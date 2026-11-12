/**
 * FloatingDock — an aesthetic Material 3 Expressive bottom navigation capsule.
 *
 * Implements a floating pill dock with:
 *  - Dynamic corner radius and adaptive surface styling (Default Material You & OxygenOS/ColorOS)
 *  - Mathematically symmetrical four-column layout (flex: 1 per slot: Home, Stats, Water, Settings)
 *  - Continuous sliding highlight pill indicator positioned behind active icons
 *  - Real-time finger-drag tracking and pronounced squash-and-stretch deformation during transitions
 *  - Wide mid-flight squeeze plateau combined with tap launch boost, landing rebound squash, and spring recovery
 *  - Accessible reduced-motion mode disabling squeeze/bounce in favor of linear translation
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { AiAmbientWaveNav, OxygenColorOsDockBar, useAyumiTheme } from '../themes';

export interface FloatingDockProps {
  readonly activeTab?: 'home' | 'stats' | 'water' | 'settings';
  readonly activeStatsMetric?: 'steps' | 'distance' | 'water';
  readonly pagerProgress?: Animated.AnimatedInterpolation<number> | Animated.Value;
  readonly onHomePress?: () => void;
  readonly onAnalyticsPress?: () => void;
  readonly onWaterPress?: () => void;
  readonly onProfilePress?: () => void;
}

type DockTabId = 'home' | 'stats' | 'water' | 'settings';

// Per-segment phase keypoints expand the mid-flight window where the capsule holds deep squeeze
// while keeping resting slot edges crisp and free of horizontal dock-wall clipping.
const PAGER_SEGMENT_PHASE_OFFSETS = [0, 0.14, 0.34, 0.5, 0.66, 0.86] as const;
const PAGER_SEGMENT_TRANSLATE_RATIOS = [0, 0.08, 0.3, 0.5, 0.7, 0.92] as const;
const PAGER_SEGMENT_SQUEEZE_WEIGHTS = [0, 0.52, 0.92, 1.0, 0.92, 0.52] as const;

function buildSegmentedDockRanges(
  slots: readonly [number, number, number, number],
  stretchMax: number,
  compressMin: number,
): {
  inputRange: number[];
  translateOutputRange: number[];
  scaleXOutputRange: number[];
  scaleYOutputRange: number[];
} {
  const inputRange: number[] = [];
  const translateOutputRange: number[] = [];
  const scaleXOutputRange: number[] = [];
  const scaleYOutputRange: number[] = [];

  for (let seg = 0; seg < 3; seg += 1) {
    const startX = slots[seg];
    const deltaX = slots[seg + 1] - startX;
    for (let i = 0; i < PAGER_SEGMENT_PHASE_OFFSETS.length; i += 1) {
      const weight = PAGER_SEGMENT_SQUEEZE_WEIGHTS[i];
      inputRange.push(seg + PAGER_SEGMENT_PHASE_OFFSETS[i]);
      translateOutputRange.push(startX + deltaX * PAGER_SEGMENT_TRANSLATE_RATIOS[i]);
      scaleXOutputRange.push(1 + (stretchMax - 1) * weight);
      scaleYOutputRange.push(1 - (1 - compressMin) * weight);
    }
  }

  inputRange.push(3);
  translateOutputRange.push(slots[3]);
  scaleXOutputRange.push(1);
  scaleYOutputRange.push(1);

  return {
    inputRange,
    translateOutputRange,
    scaleXOutputRange,
    scaleYOutputRange,
  };
}

export function FloatingDock({
  activeTab = 'home',
  activeStatsMetric = 'steps',
  pagerProgress,
  onHomePress,
  onAnalyticsPress,
  onWaterPress,
  onProfilePress,
}: FloatingDockProps): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { navigation, shapes, motion, metricAccents } = useAyumiTheme();

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

  // Animated values for standalone slot transitions and elastic tap bounce impulses
  const tabSlideAnim = useRef(new Animated.Value(activeTabIndex)).current;
  const tabSqueezeAnim = useRef(new Animated.Value(0)).current;
  const tapScaleXAnim = useRef(new Animated.Value(1)).current;
  const tapScaleYAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!reducedMotion) {
      return;
    }
    tapScaleXAnim.stopAnimation();
    tapScaleYAnim.stopAnimation();
    tapScaleXAnim.setValue(1);
    tapScaleYAnim.setValue(1);
  }, [reducedMotion, tapScaleXAnim, tapScaleYAnim]);

  // Trigger launch squeeze + arrival landing squash aligned with pager spring settling (~205ms)
  const triggerTabSwitchElastic = useCallback(() => {
    if (reducedMotion) {
      return;
    }
    tapScaleXAnim.stopAnimation();
    tapScaleYAnim.stopAnimation();
    tapScaleXAnim.setValue(1);
    tapScaleYAnim.setValue(1);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(tapScaleXAnim, {
          toValue: 1.12,
          duration: 95,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(tapScaleYAnim, {
          toValue: 0.84,
          duration: 95,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(tapScaleXAnim, {
          toValue: 0.84,
          duration: 110,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(tapScaleYAnim, {
          toValue: 1.14,
          duration: 110,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.spring(tapScaleXAnim, {
          toValue: 1,
          stiffness: 185,
          damping: 9.5,
          mass: 0.82,
          useNativeDriver: true,
        }),
        Animated.spring(tapScaleYAnim, {
          toValue: 1,
          stiffness: 185,
          damping: 9.5,
          mass: 0.82,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [reducedMotion, tapScaleXAnim, tapScaleYAnim]);

  // Tactile jelly squish when tapping the already-active tab
  const triggerActiveTapSquish = useCallback(() => {
    if (reducedMotion) {
      return;
    }
    tapScaleXAnim.stopAnimation();
    tapScaleYAnim.stopAnimation();
    tapScaleXAnim.setValue(1);
    tapScaleYAnim.setValue(1);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(tapScaleXAnim, {
          toValue: 1.22,
          duration: 65,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(tapScaleYAnim, {
          toValue: 0.76,
          duration: 65,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(tapScaleXAnim, {
          toValue: 0.9,
          duration: 65,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(tapScaleYAnim, {
          toValue: 1.1,
          duration: 65,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.spring(tapScaleXAnim, {
          toValue: 1,
          stiffness: 205,
          damping: 10.5,
          mass: 0.8,
          useNativeDriver: true,
        }),
        Animated.spring(tapScaleYAnim, {
          toValue: 1,
          stiffness: 205,
          damping: 10.5,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [reducedMotion, tapScaleXAnim, tapScaleYAnim]);

  const handleTabPress = useCallback(
    (targetTab: DockTabId, callback?: () => void) => {
      if (targetTab === activeTab) {
        triggerActiveTapSquish();
      } else if (pagerProgress) {
        triggerTabSwitchElastic();
      }
      callback?.();
    },
    [activeTab, pagerProgress, triggerActiveTapSquish, triggerTabSwitchElastic],
  );

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

    tabSqueezeAnim.stopAnimation();
    tabSqueezeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(tabSqueezeAnim, {
        toValue: 1,
        duration: 110,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(tabSqueezeAnim, {
        toValue: -0.24,
        duration: 95,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(tabSqueezeAnim, {
        toValue: 0,
        stiffness: 185,
        damping: 9.5,
        mass: 0.82,
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
  const compressMin = motion.squish?.compressY ?? MotionTokens.squish.compressY;

  const segmentedRanges = useMemo(
    () => buildSegmentedDockRanges([slot0X, slot1X, slot2X, slot3X], stretchMax, compressMin),
    [slot0X, slot1X, slot2X, slot3X, stretchMax, compressMin],
  );

  // Determine transform based on whether pagerProgress is actively driving transitions
  let indicatorTranslateX: number | Animated.AnimatedInterpolation<number> = slot0X;
  let indicatorScaleX:
    | number
    | Animated.AnimatedInterpolation<number>
    | Animated.AnimatedMultiplication<number> = 1;
  let indicatorScaleY:
    | number
    | Animated.AnimatedInterpolation<number>
    | Animated.AnimatedMultiplication<number> = 1;

  if (pagerProgress && containerWidth > 0) {
    indicatorTranslateX = reducedMotion
      ? pagerProgress.interpolate({
          inputRange: [0, 1, 2, 3],
          outputRange: [slot0X, slot1X, slot2X, slot3X],
          extrapolate: 'clamp',
        })
      : pagerProgress.interpolate({
          inputRange: segmentedRanges.inputRange,
          outputRange: segmentedRanges.translateOutputRange,
          extrapolate: 'clamp',
        });

    if (!reducedMotion) {
      const spatialScaleX = pagerProgress.interpolate({
        inputRange: segmentedRanges.inputRange,
        outputRange: segmentedRanges.scaleXOutputRange,
        extrapolate: 'clamp',
      });
      const spatialScaleY = pagerProgress.interpolate({
        inputRange: segmentedRanges.inputRange,
        outputRange: segmentedRanges.scaleYOutputRange,
        extrapolate: 'clamp',
      });

      indicatorScaleX = Animated.multiply(spatialScaleX, tapScaleXAnim);
      indicatorScaleY = Animated.multiply(spatialScaleY, tapScaleYAnim);
    }
  } else if (containerWidth > 0) {
    // Discrete spring-driven translation across all four slots
    indicatorTranslateX = tabSlideAnim.interpolate({
      inputRange: [0, 1, 2, 3],
      outputRange: [slot0X, slot1X, slot2X, slot3X],
    });

    if (!reducedMotion) {
      const spatialScaleX = tabSqueezeAnim.interpolate({
        inputRange: [-0.24, 0, 1],
        outputRange: [0.86, 1.0, stretchMax],
      });
      const spatialScaleY = tabSqueezeAnim.interpolate({
        inputRange: [-0.24, 0, 1],
        outputRange: [1.12, 1.0, compressMin],
      });

      indicatorScaleX = Animated.multiply(spatialScaleX, tapScaleXAnim);
      indicatorScaleY = Animated.multiply(spatialScaleY, tapScaleYAnim);
    }
  }

  const bottomOffset = Math.max(insets.bottom + 8, 16);

  const handleHomeTabPress = useCallback(
    () => handleTabPress('home', onHomePress),
    [handleTabPress, onHomePress],
  );
  const handleStatsTabPress = useCallback(
    () => handleTabPress('stats', onAnalyticsPress),
    [handleTabPress, onAnalyticsPress],
  );
  const handleWaterTabPress = useCallback(
    () => handleTabPress('water', onWaterPress),
    [handleTabPress, onWaterPress],
  );
  const handleSettingsTabPress = useCallback(
    () => handleTabPress('settings', onProfilePress),
    [handleTabPress, onProfilePress],
  );

  if (navigation.variant === 'wave_organic_blob') {
    return (
      <AiAmbientWaveNav
        activeTab={activeTab}
        pagerProgress={pagerProgress}
        onHomePress={handleHomeTabPress}
        onAnalyticsPress={handleStatsTabPress}
        onWaterPress={handleWaterTabPress}
        onProfilePress={handleSettingsTabPress}
      />
    );
  }

  if (navigation.variant === 'oem_labeled_pill') {
    return (
      <OxygenColorOsDockBar
        activeTab={activeTab}
        activeStatsMetric={activeStatsMetric}
        containerWidth={containerWidth}
        bottomOffset={bottomOffset}
        indicatorTranslateX={indicatorTranslateX}
        indicatorScaleX={indicatorScaleX}
        indicatorScaleY={indicatorScaleY}
        shapes={shapes}
        pillWidth={pillWidth}
        pillHeight={pillHeight}
        metricAccents={metricAccents}
        onLayout={onLayout}
        onHomePress={handleHomeTabPress}
        onAnalyticsPress={handleStatsTabPress}
        onWaterPress={handleWaterTabPress}
        onProfilePress={handleSettingsTabPress}
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
              testID="default-dock-active-pill"
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
          onPress={handleHomeTabPress}
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
          onPress={handleStatsTabPress}
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
          onPress={handleWaterTabPress}
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
          onPress={handleSettingsTabPress}
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
