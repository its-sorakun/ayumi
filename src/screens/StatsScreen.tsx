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
  PixelRatio,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../types';
import { healthService } from '../services';
import { useHealthData, useWaterTracker } from '../hooks';
import type {
  HistoricalStepData,
  HistoricalDistanceData,
  HourlyStepData,
  HourlyDistanceData,
} from '../types/health';
import {
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
import type { StatNumberScaleUnit } from '../components/AnimatedStatNumber';
import { FloatingDock } from '../components/FloatingDock';
import { MotionTokens, useReducedMotion } from '../theme/motion';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export interface StatsScreenProps {
  hideDock?: boolean;
  activeMetricProp?: StatMetricType;
  onSelectMetricProp?: (metric: StatMetricType) => void;
  isPageActive?: boolean;
}

const METRIC_ORDER: readonly StatMetricType[] = ['steps', 'distance', 'water'];

interface PeriodDataset {
  readonly period: StatPeriodType;
  readonly anchorKey: string;
  readonly anchorDate: Date;
  readonly stepsRange: readonly HistoricalStepData[];
  readonly distanceRange: readonly HistoricalDistanceData[];
  readonly hourlyStepsSupported: boolean;
  readonly hourlySteps: readonly HourlyStepData[];
  readonly hourlyDistanceSupported: boolean;
  readonly hourlyDistance: readonly HourlyDistanceData[];
  readonly dailyWaterHours: readonly number[];
  readonly periodWaterDays: ReadonlyMap<string, { amount: number; hasLog: boolean }>;
}

/**
 * Resolves the local hour (0..23) for a logged water record.
 * Prefers the millisecond timestamp stored in `log.id` before parsing 12h/24h formatted strings.
 */
export function extractWaterLogHour(
  log: { readonly id: string; readonly time: string },
  expectedDateKey: string,
): number | null {
  if (/^\d{12,15}$/.test(log.id)) {
    const parsed = new Date(Number(log.id));
    if (!Number.isNaN(parsed.getTime()) && formatLocalDateKey(parsed) === expectedDateKey) {
      return parsed.getHours();
    }
  }

  const timeMatch = log.time.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(am|pm))?/i);
  if (!timeMatch) return null;

  let hour = parseInt(timeMatch[1], 10);
  const meridiem = timeMatch[3]?.toLowerCase();
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;

  return hour >= 0 && hour < 24 ? hour : null;
}

/** Maps period aggregation mode + range label to a consistent chart header subtitle. */
export function formatChartSubtitle(periodType: StatPeriodType, rangeLabel: string): string {
  switch (periodType) {
    case 'daily':
      return `Daily • ${rangeLabel}`;
    case 'week':
      return `Weekly • ${rangeLabel}`;
    case 'month':
      return `Monthly • ${rangeLabel}`;
  }
}

/** Advances calendar month without JS Date day-of-month rollover (e.g. Mar 31 -> Feb 28). */
function shiftMonthSafely(base: Date, deltaMonths: number): Date {
  const targetYear = base.getFullYear();
  const targetMonth = base.getMonth() + deltaMonths;
  const firstOfTarget = new Date(targetYear, targetMonth, 1);
  const daysInTarget = new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth() + 1, 0).getDate();
  const clampedDay = Math.min(base.getDate(), daysInTarget);
  return new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth(), clampedDay);
}

function formatDistanceSummary(meters: number, unitSuffix?: string): { value: string; unit: string } {
  if (meters >= 1000) {
    const km = Number((meters / 1000).toFixed(2));
    return {
      value: km.toLocaleString(),
      unit: unitSuffix ? `km/${unitSuffix}` : 'km',
    };
  }
  return {
    value: Math.round(meters).toLocaleString(),
    unit: unitSuffix ? `m/${unitSuffix}` : 'm',
  };
}

function formatWaterSummary(ml: number, unitSuffix?: string): { value: string; unit: string } {
  if (ml >= 1000) {
    const liters = Number((ml / 1000).toFixed(2));
    return {
      value: liters.toString(),
      unit: unitSuffix ? `L/${unitSuffix}` : 'L',
    };
  }
  return {
    value: Math.round(ml).toLocaleString(),
    unit: unitSuffix ? `ml/${unitSuffix}` : 'ml',
  };
}

