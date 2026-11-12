/**
 * Core AI Ambient service abstractions:
 *  - Typed wrapper around native Android `AyumiAmbient` module (Keystore secrets, HTTPS APIs,
 *    local image cache verification, OKLab palette extraction, coarse location)
 *  - Deterministic context fingerprint engine preventing spurious artwork/quote regenerations
 *  - Privacy-preserving Gemini artwork and short quote prompt builders
 *  - Credential redaction & weather condition categorization helpers
 */

import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

import {
  GEMINI_IMAGE_ASPECT_RATIO,
  GEMINI_IMAGE_MODELS,
  GEMINI_IMAGE_SIZE,
  GEMINI_TEXT_MODELS,
  TimeOfDayPhase,
  WeatherConditionCategory,
  getTemperatureRangeBucket,
  resolveTimeOfDayPhase,
} from './config';
import type { AiAmbientColourSource, ExtractedArtworkPalette } from './ambientPalette';

export interface AmbientWeatherSnapshot {
  readonly temperatureC: number;
  readonly conditionId: number;
  readonly conditionMain: string;
  readonly conditionDescription: string;
  readonly conditionCategory: WeatherConditionCategory;
  readonly isNight: boolean;
  readonly fetchedAtMs: number;
  readonly source: 'gps' | 'city';
  readonly cityLabel?: string;
}

export interface AmbientArtworkSnapshot {
  readonly path: string;
  readonly uri: string;
  readonly width: number;
  readonly height: number;
  readonly generatedAtMs: number;
  readonly modelUsed: string;
}

export interface AmbientKeyStatuses {
  readonly hasGeminiKey: boolean;
  readonly geminiMasked: string;
  readonly hasWeatherKey: boolean;
  readonly weatherMasked: string;
}

export interface NativeAyumiAmbientBridge {
  setSecretKey(alias: 'gemini' | 'openweathermap', plaintext: string): Promise<{ hasKey: boolean; masked: string }>;
  getAllKeyStatuses(): Promise<AmbientKeyStatuses>;
  deleteSecretKey(alias: 'gemini' | 'openweathermap'): Promise<{ hasKey: boolean; masked: string }>;
  validateGeminiKey(optionalOverrideKey: string | null): Promise<{ valid: boolean; statusCode: number }>;
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
    temperatureC: number;
    conditionId: number;
    conditionMain: string;
    conditionDescription: string;
    iconCode: string;
    isNight: boolean;
    fetchedAtMs: number;
    source: 'gps' | 'city';
    cityLabel?: string;
  }>;
  generateQuote(
    prompt: string,
    modelCandidates: readonly string[],
  ): Promise<{ quote: string; modelUsed: string }>;
  generateArtwork(
    prompt: string,
    aspectRatio: string,
    imageSize: string,
    modelCandidates: readonly string[],
  ): Promise<{
    path: string;
    uri: string;
    width: number;
    height: number;
    generatedAtMs: number;
    modelUsed: string;
    palette: ExtractedArtworkPalette;
  }>;
  extractPaletteFromFile(pathOrUri: string): Promise<ExtractedArtworkPalette>;
  verifyCachedArtwork(pathOrUri: string): Promise<{
    path: string;
    uri: string;
    width: number;
    height: number;
  } | null>;
  getApproximateLocation(): Promise<{ lat: number; lon: number; timestampMs: number }>;
}

function getNativeAmbientBridge(): NativeAyumiAmbientBridge | null {
  const mod = NativeModules?.AyumiAmbient as NativeAyumiAmbientBridge | undefined;
  return mod && typeof mod.getAllKeyStatuses === 'function' ? mod : null;
}

