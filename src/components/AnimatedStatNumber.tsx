/**
 * AnimatedStatNumber — synchronized numerical interpolation text component.
 *
 * Implements smooth count interpolation for headline totals and summary metric cards:
 *  - Animates within the active unit scale (km/m, L/ml, steps) without mixing incompatible units
 *  - Starts cleanly from 0 when switching metrics or unit scales, matching chart baseline reveal
 *  - Interruptibly interpolates from live mid-animation values during rapid date/period switches
 *  - Deduplicates listener updates to minimize unnecessary React renders
 *  - Bypasses interpolation cleanly when OS reduced-motion is enabled
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Text as RNText,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { MotionTokens, useReducedMotion } from '../theme/motion';

export type StatNumberScaleUnit = 'raw' | 'kilo';

interface AnimatedStatNumberProps {
  readonly value: number | null;
  readonly fallbackText: string;
  readonly unitKey: string;
  readonly scaleUnit: StatNumberScaleUnit;
  readonly syncKey?: string;
  readonly duration?: number;
  readonly style?: StyleProp<TextStyle>;
  readonly numberOfLines?: number;
  readonly adjustsFontSizeToFit?: boolean;
}

/**
 * Formats an intermediate or final statistic value inside a fixed target unit scale.
 * During active mid-roll on small integer kilo values (e.g. 2 L), shows 1 decimal for fluidity
 * before snapping onto exact precision upon completion.
 */
export function formatInterpolatedStatValue(
  raw: number,
  scaleUnit: StatNumberScaleUnit,
  targetValue: number,
  isSettled: boolean,
): string {
  const safeRaw = Math.max(raw, 0);
  if (scaleUnit === 'kilo') {
    const finalScaled = Number((Math.max(targetValue, 0) / 1000).toFixed(2));
    if (isSettled) {
      return finalScaled.toLocaleString();
    }
    const targetDecimals = (String(finalScaled).split('.')[1] || '').length;
    const rollDecimals = Math.max(targetDecimals, 1);
    const currentScaled = Number((safeRaw / 1000).toFixed(rollDecimals));
    return currentScaled.toLocaleString(undefined, {
      minimumFractionDigits: rollDecimals,
      maximumFractionDigits: rollDecimals,
    });
  }
  return Math.round(safeRaw).toLocaleString();
}

export function AnimatedStatNumber({
  value,
  fallbackText,
  unitKey,
  scaleUnit,
  syncKey = '',
  duration = MotionTokens.chartReveal.week.duration,
  style,
  numberOfLines = 1,
  adjustsFontSizeToFit = false,
}: AnimatedStatNumberProps): React.JSX.Element {
  const reducedMotion = useReducedMotion();

  const initialText =
    value === null
      ? fallbackText
      : formatInterpolatedStatValue(value, scaleUnit, value, true);

  const [displayText, setDisplayText] = useState<string>(initialText);
  const animRef = useRef(new Animated.Value(value ?? 0));
  const currentNumericRef = useRef<number>(value ?? 0);
  const prevUnitKeyRef = useRef<string>(unitKey);
  const prevSyncKeyRef = useRef<string>('');
  const lastRenderedTextRef = useRef<string>(initialText);

  useEffect(() => {
    const anim = animRef.current;

    if (value === null) {
      anim.stopAnimation();
      currentNumericRef.current = 0;
      lastRenderedTextRef.current = fallbackText;
      setDisplayText(fallbackText);
      return;
    }

    if (reducedMotion) {
      anim.stopAnimation();
      anim.setValue(value);
      currentNumericRef.current = value;
      const settled = formatInterpolatedStatValue(value, scaleUnit, value, true);
      lastRenderedTextRef.current = settled;
      setDisplayText(settled);
      prevUnitKeyRef.current = unitKey;
      prevSyncKeyRef.current = syncKey;
      return;
    }

    const unitChanged = prevUnitKeyRef.current !== unitKey;
    const isInitialCommit = prevSyncKeyRef.current === '';
    const startFrom = unitChanged || isInitialCommit ? 0 : currentNumericRef.current;

    prevUnitKeyRef.current = unitKey;
    prevSyncKeyRef.current = syncKey;

    if (Math.abs(startFrom - value) < 0.001) {
      const settled = formatInterpolatedStatValue(value, scaleUnit, value, true);
      currentNumericRef.current = value;
      if (settled !== lastRenderedTextRef.current) {
        lastRenderedTextRef.current = settled;
        setDisplayText(settled);
      }
      return;
    }

    anim.stopAnimation();
    anim.setValue(startFrom);
    currentNumericRef.current = startFrom;

    const initialRoll = formatInterpolatedStatValue(startFrom, scaleUnit, value, false);
    lastRenderedTextRef.current = initialRoll;
    setDisplayText(initialRoll);

    const listenerId = anim.addListener(({ value: v }) => {
      currentNumericRef.current = v;
      const formatted = formatInterpolatedStatValue(v, scaleUnit, value, false);
      if (formatted !== lastRenderedTextRef.current) {
        lastRenderedTextRef.current = formatted;
        setDisplayText(formatted);
      }
    });

    const animation = Animated.timing(anim, {
      toValue: value,
      duration,
      easing: MotionTokens.easing.dataReveal,
      useNativeDriver: false,
    });

    animation.start(({ finished }) => {
      if (finished) {
        currentNumericRef.current = value;
        const finalText = formatInterpolatedStatValue(value, scaleUnit, value, true);
        lastRenderedTextRef.current = finalText;
        setDisplayText(finalText);
      }
    });

    return () => {
      anim.removeListener(listenerId);
      animation.stop();
    };
  }, [value, fallbackText, unitKey, scaleUnit, syncKey, duration, reducedMotion]);

  return (
    <RNText
      style={style}
      numberOfLines={numberOfLines}
      adjustsFontSizeToFit={adjustsFontSizeToFit}>
      {displayText}
    </RNText>
  );
}

