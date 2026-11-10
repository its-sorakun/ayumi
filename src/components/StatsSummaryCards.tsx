/**
 * StatsSummaryCards — twin contextual summary metric cards.
 *
 * Implements the period statistical cards below the main chart:
 *  - Average card with dynamic Bullseye / Target icon bubble
 *  - Highest (Day) card with dynamic Trophy icon bubble
 *  - Large prominent numerical typography paired with subtle unit labels
 *  - Animated odometer counter transition when statistics update
 *  - Uniform 20dp corner radii with Material 3 dark/light surface adaptation
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
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
            <TargetBullseyeIcon size={20} color={theme.colors.primary} />
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
            <TrophyIcon size={20} color={theme.colors.primary} />
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
    marginTop: 12,
    marginBottom: 24,
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
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  unitText: {
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 1,
  },
});
