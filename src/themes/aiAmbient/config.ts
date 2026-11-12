/**
 * Core configuration, temporal phases, seasonal calendars, weather look presets,
 * and free DummyJSON daily quote endpoints for Ayumi's Ambient Scenery theme.
 * Keeps zero generative-AI dependencies while supporting rich auto/manual atmosphere control.
 */

export const DUMMYJSON_QUOTE_BASE = 'https://dummyjson.com/quotes';
export const DAILY_QUOTE_POOL_SIZE = 1454;
export const QUOTE_MAX_LENGTH = 108;

export const OWM_CURRENT_WEATHER_BASE = 'https://api.openweathermap.org/data/2.5/weather';
export const OWM_DIRECT_GEOCODING_BASE = 'https://api.openweathermap.org/geo/1.0/direct';

export const WEATHER_REFRESH_TTL_MS = 30 * 60 * 1000;

export const AI_AMBIENT_STORAGE_KEYS = {
  PREFS: 'ayumi_ambient_prefs_v2',
  WEATHER_CACHE: 'ayumi_ambient_weather_v1',
  QUOTE_CACHE: 'ayumi_ambient_quote_v2',
} as const;

export type TimeOfDayPhase =
  | 'dawn'
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'dusk'
  | 'night'
  | 'midnight';

export type TimeOfDayOverride = 'auto' | TimeOfDayPhase;

export type WeatherConditionCategory =
  | 'clear'
  | 'few_clouds'
  | 'cloudy'
  | 'drizzle'
  | 'rain'
  | 'thunderstorm'
  | 'snow'
  | 'mist';

export type WeatherLookOverride = 'auto' | WeatherConditionCategory;

export type SeasonalVibe =
  | 'harsh_winter'
  | 'early_spring'
  | 'spring'
  | 'summer'
  | 'autumn_transition';

export type SeasonalOverride = 'auto' | SeasonalVibe;

export interface OptionMetadata<T extends string> {
  readonly value: T;
  readonly label: string;
}

export const TIME_OF_DAY_OPTIONS: readonly OptionMetadata<TimeOfDayOverride>[] = [
  { value: 'auto', label: 'Auto (Clock)' },
  { value: 'dawn', label: 'Early Morning' },
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'dusk', label: 'Late Evening' },
  { value: 'night', label: 'Night' },
  { value: 'midnight', label: 'Midnight' },
];

export const WEATHER_LOOK_OPTIONS: readonly OptionMetadata<WeatherLookOverride>[] = [
  { value: 'auto', label: 'Auto (Live)' },
  { value: 'clear', label: 'Clear' },
  { value: 'few_clouds', label: 'Breezy Clouds' },
  { value: 'cloudy', label: 'Overcast' },
  { value: 'drizzle', label: 'Drizzle' },
  { value: 'rain', label: 'Rain' },
  { value: 'thunderstorm', label: 'Thunderstorm' },
  { value: 'snow', label: 'Snow' },
  { value: 'mist', label: 'Mist' },
];

export const SEASONAL_VIBE_OPTIONS: readonly OptionMetadata<SeasonalOverride>[] = [
  { value: 'auto', label: 'Auto (Month)' },
  { value: 'harsh_winter', label: 'Harsh Winter (Dec–Jan)' },
  { value: 'early_spring', label: 'Thaw & Spring Welcome (Feb)' },
  { value: 'spring', label: 'Spring Blossom (Mar)' },
  { value: 'summer', label: 'Summer & Lush Rain (Apr–Sep)' },
  { value: 'autumn_transition', label: 'Pleasant Transition (Oct–Nov)' },
];

/**
 * Resolves local wall-clock time into 7 distinct atmospheric phases:
 * dawn (05:00-07:29), morning (07:30-11:59), afternoon (12:00-16:29),
 * evening (16:30-18:59), dusk (19:00-20:59), night (21:00-23:59), midnight (00:00-04:59).
 */
export function resolveTimeOfDayPhase(date: Date = new Date()): TimeOfDayPhase {
  const hour = date.getHours();
  const minute = date.getMinutes();
  const totalMinutes = hour * 60 + minute;

  if (totalMinutes < 5 * 60) {
    return 'midnight';
  }
  if (totalMinutes < 7 * 60 + 30) {
    return 'dawn';
  }
  if (totalMinutes < 12 * 60) {
    return 'morning';
  }
  if (totalMinutes < 16 * 60 + 30) {
    return 'afternoon';
  }
  if (totalMinutes < 19 * 60) {
    return 'evening';
  }
  if (totalMinutes < 21 * 60) {
    return 'dusk';
  }
  return 'night';
}

