/**
 * App.tsx — Root component for Ayumi.
 *
 * Wires together:
 * 1. Material You dynamic multi-accent palette via react-native-material-you-colors
 * 2. Session-locked visual theme provider (`src/themes`) + React Native Paper PaperProvider
 * 3. SafeAreaProvider
 * 4. App navigation
 *
 * Visual theme selection (`default` vs `oxygen_coloros`) locks once persistent settings finish
 * loading at startup so switching themes in Settings prompts an app restart without partially
 * re-theming active screens mid-session.
 */

import React from 'react';
import { StatusBar, View, useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MaterialYou from 'react-native-material-you-colors';
import type { MaterialYouPalette } from 'react-native-material-you-colors';

import { AppNavigator } from './src/navigation';
import { createLightTheme, createDarkTheme } from './src/theme';
import { SettingsProvider, useSettings } from './src/contexts/SettingsContext';
import {
  AYUMI_BASELINE_SEED,
  AyumiThemeId,
  AyumiThemeProvider,
  DEFAULT_VISUAL_THEME_ID,
  getAyumiThemeDefinition,
} from './src/themes';

/**
 * Palette shade indices (the library uses 13-element arrays):
 * Index:  0    1    2    3    4    5    6    7    8    9   10   11   12
 * Tone:   0   10   50  100  200  300  400  500  600  700  800  900 1000
 */
const S = {
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

/**
 * Maps Material You palette tonal arrays into MD3 semantic color tokens
 * for both light and dark themes.
 */
function mapPaletteToTheme(palette: MaterialYouPalette) {
  const { system_accent1, system_accent2, system_accent3, system_neutral1, system_neutral2 } = palette;

  return {
    light: {
      primary: system_accent1[S.T600],
      onPrimary: system_accent1[S.T0],
      primaryContainer: system_accent1[S.T100],
      onPrimaryContainer: system_accent1[S.T900],
      secondary: system_accent2[S.T600],
      onSecondary: system_accent2[S.T0],
      secondaryContainer: system_accent2[S.T100],
      onSecondaryContainer: system_accent2[S.T900],
      tertiary: system_accent3[S.T600],
      onTertiary: system_accent3[S.T0],
      tertiaryContainer: system_accent3[S.T100],
      onTertiaryContainer: system_accent3[S.T900],
      background: system_neutral1[S.T10],
      onBackground: system_neutral1[S.T900],
      surface: system_neutral1[S.T10],
      onSurface: system_neutral1[S.T900],
      surfaceVariant: system_neutral2[S.T100],
      onSurfaceVariant: system_neutral2[S.T700],
      outline: system_neutral2[S.T500],
      outlineVariant: system_neutral2[S.T200],
      elevation: {
        level0: 'transparent',
        level1: system_neutral1[S.T50],
        level2: system_neutral1[S.T100],
        level3: system_neutral1[S.T200],
        level4: system_neutral1[S.T200],
        level5: system_neutral1[S.T300],
      },
    },
    dark: {
      primary: system_accent1[S.T200],
      onPrimary: system_accent1[S.T800],
      primaryContainer: system_accent1[S.T700],
      onPrimaryContainer: system_accent1[S.T100],
      secondary: system_accent2[S.T200],
      onSecondary: system_accent2[S.T800],
      secondaryContainer: system_accent2[S.T700],
      onSecondaryContainer: system_accent2[S.T100],
      tertiary: system_accent3[S.T200],
      onTertiary: system_accent3[S.T800],
      tertiaryContainer: system_accent3[S.T700],
      onTertiaryContainer: system_accent3[S.T100],
      background: system_neutral1[S.T900],
      onBackground: system_neutral1[S.T100],
      surface: system_neutral1[S.T900],
      onSurface: system_neutral1[S.T100],
      surfaceVariant: system_neutral2[S.T700],
      onSurfaceVariant: system_neutral2[S.T200],
      outline: system_neutral2[S.T400],
      outlineVariant: system_neutral2[S.T700],
      elevation: {
        level0: 'transparent',
        level1: system_neutral1[S.T800],
        level2: system_neutral1[S.T700],
        level3: system_neutral1[S.T600],
        level4: system_neutral1[S.T600],
        level5: system_neutral1[S.T500],
      },
    },
  };
}

/** Ayumi baseline brand seed — fallback when Material You palette is unavailable. */
const AYUMI_SEED_COLOR = AYUMI_BASELINE_SEED;

/**
 * Create the Material You theme context using the library's createThemeContext API.
 * Exposes `palette` (5 Monet tonal arrays) and light/dark scheme switching.
 */
const { ThemeProvider, useMaterialYouTheme } = MaterialYou.createThemeContext(mapPaletteToTheme);

// Re-export for use in other parts of the app if needed
export { useMaterialYouTheme };

/**
 * Inner app component that waits for persisted settings, locks the visual theme for
 * the current process session, maps the Android multi-accent Monet palette through the
 * active theme definition, and provides both Paper + Ayumi theme contexts.
 */
function AppContent(): React.JSX.Element {
  const materialYouTheme = useMaterialYouTheme();
  const systemColorScheme = useColorScheme();
  const { theme: userTheme, visualTheme, isLoading } = useSettings();

  // Lock the visual theme once async settings finish loading so mid-session changes
  // persist cleanly and ask for a restart without half-styled active screens.
  const sessionThemeIdRef = React.useRef<AyumiThemeId | null>(null);
  if (!isLoading && sessionThemeIdRef.current === null) {
    sessionThemeIdRef.current = visualTheme;
  }
  const sessionThemeId: AyumiThemeId =
    sessionThemeIdRef.current ?? DEFAULT_VISUAL_THEME_ID;

  React.useEffect(() => {
    materialYouTheme.setColorScheme(userTheme);
  }, [userTheme, materialYouTheme]);

  const isDark =
    userTheme === 'dark'
      ? true
      : userTheme === 'light'
        ? false
        : systemColorScheme === 'dark';

  const definition = getAyumiThemeDefinition(sessionThemeId);

  const paperTheme = React.useMemo(() => {
    const paletteColors = materialYouTheme.palette
      ? definition.mapPaletteToPaperColors(materialYouTheme.palette, isDark)
      : undefined;
    const base = isDark
      ? createDarkTheme(paletteColors as any)
      : createLightTheme(paletteColors as any);

    return {
      ...base,
      colors: {
        ...base.colors,
        ...(paletteColors ?? {}),
        elevation: {
          ...base.colors.elevation,
          ...(paletteColors?.elevation ?? {}),
        },
      },
    };
  }, [definition, materialYouTheme.palette, isDark]);

  // Brief hold until AsyncStorage resolves prevents locking a non-default launch to Default.
  if (isLoading) {
    const fallbackBg = paperTheme.colors.background;
    return (
      <View style={{ flex: 1, backgroundColor: fallbackBg }}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={fallbackBg}
        />
      </View>
    );
  }

  return (
    <PaperProvider theme={paperTheme}>
      <AyumiThemeProvider themeId={sessionThemeId} paperTheme={paperTheme}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={paperTheme.colors.background}
        />
        <AppNavigator />
      </AyumiThemeProvider>
    </PaperProvider>
  );
}

/**
 * Root App component.
 * Wraps the app in SafeAreaProvider and the Material You ThemeProvider.
 */
function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <ThemeProvider
          colorScheme="auto"
          fallbackColor={AYUMI_SEED_COLOR}
          seedColor="auto"
          generationStyle="TONAL_SPOT">
          <AppContent />
        </ThemeProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

export default App;
