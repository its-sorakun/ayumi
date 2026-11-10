/**
 * DashboardScreen — the Material 3 Expressive homepage of Ayumi.
 *
 * Implements the refined, minimalist homepage faithfully matching the reference design:
 *  - 100% dynamic Material You Monet tokens extracted from user wallpaper
 *  - Minimal, calm background with clean edge-to-edge typography
 *  - High-priority contextual greeting and dynamic Health Connect status chip
 *  - Perfectly circular StepProgressIndicator with rounded endpoints and centered shoe icon
 *  - Two-row metric card grid with uniform 24dp corner radii and borderless tonal surfaces
 *  - Full-width water tracking card with +250ml quick-add action and progress indicator
 *  - Symmetrical floating bottom navigation capsule
 */

import React, { useCallback, useMemo, useRef } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../types';
import {
  EmptyState,
  HeroStepGauge,
  BentoCard,
  FloatingDock,
  RouteMapIcon,
  FlameIcon,
  BoltIcon,
  StopwatchIcon,
  DropletIcon,
} from '../components';
import { useHealthData, useWaterTracker } from '../hooks';
import { useSettings } from '../contexts/SettingsContext';
import {
  formatDistance,
  formatCalories,
  formatDuration,
  formatDate,
  calculateTotalCalories,
  calculateWaterGoal,
} from '../utils';

/** Computes dynamic greeting based on local hour */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 22) return 'Good evening';
  return 'Good night';
}

