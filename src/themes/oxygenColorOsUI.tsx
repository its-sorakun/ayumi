/**
 * Dedicated OxygenOS / ColorOS UI presentation components for Ayumi.
 *
 * Keeps OEM-styled visual containers and controls isolated inside `src/themes/`:
 *  - `OxygenColorOsDockBar`: labeled icon+text floating capsule synced to pager progress
 *  - `SettingsSectionGroup`: modular grouped card wrapper for Settings lists
 *  - `ThemeOptionCard`: dynamic-palette theme picker card showing live accent swatches
 */

import React from 'react';
import {
  Animated,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { RadioButton, Text, useTheme } from 'react-native-paper';

import {
  DockChartIcon,
  DockHomeIcon,
  DockWaterIcon,
  SettingsGearIcon,
} from '../components/AestheticIcons';
import type {
  AyumiShapeTokens,
  AyumiSurfaceTokens,
  AyumiThemeDefinition,
  DockPresentationProps,
} from './types';

interface OxygenDockRenderProps extends DockPresentationProps {
  readonly shapes: AyumiShapeTokens;
  readonly pillWidth: number;
  readonly pillHeight: number;
}

/**
 * OxygenOS / ColorOS floating navigation dock with compact icons, crisp labels,
 * hairline surface separation, and continuous pill indicator motion.
 */
export function OxygenColorOsDockBar({
  activeTab,
  containerWidth,
  bottomOffset,
  indicatorTranslateX,
  indicatorScaleX,
  indicatorScaleY,
  shapes,
  pillWidth,
  pillHeight,
  onLayout,
  onHomePress,
  onAnalyticsPress,
  onWaterPress,
  onProfilePress,
}: OxygenDockRenderProps): React.JSX.Element {
  const theme = useTheme();
  const isDark = theme.dark;

  const dockBg = isDark ? theme.colors.elevation.level1 : theme.colors.surface;
  const dockBorder = theme.colors.outlineVariant;
  const pillTop = Math.max((shapes.dockHeight - pillHeight) / 2, 4);
  const pillRadius = Math.min(pillHeight / 2, 24);

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
      renderIcon: color => <DockHomeIcon size={19} color={color} />,
    },
    {
      id: 'stats',
      label: 'Stats',
      accessibilityLabel: 'Stats tab',
      onPress: onAnalyticsPress,
      renderIcon: color => <DockChartIcon size={19} color={color} />,
    },
    {
      id: 'water',
      label: 'Water',
      accessibilityLabel: 'Water tab',
      onPress: onWaterPress,
      renderIcon: (color, active) => (
        <DockWaterIcon size={19} filled={active} color={color} />
      ),
    },
    {
      id: 'settings',
      label: 'Settings',
      accessibilityLabel: 'Settings tab',
      onPress: onProfilePress,
      renderIcon: color => <SettingsGearIcon size={19} color={color} />,
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
              style={[
                styles.slidingIndicatorPill,
                {
                  width: pillWidth,
                  height: pillHeight,
                  top: pillTop,
                  borderRadius: pillRadius,
                  backgroundColor: theme.colors.primaryContainer,
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
          const tint = isActive
            ? theme.colors.onPrimaryContainer
            : theme.colors.onSurfaceVariant;
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
          borderColor: theme.colors.outlineVariant,
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
    ? theme.colors.primaryContainer
    : isDark
    ? theme.colors.elevation.level2
    : theme.colors.elevation.level1;

  const borderColor = isSelected
    ? theme.colors.primary
    : theme.colors.outlineVariant;

  const titleColor = isSelected
    ? theme.colors.onPrimaryContainer
    : theme.colors.onSurface;
  const subtitleColor = isSelected
    ? theme.colors.onPrimaryContainer
    : theme.colors.onSurfaceVariant;

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
          <View
            style={[styles.previewDot, { backgroundColor: theme.colors.primary }]}
          />
          {isOemPreview ? (
            <>
              <View
                style={[
                  styles.previewDot,
                  { backgroundColor: theme.colors.secondary },
                ]}
              />
              <View
                style={[
                  styles.previewDot,
                  { backgroundColor: theme.colors.tertiary },
                ]}
              />
            </>
          ) : (
            <View
              style={[
                styles.previewWidePill,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
            />
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
            style={[styles.themeTitleText, { color: titleColor }]}
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
          style={[styles.themeDescriptionText, { color: subtitleColor }]}
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
    shadowOpacity: 0.04,
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
    width: 48,
    height: 44,
    borderWidth: 1,
    padding: 6,
    justifyContent: 'space-between',
  },
  previewSwatchesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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

