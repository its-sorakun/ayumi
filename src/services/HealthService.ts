/**
 * HealthService — orchestrates the HealthDataProvider and exposes
 * a singleton that the rest of the app consumes via React context/hooks.
 *
 * Provider selection waterfall (best → fallback):
 *
 *   1. HealthConnectProvider  — preferred; reads from the OS health database
 *                               which aggregates data from all fitness apps.
 *
 *   2. SensorProvider         — fallback for de-Googled devices (GrapheneOS,
 *                               LineageOS, CalyxOS, etc.) that don't have
 *                               Health Connect. Reads Android's hardware
 *                               TYPE_STEP_COUNTER sensor directly.
 *
 *   3. PedometerProvider      — last resort for devices without a dedicated
 *                               step counter chip. Uses the accelerometer +
 *                               a software peak-detection algorithm.
 *                               Only counts steps while the app is active.
 *
 * The UI never knows which provider is active — it always calls the same
 * HealthDataProvider interface methods.
 */

import type { HealthDataProvider } from '../providers/HealthDataProvider';
import { HealthConnectProvider } from '../providers/HealthConnectProvider';
import { SensorProvider } from '../providers/SensorProvider';
import { PedometerProvider } from '../providers/PedometerProvider';
import type {
  DailySummary,
  HealthRecord,
  PermissionState,
  ProviderStatus,
  RecordType,
  TimeRangeFilter,
} from '../types/health';

class HealthService {
  private provider: HealthDataProvider | null = null;
  private pedometerProvider: PedometerProvider | null = null;
  private providerStatus: ProviderStatus = 'unknown';
  private forceSensor = false;

  /**
   * Forces the app to skip Health Connect and fallback to device sensors.
   * Useful when Health Connect is installed but disabled by the user.
   */
  async setForceSensor(force: boolean): Promise<void> {
    this.forceSensor = force;
  }
  
  async forceDeviceSensor(): Promise<ProviderStatus> {
    this.forceSensor = true;
    return this.initialize();
  }

  /**
   * Detects and initializes the best available health data provider.
   * Walks the priority chain: Health Connect → Sensor → Pedometer.
   *
   * Returns the final ProviderStatus and records which provider won.
   */
  async initialize(): Promise<ProviderStatus> {
    if (!this.forceSensor) {
      // ── Tier 1: Health Connect ───────────────────────────────────────────────
      const hcProvider = new HealthConnectProvider();
      const hcStatus = await hcProvider.checkAvailability();

      if (hcStatus === 'available') {
        this.provider = hcProvider;
        this.providerStatus = 'available';
        return 'available';
      }
    }

    // ── Tier 2: Hardware Step Counter ────────────────────────────────────────
    const sensorProvider = new SensorProvider();
    const sensorStatus = await sensorProvider.checkAvailability();

    if (sensorStatus === 'available') {
      this.provider = sensorProvider;
      this.providerStatus = 'available';
      sensorProvider.onResume();
      return 'available';
    }

    // ── Tier 3: Software Pedometer ───────────────────────────────────────────
    const pedometerProvider = new PedometerProvider();
    const pedometerStatus = await pedometerProvider.checkAvailability();

    if (pedometerStatus === 'available') {
      // Pedometer needs to actively listen while the app is in use
      pedometerProvider.startListening();
      this.pedometerProvider = pedometerProvider;
      this.provider = pedometerProvider;
      this.providerStatus = 'available';
      return 'available';
    }

    // ── No provider available ────────────────────────────────────────────────
    this.providerStatus = 'not_supported';
    return 'not_supported';
  }

  /** Returns the current provider status */
  getStatus(): ProviderStatus {
    return this.providerStatus;
  }

  /** Returns the active provider's name, or null if none is active */
  getProviderName(): string | null {
    return this.provider?.name ?? null;
  }

  /**
   * Stop active sensor listeners when the app is backgrounded.
   */
  pauseSensors(): void {
    this.pedometerProvider?.stopListening();
    this.provider?.onPause?.();
  }

  /**
   * Resume sensor listeners when the app returns to foreground.
   */
  resumeSensors(): void {
    this.pedometerProvider?.startListening();
    this.provider?.onResume?.();
  }

  async requestPermissions(
    recordTypes: readonly RecordType[],
  ): Promise<readonly PermissionState[]> {
    this.ensureProvider();
    return this.provider!.requestPermissions(recordTypes);
  }

  async getGrantedPermissions(): Promise<readonly PermissionState[]> {
    this.ensureProvider();
    return this.provider!.getGrantedPermissions();
  }

  async getTodaySummary(): Promise<DailySummary> {
    this.ensureProvider();
    return this.provider!.getTodaySummary();
  }

  async getDailySummary(date: Date): Promise<DailySummary> {
    this.ensureProvider();
    return this.provider!.getDailySummary(date);
  }

  async getRecords(
    recordType: RecordType,
    timeRange: TimeRangeFilter,
  ): Promise<readonly HealthRecord[]> {
    this.ensureProvider();
    return this.provider!.getRecords(recordType, timeRange);
  }

  async getHistoricalSteps(timeRange: 'week' | 'month' | 'year') {
    this.ensureProvider();
    return this.provider!.getHistoricalSteps(timeRange);
  }

  async getHistoricalDistance(timeRange: 'week' | 'month' | 'year') {
    this.ensureProvider();
    return this.provider!.getHistoricalDistance(timeRange);
  }

  async getExerciseSessions(timeRange: 'week' | 'month' | 'year') {
    this.ensureProvider();
    return this.provider!.getExerciseSessions(timeRange);
  }

  private ensureProvider(): void {
    if (!this.provider) {
      throw new Error(
        'HealthService not initialized or no provider available. Call initialize() first.',
      );
    }
  }
}

/** Singleton instance — the app should use this, not create new instances */
export const healthService = new HealthService();
