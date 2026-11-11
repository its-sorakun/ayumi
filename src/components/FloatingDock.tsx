/**
 * FloatingDock — an aesthetic Material 3 Expressive bottom navigation capsule.
 *
 * Implements a floating pill dock with:
 *  - 28dp corner radius and dynamic Material You surface styling
 *  - Mathematically symmetrical four-column layout (flex: 1 per slot: Home, Stats, Water, Settings)
 *  - Continuous sliding highlight pill indicator positioned behind active icons
 *  - Real-time finger-drag tracking and squash-and-stretch squeeze effect during page transitions
 *  - Squeeze deformation: stretches horizontally along travel axis (scaleX up to 1.24) and
 *    inversely compresses vertically (scaleY down to 0.84) to preserve physical volume
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DockHomeIcon,
  DockChartIcon,
  DockWaterIcon,
  SettingsGearIcon,
} from './AestheticIcons';
import { MotionTokens, useReducedMotion } from '../theme/motion';
import { OxygenColorOsDockBar, useAyumiTheme } from '../themes';

export interface FloatingDockProps {
  readonly activeTab?: 'home' | 'stats' | 'water' | 'settings';
  readonly pagerProgress?: Animated.AnimatedInterpolation<number> | Animated.Value;
  readonly onHomePress?: () => void;
  readonly onAnalyticsPress?: () => void;
  readonly onWaterPress?: () => void;
  readonly onProfilePress?: () => void;
}

export function FloatingDock({
  activeTab = 'home',
  pagerProgress,
  onHomePress,
  onAnalyticsPress,
  onWaterPress,
  onProfilePress,
}: FloatingDockProps): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { navigation, shapes, motion } = useAyumiTheme();

  // Container width measured on layout for accurate slot centering
  const [containerWidth, setContainerWidth] = useState<number>(0);

  // Tab index: 0 = Home, 1 = Stats, 2 = Water, 3 = Settings
  const activeTabIndex =
    activeTab === 'stats'
      ? 1
      : activeTab === 'water'
      ? 2
      : activeTab === 'settings'
      ? 3
      : 0;

  // Animated values for standalone mode or settings navigation
  const tabSlideAnim = useRef(new Animated.Value(activeTabIndex)).current;
  const tabSqueezeAnim = useRef(new Animated.Value(0)).current;

  // Track tab index changes when pagerProgress is not actively controlling
  useEffect(() => {
    if (reducedMotion) {
      tabSqueezeAnim.setValue(0);
      Animated.timing(tabSlideAnim, {
        toValue: activeTabIndex,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
      return;
    }

    tabSqueezeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(tabSqueezeAnim, {
        toValue: 1,
        duration: motion.duration.short,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(tabSqueezeAnim, {
        toValue: 0,
        ...motion.spring.snappy,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.spring(tabSlideAnim, {
      toValue: activeTabIndex,
      ...motion.spring.snappy,
      useNativeDriver: true,
    }).start();
  }, [activeTabIndex, reducedMotion, tabSlideAnim, tabSqueezeAnim, motion]);

  const onLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  // Dimensions of pill indicator across four equal navigation slots
  const horizontalPad = shapes.dockPaddingHorizontal;
  const availableWidth = Math.max(containerWidth - horizontalPad * 2, 0);
  const slotWidth = availableWidth / 4;
  const pillWidth = Math.min(Math.max(slotWidth - 8, 44), navigation.pillMaxWidth);
  const pillHeight = navigation.pillHeight;
  const pillTop = Math.max((shapes.dockHeight - pillHeight) / 2, 4);

  // Slot center offsets (0=Home, 1=Stats, 2=Water, 3=Settings)
  const slot0X = horizontalPad + (slotWidth - pillWidth) / 2;
  const slot1X = horizontalPad + slotWidth + (slotWidth - pillWidth) / 2;
  const slot2X = horizontalPad + 2 * slotWidth + (slotWidth - pillWidth) / 2;
  const slot3X = horizontalPad + 3 * slotWidth + (slotWidth - pillWidth) / 2;

  const stretchMax = motion.squish?.stretchX ?? MotionTokens.squish.stretchX;
  const stretchMid = 1 + (stretchMax - 1) * 0.69;
  const compressMin = motion.squish?.compressY ?? MotionTokens.squish.compressY;
  const compressMid = 1 - (1 - compressMin) * 0.59;

  // Determine transform based on whether pagerProgress is actively driving transitions
  let indicatorTranslateX: number | Animated.AnimatedInterpolation<number> = slot0X;
  let indicatorScaleX: number | Animated.AnimatedInterpolation<number> = 1;
  let indicatorScaleY: number | Animated.AnimatedInterpolation<number> = 1;

  if (pagerProgress && containerWidth > 0) {
    // Destination-anchored curve: pill clings near origin on launch, stretches mid-flight,
    // and anchors cleanly onto destination slot before tail snaps into rest.
    const d01 = slot1X - slot0X;
    const d12 = slot2X - slot1X;
    const d23 = slot3X - slot2X;
    indicatorTranslateX = reducedMotion
      ? pagerProgress.interpolate({
          inputRange: [0, 1, 2, 3],
          outputRange: [slot0X, slot1X, slot2X, slot3X],
          extrapolate: 'clamp',
        })
      : pagerProgress.interpolate({
          inputRange: [0, 0.2, 0.5, 0.8, 1, 1.2, 1.5, 1.8, 2, 2.2, 2.5, 2.8, 3],
          outputRange: [
            slot0X,
            slot0X + d01 * 0.14,
            slot0X + d01 * 0.5,
            slot0X + d01 * 0.86,
            slot1X,
            slot1X + d12 * 0.14,
            slot1X + d12 * 0.5,
            slot1X + d12 * 0.86,
            slot2X,
            slot2X + d23 * 0.14,
            slot2X + d23 * 0.5,
            slot2X + d23 * 0.86,
            slot3X,
          ],
          extrapolate: 'clamp',
        });

    // Fluid pill squeeze deformation clipped cleanly inside trackClip (disabled for reduced motion)
    indicatorScaleX = reducedMotion
      ? 1
      : pagerProgress.interpolate({
          inputRange: [0, 0.2, 0.5, 0.8, 1, 1.2, 1.5, 1.8, 2, 2.2, 2.5, 2.8, 3],
          outputRange: [
            1.0, stretchMid, stretchMax, stretchMid,
            1.0, stretchMid, stretchMax, stretchMid,
            1.0, stretchMid, stretchMax, stretchMid,
            1.0,
          ],
          extrapolate: 'clamp',
        });

    indicatorScaleY = reducedMotion
      ? 1
      : pagerProgress.interpolate({
          inputRange: [0, 0.2, 0.5, 0.8, 1, 1.2, 1.5, 1.8, 2, 2.2, 2.5, 2.8, 3],
          outputRange: [
            1.0, compressMid, compressMin, compressMid,
            1.0, compressMid, compressMin, compressMid,
            1.0, compressMid, compressMin, compressMid,
            1.0,
          ],
          extrapolate: 'clamp',
        });
  } else if (containerWidth > 0) {
    // Discrete spring-driven translation across all four slots
    indicatorTranslateX = tabSlideAnim.interpolate({
      inputRange: [0, 1, 2, 3],
      outputRange: [slot0X, slot1X, slot2X, slot3X],
    });

    indicatorScaleX = tabSqueezeAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1.0, stretchMax],
    });

    indicatorScaleY = tabSqueezeAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1.0, compressMin],
    });
  }

  const bottomOffset = Math.max(insets.bottom + 8, 16);

  if (navigation.variant === 'oem_labeled_pill') {
    return (
      <OxygenColorOsDockBar
        activeTab={activeTab}
        containerWidth={containerWidth}
        bottomOffset={bottomOffset}
        indicatorTranslateX={indicatorTranslateX}
        indicatorScaleX={indicatorScaleX}
        indicatorScaleY={indicatorScaleY}
        shapes={shapes}
        pillWidth={pillWidth}
        pillHeight={pillHeight}
        onLayout={onLayout}
        onHomePress={onHomePress}
        onAnalyticsPress={onAnalyticsPress}
        onWaterPress={onWaterPress}
        onProfilePress={onProfilePress}
      />
    );
  }

  const dockBorderColor = theme.dark
    ? 'rgba(255, 255, 255, 0.08)'
    : theme.colors.outlineVariant;

  return (
    <View
      style={[
        styles.dockWrapper,
        { bottom: bottomOffset },
      ]}
      pointerEvents="box-none">
      <View
        onLayout={onLayout}
        style={[
          styles.dockContainer,
          {
            width: shapes.dockWidthPercent,
            maxWidth: shapes.dockMaxWidth,
            height: shapes.dockHeight,
            borderRadius: shapes.dockRadius,
            paddingHorizontal: shapes.dockPaddingHorizontal,
            backgroundColor: theme.dark ? theme.colors.elevation.level2 : theme.colors.surface,
            borderColor: dockBorderColor,
          },
        ]}>
        {/* Clipped Sliding Active Indicator Pill */}
        {containerWidth > 0 && (
          <View style={[styles.pillTrackClip, { borderRadius: shapes.dockRadius }]} pointerEvents="none">
            <Animated.View
              style={[
                styles.slidingIndicatorPill,
                {
                  width: pillWidth,
                  height: pillHeight,
                  top: pillTop,
                  borderRadius: pillHeight / 2,
                  backgroundColor: theme.colors.primaryContainer,
                  transform: [
                    { translateX: indicatorTranslateX },
                    { scaleX: indicatorScaleX },
                    { scaleY: indicatorScaleY },
                  ],
                },
              ]}
            />
          </View>
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

        {/* Slot 3: Water Logger Tab */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onWaterPress}
          style={styles.tabSlot}
          accessibilityRole="tab"
          accessibilityLabel="Water tab">
          <DockWaterIcon
            size={20}
            filled={activeTab === 'water'}
            color={
              activeTab === 'water'
                ? theme.colors.onPrimaryContainer
                : theme.colors.onSurfaceVariant
            }
          />
        </TouchableOpacity>

        {/* Slot 4: Settings Tab */}
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
  pillTrackClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 29,
    overflow: 'hidden',
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
