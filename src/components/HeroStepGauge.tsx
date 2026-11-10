/**
 * HeroStepGauge — an organic circular step progress hero widget.
 *
 * Implements the centerpiece of the Material 3 Expressive fitness dashboard:
 *  - Organic background container styled with dynamic Material You tokens
 *  - Pure SVG circular progress track with rounded end-caps and glowing tip dot
 *  - Sneaker icon centered inside a dynamic primaryContainer bubble
 *  - Bold display-grade step metric typography and expressive goal pill tag
 *  - Direct touch handler for navigating to detailed step analytics
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Svg, { Circle, Path } from 'react-native-svg';
import { SneakerIcon } from './AestheticIcons';

interface HeroStepGaugeProps {
  readonly steps: number;
  readonly goal: number;
  readonly onPress?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GAUGE_SIZE = Math.min(SCREEN_WIDTH - 84, 220);
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
      style={[
        styles.cardContainer,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outlineVariant,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Steps today: ${steps.toLocaleString()} out of ${goal.toLocaleString()}`}>
      
      {/* Decorative organic background blob tinted with wallpaper primaryContainer */}
      <View style={styles.organicBlobWrapper} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 320 280">
          <Path
            d="M50 30C120 -10 240 10 290 60C330 110 320 200 270 240C220 280 100 290 40 240C-10 190 -10 80 50 30Z"
            fill={theme.colors.primaryContainer}
            opacity={0.45}
          />
        </Svg>
      </View>

      <View style={styles.innerCard}>
        {/* SVG Circular Progress Gauge */}
        <View style={{ width: GAUGE_SIZE, height: GAUGE_SIZE }}>
          <Svg width={GAUGE_SIZE} height={GAUGE_SIZE}>
            {/* Background inactive track */}
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={theme.colors.surfaceVariant}
              strokeWidth={STROKE_WIDTH}
              fill="none"
            />

            {/* Active progress arc */}
            {progressRatio > 0 && (
              <Circle
                cx={center}
                cy={center}
                r={radius}
                stroke={theme.colors.primary}
                strokeWidth={STROKE_WIDTH}
                fill="none"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform={`rotate(-90, ${center}, ${center})`}
              />
            )}

            {/* Indicator tip dot */}
            {progressRatio > 0.02 && (
              <Circle
                cx={tipX}
                cy={tipY}
                r={6.5}
                fill={theme.colors.surface}
                stroke={theme.colors.primary}
                strokeWidth={3}
              />
            )}
          </Svg>

          {/* Centered Content Inside Arc */}
          <View style={styles.centerContent}>
            {/* Sneaker Icon inside dynamic primaryContainer bubble */}
            <View style={[styles.iconBubble, { backgroundColor: theme.colors.primaryContainer }]}>
              <SneakerIcon size={26} color={theme.colors.onPrimaryContainer} />
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

            {/* Expressive Goal Pill Tag */}
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
  cardContainer: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 10,
    borderRadius: 32,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  organicBlobWrapper: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  centerContent: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  stepValueText: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 44,
  },
  stepLabelText: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: -2,
    marginBottom: 6,
  },
  goalPill: {
    paddingHorizontal: 11,
    paddingVertical: 3.5,
    borderRadius: 14,
  },
  goalPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
