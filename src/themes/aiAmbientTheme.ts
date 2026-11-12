/**
 * AI Ambient visual theme definition (`ai_ambient`).
 *
 * Keeps Default (`default`) and OxygenOS / ColorOS (`oxygen_coloros`) completely untouched
 * while providing atmospheric translucent surfaces, organic circular/wave progress shapes,
 * serene spring motion tokens, and dynamic system-or-artwork palette derivation.
 */

import { Easing } from 'react-native';
import type { MD3Theme } from 'react-native-paper';
import type { MaterialYouPalette } from 'react-native-material-you-colors';

import type { AyumiMotionPreset, AyumiThemeDefinition } from './types';
import {
  deriveAiAmbientMetricAccents,
  mapAiAmbientTokensToPaperColors,
  resolveAiAmbientPaletteTokens,
} from './aiAmbient/ambientPalette';

export const AI_AMBIENT_MOTION_PRESET: AyumiMotionPreset = {
  duration: {
    instant: 120,
    short: 240,
    medium: 380,
    long: 540,
    reveal: 620,
    chartWave: 460,
  },
  spring: {
    snappy: { stiffness: 280, damping: 24, mass: 1 },
    metricCard: { stiffness: 230, damping: 22, mass: 0.96 },
    periodCapsule: { stiffness: 300, damping: 25, mass: 0.94 },
    pager: { stiffness: 240, damping: 26, mass: 0.95 },
    gentle: { stiffness: 170, damping: 21, mass: 1.05 },
    interactive: { stiffness: 340, damping: 22, mass: 0.85 },
  },
  easing: {
    standard: Easing.bezier(0.22, 0.1, 0.25, 1.0),
    emphasizedDecel: Easing.bezier(0.16, 0.88, 0.28, 1.0),
    dataReveal: Easing.bezier(0.18, 0.84, 0.3, 1.0),
    accelerate: Easing.bezier(0.4, 0.0, 0.8, 0.6),
  },
  chartReveal: {
    week: { duration: 480, staggerSpread: 0.34, overshoot: 1.04 },
    daily: { duration: 540, staggerSpread: 0.42, overshoot: 1.02 },
    month: { duration: 520, staggerSpread: 0.38, overshoot: 1.02 },
  },
  gesture: {
    pageDistanceThresholdRatio: 0.18,
    pageVelocityThreshold: 0.32,
    horizontalTouchSlop: 11,
    directionalRatio: 1.25,
  },
  squish: {
    stretchX: 1.38,
    compressY: 0.78,
  },
};

function mapAiAmbientPaletteToColors(
  palette: MaterialYouPalette,
  isDark: boolean,
): MD3Theme['colors'] {
  const tokens = resolveAiAmbientPaletteTokens({
    colourSource: 'system',
    systemPalette: palette,
    artworkPalette: null,
    isDark,
  });
  return mapAiAmbientTokensToPaperColors(tokens);
}

function getAiAmbientMetricAccentsFromPaper(
  colors: MD3Theme['colors'],
  isDark: boolean = false,
) {
  const tokens = resolveAiAmbientPaletteTokens({
    colourSource: 'artwork',
    systemPalette: null,
    artworkPalette: {
      dominant: colors.primary,
      primary: colors.primary,
      secondary: colors.secondary,
      tertiary: colors.tertiary,
      highlight: colors.secondaryContainer,
      shadowDark: colors.onSurface,
      surfaceLightTint: colors.background,
      surfaceDarkTint: colors.background,
      swatches: [],
      isDarkArtwork: isDark,
    },
    isDark,
  });
  return deriveAiAmbientMetricAccents(tokens);
}

export const aiAmbientThemeDefinition: AyumiThemeDefinition = {
  id: 'ai_ambient',
  name: 'AI Ambient',
  shortDescription: 'Atmospheric anime scenery, weather mood, and organic liquid nav',
  badgeLabel: 'AI Scenic',
  surfaces: {
    cardRadius: 22,
    fullWidthCardRadius: 24,
    sectionCardRadius: 24,
    summaryCardRadius: 20,
    outlineLightCards: true,
    cardElevation: 0,
    cardShadowOpacity: 0,
    groupedSettingsCards: true,
    tintHomeWaterCard: false,
    heroLayout: 'organic_ambient',
    bentoLayout: 'header_inline',
    activeControlStyle: 'filled_pill',
    subtleTimelineMenuButton: true,
    badgeStyle: 'tonal',
    iconFamily: 'oxygen_lucide',
    ambientGradientStyle: 'ai_ambient_scenic',
    metricSelectorVariant: 'horizontal_pills',
    separateWaterPresetCards: true,
    statsMainSummaryInline: true,
  },
  shapes: {
    selectorSlotRadius: 20,
    periodCapsulePadding: 4,
    buttonPillRadius: 20,
    chipRadius: 16,
    chartBarMaxRadius: 10,
    chartBarBottomRadius: 4,
    dockRadius: 34,
    dockWidthPercent: '100%',
    dockMaxWidth: 520,
    dockHeight: 74,
    dockPaddingHorizontal: 18,
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
    bentoValueSize: 22,
    statValueWeight: '800',
  },
  navigation: {
    variant: 'wave_organic_blob',
    showLabels: false,
    pillHeight: 46,
    pillMaxWidth: 66,
  },
  progress: {
    heroStrokeWidth: 14,
    waterStrokeWidth: 10,
    showWaterTipKnob: false,
    linearTrackHeight: 8,
  },
  motion: AI_AMBIENT_MOTION_PRESET,
  mapPaletteToPaperColors: mapAiAmbientPaletteToColors,
  getMetricAccents: getAiAmbientMetricAccentsFromPaper,
  resolveCardBorder: (colors, isDark) => ({
    borderWidth: 1,
    borderColor: isDark
      ? 'rgba(255, 255, 255, 0.14)'
      : `rgba(255, 255, 255, ${colors.primary ? 0.78 : 0.72})`,
  }),
};

