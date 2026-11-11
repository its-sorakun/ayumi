/**
 * Theme system contracts and token definitions for Ayumi visual themes.
 *
 * Separates visual presentation and motion tuning from application logic so
 * new OEM or editorial themes can be registered in `src/themes/` without
 * modifying health data providers, calculations, or storage keys.
 */

import type { Animated, EasingFunction, LayoutChangeEvent } from 'react-native';
import type { MD3Theme } from 'react-native-paper';
import type { MaterialYouPalette } from 'react-native-material-you-colors';

export type AyumiThemeId = 'default' | 'oxygen_coloros';

export const DEFAULT_VISUAL_THEME_ID: AyumiThemeId = 'default';

/** Normalizes any stored string value into a supported Ayumi theme identifier. */
export function normalizeVisualThemeId(raw: string | null | undefined): AyumiThemeId {
  if (raw === 'oxygen_coloros') {
    return 'oxygen_coloros';
  }
  return 'default';
}

export interface ExtendedSystemSemanticTokens {
  readonly primaryLight?: string;
  readonly primaryDark?: string;
  readonly primaryContainerLight?: string;
  readonly primaryContainerDark?: string;
  readonly secondaryLight?: string;
  readonly secondaryDark?: string;
  readonly tertiaryLight?: string;
  readonly tertiaryDark?: string;
  readonly errorLight?: string;
  readonly errorDark?: string;
  readonly errorContainerLight?: string;
  readonly errorContainerDark?: string;
  readonly surfaceLight?: string;
  readonly surfaceDark?: string;
  readonly surfaceContainerLowLight?: string;
  readonly surfaceContainerLowDark?: string;
  readonly outlineVariantLight?: string;
  readonly outlineVariantDark?: string;
  readonly [key: string]: string | undefined;
}

export interface ExtendedSystemPalette {
  readonly sdkInt?: number;
  readonly system_accent1: readonly string[];
  readonly system_accent2: readonly string[];
  readonly system_accent3: readonly string[];
  readonly system_neutral1: readonly string[];
  readonly system_neutral2: readonly string[];
  readonly system_error?: readonly string[];
  readonly semantic?: ExtendedSystemSemanticTokens;
  readonly wallpaper?: {
    readonly primaryHex?: string;
    readonly secondaryHex?: string;
    readonly tertiaryHex?: string;
    readonly colorHints?: number;
    readonly error?: string;
  };
}

export interface AccentColorRole {
  readonly color: string;
  readonly onColor: string;
  readonly container: string;
  readonly onContainer: string;
  readonly badgeBg?: string;
  readonly onBadge?: string;
}

export interface MetricAccentRoles {
  readonly steps: AccentColorRole;
  readonly calories: AccentColorRole;
  readonly totalCalories: AccentColorRole;
  readonly distance: AccentColorRole;
  readonly activeTime: AccentColorRole;
  readonly water: AccentColorRole;
}

export interface AyumiSurfaceTokens {
  readonly cardRadius: number;
  readonly fullWidthCardRadius: number;
  readonly sectionCardRadius: number;
  readonly summaryCardRadius: number;
  readonly outlineLightCards: boolean;
  readonly cardElevation: number;
  readonly cardShadowOpacity: number;
  readonly groupedSettingsCards: boolean;
  readonly tintHomeWaterCard: boolean;
  readonly heroLayout: 'floating_gauge' | 'modular_card';
  readonly bentoLayout: 'left_bubble' | 'header_inline';
  readonly activeControlStyle: 'tonal_container' | 'soft_outlined' | 'filled_pill';
  readonly subtleTimelineMenuButton: boolean;
  readonly badgeStyle: 'tonal' | 'solid';
  readonly iconFamily: 'ayumi_default' | 'oxygen_lucide';
  readonly ambientGradientStyle: 'none' | 'dynamic_glow';
  readonly metricSelectorVariant: 'cards_stacked' | 'horizontal_pills';
  readonly separateWaterPresetCards: boolean;
  readonly statsMainSummaryInline: boolean;
}

export interface AyumiShapeTokens {
  readonly selectorSlotRadius: number;
  readonly periodCapsulePadding: number;
  readonly buttonPillRadius: number;
  readonly chipRadius: number;
  readonly chartBarMaxRadius: number;
  readonly chartBarBottomRadius: number;
  readonly dockRadius: number;
  readonly dockWidthPercent: `${number}%`;
  readonly dockMaxWidth: number;
  readonly dockHeight: number;
  readonly dockPaddingHorizontal: number;
  readonly bottomSheetRadius: number;
  readonly logEntryRadius: number;
}

