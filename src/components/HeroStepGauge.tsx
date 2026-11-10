/**
 * HeroStepGauge — an organic circular step progress hero component.
 *
 * Implements the centerpiece of the Material 3 Expressive fitness dashboard:
 *  - Organic squircle / fluid blob background container
 *  - Pure SVG circular progress track with rounded end-caps and tip indicator dot
 *  - Centered sneaker icon in a soft pastel bubble
 *  - Display-grade step metric typography and goal indicator
 *  - Interactive press handler for navigating to StepsDetails
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { SneakerIcon } from './AestheticIcons';

interface HeroStepGaugeProps {
  readonly steps: number;
  readonly goal: number;
  readonly onPress?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GAUGE_SIZE = Math.min(SCREEN_WIDTH - 64, 250);
const STROKE_WIDTH = 13;

export function HeroStepGauge({ steps, goal, onPress }: HeroStepGaugeProps): React.JSX.Element {
  const theme = useTheme();

  const center = GAUGE_SIZE / 2;
  const radius = center - STROKE_WIDTH - 6;
  const circumference = 2 * Math.PI * radius;

  // Clamped ratio between 0 and 1
  const progressRatio = goal > 0 ? Math.min(Math.max(steps / goal, 0), 1) : 0;
  const strokeDashoffset = circumference - circumference * progressRatio;

  // Compute tip indicator coordinate
  const angleDeg = -90 + progressRatio * 360;
  const angleRad = (angleDeg * Math.PI) / 180;
  const tipX = center + radius * Math.cos(angleRad);
  const tipY = center + radius * Math.sin(angleRad);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={styles.cardContainer}
      accessibilityRole="button"
      accessibilityLabel={`Steps today: ${steps.toLocaleString()} out of ${goal.toLocaleString()}`}>
      
      {/* Decorative organic background blob */}
      <View style={styles.organicBlobWrapper} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 320 280">
          <Path
            d="M50 30C120 -10 240 10 290 60C330 110 320 200 270 240C220 280 100 290 40 240C-10 190 -10 80 50 30Z"
            fill="#F4ECFA"
            opacity={0.65}
          />
        </Svg>
      </View>

      <View style={styles.innerCard}>
        {/* SVG Circular Progress Gauge */}
        <View style={{ width: GAUGE_SIZE, height: GAUGE_SIZE }}>
          <Svg width={GAUGE_SIZE} height={GAUGE_SIZE}>
            <Defs>
              <LinearGradient id="heroGaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#C49DE8" />
                <Stop offset="100%" stopColor="#8C5AB8" />
              </LinearGradient>
            </Defs>

            {/* Background inactive track */}
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke="#EDE4F4"
              strokeWidth={STROKE_WIDTH}
              fill="none"
            />

            {/* Active progress arc */}
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

            {/* Indicator tip dot */}
            {progressRatio > 0.02 && (
              <Circle
                cx={tipX}
                cy={tipY}
                r={6.5}
                fill="#FFFFFF"
                stroke="#8C5AB8"
                strokeWidth={3}
              />
            )}
          </Svg>

          {/* Centered Content Inside Arc */}
          <View style={styles.centerContent}>
            {/* Sneaker Icon in soft bubble */}
            <View style={styles.iconBubble}>
              <SneakerIcon size={28} color="#8C5AB8" />
            </View>

            {/* Step Count */}
            <Text
              style={styles.stepValueText}
              numberOfLines={1}
              adjustsFontSizeToFit>
              {steps.toLocaleString()}
            </Text>

            {/* Label */}
            <Text style={styles.stepLabelText}>Steps</Text>

            {/* Goal Target */}
            <Text style={styles.goalText}>
              Goal: {goal.toLocaleString()}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 16,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
    shadowColor: '#7E57A0',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
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
    paddingVertical: 22,
  },
  centerContent: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3EAF9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepValueText: {
    fontSize: 42,
    fontWeight: '800',
    color: '#2A1D36',
    letterSpacing: -1,
    lineHeight: 46,
  },
  stepLabelText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3B294C',
    marginTop: -2,
    marginBottom: 4,
  },
  goalText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#847395',
  },
});
