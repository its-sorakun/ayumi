/**
 * Native Keystore, OpenWeatherMap current-weather, coarse location, and free
 * DummyJSON daily quote client services for Ayumi's Ambient Scenery theme.
 * Contains zero generative-AI keys, endpoints, or prompt payloads.
 */

import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

import {
  DAILY_QUOTE_POOL_SIZE,
  DUMMYJSON_QUOTE_BASE,
  QUOTE_MAX_LENGTH,
  getDailyQuoteSeedId,
  getFallbackQuoteForContext,
  getLocalCalendarDateKey,
  type SeasonalVibe,
  type TimeOfDayPhase,
  type WeatherConditionCategory,
} from './config';

interface NativeAyumiAmbientBridge {
  setSecretKey(alias: string, plaintext: string): Promise<{ hasKey: boolean; masked: string }>;
  getAllKeyStatuses(): Promise<{ hasWeatherKey: boolean; weatherMasked: string }>;
  deleteSecretKey(alias: string): Promise<{ hasKey: boolean; masked: string }>;
  validateWeatherKey(
    optionalOverrideKey: string | null,
    cityOrTest: string | null,
  ): Promise<{ valid: boolean; statusCode: number }>;
  fetchCurrentWeather(
    hasCoords: boolean,
    lat: number,
    lon: number,
    cityQuery: string | null,
  ): Promise<{
    temperatureC?: number;
    conditionId: number;
    conditionMain: string;
    conditionDescription: string;
    iconCode: string;
    isNight: boolean;
    fetchedAtMs: number;
    source: 'gps' | 'city';
    cityLabel?: string;
  }>;
  fetchDailyQuote?: (
    dailySeedId: number,
    useRandom: boolean,
  ) => Promise<{
    id: number;
    quote: string;
    author: string;
  }>;
  getApproximateLocation(): Promise<{ lat: number; lon: number; timestampMs: number }>;
}

function getNativeAmbient(): NativeAyumiAmbientBridge | undefined {
  return NativeModules.AyumiAmbient as NativeAyumiAmbientBridge | undefined;
}

export interface AmbientKeyStatuses {
  readonly hasWeatherKey: boolean;
  readonly weatherMasked: string;
}

export interface AmbientWeatherSnapshot {
  readonly temperatureC: number | null;
  readonly conditionId: number;
  readonly conditionMain: string;
  readonly conditionDescription: string;
  readonly iconCode: string;
  readonly conditionCategory: WeatherConditionCategory;
  readonly isNight: boolean;
  readonly fetchedAtMs: number;
  readonly source: 'gps' | 'city';
  readonly cityLabel?: string;
}

export interface AmbientQuoteSnapshot {
  readonly id: number;
  readonly quote: string;
  readonly author: string;
  readonly dateKey: string;
  readonly fetchedAtMs: number;
  readonly isFallback: boolean;
}

const OWM_KEY_QUERY_RE = /([?&](?:appid|key)=)[^&\s]+/gi;
const BEARER_TOKEN_RE = /(Bearer\s+)[A-Za-z0-9._-]+/gi;

/** Scrubs API keys or bearer tokens before logging or rendering error strings. */
export function redactAmbientSecrets(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(OWM_KEY_QUERY_RE, '$1[REDACTED]')
    .replace(BEARER_TOKEN_RE, '$1[REDACTED]');
}

/** Normalizes OpenWeatherMap numeric condition IDs into 8 visual weather looks. */
export function normalizeWeatherCategory(
  conditionId: number,
  conditionMain: string = '',
): WeatherConditionCategory {
  if (conditionId >= 200 && conditionId < 300) return 'thunderstorm';
  if (conditionId >= 300 && conditionId < 400) return 'drizzle';
  if (conditionId >= 500 && conditionId < 600) return 'rain';
  if (conditionId >= 600 && conditionId < 700) return 'snow';
  if (conditionId >= 700 && conditionId < 800) return 'mist';
  if (conditionId === 800) return 'clear';
  if (conditionId === 801 || conditionId === 802) return 'few_clouds';
  if (conditionId >= 803 && conditionId <= 804) return 'cloudy';

  const lower = conditionMain.toLowerCase();
  if (lower.includes('thunder')) return 'thunderstorm';
  if (lower.includes('drizzle')) return 'drizzle';
  if (lower.includes('rain')) return 'rain';
  if (lower.includes('snow')) return 'snow';
  if (lower.includes('mist') || lower.includes('fog') || lower.includes('haze')) return 'mist';
  if (lower.includes('cloud')) return 'cloudy';
  return 'clear';
}

