/**
 * AiAmbientContext — orchestrates non-secret AI Ambient state, Keystore key status,
 * weather/quote/artwork context-fingerprint caching, local OKLab palette switching, and
 * non-blocking manual or cooldown-guarded regeneration.
 *
 * When Default or OxygenOS / ColorOS is active in the session, AI Ambient triggers ZERO
 * background network, Gemini, OpenWeatherMap, or location calls.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MaterialYouPalette } from 'react-native-material-you-colors';

import { AYUMI_BASELINE_SEED, PALETTE_SHADE, resolveCompleteDynamicPalette } from '../paletteUtils';
import type { AyumiThemeId } from '../types';
import {
  AI_AMBIENT_CACHE_STORAGE_KEY,
  AI_AMBIENT_PREFS_STORAGE_KEY,
  AUTO_ARTWORK_COOLDOWN_MS,
  WEATHER_CACHE_TTL_MS,
  getFallbackQuoteForContext,
  resolveTimeOfDayPhase,
} from './config';
import {
  type AiAmbientColourSource,
  type AiAmbientPaletteTokens,
  type ExtractedArtworkPalette,
  resolveAiAmbientPaletteTokens,
} from './ambientPalette';
import {
  type AmbientArtworkSnapshot,
  type AmbientKeyStatuses,
  type AmbientWeatherSnapshot,
  buildAmbientContextFingerprint,
  fetchAmbientWeather,
  generateAmbientArtworkAsset,
  generateAmbientQuoteText,
  readAmbientKeyStatuses,
  redactAmbientSecrets,
  removeAmbientSecretKey,
  requestCoarseLocationPermission,
  storeAmbientSecretKey,
  validateStoredGeminiKey,
  validateStoredWeatherKey,
  verifyStoredArtworkFile,
} from './ambientServices';

export interface AiAmbientPreferences {
  readonly colourSource: AiAmbientColourSource;
  readonly manualCity: string;
  readonly useDeviceLocation: boolean;
  readonly autoRefreshEnabled: boolean;
}

const DEFAULT_PREFS: AiAmbientPreferences = {
  colourSource: 'artwork',
  manualCity: '',
  useDeviceLocation: true,
  autoRefreshEnabled: true,
};

interface PersistedAmbientCache {
  readonly weather: AmbientWeatherSnapshot | null;
  readonly quote: string | null;
  readonly quoteFingerprint: string | null;
  readonly artwork: AmbientArtworkSnapshot | null;
  readonly artworkFingerprint: string | null;
  readonly extractedPalette: ExtractedArtworkPalette | null;
}

const EMPTY_CACHE: PersistedAmbientCache = {
  weather: null,
  quote: null,
  quoteFingerprint: null,
  artwork: null,
  artworkFingerprint: null,
  extractedPalette: null,
};

export interface AiAmbientContextValue {
  readonly prefs: AiAmbientPreferences;
  readonly keyStatuses: AmbientKeyStatuses;
  readonly weather: AmbientWeatherSnapshot | null;
  readonly quote: string;
  readonly artwork: AmbientArtworkSnapshot | null;
  readonly extractedPalette: ExtractedArtworkPalette | null;
  readonly ambientPalette: AiAmbientPaletteTokens;
  readonly isGeneratingArtwork: boolean;
  readonly isRefreshingWeather: boolean;
  readonly statusMessage: string | null;
  readonly lastError: string | null;
  readonly refreshWeatherNow: (silent?: boolean) => Promise<AmbientWeatherSnapshot | null>;
  readonly regenerateArtworkAndQuote: () => Promise<void>;
  readonly setColourSource: (source: AiAmbientColourSource) => Promise<void>;
  readonly setManualCity: (city: string) => Promise<void>;
  readonly setUseDeviceLocation: (enabled: boolean) => Promise<void>;
  readonly setAutoRefreshEnabled: (enabled: boolean) => Promise<void>;
  readonly saveGeminiKey: (rawKey: string) => Promise<void>;
  readonly deleteGeminiKey: () => Promise<void>;
  readonly testGeminiKey: (rawKeyDraft?: string) => Promise<string>;
  readonly saveWeatherKey: (rawKey: string) => Promise<void>;
  readonly deleteWeatherKey: () => Promise<void>;
  readonly testWeatherKey: (rawKeyDraft?: string) => Promise<string>;
  readonly requestLocationAccess: () => Promise<boolean>;
  readonly clearDiagnostics: () => void;
}

const AiAmbientContext = createContext<AiAmbientContextValue | null>(null);

interface AiAmbientProviderProps {
  readonly activeSessionThemeId: AyumiThemeId;
  readonly systemPalette: MaterialYouPalette | null | undefined;
  readonly isDark: boolean;
  readonly children: React.ReactNode;
}

export function AiAmbientProvider({
  activeSessionThemeId,
  systemPalette,
  isDark,
  children,
}: AiAmbientProviderProps): React.JSX.Element {
  const [prefs, setPrefs] = useState<AiAmbientPreferences>(DEFAULT_PREFS);
  const [cache, setCache] = useState<PersistedAmbientCache>(EMPTY_CACHE);
  const [keyStatuses, setKeyStatuses] = useState<AmbientKeyStatuses>({
    hasGeminiKey: false,
    geminiMasked: '',
    hasWeatherKey: false,
    weatherMasked: '',
  });
  const [cacheHydrated, setCacheHydrated] = useState(false);
  const [isGeneratingArtwork, setIsGeneratingArtwork] = useState(false);
  const [isRefreshingWeather, setIsRefreshingWeather] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const cacheRef = useRef(cache);
  cacheRef.current = cache;
  const keyStatusesRef = useRef(keyStatuses);
  keyStatusesRef.current = keyStatuses;
  const isGeneratingRef = useRef(isGeneratingArtwork);
  isGeneratingRef.current = isGeneratingArtwork;
  const lastAutoCheckMsRef = useRef(0);

  const completeSystemPalette = useMemo(
    () => resolveCompleteDynamicPalette(systemPalette, AYUMI_BASELINE_SEED, 'TONAL_SPOT'),
    [systemPalette],
  );
  const systemPrimaryHint = completeSystemPalette.system_accent1[PALETTE_SHADE.T500];

  const ambientPalette = useMemo(
    () =>
      resolveAiAmbientPaletteTokens({
        colourSource: prefs.colourSource,
        systemPalette,
        artworkPalette: cache.extractedPalette,
        isDark,
      }),
    [prefs.colourSource, systemPalette, cache.extractedPalette, isDark],
  );
  const ambientPaletteRef = useRef(ambientPalette);
  ambientPaletteRef.current = ambientPalette;

  const persistPrefs = useCallback(async (next: AiAmbientPreferences) => {
    setPrefs(next);
    await AsyncStorage.setItem(AI_AMBIENT_PREFS_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const persistCache = useCallback(async (next: PersistedAmbientCache) => {
    setCache(next);
    await AsyncStorage.setItem(AI_AMBIENT_CACHE_STORAGE_KEY, JSON.stringify(next));
  }, []);

  // Hydrate Keystore key existence + non-secret prefs + cached metadata cleanly.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [rawPrefs, rawCache, keys] = await Promise.all([
          AsyncStorage.getItem(AI_AMBIENT_PREFS_STORAGE_KEY),
          AsyncStorage.getItem(AI_AMBIENT_CACHE_STORAGE_KEY),
          readAmbientKeyStatuses(),
        ]);

        if (!mounted) return;
        setKeyStatuses(keys);

        if (rawPrefs) {
          const parsedPrefs = JSON.parse(rawPrefs) as Partial<AiAmbientPreferences>;
          setPrefs({
            colourSource: parsedPrefs.colourSource === 'system' ? 'system' : 'artwork',
            manualCity: typeof parsedPrefs.manualCity === 'string' ? parsedPrefs.manualCity : '',
            useDeviceLocation: parsedPrefs.useDeviceLocation !== false,
            autoRefreshEnabled: parsedPrefs.autoRefreshEnabled !== false,
          });
        }

        if (rawCache) {
          const parsedCache = JSON.parse(rawCache) as Partial<PersistedAmbientCache>;
          let validArtwork = parsedCache.artwork ?? null;
          if (validArtwork?.path || validArtwork?.uri) {
            const verified = await verifyStoredArtworkFile(validArtwork.path || validArtwork.uri);
            if (!verified) {
              validArtwork = null;
            } else {
              validArtwork = { ...validArtwork, path: verified.path, uri: verified.uri };
            }
          }
          if (!mounted) return;
          setCache({
            weather: parsedCache.weather ?? null,
            quote: typeof parsedCache.quote === 'string' ? parsedCache.quote : null,
            quoteFingerprint: parsedCache.quoteFingerprint ?? null,
            artwork: validArtwork,
            artworkFingerprint: validArtwork ? parsedCache.artworkFingerprint ?? null : null,
            extractedPalette: validArtwork ? parsedCache.extractedPalette ?? null : null,
          });
        }
      } catch {
        // Ignore corrupt local cache silently; clean fallback surfaces take over.
      } finally {
        if (mounted) {
          setCacheHydrated(true);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const refreshWeatherNow = useCallback(
    async (silent: boolean = false): Promise<AmbientWeatherSnapshot | null> => {
      if (!keyStatusesRef.current.hasWeatherKey) {
        if (!silent) {
          setLastError('Add an OpenWeatherMap API key in Settings to sync local weather.');
        }
        return null;
      }
      setIsRefreshingWeather(true);
      if (!silent) {
        setLastError(null);
      }
      try {
        const snapshot = await fetchAmbientWeather({
          useDeviceLocation: prefsRef.current.useDeviceLocation,
          manualCity: prefsRef.current.manualCity,
        });
        const nextCache: PersistedAmbientCache = {
          ...cacheRef.current,
          weather: snapshot,
        };
        await persistCache(nextCache);
        if (!silent) {
          setStatusMessage('Weather synced.');
        }
        return snapshot;
      } catch (err) {
        if (!silent) {
          setLastError(redactAmbientSecrets(err));
        }
        return cacheRef.current.weather;
      } finally {
        setIsRefreshingWeather(false);
      }
    },
    [persistCache],
  );

  const runAmbientGeneration = useCallback(
    async ({
      weatherSnapshot,
      force,
    }: {
      readonly weatherSnapshot: AmbientWeatherSnapshot | null;
      readonly force: boolean;
    }): Promise<void> => {
      if (!keyStatusesRef.current.hasGeminiKey) {
        if (force) {
          setLastError('Add a Gemini API key in Settings to generate AI Ambient artwork.');
        }
        return;
      }
      if (isGeneratingRef.current) {
        return;
      }

      const nowMs = Date.now();
      const currentPrefs = prefsRef.current;
      const currentCache = cacheRef.current;
      const timePhase = resolveTimeOfDayPhase(new Date(nowMs));
      const fingerprint = buildAmbientContextFingerprint({
        timePhase,
        weatherCategory: weatherSnapshot?.conditionCategory ?? null,
        isNight: weatherSnapshot ? weatherSnapshot.isNight : timePhase === 'night',
        temperatureC: weatherSnapshot?.temperatureC ?? null,
        colourSource: currentPrefs.colourSource,
        systemPrimaryHint,
      });

      if (!force) {
        const artworkAgeMs = currentCache.artwork
          ? nowMs - currentCache.artwork.generatedAtMs
          : Number.POSITIVE_INFINITY;
        const alreadyFresh =
          currentCache.artwork != null &&
          (currentCache.artworkFingerprint === fingerprint ||
            artworkAgeMs < AUTO_ARTWORK_COOLDOWN_MS);
        if (alreadyFresh) {
          return;
        }
      }

      setIsGeneratingArtwork(true);
      setLastError(null);
      if (force) {
        setStatusMessage('Crafting new ambient artwork...');
      }

      try {
        // Resolve the palette direction sent to Gemini: in System palette mode follow OS seed;
        // in Artwork mode use current artwork direction or atmospheric seasonal tones.
        const promptPaletteHint =
          currentPrefs.colourSource === 'system'
            ? ambientPaletteRef.current.summaryPromptPaletteHint
            : currentCache.extractedPalette != null
              ? ambientPaletteRef.current.summaryPromptPaletteHint
              : timePhase === 'evening'
                ? 'warm dusk amber, twilight indigo, and delicate blossom tones'
                : timePhase === 'night'
                  ? 'serene midnight blue and soft lantern amber'
                  : 'fresh sky azure, gentle emerald foliage, and warm sunlight';

        const [artResult, quoteResult] = await Promise.allSettled([
          generateAmbientArtworkAsset({
            weather: weatherSnapshot,
            paletteHint: promptPaletteHint,
          }),
          generateAmbientQuoteText({ weather: weatherSnapshot }),
        ]);

        let nextArtwork = currentCache.artwork;
        let nextArtworkFingerprint = currentCache.artworkFingerprint;
        let nextExtractedPalette = currentCache.extractedPalette;
        let nextQuote = currentCache.quote;
        let nextQuoteFingerprint = currentCache.quoteFingerprint;
        const errors: string[] = [];

        if (artResult.status === 'fulfilled') {
          nextArtwork = artResult.value.artwork;
          nextExtractedPalette = artResult.value.extractedPalette;
          nextArtworkFingerprint = fingerprint;
        } else {
          errors.push(redactAmbientSecrets(artResult.reason));
        }

        if (quoteResult.status === 'fulfilled' && quoteResult.value.trim().length > 0) {
          nextQuote = quoteResult.value.trim();
          nextQuoteFingerprint = fingerprint;
        } else if (quoteResult.status === 'rejected' && artResult.status === 'rejected') {
          errors.push(redactAmbientSecrets(quoteResult.reason));
        }

        await persistCache({
          weather: weatherSnapshot ?? currentCache.weather,
          quote: nextQuote,
          quoteFingerprint: nextQuoteFingerprint,
          artwork: nextArtwork,
          artworkFingerprint: nextArtworkFingerprint,
          extractedPalette: nextExtractedPalette,
        });

        if (errors.length > 0) {
          setLastError(errors[0]);
          setStatusMessage(null);
        } else {
          setStatusMessage('Ambient scenery updated.');
        }
      } finally {
        setIsGeneratingArtwork(false);
      }
    },
    [persistCache, systemPrimaryHint],
  );

  const regenerateArtworkAndQuote = useCallback(async () => {
    let weatherSnapshot = cacheRef.current.weather;
    if (keyStatusesRef.current.hasWeatherKey) {
      weatherSnapshot = await refreshWeatherNow(true);
    }
    await runAmbientGeneration({ weatherSnapshot, force: true });
  }, [refreshWeatherNow, runAmbientGeneration]);

  // Isolated contextual refresh: strictly runs ONLY when `activeSessionThemeId === 'ai_ambient'`.
  const checkContextualRefreshIfNeeded = useCallback(async () => {
    if (activeSessionThemeId !== 'ai_ambient' || !cacheHydrated) return;
    if (!prefsRef.current.autoRefreshEnabled) return;

    const nowMs = Date.now();
    if (nowMs - lastAutoCheckMsRef.current < 60_000) return;
    lastAutoCheckMsRef.current = nowMs;

    let latestWeather = cacheRef.current.weather;
    const weatherStale =
      !latestWeather || nowMs - latestWeather.fetchedAtMs > WEATHER_CACHE_TTL_MS;
    if (weatherStale && keyStatusesRef.current.hasWeatherKey) {
      latestWeather = await refreshWeatherNow(true);
    }

    if (keyStatusesRef.current.hasGeminiKey) {
      await runAmbientGeneration({ weatherSnapshot: latestWeather, force: false });
    }
  }, [activeSessionThemeId, cacheHydrated, refreshWeatherNow, runAmbientGeneration]);

  useEffect(() => {
    if (activeSessionThemeId !== 'ai_ambient' || !cacheHydrated) return;
    checkContextualRefreshIfNeeded();

    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        checkContextualRefreshIfNeeded();
      }
    });
    return () => sub.remove();
  }, [activeSessionThemeId, cacheHydrated, checkContextualRefreshIfNeeded]);

  const setColourSource = useCallback(
    async (colourSource: AiAmbientColourSource) => {
      await persistPrefs({ ...prefsRef.current, colourSource });
    },
    [persistPrefs],
  );

  const setManualCity = useCallback(
    async (manualCity: string) => {
      await persistPrefs({ ...prefsRef.current, manualCity: manualCity.trim() });
    },
    [persistPrefs],
  );

  const setUseDeviceLocation = useCallback(
    async (useDeviceLocation: boolean) => {
      await persistPrefs({ ...prefsRef.current, useDeviceLocation });
    },
    [persistPrefs],
  );

  const setAutoRefreshEnabled = useCallback(
    async (autoRefreshEnabled: boolean) => {
      await persistPrefs({ ...prefsRef.current, autoRefreshEnabled });
    },
    [persistPrefs],
  );

  const saveGeminiKey = useCallback(async (rawKey: string) => {
    const res = await storeAmbientSecretKey('gemini', rawKey);
    setKeyStatuses(prev => ({
      ...prev,
      hasGeminiKey: res.hasKey,
      geminiMasked: res.masked,
    }));
    setLastError(null);
    setStatusMessage('Gemini API key stored in Android Keystore.');
  }, []);

  const deleteGeminiKey = useCallback(async () => {
    await removeAmbientSecretKey('gemini');
    setKeyStatuses(prev => ({
      ...prev,
      hasGeminiKey: false,
      geminiMasked: '',
    }));
    setStatusMessage('Gemini API key removed.');
  }, []);

  const testGeminiKey = useCallback(async (rawKeyDraft?: string): Promise<string> => {
    try {
      await validateStoredGeminiKey(rawKeyDraft);
      const msg = 'Gemini API connection verified.';
      setLastError(null);
      setStatusMessage(msg);
      return msg;
    } catch (err) {
      const clean = redactAmbientSecrets(err);
      setLastError(clean);
      throw new Error(clean);
    }
  }, []);

  const saveWeatherKey = useCallback(async (rawKey: string) => {
    const res = await storeAmbientSecretKey('openweathermap', rawKey);
    setKeyStatuses(prev => ({
      ...prev,
      hasWeatherKey: res.hasKey,
      weatherMasked: res.masked,
    }));
    setLastError(null);
    setStatusMessage('OpenWeatherMap API key stored in Android Keystore.');
  }, []);

  const deleteWeatherKey = useCallback(async () => {
    await removeAmbientSecretKey('openweathermap');
    setKeyStatuses(prev => ({
      ...prev,
      hasWeatherKey: false,
      weatherMasked: '',
    }));
    setStatusMessage('OpenWeatherMap API key removed.');
  }, []);

  const testWeatherKey = useCallback(async (rawKeyDraft?: string): Promise<string> => {
    try {
      await validateStoredWeatherKey(rawKeyDraft, prefsRef.current.manualCity || 'Tokyo');
      const msg = 'OpenWeatherMap connection verified.';
      setLastError(null);
      setStatusMessage(msg);
      return msg;
    } catch (err) {
      const clean = redactAmbientSecrets(err);
      setLastError(clean);
      throw new Error(clean);
    }
  }, []);

  const requestLocationAccess = useCallback(async () => {
    return requestCoarseLocationPermission();
  }, []);

  const clearDiagnostics = useCallback(() => {
    setStatusMessage(null);
    setLastError(null);
  }, []);

  const resolvedQuote = useMemo(() => {
    if (cache.quote && cache.quote.trim().length > 0) {
      return cache.quote.trim();
    }
    return getFallbackQuoteForContext(
      resolveTimeOfDayPhase(),
      cache.weather?.conditionCategory ?? null,
    );
  }, [cache.quote, cache.weather?.conditionCategory]);

  const value = useMemo<AiAmbientContextValue>(
    () => ({
      prefs,
      keyStatuses,
      weather: cache.weather,
      quote: resolvedQuote,
      artwork: cache.artwork,
      extractedPalette: cache.extractedPalette,
      ambientPalette,
      isGeneratingArtwork,
      isRefreshingWeather,
      statusMessage,
      lastError,
      refreshWeatherNow,
      regenerateArtworkAndQuote,
      setColourSource,
      setManualCity,
      setUseDeviceLocation,
      setAutoRefreshEnabled,
      saveGeminiKey,
      deleteGeminiKey,
      testGeminiKey,
      saveWeatherKey,
      deleteWeatherKey,
      testWeatherKey,
      requestLocationAccess,
      clearDiagnostics,
    }),
    [
      prefs,
      keyStatuses,
      cache.weather,
      resolvedQuote,
      cache.artwork,
      cache.extractedPalette,
      ambientPalette,
      isGeneratingArtwork,
      isRefreshingWeather,
      statusMessage,
      lastError,
      refreshWeatherNow,
      regenerateArtworkAndQuote,
      setColourSource,
      setManualCity,
      setUseDeviceLocation,
      setAutoRefreshEnabled,
      saveGeminiKey,
      deleteGeminiKey,
      testGeminiKey,
      saveWeatherKey,
      deleteWeatherKey,
      testWeatherKey,
      requestLocationAccess,
      clearDiagnostics,
    ],
  );

  return React.createElement(AiAmbientContext.Provider, { value }, children);
}

/**
 * Reads live AI Ambient state and palette controls. Safe to call in tests or views outside
 * an `AiAmbientProvider`, returning a neutral non-networked fallback snapshot cleanly.
 */
