/**
 * StatsPeriodNavigator — date range navigation control.
 *
 * Implements period backward/forward stepping with directional text animations:
 *  - Responsive previous and next arrow buttons with tactile touch states
 *  - Dynamic date formatting based on selected aggregation (Daily, Week, Month)
 *  - Disables forward navigation beyond current time anchor
 *  - Directional slide-and-fade animation when moving across calendar intervals
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { ChevronLeftIcon, ChevronRightIcon } from './AestheticIcons';
import { useReducedMotion } from '../theme/motion';

interface StatsPeriodNavigatorProps {
  readonly dateRangeText: string;
  readonly canGoNext: boolean;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly transitionDirection?: 'prev' | 'next';
  readonly height?: number;
  readonly marginTop?: number;
}

export function StatsPeriodNavigator({
  dateRangeText,
  canGoNext,
  onPrevious,
  onNext,
  transitionDirection = 'next',
  height = 36,
  marginTop = 6,
}: StatsPeriodNavigatorProps): React.JSX.Element {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();

  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      animValue.setValue(0);
      return;
    }

    animValue.setValue(transitionDirection === 'next' ? 1 : -1);
    Animated.timing(animValue, {
      toValue: 0,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [dateRangeText, transitionDirection, reducedMotion, animValue]);

  const translateX = animValue.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-16, 0, 16],
  });

  const opacity = animValue.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0.3, 1, 0.3],
  });

  return (
    <View style={[styles.container, { height, marginTop }]}>
      <TouchableOpacity
        activeOpacity={0.65}
        onPress={onPrevious}
        style={styles.navButton}
        accessibilityRole="button"
        accessibilityLabel="Previous period">
        <ChevronLeftIcon size={20} color={theme.colors.onSurface} />
      </TouchableOpacity>

      <View style={styles.labelContainer}>
        <Animated.View style={{ transform: [{ translateX }], opacity }}>
          <Text
            style={[styles.dateText, { color: theme.colors.onSurface }]}
            numberOfLines={1}>
            {dateRangeText}
          </Text>
        </Animated.View>
      </View>

      <TouchableOpacity
        activeOpacity={canGoNext ? 0.65 : 1}
        onPress={canGoNext ? onNext : undefined}
        disabled={!canGoNext}
        style={[styles.navButton, { opacity: canGoNext ? 1 : 0.25 }]}
        accessibilityRole="button"
        accessibilityLabel="Next period"
        accessibilityState={{ disabled: !canGoNext }}>
        <ChevronRightIcon size={20} color={theme.colors.onSurface} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 6,
    height: 36,
  },
  navButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  labelContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dateText: {
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
