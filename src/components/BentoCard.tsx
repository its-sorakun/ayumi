/**
 * BentoCard — a Material 3 Expressive squircle metric tile.
 *
 * Implements aesthetic, tactile bento cells with:
 *  - 26dp squircle corner radius
 *  - Pastel-tinted organic icon bubble badge
 *  - Bold display metric numbers paired with clean subtitle hierarchy
 *  - Optional goal progress bar with smooth rounded pill styling
 *  - Decorative organic wave accent for full-width cards (e.g. Water)
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Path } from 'react-native-svg';

interface BentoCardProps {
  readonly title: string;
  readonly value: string;
  readonly subtitle?: string;
  readonly icon: React.ReactNode;
  readonly iconBgColor?: string;
  readonly cardBgColor?: string;
  readonly borderColor?: string;
  readonly progress?: number; // 0 to 1
  readonly progressBarColor?: string;
  readonly fullWidth?: boolean;
  readonly showWaterWave?: boolean;
  readonly onPress?: () => void;
  readonly style?: ViewStyle;
}

export function BentoCard({
  title,
  value,
  subtitle,
  icon,
  iconBgColor = '#F2E8FA',
  cardBgColor = '#FFFFFF',
  borderColor = '#F0E7F8',
  progress,
  progressBarColor = '#A479CE',
  fullWidth = false,
  showWaterWave = false,
  onPress,
  style,
}: BentoCardProps): React.JSX.Element {
  const isInteractive = typeof onPress === 'function';

  return (
    <TouchableOpacity
      activeOpacity={isInteractive ? 0.85 : 1}
      onPress={onPress}
      disabled={!isInteractive}
      style={[
        styles.card,
        {
          backgroundColor: cardBgColor,
          borderColor,
          flex: fullWidth ? 0 : 1,
          width: fullWidth ? '100%' : undefined,
        },
        style,
      ]}
      accessibilityRole={isInteractive ? 'button' : 'text'}
      accessibilityLabel={`${title}: ${value}${subtitle ? `, ${subtitle}` : ''}`}>
      
      {/* Decorative organic corner wave for fluid full-width cards */}
      {showWaterWave && (
        <View style={styles.waterWaveWrapper} pointerEvents="none">
          <Svg width={140} height={80} viewBox="0 0 140 80">
            <Path
              d="M0 60C30 50 70 80 110 50C130 35 140 10 140 0V80H0V60Z"
              fill="#D9E6F9"
              opacity={0.45}
            />
          </Svg>
        </View>
      )}

      <View style={styles.contentRow}>
        {/* Left: Icon inside organic bubble */}
        <View style={[styles.iconContainer, { backgroundColor: iconBgColor }]}>
          {icon}
        </View>

        {/* Right: Metric details */}
        <View style={styles.detailsContainer}>
          <Text style={styles.titleText} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.valueText} numberOfLines={1} adjustsFontSizeToFit>
            {value}
          </Text>
          {subtitle != null && (
            <Text style={styles.subtitleText} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      {/* Progress pill bar */}
      {progress != null && (
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: progressBarColor,
                width: `${Math.min(Math.max(progress * 100, 0), 100)}%`,
              },
            ]}
          />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1.2,
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#8E67AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  detailsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B3B59',
    marginBottom: 2,
  },
  valueText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#271A33',
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#847395',
    marginTop: 2,
  },
  progressTrack: {
    height: 5.5,
    borderRadius: 3,
    backgroundColor: '#EDE4F3',
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  waterWaveWrapper: {
    position: 'absolute',
    right: 0,
    bottom: 0,
  },
});

