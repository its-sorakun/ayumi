/**
 * HeroStepGauge — an organic circular step progress hero widget.
 *
 * Implements the centerpiece of the Material 3 Expressive fitness dashboard:
 *  - Borderless, organic floating widget with multi-layered fluid wave backdrops
 *  - SVG circular gauge with dynamic Monet dual-tone gradient progress arc
 *  - Dual-layer glowing tip indicator with soft ambient halo
 *  - Sneaker icon centered inside a dynamic primaryContainer bubble
 *  - Calibrated vertical hierarchy providing ample breathing room for the goal pill
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Svg, { Circle, Path, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { SneakerIcon } from './AestheticIcons';

interface HeroStepGaugeProps {
  readonly steps: number;
  readonly goal: number;
  readonly onPress?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GAUGE_SIZE = Math.min(SCREEN_WIDTH - 84, 224);
const STROKE_WIDTH = 13;

export function HeroStepGauge({ steps, goal, onPress }: HeroStepGaugeProps): React.JSX.Element {
  const theme = useTheme();

  const center = GAUGE_SIZE / 2;
  const radius = center - STROKE_WIDTH - 4;
  const circumference = 2 * Math.PI * radius;

  // Clamped ratio between 0 and 1
  const progressRatio = goal > 0 ? Math.min(Math.max(steps / goal, 0), 1) : 0;
  const strokeDashoffset = circumference - circumference * progressRatio;
  const progressPercent = Math.round(progressRatio * 100);

  // Compute tip indicator coordinate
  const angleDeg = -90 + progressRatio * 360;
  const angleRad = (angleDeg * Math.PI) / 180;
  const tipX = center + radius * Math.cos(angleRad);
  const tipY = center + radius * Math.sin(angleRad);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={styles.floatingContainer}
      accessibilityRole="button"
      accessibilityLabel={`Steps today: ${steps.toLocaleString()} out of ${goal.toLocaleString()}`}>
      
      {/* Multi-layered organic fluid wave backdrops */}
      <View style={styles.organicBlobWrapper} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 340 300">
          {/* Base organic fluid shape */}
          <Path
            d="M50 40C130 -10 250 10 300 70C340 120 330 220 270 260C210 300 90 310 35 255C-20 200 -15 90 50 40Z"
            fill={theme.colors.primaryContainer}
            opacity={0.42}
          />
          {/* Layered secondary ambient blob */}
          <Path
            d="M80 60C150 20 230 40 280 90C320 140 300 230 250 250C200 270 120 270 65 230C10 190 20 100 80 60Z"
            fill={theme.colors.secondaryContainer}
            opacity={0.28}
          />
        </Svg>
      </View>

      <View style={styles.innerGaugeWrapper}>
        {/* SVG Circular Progress Gauge */}
        <View style={{ width: GAUGE_SIZE, height: GAUGE_SIZE }}>
          <Svg width={GAUGE_SIZE} height={GAUGE_SIZE}>
            <Defs>
              <LinearGradient id="heroGaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={theme.colors.primary} />
                <Stop offset="100%" stopColor={theme.colors.secondary} />
              </LinearGradient>
            </Defs>

            {/* Background inactive track */}
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={theme.colors.surfaceVariant}
              strokeWidth={STROKE_WIDTH}
              strokeOpacity={0.4}
              fill="none"
            />

            {/* Active progress arc with dynamic Monet gradient */}
            {progressRatio > 0 && (
              <Circle
                cx={center}
                cy={center}
                r={radius}
                stroke="url(#heroGaugeGrad)"
                strokeWidth={STROKE_WIDTH}
                fill="none"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform={`rotate(-90, ${center}, ${center})`}
              />
            )}

            {/* Glowing dual-layer tip indicator */}
            {progressRatio > 0.015 && (
              <G>
                {/* Soft ambient glow halo */}
                <Circle
                  cx={tipX}
                  cy={tipY}
                  r={9}
                  fill={theme.colors.primary}
                  opacity={0.25}
                />
                {/* Crisp center tip dot */}
                <Circle
                  cx={tipX}
                  cy={tipY}
                  r={5}
                  fill={theme.colors.surface}
                  stroke={theme.colors.primary}
                  strokeWidth={2.6}
                />
              </G>
            )}
          </Svg>

          {/* Centered Content with plenty of vertical breathing room */}
          <View style={styles.centerContent}>
            {/* Sneaker Icon inside dynamic primaryContainer bubble */}
            <View style={[styles.iconBubble, { backgroundColor: theme.colors.primaryContainer }]}>
              <SneakerIcon size={22} color={theme.colors.onPrimaryContainer} />
            </View>

            {/* Step Count */}
            <Text
              style={[styles.stepValueText, { color: theme.colors.onSurface }]}
              numberOfLines={1}
              adjustsFontSizeToFit>
              {steps.toLocaleString()}
            </Text>

            {/* Label */}
            <Text style={[styles.stepLabelText, { color: theme.colors.onSurfaceVariant }]}>
              Steps
            </Text>

            {/* Expressive Goal Pill Tag (separated cleanly from bottom arc) */}
            <View style={[styles.goalPill, { backgroundColor: theme.colors.primaryContainer }]}>
              <Text style={[styles.goalPillText, { color: theme.colors.onPrimaryContainer }]}>
                {progressPercent}% • Goal {goal.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  organicBlobWrapper: {
    position: 'absolute',
    top: -24,
    left: -24,
    right: -24,
    bottom: -24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerGaugeWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  centerContent: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  iconBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 1,
  },
  stepValueText: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 40,
  },
  stepLabelText: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: -2,
    marginBottom: 4,
  },
  goalPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  goalPillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
