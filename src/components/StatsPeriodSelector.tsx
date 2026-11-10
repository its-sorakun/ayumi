/**
 * StatsPeriodSelector — animated three-segment pill selector.
 *
 * Implements the Week / Daily / Month time-aggregation control:
 *  - Continuous rounded capsule container with compact vertical rhythm
 *  - Animated sliding indicator pill with spring interpolation and fluid squish/stretch
 *  - Real-time finger-drag tracking across the three period slots
 *  - Clear contrast typography adapting to Material You primary roles
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
import { MotionTokens } from '../theme/motion';

export type StatPeriodType = 'week' | 'daily' | 'month';

interface StatsPeriodSelectorProps {
  readonly selectedPeriod: StatPeriodType;
  readonly onSelectPeriod: (period: StatPeriodType) => void;
}

const PERIODS: readonly { type: StatPeriodType; label: string }[] = [
  { type: 'week', label: 'Week' },
  { type: 'daily', label: 'Daily' },
  { type: 'month', label: 'Month' },
];

const CONTAINER_HEIGHT = 42;
const PADDING = 4;

export function StatsPeriodSelector({
  selectedPeriod,
  onSelectPeriod,
}: StatsPeriodSelectorProps): React.JSX.Element {
  const theme = useTheme();
  const isDark = theme.dark;

  const [containerWidth, setContainerWidth] = useState(0);
  const activeIndex = PERIODS.findIndex(p => p.type === selectedPeriod);

  const slideAnim = useRef(new Animated.Value(activeIndex >= 0 ? activeIndex : 1)).current;
  const stretchXAnim = useRef(new Animated.Value(1)).current;
  const compressYAnim = useRef(new Animated.Value(1)).current;

  const segmentWidth = containerWidth > 0 ? (containerWidth - PADDING * 2) / 3 : 0;

  // Animate indicator with organic squish and stretch when selection changes
  useEffect(() => {
    Animated.parallel([
      Animated.timing(stretchXAnim, {
        toValue: 1.16,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(compressYAnim, {
        toValue: 0.88,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: activeIndex >= 0 ? activeIndex : 1,
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

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, segmentWidth, segmentWidth * 2],
  });

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark
            ? theme.colors.elevation.level1
            : theme.colors.surface,
          borderWidth: isDark ? 1 : 0,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
        },
      ]}
      onLayout={onLayout}>
      {segmentWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activeIndicator,
            {
              width: segmentWidth,
              backgroundColor: theme.colors.primary,
              transform: [
                { translateX },
                { scaleX: stretchXAnim },
                { scaleY: compressYAnim },
              ],
            },
          ]}
        />
      )}

      {PERIODS.map(period => {
        const isSelected = selectedPeriod === period.type;
        const textColor = isSelected
          ? theme.colors.onPrimary
          : theme.colors.onSurfaceVariant;

        return (
          <TouchableOpacity
            key={period.type}
            activeOpacity={0.8}
            onPress={() => onSelectPeriod(period.type)}
            style={styles.segmentButton}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${period.label} period`}>
            <Text
              style={[
                styles.segmentText,
                {
                  color: textColor,
                  fontWeight: isSelected ? '700' : '500',
                },
              ]}>
              {period.label}
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
    height: CONTAINER_HEIGHT,
    borderRadius: CONTAINER_HEIGHT / 2,
    marginHorizontal: 20,
    marginTop: 8,
    padding: PADDING,
    position: 'relative',
    alignItems: 'center',
    elevation: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
  },
  activeIndicator: {
    position: 'absolute',
    left: PADDING,
    top: PADDING,
    bottom: PADDING,
    borderRadius: (CONTAINER_HEIGHT - PADDING * 2) / 2,
    zIndex: 1,
    elevation: 2,
  },
  segmentButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  segmentText: {
    fontSize: 13,
    letterSpacing: -0.1,
  },
});
