/**
 * Dynamic Material You system palette derivation and seasonal atmospheric scenery
 * color synthesis for Ayumi's Ambient Scenery theme.
 * Guarantees accessible OKLab/OKLCH ink contrast across light and dark translucent glass
 * surfaces while tinting skies, ridges, and foliage across 7 time phases, 8 weather looks,
 * and 5 seasonal vibes.
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
  hexToOklch,
  oklchToHex,
  readNativeExtendedSystemPalette,
  resolveCompleteDynamicPalette,
} from '../paletteUtils';
import type { AccentColorRole, MetricAccentRoles } from '../types';
import {
  isDarkTimePhase,
  isRainyWeatherCategory,
  type SeasonalVibe,
  type TimeOfDayPhase,
  type WeatherConditionCategory,
} from './config';

export interface AiAmbientPaletteTokens {
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
}

export interface AtmosphericSceneryPalette {
  readonly skyColors: readonly [string, string, string];
  readonly celestialGlow: string;
  readonly celestialCore: string;
  readonly horizonHaze: string;
  readonly farMountain: string;
  readonly midHill: string;
  readonly nearHill: string;
  readonly foliageAccent: string;
  readonly foliageSecondary: string;
  readonly snowCapColor: string | null;
  readonly snowCapRatio: number;
  readonly headerScrimTop: string;
  readonly headerScrimMid: string;
  readonly starDensity: number;
  readonly showShootingStars: boolean;
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

/**
 * Extracts raw System Palette seed anchors via API 31+/34+/35+ SystemPaletteModule and
 * react-native-material-you-colors tonal scales so Ambient Scenery honors device Material You.
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

/** Resolves foreground card, nav, and typography tokens from the active OS Material You palette. */
export function resolveAiAmbientPaletteTokens({
  systemPalette,
  isDark,
}: {
  readonly systemPalette: MaterialYouPalette | null | undefined;
  readonly isDark: boolean;
}): AiAmbientPaletteTokens {
  const sysSeeds = resolveSystemPaletteSeeds(systemPalette, isDark);

  const primary = tuneColorChroma(sysSeeds.primary, isDark ? 0.72 : 0.53, 0.12, 0.22);
  const secondary = tuneColorChroma(sysSeeds.secondary, isDark ? 0.69 : 0.56, 0.10, 0.20);
  const tertiary = tuneColorChroma(sysSeeds.tertiary, isDark ? 0.71 : 0.57, 0.10, 0.20);
  const highlight = tuneColorChroma(sysSeeds.highlight, isDark ? 0.79 : 0.74, 0.08, 0.18);
  const surfaceBase = sysSeeds.surfaceTint;
  const deepInkSeed = sysSeeds.shadowDark;

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
    h: (hexToOklch(tertiary)?.h ?? (primaryLch.h + 24)) % 360,
  });

  const stepArcStart = oklchToHex({
    L: isDark ? 0.76 : 0.72,
    C: Math.min(0.17, Math.max(0.10, hexToOklch(highlight)?.C ?? 0.12)),
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

  return {
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
    canvasMistTop: colorWithOpacity(mistTint, isDark ? 0.12 : 0.14),
    canvasMistBottom: colorWithOpacity(mistTint, isDark ? 0.92 : 0.88),
    fallbackGradient: [gradTop, gradMid, surfaceBase],
    glassFill: isDark
      ? colorWithOpacity(surfaceBase, 0.74)
      : colorWithOpacity('#FFFFFF', 0.78),
    glassFillStrong: isDark
      ? colorWithOpacity(surfaceBase, 0.88)
      : colorWithOpacity('#FFFFFF', 0.89),
    glassSubduedFill: isDark
      ? colorWithOpacity(surfaceBase, 0.80)
      : colorWithOpacity('#FFFFFF', 0.83),
    glassBorder: isDark
      ? colorWithOpacity('#FFFFFF', 0.14)
      : colorWithOpacity('#FFFFFF', 0.80),
    glassHighlightEdge: isDark
      ? colorWithOpacity(highlight, 0.18)
      : colorWithOpacity('#FFFFFF', 0.94),
    stepBlobAuraFill: isDark
      ? colorWithOpacity(primary, 0.18)
      : colorWithOpacity('#FFFFFF', 0.46),
    stepBlobBodyFill: isDark
      ? colorWithOpacity(surfaceBase, 0.86)
      : colorWithOpacity('#FFFFFF', 0.86),
    stepBlobTrackColor: isDark
      ? colorWithOpacity('#FFFFFF', 0.12)
      : colorWithOpacity(primary, 0.13),
    stepArcStart,
    stepArcEnd,
    waterBarStart,
    waterBarEnd,
    navWaveFill: colorWithOpacity(navWaveHex, isDark ? 0.90 : 0.88),
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
    headerScrimTop: isDark ? 'rgba(8, 10, 16, 0.58)' : 'rgba(18, 22, 34, 0.34)',
    headerScrimMid: isDark ? 'rgba(8, 10, 16, 0.24)' : 'rgba(18, 22, 34, 0.12)',
  };
}

/** Computes dynamic sky, celestial, ridge, and seasonal flora colors for Ambient Scenery. */
export function resolveAtmosphericSceneryPalette({
  phase,
  weatherCategory,
  season,
  seasonalEnabled,
}: {
  readonly phase: TimeOfDayPhase;
  readonly weatherCategory: WeatherConditionCategory;
  readonly season: SeasonalVibe;
  readonly seasonalEnabled: boolean;
}): AtmosphericSceneryPalette {
  const isNightSky = isDarkTimePhase(phase);
  const isRainy = isRainyWeatherCategory(weatherCategory);

  // Base 7-phase sky progression & celestial light colors
  let skyTop = '#4E8CD2';
  let skyMid = '#89BEEF';
  let skyHorizon = '#E4EFF9';
  let celestialGlow = '#FFF1B8';
  let celestialCore = '#FFF8DC';

  switch (phase) {
    case 'dawn':
      skyTop = '#3B4275';
      skyMid = '#B26F95';
      skyHorizon = '#F8BF91';
      celestialGlow = '#FFD5A6';
      celestialCore = '#FFF0CC';
      break;
    case 'morning':
      skyTop = '#448BD6';
      skyMid = '#81BFF1';
      skyHorizon = '#E7F3FC';
      celestialGlow = '#FFF3C4';
      celestialCore = '#FFF9E2';
      break;
    case 'afternoon':
      skyTop = '#2D72CA';
      skyMid = '#6FB2EC';
      skyHorizon = '#DCEDFA';
      celestialGlow = '#FFEBA8';
      celestialCore = '#FFF6D1';
      break;
    case 'evening':
      skyTop = '#3F3A73';
      skyMid = '#C66674';
      skyHorizon = '#FBB06C';
      celestialGlow = '#FFC07A';
      celestialCore = '#FFE3AF';
      break;
    case 'dusk':
      skyTop = '#181E46';
      skyMid = '#3F366F';
      skyHorizon = '#93557C';
      celestialGlow = '#F6DFA8';
      celestialCore = '#FFF4D8';
      break;
    case 'night':
      skyTop = '#0A1026';
      skyMid = '#152348';
      skyHorizon = '#253B6C';
      celestialGlow = '#EBF2FF';
      celestialCore = '#FFF8DF';
      break;
    case 'midnight':
      skyTop = '#040712';
      skyMid = '#0A1128';
      skyHorizon = '#142244';
      celestialGlow = '#DDF0FF';
      celestialCore = '#F7FBFF';
      break;
  }

  // Seasonal sky atmosphere adjustments (subtle seasonal temperature & moisture character)
  if (seasonalEnabled) {
    if (season === 'harsh_winter') {
      skyTop = blendHex(skyTop, isNightSky ? '#0A1426' : '#6F8FAD', 0.34);
      skyMid = blendHex(skyMid, isNightSky ? '#1A2D4A' : '#B7CDE0', 0.34);
      skyHorizon = blendHex(skyHorizon, isNightSky ? '#2F4668' : '#EBF2F8', 0.42);
    } else if (season === 'early_spring') {
      skyMid = blendHex(skyMid, isNightSky ? '#262F5E' : '#B8C4EA', 0.22);
      skyHorizon = blendHex(skyHorizon, isNightSky ? '#3B426E' : '#F3E3EE', 0.25);
    } else if (season === 'spring') {
      skyMid = blendHex(skyMid, isNightSky ? '#2B2B5C' : '#C7BEEF', 0.24);
      skyHorizon = blendHex(skyHorizon, isNightSky ? '#473D6E' : '#F9E6F1', 0.28);
    } else if (season === 'autumn_transition') {
      skyTop = blendHex(skyTop, isNightSky ? '#141736' : '#4E6B9B', 0.25);
      skyHorizon = blendHex(skyHorizon, isNightSky ? '#382C4C' : '#F3D2B3', 0.28);
    }
  }

  // Weather optical shifts over the sky gradient
  if (weatherCategory === 'cloudy') {
    const muteColor = isNightSky ? '#1D2536' : '#96A6BA';
    skyTop = blendHex(skyTop, muteColor, 0.42);
    skyMid = blendHex(skyMid, isNightSky ? '#2B364D' : '#BCC8D8', 0.45);
    skyHorizon = blendHex(skyHorizon, isNightSky ? '#3B4861' : '#DFE7F0', 0.45);
  } else if (weatherCategory === 'drizzle' || weatherCategory === 'rain') {
    const rainTone = isNightSky ? '#131D30' : '#4D6885';
    skyTop = blendHex(skyTop, rainTone, 0.48);
    skyMid = blendHex(skyMid, isNightSky ? '#1F2F48' : '#6E89A6', 0.50);
    skyHorizon = blendHex(skyHorizon, isNightSky ? '#2E415F' : '#A2BACD', 0.48);
  } else if (weatherCategory === 'thunderstorm') {
    skyTop = blendHex(skyTop, '#111626', isNightSky ? 0.65 : 0.72);
    skyMid = blendHex(skyMid, '#222D45', isNightSky ? 0.60 : 0.68);
    skyHorizon = blendHex(skyHorizon, '#3A4A68', isNightSky ? 0.52 : 0.62);
  } else if (weatherCategory === 'snow') {
    skyTop = blendHex(skyTop, isNightSky ? '#1B2840' : '#A9BED6', 0.44);
    skyMid = blendHex(skyMid, isNightSky ? '#2D415E' : '#D5E3F0', 0.48);
    skyHorizon = blendHex(skyHorizon, isNightSky ? '#405776' : '#F2F7FC', 0.52);
  } else if (weatherCategory === 'mist') {
    const mistTone = isNightSky ? '#273348' : '#D8E3EE';
    skyTop = blendHex(skyTop, mistTone, 0.35);
    skyMid = blendHex(skyMid, mistTone, 0.46);
    skyHorizon = blendHex(skyHorizon, isNightSky ? '#3A4A63' : '#EEF3F7', 0.62);
  }

  // Resolve base terrain & seasonal foliage layers
  let farMountain = isNightSky ? '#202E4F' : '#6A83A8';
  let midHill = isNightSky ? '#182542' : '#537396';
  let nearHill = isNightSky ? '#111B33' : '#3C5877';
  let foliageAccent = '#539464';
  let foliageSecondary = '#74B483';
  let snowCapColor: string | null = null;
  let snowCapRatio = 0;

  if (!seasonalEnabled) {
    if (!isNightSky) {
      farMountain = blendHex(skyTop, '#6E829E', 0.55);
      midHill = blendHex(skyMid, '#4E6B86', 0.52);
      nearHill = '#39556F';
      foliageAccent = isRainy ? '#3A8B5E' : '#4E8262';
      foliageSecondary = '#6CA17D';
    } else {
      foliageAccent = '#244A47';
      foliageSecondary = '#35615C';
    }
  } else {
    switch (season) {
      case 'harsh_winter':
        farMountain = isNightSky ? '#23334F' : '#738BA6';
        midHill = isNightSky ? '#1A2740' : '#5E748E';
        nearHill = isNightSky ? '#131E33' : '#43586E';
        foliageAccent = isNightSky ? '#243C4A' : '#415E6B';
        foliageSecondary = isNightSky ? '#B6CDE0' : '#DCEAF6';
        snowCapColor = isNightSky ? '#9BB8D6' : '#F4F9FF';
        snowCapRatio = 0.85;
        break;
      case 'early_spring':
        farMountain = isNightSky ? '#223254' : '#6C84A6';
        midHill = isNightSky ? '#1A2A48' : '#527873';
        nearHill = isNightSky ? '#142138' : '#3B5C59';
        foliageAccent = isNightSky ? '#2D5950' : '#528A6D';
        foliageSecondary = isNightSky ? '#A66F8E' : '#F0AECA';
        snowCapColor = isNightSky ? '#88A4C7' : '#E7F1FB';
        snowCapRatio = 0.38;
        break;
      case 'spring':
        farMountain = isNightSky ? '#233156' : '#6E87AD';
        midHill = isNightSky ? '#1D334C' : '#548E68';
        nearHill = isNightSky ? '#15283C' : '#3C704E';
        foliageAccent = isNightSky ? '#2F6B4E' : '#5EB26A';
        foliageSecondary = isNightSky ? '#A96B8C' : '#F59CC2';
        break;
      case 'summer':
        if (isRainy) {
          // Monsoon summer: lush saturated wet emeralds & deep canopy viridian
          farMountain = isNightSky ? '#133638' : '#31765A';
          midHill = isNightSky ? '#114438' : '#248C4D';
          nearHill = isNightSky ? '#0C3328' : '#166637';
          foliageAccent = isNightSky ? '#1F7A49' : '#2EB85C';
          foliageSecondary = isNightSky ? '#389962' : '#6AD97C';
        } else {
          farMountain = isNightSky ? '#1B2D47' : '#5E858C';
          midHill = isNightSky ? '#15303B' : '#3F7D56';
          nearHill = isNightSky ? '#0F242C' : '#2B5E42';
          foliageAccent = isNightSky ? '#256047' : '#459B5D';
          foliageSecondary = isNightSky ? '#3E7A5D' : '#73BA6E';
        }
        break;
      case 'autumn_transition':
        farMountain = isNightSky ? '#282644' : '#7D748E';
        midHill = isNightSky ? '#2B2133' : '#965A3D';
        nearHill = isNightSky ? '#211828' : '#6A3E30';
        foliageAccent = isNightSky ? '#7D4730' : '#D67B3E';
        foliageSecondary = isNightSky ? '#966A36' : '#E8AA4C';
        break;
    }
  }

  // Snowfall weather always adds light frost dust even outside winter
  if (weatherCategory === 'snow' && snowCapColor == null) {
    snowCapColor = isNightSky ? '#92B0D0' : '#EEF6FE';
    snowCapRatio = 0.55;
  }

  const starDensity =
    phase === 'midnight'
      ? 1.0
      : phase === 'night'
        ? 0.78
        : phase === 'dusk'
          ? 0.42
          : phase === 'dawn'
            ? 0.18
            : 0;

  return {
    skyColors: [skyTop, skyMid, skyHorizon],
    celestialGlow,
    celestialCore,
    horizonHaze: skyHorizon,
    farMountain,
    midHill,
    nearHill,
    foliageAccent,
    foliageSecondary,
    snowCapColor,
    snowCapRatio,
    headerScrimTop: isNightSky ? 'rgba(4, 6, 16, 0.48)' : 'rgba(14, 20, 36, 0.34)',
    headerScrimMid: isNightSky ? 'rgba(4, 6, 16, 0.16)' : 'rgba(14, 20, 36, 0.10)',
    starDensity:
      weatherCategory === 'thunderstorm' || weatherCategory === 'cloudy'
        ? starDensity * 0.28
        : weatherCategory === 'rain' || weatherCategory === 'mist'
          ? starDensity * 0.4
          : starDensity,
    showShootingStars:
      (phase === 'night' || phase === 'midnight' || phase === 'dusk') &&
      weatherCategory !== 'cloudy' &&
      weatherCategory !== 'thunderstorm',
  };
}

/** Maps resolved Ambient Scenery tokens into React Native Paper MD3 `colors`. */
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

/** Derives per-metric harmonious accent roles from the active system palette tokens. */
export function deriveAiAmbientMetricAccents(
  tokens: Pick<
    AiAmbientPaletteTokens,
    'primary' | 'secondary' | 'tertiary' | 'highlight' | 'canvasBg' | 'isDark'
  >,
): MetricAccentRoles {
  const pLch = hexToOklch(tokens.primary) ?? { L: 0.56, C: 0.14, h: 255 };
  const sLch = hexToOklch(tokens.secondary) ?? { L: 0.6, C: 0.12, h: (pLch.h + 45) % 360 };
  const tLch = hexToOklch(tokens.tertiary) ?? { L: 0.62, C: 0.12, h: (pLch.h + 150) % 360 };

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
