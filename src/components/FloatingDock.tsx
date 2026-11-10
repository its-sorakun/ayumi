/**
 * FloatingDock — an aesthetic bottom navigation capsule.
 *
 * Implements a floating pill dock with:
 *  - High corner radius (34dp) and soft tonal elevation
 *  - Active Home indicator with an organic lilac blob container
 *  - Analytics / Charts shortcut for exploring step and distance history
 *  - Settings / Profile shortcut for configuring goals and sensor modes
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
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
  return (
    <View style={styles.dockWrapper} pointerEvents="box-none">
      <View style={styles.dockContainer}>
        {/* Active Home Tab with Organic Blob highlight */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onHomePress}
          style={styles.activeTabBubble}
          accessibilityRole="tab"
          accessibilityLabel="Home tab">
          <DockHomeIcon size={20} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Analytics / Charts Tab */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onAnalyticsPress}
          style={styles.tabButton}
          accessibilityRole="tab"
          accessibilityLabel="Analytics tab">
          <DockChartIcon size={22} color="#7E659A" />
        </TouchableOpacity>

        {/* Settings / Profile Tab */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onProfilePress}
          style={styles.tabButton}
          accessibilityRole="tab"
          accessibilityLabel="Settings and profile tab">
          <DockUserIcon size={22} color="#7E659A" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dockWrapper: {
    position: 'absolute',
    bottom: 22,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '88%',
    maxWidth: 360,
    height: 64,
    backgroundColor: '#FFFFFF',
    borderRadius: 36,
    paddingHorizontal: 16,
    shadowColor: '#784E9D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#F2E8FA',
  },
  activeTabBubble: {
    width: 68,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#9868C3',
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

