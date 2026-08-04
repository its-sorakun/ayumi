/**
 * useHealthData — the primary hook for consuming health data in UI components.
 *
 * This hook is completely provider-agnostic. It interacts only with
 * the HealthService, which delegates to the active HealthDataProvider.
 *
 * It handles:
 *  - Service initialization and provider detection
 *  - Permission requests
 *  - Data fetching
 *  - Loading and error states
 *  - App state changes (pause/resume sensors for battery efficiency)
 *  - Cleanup on unmount (no memory leaks / dangling listeners)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { healthService } from '../services';
import { useSettings } from '../contexts/SettingsContext';
import type { DailySummary, ProviderStatus } from '../types/health';

interface HealthDataState {
  /** Whether the hook is currently loading data */
  readonly loading: boolean;
  /** The provider initialization/availability status */
  readonly providerStatus: ProviderStatus;
  /** The human-readable name of the active provider */
  readonly providerName: string | null;
  /** Today's aggregated health summary */
  readonly todaySummary: DailySummary | null;
  /** Whether permissions have been granted */
  readonly hasPermissions: boolean;
  /** Error message, if any */
  readonly error: string | null;
  /** Request health data permissions */
  readonly requestPermissions: () => Promise<void>;
  /** Switch to local device sensor provider */
  readonly switchToDeviceSensor: () => Promise<void>;
  /** Manually refresh the data */
  readonly refresh: () => Promise<void>;
}

export function useHealthData(): HealthDataState {
  const { provider: providerPref, setProvider, isLoading: isSettingsLoading } = useSettings();
  const [loading, setLoading] = useState(true);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus>('unknown');
  const [providerName, setProviderName] = useState<string | null>(null);
  const [todaySummary, setTodaySummary] = useState<DailySummary | null>(null);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Guard against concurrent fetches which can crash the Health Connect binder
  const isFetching = React.useRef(false);

  const fetchData = useCallback(async (showSpinner = true) => {
    if (isFetching.current || isSettingsLoading) return;
    
    try {
      isFetching.current = true;
      if (showSpinner) {
        setLoading(true);
      }
      setError(null);
      
      await healthService.setForceSensor(providerPref === 'device_sensor');
      const status = await healthService.initialize();
      setProviderStatus(status);
      setProviderName(healthService.getProviderName());
      
      // Check if we actually have permissions first
      const perms = await healthService.getGrantedPermissions();
      const stepsGranted = perms.find(p => p.recordType === 'steps')?.granted ?? false;
      setHasPermissions(stepsGranted);

      if (stepsGranted) {
        const summary = await healthService.getTodaySummary();
        setTodaySummary(summary);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch health data';
      setError(message);
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, [providerPref, isSettingsLoading]);

  // Initialize the health service on mount
  useEffect(() => {
    if (isSettingsLoading) return;
    
    let mounted = true;
    const init = async () => {
      if (mounted) {
        await fetchData();
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [fetchData, isSettingsLoading]);

  // Pause/resume sensor providers when the app is backgrounded/foregrounded.
  // This is critical for the PedometerProvider (accelerometer) — we don't want
  // the accelerometer running when the user isn't in the app (battery drain).
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        // App came to foreground — resume sensors and refresh data
        healthService.resumeSensors();
        if (providerStatus === 'available') {
          fetchData(false); // silent refresh
        }
      } else if (nextState === 'background' || nextState === 'inactive') {
        // App went to background — pause sensor listeners
        healthService.pauseSensors();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Cleanup: remove AppState listener on unmount
    return () => {
      subscription.remove();
    };
  }, [providerStatus, fetchData]);

  const requestPermissions = useCallback(async () => {
    try {
      setError(null);
      await healthService.requestPermissions([
        'steps',
        'distance',
        'calories',
        'exercise',
      ]);
      await fetchData();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to request permissions';
      setError(message);
    }
  }, [fetchData]);

  const switchToDeviceSensor = useCallback(async () => {
    // 1. Save preference globally so it persists on restart
    await setProvider('device_sensor');
    // 2. Force the singleton to drop Health Connect
    await healthService.setForceSensor(true);
    
    // 3. Automatically prompt the user for permission instead of waiting for a button click
    try {
      await healthService.requestPermissions(['steps', 'distance', 'calories', 'exercise']);
    } catch (e) {
      // ignore
    }
    
    // 4. Finally fetch data and update the UI state
    await fetchData(true);
  }, [fetchData, setProvider]);

  const refresh = useCallback(async () => {
    if (providerStatus === 'available') {
      await fetchData();
    }
  }, [providerStatus, fetchData]);

  return {
    loading,
    providerStatus,
    providerName,
    todaySummary,
    hasPermissions,
    error,
    requestPermissions,
    switchToDeviceSensor,
    refresh,
  };
}
