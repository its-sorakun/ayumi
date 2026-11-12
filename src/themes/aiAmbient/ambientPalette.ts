/**
 * Dynamic palette derivation for AI Ambient supporting both:
 *  - System palette (`system_accent1..3`, `system_neutral1..2` from Android Material You / SystemPaletteModule)
 *  - Generated artwork palette (local OKLab MMCQ swatches extracted natively from the cached anime image)
 *
 * Guarantees crisp readability across light/dark translucent glass surfaces and contrast-guarded
 * foreground inks without hardcoding any fixed colorway.
 */

import type { MD3Theme } from 'react-native-paper';
import type { MaterialYouPalette } from 'react-native-material-you-colors';

import { createDarkTheme, createLightTheme } from '../../theme';
import {
  AYUMI_BASELINE_SEED,
  PALETTE_SHADE,
  blendHex,
  colorWithOpacity,
  getContrastRatio,
  readNativeExtendedSystemPalette,
  hexToOklch,
  oklchToHex,
  resolveCompleteDynamicPalette,
} from '../paletteUtils';
import type { AccentColorRole, MetricAccentRoles } from '../types';

export type AiAmbientColourSource = 'system' | 'artwork';

export interface ExtractedArtworkPalette {
  readonly dominant: string;
  readonly primary: string;
  readonly secondary: string;
  readonly tertiary: string;
  readonly highlight: string;
  readonly shadowDark: string;
  readonly surfaceLightTint: string;
  readonly surfaceDarkTint: string;
  readonly swatches: readonly string[];
  readonly isDarkArtwork: boolean;
}

export interface AiAmbientPaletteTokens {
  readonly source: AiAmbientColourSource;
  readonly isDark: boolean;
  readonly primary: string;
  readonly secondary: string;
  readonly tertiary: string;
  readonly highlight: string;
  readonly onPrimary: string;
  readonly primaryContainer: string;
  readonly onPrimaryContainer: string;
  readonly inkPrimary: string;
  readonly inkSecondary: string;
  readonly canvasBg: string;
  readonly canvasMistTop: string;
  readonly canvasMistBottom: string;
  readonly fallbackGradient: readonly [string, string, string];
  readonly glassFill: string;
  readonly glassFillStrong: string;
  readonly glassSubduedFill: string;
  readonly glassBorder: string;
  readonly glassHighlightEdge: string;
  readonly stepBlobAuraFill: string;
  readonly stepBlobBodyFill: string;
  readonly stepBlobTrackColor: string;
  readonly stepArcStart: string;
  readonly stepArcEnd: string;
  readonly waterBarStart: string;
  readonly waterBarEnd: string;
  readonly navWaveFill: string;
  readonly navWaveSecondaryFill: string;
  readonly navWaveBorder: string;
  readonly navBlobStart: string;
  readonly navBlobEnd: string;
  readonly navActiveIcon: string;
  readonly navInactiveIcon: string;
  readonly sparkleBtnFill: string;
  readonly sparkleIconColor: string;
  readonly headerScrimTop: string;
  readonly headerScrimMid: string;
  readonly summaryPromptPaletteHint: string;
}

function tuneColorChroma(
  hex: string,
  targetL: number,
  minC: number,
  maxC: number,
): string {
  const lch = hexToOklch(hex);
  if (!lch) return hex;
  const clampedC = lch.C < 0.015 ? lch.C : Math.min(maxC, Math.max(minC, lch.C));
  return oklchToHex({ L: targetL, C: clampedC, h: lch.h });
}

