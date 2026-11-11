/**
 * Central visual theme registry and React context provider for Ayumi.
 *
 * Exposes all registered theme definitions, helper lookup functions, and
 * `AyumiThemeProvider` / `useAyumiTheme` so screens and reusable components consume
 * colors, shapes, typography, surfaces, navigation mode, and motion tokens cleanly
 * without per-screen conditional theme branching.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useTheme as usePaperTheme, type MD3Theme } from 'react-native-paper';

import { defaultThemeDefinition } from './defaultTheme';
import { oxygenColorOsThemeDefinition } from './oxygenColorOsTheme';
import type {
  AyumiMotionPreset,
  AyumiNavigationTokens,
  AyumiProgressTokens,
  AyumiShapeTokens,
  AyumiSurfaceTokens,
  AyumiThemeDefinition,
  AyumiThemeId,
  AyumiTypographyTokens,
  MetricAccentRoles,
} from './types';

export * from './types';
export * from './paletteUtils';
export { defaultThemeDefinition } from './defaultTheme';
export {
  deriveOxygenMultiAccentRoles,
  oxygenColorOsThemeDefinition,
  OXYGEN_MOTION_PRESET,
} from './oxygenColorOsTheme';
export {
  deriveGradientHighlightHex,
  OxygenAmbientBackdrop,
  OxygenColorOsDockBar,
  OxygenMetricCard,
  OxygenStepHeroCard,
  OxygenWaterHomeCard,
  SettingsSectionGroup,
  ThemeOptionCard,
} from './oxygenColorOsUI';
export * from './oxygenIcons';

export const AYUMI_THEMES: Record<AyumiThemeId, AyumiThemeDefinition> = {
  default: defaultThemeDefinition,
  oxygen_coloros: oxygenColorOsThemeDefinition,
};

export const AYUMI_THEME_OPTIONS: readonly AyumiThemeDefinition[] = [
  defaultThemeDefinition,
  oxygenColorOsThemeDefinition,
];

/** Retrieves a theme definition safely, falling back to Default when unknown. */
export function getAyumiThemeDefinition(themeId?: AyumiThemeId | null): AyumiThemeDefinition {
  if (themeId && themeId in AYUMI_THEMES) {
    return AYUMI_THEMES[themeId];
  }
  return defaultThemeDefinition;
}

export interface AyumiThemeContextValue {
  readonly themeId: AyumiThemeId;
  readonly definition: AyumiThemeDefinition;
  readonly colors: MD3Theme['colors'];
  readonly isDark: boolean;
  readonly metricAccents: MetricAccentRoles;
  readonly surfaces: AyumiSurfaceTokens;
  readonly shapes: AyumiShapeTokens;
  readonly typography: AyumiTypographyTokens;
  readonly navigation: AyumiNavigationTokens;
  readonly progress: AyumiProgressTokens;
  readonly motion: AyumiMotionPreset;
  readonly resolveCardBorder: () => { readonly borderWidth: number; readonly borderColor: string };
}

const AyumiThemeContext = createContext<AyumiThemeContextValue | null>(null);

interface AyumiThemeProviderProps {
  readonly themeId: AyumiThemeId;
  readonly paperTheme: MD3Theme;
  readonly children: React.ReactNode;
}

/**
 * Provides the active session-locked visual theme definition and derived token roles
 * to the entire component tree.
 */
export function AyumiThemeProvider({
  themeId,
  paperTheme,
  children,
}: AyumiThemeProviderProps): React.JSX.Element {
  const definition = getAyumiThemeDefinition(themeId);

  const value = useMemo<AyumiThemeContextValue>(
    () => ({
      themeId: definition.id,
      definition,
      colors: paperTheme.colors,
      isDark: paperTheme.dark,
      metricAccents: definition.getMetricAccents(paperTheme.colors, paperTheme.dark),
      surfaces: definition.surfaces,
      shapes: definition.shapes,
      typography: definition.typography,
      navigation: definition.navigation,
      progress: definition.progress,
      motion: definition.motion,
      resolveCardBorder: () => definition.resolveCardBorder(paperTheme.colors, paperTheme.dark),
    }),
    [definition, paperTheme.colors, paperTheme.dark],
  );

  return React.createElement(AyumiThemeContext.Provider, { value }, children);
}

/**
 * Reads active visual theme tokens inside screens and components.
 * Falls back cleanly to Default tokens paired with Paper's active theme when rendered
 * in standalone unit tests without an enclosing `AyumiThemeProvider`.
 */
export function useAyumiTheme(): AyumiThemeContextValue {
  const ctx = useContext(AyumiThemeContext);
  const paperTheme = usePaperTheme();

  return useMemo(() => {
    if (ctx) {
      return ctx;
    }
    const def = defaultThemeDefinition;
    return {
      themeId: def.id,
      definition: def,
      colors: paperTheme.colors,
      isDark: paperTheme.dark,
      metricAccents: def.getMetricAccents(paperTheme.colors, paperTheme.dark),
      surfaces: def.surfaces,
      shapes: def.shapes,
      typography: def.typography,
      navigation: def.navigation,
      progress: def.progress,
      motion: def.motion,
      resolveCardBorder: () => def.resolveCardBorder(paperTheme.colors, paperTheme.dark),
    };
  }, [ctx, paperTheme.colors, paperTheme.dark]);
}
