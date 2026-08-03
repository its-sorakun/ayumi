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
}
