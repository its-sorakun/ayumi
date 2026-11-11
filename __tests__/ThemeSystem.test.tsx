/**
 * Test suite for Ayumi's multi-theme architecture, Monet dynamic palette
 * resolution, session-locked Settings theme switching with restart notice,
 * and OxygenOS / ColorOS vs Default component rendering.
 *
 * All native modules (AsyncStorage, Material You colors, SVG, Navigation,
 * Vector Icons, and Paper) are mocked with deterministic in-memory helpers so
 * tests run fast and repeatably in Jest without an Android runtime.
 */

import React from 'react';
import { NativeModules, Platform, ToastAndroid, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactTestRenderer, { act } from 'react-test-renderer';
import type { MaterialYouPalette } from 'react-native-material-you-colors';

const mockStorage = new Map<string, string>();

type Shades13 = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage.set(key, value);
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      mockStorage.delete(key);
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      mockStorage.clear();
      return Promise.resolve();
    }),
  },
}));

jest.mock('react-native-safe-area-context', () => {
  const actualReact = require('react');
  const { View: RNView } = require('react-native');
  return {
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) =>
      actualReact.createElement(RNView, null, children),
    SafeAreaView: ({ children, style }: { children?: React.ReactNode; style?: unknown }) =>
      actualReact.createElement(RNView, { style }, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

jest.mock('react-native-svg', () => {
  const actualReact = require('react');
  const createSvgMock =
    (name: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      actualReact.createElement(name, props, children);
  return {
    __esModule: true,
    default: createSvgMock('Svg'),
    Svg: createSvgMock('Svg'),
    Circle: createSvgMock('Circle'),
    Rect: createSvgMock('Rect'),
    Path: createSvgMock('Path'),
    Line: createSvgMock('Line'),
    Polygon: createSvgMock('Polygon'),
    Polyline: createSvgMock('Polyline'),
    Ellipse: createSvgMock('Ellipse'),
    G: createSvgMock('G'),
    Defs: createSvgMock('Defs'),
    LinearGradient: createSvgMock('LinearGradient'),
    Stop: createSvgMock('Stop'),
  };
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: {} }),
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
}));

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => {
  const actualReact = require('react');
  const { View: RNView } = require('react-native');
  return ({ name, size, color, ...props }: { name?: string; size?: number; color?: string }) =>
    actualReact.createElement(RNView, {
      ...props,
      accessibilityLabel: name,
      style: { width: size ?? 20, height: size ?? 20, backgroundColor: color },
    });
});

jest.mock('react-native-material-you-colors', () => {
  const MonetPalette = require('react-native-material-you-colors/lib/commonjs/Monet/Palette').default;
  return {
    __esModule: true,
    default: {
      getMaterialYouPalette: jest.fn(() => null),
      generatePaletteFromColor: jest.fn((seed: string, style?: string) =>
        MonetPalette.generate(seed, style),
      ),
    },
    useMaterialYouTheme: jest.fn(() => ({
      palette: null,
    })),
  };
});

