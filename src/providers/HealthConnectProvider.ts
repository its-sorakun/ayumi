/**
 * HealthConnectProvider — concrete implementation of HealthDataProvider
 * that reads from Android Health Connect via react-native-health-connect.
 *
 * This is the only file in the app that imports from react-native-health-connect.
 * All other code interacts with the abstract HealthDataProvider interface.
 */

import {
  initialize,
  getSdkStatus,
  SdkAvailabilityStatus,
  requestPermission,
  getGrantedPermissions as hcGetGrantedPermissions,
  readRecords,
  aggregateRecord,
  aggregateGroupByDuration,
  aggregateGroupByPeriod,
  ExerciseType,
} from 'react-native-health-connect';

const EXERCISE_TYPE_MAP = Object.fromEntries(
  Object.entries(ExerciseType).map(([key, val]) => [val, key.replace(/_/g, ' ').toLowerCase()])
);
import type {
  RecordType as HCRecordType,
} from 'react-native-health-connect';

import type { HealthDataProvider } from './HealthDataProvider';
import type {
  DailySummary,
  HealthRecord,
  HistoricalStepData,
  HistoricalDistanceData,
  HourlyStepData,
  HourlyDistanceData,
  HourlyBreakdownResult,
  PermissionState,
  ProviderStatus,
  RecordType,
  TimeRangeFilter,
} from '../types/health';
import { formatLocalDateKey, startOfDay, endOfDay } from '../utils/index';

function parsePeriodStartDateKey(rawStartTime: string): string {
  // Health Connect period slices emit naive LocalDateTime strings without offset, while zoned
  // instants include 'Z' or numeric UTC offsets; normalize zoned values into local YYYY-MM-DD.
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(rawStartTime)) {
    return formatLocalDateKey(new Date(rawStartTime));
  }
  return rawStartTime.split('T')[0];
}

/**
 * Maps our generic RecordType to Health Connect's strongly typed record type strings.
 * The `as const` satisfies ensures these are literal types, not widened to `string`.
 */
const RECORD_TYPE_MAP = {
  steps: 'Steps',
  distance: 'Distance',
  calories: 'ActiveCaloriesBurned',
  exercise: 'ExerciseSession',
} as const satisfies Record<RecordType, HCRecordType>;

/** Maps our generic RecordType to unit labels */
const UNIT_MAP: Record<RecordType, string> = {
  steps: 'steps',
  distance: 'meters',
  calories: 'kcal',
  exercise: 'minutes',
};

/** Creates a time range for a given date (midnight to midnight) */
function dayTimeRange(date: Date): { startTime: string; endTime: string } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return {
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
}

/** Converts SDK availability status to our generic ProviderStatus */
function mapSdkStatus(status: number): ProviderStatus {
  switch (status) {
    case SdkAvailabilityStatus.SDK_AVAILABLE:
      return 'available';
    case SdkAvailabilityStatus.SDK_UNAVAILABLE:
      return 'not_supported';
    case SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED:
      return 'update_required';
    default:
      return 'unknown';
  }
}

export class HealthConnectProvider implements HealthDataProvider {
  readonly name = 'Health Connect';
  private initialized = false;

  async checkAvailability(): Promise<ProviderStatus> {
    try {
      const status = await getSdkStatus();
      return mapSdkStatus(status);
    } catch {
      return 'not_supported';
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }
    const isInitialized = await initialize();
    if (!isInitialized) {
      throw new Error('Failed to initialize Health Connect SDK');
    }
    this.initialized = true;
  }

