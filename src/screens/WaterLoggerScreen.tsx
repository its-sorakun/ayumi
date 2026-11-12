/**
 * WaterLoggerScreen — Material 3 Expressive hydration tracker screen for Ayumi.
 *
 * Implements the dedicated Water destination matching the visual hierarchy and Ayumi motion system:
 *  - Shares the single AsyncStorage hydration source of truth (`useWaterTracker`) with Home & Stats
 *  - Displays animated Today's Intake readout, goal target, remaining pill, and synchronized circular ring
 *  - Provides 4 quick-add presets (250 ml, 500 ml, 750 ml, 1.0 L) with interruptible spring feedback
 *  - Keeps a persistent Custom Amount draft row linked to the bottom sheet editor (no vertical jump)
 *  - Allocates remaining vertical viewport naturally to Today's Log with internal scroll for long lists
 *  - Supports chronological newest-first timeline entries with overflow Edit & confirmed Delete actions
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  PixelRatio,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, Dialog, Portal, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import {
  ChevronRightIcon,
  DropletIcon,
  MoreDotsIcon,
  PencilEditIcon,
  TrashDeleteIcon,
  WaterBottleLargeIcon,
  WaterBottleSmallIcon,
  WaterCupIcon,
  WaterTumblerIcon,
} from '../components/AestheticIcons';
import { FloatingDock } from '../components/FloatingDock';
import {
  WaterCustomSheet,
  formatConfirmWaterLabel,
  type WaterInputUnit,
} from '../components/WaterCustomSheet';
import { useSettings } from '../contexts/SettingsContext';
import { useWaterTracker, type WaterLog } from '../hooks/useWaterTracker';
import { useReducedMotion } from '../theme/motion';
import {
  AiAmbientBackdropCanvas,
  blendHexColors,
  colorWithOpacity,
  deriveGradientHighlightHex,
  OxygenAmbientBackdrop,
  OxygenChevronRightIcon,
  OxygenMoreIcon,
  OxygenPencilIcon,
  OxygenTrashIcon,
  OxygenWaterIcon,
  OxygenWaterVesselIcon,
  type OxygenWaterVesselVariant,
  resolveMetricBadgeColors,
  useAyumiTheme,
} from '../themes';
import { calculateWaterGoal } from '../utils';

export interface WaterLoggerScreenProps {
  readonly hideDock?: boolean;
  readonly isPageActive?: boolean;
  readonly onNavigateHome?: () => void;
  readonly onNavigateStats?: () => void;
  readonly onNavigateSettings?: () => void;
}

function resolveOxygenVesselVariant(amountMl: number): OxygenWaterVesselVariant {
  if (amountMl <= 300) return 'cup';
  if (amountMl <= 600) return 'bottle_sm';
  if (amountMl <= 850) return 'tumbler';
  return 'bottle_lg';
}

interface WaterPresetOption {
  readonly ml: number;
  readonly label: string;
  readonly renderIcon: (color: string) => React.ReactNode;
  readonly renderOxygenIcon: (color: string) => React.ReactNode;
}

const WATER_PRESETS: readonly WaterPresetOption[] = [
  {
    ml: 250,
    label: '250 ml',
    renderIcon: color => <WaterCupIcon size={22} color={color} />,
    renderOxygenIcon: color => (
      <OxygenWaterVesselIcon variant="cup" size={21} color={color} />
    ),
  },
  {
    ml: 500,
    label: '500 ml',
    renderIcon: color => <WaterBottleSmallIcon size={22} color={color} />,
    renderOxygenIcon: color => (
      <OxygenWaterVesselIcon variant="bottle_sm" size={21} color={color} />
    ),
  },
  {
    ml: 750,
    label: '750 ml',
    renderIcon: color => <WaterTumblerIcon size={22} color={color} />,
    renderOxygenIcon: color => (
      <OxygenWaterVesselIcon variant="tumbler" size={21} color={color} />
    ),
  },
  {
    ml: 1000,
    label: '1.0 L',
    renderIcon: color => <WaterBottleLargeIcon size={22} color={color} />,
    renderOxygenIcon: color => (
      <OxygenWaterVesselIcon variant="bottle_lg" size={21} color={color} />
    ),
  },
];

const RING_SIZE = 104;
const RING_CENTER = RING_SIZE / 2;

export interface WaterProgressSummary {
  readonly consumedLiters: string;
  readonly goalLiters: string;
  readonly remainingLabel: string;
  readonly percentText: string;
  readonly ringRatio: number;
  readonly isGoalReached: boolean;
}

/** Formats integer milliliters into standard fixed 2-decimal liters (e.g. "1.80 L"). */
export function formatWaterLitersFixed2(ml: number): string {
  const safeMl = Math.max(ml, 0);
  return `${(safeMl / 1000).toFixed(2)} L`;
}

/** Formats individual water entries cleanly using ml below 1 L and L at or above 1 L. */
export function formatWaterEntryAmount(ml: number): string {
  const safeMl = Math.max(Math.round(ml), 0);
  if (safeMl < 1000) {
    return `${safeMl.toLocaleString()} ml`;
  }
  return `${(safeMl / 1000).toFixed(2)} L`;
}

/**
 * Computes consistent hydration goal, remaining label, and clamped progress ratio
 * across zero intake, partial intake, goal completion, and over-goal states.
 */
export function computeWaterProgressSummary(
  totalWaterMl: number,
  goalMl: number,
): WaterProgressSummary {
  const safeGoal = goalMl > 0 ? Math.round(goalMl) : 3000;
  const safeTotal = Math.max(Math.round(totalWaterMl), 0);
  const remainingMl = Math.max(safeGoal - safeTotal, 0);
  const exceededMl = Math.max(safeTotal - safeGoal, 0);
  const rawRatio = safeTotal / safeGoal;
  const ringRatio = Math.min(Math.max(rawRatio, 0), 1);

  let remainingLabel: string;
  if (remainingMl > 0) {
    remainingLabel = `${formatWaterLitersFixed2(remainingMl)} remaining`;
  } else if (exceededMl > 0) {
    remainingLabel = `+${formatWaterEntryAmount(exceededMl)} over goal`;
  } else {
    remainingLabel = 'Goal reached!';
  }

  return {
    consumedLiters: formatWaterLitersFixed2(safeTotal),
    goalLiters: formatWaterLitersFixed2(safeGoal),
    remainingLabel,
    percentText: `${Math.round(rawRatio * 100)}%`,
    ringRatio,
    isGoalReached: safeTotal >= safeGoal,
  };
}

