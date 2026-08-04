import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_STEP_GOAL, DEFAULT_DISTANCE_GOAL } from '../constants';

export type ThemePreference = 'auto' | 'light' | 'dark';
export type ProviderPreference = 'health_connect' | 'device_sensor';

interface SettingsData {
  theme: ThemePreference;
  provider: ProviderPreference;
  stepGoal: number;
  distanceGoal: number;
}

interface SettingsContextType extends SettingsData {
  setTheme: (theme: ThemePreference) => Promise<void>;
  setProvider: (provider: ProviderPreference) => Promise<void>;
  setStepGoal: (goal: number) => Promise<void>;
  setDistanceGoal: (goal: number) => Promise<void>;
  isLoading: boolean;
}

const defaultSettings: SettingsData = {
  theme: 'auto',
  provider: 'health_connect',
  stepGoal: DEFAULT_STEP_GOAL,
  distanceGoal: DEFAULT_DISTANCE_GOAL,
};

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const storedTheme = await AsyncStorage.getItem('@ayumi_theme');
      const storedProvider = await AsyncStorage.getItem('@ayumi_provider');
      const storedStepGoal = await AsyncStorage.getItem('@ayumi_step_goal');
      const storedDistanceGoal = await AsyncStorage.getItem('@ayumi_distance_goal');

      setSettings({
        theme: (storedTheme as ThemePreference) || 'auto',
        provider: (storedProvider as ProviderPreference) || 'health_connect',
        stepGoal: storedStepGoal ? parseInt(storedStepGoal, 10) : DEFAULT_STEP_GOAL,
        distanceGoal: storedDistanceGoal ? parseInt(storedDistanceGoal, 10) : DEFAULT_DISTANCE_GOAL,
      });
    } catch (e) {
      console.error('Failed to load settings', e);
    } finally {
      setIsLoading(false);
    }
  };

  const setTheme = async (theme: ThemePreference) => {
    setSettings(prev => ({ ...prev, theme }));
    await AsyncStorage.setItem('@ayumi_theme', theme);
  };

  const setProvider = async (provider: ProviderPreference) => {
    setSettings(prev => ({ ...prev, provider }));
    await AsyncStorage.setItem('@ayumi_provider', provider);
  };

  const setStepGoal = async (goal: number) => {
    setSettings(prev => ({ ...prev, stepGoal: goal }));
    await AsyncStorage.setItem('@ayumi_step_goal', goal.toString());
  };

  const setDistanceGoal = async (goal: number) => {
    setSettings(prev => ({ ...prev, distanceGoal: goal }));
    await AsyncStorage.setItem('@ayumi_distance_goal', goal.toString());
  };

  return (
    <SettingsContext.Provider value={{ ...settings, setTheme, setProvider, setStepGoal, setDistanceGoal, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
