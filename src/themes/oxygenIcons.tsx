/**
 * OxygenOS / ColorOS isolated iconography system.
 *
 * Balances expressive filled geometric SVG silhouettes inside solid saturated metric
 * badges (matching ColorOS/OHealth visual clarity) with quiet calibrated Lucide
 * monoline glyphs for navigation, utility actions, hydration vessels, and controls,
 * without altering any Default theme icons.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import {
  Cake,
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  Droplet,
  Ellipsis,
  Flame,
  Footprints,
  House,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
  Route,
  Ruler,
  Scale,
  Settings,
  Smartphone,
  Target,
  Timer,
  Trash,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react-native';

import { selectAccessibleForeground } from './paletteUtils';

export interface OxygenIconProps {
  readonly size?: number;
  readonly color?: string;
  readonly strokeWidth?: number;
  readonly filled?: boolean;
}

export const OXYGEN_ICON_SPEC = {
  strokeWidthRegular: 1.95,
  strokeWidthActive: 2.2,
  dockActiveFillOpacity: 0.2,
  badgeSize: 34,
  badgeRadius: 10,
  metricBadgeRadius: 16,
} as const;

export function OxygenFootstepsIcon({
  size = 20,
  color = '#1C1B1F',
  strokeWidth = OXYGEN_ICON_SPEC.strokeWidthRegular,
  filled = false,
}: OxygenIconProps): React.JSX.Element {
  if (filled) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M8.2 3.2C6.4 3.2 5 4.9 5 7.2C5 9.1 5.9 10.6 7.3 10.9C8.8 11.2 10.1 10 10.3 8.1C10.5 5.8 9.8 3.2 8.2 3.2Z"
          fill={color}
        />
        <Path
          d="M6.1 12.6C5.6 14 6.2 15.8 7.5 16.2C8.8 16.5 10.1 15.6 10.2 14.1C10.3 12.9 9.3 12 7.8 12C6.9 12 6.3 12.2 6.1 12.6Z"
          fill={color}
        />
        <Path
          d="M15.8 6.8C17.6 6.8 19 8.5 19 10.8C19 12.7 18.1 14.2 16.7 14.5C15.2 14.8 13.9 13.6 13.7 11.7C13.5 9.4 14.2 6.8 15.8 6.8Z"
          fill={color}
        />
        <Path
          d="M17.9 16.2C18.4 17.6 17.8 19.4 16.5 19.8C15.2 20.1 13.9 19.2 13.8 17.7C13.7 16.5 14.7 15.6 16.2 15.6C17.1 15.6 17.7 15.8 17.9 16.2Z"
          fill={color}
        />
      </Svg>
    );
  }

  return (
    <Footprints
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      nonScalingStroke
    />
  );
}

export function OxygenCaloriesIcon({
  size = 20,
  color = '#1C1B1F',
  strokeWidth = OXYGEN_ICON_SPEC.strokeWidthRegular,
  filled = false,
}: OxygenIconProps): React.JSX.Element {
  if (filled) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12.4 2.4C12.7 2 13.4 2.2 13.4 2.7C13.5 5.4 15.3 7.2 16.9 9C18.6 10.9 19.8 12.8 19.6 15.3C19.3 19.1 16.1 21.8 12 21.8C7.7 21.8 4.4 18.6 4.4 14.4C4.4 11.8 5.6 9.5 7.2 7.8C7.5 7.5 8.1 7.7 8.1 8.2C8.1 9.5 8.9 10.5 9.8 10.7C9.4 7.7 10.3 4.8 12.4 2.4ZM12.2 13.6C11.1 14.8 10.4 16 10.4 17.3C10.4 18.4 11.2 19.2 12.2 19.2C13.3 19.2 14.1 18.3 14.1 17.1C14.1 15.8 13.3 14.6 12.2 13.6Z"
          fill={color}
          fillRule="evenodd"
          clipRule="evenodd"
        />
      </Svg>
    );
  }

  return (
    <Flame
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      nonScalingStroke
    />
  );
}

export function OxygenTotalCaloriesIcon({
  size = 20,
  color = '#1C1B1F',
  strokeWidth = OXYGEN_ICON_SPEC.strokeWidthRegular,
  filled = false,
}: OxygenIconProps): React.JSX.Element {
  if (filled) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M13.2 2.4C13.6 2 14.2 2.3 14.1 2.9L12.9 9.5H17.8C18.5 9.5 18.9 10.3 18.4 10.9L10.8 21.6C10.4 22 9.8 21.7 9.9 21.1L11.1 14.5H6.2C5.5 14.5 5.1 13.7 5.6 13.1L13.2 2.4Z"
          fill={color}
        />
      </Svg>
    );
  }

  return (
    <Zap
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      nonScalingStroke
    />
  );
}

export function OxygenDistanceIcon({
  size = 20,
  color = '#1C1B1F',
  strokeWidth = OXYGEN_ICON_SPEC.strokeWidthRegular,
  filled = false,
}: OxygenIconProps): React.JSX.Element {
  if (filled) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M6.2 17.5C6.2 14.8 8.3 13.6 10.6 13.6H12.2C14.1 13.6 15.4 12.6 15.4 11.2"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <Circle cx="6.2" cy="18.2" r="2.6" fill={color} />
        <Path
          d="M16.2 3.2C13.8 3.2 12 5.1 12 7.4C12 10.2 15.2 13.4 15.8 14C16 14.2 16.4 14.2 16.6 14C17.2 13.4 20.4 10.2 20.4 7.4C20.4 5.1 18.6 3.2 16.2 3.2ZM16.2 8.8C15.4 8.8 14.7 8.1 14.7 7.3C14.7 6.5 15.4 5.8 16.2 5.8C17 5.8 17.7 6.5 17.7 7.3C17.7 8.1 17 8.8 16.2 8.8Z"
          fill={color}
          fillRule="evenodd"
          clipRule="evenodd"
        />
      </Svg>
    );
  }

  return (
    <Route
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      nonScalingStroke
    />
  );
}

export function OxygenActiveTimeIcon({
  size = 20,
  color = '#1C1B1F',
  strokeWidth = OXYGEN_ICON_SPEC.strokeWidthRegular,
  filled = false,
}: OxygenIconProps): React.JSX.Element {
  if (filled) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x="9.6" y="2.4" width="4.8" height="2" rx="1" fill={color} />
        <Path
          d="M18.4 6.2L19.8 7.6"
          stroke={color}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
        <Path
          d="M12 5.9C7.8 5.9 4.4 9.3 4.4 13.5C4.4 17.7 7.8 21.1 12 21.1C16.2 21.1 19.6 17.7 19.6 13.5C19.6 9.3 16.2 5.9 12 5.9ZM12.8 13.1L15.4 14.7C15.9 15 16 15.6 15.7 16C15.4 16.5 14.8 16.6 14.3 16.3L11.5 14.6C11.2 14.4 11 14 11 13.6V9.3C11 8.8 11.4 8.3 12 8.3C12.6 8.3 13 8.8 13 9.3V13.1H12.8Z"
          fill={color}
          fillRule="evenodd"
          clipRule="evenodd"
        />
      </Svg>
    );
  }

  return (
    <Timer
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      nonScalingStroke
    />
  );
}

export function OxygenWaterIcon({
  size = 20,
  color = '#1C1B1F',
  strokeWidth = OXYGEN_ICON_SPEC.strokeWidthRegular,
  filled = false,
}: OxygenIconProps): React.JSX.Element {
  if (filled) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 2.4C12.3 2.4 12.6 2.6 12.8 2.8C15.1 5.6 18.8 10.4 18.8 14.4C18.8 18.3 15.7 21.4 12 21.4C8.3 21.4 5.2 18.3 5.2 14.4C5.2 10.4 8.9 5.6 11.2 2.8C11.4 2.6 11.7 2.4 12 2.4ZM9.2 14.5C9.2 16.2 10.2 17.5 11.7 17.9C12.2 18 12.4 18.7 11.9 18.9C11.5 19 11 19 10.4 18.8C8.6 18.2 7.5 16.4 7.7 14.2C7.8 13.7 8.4 13.5 8.8 13.8C9 14 9.2 14.2 9.2 14.5Z"
          fill={color}
          fillRule="evenodd"
          clipRule="evenodd"
        />
      </Svg>
    );
  }

  return (
    <Droplet
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      nonScalingStroke
    />
  );
}

export function OxygenDockHomeIcon({
  size = 21,
  color = '#1C1B1F',
  strokeWidth,
  filled = false,
}: OxygenIconProps): React.JSX.Element {
  if (filled) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M11.15 2.85C11.64 2.45 12.36 2.45 12.85 2.85L20.35 8.95C20.76 9.29 21 9.79 21 10.32V19.2C21 20.42 20.02 21.4 18.8 21.4H14.9C14.46 21.4 14.1 21.04 14.1 20.6V15.75C14.1 14.59 13.16 13.65 12 13.65C10.84 13.65 9.9 14.59 9.9 15.75V20.6C9.9 21.04 9.54 21.4 9.1 21.4H5.2C3.98 21.4 3 20.42 3 19.2V10.32C3 9.79 3.24 9.29 3.65 8.95L11.15 2.85Z"
          fill={color}
        />
      </Svg>
    );
  }

  return (
    <House
      size={size}
      color={color}
      strokeWidth={strokeWidth ?? OXYGEN_ICON_SPEC.strokeWidthRegular}
      strokeLinecap="round"
      strokeLinejoin="round"
      nonScalingStroke
    />
  );
}

export function OxygenDockStatsIcon({
  size = 21,
  color = '#1C1B1F',
  strokeWidth,
  filled = false,
}: OxygenIconProps): React.JSX.Element {
  if (filled) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x="4" y="11" width="4" height="9" rx="1.6" fill={color} />
        <Rect x="10" y="5" width="4" height="15" rx="1.6" fill={color} />
        <Rect x="16" y="8" width="4" height="12" rx="1.6" fill={color} />
      </Svg>
    );
  }

  return (
    <ChartColumn
      size={size}
      color={color}
      strokeWidth={strokeWidth ?? OXYGEN_ICON_SPEC.strokeWidthRegular}
      strokeLinecap="round"
      strokeLinejoin="round"
      nonScalingStroke
    />
  );
}

export function OxygenDockWaterIcon({
  size = 21,
  color = '#1C1B1F',
  strokeWidth,
  filled = false,
}: OxygenIconProps): React.JSX.Element {
  if (filled) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 2.4C12.3 2.4 12.6 2.6 12.8 2.8C15.1 5.6 18.8 10.4 18.8 14.4C18.8 18.3 15.7 21.4 12 21.4C8.3 21.4 5.2 18.3 5.2 14.4C5.2 10.4 8.9 5.6 11.2 2.8C11.4 2.6 11.7 2.4 12 2.4ZM9.3 14.5C9.3 16.1 10.2 17.3 11.6 17.7C12.1 17.8 12.3 18.5 11.8 18.7C11.4 18.8 10.9 18.8 10.3 18.6C8.6 18 7.5 16.3 7.7 14.2C7.8 13.7 8.4 13.5 8.8 13.8C9 14 9.3 14.2 9.3 14.5Z"
          fill={color}
          fillRule="evenodd"
          clipRule="evenodd"
        />
      </Svg>
    );
  }

  return (
    <Droplet
      size={size}
      color={color}
      strokeWidth={strokeWidth ?? OXYGEN_ICON_SPEC.strokeWidthRegular}
      strokeLinecap="round"
      strokeLinejoin="round"
      nonScalingStroke
    />
  );
}

export function OxygenDockSettingsIcon({
  size = 21,
  color = '#1C1B1F',
  strokeWidth,
  filled = false,
}: OxygenIconProps): React.JSX.Element {
  if (filled) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M10.45 2.4C10.96 2.13 13.04 2.13 13.55 2.4L14.24 3.92C14.74 4.05 15.22 4.25 15.67 4.51L17.24 3.94C17.88 4.28 19.35 5.75 19.69 6.39L19.12 7.96C19.38 8.41 19.58 8.89 19.71 9.39L21.23 10.08C21.5 10.59 21.5 12.67 21.23 13.18L19.71 13.87C19.58 14.37 19.38 14.85 19.12 15.3L19.69 16.87C19.35 17.51 17.88 18.98 17.24 19.32L15.67 18.75C15.22 19.01 14.74 19.21 14.24 19.34L13.55 20.86C13.04 21.13 10.96 21.13 10.45 20.86L9.76 19.34C9.26 19.21 8.78 19.01 8.33 18.75L6.76 19.32C6.12 18.98 4.65 17.51 4.31 16.87L4.88 15.3C4.62 14.85 4.42 14.37 4.29 13.87L2.77 13.18C2.5 12.67 2.5 10.59 2.77 10.08L4.29 9.39C4.42 8.89 4.62 8.41 4.88 7.96L4.31 6.39C4.65 5.75 6.12 4.28 6.76 3.94L8.33 4.51C8.78 4.25 9.26 4.05 9.76 3.92L10.45 2.4ZM12 8.8C10.44 8.8 9.17 10.07 9.17 11.63C9.17 13.19 10.44 14.46 12 14.46C13.56 14.46 14.83 13.19 14.83 11.63C14.83 10.07 13.56 8.8 12 8.8Z"
          fill={color}
          fillRule="evenodd"
          clipRule="evenodd"
        />
      </Svg>
    );
  }

  return (
    <Settings
      size={size}
      color={color}
      strokeWidth={strokeWidth ?? OXYGEN_ICON_SPEC.strokeWidthRegular}
      strokeLinecap="round"
      strokeLinejoin="round"
      nonScalingStroke
    />
  );
}

export function OxygenTargetIcon({
  size = 18,
  color = '#1C1B1F',
  strokeWidth = OXYGEN_ICON_SPEC.strokeWidthRegular,
  filled = false,
}: OxygenIconProps): React.JSX.Element {
  if (filled) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 3C7.03 3 3 7.03 3 12C3 16.97 7.03 21 12 21C16.97 21 21 16.97 21 12C21 7.03 16.97 3 12 3ZM12 6.2C15.2 6.2 17.8 8.8 17.8 12C17.8 15.2 15.2 17.8 12 17.8C8.8 17.8 6.2 15.2 6.2 12C6.2 8.8 8.8 6.2 12 6.2Z"
          fill={color}
          fillRule="evenodd"
          clipRule="evenodd"
        />
        <Circle cx="12" cy="12" r="3" fill={color} />
      </Svg>
    );
  }

  return (
    <Target
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      nonScalingStroke
    />
  );
}

export function OxygenTrophyIcon({
  size = 18,
  color = '#1C1B1F',
  strokeWidth = OXYGEN_ICON_SPEC.strokeWidthRegular,
  filled = false,
}: OxygenIconProps): React.JSX.Element {
  if (filled) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M6.8 4H17.2V5.5H19.4C20.2 5.5 20.8 6.1 20.8 6.9V8.6C20.8 10.7 19.3 12.4 17.3 12.7C16.4 14.3 14.9 15.4 13.1 15.7V18.3H15.8C16.4 18.3 16.9 18.8 16.9 19.4C16.9 19.8 16.5 20.2 16 20.2H8C7.5 20.2 7.1 19.8 7.1 19.4C7.1 18.8 7.6 18.3 8.2 18.3H10.9V15.7C9.1 15.4 7.6 14.3 6.7 12.7C4.7 12.4 3.2 10.7 3.2 8.6V6.9C3.2 6.1 3.8 5.5 4.6 5.5H6.8V4ZM5.1 7.4V8.5C5.1 9.6 5.8 10.5 6.8 10.7V7.4H5.1ZM17.2 7.4V10.7C18.2 10.5 18.9 9.6 18.9 8.5V7.4H17.2Z"
          fill={color}
          fillRule="evenodd"
          clipRule="evenodd"
        />
      </Svg>
    );
  }

  return (
    <Trophy
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      nonScalingStroke
    />
  );
}

export function OxygenChevronLeftIcon({
  size = 20,
  color = '#1C1B1F',
  strokeWidth = OXYGEN_ICON_SPEC.strokeWidthRegular,
}: OxygenIconProps): React.JSX.Element {
  return (
    <ChevronLeft
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      nonScalingStroke
    />
  );
}

export function OxygenChevronRightIcon({
  size = 20,
  color = '#1C1B1F',
  strokeWidth = OXYGEN_ICON_SPEC.strokeWidthRegular,
}: OxygenIconProps): React.JSX.Element {
  return (
    <ChevronRight
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      nonScalingStroke
    />
  );
}

export function OxygenPlusIcon({
  size = 16,
  color = '#FFFFFF',
  strokeWidth = 2.2,
}: OxygenIconProps): React.JSX.Element {
  return (
    <Plus
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      nonScalingStroke
    />
  );
}

export function OxygenPencilIcon({
  size = 18,
  color = '#1C1B1F',
  strokeWidth = OXYGEN_ICON_SPEC.strokeWidthRegular,
}: OxygenIconProps): React.JSX.Element {
  return (
    <Pencil
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      nonScalingStroke
    />
  );
}

export function OxygenTrashIcon({
  size = 18,
  color = '#1C1B1F',
  strokeWidth = OXYGEN_ICON_SPEC.strokeWidthRegular,
}: OxygenIconProps): React.JSX.Element {
  return (
    <Trash
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      nonScalingStroke
    />
  );
}

export function OxygenMoreIcon({
  size = 18,
  color = '#1C1B1F',
  strokeWidth = OXYGEN_ICON_SPEC.strokeWidthRegular,
}: OxygenIconProps): React.JSX.Element {
  return (
    <Ellipsis
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      nonScalingStroke
    />
  );
}

export function OxygenCloseIcon({
  size = 18,
  color = '#1C1B1F',
  strokeWidth = OXYGEN_ICON_SPEC.strokeWidthRegular,
}: OxygenIconProps): React.JSX.Element {
  return (
    <X
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      nonScalingStroke
    />
  );
}

export type OxygenWaterVesselVariant = 'cup' | 'bottle_sm' | 'tumbler' | 'bottle_lg';

interface OxygenWaterVesselIconProps extends OxygenIconProps {
  readonly variant: OxygenWaterVesselVariant;
}

/**
 * Geometric 24x24 hydration vessel glyphs authored to match Lucide stroke calibration
 * (1px safe margin, uniform 1.95dp non-scaling stroke, round caps/joins, 2px internal clearance).
 */
