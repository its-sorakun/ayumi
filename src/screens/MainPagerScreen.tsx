/**
 * MainPagerScreen — fluid, gesture-driven horizontal pager between Home, Stats, Water, and Settings.
 *
 * Implements interactive finger-tracked page transitions inspired by OxygenOS 16 / ColorOS 16:
 *  - Continuous real-time horizontal tracking of finger displacement across 4 viewports:
 *      Page 0: Dashboard (Home)
 *      Page 1: Unified Stats Screen
 *      Page 2: Dedicated Water Logger Screen
 *      Page 3: Settings Screen
 *  - Both outgoing and incoming viewports move synchronously during drag gestures
 *  - Directional rubber-banding resistance (0.32x) when overscrolling outer boundaries
 *  - Velocity-aware and distance-thresholded spring settlement physics
 *  - Unified bottom FloatingDock with dynamic sliding pill indicator and squeeze deformation
 *  - Unhindered vertical scrolling on all four pages via strict directional gesture arbitration
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
  PanResponder,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { useRoute } from '@react-navigation/native';

import { DashboardScreen } from './DashboardScreen';
import { StatsScreen } from './StatsScreen';
import { WaterLoggerScreen } from './WaterLoggerScreen';
import { SettingsScreen } from './SettingsScreen';
import { FloatingDock } from '../components/FloatingDock';
import { useReducedMotion } from '../theme/motion';
import { useAyumiTheme } from '../themes';
import type { StatMetricType } from '../components/StatsMetricSelector';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOTAL_PAGES = 4;
const MAX_PAGE_INDEX = TOTAL_PAGES - 1;

export function MainPagerScreen(): React.JSX.Element {
  const theme = useTheme();
  const { motion } = useAyumiTheme();
  const route = useRoute<any>();
  const reducedMotion = useReducedMotion();
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;
  const motionRef = useRef(motion);
  motionRef.current = motion;

  // Page index: 0 = Home, 1 = Stats, 2 = Settings
  const rawInitialPage = route.params?.initialPage ?? (
    route.name === 'Stats'
      ? 1
      : route.name === 'Water'
      ? 2
      : route.name === 'Settings'
      ? 3
      : 0
  );
  const initialPage = Math.min(Math.max(rawInitialPage, 0), MAX_PAGE_INDEX);
  const [activePageIndex, setActivePageIndex] = useState<number>(initialPage);
  const [activeStatsMetric, setActiveStatsMetric] = useState<StatMetricType>(
    route.params?.metric || 'steps'
  );

  const currentPageRef = useRef<number>(initialPage);
  const translateX = useRef(new Animated.Value(-initialPage * SCREEN_WIDTH)).current;
  const currentTranslateXRef = useRef<number>(-initialPage * SCREEN_WIDTH);
  const gestureStartPageRef = useRef<number>(initialPage);
  const dragStartX = useRef<number>(-initialPage * SCREEN_WIDTH);
  const isDraggingRef = useRef<boolean>(false);

  // Smooth spring (or brisk linear slide under reduced motion) navigation to a target page
  const goToPage = useCallback(
    (pageIndex: number, velocity?: number) => {
      const clampedPage = Math.min(Math.max(pageIndex, 0), MAX_PAGE_INDEX);
      isDraggingRef.current = false;
      currentPageRef.current = clampedPage;
      setActivePageIndex(clampedPage);

      if (reducedMotionRef.current) {
        Animated.timing(translateX, {
          toValue: -clampedPage * SCREEN_WIDTH,
          duration: 140,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
        return;
      }

      Animated.spring(translateX, {
        toValue: -clampedPage * SCREEN_WIDTH,
        velocity: velocity ?? 0,
        ...motionRef.current.spring.pager,
        useNativeDriver: true,
      }).start();
    },
    [translateX]
  );

  // Navigate to Stats with a specific metric target
  const handleNavigateToStats = useCallback(
    (metric: StatMetricType) => {
      setActiveStatsMetric(metric);
      goToPage(1);
    },
    [goToPage]
  );

  // Track exact live offset and synchronize dock active icon smoothly past midpoints during manual drags
  useEffect(() => {
    const id = translateX.addListener(({ value }) => {
      currentTranslateXRef.current = value;
      if (!isDraggingRef.current) return;
      const page = Math.min(Math.max(Math.round(-value / SCREEN_WIDTH), 0), MAX_PAGE_INDEX);
      if (page !== currentPageRef.current) {
        currentPageRef.current = page;
        setActivePageIndex(page);
      }
    });
    return () => translateX.removeListener(id);
  }, [translateX]);

  // Sync route params changes
  useEffect(() => {
    if (route.params?.metric) {
      setActiveStatsMetric(route.params.metric);
    }
    if (route.params?.initialPage !== undefined && route.params.initialPage !== currentPageRef.current) {
      goToPage(route.params.initialPage);
    }
  }, [route.params, goToPage]);

  // Real-time finger-tracking PanResponder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only claim gesture when user has clear horizontal intent exceeding touch slop
        const isHorizontal =
          Math.abs(gestureState.dx) >
          Math.abs(gestureState.dy) * motionRef.current.gesture.directionalRatio;
        const isPastSlop =
          Math.abs(gestureState.dx) > motionRef.current.gesture.horizontalTouchSlop;
        return isHorizontal && isPastSlop;
      },
      onPanResponderGrant: () => {
        // Capture exact in-flight position and originating page so partial drags never skip two pages
        isDraggingRef.current = true;
        dragStartX.current = currentTranslateXRef.current;
        gestureStartPageRef.current = Math.min(
          Math.max(Math.round(-currentTranslateXRef.current / SCREEN_WIDTH), 0),
          MAX_PAGE_INDEX
        );
        translateX.stopAnimation(stoppedValue => {
          dragStartX.current = stoppedValue;
        });
      },
      onPanResponderMove: (_, gestureState) => {
        const base = dragStartX.current;
        let newOffset = base + gestureState.dx;

        // Apply rubber-banding resistance if overscrolling outer bounds (Page 0 left or Page 3 right)
        if (newOffset > 0) {
          newOffset = newOffset * 0.32;
        } else if (newOffset < -SCREEN_WIDTH * MAX_PAGE_INDEX) {
          const overscroll = newOffset - -SCREEN_WIDTH * MAX_PAGE_INDEX;
          newOffset = -SCREEN_WIDTH * MAX_PAGE_INDEX + overscroll * 0.32;
        }

        translateX.setValue(newOffset);
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, vx } = gestureState;
        const startPage = gestureStartPageRef.current;
        const distThreshold =
          SCREEN_WIDTH * motionRef.current.gesture.pageDistanceThresholdRatio;
        const velThreshold = motionRef.current.gesture.pageVelocityThreshold;

        let targetIndex = startPage;
        if (dx < -distThreshold || vx < -velThreshold) {
          targetIndex = Math.min(startPage + 1, MAX_PAGE_INDEX);
        } else if (dx > distThreshold || vx > velThreshold) {
          targetIndex = Math.max(startPage - 1, 0);
        } else {
          // If released gently after slow drag past halfway, settle toward nearest neighbor of startPage
          const nearestPage = Math.min(
            Math.max(Math.round(-currentTranslateXRef.current / SCREEN_WIDTH), 0),
            MAX_PAGE_INDEX
          );
          targetIndex = Math.min(Math.max(nearestPage, startPage - 1), startPage + 1);
        }

        goToPage(targetIndex, vx);
      },
      onPanResponderTerminate: () => {
        // On gesture interruption, settle back to current page
        goToPage(currentPageRef.current);
      },
    })
  ).current;

  // Interpolate continuous 0 -> 3 progress across the 4 pages (0=Home, 1=Stats, 2=Water, 3=Settings)
  const pagerProgress = translateX.interpolate({
    inputRange: [-SCREEN_WIDTH * 3, -SCREEN_WIDTH * 2, -SCREEN_WIDTH, 0],
    outputRange: [3, 2, 1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.rootContainer, { backgroundColor: theme.colors.background }]}>
      {/* Horizontally paged viewports across 4 screens */}
      <Animated.View
        style={[
          styles.pagerRow,
          {
            width: SCREEN_WIDTH * TOTAL_PAGES,
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}>
        {/* Page 0: Home / Dashboard */}
        <View style={styles.pageViewport}>
          <DashboardScreen
            hideDock={true}
            onNavigateToStats={handleNavigateToStats}
          />
        </View>

        {/* Page 1: Unified Stats Screen */}
        <View style={styles.pageViewport}>
          <StatsScreen
            hideDock={true}
            activeMetricProp={activeStatsMetric}
            onSelectMetricProp={setActiveStatsMetric}
            isPageActive={activePageIndex === 1}
          />
        </View>

        {/* Page 2: Dedicated Water Logger Screen */}
        <View style={styles.pageViewport}>
          <WaterLoggerScreen
            hideDock={true}
            isPageActive={activePageIndex === 2}
            onNavigateHome={() => goToPage(0)}
            onNavigateStats={() => goToPage(1)}
            onNavigateSettings={() => goToPage(3)}
          />
        </View>

        {/* Page 3: Settings Screen */}
        <View style={styles.pageViewport}>
          <SettingsScreen hideDock={true} />
        </View>
      </Animated.View>

      {/* Shared Interactive Floating Bottom Navigation Dock with Squeeze Pill Animation across all 4 pages */}
      <FloatingDock
        activeTab={
          activePageIndex === 0
            ? 'home'
            : activePageIndex === 1
            ? 'stats'
            : activePageIndex === 2
            ? 'water'
            : 'settings'
        }
        activeStatsMetric={activeStatsMetric}
        pagerProgress={pagerProgress}
        onHomePress={() => goToPage(0)}
        onAnalyticsPress={() => goToPage(1)}
        onWaterPress={() => goToPage(2)}
        onProfilePress={() => goToPage(3)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  pagerRow: {
    flex: 1,
    flexDirection: 'row',
  },
  pageViewport: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
});
