/**
 * Combined OxygenOS / ColorOS visual theme definition for Ayumi.
 *
 * Implements an independent Oklch hybrid colour engine anchored to public Android
 * dynamic-color seeds (`MaterialYouPalette`) without proprietary OEM dependencies,
 * separating wallpaper-responsive interface accents from stable semantic metric roles,
 * while isolating OxygenOS geometry, typography, solid badge style, and fluid motion.
 */

import { Easing } from 'react-native';
import type { MD3Theme } from 'react-native-paper';
import type { MaterialYouPalette } from 'react-native-material-you-colors';

import { createDarkTheme, createLightTheme } from '../theme';
import { MotionTokens } from '../theme/motion';
import {
  AYUMI_BASELINE_SEED,
  buildOklchAccentRole,
  classifySystemPaletteMode,
  colorWithOpacity,
  getContrastRatio,
  hexToOklch,
  isColorDark,
  oklchToHex,
  readNativeExtendedSystemPalette,
  resolveCompleteDynamicPalette,
  selectAccessibleForeground,
} from './paletteUtils';
import type {
  AccentColorRole,
  AyumiMotionPreset,
  AyumiThemeDefinition,
  ExtendedSystemPalette,
  MetricAccentRoles,
} from './types';

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

const MONOCHROME_LIGHT_TONES = [0.24, 0.34, 0.29, 0.44, 0.39, 0.27] as const;
const MONOCHROME_DARK_TONES = [0.85, 0.76, 0.80, 0.68, 0.72, 0.83] as const;
const MONOCHROME_BADGE_TONES = [0.30, 0.42, 0.36, 0.50, 0.46, 0.33] as const;

function buildMonochromeMetricRoles(isDark: boolean): MetricAccentRoles {
  const mk = (idx: number): AccentColorRole => {
    const color = oklchToHex({
      L: isDark ? MONOCHROME_DARK_TONES[idx] : MONOCHROME_LIGHT_TONES[idx],
      C: 0,
      h: 0,
    });
    const badgeBg = oklchToHex({
      L: isDark ? MONOCHROME_BADGE_TONES[idx] + 0.08 : MONOCHROME_BADGE_TONES[idx],
      C: 0,
      h: 0,
    });
    return {
      color,
      onColor: selectAccessibleForeground(color, 4.5),
      container: oklchToHex({ L: isDark ? 0.24 : 0.92, C: 0, h: 0 }),
      onContainer: oklchToHex({ L: isDark ? 0.92 : 0.16, C: 0, h: 0 }),
      badgeBg,
      onBadge: selectAccessibleForeground(badgeBg, 3.4),
    };
  };

  return {
    steps: mk(0),
    calories: mk(1),
    distance: mk(2),
    totalCalories: mk(3),
    activeTime: mk(4),
    water: mk(5),
  };
}

function isExplicitMonochromePalette(
  colors: MD3Theme['colors'],
  extendedPalette?: ExtendedSystemPalette | null,
): boolean {
  if (extendedPalette?.system_accent1 && extendedPalette?.system_accent2 && extendedPalette?.system_accent3) {
    return classifySystemPaletteMode(extendedPalette).mode === 'monochrome';
  }
  const chromas = [colors.primary, colors.secondary, colors.tertiary].map(
    hex => hexToOklch(hex)?.C ?? 0,
  );
  return Math.max(...chromas) < 0.02;
}

/**
 * Derives stable, vivid ColorOS/OxygenOS semantic metric accents directly in Oklch perceptual
 * space with sRGB gamut mapping and WCAG foreground contrast solving. Collapses cleanly to
 * grayscale ramps only when the active OS configuration is explicitly Monochrome.
 */
