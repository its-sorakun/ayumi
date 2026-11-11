/**
 * WaterLogger.test — verifies hydration custom amount parsing, goal/remaining calculations,
 * shared AsyncStorage state synchronization across views, 4-tab FloatingDock ordering,
 * interactive WaterLoggerScreen flows (preset quick-add, 1.3 L / 1300 ml custom logging,
 * entry editing, confirmed deletion), and standard-viewport non-scrolling layout behavior.
 */

import React from 'react';
import {
  AccessibilityInfo,
  PixelRatio,
  TextInput as RNTextInput,
  TouchableOpacity,
} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

const mockStorageMap = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockStorageMap.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStorageMap.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      mockStorageMap.delete(key);
    }),
    clear: jest.fn(async () => {
      mockStorageMap.clear();
    }),
  },
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useRoute: () => ({ params: {} }),
  useFocusEffect: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));

jest.mock('react-native-svg', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const SvgMock = ({ children, ...props }: any) => ReactActual.createElement(View, props, children);
  const PrimitiveMock = (props: any) => ReactActual.createElement(View, props);
  return {
    __esModule: true,
    default: SvgMock,
    Svg: SvgMock,
    Path: PrimitiveMock,
    Circle: PrimitiveMock,
    Rect: PrimitiveMock,
    Line: PrimitiveMock,
    G: PrimitiveMock,
    Polygon: PrimitiveMock,
  };
});

jest.mock('react-native-paper', () => {
  const ReactActual = require('react');
  const { View, Text: BaseText, TouchableOpacity: BaseTouchable } = require('react-native');
  const mockTheme = {
    dark: false,
    colors: {
      primary: '#3B6939',
      onPrimary: '#FFFFFF',
      primaryContainer: '#B8F397',
      onPrimaryContainer: '#002204',
      secondary: '#52634F',
      onSecondary: '#FFFFFF',
      secondaryContainer: '#D5E8CF',
      onSecondaryContainer: '#111F0F',
      error: '#BA1A1A',
      onError: '#FFFFFF',
      errorContainer: '#FFDAD6',
      onErrorContainer: '#410002',
      surface: '#FCFDF6',
      surfaceVariant: '#DEE5D9',
      background: '#FCFDF6',
      onSurface: '#1A1C19',
      onSurfaceVariant: '#424940',
      outline: '#72796F',
      outlineVariant: '#C2C9BD',
      backdrop: 'rgba(0, 0, 0, 0.35)',
      surfaceDisabled: '#E2E3DD',
      onSurfaceDisabled: '#8F918B',
      elevation: {
        level0: 'transparent',
        level1: '#F3F5ED',
        level2: '#EEF1E8',
        level3: '#E8ECE2',
        level4: '#E5E9DF',
        level5: '#E0E5DA',
      },
    },
  };

  const DialogComponent = ({ visible, children }: any) =>
    visible ? ReactActual.createElement(View, { testID: 'mock-dialog' }, children) : null;
  DialogComponent.Title = ({ children }: any) => ReactActual.createElement(BaseText, null, children);
  DialogComponent.Content = ({ children }: any) => ReactActual.createElement(View, null, children);
  DialogComponent.Actions = ({ children }: any) => ReactActual.createElement(View, null, children);

  return {
    useTheme: () => mockTheme,
    Text: ({ children, ...props }: any) => ReactActual.createElement(BaseText, props, children),
    Button: ({ children, onPress, ...props }: any) =>
      ReactActual.createElement(
        BaseTouchable,
        { accessibilityRole: 'button', onPress, ...props },
        ReactActual.createElement(BaseText, null, children),
      ),
    Portal: ({ children }: any) => ReactActual.createElement(View, null, children),
    Dialog: DialogComponent,
  };
});

jest.mock('../src/contexts/SettingsContext', () => ({
  useSettings: () => ({
    gender: 'male',
    weight: 75,
    height: 175,
    age: 25,
    customWaterGoal: 3000,
    dailyGoal: 10000,
    unitSystem: 'metric',
  }),
}));

import { FloatingDock } from '../src/components/FloatingDock';
import {
  formatConfirmWaterLabel,
  formatMlForInput,
  parseCustomWaterInputToMl,
} from '../src/components/WaterCustomSheet';
import {
  buildWaterDateKey,
  syncWaterTrackerFromStorage,
  useWaterTracker,
} from '../src/hooks/useWaterTracker';
import {
  computeWaterProgressSummary,
  formatWaterEntryAmount,
  formatWaterLitersFixed2,
  WaterLoggerScreen,
} from '../src/screens/WaterLoggerScreen';

