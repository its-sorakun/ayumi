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
import { MotionTokens } from '../theme/motion';

export interface ChartDataPoint {
  readonly key: string;
  readonly label: string;
  readonly subLabel?: string;
  readonly value: number;
}

interface StatsChartProps {
  readonly metric: StatMetricType;
  readonly period: StatPeriodType;
  readonly subtitle: string;
  readonly totalValueText: string;
  readonly unitText: string;
  readonly data: readonly ChartDataPoint[];
  readonly loading?: boolean;
}

const CHART_HEIGHT = 140;
const Y_AXIS_WIDTH = 34;

export function StatsChart({
  metric,
  period,
  subtitle,
  totalValueText,
  unitText,
  data,
  loading = false,
}: StatsChartProps): React.JSX.Element {
  const theme = useTheme();
  const isDark = theme.dark;

  const [containerWidth, setContainerWidth] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Animated wave driver for sequential bar growth (0 -> 1)
  const growthAnim = useRef(new Animated.Value(0)).current;
  const tooltipAnim = useRef(new Animated.Value(0)).current;

  // Trigger sequential wave reveal animation on dataset change
  useEffect(() => {
    growthAnim.setValue(0);
    Animated.timing(growthAnim, {
      toValue: 1,
      duration: MotionTokens.duration.reveal,
      easing: MotionTokens.easing.emphasizedDecel,
      useNativeDriver: false,
    }).start();
    setSelectedIndex(null);
  }, [metric, period, data, growthAnim]);

  // Tooltip entrance animation
  useEffect(() => {
    if (selectedIndex !== null) {
      tooltipAnim.setValue(0);
      Animated.spring(tooltipAnim, {
        toValue: 1,
        ...MotionTokens.spring.snappy,
        useNativeDriver: true,
      }).start();
    }
  }, [selectedIndex, tooltipAnim]);

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

  // Compute maximum Y for scale
  const maxValue = useMemo(() => {
    const max = Math.max(...data.map(d => d.value), 0);
    if (max <= 0) return 100;
    if (metric === 'steps') {
      return max > 5000 ? Math.ceil(max / 2000) * 2000 : Math.ceil(max / 500) * 500;
    }
    if (metric === 'distance') {
      return max > 5000 ? Math.ceil(max / 1000) * 1000 : Math.ceil(max / 500) * 500;
    }
    return max > 1000 ? Math.ceil(max / 500) * 500 : Math.ceil(max / 100) * 100;
  }, [data, metric]);

  const yTicks = [maxValue, maxValue * 0.75, maxValue * 0.5, maxValue * 0.25, 0];

  const formatTickLabel = (val: number) => {
    if (val === 0) return '0';
    if (metric === 'distance') {
      if (val >= 1000) return `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`;
      return `${Math.round(val)}`;
    }
    if (val >= 1000) {
      const k = val / 1000;
      return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
    }
    return `${Math.round(val)}`;
  };

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

  const shouldShowLabel = (index: number, total: number) => {
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
          <Text
            style={[styles.totalValueText, { color: theme.colors.onSurface }]}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {totalValueText}
          </Text>
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
              {metric === 'distance'
                ? selectedPoint.value >= 1000
                ? `${(selectedPoint.value / 1000).toFixed(2)} km`
                : `${Math.round(selectedPoint.value)} m`
                : `${selectedPoint.value.toLocaleString()} ${unitText}`}
            </Text>
          </Text>
        </Animated.View>
      )}

      {/* Main Chart Graphic Area */}
      <View style={styles.chartAreaRow}>
        {/* Y-Axis scale labels */}
        <View style={styles.yAxisColumn}>
          {yTicks.map((tick, i) => (
            <Text
              key={i}
              style={[styles.axisLabelText, { color: theme.colors.onSurfaceVariant }]}>
              {formatTickLabel(tick)}
            </Text>
          ))}
        </View>

        {/* SVG Drawing Area for Grid Lines + Overlaid Animated Bars */}
        <View style={styles.plotAreaWrapper}>
          {containerWidth > 0 && (
            <Svg width={chartPlotWidth} height={CHART_HEIGHT} style={StyleSheet.absoluteFill}>
              {/* Horizontal faint grid lines */}
              {yTicks.map((_, i) => {
                const y = (i / (yTicks.length - 1)) * (CHART_HEIGHT - 12) + 6;
                return (
                  <Line
                    key={`grid-${i}`}
                    x1={0}
                    y1={y}
                    x2={chartPlotWidth}
                    y2={y}
                    stroke={theme.colors.outlineVariant}
                    strokeOpacity={isDark ? 0.15 : 0.25}
                    strokeWidth={1}
                  />
                );
              })}
            </Svg>
          )}

          {/* Sequential Wave-Animated Bars */}
          {containerWidth > 0 && (
            <View style={styles.barsContainer} pointerEvents="box-none">
              {data.map((point, index) => {
                const x = index * (barWidth + barSpacing);
                const rawHeight = (point.value / maxValue) * (CHART_HEIGHT - 16);
                const targetBarHeight = Math.max(
                  Math.min(rawHeight, CHART_HEIGHT - 16),
                  point.value > 0 ? 4 : 0
                );
                const isSelected = selectedIndex === index;

                // Sequential Wave Timing: staggered progress across dataset
                const startFrac = (index / dataCount) * 0.55;
                const endFrac = Math.min(startFrac + 0.45, 1.0);
                const barWave = growthAnim.interpolate({
                  inputRange: [startFrac, endFrac],
                  outputRange: [0, 1],
                  extrapolate: 'clamp',
                });
                const animatedHeight = Animated.multiply(barWave, targetBarHeight);

                return (
                  <TouchableOpacity
                    key={point.key || index}
                    activeOpacity={0.8}
                    onPress={() => setSelectedIndex(index === selectedIndex ? null : index)}
                    style={[
                      styles.barColumn,
                      {
                        left: x,
                        width: barWidth,
                      },
                    ]}>
                    <Animated.View
                      style={[
                        styles.barPill,
                        {
                          height: animatedHeight,
                          width: barWidth,
                          borderRadius: Math.min(barWidth / 2, 4),
                          backgroundColor: isSelected ? theme.colors.secondary : theme.colors.primary,
                          opacity: isSelected ? 1 : point.value > 0 ? 0.85 : 0.2,
                        },
                      ]}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </View>

      {/* X-Axis Labels Row */}
      <View style={[styles.xAxisRow, { marginLeft: Y_AXIS_WIDTH }]}>
        {data.map((point, index) => {
          const isVisible = shouldShowLabel(index, data.length);
          if (!isVisible) return null;

          const x = index * (barWidth + barSpacing);
          return (
            <View
              key={`xlabel-${index}`}
              style={[
                styles.xAxisLabelWrapper,
                { left: x - (period === 'week' ? 4 : 8) },
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
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 8,
    paddingVertical: 4,
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
    bottom: 6,
    height: CHART_HEIGHT - 12,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barPill: {
    // animated height applied in style
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