export function OxygenWaterVesselIcon({
  variant,
  size = 20,
  color = '#1C1B1F',
  strokeWidth = OXYGEN_ICON_SPEC.strokeWidthRegular,
}: OxygenWaterVesselIconProps): React.JSX.Element {
  // Compensate viewBox scale to preserve optical stroke parity with Lucide nonScalingStroke
  const calibratedStroke = strokeWidth * (24 / Math.max(size, 1));

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {variant === 'cup' && (
        <>
          <Path
            d="M6.5 5.5H17.5L16.1 18.2C15.98 19.22 15.12 20 14.1 20H9.9C8.88 20 8.02 19.22 7.9 18.2L6.5 5.5Z"
            stroke={color}
            strokeWidth={calibratedStroke}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M7.4 11.4C9.2 12.1 14.8 10.7 16.6 11.4"
            stroke={color}
            strokeWidth={calibratedStroke}
            strokeLinecap="round"
          />
        </>
      )}

      {variant === 'bottle_sm' && (
        <>
          <Rect
            x="9.5"
            y="3"
            width="5"
            height="2.5"
            rx="1"
            stroke={color}
            strokeWidth={calibratedStroke}
            strokeLinejoin="round"
          />
          <Path
            d="M9.5 5.5V7.1C9.5 7.5 9.3 7.86 8.95 8.12L7.7 9.05C7.26 9.38 7 9.9 7 10.45V18.8C7 19.9 7.9 20.8 9 20.8H15C16.1 20.8 17 19.9 17 18.8V10.45C17 9.9 16.74 9.38 16.3 9.05L15.05 8.12C14.7 7.86 14.5 7.5 14.5 7.1V5.5"
            stroke={color}
            strokeWidth={calibratedStroke}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M9.5 13.5H14.5"
            stroke={color}
            strokeWidth={calibratedStroke}
            strokeLinecap="round"
          />
        </>
      )}

      {variant === 'tumbler' && (
        <>
          <Path
            d="M14.5 2.5L12.8 7"
            stroke={color}
            strokeWidth={calibratedStroke}
            strokeLinecap="round"
          />
          <Path
            d="M6.5 7H17.5"
            stroke={color}
            strokeWidth={calibratedStroke}
            strokeLinecap="round"
          />
          <Path
            d="M7.5 7L8.7 19.1C8.8 20.06 9.6 20.8 10.56 20.8H13.44C14.4 20.8 15.2 20.06 15.3 19.1L16.5 7"
            stroke={color}
            strokeWidth={calibratedStroke}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M8.3 12.2H15.7"
            stroke={color}
            strokeWidth={calibratedStroke}
            strokeLinecap="round"
          />
        </>
      )}

      {variant === 'bottle_lg' && (
        <>
          <Path
            d="M10 3.2H14C14.55 3.2 15 3.65 15 4.2V6H9V4.2C9 3.65 9.45 3.2 10 3.2Z"
            stroke={color}
            strokeWidth={calibratedStroke}
            strokeLinejoin="round"
          />
          <Path
            d="M9 6L7.35 8.2C6.8 8.94 6.5 9.84 6.5 10.76V19C6.5 20.1 7.4 21 8.5 21H15.5C16.6 21 17.5 20.1 17.5 19V10.76C17.5 9.84 17.2 8.94 16.65 8.2L15 6"
            stroke={color}
            strokeWidth={calibratedStroke}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M8.5 12H15.5M8.5 15.6H15.5"
            stroke={color}
            strokeWidth={calibratedStroke}
            strokeLinecap="round"
          />
        </>
      )}
    </Svg>
  );
}

