/**
 * StatsPeriodSelector — animated three-segment pill selector.
 *
 * Implements the Week / Daily / Month time-aggregation control:
 *  - Continuous rounded capsule container
 *  - Animated sliding indicator pill with spring interpolation
 *  - Clear contrast typography adapting to Material You primary roles
 *  - Independent state preserved during metric switching
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

export function StatsPeriodSelector({
  selectedPeriod,
  onSelectPeriod,
}: StatsPeriodSelectorProps): React.JSX.Element {
  const theme = useTheme();
  const isDark = theme.dark;

  const [containerWidth, setContainerWidth] = useState(0);
  const slideAnim = useRef(new Animated.Value(1)).current; // default to 'daily' (index 1)

  const activeIndex = PERIODS.findIndex(p => p.type === selectedPeriod);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: activeIndex >= 0 ? activeIndex : 1,
      damping: 20,
      stiffness: 180,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, slideAnim]);

  const onLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  const segmentWidth = containerWidth > 0 ? (containerWidth - 8) / 3 : 0;

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
          style={[
            styles.activeIndicator,
            {
              width: segmentWidth,
              backgroundColor: theme.colors.primary,
              transform: [{ translateX }],
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
    height: 46,
    borderRadius: 23,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 4,
    position: 'relative',
    alignItems: 'center',
    elevation: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
  },
  activeIndicator: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: 19,
    zIndex: 1,
  },
  segmentButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  segmentText: {
    fontSize: 13.5,
    letterSpacing: -0.1,
  },
});