/** Strips accidental API keys or credential fragments before logging or displaying error messages. */
export function redactAmbientSecrets(input: unknown): string {
  const raw =
    typeof input === 'string'
      ? input
      : input instanceof Error
        ? input.message
        : String(input ?? '');
  return raw
    .replace(/([?&](?:key|appid)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/(x-goog-api-key\s*[:=]\s*)[^,\s;]+/gi, '$1[REDACTED]')
    .replace(/AIza[0-9A-Za-z_-]{16,}/g, '[REDACTED_GEMINI_KEY]');
}

/** Maps an OpenWeatherMap integer weather ID into AI Ambient's weather categories. */
export function normalizeWeatherCategory(conditionId: number): WeatherConditionCategory {
  if (conditionId >= 200 && conditionId < 300) return 'thunderstorm';
  if (conditionId >= 300 && conditionId < 400) return 'drizzle';
  if (conditionId >= 500 && conditionId < 600) return 'rain';
  if (conditionId >= 600 && conditionId < 700) return 'snow';
  if (conditionId >= 700 && conditionId < 800) return 'mist';
  if (conditionId === 800) return 'clear';
  if (conditionId === 801 || conditionId === 802) return 'few_clouds';
  return 'cloudy';
}

/** Formats temperature for the compact weather pill (`24°`) without city/humidity clutter. */
export function formatAmbientTemperature(tempC: number | null | undefined): string {
  if (typeof tempC !== 'number' || !Number.isFinite(tempC)) {
    return '--°';
  }
  return `${Math.round(tempC)}°`;
}

export interface AmbientContextDescriptor {
  readonly timePhase: TimeOfDayPhase;
  readonly weatherCategory: WeatherConditionCategory | null;
  readonly isNight: boolean;
  readonly temperatureC: number | null;
  readonly colourSource: AiAmbientColourSource;
  readonly systemPrimaryHint: string;
}

/**
 * Generates a coarse context fingerprint so minor +/-1°C drift, tab switches,
 * or recompositions do NOT trigger wasteful Gemini image regeneration.
 */
export function buildAmbientContextFingerprint(desc: AmbientContextDescriptor): string {
  const bucket = getTemperatureRangeBucket(desc.temperatureC);
  const weatherPart = desc.weatherCategory ?? 'ambient';
  const lightingPart = desc.isNight ? 'night' : 'day';
  const palettePart =
    desc.colourSource === 'system' ? `sys:${desc.systemPrimaryHint}` : 'art';
  return `${desc.timePhase}|${lightingPart}|${weatherPart}|${bucket}|${palettePart}`;
}

function describeSeasonHint(monthZeroBased: number): string {
  if (monthZeroBased >= 2 && monthZeroBased <= 4) return 'spring foliage';
  if (monthZeroBased >= 5 && monthZeroBased <= 7) return 'late summer greenery';
  if (monthZeroBased >= 8 && monthZeroBased <= 10) return 'early autumn leaves';
  return 'crisp winter air';
}

function describeWeatherAtmosphere(
  category: WeatherConditionCategory | null,
  isNight: boolean,
): string {
  switch (category) {
    case 'thunderstorm':
      return isNight
        ? 'dramatic dark rainy night sky with distant soft lightning reflections on wet eaves'
        : 'moody overcast storm clouds with cool rain mist across quiet rooftops';
    case 'rain':
    case 'drizzle':
      return isNight
        ? 'calm rain streaks at dusk reflecting warm lantern glow on damp stone and foliage'
        : 'gentle rainfall over peaceful scenic rooftops and glistening wet leaves';
    case 'snow':
      return isNight
        ? 'quiet starry winter snowfall draping quiet eaves and pines in soft silver frost'
        : 'gentle daylight snowfall drifting past serene mountain town scenery';
    case 'mist':
      return 'layered atmospheric mist veiled across distant wooded hills and quiet roofs';
    case 'cloudy':
      return isNight
        ? 'soft indigo night clouds drifting gently above calm distant city lights'
        : 'painterly layered silver clouds diffusing gentle ambient sky light';
    case 'few_clouds':
      return isNight
        ? 'clear twilight moonset framed by wispy translucent clouds'
        : 'soft sunlit sky with drifting translucent clouds over distant hills';
    case 'clear':
    default:
      return isNight
        ? 'tranquil starlit night sky above a peaceful sleeping ridge and glowing horizon windows'
        : 'luminous sunlit sky stretching over a peaceful scenic overlooking vista and blossoms';
  }
}

/**
 * Builds the portrait 9:16 anime wallpaper generation prompt.
 * Never embeds GPS coordinates, health metrics, personal names, or API credentials.
 */
export function buildAmbientArtworkPrompt({
  timePhase,
  weather,
  paletteHint,
  date = new Date(),
}: {
  readonly timePhase: TimeOfDayPhase;
  readonly weather: AmbientWeatherSnapshot | null;
  readonly paletteHint: string;
  readonly date?: Date;
}): string {
  const isNight = weather ? weather.isNight : timePhase === 'night';
  const weatherDesc = describeWeatherAtmosphere(
    weather?.conditionCategory ?? null,
    isNight,
  );
  const season = describeSeasonHint(date.getMonth());
  const tempRange = getTemperatureRangeBucket(weather?.temperatureC);

  const timeMood =
    timePhase === 'morning'
      ? 'crisp early morning golden light, fresh atmosphere'
      : timePhase === 'afternoon'
        ? 'warm luminous late afternoon sunbeams and serene clarity'
        : timePhase === 'evening'
          ? 'golden-hour sunset transition melting into tranquil dusk'
          : 'calm midnight serenity, gentle moonlight and distant warm window light';

  return [
    'High-craft portrait 9:16 Japanese anime background illustration (Makoto Shinkai / CoMix Wave inspired scenery painting, clean painterly brushwork, serene environmental storytelling).',
    `Time and atmosphere: ${timeMood}; weather mood: ${weatherDesc}; seasonal feel: ${season}, ${tempRange} air.`,
    `Harmonious color direction centered around ${paletteHint}.`,
    'Composition requirements for mobile ambient UI:',
    '- Upper 52% showcases crisp scenic depth: framing foliage/wooden eaves on upper edges opening to the sky and distant landscape, with a clean calm sky/background region on the upper-left for white greeting text contrast.',
    '- Middle and lower 45% fades naturally into a soft, dreamy atmospheric haze/bokeh watercolor wash so foreground frosted-glass UI cards stay unobstructed and highly legible.',
    '- Strictly no text, no letters, no numbers, no UI icons, no borders, and no logos or watermarks anywhere in the image.',
  ].join(' ');
}

/**
 * Builds the concise 1-line greeting subtitle quote prompt (`6 to 10 words`).
 * Never includes user names, GPS coordinates, keys, or personal health measurements.
 */
export function buildAmbientQuotePrompt({
  timePhase,
  weather,
}: {
  readonly timePhase: TimeOfDayPhase;
  readonly weather: AmbientWeatherSnapshot | null;
}): string {
  const condition = weather?.conditionCategory ?? 'clear';
  const tempRange = getTemperatureRangeBucket(weather?.temperatureC);
  return [
    `Write one short calm, uplifting single-line reflection (strictly 6 to 9 words) suited to ${timePhase} in ${condition.replace('_', ' ')} (${tempRange}) weather.`,
    'Tone: serene, gentle mindfulness around movement and breathing fresh air.',
    'Rules: No quotation marks, no emojis, no author name, no exclamation-heavy hype clichés like "Crush your goals", return only the single line.',
  ].join(' ');
}

export async function readAmbientKeyStatuses(): Promise<AmbientKeyStatuses> {
  const bridge = getNativeAmbientBridge();
  if (!bridge) {
    return {
      hasGeminiKey: false,
      geminiMasked: '',
      hasWeatherKey: false,
      weatherMasked: '',
    };
  }
  return bridge.getAllKeyStatuses();
}

export async function storeAmbientSecretKey(
  alias: 'gemini' | 'openweathermap',
  plaintext: string,
): Promise<{ hasKey: boolean; masked: string }> {
  const bridge = getNativeAmbientBridge();
  if (!bridge) {
    throw new Error('Secure Android Keystore bridge is unavailable.');
  }
  return bridge.setSecretKey(alias, plaintext);
}

export async function removeAmbientSecretKey(
  alias: 'gemini' | 'openweathermap',
): Promise<void> {
  const bridge = getNativeAmbientBridge();
  if (!bridge) return;
  await bridge.deleteSecretKey(alias);
}

export async function validateStoredGeminiKey(overrideKey?: string): Promise<void> {
  const bridge = getNativeAmbientBridge();
  if (!bridge) throw new Error('Android native bridge unavailable.');
  await bridge.validateGeminiKey(overrideKey?.trim() || null);
}

export async function validateStoredWeatherKey(
  overrideKey?: string,
  sampleCity?: string,
): Promise<void> {
  const bridge = getNativeAmbientBridge();
  if (!bridge) throw new Error('Android native bridge unavailable.');
  await bridge.validateWeatherKey(overrideKey?.trim() || null, sampleCity?.trim() || null);
}

export async function requestCoarseLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const already = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    );
    if (already) return true;
    const status = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      {
        title: 'Approximate Location for AI Ambient Weather',
        message:
          'Ayumi uses coarse city-level location solely to fetch local temperature and weather for your AI Ambient scenery. You can also enter a city manually in Settings.',
        buttonPositive: 'Allow',
        buttonNegative: 'Use Manual City',
      },
    );
    return status === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export async function hasCoarseLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    return await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    );
  } catch {
    return false;
  }
}

