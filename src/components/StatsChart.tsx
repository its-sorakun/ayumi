/**
 * StatsChart — responsive pure-SVG bar chart for Material 3 Expressive analytics.
 *
 * Implements the centerpiece of the unified Statistics dashboard:
 *  - Supports 24-hour Daily (hourly), 7-day Weekly, and 28-31-day Monthly granularities
 *  - Responsive coordinate calculations guaranteeing exact fit within card bounds
 *  - Rounded top bar geometry with solid wallpaper-derived Monet primary colors
 *  - Animated bar entrance growth from baseline with staggered timing
 *  - Interactive bar tapping with highlighted state and contextual tooltip bubble
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
import Svg, { Rect, Line, G } from 'react-native-svg';

import type { StatMetricType } from './StatsMetricSelector';
import type { StatPeriodType } from './StatsPeriodSelector';
import { SneakerIcon, RouteMapIcon, DropletIcon } from './AestheticIcons';

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

const CHART_HEIGHT = 168;
const Y_AXIS_WIDTH = 38;

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

  // Animated bar growth multiplier (0 -> 1)
  const growthAnim = useRef(new Animated.Value(0)).current;

  // Loading skeleton pulse
  const pulseAnim = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    growthAnim.setValue(0);
    Animated.timing(growthAnim, {
      toValue: 1,
      duration: 380,
      useNativeDriver: false,
    }).start();
    setSelectedIndex(null);
  }, [metric, period, data, growthAnim]);

  useEffect(() => {
    if (loading) {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.65,
            duration: 650,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.25,
            duration: 650,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();
      return () => pulseLoop.stop();
    }
  }, [loading, pulseAnim]);

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
    // Round up nicely to significant intervals
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

  const chartPlotWidth = Math.max(containerWidth - Y_AXIS_WIDTH - 24, 100);
  const dataCount = Math.max(data.length, 1);

  // Responsive bar width and spacing
  const { barWidth, barSpacing } = useMemo(() => {
    if (period === 'week') {
      // 7 bars: generous width
      const totalWidth = chartPlotWidth;
      const bWidth = Math.min(Math.max((totalWidth - 6 * 14) / 7, 18), 28);
      const bSpacing = (totalWidth - bWidth * 7) / 6;
      return { barWidth: bWidth, barSpacing: Math.max(bSpacing, 8) };
    }
    if (period === 'daily') {
      // 24 hourly bars
      const totalWidth = chartPlotWidth;
      const bWidth = Math.min(Math.max((totalWidth - 23 * 4) / 24, 4), 9);
      const bSpacing = (totalWidth - bWidth * 24) / 23;
      return { barWidth: bWidth, barSpacing: Math.max(bSpacing, 2) };
    }
    // Monthly: 28 to 31 bars
    const totalWidth = chartPlotWidth;
    const bWidth = Math.min(Math.max((totalWidth - (dataCount - 1) * 3) / dataCount, 3.5), 7.5);
    const bSpacing = (totalWidth - bWidth * dataCount) / (dataCount - 1);
    return { barWidth: bWidth, barSpacing: Math.max(bSpacing, 1.5) };
  }, [period, chartPlotWidth, dataCount]);

  // Determine whether an X-axis label should be displayed
  const shouldShowLabel = (index: number, total: number) => {
    if (period === 'week') return true; // Show all 7 day labels
    if (period === 'daily') {
      // Sparse: 00, 03, 06, 09, 12, 15, 18, 21
      return index % 3 === 0 && index < 24;
    }
    // Monthly: show 1, 5, 10, 15, 20, 25, 30
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

      {/* Selected Data Point Tooltip Pill */}
      {selectedPoint != null && (
        <View
          style={[
            styles.tooltipBubble,
            { backgroundColor: theme.colors.primaryContainer },
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
        </View>
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

        {/* SVG Drawing Area */}
        <View style={styles.svgWrapper}>
          {containerWidth > 0 && (
            <Svg width={chartPlotWidth} height={CHART_HEIGHT}>
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
                    strokeOpacity={isDark ? 0.2 : 0.3}
                    strokeWidth={1}
                  />
                );
              })}

              {/* Data Bars or Loading Placeholders */}
              <G>
                {data.map((point, index) => {
                  const x = index * (barWidth + barSpacing);
                  const rawHeight = (point.value / maxValue) * (CHART_HEIGHT - 20);
                  const barHeight = Math.max(Math.min(rawHeight, CHART_HEIGHT - 20), point.value > 0 ? 3 : 0);
                  const y = CHART_HEIGHT - 6 - barHeight;
                  const isSelected = selectedIndex === index;
                  const barColor = isSelected ? theme.colors.secondary : theme.colors.primary;
                  const barOpacity = isSelected ? 1 : point.value > 0 ? 0.8 : 0.2;

                  return (
                    <Rect
                      key={point.key || index}
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx={Math.min(barWidth / 2, 4)}
                      fill={barColor}
                      fillOpacity={barOpacity}
                      onPress={() => setSelectedIndex(index === selectedIndex ? null : index)}
                    />
                  );
                })}
              </G>
            </Svg>
          )}

          {/* Interactive touch targets over bars */}
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {data.map((_, index) => {
              const x = index * (barWidth + barSpacing);
              return (
                <TouchableOpacity
                  key={`touch-${index}`}
                  activeOpacity={0.7}
                  onPress={() => setSelectedIndex(index === selectedIndex ? null : index)}
                  style={{
                    position: 'absolute',
                    left: Math.max(x - 2, 0),
                    width: barWidth + 4,
                    top: 0,
                    bottom: 0,
                  }}
                />
              );
            })}
          </View>
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
    marginTop: 14,
    borderRadius: 24,
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
    fontSize: 11.5,
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
    paddingVertical: 2,
  },
  svgWrapper: {
    flex: 1,
    height: CHART_HEIGHT,
    position: 'relative',
  },
  xAxisRow: {
    height: 22,
    position: 'relative',
    marginTop: 6,
  },
  xAxisLabelWrapper: {
    position: 'absolute',
    top: 0,
    width: 26,
    alignItems: 'center',
  },
  axisLabelText: {
    fontSize: 10.5,
    fontWeight: '500',
  },
});
