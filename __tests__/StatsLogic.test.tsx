/**
 * StatsLogic.test — verifies Stats unit scaling, period subtitles, water hour extraction,
 * and selector single-tap responsiveness & Android Z-order layering invariants.
 */

import React from 'react';
import { StyleSheet, Text as RNText } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

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
  };
});

jest.mock('react-native-paper', () => {
  const ReactActual = require('react');
  const { Text: PaperBaseText } = require('react-native');
  const mockTheme = {
    dark: false,
    colors: {
      primary: '#3B6939',
      onPrimary: '#FFFFFF',
      primaryContainer: '#B8F397',
      onPrimaryContainer: '#002204',
      secondary: '#52634F',
      secondaryContainer: '#D5E8CF',
      onSecondaryContainer: '#111F0F',
      surface: '#FCFDF6',
      background: '#FCFDF6',
      onSurface: '#1A1C19',
      onSurfaceVariant: '#424940',
      outline: '#72796F',
      outlineVariant: '#C2C9BD',
      elevation: { level1: '#F3F5ED', level2: '#EEF1E8' },
    },
  };
  return {
    useTheme: () => mockTheme,
    Text: ({ children, ...props }: any) => ReactActual.createElement(PaperBaseText, props, children),
  };
});

jest.mock('../src/services', () => ({
  healthService: {
    getHourlySteps: jest.fn(async () => ({ supported: true, buckets: [] })),
    getHourlyDistance: jest.fn(async () => ({ supported: true, buckets: [] })),
    getHistoricalStepsRange: jest.fn(async () => []),
    getHistoricalDistanceRange: jest.fn(async () => []),
  },
}));

jest.mock('../src/hooks', () => ({
  useHealthData: () => ({
    todaySummary: { steps: 0, distance: 0 },
    providerName: 'Health Connect',
  }),
  useWaterTracker: () => ({
    totalWater: 0,
    getLogsForDate: jest.fn(async () => []),
  }),
}));

import {
  AnimatedStatNumber,
  formatInterpolatedStatValue,
} from '../src/components/AnimatedStatNumber';
import { computeNiceAxisMax, formatMetricAxisTick } from '../src/components/StatsChart';
import { StatsMetricSelector } from '../src/components/StatsMetricSelector';
import { StatsPeriodSelector } from '../src/components/StatsPeriodSelector';
import { extractWaterLogHour, formatChartSubtitle } from '../src/screens/StatsScreen';
import { MotionTokens } from '../src/theme/motion';

describe('Stats axis scaling & unit formatting', () => {
  it('formats water Y-axis ticks in Liters (L) instead of k', () => {
    const maxMl = computeNiceAxisMax(1750, 'water');
    expect(maxMl).toBe(2000);
    const ticks = [maxMl, maxMl * 0.75, maxMl * 0.5, maxMl * 0.25, 0].map(v =>
      formatMetricAxisTick(v, 'water', maxMl),
    );
    expect(ticks).toEqual(['2 L', '1.5 L', '1 L', '0.5 L', '0']);
  });

  it('formats small water Y-axis ticks consistently in ml', () => {
    const maxMl = computeNiceAxisMax(750, 'water');
    expect(maxMl).toBe(800);
    const ticks = [maxMl, maxMl * 0.75, maxMl * 0.5, maxMl * 0.25, 0].map(v =>
      formatMetricAxisTick(v, 'water', maxMl),
    );
    expect(ticks).toEqual(['800 ml', '600 ml', '400 ml', '200 ml', '0']);
  });

  it('formats distance Y-axis ticks in km or m instead of generic k', () => {
    const maxMeters = computeNiceAxisMax(5200, 'distance');
    expect(maxMeters).toBe(6000);
    const kmTicks = [maxMeters, maxMeters * 0.75, maxMeters * 0.5, maxMeters * 0.25, 0].map(v =>
      formatMetricAxisTick(v, 'distance', maxMeters),
    );
    expect(kmTicks).toEqual(['6 km', '4.5 km', '3 km', '1.5 km', '0']);

    const smallMeters = computeNiceAxisMax(350, 'distance');
    expect(smallMeters).toBe(400);
    const meterTicks = [smallMeters, smallMeters * 0.75, smallMeters * 0.5, smallMeters * 0.25, 0].map(v =>
      formatMetricAxisTick(v, 'distance', smallMeters),
    );
    expect(meterTicks).toEqual(['400 m', '300 m', '200 m', '100 m', '0']);
  });

  it('scales small and multi-thousand step counts cleanly', () => {
    const smallMax = computeNiceAxisMax(6, 'steps');
    expect(smallMax).toBe(8);
    expect(formatMetricAxisTick(smallMax * 0.5, 'steps', smallMax)).toBe('4');

    const largeMax = computeNiceAxisMax(6500, 'steps');
    expect(largeMax).toBe(8000);
    expect(formatMetricAxisTick(6000, 'steps', largeMax)).toBe('6k');
  });
});