interface PresetTileProps {
  readonly preset: WaterPresetOption;
  readonly isActive: boolean;
  readonly reducedMotion: boolean;
  readonly onPress: (ml: number) => void;
}

function WaterPresetTile({
  preset,
  isActive,
  reducedMotion,
  onPress,
}: PresetTileProps): React.JSX.Element {
  const theme = useTheme();
  const { motion, surfaces, metricAccents, resolveCardSurface } = useAyumiTheme();
  const waterAccent = metricAccents.water;
  const pressScale = useRef(new Animated.Value(1)).current;
  const isSeparateTile = surfaces.separateWaterPresetCards;
  const isOemTint = isSeparateTile || surfaces.activeControlStyle === 'soft_outlined';

  const handlePressIn = () => {
    if (reducedMotion) return;
    pressScale.stopAnimation();
    Animated.timing(pressScale, {
      toValue: 0.93,
      duration: 85,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (reducedMotion) return;
    pressScale.stopAnimation();
    Animated.spring(pressScale, {
      toValue: 1,
      ...motion.spring.metricCard,
      useNativeDriver: true,
    }).start();
  };

  const surfaceBaseHex = theme.dark ? theme.colors.elevation.level1 : theme.colors.surface;
  const tileBg = isActive
    ? isOemTint
      ? blendHexColors(surfaceBaseHex, waterAccent.color, theme.dark ? 0.24 : 0.14)
      : waterAccent.container
    : resolveCardSurface(
        theme.dark
          ? isSeparateTile
            ? theme.colors.elevation.level1
            : theme.colors.elevation.level2
          : isOemTint
          ? theme.colors.surface
          : theme.colors.background,
      );
  const tileBorder = isActive
    ? isSeparateTile
      ? blendHexColors(surfaceBaseHex, waterAccent.color, theme.dark ? 0.56 : 0.42)
      : waterAccent.color
    : isSeparateTile
    ? blendHexColors(surfaceBaseHex, theme.colors.onSurface, theme.dark ? 0.11 : 0.06)
    : theme.colors.outlineVariant;
  const iconColor = isActive
    ? waterAccent.color
    : theme.colors.onSurfaceVariant;
  const labelColor = isActive
    ? isOemTint
      ? waterAccent.color
      : waterAccent.onContainer
    : theme.colors.onSurfaceVariant;

  return (
    <Animated.View
      style={[styles.presetTileWrapper, { transform: [{ scale: pressScale }] }]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => onPress(preset.ml)}
        style={[
          styles.presetTile,
          isSeparateTile && styles.presetTileStandalone,
          isSeparateTile &&
            !isActive && {
              elevation: surfaces.cardElevation,
              shadowOpacity: surfaces.cardShadowOpacity,
            },
          isActive ? styles.presetTileActive : styles.presetTileInactive,
          {
            backgroundColor: tileBg,
            borderColor: tileBorder,
          },
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={`Add ${preset.label} water`}>
        <View style={styles.presetIconBox}>
          {surfaces.iconFamily === 'oxygen_lucide'
            ? preset.renderOxygenIcon(iconColor)
            : preset.renderIcon(iconColor)}
        </View>
        <Text
          numberOfLines={1}
          style={[
            styles.presetLabel,
            isActive ? styles.presetLabelActive : styles.presetLabelInactive,
            { color: labelColor },
          ]}>
          {preset.label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

interface WaterTimelineRowProps {
  readonly log: WaterLog;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly isNewlyAdded: boolean;
  readonly isRecentlyEdited: boolean;
  readonly isDeleting: boolean;
  readonly reducedMotion: boolean;
  readonly onOpenMenu: (log: WaterLog) => void;
}

function WaterTimelineRow({
  log,
  isFirst,
  isLast,
  isNewlyAdded,
  isRecentlyEdited,
  isDeleting,
  reducedMotion,
  onOpenMenu,
}: WaterTimelineRowProps): React.JSX.Element {
  const theme = useTheme();
  const { motion, surfaces, shapes, metricAccents } = useAyumiTheme();
  const waterAccent = metricAccents.water;
  const isOemRow = surfaces.bentoLayout === 'header_inline';
  const isGroupedCleanRow = surfaces.separateWaterPresetCards;
  const enterAnim = useRef(new Animated.Value(isNewlyAdded ? 0 : 1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const exitAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isNewlyAdded) return;
    if (reducedMotion) {
      enterAnim.setValue(1);
      return;
    }
    enterAnim.setValue(0);
    Animated.parallel([
      Animated.timing(enterAnim, {
        toValue: 1,
        duration: 260,
        easing: motion.easing.emphasizedDecel,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isNewlyAdded, reducedMotion, enterAnim, motion]);

  useEffect(() => {
    if (!isRecentlyEdited || reducedMotion) return;
    pulseAnim.setValue(1);
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1.03,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(pulseAnim, {
        toValue: 1,
        ...motion.spring.snappy,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isRecentlyEdited, reducedMotion, pulseAnim, motion]);

  useEffect(() => {
    if (!isDeleting || reducedMotion) return;
    Animated.timing(exitAnim, {
      toValue: 1,
      duration: 170,
      easing: motion.easing.accelerate,
      useNativeDriver: true,
    }).start();
  }, [isDeleting, reducedMotion, exitAnim, motion]);

  const rowBg = theme.dark
    ? theme.colors.elevation.level2
    : isOemRow
    ? theme.colors.surface
    : theme.colors.elevation.level1;

  const translateY = enterAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 0],
  });
  const enterScale = enterAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  });
  const exitOpacity = exitAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const exitTranslateX = exitAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 18],
  });

  return (
    <Animated.View
      style={[
        styles.timelineRowWrapper,
        {
          opacity: Animated.multiply(enterAnim, exitOpacity),
          transform: [
            { translateY },
            { translateX: exitTranslateX },
            { scale: Animated.multiply(enterScale, pulseAnim) },
          ],
        },
      ]}>
      {/* Continuous left chronological timeline column */}
      <View style={styles.timelineRailColumn}>
        <View
          style={[
            styles.timelineRailSegment,
            isFirst ? styles.timelineSegmentHidden : styles.timelineSegmentVisible,
            { backgroundColor: waterAccent.color },
          ]}
        />
        <View
          style={[
            styles.timelineDot,
            { backgroundColor: waterAccent.color },
          ]}
        />
        <View
          style={[
            styles.timelineRailSegment,
            isLast ? styles.timelineSegmentHidden : styles.timelineSegmentVisible,
            { backgroundColor: waterAccent.color },
          ]}
        />
      </View>

      {/* Comfortable tonal entry row or borderless grouped OxygenOS row */}
      <View
        style={[
          styles.logEntryCard,
          isGroupedCleanRow && styles.logEntryRowGrouped,
          isGroupedCleanRow && !isLast && {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colorWithOpacity(
              theme.colors.onSurface,
              theme.dark ? 0.11 : 0.07,
            ),
          },
          {
            borderRadius: isGroupedCleanRow ? 0 : shapes.logEntryRadius,
            backgroundColor: isGroupedCleanRow ? 'transparent' : rowBg,
            borderColor: isGroupedCleanRow
              ? 'transparent'
              : isRecentlyEdited
              ? waterAccent.color
              : theme.colors.outlineVariant,
          },
        ]}>
        <View
          style={[
            styles.logEntryIconBox,
            {
              borderRadius: isOemRow ? 11 : 18,
              backgroundColor: isOemRow
                ? colorWithOpacity(waterAccent.color, theme.dark ? 0.2 : 0.11)
                : waterAccent.container,
            },
          ]}>
          {surfaces.iconFamily === 'oxygen_lucide' ? (
            <OxygenWaterVesselIcon
              variant={resolveOxygenVesselVariant(log.amount)}
              size={18}
              color={waterAccent.color}
            />
          ) : (
            <WaterCupIcon size={18} color={waterAccent.color} />
          )}
        </View>

        <View style={styles.logEntryTextCol}>
          <Text style={[styles.logEntryAmount, { color: theme.colors.onSurface }]}>
            {formatWaterEntryAmount(log.amount)}
          </Text>
          <Text
            style={[
              styles.logEntryTime,
              { color: theme.colors.onSurfaceVariant },
            ]}>
            {log.time}
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => onOpenMenu(log)}
          style={[
            styles.moreButton,
            {
              backgroundColor: surfaces.subtleTimelineMenuButton
                ? 'transparent'
                : theme.dark
                ? theme.colors.elevation.level3
                : theme.colors.surface,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Options for ${formatWaterEntryAmount(log.amount)} at ${log.time}`}>
          {surfaces.iconFamily === 'oxygen_lucide' ? (
            <OxygenMoreIcon size={17} color={theme.colors.onSurfaceVariant} />
          ) : (
            <MoreDotsIcon size={16} color={theme.colors.onSurfaceVariant} />
          )}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

export function WaterLoggerScreen({
  hideDock = false,
  isPageActive = true,
  onNavigateHome,
  onNavigateStats,
  onNavigateSettings,
}: WaterLoggerScreenProps = {}): React.JSX.Element {
  const theme = useTheme();
  const isDark = theme.dark;
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const {
    motion,
    surfaces,
    shapes,
    typography,
    progress,
    metricAccents,
    resolveCardBorder,
    resolveCardSurface,
  } = useAyumiTheme();
  const waterAccent = metricAccents.water;
  const ringStroke = progress.waterStrokeWidth;
  const ringRadius = RING_CENTER - ringStroke / 2 - 4;
  const ringCircumference = 2 * Math.PI * ringRadius;

  const { gender, weight, height, age, customWaterGoal } = useSettings();
  const { logs, totalWater, addWater, updateWater, deleteWater } =
    useWaterTracker();

  const waterGoalMl = useMemo(
    () => customWaterGoal || calculateWaterGoal(gender, weight, height, age),
    [customWaterGoal, gender, weight, height, age],
  );

  // Active preset highlight and custom draft (persisted as draft until user edits/confirms)
  const [selectedPresetMl, setSelectedPresetMl] = useState<number>(250);
  const [customDraftMl, setCustomDraftMl] = useState<number>(1300);
  const [customDraftUnit, setCustomDraftUnit] = useState<WaterInputUnit>('L');

  // Custom editor modal state ('add' for Custom Amount, 'edit' for modifying an entry)
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetMode, setSheetMode] = useState<'add' | 'edit'>('add');
  const [editingEntry, setEditingEntry] = useState<WaterLog | null>(null);

  // Entry overflow menu + confirmed deletion dialog state
  const [actionMenuLog, setActionMenuLog] = useState<WaterLog | null>(null);
  const [confirmDeleteLog, setConfirmDeleteLog] = useState<WaterLog | null>(null);

  // Animation state trackers for rows and quick feedback pill
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);
  const [recentlyEditedId, setRecentlyEditedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toastLabel, setToastLabel] = useState<string | null>(null);
  const prevTopLogIdRef = useRef<string | null>(logs[0]?.id ?? null);
  const pendingAddToastRef = useRef(false);

  // Responsive viewport guard: fit on standard screens without whole-page scrolling
  const [viewportHeight, setViewportHeight] = useState(0);
  const [topSectionHeight, setTopSectionHeight] = useState(0);
  const currentFontScale = PixelRatio.getFontScale();
  const dockTopOffset = Math.max(insets.bottom + 8, 16) + shapes.dockHeight;
  const bottomClearance = dockTopOffset + 12;
  const minLogCardHeight = 196;
  const requiresOuterScroll =
    currentFontScale > 1.15 ||
    (viewportHeight > 0 &&
      topSectionHeight > 0 &&
      topSectionHeight + minLogCardHeight + bottomClearance > viewportHeight + 2);

  // Synchronized numeric total + circular progress ring animation
  const animatedMlRef = useRef(new Animated.Value(totalWater));
  const currentMlRef = useRef(totalWater);
  const prevTotalForPulseRef = useRef(totalWater);
  const ringPulseAnim = useRef(new Animated.Value(1)).current;
  const [displayTotalMl, setDisplayTotalMl] = useState(totalWater);

  // Quick-add confirmation badge opacity
  const toastAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const mlAnim = animatedMlRef.current;

    if (reducedMotion) {
      mlAnim.stopAnimation();
      mlAnim.setValue(totalWater);
      currentMlRef.current = totalWater;
      setDisplayTotalMl(totalWater);
      prevTotalForPulseRef.current = totalWater;
      return;
    }

    const startVal = currentMlRef.current;
    if (Math.abs(startVal - totalWater) < 0.5) {
      currentMlRef.current = totalWater;
      setDisplayTotalMl(totalWater);
      prevTotalForPulseRef.current = totalWater;
      return;
    }

    mlAnim.stopAnimation();
    mlAnim.setValue(startVal);

    const listenerId = mlAnim.addListener(({ value }) => {
      currentMlRef.current = value;
      const rounded = Math.round(value);
      setDisplayTotalMl(prev => (prev !== rounded ? rounded : prev));
    });

    const crossedGoalUpward =
      prevTotalForPulseRef.current < waterGoalMl && totalWater >= waterGoalMl;
    prevTotalForPulseRef.current = totalWater;

    const anim = Animated.timing(mlAnim, {
      toValue: totalWater,
      duration: 540,
      easing: motion.easing.dataReveal,
      useNativeDriver: false,
    });

    anim.start(({ finished }) => {
      if (finished) {
        currentMlRef.current = totalWater;
        setDisplayTotalMl(totalWater);
        if (crossedGoalUpward) {
          ringPulseAnim.setValue(1);
          Animated.sequence([
            Animated.timing(ringPulseAnim, {
              toValue: 1.05,
              duration: 150,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.spring(ringPulseAnim, {
              toValue: 1,
              ...motion.spring.metricCard,
              useNativeDriver: true,
            }),
          ]).start();
        }
      }
    });

    return () => {
      mlAnim.removeListener(listenerId);
      anim.stop();
    };
  }, [totalWater, waterGoalMl, reducedMotion, ringPulseAnim, motion]);

  // Detect newly appended log id cleanly so new rows animate in without re-animating unchanged ones
  useEffect(() => {
    const topId = logs[0]?.id ?? null;
    if (topId && topId !== prevTopLogIdRef.current && pendingAddToastRef.current) {
      setNewlyAddedId(topId);
    }
    pendingAddToastRef.current = false;
    prevTopLogIdRef.current = topId;
  }, [logs]);

  // Brief confirmation badge right inside Add Water header without delaying repeated presses
  const showAddedFeedback = useCallback(
    (amountMl: number) => {
      setToastLabel(`+${formatWaterEntryAmount(amountMl)}`);
      toastAnim.stopAnimation();
      if (reducedMotion) {
        toastAnim.setValue(1);
        return;
      }
      toastAnim.setValue(0);
      Animated.sequence([
        Animated.timing(toastAnim, {
          toValue: 1,
          duration: 140,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(900),
        Animated.timing(toastAnim, {
          toValue: 0,
          duration: 240,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setToastLabel(null);
        }
      });
    },
    [reducedMotion, toastAnim],
  );

  // When leaving Water page cleanly collapse ephemeral edit highlight
  useEffect(() => {
    if (!isPageActive) {
      setRecentlyEditedId(null);
      setNewlyAddedId(null);
    }
  }, [isPageActive]);

  const handleQuickAdd = useCallback(
    (ml: number) => {
      setSelectedPresetMl(ml);
      pendingAddToastRef.current = true;
      addWater(ml);
      showAddedFeedback(ml);
    },
    [addWater, showAddedFeedback],
  );

  const handleOpenCustomAdd = () => {
    setSheetMode('add');
    setEditingEntry(null);
    setSheetVisible(true);
  };

  const handleSheetConfirm = (amountMl: number, unitUsed: WaterInputUnit) => {
    setSheetVisible(false);
    if (sheetMode === 'edit' && editingEntry) {
      const targetId = editingEntry.id;
      setEditingEntry(null);
      setRecentlyEditedId(targetId);
      updateWater(targetId, amountMl);
      return;
    }

    setCustomDraftMl(amountMl);
    setCustomDraftUnit(unitUsed);
    pendingAddToastRef.current = true;
    addWater(amountMl);
    showAddedFeedback(amountMl);
  };

  const handleConfirmDelete = () => {
    const target = confirmDeleteLog;
    setConfirmDeleteLog(null);
    if (!target) return;

    if (reducedMotion) {
      deleteWater(target.id);
      return;
    }

    setDeletingId(target.id);
    setTimeout(() => {
      deleteWater(target.id);
      setDeletingId(prev => (prev === target.id ? null : prev));
    }, 180);
  };

  // Animated progress displays derived strictly from synchronized displayTotalMl
  const animatedProgress = useMemo(
    () => computeWaterProgressSummary(displayTotalMl, waterGoalMl),
    [displayTotalMl, waterGoalMl],
  );
  const actualProgress = useMemo(
    () => computeWaterProgressSummary(totalWater, waterGoalMl),
    [totalWater, waterGoalMl],
  );

  const dashOffset = ringCircumference * (1 - animatedProgress.ringRatio);
  const tipAngle = -Math.PI / 2 + animatedProgress.ringRatio * Math.PI * 2;
  const tipKnobX = RING_CENTER + ringRadius * Math.cos(tipAngle);
  const tipKnobY = RING_CENTER + ringRadius * Math.sin(tipAngle);
  const showTipKnob =
    progress.showWaterTipKnob &&
    animatedProgress.ringRatio > 0.015 &&
    animatedProgress.ringRatio < 0.995;

  const baseCardBg = isDark ? theme.colors.elevation.level1 : theme.colors.surface;
  const cardBg = resolveCardSurface(baseCardBg);
  const cardBorder = resolveCardBorder();
  const customDraftLabel = formatConfirmWaterLabel(customDraftMl, customDraftUnit);
  const isOemWaterVisual = surfaces.bentoLayout === 'header_inline';
  const isSeparateWaterCards = surfaces.separateWaterPresetCards;
  const isOxygenIcons = surfaces.iconFamily === 'oxygen_lucide';
  const isSolidBadges = surfaces.badgeStyle === 'solid';
  const waterBadge = resolveMetricBadgeColors(waterAccent, surfaces.badgeStyle);
  const softWaterTint = isOemWaterVisual
    ? colorWithOpacity(waterAccent.color, isDark ? 0.2 : 0.11)
    : waterAccent.container;
  const pillTextColor =
    isOemWaterVisual || surfaces.activeControlStyle === 'soft_outlined'
      ? waterAccent.color
      : waterAccent.onContainer;

  const headerAndControls = (
    <View
      testID="water-logger-controls"
      onLayout={e => setTopSectionHeight(e.nativeEvent.layout.height)}>
      {/* 1. Header */}
      <View style={styles.headerRow}>
        <Text
          style={[
            styles.screenTitleText,
            {
              color: theme.colors.onSurface,
              fontSize: typography.screenTitleSize,
              fontWeight: typography.screenTitleWeight,
              letterSpacing: typography.screenTitleTracking,
            },
          ]}>
          Water Logger
        </Text>
        <Text
          style={[
            styles.screenSubtitleText,
            {
              color: theme.colors.onSurfaceVariant,
              fontSize: typography.screenSubtitleSize,
            },
          ]}>
          Log your water intake and stay hydrated
        </Text>
      </View>

      {/* 2. Today's Intake Card */}
      <View
        style={[
          styles.sectionCard,
          styles.intakeCardSpacing,
          {
            borderRadius: surfaces.sectionCardRadius,
            elevation: surfaces.cardElevation,
            shadowOpacity: surfaces.cardShadowOpacity,
            backgroundColor: cardBg,
            borderWidth: cardBorder.borderWidth,
            borderColor: cardBorder.borderColor,
          },
        ]}>
        <View style={styles.intakeRow}>
          <View style={styles.intakeLeftColumn}>
            <View style={styles.intakeLabelRow}>
              <View
                style={[
                  styles.intakeBadge,
                  {
                    backgroundColor: isOemWaterVisual
                      ? softWaterTint
                      : isSolidBadges
                      ? waterBadge.bg
                      : softWaterTint,
                    borderRadius: isOemWaterVisual ? 12 : isSolidBadges ? 16 : 16,
                  },
                ]}>
                {isOxygenIcons ? (
                  <OxygenWaterIcon
                    size={17}
                    color={
                      isOemWaterVisual
                        ? waterAccent.color
                        : isSolidBadges
                        ? waterBadge.fg
                        : waterAccent.color
                    }
                    filled={isSolidBadges && !isOemWaterVisual}
                  />
                ) : (
                  <DropletIcon size={17} color={waterAccent.color} />
                )}
              </View>
              <Text
                style={[
                  styles.intakeTitleText,
                  { color: theme.colors.onSurfaceVariant },
                ]}>
                Today's Intake
              </Text>
            </View>

            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.consumedValueText,
                {
                  color: theme.colors.onSurface,
                  fontWeight: typography.statValueWeight,
                },
              ]}>
              {animatedProgress.consumedLiters}
            </Text>

            <Text
              style={[
                styles.goalSubtitleText,
                { color: theme.colors.onSurfaceVariant },
              ]}>
              of {actualProgress.goalLiters}
            </Text>

            <View
              style={[
                styles.remainingPill,
                { backgroundColor: softWaterTint },
              ]}>
              {isOxygenIcons ? (
                <OxygenWaterVesselIcon
                  variant="cup"
                  size={14}
                  color={waterAccent.color}
                />
              ) : (
                <WaterCupIcon size={14} color={waterAccent.color} />
              )}
              <Text
                numberOfLines={1}
                style={[
                  styles.remainingPillText,
                  { color: pillTextColor },
                ]}>
                {actualProgress.remainingLabel}
              </Text>
            </View>
          </View>

          <Animated.View
            style={[
              styles.progressRingBox,
              { transform: [{ scale: ringPulseAnim }] },
            ]}>
            <Svg width={RING_SIZE} height={RING_SIZE}>
              {isOemWaterVisual && (
                <Defs>
                  <LinearGradient id="waterHeroRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop
                      offset="0%"
                      stopColor={deriveGradientHighlightHex(waterAccent.color, isDark)}
                    />
                    <Stop offset="100%" stopColor={waterAccent.color} />
                  </LinearGradient>
                </Defs>
              )}
              {/* Inactive circular track */}
              <Circle
                cx={RING_CENTER}
                cy={RING_CENTER}
                r={ringRadius}
                stroke={
                  isOemWaterVisual
                    ? colorWithOpacity(
                        theme.colors.onSurface,
                        isDark ? 0.12 : 0.08,
                      )
                    : isDark
                      ? theme.colors.elevation.level3
                      : theme.colors.surfaceVariant
                }
                strokeWidth={ringStroke}
                fill="none"
              />
              {/* Animated hydration arc */}
              {animatedProgress.ringRatio > 0 && (
                <Circle
                  cx={RING_CENTER}
                  cy={RING_CENTER}
                  r={ringRadius}
                  stroke={isOemWaterVisual ? 'url(#waterHeroRingGrad)' : waterAccent.color}
                  strokeWidth={ringStroke}
                  fill="none"
                  strokeDasharray={`${ringCircumference} ${ringCircumference}`}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  transform={`rotate(-90, ${RING_CENTER}, ${RING_CENTER})`}
                />
              )}
              {/* Leading tip indicator dot aligned along the progress arc */}
              {showTipKnob && (
                <Circle
                  cx={tipKnobX}
                  cy={tipKnobY}
                  r={5.5}
                  fill={baseCardBg}
                  stroke={waterAccent.color}
                  strokeWidth={2.5}
                />
              )}
            </Svg>
            <View style={styles.ringCenterOverlay} pointerEvents="none">
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[
                  styles.percentValueText,
                  {
                    color: theme.colors.onSurface,
                    fontWeight: typography.statValueWeight,
                  },
                ]}>
                {animatedProgress.percentText}
              </Text>
            </View>
          </Animated.View>
        </View>
      </View>

      {/* 3. Add Water Section (standalone tiles + row card on OxygenOS; unified card on Default) */}
      {isSeparateWaterCards ? (
        <View testID="water-add-separate-section">
          <View style={styles.standaloneSectionHeader}>
            <Text
              style={[
                styles.sectionTitleText,
                {
                  color: theme.colors.onSurface,
                  fontSize: typography.sectionTitleSize,
                  fontWeight: typography.sectionTitleWeight,
                },
              ]}>
              Add Water
            </Text>
            {toastLabel ? (
              <Animated.View
                style={[
                  styles.addedFeedbackPill,
                  {
                    backgroundColor: softWaterTint,
                    opacity: toastAnim,
                  },
                ]}>
                <Text style={[styles.addedFeedbackText, { color: pillTextColor }]}>
                  {toastLabel}
                </Text>
              </Animated.View>
            ) : null}
          </View>

          <View style={styles.standalonePresetsRow}>
            {WATER_PRESETS.map(preset => (
              <WaterPresetTile
                key={preset.ml}
                preset={preset}
                isActive={selectedPresetMl === preset.ml}
                reducedMotion={reducedMotion}
                onPress={handleQuickAdd}
              />
            ))}
          </View>

          <TouchableOpacity
            testID="water-custom-amount-card"
            activeOpacity={0.84}
            onPress={handleOpenCustomAdd}
            style={[
              styles.customAmountStandaloneCard,
              {
                backgroundColor: cardBg,
                borderWidth: cardBorder.borderWidth,
                borderColor: cardBorder.borderColor,
                elevation: surfaces.cardElevation,
                shadowOpacity: surfaces.cardShadowOpacity,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Custom amount, currently ${customDraftLabel}`}>
            <View style={styles.customRowLeft}>
              <OxygenPencilIcon size={17} color={theme.colors.onSurfaceVariant} />
              <Text style={[styles.customRowLabel, { color: theme.colors.onSurface }]}>
                Custom Amount
              </Text>
            </View>
            <View style={styles.customRowRight}>
              <Text style={[styles.customDraftInlineText, { color: theme.colors.onSurface }]}>
                {customDraftLabel}
              </Text>
              <OxygenChevronRightIcon size={18} color={theme.colors.onSurfaceVariant} />
            </View>
          </TouchableOpacity>
        </View>
      ) : (
        <View
          style={[
            styles.sectionCard,
            styles.secondaryCardSpacing,
            {
              borderRadius: surfaces.sectionCardRadius,
              elevation: surfaces.cardElevation,
              shadowOpacity: surfaces.cardShadowOpacity,
              backgroundColor: cardBg,
              borderWidth: cardBorder.borderWidth,
              borderColor: cardBorder.borderColor,
            },
          ]}>
          <View style={styles.addHeaderRow}>
            <Text
              style={[
                styles.sectionTitleText,
                {
                  color: theme.colors.onSurface,
                  fontSize: typography.sectionTitleSize,
                  fontWeight: typography.sectionTitleWeight,
                },
              ]}>
              Add Water
            </Text>
            {toastLabel ? (
              <Animated.View
                style={[
                  styles.addedFeedbackPill,
                  {
                    backgroundColor: waterAccent.container,
                    opacity: toastAnim,
                  },
                ]}>
                <Text
                  style={[
                    styles.addedFeedbackText,
                    { color: waterAccent.onContainer },
                  ]}>
                  {toastLabel}
                </Text>
              </Animated.View>
            ) : null}
          </View>

          <View style={styles.presetsRow}>
            {WATER_PRESETS.map(preset => (
              <WaterPresetTile
                key={preset.ml}
                preset={preset}
                isActive={selectedPresetMl === preset.ml}
                reducedMotion={reducedMotion}
                onPress={handleQuickAdd}
              />
            ))}
          </View>

          {/* Persistent Custom Amount row opening bottom sheet */}
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={handleOpenCustomAdd}
            style={[
              styles.customAmountRow,
              {
                backgroundColor: resolveCardSurface(
                  isDark
                    ? theme.colors.elevation.level2
                    : theme.colors.background,
                ),
                borderColor: theme.colors.outlineVariant,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Custom amount, currently ${customDraftLabel}`}>
            <View style={styles.customRowLeft}>
              {isOxygenIcons ? (
                <OxygenPencilIcon size={17} color={theme.colors.onSurfaceVariant} />
              ) : (
                <PencilEditIcon size={17} color={theme.colors.onSurfaceVariant} />
              )}
              <Text
                style={[
                  styles.customRowLabel,
                  { color: theme.colors.onSurface },
                ]}>
                Custom Amount
              </Text>
            </View>

            <View style={styles.customRowRight}>
              <View
                style={[
                  styles.customDraftChip,
                  {
                    borderRadius: shapes.chipRadius,
                    backgroundColor: cardBg,
                    borderColor: theme.colors.outlineVariant,
                  },
                ]}>
                <Text
                  style={[
                    styles.customDraftText,
                    { color: theme.colors.onSurface },
                  ]}>
                  {customDraftLabel}
                </Text>
              </View>
              {isOxygenIcons ? (
                <OxygenChevronRightIcon size={18} color={theme.colors.onSurfaceVariant} />
              ) : (
                <ChevronRightIcon size={18} color={theme.colors.onSurfaceVariant} />
              )}
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const todaysLogBody =
    logs.length === 0 ? (
      <View style={styles.emptyLogBox}>
        <Text
          style={[
            styles.emptyLogTitle,
            { color: theme.colors.onSurfaceVariant },
          ]}>
          No water logged yet today
        </Text>
        <Text
          style={[
            styles.emptyLogSubtitle,
            { color: theme.colors.outline },
          ]}>
          Tap a quick preset or Custom Amount above
        </Text>
      </View>
    ) : (
      <ScrollView
        testID="water-log-scroll"
        style={requiresOuterScroll ? undefined : styles.logInternalScroll}
        contentContainerStyle={styles.logListContent}
        nestedScrollEnabled
        scrollEnabled={!requiresOuterScroll}
        showsVerticalScrollIndicator={false}>
        {logs.map((entry, idx) => (
          <WaterTimelineRow
            key={entry.id}
            log={entry}
            isFirst={idx === 0}
            isLast={idx === logs.length - 1}
            isNewlyAdded={entry.id === newlyAddedId}
            isRecentlyEdited={entry.id === recentlyEditedId}
            isDeleting={entry.id === deletingId}
            reducedMotion={reducedMotion}
            onOpenMenu={setActionMenuLog}
          />
        ))}
      </ScrollView>
    );

  const todaysLogCard = isSeparateWaterCards ? (
    <View
      testID="water-todays-log-grouped-section"
      style={requiresOuterScroll ? undefined : styles.logCardFlex}>
      <View style={[styles.standaloneSectionHeader, styles.standaloneLogHeaderSpacing]}>
        <Text
          style={[
            styles.sectionTitleText,
            {
              color: theme.colors.onSurface,
              fontSize: typography.sectionTitleSize,
              fontWeight: typography.sectionTitleWeight,
            },
          ]}>
          Today's Log
        </Text>
        <View
          style={[
            styles.totalBadgePill,
            { backgroundColor: softWaterTint },
          ]}>
          <Text style={[styles.totalBadgeText, { color: pillTextColor }]}>
            Total {actualProgress.consumedLiters}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.sectionCard,
          styles.groupedLogCardPadding,
          requiresOuterScroll ? styles.logCardExpandedMin : styles.logCardFlex,
          {
            borderRadius: surfaces.sectionCardRadius,
            elevation: surfaces.cardElevation,
            shadowOpacity: surfaces.cardShadowOpacity,
            backgroundColor: cardBg,
            borderWidth: cardBorder.borderWidth,
            borderColor: cardBorder.borderColor,
          },
        ]}>
        {todaysLogBody}
      </View>
    </View>
  ) : (
    <View
      style={[
        styles.sectionCard,
        styles.secondaryCardSpacing,
        requiresOuterScroll ? styles.logCardExpandedMin : styles.logCardFlex,
        {
          borderRadius: surfaces.sectionCardRadius,
          elevation: surfaces.cardElevation,
          shadowOpacity: surfaces.cardShadowOpacity,
          backgroundColor: cardBg,
          borderWidth: cardBorder.borderWidth,
          borderColor: cardBorder.borderColor,
        },
      ]}>
      <View style={styles.logHeaderRow}>
        <Text
          style={[
            styles.sectionTitleText,
            {
              color: theme.colors.onSurface,
              fontSize: typography.sectionTitleSize,
              fontWeight: typography.sectionTitleWeight,
            },
          ]}>
          Today's Log
        </Text>
        <View
          style={[
            styles.totalBadgePill,
            { backgroundColor: softWaterTint },
          ]}>
          <Text
            style={[
              styles.totalBadgeText,
              { color: pillTextColor },
            ]}>
            Total {actualProgress.consumedLiters}
          </Text>
        </View>
      </View>

      {todaysLogBody}
    </View>
  );

  return (
    <View
      testID="water-logger-viewport"
      style={[styles.screenWrapper, { backgroundColor: theme.colors.background }]}
      onLayout={e => setViewportHeight(e.nativeEvent.layout.height)}>
      <OxygenAmbientBackdrop
        enabled={surfaces.ambientGradientStyle === 'dynamic_glow'}
        primaryHex={waterAccent.color}
        secondaryHex={deriveGradientHighlightHex(waterAccent.color, isDark)}
        isDark={isDark}
        testID="water-ambient-backdrop"
      />
      {surfaces.ambientGradientStyle === 'ai_ambient_scenic' && (
        <AiAmbientBackdropCanvas
          variant="subdued"
          testID="water-ai-ambient-backdrop"
        />
      )}
      {requiresOuterScroll ? (
        <ScrollView
          testID="water-outer-scroll"
          style={styles.outerScroll}
          contentContainerStyle={{
            paddingTop: insets.top + 6,
            paddingBottom: bottomClearance,
          }}
          showsVerticalScrollIndicator={false}>
          {headerAndControls}
          {todaysLogCard}
        </ScrollView>
      ) : (
        <View
          style={[
            styles.fixedViewportContainer,
            {
              paddingTop: insets.top + 6,
              paddingBottom: bottomClearance,
            },
          ]}>
          {headerAndControls}
          {todaysLogCard}
        </View>
      )}

      {/* Standalone dock fallback when not embedded in MainPagerScreen */}
      {!hideDock && (
        <FloatingDock
          activeTab="water"
          onHomePress={onNavigateHome}
          onAnalyticsPress={onNavigateStats}
          onWaterPress={() => {}}
          onProfilePress={onNavigateSettings}
        />
      )}

      {/* Custom Amount / Edit Amount Bottom Sheet */}
      <WaterCustomSheet
        visible={sheetVisible}
        mode={sheetMode}
        initialAmountMl={
          sheetMode === 'edit' && editingEntry
            ? editingEntry.amount
            : customDraftMl
        }
        initialUnit={
          sheetMode === 'edit' && editingEntry
            ? editingEntry.amount < 1000
              ? 'ml'
              : 'L'
            : customDraftUnit
        }
        onDismiss={() => {
          setSheetVisible(false);
          setEditingEntry(null);
        }}
        onConfirm={handleSheetConfirm}
      />

      {/* Row Overflow Menu Action Sheet (Modal overlay avoids pager coordinate offset issues) */}
      <Modal
        visible={actionMenuLog !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setActionMenuLog(null)}>
        <Pressable
          style={[styles.actionBackdrop, { backgroundColor: theme.colors.backdrop }]}
          onPress={() => setActionMenuLog(null)}>
          <Pressable
            style={[
              styles.actionSheet,
              {
                borderTopLeftRadius: shapes.bottomSheetRadius,
                borderTopRightRadius: shapes.bottomSheetRadius,
                backgroundColor: isDark
                  ? theme.colors.elevation.level2
                  : theme.colors.surface,
                paddingBottom: Math.max(insets.bottom + 12, 20),
              },
            ]}
            onPress={e => e.stopPropagation()}>
            <View
              style={[
                styles.actionHandle,
                { backgroundColor: theme.colors.outlineVariant },
              ]}
            />
            {actionMenuLog ? (
              <Text
                style={[
                  styles.actionHeaderText,
                  { color: theme.colors.onSurfaceVariant },
                ]}>
                {formatWaterEntryAmount(actionMenuLog.amount)} • {actionMenuLog.time}
              </Text>
            ) : null}

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                const target = actionMenuLog;
                setActionMenuLog(null);
                if (target) {
                  setEditingEntry(target);
                  setSheetMode('edit');
                  setSheetVisible(true);
                }
              }}
              style={[
                styles.actionOptionRow,
                { backgroundColor: theme.colors.elevation.level1 },
              ]}
              accessibilityRole="button">
              {isOxygenIcons ? (
                <OxygenPencilIcon size={18} color={waterAccent.color} />
              ) : (
                <PencilEditIcon size={18} color={waterAccent.color} />
              )}
              <Text
                style={[
                  styles.actionOptionText,
                  { color: theme.colors.onSurface },
                ]}>
                Edit amount
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                const target = actionMenuLog;
                setActionMenuLog(null);
                if (target) {
                  setConfirmDeleteLog(target);
                }
              }}
              style={[
                styles.actionOptionRow,
                { backgroundColor: theme.colors.errorContainer },
              ]}
              accessibilityRole="button">
              {isOxygenIcons ? (
                <OxygenTrashIcon size={18} color={theme.colors.onErrorContainer} />
              ) : (
                <TrashDeleteIcon size={18} color={theme.colors.onErrorContainer} />
              )}
              <Text
                style={[
                  styles.actionOptionText,
                  { color: theme.colors.onErrorContainer },
                ]}>
                Delete entry
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <Portal>
        <Dialog
          visible={confirmDeleteLog !== null}
          onDismiss={() => setConfirmDeleteLog(null)}>
          <Dialog.Title>Delete entry?</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>
              {confirmDeleteLog
                ? `Remove ${formatWaterEntryAmount(confirmDeleteLog.amount)} logged at ${confirmDeleteLog.time}?`
                : ''}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmDeleteLog(null)}>Cancel</Button>
            <Button textColor={theme.colors.error} onPress={handleConfirmDelete}>
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
  },
  outerScroll: {
    flex: 1,
  },
  fixedViewportContainer: {
    flex: 1,
  },
  headerRow: {
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  screenTitleText: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  screenSubtitleText: {
    fontSize: 13.5,
    fontWeight: '500',
    marginTop: 2,
  },
  sectionCard: {
    marginHorizontal: 20,
    borderRadius: 22,
    padding: 16,
    elevation: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
  },
  intakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  intakeLeftColumn: {
    flex: 1,
  },
  intakeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  intakeBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intakeTitleText: {
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  consumedValueText: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.9,
    lineHeight: 38,
  },
  goalSubtitleText: {
    fontSize: 13.5,
    fontWeight: '500',
    marginTop: 2,
  },
  remainingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    marginTop: 10,
  },
  remainingPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressRingBox: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenterOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  percentValueText: {
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  addHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitleText: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  addedFeedbackPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  addedFeedbackText: {
    fontSize: 12,
    fontWeight: '700',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  presetTileWrapper: {
    flex: 1,
  },
  presetTile: {
    height: 68,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  presetIconBox: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  presetLabel: {
    fontSize: 12.5,
    letterSpacing: -0.2,
  },
  customAmountRow: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customRowLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  customRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customDraftChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  customDraftText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  logCardFlex: {
    flex: 1,
    minHeight: 160,
  },
  logCardExpandedMin: {
    minHeight: 220,
  },
  logHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  totalBadgePill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  totalBadgeText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  logInternalScroll: {
    flex: 1,
  },
  logListContent: {
    paddingTop: 2,
    paddingBottom: 2,
  },
  emptyLogBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  emptyLogTitle: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  emptyLogSubtitle: {
    fontSize: 12.5,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  timelineRowWrapper: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  timelineRailColumn: {
    width: 18,
    alignItems: 'center',
    marginRight: 8,
  },
  timelineRailSegment: {
    flex: 1,
    width: 1.8,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginVertical: 2,
  },
  logEntryCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 58,
    marginVertical: 5,
    gap: 10,
  },
  logEntryIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logEntryTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  logEntryAmount: {
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  logEntryTime: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  moreButton: {
    width: 36,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  actionSheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 10,
  },
  actionHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 4,
  },
  actionHeaderText: {
    fontSize: 13.5,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
  },
  actionOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
  },
  actionOptionText: {
    fontSize: 15,
    fontWeight: '700',
  },
  intakeCardSpacing: {
    marginTop: 6,
  },
  secondaryCardSpacing: {
    marginTop: 10,
  },
  presetTileActive: {
    borderWidth: 1.5,
  },
  presetTileInactive: {
    borderWidth: 1,
  },
  presetLabelActive: {
    fontWeight: '700',
  },
  presetLabelInactive: {
    fontWeight: '600',
  },
  timelineSegmentHidden: {
    opacity: 0,
  },
  timelineSegmentVisible: {
    opacity: 0.42,
  },
  presetTileStandalone: {
    height: 70,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  logEntryRowGrouped: {
    borderWidth: 0,
    marginVertical: 0,
    paddingHorizontal: 4,
    paddingVertical: 11,
    minHeight: 54,
  },
  standaloneSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 8,
  },
  standaloneLogHeaderSpacing: {
    marginTop: 14,
    marginBottom: 8,
  },
  standalonePresetsRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 20,
  },
  customAmountStandaloneCard: {
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  customDraftInlineText: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  groupedLogCardPadding: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
});
