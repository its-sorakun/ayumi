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

interface StatsSummaryCardsProps {
  readonly averageValue: string;
  readonly averageUnit: string;
  readonly highestValue: string;
  readonly highestUnit: string;
}

export function StatsSummaryCards({
  averageValue,
  averageUnit,
  highestValue,
  highestUnit,
}: StatsSummaryCardsProps): React.JSX.Element {
  const theme = useTheme();
  const isDark = theme.dark;

  const cardBg = isDark ? theme.colors.elevation.level1 : theme.colors.surface;
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'transparent';
  const borderWidth = isDark ? 1 : 0;

  return (
    <View style={styles.container}>
      {/* Left Card: Average */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: cardBg,
            borderColor,
            borderWidth,
          },
        ]}>
        <View style={styles.contentRow}>
          <View style={[styles.iconBubble, { backgroundColor: theme.colors.primaryContainer }]}>
            <TargetBullseyeIcon size={18} color={theme.colors.primary} />
          </View>
          <Text style={[styles.cardLabel, { color: theme.colors.onSurfaceVariant }]}>
            Average
          </Text>
        </View>

        <Text
          style={[styles.valueText, { color: theme.colors.onSurface }]}
          numberOfLines={1}
          adjustsFontSizeToFit>
          {averageValue}
        </Text>
        <Text style={[styles.unitText, { color: theme.colors.onSurfaceVariant }]}>
          {averageUnit}
        </Text>
      </View>

      {/* Right Card: Highest (Day) */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: cardBg,
            borderColor,
            borderWidth,
          },
        ]}>
        <View style={styles.contentRow}>
          <View style={[styles.iconBubble, { backgroundColor: theme.colors.primaryContainer }]}>
            <TrophyIcon size={18} color={theme.colors.primary} />
          </View>
          <Text style={[styles.cardLabel, { color: theme.colors.onSurfaceVariant }]}>
            Highest (Day)
          </Text>
        </View>

        <Text
          style={[styles.valueText, { color: theme.colors.onSurface }]}
          numberOfLines={1}
          adjustsFontSizeToFit>
          {highestValue}
        </Text>
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
    marginTop: 6,
    marginBottom: 6,
  },
  card: {
    flex: 1,
    borderRadius: 18,
    padding: 10,
    elevation: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  iconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  valueText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 22,
  },
  unitText: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
});