  async requestPermissions(
    recordTypes: readonly RecordType[],
  ): Promise<readonly PermissionState[]> {
    await this.ensureInitialized();

    const permissions: any[] = recordTypes.map(rt => ({
      accessType: 'read',
      recordType: RECORD_TYPE_MAP[rt],
    }));
    
    permissions.push({
      accessType: 'read',
      recordType: 'ReadHealthDataHistory',
    });

    const granted = await requestPermission(permissions);

    // Build a Set of granted record types for O(1) lookup
    const grantedSet = new Set(
      granted.map((g: { recordType: string }) => g.recordType),
    );

    return recordTypes.map(rt => ({
      recordType: rt,
      granted: grantedSet.has(RECORD_TYPE_MAP[rt]),
    }));
  }

  async getGrantedPermissions(): Promise<readonly PermissionState[]> {
    await this.ensureInitialized();

    const allTypes: RecordType[] = ['steps', 'distance', 'calories', 'exercise'];

    const granted = await hcGetGrantedPermissions();
    const grantedSet = new Set(
      granted.map((g: any) => g.recordType),
    );

    return allTypes.map(rt => ({
      recordType: rt,
      granted: grantedSet.has(RECORD_TYPE_MAP[rt]),
    }));
  }

  async getTodaySummary(): Promise<DailySummary> {
    return this.getDailySummary(new Date());
  }

  async getDailySummary(date: Date): Promise<DailySummary> {
    await this.ensureInitialized();

    const { startTime, endTime } = dayTimeRange(date);
    const timeRangeFilter = {
      operator: 'between' as const,
      startTime,
      endTime,
    };

    // Fetch all metrics in parallel for efficiency
    const [stepsResult, distanceResult, caloriesResult, exerciseResult] =
      await Promise.all([
        aggregateRecord({
          recordType: 'Steps',
          timeRangeFilter,
        }).catch(() => null),
        aggregateRecord({
          recordType: 'Distance',
          timeRangeFilter,
        }).catch(() => null),
        aggregateRecord({
          recordType: 'ActiveCaloriesBurned',
          timeRangeFilter,
        }).catch(() => null),
        readRecords('ExerciseSession', { timeRangeFilter }).catch(
          () => ({ records: [] as any[] }),
        ),
      ]);

    // Calculate active time from exercise sessions
    let activeMinutes = 0;
    const sourceSet = new Set<string>();
    const exerciseRecords = exerciseResult?.records ?? [];

    for (const session of exerciseRecords) {
      const sessionStart = new Date(session.startTime).getTime();
      const sessionEnd = new Date(session.endTime).getTime();
      activeMinutes += (sessionEnd - sessionStart) / 60_000;

      if (session.metadata?.dataOrigin) {
        sourceSet.add(session.metadata.dataOrigin);
      }
    }

    const steps = (stepsResult as any)?.COUNT_TOTAL ?? 0;
    
    // Extract data origins directly from the aggregate results!
    const addOrigins = (result: any) => {
      if (result?.dataOrigins && Array.isArray(result.dataOrigins)) {
        result.dataOrigins.forEach((o: string) => sourceSet.add(o));
      }
    };
    addOrigins(stepsResult);
    addOrigins(distanceResult);
    addOrigins(caloriesResult);

    const hcDistance = (distanceResult as any)?.DISTANCE?.inMeters ?? 0;
    const hcCalories = (caloriesResult as any)?.ACTIVE_CALORIES_TOTAL?.inKilocalories ?? 0;

    // Fallback: Ensure distance and calories are at least what the step count implies
    const distance = Math.max(hcDistance, steps * 0.762);
    const calories = Math.max(hcCalories, steps * 0.04);
    
    // Fallback: Active Time estimation based on typical walking cadence (100 steps/min)
    const finalActiveTime = Math.max(activeMinutes, steps / 100);

    return {
      date,
      steps,
      distance,
      calories,
      activeTime: steps > 0 ? Math.max(1, Math.round(finalActiveTime)) : 0,
      sources: Array.from(sourceSet),
    };
  }

