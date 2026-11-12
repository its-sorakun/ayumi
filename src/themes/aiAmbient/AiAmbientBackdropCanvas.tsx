/**
 * Full-screen atmospheric scenery backdrop for AI Ambient:
 *  - Renders locally cached Gemini anime illustration seamlessly across the viewport
 *  - Performs smooth dual-layer GPU opacity crossfades when new artwork arrives
 *  - Never leaves the background blank while loading or waiting for API keys: provides a
 *    layered palette-derived scenic gradient with delicate silhouette atmosphere
 *  - Supports `'home'` (clear upper illustration melting into lower translucent haze) and
 *    `'subdued'` (frosted washed ambiance for Stats, Water Logger, and Settings)
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';

import { useReducedMotion } from '../../theme/motion';
import { useAiAmbient } from './AiAmbientContext';

interface AiAmbientBackdropCanvasProps {
  readonly variant?: 'home' | 'subdued';
  readonly testID?: string;
}

export function AiAmbientBackdropCanvas({
  variant = 'home',
  testID = 'ai-ambient-backdrop',
}: AiAmbientBackdropCanvasProps): React.JSX.Element {
  const { artwork, ambientPalette } = useAiAmbient();
  const reducedMotion = useReducedMotion();

  const currentUri = artwork?.uri ?? null;
  const [underlayUri, setUnderlayUri] = useState<string | null>(currentUri);
  const [activeUri, setActiveUri] = useState<string | null>(currentUri);
  const activeOpacity = useRef(new Animated.Value(currentUri ? 1 : 0)).current;

  useEffect(() => {
    if (!currentUri) {
      setUnderlayUri(null);
      setActiveUri(null);
      activeOpacity.setValue(0);
      return;
    }
    if (currentUri === activeUri) return;

    setUnderlayUri(activeUri);
    setActiveUri(currentUri);
    activeOpacity.setValue(reducedMotion ? 1 : 0);
  }, [currentUri, activeUri, reducedMotion, activeOpacity]);

  const handleActiveImageLoadEnd = () => {
    if (!activeUri) return;
    if (reducedMotion) {
      activeOpacity.setValue(1);
      setUnderlayUri(activeUri);
      return;
    }
    Animated.timing(activeOpacity, {
      toValue: 1,
      duration: 620,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setUnderlayUri(activeUri);
      }
    });
  };

  const isSubdued = variant === 'subdued';
  const [grad0, grad1, grad2] = ambientPalette.fallbackGradient;

  return (
    <View testID={testID} style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Base solid + serene palette-driven scenic gradient fallback */}
      <LinearGradient
        colors={[grad0, grad1, grad2]}
        locations={[0, 0.48, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Subtle atmospheric vector hills & sunlit glow when no generated artwork is cached */}
      {!activeUri && !underlayUri && (
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 390 844"
          preserveAspectRatio="xMidYMid slice"
          style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgGradient id="fallbackHillBack" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={ambientPalette.secondary} stopOpacity={0.34} />
              <Stop offset="100%" stopColor={ambientPalette.canvasBg} stopOpacity={0.05} />
            </SvgGradient>
            <SvgGradient id="fallbackHillFront" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={ambientPalette.primary} stopOpacity={0.28} />
              <Stop offset="100%" stopColor={ambientPalette.canvasBg} stopOpacity={0.08} />
            </SvgGradient>
          </Defs>
          <Circle
            cx={295}
            cy={155}
            r={82}
            fill={ambientPalette.highlight}
            fillOpacity={ambientPalette.isDark ? 0.24 : 0.42}
          />
          <Circle
            cx={295}
            cy={155}
            r={42}
            fill="#FFFFFF"
            fillOpacity={ambientPalette.isDark ? 0.2 : 0.45}
          />
          <Path
            d="M0 365 Q95 315 198 345 T390 322 L390 540 L0 540 Z"
            fill="url(#fallbackHillBack)"
          />
          <Path
            d="M0 404 Q118 360 232 396 T390 374 L390 580 L0 580 Z"
            fill="url(#fallbackHillFront)"
          />
        </Svg>
      )}

      {/* Prior artwork remains visible underneath until replacement image finishes fading in */}
      {underlayUri != null && underlayUri !== activeUri && (
        <Image
          source={{ uri: underlayUri }}
          resizeMode="cover"
          blurRadius={isSubdued ? 16 : 0}
          style={[StyleSheet.absoluteFill, { opacity: isSubdued ? 0.34 : 1 }]}
        />
      )}

      {/* Current cached Gemini anime scenery */}
      {activeUri != null && (
        <Animated.Image
          testID={`${testID}-image`}
          source={{ uri: activeUri }}
          resizeMode="cover"
          blurRadius={isSubdued ? 16 : 0}
          onLoadEnd={handleActiveImageLoadEnd}
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: isSubdued
                ? Animated.multiply(activeOpacity, 0.34)
                : activeOpacity,
            },
          ]}
        />
      )}

      {isSubdued ? (
        <LinearGradient
          colors={[
            ambientPalette.canvasMistBottom,
            ambientPalette.glassSubduedFill,
            ambientPalette.canvasMistBottom,
          ]}
          locations={[0, 0.48, 1]}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <>
          {/* Upper-left gentle scrim preserving crisp white greeting & quote readability */}
          <LinearGradient
            colors={[ambientPalette.headerScrimTop, ambientPalette.headerScrimMid, 'transparent']}
            locations={[0, 0.22, 0.45]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.7, y: 0.52 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Lower atmospheric haze dissolving artwork gently behind Steps Hero, metric stack, and Water card */}
          <LinearGradient
            colors={[
              'transparent',
              ambientPalette.canvasMistTop,
              ambientPalette.canvasMistBottom,
              ambientPalette.canvasMistBottom,
            ]}
            locations={[0.31, 0.46, 0.67, 1]}
            style={StyleSheet.absoluteFill}
          />
        </>
      )}
    </View>
  );
}

