/**
 * Comprehensive test suite for Ayumi's Ambient Scenery visual theme.
 *
 * Verifies:
 *  - Complete theme registry & zero-regression isolation of Default and OxygenOS/ColorOS
 *  - Zero generative-AI dependencies (no Gemini keys/endpoints/prompts)
 *  - Dynamic OKLab/Material You system palette derivation with contrast guarantees
 *  - 7 Time-of-Day phases (dawn, morning, afternoon, evening, dusk, night, midnight)
 *  - Exact calendar month -> 5 seasonal vibes + lush green summer monsoon rain + on/off toggle
 *  - Dynamic starry night backdrop, shooting-star spawning, and weather layers
 *  - Organic Steps contour & progress math + undulating wavy bottom navigation
 *  - Free DummyJSON daily/random quote client & Android Keystore OpenWeatherMap isolation
 *  - Dual Auto / Manual Look Pickers in `AiAmbientSettingsSection`
 */

import React from 'react';
import {
  AccessibilityInfo,
  NativeModules,
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
    hasWeatherKey: false,
    weatherMasked: '',
  })),
  deleteSecretKey: jest.fn(async () => ({
    hasKey: false,
    masked: '',
  })),
  validateWeatherKey: jest.fn(async () => ({ valid: true, statusCode: 200 })),
  fetchCurrentWeather: jest.fn(async (cityQuery?: string | null) => ({
    temperatureC: 24.4,
    conditionId: 800,
    conditionMain: 'Clear',
    conditionDescription: 'clear sky',
    iconCode: '01d',
    isNight: false,
    fetchedAtMs: Date.now(),
    source: 'city' as const,
    cityLabel: cityQuery || 'Kyoto',
  })),
  fetchDailyQuote: jest.fn(async (dailySeedId: number, useRandom: boolean) => ({
    id: useRandom ? 777 : dailySeedId,
    quote: useRandom
      ? 'Soft breeze walks with patience along the hill.'
      : 'Peace begins where haste settles down.',
    author: 'Seneca',
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
      titleSmall: { fontFamily: 'sans-serif', fontWeight: '500' },
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

  const MockList = {
    Section: ({ children, ...props }: { children?: React.ReactNode; [k: string]: unknown }) =>
      actualReact.createElement(RNView, props, children),
    Subheader: ({ children }: { children?: React.ReactNode }) =>
      actualReact.createElement(Text, null, children),
    Item: ({
      title,
      description,
      right,
      left,
      ...props
    }: {
      title?: string;
      description?: string;
      right?: () => React.ReactNode;
      left?: () => React.ReactNode;
      [k: string]: unknown;
    }) =>
      actualReact.createElement(
        RNView,
        props,
        left ? left() : null,
        actualReact.createElement(Text, null, title),
        description ? actualReact.createElement(Text, null, description) : null,
        right ? right() : null,
      ),
  };

  return {
    MD3LightTheme,
    MD3DarkTheme,
    Provider: PaperProvider,
    PaperProvider,
    useTheme: () => actualReact.useContext(PaperThemeContext),
    Text: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
      actualReact.createElement(Text, props, children),
    Divider: () => actualReact.createElement(RNView, null),
    Button: ({
      children,
      onPress,
      disabled,
      ...props
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
      disabled?: boolean;
      [key: string]: unknown;
    }) =>
      actualReact.createElement(
        RNTouchableOpacity,
        { ...props, disabled, onPress },
        actualReact.createElement(Text, null, children),
      ),
    HelperText: ({
      children,
      visible = true,
    }: {
      children?: React.ReactNode;
      visible?: boolean;
    }) => (visible ? actualReact.createElement(Text, null, children) : null),
    List: MockList,
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
  AI_AMBIENT_STORAGE_KEYS,
  AiAmbientBackdropCanvas,
  AiAmbientDashboardView,
  AiAmbientProvider,
  AiAmbientSettingsSection,
  AiAmbientWaveNav,
  aiAmbientThemeDefinition,
  AyumiThemeProvider,
  buildOrganicStepsContour,
  computeOrganicStepsProgress,
  DAILY_QUOTE_POOL_SIZE,
  defaultThemeDefinition,
  deriveAiAmbientMetricAccents,
  DUMMYJSON_QUOTE_BASE,
  fetchDailyAmbientQuote,
  formatAmbientTemperature,
  getAmbientGreetingLines,
  getContrastRatio,
  getDailyQuoteSeedId,
  getLocalCalendarDateKey,
  mapAiAmbientTokensToPaperColors,
  normalizeWeatherCategory,
  oxygenColorOsThemeDefinition,
  redactAmbientSecrets,
  resolveAiAmbientPaletteTokens,
  resolveAtmosphericSceneryPalette,
  resolveSeasonForDate,
  resolveTimeOfDayPhase,
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

const mountedRenderers: ReactTestRenderer.ReactTestRenderer[] = [];

function trackTree(tree: ReactTestRenderer.ReactTestRenderer): ReactTestRenderer.ReactTestRenderer {
  mountedRenderers.push(tree);
  return tree;
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

afterEach(async () => {
  while (mountedRenderers.length > 0) {
    const tree = mountedRenderers.pop();
    if (tree) {
      await act(async () => {
        tree.unmount();
      });
    }
  }
  jest.restoreAllMocks();
});

describe('Ambient Scenery Theme Isolation & Zero-AI Config', () => {
  it('registers Scenic metadata while leaving Default and OxygenOS completely untouched', () => {
    expect(defaultThemeDefinition.navigation.variant).toBe('capsule_icons');
    expect(defaultThemeDefinition.surfaces.ambientGradientStyle).toBe('none');
    expect(oxygenColorOsThemeDefinition.navigation.variant).toBe('oem_labeled_pill');
    expect(oxygenColorOsThemeDefinition.surfaces.ambientGradientStyle).toBe('dynamic_glow');

    expect(aiAmbientThemeDefinition.id).toBe('ai_ambient');
    expect(aiAmbientThemeDefinition.name).toBe('Ambient Scenery');
    expect(aiAmbientThemeDefinition.badgeLabel).toBe('Scenic');
    expect(aiAmbientThemeDefinition.navigation.variant).toBe('wave_organic_blob');
    expect(aiAmbientThemeDefinition.navigation.showLabels).toBe(false);
    expect(aiAmbientThemeDefinition.surfaces.heroLayout).toBe('organic_ambient');
    expect(aiAmbientThemeDefinition.surfaces.ambientGradientStyle).toBe('ai_ambient_scenic');
    expect(aiAmbientThemeDefinition.surfaces.cardElevation).toBe(0);
  });

  it('removes all generative AI endpoints/models and uses DummyJSON free quotes', () => {
    const configModule = require('../src/themes/aiAmbient/config');
    const servicesModule = require('../src/themes/aiAmbient/ambientServices');
    expect(configModule.GEMINI_IMAGE_MODELS).toBeUndefined();
    expect(configModule.GEMINI_TEXT_MODELS).toBeUndefined();
    expect(configModule.GEMINI_API_BASE).toBeUndefined();
    expect(servicesModule.requestCoarseLocationPermission).toBeUndefined();
    expect(DUMMYJSON_QUOTE_BASE).toBe('https://dummyjson.com/quotes');
    expect(DAILY_QUOTE_POOL_SIZE).toBe(1454);
  });
});

describe('Material You Palette & Atmospheric Season/Time/Weather Matrix', () => {
  it('derives distinct accessible light and dark palettes from Material You system seeds', () => {
    const lightTokens = resolveAiAmbientPaletteTokens({
      systemPalette: makePalette('#1E88E5'),
      isDark: false,
    });
    const darkTokens = resolveAiAmbientPaletteTokens({
      systemPalette: makePalette('#1E88E5'),
      isDark: true,
    });

    expect(lightTokens.canvasBg).not.toBe(darkTokens.canvasBg);
    expect(getContrastRatio(lightTokens.inkPrimary, lightTokens.canvasBg)).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(darkTokens.inkPrimary, darkTokens.canvasBg)).toBeGreaterThanOrEqual(4.5);

    const paperColors = mapAiAmbientTokensToPaperColors(lightTokens);
    expect(getContrastRatio(paperColors.onPrimary, paperColors.primary)).toBeGreaterThanOrEqual(4.5);

    const accents = deriveAiAmbientMetricAccents(lightTokens);
    expect(accents.steps.color).toBeTruthy();
    expect(accents.water.color).toBeTruthy();
  });

  it('resolves all 7 time-of-day phases and greetings across a 24h clock', () => {
    expect(resolveTimeOfDayPhase(new Date(2026, 4, 15, 5, 30))).toBe('dawn');
    expect(resolveTimeOfDayPhase(new Date(2026, 4, 15, 9, 15))).toBe('morning');
    expect(resolveTimeOfDayPhase(new Date(2026, 4, 15, 14, 0))).toBe('afternoon');
    expect(resolveTimeOfDayPhase(new Date(2026, 4, 15, 17, 45))).toBe('evening');
    expect(resolveTimeOfDayPhase(new Date(2026, 4, 15, 19, 30))).toBe('dusk');
    expect(resolveTimeOfDayPhase(new Date(2026, 4, 15, 22, 0))).toBe('night');
    expect(resolveTimeOfDayPhase(new Date(2026, 4, 15, 2, 15))).toBe('midnight');

    expect(getAmbientGreetingLines('dawn')).toEqual({ line1: 'Early', line2: 'Morning' });
    expect(getAmbientGreetingLines('dusk')).toEqual({ line1: 'Late', line2: 'Evening' });
    expect(getAmbientGreetingLines('midnight')).toEqual({ line1: 'Quiet', line2: 'Midnight' });
  });

  it('maps calendar months accurately onto all 5 seasons and transforms rainy summer into lush greens', () => {
    expect(resolveSeasonForDate(new Date(2026, 11, 10))).toBe('harsh_winter'); // Dec
    expect(resolveSeasonForDate(new Date(2026, 0, 10))).toBe('harsh_winter'); // Jan
    expect(resolveSeasonForDate(new Date(2026, 1, 10))).toBe('early_spring'); // Feb
    expect(resolveSeasonForDate(new Date(2026, 2, 10))).toBe('spring'); // Mar
    for (let m = 3; m <= 8; m += 1) {
      expect(resolveSeasonForDate(new Date(2026, m, 10))).toBe('summer'); // Apr..Sep
    }
    expect(resolveSeasonForDate(new Date(2026, 9, 10))).toBe('autumn_transition'); // Oct
    expect(resolveSeasonForDate(new Date(2026, 10, 10))).toBe('autumn_transition'); // Nov

    const harshWinter = resolveAtmosphericSceneryPalette({
      phase: 'morning',
      weatherCategory: 'clear',
      season: 'harsh_winter',
      seasonalEnabled: true,
    });
    expect(harshWinter.snowCapRatio).toBeGreaterThan(0.8);
    expect(harshWinter.snowCapColor).toBeTruthy();

    const febThaw = resolveAtmosphericSceneryPalette({
      phase: 'morning',
      weatherCategory: 'clear',
      season: 'early_spring',
      seasonalEnabled: true,
    });
    expect(febThaw.snowCapRatio).toBeLessThan(0.5);

    const rainySummer = resolveAtmosphericSceneryPalette({
      phase: 'afternoon',
      weatherCategory: 'rain',
      season: 'summer',
      seasonalEnabled: true,
    });
    const clearSummer = resolveAtmosphericSceneryPalette({
      phase: 'afternoon',
      weatherCategory: 'clear',
      season: 'summer',
      seasonalEnabled: true,
    });
    expect(rainySummer.foliageAccent).toBe('#2EB85C');
    expect(rainySummer.foliageSecondary).toBe('#6AD97C');
    expect(rainySummer.midHill).not.toBe(clearSummer.midHill);

    const disabledSeasonalWinter = resolveAtmosphericSceneryPalette({
      phase: 'morning',
      weatherCategory: 'clear',
      season: 'harsh_winter',
      seasonalEnabled: false,
    });
    expect(disabledSeasonalWinter.snowCapColor).toBeNull();
    expect(disabledSeasonalWinter.snowCapRatio).toBe(0);
  });

  it('activates starry sky & shooting star flags during dusk/night/midnight', () => {
    const midnight = resolveAtmosphericSceneryPalette({
      phase: 'midnight',
      weatherCategory: 'clear',
      season: 'summer',
      seasonalEnabled: true,
    });
    const morning = resolveAtmosphericSceneryPalette({
      phase: 'morning',
      weatherCategory: 'clear',
      season: 'summer',
      seasonalEnabled: true,
    });

    expect(midnight.starDensity).toBe(1);
    expect(midnight.showShootingStars).toBe(true);
    expect(morning.starDensity).toBe(0);
    expect(morning.showShootingStars).toBe(false);
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

describe('DummyJSON Quote Client, Weather Helpers & Secret Redaction', () => {
  it('formats temperature-only badge, maps OWM codes, and redacts API secrets', () => {
    expect(formatAmbientTemperature(24.6)).toBe('25°');
    expect(formatAmbientTemperature(null)).toBe('--°');
    expect(normalizeWeatherCategory(201)).toBe('thunderstorm');
    expect(normalizeWeatherCategory(502)).toBe('rain');
    expect(normalizeWeatherCategory(800)).toBe('clear');

    const redacted = redactAmbientSecrets(
      'https://api.openweathermap.org/data/2.5/weather?lat=10&appid=OWM_SECRET_123&units=metric',
    );
    expect(redacted).not.toContain('OWM_SECRET_123');
    expect(redacted).toContain('[REDACTED]');
  });

  it('fetches deterministic daily DummyJSON quotes and degrades cleanly on network failure', async () => {
    const sampleDate = new Date(2026, 6, 15, 9, 0);
    const seedId = getDailyQuoteSeedId(sampleDate);
    expect(seedId).toBeGreaterThanOrEqual(1);
    expect(seedId).toBeLessThanOrEqual(DAILY_QUOTE_POOL_SIZE);

    const dailyQuote = await fetchDailyAmbientQuote({
      useRandom: false,
      date: sampleDate,
      phase: 'morning',
      weatherCategory: 'clear',
      season: 'summer',
      seasonalEnabled: true,
    });
    expect(mockAyumiAmbient.fetchDailyQuote).toHaveBeenCalledWith(seedId, false);
    expect(dailyQuote.isFallback).toBe(false);
    expect(dailyQuote.quote).toContain('Seneca');

    mockAyumiAmbient.fetchDailyQuote.mockRejectedValueOnce(new Error('offline'));
    const fallback = await fetchDailyAmbientQuote({
      useRandom: true,
      date: sampleDate,
      phase: 'afternoon',
      weatherCategory: 'rain',
      season: 'summer',
      seasonalEnabled: true,
    });
    expect(fallback.isFallback).toBe(true);
    expect(fallback.quote.toLowerCase()).toContain('monsoon');
  });
});

describe('Dynamic Sky, Dashboard View, Nav & Settings Look Pickers', () => {
  it('renders AiAmbientWaveNav with 4 icon-only accessible tabs and liquid blob', async () => {
    const onStats = jest.fn();
    let tree: ReactTestRenderer.ReactTestRenderer | null = null;

    await act(async () => {
      tree = trackTree(
        ReactTestRenderer.create(
          <AiAmbientProvider
            activeSessionThemeId="default"
            systemPalette={makePalette('#336699')}
            isDark={false}>
            <AiAmbientWaveNav activeTab="home" onAnalyticsPress={onStats} />
          </AiAmbientProvider>,
        ),
      );
    });
    await flushAsync();

    expect(tree!.root.findByProps({ testID: 'ai-ambient-wave-nav' })).toBeTruthy();
    expect(tree!.root.findByProps({ testID: 'ai-ambient-wave-blob' })).toBeTruthy();
    const statsTab = tree!.root.findByProps({ accessibilityLabel: 'Stats tab' });
    await act(async () => {
      statsTab.props.onPress();
    });
    expect(onStats).toHaveBeenCalledTimes(1);
  });

  it('prevents background weather and quote calls when Default or OxygenOS is active', async () => {
    await act(async () => {
      trackTree(
        ReactTestRenderer.create(
          <AiAmbientProvider activeSessionThemeId="default" systemPalette={null} isDark={false}>
            <View />
          </AiAmbientProvider>,
        ),
      );
      trackTree(
        ReactTestRenderer.create(
          <AiAmbientProvider
            activeSessionThemeId="oxygen_coloros"
            systemPalette={null}
            isDark={false}>
            <View />
          </AiAmbientProvider>,
        ),
      );
    });
    await flushAsync();

    expect(mockAyumiAmbient.fetchCurrentWeather).not.toHaveBeenCalled();
    expect(mockAyumiAmbient.fetchDailyQuote).not.toHaveBeenCalled();
  });

  it('spawns randomized starfield & shooting star on night UI and monsoon greens during rainy summer', async () => {
    mockStorage.set(
      AI_AMBIENT_STORAGE_KEYS.PREFS,
      JSON.stringify({
        autoRefreshWeather: false,
        manualCity: 'Tokyo',
        timeOverride: 'midnight',
        weatherOverride: 'rain',
        seasonalEnabled: true,
        seasonalOverride: 'summer',
      }),
    );

    let tree: ReactTestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = trackTree(
        ReactTestRenderer.create(
          <AiAmbientProvider
            activeSessionThemeId="ai_ambient"
            systemPalette={makePalette('#2E7D32')}
            isDark={false}>
            <AiAmbientBackdropCanvas variant="home" />
          </AiAmbientProvider>,
        ),
      );
    });
    await flushAsync();

    expect(tree!.root.findByProps({ testID: 'ai-ambient-starfield' })).toBeTruthy();
    expect(tree!.root.findByProps({ testID: 'ai-ambient-shooting-star' })).toBeTruthy();
    expect(tree!.root.findByProps({ testID: 'ai-ambient-monsoon-greens' })).toBeTruthy();
    expect(tree!.root.findByProps({ testID: 'ai-ambient-weather-rain' })).toBeTruthy();
  });

  it('renders AiAmbientDashboardView with real metrics, DummyJSON daily quote, and quick hydration', async () => {
    const onAddWater = jest.fn();
    let tree: ReactTestRenderer.ReactTestRenderer | null = null;

    mockStorage.set(
      AI_AMBIENT_STORAGE_KEYS.PREFS,
      JSON.stringify({
        autoRefreshWeather: false,
        manualCity: 'Kyoto',
        timeOverride: 'dawn',
        weatherOverride: 'clear',
        seasonalEnabled: true,
        seasonalOverride: 'spring',
      }),
    );
    mockStorage.set(
      AI_AMBIENT_STORAGE_KEYS.WEATHER_CACHE,
      JSON.stringify({
        temperatureC: 24.4,
        conditionId: 800,
        conditionMain: 'Clear',
        conditionDescription: 'clear sky',
        iconCode: '01d',
        conditionCategory: 'clear',
        isNight: false,
        fetchedAtMs: Date.now(),
        source: 'city',
        cityLabel: 'Kyoto',
      }),
    );
    mockStorage.set(
      AI_AMBIENT_STORAGE_KEYS.QUOTE_CACHE,
      JSON.stringify({
        id: 42,
        quote: 'Breeze stirs through the quiet cedar canopy.',
        author: '',
        dateKey: getLocalCalendarDateKey(),
        fetchedAtMs: Date.now(),
        isFallback: false,
      }),
    );

    await act(async () => {
      tree = trackTree(
        ReactTestRenderer.create(
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
                  onOpenStepsStats={jest.fn()}
                  onOpenDistanceStats={jest.fn()}
                  onOpenWaterStats={jest.fn()}
                  onOpenSettings={jest.fn()}
                />
              </AiAmbientProvider>
            </AyumiThemeProvider>
          </PaperProvider>,
        ),
      );
    });
    await flushAsync();

    const renderedText = collectRenderedText(tree!.root);
    expect(renderedText).toContain('Early');
    expect(renderedText).toContain('Morning');
    expect(renderedText).toContain('12,450');
    expect(renderedText).toContain('of 15,000 steps');
    expect(renderedText).toContain('410');
    expect(renderedText).toContain('Total 1,890 kcal');
    expect(renderedText).toContain('9.2');
    expect(renderedText).toContain('64');
    expect(renderedText).toContain('750 ml');
    expect(renderedText).toContain('24°');
    expect(renderedText).toContain('Breeze stirs through the quiet cedar canopy.');
    expect(renderedText).not.toContain('Kyoto');
    expect(renderedText).not.toContain('6,842');

    const quickAdd = tree!.root.findByProps({ testID: 'ai-ambient-water-quick-add' });
    await act(async () => {
      quickAdd.props.onPress();
    });
    expect(onAddWater).toHaveBeenCalledWith(250);

    // Tapping top-right refresh button fetches a fresh random quote cleanly
    const refreshBtn = tree!.root.findByProps({ testID: 'ai-ambient-regenerate-button' });
    await act(async () => {
      refreshBtn.props.onPress();
    });
    await flushAsync();
    expect(mockAyumiAmbient.fetchDailyQuote).toHaveBeenCalledWith(expect.any(Number), true);
  });

  it('stores OpenWeatherMap secret via Keystore and switches time/weather/seasonal overrides', async () => {
    mockAyumiAmbient.setSecretKey.mockImplementationOnce(async (alias: string, plaintext: string) => {
      mockAyumiAmbient.getAllKeyStatuses.mockResolvedValueOnce({
        hasWeatherKey: true,
        weatherMasked: `••••••••${plaintext.slice(-4)}`,
      });
      return {
        hasKey: true,
        masked: `••••••••${plaintext.slice(-4)}`,
        alias,
      };
    });

    let tree: ReactTestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = trackTree(
        ReactTestRenderer.create(
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
        ),
      );
    });
    await flushAsync();

    // Verify Time, Weather, and Seasonal Pickers exist and work interactively
    const midnightChip = tree!.root.findByProps({ testID: 'ai-ambient-time-midnight' });
    const snowChip = tree!.root.findByProps({ testID: 'ai-ambient-weather-look-snow' });
    const winterChip = tree!.root.findByProps({ testID: 'ai-ambient-season-harsh_winter' });

    await act(async () => {
      midnightChip.props.onPress();
      snowChip.props.onPress();
      winterChip.props.onPress();
    });
    await flushAsync();

    const storedPrefs = JSON.parse(mockStorage.get(AI_AMBIENT_STORAGE_KEYS.PREFS) ?? '{}');
    expect(storedPrefs.timeOverride).toBe('midnight');
    expect(storedPrefs.weatherOverride).toBe('snow');
    expect(storedPrefs.seasonalOverride).toBe('harsh_winter');

    // Turning Seasonal Scenery OFF hides the seasonal picker chips cleanly
    const seasonalSwitch = tree!.root.findByProps({ testID: 'ai-ambient-seasonal-toggle' });
    await act(async () => {
      seasonalSwitch.props.onValueChange(false);
    });
    await flushAsync();
    expect(tree!.root.findAllByProps({ testID: 'ai-ambient-season-picker' })).toHaveLength(0);

    // Verify zero device location permission toggles exist in Settings UI
    expect(tree!.root.findAllByProps({ testID: 'ai-ambient-location-toggle' })).toHaveLength(0);

    // Save OpenWeatherMap BYOK exclusively via Keystore
    const weatherInput = tree!.root.findByProps({ testID: 'ai-ambient-weather-input' });
    await act(async () => {
      weatherInput.props.onChangeText('owm_secret_4321');
    });
    const saveBtn = tree!.root.findByProps({ testID: 'ai-ambient-weather-save' });
    await act(async () => {
      await saveBtn.props.onPress();
    });
    await flushAsync();

    expect(mockAyumiAmbient.setSecretKey).toHaveBeenCalledWith('openweathermap', 'owm_secret_4321');
    const serializedStorage = Array.from(mockStorage.entries())
      .map(([k, v]) => `${k}:${v}`)
      .join('\n');
    expect(serializedStorage).not.toContain('owm_secret_4321');
    expect(
      (AsyncStorage.setItem as jest.Mock).mock.calls.every(
        c => !String(c[1]).includes('owm_secret_4321'),
      ),
    ).toBe(true);

    const statusNode = tree!.root.findByProps({ testID: 'ai-ambient-weather-status' });
    expect(JSON.stringify(statusNode.props.children)).toContain('4321');
  });

  it('preserves opaque card surfaces for Default/OxygenOS while providing frosted glass for Ambient Scenery', async () => {
    const observed: Record<string, string> = {};
    const { useAyumiTheme: useThemeTokens } = require('../src/themes');

    function Probe({ label }: { readonly label: string }): React.JSX.Element {
      const ctx = useThemeTokens();
      observed[label] = ctx.resolveCardSurface('#FFFFFF');
      return React.createElement(View);
    }

    await act(async () => {
      trackTree(
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
        ),
      );
    });

    expect(observed.default).toBe('#FFFFFF');
    expect(observed.oxygen).toBe('#FFFFFF');
    expect(observed.ai_ambient).toBe('rgba(248, 251, 250, 0.78)');
  });
});
