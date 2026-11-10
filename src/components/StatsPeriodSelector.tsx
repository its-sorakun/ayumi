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
  PanResponder,
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
      Animated.sequence([
        Animated.timing(stretchXAnim, {
          toValue: MotionTokens.squish.stretchX,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.spring(stretchXAnim, {
          toValue: 1.0,
          ...MotionTokens.spring.snappy,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(compressYAnim, {
          toValue: MotionTokens.squish.compressY,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.spring(compressYAnim, {
          toValue: 1.0,
          ...MotionTokens.spring.snappy,
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(slideAnim, {
        toValue: activeIndex >= 0 ? activeIndex : 1,
        ...MotionTokens.spring.snappy,
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeIndex, slideAnim, stretchXAnim, compressYAnim]);

  // Direct finger dragging across period pills
  const dragStartSlot = useRef(1);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
          Math.abs(gestureState.dx) > 10
        );
      },
      onPanResponderGrant: () => {
        dragStartSlot.current = activeIndex >= 0 ? activeIndex : 1;
        slideAnim.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        if (segmentWidth <= 0) return;
        const slotDelta = gestureState.dx / segmentWidth;
        const rawTarget = dragStartSlot.current + slotDelta;
        const clampedTarget = Math.max(0, Math.min(rawTarget, 2));
        slideAnim.setValue(clampedTarget);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (segmentWidth <= 0) return;
        const slotDelta = gestureState.dx / segmentWidth;
        let targetIndex = dragStartSlot.current;

        if (slotDelta > 0.35 || gestureState.vx > 0.4) {
          targetIndex = Math.min(dragStartSlot.current + 1, 2);
        } else if (slotDelta < -0.35 || gestureState.vx < -0.4) {
          targetIndex = Math.max(dragStartSlot.current - 1, 0);
        }

        onSelectPeriod(PERIODS[targetIndex].type);
      },
    })
  ).current;

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
      onLayout={onLayout}
      {...panResponder.panHandlers}>
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
