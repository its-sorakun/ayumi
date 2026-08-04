/**
 * AppNavigator — the root navigation structure for Ayumi.
 *
 * Currently a simple single-stack with Dashboard as the home screen.
 * History and Settings screens will be added in subsequent phases.
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';

import { DashboardScreen, SettingsScreen } from '../screens';
import type { RootStackParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator(): React.JSX.Element {
  const theme = useTheme();

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.colors.surface,
          },
          headerTintColor: theme.colors.onSurface,
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: theme.colors.background,
          },
          animation: 'fade_from_bottom',
        }}>
        <Stack.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{
            title: 'Ayumi',
            headerLargeTitle: false,
          }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            title: 'Settings',
            headerLargeTitle: false,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
