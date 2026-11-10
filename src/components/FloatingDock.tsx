/**
 * FloatingDock — an aesthetic Material 3 Expressive bottom navigation capsule.
 *
 * Implements a floating pill dock with:
 *  - 28dp corner radius and dynamic Material You surface styling
 *  - Mathematically symmetrical three-column layout (flex: 1 per slot)
 *  - Continuous sliding highlight pill indicator positioned behind active icons
 *  - Real-time finger-drag tracking and squash-and-stretch squeeze effect during page transitions
 *  - Squeeze deformation: stretches horizontally along travel axis (scaleX up to 1.34) and
 *    inversely compresses vertically (scaleY down to 0.76) to preserve physical volume
 *  - Spring settling physics when snapping into resting slot positions
 *  - Seamless adaptation between light and dark Material 3 themes
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  LayoutChangeEvent,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { DockHomeIcon, DockChartIcon, SettingsGearIcon } from './AestheticIcons';
import { MotionTokens } from '../theme/motion';

export interface FloatingDockProps {
  readonly activeTab?: 'home' | 'stats' | 'settings';
  readonly pagerProgress?: Animated.AnimatedInterpolation<number> | Animated.Value;
  readonly onHomePress?: () => void;
  readonly onAnalyticsPress?: () => void;
  readonly onProfilePress?: () => void;
}

export function FloatingDock({
  activeTab = 'home',
  pagerProgress,
  onHomePress,
  onAnalyticsPress,
  onProfilePress,
}: FloatingDockProps): React.JSX.Element {
  const theme = useTheme();

  // Container width measured on layout for accurate slot centering
  const [containerWidth, setContainerWidth] = useState<number>(0);

  // Tab index: 0 = Home, 1 = Stats, 2 = Settings
  const activeTabIndex = activeTab === 'stats' ? 1 : activeTab === 'settings' ? 2 : 0;

  // Animated values for standalone mode or settings navigation
  const tabSlideAnim = useRef(new Animated.Value(activeTabIndex)).current;
  const tabSqueezeAnim = useRef(new Animated.Value(0)).current;

  // Track tab index changes when pagerProgress is not actively controlling
  useEffect(() => {
    tabSqueezeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(tabSqueezeAnim, {
        toValue: 1,
        duration: 130,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(tabSqueezeAnim, {
        toValue: 0,
        damping: 15,
        stiffness: 220,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.spring(tabSlideAnim, {
      toValue: activeTabIndex,
      damping: 22,
      stiffness: 220,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [activeTabIndex, tabSlideAnim, tabSqueezeAnim]);

  const onLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  // Dimensions of pill indicator
  const availableWidth = Math.max(containerWidth - 16, 0);
  const slotWidth = availableWidth / 3;
  const pillWidth = Math.min(Math.max(slotWidth - 8, 48), 64);
  const pillHeight = 38;

  // Slot center offsets
  const slot0X = 8 + (slotWidth - pillWidth) / 2;
  const slot1X = 8 + slotWidth + (slotWidth - pillWidth) / 2;
  const slot2X = 8 + 2 * slotWidth + (slotWidth - pillWidth) / 2;

  // Determine transform based on whether pagerProgress is actively driving between Home and Stats
  let indicatorTranslateX: any = slot0X;
  let indicatorScaleX: any = 1;
  let indicatorScaleY: any = 1;

  if (pagerProgress && containerWidth > 0) {
    // Real-time finger-drag tracking across Home (0), Stats (1), and Settings (2)
    indicatorTranslateX = pagerProgress.interpolate({
      inputRange: [0, 1, 2],
      outputRange: [slot0X, slot1X, slot2X],
      extrapolate: 'clamp',
    });

    // Squash & Stretch: pill elongates horizontally during travel and thins vertically across both transitions
    indicatorScaleX = pagerProgress.interpolate({
      inputRange: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
      outputRange: [1.0, 1.20, 1.34, 1.20, 1.0, 1.20, 1.34, 1.20, 1.0],
      extrapolate: 'clamp',
    });

    indicatorScaleY = pagerProgress.interpolate({
      inputRange: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
      outputRange: [1.0, 0.88, 0.76, 0.88, 1.0, 0.88, 0.76, 0.88, 1.0],
      extrapolate: 'clamp',
    });
  } else if (containerWidth > 0) {
    // Discrete spring-driven translation across all three slots
    indicatorTranslateX = tabSlideAnim.interpolate({
      inputRange: [0, 1, 2],
      outputRange: [slot0X, slot1X, slot2X],
    });

    indicatorScaleX = tabSqueezeAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1.0, 1.32],
    });

    indicatorScaleY = tabSqueezeAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1.0, 0.78],
    });
  }

  return (
    <View style={styles.dockWrapper} pointerEvents="box-none">
      <View
        onLayout={onLayout}
        style={[
          styles.dockContainer,
          {
            backgroundColor: theme.dark ? theme.colors.elevation.level2 : theme.colors.surface,
            borderColor: theme.dark ? 'rgba(255, 255, 255, 0.08)' : theme.colors.outlineVariant,
          },
        ]}>
        {/* Animated Sliding Highlight Pill with Squeeze Deformation */}
        {containerWidth > 0 && (
          <Animated.View
            style={[
              styles.slidingIndicatorPill,
              {
                width: pillWidth,
                height: pillHeight,
                backgroundColor: theme.colors.primaryContainer,
                transform: [
                  { translateX: indicatorTranslateX },
                  { scaleX: indicatorScaleX },
                  { scaleY: indicatorScaleY },
                ],
              },
            ]}
          />
        )}

        {/* Slot 1: Home Tab */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onHomePress}
          style={styles.tabSlot}
          accessibilityRole="tab"
          accessibilityLabel="Home tab">
          <DockHomeIcon
            size={20}
            color={
              activeTab === 'home'
                ? theme.colors.onPrimaryContainer
                : theme.colors.onSurfaceVariant
            }
          />
        </TouchableOpacity>

        {/* Slot 2: Analytics / Stats Tab */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onAnalyticsPress}
          style={styles.tabSlot}
          accessibilityRole="tab"
          accessibilityLabel="Stats tab">
          <DockChartIcon
            size={20}
            color={
              activeTab === 'stats'
                ? theme.colors.onPrimaryContainer
                : theme.colors.onSurfaceVariant
            }
          />
        </TouchableOpacity>

        {/* Slot 3: Settings Tab */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onProfilePress}
          style={styles.tabSlot}
          accessibilityRole="tab"
          accessibilityLabel="Settings tab">
          <SettingsGearIcon
            size={20}
            color={
              activeTab === 'settings'
                ? theme.colors.onPrimaryContainer
                : theme.colors.onSurfaceVariant
            }
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dockWrapper: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '84%',
    maxWidth: 340,
    height: 58,
    borderRadius: 29,
    paddingHorizontal: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
    borderWidth: 0,
  },
  slidingIndicatorPill: {
    position: 'absolute',
    borderRadius: 19,
    top: 10,
    left: 0,
    zIndex: 0,
  },
  tabSlot: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
});
