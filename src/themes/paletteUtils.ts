/**
 * Palette utilities for dynamic Android Material You, API 34+/35+ system token resolution,
 * perceptual Oklab/Oklch color math, and multi-accent tonal derivation without hardcoded UI colors.
 */

import { NativeModules, Platform } from 'react-native';
import MaterialYou, {
  type GenerationStyle,
  type MaterialYouPalette,
} from 'react-native-material-you-colors';

import type { AccentColorRole, ExtendedSystemPalette } from './types';

/**
 * 13-tone array index mapping exposed by Android Material You palettes:
 * Tone:  0   10   50  100  200  300  400  500  600  700  800  900 1000
 */
export const PALETTE_SHADE = {
  T0: 0,
  T10: 1,
  T50: 2,
  T100: 3,
  T200: 4,
  T300: 5,
  T400: 6,
  T500: 7,
  T600: 8,
  T700: 9,
  T800: 10,
  T900: 11,
  T1000: 12,
} as const;

export const AYUMI_BASELINE_SEED = '#006E60';

export interface OklchColor {
  readonly L: number;
  readonly C: number;
  readonly h: number;
}

interface NativeSystemPaletteBridge {
  getExtendedSystemPalette?: () => ExtendedSystemPalette | null;
}

function isValidOpaqueHex(color: unknown): color is string {
  return typeof color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(color);
}

function isCompleteShadeArray(arr: unknown): boolean {
  return (
    Array.isArray(arr) &&
    arr.length >= 13 &&
    isValidOpaqueHex(arr[PALETTE_SHADE.T10]) &&
    isValidOpaqueHex(arr[PALETTE_SHADE.T200]) &&
    isValidOpaqueHex(arr[PALETTE_SHADE.T600]) &&
    isValidOpaqueHex(arr[PALETTE_SHADE.T900])
  );
}

function srgbChannelToLinear(channel255: number): number {
  const c = channel255 / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearChannelToSrgb255(linear: number): number {
  const clamped = Math.min(1, Math.max(0, linear));
  const srgb =
    clamped <= 0.0031308
      ? 12.92 * clamped
      : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  return Math.round(Math.min(255, Math.max(0, srgb * 255)));
}

function parseRgbChannels(color: string): [number, number, number] | null {
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
    const clean = color.slice(1);
    return [
      Number.parseInt(clean.slice(0, 2), 16),
      Number.parseInt(clean.slice(2, 4), 16),
      Number.parseInt(clean.slice(4, 6), 16),
    ];
  }

  const rgbMatch = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(color);
  if (rgbMatch) {
    return [
      Number.parseInt(rgbMatch[1], 10),
      Number.parseInt(rgbMatch[2], 10),
      Number.parseInt(rgbMatch[3], 10),
    ];
  }

  return null;
}

