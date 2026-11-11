/**
 * Ayumi Motion Design System — expressive, fluid motion tokens.
 *
 * Defines animation constants, spring physics configurations, and easing curves
 * inspired by the interaction quality of OxygenOS 16 and ColorOS 16 while adhering
 * strictly to Material 3 Expressive guidelines:
 *  - Categorized durations based on spatial scale and interaction priority
 *  - Spring dynamics with natural damping (preventing uncontrolled bouncing)
 *  - Squish and stretch deformation factors for sliding pill containers
 *  - Consistent gesture thresholds for velocity-aware horizontal pagers
 *  - System reduced-motion subscription hook via AccessibilityInfo
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo, Easing } from 'react-native';

export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) {
          setReducedMotion(Boolean(enabled));
        }
      })
      .catch(() => {
        // Keep false when OS accessibility query is unavailable in non-native tests
      });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        if (mounted) {
          setReducedMotion(Boolean(enabled));
        }
      }
    );

    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);

  return reducedMotion;
}

export const MotionTokens = {
  // Standard durations in milliseconds (calibrated to Android 1x system motion)
  duration: {
    instant: 150,
    short: 280,
    medium: 420,
    long: 600,
    reveal: 800,
    chartWave: 1150,
  },

  // Native Spring physics configurations (calibrated to Android 1x natural physics)
  spring: {
    // Smooth, relaxed response for buttons, tabs, pills, and indicators
    snappy: {
      stiffness: 140,
      damping: 18,
      mass: 1.0,
    },
    // Responsive, snappy hand-off for page-level horizontal swipe navigation
    pager: {
      stiffness: 220,
      damping: 24,
      mass: 0.8,
    },
    // Soft, organic settling for data bars and tooltips
    gentle: {
      stiffness: 90,
      damping: 15,
      mass: 1.0,
    },
    // Interactive drag spring for touch-following indicators
    interactive: {
      stiffness: 160,
      damping: 20,
      mass: 0.9,
    },
  },

  // Curvature / Easing
  easing: {
    standard: Easing.bezier(0.2, 0.0, 0, 1.0),
    emphasizedDecel: Easing.bezier(0.05, 0.7, 0.1, 1.0),
    accelerate: Easing.bezier(0.3, 0.0, 0.8, 0.15),
  },

  // Gesture thresholds
  gesture: {
    // Distance ratio (percentage of screen width) to commit page navigation
    pageDistanceThresholdRatio: 0.28,
    // Horizontal velocity threshold (dp/ms) for flick gestures
    pageVelocityThreshold: 0.45,
    // Touch slop in pixels before recognizing horizontal drag
    horizontalTouchSlop: 12,
    // Directional ratio: dx must exceed dy by this factor to claim gesture
    directionalRatio: 1.5,
  },

  // Squish and stretch factors for fluid pill deformation
  squish: {
    stretchX: 1.14,
    compressY: 0.91,
  },
} as const;
