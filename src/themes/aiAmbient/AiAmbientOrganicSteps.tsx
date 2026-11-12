/**
 * Signature AI Ambient organic Steps progress centerpiece.
 *
 * Implements an asymmetric multi-layered organic contour via closed Fourier polar
 * harmonics (`r(theta) = R * (1 + sum(a_k cos(k*theta + phi_k)))`) with exact
 * Euclidean arc-length sampling so the chunky rounded-cap gradient progress stroke
 * follows the irregular organic perimeter directly rather than wrapping a circle
 * inside a decorative blob.
 */

import React, { useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import type { AiAmbientPaletteTokens } from './ambientPalette';

export interface OrganicContourGeometry {
  readonly auraPath: string;
  readonly secondaryAuraPath: string;
  readonly bodyPath: string;
  readonly trackPath: string;
  readonly trackLength: number;
}

interface HarmonicTerm {
  readonly order: number;
  readonly amp: number;
  readonly phase: number;
}

const MAIN_HARMONICS: readonly HarmonicTerm[] = [
  { order: 2, amp: 0.036, phase: -0.55 },
  { order: 3, amp: 0.028, phase: 0.72 },
  { order: 4, amp: 0.016, phase: -1.1 },
];

const OUTER_AURA_HARMONICS: readonly HarmonicTerm[] = [
  { order: 2, amp: 0.056, phase: -1.25 },
  { order: 3, amp: 0.044, phase: 1.55 },
  { order: 5, amp: 0.022, phase: 0.35 },
];

const SECONDARY_AURA_HARMONICS: readonly HarmonicTerm[] = [
  { order: 2, amp: 0.052, phase: 0.85 },
  { order: 3, amp: 0.038, phase: -0.65 },
  { order: 4, amp: 0.024, phase: 1.3 },
];

function sampleClosedOrganicPath(
  cx: number,
  cy: number,
  baseRadius: number,
  harmonics: readonly HarmonicTerm[],
  samples: number = 192,
  offsetX: number = 0,
  offsetY: number = 0,
): { readonly path: string; readonly length: number } {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < samples; i += 1) {
    // Clockwise starting at 12 o'clock top (`-PI/2`).
    const theta = -Math.PI / 2 + (2 * Math.PI * i) / samples;
    let mod = 1;
    for (const term of harmonics) {
      mod += term.amp * Math.cos(term.order * theta + term.phase);
    }
    const r = baseRadius * mod;
    pts.push([cx + offsetX + r * Math.cos(theta), cy + offsetY + r * Math.sin(theta)]);
  }

  let length = 0;
  let path = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 1; i < pts.length; i += 1) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    length += Math.hypot(dx, dy);
    path += ` L ${pts[i][0].toFixed(2)} ${pts[i][1].toFixed(2)}`;
  }
  const closeDx = pts[0][0] - pts[pts.length - 1][0];
  const closeDy = pts[0][1] - pts[pts.length - 1][1];
  length += Math.hypot(closeDx, closeDy);
  path += ' Z';

  return { path, length };
}

/** Builds synchronized aura, frosted body, and exact arc-length track contours. */
export function buildOrganicStepsContour(size: number): OrganicContourGeometry {
  const center = size / 2;
  const bodyRadius = size * 0.405;
  const trackRadius = size * 0.376;

  const aura = sampleClosedOrganicPath(
    center,
    center,
    bodyRadius * 1.09,
    OUTER_AURA_HARMONICS,
    180,
    -size * 0.018,
    size * 0.01,
  );
  const secondaryAura = sampleClosedOrganicPath(
    center,
    center,
    bodyRadius * 1.055,
    SECONDARY_AURA_HARMONICS,
    180,
    size * 0.012,
    size * 0.015,
  );
  const body = sampleClosedOrganicPath(center, center, bodyRadius * 1.03, MAIN_HARMONICS, 192);
  const track = sampleClosedOrganicPath(center, center, trackRadius, MAIN_HARMONICS, 240);

  return {
    auraPath: aura.path,
    secondaryAuraPath: secondaryAura.path,
    bodyPath: body.path,
    trackPath: track.path,
    trackLength: track.length,
  };
}

/** Clamps step progress cleanly into `[0, 1]` and converts to organic dash length. */
export function computeOrganicStepsProgress(
  steps: number,
  goal: number,
  trackLength: number,
): {
  readonly ratio: number;
  readonly percent: number;
  readonly dashArray: [number, number];
} {
  const ratio = goal > 0 ? Math.min(Math.max(steps / goal, 0), 1) : 0;
  const percent = Math.round(ratio * 100);
  const minVisibleArc = ratio > 0 ? Math.min(trackLength, Math.max(8, ratio * trackLength)) : 0;
  return {
    ratio,
    percent,
    dashArray: [minVisibleArc, Math.max(trackLength + 12, 12)],
  };
}

