/**
 * BentoCard — a Material 3 Expressive metric card component.
 *
 * Implements clean, borderless tonal containers matching the Material 3 Expressive guidelines:
 *  - 24dp uniform corner radius for standard cards, 28dp for full-width cards
 *  - Borderless soft tonal surfaces derived dynamically from Material You
 *  - Prominent numerical display paired with inline, visually subordinate unit typography
 *  - Adaptive font scaling preventing text clipping and horizontal overflow
 *  - Horizontal progress bar with rounded end caps
 *  - Interactive quick-action pill buttons for micro-interactions
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

interface BentoCardProps {
  readonly title: string;
  readonly value: string;
  readonly unit?: string;
  readonly subtitle?: string;
  readonly icon: React.ReactNode;
  readonly iconBgColor?: string;
  readonly cardBgColor?: string;
  readonly titleColor?: string;
  readonly valueColor?: string;
  readonly subtitleColor?: string;
  readonly progress?: number; // 0 to 1
  readonly progressBarColor?: string;
  readonly fullWidth?: boolean;
  readonly actionLabel?: string;
  readonly onActionPress?: () => void;
  readonly onPress?: () => void;
  readonly style?: ViewStyle;
}

export function BentoCard({
  title,
  value,
  unit,
  subtitle,
  icon,
  iconBgColor,
  cardBgColor,
  titleColor,
  valueColor,
  subtitleColor,
  progress,
  progressBarColor,
  fullWidth = false,
  actionLabel,
  onActionPress,
  onPress,
  style,
}: BentoCardProps): React.JSX.Element {
  const theme = useTheme();
  const isInteractive = typeof onPress === 'function';
  const isDark = theme.dark;

  const isDefaultSurface = !cardBgColor || cardBgColor === theme.colors.surface;
  const resolvedBg = isDefaultSurface
    ? (isDark ? theme.colors.elevation.level1 : theme.colors.surface)
    : cardBgColor;
  const activeProgressColor = progressBarColor || theme.colors.primary;

  return (
    <TouchableOpacity
      activeOpacity={isInteractive ? 0.85 : 1}
      onPress={onPress}
      disabled={!isInteractive}
      style={[
        styles.card,
        {
          borderRadius: fullWidth ? 28 : 24,
          paddingHorizontal: fullWidth ? 16 : 13,
          backgroundColor: resolvedBg,
          borderWidth: isDark && !fullWidth ? 1 : 0,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
          flex: fullWidth ? 0 : 1,
          width: fullWidth ? '100%' : undefined,
          minHeight: fullWidth ? 98 : 108,
        },
        style,
      ]}
      accessibilityRole={isInteractive ? 'button' : 'text'}
      accessibilityLabel={`${title}: ${value}${unit ? ` ${unit}` : ''}${subtitle ? `, ${subtitle}` : ''}`}>
      
      <View style={[styles.contentRow, { gap: fullWidth ? 12 : 9 }]}>
        {/* Left: Icon inside clean circular bubble */}
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: iconBgColor || theme.colors.surface,
              width: fullWidth ? 48 : 40,
              height: fullWidth ? 48 : 40,
              borderRadius: fullWidth ? 24 : 20,
            },
          ]}>
          {icon}
        </View>

        {/* Center: Details */}
        <View style={styles.detailsContainer}>
          <Text
            style={[
              styles.titleText,
              { color: titleColor || theme.colors.onSurfaceVariant },
            ]}
            numberOfLines={2}>
            {title}
          </Text>

          {/* Value and unit rendered inline to guarantee baseline alignment and adaptive fit */}
          <Text
            style={[
              styles.valueText,
              { color: valueColor || theme.colors.onSurface },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.82}>
            {value}
            {unit != null && unit.length > 0 && (
              <Text
                style={[
                  styles.unitText,
                  { color: valueColor || theme.colors.onSurface },
                ]}>
                {' ' + unit}
              </Text>
            )}
          </Text>

          {subtitle != null && (
            <Text
              style={[
                styles.subtitleText,
                { color: subtitleColor || theme.colors.onSurfaceVariant },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}>
              {subtitle}
            </Text>
          )}
        </View>

        {/* Right: Optional in-widget quick-action button */}
        {actionLabel != null && onActionPress != null && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onActionPress}
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}>
            <Text style={[styles.actionButtonText, { color: theme.colors.onPrimary }]}>
              {actionLabel}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Horizontal progress bar */}
      {progress != null && (
        <View
          style={[
            styles.progressTrack,
            {
              backgroundColor: fullWidth
                ? (isDark ? 'rgba(255, 255, 255, 0.15)' : theme.colors.surface)
                : (isDark ? 'rgba(255, 255, 255, 0.08)' : theme.colors.surfaceVariant),
              marginTop: subtitle ? 8 : 10,
            },
          ]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: activeProgressColor,
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
    paddingVertical: 14,
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  detailsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 12.5,
    fontWeight: '500',
    lineHeight: 15,
    marginBottom: 2,
  },
  valueText: {
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  unitText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  subtitleText: {
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 2,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressTrack: {
    height: 4.5,
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2.5,
  },
});
