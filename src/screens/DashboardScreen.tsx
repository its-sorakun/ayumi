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
  PixelRatio,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';

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
  AiAmbientDashboardView,
  colorWithOpacity,
  computeOxygenHomeLayout,
  deriveHarmonicGlowSecondaryHex,
  OxygenActiveTimeIcon,
  OxygenAmbientBackdrop,
  OxygenCaloriesIcon,
  OxygenDistanceIcon,
  OxygenTotalCaloriesIcon,
  OxygenWaterIcon,
  resolveMetricBadgeColors,
  useAyumiTheme,
} from '../themes';
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

interface DashboardScreenProps {
  readonly hideDock?: boolean;
  readonly onNavigateToStats?: (metric: 'steps' | 'distance' | 'water') => void;
  readonly onNavigateToSettings?: () => void;
}

export function DashboardScreen({
  hideDock = false,
  onNavigateToStats,
  onNavigateToSettings,
}: DashboardScreenProps = {}): React.JSX.Element {
  const theme = useTheme();
  const { themeId, colors, isDark, surfaces, shapes, typography, metricAccents } = useAyumiTheme();
  const isOemHomeLayout = surfaces.bentoLayout === 'header_inline';
  const useSoftOemBadges = isOemHomeLayout;
  const isOxygenIcons = surfaces.iconFamily === 'oxygen_lucide';
  const isSolidBadges = surfaces.badgeStyle === 'solid';
  const defaultCardBg = theme.dark ? theme.colors.elevation.level1 : theme.colors.surface;
  const caloriesBadge = resolveMetricBadgeColors(metricAccents.calories, surfaces.badgeStyle);
  const distanceBadge = resolveMetricBadgeColors(metricAccents.distance, surfaces.badgeStyle);
  const totalCaloriesBadge = resolveMetricBadgeColors(metricAccents.totalCalories, surfaces.badgeStyle);
  const activeTimeBadge = resolveMetricBadgeColors(metricAccents.activeTime, surfaces.badgeStyle);
  const waterBadge = resolveMetricBadgeColors(metricAccents.water, surfaces.badgeStyle);
  const resolveBadgeBg = (accentColor: string, fallbackContainer: string) =>
    useSoftOemBadges
      ? colorWithOpacity(accentColor, theme.dark ? 0.2 : 0.11)
      : fallbackContainer;
  const insets = useSafeAreaInsets();
  const safeFrame = useSafeAreaFrame();
  const fontScale = PixelRatio.getFontScale();
  const oemDockClearance = Math.max(insets.bottom + 8, 16) + shapes.dockHeight;
  const oemHomeLayout = isOemHomeLayout
    ? computeOxygenHomeLayout(safeFrame.height, insets.top, oemDockClearance, fontScale)
    : null;
  const scrollViewRef = useRef<ScrollView>(null);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const navigateToStatsMetric = (metric: 'steps' | 'distance' | 'water') => {
    if (onNavigateToStats) {
      onNavigateToStats(metric);
    } else {
      navigation.navigate('Stats', { metric });
    }
  };

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
      waterGoalMl: waterGoal,
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

  if (themeId === 'ai_ambient') {
    const resolvedWaterGoalMl =
      formattedValues?.waterGoalMl ??
      (customWaterGoal || calculateWaterGoal(gender, weight, height, age));
    const resolvedWaterGoalText =
      formattedValues?.waterGoalText ?? `${(resolvedWaterGoalMl / 1000).toFixed(1)} L`;

    return (
      <AiAmbientDashboardView
        steps={formattedValues?.steps ?? 0}
        stepGoal={stepGoal}
        activeCaloriesText={calValue}
        activeCaloriesUnit={calUnit || 'kcal'}
        totalCaloriesRaw={formattedValues?.totalCalories ?? 'Setup'}
        distanceValue={distValue}
        distanceUnit={distUnit || 'km'}
        distanceGoalText={formatDistance(distanceGoal)}
        distanceProgress={formattedValues?.distanceProgress ?? 0}
        activeTimeValue={activeTimeValue}
        activeTimeUnit={activeTimeUnit || 'min'}
        totalWaterMl={totalWater}
        waterGoalMl={resolvedWaterGoalMl}
        waterGoalText={resolvedWaterGoalText}
        waterProgress={formattedValues?.waterProgress ?? 0}
        refreshing={loading}
        hideDock={hideDock}
        onRefresh={onRefresh}
        onAddWater={addWater}
        onOpenStepsStats={() => navigateToStatsMetric('steps')}
        onOpenDistanceStats={() => navigateToStatsMetric('distance')}
        onOpenWaterStats={() => navigateToStatsMetric('water')}
        onOpenSettings={() =>
          onNavigateToSettings ? onNavigateToSettings() : navigation.navigate('Settings')
        }
      />
    );
  }

  return (
    <View style={[styles.screenWrapper, { backgroundColor: theme.colors.background }]}>
      <OxygenAmbientBackdrop
        enabled={surfaces.ambientGradientStyle === 'dynamic_glow'}
        primaryHex={colors.primary}
        secondaryHex={deriveHarmonicGlowSecondaryHex(colors.primary, colors.tertiary, isDark)}
        isDark={isDark}
        testID="dashboard-ambient-backdrop"
      />
      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          oemHomeLayout
            ? {
                paddingTop: oemHomeLayout.topPadding,
                paddingBottom: oemHomeLayout.bottomPadding,
              }
            : {
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
        <View
          style={[
            styles.topBarRow,
            oemHomeLayout && { marginBottom: oemHomeLayout.headerBottomMargin },
          ]}>
          <Text
            style={[
              styles.greetingTitleText,
              {
                color: theme.colors.onSurface,
                fontSize: typography.screenTitleSize,
                fontWeight: typography.screenTitleWeight,
                letterSpacing: typography.screenTitleTracking,
              },
            ]}>
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
                  { backgroundColor: metricAccents.steps.container },
                ]}>
                <View style={[styles.liveDot, { backgroundColor: metricAccents.steps.color }]} />
                <Text
                  style={[
                    styles.providerBadgeText,
                    { color: metricAccents.steps.onContainer },
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
          ringSize={oemHomeLayout?.heroRingSize}
          cardPaddingVertical={oemHomeLayout?.heroPaddingVertical}
          marginTop={oemHomeLayout ? 0 : undefined}
          marginBottom={oemHomeLayout?.gridGap}
          onPress={() => navigateToStatsMetric('steps')}
        />

        {/* Bento Grid Metrics */}
        {formattedValues != null && (
          <View
            style={[
              styles.bentoGrid,
              oemHomeLayout && { gap: oemHomeLayout.gridGap, marginTop: 0 },
            ]}>
            {/* Row 1: Active Calories & Distance (theme-driven multi-accent icon bubbles) */}
            <View style={[styles.bentoRow, oemHomeLayout && { gap: oemHomeLayout.gridGap }]}>
              <BentoCard
                title={'Active\nCalories'}
                value={calValue}
                unit={calUnit}
                style={oemHomeLayout ? { minHeight: oemHomeLayout.row1MinHeight } : undefined}
                icon={
                  isOxygenIcons ? (
                    <OxygenCaloriesIcon size={17} color={caloriesBadge.fg} filled={isSolidBadges} />
                  ) : (
                    <FlameIcon size={useSoftOemBadges ? 17 : 22} color={metricAccents.calories.color} />
                  )
                }
                iconBgColor={
                  isSolidBadges
                    ? caloriesBadge.bg
                    : resolveBadgeBg(metricAccents.calories.color, metricAccents.calories.container)
                }
                cardBgColor={defaultCardBg}
                titleColor={theme.colors.onSurfaceVariant}
                valueColor={theme.colors.onSurface}
                progressBarColor={metricAccents.calories.color}
              />
              <BentoCard
                title="Distance"
                value={distValue}
                unit={distUnit}
                subtitle={`Goal: ${formatDistance(distanceGoal)}`}
                style={oemHomeLayout ? { minHeight: oemHomeLayout.row1MinHeight } : undefined}
                icon={
                  isOxygenIcons ? (
                    <OxygenDistanceIcon size={17} color={distanceBadge.fg} filled={isSolidBadges} />
                  ) : (
                    <RouteMapIcon size={useSoftOemBadges ? 17 : 22} color={metricAccents.distance.color} />
                  )
                }
                iconBgColor={
                  isSolidBadges
                    ? distanceBadge.bg
                    : resolveBadgeBg(metricAccents.distance.color, metricAccents.distance.container)
                }
                cardBgColor={defaultCardBg}
                titleColor={theme.colors.onSurfaceVariant}
                valueColor={theme.colors.onSurface}
                subtitleColor={theme.colors.onSurfaceVariant}
                progress={formattedValues.distanceProgress}
                progressBarColor={metricAccents.distance.color}
                onPress={() => navigateToStatsMetric('distance')}
              />
            </View>

            {/* Row 2: Total Calories & Active Time (theme-driven multi-accent icon bubbles) */}
            <View style={[styles.bentoRow, oemHomeLayout && { gap: oemHomeLayout.gridGap }]}>
              <BentoCard
                title={'Total\nCalories'}
                value={totalCalValue}
                unit={totalCalUnit}
                subtitle={formattedValues.totalCalories === 'Setup' ? 'Tap to configure' : undefined}
                style={oemHomeLayout ? { minHeight: oemHomeLayout.row2MinHeight } : undefined}
                icon={
                  isOxygenIcons ? (
                    <OxygenTotalCaloriesIcon
                      size={17}
                      color={totalCaloriesBadge.fg}
                      filled={isSolidBadges}
                    />
                  ) : (
                    <BoltIcon size={useSoftOemBadges ? 17 : 22} color={metricAccents.totalCalories.color} />
                  )
                }
                iconBgColor={
                  isSolidBadges
                    ? totalCaloriesBadge.bg
                    : resolveBadgeBg(
                        metricAccents.totalCalories.color,
                        metricAccents.totalCalories.container,
                      )
                }
                cardBgColor={defaultCardBg}
                titleColor={theme.colors.onSurfaceVariant}
                valueColor={theme.colors.onSurface}
                subtitleColor={theme.colors.onSurfaceVariant}
                progressBarColor={metricAccents.totalCalories.color}
                onPress={formattedValues.totalCalories === 'Setup' ? () => navigation.navigate('Settings') : undefined}
              />
              <BentoCard
                title="Active Time"
                value={activeTimeValue}
                unit={activeTimeUnit}
                style={oemHomeLayout ? { minHeight: oemHomeLayout.row2MinHeight } : undefined}
                icon={
                  isOxygenIcons ? (
                    <OxygenActiveTimeIcon size={17} color={activeTimeBadge.fg} filled={isSolidBadges} />
                  ) : (
                    <StopwatchIcon size={useSoftOemBadges ? 17 : 22} color={metricAccents.activeTime.color} />
                  )
                }
                iconBgColor={
                  isSolidBadges
                    ? activeTimeBadge.bg
                    : resolveBadgeBg(metricAccents.activeTime.color, metricAccents.activeTime.container)
                }
                cardBgColor={defaultCardBg}
                titleColor={theme.colors.onSurfaceVariant}
                valueColor={theme.colors.onSurface}
                progressBarColor={metricAccents.activeTime.color}
              />
            </View>

            {/* Row 3 (Full Width): Water Hydration Card */}
            <View style={styles.bentoRow}>
              <BentoCard
                title="Water"
                value={`${totalWater}`}
                unit="ml"
                subtitle={`Goal: ${formattedValues.waterGoalText}`}
                style={oemHomeLayout ? { minHeight: oemHomeLayout.waterMinHeight } : undefined}
                icon={
                  isOxygenIcons ? (
                    <OxygenWaterIcon
                      size={17}
                      color={
                        useSoftOemBadges
                          ? metricAccents.water.color
                          : isSolidBadges
                            ? waterBadge.fg
                            : metricAccents.water.color
                      }
                      filled={isSolidBadges && !useSoftOemBadges}
                    />
                  ) : (
                    <DropletIcon size={useSoftOemBadges ? 17 : 22} color={metricAccents.water.color} />
                  )
                }
                iconBgColor={
                  surfaces.tintHomeWaterCard
                    ? theme.dark
                      ? colorWithOpacity(theme.colors.onSurface, 0.12)
                      : theme.colors.surface
                    : useSoftOemBadges
                    ? resolveBadgeBg(metricAccents.water.color, metricAccents.water.container)
                    : isSolidBadges
                    ? waterBadge.bg
                    : resolveBadgeBg(metricAccents.water.color, metricAccents.water.container)
                }
                cardBgColor={surfaces.tintHomeWaterCard ? metricAccents.water.container : defaultCardBg}
                titleColor={surfaces.tintHomeWaterCard ? metricAccents.water.onContainer : theme.colors.onSurfaceVariant}
                valueColor={surfaces.tintHomeWaterCard ? metricAccents.water.onContainer : theme.colors.onSurface}
                subtitleColor={surfaces.tintHomeWaterCard ? metricAccents.water.onContainer : theme.colors.onSurfaceVariant}
                fullWidth={true}
                progress={formattedValues.waterProgress}
                progressBarColor={metricAccents.water.color}
                actionLabel="+ 250 ml"
                actionBgColor={metricAccents.water.color}
                actionTextColor={metricAccents.water.onColor}
                onActionPress={() => addWater(250)}
                onPress={() => navigateToStatsMetric('water')}
              />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Floating Bottom Navigation Dock */}
      {!hideDock && (
        <FloatingDock
          activeTab="home"
          onHomePress={() => scrollViewRef.current?.scrollTo({ y: 0, animated: true })}
          onAnalyticsPress={() => navigateToStatsMetric('steps')}
          onWaterPress={() => navigation.navigate('Water')}
          onProfilePress={() => navigation.navigate('Settings')}
        />
      )}
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
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 4,
  },
  bentoRow: {
    flexDirection: 'row',
    gap: 12,
  },
});
