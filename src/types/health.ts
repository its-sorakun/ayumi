/**
 * Core health data types used throughout the application.
 * These types are provider-agnostic — the UI and business logic
 * only consume these, never provider-specific types.
 */

/** Supported health record categories */
export type RecordType = 'steps' | 'distance' | 'calories' | 'exercise';

/** A single health data record */
export interface HealthRecord {
  readonly id: string;
  readonly type: RecordType;
  readonly value: number;
  readonly unit: string;
  readonly startTime: Date;
  readonly endTime: Date;
  /** The app or device that produced this record */
  readonly sourceName: string;
  readonly sourcePackage?: string;
}

/** Aggregated daily summary for the dashboard */
export interface DailySummary {
  readonly date: Date;
  readonly steps: number;
  readonly distance: number; // meters
  readonly calories: number; // kcal
  readonly activeTime: number; // minutes
  readonly sources: readonly string[];
}

/** Time range filter for querying records */
export interface TimeRangeFilter {
  readonly startTime: Date;
  readonly endTime: Date;
}

/** Granularity for history views */
export type TimeGranularity = 'daily' | 'weekly' | 'monthly' | 'yearly';

/** Data for a single day in a historical chart */
export interface HistoricalStepData {
  readonly date: string; // YYYY-MM-DD (local calendar date)
  readonly steps: number;
  readonly hasRecord?: boolean;
}

/** Data for a single day in a historical chart for distance */
export interface HistoricalDistanceData {
  readonly date: string; // YYYY-MM-DD (local calendar date)
  readonly distance: number; // meters
  readonly hasRecord?: boolean;
}

export interface HistoricalWaterData {
  readonly date: string; // YYYY-MM-DD (local calendar date)
  readonly water: number; // ml
  readonly hasRecord?: boolean;
}

/** Granular hourly bucket for single-day step breakdowns */
export interface HourlyStepData {
  readonly hour: number; // 0..23 local hour
  readonly steps: number;
  readonly hasRecord?: boolean;
}

/** Granular hourly bucket for single-day distance breakdowns */
export interface HourlyDistanceData {
  readonly hour: number; // 0..23 local hour
  readonly distance: number; // meters
  readonly hasRecord?: boolean;
}

/** Hourly breakdown result indicating whether the active provider supports hourly slicing */
export interface HourlyBreakdownResult<T> {
  readonly supported: boolean;
  readonly buckets: readonly T[];
}

/** Summarized duration of a specific exercise type */
export interface ExerciseSessionData {
  readonly type: string; // e.g. 'walking', 'running'
  readonly durationMinutes: number;
  readonly steps?: number;
  readonly distance?: number;
  readonly date?: string;
  readonly timeOfDay?: string;
  readonly startTime?: number;
  readonly endTime?: number;
}

/** Status of the data provider */
export type ProviderStatus =
  | 'available'
  | 'not_installed'
  | 'update_required'
  | 'not_supported'
  | 'unknown';

/** Permission state for a record type */
export interface PermissionState {
  readonly recordType: RecordType;
  readonly granted: boolean;
}
