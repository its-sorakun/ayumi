/**
 * MainPagerScreen — fluid, gesture-driven horizontal pager between Home, Stats, and Settings.
 *
 * Implements interactive finger-tracked page transitions inspired by OxygenOS 16 / ColorOS 16:
 *  - Continuous real-time horizontal tracking of finger displacement across 3 viewports:
 *      Page 0: Dashboard (Home)
 *      Page 1: Unified Stats Screen
 *      Page 2: Settings Screen
 *  - Both outgoing and incoming viewports move synchronously during drag gestures
 *  - Directional rubber-banding resistance (0.32x) when overscrolling outer boundaries
 *  - Velocity-aware and distance-thresholded spring settlement physics
 *  - Unified bottom FloatingDock with dynamic sliding pill indicator and squeeze deformation
 *  - Unhindered vertical scrolling on all three pages via strict directional gesture arbitration
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { useRoute } from '@react-navigation/native';

import { DashboardScreen } from './DashboardScreen';
import { StatsScreen } from './StatsScreen';
import { SettingsScreen } from './SettingsScreen';
import { FloatingDock } from '../components/FloatingDock';
import { MotionTokens } from '../theme/motion';
import type { StatMetricType } from '../components/StatsMetricSelector';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function MainPagerScreen(): React.JSX.Element {
  const theme = useTheme();
  const route = useRoute<any>();

  // Page index: 0 = Home, 1 = Stats, 2 = Settings
  const initialPage = route.params?.initialPage ?? (
    route.name === 'Stats' ? 1 : route.name === 'Settings' ? 2 : 0
  );
  const [activePageIndex, setActivePageIndex] = useState<number>(initialPage);
  const [activeStatsMetric, setActiveStatsMetric] = useState<StatMetricType>(
    route.params?.metric || 'steps'
  );

  const currentPageRef = useRef<number>(initialPage);
  const translateX = useRef(new Animated.Value(-initialPage * SCREEN_WIDTH)).current;
  const currentTranslateXRef = useRef<number>(-initialPage * SCREEN_WIDTH);
  const gestureStartPageRef = useRef<number>(initialPage);
  const dragStartX = useRef<number>(-initialPage * SCREEN_WIDTH);

  // Smooth spring navigation to a target page
  const goToPage = useCallback(
    (pageIndex: number, velocity?: number) => {
      currentPageRef.current = pageIndex;
      setActivePageIndex(pageIndex);

      Animated.spring(translateX, {
        toValue: -pageIndex * SCREEN_WIDTH,
        velocity: velocity ?? 0,
        ...MotionTokens.spring.pager,
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

  // Track exact live offset and synchronize dock active icon smoothly past page midpoints
  useEffect(() => {
    const id = translateX.addListener(({ value }) => {
      currentTranslateXRef.current = value;
      const page = Math.min(Math.max(Math.round(-value / SCREEN_WIDTH), 0), 2);
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
          Math.abs(gestureState.dy) * MotionTokens.gesture.directionalRatio;
        const isPastSlop =
          Math.abs(gestureState.dx) > MotionTokens.gesture.horizontalTouchSlop;
        return isHorizontal && isPastSlop;
      },
      onPanResponderGrant: () => {
        // Capture exact in-flight position and originating page so partial drags never skip two pages
        dragStartX.current = currentTranslateXRef.current;
        gestureStartPageRef.current = Math.min(
          Math.max(Math.round(-currentTranslateXRef.current / SCREEN_WIDTH), 0),
          2
        );
        translateX.stopAnimation(stoppedValue => {
          dragStartX.current = stoppedValue;
        });
      },
      onPanResponderMove: (_, gestureState) => {
        const base = dragStartX.current;
        let newOffset = base + gestureState.dx;

        // Apply rubber-banding resistance if overscrolling outer bounds (Page 0 left or Page 2 right)
        if (newOffset > 0) {
          newOffset = newOffset * 0.32;
        } else if (newOffset < -SCREEN_WIDTH * 2) {
          const overscroll = newOffset - -SCREEN_WIDTH * 2;
          newOffset = -SCREEN_WIDTH * 2 + overscroll * 0.32;
        }

        translateX.setValue(newOffset);
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, vx } = gestureState;
        const startPage = gestureStartPageRef.current;
        const distThreshold =
          SCREEN_WIDTH * MotionTokens.gesture.pageDistanceThresholdRatio;
        const velThreshold = MotionTokens.gesture.pageVelocityThreshold;

        let targetIndex = startPage;
        if (dx < -distThreshold || vx < -velThreshold) {
          targetIndex = Math.min(startPage + 1, 2);
        } else if (dx > distThreshold || vx > velThreshold) {
          targetIndex = Math.max(startPage - 1, 0);
        } else {
          // If released gently after slow drag past halfway, settle toward nearest neighbor of startPage
          const nearestPage = Math.min(
            Math.max(Math.round(-currentTranslateXRef.current / SCREEN_WIDTH), 0),
            2
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

  // Interpolate continuous 0 -> 2 progress across the 3 pages (0=Home, 1=Stats, 2=Settings)
  const pagerProgress = translateX.interpolate({
    inputRange: [-SCREEN_WIDTH * 2, -SCREEN_WIDTH, 0],
    outputRange: [2, 1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.rootContainer, { backgroundColor: theme.colors.background }]}>
      {/* Horizontally paged viewports across 3 screens */}
      <Animated.View
        style={[
          styles.pagerRow,
          {
            width: SCREEN_WIDTH * 3,
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

        {/* Page 2: Settings Screen */}
        <View style={styles.pageViewport}>
          <SettingsScreen hideDock={true} />
        </View>
      </Animated.View>

      {/* Shared Interactive Floating Bottom Navigation Dock with Squeeze Pill Animation across all 3 pages */}
      <FloatingDock
        activeTab={
          activePageIndex === 0 ? 'home' : activePageIndex === 1 ? 'stats' : 'settings'
        }
        pagerProgress={pagerProgress}
        onHomePress={() => goToPage(0)}
        onAnalyticsPress={() => goToPage(1)}
        onProfilePress={() => goToPage(2)}
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
