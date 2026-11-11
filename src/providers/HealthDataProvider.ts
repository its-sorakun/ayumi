/**
 * HealthDataProvider interface — the core abstraction that decouples
 * the entire application from any specific health data source.
 *
 * The UI and business logic only interact with this interface.
 * Concrete implementations (HealthConnectProvider, SensorProvider, etc.)
 * handle the platform-specific details.
 */

import type {
  DailySummary,
  HealthRecord,
  PermissionState,
  ProviderStatus,
  RecordType,
  TimeRangeFilter,
  HistoricalStepData,
  HistoricalDistanceData,
  HourlyStepData,
  HourlyDistanceData,
  HourlyBreakdownResult,
  ExerciseSessionData,
} from '../types/health';

export interface HealthDataProvider {
  /** Human-readable name of this provider (e.g. "Health Connect") */
  readonly name: string;

  /** Check whether this provider is available on the current device */
  checkAvailability(): Promise<ProviderStatus>;

  /** Request read permissions for the given record types */
  requestPermissions(recordTypes: readonly RecordType[]): Promise<readonly PermissionState[]>;

  /** Check which permissions are currently granted */
  getGrantedPermissions(): Promise<readonly PermissionState[]>;

  /** Get today's aggregated summary */
  getTodaySummary(): Promise<DailySummary>;

  /** Get aggregated daily summary for a specific date */
  getDailySummary(date: Date): Promise<DailySummary>;

  /** Read raw records of a specific type within a time range */
  getRecords(
    recordType: RecordType,
    timeRange: TimeRangeFilter,
  ): Promise<readonly HealthRecord[]>;

  /** Get daily step buckets for a given time range */
  getHistoricalSteps(timeRange: 'week' | 'month' | 'year'): Promise<readonly HistoricalStepData[]>;

  /** Get daily distance buckets for a given time range */
  getHistoricalDistance(timeRange: 'week' | 'month' | 'year'): Promise<readonly HistoricalDistanceData[]>;

  /** Get daily step buckets across an explicit local calendar date range [startDate..endDate] */
  getHistoricalStepsRange(startDate: Date, endDate: Date): Promise<readonly HistoricalStepData[]>;

  /** Get daily distance buckets across an explicit local calendar date range [startDate..endDate] */
  getHistoricalDistanceRange(startDate: Date, endDate: Date): Promise<readonly HistoricalDistanceData[]>;

  /** Get 24-hour local hourly step buckets for a date, or supported=false if unavailable */
  getHourlySteps(date: Date): Promise<HourlyBreakdownResult<HourlyStepData>>;

  /** Get 24-hour local hourly distance buckets for a date, or supported=false if unavailable */
  getHourlyDistance(date: Date): Promise<HourlyBreakdownResult<HourlyDistanceData>>;

  /** Get exercise sessions for a given time range */
  getExerciseSessions(timeRange: 'week' | 'month' | 'year'): Promise<readonly ExerciseSessionData[]>;

  /**
   * Called when the app comes to the foreground.
   * Useful for providers that need to start realtime hardware listeners.
   */
  onResume?(): void;

  /**
   * Called when the app goes to the background.
   * Useful for providers that need to pause realtime hardware listeners to save battery.
   */
  onPause?(): void;
}
