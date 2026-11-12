/**
 * Isolated React state coordinator for Ambient Scenery (`ai_ambient`).
 * Manages Android Keystore OpenWeatherMap BYOK status, dual auto/manual look overrides
 * (time of day, weather mood, seasonal mode), live OpenWeatherMap syncing, and daily/random
 * DummyJSON quote caching while staying dormant when Default or OxygenOS/ColorOS is active.
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
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MaterialYouPalette } from 'react-native-material-you-colors';

import type { AyumiThemeId } from '../types';

import {
  resolveAiAmbientPaletteTokens,
  resolveAtmosphericSceneryPalette,
  type AiAmbientPaletteTokens,
  type AtmosphericSceneryPalette,
} from './ambientPalette';
import {
  deleteWeatherApiKey,
  fetchAmbientWeather,
  fetchDailyAmbientQuote,
  readAmbientKeyStatuses,
  redactAmbientSecrets,
  requestCoarseLocationPermission,
  saveWeatherApiKey,
  validateWeatherApiKey,
  type AmbientKeyStatuses,
  type AmbientQuoteSnapshot,
  type AmbientWeatherSnapshot,
} from './ambientServices';
import {
  AI_AMBIENT_STORAGE_KEYS,
  WEATHER_REFRESH_TTL_MS,
  getFallbackQuoteForContext,
  getLocalCalendarDateKey,
  isDarkTimePhase,
  resolveEffectiveSeason,
  resolveEffectiveTimePhase,
  type SeasonalOverride,
  type SeasonalVibe,
  type TimeOfDayOverride,
  type TimeOfDayPhase,
  type WeatherConditionCategory,
  type WeatherLookOverride,
} from './config';

export interface AiAmbientPreferences {
  readonly autoRefreshWeather: boolean;
  readonly useDeviceLocation: boolean;
  readonly manualCity: string;
  readonly timeOverride: TimeOfDayOverride;
  readonly weatherOverride: WeatherLookOverride;
  readonly seasonalEnabled: boolean;
  readonly seasonalOverride: SeasonalOverride;
}

const DEFAULT_PREFS: AiAmbientPreferences = {
  autoRefreshWeather: true,
  useDeviceLocation: true,
  manualCity: 'Tokyo',
  timeOverride: 'auto',
  weatherOverride: 'auto',
  seasonalEnabled: true,
  seasonalOverride: 'auto',
};

export interface AiAmbientContextValue {
  readonly isActive: boolean;
  readonly prefs: AiAmbientPreferences;
  readonly keyStatuses: AmbientKeyStatuses;
  readonly weather: AmbientWeatherSnapshot | null;
  readonly quote: string;
  readonly quoteMeta: AmbientQuoteSnapshot | null;
  readonly effectiveTimePhase: TimeOfDayPhase;
  readonly effectiveWeatherCategory: WeatherConditionCategory;
  readonly effectiveSeason: SeasonalVibe;
  readonly effectiveIsNight: boolean;
  readonly ambientPalette: AiAmbientPaletteTokens;
  readonly sceneryPalette: AtmosphericSceneryPalette;
  readonly isRefreshingWeather: boolean;
  readonly isRefreshingQuote: boolean;
  readonly lastError: string | null;
  readonly refreshStatus: () => Promise<void>;
  readonly saveWeatherKey: (plaintext: string, testCity?: string) => Promise<void>;
  readonly deleteWeatherKey: () => Promise<void>;
  readonly testWeatherKey: (candidateKey?: string, testCity?: string) => Promise<boolean>;
  readonly setAutoRefreshWeather: (enabled: boolean) => Promise<void>;
  readonly setUseDeviceLocation: (enabled: boolean) => Promise<void>;
  readonly setManualCity: (city: string) => Promise<void>;
  readonly setTimeOverride: (override: TimeOfDayOverride) => Promise<void>;
  readonly setWeatherOverride: (override: WeatherLookOverride) => Promise<void>;
  readonly setSeasonalEnabled: (enabled: boolean) => Promise<void>;
  readonly setSeasonalOverride: (override: SeasonalOverride) => Promise<void>;
  readonly refreshWeatherNow: (interactive?: boolean) => Promise<AmbientWeatherSnapshot | null>;
  readonly refreshQuoteNow: (useRandom?: boolean) => Promise<void>;
  readonly refreshAtmosphereNow: () => Promise<void>;
  readonly clearError: () => void;
}

const DEFAULT_CONTEXT_VALUE: AiAmbientContextValue = {
  isActive: false,
  prefs: DEFAULT_PREFS,
  keyStatuses: { hasWeatherKey: false, weatherMasked: '' },
  weather: null,
  quote: getFallbackQuoteForContext('morning', 'clear', 'summer', true),
  quoteMeta: null,
  effectiveTimePhase: 'morning',
  effectiveWeatherCategory: 'clear',
  effectiveSeason: 'summer',
  effectiveIsNight: false,
  ambientPalette: resolveAiAmbientPaletteTokens({
    systemPalette: null,
    isDark: false,
  }),
  sceneryPalette: resolveAtmosphericSceneryPalette({
    phase: 'morning',
    weatherCategory: 'clear',
    season: 'summer',
    seasonalEnabled: true,
  }),
  isRefreshingWeather: false,
  isRefreshingQuote: false,
  lastError: null,
  refreshStatus: async () => {},
  saveWeatherKey: async () => {},
  deleteWeatherKey: async () => {},
  testWeatherKey: async () => false,
  setAutoRefreshWeather: async () => {},
  setUseDeviceLocation: async () => {},
  setManualCity: async () => {},
  setTimeOverride: async () => {},
  setWeatherOverride: async () => {},
  setSeasonalEnabled: async () => {},
  setSeasonalOverride: async () => {},
  refreshWeatherNow: async () => null,
  refreshQuoteNow: async () => {},
  refreshAtmosphereNow: async () => {},
  clearError: () => {},
};

const AiAmbientContext = createContext<AiAmbientContextValue>(DEFAULT_CONTEXT_VALUE);

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
  const isActiveSession = activeSessionThemeId === 'ai_ambient';

  const [prefs, setPrefs] = useState<AiAmbientPreferences>(DEFAULT_PREFS);
  const [keyStatuses, setKeyStatuses] = useState<AmbientKeyStatuses>({
    hasWeatherKey: false,
    weatherMasked: '',
  });
  const [weather, setWeather] = useState<AmbientWeatherSnapshot | null>(null);
  const [quoteMeta, setQuoteMeta] = useState<AmbientQuoteSnapshot | null>(null);
  const [clockNowMs, setClockNowMs] = useState<number>(() => Date.now());
  const [isRefreshingWeather, setIsRefreshingWeather] = useState(false);
  const [isRefreshingQuote, setIsRefreshingQuote] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const statusesRef = useRef(keyStatuses);
  statusesRef.current = keyStatuses;
  const weatherRef = useRef(weather);
  weatherRef.current = weather;
  const quoteRef = useRef(quoteMeta);
  quoteRef.current = quoteMeta;
  const weatherInFlightRef = useRef(false);
  const quoteInFlightRef = useRef(false);

  const persistPrefs = useCallback(async (next: AiAmbientPreferences) => {
    setPrefs(next);
    prefsRef.current = next;
    try {
      await AsyncStorage.setItem(AI_AMBIENT_STORAGE_KEYS.PREFS, JSON.stringify(next));
    } catch {
      // Non-fatal persistence error; memory state remains current.
    }
  }, []);

  const updatePrefField = useCallback(
    async <K extends keyof AiAmbientPreferences>(key: K, value: AiAmbientPreferences[K]) => {
      const next: AiAmbientPreferences = { ...prefsRef.current, [key]: value };
      await persistPrefs(next);
    },
    [persistPrefs],
  );

  const refreshStatus = useCallback(async () => {
    const statuses = await readAmbientKeyStatuses();
    setKeyStatuses(statuses);
    statusesRef.current = statuses;
  }, []);

  const refreshQuoteNow = useCallback(async (useRandom: boolean = false) => {
    if (!isActiveSession || quoteInFlightRef.current) return;
    quoteInFlightRef.current = true;
    setIsRefreshingQuote(true);
    try {
      const p = prefsRef.current;
      const now = new Date();
      const phase = resolveEffectiveTimePhase(p.timeOverride, now);
      const category =
        p.weatherOverride === 'auto'
          ? (weatherRef.current?.conditionCategory ?? 'clear')
          : p.weatherOverride;
      const season = resolveEffectiveSeason(p.seasonalOverride, now);

      const snapshot = await fetchDailyAmbientQuote({
        useRandom,
        date: now,
        phase,
        weatherCategory: category,
        season,
        seasonalEnabled: p.seasonalEnabled,
      });

      setQuoteMeta(snapshot);
      quoteRef.current = snapshot;
      await AsyncStorage.setItem(AI_AMBIENT_STORAGE_KEYS.QUOTE_CACHE, JSON.stringify(snapshot));
    } catch {
      // Graceful fallback handled cleanly inside fetchDailyAmbientQuote.
    } finally {
      quoteInFlightRef.current = false;
      setIsRefreshingQuote(false);
    }
  }, [isActiveSession]);

  const refreshWeatherNow = useCallback(
    async (interactive: boolean = false): Promise<AmbientWeatherSnapshot | null> => {
      if (!isActiveSession || weatherInFlightRef.current) {
        return weatherRef.current;
      }
      const statuses = await readAmbientKeyStatuses();
      setKeyStatuses(statuses);
      statusesRef.current = statuses;
      if (!statuses.hasWeatherKey) {
        if (interactive) {
          setLastError('Add your OpenWeatherMap API key in Settings to sync local weather.');
        }
        return weatherRef.current;
      }

      weatherInFlightRef.current = true;
      setIsRefreshingWeather(true);
      setLastError(null);

      try {
        const currentPrefs = prefsRef.current;
        if (interactive && currentPrefs.useDeviceLocation) {
          await requestCoarseLocationPermission();
        }
        const snap = await fetchAmbientWeather(
          currentPrefs.useDeviceLocation,
          currentPrefs.manualCity,
        );
        setWeather(snap);
        weatherRef.current = snap;
        await AsyncStorage.setItem(AI_AMBIENT_STORAGE_KEYS.WEATHER_CACHE, JSON.stringify(snap));
        return snap;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setLastError(redactAmbientSecrets(msg));
        return weatherRef.current;
      } finally {
        weatherInFlightRef.current = false;
        setIsRefreshingWeather(false);
      }
    },
    [isActiveSession],
  );

  const refreshAtmosphereNow = useCallback(async () => {
    if (!isActiveSession) return;
    setClockNowMs(Date.now());
    const jobs: Promise<unknown>[] = [refreshQuoteNow(true)];
    if (statusesRef.current.hasWeatherKey) {
      jobs.push(refreshWeatherNow(false));
    }
    await Promise.all(jobs);
  }, [isActiveSession, refreshQuoteNow, refreshWeatherNow]);

  // Hydrate preferences, weather cache, daily quote cache, and key statuses once active.
  useEffect(() => {
    if (!isActiveSession) return;
    let cancelled = false;

    (async () => {
      try {
        const [rawPrefs, rawWeather, rawQuote, statuses] = await Promise.all([
          AsyncStorage.getItem(AI_AMBIENT_STORAGE_KEYS.PREFS),
          AsyncStorage.getItem(AI_AMBIENT_STORAGE_KEYS.WEATHER_CACHE),
          AsyncStorage.getItem(AI_AMBIENT_STORAGE_KEYS.QUOTE_CACHE),
          readAmbientKeyStatuses(),
        ]);
        if (cancelled) return;

        if (rawPrefs) {
          const parsed = JSON.parse(rawPrefs) as Partial<AiAmbientPreferences>;
          const merged: AiAmbientPreferences = {
            autoRefreshWeather: parsed.autoRefreshWeather ?? true,
            useDeviceLocation: parsed.useDeviceLocation ?? true,
            manualCity: parsed.manualCity ?? 'Tokyo',
            timeOverride: parsed.timeOverride ?? 'auto',
            weatherOverride: parsed.weatherOverride ?? 'auto',
            seasonalEnabled: parsed.seasonalEnabled ?? true,
            seasonalOverride: parsed.seasonalOverride ?? 'auto',
          };
          setPrefs(merged);
          prefsRef.current = merged;
        }

        if (rawWeather) {
          const parsedWeather = JSON.parse(rawWeather) as AmbientWeatherSnapshot;
          if (parsedWeather && parsedWeather.conditionCategory) {
            setWeather(parsedWeather);
            weatherRef.current = parsedWeather;
          }
        }

        const todayKey = getLocalCalendarDateKey();
        if (rawQuote) {
          const parsedQuote = JSON.parse(rawQuote) as AmbientQuoteSnapshot;
          if (parsedQuote?.quote && parsedQuote.dateKey === todayKey && !parsedQuote.isFallback) {
            setQuoteMeta(parsedQuote);
            quoteRef.current = parsedQuote;
          }
        }

        setKeyStatuses(statuses);
        statusesRef.current = statuses;
      } catch {
        // Safe hydration defaults already present in state.
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isActiveSession]);

  // Maintain live clock alignment (every minute + foreground resume) and sync daily quote / weather TTL.
  useEffect(() => {
    if (!isActiveSession || !hydrated) return;

    const runContextualSync = async () => {
      const now = Date.now();
      setClockNowMs(now);
      const todayKey = getLocalCalendarDateKey(new Date(now));

      const cachedQuote = quoteRef.current;
      if (!cachedQuote || cachedQuote.dateKey !== todayKey || cachedQuote.isFallback) {
        await refreshQuoteNow(false);
      }

      if (prefsRef.current.autoRefreshWeather && statusesRef.current.hasWeatherKey) {
        const cachedWeather = weatherRef.current;
        const stale =
          !cachedWeather || now - cachedWeather.fetchedAtMs >= WEATHER_REFRESH_TTL_MS;
        if (stale) {
          await refreshWeatherNow(false);
        }
      }
    };

    runContextualSync();

    const intervalId = setInterval(() => {
      setClockNowMs(Date.now());
    }, 60 * 1000);

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        runContextualSync();
      }
    });

    return () => {
      clearInterval(intervalId);
      subscription.remove();
    };
  }, [hydrated, isActiveSession, refreshQuoteNow, refreshWeatherNow]);

  const saveWeatherKey = useCallback(
    async (plaintext: string, testCity?: string) => {
      setLastError(null);
      await saveWeatherApiKey(plaintext);
      await refreshStatus();
      if (testCity && testCity.trim()) {
        await validateWeatherApiKey(null, testCity.trim());
      }
    },
    [refreshStatus],
  );

  const deleteWeatherKey = useCallback(async () => {
    setLastError(null);
    await deleteWeatherApiKey();
    await refreshStatus();
  }, [refreshStatus]);

  const testWeatherKey = useCallback(
    async (candidateKey?: string, testCity?: string): Promise<boolean> => {
      setLastError(null);
      try {
        await validateWeatherApiKey(
          candidateKey,
          testCity?.trim() || prefsRef.current.manualCity || 'Tokyo',
        );
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setLastError(redactAmbientSecrets(msg));
        return false;
      }
    },
    [],
  );

  const nowDate = useMemo(() => new Date(clockNowMs), [clockNowMs]);
  const effectiveTimePhase = useMemo(
    () => resolveEffectiveTimePhase(prefs.timeOverride, nowDate),
    [prefs.timeOverride, nowDate],
  );
  const effectiveWeatherCategory: WeatherConditionCategory =
    prefs.weatherOverride === 'auto'
      ? (weather?.conditionCategory ?? 'clear')
      : prefs.weatherOverride;
  const effectiveSeason = useMemo(
    () => resolveEffectiveSeason(prefs.seasonalOverride, nowDate),
    [prefs.seasonalOverride, nowDate],
  );

  const effectiveIsNight =
    prefs.timeOverride !== 'auto'
      ? isDarkTimePhase(effectiveTimePhase)
      : (weather?.isNight ?? isDarkTimePhase(effectiveTimePhase));

  const ambientPalette = useMemo(
    () =>
      resolveAiAmbientPaletteTokens({
        systemPalette,
        isDark,
      }),
    [isDark, systemPalette],
  );

  const sceneryPalette = useMemo(
    () =>
      resolveAtmosphericSceneryPalette({
        phase: effectiveTimePhase,
        weatherCategory: effectiveWeatherCategory,
        season: effectiveSeason,
        seasonalEnabled: prefs.seasonalEnabled,
      }),
    [
      effectiveSeason,
      effectiveTimePhase,
      effectiveWeatherCategory,
      prefs.seasonalEnabled,
    ],
  );

  const fallbackQuote = useMemo(
    () =>
      getFallbackQuoteForContext(
        effectiveTimePhase,
        effectiveWeatherCategory,
        effectiveSeason,
        prefs.seasonalEnabled,
      ),
    [
      effectiveSeason,
      effectiveTimePhase,
      effectiveWeatherCategory,
      prefs.seasonalEnabled,
    ],
  );

  const activeQuote = quoteMeta?.quote?.trim() || fallbackQuote;

  const value = useMemo<AiAmbientContextValue>(
    () => ({
      isActive: isActiveSession,
      prefs,
      keyStatuses,
      weather,
      quote: activeQuote,
      quoteMeta,
      effectiveTimePhase,
      effectiveWeatherCategory,
      effectiveSeason,
      effectiveIsNight,
      ambientPalette,
      sceneryPalette,
      isRefreshingWeather,
      isRefreshingQuote,
      lastError,
      refreshStatus,
      saveWeatherKey,
      deleteWeatherKey,
      testWeatherKey,
      setAutoRefreshWeather: (enabled: boolean) => updatePrefField('autoRefreshWeather', enabled),
      setUseDeviceLocation: (enabled: boolean) => updatePrefField('useDeviceLocation', enabled),
      setManualCity: (city: string) => updatePrefField('manualCity', city),
      setTimeOverride: (override: TimeOfDayOverride) => updatePrefField('timeOverride', override),
      setWeatherOverride: (override: WeatherLookOverride) =>
        updatePrefField('weatherOverride', override),
      setSeasonalEnabled: (enabled: boolean) => updatePrefField('seasonalEnabled', enabled),
      setSeasonalOverride: (override: SeasonalOverride) =>
        updatePrefField('seasonalOverride', override),
      refreshWeatherNow,
      refreshQuoteNow,
      refreshAtmosphereNow,
      clearError: () => setLastError(null),
    }),
    [
      activeQuote,
      ambientPalette,
      deleteWeatherKey,
      effectiveIsNight,
      effectiveSeason,
      effectiveTimePhase,
      effectiveWeatherCategory,
      isActiveSession,
      isRefreshingQuote,
      isRefreshingWeather,
      keyStatuses,
      lastError,
      prefs,
      quoteMeta,
      refreshAtmosphereNow,
      refreshQuoteNow,
      refreshStatus,
      refreshWeatherNow,
      saveWeatherKey,
      sceneryPalette,
      testWeatherKey,
      updatePrefField,
      weather,
    ],
  );

  return (
    <AiAmbientContext.Provider value={value}>
      {children}
    </AiAmbientContext.Provider>
  );
}

export function useAiAmbient(): AiAmbientContextValue {
  return useContext(AiAmbientContext);
}
