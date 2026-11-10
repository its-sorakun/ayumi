/**
 * FloatingDock — an aesthetic Material 3 Expressive bottom navigation capsule.
 *
 * Implements a floating pill dock with:
 *  - 28dp corner radius and dynamic Material You surface styling
 *  - Mathematically symmetrical three-column layout (flex: 1 per slot)
 *  - Active Home indicator with dynamic primaryContainer pill styling
 *  - Analytics shortcut for exploring step, distance, and calorie charts
 *  - Settings gear shortcut for configuring goals and sensor modes
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import { DockHomeIcon, DockChartIcon, SettingsGearIcon } from './AestheticIcons';

interface FloatingDockProps {
  readonly onHomePress?: () => void;
  readonly onAnalyticsPress?: () => void;
  readonly onProfilePress?: () => void;
}

export function FloatingDock({
  onHomePress,
  onAnalyticsPress,
  onProfilePress,
}: FloatingDockProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={styles.dockWrapper} pointerEvents="box-none">
      <View
        style={[
          styles.dockContainer,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outlineVariant,
          },
        ]}>
        {/* Slot 1: Active Home Tab */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onHomePress}
          style={styles.tabSlot}
          accessibilityRole="tab"
          accessibilityLabel="Home tab">
          <View
            style={[
              styles.activeTabBubble,
              { backgroundColor: theme.colors.primaryContainer },
            ]}>
            <DockHomeIcon size={20} color={theme.colors.onPrimaryContainer} />
          </View>
        </TouchableOpacity>

        {/* Slot 2: Analytics / Charts Tab */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onAnalyticsPress}
          style={styles.tabSlot}
          accessibilityRole="tab"
          accessibilityLabel="Analytics tab">
          <DockChartIcon size={20} color={theme.colors.onSurfaceVariant} />
        </TouchableOpacity>

        {/* Slot 3: Settings Tab */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onProfilePress}
          style={styles.tabSlot}
          accessibilityRole="tab"
          accessibilityLabel="Settings tab">
          <SettingsGearIcon size={20} color={theme.colors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dockWrapper: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '84%',
    maxWidth: 340,
    height: 56,
    borderRadius: 28,
    paddingHorizontal: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
  },
  tabSlot: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeTabBubble: {
    width: 64,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