function collectNodeText(node: any): string {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(collectNodeText).join('');
  }
  if (node.children) {
    return node.children.map(collectNodeText).join('');
  }
  return '';
}

function extractAllText(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  const results: string[] = [];
  const walk = (node: any) => {
    if (node == null) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node.type === 'Text') {
      const joined = collectNodeText(node);
      if (joined.length > 0) {
        results.push(joined);
      }
      return;
    }
    if (node.children) {
      node.children.forEach(walk);
    }
  };
  walk(tree.toJSON());
  return results;
}

function findButtonByText(
  root: ReactTestRenderer.ReactTestInstance,
  label: string,
): ReactTestRenderer.ReactTestInstance | undefined {
  return root.findAllByType(TouchableOpacity).find(btn => {
    const texts = btn
      .findAll(n => typeof n.props?.children === 'string')
      .map(n => n.props.children);
    return texts.includes(label);
  });
}

describe('Water custom input parsing & formatting', () => {
  it('parses decimal liter inputs accurately into integer milliliters', () => {
    expect(parseCustomWaterInputToMl('1.3', 'L')).toEqual({ amountMl: 1300, error: null });
    expect(parseCustomWaterInputToMl('0.25', 'L')).toEqual({ amountMl: 250, error: null });
    expect(parseCustomWaterInputToMl('.5', 'L')).toEqual({ amountMl: 500, error: null });
    expect(parseCustomWaterInputToMl('1,75', 'L')).toEqual({ amountMl: 1750, error: null });
  });

  it('parses whole milliliter inputs accurately', () => {
    expect(parseCustomWaterInputToMl('1300', 'ml')).toEqual({ amountMl: 1300, error: null });
    expect(parseCustomWaterInputToMl('250', 'ml')).toEqual({ amountMl: 250, error: null });
  });

  it('rejects zero, negative, fractional-ml, empty, and excessive quantities', () => {
    expect(parseCustomWaterInputToMl('', 'L').amountMl).toBeNull();
    expect(parseCustomWaterInputToMl('0', 'L').amountMl).toBeNull();
    expect(parseCustomWaterInputToMl('-1', 'L').amountMl).toBeNull();
    expect(parseCustomWaterInputToMl('1.5', 'ml').amountMl).toBeNull();
    expect(parseCustomWaterInputToMl('abc', 'L').amountMl).toBeNull();
    expect(parseCustomWaterInputToMl('12000', 'ml').amountMl).toBeNull();
    expect(parseCustomWaterInputToMl('10.5', 'L').amountMl).toBeNull();
  });

  it('formats inputs and action labels cleanly in L and ml modes', () => {
    expect(formatMlForInput(1300, 'L')).toBe('1.30');
    expect(formatMlForInput(1300, 'ml')).toBe('1300');
    expect(formatConfirmWaterLabel(1300, 'L')).toBe('1.30 L');
    expect(formatConfirmWaterLabel(500, 'ml')).toBe('500 ml');
  });
});

describe('WaterLoggerScreen progress calculations', () => {
  it('computes consumed, remaining, percent, and ringRatio across all states', () => {
    expect(computeWaterProgressSummary(0, 3000)).toEqual({
      consumedLiters: '0.00 L',
      goalLiters: '3.00 L',
      remainingLabel: '3.00 L remaining',
      percentText: '0%',
      ringRatio: 0,
      isGoalReached: false,
    });

    expect(computeWaterProgressSummary(1800, 3000)).toEqual({
      consumedLiters: '1.80 L',
      goalLiters: '3.00 L',
      remainingLabel: '1.20 L remaining',
      percentText: '60%',
      ringRatio: 0.6,
      isGoalReached: false,
    });

    expect(computeWaterProgressSummary(3000, 3000)).toEqual({
      consumedLiters: '3.00 L',
      goalLiters: '3.00 L',
      remainingLabel: 'Goal reached!',
      percentText: '100%',
      ringRatio: 1,
      isGoalReached: true,
    });

    expect(computeWaterProgressSummary(3250, 3000)).toEqual({
      consumedLiters: '3.25 L',
      goalLiters: '3.00 L',
      remainingLabel: '+250 ml over goal',
      percentText: '108%',
      ringRatio: 1,
      isGoalReached: true,
    });

    expect(computeWaterProgressSummary(1500, 0).goalLiters).toBe('3.00 L');
  });

  it('formats intake totals and individual entries accurately', () => {
    expect(formatWaterLitersFixed2(1800)).toBe('1.80 L');
    expect(formatWaterEntryAmount(500)).toBe('500 ml');
    expect(formatWaterEntryAmount(1000)).toBe('1.00 L');
    expect(formatWaterEntryAmount(1300)).toBe('1.30 L');
  });
});