export async function fetchAmbientWeather({
  useDeviceLocation,
  manualCity,
}: {
  readonly useDeviceLocation: boolean;
  readonly manualCity: string;
}): Promise<AmbientWeatherSnapshot> {
  const bridge = getNativeAmbientBridge();
  if (!bridge) {
    throw new Error('Android weather bridge unavailable.');
  }

  let hasCoords = false;
  let lat = 0;
  let lon = 0;

  if (useDeviceLocation) {
    const permitted = await hasCoarseLocationPermission();
    if (permitted) {
      try {
        const coords = await bridge.getApproximateLocation();
        if (
          coords &&
          typeof coords.lat === 'number' &&
          typeof coords.lon === 'number' &&
          Number.isFinite(coords.lat) &&
          Number.isFinite(coords.lon)
        ) {
          hasCoords = true;
          lat = coords.lat;
          lon = coords.lon;
        }
      } catch {
        // Gracefully fall back to manual city if coarse location times out indoors.
      }
    }
  }

  const trimmedCity = manualCity.trim();
  if (!hasCoords && !trimmedCity) {
    throw new Error('Grant coarse location permission or set a manual city in AI Ambient settings.');
  }

  const raw = await bridge.fetchCurrentWeather(hasCoords, lat, lon, trimmedCity || null);
  return {
    temperatureC: raw.temperatureC,
    conditionId: raw.conditionId,
    conditionMain: raw.conditionMain,
    conditionDescription: raw.conditionDescription,
    conditionCategory: normalizeWeatherCategory(raw.conditionId),
    isNight: raw.isNight,
    fetchedAtMs: raw.fetchedAtMs || Date.now(),
    source: raw.source === 'gps' ? 'gps' : 'city',
    cityLabel: raw.cityLabel,
  };
}

