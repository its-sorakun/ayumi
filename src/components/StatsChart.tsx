/**
 * StatsChart — responsive bar chart for Material 3 Expressive analytics.
 *
 * Implements the centerpiece of the unified Statistics dashboard:
 *  - Supports 24-hour Daily (hourly), 7-day Weekly, and 28-31-day Monthly granularities
 *  - Responsive coordinate calculations guaranteeing exact fit within card bounds
 *  - Rounded top bar geometry with solid wallpaper-derived Monet primary colors
 *  - Sequential wave-like bar growth from baseline with staggered wave interpolation
 *  - Balanced vertical dimensions providing comfortable readability without excessive blank space
 *  - Interactive bar tapping with highlighted state and animated spring tooltip bubble
 *  - Clean Y-axis scaling with sparse X-axis intervals and subtle horizontal gridlines
 *  - Native loading skeleton and empty state handling
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  LayoutChangeEvent,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Svg, { Line } from 'react-native-svg';

import type { StatMetricType } from './StatsMetricSelector';
import type { StatPeriodType } from './StatsPeriodSelector';
import { SneakerIcon, RouteMapIcon, DropletIcon } from './AestheticIcons';
import { MotionTokens, useReducedMotion } from '../theme/motion';
import { AnimatedStatNumber, type StatNumberScaleUnit } from './AnimatedStatNumber';

export type ChartPointStatus = 'recorded' | 'missing' | 'future';

export interface ChartDataPoint {
  readonly key: string;
  readonly label: string;
  readonly subLabel?: string;
  readonly value: number;
  readonly status?: ChartPointStatus;
}

interface StatsChartProps {
  readonly metric: StatMetricType;
  readonly period: StatPeriodType;
  readonly subtitle: string;
  readonly totalValueText: string;
  readonly totalRawValue?: number | null;
  readonly totalScaleUnit?: StatNumberScaleUnit;
  readonly unitText: string;
  readonly data: readonly ChartDataPoint[];
  readonly loading?: boolean;
  readonly unavailableNotice?: string | null;
}

const CHART_HEIGHT = 140;
const PLOT_TOP_PADDING = 8;
const PLOT_BOTTOM_PADDING = 8;
const PLOT_SPAN = CHART_HEIGHT - PLOT_TOP_PADDING - PLOT_BOTTOM_PADDING;
const Y_AXIS_WIDTH = 48;

/**
 * Formats a Y-axis tick value consistently with the active metric's primary units
 * (km/m for distance, L/ml for water, compact k/integer counts for steps).
 * Pass `scaleMax` so non-zero ticks within the same chart share one coherent unit.
 */
export function formatMetricAxisTick(
  value: number,
  metric: StatMetricType,
  scaleMax: number,
): string {
  if (value === 0) return '0';

  if (metric === 'distance') {
    if (scaleMax >= 1000) {
      return `${Number((value / 1000).toFixed(2))} km`;
    }
    return `${Math.round(value)} m`;
  }

  if (metric === 'water') {
    if (scaleMax >= 1000) {
      return `${Number((value / 1000).toFixed(2))} L`;
    }
    return `${Math.round(value)} ml`;
  }

  if (value >= 1000) {
    return `${Number((value / 1000).toFixed(2))}k`;
  }
  return `${Math.round(value)}`;
}

/**
 * Selects a clean upper axis bound divisible by 4 into round whole ticks.
 * Handles small hourly counts (e.g. 6 steps -> 0..8) and Liter/km bounds cleanly.
 */
export function computeNiceAxisMax(rawMax: number, metric: StatMetricType): number {
  if (rawMax <= 0) {
    return metric === 'water' ? 2000 : metric === 'distance' ? 1000 : 100;
  }

  const minStep = rawMax / 4;
  if (minStep < 10) {
    const smallSteps = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15];
    const picked = smallSteps.find(step => step * 4 >= rawMax) ?? 15;
    return picked * 4;
  }

  const exponent = Math.floor(Math.log10(minStep));
  const decade = Math.pow(10, exponent);
  const mantissas = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

  for (const m of mantissas) {
    const step = m * decade;
    if (!Number.isInteger(step)) continue;
    if (step * 4 >= rawMax) {
      return step * 4;
    }
  }

  return 10 * decade * 4;
}