export type OxygenSettingsIconId =
  | 'theme'
  | 'sun'
  | 'moon'
  | 'sync'
  | 'device'
  | 'gender'
  | 'weight'
  | 'height'
  | 'age'
  | 'steps_goal'
  | 'distance_goal'
  | 'water_goal';

interface OxygenSettingsRowIconProps {
  readonly icon: OxygenSettingsIconId;
  readonly accentColor: string;
  readonly badgeFgColor?: string;
}

function OxygenSunGlyph({ size, color }: { readonly size: number; readonly color: string }): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="4.5" fill={color} />
      <Path
        d="M12 3V5M12 19V21M3 12H5M19 12H21M5.6 5.6L7.1 7.1M16.9 16.9L18.4 18.4M18.4 5.6L16.9 7.1M7.1 16.9L5.6 18.4"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function OxygenMoonGlyph({ size, color }: { readonly size: number; readonly color: string }): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19.4 14.6C18.1 15.1 16.6 15.2 15.1 14.8C11.4 13.8 9.2 10 10.2 6.3C10.5 5.1 11.1 4.1 11.9 3.3C7.7 3.7 4.3 7.1 4 11.4C3.7 16.3 7.4 20.5 12.3 20.8C15.7 21 18.7 19.1 20.1 16.2C20.4 15.5 20.1 14.4 19.4 14.6Z"
        fill={color}
      />
    </Svg>
  );
}