export function DashboardScreen(): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const { stepGoal, distanceGoal, gender, weight, height, age, customWaterGoal } = useSettings();
  
  // Water tracker hook
  const { totalWater, addWater, refresh: refreshWater } = useWaterTracker();

  useFocusEffect(
    useCallback(() => {
      refreshWater();
    }, [refreshWater])
  );

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
    await refreshWater();
  }, [refresh, refreshWater]);

  // Memoized formatted values
  const formattedValues = useMemo(() => {
    if (!todaySummary) return null;

    let totalCaloriesStr = 'Setup';
    if (gender && weight && height && age) {
      const totalCal = calculateTotalCalories(todaySummary.calories, gender, weight, height, age);
      totalCaloriesStr = formatCalories(totalCal);
    }

    const waterGoal = customWaterGoal || calculateWaterGoal(gender, weight, height, age);
    const formattedWaterGoal = (waterGoal / 1000).toFixed(1) + ' L';
    const waterProgress = waterGoal > 0 ? Math.min(totalWater / waterGoal, 1) : 0;

    return {
      steps: todaySummary.steps,
      distance: formatDistance(todaySummary.distance),
      calories: formatCalories(todaySummary.calories),
      totalCalories: totalCaloriesStr,
      waterGoalText: formattedWaterGoal,
      waterProgress,
      activeTime: formatDuration(todaySummary.activeTime),
      distanceProgress: distanceGoal > 0 ? todaySummary.distance / distanceGoal : 0,
      date: formatDate(todaySummary.date),
      sources: todaySummary.sources.length > 0 ? todaySummary.sources.join(', ') : providerName,
    };
  }, [todaySummary, providerName, distanceGoal, gender, weight, height, age, customWaterGoal, totalWater]);

  // Helper to split numerical value and unit
  const splitValue = (rawStr: string | undefined): [string, string] => {
    if (!rawStr) return ['0', ''];
    const parts = rawStr.trim().split(' ');
    if (parts.length === 1) return [parts[0], ''];
    return [parts[0], parts.slice(1).join(' ')];
  };

  const [calValue, calUnit] = splitValue(formattedValues?.calories);
  const [distValue, distUnit] = splitValue(formattedValues?.distance);
  const [totalCalValue, totalCalUnit] = splitValue(formattedValues?.totalCalories);
  const [activeTimeValue, activeTimeUnit] = splitValue(formattedValues?.activeTime);

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
        secondaryActionLabel={providerName === 'Health Connect' ? 'Use Device Sensor Instead' : undefined}
        onSecondaryAction={providerName === 'Health Connect' ? switchToDeviceSensor : undefined}
      />
    );
  }

  // Handle error state
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
    <View style={[styles.screenWrapper, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: insets.bottom + 88,
          },
        ]}
        bounces={false}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            progressBackgroundColor={theme.colors.surface}
          />
        }
        accessibilityLabel="Ayumi Dashboard">

        {/* Minimalist Top Header: Greeting & Status Chip */}
        <View style={styles.topBarRow}>
          <Text style={[styles.greetingTitleText, { color: theme.colors.onSurface }]}>
            {getGreeting()}
          </Text>
          <View style={styles.dateBadgeRow}>
            <Text style={[styles.dateBadgeText, { color: theme.colors.onSurfaceVariant }]}>
              {formattedValues?.date ?? formatDate(new Date())}
            </Text>
            {providerName != null && (
              <View
                style={[
                  styles.providerBadge,
                  { backgroundColor: theme.colors.primaryContainer },
                ]}>
                <View style={[styles.liveDot, { backgroundColor: theme.colors.primary }]} />
                <Text
                  style={[
                    styles.providerBadgeText,
                    { color: theme.colors.onPrimaryContainer },
                  ]}>
                  {providerName}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Central Step Progress Indicator */}
        <HeroStepGauge
          steps={formattedValues?.steps ?? 0}
          goal={stepGoal}
          onPress={() => navigation.navigate('StepsDetails')}
        />

        {/* Bento Grid Metrics */}
        {formattedValues != null && (
          <View style={styles.bentoGrid}>
            {/* Row 1: Active Calories (tertiaryContainer) & Distance (secondaryContainer) */}
            <View style={styles.bentoRow}>
              <BentoCard
                title={'Active\nCalories'}
                value={calValue}
                unit={calUnit}
                icon={<FlameIcon size={22} color={theme.colors.tertiary} />}
                iconBgColor={theme.colors.surface}
                cardBgColor={theme.colors.tertiaryContainer}
                titleColor={theme.colors.onTertiaryContainer}
                valueColor={theme.colors.onTertiaryContainer}
              />
              <BentoCard
                title="Distance"
                value={distValue}
                unit={distUnit}
                subtitle={`Goal: ${formatDistance(distanceGoal)}`}
                icon={<RouteMapIcon size={22} color={theme.colors.secondary} />}
                iconBgColor={theme.colors.surface}
                cardBgColor={theme.colors.secondaryContainer}
                titleColor={theme.colors.onSecondaryContainer}
                valueColor={theme.colors.onSecondaryContainer}
                subtitleColor={theme.colors.onSecondaryContainer}
                progress={formattedValues.distanceProgress}
                progressBarColor={theme.colors.secondary}
                onPress={() => navigation.navigate('DistanceDetails')}
              />
            </View>

            {/* Row 2: Total Calories & Active Time (surface tonal containers) */}
            <View style={styles.bentoRow}>
              <BentoCard
                title={'Total\nCalories'}
                value={totalCalValue}
                unit={totalCalUnit}
                subtitle={formattedValues.totalCalories === 'Setup' ? 'Tap to configure' : undefined}
                icon={<BoltIcon size={22} color={theme.colors.primary} />}
                iconBgColor={theme.colors.primaryContainer}
                cardBgColor={theme.colors.surface}
                titleColor={theme.colors.onSurfaceVariant}
                valueColor={theme.colors.onSurface}
                subtitleColor={theme.colors.onSurfaceVariant}
                onPress={formattedValues.totalCalories === 'Setup' ? () => navigation.navigate('Settings') : undefined}
              />
              <BentoCard
                title="Active Time"
                value={activeTimeValue}
                unit={activeTimeUnit}
                icon={<StopwatchIcon size={22} color={theme.colors.secondary} />}
                iconBgColor={theme.colors.secondaryContainer}
                cardBgColor={theme.colors.surface}
                titleColor={theme.colors.onSurfaceVariant}
                valueColor={theme.colors.onSurface}
              />
            </View>

            {/* Row 3 (Full Width): Water Hydration Card in primaryContainer */}
            <View style={styles.bentoRow}>
              <BentoCard
                title="Water"
                value={`${totalWater}`}
                unit="ml"
                subtitle={`Goal: ${formattedValues.waterGoalText}`}
                icon={<DropletIcon size={22} color={theme.colors.primary} />}
                iconBgColor={theme.colors.surface}
                cardBgColor={theme.colors.primaryContainer}
                titleColor={theme.colors.onPrimaryContainer}
                valueColor={theme.colors.onPrimaryContainer}
                subtitleColor={theme.colors.onPrimaryContainer}
                fullWidth={true}
                progress={formattedValues.waterProgress}
                progressBarColor={theme.colors.primary}
                actionLabel="+ 250 ml"
                onActionPress={() => addWater(250)}
                onPress={() => navigation.navigate('WaterDetails')}
              />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Floating Bottom Navigation Dock */}
      <FloatingDock
        onHomePress={() => scrollViewRef.current?.scrollTo({ y: 0, animated: true })}
        onAnalyticsPress={() => navigation.navigate('StepsDetails')}
        onProfilePress={() => navigation.navigate('Settings')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 0,
  },
  topBarRow: {
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  greetingTitleText: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  dateBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  dateBadgeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  providerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  providerBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  bentoGrid: {
    paddingHorizontal: 20,
    gap: 14,
    marginTop: 4,
  },
  bentoRow: {
    flexDirection: 'row',
    gap: 14,
  },
});
