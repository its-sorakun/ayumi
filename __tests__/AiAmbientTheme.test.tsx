/**
 * Comprehensive test suite for Ayumi's AI Ambient visual theme.
 *
 * Verifies:
 *  - Complete theme registry & zero-regression isolation of Default and OxygenOS/ColorOS
 *  - Dynamic OKLab/Material You palette derivation in both `system` and `artwork` modes
 *  - Organic closed Fourier contour math & stroke-dash progress clamping
 *  - Context fingerprint deduplication, temperature formatting, secret redaction, and privacy-safe prompts
 *  - Undulating wavy bottom nav (`AiAmbientWaveNav`) with 4 icon-only tabs and reduced-motion safety
 *  - Complete `AiAmbientDashboardView` real metric rendering & `+ 250 ml` hydration quick-add
 *  - `AiAmbientContext` + `AiAmbientSettingsSection` Android Keystore secret isolation & session gating
 */

import React from 'react';
import {
  AccessibilityInfo,
  NativeModules,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactTestRenderer, { act } from 'react-test-renderer';
import type { MaterialYouPalette } from 'react-native-material-you-colors';

const mockStorage = new Map<string, string>();

const mockAyumiAmbient = {
  setSecretKey: jest.fn(async (alias: string, plaintext: string) => ({
    hasKey: Boolean(plaintext),
    masked: `••••••••${plaintext.slice(-4)}`,
    alias,
  })),
  getAllKeyStatuses: jest.fn(async () => ({
    hasGeminiKey: false,
    geminiMasked: '',
    hasWeatherKey: false,
    weatherMasked: '',
  })),
  deleteSecretKey: jest.fn(async () => ({
    hasKey: false,
    masked: '',
  })),
  validateGeminiKey: jest.fn(async () => ({ valid: true, statusCode: 200 })),
  validateWeatherKey: jest.fn(async () => ({ valid: true, statusCode: 200 })),
  fetchCurrentWeather: jest.fn(async () => ({
    temperatureC: 24.4,
    conditionId: 800,
    conditionMain: 'Clear',
    conditionDescription: 'clear sky',
    iconCode: '01d',
    isNight: false,
    fetchedAtMs: Date.now(),
    source: 'city' as const,
    cityLabel: 'Kyoto',
  })),
  generateQuote: jest.fn(async () => ({
    quote: 'Sunlight settles gently along the quiet terrace.',
    modelUsed: 'gemini-2.5-flash-lite',
  })),
  generateArtwork: jest.fn(async () => ({
    path: '/data/user/0/com.ayumi.health/files/ai_ambient_cache/ambient_1.jpg',
    uri: 'file:///data/user/0/com.ayumi.health/files/ai_ambient_cache/ambient_1.jpg',
    width: 1080,
    height: 1920,
    generatedAtMs: Date.now(),
    modelUsed: 'gemini-3.1-flash-image-preview',
    palette: {
      dominant: '#3C8DAD',
      primary: '#2B7A9B',
      secondary: '#E28C6B',
      tertiary: '#569E7B',
      highlight: '#F6E4C8',
      shadowDark: '#162836',
      surfaceLightTint: '#EDF6F8',
      surfaceDarkTint: '#0F1B24',
      swatches: ['#2B7A9B', '#E28C6B', '#569E7B'],
      isDarkArtwork: false,
    },
  })),
  extractPaletteFromFile: jest.fn(async () => null),
  verifyCachedArtwork: jest.fn(async () => ({
    path: '',
    uri: '',
    width: 0,
    height: 0,
    exists: false,
  })),
  getCoarseLocation: jest.fn(async () => ({
    hasCoords: false,
    lat: 0,
    lon: 0,
  })),
};

NativeModules.AyumiAmbient = mockAyumiAmbient;

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
    useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 16, left: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

jest.mock('react-native-linear-gradient', () => {
  const actualReact = require('react');
  const { View: RNView } = require('react-native');
  return ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
    actualReact.createElement(RNView, props, children);
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
    RadialGradient: createSvgMock('RadialGradient'),
    Stop: createSvgMock('Stop'),
  };
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
  const {
    View: RNView,
    Text,
    TouchableOpacity: RNTouchableOpacity,
    TextInput: RNTextInput,
  } = require('react-native');

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

  const MockRadioGroup = ({ children }: { children?: React.ReactNode }) =>
    actualReact.createElement(RNView, null, children);
  const MockRadioButton = ({ value }: { value?: string }) =>
    actualReact.createElement(RNView, { testID: value ? `radio-btn-${value}` : undefined });
  MockRadioButton.Group = MockRadioGroup;

  return {
    MD3LightTheme,
    MD3DarkTheme,
    Provider: PaperProvider,
    PaperProvider,
    useTheme: () => actualReact.useContext(PaperThemeContext),
    Text: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
      actualReact.createElement(Text, props, children),
    Divider: () => actualReact.createElement(RNView, null),
    ActivityIndicator: (props: Record<string, unknown>) =>
      actualReact.createElement(RNView, { ...props, accessibilityRole: 'progressbar' }),
    Switch: ({
      value,
      onValueChange,
      ...props
    }: {
      value?: boolean;
      onValueChange?: (v: boolean) => void;
      [key: string]: unknown;
    }) =>
      actualReact.createElement(RNTouchableOpacity, {
        ...props,
        accessibilityRole: 'switch',
        accessibilityState: { checked: Boolean(value) },
        onPress: () => onValueChange && onValueChange(!value),
      }),
    RadioButton: MockRadioButton,
    TextInput: (props: Record<string, unknown>) => actualReact.createElement(RNTextInput, props),
  };
});

