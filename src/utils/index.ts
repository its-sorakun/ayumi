/**
 * Date utility functions for Ayumi.
 * All date operations are centralized here to avoid scattered date logic.
 */

/** Returns a new Date set to the start of the given date (00:00:00.000) */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/** Returns a new Date set to the end of the given date (23:59:59.999) */
export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/** Returns today's date at midnight */
export function today(): Date {
  return startOfDay(new Date());
}

/** Formats a date into a human-readable string (e.g. "3 Aug 2026") */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Formats a number with locale-appropriate thousand separators */
export function formatNumber(value: number): string {
  return value.toLocaleString();
}

/** Formats distance in meters to a readable string with appropriate unit */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

/** Formats calories to a readable string */
export function formatCalories(kcal: number): string {
  return `${Math.round(kcal)} kcal`;
}

/** Formats minutes into a human-readable duration string */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMinutes}m`;
}

/** 
 * Calculates Total Calories (Active + BMR scaled to current time of day).
 * Uses Mifflin-St Jeor equation.
 */
export function calculateTotalCalories(
  activeCalories: number,
  gender: 'male' | 'female' | null,
  weight: number | null,
  height: number | null,
  age: number | null
): number {
  if (!gender || !weight || !height || !age) {
    return activeCalories;
  }

  let dailyBmr = 0;
  if (gender === 'male') {
    dailyBmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
  } else if (gender === 'female') {
    dailyBmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
  }

  // Calculate how many minutes have passed since midnight
  const now = new Date();
  const minutesSinceMidnight = (now.getHours() * 60) + now.getMinutes();
  
  // Scale BMR by the fraction of the day that has passed
  const scaledBmr = dailyBmr * (minutesSinceMidnight / 1440);

  return Math.round(activeCalories + scaledBmr);
}

/**
 * Calculates recommended daily water goal (in ml) based on physical stats.
 * Uses standard baseline: weight (kg) * 35 ml for adults, adjusted slightly for age/gender.
 * If no stats provided, defaults to 3000 ml.
 */
export function calculateWaterGoal(
  gender: 'male' | 'female' | null,
  weight: number | null,
  height: number | null,
  age: number | null
): number {
  if (!weight) {
    return 3000; // Sensible default if weight is unknown
  }

  // Base calculation
  let waterMl = weight * 35;

  // Slight adjustments based on age/gender (simplified clinical guidelines)
  if (age && age > 55) {
    waterMl = weight * 30; // Older adults generally need slightly less relative to body weight
  }

  // Round to nearest 100ml for cleaner goals (e.g. 2400 ml instead of 2450 ml)
  return Math.round(waterMl / 100) * 100;
}
