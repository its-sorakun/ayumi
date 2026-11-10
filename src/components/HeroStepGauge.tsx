/**
 * HeroStepGauge — clean circular step progress indicator.
 *
 * Implements the centerpiece of the Material 3 Expressive fitness dashboard:
 *  - Perfectly circular geometry floating cleanly on the background
 *  - Smooth circular background track with rounded progress arc
 *  - Centered sneaker icon inside a soft primaryContainer pill
 *  - Bold display-grade step metric typography and goal percentage indicator
 *  - Pure SVG vector rendering with dynamic Material You tokens
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Svg, { Circle } from 'react-native-svg';
import { SneakerIcon } from './AestheticIcons';

interface HeroStepGaugeProps {
  readonly steps: number;
  readonly goal: number;
  readonly onPress?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GAUGE_SIZE = Math.min(SCREEN_WIDTH - 84, 226);
const STROKE_WIDTH = 14;

export function HeroStepGauge({ steps, goal, onPress }: HeroStepGaugeProps): React.JSX.Element {
  const theme = useTheme();

  const center = GAUGE_SIZE / 2;
  const radius = center - STROKE_WIDTH / 2 - 2;
  const circumference = 2 * Math.PI * radius;

  // Clamped ratio between 0 and 1
  const progressRatio = goal > 0 ? Math.min(Math.max(steps / goal, 0), 1) : 0;
  const strokeDashoffset = circumference - circumference * progressRatio;
  const progressPercent = Math.round(progressRatio * 100);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={styles.gaugeContainer}
      accessibilityRole="button"
      accessibilityLabel={`Steps today: ${steps.toLocaleString()} out of ${goal.toLocaleString()}`}>
      
      <View style={{ width: GAUGE_SIZE, height: GAUGE_SIZE }}>
        <Svg width={GAUGE_SIZE} height={GAUGE_SIZE}>
          {/* Background inactive track */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={theme.dark ? theme.colors.elevation.level2 : theme.colors.surfaceVariant}
            strokeWidth={STROKE_WIDTH}
            strokeOpacity={theme.dark ? 0.9 : 0.4}
            fill="none"
          />

          {/* Active progress arc with dynamic Monet primary color */}
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
        </Svg>

        {/* Centered Content with balanced vertical breathing room */}
        <View style={styles.centerContent}>
          {/* Sneaker Icon inside soft primaryContainer pill */}
          <View style={[styles.iconPill, { backgroundColor: theme.colors.primaryContainer }]}>
            <SneakerIcon size={22} color={theme.colors.primary} />
          </View>

          {/* Large Step Count */}
          <Text
            style={[styles.stepValueText, { color: theme.colors.onSurface }]}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {steps.toLocaleString()}
          </Text>

          {/* Steps Label */}
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
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  gaugeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  centerContent: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  iconPill: {
    width: 48,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepValueText: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 48,
  },
  stepLabelText: {
    fontSize: 15,
    fontWeight: '500',
    marginTop: -2,
    marginBottom: 6,
  },
  goalPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
  },
  goalPillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
