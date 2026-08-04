/**
 * EmptyState — displayed when no health data is available.
 * Shows an icon, title, description, and an optional action button.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';

interface EmptyStateProps {
  readonly icon: string;
  readonly title: string;
  readonly description: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly secondaryActionLabel?: string;
  readonly onSecondaryAction?: () => void;
}

function EmptyStateComponent({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: EmptyStateProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Text style={{ fontSize: 64, textAlign: 'center' }} accessibilityLabel={title}>
        {icon}
      </Text>
      <Text
        variant="headlineSmall"
        style={[styles.title, { color: theme.colors.onSurface }]}>
        {title}
      </Text>
      <Text
        variant="bodyMedium"
        style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
        {description}
      </Text>
      {actionLabel != null && onAction != null && (
        <Button
          mode="contained"
          onPress={onAction}
          style={styles.button}
          accessibilityLabel={actionLabel}>
          {actionLabel}
        </Button>
      )}
      {secondaryActionLabel != null && onSecondaryAction != null && (
        <Button
          mode="text"
          onPress={onSecondaryAction}
          style={styles.secondaryButton}
          accessibilityLabel={secondaryActionLabel}>
          {secondaryActionLabel}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  title: {
    textAlign: 'center',
    marginTop: 8,
  },
  description: {
    textAlign: 'center',
    maxWidth: 280,
  },
  button: {
    marginTop: 16,
  },
  secondaryButton: {
    marginTop: 8,
  },
});

export const EmptyState = React.memo(EmptyStateComponent);