jest.mock('react-native-paper', () => {
  const actualReact = require('react');
  const { View: RNView, Text, TouchableOpacity, TextInput: RNTextInput } = require('react-native');

  const baseColors = {
    primary: '#006E60',
    onPrimary: '#FFFFFF',
    primaryContainer: '#A8EFE0',
    onPrimaryContainer: '#00201B',
    secondary: '#4A635D',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#CCE8E0',
    onSecondaryContainer: '#06201B',
    tertiary: '#436278',
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#C8E6FF',
    onTertiaryContainer: '#001E2F',
    error: '#BA1A1A',
    onError: '#FFFFFF',
    errorContainer: '#FFDAD6',
    onErrorContainer: '#410002',
    background: '#F4FBF8',
    onBackground: '#171D1B',
    surface: '#F4FBF8',
    onSurface: '#171D1B',
    surfaceVariant: '#DBE5E1',
    onSurfaceVariant: '#3F4946',
    outline: '#6F7976',
    outlineVariant: '#BFC9C5',
    shadow: '#000000',
    scrim: '#000000',
    inverseSurface: '#2B3230',
    inverseOnSurface: '#ECF2EF',
    inversePrimary: '#76D7C4',
    elevation: {
      level0: 'transparent',
      level1: '#ECF4F1',
      level2: '#E7EFEC',
      level3: '#E1EAE7',
      level4: '#DFE8E5',
      level5: '#DBE4E1',
    },
    surfaceDisabled: 'rgba(23, 29, 27, 0.12)',
    onSurfaceDisabled: 'rgba(23, 29, 27, 0.38)',
    backdrop: 'rgba(41, 50, 47, 0.4)',
  };

  const MD3LightTheme = {
    dark: false,
    roundness: 4,
    version: 3,
    isV3: true,
    colors: { ...baseColors },
    fonts: {
      default: { fontFamily: 'sans-serif', fontWeight: '400' },
      displayLarge: { fontFamily: 'sans-serif', fontWeight: '400' },
      headlineMedium: { fontFamily: 'sans-serif', fontWeight: '400' },
      titleLarge: { fontFamily: 'sans-serif', fontWeight: '500' },
      titleMedium: { fontFamily: 'sans-serif', fontWeight: '500' },
      bodyLarge: { fontFamily: 'sans-serif', fontWeight: '400' },
      bodyMedium: { fontFamily: 'sans-serif', fontWeight: '400' },
      labelLarge: { fontFamily: 'sans-serif', fontWeight: '500' },
      labelMedium: { fontFamily: 'sans-serif', fontWeight: '500' },
      labelSmall: { fontFamily: 'sans-serif', fontWeight: '500' },
    },
  };

  const MD3DarkTheme = {
    ...MD3LightTheme,
    dark: true,
    colors: {
      ...baseColors,
      primary: '#76D7C4',
      onPrimary: '#00382F',
      primaryContainer: '#005145',
      onPrimaryContainer: '#A8EFE0',
      background: '#0F1513',
      onBackground: '#DEE4E1',
      surface: '#0F1513',
      onSurface: '#DEE4E1',
    },
  };

  const PaperThemeContext = actualReact.createContext(MD3LightTheme);

  const PaperProvider = ({
    theme,
    children,
  }: {
    theme?: typeof MD3LightTheme;
    children?: React.ReactNode;
  }) =>
    actualReact.createElement(
      PaperThemeContext.Provider,
      { value: theme ?? MD3LightTheme },
      children,
    );

  const MockText = ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => actualReact.createElement(Text, props, children);

  const MockButton = ({
    children,
    onPress,
    ...props
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
    [key: string]: unknown;
  }) =>
    actualReact.createElement(
      TouchableOpacity,
      { ...props, onPress, accessibilityRole: 'button' },
      actualReact.createElement(Text, null, children),
    );

  const MockSurface = ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => actualReact.createElement(RNView, props, children);

  const MockSwitch = ({
    value,
    onValueChange,
    ...props
  }: {
    value?: boolean;
    onValueChange?: (next: boolean) => void;
    [key: string]: unknown;
  }) =>
    actualReact.createElement(TouchableOpacity, {
      ...props,
      accessibilityRole: 'switch',
      accessibilityState: { checked: Boolean(value) },
      onPress: () => onValueChange && onValueChange(!value),
    });

  const MockSnackbar = ({
    visible,
    children,
    onDismiss,
  }: {
    visible?: boolean;
    children?: React.ReactNode;
    onDismiss?: () => void;
  }) =>
    visible
      ? actualReact.createElement(
          RNView,
          { accessibilityRole: 'alert', testID: 'mock-snackbar' },
          actualReact.createElement(Text, null, children),
          onDismiss
            ? actualReact.createElement(
                TouchableOpacity,
                { onPress: onDismiss },
                actualReact.createElement(Text, null, 'Dismiss'),
              )
            : null,
        )
      : null;

  const MockListItem = ({
    title,
    description,
    onPress,
    right,
    left,
  }: {
    title?: React.ReactNode;
    description?: React.ReactNode;
    onPress?: () => void;
    right?: (args: { color: string }) => React.ReactNode;
    left?: (args: { color: string; style: unknown }) => React.ReactNode;
  }) =>
    actualReact.createElement(
      TouchableOpacity,
      { onPress },
      left ? left({ color: '#000', style: {} }) : null,
      actualReact.createElement(Text, null, title),
      description ? actualReact.createElement(Text, null, description) : null,
      right ? right({ color: '#000' }) : null,
    );

  const MockListSection = ({ children }: { children?: React.ReactNode }) =>
    actualReact.createElement(RNView, null, children);
  const MockListSubheader = ({ children }: { children?: React.ReactNode }) =>
    actualReact.createElement(Text, null, children);
  const MockListIcon = ({
    icon,
    color,
  }: {
    icon?: ((args: { color: string; size: number }) => React.ReactNode) | string;
    color?: string;
  }) =>
    typeof icon === 'function'
      ? actualReact.createElement(RNView, null, icon({ color: color ?? '#000', size: 24 }))
      : null;

  const MockRadioGroup = ({ children }: { children?: React.ReactNode }) =>
    actualReact.createElement(RNView, null, children);
  const MockRadioItem = ({
    label,
    value,
    onPress,
  }: {
    label?: string;
    value?: string;
    onPress?: () => void;
  }) =>
    actualReact.createElement(
      TouchableOpacity,
      { onPress, testID: value ? `radio-${value}` : undefined },
      actualReact.createElement(Text, null, label),
    );

  const MockRadioButton = () => null;
  MockRadioButton.Group = MockRadioGroup;
  MockRadioButton.Item = MockRadioItem;
  MockRadioButton.Android = () => null;
  MockRadioButton.IOS = () => null;

  const MockDialog = ({
    visible,
    children,
  }: {
    visible?: boolean;
    children?: React.ReactNode;
  }) => (visible ? actualReact.createElement(RNView, null, children) : null);
  MockDialog.Title = ({ children }: { children?: React.ReactNode }) =>
    actualReact.createElement(Text, null, children);
  MockDialog.Content = ({ children }: { children?: React.ReactNode }) =>
    actualReact.createElement(RNView, null, children);
  MockDialog.Actions = ({ children }: { children?: React.ReactNode }) =>
    actualReact.createElement(RNView, null, children);

  const MockTextInput = (props: Record<string, unknown>) =>
    actualReact.createElement(RNTextInput, props);
  MockTextInput.Icon = () => null;

  return {
    MD3LightTheme,
    MD3DarkTheme,
    Provider: PaperProvider,
    PaperProvider,
    useTheme: () => actualReact.useContext(PaperThemeContext),
    Text: MockText,
    Button: MockButton,
    Surface: MockSurface,
    Switch: MockSwitch,
    Snackbar: MockSnackbar,
    Divider: () => actualReact.createElement(RNView, null),
    Portal: ({ children }: { children?: React.ReactNode }) =>
      actualReact.createElement(RNView, null, children),
    Dialog: MockDialog,
    List: {
      Section: MockListSection,
      Item: MockListItem,
      Subheader: MockListSubheader,
      Icon: MockListIcon,
    },
    RadioButton: MockRadioButton,
    TextInput: MockTextInput,
  };
});

