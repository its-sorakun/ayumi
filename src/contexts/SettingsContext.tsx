import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePreference = 'auto' | 'light' | 'dark';
export type ProviderPreference = 'health_connect' | 'device_sensor';

interface SettingsData {
  theme: ThemePreference;
  provider: ProviderPreference;
}

interface SettingsContextType extends SettingsData {
  setTheme: (theme: ThemePreference) => Promise<void>;
  setProvider: (provider: ProviderPreference) => Promise<void>;
  isLoading: boolean;
}

const defaultSettings: SettingsData = {
  theme: 'auto',
  provider: 'health_connect',
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

      setSettings({
        theme: (storedTheme as ThemePreference) || 'auto',
        provider: (storedProvider as ProviderPreference) || 'health_connect',
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

  return (
    <SettingsContext.Provider value={{ ...settings, setTheme, setProvider, isLoading }}>
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
