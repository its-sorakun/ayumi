/**
 * StatsSummaryCards — twin contextual summary metric cards.
 *
 * Implements the period statistical cards below the main chart:
 *  - Average card with dynamic Bullseye / Target icon bubble
 *  - Highest (Day) card with dynamic Trophy icon bubble
 *  - Large prominent numerical typography paired with subtle unit labels
 *  - Compact vertical sizing ensuring full viewport fit on mobile screens
 *  - Uniform 18dp corner radii with Material 3 dark/light surface adaptation
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { TargetBullseyeIcon, TrophyIcon } from './AestheticIcons';
import { AnimatedStatNumber, type StatNumberScaleUnit } from './AnimatedStatNumber';
import type { StatMetricType } from './StatsMetricSelector';
import {
  colorWithOpacity,
  OxygenTargetIcon,
  OxygenTrophyIcon,
  resolveMetricBadgeColors,
  useAyumiTheme,
} from '../themes';

interface StatsSummaryCardsProps {
  readonly metric?: StatMetricType;
  readonly averageValue: string;
  readonly averageRawValue?: number | null;
  readonly averageScaleUnit?: StatNumberScaleUnit;
  readonly averageUnit: string;
  readonly highestValue: string;
  readonly highestRawValue?: number | null;
  readonly highestScaleUnit?: StatNumberScaleUnit;
  readonly highestUnit: string;
  readonly highestLabel?: string;
  readonly syncKey?: string;
  readonly duration?: number;
  readonly marginTop?: number;
  readonly marginBottom?: number;
  readonly cardPaddingVertical?: number;
  readonly contentRowMarginBottom?: number;
}

export function StatsSummaryCards({
  metric = 'steps',
  averageValue,
  averageRawValue,
  averageScaleUnit = 'raw',
  averageUnit,
  highestValue,
  highestRawValue,
  highestScaleUnit = 'raw',
  highestUnit,
  highestLabel = 'Highest (Day)',
  syncKey = '',
  duration,
  marginTop = 8,
  marginBottom = 10,
  cardPaddingVertical = 14,
  contentRowMarginBottom = 6,
}: StatsSummaryCardsProps): React.JSX.Element {
  const theme = useTheme();
  const { surfaces, typography, metricAccents, resolveCardBorder } = useAyumiTheme();
  const isDark = theme.dark;

  const metricAccent =
    metric === 'distance'
      ? metricAccents.distance
      : metric === 'water'
        ? metricAccents.water
        : metricAccents.steps;

  const cardBg = isDark ? theme.colors.elevation.level1 : theme.colors.surface;
  const { borderColor, borderWidth } = resolveCardBorder();
  const isOemCards = surfaces.bentoLayout === 'header_inline';
  const isOxygenIcons = surfaces.iconFamily === 'oxygen_lucide';
  const isSolidBadges = surfaces.badgeStyle === 'solid';
  const summaryBadge = resolveMetricBadgeColors(metricAccent, surfaces.badgeStyle);
  const badgeBg = isSolidBadges
    ? summaryBadge.bg
    : isOemCards
    ? colorWithOpacity(metricAccent.color, isDark ? 0.2 : 0.11)
    : metricAccent.container;
  const badgeRadius = isSolidBadges ? 16 : isOemCards ? 10 : 16;

  return (
    <View style={[styles.container, { marginTop, marginBottom }]}>
      {/* Left Card: Average */}
      <View
        style={[
          styles.card,
          {
            paddingVertical: cardPaddingVertical,
            borderRadius: surfaces.summaryCardRadius,
            elevation: surfaces.cardElevation,
            shadowOpacity: surfaces.cardShadowOpacity,
            backgroundColor: cardBg,
            borderColor,
            borderWidth,
          },
        ]}>
        <View style={[styles.contentRow, { marginBottom: contentRowMarginBottom }]}>
          <View
            style={[
              styles.iconBubble,
              { backgroundColor: badgeBg, borderRadius: badgeRadius },
            ]}>
            {isOxygenIcons ? (
              <OxygenTargetIcon size={17} color={summaryBadge.fg} filled={isSolidBadges} />
            ) : (
              <TargetBullseyeIcon size={18} color={metricAccent.color} />
            )}
          </View>
          <Text style={[styles.cardLabel, { color: theme.colors.onSurfaceVariant }]}>
            Average
          </Text>
        </View>

        {averageRawValue !== undefined ? (
          <AnimatedStatNumber
            value={averageRawValue}
            fallbackText={averageValue}
            unitKey={`${metric}:avg:${averageUnit}`}
            scaleUnit={averageScaleUnit}
            syncKey={syncKey}
            duration={duration}
            style={[
              styles.valueText,
              { color: theme.colors.onSurface, fontWeight: typography.statValueWeight },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          />
        ) : (
          <Text
            style={[
              styles.valueText,
              { color: theme.colors.onSurface, fontWeight: typography.statValueWeight },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {averageValue}
          </Text>
        )}
        <Text style={[styles.unitText, { color: theme.colors.onSurfaceVariant }]}>
          {averageUnit}
        </Text>
      </View>

      {/* Right Card: Highest (Day) */}
      <View
        style={[
          styles.card,
          {
            paddingVertical: cardPaddingVertical,
            borderRadius: surfaces.summaryCardRadius,
            elevation: surfaces.cardElevation,
            shadowOpacity: surfaces.cardShadowOpacity,
            backgroundColor: cardBg,
            borderColor,
            borderWidth,
          },
        ]}>
        <View style={[styles.contentRow, { marginBottom: contentRowMarginBottom }]}>
          <View
            style={[
              styles.iconBubble,
              { backgroundColor: badgeBg, borderRadius: badgeRadius },
            ]}>
            {isOxygenIcons ? (
              <OxygenTrophyIcon size={17} color={summaryBadge.fg} filled={isSolidBadges} />
            ) : (
              <TrophyIcon size={18} color={metricAccent.color} />
            )}
          </View>
          <Text style={[styles.cardLabel, { color: theme.colors.onSurfaceVariant }]}>
            {highestLabel}
          </Text>
        </View>

        {highestRawValue !== undefined ? (
          <AnimatedStatNumber
            value={highestRawValue}
            fallbackText={highestValue}
            unitKey={`${metric}:high:${highestUnit}`}
            scaleUnit={highestScaleUnit}
            syncKey={syncKey}
            duration={duration}
            style={[
              styles.valueText,
              { color: theme.colors.onSurface, fontWeight: typography.statValueWeight },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          />
        ) : (
          <Text
            style={[
              styles.valueText,
              { color: theme.colors.onSurface, fontWeight: typography.statValueWeight },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {highestValue}
          </Text>
        )}
        <Text style={[styles.unitText, { color: theme.colors.onSurfaceVariant }]}>
          {highestUnit}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 10,
  },
  card: {
    flex: 1,
    borderRadius: 20,
    padding: 14,
    elevation: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    flex: 1,
  },
  valueText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 25,
  },
  unitText: {
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 2,
  },
});
