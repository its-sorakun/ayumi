/**
 * Combined OxygenOS / ColorOS visual theme definition for Ayumi.
 *
 * Derives every color directly from the Android dynamic system palette
 * (including multi-accent primary, secondary, and tertiary tonal families)
 * with Material Color Utilities fallback synthesis, pairing clean modular
 * surfaces and subtle hairline depth with crisp Android 1x motion curves.
 */

import { Easing } from 'react-native';
import type { MD3Theme } from 'react-native-paper';
import type { MaterialYouPalette } from 'react-native-material-you-colors';

import { createDarkTheme, createLightTheme } from '../theme';
import { MotionTokens } from '../theme/motion';
import {
  AYUMI_BASELINE_SEED,
  colorWithOpacity,
  PALETTE_SHADE,
  resolveCompleteDynamicPalette,
} from './paletteUtils';
import type { AyumiMotionPreset, AyumiThemeDefinition } from './types';

/**
 * Calibrated OxygenOS / ColorOS physics tuned for crisp tactile responsiveness
 * while keeping swipe transitions fast and graph animations smooth at 1x speed.
 */
export const OXYGEN_MOTION_PRESET: AyumiMotionPreset = {
  duration: {
    instant: 135,
    short: 250,
    medium: 390,
    long: 560,
    reveal: 760,
    chartWave: 1060,
  },
  spring: {
    snappy: {
      stiffness: 190,
      damping: 20,
      mass: 0.92,
    },
    metricCard: {
      stiffness: 205,
      damping: 16,
      mass: 0.9,
    },
    periodCapsule: {
      stiffness: 255,
      damping: 18,
      mass: 0.74,
    },
    pager: {
      stiffness: 245,
      damping: 25,
      mass: 0.78,
    },
    gentle: {
      stiffness: 115,
      damping: 16,
      mass: 0.95,
    },
    interactive: {
      stiffness: 195,
      damping: 22,
      mass: 0.86,
    },
  },
  easing: {
    standard: Easing.bezier(0.2, 0.0, 0.0, 1.0),
    emphasizedDecel: Easing.bezier(0.08, 0.82, 0.17, 1.0),
    dataReveal: Easing.bezier(0.2, 0.84, 0.24, 1.0),
    accelerate: Easing.bezier(0.32, 0.0, 0.75, 0.2),
  },
  chartReveal: {
    week: { duration: 880, staggerSpread: 0.34, overshoot: 0.036 },
    daily: { duration: 840, staggerSpread: 0.38, overshoot: 0.022 },
    month: { duration: 920, staggerSpread: 0.42, overshoot: 0.014 },
  },
  gesture: MotionTokens.gesture,
  squish: {
    stretchX: 1.12,
    compressY: 0.92,
  },
};

function mapOxygenColorOsPaletteToColors(
  rawPalette: MaterialYouPalette,
  isDark: boolean,
): MD3Theme['colors'] {
  const palette = resolveCompleteDynamicPalette(
    rawPalette,
    AYUMI_BASELINE_SEED,
    'VIBRANT',
  );
  const {
    system_accent1,
    system_accent2,
    system_accent3,
    system_neutral1,
    system_neutral2,
  } = palette;

  if (isDark) {
    const baseDark = createDarkTheme().colors;
    const inkPrimary = system_neutral1[PALETTE_SHADE.T50];
    const deepCanvas = system_neutral1[PALETTE_SHADE.T1000];

    return {
      ...baseDark,
      primary: system_accent1[PALETTE_SHADE.T200],
      onPrimary: system_accent1[PALETTE_SHADE.T800],
      primaryContainer: system_accent1[PALETTE_SHADE.T800],
      onPrimaryContainer: system_accent1[PALETTE_SHADE.T100],
      secondary: system_accent2[PALETTE_SHADE.T200],
      onSecondary: system_accent2[PALETTE_SHADE.T800],
      secondaryContainer: system_accent2[PALETTE_SHADE.T800],
      onSecondaryContainer: system_accent2[PALETTE_SHADE.T100],
      tertiary: system_accent3[PALETTE_SHADE.T200],
      onTertiary: system_accent3[PALETTE_SHADE.T800],
      tertiaryContainer: system_accent3[PALETTE_SHADE.T800],
      onTertiaryContainer: system_accent3[PALETTE_SHADE.T100],
      background: deepCanvas,
      onBackground: inkPrimary,
      surface: system_neutral1[PALETTE_SHADE.T900],
      onSurface: inkPrimary,
      surfaceVariant: system_neutral2[PALETTE_SHADE.T800],
      onSurfaceVariant: system_neutral2[PALETTE_SHADE.T200],
      outline: system_neutral2[PALETTE_SHADE.T500],
      outlineVariant: system_neutral2[PALETTE_SHADE.T700],
      inverseSurface: system_neutral1[PALETTE_SHADE.T100],
      inverseOnSurface: system_neutral1[PALETTE_SHADE.T900],
      inversePrimary: system_accent1[PALETTE_SHADE.T600],
      elevation: {
        level0: 'transparent',
        level1: system_neutral1[PALETTE_SHADE.T800],
        level2: system_neutral1[PALETTE_SHADE.T700],
        level3: system_neutral1[PALETTE_SHADE.T600],
        level4: system_neutral1[PALETTE_SHADE.T600],
        level5: system_neutral1[PALETTE_SHADE.T500],
      },
      surfaceDisabled: colorWithOpacity(inkPrimary, 0.12),
      onSurfaceDisabled: colorWithOpacity(inkPrimary, 0.38),
      backdrop: colorWithOpacity(deepCanvas, 0.56),
    };
  }

  const baseLight = createLightTheme().colors;
  const inkDark = system_neutral1[PALETTE_SHADE.T900];
  const softCanvas = system_neutral1[PALETTE_SHADE.T50];
  const pureCardSurface = system_neutral1[PALETTE_SHADE.T0];

  return {
    ...baseLight,
    primary: system_accent1[PALETTE_SHADE.T600],
    onPrimary: system_accent1[PALETTE_SHADE.T0],
    primaryContainer: system_accent1[PALETTE_SHADE.T100],
    onPrimaryContainer: system_accent1[PALETTE_SHADE.T900],
    secondary: system_accent2[PALETTE_SHADE.T600],
    onSecondary: system_accent2[PALETTE_SHADE.T0],
    secondaryContainer: system_accent2[PALETTE_SHADE.T100],
    onSecondaryContainer: system_accent2[PALETTE_SHADE.T900],
    tertiary: system_accent3[PALETTE_SHADE.T600],
    onTertiary: system_accent3[PALETTE_SHADE.T0],
    tertiaryContainer: system_accent3[PALETTE_SHADE.T100],
    onTertiaryContainer: system_accent3[PALETTE_SHADE.T900],
    // Soft neutral backdrop separates cleanly beneath lifted card surfaces
    background: softCanvas,
    onBackground: inkDark,
    surface: pureCardSurface,
    onSurface: inkDark,
    surfaceVariant: system_neutral2[PALETTE_SHADE.T100],
    onSurfaceVariant: system_neutral2[PALETTE_SHADE.T600],
    outline: system_neutral2[PALETTE_SHADE.T400],
    outlineVariant: system_neutral2[PALETTE_SHADE.T100],
    inverseSurface: system_neutral1[PALETTE_SHADE.T800],
    inverseOnSurface: system_neutral1[PALETTE_SHADE.T50],
    inversePrimary: system_accent1[PALETTE_SHADE.T200],
    elevation: {
      level0: 'transparent',
      level1: system_neutral1[PALETTE_SHADE.T10],
      level2: system_neutral1[PALETTE_SHADE.T50],
      level3: system_neutral1[PALETTE_SHADE.T100],
      level4: system_neutral1[PALETTE_SHADE.T100],
      level5: system_neutral1[PALETTE_SHADE.T200],
    },
    surfaceDisabled: colorWithOpacity(inkDark, 0.12),
    onSurfaceDisabled: colorWithOpacity(inkDark, 0.38),
    backdrop: colorWithOpacity(inkDark, 0.36),
  };
}

