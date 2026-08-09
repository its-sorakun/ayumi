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

import React, { useCallback, useMemo, useLayoutEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme, IconButton, Portal, Dialog, Button, TextInput, List, Divider } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';

import { StatCard, EmptyState } from '../components';
import { useHealthData, useWaterTracker } from '../hooks';
import { useSettings } from '../contexts/SettingsContext';
import {
  formatNumber,
  formatDistance,
  formatCalories,
  formatDuration,
  formatDate,
  calculateTotalCalories,
  calculateWaterGoal,
} from '../utils';

export function DashboardScreen(): React.JSX.Element {
  const theme = useTheme();
  const { stepGoal, distanceGoal, gender, weight, height, age, customWaterGoal } = useSettings();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  
  // Water Tracker State
  const { totalWater, addWater, logs, deleteWater } = useWaterTracker();
  const [waterModalVisible, setWaterModalVisible] = useState(false);
  const [customWaterInput, setCustomWaterInput] = useState('');

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
    
    let totalCaloriesStr = "Setup";
    if (gender && weight && height && age) {
      const totalCal = calculateTotalCalories(todaySummary.calories, gender, weight, height, age);
      totalCaloriesStr = formatCalories(totalCal);
    }

    const waterGoal = customWaterGoal || calculateWaterGoal(gender, weight, height, age);
    const formattedWaterGoal = (waterGoal / 1000).toFixed(1) + ' L';
    const waterProgress = Math.min(totalWater / waterGoal, 1);
    
    return {
      steps: formatNumber(todaySummary.steps),
      distance: formatDistance(todaySummary.distance),
      calories: formatCalories(todaySummary.calories),
      totalCalories: totalCaloriesStr,
      waterGoalText: formattedWaterGoal,
      waterProgress,
      activeTime: formatDuration(todaySummary.activeTime),
      stepProgress: todaySummary.steps / stepGoal,
      distanceProgress: todaySummary.distance / distanceGoal,
      date: formatDate(todaySummary.date),
      sources: todaySummary.sources.length > 0 ? todaySummary.sources.join(', ') : providerName,
    };
  }, [todaySummary, providerName, stepGoal, distanceGoal, gender, weight, height, age, customWaterGoal]);

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
              subtitle={`Goal: ${formatNumber(stepGoal)}`}
              icon="👟"
              progress={formattedValues.stepProgress}
              onPress={() => navigation.navigate('StepsDetails')}
            />
            <StatCard
              title="Distance"
              value={formattedValues.distance}
              subtitle={`Goal: ${formatDistance(distanceGoal)}`}
              icon="📏"
              progress={formattedValues.distanceProgress}
            />
          </View>
          <View style={styles.row}>
            <StatCard
              title={"ACTIVE\nCALORIES"}
              value={formattedValues.calories}
              icon="🔥"
            />
            <StatCard
              title={"TOTAL\nCALORIES"}
              value={formattedValues.totalCalories}
              subtitle={formattedValues.totalCalories === "Setup" ? "Tap settings to configure" : undefined}
              icon="⚡"
            />
          </View>
          
          <View style={styles.row}>
            <StatCard
              title="Active Time"
              value={formattedValues.activeTime}
              icon="⏱️"
            />
            <StatCard
              title="Water"
              value={`${totalWater} ml`}
              subtitle={`Goal: ${formattedValues.waterGoalText}`}
              icon="💧"
              progress={formattedValues.waterProgress}
              onPress={() => setWaterModalVisible(true)}
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

      {/* Water Tracker Modal */}
      <Portal>
        <Dialog visible={waterModalVisible} onDismiss={() => setWaterModalVisible(false)} style={{ maxHeight: '80%' }}>
          <Dialog.Title>Log Water</Dialog.Title>
          <Dialog.Content>
            <View style={styles.quickAddContainer}>
              <Button mode="contained-tonal" onPress={() => { addWater(250); setWaterModalVisible(false); }}>+ 250ml</Button>
              <Button mode="contained-tonal" onPress={() => { addWater(500); setWaterModalVisible(false); }}>+ 500ml</Button>
            </View>
            <View style={styles.customInputContainer}>
              <TextInput
                mode="outlined"
                keyboardType="numeric"
                label="Custom amount (ml)"
                value={customWaterInput}
                onChangeText={setCustomWaterInput}
                style={{ flex: 1 }}
                dense
              />
              <Button 
                mode="contained" 
                onPress={() => {
                  const val = parseInt(customWaterInput, 10);
                  if (!isNaN(val) && val > 0) {
                    addWater(val);
                    setCustomWaterInput('');
                    setWaterModalVisible(false);
                  }
                }}>
                Add
              </Button>
            </View>
            
            <Divider style={{ marginVertical: 16 }} />
            <Text variant="titleSmall" style={{ marginBottom: 8, color: theme.colors.onSurfaceVariant }}>Today's Logs</Text>
            
            <ScrollView style={{ maxHeight: 200 }}>
              {logs.length === 0 ? (
                <Text style={{ textAlign: 'center', marginVertical: 16, color: theme.colors.outline }}>No water logged yet today.</Text>
              ) : (
                logs.map(log => (
                  <List.Item
                    key={log.id}
                    title={`${log.amount} ml`}
                    description={log.time}
                    left={props => <List.Icon {...props} icon={() => <Text>💧</Text>} />}
                    right={props => (
                      <IconButton {...props} icon={() => <Text>❌</Text>} onPress={() => deleteWater(log.id)} />
                    )}
                  />
                ))
              )}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setWaterModalVisible(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  quickAddContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  customInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
