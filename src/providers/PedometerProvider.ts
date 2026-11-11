/**
 * PedometerProvider — software-based step counter using the accelerometer.
 *
 * This is the last-resort fallback for devices that have neither Health Connect
 * nor a hardware TYPE_STEP_COUNTER sensor (very old or stripped-down devices).
 *
 * Algorithm: Peak detection on the vertical acceleration magnitude.
 *  1. Compute the magnitude of the 3-axis acceleration vector.
 *  2. Apply a simple low-pass filter to smooth noise.
 *  3. Detect a "step" when the magnitude crosses a threshold from below (rising edge).
 *  4. Enforce a minimum inter-step interval to reject rapid noise spikes.
 *
 * This approach works reasonably well for flat walking; it is less accurate
 * than the hardware counter but requires no special hardware.
 *
 * Limitations vs SensorProvider:
 *  - Less accurate (10-15% error typical)
 *  - Counts only while the app session is active (no background detection)
 *  - Uses more battery (accelerometer runs continuously while listening)
 *
 * F-Droid compatible: uses react-native-sensors (open-source, no proprietary code).
 */

import { PermissionsAndroid, Platform } from 'react-native';
import { accelerometer, setUpdateIntervalForType, SensorTypes } from 'react-native-sensors';
import type { Subscription } from 'rxjs';

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
  HourlyStepData,
  HourlyDistanceData,
  HourlyBreakdownResult,
  ExerciseSessionData,
} from '../types/health';

// ─── Step detection constants ─────────────────────────────────────────────────

/** Accelerometer sample rate in ms. 100ms = 10Hz — enough for step detection */
const SAMPLE_INTERVAL_MS = 100;

/** Acceleration magnitude threshold for detecting a step peak (m/s²).
 *  9.81 = gravity. Peaks above gravity + threshold indicate a step impact. */
const STEP_MAGNITUDE_THRESHOLD = 11.5;

/** Minimum time between two consecutive steps in ms.
 *  ~300ms = max ~3.3 steps/sec. Prevents counting the same impact twice. */
const MIN_STEP_INTERVAL_MS = 300;

/** Low-pass filter smoothing factor. Higher = more smoothing, less responsive. */
const LOW_PASS_ALPHA = 0.8;

// ─── Stride/calorie estimation (same as SensorProvider) ───────────────────────
const AVERAGE_STRIDE_LENGTH_M = 0.762;
const KCAL_PER_STEP = 0.04;

function stepsToMeters(steps: number): number {
  return steps * AVERAGE_STRIDE_LENGTH_M;
}

function stepsToKcal(steps: number): number {
  return steps * KCAL_PER_STEP;
}

export class PedometerProvider implements HealthDataProvider {
  readonly name = 'Software Pedometer';

  // ─── Step detection state ──────────────────────────────────────────────────
  private stepCount = 0;
  private sessionStartTime: Date | null = null;
  private subscription: Subscription | null = null;
  private smoothedMagnitude = 9.81; // start at gravity
  private lastStepTimestamp = 0;
  private wasAboveThreshold = false;

  async checkAvailability(): Promise<ProviderStatus> {
    // The accelerometer is available on virtually all Android devices.
    // We verify by attempting a brief subscription — if it errors immediately,
    // the sensor is unavailable.
    return new Promise<ProviderStatus>(resolve => {
      const sub = accelerometer.subscribe({
        next: () => {
          sub.unsubscribe();
          resolve('available');
        },
        error: () => {
          resolve('not_supported');
        },
      });

      // Resolve as available after 500ms even without a reading
      // (sensor may not fire immediately on some devices)
      setTimeout(() => {
        sub.unsubscribe();
        resolve('available');
      }, 500);
    });
  }

  async requestPermissions(
    _recordTypes: readonly RecordType[],
  ): Promise<readonly PermissionState[]> {
    if (Platform.OS === 'android' && Platform.Version >= 29) {
      try {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
          {
            title: 'Step Detection',
            message:
              'Ayumi needs access to motion sensors to count your steps.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );
        const granted = result === PermissionsAndroid.RESULTS.GRANTED;
        return this.buildPermissions(granted);
      } catch {
        return this.buildPermissions(false);
      }
    }
    return this.buildPermissions(true);
  }

  async getGrantedPermissions(): Promise<readonly PermissionState[]> {
    if (Platform.OS === 'android' && Platform.Version >= 29) {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
      );
      return this.buildPermissions(granted);
    }
    return this.buildPermissions(true);
  }

  async getTodaySummary(): Promise<DailySummary> {
    return this.buildSummary(new Date());
  }

  async getDailySummary(date: Date): Promise<DailySummary> {
    // Software pedometer only knows about the current session
    return this.buildSummary(date);
  }

