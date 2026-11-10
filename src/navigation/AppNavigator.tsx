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

import {
  MainPagerScreen,
  SettingsScreen,
  StepsDetailsScreen,
  DistanceDetailsScreen,
  WaterDetailsScreen,
} from '../screens';
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
          animation: 'slide_from_bottom',
          animationDuration: 280,
          gestureEnabled: true,
        }}>
        <Stack.Screen
          name="Dashboard"
          component={MainPagerScreen}
          options={{
            headerShown: false,
          }}
          initialParams={{ initialPage: 0 }}
        />
        <Stack.Screen
          name="Stats"
          component={MainPagerScreen}
          options={{
            headerShown: false,
          }}
          initialParams={{ initialPage: 1 }}
        />
        <Stack.Screen 
          name="StepsDetails" 
          component={StepsDetailsScreen}
          options={{ title: 'Steps Details' }}
        />
        <Stack.Screen 
          name="DistanceDetails" 
          component={DistanceDetailsScreen}
          options={{ title: 'Distance Details' }}
        />
        <Stack.Screen 
          name="WaterDetails" 
          component={WaterDetailsScreen}
          options={{ title: 'Water Details' }}
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