export function deriveOxygenMultiAccentRoles(
  colors: MD3Theme['colors'],
  isDark?: boolean,
  extendedPalette?: ExtendedSystemPalette | null,
): MetricAccentRoles {
  const resolvedDark = typeof isDark === 'boolean' ? isDark : isColorDark(colors.background);
  const nativeExtended =
    extendedPalette !== undefined ? extendedPalette : readNativeExtendedSystemPalette();

  if (isExplicitMonochromePalette(colors, nativeExtended)) {
    return buildMonochromeMetricRoles(resolvedDark);
  }

  // Stable semantic metric identities orthogonal to arbitrary wallpaper swings:
  // Steps = Vibrant Green, Active Calories = Coral Red, Distance = Vivid Blue,
  // Total Calories = Warm Amber/Orange (dark glyph on luminous gold badge),
  // Active Time = Teal, Water = Cyan/Cerulean.
  return {
    steps: buildOklchAccentRole(
      {
        hue: 148,
        lightColor: { L: 0.54, C: 0.19 },
        darkColor: { L: 0.72, C: 0.185 },
        lightBadge: { L: 0.585, C: 0.19 },
        darkBadge: { L: 0.58, C: 0.19 },
      },
      resolvedDark,
    ),
    calories: buildOklchAccentRole(
      {
        hue: 24,
        lightColor: { L: 0.57, C: 0.225 },
        darkColor: { L: 0.68, C: 0.19, h: 25 },
        lightBadge: { L: 0.60, C: 0.225, h: 25 },
        darkBadge: { L: 0.59, C: 0.22, h: 25 },
      },
      resolvedDark,
    ),
    distance: buildOklchAccentRole(
      {
        hue: 258,
        lightColor: { L: 0.535, C: 0.22 },
        darkColor: { L: 0.675, C: 0.18, h: 255 },
        lightBadge: { L: 0.565, C: 0.22 },
        darkBadge: { L: 0.565, C: 0.215, h: 257 },
      },
      resolvedDark,
    ),
    totalCalories: buildOklchAccentRole(
      {
        hue: 58,
        lightColor: { L: 0.565, C: 0.17, h: 50 },
        darkColor: { L: 0.755, C: 0.17, h: 72 },
        lightBadge: { L: 0.745, C: 0.18, h: 72 },
        darkBadge: { L: 0.745, C: 0.18, h: 72 },
      },
      resolvedDark,
    ),
    activeTime: buildOklchAccentRole(
      {
        hue: 184,
        lightColor: { L: 0.545, C: 0.15 },
        darkColor: { L: 0.715, C: 0.145 },
        lightBadge: { L: 0.58, C: 0.15 },
        darkBadge: { L: 0.575, C: 0.15 },
      },
      resolvedDark,
    ),
    water: buildOklchAccentRole(
      {
        hue: 244,
        lightColor: { L: 0.545, C: 0.178, h: 244 },
        darkColor: { L: 0.72, C: 0.155, h: 242 },
        lightBadge: { L: 0.59, C: 0.19, h: 244 },
        darkBadge: { L: 0.59, C: 0.18, h: 242 },
      },
      resolvedDark,
    ),
  };
}

function solveVividInterfaceHueRole(
  seedHue: number,
  seedChroma: number,
  isDark: boolean,
): AccentColorRole {
  const boostC = Math.min(0.22, Math.max(0.175, seedChroma * 1.45));
  const isWarmGoldHue = seedHue >= 58 && seedHue <= 112;
  const tunedHue = isWarmGoldHue ? 58 : seedHue;

  let lightColorL = isWarmGoldHue ? 0.59 : 0.55;
  if (!isDark && !isWarmGoldHue) {
    // Refine lightness step down subtly until white card contrast & white ink both hold >= 4.5
    while (lightColorL > 0.44) {
      const probe = oklchToHex({ L: lightColorL, C: boostC, h: tunedHue });
      if (getContrastRatio(probe, '#FFFFFF') >= 4.5) {
        break;
      }
      lightColorL -= 0.015;
    }
  }

  return buildOklchAccentRole(
    {
      hue: tunedHue,
      lightColor: { L: lightColorL, C: isWarmGoldHue ? 0.175 : boostC },
      darkColor: { L: 0.71, C: Math.min(0.19, boostC * 0.9) },
      lightBadge: { L: isWarmGoldHue ? 0.745 : Math.min(0.60, lightColorL + 0.03), C: boostC },
      darkBadge: { L: isWarmGoldHue ? 0.745 : 0.585, C: boostC * 0.94 },
    },
    isDark,
  );
}