function createResponderTouchEvent(locationX: number) {
  return {
    nativeEvent: { locationX, locationY: 20, pageX: locationX, pageY: 20 },
    touchHistory: {
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: 100,
      touchBank: [
        {
          touchActive: true,
          startPageX: locationX,
          startPageY: 20,
          currentPageX: locationX,
          currentPageY: 20,
          previousPageX: locationX,
          previousPageY: 20,
          startTimeStamp: 100,
          currentTimeStamp: 100,
          previousTimeStamp: 100,
        },
      ],
    },
  };
}

describe('Stats period subtitle labels & water hour parsing', () => {
  it('matches chart header period wording accurately across all three periods', () => {
    expect(formatChartSubtitle('daily', 'Nov 11, 2026')).toBe('Daily • Nov 11, 2026');
    expect(formatChartSubtitle('week', 'Nov 5 – Nov 11, 2026')).toBe('Weekly • Nov 5 – Nov 11, 2026');
    expect(formatChartSubtitle('month', 'November 2026')).toBe('Monthly • November 2026');
  });

  it('extracts water log local hours from timestamps and 12h/24h time strings', () => {
    const ts = new Date(2026, 10, 11, 15, 22, 0, 0).getTime();
    expect(extractWaterLogHour({ id: String(ts), time: '3:22 PM' }, '2026-11-11')).toBe(15);
    expect(extractWaterLogHour({ id: 'legacy-1', time: '12:05 am' }, '2026-11-11')).toBe(0);
    expect(extractWaterLogHour({ id: 'legacy-2', time: '12:30 PM' }, '2026-11-11')).toBe(12);
    expect(extractWaterLogHour({ id: 'legacy-3', time: '21:10' }, '2026-11-11')).toBe(21);
  });
});

describe('Stats selectors layering and single-tap selection', () => {
  it('keeps Metric selector foreground overlay elevated above activeIndicator and switches Distance on first tap', async () => {
    const onSelectMetric = jest.fn();
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <StatsMetricSelector selectedMetric="distance" onSelectMetric={onSelectMetric} />,
      );
    });

    const rootView = tree.root.findByProps({ accessibilityRole: 'tablist' });
    await ReactTestRenderer.act(async () => {
      rootView.props.onLayout({ nativeEvent: { layout: { width: 320 } } });
    });

    const textLabels = tree.root.findAllByType(RNText).map(n => n.props.children);
    expect(textLabels).toEqual(['Steps', 'Distance', 'Water']);

    const layeredStyles = tree.root
      .findAll(
        n =>
          n.props.pointerEvents === 'none' &&
          n.props.style != null &&
          typeof StyleSheet.flatten(n.props.style)?.zIndex === 'number',
      )
      .map(n => StyleSheet.flatten(n.props.style));
    const indicatorStyle = layeredStyles.find(s => s.backgroundColor === '#B8F397');
    const foregroundStyle = layeredStyles.find(s => s.elevation === 4);
    expect(indicatorStyle).toBeDefined();
    expect(foregroundStyle).toBeDefined();
    expect(foregroundStyle!.zIndex).toBeGreaterThan(indicatorStyle!.zIndex!);
    expect(foregroundStyle!.elevation).toBeGreaterThan(indicatorStyle!.elevation!);

    // Single tap on Water (slot 2 -> x = 270 / 320)
    await ReactTestRenderer.act(async () => {
      const evt = createResponderTouchEvent(270);
      rootView.props.onResponderGrant(evt);
      rootView.props.onResponderRelease(evt);
    });
    expect(onSelectMetric).toHaveBeenCalledTimes(1);
    expect(onSelectMetric).toHaveBeenCalledWith('water');
  });

  it('keeps Period selector labels above indicator and switches Week/Month on first tap', async () => {
    const onSelectPeriod = jest.fn();
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <StatsPeriodSelector selectedPeriod="daily" onSelectPeriod={onSelectPeriod} />,
      );
    });

    const rootView = tree.root.findByProps({ accessibilityRole: 'tablist' });
    await ReactTestRenderer.act(async () => {
      rootView.props.onLayout({ nativeEvent: { layout: { width: 308 } } });
    });

    const textLabels = tree.root.findAllByType(RNText).map(n => n.props.children);
    expect(textLabels).toEqual(['Week', 'Daily', 'Month']);

    await ReactTestRenderer.act(async () => {
      const evt = createResponderTouchEvent(40);
      rootView.props.onResponderGrant(evt);
      rootView.props.onResponderRelease(evt);
    });
    expect(onSelectPeriod).toHaveBeenCalledTimes(1);
    expect(onSelectPeriod).toHaveBeenCalledWith('week');
  });
});

