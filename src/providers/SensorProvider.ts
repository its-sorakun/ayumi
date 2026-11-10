/**
 * SensorProvider — HealthDataProvider implementation backed by Android's
 * hardware TYPE_STEP_COUNTER sensor via our custom StepCounterModule.
 *
 * This provider targets:
 *  - De-Googled devices (GrapheneOS, CalyxOS, LineageOS without MicroG)
 *  - Users who have uninstalled Health Connect
 *  - Privacy-conscious users who don't want Health Connect
 *
 * Capabilities (v1):
 *  - Steps: from hardware step counter ✅
 *  - Distance: estimated from steps using average stride length ✅ (approximation)
 *  - Calories: estimated from steps using a metabolic constant ✅ (approximation)
 *  - Exercise sessions: not available ❌
 *  - Data sources: always "Device Sensor" ✅
 *
 * F-Droid compatible: uses only Android framework APIs via our native module.
 */

import { PermissionsAndroid, Platform } from 'react-native';
import type { HealthDataProvider } from './HealthDataProvider';
import type {
  DailySummary,
  HealthRecord,
  PermissionState,
  ProviderStatus,
  RecordType,
  TimeRangeFilter,
  HistoricalStepData,
  HistoricalDistanceData,
  ExerciseSessionData,
} from '../types/health';
import { StepCounter } from './native/StepCounterBridge';
import { formatLocalDateKey } from '../utils';

/**
 * Physical constants for step-based health metric estimation.
 * These use gender-neutral averages. Future versions could let the user
 * configure stride length in Settings.
 */
const AVERAGE_STRIDE_LENGTH_M = 0.762; // meters per step (average adult)
const KCAL_PER_STEP = 0.04; // approximate kcal burned per step (60kg adult, flat terrain)

/** Convert steps to estimated distance in meters */
function stepsToMeters(steps: number): number {
  return steps * AVERAGE_STRIDE_LENGTH_M;
}

/** Convert steps to estimated calories in kcal */
function stepsToKcal(steps: number): number {
  return steps * KCAL_PER_STEP;
}

export class SensorProvider implements HealthDataProvider {
  readonly name = 'Device Sensor';

  async checkAvailability(): Promise<ProviderStatus> {
    // Sensor module must exist (i.e. native module linked properly)
    if (StepCounter == null) {
      return 'not_supported';
    }

    try {
      const result = await StepCounter.isAvailable();
      return result.available ? 'available' : 'not_supported';
    } catch {
      return 'not_supported';
    }
  }

  onResume(): void {
    if (StepCounter) {
      StepCounter.startListening().catch(() => {
        // Ignore errors if sensor is unavailable
      });
    }
  }

  onPause(): void {
    if (StepCounter) {
      StepCounter.stopListening();
    }
  }

  async requestPermissions(
    _recordTypes: readonly RecordType[],
  ): Promise<readonly PermissionState[]> {
    // On Android 10+ (API 29+) ACTIVITY_RECOGNITION is a runtime permission.
    // On Android 9 (our minimum), it is automatically granted.
    if (Platform.OS === 'android' && Platform.Version >= 29) {
      try {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
          {
            title: 'Step Counter',
            message:
              'Ayumi needs access to your physical activity to count steps from the device sensor.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );

        const granted = result === PermissionsAndroid.RESULTS.GRANTED;

        // Sensor provider only provides meaningful data for steps
        return [
          { recordType: 'steps', granted },
          { recordType: 'distance', granted }, // derived from steps
          { recordType: 'calories', granted }, // derived from steps
          { recordType: 'exercise', granted: false }, // not supported
        ];
      } catch {
        return [
          { recordType: 'steps', granted: false },
          { recordType: 'distance', granted: false },
          { recordType: 'calories', granted: false },
          { recordType: 'exercise', granted: false },
        ];
      }
    }

    // Android 9 — no runtime permission needed
    return [
      { recordType: 'steps', granted: true },
      { recordType: 'distance', granted: true },
      { recordType: 'calories', granted: true },
      { recordType: 'exercise', granted: false },
    ];
  }

  async getGrantedPermissions(): Promise<readonly PermissionState[]> {
    if (Platform.OS === 'android' && Platform.Version >= 29) {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
      );
      return [
        { recordType: 'steps', granted },
        { recordType: 'distance', granted },
        { recordType: 'calories', granted },
        { recordType: 'exercise', granted: false },
      ];
    }
    return [
      { recordType: 'steps', granted: true },
      { recordType: 'distance', granted: true },
      { recordType: 'calories', granted: true },
      { recordType: 'exercise', granted: false },
    ];
  }

