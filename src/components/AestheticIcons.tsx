/**
 * AestheticIcons — lightweight, pure SVG vector icons and expressive shapes for Ayumi.
 * 
 * Implemented using react-native-svg to guarantee crisp resolution across all
 * screen densities without depending on font asset linking or native icon font packs.
 * Each icon supports custom size and color props.
 * Includes Material 3 Expressive shapes such as the 8-petal scalloped cookie.
 */

import React from 'react';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';

interface IconProps {
  readonly size?: number;
  readonly color?: string;
}

/** Generates a smooth 8-petal scalloped cookie SVG path in a square bounding box */
export function generateScallopPath(size: number = 44, petals: number = 8, innerRatio: number = 0.82): string {
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = (size / 2) * 0.95;
  const rInner = rOuter * innerRatio;
  const totalPoints = petals * 2;
  const step = (Math.PI * 2) / totalPoints;

  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < totalPoints; i++) {
    const angle = i * step - Math.PI / 2;
    const r = i % 2 === 0 ? rOuter : rInner;
    points.push({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    });
  }

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < totalPoints; i++) {
    const curr = points[i];
    const next = points[(i + 1) % totalPoints];
    const prev = points[(i - 1 + totalPoints) % totalPoints];
    const nextNext = points[(i + 2) % totalPoints];

    const cp1x = curr.x + (next.x - prev.x) * 0.2;
    const cp1y = curr.y + (next.y - prev.y) * 0.2;
    const cp2x = next.x - (nextNext.x - curr.x) * 0.2;
    const cp2y = next.y - (nextNext.y - curr.y) * 0.2;

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
  }
  return d + ' Z';
}

/** Material 3 Expressive 8-petal scalloped cookie container badge */
export function ScallopCookieBadge({
  size = 46,
  bgColor = '#F2E8FA',
  children,
}: {
  readonly size?: number;
  readonly bgColor?: string;
  readonly children?: React.ReactNode;
}): React.JSX.Element {
  const pathData = React.useMemo(() => generateScallopPath(size, 8, 0.8), [size]);

  return (
    <React.Fragment>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute' }}>
        <Path d={pathData} fill={bgColor} />
      </Svg>
      {children}
    </React.Fragment>
  );
}

/** Quick add plus icon */
export function PlusIcon({ size = 18, color = '#FFFFFF' }: IconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5v14M5 12h14"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Leaf/Bloom organic brand logo */
export function LeafLogo({ size = 26, color = '#8A5BB8' }: IconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17.5 3C11.5 3 6 8.5 6 14.5c0 3.3 2.7 6 6 6 6 0 11.5-5.5 11.5-11.5 0-3.3-2.7-6-6-6z"
        fill={color}
        opacity={0.85}
      />
      <Path
        d="M6 14.5C6 11 8.5 7.5 12 5.5c-1 3-1 6.5 0 9.5"
        stroke="#FFFFFF"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Path
        d="M3 21c3-1 6-3 8-6.5"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Running sneaker / shoe icon */
export function SneakerIcon({ size = 26, color = '#8A5BB8' }: IconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2 17h19a2 2 0 002-2v-1c0-1.5-1-2.5-2.5-3l-3.5-1-3-4a3 3 0 00-2.4-1.2H7a2 2 0 00-2 2v2.5L2.5 12A2 2 0 001 13.8V16a1 1 0 001 1z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M1 18.5a1.5 1.5 0 001.5 1.5h18a1.5 1.5 0 001.5-1.5V17H1v1.5z"
        fill={color}
        opacity={0.3}
      />
      <Path
        d="M8 8.5l3 3M11 6.5l3 3"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Map pin / Distance path icon */
export function RouteMapIcon({ size = 24, color = '#7D49B8' }: IconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21c-4.5-4-8-8.5-8-12a8 8 0 1116 0c0 3.5-3.5 8-8 12z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={9} r={3} fill={color} />
      <Path
        d="M6 19a9 9 0 0012 0"
        stroke={color}
        strokeWidth={1.8}
        strokeDasharray="2 3"
      />
    </Svg>
  );
}

/** Flame / Active calories icon */
export function FlameIcon({ size = 24, color = '#E85D3F' }: IconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2c-.5 2.5-2.5 4.5-4.5 6.5C5.5 10.5 4 12.8 4 15.5 4 19.6 7.4 23 11.5 23s7.5-3.4 7.5-7.5c0-4.5-3.5-7-4.5-10.5-.5 2-2 3.5-3.5 4.5 0-3 1-5.5 1-7.5z"
        fill={color}
        opacity={0.85}
      />
      <Path
        d="M12 14c-1.5 1-2.5 2.2-2.5 3.8 0 2 1.6 3.7 3.5 3.7s3.5-1.7 3.5-3.7c0-1.8-1.5-2.8-2.5-4-.5.8-1.2 1.2-2 1.2z"
        fill="#FFFFFF"
        opacity={0.9}
      />
    </Svg>
  );
}

/** Lightning / Total metabolic energy icon */
export function BoltIcon({ size = 24, color = '#D98A1E' }: IconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 2L3 14h8l-2 8 10-12h-8l2-8z"
        fill={color}
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Stopwatch / Active time icon */
export function StopwatchIcon({ size = 24, color = '#8B57C6' }: IconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={14} r={8} stroke={color} strokeWidth={2} />
      <Path d="M12 10v4l2.5 2.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M10 2h4M12 2v3M19 6l-1.5 1.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/** Water droplet icon */
export function DropletIcon({ size = 24, color = '#3D78DB' }: IconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2.7c-3.2 4.2-7 9.1-7 13.1C5 19.8 8.1 23 12 23s7-3.2 7-7.2c0-4-3.8-8.9-7-13.1z"
        fill={color}
        opacity={0.9}
      />
      <Path
        d="M9.5 15.5c0-2.2 1.8-4 4-4.5"
        stroke="#FFFFFF"
        strokeWidth={1.6}
        strokeLinecap="round"
        opacity={0.8}
      />
    </Svg>
  );
}

/** Gear / Settings icon */
export function SettingsGearIcon({ size = 22, color = '#6B5782' }: IconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Home icon for floating dock */
export function DockHomeIcon({ size = 22, color = '#FFFFFF' }: IconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 10.5L12 3l9 7.5V20a2 2 0 01-2 2h-4a1 1 0 01-1-1v-4a1 1 0 00-1-1h-2a1 1 0 00-1 1v4a1 1 0 01-1 1H5a2 2 0 01-2-2v-9.5z"
        fill={color}
      />
    </Svg>
  );
}

/** Bar chart / analytics icon for floating dock */
export function DockChartIcon({ size = 22, color = '#7F6799' }: IconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={13} width={3.5} height={8} rx={1.75} fill={color} />
      <Rect x={10.25} y={6} width={3.5} height={15} rx={1.75} fill={color} />
      <Rect x={16.5} y={10} width={3.5} height={11} rx={1.75} fill={color} />
    </Svg>
  );
}

/** User / profile icon for floating dock */
export function DockUserIcon({ size = 22, color = '#7F6799' }: IconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4.5} stroke={color} strokeWidth={2.2} />
      <Path
        d="M4.5 20.5c0-4 3.5-6.5 7.5-6.5s7.5 2.5 7.5 6.5"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