import { PaperProvider } from 'react-native-paper';
import {
  AYUMI_THEMES,
  AYUMI_THEME_OPTIONS,
  AyumiThemeProvider,
  DEFAULT_VISUAL_THEME_ID,
  defaultThemeDefinition,
  deriveOxygenMultiAccentRoles,
  getAyumiThemeDefinition,
  normalizeVisualThemeId,
  oxygenColorOsThemeDefinition,
  useAyumiTheme,
} from '../src/themes';
import {
  classifySystemPaletteMode,
  getContrastRatio,
  hexToOklch,
  PALETTE_SHADE,
  readNativeExtendedSystemPalette,
  resolveCompleteDynamicPalette,
  resolveMetricBadgeColors,
} from '../src/themes/paletteUtils';
import { createDarkTheme, createLightTheme } from '../src/theme';
import MaterialYou from 'react-native-material-you-colors';
import { SettingsProvider, useSettings } from '../src/contexts/SettingsContext';
import { SettingsScreen } from '../src/screens/SettingsScreen';
import { FloatingDock } from '../src/components/FloatingDock';
import { BentoCard } from '../src/components/BentoCard';
import { HeroStepGauge } from '../src/components/HeroStepGauge';

const CUSTOM_WALLPAPER_PALETTE: MaterialYouPalette = {
  // Distinct cobalt blue accent1 (13 shades T0..T1000)
  system_accent1: [
    '#FFFFFF',
    '#F1F6FF',
    '#DDE9FF',
    '#C4DAFF',
    '#9BBEFF',
    '#6B9BFF',
    '#4379F2',
    '#1D5FD6',
    '#154BB3',
    '#0E378A',
    '#082563',
    '#03143B',
    '#000000',
  ],
  // Distinct emerald teal accent2 (13 shades T0..T1000)
  system_accent2: [
    '#FFFFFF',
    '#EEFCFA',
    '#D5F5F0',
    '#B3EBE2',
    '#85DDD0',
    '#57CABB',
    '#2EAFA0',
    '#118A7E',
    '#0B6D63',
    '#07524A',
    '#043832',
    '#021F1B',
    '#000000',
  ],
  // Distinct warm amber accent3 (13 shades T0..T1000)
  system_accent3: [
    '#FFFFFF',
    '#FFF6ED',
    '#FFE7D1',
    '#FFD2AA',
    '#FFB475',
    '#FA9342',
    '#E57B24',
    '#C96A12',
    '#A3510A',
    '#7D3B05',
    '#572602',
    '#331400',
    '#000000',
  ],
  // Neutral surface ramps (13 shades T0..T1000)
  system_neutral1: [
    '#FFFFFF',
    '#F8FAFC',
    '#F2F4F7',
    '#E5E8EE',
    '#CFD4DD',
    '#B2B8C4',
    '#949BA8',
    '#666B73',
    '#4C5159',
    '#34383E',
    '#1D2024',
    '#101215',
    '#000000',
  ],
  system_neutral2: [
    '#FFFFFF',
    '#F4F6FA',
    '#EAEEF5',
    '#DAE0EB',
    '#C0C8D6',
    '#A0AAB9',
    '#808B9C',
    '#5E6672',
    '#454C57',
    '#2F353D',
    '#1B1F25',
    '#0E1115',
    '#000000',
  ],
};

/**
 * Extracts all rendered text strings inside a ReactTestRenderer tree.
 */
function collectAllText(root: ReactTestRenderer.ReactTestInstance): string[] {
  const results: string[] = [];
  root.findAllByType('Text' as React.ElementType).forEach((node) => {
    const raw = node.props.children;
    if (typeof raw === 'string' || typeof raw === 'number') {
      results.push(String(raw));
    } else if (Array.isArray(raw)) {
      const joined = raw
        .filter((item) => typeof item === 'string' || typeof item === 'number')
        .join('');
      if (joined.length > 0) {
        results.push(joined);
      }
    }
  });
  return results;
}

/**
 * Flushes pending Promises and microtasks inside an async act block.
 */