export function formatAmbientTemperature(tempC?: number | null): string {
  if (tempC == null || !Number.isFinite(tempC)) {
    return '--°';
  }
  return `${Math.round(tempC)}°`;
}

/** Formats DummyJSON quotes cleanly to fit the compact 2-line scenic header strip. */
export function formatCompactAmbientQuote(rawQuote: string, author: string = ''): string {
  const cleaned = rawQuote.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  const cleanAuthor = author.replace(/\s+/g, ' ').trim();
  const attributed =
    cleanAuthor.length > 0 && cleaned.length + cleanAuthor.length + 5 <= QUOTE_MAX_LENGTH
      ? `${cleaned} — ${cleanAuthor}`
      : cleaned;

  if (attributed.length <= QUOTE_MAX_LENGTH) {
    return attributed;
  }
  const sliced = attributed.slice(0, QUOTE_MAX_LENGTH - 1);
  const lastSpace = sliced.lastIndexOf(' ');
  const cutoff = lastSpace > Math.floor(QUOTE_MAX_LENGTH * 0.6) ? lastSpace : sliced.length;
  return `${sliced.slice(0, cutoff).trimEnd()}…`;
}

function getAmbientBridgeOrThrow(): NativeAyumiAmbientBridge {
  const bridge = getNativeAmbient();
  if (!bridge) {
    throw new Error('AyumiAmbient native module is unavailable on this build.');
  }
  return bridge;
}

export async function readAmbientKeyStatuses(): Promise<AmbientKeyStatuses> {
  const bridge = getNativeAmbient();
  if (!bridge?.getAllKeyStatuses) {
    return { hasWeatherKey: false, weatherMasked: '' };
  }
  try {
    const res = await bridge.getAllKeyStatuses();
    return {
      hasWeatherKey: Boolean(res?.hasWeatherKey),
      weatherMasked: res?.weatherMasked ?? '',
    };
  } catch {
    return { hasWeatherKey: false, weatherMasked: '' };
  }
}

export async function saveWeatherApiKey(
  plaintext: string,
): Promise<{ hasKey: boolean; masked: string }> {
  const trimmed = plaintext.trim();
  if (!trimmed) {
    throw new Error('Enter a valid OpenWeatherMap API key before saving.');
  }
  return getAmbientBridgeOrThrow().setSecretKey('openweathermap', trimmed);
}

export async function deleteWeatherApiKey(): Promise<void> {
  const bridge = getNativeAmbient();
  if (!bridge?.deleteSecretKey) return;
  await bridge.deleteSecretKey('openweathermap');
}

export async function validateWeatherApiKey(
  optionalOverrideKey?: string | null,
  cityOrTest?: string | null,
): Promise<{ valid: boolean; statusCode: number }> {
  const bridge = getAmbientBridgeOrThrow();
  try {
    return await bridge.validateWeatherKey(optionalOverrideKey?.trim() || null, cityOrTest || 'Tokyo');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(redactAmbientSecrets(msg));
  }
}