  async getTodaySummary(): Promise<DailySummary> {
    return this.getDailySummary(new Date());
  }

  async getDailySummary(date: Date): Promise<DailySummary> {
    if (StepCounter == null) {
      return this.emptyDailySummary(date);
    }

    try {
      const result = await StepCounter.getTodaySteps();

      if (!result.available) {
        return this.emptyDailySummary(date);
      }

      const steps = result.stepsToday;

      return {
        date,
        steps,
        distance: stepsToMeters(steps),
        calories: stepsToKcal(steps),
        activeTime: steps > 0 ? Math.max(1, Math.round(steps / 100)) : 0,
        sources: [this.name],
      };
    } catch {
      return this.emptyDailySummary(date);
    }
  }

  /**
   * The hardware step counter doesn't store historical records,
   * so we can only return today's data. Historical dates return empty.
   */
  async getRecords(
    recordType: RecordType,
    _timeRange: TimeRangeFilter,
  ): Promise<readonly HealthRecord[]> {
    if (StepCounter == null || recordType === 'exercise') {
      return [];
    }

    try {
      const result = await StepCounter.getTodaySteps();
      if (!result.available) {
        return [];
      }

      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);

      const steps = result.stepsToday;
      let value: number;

      switch (recordType) {
        case 'steps':
          value = steps;
          break;
        case 'distance':
          value = stepsToMeters(steps);
          break;
        case 'calories':
          value = stepsToKcal(steps);
          break;
        default:
          return [];
      }

      return [
        {
          id: `sensor-${recordType}-${startOfDay.toISOString()}`,
          type: recordType,
          value,
          unit: recordType === 'steps' ? 'steps' : recordType === 'distance' ? 'meters' : 'kcal',
          startTime: startOfDay,
          endTime: now,
          sourceName: this.name,
        },
      ];
    } catch {
      return [];
    }
  }

  async getHistoricalSteps(timeRange: 'week' | 'month' | 'year') {
    try {
      if (StepCounter && StepCounter.getHistoricalSteps) {
        const historyStr = await StepCounter.getHistoricalSteps();
        const history: HistoricalStepData[] = JSON.parse(historyStr) || [];
        
        // The native step history only records up to yesterday (done at midnight).
        // We must manually append today's steps so the graph shows current progress.
        const todaySummary = await this.getTodaySummary();
        const todayDateStr = formatLocalDateKey(todaySummary.date);
        
        // Remove today's date from history if it somehow exists (e.g., timezone weirdness)
        const filteredHistory = history.filter(d => d.date !== todayDateStr);
        
        // Append today's live steps
        filteredHistory.push({
          date: todayDateStr,
          steps: todaySummary.steps
        });
        
        const days = timeRange === 'week' ? 7 : timeRange === 'year' ? 365 : 30;
        return filteredHistory.slice(-days);
      }
    } catch (e) {
      console.warn('Failed to parse historical steps', e);
    }
    return [];
  }

  async getHistoricalDistance(timeRange: 'week' | 'month' | 'year'): Promise<HistoricalDistanceData[]> {
    const stepsHistory = await this.getHistoricalSteps(timeRange);
    return stepsHistory.map((day: any) => ({
      date: day.date,
      distance: day.steps * 0.762, // Approximation: 1 step = 0.762m
    }));
  }

  async getExerciseSessions(_timeRange: 'week' | 'month' | 'year'): Promise<ExerciseSessionData[]> {
    return [];
  }

  private emptyDailySummary(date: Date): DailySummary {
    return {
      date,
      steps: 0,
      distance: 0,
      calories: 0,
      activeTime: 0,
      sources: [],
    };
  }
}