function ensureReadableContrast(
  fgHex: string,
  bgHex: string,
  preferDark: boolean,
  minRatio: number = 4.5,
): string {
  if (getContrastRatio(fgHex, bgHex) >= minRatio) {
    return fgHex;
  }
  const lch = hexToOklch(fgHex) ?? { L: preferDark ? 0.2 : 0.94, C: 0.02, h: 240 };
  let L = lch.L;
  for (let step = 0; step < 12; step += 1) {
    L = preferDark ? Math.max(0.08, L - 0.06) : Math.min(0.98, L + 0.06);
    const candidate = oklchToHex({ L, C: Math.min(lch.C, 0.08), h: lch.h });
    if (getContrastRatio(candidate, bgHex) >= minRatio) {
      return candidate;
    }
  }
  return preferDark ? '#141820' : '#F4F7FA';
}

function pickHighContrastOnFill(bgHex: string, seedHex: string): string {
  const lch = hexToOklch(seedHex) ?? { L: 0.5, C: 0.02, h: 240 };
  const lightCandidate = oklchToHex({ L: 0.98, C: Math.min(0.015, lch.C * 0.15), h: lch.h });
  const darkCandidate = oklchToHex({ L: 0.17, C: Math.min(0.03, lch.C * 0.2), h: lch.h });
  return getContrastRatio(lightCandidate, bgHex) >= getContrastRatio(darkCandidate, bgHex)
    ? lightCandidate
    : darkCandidate;
}

function hueNameFromOklch(hex: string): string {
  const lch = hexToOklch(hex);
  if (!lch || lch.C < 0.025) return 'soft monochrome slate';
  const h = lch.h;
  if (h < 25 || h >= 340) return 'warm crimson rose';
  if (h < 60) return 'peach sunset amber';
  if (h < 105) return 'golden honey sunlit';
  if (h < 155) return 'meadow sage emerald';
  if (h < 205) return 'misty jade cyan';
  if (h < 255) return 'cerulean twilight blue';
  if (h < 300) return 'periwinkle dusk indigo';
  return 'sakura blossom magenta';
}

/**
 * Extracts raw System Palette seed anchors via API 31+/34+/35+ SystemPaletteModule and
 * react-native-material-you-colors tonal scales so System Palette mode honors device OEM theme.
 */
function resolveSystemPaletteSeeds(
  rawPalette: MaterialYouPalette | null | undefined,
  isDark: boolean,
): {
  primary: string;
  secondary: string;
  tertiary: string;
  highlight: string;
  surfaceTint: string;
  shadowDark: string;
} {
  const extended = readNativeExtendedSystemPalette();
  const complete = resolveCompleteDynamicPalette(rawPalette, AYUMI_BASELINE_SEED, 'TONAL_SPOT');

  const accent1Raw =
    extended?.system_accent1?.[PALETTE_SHADE.T500] ??
    complete.system_accent1[PALETTE_SHADE.T500];
  const accent2Raw =
    extended?.system_accent2?.[PALETTE_SHADE.T500] ??
    complete.system_accent2[PALETTE_SHADE.T500];
  const accent3Raw =
    extended?.system_accent3?.[PALETTE_SHADE.T400] ??
    complete.system_accent3[PALETTE_SHADE.T400];

  const primary = tuneColorChroma(accent1Raw, isDark ? 0.72 : 0.54, 0.11, 0.22);
  const secondary = tuneColorChroma(accent2Raw, isDark ? 0.70 : 0.56, 0.09, 0.19);
  const tertiary = tuneColorChroma(accent3Raw, isDark ? 0.72 : 0.58, 0.10, 0.21);
  const highlight = tuneColorChroma(accent3Raw, 0.80, 0.09, 0.17);
  const neutralTintRaw =
    extended?.system_neutral1?.[isDark ? PALETTE_SHADE.T900 : PALETTE_SHADE.T50] ??
    complete.system_neutral1[isDark ? PALETTE_SHADE.T900 : PALETTE_SHADE.T50];
  const shadowRaw = complete.system_neutral1[PALETTE_SHADE.T900];

  return {
    primary,
    secondary,
    tertiary,
    highlight,
    surfaceTint: tuneColorChroma(neutralTintRaw, isDark ? 0.18 : 0.96, 0.008, 0.03),
    shadowDark: tuneColorChroma(shadowRaw, 0.19, 0.015, 0.045),
  };
}

