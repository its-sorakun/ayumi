/**
 * StatsScreen — unified Material 3 Expressive analytics dashboard for Ayumi.
 *
 * Implements the complete statistics hub replacing standalone chart screens:
 *  - Supports Steps, Distance, and Water metrics
 *  - Daily (24h hourly), Week (7d), and Month (28-31d) aggregations
 *  - Horizontal swipe gestures to cycle between metrics with directional slide
 *  - Animated period selector with sliding pill indicator
 *  - Responsive previous/next date navigator with bounded forward travel
 *  - Pure SVG responsive chart with bar highlight and contextual tooltips
 *  - Contextual Average and Highest summary cards
 *  - Choreographed screen entrance and fluid OxygenOS/ColorOS-inspired interaction
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../types';
import { healthService } from '../services';
import { useHealthData, useWaterTracker } from '../hooks';
import type { HistoricalStepData, HistoricalDistanceData } from '../types/health';
import {
  formatDate,
  formatDistance,
  formatLocalDateKey,
  startOfDay,
  today,
} from '../utils/index';

import {
  StatsMetricSelector,
  type StatMetricType,
} from '../components/StatsMetricSelector';
import {
  StatsPeriodSelector,
  type StatPeriodType,
} from '../components/StatsPeriodSelector';
import { StatsPeriodNavigator } from '../components/StatsPeriodNavigator';
import { StatsChart, type ChartDataPoint } from '../components/StatsChart';
import { StatsSummaryCards } from '../components/StatsSummaryCards';
import { FloatingDock } from '../components/FloatingDock';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export interface StatsScreenProps {
  hideDock?: boolean;
  activeMetricProp?: StatMetricType;
  onSelectMetricProp?: (metric: StatMetricType) => void;
}

const METRIC_ORDER: readonly StatMetricType[] = ['steps', 'distance', 'water'];

export function StatsScreen({
  hideDock = false,
  activeMetricProp,
  onSelectMetricProp,
}: StatsScreenProps = {}): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<any>();

  const { providerStatus } = useHealthData();
  const { getLogsForDate } = useWaterTracker();

  // Primary state
  const initialMetric: StatMetricType = activeMetricProp || route.params?.metric || 'steps';
  const [selectedMetric, setSelectedMetric] = useState<StatMetricType>(initialMetric);
  const [selectedPeriod, setSelectedPeriod] = useState<StatPeriodType>('daily');
  const [anchorDate, setAnchorDate] = useState<Date>(today());
  const [navDirection, setNavDirection] = useState<'prev' | 'next'>('next');
  const [loading, setLoading] = useState(false);

  // Raw fetched history
  const [stepsHistory, setStepsHistory] = useState<HistoricalStepData[]>([]);
  const [distanceHistory, setDistanceHistory] = useState<HistoricalDistanceData[]>([]);
  const [dailyWaterLogs, setDailyWaterLogs] = useState<{ hour: number; amount: number }[]>([]);
  const [periodWaterDaily, setPeriodWaterDaily] = useState<Map<string, number>>(new Map());

  // Animation values for screen entrance
  const entranceHeader = useRef(new Animated.Value(0)).current;
  const entranceMetrics = useRef(new Animated.Value(0)).current;
  const entrancePeriods = useRef(new Animated.Value(0)).current;
  const entranceChart = useRef(new Animated.Value(0)).current;
  const entranceSummaries = useRef(new Animated.Value(0)).current;

  // Animation for metric slide/crossfade
  const contentSlideAnim = useRef(new Animated.Value(0)).current;

  // Initial choreographed entrance
  useEffect(() => {
    Animated.stagger(50, [
      Animated.timing(entranceHeader, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(entranceMetrics, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(entrancePeriods, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(entranceChart, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(entranceSummaries, { toValue: 1, duration: 240, useNativeDriver: true }),
    ]).start();
  }, []);

  // Update metric if passed via route params or props
  useEffect(() => {
    if (activeMetricProp && activeMetricProp !== selectedMetric) {
      handleSelectMetric(activeMetricProp);
    } else if (route.params?.metric && route.params.metric !== selectedMetric) {
      handleSelectMetric(route.params.metric);
    }
  }, [activeMetricProp, route.params?.metric]);

  // Load historical data whenever anchor date or period changes
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (selectedMetric === 'water') {
        const dateKey = formatLocalDateKey(anchorDate);
        const logs = await getLogsForDate(dateKey);
        const hourMap: Record<number, number> = {};
        for (let h = 0; h < 24; h++) hourMap[h] = 0;

        logs.forEach(log => {
          // Parse hour from log time string (HH:MM)
          const parts = log.time.split(':');
          const hr = parseInt(parts[0], 10);
          if (!isNaN(hr) && hr >= 0 && hr < 24) {
            hourMap[hr] = (hourMap[hr] || 0) + log.amount;
          }
        });

        setDailyWaterLogs(
          Object.entries(hourMap).map(([h, amt]) => ({
            hour: parseInt(h, 10),
            amount: amt,
          }))
        );

        // Fetch logs for the multi-day period (week: 7 days, month: 28-31 days)
        const daysToFetch = selectedPeriod === 'week' ? 7 : 31;
        const waterMap = new Map<string, number>();
        const fetchPromises = [];

        for (let i = 0; i < daysToFetch; i++) {
          const d = new Date(anchorDate);
          d.setDate(d.getDate() - i);
          const key = formatLocalDateKey(d);
          fetchPromises.push(
            getLogsForDate(key).then(dayLogs => {
              const sum = dayLogs.reduce((acc, curr) => acc + curr.amount, 0);
              waterMap.set(key, sum);
            })
          );
        }
        await Promise.all(fetchPromises);
        setPeriodWaterDaily(waterMap);
      } else {
        // Steps or Distance
        const timeRangeQuery = selectedPeriod === 'month' ? 'month' : 'week';
        const [stepsRes, distRes] = await Promise.all([
          healthService.getHistoricalSteps(timeRangeQuery),
          healthService.getHistoricalDistance(timeRangeQuery),
        ]);
        setStepsHistory(stepsRes as HistoricalStepData[]);
        setDistanceHistory(distRes as HistoricalDistanceData[]);
      }
    } catch (err) {
      console.warn('Failed to load stats data', err);
    } finally {
      setLoading(false);
    }
  }, [selectedMetric, selectedPeriod, anchorDate, getLogsForDate]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Transition handler when switching metric
  const handleSelectMetric = (newMetric: StatMetricType) => {
    if (newMetric === selectedMetric) return;

    const currentIndex = METRIC_ORDER.indexOf(selectedMetric);
    const newIndex = METRIC_ORDER.indexOf(newMetric);
    const direction = newIndex > currentIndex ? -1 : 1;

    // Trigger horizontal slide transition
    contentSlideAnim.setValue(direction);
    setSelectedMetric(newMetric);
    onSelectMetricProp?.(newMetric);

    Animated.spring(contentSlideAnim, {
      toValue: 0,
      damping: 22,
      stiffness: 200,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  };

  // Metric cycling for horizontal swipe gesture
  const cycleMetric = (direction: 'next' | 'prev') => {
    const currentIndex = METRIC_ORDER.indexOf(selectedMetric);
    let nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex >= METRIC_ORDER.length) nextIndex = 0;
    if (nextIndex < 0) nextIndex = METRIC_ORDER.length - 1;
    handleSelectMetric(METRIC_ORDER[nextIndex]);
  };

  // PanResponder to intercept horizontal swipes across chart content (active only in standalone mode)
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // If embedded in horizontal pager, yield horizontal gestures to the parent pager
          if (hideDock) return false;
          // Intercept horizontal swipes with clear horizontal intent
          return (
            Math.abs(gestureState.dx) > 30 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.6
          );
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx < -45) {
            cycleMetric('next');
          } else if (gestureState.dx > 45) {
            cycleMetric('prev');
          }
        },
      }),
    [selectedMetric, hideDock]
  );

  // Navigation handlers
  const canGoNext = useMemo(() => {
    const todayMidnight = today().getTime();
    return anchorDate.getTime() < todayMidnight;
  }, [anchorDate]);

  const handlePrevious = () => {
    setNavDirection('prev');
    const newDate = new Date(anchorDate);
    if (selectedPeriod === 'daily') {
      newDate.setDate(newDate.getDate() - 1);
    } else if (selectedPeriod === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setAnchorDate(newDate);
  };

  const handleNext = () => {
    if (!canGoNext) return;
    setNavDirection('next');
    const newDate = new Date(anchorDate);
    if (selectedPeriod === 'daily') {
      newDate.setDate(newDate.getDate() + 1);
    } else if (selectedPeriod === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    // Prevent navigating past today
    if (newDate.getTime() > today().getTime()) {
      setAnchorDate(today());
    } else {
      setAnchorDate(newDate);
    }
  };

  // Period Navigator date text
  const dateRangeText = useMemo(() => {
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    if (selectedPeriod === 'daily') {
      return `${monthNames[anchorDate.getMonth()]} ${anchorDate.getDate()}, ${anchorDate.getFullYear()}`;
    }
    if (selectedPeriod === 'week') {
      const start = new Date(anchorDate);
      start.setDate(start.getDate() - 6);
      const startStr = `${monthNames[start.getMonth()]} ${start.getDate()}`;
      const endStr = `${monthNames[anchorDate.getMonth()]} ${anchorDate.getDate()}, ${anchorDate.getFullYear()}`;
      return `${startStr} – ${endStr}`;
    }
    // Month
    const fullMonthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return `${fullMonthNames[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`;
  }, [selectedPeriod, anchorDate]);

  // Chart subtitle
  const chartSubtitle = useMemo(() => {
    if (selectedPeriod === 'daily') {
      return `Hourly • ${dateRangeText}`;
    }
    return `Daily • ${dateRangeText}`;
  }, [selectedPeriod, dateRangeText]);

  // Construct chart data points based on metric & period
  const chartDataPoints: readonly ChartDataPoint[] = useMemo(() => {
    if (selectedPeriod === 'daily') {
      // 24 hourly data points
      const points: ChartDataPoint[] = [];
      const currentHour = anchorDate.getTime() === today().getTime() ? new Date().getHours() : 23;

      for (let h = 0; h < 24; h++) {
        const hourStr = String(h).padStart(2, '0');
        let val = 0;

        if (selectedMetric === 'water') {
          const found = dailyWaterLogs.find(l => l.hour === h);
          val = found ? found.amount : 0;
        } else if (selectedMetric === 'steps') {
          // If past current hour today, zero
          if (h <= currentHour) {
            // Find in step history or distribute
            const dayKey = formatLocalDateKey(anchorDate);
            const foundDay = stepsHistory.find(d => d.date === dayKey);
            const total = foundDay?.steps || 0;
            // Simulated active curve for hours when only aggregate exists
            if (total > 0 && h >= 7 && h <= 21) {
              const weights = [1, 2, 3, 5, 8, 12, 10, 8, 7, 9, 11, 8, 6, 4, 2];
              const w = weights[h - 7] || 1;
              val = Math.round((total * w) / 98);
            }
          }
        } else {
          // Distance
          if (h <= currentHour) {
            const dayKey = formatLocalDateKey(anchorDate);
            const foundDay = distanceHistory.find(d => d.date === dayKey);
            const total = foundDay?.distance || 0;
            if (total > 0 && h >= 7 && h <= 21) {
              const weights = [1, 2, 3, 5, 8, 12, 10, 8, 7, 9, 11, 8, 6, 4, 2];
              const w = weights[h - 7] || 1;
              val = Math.round((total * w) / 98);
            }
          }
        }

        points.push({
          key: `hour-${h}`,
          label: hourStr,
          subLabel: `${hourStr}:00`,
          value: val,
        });
      }
      return points;
    }

    if (selectedPeriod === 'week') {
      // 7 daily data points ending at anchorDate
      const points: ChartDataPoint[] = [];
      const dayLetters = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      for (let i = 6; i >= 0; i--) {
        const d = new Date(anchorDate);
        d.setDate(d.getDate() - i);
        const dayKey = formatLocalDateKey(d);
        const dayLabel = dayLetters[d.getDay()];

        let val = 0;
        if (selectedMetric === 'water') {
          val = periodWaterDaily.get(dayKey) || 0;
        } else if (selectedMetric === 'steps') {
          const found = stepsHistory.find(item => item.date === dayKey);
          val = found ? found.steps : 0;
        } else {
          const found = distanceHistory.find(item => item.date === dayKey);
          val = found ? found.distance : 0;
        }

        points.push({
          key: dayKey,
          label: dayLabel,
          subLabel: `${dayLabel}, ${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })}`,
          value: val,
        });
      }
      return points;
    }

    // Monthly: 28, 29, 30 or 31 days
    const year = anchorDate.getFullYear();
    const month = anchorDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const points: ChartDataPoint[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const dayKey = formatLocalDateKey(d);
      let val = 0;

      if (selectedMetric === 'water') {
        val = periodWaterDaily.get(dayKey) || 0;
      } else if (selectedMetric === 'steps') {
        const found = stepsHistory.find(item => item.date === dayKey);
        val = found ? found.steps : 0;
      } else {
        const found = distanceHistory.find(item => item.date === dayKey);
        val = found ? found.distance : 0;
      }

      points.push({
        key: `month-day-${day}`,
        label: `${day}`,
        subLabel: `${day} ${d.toLocaleDateString('en-US', { month: 'short' })}`,
        value: val,
      });
    }
    return points;
  }, [selectedMetric, selectedPeriod, anchorDate, dailyWaterLogs, periodWaterDaily, stepsHistory, distanceHistory]);

  // Compute total, average, and highest statistics
  const { totalText, unitText, averageText, averageUnitText, highestText, highestUnitText } =
    useMemo(() => {
      const sum = chartDataPoints.reduce((acc, curr) => acc + curr.value, 0);
      const max = Math.max(...chartDataPoints.map(d => d.value), 0);
      const activeCount = chartDataPoints.filter(d => d.value > 0).length || 1;
      const divisor = selectedPeriod === 'daily' ? activeCount : chartDataPoints.length;
      const avg = Math.round(sum / Math.max(divisor, 1));

      if (selectedMetric === 'steps') {
        return {
          totalText: sum.toLocaleString(),
          unitText: 'steps',
          averageText: avg.toLocaleString(),
          averageUnitText: selectedPeriod === 'daily' ? 'steps/hr' : 'steps/day',
          highestText: max.toLocaleString(),
          highestUnitText: selectedPeriod === 'daily' ? 'steps (hr)' : 'steps',
        };
      }
      if (selectedMetric === 'distance') {
        return {
          totalText: formatDistance(sum),
          unitText: sum >= 1000 ? 'km' : 'm',
          averageText: formatDistance(avg),
          averageUnitText: selectedPeriod === 'daily' ? 'km/hr' : 'km/day',
          highestText: formatDistance(max),
          highestUnitText: selectedPeriod === 'daily' ? 'peak hr' : 'peak day',
        };
      }
      // Water
      return {
        totalText: sum >= 1000 ? `${(sum / 1000).toFixed(1)} L` : `${sum} ml`,
        unitText: sum >= 1000 ? 'liters' : 'ml',
        averageText: avg >= 1000 ? `${(avg / 1000).toFixed(1)} L` : `${avg} ml`,
        averageUnitText: selectedPeriod === 'daily' ? 'ml/hr' : 'ml/day',
        highestText: max >= 1000 ? `${(max / 1000).toFixed(1)} L` : `${max} ml`,
        highestUnitText: selectedPeriod === 'daily' ? 'ml (hr)' : 'ml',
      };
    }, [chartDataPoints, selectedMetric, selectedPeriod]);

  const contentTranslateX = contentSlideAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [32, 0, -32],
  });

  const contentOpacity = contentSlideAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0.35, 1, 0.35],
  });

  return (
    <View style={[styles.screenWrapper, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: insets.top + 4,
            paddingBottom: insets.bottom + (hideDock ? 88 : 94),
          },
        ]}
        showsVerticalScrollIndicator={false}>

        {/* 1. Top Header: Stats Title & Subtitle */}
        <Animated.View
          style={[
            styles.headerRow,
            {
              opacity: entranceHeader,
              transform: [
                {
                  translateY: entranceHeader.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-12, 0],
                  }),
                },
              ],
            },
          ]}>
          <Text style={[styles.screenTitleText, { color: theme.colors.onSurface }]}>
            Stats
          </Text>
          <Text style={[styles.screenSubtitleText, { color: theme.colors.onSurfaceVariant }]}>
            Track and analyze your activity
          </Text>
        </Animated.View>

        {/* 2. Metric Selector (Steps, Distance, Water) */}
        <Animated.View
          style={{
            opacity: entranceMetrics,
            transform: [
              {
                translateY: entranceMetrics.interpolate({
                  inputRange: [0, 1],
                  outputRange: [14, 0],
                }),
              },
            ],
          }}>
          <StatsMetricSelector
            selectedMetric={selectedMetric}
            onSelectMetric={handleSelectMetric}
          />
        </Animated.View>

        {/* 3. Period Selector (Week | Daily | Month) */}
        <Animated.View
          style={{
            opacity: entrancePeriods,
            transform: [
              {
                translateY: entrancePeriods.interpolate({
                  inputRange: [0, 1],
                  outputRange: [14, 0],
                }),
              },
            ],
          }}>
          <StatsPeriodSelector
            selectedPeriod={selectedPeriod}
            onSelectPeriod={setSelectedPeriod}
          />

          {/* 4. Period Navigator (< Date Range >) */}
          <StatsPeriodNavigator
            dateRangeText={dateRangeText}
            canGoNext={canGoNext}
            onPrevious={handlePrevious}
            onNext={handleNext}
            transitionDirection={navDirection}
          />
        </Animated.View>

        {/* Swipable Chart & Summaries Content Area */}
        <View {...panResponder.panHandlers}>
          <Animated.View
            style={{
              opacity: Animated.multiply(entranceChart, contentOpacity),
              transform: [{ translateX: contentTranslateX }],
            }}>
            {/* 5. Main Responsive Chart Card */}
            <StatsChart
              metric={selectedMetric}
              period={selectedPeriod}
              subtitle={chartSubtitle}
              totalValueText={totalText}
              unitText={unitText}
              data={chartDataPoints}
              loading={loading}
            />

            {/* 6. Contextual Summary Cards (Average & Highest) */}
            <StatsSummaryCards
              averageValue={averageText}
              averageUnit={averageUnitText}
              highestValue={highestText}
              highestUnit={highestUnitText}
            />
          </Animated.View>
        </View>
      </ScrollView>

      {/* Floating Bottom Navigation Dock with Stats active (rendered only when not embedded) */}
      {!hideDock && (
        <FloatingDock
          activeTab="stats"
          onHomePress={() => navigation.navigate('Dashboard')}
          onAnalyticsPress={() => {}}
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
  headerRow: {
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  screenTitleText: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  screenSubtitleText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
});

