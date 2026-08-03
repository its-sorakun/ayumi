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
