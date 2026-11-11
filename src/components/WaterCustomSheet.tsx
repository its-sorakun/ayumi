/**
 * WaterCustomSheet — Material You bottom sheet editor for custom or edited water intake.
 *
 * Implements custom-quantity water input without distorting main screen layout:
 *  - Animates smoothly from bottom edge using spring entrance and fast cubic dismissal
 *  - Supports L (decimal liters) and ml (whole milliliters) with precision-safe conversion
 *  - Stores/emits integer milliliters exclusively to eliminate floating-point drift
 *  - Validates zero, negative, unreasonable (> 10,000 ml), and fractional-ml inputs explicitly
 *  - Provides quick-draft chips matching active unit without auto-logging before confirmation
 *  - Handles keyboard avoidance safely and respects OS reduced-motion settings
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../theme/motion';
import { useAyumiTheme } from '../themes';
import { CloseXIcon } from './AestheticIcons';

export type WaterInputUnit = 'L' | 'ml';

export const MAX_SINGLE_WATER_ENTRY_ML = 10000;

export interface ParsedWaterInput {
  readonly amountMl: number | null;
  readonly error: string | null;
}

/**
 * Parses a user-entered string in `'L'` or `'ml'` cleanly into integer milliliters.
 * Prevents zero, negative, non-numeric, fractional-ml, and excessive (> 10,000 ml) entries.
 */
export function parseCustomWaterInputToMl(
  rawText: string,
  unit: WaterInputUnit,
): ParsedWaterInput {
  const trimmed = rawText.trim().replace(',', '.');
  if (trimmed.length === 0) {
    return { amountMl: null, error: 'Enter an amount' };
  }

  if (unit === 'ml') {
    if (!/^\d+$/.test(trimmed)) {
      return { amountMl: null, error: 'Enter a whole number in ml' };
    }
    const parsedMl = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsedMl) || parsedMl <= 0) {
      return { amountMl: null, error: 'Amount must be greater than 0 ml' };
    }
    if (parsedMl > MAX_SINGLE_WATER_ENTRY_ML) {
      return {
        amountMl: null,
        error: `Maximum single entry is ${MAX_SINGLE_WATER_ENTRY_ML.toLocaleString()} ml`,
      };
    }
    return { amountMl: parsedMl, error: null };
  }

  // Liter mode accepts up to 3 decimal places cleanly converted via Math.round(liters * 1000)
  if (!/^(?:\d+(?:\.\d{0,3})?|\.\d{1,3})$/.test(trimmed)) {
    return { amountMl: null, error: 'Enter a valid amount in L (e.g. 1.3)' };
  }

  const liters = Number(trimmed);
  if (!Number.isFinite(liters) || liters <= 0) {
    return { amountMl: null, error: 'Amount must be greater than 0 L' };
  }

  const ml = Math.round(liters * 1000);
  if (ml <= 0) {
    return { amountMl: null, error: 'Amount must be at least 1 ml' };
  }
  if (ml > MAX_SINGLE_WATER_ENTRY_ML) {
    return {
      amountMl: null,
      error: `Maximum single entry is ${(MAX_SINGLE_WATER_ENTRY_ML / 1000).toFixed(0)} L`,
    };
  }
  return { amountMl: ml, error: null };
}

/** Formats integer milliliters into editable input string for a given unit. */
export function formatMlForInput(ml: number, unit: WaterInputUnit): string {
  const safeMl = Math.max(Math.round(ml), 0);
  if (unit === 'ml') {
    return String(safeMl);
  }
  return (safeMl / 1000).toFixed(2);
}

/** Formats integer milliliters cleanly for button and chip labels. */
export function formatConfirmWaterLabel(ml: number, unit: WaterInputUnit): string {
  if (unit === 'L') {
    return `${(ml / 1000).toFixed(2)} L`;
  }
  return `${Math.round(ml).toLocaleString()} ml`;
}

const LITER_QUICK_DRAFTS_ML = [1250, 1300, 1500, 2000] as const;
const ML_QUICK_DRAFTS_ML = [150, 350, 600, 850] as const;