  async getRecords(
    recordType: RecordType,
    timeRange: TimeRangeFilter,
  ): Promise<readonly HealthRecord[]> {
    await this.ensureInitialized();

    const hcRecordType = RECORD_TYPE_MAP[recordType];
    const timeRangeFilter = {
      operator: 'between' as const,
      startTime: timeRange.startTime.toISOString(),
      endTime: timeRange.endTime.toISOString(),
    };

    const result = await readRecords(hcRecordType, { timeRangeFilter });

    return result.records.map((record: any) => ({
      id: record.metadata?.id ?? `${Date.now()}-${Math.random()}`,
      type: recordType,
      value: this.extractValue(recordType, record),
      unit: UNIT_MAP[recordType],
      startTime: new Date(record.startTime),
      endTime: new Date(record.endTime),
      sourceName: record.metadata?.dataOrigin ?? 'Unknown',
      sourcePackage: record.metadata?.dataOrigin,
    }));
  }

  private async aggregateDailyRange(
    recordType: 'Steps' | 'Distance',
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ date: string; value: number; hasRecord: boolean }>> {
    await this.ensureInitialized();
    const rangeStart = startOfDay(startDate);
    const now = new Date();
    const requestedEnd = endOfDay(endDate);
    const clampedEnd = requestedEnd.getTime() > now.getTime() ? now : requestedEnd;
    if (rangeStart.getTime() > clampedEnd.getTime()) {
      return [];
    }

    try {
      const result = await aggregateGroupByPeriod({
        recordType,
        timeRangeFilter: {
          operator: 'between',
          startTime: rangeStart.toISOString(),
          endTime: clampedEnd.toISOString(),
        },
        timeRangeSlicer: {
          period: 'DAYS',
          length: 1,
        },
      });

      return result.map((r: any) => {
        const value =
          recordType === 'Steps'
            ? r.result?.COUNT_TOTAL || 0
            : r.result?.DISTANCE?.inMeters || 0;
        const origins = r.result?.dataOrigins;
        const hasRecord = value > 0 || (Array.isArray(origins) && origins.length > 0);
        return {
          date: parsePeriodStartDateKey(r.startTime),
          value,
          hasRecord,
        };
      });
    } catch (e) {
      console.warn(`Failed to aggregate ${recordType} range`, e);
      return [];
    }
  }

  private async aggregateHourlyDate(
    recordType: 'Steps' | 'Distance',
    date: Date,
  ): Promise<{ supported: boolean; buckets: Array<{ hour: number; value: number; hasRecord: boolean }> }> {
    await this.ensureInitialized();
    const dayStart = startOfDay(date);
    if (dayStart.getTime() > endOfDay(new Date()).getTime()) {
      return { supported: true, buckets: [] };
    }

    // Query full [00:00, next 00:00) window so all 24 local hours align cleanly on hour boundaries.
    const nextMidnight = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() + 1,
      0,
      0,
      0,
      0,
    );
    const targetDateKey = formatLocalDateKey(date);

