/**
 * Smoke test for root `App` component startup, dynamic Material You theme
 * context initialization, Paper/Ayumi theme providers, and navigation tree.
 *
 * Mocks native Android bridges (AsyncStorage, Material You colors, Health
 * Connect, hardware sensors, SafeArea, SVG, Screens, LinearGradient, and
 * Vector Icons) cleanly in memory so Jest mounts the real provider hierarchy.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

const mockStorage = new Map<string, string>();

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
    multiGet: jest.fn((keys: readonly string[]) =>
      Promise.resolve(keys.map((key) => [key, mockStorage.get(key) ?? null])),
    ),
    clear: jest.fn(() => {
      mockStorage.clear();
      return Promise.resolve();
    }),
  },
}));

jest.mock('react-native-material-you-colors', () => {
  const actualReact = require('react');
  const mockPalette = {
    system_accent1: [
      '#FFFFFF', '#F2F7F6', '#E0F2EE', '#C3E8E0', '#9ADBD0', '#69C7B7',
      '#006E60', '#005B4F', '#00483E', '#00362F', '#002520', '#001511', '#000000',
    ],
    system_accent2: [
      '#FFFFFF', '#F2F5F9', '#E1E8F2', '#C6D3E6', '#9EB4D4', '#7694BF',
      '#4A635D', '#385887', '#27426B', '#1A2E4D', '#0F1E36', '#071021', '#000000',
    ],
    system_accent3: [
      '#FFFFFF', '#FDF4EC', '#FAE4D2', '#F5CCA8', '#EEAA73', '#E58A44',
      '#436278', '#354F62', '#283D4C', '#1C2C37', '#111C24', '#080E13', '#000000',
    ],
    system_neutral1: [
      '#FFFFFF', '#F8FAF9', '#F1F4F3', '#E4E8E6', '#CED4D1', '#B0B8B4',
      '#919995', '#646C68', '#4B524E', '#333936', '#1C211F', '#101412', '#000000',
    ],
    system_neutral2: [
      '#FFFFFF', '#F5F7F8', '#ECEFF1', '#DCE2E6', '#C2CBD1', '#A2AEB5',
      '#829098', '#5E6A72', '#465057', '#30383D', '#1C2226', '#0E1215', '#000000',
    ],
  };

  return {
    __esModule: true,
    default: {
      getMaterialYouPalette: jest.fn(() => mockPalette),
      generatePaletteFromColor: jest.fn(() => mockPalette),
      createThemeContext: () => ({
        ThemeProvider: ({ children }: { children?: React.ReactNode }) =>
          actualReact.createElement(actualReact.Fragment, null, children),
        useMaterialYouTheme: () => ({
          palette: mockPalette,
          theme: { light: {}, dark: {} },
          setColorScheme: jest.fn(),
        }),
      }),
    },
  };
});

jest.mock('react-native-safe-area-context', () => {
  const actualReact = require('react');
  const { View } = require('react-native');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  return {
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) =>
      actualReact.createElement(View, { style: { flex: 1 } }, children),
    SafeAreaView: ({ children, style }: { children?: React.ReactNode; style?: unknown }) =>
      actualReact.createElement(View, { style }, children),
    SafeAreaInsetsContext: actualReact.createContext(insets),
    SafeAreaFrameContext: actualReact.createContext(frame),
    initialWindowMetrics: { insets, frame },
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
  };
});

jest.mock('react-native-svg', () => {
  const actualReact = require('react');
  const mockEl =
    (name: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      actualReact.createElement(name, props, children);
  return {
    __esModule: true,
    default: mockEl('Svg'),
    Svg: mockEl('Svg'),
    Circle: mockEl('Circle'),
    Rect: mockEl('Rect'),
    Path: mockEl('Path'),
    Line: mockEl('Line'),
    Polygon: mockEl('Polygon'),
    Polyline: mockEl('Polyline'),
    Ellipse: mockEl('Ellipse'),
    G: mockEl('G'),
  };
});

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => {
  const actualReact = require('react');
  const { View } = require('react-native');
  return (props: Record<string, unknown>) => actualReact.createElement(View, props);
});

jest.mock('react-native-linear-gradient', () => {
  const actualReact = require('react');
  const { View } = require('react-native');
  return ({ children, ...props }: { children?: React.ReactNode }) =>
    actualReact.createElement(View, props, children);
});

jest.mock('react-native-screens', () => {
  const actualReact = require('react');
  const { View } = require('react-native');
  return {
    enableScreens: jest.fn(),
    screensEnabled: jest.fn(() => false),
    Screen: View,
    ScreenContainer: View,
    ScreenStack: View,
    NativeScreen: View,
    ScreenStackHeaderConfig: View,
    ScreenStackHeaderSubview: View,
    FullWindowOverlay: ({ children }: { children?: React.ReactNode }) =>
      actualReact.createElement(View, null, children),
  };
});

jest.mock('@react-navigation/native', () => {
  const actualReact = require('react');
  const { View } = require('react-native');
  return {
    NavigationContainer: ({ children }: { children?: React.ReactNode }) =>
      actualReact.createElement(View, { style: { flex: 1 } }, children),
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
    useRoute: () => ({ params: { initialPage: 0 } }),
    useFocusEffect: jest.fn(),
    useIsFocused: () => true,
  };
});

jest.mock('@react-navigation/native-stack', () => {
  const actualReact = require('react');
  const { View } = require('react-native');
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ children }: { children?: React.ReactNode }) => {
        const list = actualReact.Children.toArray(children);
        const firstScreen = list[0];
        if (actualReact.isValidElement(firstScreen)) {
          const Comp = (firstScreen.props as { component?: React.ComponentType<unknown> }).component;
          const initialParams = (firstScreen.props as { initialParams?: Record<string, unknown> })
            .initialParams;
          if (Comp) {
            return actualReact.createElement(
              View,
              { style: { flex: 1 } },
              actualReact.createElement(Comp, { route: { params: initialParams } }),
            );
          }
        }
        return actualReact.createElement(View, null, children);
      },
      Screen: () => null,
    }),
  };
});

jest.mock('react-native-health-connect', () => ({
  initialize: jest.fn(() => Promise.resolve(false)),
  requestPermission: jest.fn(() => Promise.resolve([])),
  getSdkStatus: jest.fn(() => Promise.resolve(1)),
  readRecords: jest.fn(() => Promise.resolve({ records: [] })),
  getGrantedPermissions: jest.fn(() => Promise.resolve([])),
  aggregateRecord: jest.fn(() => Promise.resolve({})),
  aggregateGroupByDuration: jest.fn(() => Promise.resolve([])),
  aggregateGroupByPeriod: jest.fn(() => Promise.resolve([])),
  ExerciseType: {
    WALKING: 79,
    RUNNING: 56,
    CYCLING: 8,
  },
  SdkAvailabilityStatus: {
    SDK_AVAILABLE: 3,
    SDK_UNAVAILABLE: 1,
    SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2,
  },
}));

jest.mock('react-native-sensors', () => ({
  accelerometer: { subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })) },
  SensorTypes: { accelerometer: 'accelerometer' },
  setUpdateIntervalForType: jest.fn(),
}));

import App from '../App';

test('renders root App cleanly with dynamic theme providers', async () => {
  jest.useFakeTimers();
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;
  await act(async () => {
    renderer = ReactTestRenderer.create(<App />);
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(renderer!.toJSON()).not.toBeNull();

  await act(async () => {
    jest.runOnlyPendingTimers();
    renderer!.unmount();
  });
  jest.useRealTimers();
});
