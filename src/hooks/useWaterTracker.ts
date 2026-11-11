/**
 * useWaterTracker — synchronized single source of truth for daily & historical water logs.
 *
 * Implements shared hydration state across Home, Water Logger, and Statistics:
 *  - Persists entries under AsyncStorage keys `@ayumi_water_YYYY-MM-DD` (integer ml)
 *  - Broadcasts live mutations across all mounted hook consumers inside MainPagerScreen
 *  - Supports addWater, updateWater (in-place preserving timestamp & id), and deleteWater
 *  - Serializes storage writes and enforces calendar-day boundary resets automatically
 */

import { useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WaterLog {
  id: string;
  time: string; // Local formatted timestamp string (e.g. "02:34 PM")
  amount: number; // Integer quantity in millilitres
}

interface SharedWaterState {
  dayKey: string;
  logs: WaterLog[];
  loading: boolean;
}

const subscribers = new Set<() => void>();
let lastIssuedIdMs = 0;
let writeQueue: Promise<void> = Promise.resolve();

export function buildWaterDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `@ayumi_water_${year}-${month}-${day}`;
}

function getTodayStorageKey(): string {
  return buildWaterDateKey(new Date());
}

let sharedState: SharedWaterState = {
  dayKey: getTodayStorageKey(),
  logs: [],
  loading: true,
};

function notifySubscribers(): void {
  subscribers.forEach(listener => listener());
}

function nextMonotonicLogId(): string {
  const nowMs = Date.now();
  lastIssuedIdMs = nowMs > lastIssuedIdMs ? nowMs : lastIssuedIdMs + 1;
  return String(lastIssuedIdMs);
}

/** Ensures logs remain sorted newest-first using creation epoch id when present. */
export function sortWaterLogsNewestFirst(entries: readonly WaterLog[]): WaterLog[] {
  return [...entries].sort((a, b) => {
    const aMs = Number(a.id);
    const bMs = Number(b.id);
    if (Number.isFinite(aMs) && Number.isFinite(bMs) && aMs !== bMs) {
      return bMs - aMs;
    }
    return 0;
  });
}

function enqueueDayWrite(dayKey: string, snapshot: readonly WaterLog[]): Promise<void> {
  writeQueue = writeQueue
    .then(async () => {
      await AsyncStorage.setItem(dayKey, JSON.stringify(snapshot));
    })
    .catch(err => {
      console.error('Failed to persist water logs', err);
    });
  return writeQueue;
}

async function loadTodayLogsShared(): Promise<void> {
  const todayKey = getTodayStorageKey();
  try {
    const stored = await AsyncStorage.getItem(todayKey);
    const parsed: WaterLog[] = stored ? JSON.parse(stored) : [];
    const normalized = sortWaterLogsNewestFirst(
      parsed.filter(entry => entry && typeof entry.amount === 'number' && entry.amount > 0),
    );
    sharedState = {
      dayKey: todayKey,
      logs: normalized,
      loading: false,
    };
  } catch (e) {
    console.error('Failed to load water logs', e);
    sharedState = {
      dayKey: todayKey,
      logs: [],
      loading: false,
    };
  } finally {
    notifySubscribers();
  }
}

/** Forces a reload of today's shared water logs from AsyncStorage. */
export async function syncWaterTrackerFromStorage(): Promise<void> {
  await loadTodayLogsShared();
}