export interface AyumiTypographyTokens {
  readonly screenTitleSize: number;
  readonly screenTitleWeight: '700' | '800' | '900';
  readonly screenTitleTracking: number;
  readonly screenSubtitleSize: number;
  readonly sectionTitleSize: number;
  readonly sectionTitleWeight: '700' | '800';
  readonly bentoValueSize: number;
  readonly statValueWeight: '700' | '800';
}

export interface AyumiNavigationTokens {
  readonly variant: 'capsule_icons' | 'oem_labeled_pill';
  readonly showLabels: boolean;
  readonly pillHeight: number;
  readonly pillMaxWidth: number;
}

export interface AyumiProgressTokens {
  readonly heroStrokeWidth: number;
  readonly waterStrokeWidth: number;
  readonly showWaterTipKnob: boolean;
  readonly linearTrackHeight: number;
}

export interface SpringSpec {
  readonly stiffness: number;
  readonly damping: number;
  readonly mass: number;
}

export interface ChartRevealSpec {
  readonly duration: number;
  readonly staggerSpread: number;
  readonly overshoot: number;
}

export interface AyumiMotionPreset {
  readonly duration: {
    readonly instant: number;
    readonly short: number;
    readonly medium: number;
    readonly long: number;
    readonly reveal: number;
    readonly chartWave: number;
  };
  readonly spring: {
    readonly snappy: SpringSpec;
    readonly metricCard: SpringSpec;
    readonly periodCapsule: SpringSpec;
    readonly pager: SpringSpec;
    readonly gentle: SpringSpec;
    readonly interactive: SpringSpec;
  };
  readonly easing: {
    readonly standard: EasingFunction;
    readonly emphasizedDecel: EasingFunction;
    readonly dataReveal: EasingFunction;
    readonly accelerate: EasingFunction;
  };
  readonly chartReveal: {
    readonly week: ChartRevealSpec;
    readonly daily: ChartRevealSpec;
    readonly month: ChartRevealSpec;
  };
  readonly gesture: {
    readonly pageDistanceThresholdRatio: number;
    readonly pageVelocityThreshold: number;
    readonly horizontalTouchSlop: number;
    readonly directionalRatio: number;
  };
  readonly squish: {
    readonly stretchX: number;
    readonly compressY: number;
  };
}

export interface AyumiThemeDefinition {
  readonly id: AyumiThemeId;
  readonly name: string;
  readonly shortDescription: string;
  readonly badgeLabel: string;
  readonly surfaces: AyumiSurfaceTokens;
  readonly shapes: AyumiShapeTokens;
  readonly typography: AyumiTypographyTokens;
  readonly navigation: AyumiNavigationTokens;
  readonly progress: AyumiProgressTokens;
  readonly motion: AyumiMotionPreset;
  readonly mapPaletteToPaperColors: (
    palette: MaterialYouPalette,
    isDark: boolean,
  ) => MD3Theme['colors'];
  readonly getMetricAccents: (
    colors: MD3Theme['colors'],
    isDark?: boolean,
    extendedPalette?: ExtendedSystemPalette | null,
  ) => MetricAccentRoles;
  readonly resolveCardBorder: (
    colors: MD3Theme['colors'],
    isDark: boolean,
  ) => { readonly borderWidth: number; readonly borderColor: string };
}

export interface DockPresentationProps {
  readonly activeTab: 'home' | 'stats' | 'water' | 'settings';
  readonly activeStatsMetric?: 'steps' | 'distance' | 'water';
  readonly containerWidth: number;
  readonly bottomOffset: number;
  readonly indicatorTranslateX: number | Animated.AnimatedInterpolation<number>;
  readonly indicatorScaleX: number | Animated.AnimatedInterpolation<number>;
  readonly indicatorScaleY: number | Animated.AnimatedInterpolation<number>;
  readonly onLayout: (e: LayoutChangeEvent) => void;
  readonly onHomePress?: () => void;
  readonly onAnalyticsPress?: () => void;
  readonly onWaterPress?: () => void;
  readonly onProfilePress?: () => void;
}