export function useAiAmbient(): AiAmbientContextValue {
  const ctx = useContext(AiAmbientContext);
  return useMemo(() => {
    if (ctx) return ctx;
    const fallbackTokens = resolveAiAmbientPaletteTokens({
      colourSource: 'system',
      systemPalette: null,
      artworkPalette: null,
      isDark: false,
    });
    return {
      prefs: DEFAULT_PREFS,
      keyStatuses: {
        hasGeminiKey: false,
        geminiMasked: '',
        hasWeatherKey: false,
        weatherMasked: '',
      },
      weather: null,
      quote: getFallbackQuoteForContext(resolveTimeOfDayPhase(), null),
      artwork: null,
      extractedPalette: null,
      ambientPalette: fallbackTokens,
      isGeneratingArtwork: false,
      isRefreshingWeather: false,
      statusMessage: null,
      lastError: null,
      refreshWeatherNow: async () => null,
      regenerateArtworkAndQuote: async () => {},
      setColourSource: async () => {},
      setManualCity: async () => {},
      setUseDeviceLocation: async () => {},
      setAutoRefreshEnabled: async () => {},
      saveGeminiKey: async () => {},
      deleteGeminiKey: async () => {},
      testGeminiKey: async () => 'Unavailable outside provider.',
      saveWeatherKey: async () => {},
      deleteWeatherKey: async () => {},
      testWeatherKey: async () => 'Unavailable outside provider.',
      requestLocationAccess: async () => false,
      clearDiagnostics: () => {},
    };
  }, [ctx]);
}

