/**
 * MainPagerScreen — fluid, gesture-driven horizontal pager between Home and Stats.
 *
 * Implements interactive finger-tracked page transitions inspired by OxygenOS 16 / ColorOS 16:
 *  - Continuous real-time horizontal tracking of finger displacement across viewports
 *  - Both Home (Dashboard) and Stats move synchronously during drag gestures
 *  - Directional rubber-banding resistance when overscrolling outer boundaries
 *  - Velocity-aware and distance-thresholded spring settlement physics
 *  - Unified bottom FloatingDock that seamlessly reflects active destination
 *  - Unhindered vertical scrolling on both pages via strict directional gesture arbitration
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
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../types';
import { DashboardScreen } from './DashboardScreen';
import { StatsScreen } from './StatsScreen';
import { FloatingDock } from '../components/FloatingDock';
import { MotionTokens } from '../theme/motion';
import type { StatMetricType } from '../components/StatsMetricSelector';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function MainPagerScreen(): React.JSX.Element {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<any>();

  // Page index: 0 = Home, 1 = Stats
  const initialPage = route.params?.initialPage ?? (route.name === 'Stats' ? 1 : 0);
  const [activePageIndex, setActivePageIndex] = useState<number>(initialPage);
  const [activeStatsMetric, setActiveStatsMetric] = useState<StatMetricType>(
    route.params?.metric || 'steps'
  );

  const currentPageRef = useRef<number>(initialPage);
  const translateX = useRef(new Animated.Value(-initialPage * SCREEN_WIDTH)).current;
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
        // Stop any running settling animations so finger claims control immediately
        translateX.stopAnimation();
        dragStartX.current = -currentPageRef.current * SCREEN_WIDTH;
      },
      onPanResponderMove: (_, gestureState) => {
        const base = dragStartX.current;
        let newOffset = base + gestureState.dx;

        // Apply rubber-banding resistance if overscrolling outer bounds
        if (newOffset > 0) {
          newOffset = gestureState.dx * 0.32;
        } else if (newOffset < -SCREEN_WIDTH) {
          const overscroll = newOffset - -SCREEN_WIDTH;
          newOffset = -SCREEN_WIDTH + overscroll * 0.32;
        }

        translateX.setValue(newOffset);
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, vx } = gestureState;
        let targetIndex = currentPageRef.current;
        const distThreshold =
          SCREEN_WIDTH * MotionTokens.gesture.pageDistanceThresholdRatio;
        const velThreshold = MotionTokens.gesture.pageVelocityThreshold;

        if (currentPageRef.current === 0) {
          // On Home: drag left qualifies to advance to Stats
          if (dx < -distThreshold || vx < -velThreshold) {
            targetIndex = 1;
          }
        } else {
          // On Stats: drag right qualifies to return to Home
          if (dx > distThreshold || vx > velThreshold) {
            targetIndex = 0;
          }
        }

        goToPage(targetIndex, vx);
      },
      onPanResponderTerminate: () => {
        // On gesture interruption, settle back to current page
        goToPage(currentPageRef.current);
      },
    })
  ).current;

  return (
    <View style={[styles.rootContainer, { backgroundColor: theme.colors.background }]}>
      {/* Horizontally paged viewports */}
      <Animated.View
        style={[
          styles.pagerRow,
          {
            width: SCREEN_WIDTH * 2,
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
          />
        </View>
      </Animated.View>

      {/* Shared Interactive Floating Bottom Navigation Dock */}
      <FloatingDock
        activeTab={activePageIndex === 0 ? 'home' : 'stats'}
        onHomePress={() => goToPage(0)}
        onAnalyticsPress={() => goToPage(1)}
        onProfilePress={() => navigation.navigate('Settings')}
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