  async getRecords(
    recordType: RecordType,
    _timeRange: TimeRangeFilter,
  ): Promise<readonly HealthRecord[]> {
    if (recordType === 'exercise' || this.sessionStartTime == null) {
      return [];
    }

    const now = new Date();
    let value: number;

    switch (recordType) {
      case 'steps':
        value = this.stepCount;
        break;
      case 'distance':
        value = stepsToMeters(this.stepCount);
        break;
      case 'calories':
        value = stepsToKcal(this.stepCount);
        break;
      default:
        return [];
    }

    return [
      {
        id: `pedometer-${recordType}-${this.sessionStartTime.toISOString()}`,
        type: recordType,
        value,
        unit: recordType === 'steps' ? 'steps' : recordType === 'distance' ? 'meters' : 'kcal',
        startTime: this.sessionStartTime,
        endTime: now,
        sourceName: this.name,
      },
    ];
  }

  async getHistoricalSteps(_timeRange: 'week' | 'month' | 'year') {
    return [];
  }

  async getHistoricalDistance(_timeRange: 'week' | 'month' | 'year'): Promise<HistoricalDistanceData[]> {
    return [];
  }

  async getHistoricalStepsRange(_startDate: Date, _endDate: Date): Promise<HistoricalStepData[]> {
    return [];
  }

  async getHistoricalDistanceRange(_startDate: Date, _endDate: Date): Promise<HistoricalDistanceData[]> {
    return [];
  }

  async getHourlySteps(_date: Date): Promise<HourlyBreakdownResult<HourlyStepData>> {
    // Software accelerometer sessions do not persist per-hour breakdown buckets.
    return { supported: false, buckets: [] };
  }

  async getHourlyDistance(_date: Date): Promise<HourlyBreakdownResult<HourlyDistanceData>> {
    return { supported: false, buckets: [] };
  }

  async getExerciseSessions(_timeRange: 'week' | 'month' | 'year'): Promise<ExerciseSessionData[]> {
    return [];
  }

  /**
   * Begin listening to the accelerometer and detecting steps.
   * Call this when the app comes to the foreground.
   * Always call stopListening() when done to release the sensor.
   */
  startListening(): void {
    if (this.subscription != null) {
      return; // Already listening
    }

    this.sessionStartTime = new Date();
    this.stepCount = 0;
    this.smoothedMagnitude = 9.81;
    this.lastStepTimestamp = 0;
    this.wasAboveThreshold = false;

    // Set accelerometer update rate (affects battery usage)
    setUpdateIntervalForType(SensorTypes.accelerometer, SAMPLE_INTERVAL_MS);

    this.subscription = accelerometer.subscribe({
      next: ({ x, y, z }) => {
        this.processSample(x, y, z);
      },
      error: () => {
        // Sensor failed — unsubscribe silently
        this.stopListening();
      },
    });
  }

  /**
   * Stop listening to the accelerometer.
   * Important: call this when navigating away or unmounting
   * to prevent battery drain.
   */
  stopListening(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
  }

  // ─── Step detection algorithm ──────────────────────────────────────────────

  /**
   * Process one accelerometer sample using a peak-detection algorithm.
   *
   * Steps:
   * 1. Compute the resultant magnitude of the 3D acceleration vector.
   * 2. Apply a low-pass filter to remove high-frequency vibration noise.
   * 3. Detect a rising-edge crossing of the step threshold.
   * 4. Enforce minimum inter-step interval to reject duplicates.
   */
  private processSample(x: number, y: number, z: number): void {
    // 1. Compute resultant magnitude: √(x² + y² + z²)
    const rawMagnitude = Math.sqrt(x * x + y * y + z * z);

    // 2. Low-pass filter: blend previous smoothed value with new sample
    //    smoothed = alpha * previous + (1 - alpha) * new
    this.smoothedMagnitude =
      LOW_PASS_ALPHA * this.smoothedMagnitude +
      (1 - LOW_PASS_ALPHA) * rawMagnitude;

    const isAboveThreshold = this.smoothedMagnitude > STEP_MAGNITUDE_THRESHOLD;
    const now = Date.now();

    // 3. Detect rising edge (transition from below → above threshold)
    if (isAboveThreshold && !this.wasAboveThreshold) {
      // 4. Enforce minimum inter-step interval
      if (now - this.lastStepTimestamp >= MIN_STEP_INTERVAL_MS) {
        this.stepCount += 1;
        this.lastStepTimestamp = now;
      }
    }

    this.wasAboveThreshold = isAboveThreshold;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private buildSummary(date: Date): DailySummary {
    const steps = this.stepCount;
    return {
      date,
      steps,
      distance: stepsToMeters(steps),
      calories: stepsToKcal(steps),
      activeTime: 0,
      sources: this.stepCount > 0 ? [this.name] : [],
    };
  }

  private buildPermissions(granted: boolean): readonly PermissionState[] {
    return [
      { recordType: 'steps', granted },
      { recordType: 'distance', granted },
      { recordType: 'calories', granted },
      { recordType: 'exercise', granted: false },
    ];
  }
}
