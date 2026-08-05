import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WaterLog {
  id: string;
  time: string; // ISO string or simple time format
  amount: number; // in ml
}

export function useWaterTracker() {
  const [logs, setLogs] = useState<WaterLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Use today's date in local time as the key (e.g. YYYY-MM-DD)
  const getTodayKey = () => {
    const d = new Date();
    // Normalize to local date string to avoid UTC shift issues
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `@ayumi_water_${year}-${month}-${day}`;
  };

  const loadLogs = useCallback(async () => {
    try {
      const key = getTodayKey();
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        setLogs(JSON.parse(stored));
      } else {
        setLogs([]);
      }
    } catch (e) {
      console.error('Failed to load water logs', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const addWater = async (amount: number) => {
    if (amount <= 0) return;
    
    const now = new Date();
    const newLog: WaterLog = {
      id: now.getTime().toString(),
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      amount,
    };

    const newLogs = [newLog, ...logs];
    setLogs(newLogs);

    try {
      const key = getTodayKey();
      await AsyncStorage.setItem(key, JSON.stringify(newLogs));
    } catch (e) {
      console.error('Failed to save water log', e);
    }
  };

  const deleteWater = async (id: string) => {
    const newLogs = logs.filter(log => log.id !== id);
    setLogs(newLogs);

    try {
      const key = getTodayKey();
      await AsyncStorage.setItem(key, JSON.stringify(newLogs));
    } catch (e) {
      console.error('Failed to save water log after deletion', e);
    }
  };

  const totalWater = logs.reduce((sum, log) => sum + log.amount, 0);

  return {
    logs,
    totalWater,
    addWater,
    deleteWater,
    loading,
    refresh: loadLogs
  };
}
