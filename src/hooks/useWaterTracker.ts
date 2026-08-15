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
  const getDateKey = useCallback((d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `@ayumi_water_${year}-${month}-${day}`;
  }, []);

  const getTodayKey = useCallback(() => getDateKey(new Date()), [getDateKey]);

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
    
    // For year, we group by month. For week/month, we group by day.
    if (timeRange === 'year') {
      // Get the last 12 months
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        
        // This is a bit inefficient to read all days, but fine for local storage
        // A better approach would be to store monthly aggregates, but we'll sum up days here
        let monthlyTotal = 0;
        const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        
        const keysToFetch = [];
        for (let day = 1; day <= daysInMonth; day++) {
          keysToFetch.push(`@ayumi_water_${monthKey}-${String(day).padStart(2, '0')}`);
        }
        
        try {
          const fetchPromises = keysToFetch.map(k => AsyncStorage.getItem(k));
          const storedValues = await Promise.all(fetchPromises);
          
          for (let i = 0; i < storedValues.length; i++) {
            const value = storedValues[i];
            if (value) {
              const dayLogs: WaterLog[] = JSON.parse(value);
              monthlyTotal += dayLogs.reduce((sum, log) => sum + log.amount, 0);
            }
          }
        } catch(e) {
          console.error(e);
        }
        
        result.push({
          date: monthKey,
          water: monthlyTotal,
        });
      }
    } else {
      // Week or month - fetch daily data
      const keysToFetch = [];
      const dates = [];
      
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        dates.push(dateStr);
        keysToFetch.push(`@ayumi_water_${dateStr}`);
      }
      
      try {
        const fetchPromises = keysToFetch.map(k => AsyncStorage.getItem(k));
        const storedValues = await Promise.all(fetchPromises);
        
        // Map the results back to our dates to ensure correct order
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
      } catch(e) {
        console.error(e);
      }
    }
    
    return result;
  }, []);

  return {
    logs,
    totalWater,
    addWater,
    deleteWater,
    loading,
    refresh: loadLogs,
    getHistoricalWater,
    getLogsForDate,
  };
}