describe('Shared useWaterTracker synchronization', () => {
  beforeEach(async () => {
    mockStorageMap.clear();
    await syncWaterTrackerFromStorage();
  });

  it('keeps sibling consumers synced on add, edit, and delete without duplicates', async () => {
    let consumerA: ReturnType<typeof useWaterTracker> | null = null;
    let consumerB: ReturnType<typeof useWaterTracker> | null = null;

    const ProbeA = () => {
      consumerA = useWaterTracker();
      return null;
    };
    const ProbeB = () => {
      consumerB = useWaterTracker();
      return null;
    };

    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <>
          <ProbeA />
          <ProbeB />
        </>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    await ReactTestRenderer.act(async () => {
      await consumerA!.addWater(500);
      await consumerB!.addWater(1300);
    });

    expect(consumerA!.totalWater).toBe(1800);
    expect(consumerB!.totalWater).toBe(1800);
    expect(consumerA!.logs).toHaveLength(2);
    // Newest entry appears first chronologically
    expect(consumerA!.logs[0].amount).toBe(1300);
    expect(consumerA!.logs[1].amount).toBe(500);

    const targetId = consumerA!.logs[1].id;
    const originalTime = consumerA!.logs[1].time;

    // Edit replaces amount in-place preserving original timestamp & id
    await ReactTestRenderer.act(async () => {
      await consumerB!.updateWater(targetId, 750);
    });

    expect(consumerA!.totalWater).toBe(2050);
    const updatedRow = consumerA!.logs.find(entry => entry.id === targetId);
    expect(updatedRow?.amount).toBe(750);
    expect(updatedRow?.time).toBe(originalTime);

    // Delete removes target cleanly while leaving persisted data intact
    await ReactTestRenderer.act(async () => {
      await consumerA!.deleteWater(targetId);
    });

    expect(consumerB!.totalWater).toBe(1300);
    expect(consumerB!.logs).toHaveLength(1);
    const todayKey = buildWaterDateKey(new Date());
    expect(JSON.parse(mockStorageMap.get(todayKey) ?? '[]')).toHaveLength(1);

    await ReactTestRenderer.act(async () => {
      tree.unmount();
    });
  });
});

describe('FloatingDock 4-destination order', () => {
  it('renders Home, Stats, Water, Settings tabs in order and dispatches onWaterPress', () => {
    const onHome = jest.fn();
    const onStats = jest.fn();
    const onWater = jest.fn();
    const onSettings = jest.fn();

    let tree!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <FloatingDock
          activeTab="water"
          onHomePress={onHome}
          onAnalyticsPress={onStats}
          onWaterPress={onWater}
          onProfilePress={onSettings}
        />,
      );
    });

    const tabs = tree.root
      .findAllByType(TouchableOpacity)
      .filter(node => node.props.accessibilityRole === 'tab');
    expect(tabs.map(t => t.props.accessibilityLabel)).toEqual([
      'Home tab',
      'Stats tab',
      'Water tab',
      'Settings tab',
    ]);

    ReactTestRenderer.act(() => {
      tabs[2].props.onPress();
    });
    expect(onWater).toHaveBeenCalledTimes(1);

    ReactTestRenderer.act(() => {
      tree.unmount();
    });
  });
});

