/**
 * BentoCard — a Material 3 Expressive widget tile.
 *
 * Implements aesthetic, tactile widget cells with:
 *  - Dynamic Material You tonal container backgrounds and contrast tokens
 *  - M3 Expressive shape modes (asymmetric corners, pill capsule, squircle)
 *  - Support for the 8-petal scalloped cookie icon badge
 *  - Optional in-widget micro-action pill buttons (such as quick-add water)
 *  - Rounded progress pill indicator and fluid water wave decoration
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Svg, { Path } from 'react-native-svg';
import { ScallopCookieBadge, PlusIcon } from './AestheticIcons';

export type BentoShapeVariant = 'squircle' | 'asymmetric' | 'pill';

interface BentoCardProps {
  readonly title: string;
  readonly value: string;
  readonly subtitle?: string;
  readonly icon: React.ReactNode;
  readonly iconBgColor?: string;
  readonly cardBgColor?: string;
  readonly borderColor?: string;
  readonly titleColor?: string;
  readonly valueColor?: string;
  readonly subtitleColor?: string;
  readonly progress?: number; // 0 to 1
  readonly progressBarColor?: string;
  readonly fullWidth?: boolean;
  readonly showWaterWave?: boolean;
  readonly shapeVariant?: BentoShapeVariant;
  readonly useScallopBadge?: boolean;
  readonly actionLabel?: string;
  readonly onActionPress?: () => void;
  readonly onPress?: () => void;
  readonly style?: ViewStyle;
}

export function BentoCard({
  title,
  value,
  subtitle,
  icon,
  iconBgColor,
  cardBgColor,
  borderColor,
  titleColor,
  valueColor,
  subtitleColor,
  progress,
  progressBarColor,
  fullWidth = false,
  showWaterWave = false,
  shapeVariant = 'squircle',
  useScallopBadge = false,
  actionLabel,
  onActionPress,
  onPress,
  style,
}: BentoCardProps): React.JSX.Element {
  const theme = useTheme();
  const isInteractive = typeof onPress === 'function';

  // Compute corner styles based on shapeVariant
  const shapeStyle = React.useMemo(() => {
    switch (shapeVariant) {
      case 'asymmetric':
        return {
          borderTopLeftRadius: 28,
          borderTopRightRadius: 14,
          borderBottomRightRadius: 28,
          borderBottomLeftRadius: 14,
        };
      case 'pill':
        return {
          borderRadius: 26,
        };
      case 'squircle':
      default:
        return {
          borderRadius: 24,
        };
    }
  }, [shapeVariant]);

  const defaultBg = theme.colors.surfaceVariant;
  const defaultBorder = theme.colors.outlineVariant;
  const activeProgressColor = progressBarColor || theme.colors.primary;

  return (
    <TouchableOpacity
      activeOpacity={isInteractive ? 0.85 : 1}
      onPress={onPress}
      disabled={!isInteractive}
      style={[
        styles.card,
        shapeStyle,
        {
          backgroundColor: cardBgColor || defaultBg,
          borderColor: borderColor || defaultBorder,
          flex: fullWidth ? 0 : 1,
          width: fullWidth ? '100%' : undefined,
          minHeight: fullWidth ? 96 : 106,
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
              fill={theme.colors.primary}
              opacity={0.15}
            />
          </Svg>
        </View>
      )}

      <View style={styles.contentRow}>
        {/* Left: Icon container */}
        {useScallopBadge ? (
          <View style={styles.scallopWrapper}>
            <ScallopCookieBadge
              size={46}
              bgColor={iconBgColor || theme.colors.surface}>
              <View style={styles.scallopInnerIcon}>{icon}</View>
            </ScallopCookieBadge>
          </View>
        ) : (
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: iconBgColor || theme.colors.surface },
            ]}>
            {icon}
          </View>
        )}

        {/* Center: Metric details */}
        <View style={styles.detailsContainer}>
          <Text
            style={[
              styles.titleText,
              { color: titleColor || theme.colors.onSurfaceVariant },
            ]}
            numberOfLines={2}>
            {title}
          </Text>
          <Text
            style={[
              styles.valueText,
              { color: valueColor || theme.colors.onSurface },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {value}
          </Text>
          {subtitle != null && (
            <Text
              style={[
                styles.subtitleText,
                { color: subtitleColor || theme.colors.onSurfaceVariant },
              ]}
              numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        {/* Optional trailing in-widget action button */}
        {actionLabel != null && onActionPress != null && (
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={onActionPress}
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}>
            <PlusIcon size={14} color={theme.colors.onPrimary} />
            <Text style={[styles.actionButtonText, { color: theme.colors.onPrimary }]}>
              {actionLabel}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Progress pill bar */}
      {progress != null && (
        <View
          style={[
            styles.progressTrack,
            { backgroundColor: theme.colors.surface },
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
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 14,
    position: 'relative',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  scallopWrapper: {
    width: 46,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    position: 'relative',
  },
  scallopInnerIcon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 16,
    marginBottom: 2,
  },
  valueText: {
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 2,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 18,
    gap: 4,
    flexShrink: 0,
  },
  actionButtonText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  progressTrack: {
    height: 5.5,
    borderRadius: 3,
    marginTop: 10,
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
