/**
 * Dynamic multi-layered vector + native-GPU animated scenery backdrop for Ambient Scenery.
 * Combines 7 time-of-day skies, 8 weather atmospheric layers, optional 5-season flora/peaks
 * (including monsoon lush-green summer rain), freshly randomized night starfields, and
 * occasional shooting stars while honoring system Reduced Motion preferences.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { useReducedMotion } from '../../theme/motion';
import { useAiAmbient } from './AiAmbientContext';
import { isRainyWeatherCategory } from './config';

interface AiAmbientBackdropCanvasProps {
  readonly variant?: 'home' | 'subpage' | 'subdued';
  readonly testID?: string;
}

interface StarPoint {
  readonly id: number;
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  readonly opacity: number;
  readonly group: 0 | 1;
}

interface PrecipitationStreak {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly len: number;
  readonly opacity: number;
}

interface FloatingParticle {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly drift: number;
  readonly opacity: number;
}

function generateRandomStars(count: number): readonly StarPoint[] {
  const stars: StarPoint[] = [];
  for (let i = 0; i < count; i += 1) {
    stars.push({
      id: i,
      cx: Math.round((4 + Math.random() * 92) * 10) / 10,
      cy: Math.round((3 + Math.random() * 44) * 10) / 10,
      r: Math.round((0.35 + Math.random() * 0.95) * 100) / 100,
      opacity: Math.round((0.35 + Math.random() * 0.65) * 100) / 100,
      group: i % 2 === 0 ? 0 : 1,
    });
  }
  return stars;
}

const RAIN_STREAKS: readonly PrecipitationStreak[] = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  x: (i * 19 + 7) % 100,
  y: ((i * 31 + 11) % 85) - 10,
  len: 4.5 + (i % 4) * 1.8,
  opacity: 0.25 + (i % 3) * 0.14,
}));

const DRIZZLE_STREAKS: readonly PrecipitationStreak[] = RAIN_STREAKS.slice(0, 11);

const SNOW_PARTICLES: readonly FloatingParticle[] = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  x: (i * 23 + 5) % 98,
  y: (i * 29 + 9) % 88,
  size: 0.65 + (i % 4) * 0.35,
  drift: (i % 2 === 0 ? 1 : -1) * (2 + (i % 3)),
  opacity: 0.48 + (i % 3) * 0.18,
}));

const DRIFTING_PETALS_OR_LEAVES: readonly FloatingParticle[] = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  x: (i * 21 + 8) % 95,
  y: (i * 17 + 6) % 62,
  size: 1.0 + (i % 3) * 0.45,
  drift: i % 2 === 0 ? 4.5 : -2.5,
  opacity: 0.65 + (i % 2) * 0.2,
}));

export function AiAmbientBackdropCanvas({
  variant = 'home',
  testID = 'ai-ambient-backdrop-canvas',
}: AiAmbientBackdropCanvasProps): React.JSX.Element {
  const {
    ambientPalette,
    sceneryPalette,
    effectiveTimePhase,
    effectiveWeatherCategory,
    effectiveSeason,
    prefs,
  } = useAiAmbient();
  const reducedMotion = useReducedMotion();

  const isStarrySky = sceneryPalette.starDensity > 0;
  const isHome = variant === 'home';

  // Regenerate fresh randomized starfield coordinates whenever a starry night phase spawns.
  const [stars, setStars] = useState<readonly StarPoint[]>(() =>
    isStarrySky
      ? generateRandomStars(Math.max(12, Math.round(52 * sceneryPalette.starDensity)))
      : [],
  );
  const wasStarryRef = useRef(isStarrySky);

  useEffect(() => {
    if (!isStarrySky) {
      wasStarryRef.current = false;
      setStars([]);
      return;
    }
    const targetCount = Math.max(12, Math.round(52 * sceneryPalette.starDensity));
    if (!wasStarryRef.current || stars.length !== targetCount) {
      setStars(generateRandomStars(targetCount));
      wasStarryRef.current = true;
    }
  }, [isStarrySky, sceneryPalette.starDensity, stars.length]);

  const twinkleAnim = useRef(new Animated.Value(0)).current;
  const precipAnim = useRef(new Animated.Value(0)).current;
  const cloudDriftAnim = useRef(new Animated.Value(0)).current;
  const petalFloatAnim = useRef(new Animated.Value(0)).current;
  const lightningOpacity = useRef(new Animated.Value(0)).current;

  // Shooting star state & GPU coordinates
  const shootingProgress = useRef(new Animated.Value(0)).current;
  const [shootingSpec, setShootingSpec] = useState({
    startX: 68,
    startY: 16,
    visible: false,
  });

  // Twinkle + drifting clouds + precipitation + seasonal petals loops
  useEffect(() => {
    if (reducedMotion || !isHome) {
      twinkleAnim.setValue(0.5);
      precipAnim.setValue(0);
      cloudDriftAnim.setValue(0);
      petalFloatAnim.setValue(0);
      lightningOpacity.setValue(0);
      return;
    }

    const loops: Animated.CompositeAnimation[] = [];

    if (isStarrySky) {
      const twinkleLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(twinkleAnim, {
            toValue: 1,
            duration: 2400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(twinkleAnim, {
            toValue: 0,
            duration: 2400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
      twinkleLoop.start();
      loops.push(twinkleLoop);
    }

    if (
      effectiveWeatherCategory === 'rain' ||
      effectiveWeatherCategory === 'drizzle' ||
      effectiveWeatherCategory === 'thunderstorm' ||
      effectiveWeatherCategory === 'snow'
    ) {
      const speedMs = effectiveWeatherCategory === 'snow' ? 3800 : 1200;
      const precipLoop = Animated.loop(
        Animated.timing(precipAnim, {
          toValue: 1,
          duration: speedMs,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      precipLoop.start();
      loops.push(precipLoop);
    }

    if (
      effectiveWeatherCategory === 'few_clouds' ||
      effectiveWeatherCategory === 'cloudy' ||
      effectiveWeatherCategory === 'thunderstorm'
    ) {
      const cloudLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(cloudDriftAnim, {
            toValue: 1,
            duration: 9500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(cloudDriftAnim, {
            toValue: 0,
            duration: 9500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
      cloudLoop.start();
      loops.push(cloudLoop);
    }

    if (
      prefs.seasonalEnabled &&
      (effectiveSeason === 'spring' ||
        effectiveSeason === 'early_spring' ||
        effectiveSeason === 'autumn_transition')
    ) {
      const floatLoop = Animated.loop(
        Animated.timing(petalFloatAnim, {
          toValue: 1,
          duration: 5200,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      floatLoop.start();
      loops.push(floatLoop);
    }

    if (effectiveWeatherCategory === 'thunderstorm') {
      const flashLoop = Animated.loop(
        Animated.sequence([
          Animated.delay(4600),
          Animated.timing(lightningOpacity, {
            toValue: 0.28,
            duration: 90,
            useNativeDriver: true,
          }),
          Animated.timing(lightningOpacity, {
            toValue: 0,
            duration: 140,
            useNativeDriver: true,
          }),
          Animated.timing(lightningOpacity, {
            toValue: 0.18,
            duration: 70,
            useNativeDriver: true,
          }),
          Animated.timing(lightningOpacity, {
            toValue: 0,
            duration: 380,
            useNativeDriver: true,
          }),
        ]),
      );
      flashLoop.start();
      loops.push(flashLoop);
    }

    return () => {
      loops.forEach(loop => loop.stop());
    };
  }, [
    cloudDriftAnim,
    effectiveSeason,
    effectiveWeatherCategory,
    isHome,
    isStarrySky,
    lightningOpacity,
    petalFloatAnim,
    precipAnim,
    prefs.seasonalEnabled,
    reducedMotion,
    twinkleAnim,
  ]);

  // Occasional shooting star launcher during dark skies (dusk, night, midnight).
  useEffect(() => {
    if (!isHome || !sceneryPalette.showShootingStars || reducedMotion) {
      setShootingSpec(prev => ({ ...prev, visible: false }));
      return;
    }

    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let activeAnim: Animated.CompositeAnimation | null = null;

    const scheduleNextMeteor = (initialDelay: boolean) => {
      const waitMs = initialDelay
        ? 1800 + Math.round(Math.random() * 2200)
        : 6500 + Math.round(Math.random() * 7500);

      timerId = setTimeout(() => {
        if (cancelled) return;
        const startX = 48 + Math.round(Math.random() * 38);
        const startY = 8 + Math.round(Math.random() * 20);
        setShootingSpec({ startX, startY, visible: true });
        shootingProgress.setValue(0);

        activeAnim = Animated.timing(shootingProgress, {
          toValue: 1,
          duration: 1050,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        });
        activeAnim.start(({ finished }) => {
          if (cancelled || !finished) return;
          setShootingSpec(prev => ({ ...prev, visible: false }));
          scheduleNextMeteor(false);
        });
      }, waitMs);
    };

    scheduleNextMeteor(true);

    return () => {
      cancelled = true;
      if (timerId != null) clearTimeout(timerId);
      activeAnim?.stop();
    };
  }, [isHome, reducedMotion, sceneryPalette.showShootingStars, shootingProgress]);

  // Celestial orb coordinates by time phase
  const celestialPos = useMemo(() => {
    switch (effectiveTimePhase) {
      case 'dawn':
        return { cx: 68, cy: 52, r: 11, isMoon: false };
      case 'morning':
        return { cx: 74, cy: 31, r: 9.5, isMoon: false };
      case 'afternoon':
        return { cx: 70, cy: 20, r: 9, isMoon: false };
      case 'evening':
        return { cx: 64, cy: 48, r: 12.5, isMoon: false };
      case 'dusk':
        return { cx: 76, cy: 22, r: 7.2, isMoon: true };
      case 'night':
        return { cx: 75, cy: 19, r: 7.6, isMoon: true };
      case 'midnight':
        return { cx: 52, cy: 16, r: 8.0, isMoon: true };
    }
  }, [effectiveTimePhase]);

  const showClouds =
    effectiveWeatherCategory === 'few_clouds' ||
    effectiveWeatherCategory === 'cloudy' ||
    effectiveWeatherCategory === 'drizzle' ||
    effectiveWeatherCategory === 'rain' ||
    effectiveWeatherCategory === 'thunderstorm';

  const isMonsoonSummer =
    prefs.seasonalEnabled &&
    effectiveSeason === 'summer' &&
    isRainyWeatherCategory(effectiveWeatherCategory);

  const starGroup0Opacity = twinkleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.42, 1],
  });
  const starGroup1Opacity = twinkleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.36],
  });

  const rainTranslateY = precipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-24, 96],
  });
  const snowTranslateY = precipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-18, 92],
  });
  const petalTranslateY = petalFloatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-14, 72],
  });
  const cloudTranslateX = cloudDriftAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 12],
  });

  const meteorTranslateX = shootingProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -155],
  });
  const meteorTranslateY = shootingProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 82],
  });
  const meteorOpacity = shootingProgress.interpolate({
    inputRange: [0, 0.14, 0.72, 1],
    outputRange: [0, 1, 0.85, 0],
  });

  const mistTopOpacity = isHome ? 0.02 : 0.45;
  const mistBottomOpacity = isHome ? 0.82 : 0.92;

  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: ambientPalette.canvasBg }]}>
      {/* Layer 1: 7-phase seasonal + weather sky gradient */}
      <LinearGradient
        colors={[
          sceneryPalette.skyColors[0],
          sceneryPalette.skyColors[1],
          sceneryPalette.skyColors[2],
        ]}
        locations={[0, 0.52, 1]}
        start={{ x: 0.18, y: 0 }}
        end={{ x: 0.84, y: 0.72 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Layer 2: Freshly spawned starfield during dusk / night / midnight / early dawn */}
      {isStarrySky && (
        <View testID="ai-ambient-starfield" style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: starGroup0Opacity }]}>
            <Svg
              width="100%"
              height="100%"
              viewBox="0 0 100 180"
              preserveAspectRatio="xMidYMid slice">
              {stars
                .filter(s => s.group === 0)
                .map(star => (
                  <Circle
                    key={star.id}
                    cx={star.cx}
                    cy={star.cy}
                    r={star.r}
                    fill="#FFFFFF"
                    fillOpacity={star.opacity}
                  />
                ))}
            </Svg>
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: starGroup1Opacity }]}>
            <Svg
              width="100%"
              height="100%"
              viewBox="0 0 100 180"
              preserveAspectRatio="xMidYMid slice">
              {stars
                .filter(s => s.group === 1)
                .map(star => (
                  <Circle
                    key={star.id}
                    cx={star.cx}
                    cy={star.cy}
                    r={star.r}
                    fill="#E5F1FF"
                    fillOpacity={star.opacity}
                  />
                ))}
            </Svg>
          </Animated.View>
        </View>
      )}

      {/* Layer 3: Occasional shooting star across starry night skies */}
      {isHome && sceneryPalette.showShootingStars && (
        <View testID="ai-ambient-shooting-star" style={StyleSheet.absoluteFill}>
          {(shootingSpec.visible || reducedMotion) && !reducedMotion && (
            <Animated.View
              style={[
                styles.shootingStarWrap,
                {
                  left: `${shootingSpec.startX}%`,
                  top: `${shootingSpec.startY}%`,
                  opacity: meteorOpacity,
                  transform: [
                    { translateX: meteorTranslateX },
                    { translateY: meteorTranslateY },
                    { rotate: '-28deg' },
                  ],
                },
              ]}>
              <LinearGradient
                colors={['#FFFFFF', 'rgba(220, 238, 255, 0.55)', 'transparent']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.shootingStarTail}
              />
            </Animated.View>
          )}
        </View>
      )}

      {/* Layer 4: Sun/moon celestial glow, seasonal ridges, snowcaps & foliage silhouettes */}
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 180"
        preserveAspectRatio="xMidYMid slice"
        style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="celestialAura" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={sceneryPalette.celestialGlow} stopOpacity={0.55} />
            <Stop offset="55%" stopColor={sceneryPalette.celestialGlow} stopOpacity={0.18} />
            <Stop offset="100%" stopColor={sceneryPalette.celestialGlow} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="milkyBand" cx="50%" cy="30%" r="60%">
            <Stop offset="0%" stopColor="#94C0FF" stopOpacity={0.16} />
            <Stop offset="100%" stopColor="#94C0FF" stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {effectiveTimePhase === 'midnight' && (
          <Ellipse cx={55} cy={36} rx={48} ry={22} fill="url(#milkyBand)" />
        )}

        {effectiveWeatherCategory !== 'thunderstorm' && (
          <G>
            <Circle
              cx={celestialPos.cx}
              cy={celestialPos.cy}
              r={celestialPos.r * 2.4}
              fill="url(#celestialAura)"
            />
            {celestialPos.isMoon ? (
              <Path
                d={`M ${celestialPos.cx + 2.2} ${celestialPos.cy - 6.8} A 6.8 6.8 0 1 0 ${celestialPos.cx + 5.8} ${celestialPos.cy + 4.4} A 5.4 5.4 0 0 1 ${celestialPos.cx + 2.2} ${celestialPos.cy - 6.8} Z`}
                fill={sceneryPalette.celestialCore}
                fillOpacity={0.94}
              />
            ) : (
              <Circle
                cx={celestialPos.cx}
                cy={celestialPos.cy}
                r={celestialPos.r * 0.62}
                fill={sceneryPalette.celestialCore}
                fillOpacity={0.86}
              />
            )}
          </G>
        )}

        {/* Distant mountain peaks */}
        <Path
          d="M-4 114 L18 82 L39 98 L61 72 L85 95 L106 80 L106 182 L-4 182 Z"
          fill={sceneryPalette.farMountain}
          fillOpacity={0.52}
        />

        {/* Winter / thawing snowcaps along distant peaks */}
        {sceneryPalette.snowCapColor != null && sceneryPalette.snowCapRatio > 0 && (
          <G
            fill={sceneryPalette.snowCapColor}
            fillOpacity={Math.min(0.9, 0.55 + sceneryPalette.snowCapRatio * 0.35)}>
            <Path d="M18 82 L11 92 L16 90 L19 94 L25 90 Z" />
            <Path d="M61 72 L52 84 L58 82 L63 87 L69 82 Z" />
            {sceneryPalette.snowCapRatio > 0.6 && (
              <Path d="M85 95 L79 102 L85 100 L90 103 L94 97 Z" />
            )}
          </G>
        )}

        {/* Mid undulating hills */}
        <Path
          d="M-6 126 Q24 98 54 118 T106 106 L106 182 L-6 182 Z"
          fill={sceneryPalette.midHill}
          fillOpacity={0.62}
        />

        {/* Near foreground ridge */}
        <Path
          d="M-6 142 Q28 118 64 134 T106 124 L106 182 L-6 182 Z"
          fill={sceneryPalette.nearHill}
          fillOpacity={0.72}
        />

        {/* Seasonal flora signatures */}
        {prefs.seasonalEnabled && effectiveSeason === 'harsh_winter' && (
          <G fill={sceneryPalette.foliageAccent} fillOpacity={0.85}>
            <Path d="M8 134 L12 118 L16 134 Z" />
            <Path d="M15 136 L19.5 117 L24 136 Z" />
            <Path d="M84 129 L88.5 112 L93 129 Z" />
          </G>
        )}

        {prefs.seasonalEnabled &&
          (effectiveSeason === 'spring' || effectiveSeason === 'early_spring') && (
            <G testID="ai-ambient-spring-blossoms">
              <Path
                d="M-2 10 Q14 16 24 26"
                stroke="#4C3848"
                strokeOpacity={0.55}
                strokeWidth={1.1}
                fill="none"
              />
              <Circle cx={8} cy={12} r={2.8} fill={sceneryPalette.foliageSecondary} fillOpacity={0.78} />
              <Circle cx={15} cy={15} r={2.3} fill={sceneryPalette.foliageSecondary} fillOpacity={0.72} />
              <Circle cx={22} cy={23} r={1.8} fill="#FFE3EF" fillOpacity={0.75} />
              {effectiveSeason === 'spring' && (
                <>
                  <Circle cx={28} cy={19} r={2.4} fill={sceneryPalette.foliageSecondary} fillOpacity={0.66} />
                  <Circle cx={4} cy={22} r={2.1} fill={sceneryPalette.foliageSecondary} fillOpacity={0.68} />
                </>
              )}
            </G>
          )}

        {isMonsoonSummer && (
          <G testID="ai-ambient-monsoon-greens">
            <Ellipse
              cx={16}
              cy={138}
              rx={22}
              ry={11}
              fill={sceneryPalette.foliageAccent}
              fillOpacity={0.78}
            />
            <Ellipse
              cx={82}
              cy={131}
              rx={26}
              ry={12}
              fill={sceneryPalette.foliageAccent}
              fillOpacity={0.76}
            />
            <Circle cx={11} cy={129} r={6} fill={sceneryPalette.foliageSecondary} fillOpacity={0.52} />
            <Circle cx={89} cy={121} r={7} fill={sceneryPalette.foliageSecondary} fillOpacity={0.48} />
          </G>
        )}

        {prefs.seasonalEnabled && effectiveSeason === 'autumn_transition' && (
          <G testID="ai-ambient-autumn-hills">
            <Ellipse cx={22} cy={135} rx={18} ry={8} fill={sceneryPalette.foliageAccent} fillOpacity={0.64} />
            <Ellipse cx={79} cy={126} rx={21} ry={9} fill={sceneryPalette.foliageSecondary} fillOpacity={0.58} />
          </G>
        )}
      </Svg>

      {/* Layer 5: Drifting soft weather clouds */}
      {showClouds && (
        <Animated.View
          testID="ai-ambient-weather-clouds"
          style={[
            StyleSheet.absoluteFill,
            { transform: [{ translateX: cloudTranslateX }] },
          ]}>
          <Svg width="100%" height="100%" viewBox="0 0 100 180" preserveAspectRatio="xMidYMid slice">
            <G
              fill={
                effectiveWeatherCategory === 'thunderstorm'
                  ? '#6E7E9C'
                  : sceneryPalette.skyColors[0].startsWith('#0') || sceneryPalette.skyColors[0].startsWith('#1')
                    ? '#8899BA'
                    : '#FFFFFF'
              }
              fillOpacity={effectiveWeatherCategory === 'cloudy' ? 0.36 : 0.24}>
              <Ellipse cx={26} cy={29} rx={18} ry={5.5} />
              <Ellipse cx={34} cy={27} rx={12} ry={4.8} />
              <Ellipse cx={78} cy={38} rx={21} ry={6.2} />
              {effectiveWeatherCategory !== 'few_clouds' && (
                <Ellipse cx={54} cy={22} rx={24} ry={6.5} />
              )}
            </G>
          </Svg>
        </Animated.View>
      )}

      {/* Layer 6: Rain / Drizzle streaks */}
      {(effectiveWeatherCategory === 'rain' ||
        effectiveWeatherCategory === 'drizzle' ||
        effectiveWeatherCategory === 'thunderstorm') && (
        <Animated.View
          testID="ai-ambient-weather-rain"
          style={[
            StyleSheet.absoluteFill,
            { transform: [{ translateY: rainTranslateY }] },
          ]}>
          <Svg width="100%" height="100%" viewBox="0 0 100 180" preserveAspectRatio="xMidYMid slice">
            <G stroke="#CFE8FF" strokeLinecap="round" strokeWidth={0.38}>
              {(effectiveWeatherCategory === 'drizzle' ? DRIZZLE_STREAKS : RAIN_STREAKS).map(drop => (
                <Line
                  key={drop.id}
                  x1={drop.x}
                  y1={drop.y}
                  x2={drop.x - 1.8}
                  y2={drop.y + drop.len}
                  strokeOpacity={drop.opacity}
                />
              ))}
            </G>
          </Svg>
        </Animated.View>
      )}

      {/* Layer 7: Soft falling snow */}
      {effectiveWeatherCategory === 'snow' && (
        <Animated.View
          testID="ai-ambient-weather-snow"
          style={[
            StyleSheet.absoluteFill,
            { transform: [{ translateY: snowTranslateY }] },
          ]}>
          <Svg width="100%" height="100%" viewBox="0 0 100 180" preserveAspectRatio="xMidYMid slice">
            <G fill="#FFFFFF">
              {SNOW_PARTICLES.map(flake => (
                <Circle
                  key={flake.id}
                  cx={flake.x}
                  cy={flake.y}
                  r={flake.size}
                  fillOpacity={flake.opacity}
                />
              ))}
            </G>
          </Svg>
        </Animated.View>
      )}

      {/* Layer 8: Seasonal floating cherry petals (spring) or drifting golden leaves (autumn) */}
      {prefs.seasonalEnabled &&
        (effectiveSeason === 'spring' || effectiveSeason === 'autumn_transition') && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { transform: [{ translateY: petalTranslateY }] },
            ]}>
            <Svg width="100%" height="100%" viewBox="0 0 100 180" preserveAspectRatio="xMidYMid slice">
              {DRIFTING_PETALS_OR_LEAVES.map(p => (
                <Ellipse
                  key={p.id}
                  cx={p.x}
                  cy={p.y}
                  rx={p.size}
                  ry={p.size * 0.55}
                  fill={
                    effectiveSeason === 'spring'
                      ? sceneryPalette.foliageSecondary
                      : sceneryPalette.foliageAccent
                  }
                  fillOpacity={p.opacity}
                />
              ))}
            </Svg>
          </Animated.View>
        )}

      {/* Layer 9: Misty horizontal veil */}
      {effectiveWeatherCategory === 'mist' && (
        <LinearGradient
          colors={['transparent', 'rgba(235, 243, 250, 0.38)', 'rgba(235, 243, 250, 0.54)', 'transparent']}
          locations={[0.18, 0.42, 0.62, 0.85]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Layer 10: Distant thunderstorm cloud flash */}
      {effectiveWeatherCategory === 'thunderstorm' && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.lightningFlashOverlay,
            { opacity: lightningOpacity },
          ]}
        />
      )}

      {/* Subtle atmospheric mist blending lower cards toward the surface palette */}
      <LinearGradient
        colors={[
          'transparent',
          ambientPalette.canvasMistTop,
          ambientPalette.canvasMistBottom,
        ]}
        locations={[isHome ? 0.46 : 0.1, isHome ? 0.68 : 0.38, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[
          StyleSheet.absoluteFill,
          { opacity: isHome ? mistBottomOpacity : mistTopOpacity + 0.52 },
        ]}
      />

      {/* Soft top-left contrast scrim ensuring crisp white greeting & quote legibility */}
      {isHome && (
        <LinearGradient
          colors={[
            sceneryPalette.headerScrimTop,
            sceneryPalette.headerScrimMid,
            'transparent',
          ]}
          locations={[0, 0.42, 0.78]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.75, y: 0.55 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Scoped sub-page tint so Charts, Water Logger, and Settings stay effortless to read */}
      {!isHome && (
        <RectMaskOverlay color={ambientPalette.canvasMistBottom} />
      )}
    </View>
  );
}

function RectMaskOverlay({ color }: { readonly color: string }): React.JSX.Element {
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
      <Rect x="0" y="0" width="100%" height="100%" fill={color} fillOpacity={0.28} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  lightningFlashOverlay: {
    backgroundColor: '#DCEBFF',
  },
  shootingStarWrap: {
    position: 'absolute',
    width: 96,
    height: 3,
  },
  shootingStarTail: {
    width: '100%',
    height: 2.2,
    borderRadius: 2,
  },
});