function mapOxygenColorOsPaletteToColors(
  rawPalette: MaterialYouPalette,
  isDark: boolean,
): MD3Theme['colors'] {
  const palette = resolveCompleteDynamicPalette(
    rawPalette,
    AYUMI_BASELINE_SEED,
    'VIBRANT',
  );
  const { mode, seedHue, peakChroma } = classifySystemPaletteMode(palette);
  const surfaceHue = mode === 'monochrome' ? 0 : seedHue;
  const surfaceChroma = mode === 'monochrome' ? 0 : 0.003;

  // Compute dynamic interface roles independent of muted Monet T600/T200 clamping
  let primaryRole: AccentColorRole;
  let secondaryRole: AccentColorRole;
  let tertiaryRole: AccentColorRole;

  if (mode === 'monochrome') {
    const pColor = oklchToHex({ L: isDark ? 0.86 : 0.25, C: 0, h: 0 });
    const sColor = oklchToHex({ L: isDark ? 0.74 : 0.40, C: 0, h: 0 });
    const tColor = oklchToHex({ L: isDark ? 0.64 : 0.50, C: 0, h: 0 });
    primaryRole = {
      color: pColor,
      onColor: selectAccessibleForeground(pColor, 4.5),
      container: oklchToHex({ L: isDark ? 0.26 : 0.91, C: 0, h: 0 }),
      onContainer: oklchToHex({ L: isDark ? 0.93 : 0.14, C: 0, h: 0 }),
    };
    secondaryRole = {
      color: sColor,
      onColor: selectAccessibleForeground(sColor, 4.5),
      container: oklchToHex({ L: isDark ? 0.24 : 0.93, C: 0, h: 0 }),
      onContainer: oklchToHex({ L: isDark ? 0.90 : 0.18, C: 0, h: 0 }),
    };
    tertiaryRole = {
      color: tColor,
      onColor: selectAccessibleForeground(tColor, 4.5),
      container: oklchToHex({ L: isDark ? 0.22 : 0.94, C: 0, h: 0 }),
      onContainer: oklchToHex({ L: isDark ? 0.88 : 0.22, C: 0, h: 0 }),
    };
  } else if (mode === 'neutral_accent') {
    // Clean cool charcoal-slate interface accent for dull/unsuitable wallpaper seeds,
    // retaining subtle harmonic slate secondary/tertiary so metric hues stay vivid.
    primaryRole = buildOklchAccentRole(
      {
        hue: 248,
        lightColor: { L: 0.36, C: 0.015 },
        darkColor: { L: 0.83, C: 0.015 },
        lightBadge: { L: 0.40, C: 0.016 },
        darkBadge: { L: 0.50, C: 0.016 },
      },
      isDark,
    );
    secondaryRole = buildOklchAccentRole(
      {
        hue: 235,
        lightColor: { L: 0.49, C: 0.048 },
        darkColor: { L: 0.74, C: 0.045 },
        lightBadge: { L: 0.52, C: 0.048 },
        darkBadge: { L: 0.54, C: 0.046 },
      },
      isDark,
    );
    tertiaryRole = buildOklchAccentRole(
      {
        hue: 190,
        lightColor: { L: 0.50, C: 0.046 },
        darkColor: { L: 0.74, C: 0.044 },
        lightBadge: { L: 0.53, C: 0.046 },
        darkBadge: { L: 0.54, C: 0.044 },
      },
      isDark,
    );
  } else {
    primaryRole = solveVividInterfaceHueRole(seedHue, peakChroma, isDark);
    secondaryRole = solveVividInterfaceHueRole((seedHue + 34) % 360, peakChroma * 0.88, isDark);
    tertiaryRole = solveVividInterfaceHueRole((seedHue + 195) % 360, peakChroma * 0.84, isDark);
  }

  const errRole =
    mode === 'monochrome'
      ? primaryRole
      : buildOklchAccentRole(
          {
            hue: 24,
            lightColor: { L: 0.54, C: 0.215 },
            darkColor: { L: 0.70, C: 0.185 },
            lightBadge: { L: 0.56, C: 0.215 },
            darkBadge: { L: 0.58, C: 0.20 },
          },
          isDark,
        );

  if (isDark) {
    const baseDark = createDarkTheme().colors;
    const inkPrimary = oklchToHex({ L: 0.965, C: surfaceChroma, h: surfaceHue });
    const inkSecondary = oklchToHex({ L: 0.78, C: surfaceChroma * 1.4, h: surfaceHue });
    const deepCanvas = oklchToHex({ L: 0.0, C: 0, h: 0 });
    const elevatedCard = oklchToHex({ L: 0.195, C: surfaceChroma * 1.3, h: surfaceHue });
    const surfaceVar = oklchToHex({ L: 0.245, C: surfaceChroma * 1.5, h: surfaceHue });

    return {
      ...baseDark,
      primary: primaryRole.color,
      onPrimary: primaryRole.onColor,
      primaryContainer: primaryRole.container,
      onPrimaryContainer: primaryRole.onContainer,
      secondary: secondaryRole.color,
      onSecondary: secondaryRole.onColor,
      secondaryContainer: secondaryRole.container,
      onSecondaryContainer: secondaryRole.onContainer,
      tertiary: tertiaryRole.color,
      onTertiary: tertiaryRole.onColor,
      tertiaryContainer: tertiaryRole.container,
      onTertiaryContainer: tertiaryRole.onContainer,
      error: errRole.color,
      onError: errRole.onColor,
      errorContainer: errRole.container,
      onErrorContainer: errRole.onContainer,
      background: deepCanvas,
      onBackground: inkPrimary,
      surface: elevatedCard,
      onSurface: inkPrimary,
      surfaceVariant: surfaceVar,
      onSurfaceVariant: inkSecondary,
      outline: oklchToHex({ L: 0.58, C: surfaceChroma * 1.5, h: surfaceHue }),
      outlineVariant: colorWithOpacity(inkPrimary, 0.1),
      inverseSurface: oklchToHex({ L: 0.94, C: surfaceChroma, h: surfaceHue }),
      inverseOnSurface: elevatedCard,
      inversePrimary:
        mode === 'monochrome'
          ? oklchToHex({ L: 0.25, C: 0, h: 0 })
          : solveVividInterfaceHueRole(seedHue, peakChroma, false).color,
      elevation: {
        level0: 'transparent',
        level1: elevatedCard,
        level2: oklchToHex({ L: 0.235, C: surfaceChroma * 1.3, h: surfaceHue }),
        level3: oklchToHex({ L: 0.275, C: surfaceChroma * 1.4, h: surfaceHue }),
        level4: oklchToHex({ L: 0.295, C: surfaceChroma * 1.4, h: surfaceHue }),
        level5: oklchToHex({ L: 0.32, C: surfaceChroma * 1.5, h: surfaceHue }),
      },
      surfaceDisabled: colorWithOpacity(inkPrimary, 0.12),
      onSurfaceDisabled: colorWithOpacity(inkPrimary, 0.38),
      backdrop: colorWithOpacity(deepCanvas, 0.58),
    };
  }

  const baseLight = createLightTheme().colors;
  const inkDark = oklchToHex({ L: 0.20, C: surfaceChroma, h: surfaceHue });
  const inkMuted = oklchToHex({ L: 0.52, C: surfaceChroma * 1.5, h: surfaceHue });
  const crispCanvas = oklchToHex({ L: 0.968, C: surfaceChroma, h: surfaceHue });
  const pureCardSurface = '#FFFFFF';
  const subtleWell = oklchToHex({ L: 0.94, C: surfaceChroma * 1.3, h: surfaceHue });

  return {
    ...baseLight,
    primary: primaryRole.color,
    onPrimary: primaryRole.onColor,
    primaryContainer: primaryRole.container,
    onPrimaryContainer: primaryRole.onContainer,
    secondary: secondaryRole.color,
    onSecondary: secondaryRole.onColor,
    secondaryContainer: secondaryRole.container,
    onSecondaryContainer: secondaryRole.onContainer,
    tertiary: tertiaryRole.color,
    onTertiary: tertiaryRole.onColor,
    tertiaryContainer: tertiaryRole.container,
    onTertiaryContainer: tertiaryRole.onContainer,
    error: errRole.color,
    onError: errRole.onColor,
    errorContainer: errRole.container,
    onErrorContainer: errRole.onContainer,
    background: crispCanvas,
    onBackground: inkDark,
    surface: pureCardSurface,
    onSurface: inkDark,
    surfaceVariant: subtleWell,
    onSurfaceVariant: inkMuted,
    outline: oklchToHex({ L: 0.62, C: surfaceChroma * 1.5, h: surfaceHue }),
    outlineVariant: colorWithOpacity(inkDark, 0.07),
    inverseSurface: oklchToHex({ L: 0.25, C: surfaceChroma, h: surfaceHue }),
    inverseOnSurface: crispCanvas,
    inversePrimary:
      mode === 'monochrome'
        ? oklchToHex({ L: 0.86, C: 0, h: 0 })
        : solveVividInterfaceHueRole(seedHue, peakChroma, true).color,
    elevation: {
      level0: 'transparent',
      level1: oklchToHex({ L: 0.985, C: surfaceChroma, h: surfaceHue }),
      level2: crispCanvas,
      level3: subtleWell,
      level4: subtleWell,
      level5: oklchToHex({ L: 0.915, C: surfaceChroma * 1.4, h: surfaceHue }),
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
    cardRadius: 24,
    fullWidthCardRadius: 24,
    sectionCardRadius: 24,
    summaryCardRadius: 20,
    outlineLightCards: true,
    cardElevation: 1,
    cardShadowOpacity: 0.045,
    groupedSettingsCards: true,
    tintHomeWaterCard: false,
    heroLayout: 'modular_card',
    bentoLayout: 'header_inline',
    activeControlStyle: 'filled_pill',
    subtleTimelineMenuButton: true,
    badgeStyle: 'solid',
    iconFamily: 'oxygen_lucide',
    ambientGradientStyle: 'dynamic_glow',
    metricSelectorVariant: 'horizontal_pills',
    separateWaterPresetCards: true,
    statsMainSummaryInline: true,
  },
  shapes: {
    selectorSlotRadius: 20,
    periodCapsulePadding: 4,
    buttonPillRadius: 20,
    chipRadius: 16,
    chartBarMaxRadius: 8,
    chartBarBottomRadius: 3,
    dockRadius: 34,
    dockWidthPercent: '92%',
    dockMaxWidth: 396,
    dockHeight: 66,
    dockPaddingHorizontal: 10,
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
    bentoValueSize: 23,
    statValueWeight: '800',
  },
  navigation: {
    variant: 'oem_labeled_pill',
    showLabels: true,
    pillHeight: 50,
    pillMaxWidth: 86,
  },
  progress: {
    heroStrokeWidth: 11,
    waterStrokeWidth: 10,
    showWaterTipKnob: false,
    linearTrackHeight: 5,
  },
  motion: OXYGEN_MOTION_PRESET,
  mapPaletteToPaperColors: mapOxygenColorOsPaletteToColors,
  getMetricAccents: deriveOxygenMultiAccentRoles,
  resolveCardBorder: (colors, isDark) => ({
    borderWidth: 1,
    borderColor: isDark
      ? colorWithOpacity(colors.onSurface, 0.09)
      : colorWithOpacity(colors.onSurface, 0.055),
  }),
};