    try {
      const result = await aggregateGroupByDuration({
        recordType,
        timeRangeFilter: {
          operator: 'between',
          startTime: dayStart.toISOString(),
          endTime: nextMidnight.toISOString(),
        },
        timeRangeSlicer: {
          duration: 'HOURS',
          length: 1,
        },
      });

      const hourTotals = new Map<number, { value: number; hasRecord: boolean }>();
      for (const r of result as any[]) {
        const bucketStart = new Date(r.startTime);
        if (formatLocalDateKey(bucketStart) !== targetDateKey) continue;
        const hr = bucketStart.getHours();
        const value =
          recordType === 'Steps'
            ? r.result?.COUNT_TOTAL || 0
            : r.result?.DISTANCE?.inMeters || 0;
        const origins = r.result?.dataOrigins;
        const hasOrigin = value > 0 || (Array.isArray(origins) && origins.length > 0);
        const existing = hourTotals.get(hr);
        hourTotals.set(hr, {
          value: (existing?.value || 0) + value,
          hasRecord: Boolean(existing?.hasRecord || hasOrigin),
        });
      }

      const buckets: Array<{ hour: number; value: number; hasRecord: boolean }> = [];
      for (let h = 0; h < 24; h++) {
        const entry = hourTotals.get(h);
        buckets.push({
          hour: h,
          value: entry?.value || 0,
          hasRecord: Boolean(entry?.hasRecord),
        });
      }

      return { supported: true, buckets };
    } catch (e) {
      console.warn(`Failed to aggregate hourly ${recordType}`, e);
      return { supported: false, buckets: [] };
    }
  }

  async getHistoricalSteps(timeRange: 'week' | 'month' | 'year'): Promise<HistoricalStepData[]> {
    await this.ensureInitialized();
    const now = new Date();
    if (timeRange !== 'year') {
      const days = timeRange === 'week' ? 7 : 30;
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - (days - 1));
      return this.getHistoricalStepsRange(startDate, now);
    }

    const startTime = new Date(now);
    startTime.setMonth(startTime.getMonth() - 11);
    startTime.setDate(1);
    startTime.setHours(0, 0, 0, 0);

    try {
      const result = await aggregateGroupByPeriod({
        recordType: 'Steps',
        timeRangeFilter: {
          operator: 'between',
          startTime: startTime.toISOString(),
          endTime: now.toISOString(),
        },
        timeRangeSlicer: {
          period: 'MONTHS',
          length: 1,
        },
      });

      return result.map((r: any) => {
        const steps = r.result?.COUNT_TOTAL || 0;
        const origins = r.result?.dataOrigins;
        return {
          date: parsePeriodStartDateKey(r.startTime),
          steps,
          hasRecord: steps > 0 || (Array.isArray(origins) && origins.length > 0),
        };
      });
    } catch (e) {
      console.warn('Failed to aggregate historical steps', e);
      return [];
    }
  }

  async getHistoricalDistance(timeRange: 'week' | 'month' | 'year'): Promise<HistoricalDistanceData[]> {
    await this.ensureInitialized();
    const now = new Date();
    if (timeRange !== 'year') {
      const days = timeRange === 'week' ? 7 : 30;
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - (days - 1));
      return this.getHistoricalDistanceRange(startDate, now);
    }

    const startTime = new Date(now);
    startTime.setMonth(startTime.getMonth() - 11);
    startTime.setDate(1);
    startTime.setHours(0, 0, 0, 0);

    try {
      const result = await aggregateGroupByPeriod({
        recordType: 'Distance',
        timeRangeFilter: {
          operator: 'between',
          startTime: startTime.toISOString(),
          endTime: now.toISOString(),
        },
        timeRangeSlicer: {
          period: 'MONTHS',
          length: 1,
        },
      });

      return result.map((r: any) => {
        const distance = r.result?.DISTANCE?.inMeters || 0;
        const origins = r.result?.dataOrigins;
        return {
          date: parsePeriodStartDateKey(r.startTime),
          distance,
          hasRecord: distance > 0 || (Array.isArray(origins) && origins.length > 0),
        };
      });
    } catch (e) {
      console.warn('Failed to aggregate historical distance', e);
      return [];
    }
  }

  async getHistoricalStepsRange(startDate: Date, endDate: Date): Promise<HistoricalStepData[]> {
    const rows = await this.aggregateDailyRange('Steps', startDate, endDate);
    return rows.map(r => ({ date: r.date, steps: r.value, hasRecord: r.hasRecord }));
  }

  async getHistoricalDistanceRange(startDate: Date, endDate: Date): Promise<HistoricalDistanceData[]> {
    const rows = await this.aggregateDailyRange('Distance', startDate, endDate);
    return rows.map(r => ({ date: r.date, distance: r.value, hasRecord: r.hasRecord }));
  }

  async getHourlySteps(date: Date): Promise<HourlyBreakdownResult<HourlyStepData>> {
    const res = await this.aggregateHourlyDate('Steps', date);
    return {
      supported: res.supported,
      buckets: res.buckets.map(b => ({ hour: b.hour, steps: b.value, hasRecord: b.hasRecord })),
    };
  }

  async getHourlyDistance(date: Date): Promise<HourlyBreakdownResult<HourlyDistanceData>> {
    const res = await this.aggregateHourlyDate('Distance', date);
    return {
      supported: res.supported,
      buckets: res.buckets.map(b => ({ hour: b.hour, distance: b.value, hasRecord: b.hasRecord })),
    };
  }

  async getExerciseSessions(timeRange: 'week' | 'month' | 'year') {
    await this.ensureInitialized();
    const days = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 365;
    
    const now = new Date();
    const startTime = new Date(now);
    if (timeRange === 'year') {
      startTime.setMonth(startTime.getMonth() - 11);
      startTime.setDate(1);
    } else {
      startTime.setDate(startTime.getDate() - days);
    }
    startTime.setHours(0, 0, 0, 0);

    try {
      const result = await readRecords('ExerciseSession', {
        timeRangeFilter: {
          operator: 'between',
          startTime: startTime.toISOString(),
          endTime: now.toISOString(),
        },
      });

      const sessions: any[] = [];

      await Promise.all(
        result.records.map(async (record: any) => {
          let typeStr = record.title;
          if (!typeStr) {
            const mapped = EXERCISE_TYPE_MAP[record.exerciseType];
            typeStr = mapped ? mapped : `Exercise ${record.exerciseType}`;
          }

          const startDate = new Date(record.startTime);
          const hour = startDate.getHours();
          let timeOfDay = 'Night';
          if (hour >= 5 && hour < 12) timeOfDay = 'Morning';
          else if (hour >= 12 && hour < 17) timeOfDay = 'Afternoon';
          else if (hour >= 17 && hour < 21) timeOfDay = 'Evening';

          const start = startDate.getTime();
          const end = new Date(record.endTime).getTime();
          const durationMinutes = (end - start) / (1000 * 60);

          // Fetch steps and distance for this session
          let sessionSteps = 0;
          let sessionDistance = 0;
          try {
            const stepsAggr = await aggregateRecord({
              recordType: 'Steps',
              timeRangeFilter: {
                operator: 'between',
                startTime: record.startTime,
                endTime: record.endTime,
              },
            });
            sessionSteps = (stepsAggr as any)?.COUNT_TOTAL || 0;
          } catch {
            // Ignore step errors per session
          }

          try {
            const distanceAggr = await aggregateRecord({
              recordType: 'Distance',
              timeRangeFilter: {
                operator: 'between',
                startTime: record.startTime,
                endTime: record.endTime,
              },
            });
            sessionDistance = (distanceAggr as any)?.DISTANCE?.inMeters || 0;
          } catch {
            // Ignore distance errors per session
          }
          
          sessions.push({
            type: `${timeOfDay} ${typeStr}`,
            durationMinutes,
            steps: sessionSteps,
            distance: sessionDistance,
            date: formatLocalDateKey(new Date(record.startTime)),
            timeOfDay,
            startTime: start,
            endTime: end,
          });
        })
      );

      return sessions.sort((a, b) => b.startTime - a.startTime);

    } catch (e) {
      console.warn('Failed to read exercise sessions', e);
      return [];
    }
  }

  /** Extracts the numeric value from a Health Connect record based on type */
  private extractValue(recordType: RecordType, record: any): number {
    switch (recordType) {
      case 'steps':
        return record.count ?? 0;
      case 'distance':
        return record.distance?.inMeters ?? 0;
      case 'calories':
        return record.energy?.inKilocalories ?? 0;
      case 'exercise': {
        const start = new Date(record.startTime).getTime();
        const end = new Date(record.endTime).getTime();
        return Math.round((end - start) / 60_000);
      }
      default:
        return 0;
    }
  }
}