export function StatsChart({
  metric,
  period,
  subtitle,
  totalValueText,
  totalRawValue,
  totalScaleUnit = 'raw',
  unitText,
  data,
  loading = false,
  unavailableNotice = null,
}: StatsChartProps): React.JSX.Element {
  const theme = useTheme();
  const isDark = theme.dark;
  const reducedMotion = useReducedMotion();

  const [containerWidth, setContainerWidth] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const revealConfig = MotionTokens.chartReveal[period];

  // Native-driven baseline growth factor (0 -> 1)
  const growthAnim = useRef(new Animated.Value(0)).current;
  const tooltipAnim = useRef(new Animated.Value(0)).current;

  // Fingerprint meaningful chart changes so identical refreshes avoid redundant full replays
  const datasetSignature = useMemo(() => {
    const valuesSig = data.map(d => `${d.key}:${Math.round(d.value)}:${d.status || 'r'}`).join('|');
    return `${metric}:${period}:${valuesSig}`;
  }, [metric, period, data]);

  // Deliberate, period-tailored baseline wave reveal with controlled overshoot & true settle
  useEffect(() => {
    growthAnim.stopAnimation();
    if (reducedMotion) {
      growthAnim.setValue(1);
    } else {
      growthAnim.setValue(0);
      Animated.timing(growthAnim, {
        toValue: 1,
        duration: revealConfig.duration,
        easing: MotionTokens.easing.dataReveal,
        useNativeDriver: true,
      }).start();
    }
    setSelectedIndex(null);
  }, [datasetSignature, revealConfig.duration, reducedMotion, growthAnim]);

  // Tooltip entrance animation
  useEffect(() => {
    if (selectedIndex !== null) {
      if (reducedMotion) {
        tooltipAnim.setValue(1);
        return;
      }
      tooltipAnim.setValue(0);
      Animated.spring(tooltipAnim, {
        toValue: 1,
        ...MotionTokens.spring.snappy,
        useNativeDriver: true,
      }).start();
    }
  }, [selectedIndex, reducedMotion, tooltipAnim]);

  const onLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  // Metric Icon configuration
  const metricIcon = useMemo(() => {
    const iconColor = theme.colors.primary;
    switch (metric) {
      case 'steps':
        return <SneakerIcon size={22} color={iconColor} />;
      case 'distance':
        return <RouteMapIcon size={22} color={iconColor} />;
      case 'water':
        return <DropletIcon size={22} color={iconColor} />;
    }
  }, [metric, theme.colors.primary]);

  const metricTitle = useMemo(() => {
    switch (metric) {
      case 'steps':
        return 'Steps';
      case 'distance':
        return 'Distance';
      case 'water':
        return 'Water';
    }
  }, [metric]);

  // Compute clean data-driven maximum Y for scale
  const maxValue = useMemo(() => {
    const max = Math.max(...data.map(d => d.value), 0);
    return computeNiceAxisMax(max, metric);
  }, [data, metric]);

  const yTicks = [maxValue, maxValue * 0.75, maxValue * 0.5, maxValue * 0.25, 0];

  const formatTickLabel = (val: number) => formatMetricAxisTick(val, metric, maxValue);

  const chartPlotWidth = Math.max(containerWidth - Y_AXIS_WIDTH - 32, 100);
  const dataCount = Math.max(data.length, 1);

  // Responsive bar width and spacing
  const { barWidth, barSpacing } = useMemo(() => {
    if (period === 'week') {
      const totalWidth = chartPlotWidth;
      const bWidth = Math.min(Math.max((totalWidth - 6 * 14) / 7, 20), 28);
      const bSpacing = (totalWidth - bWidth * 7) / 6;
      return { barWidth: bWidth, barSpacing: Math.max(bSpacing, 8) };
    }
    if (period === 'daily') {
      const totalWidth = chartPlotWidth;
      const bWidth = Math.min(Math.max((totalWidth - 23 * 4) / 24, 4.5), 9);
      const bSpacing = (totalWidth - bWidth * 24) / 23;
      return { barWidth: bWidth, barSpacing: Math.max(bSpacing, 2) };
    }
    const totalWidth = chartPlotWidth;
    const bWidth = Math.min(Math.max((totalWidth - (dataCount - 1) * 3) / dataCount, 4), 8);
    const bSpacing = (totalWidth - bWidth * dataCount) / (dataCount - 1);
    return { barWidth: bWidth, barSpacing: Math.max(bSpacing, 1.5) };
  }, [period, chartPlotWidth, dataCount]);

  const shouldShowLabel = (index: number, _total: number) => {
    if (period === 'week') return true;
    if (period === 'daily') {
      return index % 3 === 0 && index < 24;
    }
    const day = index + 1;
    return day === 1 || day % 5 === 0;
  };

  const selectedPoint = selectedIndex !== null ? data[selectedIndex] : null;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark
            ? theme.colors.elevation.level1
            : theme.colors.surface,
          borderWidth: isDark ? 1 : 0,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
        },
      ]}
      onLayout={onLayout}>
      
      {/* Card Header: Left = Metric + Period Subtitle, Right = Sum Value */}
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBubble, { backgroundColor: theme.colors.primaryContainer }]}>
            {metricIcon}
          </View>
          <View style={styles.titleColumn}>
            <Text style={[styles.metricTitleText, { color: theme.colors.onSurface }]}>
              {metricTitle}
            </Text>
            <Text style={[styles.subtitleText, { color: theme.colors.onSurfaceVariant }]}>
              {subtitle}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {totalRawValue !== undefined ? (
            <AnimatedStatNumber
              value={totalRawValue}
              fallbackText={totalValueText}
              unitKey={`${metric}:${unitText}`}
              scaleUnit={totalScaleUnit}
              syncKey={datasetSignature}
              duration={revealConfig.duration}
              style={[styles.totalValueText, { color: theme.colors.onSurface }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            />
          ) : (
            <Text
              style={[styles.totalValueText, { color: theme.colors.onSurface }]}
              numberOfLines={1}
              adjustsFontSizeToFit>
              {totalValueText}
            </Text>
          )}
          <Text style={[styles.unitText, { color: theme.colors.onSurfaceVariant }]}>
            {unitText}
          </Text>
        </View>
      </View>

      {/* Selected Data Point Tooltip Pill with spring pop */}
      {selectedPoint != null && (
        <Animated.View
          style={[
            styles.tooltipBubble,
            {
              backgroundColor: theme.colors.primaryContainer,
              transform: [{ scale: tooltipAnim }],
              opacity: tooltipAnim,
            },
          ]}>
          <Text style={[styles.tooltipText, { color: theme.colors.onPrimaryContainer }]}>
            {selectedPoint.subLabel || selectedPoint.label}:{' '}
            <Text style={{ fontWeight: '800' }}>
              {selectedPoint.status === 'future'
                ? 'Upcoming'
                : selectedPoint.status === 'missing'
                ? 'No data'
                : metric === 'distance'
                ? selectedPoint.value >= 1000
                  ? `${Number((selectedPoint.value / 1000).toFixed(2))} km`
                  : `${Math.round(selectedPoint.value)} m`
                : metric === 'water'
                ? selectedPoint.value >= 1000
                  ? `${Number((selectedPoint.value / 1000).toFixed(2))} L`
                  : `${Math.round(selectedPoint.value)} ml`
                : `${Math.round(selectedPoint.value).toLocaleString()} steps`}
            </Text>
          </Text>
        </Animated.View>
      )}

      {/* Main Chart Graphic Area */}
      <View style={styles.chartAreaRow}>
        {/* Y-Axis scale labels anchored directly to SVG gridline y-positions */}
        <View style={styles.yAxisColumn}>
          {yTicks.map((tick, i) => {
            const lineY = PLOT_TOP_PADDING + (i / (yTicks.length - 1)) * PLOT_SPAN;
            return (
              <Text
                key={i}
                numberOfLines={1}
                style={[
                  styles.axisLabelText,
                  styles.yAxisTickLabel,
                  {
                    color: theme.colors.onSurfaceVariant,
                    top: lineY - 7,
                  },
                ]}>
                {formatTickLabel(tick)}
              </Text>
            );
          })}
        </View>

        {/* SVG Drawing Area for Grid Lines + Overlaid Animated Bars */}
        <View style={styles.plotAreaWrapper}>
          {containerWidth > 0 && (
            <Svg width={chartPlotWidth} height={CHART_HEIGHT} style={StyleSheet.absoluteFill}>
              {/* Horizontal faint grid lines matching PLOT_SPAN */}
              {yTicks.map((_, i) => {
                const y = PLOT_TOP_PADDING + (i / (yTicks.length - 1)) * PLOT_SPAN;
                return (
                  <Line
                    key={`grid-${i}`}
                    x1={0}
                    y1={y}
                    x2={chartPlotWidth}
                    y2={y}
                    stroke={theme.colors.outlineVariant}
                    strokeOpacity={isDark ? 0.16 : 0.26}
                    strokeWidth={1}
                  />
                );
              })}
            </Svg>
          )}

          {/* Baseline-Anchored Native Staggered Bars */}
          {containerWidth > 0 && (
            <View style={styles.barsContainer} pointerEvents="box-none">
              {data.map((point, index) => {
                const x = index * (barWidth + barSpacing);
                const pointStatus: ChartPointStatus = point.status ?? 'recorded';
                const rawHeight = (point.value / maxValue) * PLOT_SPAN;
                const isPositiveValue = pointStatus === 'recorded' && point.value > 0;
                const targetBarHeight = isPositiveValue
                  ? Math.max(Math.min(rawHeight, PLOT_SPAN), 3)
                  : pointStatus === 'recorded'
                  ? 3
                  : 2;
                const isSelected = selectedIndex === index;

                // Period-tailored wave stagger with subtle overshoot peak settling at exact data scale (1.0)
                const startFrac = dataCount > 1 ? (index / (dataCount - 1)) * revealConfig.staggerSpread : 0;
                const span = Math.max(1 - revealConfig.staggerSpread, 0.25);
                const endFrac = Math.min(startFrac + span, 1.0);
                const peakFrac = Math.min(startFrac + (endFrac - startFrac) * 0.72, endFrac - 0.005);
                const barWave = growthAnim.interpolate({
                  inputRange: [startFrac, peakFrac, endFrac],
                  outputRange: [0.001, 1 + revealConfig.overshoot, 1],
                  extrapolate: 'clamp',
                });

                const touchWidth = Math.max(barWidth, 16);
                const touchLeft = x - (touchWidth - barWidth) / 2;

                const barColor = isSelected
                  ? theme.colors.secondary
                  : pointStatus === 'recorded'
                  ? theme.colors.primary
                  : pointStatus === 'missing'
                  ? theme.colors.outline
                  : theme.colors.outlineVariant;

                const barOpacity = isSelected
                  ? 1
                  : pointStatus === 'recorded'
                  ? point.value > 0
                    ? 0.88
                    : 0.3
                  : pointStatus === 'missing'
                  ? isDark
                    ? 0.24
                    : 0.28
                  : 0.14;

                return (
                  <TouchableOpacity
                    key={point.key || index}
                    activeOpacity={0.75}
                    onPress={() => setSelectedIndex(index === selectedIndex ? null : index)}
                    style={[
                      styles.barColumn,
                      {
                        left: touchLeft,
                        width: touchWidth,
                      },
                    ]}>
                    {isPositiveValue ? (
                      <Animated.View
                        style={[
                          styles.barPill,
                          {
                            height: targetBarHeight,
                            width: barWidth,
                            borderRadius: Math.min(barWidth / 2, 4),
                            backgroundColor: barColor,
                            opacity: barOpacity,
                            transform: [
                              {
                                translateY: Animated.multiply(
                                  Animated.subtract(1, barWave),
                                  targetBarHeight / 2,
                                ),
                              },
                              { scaleY: barWave },
                            ],
                          },
                        ]}
                      />
                    ) : (
                      <View
                        style={[
                          styles.barPill,
                          {
                            height: targetBarHeight,
                            width: barWidth,
                            borderRadius: Math.min(barWidth / 2, 4),
                            backgroundColor: barColor,
                            opacity: barOpacity,
                          },
                        ]}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Honest inline notice when provider lacks hourly breakdown */}
          {!loading && unavailableNotice ? (
            <View style={styles.unavailableNoticeOverlay} pointerEvents="none">
              <View
                style={[
                  styles.unavailableNoticePill,
                  { backgroundColor: theme.colors.secondaryContainer },
                ]}>
                <Text
                  style={[
                    styles.unavailableNoticeText,
                    { color: theme.colors.onSecondaryContainer },
                  ]}>
                  {unavailableNotice}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </View>

      {/* X-Axis Labels Row */}
      <View style={[styles.xAxisRow, { marginLeft: Y_AXIS_WIDTH }]}>
        {data.map((point, index) => {
          const isVisible = shouldShowLabel(index, data.length);
          if (!isVisible) return null;

          const centerX = index * (barWidth + barSpacing) + barWidth / 2;
          return (
            <View
              key={`xlabel-${index}`}
              style={[
                styles.xAxisLabelWrapper,
                { left: centerX - 14 },
              ]}>
              <Text
                style={[
                  styles.axisLabelText,
                  {
                    color: selectedIndex === index ? theme.colors.primary : theme.colors.onSurfaceVariant,
                    fontWeight: selectedIndex === index ? '700' : '500',
                  },
                ]}>
                {point.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 22,
    padding: 16,
    elevation: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleColumn: {
    justifyContent: 'center',
    flex: 1,
  },
  metricTitleText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitleText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  totalValueText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 24,
  },
  unitText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  tooltipBubble: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  tooltipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chartAreaRow: {
    flexDirection: 'row',
    height: CHART_HEIGHT,
  },
  yAxisColumn: {
    width: Y_AXIS_WIDTH,
    height: CHART_HEIGHT,
    position: 'relative',
  },
  yAxisTickLabel: {
    position: 'absolute',
    right: 6,
    width: Y_AXIS_WIDTH - 6,
    height: 14,
    lineHeight: 14,
    textAlign: 'right',
  },
  plotAreaWrapper: {
    flex: 1,
    height: CHART_HEIGHT,
    position: 'relative',
  },
  barsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    height: CHART_HEIGHT,
  },
  barColumn: {
    position: 'absolute',
    bottom: PLOT_BOTTOM_PADDING,
    height: PLOT_SPAN,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barPill: {
    // animated transform scaleY anchored to baseline
  },
  unavailableNoticeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  unavailableNoticePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    opacity: 0.94,
  },
  unavailableNoticeText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  xAxisRow: {
    height: 22,
    position: 'relative',
    marginTop: 6,
  },
  xAxisLabelWrapper: {
    position: 'absolute',
    top: 0,
    width: 28,
    alignItems: 'center',
  },
  axisLabelText: {
    fontSize: 10.5,
    fontWeight: '500',
  },
});