export function useWaterTracker() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick(t => t + 1);
    subscribers.add(listener);

    const currentKey = getTodayStorageKey();
    if (sharedState.loading || sharedState.dayKey !== currentKey) {
      loadTodayLogsShared();
    }

    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active' && sharedState.dayKey !== getTodayStorageKey()) {
        loadTodayLogsShared();
      }
    });

    return () => {
      subscribers.delete(listener);
      appStateSub.remove();
    };
  }, []);

  const getDateKey = useCallback((d: Date) => buildWaterDateKey(d), []);
  const getTodayKey = useCallback(() => getTodayStorageKey(), []);

  const refresh = useCallback(async () => {
    await loadTodayLogsShared();
  }, []);

  const addWater = useCallback(async (amount: number) => {
    const cleanAmount = Math.round(amount);
    if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) return;

    const todayKey = getTodayStorageKey();
    if (sharedState.dayKey !== todayKey) {
      await loadTodayLogsShared();
    }

    const now = new Date();
    const newLog: WaterLog = {
      id: nextMonotonicLogId(),
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      amount: cleanAmount,
    };

    const nextLogs = sortWaterLogsNewestFirst([newLog, ...sharedState.logs]);
    sharedState = {
      dayKey: todayKey,
      logs: nextLogs,
      loading: false,
    };
    notifySubscribers();
    await enqueueDayWrite(todayKey, nextLogs);
  }, []);

  const updateWater = useCallback(async (id: string, newAmount: number) => {
    const cleanAmount = Math.round(newAmount);
    if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) return;

    const todayKey = getTodayStorageKey();
    if (sharedState.dayKey !== todayKey) {
      await loadTodayLogsShared();
    }

    let matched = false;
    const nextLogs = sharedState.logs.map(entry => {
      if (entry.id !== id) return entry;
      matched = true;
      return { ...entry, amount: cleanAmount };
    });

    if (!matched) return;

    sharedState = {
      dayKey: todayKey,
      logs: nextLogs,
      loading: false,
    };
    notifySubscribers();
    await enqueueDayWrite(todayKey, nextLogs);
  }, []);

  const deleteWater = useCallback(async (id: string) => {
    const todayKey = getTodayStorageKey();
    if (sharedState.dayKey !== todayKey) {
      await loadTodayLogsShared();
    }

    const nextLogs = sharedState.logs.filter(log => log.id !== id);
    sharedState = {
      dayKey: todayKey,
      logs: nextLogs,
      loading: false,
    };
    notifySubscribers();
    await enqueueDayWrite(todayKey, nextLogs);
  }, []);

  const logs =
    sharedState.dayKey === getTodayStorageKey() ? sharedState.logs : [];
  const totalWater = logs.reduce((sum, log) => sum + log.amount, 0);

  const getLogsForDate = useCallback(async (dateString: string): Promise<WaterLog[]> => {
    try {
      const key = `@ayumi_water_${dateString}`;
      const stored = await AsyncStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to get logs for date', e);
      return [];
    }
  }, []);

  const getHistoricalWater = useCallback(async (timeRange: 'week' | 'month' | 'year') => {
    const days = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 365;
    const result = [];
    const now = new Date();

    if (timeRange === 'year') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        let monthlyTotal = 0;
        const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

        const keysToFetch = [];
        for (let day = 1; day <= daysInMonth; day++) {
          keysToFetch.push(`@ayumi_water_${monthKey}-${String(day).padStart(2, '0')}`);
        }

        try {
          const storedValues = await Promise.all(keysToFetch.map(k => AsyncStorage.getItem(k)));
          for (let j = 0; j < storedValues.length; j++) {
            const value = storedValues[j];
            if (value) {
              const dayLogs: WaterLog[] = JSON.parse(value);
              monthlyTotal += dayLogs.reduce((sum, log) => sum + log.amount, 0);
            }
          }
        } catch (e) {
          console.error(e);
        }

        result.push({
          date: monthKey,
          water: monthlyTotal,
        });
      }
    } else {
      const keysToFetch = [];
      const dates = [];

      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        dates.push(dateStr);
        keysToFetch.push(`@ayumi_water_${dateStr}`);
      }

      try {
        const storedValues = await Promise.all(keysToFetch.map(k => AsyncStorage.getItem(k)));
        for (let i = 0; i < dates.length; i++) {
          const dateStr = dates[i];
          const value = storedValues[i];
          let dailyTotal = 0;
          if (value) {
            const dayLogs: WaterLog[] = JSON.parse(value);
            dailyTotal = dayLogs.reduce((sum, log) => sum + log.amount, 0);
          }
          result.push({
            date: dateStr,
            water: dailyTotal,
          });
        }
      } catch (e) {
        console.error(e);
      }
    }

    return result;
  }, []);

  return {
    logs,
    totalWater,
    addWater,
    updateWater,
    deleteWater,
    loading: sharedState.loading,
    refresh,
    getHistoricalWater,
    getLogsForDate,
    getDateKey,
    getTodayKey,
  };
}
