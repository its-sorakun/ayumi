/**
 * Exclusive undulating wavy bottom navigation bar for the AI Ambient theme.
 *
 * Visually distinct from both Default (`FloatingDock`) and OxygenOS (`OxygenColorOsDockBar`):
 *  - Edge-to-edge translucent frosted SVG double-wave silhouette spanning above safe area insets
 *  - All 4 Ayumi tabs (Home, Stats, Water, Settings) cleanly spaced icon-only with accessibility roles
 *  - Active selection rendered as an asymmetric organic liquid blob SVG that stretches/squashes
 *    along pager travel (`pagerProgress`) or spring tab transitions while disabling deformation under
 *    system reduced-motion preferences
 */

import React, { useMemo, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import {
  DockChartIcon,
  DockHomeIcon,
  DockWaterIcon,
  SettingsGearIcon,
} from '../../components/AestheticIcons';
import { useReducedMotion } from '../../theme/motion';
import { useAiAmbient } from './AiAmbientContext';

export interface AiAmbientWaveNavProps {
  readonly activeTab?: 'home' | 'stats' | 'water' | 'settings';
  readonly pagerProgress?: Animated.AnimatedInterpolation<number> | Animated.Value;
  readonly onHomePress?: () => void;
  readonly onAnalyticsPress?: () => void;
  readonly onWaterPress?: () => void;
  readonly onProfilePress?: () => void;
}

const BLOB_WIDTH = 66;
const BLOB_HEIGHT = 46;
const NAV_INTERACTIVE_HEIGHT = 64;
const HORIZONTAL_INSET = 18;
const PAGER_SEGMENT_OFFSETS = [0, 0.16, 0.36, 0.5, 0.64, 0.84] as const;
const PAGER_TRANSLATE_RATIOS = [0, 0.10, 0.32, 0.5, 0.68, 0.90] as const;
const PAGER_LIQUID_WEIGHTS = [0, 0.55, 0.94, 1.0, 0.94, 0.55] as const;

function buildWaveBarPaths(width: number, totalHeight: number): {
  readonly secondaryWave: string;
  readonly primaryWave: string;
  readonly topStroke: string;
} {
  const w = Math.max(width, 320);
  // Subtle organic wave crest profile matching the dreamy undulating chrome silhouette.
  const primaryWave = [
    `M 0 18`,
    `C ${w * 0.11} 4, ${w * 0.24} 5, ${w * 0.36} 15`,
    `C ${w * 0.46} 23, ${w * 0.56} 22, ${w * 0.67} 13`,
    `C ${w * 0.78} 4, ${w * 0.90} 6, ${w} 17`,
    `L ${w} ${totalHeight}`,
    `L 0 ${totalHeight} Z`,
  ].join(' ');

  const secondaryWave = [
    `M 0 10`,
    `C ${w * 0.15} 21, ${w * 0.30} 20, ${w * 0.44} 11`,
    `C ${w * 0.57} 3, ${w * 0.74} 20, ${w} 9`,
    `L ${w} ${totalHeight}`,
    `L 0 ${totalHeight} Z`,
  ].join(' ');

  const topStroke = [
    `M 0 18`,
    `C ${w * 0.11} 4, ${w * 0.24} 5, ${w * 0.36} 15`,
    `C ${w * 0.46} 23, ${w * 0.56} 22, ${w * 0.67} 13`,
    `C ${w * 0.78} 4, ${w * 0.90} 6, ${w} 17`,
  ].join(' ');

  return { secondaryWave, primaryWave, topStroke };
}

function buildLiquidRanges(slots: readonly [number, number, number, number]): {
  inputRange: number[];
  translateOutputRange: number[];
  scaleXOutputRange: number[];
  scaleYOutputRange: number[];
} {
  const inputRange: number[] = [];
  const translateOutputRange: number[] = [];
  const scaleXOutputRange: number[] = [];
  const scaleYOutputRange: number[] = [];

  for (let seg = 0; seg < 3; seg += 1) {
    const startX = slots[seg];
    const deltaX = slots[seg + 1] - startX;
    for (let i = 0; i < PAGER_SEGMENT_OFFSETS.length; i += 1) {
      const w = PAGER_LIQUID_WEIGHTS[i];
      inputRange.push(seg + PAGER_SEGMENT_OFFSETS[i]);
      translateOutputRange.push(startX + deltaX * PAGER_TRANSLATE_RATIOS[i]);
      scaleXOutputRange.push(1 + 0.38 * w);
      scaleYOutputRange.push(1 - 0.22 * w);
    }
  }
  inputRange.push(3);
  translateOutputRange.push(slots[3]);
  scaleXOutputRange.push(1);
  scaleYOutputRange.push(1);

  return {
    inputRange,
    translateOutputRange,
    scaleXOutputRange,
    scaleYOutputRange,
  };
}

export function AiAmbientWaveNav({
  activeTab = 'home',
  pagerProgress,
  onHomePress,
  onAnalyticsPress,
  onWaterPress,
  onProfilePress,
}: AiAmbientWaveNavProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const safeFrame = useSafeAreaFrame();
  const reducedMotion = useReducedMotion();
  const { ambientPalette } = useAiAmbient();

  const [measuredWidth, setMeasuredWidth] = useState<number>(safeFrame.width || 390);
  const effectiveWidth = measuredWidth > 0 ? measuredWidth : 390;

  const totalHeight = NAV_INTERACTIVE_HEIGHT + Math.max(insets.bottom, 10) + 10;
  const slotsHeightTop = 15;

  const slotWidth = Math.max(1, (effectiveWidth - HORIZONTAL_INSET * 2) / 4);
  const slotCenters = useMemo(
    () =>
      [
        HORIZONTAL_INSET + slotWidth * 0.5 - BLOB_WIDTH / 2,
        HORIZONTAL_INSET + slotWidth * 1.5 - BLOB_WIDTH / 2,
        HORIZONTAL_INSET + slotWidth * 2.5 - BLOB_WIDTH / 2,
        HORIZONTAL_INSET + slotWidth * 3.5 - BLOB_WIDTH / 2,
      ] as const,
    [slotWidth],
  );

  const activeIndex =
    activeTab === 'home' ? 0 : activeTab === 'stats' ? 1 : activeTab === 'water' ? 2 : 3;

  const liquidRanges = useMemo(() => buildLiquidRanges(slotCenters), [slotCenters]);

  let translateX: number | Animated.AnimatedInterpolation<number> = slotCenters[activeIndex];
  let scaleX: number | Animated.AnimatedInterpolation<number> = 1;
  let scaleY: number | Animated.AnimatedInterpolation<number> = 1;

  if (pagerProgress) {
    translateX = reducedMotion
      ? pagerProgress.interpolate({
          inputRange: [0, 1, 2, 3],
          outputRange: [...slotCenters],
          extrapolate: 'clamp',
        })
      : pagerProgress.interpolate({
          inputRange: liquidRanges.inputRange,
          outputRange: liquidRanges.translateOutputRange,
          extrapolate: 'clamp',
        });
    if (!reducedMotion) {
      scaleX = pagerProgress.interpolate({
        inputRange: liquidRanges.inputRange,
        outputRange: liquidRanges.scaleXOutputRange,
        extrapolate: 'clamp',
      });
      scaleY = pagerProgress.interpolate({
        inputRange: liquidRanges.inputRange,
        outputRange: liquidRanges.scaleYOutputRange,
        extrapolate: 'clamp',
      });
    }
  }

  const wavePaths = useMemo(
    () => buildWaveBarPaths(effectiveWidth, totalHeight),
    [effectiveWidth, totalHeight],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - measuredWidth) > 0.5) {
      setMeasuredWidth(w);
    }
  };

  const tabs: ReadonlyArray<{
    readonly id: 'home' | 'stats' | 'water' | 'settings';
    readonly label: string;
    readonly onPress?: () => void;
    readonly renderIcon: (color: string) => React.ReactNode;
  }> = [
    {
      id: 'home',
      label: 'Home tab',
      onPress: onHomePress,
      renderIcon: color => <DockHomeIcon size={21} color={color} />,
    },
    {
      id: 'stats',
      label: 'Stats tab',
      onPress: onAnalyticsPress,
      renderIcon: color => <DockChartIcon size={21} color={color} />,
    },
    {
      id: 'water',
      label: 'Water tab',
      onPress: onWaterPress,
      renderIcon: color => <DockWaterIcon size={21} color={color} />,
    },
    {
      id: 'settings',
      label: 'Settings tab',
      onPress: onProfilePress,
      renderIcon: color => <SettingsGearIcon size={21} color={color} />,
    },
  ];

  return (
    <View
      testID="ai-ambient-wave-nav"
      onLayout={onLayout}
      style={[styles.container, { height: totalHeight }]}
      pointerEvents="box-none">
      <Svg
        width={effectiveWidth}
        height={totalHeight}
        viewBox={`0 0 ${effectiveWidth} ${totalHeight}`}
        style={StyleSheet.absoluteFill}
        pointerEvents="none">
        <Path d={wavePaths.secondaryWave} fill={ambientPalette.navWaveSecondaryFill} />
        <Path d={wavePaths.primaryWave} fill={ambientPalette.navWaveFill} />
        <Path
          d={wavePaths.topStroke}
          fill="none"
          stroke={ambientPalette.navWaveBorder}
          strokeWidth={1.3}
        />
      </Svg>

      {/* Selected organic liquid indicator blob (not a standard pill) */}
      <Animated.View
        testID="ai-ambient-wave-blob"
        pointerEvents="none"
        style={[
          styles.blobHolder,
          {
            top: slotsHeightTop + (NAV_INTERACTIVE_HEIGHT - BLOB_HEIGHT) / 2 - 2,
            transform: [{ translateX }, { scaleX }, { scaleY }],
          },
        ]}>
        <Svg width={BLOB_WIDTH} height={BLOB_HEIGHT} viewBox="0 0 66 46">
          <Defs>
            <LinearGradient id="aiWaveBlobGrad" x1="10%" y1="10%" x2="90%" y2="90%">
              <Stop offset="0%" stopColor={ambientPalette.navBlobStart} />
              <Stop offset="100%" stopColor={ambientPalette.navBlobEnd} />
            </LinearGradient>
          </Defs>
          <Path
            d="M33.5 3.2C47.8 2.4 61.5 9.8 62.6 22.8C63.6 34.4 51.2 43.2 35.4 42.8C18.6 42.4 4.2 36.6 3.5 23.6C2.8 11.4 17.8 4.1 33.5 3.2Z"
            fill="url(#aiWaveBlobGrad)"
          />
        </Svg>
      </Animated.View>

      {/* Four cleanly separated icon-only interactive destinations */}
      <View
        style={[
          styles.tabsRow,
          {
            paddingHorizontal: HORIZONTAL_INSET,
            marginTop: slotsHeightTop,
            height: NAV_INTERACTIVE_HEIGHT,
          },
        ]}>
        {tabs.map(tab => {
          const isSelected = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              activeOpacity={0.78}
              onPress={tab.onPress}
              style={styles.tabButton}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isSelected }}>
              {tab.renderIcon(
                isSelected ? ambientPalette.navActiveIcon : ambientPalette.navInactiveIcon,
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 25,
  },
  blobHolder: {
    position: 'absolute',
    left: 0,
    width: BLOB_WIDTH,
    height: BLOB_HEIGHT,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

