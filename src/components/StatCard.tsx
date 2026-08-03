/**
 * StatCard — a Material Design 3 card that displays a single health metric.
 * Used on the Dashboard to show steps, distance, calories, and active time.
 *
 * Uses React.memo to prevent unnecessary re-renders when parent state changes
 * but the card's props haven't.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';

interface StatCardProps {
  readonly title: string;
  readonly value: string;
  readonly subtitle?: string;
  readonly icon: string;
  readonly progress?: number; // 0 to 1
}

function StatCardComponent({
  title,
  value,
  subtitle,
  icon,
  progress,
}: StatCardProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content style={styles.content}>
        <View style={styles.header}>
          <Text style={{ fontSize: 20 }} accessibilityLabel={title}>
            {icon}
          </Text>
          <Text
            variant="labelMedium"
            style={[styles.title, { color: theme.colors.onSurfaceVariant }]}>
            {title}
          </Text>
        </View>

        <Text
          variant="headlineMedium"
          style={[styles.value, { color: theme.colors.onSurface }]}
          accessibilityLabel={`${title}: ${value}`}>
          {value}
        </Text>

        {subtitle != null && (
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}>
            {subtitle}
          </Text>
        )}

        {progress != null && (
          <View
            style={[
              styles.progressTrack,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: theme.colors.primary,
                  width: `${Math.min(progress * 100, 100)}%`,
                },
              ]}
            />
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 150,
    marginHorizontal: 6,
    marginVertical: 6,
  },
  content: {
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontWeight: '600',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});

export const StatCard = React.memo(StatCardComponent);
