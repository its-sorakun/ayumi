/**
 * AiAmbientDashboardView — complete AI Ambient Home experience built to match the
 * target aesthetic (full-bleed anime scenery fading into soft atmospheric mist, crisp
 * white upper-left multi-line greeting with colourful icon+temperature weather pill and
 * short Gemini quote, top-right scalloped sparkle regeneration button, left organic
 * contour Steps progress visualization, right stacked translucent metric cards with all
 * real Ayumi data, and lower Water card with shared `useWaterTracker` sync).
 */

import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  PixelRatio,
  RefreshControl,
  ScrollView,
  StyleSheet,
  ToastAndroid,
  Platform,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Text } from 'react-native-paper';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import {
  OxygenActiveTimeIcon,
  OxygenCaloriesIcon,
  OxygenDistanceIcon,
  OxygenWaterIcon,
} from '../oxygenIcons';
import { colorWithOpacity } from '../paletteUtils';
import { useReducedMotion } from '../../theme/motion';
import {
  getAmbientGreetingLines,
  resolveTimeOfDayPhase,
} from './config';
import { useAiAmbient } from './AiAmbientContext';
import { deriveAiAmbientMetricAccents, type AiAmbientPaletteTokens } from './ambientPalette';
import { formatAmbientTemperature } from './ambientServices';
import { AiAmbientBackdropCanvas } from './AiAmbientBackdropCanvas';
import { AiAmbientOrganicSteps } from './AiAmbientOrganicSteps';
import { AiAmbientWaveNav } from './AiAmbientWaveNav';
import { AiAmbientWeatherIcon } from './AiAmbientWeatherIcon';

export interface AiAmbientDashboardProps {
  readonly steps: number;
  readonly stepGoal: number;
  readonly activeCaloriesText: string;
  readonly activeCaloriesUnit: string;
  readonly totalCaloriesRaw: string;
  readonly distanceValue: string;
  readonly distanceUnit: string;
  readonly distanceGoalText: string;
  readonly distanceProgress: number;
  readonly activeTimeValue: string;
  readonly activeTimeUnit: string;
  readonly totalWaterMl: number;
  readonly waterGoalMl: number;
  readonly waterGoalText: string;
  readonly waterProgress: number;
  readonly refreshing: boolean;
  readonly hideDock?: boolean;
  readonly onRefresh: () => void;
  readonly onAddWater: (amountMl: number) => void;
  readonly onOpenStepsStats: () => void;
  readonly onOpenDistanceStats: () => void;
  readonly onOpenWaterStats: () => void;
  readonly onOpenSettings: () => void;
}