/**
 * Resolves unified AI Ambient visual tokens from either the OS system palette OR
 * extracted local artwork swatches, guaranteeing legible foreground contrast in both
 * light and dark themes.
 */
export function resolveAiAmbientPaletteTokens({
  colourSource,
  systemPalette,
  artworkPalette,
  isDark,
}: {
  readonly colourSource: AiAmbientColourSource;
  readonly systemPalette: MaterialYouPalette | null | undefined;
  readonly artworkPalette: ExtractedArtworkPalette | null | undefined;
  readonly isDark: boolean;
}): AiAmbientPaletteTokens {
  const sysSeeds = resolveSystemPaletteSeeds(systemPalette, isDark);
  const useArtwork = colourSource === 'artwork' && artworkPalette != null;

  const primaryRaw = useArtwork ? artworkPalette.primary : sysSeeds.primary;
  const secondaryRaw = useArtwork ? artworkPalette.secondary : sysSeeds.secondary;
  const tertiaryRaw = useArtwork ? artworkPalette.tertiary : sysSeeds.tertiary;
  const highlightRaw = useArtwork ? artworkPalette.highlight : sysSeeds.highlight;
  const surfaceBase = useArtwork
    ? isDark
      ? artworkPalette.surfaceDarkTint
      : artworkPalette.surfaceLightTint
    : sysSeeds.surfaceTint;

  const primary = tuneColorChroma(primaryRaw, isDark ? 0.72 : 0.53, 0.12, 0.22);
  const secondary = tuneColorChroma(secondaryRaw, isDark ? 0.69 : 0.56, 0.10, 0.20);
  const tertiary = tuneColorChroma(tertiaryRaw, isDark ? 0.71 : 0.57, 0.10, 0.20);
  const highlight = tuneColorChroma(highlightRaw, isDark ? 0.79 : 0.74, 0.08, 0.18);
  const deepInkSeed = useArtwork ? artworkPalette.shadowDark : sysSeeds.shadowDark;

  const onPrimary = pickHighContrastOnFill(primary, deepInkSeed);
  const primaryLch = hexToOklch(primary) ?? { L: 0.56, C: 0.14, h: 260 };
  const primaryContainer = oklchToHex({
    L: isDark ? 0.29 : 0.91,
    C: Math.min(0.08, primaryLch.C * 0.55),
    h: primaryLch.h,
  });
  const onPrimaryContainer = ensureReadableContrast(
    oklchToHex({ L: isDark ? 0.93 : 0.23, C: Math.min(0.06, primaryLch.C * 0.4), h: primaryLch.h }),
    primaryContainer,
    !isDark,
    4.6,
  );

  const inkPrimary = ensureReadableContrast(
    isDark
      ? oklchToHex({ L: 0.95, C: 0.012, h: primaryLch.h })
      : oklchToHex({ L: 0.18, C: Math.min(0.032, primaryLch.C * 0.28), h: primaryLch.h }),
    surfaceBase,
    !isDark,
    7.0,
  );
  const inkSecondary = ensureReadableContrast(
    isDark
      ? oklchToHex({ L: 0.77, C: 0.025, h: primaryLch.h })
      : oklchToHex({ L: 0.43, C: Math.min(0.035, primaryLch.C * 0.3), h: primaryLch.h }),
    surfaceBase,
    !isDark,
    4.6,
  );

  const canvasBg = isDark
    ? blendHex(surfaceBase, '#0D1017', 0.35)
    : blendHex(surfaceBase, '#FFFFFF', 0.25);

  const mistTint = isDark
    ? oklchToHex({ L: 0.15, C: Math.min(0.035, primaryLch.C * 0.3), h: primaryLch.h })
    : oklchToHex({ L: 0.93, C: Math.min(0.028, primaryLch.C * 0.26), h: primaryLch.h });

  const gradTop = oklchToHex({
    L: isDark ? 0.24 : 0.56,
    C: Math.min(0.14, primaryLch.C * 0.8),
    h: primaryLch.h,
  });
  const gradMid = oklchToHex({
    L: isDark ? 0.20 : 0.76,
    C: Math.min(0.10, (hexToOklch(secondary)?.C ?? 0.1) * 0.7),
    h: (hexToOklch(secondary)?.h ?? (primaryLch.h + 36)) % 360,
  });

  const navWaveHex = isDark
    ? oklchToHex({ L: 0.21, C: Math.min(0.032, primaryLch.C * 0.25), h: primaryLch.h })
    : '#FFFFFF';
  const navSecondaryWaveHex = isDark
    ? oklchToHex({ L: 0.28, C: Math.min(0.04, primaryLch.C * 0.3), h: primaryLch.h })
    : oklchToHex({ L: 0.95, C: Math.min(0.035, primaryLch.C * 0.3), h: primaryLch.h });

  const blobEnd = oklchToHex({
    L: isDark ? 0.58 : 0.54,
    C: Math.min(0.22, Math.max(0.13, primaryLch.C)),
    h: primaryLch.h,
  });
  const blobStart = oklchToHex({
    L: isDark ? 0.66 : 0.64,
    C: Math.min(0.19, Math.max(0.11, primaryLch.C * 0.92)),
    h: ((hexToOklch(tertiary)?.h ?? (primaryLch.h + 24)) % 360),
  });

  const stepArcStart = oklchToHex({
    L: isDark ? 0.76 : 0.72,
    C: Math.min(0.17, Math.max(0.10, (hexToOklch(highlight)?.C ?? 0.12))),
    h: hexToOklch(highlight)?.h ?? ((primaryLch.h + 28) % 360),
  });
  const stepArcEnd = oklchToHex({
    L: isDark ? 0.62 : 0.52,
    C: Math.min(0.22, Math.max(0.14, primaryLch.C)),
    h: primaryLch.h,
  });

  const waterLch = hexToOklch(secondary) ?? primaryLch;
  const waterBarStart = oklchToHex({
    L: isDark ? 0.75 : 0.68,
    C: Math.min(0.18, Math.max(0.11, waterLch.C)),
    h: waterLch.h,
  });
  const waterBarEnd = oklchToHex({
    L: isDark ? 0.62 : 0.52,
    C: Math.min(0.22, Math.max(0.14, primaryLch.C)),
    h: primaryLch.h,
  });

  const summaryPromptPaletteHint = `${hueNameFromOklch(primary)} paired with ${hueNameFromOklch(
    secondary,
  )} and soft ${hueNameFromOklch(highlight)} accents`;

  return {
    source: useArtwork ? 'artwork' : 'system',
    isDark,
    primary,
    secondary,
    tertiary,
    highlight,
    onPrimary,
    primaryContainer,
    onPrimaryContainer,
    inkPrimary,
    inkSecondary,
    canvasBg,
    canvasMistTop: colorWithOpacity(mistTint, isDark ? 0.14 : 0.18),
    canvasMistBottom: colorWithOpacity(mistTint, isDark ? 0.92 : 0.90),
    fallbackGradient: [gradTop, gradMid, surfaceBase],
    glassFill: isDark
      ? colorWithOpacity(surfaceBase, 0.72)
      : colorWithOpacity('#FFFFFF', 0.76),
    glassFillStrong: isDark
      ? colorWithOpacity(surfaceBase, 0.86)
      : colorWithOpacity('#FFFFFF', 0.88),
    glassSubduedFill: isDark
      ? colorWithOpacity(surfaceBase, 0.78)
      : colorWithOpacity('#FFFFFF', 0.82),
    glassBorder: isDark
      ? colorWithOpacity('#FFFFFF', 0.14)
      : colorWithOpacity('#FFFFFF', 0.78),
    glassHighlightEdge: isDark
      ? colorWithOpacity(highlight, 0.18)
      : colorWithOpacity('#FFFFFF', 0.92),
    stepBlobAuraFill: isDark
      ? colorWithOpacity(primary, 0.18)
      : colorWithOpacity('#FFFFFF', 0.44),
    stepBlobBodyFill: isDark
      ? colorWithOpacity(surfaceBase, 0.84)
      : colorWithOpacity('#FFFFFF', 0.84),
    stepBlobTrackColor: isDark
      ? colorWithOpacity('#FFFFFF', 0.12)
      : colorWithOpacity(primary, 0.13),
    stepArcStart,
    stepArcEnd,
    waterBarStart,
    waterBarEnd,
    navWaveFill: colorWithOpacity(navWaveHex, isDark ? 0.88 : 0.86),
    navWaveSecondaryFill: colorWithOpacity(navSecondaryWaveHex, isDark ? 0.42 : 0.56),
    navWaveBorder: isDark
      ? colorWithOpacity('#FFFFFF', 0.14)
      : colorWithOpacity('#FFFFFF', 0.9),
    navBlobStart: blobStart,
    navBlobEnd: blobEnd,
    navActiveIcon: pickHighContrastOnFill(blobEnd, deepInkSeed),
    navInactiveIcon: colorWithOpacity(inkSecondary, 0.82),
    sparkleBtnFill: isDark
      ? colorWithOpacity(surfaceBase, 0.78)
      : colorWithOpacity('#FFFFFF', 0.88),
    sparkleIconColor: primary,
    headerScrimTop: isDark ? 'rgba(8, 10, 16, 0.58)' : 'rgba(18, 22, 34, 0.36)',
    headerScrimMid: isDark ? 'rgba(8, 10, 16, 0.24)' : 'rgba(18, 22, 34, 0.14)',
    summaryPromptPaletteHint,
  };
}