describe('WaterLoggerScreen full interactive flow', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    mockStorageMap.clear();
    await syncWaterTrackerFromStorage();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('supports preset quick-add, custom 1.3 L logging, editing, deletion, and non-scroll fit', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<WaterLoggerScreen hideDock={true} />);
      await Promise.resolve();
      await Promise.resolve();
    });

    // Simulate a standard mobile viewport height where outer scrolling stays disabled
    await ReactTestRenderer.act(async () => {
      const viewport = tree.root.findByProps({ testID: 'water-logger-viewport' });
      const controls = tree.root.findByProps({ testID: 'water-logger-controls' });
      viewport.props.onLayout({ nativeEvent: { layout: { width: 390, height: 820 } } });
      controls.props.onLayout({ nativeEvent: { layout: { width: 390, height: 420 } } });
      await Promise.resolve();
    });

    const initialTexts = extractAllText(tree);
    expect(initialTexts).toContain('Water Logger');
    expect(initialTexts).toContain('0.00 L');
    expect(initialTexts).toContain('of 3.00 L');
    expect(initialTexts).toContain('3.00 L remaining');
    expect(initialTexts).toContain('Custom Amount');
    expect(initialTexts).toContain('1.30 L');

    // Quick-add 500 ml preset
    await ReactTestRenderer.act(async () => {
      const btn500 = tree.root.findByProps({ accessibilityLabel: 'Add 500 ml water' });
      await btn500.props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(1600);
    });

    const afterPresetTexts = extractAllText(tree);
    expect(afterPresetTexts).toContain('0.50 L');
    expect(afterPresetTexts).toContain('Total 0.50 L');
    expect(afterPresetTexts.filter(t => t === '500 ml').length).toBeGreaterThanOrEqual(2);

    // Non-scrolling outer screen invariant: only Today's Log internal ScrollView exists
    expect(tree.root.findAllByProps({ testID: 'water-outer-scroll' })).toHaveLength(0);
    const logScrollViews = tree.root.findAllByProps({ testID: 'water-log-scroll' });
    expect(logScrollViews.length).toBeGreaterThanOrEqual(1);
    expect(logScrollViews[0].props.scrollEnabled).toBe(true);

    // Open Custom Amount sheet and log default 1.30 L (1300 ml)
    await ReactTestRenderer.act(async () => {
      const customBtn = tree.root.findByProps({
        accessibilityLabel: 'Custom amount, currently 1.30 L',
      });
      customBtn.props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(400);
    });

    await ReactTestRenderer.act(async () => {
      const confirmBtn = tree.root.findByProps({ accessibilityLabel: 'Add 1.30 L' });
      await confirmBtn.props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(1600);
    });

    const afterCustomTexts = extractAllText(tree);
    expect(afterCustomTexts).toContain('1.80 L');
    expect(afterCustomTexts).toContain('60%');
    expect(afterCustomTexts).toContain('1.20 L remaining');
    expect(afterCustomTexts).toContain('Total 1.80 L');

    // Edit the 500 ml log entry -> change to 750 ml via ml mode
    const optionButtons = tree.root
      .findAllByType(TouchableOpacity)
      .filter(
        n =>
          typeof n.props?.accessibilityLabel === 'string' &&
          n.props.accessibilityLabel.startsWith('Options for 500 ml'),
      );
    expect(optionButtons).toHaveLength(1);

    await ReactTestRenderer.act(async () => {
      optionButtons[0].props.onPress();
    });

    await ReactTestRenderer.act(async () => {
      findButtonByText(tree.root, 'Edit amount')!.props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(400);
    });

    await ReactTestRenderer.act(async () => {
      const input = tree.root.findByType(RNTextInput);
      input.props.onChangeText('750');
    });

    await ReactTestRenderer.act(async () => {
      const saveBtn = tree.root.findByProps({ accessibilityLabel: 'Save 750 ml' });
      await saveBtn.props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(1600);
    });

    const afterEditTexts = extractAllText(tree);
    expect(afterEditTexts).toContain('2.05 L');
    expect(afterEditTexts).toContain('Total 2.05 L');

    // Delete the updated 750 ml log entry via confirmation dialog
    const updatedOptionBtn = tree.root
      .findAllByType(TouchableOpacity)
      .filter(
        n =>
          typeof n.props?.accessibilityLabel === 'string' &&
          n.props.accessibilityLabel.startsWith('Options for 750 ml'),
      );
    expect(updatedOptionBtn).toHaveLength(1);

    await ReactTestRenderer.act(async () => {
      updatedOptionBtn[0].props.onPress();
    });

    await ReactTestRenderer.act(async () => {
      findButtonByText(tree.root, 'Delete entry')!.props.onPress();
    });

    await ReactTestRenderer.act(async () => {
      await findButtonByText(tree.root, 'Delete')!.props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(1600);
    });

    const afterDeleteTexts = extractAllText(tree);
    expect(afterDeleteTexts).toContain('1.30 L');
    expect(afterDeleteTexts).toContain('Total 1.30 L');

    // Genuine small-viewport height fallback enables outer scrolling to prevent clipping
    await ReactTestRenderer.act(async () => {
      const viewport = tree.root.findByProps({ testID: 'water-logger-viewport' });
      const controls = tree.root.findByProps({ testID: 'water-logger-controls' });
      viewport.props.onLayout({ nativeEvent: { layout: { width: 320, height: 560 } } });
      controls.props.onLayout({ nativeEvent: { layout: { width: 320, height: 420 } } });
    });

    expect(tree.root.findAllByProps({ testID: 'water-outer-scroll' }).length).toBeGreaterThanOrEqual(1);

    await ReactTestRenderer.act(async () => {
      tree.unmount();
    });
  });
});