function ScallopedSparkleButton({
  palette,
  isGenerating,
  reducedMotion,
  onPress,
}: {
  readonly palette: AiAmbientPaletteTokens;
  readonly isGenerating: boolean;
  readonly reducedMotion: boolean;
  readonly onPress: () => void;
}): React.JSX.Element {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isGenerating || reducedMotion) {
      spinAnim.stopAnimation();
      spinAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [isGenerating, reducedMotion, spinAnim]);

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      testID="ai-ambient-regenerate-button"
      accessibilityRole="button"
      accessibilityLabel={
        isGenerating
          ? 'Generating new AI ambient scenery'
          : 'Regenerate AI ambient scenery and quote'
      }
      style={styles.sparkleTouchable}>
      <Svg width={48} height={48} viewBox="0 0 48 48">
        {/* Scalloped 8-lobe flower-cloud silhouette matching the reference badge */}
        <Path
          d="M24 3.5C27.2 3.5 29.3 5.7 31.8 6.8C34.5 7.9 37.8 7.5 39.8 9.8C41.8 12.1 40.9 15.2 41.9 18C42.9 20.6 45 22.8 44.5 25.8C44 28.8 41.5 30.6 40.6 33.4C39.6 36.2 40.2 39.4 37.9 41.3C35.5 43.2 32.4 42.1 29.6 43.1C26.9 44 24.9 45.8 21.8 45.4C18.8 45 16.9 42.7 14.1 41.7C11.3 40.7 8.1 41.2 6.2 38.8C4.3 36.4 5.4 33.2 4.4 30.4C3.4 27.8 1.5 25.6 2 22.6C2.5 19.6 5 17.8 6 15C7 12.2 6.4 9 8.8 7.1C11.2 5.2 14.2 6.4 17 5.4C19.6 4.4 21 3.5 24 3.5Z"
          fill={palette.sparkleBtnFill}
          stroke={palette.glassBorder}
          strokeWidth={1.2}
        />
        {isGenerating && (
          <Circle
            cx={24}
            cy={24}
            r={16}
            fill="none"
            stroke={palette.sparkleIconColor}
            strokeWidth={1.5}
            strokeDasharray={[6, 5]}
            strokeOpacity={0.65}
          />
        )}
      </Svg>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.sparkleIconCenter,
          !reducedMotion && isGenerating ? { transform: [{ rotate: spinInterpolate }] } : undefined,
        ]}>
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <Path
            d="M12 2.5L14.2 9.8L21.5 12L14.2 14.2L12 21.5L9.8 14.2L2.5 12L9.8 9.8Z"
            fill={palette.sparkleIconColor}
          />
        </Svg>
      </Animated.View>
    </TouchableOpacity>
  );
}

interface RightFrostedMetricCardProps {
  readonly title: string;
  readonly value: string;
  readonly unit: string;
  readonly secondaryLine?: string;
  readonly accentColor: string;
  readonly icon: React.ReactNode;
  readonly palette: AiAmbientPaletteTokens;
  readonly minHeight: number;
  readonly onPress?: () => void;
  readonly testID?: string;
}