/** Maps resolved AI Ambient tokens into React Native Paper MD3 `colors`. */
export function mapAiAmbientTokensToPaperColors(
  tokens: AiAmbientPaletteTokens,
): MD3Theme['colors'] {
  const onSecondary = pickHighContrastOnFill(tokens.secondary, tokens.inkPrimary);
  const onTertiary = pickHighContrastOnFill(tokens.tertiary, tokens.inkPrimary);
  const level1 = blendHex(tokens.canvasBg, '#FFFFFF', tokens.isDark ? 0.06 : 0.52);
  const level2 = blendHex(tokens.canvasBg, '#FFFFFF', tokens.isDark ? 0.10 : 0.72);
  const level3 = blendHex(tokens.canvasBg, tokens.primary, tokens.isDark ? 0.14 : 0.08);

  const overrides = {
    primary: tokens.primary,
    onPrimary: tokens.onPrimary,
    primaryContainer: tokens.primaryContainer,
    onPrimaryContainer: tokens.onPrimaryContainer,
    secondary: tokens.secondary,
    onSecondary,
    secondaryContainer: blendHex(tokens.canvasBg, tokens.secondary, tokens.isDark ? 0.26 : 0.16),
    onSecondaryContainer: tokens.inkPrimary,
    tertiary: tokens.tertiary,
    onTertiary,
    tertiaryContainer: blendHex(tokens.canvasBg, tokens.tertiary, tokens.isDark ? 0.26 : 0.16),
    onTertiaryContainer: tokens.inkPrimary,
    background: tokens.canvasBg,
    onBackground: tokens.inkPrimary,
    surface: level1,
    onSurface: tokens.inkPrimary,
    surfaceVariant: blendHex(tokens.canvasBg, tokens.primary, tokens.isDark ? 0.12 : 0.06),
    onSurfaceVariant: tokens.inkSecondary,
    outline: colorWithOpacity(tokens.inkSecondary, 0.45),
    outlineVariant: colorWithOpacity(tokens.inkPrimary, tokens.isDark ? 0.14 : 0.09),
    elevation: {
      level0: 'transparent',
      level1,
      level2,
      level3,
      level4: level3,
      level5: blendHex(tokens.canvasBg, tokens.primary, tokens.isDark ? 0.18 : 0.12),
    },
  };

  return (tokens.isDark ? createDarkTheme(overrides) : createLightTheme(overrides)).colors;
}