export async function requestCoarseLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const already = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    );
    if (already) return true;
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      {
        title: 'Approximate location for local weather',
        message:
          'Ayumi uses coarse location only to query local current weather conditions. GPS coordinates are never stored.',
        buttonPositive: 'Allow',
        buttonNegative: 'Use manual city',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export async function fetchAmbientWeather(
  useDeviceLocation: boolean,
  fallbackCity: string,
): Promise<AmbientWeatherSnapshot> {
  const bridge = getAmbientBridgeOrThrow();
  let hasCoords = false;
  let lat = 0;
  let lon = 0;

  if (useDeviceLocation) {
    try {
      const hasPerm =
        Platform.OS === 'android'
          ? await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION)
          : false;
      if (hasPerm) {
        const loc = await bridge.getApproximateLocation();
        if (Number.isFinite(loc.lat) && Number.isFinite(loc.lon)) {
          hasCoords = true;
          lat = loc.lat;
          lon = loc.lon;
        }
      }
    } catch {
      // Fall back cleanly to manual city if coarse GPS is temporarily disabled.
    }
  }

  if (!hasCoords && !fallbackCity.trim()) {
    throw new Error('Enable coarse location permission or enter a city name in Settings.');
  }

  try {
    const res = await bridge.fetchCurrentWeather(hasCoords, lat, lon, fallbackCity.trim() || null);
    return {
      temperatureC:
        typeof res.temperatureC === 'number' && Number.isFinite(res.temperatureC)
          ? res.temperatureC
          : null,
      conditionId: res.conditionId,
      conditionMain: res.conditionMain,
      conditionDescription: res.conditionDescription,
      iconCode: res.iconCode,
      conditionCategory: normalizeWeatherCategory(res.conditionId, res.conditionMain),
      isNight: Boolean(res.isNight),
      fetchedAtMs: res.fetchedAtMs || Date.now(),
      source: res.source,
      cityLabel: res.cityLabel,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(redactAmbientSecrets(msg));
  }
}

export async function fetchDailyAmbientQuote({
  useRandom = false,
  date = new Date(),
  phase,
  weatherCategory,
  season,
  seasonalEnabled,
}: {
  readonly useRandom?: boolean;
  readonly date?: Date;
  readonly phase: TimeOfDayPhase;
  readonly weatherCategory: WeatherConditionCategory;
  readonly season: SeasonalVibe;
  readonly seasonalEnabled: boolean;
}): Promise<AmbientQuoteSnapshot> {
  const dateKey = getLocalCalendarDateKey(date);
  const seedId = Math.min(DAILY_QUOTE_POOL_SIZE, Math.max(1, getDailyQuoteSeedId(date)));

  try {
    let rawId = seedId;
    let rawQuote = '';
    let rawAuthor = '';

    const bridge = getNativeAmbient();
    if (bridge?.fetchDailyQuote) {
      const nativeRes = await bridge.fetchDailyQuote(seedId, useRandom);
      rawId = nativeRes.id ?? seedId;
      rawQuote = nativeRes.quote ?? '';
      rawAuthor = nativeRes.author ?? '';
    } else if (typeof fetch === 'function') {
      const url = useRandom
        ? `${DUMMYJSON_QUOTE_BASE}/random`
        : `${DUMMYJSON_QUOTE_BASE}/${seedId}`;
      const resp = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!resp.ok) {
        throw new Error(`Quote API HTTP ${resp.status}`);
      }
      const payload = (await resp.json()) as { id?: number; quote?: string; author?: string };
      rawId = typeof payload.id === 'number' ? payload.id : seedId;
      rawQuote = typeof payload.quote === 'string' ? payload.quote : '';
      rawAuthor = typeof payload.author === 'string' ? payload.author : '';
    }

    const formatted = formatCompactAmbientQuote(rawQuote, rawAuthor);
    if (!formatted) {
      throw new Error('Empty quote response');
    }

    return {
      id: rawId,
      quote: formatted,
      author: rawAuthor.trim(),
      dateKey,
      fetchedAtMs: Date.now(),
      isFallback: false,
    };
  } catch {
    return {
      id: 0,
      quote: getFallbackQuoteForContext(phase, weatherCategory, season, seasonalEnabled),
      author: '',
      dateKey,
      fetchedAtMs: Date.now(),
      isFallback: true,
    };
  }
}