function channelsToHex(r: number, g: number, b: number): string {
  const hex = (n: number) =>
    Math.min(255, Math.max(0, Math.round(n)))
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * Converts a `#RRGGBB` or `rgb(r,g,b)` color into perceptual Oklch coordinates
 * using Björn Ottosson's Oklab transform.
 */
export function hexToOklch(color: string): OklchColor | null {
  const channels = parseRgbChannels(color);
  if (!channels) {
    return null;
  }

  const r = srgbChannelToLinear(channels[0]);
  const g = srgbChannelToLinear(channels[1]);
  const b = srgbChannelToLinear(channels[2]);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bLab = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const C = Math.hypot(a, bLab);
  const h = C < 1e-6 ? 0 : (((Math.atan2(bLab, a) * 180) / Math.PI) + 360) % 360;

  return { L, C, h };
}

function oklchToLinearRgb(L: number, C: number, hDeg: number): [number, number, number] {
  const rad = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(rad);
  const bLab = C * Math.sin(rad);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * bLab;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * bLab;
  const s_ = L - 0.0894841775 * a - 1.291485548 * bLab;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return [r, g, b];
}

function isInSrgbGamut(rgb: [number, number, number]): boolean {
  const eps = 1e-4;
  return (
    rgb[0] >= -eps &&
    rgb[0] <= 1 + eps &&
    rgb[1] >= -eps &&
    rgb[1] <= 1 + eps &&
    rgb[2] >= -eps &&
    rgb[2] <= 1 + eps
  );
}

/**
 * Converts Oklch coordinates back into a gamut-mapped `#RRGGBB` string while preserving
 * perceptual lightness and hue via binary chroma reduction when outside sRGB bounds.
 */
export function oklchToHex({ L, C, h }: OklchColor): string {
  const clampedL = Math.min(1, Math.max(0, L));
  const clampedC = Math.max(0, C);
  const normalizedH = ((h % 360) + 360) % 360;

  let candidate = oklchToLinearRgb(clampedL, clampedC, normalizedH);
  if (!isInSrgbGamut(candidate) && clampedC > 0) {
    let low = 0;
    let high = clampedC;
    for (let i = 0; i < 10; i += 1) {
      const mid = (low + high) * 0.5;
      if (isInSrgbGamut(oklchToLinearRgb(clampedL, mid, normalizedH))) {
        low = mid;
      } else {
        high = mid;
      }
    }
    candidate = oklchToLinearRgb(clampedL, low, normalizedH);
  }

  return channelsToHex(
    linearChannelToSrgb255(candidate[0]),
    linearChannelToSrgb255(candidate[1]),
    linearChannelToSrgb255(candidate[2]),
  );
}

/**
 * Limits Oklch chroma on neutral surfaces so OxygenOS light backgrounds remain clean
 * off-white and dark cards remain crisp elevated slate without heavy wallpaper muddying.
 */
export function clampNeutralChroma(color: string, maxChroma: number): string {
  const lch = hexToOklch(color);
  if (!lch || lch.C <= maxChroma) {
    return color;
  }
  return oklchToHex({ L: lch.L, C: maxChroma, h: lch.h });
}

/**
 * Linearly blends two opaque `#RRGGBB` colors in RGB space by weight `t` in `[0, 1]`.
 */
export function blendHex(colorA: string, colorB: string, t: number): string {
  const a = parseRgbChannels(colorA);
  const b = parseRgbChannels(colorB);
  if (!a || !b) {
    return colorA;
  }
  const weight = Math.min(1, Math.max(0, t));
  return channelsToHex(
    a[0] + (b[0] - a[0]) * weight,
    a[1] + (b[1] - a[1]) * weight,
    a[2] + (b[2] - a[2]) * weight,
  );
}

/**
 * Computes shortest circular angular distance in degrees `[0, 180]` between two Oklch hues.
 */
export function circularHueDistance(hueA: number, hueB: number): number {
  const diff = Math.abs(((hueA % 360) + 360) % 360 - (((hueB % 360) + 360) % 360));
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Computes WCAG 2.1 relative luminance in `[0, 1]` from any valid `#RRGGBB` or `rgb(...)` color.
 */
export function getRelativeLuminance(color: string): number | null {
  const channels = parseRgbChannels(color);
  if (!channels) {
    return null;
  }
  const r = srgbChannelToLinear(channels[0]);
  const g = srgbChannelToLinear(channels[1]);
  const b = srgbChannelToLinear(channels[2]);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Computes the WCAG 2.1 contrast ratio (`1..21`) between two colors.
 */
export function getContrastRatio(colorA: string, colorB: string): number {
  const lumA = getRelativeLuminance(colorA);
  const lumB = getRelativeLuminance(colorB);
  if (lumA === null || lumB === null) {
    return 1;
  }
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Picks `#FFFFFF` or a high-contrast dark foreground dynamically against `backgroundHex`
 * so text and filled icon silhouettes meet visibility targets across bright yellow/amber
 * badges as well as deep saturated hues.
 */
export function selectAccessibleForeground(
  backgroundHex: string,
  minContrastRatio: number = 4.5,
  lightCandidate: string = '#FFFFFF',
  darkCandidate: string = '#111827',
): string {
  const lightRatio = getContrastRatio(lightCandidate, backgroundHex);
  if (lightRatio >= minContrastRatio) {
    return lightCandidate;
  }
  const darkRatio = getContrastRatio(darkCandidate, backgroundHex);
  return darkRatio >= lightRatio ? darkCandidate : lightCandidate;
}

export interface OklchRoleSpec {
  readonly hue: number;
  readonly lightColor: { readonly L: number; readonly C: number; readonly h?: number };
  readonly darkColor: { readonly L: number; readonly C: number; readonly h?: number };
  readonly lightBadge: { readonly L: number; readonly C: number; readonly h?: number };
  readonly darkBadge: { readonly L: number; readonly C: number; readonly h?: number };
}

/**
 * Synthesizes an `AccentColorRole` directly in Oklch perceptual space with binary sRGB
 * gamut mapping and WCAG foreground contrast solving—avoiding Material You `TonalPalette`
 * chroma compression that washes out vivid seeds.
 */
export function buildOklchAccentRole(spec: OklchRoleSpec, isDark: boolean): AccentColorRole {
  const colorTarget = isDark ? spec.darkColor : spec.lightColor;
  const badgeTarget = isDark ? spec.darkBadge : spec.lightBadge;

  const color = oklchToHex({
    L: colorTarget.L,
    C: colorTarget.C,
    h: colorTarget.h ?? spec.hue,
  });
  const onColor = selectAccessibleForeground(color, 4.5);

  const badgeBg = oklchToHex({
    L: badgeTarget.L,
    C: badgeTarget.C,
    h: badgeTarget.h ?? spec.hue,
  });
  const onBadge = selectAccessibleForeground(badgeBg, 3.4);

  const container = oklchToHex({
    L: isDark ? 0.25 : 0.945,
    C: isDark ? Math.min(0.065, colorTarget.C * 0.38) : Math.min(0.055, colorTarget.C * 0.28),
    h: colorTarget.h ?? spec.hue,
  });
  const onContainer = oklchToHex({
    L: isDark ? 0.91 : 0.30,
    C: isDark ? Math.min(0.11, colorTarget.C * 0.65) : Math.min(0.14, colorTarget.C * 0.78),
    h: colorTarget.h ?? spec.hue,
  });

  return {
    color,
    onColor,
    container,
    onContainer,
    badgeBg,
    onBadge,
  };
}

/**
 * Resolves badge background and glyph colors honoring active surface `badgeStyle`
 * (`'solid'` saturated badge + filled contrast-safe glyph for OxygenOS/ColorOS, or
 * `'tonal'` soft container + accent stroke for Default).
 */
export function resolveMetricBadgeColors(
  role: AccentColorRole,
  badgeStyle: 'tonal' | 'solid',
): { readonly bg: string; readonly fg: string } {
  if (badgeStyle === 'solid') {
    const bg = role.badgeBg ?? role.color;
    const fg = role.onBadge ?? selectAccessibleForeground(bg, 3.4);
    return { bg, fg };
  }
  return {
    bg: role.container,
    fg: role.color,
  };
}

export type SystemPaletteChromaMode = 'monochrome' | 'neutral_accent' | 'chromatic';

/**
 * Distinguishes explicitly monochrome OS presets (`MONOCHROMATIC`) from low-chroma neutral/dull
 * wallpaper seeds (`SPRITZ` / desaturated earth tones) and vivid chromatic wallpaper seeds.
 */
export function classifySystemPaletteMode(palette: {
  readonly system_accent1?: readonly string[];
  readonly system_accent2?: readonly string[];
  readonly system_accent3?: readonly string[];
}): { readonly mode: SystemPaletteChromaMode; readonly seedHue: number; readonly peakChroma: number } {
  const sampleShadeIndices = [PALETTE_SHADE.T400, PALETTE_SHADE.T500, PALETTE_SHADE.T600];
  let maxAccent1C = 0;
  let bestAccent1Hue = 220;

  for (const idx of sampleShadeIndices) {
    const hex = palette.system_accent1?.[idx];
    const lch = hex ? hexToOklch(hex) : null;
    if (lch && lch.C > maxAccent1C) {
      maxAccent1C = lch.C;
      bestAccent1Hue = lch.h;
    }
  }

  let maxAnyAccentC = maxAccent1C;
  for (const scale of [palette.system_accent2, palette.system_accent3]) {
    for (const idx of sampleShadeIndices) {
      const hex = scale?.[idx];
      const lch = hex ? hexToOklch(hex) : null;
      if (lch && lch.C > maxAnyAccentC) {
        maxAnyAccentC = lch.C;
      }
    }
  }

  if (maxAnyAccentC < 0.014) {
    return { mode: 'monochrome', seedHue: 0, peakChroma: maxAnyAccentC };
  }
  if (maxAccent1C < 0.062) {
    return { mode: 'neutral_accent', seedHue: bestAccent1Hue, peakChroma: maxAccent1C };
  }
  return { mode: 'chromatic', seedHue: bestAccent1Hue, peakChroma: maxAccent1C };
}

/**
 * Generates an accessible vivid `AccentColorRole` directly in Oklch space from any single
 * dynamic seed hex without re-compressing saturation through Monet `TONAL_SPOT`/`RAINBOW`.
 */
export function buildAccentRoleFromSeed(seedHex: string, isDark: boolean): AccentColorRole {
  const validHex = isValidOpaqueHex(seedHex) ? seedHex : AYUMI_BASELINE_SEED;
  const seedLch = hexToOklch(validHex);
  if (!seedLch || seedLch.C < 0.015) {
    const grayColor = oklchToHex({ L: isDark ? 0.78 : 0.34, C: 0, h: 0 });
    const grayBadge = oklchToHex({ L: isDark ? 0.48 : 0.36, C: 0, h: 0 });
    return {
      color: grayColor,
      onColor: selectAccessibleForeground(grayColor, 4.5),
      container: oklchToHex({ L: isDark ? 0.24 : 0.92, C: 0, h: 0 }),
      onContainer: oklchToHex({ L: isDark ? 0.91 : 0.16, C: 0, h: 0 }),
      badgeBg: grayBadge,
      onBadge: selectAccessibleForeground(grayBadge, 3.4),
    };
  }

  const targetC = Math.min(0.215, Math.max(0.155, seedLch.C * 1.35));
  const isWarmGoldRange = seedLch.h >= 58 && seedLch.h <= 112;
  const adjustedLightHue = isWarmGoldRange ? 58 : seedLch.h;

  return buildOklchAccentRole(
    {
      hue: seedLch.h,
      lightColor: {
        L: isWarmGoldRange ? 0.59 : 0.535,
        C: isWarmGoldRange ? 0.17 : targetC,
        h: adjustedLightHue,
      },
      darkColor: { L: 0.70, C: Math.min(0.19, targetC * 0.92) },
      lightBadge: {
        L: isWarmGoldRange ? 0.745 : 0.575,
        C: targetC,
      },
      darkBadge: {
        L: isWarmGoldRange ? 0.745 : 0.575,
        C: targetC * 0.96,
      },
    },
    isDark,
  );
}

/**
 * Reads public Android API 31+ / 34+ / 35+ system palette tokens from `AyumiSystemPalette`
 * when running on Android. Returns `null` cleanly outside Android or when unavailable.
 */
export function readNativeExtendedSystemPalette(): ExtendedSystemPalette | null {
  if (Platform.OS !== 'android') {
    return null;
  }
  const bridge = NativeModules.AyumiSystemPalette as NativeSystemPaletteBridge | undefined;
  if (!bridge || typeof bridge.getExtendedSystemPalette !== 'function') {
    return null;
  }
  try {
    return bridge.getExtendedSystemPalette() ?? null;
  } catch (err) {
    // Surface native bridge failures explicitly rather than crashing app startup.
    console.warn('AyumiSystemPalette.getExtendedSystemPalette failed:', err);
    return null;
  }
}

/**
 * Converts a `#RRGGBB` or `rgb(...)` color into `rgba(r, g, b, alpha)` dynamically,
 * avoiding hardcoded overlay literals when computing disabled/backdrop surfaces.
 */
export function colorWithOpacity(color: string, alpha: number): string {
  const clamped = Math.min(Math.max(alpha, 0), 1);

  if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
    const clean = color.slice(1);
    const r = Number.parseInt(clean.slice(0, 2), 16);
    const g = Number.parseInt(clean.slice(2, 4), 16);
    const b = Number.parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${clamped})`;
  }

  const rgbMatch = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(color);
  if (rgbMatch) {
    return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${clamped})`;
  }

  return color;
}

/**
 * Evaluates perceptual ITU-R BT.709 luminance across both `#RRGGBB` and `rgb(r,g,b)` formats.
 */
export function isColorDark(color: string): boolean {
  const channels = parseRgbChannels(color);
  if (!channels) {
    return false;
  }
  const luminance = (0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]) / 255;
  return luminance < 0.5;
}

/**
 * Verifies system dynamic palette completeness and fills any missing accent or
 * neutral families from the active accent seed using Material Color Utilities.
 */
export function resolveCompleteDynamicPalette(
  rawPalette: MaterialYouPalette | null | undefined,
  fallbackSeed: string = AYUMI_BASELINE_SEED,
  fallbackStyle: GenerationStyle = 'VIBRANT',
): MaterialYouPalette {
  const validPrimarySeed =
    rawPalette && isCompleteShadeArray(rawPalette.system_accent1)
      ? rawPalette.system_accent1[PALETTE_SHADE.T600]
      : fallbackSeed;

  const synthesized = MaterialYou.generatePaletteFromColor(
    isValidOpaqueHex(validPrimarySeed) ? validPrimarySeed : fallbackSeed,
    fallbackStyle,
  );

  if (!rawPalette) {
    return synthesized;
  }

  const system_accent1 = isCompleteShadeArray(rawPalette.system_accent1)
    ? rawPalette.system_accent1
    : synthesized.system_accent1;

  const system_accent2 = isCompleteShadeArray(rawPalette.system_accent2)
    ? rawPalette.system_accent2
    : synthesized.system_accent2;

  // Ensure tertiary multi-accent exists and remains chromatically distinct from accent1
  // when the source palette itself is chromatic (do not inject chroma into Monochrome presets).
  const rawAccent3Valid = isCompleteShadeArray(rawPalette.system_accent3);
  const accent1T600C = hexToOklch(system_accent1[PALETTE_SHADE.T600] ?? '')?.C ?? 0;
  const accent3MatchesPrimary =
    rawAccent3Valid &&
    accent1T600C >= 0.014 &&
    rawPalette.system_accent3[PALETTE_SHADE.T600]?.toLowerCase() ===
      system_accent1[PALETTE_SHADE.T600]?.toLowerCase();

  const system_accent3 =
    rawAccent3Valid && !accent3MatchesPrimary
      ? rawPalette.system_accent3
      : synthesized.system_accent3;

  const system_neutral1 = isCompleteShadeArray(rawPalette.system_neutral1)
    ? rawPalette.system_neutral1
    : synthesized.system_neutral1;

  const system_neutral2 = isCompleteShadeArray(rawPalette.system_neutral2)
    ? rawPalette.system_neutral2
    : synthesized.system_neutral2;

  return {
    system_accent1,
    system_accent2,
    system_accent3,
    system_neutral1,
    system_neutral2,
  };
}