function buildRoleFromColor(
  accentHex: string,
  containerBgRef: string,
  isDark: boolean,
): AccentColorRole {
  const lch = hexToOklch(accentHex) ?? { L: 0.56, C: 0.14, h: 240 };
  const color = oklchToHex({
    L: isDark ? 0.73 : 0.54,
    C: Math.min(0.22, Math.max(0.11, lch.C)),
    h: lch.h,
  });
  const onColor = pickHighContrastOnFill(color, '#12151C');
  const container = oklchToHex({
    L: isDark ? 0.27 : 0.92,
    C: Math.min(0.075, lch.C * 0.45),
    h: lch.h,
  });
  const onContainer = ensureReadableContrast(
    oklchToHex({ L: isDark ? 0.94 : 0.22, C: Math.min(0.05, lch.C * 0.35), h: lch.h }),
    containerBgRef,
    !isDark,
    4.5,
  );
  return {
    color,
    onColor,
    container,
    onContainer,
    badgeBg: colorWithOpacity(color, isDark ? 0.24 : 0.13),
    onBadge: color,
  };
}

/**
 * Derives per-metric soft harmonious accent roles from the active AI Ambient palette
 * (system or artwork), tuning warm/cool hue offsets so every metric stays distinct yet cohesive.
 */
export function deriveAiAmbientMetricAccents(
  tokens: AiAmbientPaletteTokens,
): MetricAccentRoles {
  const pLch = hexToOklch(tokens.primary) ?? { L: 0.56, C: 0.14, h: 255 };
  const sLch = hexToOklch(tokens.secondary) ?? { L: 0.6, C: 0.12, h: (pLch.h + 45) % 360 };
  const tLch = hexToOklch(tokens.tertiary) ?? { L: 0.62, C: 0.12, h: (pLch.h + 150) % 360 };

  // Softly blend toward harmonious semantic directions (coral-amber flames, cool sky water)
  // while keeping hue proximity grounded in the active ambient palette.
  const caloriesHex = oklchToHex({
    L: tokens.isDark ? 0.72 : 0.58,
    C: Math.min(0.20, Math.max(0.12, tLch.C)),
    h: ((tLch.h * 0.65 + 28 * 0.35) + 360) % 360,
  });
  const waterHex = oklchToHex({
    L: tokens.isDark ? 0.72 : 0.55,
    C: Math.min(0.19, Math.max(0.11, sLch.C)),
    h: ((sLch.h * 0.65 + 225 * 0.35) + 360) % 360,
  });
  const activeTimeHex = oklchToHex({
    L: tokens.isDark ? 0.72 : 0.54,
    C: Math.min(0.18, Math.max(0.10, pLch.C)),
    h: (pLch.h + 38) % 360,
  });

  return {
    steps: buildRoleFromColor(tokens.primary, tokens.canvasBg, tokens.isDark),
    calories: buildRoleFromColor(caloriesHex, tokens.canvasBg, tokens.isDark),
    totalCalories: buildRoleFromColor(tokens.highlight, tokens.canvasBg, tokens.isDark),
    distance: buildRoleFromColor(tokens.secondary, tokens.canvasBg, tokens.isDark),
    activeTime: buildRoleFromColor(activeTimeHex, tokens.canvasBg, tokens.isDark),
    water: buildRoleFromColor(waterHex, tokens.canvasBg, tokens.isDark),
  };
}