export async function generateAmbientArtworkAsset({
  weather,
  paletteHint,
}: {
  readonly weather: AmbientWeatherSnapshot | null;
  readonly paletteHint: string;
}): Promise<{
  artwork: AmbientArtworkSnapshot;
  extractedPalette: ExtractedArtworkPalette;
}> {
  const bridge = getNativeAmbientBridge();
  if (!bridge) {
    throw new Error('Android native artwork bridge unavailable.');
  }
  const timePhase = resolveTimeOfDayPhase();
  const prompt = buildAmbientArtworkPrompt({
    timePhase,
    weather,
    paletteHint,
  });

  const res = await bridge.generateArtwork(
    prompt,
    GEMINI_IMAGE_ASPECT_RATIO,
    GEMINI_IMAGE_SIZE,
    GEMINI_IMAGE_MODELS,
  );

  return {
    artwork: {
      path: res.path,
      uri: res.uri,
      width: res.width,
      height: res.height,
      generatedAtMs: res.generatedAtMs || Date.now(),
      modelUsed: res.modelUsed,
    },
    extractedPalette: res.palette,
  };
}

export async function generateAmbientQuoteText({
  weather,
}: {
  readonly weather: AmbientWeatherSnapshot | null;
}): Promise<string> {
  const bridge = getNativeAmbientBridge();
  if (!bridge) {
    throw new Error('Android native quote bridge unavailable.');
  }
  const prompt = buildAmbientQuotePrompt({
    timePhase: resolveTimeOfDayPhase(),
    weather,
  });
  const res = await bridge.generateQuote(prompt, GEMINI_TEXT_MODELS);
  return res.quote;
}

export async function verifyStoredArtworkFile(
  pathOrUri: string,
): Promise<{ path: string; uri: string; width: number; height: number } | null> {
  const bridge = getNativeAmbientBridge();
  if (!bridge || !pathOrUri) return null;
  return bridge.verifyCachedArtwork(pathOrUri);
}

