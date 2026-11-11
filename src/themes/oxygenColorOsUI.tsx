/**
 * Dedicated OxygenOS / ColorOS UI presentation components for Ayumi.
 *
 * Isolates OEM-styled visual containers and controls inside `src/themes/` without
 * touching any Default theme component trees:
 *  - `OxygenAmbientBackdrop`: dynamic top-right multi-stop ambient wash
 *  - `OxygenStepHeroCard`: split left readout + concentric gradient circular progress ring
 *  - `OxygenMetricCard`: balanced top-header / bottom-metric 2x2 grid card
 *  - `OxygenWaterHomeCard`: full-width hydration card with `+ 250 ml` action pill
 *  - `OxygenColorOsDockBar`: Lucide/filled labeled dock synced to pager & metric accents
 *  - `SettingsSectionGroup`: modular grouped card wrapper for Settings lists
 *  - `ThemeOptionCard`: live multi-accent preview theme selector card
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { RadioButton, Text, useTheme } from 'react-native-paper';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { useReducedMotion } from '../theme/motion';
import { oxygenColorOsThemeDefinition } from './oxygenColorOsTheme';
import {
  OXYGEN_ICON_SPEC,
  OxygenDockHomeIcon,
  OxygenDockSettingsIcon,
  OxygenDockStatsIcon,
  OxygenDockWaterIcon,
  OxygenFootstepsIcon,
} from './oxygenIcons';
import {
  colorWithOpacity,
  hexToOklch,
  oklchToHex,
  resolveMetricBadgeColors,
} from './paletteUtils';
import type {
  AyumiProgressTokens,
  AyumiShapeTokens,
  AyumiSurfaceTokens,
  AyumiThemeDefinition,
  AyumiTypographyTokens,
  DockPresentationProps,
  MetricAccentRoles,
} from './types';

/**
 * Derives a luminous highlight stop from an Oklch accent color so progress rings and
 * vertical chart bars render subtle OxygenOS depth without hardcoded palette hexes.
 */
export function deriveGradientHighlightHex(hexColor: string, isDark: boolean): string {
  const lch = hexToOklch(hexColor);
  if (!lch) {
    return hexColor;
  }
  const isNeutral = lch.C < 0.015;
  const targetL = isDark
    ? Math.min(0.88, lch.L + 0.14)
    : Math.min(0.84, Math.max(0.68, lch.L + 0.16));
  const targetC = isNeutral ? 0 : Math.max(0.03, lch.C * 0.92);
  const targetHue = isNeutral ? 0 : (lch.h - 10 + 360) % 360;
  return oklchToHex({ L: targetL, C: targetC, h: targetHue });
}

interface OxygenAmbientBackdropProps {
  readonly enabled: boolean;
  readonly primaryHex: string;
  readonly secondaryHex?: string;
  readonly isDark: boolean;
  readonly testID?: string;
}

/**
 * Dynamic top-right multi-stop ambient glow backdrop isolated to OxygenOS / ColorOS screens.
 * Never renders when `enabled` is false so Default Ayumi surfaces stay 100% solid.
 */
export function OxygenAmbientBackdrop({
  enabled,
  primaryHex,
  secondaryHex,
  isDark,
  testID = 'oxygen-ambient-backdrop',
}: OxygenAmbientBackdropProps): React.JSX.Element | null {
  if (!enabled) {
    return null;
  }

  const resolvedSecondary = secondaryHex ?? deriveGradientHighlightHex(primaryHex, isDark);
  const primaryPeakOpacity = isDark ? 0.25 : 0.36;
  const primaryMidOpacity = isDark ? 0.11 : 0.16;
  const secondaryPeakOpacity = isDark ? 0.18 : 0.26;
  const secondaryMidOpacity = isDark ? 0.06 : 0.1;

  return (
    <View testID={testID} style={styles.ambientBackdropLayer} pointerEvents="none">
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 400 340"
        preserveAspectRatio="xMaxYMin slice">
        <Defs>
          <RadialGradient id="oxygenAmbientPrimary" cx="86%" cy="15%" rx="64%" ry="58%">
            <Stop offset="0%" stopColor={primaryHex} stopOpacity={primaryPeakOpacity} />
            <Stop offset="46%" stopColor={primaryHex} stopOpacity={primaryMidOpacity} />
            <Stop offset="100%" stopColor={primaryHex} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="oxygenAmbientSecondary" cx="54%" cy="6%" rx="50%" ry="46%">
            <Stop offset="0%" stopColor={resolvedSecondary} stopOpacity={secondaryPeakOpacity} />
            <Stop offset="50%" stopColor={resolvedSecondary} stopOpacity={secondaryMidOpacity} />
            <Stop offset="100%" stopColor={resolvedSecondary} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="400" height="340" fill="url(#oxygenAmbientSecondary)" />
        <Rect x="0" y="0" width="400" height="340" fill="url(#oxygenAmbientPrimary)" />
      </Svg>
    </View>
  );
}

