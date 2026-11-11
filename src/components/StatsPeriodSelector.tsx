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
  Animated,
  LayoutChangeEvent,
  PanResponder,
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

const CONTAINER_HEIGHT = 42;
const PADDING = 4;
const TAP_SLOP_PX = 10;

export function StatsPeriodSelector({
  selectedPeriod,
  onSelectPeriod,
}: StatsPeriodSelectorProps): React.JSX.Element {
  const theme = useTheme();
  const isDark = theme.dark;

  const [containerWidth, setContainerWidth] = useState(0);
  const activeIndex = Math.max(PERIODS.findIndex(p => p.type === selectedPeriod), 0);

  const slideAnim = useRef(new Animated.Value(activeIndex)).current;
  const stretchXAnim = useRef(new Animated.Value(1)).current;
  const compressYAnim = useRef(new Animated.Value(1)).current;
  const pressScaleAnim = useRef(new Animated.Value(1)).current;

  const containerWidthRef = useRef(0);
  const activeIndexRef = useRef(activeIndex);
  const onSelectRef = useRef(onSelectPeriod);
  activeIndexRef.current = activeIndex;
  onSelectRef.current = onSelectPeriod;

  const pressLocalXRef = useRef(0);
  const dragStartSlotRef = useRef(activeIndex);
  const isHorizontalDragRef = useRef(false);
  const skipNextEffectAnimRef = useRef(false);

  const segmentWidth = containerWidth > 0 ? (containerWidth - PADDING * 2) / 3 : 0;

  const resetCapsuleShape = () => {
    Animated.parallel([
      Animated.spring(stretchXAnim, {
        toValue: 1,
        stiffness: 310,
        damping: 26,
        useNativeDriver: true,
      }),
      Animated.spring(compressYAnim, {
        toValue: 1,
        stiffness: 310,
        damping: 26,
        useNativeDriver: true,
      }),
      Animated.spring(pressScaleAnim, {
        toValue: 1,
        stiffness: 320,
        damping: 24,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Distinct segmented capsule motion: taut, disciplined critically-damped glide with minimal squish
  useEffect(() => {
    if (skipNextEffectAnimRef.current) {
      skipNextEffectAnimRef.current = false;
      return;
    }

    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: activeIndex,
        stiffness: 290,
        damping: 26,
        mass: 0.72,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(pressScaleAnim, {
          toValue: 0.96,
          duration: 70,
          useNativeDriver: true,
        }),
        Animated.spring(pressScaleAnim, {
          toValue: 1,
          stiffness: 320,
          damping: 24,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [activeIndex, slideAnim, pressScaleAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onShouldBlockNativeResponder: () => false,
      onPanResponderTerminationRequest: () => !isHorizontalDragRef.current,

      onPanResponderGrant: evt => {
        pressLocalXRef.current = evt.nativeEvent.locationX;
        isHorizontalDragRef.current = false;
        dragStartSlotRef.current = activeIndexRef.current;
        slideAnim.stopAnimation(currentVal => {
          dragStartSlotRef.current = currentVal;
        });

        Animated.timing(pressScaleAnim, {
          toValue: 0.96,
          duration: 70,
          useNativeDriver: true,
        }).start();
      },

      onPanResponderMove: (_, gestureState) => {
        const width = containerWidthRef.current;
        if (width <= 0) return;

        const { dx, dy, vx } = gestureState;
        if (!isHorizontalDragRef.current) {
          if (Math.abs(dx) > TAP_SLOP_PX && Math.abs(dx) > Math.abs(dy) * 1.15) {
            isHorizontalDragRef.current = true;
            Animated.timing(pressScaleAnim, {
              toValue: 1,
              duration: 75,
              useNativeDriver: true,
            }).start();
          } else {
            return;
          }
        }

        const segW = Math.max((width - PADDING * 2) / 3, 1);
        const rawSlot = dragStartSlotRef.current + dx / segW;
        // Strict hard-bounded track prevents pill indicator from clipping outside capsule ends
        const clampedSlot = Math.min(Math.max(rawSlot, 0), 2);
        slideAnim.setValue(clampedSlot);

        const stretchFactor = Math.min(
          Math.abs(vx) * 0.045 + Math.min(Math.abs(dx) / segW, 1) * 0.035,
          0.07
        );
        stretchXAnim.setValue(1 + stretchFactor);
        compressYAnim.setValue(1 - stretchFactor * 0.75);
      },

      onPanResponderRelease: (_, gestureState) => {
        const width = containerWidthRef.current;

        if (!isHorizontalDragRef.current) {
          if (width > 0 && Math.abs(gestureState.dx) <= TAP_SLOP_PX * 1.4) {
            const innerX = Math.min(Math.max(pressLocalXRef.current - PADDING, 0), Math.max(width - PADDING * 2, 1));
            const segW = Math.max((width - PADDING * 2) / 3, 1);
            const tappedSlot = Math.min(Math.max(Math.floor(innerX / segW), 0), 2);
            onSelectRef.current(PERIODS[tappedSlot].type);
          } else {
            Animated.spring(slideAnim, {
              toValue: activeIndexRef.current,
              stiffness: 290,
              damping: 26,
              useNativeDriver: true,
            }).start();
          }
          resetCapsuleShape();
          return;
        }

        const segW = Math.max((width - PADDING * 2) / 3, 1);
        const rawSlot = dragStartSlotRef.current + gestureState.dx / segW;
        let targetSlot = Math.round(rawSlot);
        if (gestureState.vx > 0.32) {
          targetSlot = Math.ceil(rawSlot);
        } else if (gestureState.vx < -0.32) {
          targetSlot = Math.floor(rawSlot);
        }
        targetSlot = Math.min(Math.max(targetSlot, 0), 2);

        const swipeVelocitySlots = Math.max(Math.min((gestureState.vx / segW) * 1000, 10), -10);
        if (targetSlot !== activeIndexRef.current) {
          skipNextEffectAnimRef.current = true;
          onSelectRef.current(PERIODS[targetSlot].type);
        }

        Animated.parallel([
          Animated.spring(slideAnim, {
            toValue: targetSlot,
            velocity: swipeVelocitySlots,
            stiffness: 290,
            damping: 26,
            mass: 0.72,
            useNativeDriver: true,
          }),
          Animated.spring(stretchXAnim, {
            toValue: 1,
            stiffness: 310,
            damping: 26,
            useNativeDriver: true,
          }),
          Animated.spring(compressYAnim, {
            toValue: 1,
            stiffness: 310,
            damping: 26,
            useNativeDriver: true,
          }),
          Animated.spring(pressScaleAnim, {
            toValue: 1,
            stiffness: 320,
            damping: 24,
            useNativeDriver: true,
          }),
        ]).start();
      },

      onPanResponderTerminate: () => {
        isHorizontalDragRef.current = false;
        Animated.spring(slideAnim, {
          toValue: activeIndexRef.current,
          stiffness: 290,
          damping: 26,
          useNativeDriver: true,
        }).start();
        resetCapsuleShape();
      },
    })
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    containerWidthRef.current = w;
    setContainerWidth(w);
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
      accessibilityRole="tablist"
      {...panResponder.panHandlers}>
      {segmentWidth > 0 && (
        <View style={styles.trackClip} pointerEvents="none">
          <Animated.View
            style={[
              styles.activeIndicator,
              {
                width: segmentWidth,
                backgroundColor: theme.colors.primary,
                transform: [
                  { translateX },
                  { scaleX: Animated.multiply(stretchXAnim, pressScaleAnim) },
                  { scaleY: Animated.multiply(compressYAnim, pressScaleAnim) },
                ],
              },
            ]}
          />
        </View>
      )}

      <View style={styles.labelsRow} pointerEvents="none">
        {PERIODS.map(period => {
          const isSelected = selectedPeriod === period.type;
          const textColor = isSelected
            ? theme.colors.onPrimary
            : theme.colors.onSurfaceVariant;

          return (
            <View key={period.type} style={styles.segmentButton}>
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
            </View>
          );
        })}
      </View>
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
    overflow: 'hidden',
    elevation: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
  },
  trackClip: {
    position: 'absolute',
    left: PADDING,
    right: PADDING,
    top: PADDING,
    bottom: PADDING,
    borderRadius: (CONTAINER_HEIGHT - PADDING * 2) / 2,
    overflow: 'hidden',
    zIndex: 1,
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: (CONTAINER_HEIGHT - PADDING * 2) / 2,
    elevation: 2,
  },
  labelsRow: {
    flex: 1,
    flexDirection: 'row',
    height: '100%',
    zIndex: 2,
  },
  segmentButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: 13,
    letterSpacing: -0.1,
  },
});
