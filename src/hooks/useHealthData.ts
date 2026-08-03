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
  /** Manually refresh the data */
  readonly refresh: () => Promise<void>;
}

export function useHealthData(): HealthDataState {
  const [loading, setLoading] = useState(true);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus>('unknown');
  const [providerName, setProviderName] = useState<string | null>(null);
  const [todaySummary, setTodaySummary] = useState<DailySummary | null>(null);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Guard against concurrent fetches which can crash the Health Connect binder
  const isFetching = React.useRef(false);

  const fetchData = useCallback(async (showSpinner = true) => {
    if (isFetching.current) return;
    
    try {
      isFetching.current = true;
      if (showSpinner) {
        setLoading(true);
      }
      setError(null);
      
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
  }, []);

  // Initialize the health service on mount
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const status = await healthService.initialize();
        if (!mounted) { return; }

        setProviderStatus(status);
        setProviderName(healthService.getProviderName());

        if (status === 'available') {
          await fetchData();
        } else {
          setLoading(false);
        }
      } catch (err) {
        if (!mounted) { return; }
        setError('Failed to initialize health service');
        setLoading(false);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [fetchData]);

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
    refresh,
  };
}