function RightFrostedMetricCard({
  title,
  value,
  unit,
  secondaryLine,
  accentColor,
  icon,
  palette,
  minHeight,
  onPress,
  testID,
}: RightFrostedMetricCardProps): React.JSX.Element {
  const isInteractive = typeof onPress === 'function';
  return (
    <TouchableOpacity
      activeOpacity={isInteractive ? 0.82 : 1}
      disabled={!isInteractive}
      onPress={onPress}
      testID={testID}
      style={[
        styles.metricGlassCard,
        {
          minHeight,
          backgroundColor: palette.glassFill,
          borderColor: palette.glassBorder,
        },
      ]}>
      <LinearGradient
        colors={[
          palette.glassHighlightEdge,
          'transparent',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View
        style={[
          styles.metricIconBadge,
          { backgroundColor: colorWithOpacity(accentColor, palette.isDark ? 0.24 : 0.14) },
        ]}>
        {icon}
      </View>
      <View style={styles.metricTextCol}>
        <Text
          numberOfLines={1}
          style={[styles.metricTitle, { color: palette.inkSecondary }]}>
          {title}
        </Text>
        <View style={styles.metricValueRow}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.metricValue, { color: palette.inkPrimary }]}>
            {value}
          </Text>
          {unit.length > 0 && (
            <Text style={[styles.metricUnit, { color: palette.inkSecondary }]}>
              {unit}
            </Text>
          )}
        </View>
        {secondaryLine != null && secondaryLine.length > 0 && (
          <Text
            numberOfLines={1}
            style={[styles.metricSubLine, { color: palette.inkSecondary }]}>
            {secondaryLine}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export function AiAmbientDashboardView({
  steps,
  stepGoal,
  activeCaloriesText,
  activeCaloriesUnit,
  totalCaloriesRaw,
  distanceValue,
  distanceUnit,
  distanceGoalText,
  activeTimeValue,
  activeTimeUnit,
  totalWaterMl,
  waterGoalMl,
  waterGoalText,
  waterProgress,
  refreshing,
  hideDock = false,
  onRefresh,
  onAddWater,
  onOpenStepsStats,
  onOpenDistanceStats,
  onOpenWaterStats,
  onOpenSettings,
}: AiAmbientDashboardProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const safeFrame = useSafeAreaFrame();
  const reducedMotion = useReducedMotion();
  const fontScale = PixelRatio.getFontScale();

  const {
    weather,
    quote,
    keyStatuses,
    ambientPalette,
    isGeneratingArtwork,
    regenerateArtworkAndQuote,
    refreshWeatherNow,
  } = useAiAmbient();

  const metricAccents = useMemo(
    () => deriveAiAmbientMetricAccents(ambientPalette),
    [ambientPalette],
  );

  const timePhase = resolveTimeOfDayPhase();
  const greeting = getAmbientGreetingLines(timePhase);

  const viewportH = safeFrame.height > 0 ? safeFrame.height : 844;
  const viewportW = safeFrame.width > 0 ? safeFrame.width : 390;
  const horizontalPad = 18;
  const contentW = Math.max(280, viewportW - horizontalPad * 2);

  // Balance visual scenic upper window with crisp below-the-fold fit across phone heights.
  const navClearance = Math.max(insets.bottom, 10) + 78;
  const topPad = Math.max(insets.top + 8, 20);
  const heroBlobSize = Math.round(Math.min(contentW * 0.545, 206));
  const metricCardHeight = Math.max(60, Math.round((heroBlobSize - 16) / 3));
  const waterCardHeight = 104;
  const middleGap = 14;
  const headerHeightEst = 114;
  const remainingScenicSlack =
    viewportH -
    topPad -
    headerHeightEst -
    heroBlobSize -
    middleGap -
    waterCardHeight -
    navClearance;
  const scenicWindowGap =
    fontScale > 1.08 ? 22 : Math.min(Math.max(Math.round(remainingScenicSlack * 0.78), 24), 132);

  const handleSparklePress = () => {
    if (isGeneratingArtwork) return;
    if (!keyStatuses.hasGeminiKey) {
      if (Platform.OS === 'android') {
        ToastAndroid.show(
          'Add your Gemini API key in Settings to generate artwork.',
          ToastAndroid.SHORT,
        );
      }
      onOpenSettings();
      return;
    }
    regenerateArtworkAndQuote();
  };

  const handleWeatherTap = () => {
    if (!keyStatuses.hasWeatherKey) {
      onOpenSettings();
      return;
    }
    refreshWeatherNow(false);
  };

  const waterRemainingMl = Math.max(0, waterGoalMl - totalWaterMl);
  const waterRemainingLabel =
    waterRemainingMl >= 1000
      ? `${(waterRemainingMl / 1000).toFixed(2)} L left`
      : `${waterRemainingMl} ml left`;
  const waterPct = Math.round(Math.min(Math.max(waterProgress, 0), 1) * 100);
  const totalCaloriesLabel =
    totalCaloriesRaw === 'Setup' ? 'Total: Setup' : `Total ${totalCaloriesRaw}`;

  return (
    <View testID="ai-ambient-dashboard" style={styles.root}>
      <AiAmbientBackdropCanvas variant="home" testID="ai-ambient-home-backdrop" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: topPad,
            paddingBottom: navClearance + 14,
            paddingHorizontal: horizontalPad,
          },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[ambientPalette.primary]}
          />
        }
        accessibilityLabel="Ayumi AI Ambient Dashboard">
        {/* Top Row: Multi-line crisp white greeting + weather icon/temp ONLY + sparkle control */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeftCol}>
            <Text style={styles.greetingLine}>{greeting.line1}</Text>
            <View style={styles.greetingSecondRow}>
              <Text style={styles.greetingLine}>{greeting.line2}</Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleWeatherTap}
                testID="ai-ambient-weather-pill"
                accessibilityRole="button"
                accessibilityLabel={`Current temperature ${formatAmbientTemperature(weather?.temperatureC)}`}
                style={styles.weatherPill}>
                <AiAmbientWeatherIcon
                  category={weather?.conditionCategory ?? 'clear'}
                  isNight={weather ? weather.isNight : timePhase === 'night'}
                  size={22}
                />
                <Text style={styles.weatherTempText}>
                  {formatAmbientTemperature(weather?.temperatureC)}
                </Text>
              </TouchableOpacity>
            </View>
            <Text
              numberOfLines={2}
              testID="ai-ambient-quote-text"
              style={styles.quoteText}>
              {quote}
            </Text>
          </View>

          <ScallopedSparkleButton
            palette={ambientPalette}
            isGenerating={isGeneratingArtwork}
            reducedMotion={reducedMotion}
            onPress={handleSparklePress}
          />
        </View>

        {/* Scenic window breathing space displaying the upper anime illustration unobstructed */}
        <View style={{ height: scenicWindowGap }} />

        {/* Middle Hero Row: Left Organic Steps Blob + Right 3 Stacked Translucent Metric Cards */}
        <View style={styles.middleRow}>
          <View style={styles.stepsHeroCol}>
            <AiAmbientOrganicSteps
              steps={steps}
              goal={stepGoal}
              size={heroBlobSize}
              palette={ambientPalette}
              onPress={onOpenStepsStats}
            />
          </View>

          <View style={styles.rightCardsCol}>
            <RightFrostedMetricCard
              testID="ai-ambient-card-calories"
              title="Calories"
              value={activeCaloriesText}
              unit={activeCaloriesUnit}
              secondaryLine={totalCaloriesLabel}
              accentColor={metricAccents.calories.color}
              palette={ambientPalette}
              minHeight={metricCardHeight}
              onPress={totalCaloriesRaw === 'Setup' ? onOpenSettings : undefined}
              icon={<OxygenCaloriesIcon size={17} color={metricAccents.calories.color} filled />}
            />

            <RightFrostedMetricCard
              testID="ai-ambient-card-distance"
              title="Distance"
              value={distanceValue}
              unit={distanceUnit}
              secondaryLine={`Goal: ${distanceGoalText}`}
              accentColor={metricAccents.distance.color}
              palette={ambientPalette}
              minHeight={metricCardHeight}
              onPress={onOpenDistanceStats}
              icon={<OxygenDistanceIcon size={17} color={metricAccents.distance.color} />}
            />

            <RightFrostedMetricCard
              testID="ai-ambient-card-active-time"
              title="Active Time"
              value={activeTimeValue}
              unit={activeTimeUnit}
              accentColor={metricAccents.activeTime.color}
              palette={ambientPalette}
              minHeight={metricCardHeight}
              icon={<OxygenActiveTimeIcon size={17} color={metricAccents.activeTime.color} />}
            />
          </View>
        </View>

        {/* Lower Row: Frosted Translucent Water Card replacing weekly chart card */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={onOpenWaterStats}
          testID="ai-ambient-water-card"
          accessibilityRole="button"
          accessibilityLabel={`Water today: ${totalWaterMl} ml of ${waterGoalText}`}
          style={[
            styles.waterGlassCard,
            {
              marginTop: middleGap,
              backgroundColor: ambientPalette.glassFillStrong,
              borderColor: ambientPalette.glassBorder,
            },
          ]}>
          <LinearGradient
            colors={[ambientPalette.glassHighlightEdge, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.waterTopRow}>
            <View style={styles.waterTitleGroup}>
              <View
                style={[
                  styles.waterIconCircle,
                  {
                    backgroundColor: colorWithOpacity(
                      metricAccents.water.color,
                      ambientPalette.isDark ? 0.24 : 0.14,
                    ),
                  },
                ]}>
                <OxygenWaterIcon size={18} color={metricAccents.water.color} filled />
              </View>
              <View style={styles.waterTextMeta}>
                <Text style={[styles.waterCardLabel, { color: ambientPalette.inkSecondary }]}>
                  Water
                </Text>
                <View style={styles.waterValueRow}>
                  <Text
                    numberOfLines={1}
                    style={[styles.waterValueNum, { color: ambientPalette.inkPrimary }]}>
                    {totalWaterMl} ml
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[styles.waterGoalSub, { color: ambientPalette.inkSecondary }]}>
                    {' '}of {waterGoalText}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => onAddWater(250)}
              testID="ai-ambient-water-quick-add"
              accessibilityRole="button"
              accessibilityLabel="Add 250 ml water"
              style={styles.quickAddWrap}>
              <LinearGradient
                colors={[ambientPalette.waterBarStart, ambientPalette.waterBarEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.quickAddPill}>
                <Text style={[styles.quickAddText, { color: ambientPalette.onPrimary }]}>
                  + 250 ml
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.waterTrack,
              {
                backgroundColor: colorWithOpacity(
                  metricAccents.water.color,
                  ambientPalette.isDark ? 0.18 : 0.14,
                ),
              },
            ]}>
            {waterProgress > 0 && (
              <LinearGradient
                colors={[ambientPalette.waterBarStart, ambientPalette.waterBarEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.waterFill,
                  { width: `${Math.min(100, Math.max(4, waterProgress * 100))}%` },
                ]}
              />
            )}
          </View>

          <View style={styles.waterBottomRow}>
            <Text style={[styles.waterFootText, { color: ambientPalette.inkSecondary }]}>
              {waterPct}% daily hydration
            </Text>
            <Text style={[styles.waterFootText, { color: ambientPalette.inkSecondary }]}>
              {waterRemainingLabel}
            </Text>
          </View>
        </TouchableOpacity>
      </ScrollView>

      {!hideDock && (
        <AiAmbientWaveNav
          activeTab="home"
          onHomePress={() => {}}
          onAnalyticsPress={onOpenStepsStats}
          onWaterPress={onOpenWaterStats}
          onProfilePress={onOpenSettings}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerLeftCol: {
    flex: 1,
    paddingRight: 12,
  },
  greetingLine: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 36,
    letterSpacing: -0.7,
    textShadowColor: 'rgba(10, 14, 24, 0.34)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  greetingSecondRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  weatherPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.38)',
  },
  weatherTempText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(10, 14, 24, 0.28)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  quoteText: {
    marginTop: 7,
    color: 'rgba(255, 255, 255, 0.94)',
    fontSize: 13.5,
    fontWeight: '500',
    lineHeight: 18,
    textShadowColor: 'rgba(10, 14, 24, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  sparkleTouchable: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  sparkleIconCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  middleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepsHeroCol: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightCardsCol: {
    flex: 1,
    gap: 8,
  },
  metricGlassCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1.1,
    paddingHorizontal: 11,
    paddingVertical: 8,
    gap: 9,
    overflow: 'hidden',
  },
  metricIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricTextCol: {
    flex: 1,
  },
  metricTitle: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    marginTop: 1,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  metricUnit: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  metricSubLine: {
    fontSize: 10.5,
    fontWeight: '500',
    marginTop: 1,
  },
  waterGlassCard: {
    borderRadius: 24,
    borderWidth: 1.15,
    paddingHorizontal: 15,
    paddingVertical: 14,
    overflow: 'hidden',
  },
  waterTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  waterTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  waterIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterTextMeta: {
    flex: 1,
  },
  waterCardLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  waterValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  waterValueNum: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  waterGoalSub: {
    fontSize: 12,
    fontWeight: '500',
  },
  quickAddWrap: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  quickAddPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAddText: {
    fontSize: 13,
    fontWeight: '700',
  },
  waterTrack: {
    height: 9,
    borderRadius: 5,
    marginTop: 12,
    overflow: 'hidden',
  },
  waterFill: {
    height: '100%',
    borderRadius: 5,
  },
  waterBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 7,
  },
  waterFootText: {
    fontSize: 11.5,
    fontWeight: '500',
  },
});