async function flushAsyncRender(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('Theme Registry & Normalization', () => {
  it('exposes exactly two themes (default and oxygen_coloros)', () => {
    expect(AYUMI_THEME_OPTIONS).toHaveLength(2);
    expect(AYUMI_THEME_OPTIONS.map((t) => t.id)).toEqual(['default', 'oxygen_coloros']);
    expect(Object.keys(AYUMI_THEMES).sort()).toEqual(['default', 'oxygen_coloros']);
    expect(DEFAULT_VISUAL_THEME_ID).toBe('default');
  });

  it('normalizes unknown or empty values to default and resolves definitions safely', () => {
    expect(normalizeVisualThemeId(null)).toBe('default');
    expect(normalizeVisualThemeId(undefined)).toBe('default');
    expect(normalizeVisualThemeId('')).toBe('default');
    expect(normalizeVisualThemeId('coloros')).toBe('default');
    expect(normalizeVisualThemeId('oxygen')).toBe('default');
    expect(normalizeVisualThemeId('default')).toBe('default');
    expect(normalizeVisualThemeId('oxygen_coloros')).toBe('oxygen_coloros');

    expect(getAyumiThemeDefinition(null).id).toBe('default');
    expect(getAyumiThemeDefinition('invalid' as 'default').id).toBe('default');
    expect(getAyumiThemeDefinition('oxygen_coloros').id).toBe('oxygen_coloros');
  });
});

describe('Dynamic Multi-Accent Monet Palette Mapping', () => {
  it('synthesizes vivid wallpaper-driven accents and ultra-low-chroma surfaces without dull Monet washing', () => {
    const lightColors = oxygenColorOsThemeDefinition.mapPaletteToPaperColors(
      CUSTOM_WALLPAPER_PALETTE,
      false,
    );
    const darkColors = oxygenColorOsThemeDefinition.mapPaletteToPaperColors(
      CUSTOM_WALLPAPER_PALETTE,
      true,
    );

    // Distinct wallpaper-derived accents with boosted Oklch saturation (not muted T600)
    expect(new Set([lightColors.primary, lightColors.secondary, lightColors.tertiary]).size).toBe(3);
    const lightPrimaryLch = hexToOklch(lightColors.primary);
    expect(lightPrimaryLch).not.toBeNull();
    expect(lightPrimaryLch!.C).toBeGreaterThan(0.14);
    expect(lightPrimaryLch!.h).toBeGreaterThanOrEqual(220);
    expect(lightPrimaryLch!.h).toBeLessThanOrEqual(285);
    expect(getContrastRatio(lightColors.primary, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(lightColors.onPrimary, lightColors.primary)).toBeGreaterThanOrEqual(4.5);

    // Ultra-low-chroma light surfaces with subtle separation between canvas and white cards
    const lightBgLch = hexToOklch(lightColors.background);
    const lightSurfaceLch = hexToOklch(lightColors.surface);
    expect(lightBgLch!.C).toBeLessThan(0.01);
    expect(lightBgLch!.L).toBeGreaterThan(0.94);
    expect(lightSurfaceLch!.L).toBeGreaterThan(lightBgLch!.L);

    // Dark theme uses luminous accessible primary and OLED-friendly pure black background
    const darkPrimaryLch = hexToOklch(darkColors.primary);
    expect(darkPrimaryLch!.L).toBeGreaterThan(0.6);
    expect(darkColors.background).toBe('#000000');
    expect(getContrastRatio(darkColors.primary, darkColors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(new Set([darkColors.primary, darkColors.secondary, darkColors.tertiary]).size).toBe(3);
  });

  it('assigns 6 vivid semantic metric roles under OxygenOS / ColorOS and uniform primary accent under Default', () => {
    const oosTheme = createLightTheme(
      oxygenColorOsThemeDefinition.mapPaletteToPaperColors(CUSTOM_WALLPAPER_PALETTE, false),
    );
    const defaultTheme = createLightTheme(
      defaultThemeDefinition.mapPaletteToPaperColors(CUSTOM_WALLPAPER_PALETTE, false),
    );

    const oosMetrics = oxygenColorOsThemeDefinition.getMetricAccents(oosTheme.colors, false, null);
    const defaultMetrics = defaultThemeDefinition.getMetricAccents(defaultTheme.colors);

    expect(
      new Set([
        oosMetrics.steps.color,
        oosMetrics.calories.color,
        oosMetrics.totalCalories.color,
        oosMetrics.distance.color,
        oosMetrics.activeTime.color,
        oosMetrics.water.color,
      ]).size,
    ).toBe(6);

    for (const role of Object.values(oosMetrics)) {
      const lch = hexToOklch(role.color);
      expect(lch!.C).toBeGreaterThanOrEqual(0.09);
      expect(role.badgeBg).toBeDefined();
      expect(role.onBadge).toBeDefined();
      expect(getContrastRatio(role.color, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    }

    expect(defaultMetrics.steps.color).toBe(defaultTheme.colors.primary);
    expect(defaultMetrics.distance.color).toBe(defaultTheme.colors.primary);
    expect(defaultMetrics.calories.color).toBe(defaultTheme.colors.primary);
    expect(defaultMetrics.totalCalories.color).toBe(defaultTheme.colors.primary);
    expect(defaultMetrics.activeTime.color).toBe(defaultTheme.colors.primary);
    expect(defaultMetrics.water.color).toBe(defaultTheme.colors.primary);
  });

  it('synthesizes complete 13-shade palette and distinct accent3 when system accent3 is missing or duplicated', () => {
    const duplicatedAccent3: Shades13 = [...CUSTOM_WALLPAPER_PALETTE.system_accent1];
    const incompletePalette = {
      system_accent1: CUSTOM_WALLPAPER_PALETTE.system_accent1,
      system_accent2: CUSTOM_WALLPAPER_PALETTE.system_accent2,
      system_accent3: duplicatedAccent3,
      system_neutral1: CUSTOM_WALLPAPER_PALETTE.system_neutral1,
    } as unknown as MaterialYouPalette;

    const completed = resolveCompleteDynamicPalette(incompletePalette);
    expect(completed.system_accent1).toHaveLength(13);
    expect(completed.system_accent2).toHaveLength(13);
    expect(completed.system_accent3).toHaveLength(13);
    expect(completed.system_neutral1).toHaveLength(13);
    expect(completed.system_neutral2).toHaveLength(13);
    expect(completed.system_accent3[PALETTE_SHADE.T500]).not.toBe(
      completed.system_accent1[PALETTE_SHADE.T500],
    );
  });
});

describe('SettingsContext Persistence & Session-Locked SettingsScreen Switch', () => {
  let toastSpy: jest.SpyInstance;
  const originalPlatformOs = Platform.OS;

  beforeEach(() => {
    mockStorage.clear();
    jest.clearAllMocks();
    (Platform as { OS: string }).OS = 'android';
    toastSpy = jest.spyOn(ToastAndroid, 'show').mockImplementation(jest.fn());
  });

  afterEach(() => {
    (Platform as { OS: string }).OS = originalPlatformOs;
    toastSpy.mockRestore();
  });

  it('persists @ayumi_visual_theme in AsyncStorage across provider remounts', async () => {
    let latestContext: ReturnType<typeof useSettings> | null = null;
    const Probe = () => {
      latestContext = useSettings();
      return null;
    };

    let renderer: ReactTestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <SettingsProvider>
          <Probe />
        </SettingsProvider>,
      );
    });
    await flushAsyncRender();

    expect(latestContext!.visualTheme).toBe('default');

    await act(async () => {
      latestContext!.setVisualTheme('oxygen_coloros');
    });
    await flushAsyncRender();

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@ayumi_visual_theme', 'oxygen_coloros');
    expect(mockStorage.get('@ayumi_visual_theme')).toBe('oxygen_coloros');

    await act(async () => {
      renderer!.unmount();
    });

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <SettingsProvider>
          <Probe />
        </SettingsProvider>,
      );
    });
    await flushAsyncRender();

    expect(latestContext!.visualTheme).toBe('oxygen_coloros');

    await act(async () => {
      renderer!.unmount();
    });
  });

  it('locks active session theme in SettingsScreen, shows restart Toast/notice on switch, and clears when reverted', async () => {
    let observedSessionThemeId = '';
    const SessionObserver = () => {
      observedSessionThemeId = useAyumiTheme().themeId;
      return null;
    };

    const paperTheme = createLightTheme(
      defaultThemeDefinition.mapPaletteToPaperColors(CUSTOM_WALLPAPER_PALETTE, false),
    );

    let renderer: ReactTestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <PaperProvider theme={paperTheme}>
          <AyumiThemeProvider themeId="default" paperTheme={paperTheme}>
            <SettingsProvider>
              <SessionObserver />
              <SettingsScreen />
            </SettingsProvider>
          </AyumiThemeProvider>
        </PaperProvider>,
      );
    });
    await flushAsyncRender();

    const initialTexts = collectAllText(renderer!.root);
    expect(initialTexts).toContain('Theme');
    expect(initialTexts).toContain('Default (Ayumi)');
    expect(initialTexts).toContain('OxygenOS / ColorOS');
    expect(observedSessionThemeId).toBe('default');

    const themeOptionButtons = renderer!.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        typeof node.props.accessibilityLabel === 'string' &&
        (node.props.accessibilityLabel.startsWith('Default (Ayumi)') ||
          node.props.accessibilityLabel.startsWith('OxygenOS / ColorOS')),
    );
    const defaultCard = themeOptionButtons.find((n) =>
      n.props.accessibilityLabel.startsWith('Default (Ayumi)'),
    )!;
    const oosCard = themeOptionButtons.find((n) =>
      n.props.accessibilityLabel.startsWith('OxygenOS / ColorOS'),
    )!;
    expect(defaultCard).toBeDefined();
    expect(oosCard).toBeDefined();

    // Tapping already-active Default card must not trigger restart prompt
    await act(async () => {
      defaultCard.props.onPress();
    });
    await flushAsyncRender();
    expect(toastSpy).not.toHaveBeenCalled();

    // Switching to OxygenOS / ColorOS persists selection, raises Toast + notice, keeps active session locked
    await act(async () => {
      oosCard.props.onPress();
    });
    await flushAsyncRender();

    expect(mockStorage.get('@ayumi_visual_theme')).toBe('oxygen_coloros');
    expect(toastSpy).toHaveBeenCalledWith(
      'Restart Ayumi to apply the new theme.',
      ToastAndroid.SHORT,
    );
    expect(observedSessionThemeId).toBe('default');

    const afterSwitchTexts = collectAllText(renderer!.root);
    expect(afterSwitchTexts).toContain('Restart Ayumi to apply the new theme.');
    expect(afterSwitchTexts).toContain('Restart Ayumi to apply the selected theme.');
    expect(afterSwitchTexts).toContain('Restart to apply');

    // Reverting to Default dismisses pending restart notice cleanly
    await act(async () => {
      defaultCard.props.onPress();
    });
    await flushAsyncRender();

    expect(mockStorage.get('@ayumi_visual_theme')).toBe('default');
    const afterRevertTexts = collectAllText(renderer!.root);
    expect(afterRevertTexts).not.toContain('Restart Ayumi to apply the new theme.');
    expect(afterRevertTexts).not.toContain('Restart Ayumi to apply the selected theme.');

    await act(async () => {
      renderer!.unmount();
    });
  });
});

