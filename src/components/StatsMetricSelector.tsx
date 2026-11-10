/**
 * StatsMetricSelector — three-segment expressive metric selector.
 *
 * Implements the horizontal metric selection tabs for the unified Stats screen:
 *  - Steps, Distance, and Water options
 *  - Dynamic Material You tonal container highlighting for selected metric
 *  - Responsive touch targets with smooth scale/opacity tactile feedback
 *  - Coherent typography and icon colors adapting cleanly to light/dark themes
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { SneakerIcon, RouteMapIcon, DropletIcon } from './AestheticIcons';

export type StatMetricType = 'steps' | 'distance' | 'water';

interface StatsMetricSelectorProps {
  readonly selectedMetric: StatMetricType;
  readonly onSelectMetric: (metric: StatMetricType) => void;
}

interface MetricItemConfig {
  readonly type: StatMetricType;
  readonly label: string;
  readonly renderIcon: (color: string) => React.ReactNode;
}

const METRICS: readonly MetricItemConfig[] = [
  {
    type: 'steps',
    label: 'Steps',
    renderIcon: (color: string) => <SneakerIcon size={24} color={color} />,
  },
  {
    type: 'distance',
    label: 'Distance',
    renderIcon: (color: string) => <RouteMapIcon size={24} color={color} />,
  },
  {
    type: 'water',
    label: 'Water',
    renderIcon: (color: string) => <DropletIcon size={24} color={color} />,
  },
];

export function StatsMetricSelector({
  selectedMetric,
  onSelectMetric,
}: StatsMetricSelectorProps): React.JSX.Element {
  const theme = useTheme();
  const isDark = theme.dark;

  return (
    <View style={styles.container}>
      {METRICS.map(metric => {
        const isSelected = selectedMetric === metric.type;
        const iconColor = isSelected ? theme.colors.primary : theme.colors.onSurfaceVariant;
        const textColor = isSelected ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant;
        const bgColor = isSelected
          ? theme.colors.primaryContainer
          : isDark
            ? theme.colors.elevation.level1
            : theme.colors.surface;

        return (
          <TouchableOpacity
            key={metric.type}
            activeOpacity={0.78}
            onPress={() => onSelectMetric(metric.type)}
            style={[
              styles.card,
              {
                backgroundColor: bgColor,
                borderWidth: isDark && !isSelected ? 1 : 0,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
              },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${metric.label} metric`}>
            <View style={styles.iconWrapper}>
              {metric.renderIcon(iconColor)}
            </View>
            <Text
              style={[
                styles.label,
                {
                  color: textColor,
                  fontWeight: isSelected ? '700' : '500',
                },
              ]}>
              {metric.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 14,
  },
  card: {
    flex: 1,
    height: 78,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    elevation: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
  },
  iconWrapper: {
    marginBottom: 4,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    letterSpacing: -0.2,
  },
});