function FootstepsCenterGlyph({ color, size = 24 }: { readonly color: string; readonly size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Path
        d="M10.1 5.2C11.6 5.2 12.6 6.8 12.4 9.1C12.2 11.1 11.4 12.6 10.1 12.6C8.7 12.6 7.8 11.2 7.8 9.0C7.8 6.8 8.7 5.2 10.1 5.2ZM9.9 14.3C11.2 14.3 12.0 15.1 12.0 16.3C12.0 17.6 11.1 18.6 9.8 18.6C8.6 18.6 7.8 17.7 7.8 16.4C7.8 15.1 8.6 14.3 9.9 14.3Z"
        fill={color}
      />
      <Path
        d="M17.8 9.2C19.3 9.2 20.3 10.8 20.1 13.1C19.9 15.1 19.1 16.6 17.8 16.6C16.4 16.6 15.5 15.2 15.5 13.0C15.5 10.8 16.4 9.2 17.8 9.2ZM17.6 18.3C18.9 18.3 19.7 19.1 19.7 20.3C19.7 21.6 18.8 22.6 17.5 22.6C16.3 22.6 15.5 21.7 15.5 20.4C15.5 19.1 16.3 18.3 17.6 18.3Z"
        fill={color}
        fillOpacity={0.85}
      />
    </Svg>
  );
}

interface AiAmbientOrganicStepsProps {
  readonly steps: number;
  readonly goal: number;
  readonly size: number;
  readonly palette: AiAmbientPaletteTokens;
  readonly onPress?: () => void;
}

export function AiAmbientOrganicSteps({
  steps,
  goal,
  size,
  palette,
  onPress,
}: AiAmbientOrganicStepsProps): React.JSX.Element {
  const contour = useMemo(() => buildOrganicStepsContour(size), [size]);
  const progress = useMemo(
    () => computeOrganicStepsProgress(steps, goal, contour.trackLength),
    [steps, goal, contour.trackLength],
  );
  const strokeWidth = Math.max(12, Math.round(size * 0.068));

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      testID="ai-ambient-organic-steps"
      accessibilityRole="button"
      accessibilityLabel={`Steps today: ${steps.toLocaleString()} out of ${goal.toLocaleString()}`}
      style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id="aiAmbientStepArc" x1="12%" y1="88%" x2="88%" y2="12%">
            <Stop offset="0%" stopColor={palette.stepArcStart} />
            <Stop offset="100%" stopColor={palette.stepArcEnd} />
          </LinearGradient>
        </Defs>

        {/* Outer translucent multi-layer organic bloom aura */}
        <Path d={contour.auraPath} fill={palette.stepBlobAuraFill} />
        <Path
          d={contour.secondaryAuraPath}
          fill={palette.stepBlobAuraFill}
          fillOpacity={0.72}
        />

        {/* Main frosted organic pebble container with subtle glass border */}
        <Path
          d={contour.bodyPath}
          fill={palette.stepBlobBodyFill}
          stroke={palette.glassBorder}
          strokeWidth={1.25}
        />

        {/* Recessed organic track contour */}
        <Path
          d={contour.trackPath}
          fill="none"
          stroke={palette.stepBlobTrackColor}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />

        {/* Soft glow aura along the filled organic progress segment */}
        {progress.ratio > 0 && (
          <Path
            d={contour.trackPath}
            fill="none"
            stroke={palette.stepArcEnd}
            strokeOpacity={0.2}
            strokeWidth={strokeWidth + 6}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={progress.dashArray}
          />
        )}

        {/* Chunky rounded-cap gradient stroke tracing the organic contour path itself */}
        {progress.ratio > 0 && (
          <Path
            testID="ai-ambient-organic-progress-path"
            d={contour.trackPath}
            fill="none"
            stroke="url(#aiAmbientStepArc)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={progress.dashArray}
          />
        )}
      </Svg>

      <View style={styles.centerOverlay} pointerEvents="none">
        <FootstepsCenterGlyph color={palette.primary} size={23} />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[
            styles.stepsNumber,
            {
              color: palette.inkPrimary,
              fontSize: Math.round(size * 0.175),
            },
          ]}>
          {steps.toLocaleString()}
        </Text>
        <Text
          numberOfLines={1}
          style={[
            styles.stepsGoal,
            {
              color: palette.inkSecondary,
              fontSize: Math.max(11, Math.round(size * 0.058)),
            },
          ]}>
          of {goal.toLocaleString()} steps
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: '20%',
  },
  stepsNumber: {
    fontWeight: '800',
    letterSpacing: -0.9,
    fontVariant: ['tabular-nums'],
    marginTop: 4,
  },
  stepsGoal: {
    fontWeight: '500',
    marginTop: 2,
  },
});