/**
 * Renders a saturated ColorOS-style squircle badge wrapping filled/high-contrast glyphs
 * for OxygenOS Settings rows, automatically switching between crisp white and dark glyphs
 * via WCAG luminance contrast checks without touching Default emojis.
 */
export function OxygenSettingsRowIcon({
  icon,
  accentColor,
  badgeFgColor,
}: OxygenSettingsRowIconProps): React.JSX.Element {
  const iconSize = 18;
  const strokeWidth = 2.05;
  const fgColor = badgeFgColor ?? selectAccessibleForeground(accentColor, 3.4);

  const renderGlyph = (): React.JSX.Element => {
    switch (icon) {
      case 'theme':
        return <Palette size={iconSize} color={fgColor} strokeWidth={strokeWidth} nonScalingStroke />;
      case 'sun':
        return <OxygenSunGlyph size={iconSize} color={fgColor} />;
      case 'moon':
        return <OxygenMoonGlyph size={iconSize} color={fgColor} />;
      case 'sync':
        return <RefreshCw size={iconSize} color={fgColor} strokeWidth={strokeWidth} nonScalingStroke />;
      case 'device':
        return <Smartphone size={iconSize} color={fgColor} strokeWidth={strokeWidth} nonScalingStroke />;
      case 'gender':
        return <Users size={iconSize} color={fgColor} strokeWidth={strokeWidth} nonScalingStroke />;
      case 'weight':
        return <Scale size={iconSize} color={fgColor} strokeWidth={strokeWidth} nonScalingStroke />;
      case 'height':
        return <Ruler size={iconSize} color={fgColor} strokeWidth={strokeWidth} nonScalingStroke />;
      case 'age':
        return <Cake size={iconSize} color={fgColor} strokeWidth={strokeWidth} nonScalingStroke />;
      case 'steps_goal':
        return <OxygenFootstepsIcon size={iconSize} color={fgColor} filled />;
      case 'distance_goal':
        return <OxygenDistanceIcon size={iconSize} color={fgColor} filled />;
      case 'water_goal':
        return <OxygenWaterIcon size={iconSize} color={fgColor} filled />;
    }
  };

  return (
    <View
      testID={`oxygen-settings-icon-${icon}`}
      style={[
        styles.settingsBadge,
        {
          backgroundColor: accentColor,
        },
      ]}
    >
      {renderGlyph()}
    </View>
  );
}

const styles = StyleSheet.create({
  settingsBadge: {
    width: OXYGEN_ICON_SPEC.badgeSize,
    height: OXYGEN_ICON_SPEC.badgeSize,
    borderRadius: OXYGEN_ICON_SPEC.badgeRadius,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginLeft: 8,
  },
});