import MaterialYou from 'react-native-material-you-colors';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';
import {
  AiAmbientDashboardView,
  AiAmbientProvider,
  AiAmbientSettingsSection,
  AiAmbientWaveNav,
  aiAmbientThemeDefinition,
  AyumiThemeProvider,
  buildAmbientArtworkPrompt,
  buildAmbientContextFingerprint,
  buildAmbientQuotePrompt,
  buildOrganicStepsContour,
  computeOrganicStepsProgress,
  defaultThemeDefinition,
  deriveAiAmbientMetricAccents,
  formatAmbientTemperature,
  getAmbientGreetingLines,
  getContrastRatio,
  mapAiAmbientTokensToPaperColors,
  normalizeWeatherCategory,
  oxygenColorOsThemeDefinition,
  redactAmbientSecrets,
  resolveAiAmbientPaletteTokens,
} from '../src/themes';

async function flushAsync(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function collectRenderedText(node: ReactTestRenderer.ReactTestInstance | string): string {
  const walk = (n: ReactTestRenderer.ReactTestInstance | string): string => {
    if (typeof n === 'string') {
      return n;
    }
    const typeName = String(n.type);
    const isTextHost = typeName === 'Text' || typeName === 'RCTText';
    const joined = n.children.map(walk).join(isTextHost ? '' : ' ');
    return joined;
  };
  return walk(node).replace(/\s+/g, ' ').trim();
}

function makePalette(seed: string): MaterialYouPalette {
  return MaterialYou.generatePaletteFromColor(seed);
}

beforeEach(() => {
  mockStorage.clear();
  jest.clearAllMocks();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockImplementation(() => ({ remove: jest.fn() }) as unknown as ReturnType<
      typeof AccessibilityInfo.addEventListener
    >);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AI Ambient Theme Isolation & Definition', () => {
  it('registers distinct AI Ambient tokens while leaving Default and OxygenOS untouched', () => {
    expect(defaultThemeDefinition.navigation.variant).toBe('capsule_icons');
    expect(defaultThemeDefinition.surfaces.ambientGradientStyle).toBe('none');
    expect(oxygenColorOsThemeDefinition.navigation.variant).toBe('oem_labeled_pill');
    expect(oxygenColorOsThemeDefinition.surfaces.ambientGradientStyle).toBe('dynamic_glow');

    expect(aiAmbientThemeDefinition.id).toBe('ai_ambient');
    expect(aiAmbientThemeDefinition.navigation.variant).toBe('wave_organic_blob');
    expect(aiAmbientThemeDefinition.navigation.showLabels).toBe(false);
    expect(aiAmbientThemeDefinition.surfaces.heroLayout).toBe('organic_ambient');
    expect(aiAmbientThemeDefinition.surfaces.ambientGradientStyle).toBe('ai_ambient_scenic');
    expect(aiAmbientThemeDefinition.surfaces.cardElevation).toBe(0);
  });
});

describe('AI Ambient Dynamic Palette Engine (System & Artwork Modes)', () => {
  it('adapts fully across diverse artwork palettes without hardcoding fixed hues', () => {
    const tealCoastalPalette = resolveAiAmbientPaletteTokens({
      colourSource: 'artwork',
      systemPalette: null,
      artworkPalette: {
        dominant: '#1F7A8C',
        primary: '#126E82',
        secondary: '#E07A5F',
        tertiary: '#2A9D8F',
        highlight: '#F4D58D',
        shadowDark: '#102A38',
        surfaceLightTint: '#E9F5F7',
        surfaceDarkTint: '#0D1C24',
        swatches: ['#126E82', '#E07A5F'],
        isDarkArtwork: false,
      },
      isDark: false,
    });

    const amberAutumnPalette = resolveAiAmbientPaletteTokens({
      colourSource: 'artwork',
      systemPalette: null,
      artworkPalette: {
        dominant: '#C85A17',
        primary: '#B84B14',
        secondary: '#6B7F36',
        tertiary: '#D9822B',
        highlight: '#FCE2AE',
        shadowDark: '#2E180B',
        surfaceLightTint: '#FBF1E6',
        surfaceDarkTint: '#1F130B',
        swatches: ['#B84B14', '#6B7F36'],
        isDarkArtwork: false,
      },
      isDark: false,
    });

    expect(tealCoastalPalette.primary).not.toBe(amberAutumnPalette.primary);
    expect(tealCoastalPalette.stepArcStart).not.toBe(amberAutumnPalette.stepArcStart);
    expect(tealCoastalPalette.navBlobStart).not.toBe(amberAutumnPalette.navBlobStart);

    const lightAccents = deriveAiAmbientMetricAccents(tealCoastalPalette);
    expect(lightAccents.steps.color).toBeTruthy();
    expect(lightAccents.water.color).toBeTruthy();

    const paperColors = mapAiAmbientTokensToPaperColors(tealCoastalPalette);
    expect(getContrastRatio(tealCoastalPalette.inkPrimary, tealCoastalPalette.canvasBg)).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(paperColors.onPrimary, paperColors.primary)).toBeGreaterThanOrEqual(4.5);
  });

  it('derives light and dark Paper palettes in System palette mode with readable contrast', () => {
    const sysPalette = makePalette('#2E7D32');
    const lightTokens = resolveAiAmbientPaletteTokens({
      colourSource: 'system',
      systemPalette: sysPalette,
      artworkPalette: null,
      isDark: false,
    });
    const darkTokens = resolveAiAmbientPaletteTokens({
      colourSource: 'system',
      systemPalette: sysPalette,
      artworkPalette: null,
      isDark: true,
    });

    expect(lightTokens.source).toBe('system');
    expect(darkTokens.source).toBe('system');
    expect(lightTokens.canvasBg).not.toBe(darkTokens.canvasBg);
    expect(getContrastRatio(lightTokens.inkPrimary, lightTokens.canvasBg)).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(darkTokens.inkPrimary, darkTokens.canvasBg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Organic Steps Contour & Progress Math', () => {
  it('builds closed asymmetric harmonic contour paths and clamps progress ratios cleanly', () => {
    const contour = buildOrganicStepsContour(200);
    expect(contour.auraPath).toContain(' Z');
    expect(contour.secondaryAuraPath).toContain(' Z');
    expect(contour.bodyPath).toContain(' Z');
    expect(contour.trackPath).toContain(' Z');
    expect(contour.trackLength).toBeGreaterThan(350);

    const zeroProg = computeOrganicStepsProgress(0, 10000, contour.trackLength);
    expect(zeroProg.ratio).toBe(0);
    expect(zeroProg.percent).toBe(0);
    expect(zeroProg.dashArray[0]).toBe(0);

    const halfProg = computeOrganicStepsProgress(5000, 10000, contour.trackLength);
    expect(halfProg.ratio).toBeCloseTo(0.5, 4);
    expect(halfProg.percent).toBe(50);

    const overflowProg = computeOrganicStepsProgress(18000, 10000, contour.trackLength);
    expect(overflowProg.ratio).toBe(1);
    expect(overflowProg.percent).toBe(100);

    const safeZeroGoal = computeOrganicStepsProgress(500, 0, contour.trackLength);
    expect(safeZeroGoal.ratio).toBe(0);
  });
});

describe('Context Fingerprinting, Redaction, Weather & Privacy-Safe Prompts', () => {
  it('deduplicates minor temperature swings within 4C bucket and invalidates on weather changes', () => {
    const baseFp = buildAmbientContextFingerprint({
      timePhase: 'afternoon',
      weatherCategory: 'clear',
      isNight: false,
      temperatureC: 24.1,
      colourSource: 'artwork',
      systemPrimaryHint: '#226688',
    });
    const sameBucketFp = buildAmbientContextFingerprint({
      timePhase: 'afternoon',
      weatherCategory: 'clear',
      isNight: false,
      temperatureC: 26.8,
      colourSource: 'artwork',
      systemPrimaryHint: '#226688',
    });
    const rainFp = buildAmbientContextFingerprint({
      timePhase: 'afternoon',
      weatherCategory: 'rain',
      isNight: false,
      temperatureC: 24.1,
      colourSource: 'artwork',
      systemPrimaryHint: '#226688',
    });

    expect(baseFp).toBe(sameBucketFp);
    expect(rainFp).not.toBe(baseFp);
  });

  it('formats temperature-only badge, maps OWM condition codes, and redacts API secrets', () => {
    expect(formatAmbientTemperature(24.6)).toBe('25°');
    expect(formatAmbientTemperature(null)).toBe('--°');
    expect(normalizeWeatherCategory(201)).toBe('thunderstorm');
    expect(normalizeWeatherCategory(502)).toBe('rain');
    expect(normalizeWeatherCategory(800)).toBe('clear');

    const redacted = redactAmbientSecrets(
      'https://api.openweathermap.org/data/2.5/weather?lat=10&appid=SECRET123&key=AIzaSyDummyToken123456',
    );
    expect(redacted).not.toContain('SECRET123');
    expect(redacted).not.toContain('AIzaSyDummyToken123456');
  });

  it('never leaks coordinates, personal names, or health data into prompts or greetings', () => {
    const artworkPrompt = buildAmbientArtworkPrompt({
      timePhase: 'morning',
      weather: {
        temperatureC: 21,
        conditionId: 800,
        conditionMain: 'Clear',
        conditionDescription: 'clear sky',
        conditionCategory: 'clear',
        isNight: false,
        fetchedAtMs: 1,
        source: 'gps',
        cityLabel: 'Tokyo',
      },
      paletteHint: 'emerald, warm coral accents',
    });
    const quotePrompt = buildAmbientQuotePrompt({
      timePhase: 'morning',
      weather: null,
    });

    expect(artworkPrompt).not.toContain('Tokyo');
    expect(artworkPrompt).not.toContain('Sora');
    expect(artworkPrompt).not.toContain('steps');
    expect(quotePrompt).not.toContain('calories');
    expect(quotePrompt).not.toContain('Sora');

    const morningGreeting = getAmbientGreetingLines('morning');
    expect(`${morningGreeting.line1} ${morningGreeting.line2}`).toBe('Good Morning');
    expect(`${morningGreeting.line1} ${morningGreeting.line2}`).not.toContain('Sora');
  });
});

describe('AI Ambient Navigation, Dashboard View & Settings Secret Handling', () => {
  it('renders AiAmbientWaveNav with 4 icon-only accessible tabs and liquid blob', async () => {
    const onStats = jest.fn();
    let tree: ReactTestRenderer.ReactTestRenderer | null = null;

    await act(async () => {
      tree = ReactTestRenderer.create(
        <AiAmbientProvider activeSessionThemeId="default" systemPalette={makePalette('#336699')} isDark={false}>
          <AiAmbientWaveNav activeTab="home" onAnalyticsPress={onStats} />
        </AiAmbientProvider>,
      );
    });
    await flushAsync();

    expect(tree!.root.findByProps({ testID: 'ai-ambient-wave-nav' })).toBeTruthy();
    expect(tree!.root.findByProps({ testID: 'ai-ambient-wave-blob' })).toBeTruthy();
    expect(tree!.root.findByProps({ accessibilityLabel: 'Home tab' })).toBeTruthy();
    const statsTab = tree!.root.findByProps({ accessibilityLabel: 'Stats tab' });
    expect(tree!.root.findByProps({ accessibilityLabel: 'Water tab' })).toBeTruthy();
    expect(tree!.root.findByProps({ accessibilityLabel: 'Settings tab' })).toBeTruthy();

    await act(async () => {
      statsTab.props.onPress();
    });
    expect(onStats).toHaveBeenCalledTimes(1);
  });

  it('prevents background weather/Gemini/location calls when active theme is Default or OxygenOS', async () => {
    await act(async () => {
      ReactTestRenderer.create(
        <AiAmbientProvider activeSessionThemeId="default" systemPalette={null} isDark={false}>
          <View />
        </AiAmbientProvider>,
      );
      ReactTestRenderer.create(
        <AiAmbientProvider activeSessionThemeId="oxygen_coloros" systemPalette={null} isDark={false}>
          <View />
        </AiAmbientProvider>,
      );
    });
    await flushAsync();

    expect(mockAyumiAmbient.fetchCurrentWeather).not.toHaveBeenCalled();
    expect(mockAyumiAmbient.generateArtwork).not.toHaveBeenCalled();
    expect(mockAyumiAmbient.generateQuote).not.toHaveBeenCalled();
    expect(mockAyumiAmbient.getCoarseLocation).not.toHaveBeenCalled();
  });

  it('renders AiAmbientDashboardView with live metrics, combined calories, water sync, and temp-only pill', async () => {
    const onAddWater = jest.fn();
    const onOpenStepsStats = jest.fn();
    const onOpenWaterStats = jest.fn();
    let tree: ReactTestRenderer.ReactTestRenderer | null = null;

    const cached = {
      weather: {
        temperatureC: 24.4,
        conditionId: 800,
        conditionMain: 'Clear',
        conditionDescription: 'clear sky',
        conditionCategory: 'clear',
        isNight: false,
        fetchedAtMs: Date.now(),
        source: 'city',
        cityLabel: 'Kyoto',
      },
      quote: 'Breeze stirs through the quiet cedar canopy.',
      quoteFingerprint: 'afternoon|day|clear|mild_20_24|art',
      artwork: null,
      artworkFingerprint: null,
      extractedPalette: null,
    };
    mockStorage.set('@ayumi_ai_ambient_cache_v1', JSON.stringify(cached));

    await act(async () => {
      tree = ReactTestRenderer.create(
        <PaperProvider theme={MD3LightTheme}>
          <AyumiThemeProvider themeId="ai_ambient" paperTheme={MD3LightTheme}>
            <AiAmbientProvider
              activeSessionThemeId="ai_ambient"
              systemPalette={makePalette('#4D6658')}
              isDark={false}>
              <AiAmbientDashboardView
                steps={12450}
                stepGoal={15000}
                activeCaloriesText="410"
                activeCaloriesUnit="kcal"
                totalCaloriesRaw="1,890 kcal"
                distanceValue="9.2"
                distanceUnit="km"
                distanceGoalText="10 km"
                distanceProgress={0.92}
                activeTimeValue="64"
                activeTimeUnit="min"
                totalWaterMl={750}
                waterGoalMl={3000}
                waterGoalText="3.0 L"
                waterProgress={0.25}
                refreshing={false}
                hideDock={true}
                onRefresh={jest.fn()}
                onAddWater={onAddWater}
                onOpenStepsStats={onOpenStepsStats}
                onOpenDistanceStats={jest.fn()}
                onOpenWaterStats={onOpenWaterStats}
                onOpenSettings={jest.fn()}
              />
            </AiAmbientProvider>
          </AyumiThemeProvider>
        </PaperProvider>,
      );
    });
    await flushAsync();

    const renderedText = collectRenderedText(tree!.root);
    expect(renderedText).toContain('12,450');
    expect(renderedText).toContain('of 15,000 steps');
    expect(renderedText).toContain('410');
    expect(renderedText).toContain('Total 1,890 kcal');
    expect(renderedText).toContain('9.2');
    expect(renderedText).toContain('64');
    expect(renderedText).toContain('750 ml');
    expect(renderedText).toContain('24°');
    expect(renderedText).not.toContain('Kyoto');
    expect(renderedText).not.toContain('6,842');
    expect(renderedText).not.toContain('Sora');
    expect(renderedText).toContain('Breeze stirs through the quiet cedar canopy.');

    const quickAdd = tree!.root.findByProps({ testID: 'ai-ambient-water-quick-add' });
    await act(async () => {
      quickAdd.props.onPress();
    });
    expect(onAddWater).toHaveBeenCalledWith(250);
  });

  it('stores Gemini/Weather BYOK secrets exclusively via Android Keystore and never in AsyncStorage', async () => {
    mockAyumiAmbient.setSecretKey.mockImplementationOnce(async (alias: string, plaintext: string) => {
      mockAyumiAmbient.getAllKeyStatuses.mockResolvedValueOnce({
        hasGeminiKey: alias === 'gemini',
        geminiMasked: alias === 'gemini' ? `••••••••${plaintext.slice(-4)}` : '',
        hasWeatherKey: false,
        weatherMasked: '',
      });
      return {
        hasKey: true,
        masked: `••••••••${plaintext.slice(-4)}`,
        alias,
      };
    });

    let tree: ReactTestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <PaperProvider theme={MD3LightTheme}>
          <AyumiThemeProvider themeId="ai_ambient" paperTheme={MD3LightTheme}>
            <AiAmbientProvider
              activeSessionThemeId="ai_ambient"
              systemPalette={makePalette('#4D6658')}
              isDark={false}>
              <AiAmbientSettingsSection isActiveSession={true} />
            </AiAmbientProvider>
          </AyumiThemeProvider>
        </PaperProvider>,
      );
    });
    await flushAsync();

    const geminiInput = tree!.root.findByProps({ testID: 'gemini-key-input' });
    await act(async () => {
      geminiInput.props.onChangeText('AIzaTestSecretKey9876');
    });

    const saveBtn = tree!.root.findByProps({ testID: 'gemini-key-save' });
    await act(async () => {
      await saveBtn.props.onPress();
    });
    await flushAsync();

    expect(mockAyumiAmbient.setSecretKey).toHaveBeenCalledWith('gemini', 'AIzaTestSecretKey9876');
    const serializedStorage = Array.from(mockStorage.entries())
      .map(([k, v]) => `${k}:${v}`)
      .join('\n');
    expect(serializedStorage).not.toContain('AIzaTestSecretKey9876');
    expect((AsyncStorage.setItem as jest.Mock).mock.calls.every(c => !String(c[1]).includes('AIzaTestSecretKey9876'))).toBe(true);

    const statusNode = tree!.root.findByProps({ testID: 'gemini-key-status' });
    expect(JSON.stringify(statusNode.props.children)).toContain('9876');

    // Toggle colour source button works cleanly without Touch errors
    const systemSourceBtn = tree!.root
      .findAllByType(TouchableOpacity)
      .find(n => collectRenderedText(n).includes('System palette'));
    expect(systemSourceBtn).toBeTruthy();
    await act(async () => {
      systemSourceBtn!.props.onPress();
    });
    await flushAsync();

    const testGeminiBtn = tree!.root.findByProps({ testID: 'gemini-key-test' });
    await act(async () => {
      await testGeminiBtn.props.onPress();
    });
    await flushAsync();
    expect(mockAyumiAmbient.validateGeminiKey).toHaveBeenCalledTimes(1);
  });

  it('preserves opaque card surfaces for Default/OxygenOS while providing frosted glass for AI Ambient', async () => {
    const observed: Record<string, string> = {};
    const { useAyumiTheme: useThemeTokens } = require('../src/themes');

    function Probe({ label }: { readonly label: string }): React.JSX.Element {
      const ctx = useThemeTokens();
      observed[label] = ctx.resolveCardSurface('#FFFFFF');
      return React.createElement(View);
    }

    await act(async () => {
      ReactTestRenderer.create(
        <PaperProvider theme={MD3LightTheme}>
          <AyumiThemeProvider themeId="default" paperTheme={MD3LightTheme}>
            <Probe label="default" />
          </AyumiThemeProvider>
          <AyumiThemeProvider themeId="oxygen_coloros" paperTheme={MD3LightTheme}>
            <Probe label="oxygen" />
          </AyumiThemeProvider>
          <AyumiThemeProvider
            themeId="ai_ambient"
            paperTheme={MD3LightTheme}
            customGlassSurface="rgba(248, 251, 250, 0.78)">
            <Probe label="ai_ambient" />
          </AyumiThemeProvider>
        </PaperProvider>,
      );
    });

    expect(observed.default).toBe('#FFFFFF');
    expect(observed.oxygen).toBe('#FFFFFF');
    expect(observed.ai_ambient).toBe('rgba(248, 251, 250, 0.78)');
  });
});