interface OxygenStepHeroCardProps {
  readonly steps: number;
  readonly goal: number;
  readonly onPress?: () => void;
  readonly progress: AyumiProgressTokens;
  readonly surfaces: AyumiSurfaceTokens;
  readonly typography: AyumiTypographyTokens;
  readonly metricAccents: MetricAccentRoles;
  readonly border: { readonly borderWidth: number; readonly borderColor: string };
}

const OEM_RING_SIZE = 102;
const OEM_RING_CENTER = OEM_RING_SIZE / 2;

/**
 * Modular OxygenOS / ColorOS Hero Steps card balancing a prominent tabular step figure
 * on the left with a clean percentage-centered circular progress ring on the right.
 */
export function OxygenStepHeroCard({
  steps,
  goal,
  onPress,
  progress,
  surfaces,
  typography,
  metricAccents,
  border,
}: OxygenStepHeroCardProps): React.JSX.Element {
  const theme = useTheme();
  const isDark = theme.dark;
  const reducedMotion = useReducedMotion();
  const stepsAccent = metricAccents.steps;
  const stepsBadge = resolveMetricBadgeColors(stepsAccent, surfaces.badgeStyle);

  const strokeWidth = progress.heroStrokeWidth;
  const radius = OEM_RING_CENTER - strokeWidth / 2 - 2;
  const circumference = 2 * Math.PI * radius;
  const targetRatio = goal > 0 ? Math.min(Math.max(steps / goal, 0), 1) : 0;

  const progressAnim = useRef(new Animated.Value(targetRatio)).current;
  const [animatedRatio, setAnimatedRatio] = useState(targetRatio);

  useEffect(() => {
    const listenerId = progressAnim.addListener(({ value }) => {
      setAnimatedRatio(value);
    });
    if (reducedMotion) {
      progressAnim.setValue(targetRatio);
      setAnimatedRatio(targetRatio);
    } else {
      Animated.timing(progressAnim, {
        toValue: targetRatio,
        duration: 460,
        easing: Easing.bezier(0.2, 0.0, 0.0, 1.0),
        useNativeDriver: false,
      }).start();
    }
    return () => {
      progressAnim.removeListener(listenerId);
    };
  }, [progressAnim, reducedMotion, targetRatio]);

  const displayRatio = Math.min(Math.max(animatedRatio, 0), 1);
  const dashOffset = circumference - circumference * displayRatio;
  const percent = Math.round(targetRatio * 100);

  const cardBg = isDark ? theme.colors.elevation.level1 : theme.colors.surface;
  const trackColor = colorWithOpacity(theme.colors.onSurface, isDark ? 0.12 : 0.075);
  const heroHighlightColor = deriveGradientHighlightHex(stepsAccent.color, isDark);

  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      disabled={!onPress}
      testID="oxygen-step-hero-card"
      style={[
        styles.heroCard,
        {
          borderRadius: surfaces.fullWidthCardRadius,
          backgroundColor: cardBg,
          borderWidth: border.borderWidth,
          borderColor: border.borderColor,
          elevation: surfaces.cardElevation,
          shadowOpacity: surfaces.cardShadowOpacity,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Steps today: ${steps.toLocaleString()} out of ${goal.toLocaleString()}, ${percent} percent`}>
      <View style={styles.heroRow}>
        <View style={styles.heroLeftCol}>
          <View style={styles.heroLabelRow}>
            <View
              testID="oxygen-hero-steps-badge"
              style={[styles.heroIconBadge, { backgroundColor: stepsBadge.bg }]}>
              <OxygenFootstepsIcon
                size={17}
                color={stepsBadge.fg}
                filled={surfaces.badgeStyle === 'solid'}
              />
            </View>
            <Text style={[styles.heroLabelText, { color: theme.colors.onSurfaceVariant }]}>
              Steps
            </Text>
          </View>

          <Text
            style={[
              styles.heroValueText,
              { color: theme.colors.onSurface, fontWeight: typography.statValueWeight },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.78}>
            {steps.toLocaleString()}
          </Text>

          <Text
            style={[styles.heroGoalText, { color: theme.colors.onSurfaceVariant }]}
            numberOfLines={1}>
            of {goal.toLocaleString()} steps
          </Text>
        </View>

        <View style={styles.heroRingBox}>
          <Svg width={OEM_RING_SIZE} height={OEM_RING_SIZE}>
            <Defs>
              <LinearGradient id="oxygenHeroRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={heroHighlightColor} />
                <Stop offset="100%" stopColor={stepsAccent.color} />
              </LinearGradient>
            </Defs>
            <Circle
              cx={OEM_RING_CENTER}
              cy={OEM_RING_CENTER}
              r={radius}
              stroke={trackColor}
              strokeWidth={strokeWidth}
              fill="none"
            />
            {displayRatio > 0 && (
              <Circle
                cx={OEM_RING_CENTER}
                cy={OEM_RING_CENTER}
                r={radius}
                stroke="url(#oxygenHeroRingGrad)"
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                transform={`rotate(-90, ${OEM_RING_CENTER}, ${OEM_RING_CENTER})`}
              />
            )}
          </Svg>
          <View style={styles.heroRingCenter} pointerEvents="none">
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.heroPercentText,
                { color: theme.colors.onSurface, fontWeight: typography.statValueWeight },
              ]}>
              {percent}%
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

interface OxygenMetricCardProps {
  readonly title: string;
  readonly value: string | number;
  readonly unit?: string;
  readonly subtitle?: string;
  readonly icon: React.ReactNode;
  readonly accentColor: string;
  readonly badgeBgColor: string;
  readonly surfaces: AyumiSurfaceTokens;
  readonly typography: AyumiTypographyTokens;
  readonly progress: AyumiProgressTokens;
  readonly progressFillWidth?: Animated.AnimatedInterpolation<string> | `${number}%` | number;
  readonly hasProgressBar?: boolean;
}

/**
 * Compact 2x2 grid inner card layout for OxygenOS / ColorOS with top-aligned icon badge
 * and bottom-anchored tabular metric readout, eliminating dead vertical voids.
 */
export function OxygenMetricCard({
  title,
  value,
  unit,
  subtitle,
  icon,
  accentColor,
  badgeBgColor,
  typography,
  progress,
  progressFillWidth = '0%',
  hasProgressBar = false,
}: OxygenMetricCardProps): React.JSX.Element {
  const theme = useTheme();
  const trackBg = colorWithOpacity(
    theme.colors.onSurface,
    theme.dark ? 0.12 : 0.08,
  );

  return (
    <View testID="oxygen-metric-card-body" style={styles.metricCardContainer}>
      <View style={styles.metricHeaderRow}>
        <View style={[styles.metricBadge, { backgroundColor: badgeBgColor }]}>
          {icon}
        </View>
        <Text
          style={[styles.metricTitle, { color: theme.colors.onSurfaceVariant }]}
          numberOfLines={2}>
          {title}
        </Text>
      </View>

      <View style={styles.metricFooterBlock}>
        <Text
          style={[
            styles.metricValue,
            {
              color: theme.colors.onSurface,
              fontSize: typography.bentoValueSize,
              fontWeight: typography.statValueWeight,
            },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.78}>
          {value}
          {unit ? (
            <Text style={[styles.metricUnit, { color: theme.colors.onSurfaceVariant }]}>
              {` ${unit}`}
            </Text>
          ) : null}
        </Text>

        {subtitle ? (
          <Text
            style={[styles.metricSubtitle, { color: theme.colors.onSurfaceVariant }]}
            numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}

        {hasProgressBar ? (
          <View
            style={[
              styles.linearTrack,
              styles.metricProgressSpacing,
              {
                height: progress.linearTrackHeight,
                backgroundColor: trackBg,
              },
            ]}>
            <Animated.View
              style={[
                styles.linearFill,
                {
                  width: progressFillWidth,
                  backgroundColor: accentColor,
                },
              ]}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

interface OxygenWaterHomeCardProps {
  readonly title: string;
  readonly value: string | number;
  readonly unit?: string;
  readonly subtitle?: string;
  readonly icon: React.ReactNode;
  readonly accentColor: string;
  readonly onAccentColor: string;
  readonly badgeBgColor: string;
  readonly typography: AyumiTypographyTokens;
  readonly progress: AyumiProgressTokens;
  readonly progressFillWidth?: Animated.AnimatedInterpolation<string> | `${number}%` | number;
  readonly actionLabel: string;
  readonly onActionPress?: () => void;
}

/**
 * Full-width OxygenOS / ColorOS Water summary body for Home with crisp Lucide droplet
 * squircle badge, cerulean `+ 250 ml` quick-add pill, and bottom hydration track.
 */
export function OxygenWaterHomeCard({
  title,
  value,
  unit,
  subtitle,
  icon,
  accentColor,
  onAccentColor,
  badgeBgColor,
  typography,
  progress,
  progressFillWidth = '0%',
  actionLabel,
  onActionPress,
}: OxygenWaterHomeCardProps): React.JSX.Element {
  const theme = useTheme();
  const trackBg = colorWithOpacity(
    accentColor,
    theme.dark ? 0.2 : 0.14,
  );

  return (
    <View testID="oxygen-water-home-card-body">
      <View style={styles.waterTopRow}>
        <View style={styles.waterInfoCol}>
          <View style={styles.waterLabelRow}>
            <View style={[styles.metricBadge, { backgroundColor: badgeBgColor }]}>
              {icon}
            </View>
            <Text style={[styles.metricTitle, { color: theme.colors.onSurfaceVariant }]}>
              {title}
            </Text>
          </View>

          <View style={styles.waterValueRow}>
            <Text
              style={[
                styles.metricValue,
                {
                  color: theme.colors.onSurface,
                  fontSize: typography.bentoValueSize,
                  fontWeight: typography.statValueWeight,
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit>
              {value}
              {unit ? (
                <Text style={[styles.metricUnit, { color: theme.colors.onSurfaceVariant }]}>
                  {` ${unit}`}
                </Text>
              ) : null}
            </Text>

            {subtitle ? (
              <Text
                style={[styles.waterSubtitleText, { color: theme.colors.onSurfaceVariant }]}
                numberOfLines={1}>
                {`• ${subtitle}`}
              </Text>
            ) : null}
          </View>
        </View>

        {onActionPress ? (
          <TouchableOpacity
            testID="water-quick-add-btn"
            style={[styles.waterActionPill, { backgroundColor: accentColor }]}
            onPress={onActionPress}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}>
            <Text style={[styles.waterActionPillText, { color: onAccentColor }]}>
              {actionLabel}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View
        style={[
          styles.linearTrack,
          styles.waterProgressSpacing,
          {
            height: progress.linearTrackHeight,
            backgroundColor: trackBg,
          },
        ]}>
        <Animated.View
          style={[
            styles.linearFill,
            {
              width: progressFillWidth,
              backgroundColor: accentColor,
            },
          ]}
        />
      </View>
    </View>
  );
}

interface OxygenDockRenderProps extends DockPresentationProps {
  readonly shapes: AyumiShapeTokens;
  readonly pillWidth: number;
  readonly pillHeight: number;
  readonly metricAccents: MetricAccentRoles;
}

/**
 * OxygenOS / ColorOS floating navigation dock with filled active glyphs, monoline
 * idle icons, per-destination accent capsules (without hard inner borders), and
 * spring-synchronized sliding pill transitions.
 */
export function OxygenColorOsDockBar({
  activeTab,
  activeStatsMetric = 'steps',
  containerWidth,
  bottomOffset,
  indicatorTranslateX,
  indicatorScaleX,
  indicatorScaleY,
  shapes,
  pillWidth,
  pillHeight,
  metricAccents,
  onLayout,
  onHomePress,
  onAnalyticsPress,
  onWaterPress,
  onProfilePress,
}: OxygenDockRenderProps): React.JSX.Element {
  const theme = useTheme();
  const isDark = theme.dark;

  const dockBg = isDark ? theme.colors.elevation.level1 : theme.colors.surface;
  const dockBorder = isDark
    ? colorWithOpacity(theme.colors.onSurface, 0.1)
    : colorWithOpacity(theme.colors.onSurface, 0.055);
  const pillTop = Math.max((shapes.dockHeight - pillHeight) / 2, 4);
  const pillRadius = Math.min(pillHeight / 2, 26);

  const tabTintById: Record<'home' | 'stats' | 'water' | 'settings', string> = {
    home: theme.colors.primary,
    stats: metricAccents[activeStatsMetric].color,
    water: metricAccents.water.color,
    settings: theme.colors.primary,
  };

  const activePillTint = tabTintById[activeTab] ?? theme.colors.primary;
  const activePillBg = colorWithOpacity(activePillTint, isDark ? 0.24 : 0.14);
  const idleTint = isDark
    ? theme.colors.onSurfaceVariant
    : colorWithOpacity(theme.colors.onSurface, 0.72);

  const tabs: ReadonlyArray<{
    readonly id: 'home' | 'stats' | 'water' | 'settings';
    readonly label: string;
    readonly accessibilityLabel: string;
    readonly onPress?: () => void;
    readonly renderIcon: (color: string, active: boolean) => React.ReactNode;
  }> = [
    {
      id: 'home',
      label: 'Home',
      accessibilityLabel: 'Home tab',
      onPress: onHomePress,
      renderIcon: (color, active) => (
        <OxygenDockHomeIcon size={21} filled={active} color={color} />
      ),
    },
    {
      id: 'stats',
      label: 'Stats',
      accessibilityLabel: 'Stats tab',
      onPress: onAnalyticsPress,
      renderIcon: (color, active) => (
        <OxygenDockStatsIcon size={21} filled={active} color={color} />
      ),
    },
    {
      id: 'water',
      label: 'Water',
      accessibilityLabel: 'Water tab',
      onPress: onWaterPress,
      renderIcon: (color, active) => (
        <OxygenDockWaterIcon size={21} filled={active} color={color} />
      ),
    },
    {
      id: 'settings',
      label: 'Settings',
      accessibilityLabel: 'Settings tab',
      onPress: onProfilePress,
      renderIcon: (color, active) => (
        <OxygenDockSettingsIcon size={21} filled={active} color={color} />
      ),
    },
  ];

  return (
    <View
      style={[styles.dockWrapper, { bottom: bottomOffset }]}
      pointerEvents="box-none">
      <View
        onLayout={onLayout}
        style={[
          styles.dockContainer,
          {
            width: shapes.dockWidthPercent,
            maxWidth: shapes.dockMaxWidth,
            height: shapes.dockHeight,
            borderRadius: shapes.dockRadius,
            paddingHorizontal: shapes.dockPaddingHorizontal,
            backgroundColor: dockBg,
            borderColor: dockBorder,
          },
        ]}>
        {/* Sliding highlighted capsule synchronized with pager & squeeze springs */}
        {containerWidth > 0 && (
          <View
            style={[styles.pillTrackClip, { borderRadius: shapes.dockRadius }]}
            pointerEvents="none">
            <Animated.View
              testID="oxygen-dock-active-pill"
              style={[
                styles.slidingIndicatorPill,
                {
                  width: pillWidth,
                  height: pillHeight,
                  top: pillTop,
                  borderRadius: pillRadius,
                  backgroundColor: activePillBg,
                  transform: [
                    { translateX: indicatorTranslateX },
                    { scaleX: indicatorScaleX },
                    { scaleY: indicatorScaleY },
                  ],
                },
              ]}
            />
          </View>
        )}

        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          const tint = isActive ? tabTintById[tab.id] : idleTint;
          return (
            <TouchableOpacity
              key={tab.id}
              activeOpacity={0.8}
              onPress={tab.onPress}
              style={styles.tabSlot}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.accessibilityLabel}>
              {tab.renderIcon(tint, isActive)}
              <Text
                numberOfLines={1}
                style={[
                  styles.tabLabel,
                  isActive ? styles.tabLabelActive : styles.tabLabelInactive,
                  { color: tint },
                ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

interface SettingsSectionGroupProps {
  readonly grouped: boolean;
  readonly surfaces: AyumiSurfaceTokens;
  readonly children: React.ReactNode;
}

/**
 * Wraps Settings sections in modular OxygenOS / ColorOS cards when grouped mode
 * is active, leaving flat list presentation intact under the Default theme.
 */
export function SettingsSectionGroup({
  grouped,
  surfaces,
  children,
}: SettingsSectionGroupProps): React.JSX.Element {
  const theme = useTheme();
  const isDark = theme.dark;

  if (!grouped) {
    return <View>{children}</View>;
  }

  return (
    <View
      style={[
        styles.settingsCard,
        {
          borderRadius: surfaces.sectionCardRadius,
          backgroundColor: isDark
            ? theme.colors.elevation.level1
            : theme.colors.surface,
          borderColor: isDark
            ? colorWithOpacity(theme.colors.onSurface, 0.09)
            : theme.colors.outlineVariant,
        },
      ]}>
      {children}
    </View>
  );
}

interface ThemeOptionCardProps {
  readonly option: AyumiThemeDefinition;
  readonly isSelected: boolean;
  readonly isActiveSession: boolean;
  readonly pendingRestart: boolean;
  readonly onSelect: (themeId: AyumiThemeDefinition['id']) => void;
}

/**
 * Settings Theme selector option displaying a compact live-palette miniature
 * preview alongside the theme name, concise description, status badge, and radio.
 */
export function ThemeOptionCard({
  option,
  isSelected,
  isActiveSession,
  pendingRestart,
  onSelect,
}: ThemeOptionCardProps): React.JSX.Element {
  const theme = useTheme();
  const isDark = theme.dark;
  const isOemPreview = option.id === 'oxygen_coloros';

  const cardBg = isSelected
    ? colorWithOpacity(theme.colors.primary, isDark ? 0.2 : 0.08)
    : isDark
    ? theme.colors.elevation.level2
    : theme.colors.background;

  const borderColor = isSelected
    ? theme.colors.primary
    : theme.colors.outlineVariant;

  const oemPreviewAccents = React.useMemo(
    () =>
      isOemPreview
        ? oxygenColorOsThemeDefinition.getMetricAccents(theme.colors, isDark)
        : null,
    [isOemPreview, theme.colors, isDark],
  );

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={() => onSelect(option.id)}
      style={[
        styles.themeOptionCard,
        isSelected ? styles.themeOptionBorderSelected : styles.themeOptionBorderIdle,
        {
          backgroundColor: cardBg,
          borderColor,
        },
      ]}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={`${option.name}. ${option.shortDescription}`}>
      {/* Miniature dynamic-palette preview matching current system colors */}
      <View
        style={[
          styles.previewBox,
          {
            backgroundColor: isDark
              ? theme.colors.elevation.level3
              : theme.colors.background,
            borderColor: theme.colors.outlineVariant,
            borderRadius: isOemPreview ? 14 : 16,
          },
        ]}>
        <View style={styles.previewSwatchesRow}>
          {isOemPreview && oemPreviewAccents ? (
            <>
              <View
                style={[
                  styles.previewDotSmall,
                  { backgroundColor: oemPreviewAccents.steps.badgeBg ?? oemPreviewAccents.steps.color },
                ]}
              />
              <View
                style={[
                  styles.previewDotSmall,
                  { backgroundColor: oemPreviewAccents.calories.badgeBg ?? oemPreviewAccents.calories.color },
                ]}
              />
              <View
                style={[
                  styles.previewDotSmall,
                  { backgroundColor: oemPreviewAccents.distance.badgeBg ?? oemPreviewAccents.distance.color },
                ]}
              />
              <View
                style={[
                  styles.previewDotSmall,
                  { backgroundColor: oemPreviewAccents.water.badgeBg ?? oemPreviewAccents.water.color },
                ]}
              />
            </>
          ) : (
            <>
              <View
                style={[styles.previewDot, { backgroundColor: theme.colors.primary }]}
              />
              <View
                style={[
                  styles.previewWidePill,
                  { backgroundColor: theme.colors.primaryContainer },
                ]}
              />
            </>
          )}
        </View>
        <View
          style={[
            styles.previewMockCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.outlineVariant,
              borderWidth: isOemPreview ? 1 : 0,
            },
          ]}
        />
      </View>

      {/* Title, badge & short description */}
      <View style={styles.themeTextCol}>
        <View style={styles.themeTitleRow}>
          <Text
            style={[styles.themeTitleText, { color: theme.colors.onSurface }]}
            numberOfLines={1}>
            {option.name}
          </Text>
          {pendingRestart ? (
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: theme.colors.tertiaryContainer },
              ]}>
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: theme.colors.onTertiaryContainer },
                ]}>
                Restart to apply
              </Text>
            </View>
          ) : isActiveSession ? (
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: theme.colors.surface },
              ]}>
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: theme.colors.primary },
                ]}>
                Active
              </Text>
            </View>
          ) : null}
        </View>

        <Text
          style={[styles.themeDescriptionText, { color: theme.colors.onSurfaceVariant }]}
          numberOfLines={2}>
          {option.shortDescription}
        </Text>
      </View>

      {/* Radio selection indicator */}
      <View pointerEvents="none">
        <RadioButton
          value={option.id}
          status={isSelected ? 'checked' : 'unchecked'}
          color={theme.colors.primary}
          uncheckedColor={theme.colors.onSurfaceVariant}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  ambientBackdropLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 340,
    overflow: 'hidden',
    zIndex: 0,
  },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 18,
    paddingVertical: 15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  heroLeftCol: {
    flex: 1,
    justifyContent: 'center',
  },
  heroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  heroIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabelText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  heroValueText: {
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '800',
    letterSpacing: -1.1,
    fontVariant: ['tabular-nums'],
  },
  heroGoalText: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  heroRingBox: {
    width: OEM_RING_SIZE,
    height: OEM_RING_SIZE,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRingCenter: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPercentText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  metricCardContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    minHeight: 72,
  },
  metricHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 34,
  },
  metricBadge: {
    width: 32,
    height: 32,
    borderRadius: OXYGEN_ICON_SPEC.metricBadgeRadius,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  metricTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 16,
    letterSpacing: -0.1,
  },
  metricFooterBlock: {
    marginTop: 12,
  },
  metricValue: {
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  metricUnit: {
    fontSize: 13,
    fontWeight: '600',
  },
  metricSubtitle: {
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 2,
  },
  linearTrack: {
    borderRadius: 99,
    overflow: 'hidden',
  },
  metricProgressSpacing: {
    marginTop: 7,
  },
  waterProgressSpacing: {
    marginTop: 10,
  },
  linearFill: {
    height: '100%',
    borderRadius: 99,
  },
  waterTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  waterInfoCol: {
    flex: 1,
    gap: 8,
  },
  waterLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  waterValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 7,
  },
  waterSubtitleText: {
    fontSize: 12,
    fontWeight: '500',
  },
  waterActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    flexShrink: 0,
  },
  waterActionPillText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.1,
    fontVariant: ['tabular-nums'],
  },
  dockWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  },
  pillTrackClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  slidingIndicatorPill: {
    position: 'absolute',
    left: 0,
    zIndex: 0,
  },
  tabSlot: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    zIndex: 1,
  },
  tabLabel: {
    fontSize: 10.5,
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    fontWeight: '700',
  },
  tabLabelInactive: {
    fontWeight: '500',
  },
  settingsCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.035,
    shadowRadius: 8,
  },
  themeOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 12,
  },
  themeOptionBorderSelected: {
    borderWidth: 1.5,
  },
  themeOptionBorderIdle: {
    borderWidth: 1,
  },
  previewBox: {
    width: 50,
    height: 44,
    borderWidth: 1,
    padding: 6,
    justifyContent: 'space-between',
  },
  previewSwatchesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  previewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  previewDotSmall: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  previewWidePill: {
    width: 18,
    height: 7,
    borderRadius: 4,
  },
  previewMockCard: {
    height: 15,
    borderRadius: 6,
  },
  themeTextCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  themeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  themeTitleText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  themeDescriptionText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
});
