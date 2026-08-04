/**
 * App.tsx — Root component for Ayumi.
 *
 * Wires together:
 * 1. Material You dynamic theme via react-native-material-you-colors ThemeProvider
 * 2. React Native Paper PaperProvider (receiving Material You colors)
 * 3. SafeAreaProvider
 * 4. App navigation
 *
 * The library's palette arrays have 13 shades per tonal family, indexed as:
 *   [0, 10, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
 * We map these indices to Material Design 3 color tokens.
 */

import React from 'react';
import { StatusBar } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MaterialYou from 'react-native-material-you-colors';
import type { MaterialYouPalette } from 'react-native-material-you-colors';

import { AppNavigator } from './src/navigation';
import { createLightTheme, createDarkTheme } from './src/theme';
import { SettingsProvider, useSettings } from './src/contexts/SettingsContext';

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
    },
  };
}

/** Ayumi's brand color — used as the fallback seed when Material You is not available */
const AYUMI_SEED_COLOR = '#006E60'; // The teal from our baseline theme

/**
 * Create the Material You theme context using the library's createThemeContext API.
 * This gives us a ThemeProvider and a useMaterialYouTheme hook.
 */
const { ThemeProvider, useMaterialYouTheme } = MaterialYou.createThemeContext(mapPaletteToTheme);

// Re-export for use in other parts of the app if needed
export { useMaterialYouTheme };

/**
 * Inner app component that consumes the Material You theme
 * and passes it into React Native Paper's PaperProvider.
 */
function AppContent(): React.JSX.Element {
  const materialYouTheme = useMaterialYouTheme();
  const { theme: userTheme } = useSettings();

  React.useEffect(() => {
    materialYouTheme.setColorScheme(userTheme);
  }, [userTheme, materialYouTheme]);

  // Build Paper theme from the active Material You colors
  const paperTheme = materialYouTheme.background === materialYouTheme.onSurface
    // Fallback: shouldn't happen, but defensive
    ? createLightTheme()
    : isColorDark(materialYouTheme.background)
      ? createDarkTheme(materialYouTheme)
      : createLightTheme(materialYouTheme);

  const isDark = isColorDark(materialYouTheme.background);

  return (
    <PaperProvider theme={paperTheme}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={materialYouTheme.surface}
      />
      <AppNavigator />
    </PaperProvider>
  );
}

/**
 * Simple heuristic to determine if a hex color is "dark".
 * Uses relative luminance calculation.
 */
function isColorDark(hexColor: string): boolean {
  try {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    // Relative luminance formula (ITU-R BT.709)
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance < 0.5;
  } catch {
    return false;
  }
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
