/**
 * DashboardScreen — the Material 3 Expressive homepage of Ayumi.
 *
 * Implements a single-page, Pinterest-level aesthetic widget dashboard:
 *  - Dynamic Material You Monet system theming with zero hardcoded colors
 *  - High-priority contextual greeting and live sensor status in top header
 *  - HeroStepGauge centerpiece with circular progress arc and goal pill badge
 *  - Scalloped 8-petal cookie widget for Active Calories
 *  - Asymmetric and pill-shaped BentoCards for Distance, Energy, and Time
 *  - Interactive Water Widget with fluid wave accent and instant in-widget +250ml logging
 *  - Floating pill navigation dock
 */

import React, { useCallback, useMemo, useRef } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import type { RootStackParamList } from '../types';
import {
  EmptyState,
  HeroStepGauge,
  BentoCard,
  FloatingDock,
  SettingsGearIcon,
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
      {/* Decorative top-right organic fluid wave */}
      <View style={styles.topWaveWrapper} pointerEvents="none">
        <Svg width={SCREEN_WIDTH} height={160} viewBox="0 0 380 160">
          <Path
            d="M140 0C210 20 280 85 380 70V0H140Z"
            fill={theme.colors.primaryContainer}
            opacity={0.35}
          />
          <Path
            d="M200 0C250 40 310 120 380 110V0H200Z"
            fill={theme.colors.secondaryContainer}
            opacity={0.25}
          />
        </Svg>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: insets.bottom + 76,
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

        {/* Top Header Row with Greeting & Live Status on Left, Settings on Right */}
        <View style={styles.topBarRow}>
          <View style={styles.greetingContainer}>
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

          {/* Settings Bubble Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Settings')}
            style={[
              styles.settingsBubbleButton,
              {
                backgroundColor: theme.colors.surfaceVariant,
                borderColor: theme.colors.outlineVariant,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Open settings">
            <SettingsGearIcon size={19} color={theme.colors.onSurfaceVariant} />
          </TouchableOpacity>
        </View>

        {/* Centerpiece: Expressive Hero Step Circular Gauge */}
        <HeroStepGauge
          steps={formattedValues?.steps ?? 0}
          goal={stepGoal}
          onPress={() => navigation.navigate('StepsDetails')}
        />

        {/* Bento Grid Metrics */}
        {formattedValues != null && (
          <View style={styles.bentoGrid}>
            {/* Row 1: Active Calories (Scalloped Cookie) & Distance (Asymmetric Pill) */}
            <View style={styles.bentoRow}>
              <BentoCard
                title="Active Calories"
                value={formattedValues.calories}
                icon={<FlameIcon size={20} color={theme.colors.onTertiaryContainer} />}
                useScallopBadge={true}
                iconBgColor={theme.colors.tertiaryContainer}
                cardBgColor={theme.colors.elevation.level1}
                borderColor={theme.colors.outlineVariant}
              />
              <BentoCard
                title="Distance"
                value={formattedValues.distance}
                subtitle={`Goal: ${formatDistance(distanceGoal)}`}
                icon={<RouteMapIcon size={20} color={theme.colors.onSecondaryContainer} />}
                iconBgColor={theme.colors.secondaryContainer}
                cardBgColor={theme.colors.elevation.level1}
                borderColor={theme.colors.outlineVariant}
                shapeVariant="asymmetric"
                progress={formattedValues.distanceProgress}
                progressBarColor={theme.colors.secondary}
                onPress={() => navigation.navigate('DistanceDetails')}
              />
            </View>

            {/* Row 2: Total Calories & Active Time */}
            <View style={styles.bentoRow}>
              <BentoCard
                title="Total Calories"
                value={formattedValues.totalCalories}
                subtitle={formattedValues.totalCalories === 'Setup' ? 'Tap to configure' : undefined}
                icon={<BoltIcon size={20} color={theme.colors.primary} />}
                iconBgColor={theme.colors.surfaceVariant}
                cardBgColor={theme.colors.elevation.level1}
                borderColor={theme.colors.outlineVariant}
                shapeVariant="squircle"
                onPress={formattedValues.totalCalories === 'Setup' ? () => navigation.navigate('Settings') : undefined}
              />
              <BentoCard
                title="Active Time"
                value={formattedValues.activeTime}
                icon={<StopwatchIcon size={20} color={theme.colors.secondary} />}
                iconBgColor={theme.colors.surfaceVariant}
                cardBgColor={theme.colors.elevation.level1}
                borderColor={theme.colors.outlineVariant}
                shapeVariant="pill"
              />
            </View>

            {/* Row 3 (Full Width): Interactive Water Hydration Widget */}
            <View style={styles.bentoRow}>
              <BentoCard
                title="Water"
                value={`${totalWater} ml`}
                subtitle={`Goal: ${formattedValues.waterGoalText}`}
                icon={<DropletIcon size={20} color={theme.colors.primary} />}
                iconBgColor={theme.colors.primaryContainer}
                cardBgColor={theme.colors.elevation.level1}
                borderColor={theme.colors.outlineVariant}
                shapeVariant="pill"
                progress={formattedValues.waterProgress}
                progressBarColor={theme.colors.primary}
                fullWidth={true}
                showWaterWave={true}
                actionLabel="+250 ml"
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
  topWaveWrapper: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 0,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  greetingContainer: {
    flex: 1,
  },
  greetingTitleText: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  dateBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  dateBadgeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  providerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  providerBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  settingsBubbleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  bentoGrid: {
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 2,
  },
  bentoRow: {
    flexDirection: 'row',
    gap: 8,
  },
});