export function StatsScreen({
  hideDock = false,
  activeMetricProp,
  onSelectMetricProp,
  isPageActive = true,
}: StatsScreenProps = {}): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<any>();
  const reducedMotion = useReducedMotion();

  const { todaySummary, providerName } = useHealthData();
  const { totalWater, getLogsForDate } = useWaterTracker();

  // Primary selection state (drives selectors & navigator immediately on user tap)
  const initialMetric: StatMetricType = activeMetricProp || route.params?.metric || 'steps';
  const [selectedMetric, setSelectedMetric] = useState<StatMetricType>(initialMetric);
  const [selectedPeriod, setSelectedPeriod] = useState<StatPeriodType>('daily');
  const [anchorDate, setAnchorDate] = useState<Date>(today());
  const [navDirection, setNavDirection] = useState<'prev' | 'next'>('next');
  const [loading, setLoading] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  // Atomic committed dataset ensures chart title, total, bars, and summary always match
  const [committedDataset, setCommittedDataset] = useState<PeriodDataset | null>(null);
  const datasetCacheRef = useRef<Map<string, PeriodDataset>>(new Map());
  const requestIdRef = useRef(0);
  const prevLiveSigRef = useRef('');
  const wasPageActiveRef = useRef(isPageActive);

  // Animation values for screen entrance
  const entranceHeader = useRef(new Animated.Value(0)).current;
  const entranceMetrics = useRef(new Animated.Value(0)).current;
  const entrancePeriods = useRef(new Animated.Value(0)).current;
  const entranceChart = useRef(new Animated.Value(0)).current;
  const entranceSummaries = useRef(new Animated.Value(0)).current;

  // Crisp subtle horizontal nudge for metric switch (zero opacity wash-out)
  const contentSlideAnim = useRef(new Animated.Value(0)).current;

  // Initial choreographed entrance (bypassed under OS reduced-motion setting)
  useEffect(() => {
    if (reducedMotion) {
      entranceHeader.setValue(1);
      entranceMetrics.setValue(1);
      entrancePeriods.setValue(1);
      entranceChart.setValue(1);
      entranceSummaries.setValue(1);
      return;
    }

    Animated.stagger(65, [
      Animated.timing(entranceHeader, { toValue: 1, duration: 340, easing: MotionTokens.easing.emphasizedDecel, useNativeDriver: true }),
      Animated.timing(entranceMetrics, { toValue: 1, duration: 360, easing: MotionTokens.easing.emphasizedDecel, useNativeDriver: true }),
      Animated.timing(entrancePeriods, { toValue: 1, duration: 360, easing: MotionTokens.easing.emphasizedDecel, useNativeDriver: true }),
      Animated.timing(entranceChart, { toValue: 1, duration: 400, easing: MotionTokens.easing.emphasizedDecel, useNativeDriver: true }),
      Animated.timing(entranceSummaries, { toValue: 1, duration: 380, easing: MotionTokens.easing.emphasizedDecel, useNativeDriver: true }),
    ]).start();
  }, [reducedMotion, entranceHeader, entranceMetrics, entrancePeriods, entranceChart, entranceSummaries]);

  // Transition handler when switching metric
  const handleSelectMetric = useCallback((newMetric: StatMetricType) => {
    if (newMetric === selectedMetric) return;

    const currentIndex = METRIC_ORDER.indexOf(selectedMetric);
    const newIndex = METRIC_ORDER.indexOf(newMetric);
    const direction = newIndex > currentIndex ? -1 : 1;

    contentSlideAnim.stopAnimation();
    setSelectedMetric(newMetric);
    onSelectMetricProp?.(newMetric);

    if (reducedMotion) {
      contentSlideAnim.setValue(0);
      return;
    }

    contentSlideAnim.setValue(direction);
    Animated.spring(contentSlideAnim, {
      toValue: 0,
      stiffness: 240,
      damping: 22,
      mass: 0.85,
      useNativeDriver: true,
    }).start();
  }, [selectedMetric, reducedMotion, contentSlideAnim, onSelectMetricProp]);

  // Update metric if passed via route params or props
  useEffect(() => {
    if (activeMetricProp && activeMetricProp !== selectedMetric) {
      handleSelectMetric(activeMetricProp);
    } else if (route.params?.metric && route.params.metric !== selectedMetric) {
      handleSelectMetric(route.params.metric);
    }
  }, [activeMetricProp, route.params?.metric, selectedMetric, handleSelectMetric]);

  // Fetch all metrics for a period+date atomically so switching metrics never flashes empty bars
  const loadData = useCallback(async (bypassCache = false) => {
    const anchorKey = formatLocalDateKey(anchorDate);
    const cacheKey = `${selectedPeriod}:${anchorKey}:${providerName}`;
    const cached = !bypassCache ? datasetCacheRef.current.get(cacheKey) : undefined;
    if (cached) {
      setCommittedDataset(cached);
      return;
    }

    const reqId = ++requestIdRef.current;
    setLoading(true);
    try {
      const todayMid = today().getTime();

      if (selectedPeriod === 'daily') {
        const [hourlyStepsRes, hourlyDistRes, waterLogs] = await Promise.all([
          healthService.getHourlySteps(anchorDate),
          healthService.getHourlyDistance(anchorDate),
          getLogsForDate(anchorKey),
        ]);

        const dailyWaterHours = new Array<number>(24).fill(0);
        waterLogs.forEach(log => {
          const hr = extractWaterLogHour(log, anchorKey);
          if (hr !== null) {
            dailyWaterHours[hr] += log.amount;
          }
        });

        const dataset: PeriodDataset = {
          period: 'daily',
          anchorKey,
          anchorDate: new Date(anchorDate),
          stepsRange: [],
          distanceRange: [],
          hourlyStepsSupported: hourlyStepsRes.supported,
          hourlySteps: hourlyStepsRes.buckets,
          hourlyDistanceSupported: hourlyDistRes.supported,
          hourlyDistance: hourlyDistRes.buckets,
          dailyWaterHours,
          periodWaterDays: new Map(),
        };

        if (reqId === requestIdRef.current) {
          datasetCacheRef.current.set(cacheKey, dataset);
          setCommittedDataset(dataset);
        }
        return;
      }

      // Compute exact inclusive local calendar bounds for Week (7d) or Month (28-31d)
      let rangeStart: Date;
      let rangeEnd: Date;
      if (selectedPeriod === 'week') {
        rangeStart = new Date(anchorDate);
        rangeStart.setDate(rangeStart.getDate() - 6);
        rangeEnd = new Date(anchorDate);
      } else {
        const year = anchorDate.getFullYear();
        const month = anchorDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        rangeStart = new Date(year, month, 1);
        rangeEnd = new Date(year, month, daysInMonth);
      }

      const dayKeysToFetch: string[] = [];
      const cursor = new Date(rangeStart);
      while (startOfDay(cursor).getTime() <= startOfDay(rangeEnd).getTime()) {
        if (startOfDay(cursor).getTime() <= todayMid) {
          dayKeysToFetch.push(formatLocalDateKey(cursor));
        }
        cursor.setDate(cursor.getDate() + 1);
      }

      const periodWaterDays = new Map<string, { amount: number; hasLog: boolean }>();
      const [stepsRange, distanceRange] = await Promise.all([
        healthService.getHistoricalStepsRange(rangeStart, rangeEnd),
        healthService.getHistoricalDistanceRange(rangeStart, rangeEnd),
        Promise.all(
          dayKeysToFetch.map(key =>
            getLogsForDate(key).then(dayLogs => {
              const amount = dayLogs.reduce((acc, curr) => acc + curr.amount, 0);
              periodWaterDays.set(key, {
                amount,
                hasLog: dayLogs.length > 0,
              });
            })
          )
        ),
      ]);

      const dataset: PeriodDataset = {
        period: selectedPeriod,
        anchorKey,
        anchorDate: new Date(anchorDate),
        stepsRange,
        distanceRange,
        hourlyStepsSupported: true,
        hourlySteps: [],
        hourlyDistanceSupported: true,
        hourlyDistance: [],
        dailyWaterHours: [],
        periodWaterDays,
      };

      if (reqId === requestIdRef.current) {
        datasetCacheRef.current.set(cacheKey, dataset);
        setCommittedDataset(dataset);
      }
    } catch (err) {
      console.warn('Failed to load stats data', err);
    } finally {
      if (reqId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [selectedPeriod, anchorDate, providerName, getLogsForDate]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      datasetCacheRef.current.clear();
      loadData(true);
    }, [loadData])
  );

  // Sync automatically when live home telemetry changes or user swipes back onto Stats page
  const liveSteps = todaySummary?.steps ?? 0;
  const liveDistance = Math.round(todaySummary?.distance ?? 0);
  useEffect(() => {
    const liveSig = `${liveSteps}:${liveDistance}:${totalWater}:${providerName}`;
    const becameActive = isPageActive && !wasPageActiveRef.current;
    wasPageActiveRef.current = isPageActive;

    if (prevLiveSigRef.current !== '' && (liveSig !== prevLiveSigRef.current || becameActive)) {
      datasetCacheRef.current.clear();
      loadData(true);
    }
    prevLiveSigRef.current = liveSig;
  }, [liveSteps, liveDistance, totalWater, providerName, isPageActive, loadData]);

  // Metric cycling for horizontal swipe gesture
  const cycleMetric = useCallback((direction: 'next' | 'prev') => {
    const currentIndex = METRIC_ORDER.indexOf(selectedMetric);
    let nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex >= METRIC_ORDER.length) nextIndex = 0;
    if (nextIndex < 0) nextIndex = METRIC_ORDER.length - 1;
    handleSelectMetric(METRIC_ORDER[nextIndex]);
  }, [selectedMetric, handleSelectMetric]);

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
    [cycleMetric, hideDock]
  );

  // Navigation handlers
  const canGoNext = useMemo(() => {
    const todayMidnight = today().getTime();
    if (selectedPeriod === 'month') {
      const now = today();
      return (
        anchorDate.getFullYear() < now.getFullYear() ||
        (anchorDate.getFullYear() === now.getFullYear() && anchorDate.getMonth() < now.getMonth())
      );
    }
    return anchorDate.getTime() < todayMidnight;
  }, [anchorDate, selectedPeriod]);

  const handlePrevious = () => {
    setNavDirection('prev');
    if (selectedPeriod === 'daily') {
      const next = new Date(anchorDate);
      next.setDate(next.getDate() - 1);
      setAnchorDate(next);
    } else if (selectedPeriod === 'week') {
      const next = new Date(anchorDate);
      next.setDate(next.getDate() - 7);
      setAnchorDate(next);
    } else {
      setAnchorDate(shiftMonthSafely(anchorDate, -1));
    }
  };

  const handleNext = () => {
    if (!canGoNext) return;
    setNavDirection('next');
    let next: Date;
    if (selectedPeriod === 'daily') {
      next = new Date(anchorDate);
      next.setDate(next.getDate() + 1);
    } else if (selectedPeriod === 'week') {
      next = new Date(anchorDate);
      next.setDate(next.getDate() + 7);
    } else {
      next = shiftMonthSafely(anchorDate, 1);
    }
    if (next.getTime() > today().getTime()) {
      setAnchorDate(today());
    } else {
      setAnchorDate(next);
    }
  };

  const formatPeriodRangeLabel = useCallback((periodType: StatPeriodType, targetDate: Date) => {
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    if (periodType === 'daily') {
      return `${monthNames[targetDate.getMonth()]} ${targetDate.getDate()}, ${targetDate.getFullYear()}`;
    }
    if (periodType === 'week') {
      const start = new Date(targetDate);
      start.setDate(start.getDate() - 6);
      const startStr = `${monthNames[start.getMonth()]} ${start.getDate()}`;
      const endStr = `${monthNames[targetDate.getMonth()]} ${targetDate.getDate()}, ${targetDate.getFullYear()}`;
      return `${startStr} – ${endStr}`;
    }
    const fullMonthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return `${fullMonthNames[targetDate.getMonth()]} ${targetDate.getFullYear()}`;
  }, []);

  // Navigator header follows immediate UI selection
  const dateRangeText = useMemo(
    () => formatPeriodRangeLabel(selectedPeriod, anchorDate),
    [formatPeriodRangeLabel, selectedPeriod, anchorDate]
  );

  // Chart card and summary cards bind strictly to committedDataset so title/bars/totals stay coherent
  const committedPeriod = committedDataset?.period ?? selectedPeriod;
  const committedAnchor = committedDataset?.anchorDate ?? anchorDate;

  const chartSubtitle = useMemo(() => {
    const label = formatPeriodRangeLabel(committedPeriod, committedAnchor);
    return formatChartSubtitle(committedPeriod, label);
  }, [committedPeriod, committedAnchor, formatPeriodRangeLabel]);

  const { chartDataPoints, unavailableNotice, hourlyUnavailable } = useMemo(() => {
    const todayMidnight = today().getTime();
    const nowHour = new Date().getHours();

    if (committedPeriod === 'daily') {
      const points: ChartDataPoint[] = [];
      const dayMid = startOfDay(committedAnchor).getTime();
      const isFutureDay = dayMid > todayMidnight;
      const isTodayDay = dayMid === todayMidnight;

      const isHourlyUnsupported =
        !committedDataset ||
        (selectedMetric === 'steps' && !committedDataset.hourlyStepsSupported) ||
        (selectedMetric === 'distance' && !committedDataset.hourlyDistanceSupported);

      const hasCommittedHourly =
        committedDataset != null &&
        ((selectedMetric === 'steps' && !committedDataset.hourlyStepsSupported) ||
          (selectedMetric === 'distance' && !committedDataset.hourlyDistanceSupported));

      for (let h = 0; h < 24; h++) {
        const hourStr = String(h).padStart(2, '0');
        const isFutureSlot = isFutureDay || (isTodayDay && h > nowHour);

        if (isFutureSlot) {
          points.push({
            key: `hour-${h}`,
            label: hourStr,
            subLabel: `${hourStr}:00`,
            value: 0,
            status: 'future',
          });
          continue;
        }

        if (selectedMetric === 'water') {
          const val = committedDataset?.dailyWaterHours[h] || 0;
          points.push({
            key: `hour-${h}`,
            label: hourStr,
            subLabel: `${hourStr}:00`,
            value: val,
            status: 'recorded',
          });
        } else if (hasCommittedHourly || !committedDataset) {
          points.push({
            key: `hour-${h}`,
            label: hourStr,
            subLabel: `${hourStr}:00`,
            value: 0,
            status: 'missing',
          });
        } else if (selectedMetric === 'steps') {
          const bucket = committedDataset.hourlySteps.find(b => b.hour === h);
          points.push({
            key: `hour-${h}`,
            label: hourStr,
            subLabel: `${hourStr}:00`,
            value: bucket?.steps || 0,
            status: 'recorded',
          });
        } else {
          const bucket = committedDataset.hourlyDistance.find(b => b.hour === h);
          points.push({
            key: `hour-${h}`,
            label: hourStr,
            subLabel: `${hourStr}:00`,
            value: bucket?.distance || 0,
            status: 'recorded',
          });
        }
      }

      const notice =
        hasCommittedHourly && !isFutureDay
          ? 'Hourly breakdown requires Health Connect'
          : null;

      return {
        chartDataPoints: points,
        unavailableNotice: notice,
        hourlyUnavailable: Boolean(hasCommittedHourly && !isFutureDay && isHourlyUnsupported),
      };
    }

    if (committedPeriod === 'week') {
      const points: ChartDataPoint[] = [];
      const dayLetters = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      for (let i = 6; i >= 0; i--) {
        const d = new Date(committedAnchor);
        d.setDate(d.getDate() - i);
        const dayKey = formatLocalDateKey(d);
        const dayLabel = dayLetters[d.getDay()];
        const isFutureDay = startOfDay(d).getTime() > todayMidnight;

        if (isFutureDay) {
          points.push({
            key: dayKey,
            label: dayLabel,
            subLabel: `${dayLabel}, ${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })}`,
            value: 0,
            status: 'future',
          });
          continue;
        }

        let val = 0;
        let hasRecord = false;
        if (committedDataset) {
          if (selectedMetric === 'water') {
            const waterEntry = committedDataset.periodWaterDays.get(dayKey);
            val = waterEntry?.amount || 0;
            hasRecord = Boolean(waterEntry && (waterEntry.hasLog || waterEntry.amount > 0));
          } else if (selectedMetric === 'steps') {
            const found = committedDataset.stepsRange.find(item => item.date === dayKey);
            val = found ? found.steps : 0;
            hasRecord = Boolean(found && (found.hasRecord !== false || found.steps > 0));
          } else {
            const found = committedDataset.distanceRange.find(item => item.date === dayKey);
            val = found ? found.distance : 0;
            hasRecord = Boolean(found && (found.hasRecord !== false || found.distance > 0));
          }
        }

        points.push({
          key: dayKey,
          label: dayLabel,
          subLabel: `${dayLabel}, ${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })}`,
          value: val,
          status: hasRecord ? 'recorded' : 'missing',
        });
      }

      return { chartDataPoints: points, unavailableNotice: null, hourlyUnavailable: false };
    }

    // Monthly: 28-31 calendar days
    const year = committedAnchor.getFullYear();
    const month = committedAnchor.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const points: ChartDataPoint[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const dayKey = formatLocalDateKey(d);
      const isFutureDay = startOfDay(d).getTime() > todayMidnight;

      if (isFutureDay) {
        points.push({
          key: `month-day-${day}`,
          label: `${day}`,
          subLabel: `${day} ${d.toLocaleDateString('en-US', { month: 'short' })}`,
          value: 0,
          status: 'future',
        });
        continue;
      }

      let val = 0;
      let hasRecord = false;
      if (committedDataset) {
        if (selectedMetric === 'water') {
          const waterEntry = committedDataset.periodWaterDays.get(dayKey);
          val = waterEntry?.amount || 0;
          hasRecord = Boolean(waterEntry && (waterEntry.hasLog || waterEntry.amount > 0));
        } else if (selectedMetric === 'steps') {
          const found = committedDataset.stepsRange.find(item => item.date === dayKey);
          val = found ? found.steps : 0;
          hasRecord = Boolean(found && (found.hasRecord !== false || found.steps > 0));
        } else {
          const found = committedDataset.distanceRange.find(item => item.date === dayKey);
          val = found ? found.distance : 0;
          hasRecord = Boolean(found && (found.hasRecord !== false || found.distance > 0));
        }
      }

      points.push({
        key: `month-day-${day}`,
        label: `${day}`,
        subLabel: `${day} ${d.toLocaleDateString('en-US', { month: 'short' })}`,
        value: val,
        status: hasRecord ? 'recorded' : 'missing',
      });
    }

    return { chartDataPoints: points, unavailableNotice: null, hourlyUnavailable: false };
  }, [committedDataset, committedPeriod, committedAnchor, selectedMetric]);

  // Compute total, average (over elapsed recorded slots only), and highest without duplicating units
  const {
    totalText,
    totalRaw,
    totalScaleUnit,
    unitText,
    averageText,
    averageRaw,
    averageScaleUnit,
    averageUnitText,
    highestText,
    highestRaw,
    highestScaleUnit,
    highestUnitText,
  } =
    useMemo(() => {
      if (hourlyUnavailable) {
        return {
          totalText: '--',
          totalRaw: null as number | null,
          totalScaleUnit: 'raw' as StatNumberScaleUnit,
          unitText: selectedMetric === 'steps' ? 'steps/hr' : 'hourly',
          averageText: '--',
          averageRaw: null as number | null,
          averageScaleUnit: 'raw' as StatNumberScaleUnit,
          averageUnitText: 'unavailable',
          highestText: '--',
          highestRaw: null as number | null,
          highestScaleUnit: 'raw' as StatNumberScaleUnit,
          highestUnitText: 'unavailable',
        };
      }

      const recordedPoints = chartDataPoints.filter(p => (p.status ?? 'recorded') === 'recorded');
      const sum = recordedPoints.reduce((acc, curr) => acc + curr.value, 0);
      const max = recordedPoints.length > 0 ? Math.max(...recordedPoints.map(d => d.value)) : 0;
      const periodUnitSuffix = committedPeriod === 'daily' ? 'hr' : 'day';

      let avg = 0;
      if (committedPeriod === 'daily') {
        const activeHours = recordedPoints.filter(p => p.value > 0).length;
        avg = activeHours > 0 ? sum / activeHours : 0;
      } else {
        avg = recordedPoints.length > 0 ? sum / recordedPoints.length : 0;
      }

      if (selectedMetric === 'steps') {
        return {
          totalText: Math.round(sum).toLocaleString(),
          totalRaw: sum,
          totalScaleUnit: 'raw' as StatNumberScaleUnit,
          unitText: 'steps',
          averageText: Math.round(avg).toLocaleString(),
          averageRaw: avg,
          averageScaleUnit: 'raw' as StatNumberScaleUnit,
          averageUnitText: `steps/${periodUnitSuffix}`,
          highestText: Math.round(max).toLocaleString(),
          highestRaw: max,
          highestScaleUnit: 'raw' as StatNumberScaleUnit,
          highestUnitText: 'steps',
        };
      }

      if (selectedMetric === 'distance') {
        const totalParts = formatDistanceSummary(sum);
        const avgParts = formatDistanceSummary(avg, periodUnitSuffix);
        const highParts = formatDistanceSummary(max);
        return {
          totalText: totalParts.value,
          totalRaw: sum,
          totalScaleUnit: (sum >= 1000 ? 'kilo' : 'raw') as StatNumberScaleUnit,
          unitText: totalParts.unit,
          averageText: avgParts.value,
          averageRaw: avg,
          averageScaleUnit: (avg >= 1000 ? 'kilo' : 'raw') as StatNumberScaleUnit,
          averageUnitText: avgParts.unit,
          highestText: highParts.value,
          highestRaw: max,
          highestScaleUnit: (max >= 1000 ? 'kilo' : 'raw') as StatNumberScaleUnit,
          highestUnitText: highParts.unit,
        };
      }

      const totalWaterParts = formatWaterSummary(sum);
      const avgWaterParts = formatWaterSummary(avg, periodUnitSuffix);
      const highWaterParts = formatWaterSummary(max);
      return {
        totalText: totalWaterParts.value,
        totalRaw: sum,
        totalScaleUnit: (sum >= 1000 ? 'kilo' : 'raw') as StatNumberScaleUnit,
        unitText: totalWaterParts.unit,
        averageText: avgWaterParts.value,
        averageRaw: avg,
        averageScaleUnit: (avg >= 1000 ? 'kilo' : 'raw') as StatNumberScaleUnit,
        averageUnitText: avgWaterParts.unit,
        highestText: highWaterParts.value,
        highestRaw: max,
        highestScaleUnit: (max >= 1000 ? 'kilo' : 'raw') as StatNumberScaleUnit,
        highestUnitText: highWaterParts.unit,
      };
    }, [chartDataPoints, committedPeriod, selectedMetric, hourlyUnavailable]);

  const numericSyncKey = `${committedPeriod}:${committedDataset?.anchorKey ?? 'none'}:${selectedMetric}:${hourlyUnavailable ? 'na' : 'ok'}`;
  const revealDuration = MotionTokens.chartReveal[committedPeriod].duration;

  // Preserve non-scrolling layout on standard viewports while unlocking scroll only on smaller screens or large font scales
  const dockReserve = Math.max(insets.bottom + 8, 16) + 58 + 10;
  const requiresScroll =
    PixelRatio.getFontScale() > 1.15 ||
    (viewportHeight > 0 && contentHeight > 0 && contentHeight + dockReserve > viewportHeight + 1);

  const contentTranslateX = contentSlideAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [14, 0, -14],
  });

  // Gentle micro-dip keeps card readable at near-full contrast instead of washing out to 0.35
  const contentOpacity = contentSlideAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0.92, 1, 0.92],
  });

  return (
    <View
      style={[styles.screenWrapper, { backgroundColor: theme.colors.background }]}
      onLayout={e => setViewportHeight(e.nativeEvent.layout.height)}>
      <ScrollView
        style={styles.container}
        scrollEnabled={requiresScroll}
        bounces={requiresScroll}
        overScrollMode={requiresScroll ? 'always' : 'never'}
        contentContainerStyle={[
          styles.contentContainer,
          requiresScroll ? { paddingBottom: dockReserve } : styles.nonScrollingContainer,
        ]}
        showsVerticalScrollIndicator={false}>
        <View
          onLayout={e => setContentHeight(e.nativeEvent.layout.height)}
          style={{ paddingTop: insets.top + 6 }}>

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
              period={committedPeriod}
              subtitle={chartSubtitle}
              totalValueText={totalText}
              totalRawValue={totalRaw}
              totalScaleUnit={totalScaleUnit}
              unitText={unitText}
              data={chartDataPoints}
              loading={loading}
              unavailableNotice={unavailableNotice}
            />

            {/* 6. Contextual Summary Cards (Average & Highest) */}
            <StatsSummaryCards
              metric={selectedMetric}
              averageValue={averageText}
              averageRawValue={averageRaw}
              averageScaleUnit={averageScaleUnit}
              averageUnit={averageUnitText}
              highestValue={highestText}
              highestRawValue={highestRaw}
              highestScaleUnit={highestScaleUnit}
              highestUnit={highestUnitText}
              highestLabel={committedPeriod === 'daily' ? 'Highest (Hr)' : 'Highest (Day)'}
              syncKey={numericSyncKey}
              duration={revealDuration}
            />
          </Animated.View>
        </View>
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
  nonScrollingContainer: {
    flexGrow: 1,
    paddingBottom: 0,
  },
  headerRow: {
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  screenTitleText: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  screenSubtitleText: {
    fontSize: 13.5,
    fontWeight: '500',
    marginTop: 2,
  },
});