describe('OxygenOS / ColorOS vs Default Component Rendering', () => {
  it('renders 4 labeled pill tabs in FloatingDock under oxygen_coloros and omits text labels under default', async () => {
    const oosPaperTheme = createLightTheme(
      oxygenColorOsThemeDefinition.mapPaletteToPaperColors(CUSTOM_WALLPAPER_PALETTE, false),
    );
    const defaultPaperTheme = createLightTheme(
      defaultThemeDefinition.mapPaletteToPaperColors(CUSTOM_WALLPAPER_PALETTE, false),
    );

    const onHomePress = jest.fn();
    const onAnalyticsPress = jest.fn();
    const onWaterPress = jest.fn();
    const onProfilePress = jest.fn();

    let oosRenderer: ReactTestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      oosRenderer = ReactTestRenderer.create(
        <PaperProvider theme={oosPaperTheme}>
          <AyumiThemeProvider themeId="oxygen_coloros" paperTheme={oosPaperTheme}>
            <FloatingDock
              activeTab="water"
              onHomePress={onHomePress}
              onAnalyticsPress={onAnalyticsPress}
              onWaterPress={onWaterPress}
              onProfilePress={onProfilePress}
            />
          </AyumiThemeProvider>
        </PaperProvider>,
      );
    });

    const oosDockTexts = collectAllText(oosRenderer!.root);
    expect(oosDockTexts).toEqual(['Home', 'Stats', 'Water', 'Settings']);

    const statsButton = oosRenderer!.root.findByProps({ accessibilityLabel: 'Stats tab' });
    await act(async () => {
      statsButton.props.onPress();
    });
    expect(onAnalyticsPress).toHaveBeenCalledTimes(1);

    let defaultRenderer: ReactTestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      defaultRenderer = ReactTestRenderer.create(
        <PaperProvider theme={defaultPaperTheme}>
          <AyumiThemeProvider themeId="default" paperTheme={defaultPaperTheme}>
            <FloatingDock
              activeTab="home"
              onHomePress={onHomePress}
              onAnalyticsPress={onAnalyticsPress}
              onWaterPress={onWaterPress}
              onProfilePress={onProfilePress}
            />
          </AyumiThemeProvider>
        </PaperProvider>,
      );
    });

    const defaultDockTexts = collectAllText(defaultRenderer!.root);
    expect(defaultDockTexts).not.toContain('Home');
    expect(defaultDockTexts).not.toContain('Stats');
    expect(defaultDockTexts).not.toContain('Water');
    expect(defaultDockTexts).not.toContain('Settings');

    await act(async () => {
      oosRenderer!.unmount();
      defaultRenderer!.unmount();
    });
  });

  it('renders BentoCard and modular OxygenStepHeroCard cleanly under oxygen_coloros vs floating gauge under default', async () => {
    const oosPaperTheme = createLightTheme(
      oxygenColorOsThemeDefinition.mapPaletteToPaperColors(CUSTOM_WALLPAPER_PALETTE, false),
    );
    const defaultPaperTheme = createLightTheme(
      defaultThemeDefinition.mapPaletteToPaperColors(CUSTOM_WALLPAPER_PALETTE, false),
    );
    const oosMetrics = oxygenColorOsThemeDefinition.getMetricAccents(oosPaperTheme.colors);

    let oosRenderer: ReactTestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      oosRenderer = ReactTestRenderer.create(
        <PaperProvider theme={oosPaperTheme}>
          <AyumiThemeProvider themeId="oxygen_coloros" paperTheme={oosPaperTheme}>
            <HeroStepGauge steps={4820} goal={8000} />
            <BentoCard
              title={'Active\nCalories'}
              value="30"
              unit="kcal"
              icon={<View testID="mock-cal-icon" />}
              iconBgColor={oosMetrics.calories.container}
              cardBgColor={oosPaperTheme.colors.surface}
            />
            <BentoCard
              title="Water"
              value="1.80"
              unit="L"
              subtitle="Goal: 3.0 L"
              fullWidth
              icon={<View testID="mock-water-icon" />}
              iconBgColor={oosMetrics.water.container}
              cardBgColor={oosPaperTheme.colors.surface}
              actionLabel="+ 250 ml"
              actionBgColor={oosMetrics.water.color}
              actionTextColor={oosMetrics.water.onColor}
              onActionPress={jest.fn()}
            />
          </AyumiThemeProvider>
        </PaperProvider>,
      );
    });

    const oosTexts = collectAllText(oosRenderer!.root);
    expect(oosTexts).toContain('Steps');
    expect(oosTexts).toContain('60%');
    expect(oosTexts).toContain('of 8,000 steps');
    expect(oosTexts).toContain('Active Calories');
    expect(oosTexts).toContain('+ 250 ml');

    let defaultRenderer: ReactTestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      defaultRenderer = ReactTestRenderer.create(
        <PaperProvider theme={defaultPaperTheme}>
          <AyumiThemeProvider themeId="default" paperTheme={defaultPaperTheme}>
            <HeroStepGauge steps={4820} goal={8000} />
          </AyumiThemeProvider>
        </PaperProvider>,
      );
    });

    const defaultTexts = collectAllText(defaultRenderer!.root);
    expect(defaultTexts).toContain('60% • Goal 8,000');

    await act(async () => {
      oosRenderer!.unmount();
      defaultRenderer!.unmount();
    });
  });
});

