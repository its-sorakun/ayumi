/**
 * StatsPeriodSelector — animated three-segment pill selector.
 *
 * Implements the Week / Daily / Month time-aggregation control:
 *  - Continuous rounded capsule container with compact vertical rhythm
 *  - Animated sliding indicator pill with spring interpolation and fluid squish/stretch
 *  - Real-time finger-drag tracking across the three period slots
 *  - Clear contrast typography adapting to Material You primary roles
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  LayoutChangeEvent,
  PanResponder,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useReducedMotion } from '../theme/motion';
import { useAyumiTheme } from '../themes';

export type StatPeriodType = 'week' | 'daily' | 'month';

interface StatsPeriodSelectorProps {
  readonly selectedPeriod: StatPeriodType;
  readonly onSelectPeriod: (period: StatPeriodType) => void;
  readonly accentColor?: string;
  readonly onAccentColor?: string;
  readonly containerHeight?: number;
  readonly marginTop?: number;
}

const DEFAULT_PERIODS: readonly { type: StatPeriodType; label: string }[] = [
  { type: 'week', label: 'Week' },
  { type: 'daily', label: 'Daily' },
  { type: 'month', label: 'Month' },
];

const OEM_PERIODS: readonly { type: StatPeriodType; label: string }[] = [
  { type: 'daily', label: 'Day' },
  { type: 'week', label: 'Week' },
  { type: 'month', label: 'Month' },
];

const CONTAINER_HEIGHT = 42;
const PADDING = 4;
const TAP_SLOP_PX = 10;

export function StatsPeriodSelector({
  selectedPeriod,
  onSelectPeriod,
  accentColor,
  onAccentColor,
  containerHeight = CONTAINER_HEIGHT,
  marginTop = 8,
}: StatsPeriodSelectorProps): React.JSX.Element {
  const outerRadius = containerHeight / 2;
  const innerRadius = (containerHeight - PADDING * 2) / 2;
  const theme = useTheme();
  const isDark = theme.dark;
  const reducedMotion = useReducedMotion();
  const { motion, surfaces, resolveCardBorder, resolveCardSurface } = useAyumiTheme();
  const activePeriods =
    surfaces.metricSelectorVariant === 'horizontal_pills'
      ? OEM_PERIODS
      : DEFAULT_PERIODS;
  const cardBorder = resolveCardBorder();
  const activeColor = accentColor ?? theme.colors.primary;
  const onActiveColor = onAccentColor ?? theme.colors.onPrimary;

  const [containerWidth, setContainerWidth] = useState(0);
  const activeIndex = Math.max(activePeriods.findIndex(p => p.type === selectedPeriod), 0);

  const slideAnim = useRef(new Animated.Value(activeIndex)).current;
  const stretchXAnim = useRef(new Animated.Value(1)).current;
  const compressYAnim = useRef(new Animated.Value(1)).current;
  const leanXAnim = useRef(new Animated.Value(0)).current;
  const pressScaleAnim = useRef(new Animated.Value(1)).current;

  const containerWidthRef = useRef(0);
  const activeIndexRef = useRef(activeIndex);
  const prevActiveIndexRef = useRef(activeIndex);
  const onSelectRef = useRef(onSelectPeriod);
  const reducedMotionRef = useRef(reducedMotion);
  const motionRef = useRef(motion);
  const periodsRef = useRef(activePeriods);
  activeIndexRef.current = activeIndex;
  onSelectRef.current = onSelectPeriod;
  reducedMotionRef.current = reducedMotion;
  motionRef.current = motion;
  periodsRef.current = activePeriods;

  const pressLocalXRef = useRef(0);
  const dragStartSlotRef = useRef(activeIndex);
  const isHorizontalDragRef = useRef(false);
  const skipNextEffectAnimRef = useRef(false);

  const segmentWidth = containerWidth > 0 ? (containerWidth - PADDING * 2) / 3 : 0;

  const resetCapsuleShape = useCallback(() => {
    const reduced = reducedMotionRef.current;
    const capsuleSpring = motionRef.current.spring.periodCapsule;
    const settleStiffness = reduced ? 380 : capsuleSpring.stiffness;
    const settleDamping = reduced ? 36 : capsuleSpring.damping;
    Animated.parallel([
      Animated.spring(stretchXAnim, {
        toValue: 1,
        stiffness: settleStiffness,
        damping: settleDamping,
        useNativeDriver: true,
      }),
      Animated.spring(compressYAnim, {
        toValue: 1,
        stiffness: settleStiffness,
        damping: settleDamping,
        useNativeDriver: true,
      }),
      Animated.spring(leanXAnim, {
        toValue: 0,
        stiffness: settleStiffness,
        damping: settleDamping,
        useNativeDriver: true,
      }),
      Animated.spring(pressScaleAnim, {
        toValue: 1,
        stiffness: 280,
        damping: 20,
        useNativeDriver: true,
      }),
    ]).start();
  }, [stretchXAnim, compressYAnim, leanXAnim, pressScaleAnim]);

  // Viscous liquid-capsule motion: streamlined compression and taut surge inside trackClip,
  // deliberately crisper and less bouncy than the metric card leaps.
  useEffect(() => {
    const prevIdx = prevActiveIndexRef.current;
    prevActiveIndexRef.current = activeIndex;

    if (skipNextEffectAnimRef.current) {
      skipNextEffectAnimRef.current = false;
      return;
    }

    if (reducedMotion) {
      stretchXAnim.setValue(1);
      compressYAnim.setValue(1);
      leanXAnim.setValue(0);
      pressScaleAnim.setValue(1);
      Animated.timing(slideAnim, {
        toValue: activeIndex,
        duration: 110,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
      return;
    }

    const deltaSlots = activeIndex - prevIdx;
    const dir = Math.sign(deltaSlots) || 1;
    const jumpDistance = Math.abs(deltaSlots);
    if (jumpDistance === 0) {
      return;
    }

    const peakStretch = jumpDistance >= 2 ? 1.25 : 1.18;
    const peakCompress = jumpDistance >= 2 ? 0.80 : 0.84;

    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: activeIndex,
        ...motion.spring.periodCapsule,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.parallel([
          Animated.timing(stretchXAnim, {
            toValue: 0.92,
            duration: 45,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(compressYAnim, {
            toValue: 1.03,
            duration: 45,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(stretchXAnim, {
            toValue: peakStretch,
            duration: 85,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(compressYAnim, {
            toValue: peakCompress,
            duration: 85,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(leanXAnim, {
            toValue: -dir * (jumpDistance >= 2 ? 7 : 4.5),
            duration: 85,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.spring(stretchXAnim, {
            toValue: 1,
            stiffness: 240,
            damping: 16,
            useNativeDriver: true,
          }),
          Animated.spring(compressYAnim, {
            toValue: 1,
            stiffness: 240,
            damping: 16,
            useNativeDriver: true,
          }),
          Animated.spring(leanXAnim, {
            toValue: 0,
            stiffness: 240,
            damping: 17,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, [
    activeIndex,
    reducedMotion,
    slideAnim,
    stretchXAnim,
    compressYAnim,
    leanXAnim,
    pressScaleAnim,
    motion.spring.periodCapsule,
  ]);

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

        if (reducedMotionRef.current) {
          stretchXAnim.setValue(1);
          compressYAnim.setValue(1);
          leanXAnim.setValue(0);
        } else {
          const wrappedFrac = clampedSlot % 1;
          const midStretch = Math.sin(Math.PI * wrappedFrac) * 0.12;
          const velocityBoost = Math.min(Math.abs(vx) * 0.11, 0.13);
          const stretchFactor = Math.min(midStretch + velocityBoost, 0.24);
          const dragDir = vx !== 0 ? Math.sign(vx) : Math.sign(dx);
          stretchXAnim.setValue(1 + stretchFactor);
          compressYAnim.setValue(1 - stretchFactor * 0.76);
          leanXAnim.setValue(-dragDir * Math.min(Math.abs(vx) * 5 + stretchFactor * 16, 9));
        }
      },

      onPanResponderRelease: (_, gestureState) => {
        const width = containerWidthRef.current;

        if (!isHorizontalDragRef.current) {
          if (width > 0 && Math.abs(gestureState.dx) <= TAP_SLOP_PX * 1.4) {
            const innerX = Math.min(Math.max(pressLocalXRef.current - PADDING, 0), Math.max(width - PADDING * 2, 1));
            const segW = Math.max((width - PADDING * 2) / 3, 1);
            const tappedSlot = Math.min(Math.max(Math.floor(innerX / segW), 0), 2);
            if (tappedSlot !== activeIndexRef.current) {
              onSelectRef.current(periodsRef.current[tappedSlot].type);
            }
          } else {
            Animated.spring(slideAnim, {
              toValue: activeIndexRef.current,
              ...motionRef.current.spring.periodCapsule,
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
          onSelectRef.current(periodsRef.current[targetSlot].type);
        }

        const reduced = reducedMotionRef.current;
        const capsuleSpring = motionRef.current.spring.periodCapsule;
        Animated.parallel([
          Animated.spring(slideAnim, {
            toValue: targetSlot,
            velocity: swipeVelocitySlots,
            stiffness: reduced ? 360 : capsuleSpring.stiffness,
            damping: reduced ? 34 : capsuleSpring.damping,
            mass: capsuleSpring.mass,
            useNativeDriver: true,
          }),
          Animated.spring(stretchXAnim, {
            toValue: 1,
            stiffness: reduced ? 380 : 240,
            damping: reduced ? 36 : 16,
            useNativeDriver: true,
          }),
          Animated.spring(compressYAnim, {
            toValue: 1,
            stiffness: reduced ? 380 : 240,
            damping: reduced ? 36 : 16,
            useNativeDriver: true,
          }),
          Animated.spring(leanXAnim, {
            toValue: 0,
            stiffness: reduced ? 380 : 240,
            damping: reduced ? 36 : 17,
            useNativeDriver: true,
          }),
          Animated.spring(pressScaleAnim, {
            toValue: 1,
            stiffness: 280,
            damping: 20,
            useNativeDriver: true,
          }),
        ]).start();
      },

      onPanResponderTerminate: () => {
        isHorizontalDragRef.current = false;
        Animated.spring(slideAnim, {
          toValue: activeIndexRef.current,
          ...motionRef.current.spring.periodCapsule,
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

  const baseTranslateX = slideAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, segmentWidth, segmentWidth * 2],
  });
  const translateX = Animated.add(baseTranslateX, leanXAnim);

  return (
    <View
      style={[
        styles.container,
        {
          height: containerHeight,
          borderRadius: outerRadius,
          marginTop,
          elevation: surfaces.cardElevation,
          shadowOpacity: surfaces.cardShadowOpacity,
          backgroundColor: resolveCardSurface(
            isDark ? theme.colors.elevation.level1 : theme.colors.surface,
          ),
          borderWidth: cardBorder.borderWidth,
          borderColor: cardBorder.borderColor,
        },
      ]}
      onLayout={onLayout}
      accessibilityRole="tablist"
      {...panResponder.panHandlers}>
      {segmentWidth > 0 && (
        <View
          style={[styles.trackClip, { borderRadius: innerRadius }]}
          pointerEvents="none">
          <Animated.View
            style={[
              styles.activeIndicator,
              {
                width: segmentWidth,
                borderRadius: innerRadius,
                backgroundColor: activeColor,
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

      <View style={styles.labelsRow} pointerEvents="none" collapsable={false}>
        {activePeriods.map(period => {
          const isSelected = selectedPeriod === period.type;
          const textColor = isSelected
            ? onActiveColor
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
    elevation: 0,
  },
  labelsRow: {
    flex: 1,
    flexDirection: 'row',
    height: '100%',
    zIndex: 10,
    elevation: 2,
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
