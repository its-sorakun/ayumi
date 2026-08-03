/**
 * Application-wide constants.
 * Centralizes magic values so they can be changed in one place.
 */

/** Default daily step goal */
export const DEFAULT_STEP_GOAL = 10_000;

/** Default daily distance goal in meters */
export const DEFAULT_DISTANCE_GOAL = 8_000;

/** Default daily calorie goal in kcal */
export const DEFAULT_CALORIE_GOAL = 500;

/** Minimum steps threshold before a record is considered valid */
export const MIN_VALID_STEPS = 0;

/** Maximum reasonable steps per day (used for data sanity checks) */
export const MAX_REASONABLE_DAILY_STEPS = 100_000;

/** App metadata */
export const APP_NAME = 'Ayumi';
export const APP_VERSION = '1.0.0';
export const APP_PACKAGE = 'com.ayumi.health';

/** Supported record types for Health Connect queries */
export const HEALTH_RECORD_TYPES = [
  'steps',
  'distance',
  'calories',
  'exercise',
] as const;