describe('Extended OxygenOS Multi-Color Palette & Iconography Isolation', () => {
  it('adapts primary across Blue, Green, Red, Neutral, and Monochrome seeds while preserving semantic metrics and contrast', () => {
    const seedScenarios = [
      { name: 'blue', palette: MaterialYou.generatePaletteFromColor('#1A56DB', 'TONAL_SPOT'), mode: 'chromatic' as const, hueRange: [220, 285] },
      { name: 'green', palette: MaterialYou.generatePaletteFromColor('#16A34A', 'TONAL_SPOT'), mode: 'chromatic' as const, hueRange: [120, 175] },
      { name: 'red', palette: MaterialYou.generatePaletteFromColor('#DC2626', 'TONAL_SPOT'), mode: 'chromatic' as const, hueRange: [5, 45] },
      { name: 'neutral', palette: MaterialYou.generatePaletteFromColor('#808892', 'SPRITZ'), mode: 'neutral_accent' as const, hueRange: null },
      { name: 'monochrome', palette: MaterialYou.generatePaletteFromColor('#1A56DB', 'MONOCHROMATIC'), mode: 'monochrome' as const, hueRange: null },
    ];

    for (const scenario of seedScenarios) {
      expect(classifySystemPaletteMode(scenario.palette).mode).toBe(scenario.mode);

      for (const isDark of [false, true]) {
        const paperColors = oxygenColorOsThemeDefinition.mapPaletteToPaperColors(
          scenario.palette,
          isDark,
        );
        const paperTheme = isDark ? createDarkTheme(paperColors) : createLightTheme(paperColors);
        const metrics = oxygenColorOsThemeDefinition.getMetricAccents(
          paperTheme.colors,
          isDark,
          scenario.palette,
        );

        const primaryLch = hexToOklch(paperColors.primary);
        expect(primaryLch).not.toBeNull();

        if (scenario.mode === 'chromatic') {
          expect(primaryLch!.C).toBeGreaterThanOrEqual(0.14);
          expect(primaryLch!.h).toBeGreaterThanOrEqual(scenario.hueRange![0]);
          expect(primaryLch!.h).toBeLessThanOrEqual(scenario.hueRange![1]);
        } else if (scenario.mode === 'neutral_accent') {
          expect(primaryLch!.C).toBeLessThan(0.03);
        } else {
          expect(primaryLch!.C).toBeLessThan(0.01);
        }

        // Interface contrast check
        expect(getContrastRatio(paperColors.primary, paperColors.surface)).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(paperColors.onPrimary, paperColors.primary)).toBeGreaterThanOrEqual(4.5);

        if (scenario.mode === 'monochrome') {
          for (const role of Object.values(metrics)) {
            const roleLch = hexToOklch(role.color);
            expect(roleLch!.C).toBeLessThan(0.025);
          }
          continue;
        }

        // Stable semantic metric hues across Chromatic AND Neutral seeds
        const stepsLch = hexToOklch(metrics.steps.color)!;
        const calLch = hexToOklch(metrics.calories.color)!;
        const totalCalLch = hexToOklch(metrics.totalCalories.color)!;
        const distLch = hexToOklch(metrics.distance.color)!;
        const activeLch = hexToOklch(metrics.activeTime.color)!;
        const waterLch = hexToOklch(metrics.water.color)!;

        expect(stepsLch.h).toBeGreaterThanOrEqual(125);
        expect(stepsLch.h).toBeLessThanOrEqual(170);
        expect(calLch.h).toBeGreaterThanOrEqual(10);
        expect(calLch.h).toBeLessThanOrEqual(45);
        expect(totalCalLch.h).toBeGreaterThanOrEqual(45);
        expect(totalCalLch.h).toBeLessThanOrEqual(90);
        expect(distLch.h).toBeGreaterThanOrEqual(225);
        expect(distLch.h).toBeLessThanOrEqual(280);
        expect(activeLch.h).toBeGreaterThanOrEqual(165);
        expect(activeLch.h).toBeLessThanOrEqual(210);
        expect(waterLch.h).toBeGreaterThanOrEqual(205);
        expect(waterLch.h).toBeLessThanOrEqual(250);

        for (const role of Object.values(metrics)) {
          const lch = hexToOklch(role.color)!;
          expect(lch.C).toBeGreaterThanOrEqual(0.09);
          const cardBg = isDark ? paperColors.surface : '#FFFFFF';
          expect(getContrastRatio(role.color, cardBg)).toBeGreaterThanOrEqual(4.5);
          expect(getContrastRatio(role.onColor, role.color)).toBeGreaterThanOrEqual(4.5);

          const solidBadge = resolveMetricBadgeColors(role, 'solid');
          expect(getContrastRatio(solidBadge.fg, solidBadge.bg)).toBeGreaterThanOrEqual(3.4);
        }

        // Warm amber Total Calories badge selects accessible dark charcoal foreground
        const totalCalBadge = resolveMetricBadgeColors(metrics.totalCalories, 'solid');
        expect(totalCalBadge.fg).toBe('#111827');
        expect(getContrastRatio(totalCalBadge.fg, totalCalBadge.bg)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('respects Monochrome system palettes cleanly without inventing artificial rainbow accents', () => {
    const monochromeTheme = createLightTheme({
      ...createLightTheme().colors,
      primary: '#5C5F62',
      onPrimary: '#FFFFFF',
      primaryContainer: '#E2E4E7',
      onPrimaryContainer: '#1A1C1E',
      secondary: '#6B6E72',
      onSecondary: '#FFFFFF',
      secondaryContainer: '#E6E8EB',
      onSecondaryContainer: '#1E2022',
      tertiary: '#4B4E52',
      onTertiary: '#FFFFFF',
      tertiaryContainer: '#DCDFE2',
      onTertiaryContainer: '#141618',
    });

    const monoMetrics = deriveOxygenMultiAccentRoles(monochromeTheme.colors, false, null);
    for (const role of Object.values(monoMetrics)) {
      const lch = hexToOklch(role.color);
      expect(lch).not.toBeNull();
      expect(lch!.C).toBeLessThan(0.032);
    }
  });

  it('isolates Lucide Settings & solid circular card badges strictly to OxygenOS / ColorOS while leaving Default intact', async () => {
    expect(defaultThemeDefinition.surfaces.iconFamily).toBe('ayumi_default');
    expect(defaultThemeDefinition.surfaces.badgeStyle).toBe('tonal');
    expect(oxygenColorOsThemeDefinition.surfaces.iconFamily).toBe('oxygen_lucide');
    expect(oxygenColorOsThemeDefinition.surfaces.badgeStyle).toBe('solid');

    const defaultPaperTheme = createLightTheme(
      defaultThemeDefinition.mapPaletteToPaperColors(CUSTOM_WALLPAPER_PALETTE, false),
    );
    const oosPaperTheme = createLightTheme(
      oxygenColorOsThemeDefinition.mapPaletteToPaperColors(CUSTOM_WALLPAPER_PALETTE, false),
    );
    const defaultWaterBadge = resolveMetricBadgeColors(
      defaultThemeDefinition.getMetricAccents(defaultPaperTheme.colors).water,
      defaultThemeDefinition.surfaces.badgeStyle,
    );
    expect(defaultWaterBadge.bg).toBe(defaultPaperTheme.colors.primaryContainer);
    expect(defaultWaterBadge.fg).toBe(defaultPaperTheme.colors.primary);

    // SettingsScreen under OxygenOS uses squircle Lucide badges without raw emojis
    let oosSettingsTree: ReactTestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      oosSettingsTree = ReactTestRenderer.create(
        <SettingsProvider>
          <PaperProvider theme={oosPaperTheme}>
            <AyumiThemeProvider themeId="oxygen_coloros" paperTheme={oosPaperTheme}>
              <SettingsScreen hideDock />
            </AyumiThemeProvider>
          </PaperProvider>
        </SettingsProvider>,
      );
    });

    const oosBadges = oosSettingsTree!.root.findAll(
      n => typeof n.props?.testID === 'string' && n.props.testID.startsWith('oxygen-settings-icon-'),
    );
    expect(oosBadges.length).toBeGreaterThanOrEqual(10);
    const oosSettingsTexts = collectAllText(oosSettingsTree!.root);
    expect(oosSettingsTexts).not.toContain('⚙️');
    expect(oosSettingsTexts).not.toContain('👟');
    expect(oosSettingsTexts).not.toContain('💧');

    // SettingsScreen under Default preserves original emojis with zero Oxygen badges
    let defaultSettingsTree: ReactTestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      defaultSettingsTree = ReactTestRenderer.create(
        <SettingsProvider>
          <PaperProvider theme={defaultPaperTheme}>
            <AyumiThemeProvider themeId="default" paperTheme={defaultPaperTheme}>
              <SettingsScreen hideDock />
            </AyumiThemeProvider>
          </PaperProvider>
        </SettingsProvider>,
      );
    });

    const defaultBadges = defaultSettingsTree!.root.findAll(
      n => typeof n.props?.testID === 'string' && n.props.testID.startsWith('oxygen-settings-icon-'),
    );
    expect(defaultBadges).toHaveLength(0);
    const defaultSettingsTexts = collectAllText(defaultSettingsTree!.root);
    expect(defaultSettingsTexts).toContain('⚙️');
    expect(defaultSettingsTexts).toContain('👟');
    expect(defaultSettingsTexts).toContain('💧');

    // Default HeroStepGauge and BentoCard keep Default structure with zero Oxygen component bodies or badges
    let oosHeroTree: ReactTestRenderer.ReactTestRenderer | null = null;
    let defaultHeroAndBentoTree: ReactTestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      oosHeroTree = ReactTestRenderer.create(
        <PaperProvider theme={oosPaperTheme}>
          <AyumiThemeProvider themeId="oxygen_coloros" paperTheme={oosPaperTheme}>
            <HeroStepGauge steps={4820} goal={8000} />
          </AyumiThemeProvider>
        </PaperProvider>,
      );
      defaultHeroAndBentoTree = ReactTestRenderer.create(
        <PaperProvider theme={defaultPaperTheme}>
          <AyumiThemeProvider themeId="default" paperTheme={defaultPaperTheme}>
            <HeroStepGauge steps={4820} goal={8000} />
            <BentoCard
              title="Distance"
              value="1.4"
              unit="km"
              icon={<View testID="default-bento-icon" />}
              cardBgColor={defaultPaperTheme.colors.surface}
            />
          </AyumiThemeProvider>
        </PaperProvider>,
      );
    });

    expect(
      oosHeroTree!.root.findAllByProps({ testID: 'oxygen-hero-steps-badge' }).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      defaultHeroAndBentoTree!.root.findAllByProps({ testID: 'oxygen-hero-steps-badge' }),
    ).toHaveLength(0);
    expect(
      defaultHeroAndBentoTree!.root.findAllByProps({ testID: 'oxygen-metric-card-body' }),
    ).toHaveLength(0);

    await act(async () => {
      oosSettingsTree!.unmount();
      defaultSettingsTree!.unmount();
      oosHeroTree!.unmount();
      defaultHeroAndBentoTree!.unmount();
    });
  });

  it('degrades gracefully when AyumiSystemPalette native bridge throws', () => {
    const originalPlatformOs = Platform.OS;
    const originalModule = NativeModules.AyumiSystemPalette;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(jest.fn());

    try {
      (Platform as { OS: string }).OS = 'android';
      NativeModules.AyumiSystemPalette = {
        getExtendedSystemPalette: jest.fn(() => {
          throw new Error('Map already consumed');
        }),
      };

      expect(readNativeExtendedSystemPalette()).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      (Platform as { OS: string }).OS = originalPlatformOs;
      NativeModules.AyumiSystemPalette = originalModule;
      warnSpy.mockRestore();
    }
  });
});