export const oxygenColorOsThemeDefinition: AyumiThemeDefinition = {
  id: 'oxygen_coloros',
  name: 'OxygenOS / ColorOS',
  shortDescription: 'Clean modular surfaces, multi-accent dynamic palette, fluid motion',
  badgeLabel: 'OEM Clean',
  surfaces: {
    cardRadius: 22,
    fullWidthCardRadius: 24,
    sectionCardRadius: 24,
    summaryCardRadius: 22,
    outlineLightCards: true,
    cardElevation: 2,
    cardShadowOpacity: 0.05,
    groupedSettingsCards: true,
    tintHomeWaterCard: true,
  },
  shapes: {
    selectorSlotRadius: 20,
    periodCapsulePadding: 4,
    buttonPillRadius: 22,
    chipRadius: 16,
    chartBarMaxRadius: 6,
    chartBarBottomRadius: 2,
    dockRadius: 31,
    dockWidthPercent: '90%',
    dockMaxWidth: 384,
    dockHeight: 62,
    dockPaddingHorizontal: 8,
    bottomSheetRadius: 28,
    logEntryRadius: 20,
  },
  typography: {
    screenTitleSize: 33,
    screenTitleWeight: '800',
    screenTitleTracking: -0.8,
    screenSubtitleSize: 13.5,
    sectionTitleSize: 17,
    sectionTitleWeight: '800',
    bentoValueSize: 22,
    statValueWeight: '800',
  },
  navigation: {
    variant: 'oem_labeled_pill',
    showLabels: true,
    pillHeight: 48,
    pillMaxWidth: 76,
  },
  progress: {
    heroStrokeWidth: 13,
    waterStrokeWidth: 11,
    showWaterTipKnob: true,
    linearTrackHeight: 5,
  },
  motion: OXYGEN_MOTION_PRESET,
  mapPaletteToPaperColors: mapOxygenColorOsPaletteToColors,
  // Consume system accent1, accent2, and accent3 families across distinct metrics
  getMetricAccents: colors => ({
    steps: {
      color: colors.primary,
      onColor: colors.onPrimary,
      container: colors.primaryContainer,
      onContainer: colors.onPrimaryContainer,
    },
    activeTime: {
      color: colors.primary,
      onColor: colors.onPrimary,
      container: colors.primaryContainer,
      onContainer: colors.onPrimaryContainer,
    },
    distance: {
      color: colors.secondary,
      onColor: colors.onSecondary,
      container: colors.secondaryContainer,
      onContainer: colors.onSecondaryContainer,
    },
    calories: {
      color: colors.tertiary,
      onColor: colors.onTertiary,
      container: colors.tertiaryContainer,
      onContainer: colors.onTertiaryContainer,
    },
    water: {
      color: colors.tertiary,
      onColor: colors.onTertiary,
      container: colors.tertiaryContainer,
      onContainer: colors.onTertiaryContainer,
    },
  }),
  resolveCardBorder: (colors, _isDark) => ({
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  }),
};
