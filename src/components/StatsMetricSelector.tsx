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
import { SneakerIcon, RouteMapIcon, DropletIcon } from './AestheticIcons';
import { MotionTokens, useReducedMotion } from '../theme/motion';

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
const TAP_SLOP_PX = 10;

function applyBoundaryResistance(value: number, min: number, max: number): number {
  if (value < min) return min + (value - min) * 0.14;
  if (value > max) return max + (value - max) * 0.14;
  return value;
}

export function StatsMetricSelector({
  selectedMetric,
  onSelectMetric,
}: StatsMetricSelectorProps): React.JSX.Element {
  const theme = useTheme();
  const isDark = theme.dark;
  const reducedMotion = useReducedMotion();

  const [containerWidth, setContainerWidth] = useState(0);

  const activeIndex = Math.max(METRICS.findIndex(m => m.type === selectedMetric), 0);
  const slideAnim = useRef(new Animated.Value(activeIndex)).current;
  const stretchXAnim = useRef(new Animated.Value(1)).current;
  const compressYAnim = useRef(new Animated.Value(1)).current;
  const leanXAnim = useRef(new Animated.Value(0)).current;
  const pressScaleAnim = useRef(new Animated.Value(1)).current;

  // Live refs keep PanResponder closures synchronized without stale layout, accessibility, or selection state
  const containerWidthRef = useRef(0);
  const activeIndexRef = useRef(activeIndex);
  const prevActiveIndexRef = useRef(activeIndex);
  const onSelectRef = useRef(onSelectMetric);
  const reducedMotionRef = useRef(reducedMotion);
  activeIndexRef.current = activeIndex;
  onSelectRef.current = onSelectMetric;
  reducedMotionRef.current = reducedMotion;

  const pressLocalXRef = useRef(0);
  const dragStartSlotRef = useRef(activeIndex);
  const isHorizontalDragRef = useRef(false);
  const skipNextEffectAnimRef = useRef(false);

  const currentSlotWidth = containerWidth > 0 ? (containerWidth - GAP * 2) / 3 : 0;

  const settleDeformation = useCallback(() => {
    const reduced = reducedMotionRef.current;
    const settleStiffness = reduced ? 400 : MotionTokens.spring.metricCard.stiffness;
    const settleDamping = reduced ? 38 : MotionTokens.spring.metricCard.damping;
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
        stiffness: 260,
        damping: 18,
        useNativeDriver: true,
      }),
    ]).start();
  }, [stretchXAnim, compressYAnim, leanXAnim, pressScaleAnim]);

  // Cushioned tile tap leap: anticipation compress -> directional stretch -> impact cushion -> spring recovery.
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
      Animated.timing(slideAnim, {
        toValue: activeIndex,
        duration: 120,
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

    const peakStretch = jumpDistance >= 2 ? 1.30 : 1.23;
    const peakCompress = jumpDistance >= 2 ? 0.78 : 0.82;
    const flightLean = -dir * (jumpDistance >= 2 ? 10 : 6);

    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: activeIndex,
        ...MotionTokens.spring.metricCard,
        useNativeDriver: true,
      }),
      Animated.sequence([
        // Phase 1: anticipation compression along horizontal travel axis
        Animated.parallel([
          Animated.timing(stretchXAnim, {
            toValue: 0.89,
            duration: 55,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(compressYAnim, {
            toValue: 1.07,
            duration: 55,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(leanXAnim, {
            toValue: -dir * 3.5,
            duration: 55,
            useNativeDriver: true,
          }),
        ]),
        // Phase 2: elongated travel stretch with trailing tail lag
        Animated.parallel([
          Animated.timing(stretchXAnim, {
            toValue: peakStretch,
            duration: 115,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(compressYAnim, {
            toValue: peakCompress,
            duration: 115,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(leanXAnim, {
            toValue: flightLean,
            duration: 115,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        // Phase 3: brief landing squash cushion
        Animated.parallel([
          Animated.timing(stretchXAnim, {
            toValue: 0.93,
            duration: 75,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(compressYAnim, {
            toValue: 1.05,
            duration: 75,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(leanXAnim, {
            toValue: dir * 2.5,
            duration: 75,
            useNativeDriver: true,
          }),
        ]),
        // Phase 4: elastic spring shape recovery
        Animated.parallel([
          Animated.spring(stretchXAnim, {
            toValue: 1,
            stiffness: 170,
            damping: 12,
            useNativeDriver: true,
          }),
          Animated.spring(compressYAnim, {
            toValue: 1,
            stiffness: 170,
            damping: 12,
            useNativeDriver: true,
          }),
          Animated.spring(leanXAnim, {
            toValue: 0,
            stiffness: 170,
            damping: 13,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, [activeIndex, reducedMotion, slideAnim, stretchXAnim, compressYAnim, leanXAnim]);

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
          toValue: 0.975,
          duration: 80,
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
              duration: 90,
              useNativeDriver: true,
            }).start();
          } else {
            return;
          }
        }

        const slotW = (width - GAP * 2) / 3;
        const stepDist = Math.max(slotW + GAP, 1);
        const rawSlot = dragStartSlotRef.current + dx / stepDist;
        const clampedSlot = applyBoundaryResistance(rawSlot, 0, 2);
        slideAnim.setValue(clampedSlot);

        if (reducedMotionRef.current) {
          stretchXAnim.setValue(1);
          compressYAnim.setValue(1);
          leanXAnim.setValue(0);
        } else {
          // Squeeze intensity and trailing lag respond dynamically to swipe velocity and direction.
          const wrappedFrac = Math.min(Math.max(clampedSlot, 0), 2) % 1;
          const midBridge = Math.sin(Math.PI * wrappedFrac) * 0.14;
          const velocityBoost = Math.min(Math.abs(vx) * 0.14, 0.16);
          const travelFactor = Math.min(midBridge + velocityBoost, 0.28);
          const dragDir = vx !== 0 ? Math.sign(vx) : Math.sign(dx);
          stretchXAnim.setValue(1 + travelFactor);
          compressYAnim.setValue(1 - travelFactor * 0.74);
          leanXAnim.setValue(-dragDir * Math.min(Math.abs(vx) * 6 + travelFactor * 22, 12));
        }
      },

      onPanResponderRelease: (_, gestureState) => {
        const width = containerWidthRef.current;
        Animated.spring(pressScaleAnim, {
          toValue: 1,
          stiffness: 260,
          damping: 18,
          useNativeDriver: true,
        }).start();

        if (!isHorizontalDragRef.current) {
          if (width > 0 && Math.abs(gestureState.dx) <= TAP_SLOP_PX * 1.4) {
            const tappedSlot = Math.min(
              Math.max(Math.floor((pressLocalXRef.current / width) * 3), 0),
              2
            );
            if (tappedSlot !== activeIndexRef.current) {
              onSelectRef.current(METRICS[tappedSlot].type);
            } else if (!reducedMotionRef.current) {
              // Subtle active-tile cushion bump confirms same-slot tap tactilely.
              Animated.sequence([
                Animated.parallel([
                  Animated.timing(stretchXAnim, { toValue: 0.94, duration: 55, useNativeDriver: true }),
                  Animated.timing(compressYAnim, { toValue: 1.05, duration: 55, useNativeDriver: true }),
                ]),
                Animated.parallel([
                  Animated.spring(stretchXAnim, { toValue: 1, stiffness: 190, damping: 13, useNativeDriver: true }),
                  Animated.spring(compressYAnim, { toValue: 1, stiffness: 190, damping: 13, useNativeDriver: true }),
                ]),
              ]).start();
            }
          } else {
            Animated.spring(slideAnim, {
              toValue: activeIndexRef.current,
              ...MotionTokens.spring.metricCard,
              useNativeDriver: true,
            }).start();
            settleDeformation();
          }
          return;
        }

        const slotW = Math.max((width - GAP * 2) / 3, 1);
        const stepDist = slotW + GAP;
        const rawSlot = dragStartSlotRef.current + gestureState.dx / stepDist;
        let targetSlot = Math.round(rawSlot);
        if (gestureState.vx > 0.35) {
          targetSlot = Math.ceil(rawSlot);
        } else if (gestureState.vx < -0.35) {
          targetSlot = Math.floor(rawSlot);
        }
        targetSlot = Math.min(Math.max(targetSlot, 0), 2);

        const swipeVelocitySlots = Math.max(Math.min((gestureState.vx / stepDist) * 1000, 10), -10);
        if (targetSlot !== activeIndexRef.current) {
          skipNextEffectAnimRef.current = true;
          onSelectRef.current(METRICS[targetSlot].type);
        }

        const reduced = reducedMotionRef.current;
        Animated.parallel([
          Animated.spring(slideAnim, {
            toValue: targetSlot,
            velocity: swipeVelocitySlots,
            stiffness: reduced ? 340 : MotionTokens.spring.metricCard.stiffness,
            damping: reduced ? 34 : MotionTokens.spring.metricCard.damping,
            mass: MotionTokens.spring.metricCard.mass,
            useNativeDriver: true,
          }),
          Animated.spring(stretchXAnim, {
            toValue: 1,
            stiffness: reduced ? 380 : 170,
            damping: reduced ? 38 : 12,
            useNativeDriver: true,
          }),
          Animated.spring(compressYAnim, {
            toValue: 1,
            stiffness: reduced ? 380 : 170,
            damping: reduced ? 38 : 12,
            useNativeDriver: true,
          }),
          Animated.spring(leanXAnim, {
            toValue: 0,
            stiffness: reduced ? 380 : 170,
            damping: reduced ? 38 : 13,
            useNativeDriver: true,
          }),
        ]).start();
      },

      onPanResponderTerminate: () => {
        isHorizontalDragRef.current = false;
        Animated.spring(slideAnim, {
          toValue: activeIndexRef.current,
          ...MotionTokens.spring.metricCard,
          useNativeDriver: true,
        }).start();
        settleDeformation();
      },
    })
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    containerWidthRef.current = w;
    setContainerWidth(w);
  };

  const stepDistance = currentSlotWidth + GAP;
  const baseTranslateX = slideAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, stepDistance, stepDistance * 2],
  });
  const translateX = Animated.add(baseTranslateX, leanXAnim);

  return (
    <View
      style={styles.container}
      onLayout={onLayout}
      accessibilityRole="tablist"
      {...panResponder.panHandlers}>
      {/* Background Track Slots for Unselected State */}
      {METRICS.map(metric => {
        return (
          <View
            key={`slot-${metric.type}`}
            pointerEvents="none"
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
                { scaleY: Animated.multiply(compressYAnim, pressScaleAnim) },
              ],
            },
          ]}
        />
      )}

      {/* Foreground Content Labels & Icons (non-interactive overlay elevated above sliding indicator) */}
      <View
        style={[StyleSheet.absoluteFill, styles.foregroundOverlay]}
        pointerEvents="none"
        collapsable={false}>
        <View style={styles.contentRow}>
          {METRICS.map(metric => {
            const isSelected = selectedMetric === metric.type;
            const iconColor = isSelected ? theme.colors.primary : theme.colors.onSurfaceVariant;
            const textColor = isSelected ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant;

            return (
              <View key={metric.type} style={styles.cardButton} collapsable={false}>
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
              </View>
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
    borderRadius: 18,
    zIndex: 2,
    elevation: 2,
  },
  foregroundOverlay: {
    zIndex: 10,
    elevation: 4,
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
    zIndex: 12,
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
