/**
 * Default Ayumi theme definition preserving the existing Material You 3 Expressive identity.
 *
 * Keeps Ayumi's baseline teal seed palette, borderless light tonal containers,
 * capsule icon-only dock, and expressive motion curves completely unchanged when
 * `'default'` is selected.
 */

import type { MD3Theme } from 'react-native-paper';
import type { MaterialYouPalette } from 'react-native-material-you-colors';

import { MotionTokens } from '../theme/motion';
import { createDarkTheme, createLightTheme } from '../theme';
import {
  AYUMI_BASELINE_SEED,
  PALETTE_SHADE,
  resolveCompleteDynamicPalette,
} from './paletteUtils';
import type { AyumiThemeDefinition } from './types';

function mapDefaultPaletteToColors(
  rawPalette: MaterialYouPalette,
  isDark: boolean,
): MD3Theme['colors'] {
  const palette = resolveCompleteDynamicPalette(
    rawPalette,
    AYUMI_BASELINE_SEED,
    'TONAL_SPOT',
  );
  const {
    system_accent1,
    system_accent2,
    system_accent3,
    system_neutral1,
    system_neutral2,
  } = palette;

  if (isDark) {
    return createDarkTheme({
      primary: system_accent1[PALETTE_SHADE.T200],
      onPrimary: system_accent1[PALETTE_SHADE.T800],
      primaryContainer: system_accent1[PALETTE_SHADE.T700],
      onPrimaryContainer: system_accent1[PALETTE_SHADE.T100],
      secondary: system_accent2[PALETTE_SHADE.T200],
      onSecondary: system_accent2[PALETTE_SHADE.T800],
      secondaryContainer: system_accent2[PALETTE_SHADE.T700],
      onSecondaryContainer: system_accent2[PALETTE_SHADE.T100],
      tertiary: system_accent3[PALETTE_SHADE.T200],
      onTertiary: system_accent3[PALETTE_SHADE.T800],
      tertiaryContainer: system_accent3[PALETTE_SHADE.T700],
      onTertiaryContainer: system_accent3[PALETTE_SHADE.T100],
      background: system_neutral1[PALETTE_SHADE.T900],
      onBackground: system_neutral1[PALETTE_SHADE.T100],
      surface: system_neutral1[PALETTE_SHADE.T900],
      onSurface: system_neutral1[PALETTE_SHADE.T100],
      surfaceVariant: system_neutral2[PALETTE_SHADE.T700],
      onSurfaceVariant: system_neutral2[PALETTE_SHADE.T200],
      outline: system_neutral2[PALETTE_SHADE.T400],
      outlineVariant: system_neutral2[PALETTE_SHADE.T700],
      elevation: {
        level0: 'transparent',
        level1: system_neutral1[PALETTE_SHADE.T800],
        level2: system_neutral1[PALETTE_SHADE.T700],
        level3: system_neutral1[PALETTE_SHADE.T600],
        level4: system_neutral1[PALETTE_SHADE.T600],
        level5: system_neutral1[PALETTE_SHADE.T500],
      },
    }).colors;
  }

  return createLightTheme({
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
    background: system_neutral1[PALETTE_SHADE.T10],
    onBackground: system_neutral1[PALETTE_SHADE.T900],
    surface: system_neutral1[PALETTE_SHADE.T10],
    onSurface: system_neutral1[PALETTE_SHADE.T900],
    surfaceVariant: system_neutral2[PALETTE_SHADE.T100],
    onSurfaceVariant: system_neutral2[PALETTE_SHADE.T700],
    outline: system_neutral2[PALETTE_SHADE.T500],
    outlineVariant: system_neutral2[PALETTE_SHADE.T200],
    elevation: {
      level0: 'transparent',
      level1: system_neutral1[PALETTE_SHADE.T50],
      level2: system_neutral1[PALETTE_SHADE.T100],
      level3: system_neutral1[PALETTE_SHADE.T200],
      level4: system_neutral1[PALETTE_SHADE.T200],
      level5: system_neutral1[PALETTE_SHADE.T300],
    },
  }).colors;
}

export const defaultThemeDefinition: AyumiThemeDefinition = {
  id: 'default',
  name: 'Default (Ayumi)',
  shortDescription: 'Material You 3 Expressive with adaptive wallpaper colors',
  badgeLabel: 'Material You',
  surfaces: {
    cardRadius: 24,
    fullWidthCardRadius: 28,
    sectionCardRadius: 22,
    summaryCardRadius: 20,
    outlineLightCards: false,
    cardElevation: 1,
    cardShadowOpacity: 0.03,
    groupedSettingsCards: false,
    tintHomeWaterCard: true,
  },
  shapes: {
    selectorSlotRadius: 18,
    periodCapsulePadding: 4,
    buttonPillRadius: 20,
    chipRadius: 14,
    chartBarMaxRadius: 4,
    chartBarBottomRadius: 4,
    dockRadius: 29,
    dockWidthPercent: '84%',
    dockMaxWidth: 340,
    dockHeight: 58,
    dockPaddingHorizontal: 8,
    bottomSheetRadius: 28,
    logEntryRadius: 18,
  },
  typography: {
    screenTitleSize: 32,
    screenTitleWeight: '800',
    screenTitleTracking: -0.7,
    screenSubtitleSize: 13.5,
    sectionTitleSize: 17,
    sectionTitleWeight: '800',
    bentoValueSize: 21,
    statValueWeight: '800',
  },
  navigation: {
    variant: 'capsule_icons',
    showLabels: false,
    pillHeight: 38,
    pillMaxWidth: 60,
  },
  progress: {
    heroStrokeWidth: 14,
    waterStrokeWidth: 10,
    showWaterTipKnob: true,
    linearTrackHeight: 4.5,
  },
  motion: MotionTokens,
  mapPaletteToPaperColors: mapDefaultPaletteToColors,
  getMetricAccents: colors => {
    const primaryRole = {
      color: colors.primary,
      onColor: colors.onPrimary,
      container: colors.primaryContainer,
      onContainer: colors.onPrimaryContainer,
    };
    return {
      steps: primaryRole,
      calories: primaryRole,
      distance: primaryRole,
      activeTime: primaryRole,
      water: primaryRole,
    };
  },
  resolveCardBorder: (_colors, isDark) => ({
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
  }),
};
