import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_STEP_GOAL, DEFAULT_DISTANCE_GOAL } from '../constants';

export type ThemePreference = 'auto' | 'light' | 'dark';
export type ProviderPreference = 'health_connect' | 'device_sensor';
export type GenderPreference = 'male' | 'female' | null;

interface SettingsData {
  theme: ThemePreference;
  provider: ProviderPreference;
  stepGoal: number;
  distanceGoal: number;
  gender: GenderPreference;
  weight: number | null;
  height: number | null;
  age: number | null;
  customWaterGoal: number | null;
}

interface SettingsContextType extends SettingsData {
  setTheme: (theme: ThemePreference) => Promise<void>;
  setProvider: (provider: ProviderPreference) => Promise<void>;
  setStepGoal: (goal: number) => Promise<void>;
  setDistanceGoal: (goal: number) => Promise<void>;
  setGender: (gender: GenderPreference) => Promise<void>;
  setWeight: (weight: number | null) => Promise<void>;
  setHeight: (height: number | null) => Promise<void>;
  setAge: (age: number | null) => Promise<void>;
  setCustomWaterGoal: (goal: number | null) => Promise<void>;
  isLoading: boolean;
}

const defaultSettings: SettingsData = {
  theme: 'auto',
  provider: 'health_connect',
  stepGoal: DEFAULT_STEP_GOAL,
  distanceGoal: DEFAULT_DISTANCE_GOAL,
  gender: null,
  weight: null,
  height: null,
  age: null,
  customWaterGoal: null,
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
      const storedGender = await AsyncStorage.getItem('@ayumi_gender');
      const storedWeight = await AsyncStorage.getItem('@ayumi_weight');
      const storedHeight = await AsyncStorage.getItem('@ayumi_height');
      const storedAge = await AsyncStorage.getItem('@ayumi_age');
      const storedWaterGoal = await AsyncStorage.getItem('@ayumi_custom_water_goal');

      setSettings({
        theme: (storedTheme as ThemePreference) || 'auto',
        provider: (storedProvider as ProviderPreference) || 'health_connect',
        stepGoal: storedStepGoal ? parseInt(storedStepGoal, 10) : DEFAULT_STEP_GOAL,
        distanceGoal: storedDistanceGoal ? parseInt(storedDistanceGoal, 10) : DEFAULT_DISTANCE_GOAL,
        gender: (storedGender as GenderPreference) || null,
        weight: storedWeight ? parseFloat(storedWeight) : null,
        height: storedHeight ? parseFloat(storedHeight) : null,
        age: storedAge ? parseInt(storedAge, 10) : null,
        customWaterGoal: storedWaterGoal ? parseInt(storedWaterGoal, 10) : null,
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

  const setGender = async (gender: GenderPreference) => {
    setSettings(prev => ({ ...prev, gender }));
    if (gender) {
      await AsyncStorage.setItem('@ayumi_gender', gender);
    } else {
      await AsyncStorage.removeItem('@ayumi_gender');
    }
  };

  const setWeight = async (weight: number | null) => {
    setSettings(prev => ({ ...prev, weight }));
    if (weight !== null) {
      await AsyncStorage.setItem('@ayumi_weight', weight.toString());
    } else {
      await AsyncStorage.removeItem('@ayumi_weight');
    }
  };

  const setHeight = async (height: number | null) => {
    setSettings(prev => ({ ...prev, height }));
    if (height !== null) {
      await AsyncStorage.setItem('@ayumi_height', height.toString());
    } else {
      await AsyncStorage.removeItem('@ayumi_height');
    }
  };

  const setAge = async (age: number | null) => {
    setSettings(prev => ({ ...prev, age }));
    if (age !== null) {
      await AsyncStorage.setItem('@ayumi_age', age.toString());
    } else {
      await AsyncStorage.removeItem('@ayumi_age');
    }
  };

  const setCustomWaterGoal = async (goal: number | null) => {
    setSettings(prev => ({ ...prev, customWaterGoal: goal }));
    if (goal !== null) {
      await AsyncStorage.setItem('@ayumi_custom_water_goal', goal.toString());
    } else {
      await AsyncStorage.removeItem('@ayumi_custom_water_goal');
    }
  };

  return (
    <SettingsContext.Provider value={{ 
      ...settings, 
      setTheme, 
      setProvider, 
      setStepGoal, 
      setDistanceGoal, 
      setGender, 
      setWeight, 
      setHeight, 
      setAge, 
      setCustomWaterGoal,
      isLoading 
    }}>
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