describe('Synchronized stat number interpolation & motion tokens', () => {
  it('formats raw and kilo metric scales cleanly across mid-roll and settled states', () => {
    // Raw scale rounds integer units like steps or ml/m
    expect(formatInterpolatedStatValue(0, 'raw', 450, false)).toBe('0');
    expect(formatInterpolatedStatValue(450.4, 'raw', 450, true)).toBe('450');

    // Small integer kilo values (e.g. 2 L = 2000 ml) show 1 decimal mid-roll and exact integer when settled
    expect(formatInterpolatedStatValue(0, 'kilo', 2000, false)).toBe('0.0');
    expect(formatInterpolatedStatValue(1500, 'kilo', 2000, false)).toBe('1.5');
    expect(formatInterpolatedStatValue(2000, 'kilo', 2000, true)).toBe('2');

    // Fractional kilo targets (e.g. 6.24 km = 6240 m) preserve 2-decimal fidelity
    expect(formatInterpolatedStatValue(3120, 'kilo', 6240, false)).toBe('3.12');
    expect(formatInterpolatedStatValue(6240, 'kilo', 6240, true)).toBe('6.24');
  });

  it('restarts count from zero on unit switch without mixing incompatible units and settles cleanly', async () => {
    jest.useFakeTimers();
    try {
      let tree!: ReactTestRenderer.ReactTestRenderer;

      await ReactTestRenderer.act(async () => {
        tree = ReactTestRenderer.create(
          <AnimatedStatNumber
            value={450}
            fallbackText="--"
            unitKey="steps"
            scaleUnit="raw"
            syncKey="steps-week-0"
            duration={400}
          />,
        );
      });

      await ReactTestRenderer.act(async () => {
        jest.advanceTimersByTime(500);
      });
      expect(tree.root.findByType(RNText).props.children).toBe('450');

      // Switch to kilo water unit: must reset roll at 0.0 instead of interpolating from 450 -> 2
      await ReactTestRenderer.act(async () => {
        tree.update(
          <AnimatedStatNumber
            value={2000}
            fallbackText="--"
            unitKey="water-l"
            scaleUnit="kilo"
            syncKey="water-week-0"
            duration={400}
          />,
        );
      });
      expect(tree.root.findByType(RNText).props.children).toBe('0.0');

      await ReactTestRenderer.act(async () => {
        jest.advanceTimersByTime(500);
      });
      expect(tree.root.findByType(RNText).props.children).toBe('2');

      // Null data displays fallback text cleanly
      await ReactTestRenderer.act(async () => {
        tree.update(
          <AnimatedStatNumber
            value={null}
            fallbackText="--"
            unitKey="water-l"
            scaleUnit="kilo"
            syncKey="water-week-null"
            duration={400}
          />,
        );
      });
      expect(tree.root.findByType(RNText).props.children).toBe('--');
    } finally {
      jest.useRealTimers();
    }
  });

  it('defines distinct per-period chart reveal curves and separated selector spring physics', () => {
    expect(MotionTokens.chartReveal.week.duration).toBeGreaterThanOrEqual(900);
    expect(MotionTokens.chartReveal.daily.duration).toBeGreaterThanOrEqual(900);
    expect(MotionTokens.chartReveal.month.duration).toBeGreaterThanOrEqual(900);

    expect(MotionTokens.chartReveal.week.overshoot).toBeGreaterThan(
      MotionTokens.chartReveal.daily.overshoot,
    );
    expect(MotionTokens.chartReveal.daily.overshoot).toBeGreaterThan(
      MotionTokens.chartReveal.month.overshoot,
    );
    expect(MotionTokens.chartReveal.month.overshoot).toBeGreaterThan(0);

    // Metric selector uses cushioned bouncy spring while Period selector uses tauter ferrofluid capsule physics
    expect(MotionTokens.spring.periodCapsule.stiffness).toBeGreaterThan(
      MotionTokens.spring.metricCard.stiffness,
    );
    expect(MotionTokens.spring.periodCapsule.mass).toBeLessThan(
      MotionTokens.spring.metricCard.mass,
    );
  });
});
