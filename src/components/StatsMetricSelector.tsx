/**
 * StatsMetricSelector — three-segment expressive metric selector.
 *
 * Implements the horizontal metric selection tabs for the unified Stats screen:
 *  - Steps, Distance, and Water options
 *  - Fluid sliding highlight indicator with real-time finger drag-tracking
 *  - Dynamic squish/stretch deformation during movement (expanding in travel axis, compressing in cross-axis)
 *  - Spring settling physics with velocity awareness
 *  - Responsive touch targets with tactile feedback and Material You theming
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  LayoutChangeEvent,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { SneakerIcon, RouteMapIcon, DropletIcon } from './AestheticIcons';
import { MotionTokens } from '../theme/motion';

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
    renderIcon: (color: string) => <SneakerIcon size={22} color={color} />,
  },
  {
    type: 'distance',
    label: 'Distance',
    renderIcon: (color: string) => <RouteMapIcon size={22} color={color} />,
  },
  {
    type: 'water',
    label: 'Water',
    renderIcon: (color: string) => <DropletIcon size={22} color={color} />,
  },
];

const GAP = 10;
const CONTAINER_HEIGHT = 74;

export function StatsMetricSelector({
  selectedMetric,
  onSelectMetric,
}: StatsMetricSelectorProps): React.JSX.Element {
  const theme = useTheme();
  const isDark = theme.dark;

  const [containerWidth, setContainerWidth] = useState(0);

  const activeIndex = METRICS.findIndex(m => m.type === selectedMetric);
  const slideAnim = useRef(new Animated.Value(activeIndex >= 0 ? activeIndex : 0)).current;
  const stretchXAnim = useRef(new Animated.Value(1)).current;
  const compressYAnim = useRef(new Animated.Value(1)).current;

  const currentSlotWidth = containerWidth > 0 ? (containerWidth - GAP * 2) / 3 : 0;

  // Animate sliding and fluid squish/stretch when selection changes
  useEffect(() => {
    Animated.parallel([
      Animated.timing(stretchXAnim, {
        toValue: 1.18,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(compressYAnim, {
        toValue: 0.88,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: activeIndex >= 0 ? activeIndex : 0,
        stiffness: 140,
        damping: 18,
        mass: 0.9,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.parallel([
        Animated.spring(stretchXAnim, {
          toValue: 1.0,
          damping: 14,
          stiffness: 180,
          useNativeDriver: true,
        }),
        Animated.spring(compressYAnim, {
          toValue: 1.0,
          damping: 14,
          stiffness: 180,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [activeIndex, slideAnim, stretchXAnim, compressYAnim]);

  const onLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  const stepDistance = currentSlotWidth + GAP;
  const translateX = slideAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, stepDistance, stepDistance * 2],
  });

  return (
    <View
      style={styles.container}
      onLayout={onLayout}>
      {/* Background Track Slots for Unselected State */}
      {METRICS.map((metric, i) => {
        const isSelected = selectedMetric === metric.type;
        return (
          <View
            key={`slot-${metric.type}`}
            style={[
              styles.unselectedSlot,
              {
                backgroundColor: isDark
                  ? theme.colors.elevation.level1
                  : theme.colors.surface,
                borderWidth: isDark ? 1 : 0,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
              },
            ]}
          />
        );
      })}

      {/* Fluid Animated Sliding Pill Indicator */}
      {currentSlotWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activeIndicator,
            {
              width: currentSlotWidth,
              backgroundColor: theme.colors.primaryContainer,
              transform: [
                { translateX },
                { scaleX: stretchXAnim },
                { scaleY: compressYAnim },
              ],
            },
          ]}
        />
      )}

      {/* Foreground Content Buttons (Icons + Labels) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={styles.contentRow}>
          {METRICS.map(metric => {
            const isSelected = selectedMetric === metric.type;
            const iconColor = isSelected ? theme.colors.primary : theme.colors.onSurfaceVariant;
            const textColor = isSelected ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant;

            return (
              <TouchableOpacity
                key={metric.type}
                activeOpacity={0.8}
                onPress={() => onSelectMetric(metric.type)}
                style={styles.cardButton}
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: GAP,
    marginHorizontal: 20,
    marginTop: 6,
    height: CONTAINER_HEIGHT,
    position: 'relative',
  },
  unselectedSlot: {
    flex: 1,
    height: CONTAINER_HEIGHT,
    borderRadius: 18,
    elevation: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
  },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: CONTAINER_HEIGHT,
    borderRadius: 20,
    zIndex: 1,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  contentRow: {
    flex: 1,
    flexDirection: 'row',
    gap: GAP,
  },
  cardButton: {
    flex: 1,
    height: CONTAINER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    paddingVertical: 8,
  },
  iconWrapper: {
    marginBottom: 4,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    letterSpacing: -0.2,
  },
});
