/**
 * DashboardScreen — the main screen of Ayumi.
 *
 * Displays today's health metrics (steps, distance, calories, active time)
 * with progress indicators. Handles all provider states gracefully:
 * - Loading
 * - Provider unavailable (Health Connect not installed)
 * - Permissions not granted
 * - No data available
 * - Data loaded successfully
 */

import React, { useCallback, useMemo, useLayoutEffect } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme, IconButton } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';

import { StatCard, EmptyState } from '../components';
import { useHealthData } from '../hooks';
import {
  DEFAULT_STEP_GOAL,
  DEFAULT_DISTANCE_GOAL,
  DEFAULT_CALORIE_GOAL,
} from '../constants';
import {
  formatNumber,
  formatDistance,
  formatCalories,
  formatDuration,
  formatDate,
} from '../utils';

export function DashboardScreen(): React.JSX.Element {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <IconButton
          icon={() => <Text>⚙️</Text>}
          onPress={() => navigation.navigate('Settings')}
          accessibilityLabel="Settings"
        />
      ),
    });
  }, [navigation]);

  const {
    loading,
    providerStatus,
    providerName,
    todaySummary,
    hasPermissions,
    error,
    requestPermissions,
    switchToDeviceSensor,
    refresh,
  } = useHealthData();

  const onRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  // Memoize formatted values to avoid recomputation on every render
  const formattedValues = useMemo(() => {
    if (!todaySummary) { return null; }
    return {
      steps: formatNumber(todaySummary.steps),
      distance: formatDistance(todaySummary.distance),
      calories: formatCalories(todaySummary.calories),
      activeTime: formatDuration(todaySummary.activeTime),
      stepProgress: todaySummary.steps / DEFAULT_STEP_GOAL,
      distanceProgress: todaySummary.distance / DEFAULT_DISTANCE_GOAL,
      calorieProgress: todaySummary.calories / DEFAULT_CALORIE_GOAL,
      date: formatDate(todaySummary.date),
      sources: todaySummary.sources.length > 0 ? todaySummary.sources.join(', ') : providerName,
    };
  }, [todaySummary, providerName]);

  // Handle provider unavailable
  if (providerStatus === 'not_installed' || providerStatus === 'not_supported') {
    return (
      <EmptyState
        icon="💔"
        title="Health Connect Required"
        description="Ayumi needs Health Connect to read your health data. Please install Health Connect from the Play Store."
      />
    );
  }

  if (providerStatus === 'update_required') {
    return (
      <EmptyState
        icon="🔄"
        title="Update Required"
        description="Your version of Health Connect needs to be updated for Ayumi to work."
      />
    );
  }

  // Handle permission needed
  if (
    providerStatus === 'available' &&
    !hasPermissions &&
    !loading &&
    error == null
  ) {
    return (
      <EmptyState
        icon="🛡️"
        title="Permission Needed"
        description="Ayumi needs permission to read your health data from Health Connect. Your data never leaves your device."
        actionLabel="Grant Permission"
        onAction={requestPermissions}
        secondaryActionLabel={providerName === 'Health Connect' ? "Use Device Sensor Instead" : undefined}
        onSecondaryAction={providerName === 'Health Connect' ? switchToDeviceSensor : undefined}
      />
    );
  }

  // Handle error
  if (error != null && !loading) {
    return (
      <EmptyState
        icon="⚠️"
        title="Something went wrong"
        description={error}
        actionLabel="Try Again"
        onAction={refresh}
      />
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={onRefresh}
          colors={[theme.colors.primary]}
          progressBackgroundColor={theme.colors.surface}
        />
      }
      accessibilityLabel="Dashboard">
      {/* Header */}
      <View style={styles.header}>
        <Text
          variant="headlineLarge"
          style={{ color: theme.colors.onBackground }}>
          Today
        </Text>
        <Text
          variant="bodyMedium"
          style={{ color: theme.colors.onSurfaceVariant }}>
          {formattedValues?.date ?? ''}
          {providerName != null ? ` · ${providerName}` : ''}
        </Text>
      </View>

      {/* Stat Cards Grid */}
      {formattedValues != null && (
        <>
          <View style={styles.row}>
            <StatCard
              title="Steps"
              value={formattedValues.steps}
              subtitle={`Goal: ${formatNumber(DEFAULT_STEP_GOAL)}`}
              icon="👟"
              progress={formattedValues.stepProgress}
            />
            <StatCard
              title="Distance"
              value={formattedValues.distance}
              subtitle={`Goal: ${formatDistance(DEFAULT_DISTANCE_GOAL)}`}
              icon="📏"
              progress={formattedValues.distanceProgress}
            />
          </View>
          <View style={styles.row}>
            <StatCard
              title="Calories"
              value={formattedValues.calories}
              subtitle={`Goal: ${formatCalories(DEFAULT_CALORIE_GOAL)}`}
              icon="🔥"
              progress={formattedValues.calorieProgress}
            />
            <StatCard
              title="Active Time"
              value={formattedValues.activeTime}
              icon="⏱️"
            />
          </View>

          {/* Data Sources */}
          {formattedValues.sources != null && (
            <View style={styles.sourcesContainer}>
              <Text
                variant="labelSmall"
                style={{ color: theme.colors.onSurfaceVariant }}>
                Data from: {formattedValues.sources}
              </Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 20,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    marginHorizontal: -6,
  },
  sourcesContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
});
