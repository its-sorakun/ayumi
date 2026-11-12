/**
 * Centralized API endpoints, verified Gemini / OpenWeatherMap configuration,
 * caching intervals, time-of-day phases, and local fallback greeting lines for AI Ambient.
 * Kept isolated under `src/themes/aiAmbient/` so Default and OxygenOS remain untouched.
 */

export const GEMINI_IMAGE_MODELS = [
  'gemini-3.1-flash-image-preview',
  'gemini-2.5-flash-image',
] as const;

export const GEMINI_TEXT_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
] as const;

export const GEMINI_IMAGE_ASPECT_RATIO = '9:16';
export const GEMINI_IMAGE_SIZE = '2K';

export const OWM_CURRENT_WEATHER_BASE = 'https://api.openweathermap.org/data/2.5/weather';
export const OWM_DIRECT_GEOCODING_BASE = 'https://api.openweathermap.org/geo/1.0/direct';
export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000;
export const AUTO_ARTWORK_COOLDOWN_MS = 45 * 60 * 1000;
export const TEMPERATURE_BUCKET_STEP_C = 4;

export const AI_AMBIENT_PREFS_STORAGE_KEY = '@ayumi_ai_ambient_prefs_v1';
export const AI_AMBIENT_CACHE_STORAGE_KEY = '@ayumi_ai_ambient_cache_v1';

export type TimeOfDayPhase = 'morning' | 'afternoon' | 'evening' | 'night';

export type WeatherConditionCategory =
  | 'clear'
  | 'few_clouds'
  | 'cloudy'
  | 'rain'
  | 'drizzle'
  | 'thunderstorm'
  | 'snow'
  | 'mist';

export function resolveTimeOfDayPhase(date: Date = new Date()): TimeOfDayPhase {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

export function getAmbientGreetingLines(phase: TimeOfDayPhase): {
  readonly line1: string;
  readonly line2: string;
  readonly singleLine: string;
} {
  switch (phase) {
    case 'morning':
      return { line1: 'Good', line2: 'Morning', singleLine: 'Good Morning' };
    case 'afternoon':
      return { line1: 'Good', line2: 'Afternoon', singleLine: 'Good Afternoon' };
    case 'evening':
      return { line1: 'Good', line2: 'Evening', singleLine: 'Good Evening' };
    case 'night':
    default:
      return { line1: 'Good', line2: 'Night', singleLine: 'Good Night' };
  }
}

export function getTemperatureRangeBucket(tempC: number | null | undefined): string {
  if (typeof tempC !== 'number' || !Number.isFinite(tempC)) return 'mild';
  if (tempC < 5) return 'cold (<5C)';
  if (tempC < 14) return 'cool (5-13C)';
  if (tempC < 22) return 'mild (14-21C)';
  if (tempC < 30) return 'warm (22-29C)';
  return 'hot (>=30C)';
}

export function getFallbackQuoteForContext(
  phase: TimeOfDayPhase,
  weatherCategory?: WeatherConditionCategory | null,
): string {
  if (weatherCategory === 'rain' || weatherCategory === 'drizzle') {
    return 'Soft footsteps sound peaceful in gentle rain.';
  }
  if (weatherCategory === 'thunderstorm') {
    return 'Quiet skies follow every passing summer storm.';
  }
  if (weatherCategory === 'snow') {
    return 'Crisp air invites slow and steady strides.';
  }

  switch (phase) {
    case 'morning':
      return 'Fresh morning air brings calm energy ahead.';
    case 'afternoon':
      return 'Sunlight drifts softly over every unhurried step.';
    case 'evening':
      return 'Warm twilight turns quiet movement into peace.';
    case 'night':
    default:
      return 'Still starlight closes another mindful day cleanly.';
  }
}