export function isDarkTimePhase(phase: TimeOfDayPhase): boolean {
  return phase === 'dusk' || phase === 'night' || phase === 'midnight';
}

export function isRainyWeatherCategory(category: WeatherConditionCategory): boolean {
  return category === 'rain' || category === 'drizzle' || category === 'thunderstorm';
}

/**
 * Maps calendar month (0-11) onto user-defined seasonal vibes:
 * Dec-Jan -> harsh_winter, Feb -> early_spring, Mar -> spring,
 * Apr-Sep -> summer, Oct-Nov -> autumn_transition.
 */
export function resolveSeasonForDate(date: Date = new Date()): SeasonalVibe {
  const month = date.getMonth();
  if (month === 11 || month === 0) {
    return 'harsh_winter';
  }
  if (month === 1) {
    return 'early_spring';
  }
  if (month === 2) {
    return 'spring';
  }
  if (month >= 3 && month <= 8) {
    return 'summer';
  }
  return 'autumn_transition';
}

export function resolveEffectiveTimePhase(
  override: TimeOfDayOverride = 'auto',
  date: Date = new Date(),
): TimeOfDayPhase {
  return override === 'auto' ? resolveTimeOfDayPhase(date) : override;
}

export function resolveEffectiveSeason(
  override: SeasonalOverride = 'auto',
  date: Date = new Date(),
): SeasonalVibe {
  return override === 'auto' ? resolveSeasonForDate(date) : override;
}

export function getAmbientGreetingLines(phase: TimeOfDayPhase): {
  readonly line1: string;
  readonly line2: string;
} {
  switch (phase) {
    case 'dawn':
      return { line1: 'Early', line2: 'Morning' };
    case 'morning':
      return { line1: 'Good', line2: 'Morning' };
    case 'afternoon':
      return { line1: 'Good', line2: 'Afternoon' };
    case 'evening':
      return { line1: 'Good', line2: 'Evening' };
    case 'dusk':
      return { line1: 'Late', line2: 'Evening' };
    case 'night':
      return { line1: 'Good', line2: 'Night' };
    case 'midnight':
      return { line1: 'Quiet', line2: 'Midnight' };
  }
}

/** Deterministic daily index (1..DAILY_QUOTE_POOL_SIZE) anchored to local calendar date. */
export function getDailyQuoteSeedId(date: Date = new Date()): number {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const composite = year * 10000 + month * 100 + day;
  const fractional = (composite * 0.618033988749895) % 1;
  return Math.floor(fractional * DAILY_QUOTE_POOL_SIZE) + 1;
}

export function getLocalCalendarDateKey(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getFallbackQuoteForContext(
  phase: TimeOfDayPhase,
  category: WeatherConditionCategory,
  season: SeasonalVibe = 'summer',
  seasonalEnabled = true,
): string {
  if (seasonalEnabled && season === 'summer' && isRainyWeatherCategory(category)) {
    return 'Monsoon rain awakens deep emerald hills—keep moving steady.';
  }
  if (seasonalEnabled && season === 'harsh_winter') {
    return category === 'snow'
      ? 'Crisp snowfall settles softly—warm every stride today.'
      : 'Quiet frost holds the peaks; steady steps carry warmth.';
  }
  if (seasonalEnabled && season === 'early_spring') {
    return 'Winter loosens its grip as early buds greet fresh air.';
  }
  if (seasonalEnabled && season === 'spring') {
    return 'Soft blossoms drift across mild light—enjoy unhurried motion.';
  }
  if (seasonalEnabled && season === 'autumn_transition') {
    return 'Pleasant cool breezes signal changing skies—a great day to walk.';
  }

  if (category === 'rain' || category === 'drizzle') {
    return 'Steady raindrops set a gentle rhythm for today.';
  }
  if (category === 'thunderstorm') {
    return 'Calm focus indoors while distant thunder passes cleanly.';
  }
  if (category === 'snow') {
    return 'Quiet snowfall slows the world down for calm steps.';
  }
  if (category === 'mist') {
    return 'Soft morning mist clears gently with each quiet stride.';
  }

  switch (phase) {
    case 'dawn':
      return 'First light stains the horizon; start slow and clear-headed.';
    case 'morning':
      return 'Fresh morning air invites unhurried focus and steady steps.';
    case 'afternoon':
      return 'Keep a calm rhythm through the warmth of the day.';
    case 'evening':
      return 'Golden evening light rewards another thoughtful stride.';
    case 'dusk':
      return 'Daylight folds into indigo—wind down gently at your pace.';
    case 'night':
      return 'Starlight settles above the ridge; rest well and hydrate.';
    case 'midnight':
      return 'Deep midnight silence leaves only calm breath and distant stars.';
  }
}
