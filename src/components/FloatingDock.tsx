/**
 * FloatingDock — an aesthetic Material 3 Expressive bottom navigation capsule.
 *
 * Implements a floating pill dock with:
 *  - 32dp corner radius and dynamic Material You elevation
 *  - Active Home indicator with dynamic primaryContainer pill styling
 *  - Analytics shortcut for exploring step, distance, and calorie charts
 *  - Profile and settings shortcut for configuring goals and sensor modes
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import { DockHomeIcon, DockChartIcon, DockUserIcon } from './AestheticIcons';

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
            backgroundColor: theme.colors.elevation.level2,
            borderColor: theme.colors.outlineVariant,
          },
        ]}>
        {/* Active Home Tab with Expressive Pill highlight */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onHomePress}
          style={[
            styles.activeTabBubble,
            { backgroundColor: theme.colors.primaryContainer },
          ]}
          accessibilityRole="tab"
          accessibilityLabel="Home tab">
          <DockHomeIcon size={20} color={theme.colors.onPrimaryContainer} />
        </TouchableOpacity>

        {/* Analytics / Charts Tab */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onAnalyticsPress}
          style={styles.tabButton}
          accessibilityRole="tab"
          accessibilityLabel="Analytics tab">
          <DockChartIcon size={20} color={theme.colors.onSurfaceVariant} />
        </TouchableOpacity>

        {/* Settings / Profile Tab */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onProfilePress}
          style={styles.tabButton}
          accessibilityRole="tab"
          accessibilityLabel="Settings and profile tab">
          <DockUserIcon size={20} color={theme.colors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dockWrapper: {
    position: 'absolute',
    bottom: 16,
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
    height: 54,
    borderRadius: 28,
    paddingHorizontal: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
  },
  activeTabBubble: {
    width: 60,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabButton: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
