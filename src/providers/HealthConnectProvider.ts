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
  PermissionState,
  ProviderStatus,
  RecordType,
  TimeRangeFilter,
} from '../types/health';

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

  async getHistoricalSteps(timeRange: 'week' | 'month' | 'year') {
    await this.ensureInitialized();
    const days = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 365;
    
    const now = new Date();
    const startTime = new Date(now);
    if (timeRange === 'year') {
      startTime.setMonth(startTime.getMonth() - 11);
      startTime.setDate(1);
    } else {
      startTime.setDate(startTime.getDate() - (days - 1));
    }
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
          period: timeRange === 'year' ? 'MONTHS' : 'DAYS',
          length: 1,
        },
      });

      return result.map((r: any) => ({
        date: r.startTime.split('T')[0],
        steps: r.result?.COUNT_TOTAL || 0,
      }));
    } catch (e) {
      console.warn('Failed to aggregate historical steps', e);
      return [];
    }
  }

  async getHistoricalDistance(timeRange: 'week' | 'month' | 'year') {
    await this.ensureInitialized();
    const days = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 365;
    
    const now = new Date();
    const startTime = new Date(now);
    if (timeRange === 'year') {
      startTime.setMonth(startTime.getMonth() - 11);
      startTime.setDate(1);
    } else {
      startTime.setDate(startTime.getDate() - (days - 1));
    }
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
          period: timeRange === 'year' ? 'MONTHS' : 'DAYS',
          length: 1,
        },
      });

      return result.map((r: any) => ({
        date: r.startTime.split('T')[0],
        distance: r.result?.DISTANCE?.inMeters || 0,
      }));
    } catch (e) {
      console.warn('Failed to aggregate historical distance', e);
      return [];
    }
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
          } catch (e) {
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
          } catch (e) {
            // Ignore distance errors per session
          }
          
          sessions.push({
            type: `${timeOfDay} ${typeStr}`,
            durationMinutes,
            steps: sessionSteps,
            distance: sessionDistance,
            date: record.startTime.split('T')[0],
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