interface WaterCustomSheetProps {
  readonly visible: boolean;
  readonly mode?: 'add' | 'edit';
  readonly initialAmountMl: number;
  readonly initialUnit?: WaterInputUnit;
  readonly onDismiss: () => void;
  readonly onConfirm: (amountMl: number, unitUsed: WaterInputUnit) => void;
}

export function WaterCustomSheet({
  visible,
  mode = 'add',
  initialAmountMl,
  initialUnit = 'L',
  onDismiss,
  onConfirm,
}: WaterCustomSheetProps): React.JSX.Element {
  const theme = useTheme();
  const { motion, shapes, metricAccents } = useAyumiTheme();
  const waterAccent = metricAccents.water;
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  const [rendered, setRendered] = useState(visible);
  const [unit, setUnit] = useState<WaterInputUnit>(initialUnit);
  const [inputText, setInputText] = useState(() =>
    formatMlForInput(initialAmountMl, initialUnit),
  );
  const [showError, setShowError] = useState(false);

  const backdropAnim = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(320)).current;

  useEffect(() => {
    if (visible) {
      setUnit(initialUnit);
      setInputText(formatMlForInput(initialAmountMl, initialUnit));
      setShowError(false);
      setRendered(true);

      if (reducedMotion) {
        backdropAnim.setValue(1);
        sheetTranslateY.setValue(0);
        return;
      }

      backdropAnim.setValue(0);
      sheetTranslateY.setValue(280);
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          ...motion.spring.pager,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    if (!rendered) return;

    if (reducedMotion) {
      backdropAnim.setValue(0);
      sheetTranslateY.setValue(280);
      setRendered(false);
      return;
    }

    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 180,
        easing: motion.easing.accelerate,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 300,
        duration: 200,
        easing: motion.easing.accelerate,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setRendered(false);
      }
    });
  }, [
    visible,
    rendered,
    initialAmountMl,
    initialUnit,
    reducedMotion,
    backdropAnim,
    sheetTranslateY,
    motion,
  ]);

  if (!rendered) {
    return <></>;
  }

  const parsed = parseCustomWaterInputToMl(inputText, unit);
  const quickDrafts = unit === 'L' ? LITER_QUICK_DRAFTS_ML : ML_QUICK_DRAFTS_ML;

  const handleSwitchUnit = (nextUnit: WaterInputUnit) => {
    if (nextUnit === unit) return;
    if (parsed.amountMl !== null) {
      setInputText(formatMlForInput(parsed.amountMl, nextUnit));
      setShowError(false);
    } else if (inputText.trim().length > 0) {
      // Clear unparseable partial draft cleanly instead of carrying invalid decimals into ml mode
      setInputText('');
      setShowError(false);
    }
    setUnit(nextUnit);
  };

  const handleConfirm = () => {
    if (parsed.amountMl === null) {
      setShowError(true);
      return;
    }
    onConfirm(parsed.amountMl, unit);
  };

  const confirmVerb = mode === 'edit' ? 'Save' : 'Add';
  const confirmText =
    parsed.amountMl !== null
      ? `${confirmVerb} ${formatConfirmWaterLabel(parsed.amountMl, unit)}`
      : `${confirmVerb} Water`;

  return (
    <Modal
      visible={rendered}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}>
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                backgroundColor: theme.colors.backdrop,
                opacity: backdropAnim,
              },
            ]}
          />
        </Pressable>

        <Animated.View
          style={[
            styles.sheetContainer,
            theme.dark && styles.sheetDarkBorder,
            {
              borderTopLeftRadius: shapes.bottomSheetRadius,
              borderTopRightRadius: shapes.bottomSheetRadius,
              backgroundColor: theme.dark
                ? theme.colors.elevation.level2
                : theme.colors.surface,
              borderColor: theme.colors.outlineVariant,
              paddingBottom: Math.max(insets.bottom + 14, 24),
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}>
          {/* Drag Handle */}
          <View
            style={[
              styles.dragHandle,
              { backgroundColor: theme.colors.outlineVariant },
            ]}
          />

          {/* Header Row */}
          <View style={styles.headerRow}>
            <Text style={[styles.sheetTitle, { color: theme.colors.onSurface }]}>
              {mode === 'edit' ? 'Edit Amount' : 'Custom Amount'}
            </Text>
            <TouchableOpacity
              onPress={onDismiss}
              style={[
                styles.closeButton,
                { backgroundColor: theme.colors.elevation.level1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Close custom amount editor">
              <CloseXIcon size={18} color={theme.colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          {/* Numeric Input Pill & L / ml Segmented Unit Switcher */}
          <View style={styles.inputRow}>
            <View
              style={[
                styles.inputBox,
                {
                  backgroundColor: theme.colors.elevation.level1,
                  borderColor:
                    showError && parsed.error
                      ? theme.colors.error
                      : theme.colors.outlineVariant,
                },
              ]}>
              <RNTextInput
                value={inputText}
                onChangeText={val => {
                  setInputText(val);
                  if (showError) setShowError(false);
                }}
                keyboardType={unit === 'L' ? 'decimal-pad' : 'number-pad'}
                placeholder={unit === 'L' ? '1.30' : '500'}
                placeholderTextColor={theme.colors.outline}
                selectTextOnFocus
                returnKeyType="done"
                onSubmitEditing={handleConfirm}
                maxLength={7}
                style={[styles.numericInput, { color: theme.colors.onSurface }]}
                accessibilityLabel={`Water amount in ${unit}`}
              />
            </View>

            <View
              style={[
                styles.unitToggleTrack,
                { backgroundColor: theme.colors.elevation.level1 },
              ]}>
              {(['L', 'ml'] as const).map(option => {
                const isSelected = unit === option;
                return (
                  <TouchableOpacity
                    key={option}
                    activeOpacity={0.8}
                    onPress={() => handleSwitchUnit(option)}
                    style={[
                      styles.unitOptionPill,
                      isSelected && {
                        backgroundColor: waterAccent.color,
                      },
                    ]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isSelected }}>
                    <Text
                      style={[
                        styles.unitOptionText,
                        {
                          color: isSelected
                            ? waterAccent.onColor
                            : theme.colors.onSurfaceVariant,
                        },
                      ]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Inline Validation Message */}
          {showError && parsed.error ? (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {parsed.error}
            </Text>
          ) : null}

          {/* Confirm Action Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleConfirm}
            style={[
              styles.confirmButton,
              {
                borderRadius: shapes.buttonPillRadius,
                backgroundColor:
                  parsed.amountMl !== null
                    ? waterAccent.color
                    : theme.colors.surfaceDisabled,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={confirmText}>
            <Text
              style={[
                styles.confirmButtonText,
                {
                  color:
                    parsed.amountMl !== null
                      ? waterAccent.onColor
                      : theme.colors.onSurfaceDisabled,
                },
              ]}>
              {confirmText}
            </Text>
          </TouchableOpacity>

          {/* Contextual Draft Preset Chips */}
          <View style={styles.draftChipsRow}>
            {quickDrafts.map(draftMl => {
              const isSelected = parsed.amountMl === draftMl;
              return (
                <TouchableOpacity
                  key={draftMl}
                  activeOpacity={0.78}
                  onPress={() => {
                    setInputText(formatMlForInput(draftMl, unit));
                    setShowError(false);
                  }}
                  style={[
                    styles.draftChip,
                    {
                      borderRadius: shapes.chipRadius,
                      backgroundColor: isSelected
                        ? waterAccent.container
                        : theme.colors.elevation.level1,
                      borderColor: isSelected
                        ? waterAccent.color
                        : theme.colors.outlineVariant,
                    },
                  ]}
                  accessibilityRole="button">
                  <Text
                    style={[
                      styles.draftChipText,
                      {
                        color: isSelected
                          ? waterAccent.onContainer
                          : theme.colors.onSurfaceVariant,
                      },
                    ]}>
                    {formatConfirmWaterLabel(draftMl, unit)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    elevation: 8,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
  },
  sheetDarkBorder: {
    borderWidth: 1,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputBox: {
    flex: 1,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  numericInput: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    padding: 0,
  },
  unitToggleTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: 27,
    height: 54,
    gap: 4,
  },
  unitOptionPill: {
    paddingHorizontal: 16,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitOptionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 8,
    marginLeft: 4,
  },
  confirmButton: {
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  confirmButtonText: {
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  draftChipsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 14,
  },
  draftChip: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftChipText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
});
