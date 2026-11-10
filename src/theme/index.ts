/**
 * Material You dynamic theme for Ayumi.
 *
 * On Android 12+, extracts the user's wallpaper-based dynamic color palette
 * and maps it into a Material Design 3 theme for React Native Paper.
 * Falls back to a curated Ayumi-branded baseline theme on older devices.
 */

import {
  MD3DarkTheme,
  MD3LightTheme,
  type MD3Theme,
} from 'react-native-paper';

/**
 * Ayumi baseline colors — used when dynamic colors are unavailable.
 * A calming teal/sage palette that evokes nature and walking.
 */
const BASELINE_LIGHT_COLORS = {
  primary: 'rgb(0, 110, 96)',
  onPrimary: 'rgb(255, 255, 255)',
  primaryContainer: 'rgb(129, 248, 216)',
  onPrimaryContainer: 'rgb(0, 33, 27)',
  secondary: 'rgb(75, 99, 91)',
  onSecondary: 'rgb(255, 255, 255)',
  secondaryContainer: 'rgb(205, 233, 221)',
  onSecondaryContainer: 'rgb(7, 32, 25)',
  tertiary: 'rgb(65, 98, 118)',
  onTertiary: 'rgb(255, 255, 255)',
  tertiaryContainer: 'rgb(196, 231, 255)',
  onTertiaryContainer: 'rgb(0, 30, 44)',
  error: 'rgb(186, 26, 26)',
  onError: 'rgb(255, 255, 255)',
  errorContainer: 'rgb(255, 218, 214)',
  onErrorContainer: 'rgb(65, 0, 2)',
  background: 'rgb(251, 253, 249)',
  onBackground: 'rgb(25, 28, 27)',
  surface: 'rgb(251, 253, 249)',
  onSurface: 'rgb(25, 28, 27)',
  surfaceVariant: 'rgb(219, 229, 223)',
  onSurfaceVariant: 'rgb(63, 73, 68)',
  outline: 'rgb(111, 121, 116)',
  outlineVariant: 'rgb(191, 201, 195)',
  inverseSurface: 'rgb(46, 49, 47)',
  inverseOnSurface: 'rgb(239, 241, 238)',
  inversePrimary: 'rgb(99, 219, 189)',
  elevation: {
    level0: 'transparent',
    level1: 'rgb(238, 246, 241)',
    level2: 'rgb(231, 241, 236)',
    level3: 'rgb(223, 237, 231)',
    level4: 'rgb(221, 236, 229)',
    level5: 'rgb(216, 233, 226)',
  },
  surfaceDisabled: 'rgba(25, 28, 27, 0.12)',
  onSurfaceDisabled: 'rgba(25, 28, 27, 0.38)',
  backdrop: 'rgba(41, 50, 46, 0.4)',
};

const BASELINE_DARK_COLORS = {
  primary: 'rgb(99, 219, 189)',
  onPrimary: 'rgb(0, 56, 47)',
  primaryContainer: 'rgb(0, 82, 70)',
  onPrimaryContainer: 'rgb(129, 248, 216)',
  secondary: 'rgb(177, 204, 194)',
  onSecondary: 'rgb(29, 53, 46)',
  secondaryContainer: 'rgb(52, 76, 68)',
  onSecondaryContainer: 'rgb(205, 233, 221)',
  tertiary: 'rgb(168, 203, 227)',
  onTertiary: 'rgb(14, 51, 69)',
  tertiaryContainer: 'rgb(40, 74, 93)',
  onTertiaryContainer: 'rgb(196, 231, 255)',
  error: 'rgb(255, 180, 171)',
  onError: 'rgb(105, 0, 5)',
  errorContainer: 'rgb(147, 0, 10)',
  onErrorContainer: 'rgb(255, 218, 214)',
  background: 'rgb(25, 28, 27)',
  onBackground: 'rgb(225, 227, 224)',
  surface: 'rgb(25, 28, 27)',
  onSurface: 'rgb(225, 227, 224)',
  surfaceVariant: 'rgb(63, 73, 68)',
  onSurfaceVariant: 'rgb(191, 201, 195)',
  outline: 'rgb(137, 147, 142)',
  outlineVariant: 'rgb(63, 73, 68)',
  inverseSurface: 'rgb(225, 227, 224)',
  inverseOnSurface: 'rgb(46, 49, 47)',
  inversePrimary: 'rgb(0, 110, 96)',
  elevation: {
    level0: 'transparent',
    level1: 'rgb(28, 38, 35)',
    level2: 'rgb(30, 43, 40)',
    level3: 'rgb(32, 49, 44)',
    level4: 'rgb(32, 51, 46)',
    level5: 'rgb(34, 55, 49)',
  },
  surfaceDisabled: 'rgba(225, 227, 224, 0.12)',
  onSurfaceDisabled: 'rgba(225, 227, 224, 0.38)',
  backdrop: 'rgba(41, 50, 46, 0.4)',
};

/** Creates the light theme, optionally merging dynamic Material You colors */
export function createLightTheme(
  dynamicColors?: Partial<typeof BASELINE_LIGHT_COLORS>,
): MD3Theme {
  return {
    ...MD3LightTheme,
    colors: {
      ...MD3LightTheme.colors,
      ...BASELINE_LIGHT_COLORS,
      ...dynamicColors,
      elevation: {
        ...BASELINE_LIGHT_COLORS.elevation,
        ...dynamicColors?.elevation,
      },
    },
  };
}

/** Creates the dark theme, optionally merging dynamic Material You colors */
export function createDarkTheme(
  dynamicColors?: Partial<typeof BASELINE_DARK_COLORS>,
): MD3Theme {
  return {
    ...MD3DarkTheme,
    colors: {
      ...MD3DarkTheme.colors,
      ...BASELINE_DARK_COLORS,
      ...dynamicColors,
      elevation: {
        ...BASELINE_DARK_COLORS.elevation,
        ...dynamicColors?.elevation,
      },
    },
  };
}
