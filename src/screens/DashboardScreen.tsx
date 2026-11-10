/**
 * DashboardScreen — the Material 3 Expressive homepage of Ayumi.
 *
 * Implements a Pinterest-grade, aesthetic Bento Grid fitness interface:
 *  - Organic background fluid wave shapes
 *  - Time-aware contextual greeting ("Good morning", "Good afternoon", "Good evening")
 *  - HeroStepGauge with circular progress arc and squircle organic background
 *  - Asymmetrical pastel-tinted BentoCards for Distance, Calories, Active Time, and Water
 *  - Floating rounded navigation dock with organic active tab highlight
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
  LeafLogo,
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
  const { totalWater, refresh: refreshWater } = useWaterTracker();

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
    <View style={styles.screenWrapper}>
      {/* Decorative top-right organic pastel wave */}
      <View style={styles.topWaveWrapper} pointerEvents="none">
        <Svg width={SCREEN_WIDTH} height={180} viewBox="0 0 380 180">
          <Path
            d="M140 0C210 20 280 85 380 70V0H140Z"
            fill="#EADCF8"
            opacity={0.55}
          />
          <Path
            d="M200 0C250 40 310 120 380 110V0H200Z"
            fill="#F3E9FC"
            opacity={0.4}
          />
        </Svg>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: Math.max(insets.top, 16), paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={onRefresh}
            colors={['#8C5AB8']}
            progressBackgroundColor="#FFFFFF"
          />
        }
        accessibilityLabel="Ayumi Dashboard">

        {/* Top Header Row */}
        <View style={styles.topBarRow}>
          {/* Brand Icon & Name */}
          <View style={styles.brandContainer}>
            <View style={styles.brandIconBubble}>
              <LeafLogo size={22} color="#8A5BB8" />
            </View>
            <Text style={styles.brandTitleText}>Ayumi</Text>
          </View>

          {/* Settings Bubble Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Settings')}
            style={styles.settingsBubbleButton}
            accessibilityRole="button"
            accessibilityLabel="Open settings">
            <SettingsGearIcon size={20} color="#7A569B" />
          </TouchableOpacity>
        </View>

        {/* Greeting & Date Header */}
        <View style={styles.greetingHeader}>
          <Text style={styles.greetingTitleText}>
            {getGreeting()}
          </Text>
          <View style={styles.dateBadgeRow}>
            <Text style={styles.dateBadgeText}>
              {formattedValues?.date ?? formatDate(new Date())}
            </Text>
            {providerName != null && (
              <View style={styles.providerBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.providerBadgeText}>{providerName}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Centerpiece: Hero Step Circular Gauge */}
        <HeroStepGauge
          steps={formattedValues?.steps ?? 0}
          goal={stepGoal}
          onPress={() => navigation.navigate('StepsDetails')}
        />

        {/* Bento Grid Metrics */}
        {formattedValues != null && (
          <View style={styles.bentoGrid}>
            {/* Row 1: Distance & Active Calories */}
            <View style={styles.bentoRow}>
              <BentoCard
                title="Distance"
                value={formattedValues.distance}
                subtitle={`Goal: ${formatDistance(distanceGoal)}`}
                icon={<RouteMapIcon size={22} color="#7D49B8" />}
                iconBgColor="#EFE8F9"
                cardBgColor="#F9F5FD"
                borderColor="#EFE6F8"
                progress={formattedValues.distanceProgress}
                progressBarColor="#A27BC8"
                onPress={() => navigation.navigate('DistanceDetails')}
              />
              <BentoCard
                title="Active Calories"
                value={formattedValues.calories}
                icon={<FlameIcon size={22} color="#E85D3F" />}
                iconBgColor="#FFEBE6"
                cardBgColor="#FFF5F2"
                borderColor="#FFE6DF"
              />
            </View>

            {/* Row 2: Total Calories & Active Time */}
            <View style={styles.bentoRow}>
              <BentoCard
                title="Total Calories"
                value={formattedValues.totalCalories}
                subtitle={formattedValues.totalCalories === 'Setup' ? 'Tap to configure' : undefined}
                icon={<BoltIcon size={22} color="#D98A1E" />}
                iconBgColor="#FFF3DC"
                cardBgColor="#FFF9F1"
                borderColor="#FFEECF"
                onPress={formattedValues.totalCalories === 'Setup' ? () => navigation.navigate('Settings') : undefined}
              />
              <BentoCard
                title="Active Time"
                value={formattedValues.activeTime}
                icon={<StopwatchIcon size={22} color="#8B57C6" />}
                iconBgColor="#EFE8F9"
                cardBgColor="#F9F5FD"
                borderColor="#EFE6F8"
              />
            </View>

            {/* Row 3 (Full Width): Water Fluid Card */}
            <View style={styles.bentoRow}>
              <BentoCard
                title="Water"
                value={`${totalWater} ml`}
                subtitle={`Goal: ${formattedValues.waterGoalText}`}
                icon={<DropletIcon size={22} color="#3D78DB" />}
                iconBgColor="#E3EEFB"
                cardBgColor="#F0F6FD"
                borderColor="#DFEBFB"
                progress={formattedValues.waterProgress}
                progressBarColor="#5E99EC"
                fullWidth={true}
                showWaterWave={true}
                onPress={() => navigation.navigate('WaterDetails')}
              />
            </View>

            {/* Hardware Status Footer */}
            {formattedValues.sources != null && (
              <View style={styles.footerStatusRow}>
                <Text style={styles.footerBroadcastIcon}>((•))</Text>
                <Text style={styles.footerStatusText}>
                  Data from: {formattedValues.sources}
                </Text>
              </View>
            )}
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
    backgroundColor: '#FAF7FD',
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
    paddingHorizontal: 22,
    marginBottom: 16,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandIconBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EBDDF8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitleText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#261933',
    letterSpacing: -0.5,
  },
  settingsBubbleButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F3EAFB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFE4F8',
  },
  greetingHeader: {
    paddingHorizontal: 22,
    marginBottom: 8,
  },
  greetingTitleText: {
    fontSize: 34,
    fontWeight: '800',
    color: '#251733',
    letterSpacing: -0.8,
  },
  dateBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  dateBadgeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#7B678C',
  },
  providerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F2E8FA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8C5AB8',
  },
  providerBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6F4A96',
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
  footerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
    marginBottom: 10,
  },
  footerBroadcastIcon: {
    fontSize: 12,
    color: '#8E7A9F',
    fontWeight: '700',
  },
  footerStatusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E7A9F',
  },
});
