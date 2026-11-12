/**
 * Custom colourful, multi-layered SVG vector weather icons tailored for AI Ambient's
 * compact header weather indicator (clear day/night, clouds, rain, drizzle, thunderstorm,
 * snow, and mist) without relying on system emojis or monochrome glyphs.
 */

import React from 'react';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

import type { WeatherConditionCategory } from './config';

interface AiAmbientWeatherIconProps {
  readonly category?: WeatherConditionCategory | null;
  readonly isNight?: boolean;
  readonly size?: number;
}

const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315] as const;

export function AiAmbientWeatherIcon({
  category = 'clear',
  isNight = false,
  size = 24,
}: AiAmbientWeatherIconProps): React.JSX.Element {
  const safeCat = category ?? 'clear';

  if (safeCat === 'clear' && !isNight) {
    return (
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Defs>
          <LinearGradient id="sunCore" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FFE97D" />
            <Stop offset="55%" stopColor="#FFC13B" />
            <Stop offset="100%" stopColor="#FF9626" />
          </LinearGradient>
        </Defs>
        <Circle cx={16} cy={16} r={10.5} fill="#FFE082" fillOpacity={0.28} />
        <G stroke="#FFD25A" strokeWidth={2.2} strokeLinecap="round">
          {RAY_ANGLES.map(angle => {
            const rad = (angle * Math.PI) / 180;
            const r1 = 9.4;
            const r2 = 13.0;
            return (
              <Line
                key={angle}
                x1={16 + r1 * Math.cos(rad)}
                y1={16 + r1 * Math.sin(rad)}
                x2={16 + r2 * Math.cos(rad)}
                y2={16 + r2 * Math.sin(rad)}
              />
            );
          })}
        </G>
        <Circle cx={16} cy={16} r={6.8} fill="url(#sunCore)" />
        <Circle cx={14.1} cy={13.8} r={2.2} fill="#FFF7CC" fillOpacity={0.65} />
      </Svg>
    );
  }

  if (safeCat === 'clear' && isNight) {
    return (
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Defs>
          <LinearGradient id="moonGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FFF0B8" />
            <Stop offset="100%" stopColor="#F5BD58" />
          </LinearGradient>
        </Defs>
        <Circle cx={15} cy={16} r={11} fill="#FFE082" fillOpacity={0.18} />
        <Path
          d="M19.8 7.5A8.8 8.8 0 1 0 24.5 21.6 7.4 7.4 0 0 1 19.8 7.5Z"
          fill="url(#moonGlow)"
        />
        <Path
          d="M23.5 8.5L24.3 10.7L26.5 11.5L24.3 12.3L23.5 14.5L22.7 12.3L20.5 11.5L22.7 10.7Z"
          fill="#FFF4C2"
        />
        <Circle cx={25.5} cy={17.5} r={1.2} fill="#FFE694" />
      </Svg>
    );
  }

  if (safeCat === 'few_clouds') {
    return (
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Defs>
          <LinearGradient id="fcSun" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FFE97D" />
            <Stop offset="100%" stopColor="#FF9E30" />
          </LinearGradient>
          <LinearGradient id="fcCloud" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="100%" stopColor="#D7E6F7" />
          </LinearGradient>
        </Defs>
        {isNight ? (
          <Path
            d="M20.8 6.8A5.8 5.8 0 1 0 24.5 15.8 4.8 4.8 0 0 1 20.8 6.8Z"
            fill="#F9CF6B"
          />
        ) : (
          <Circle cx={20.8} cy={11.2} r={5.4} fill="url(#fcSun)" />
        )}
        <Path
          d="M9.6 24.2H22.2A4.3 4.3 0 0 0 23 15.7 5.8 5.8 0 0 0 11.8 14.2 4.8 4.8 0 0 0 9.6 24.2Z"
          fill="url(#fcCloud)"
        />
      </Svg>
    );
  }

  if (safeCat === 'cloudy') {
    return (
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Defs>
          <LinearGradient id="cBack" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#E4EEFA" />
            <Stop offset="100%" stopColor="#B2C7DE" />
          </LinearGradient>
          <LinearGradient id="cFront" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="100%" stopColor="#CFE0F2" />
          </LinearGradient>
        </Defs>
        <Path
          d="M12.5 18.2H24A3.6 3.6 0 0 0 24.5 11 4.6 4.6 0 0 0 15.8 9.8 3.9 3.9 0 0 0 12.5 18.2Z"
          fill="url(#cBack)"
        />
        <Path
          d="M8.5 23.6H21.2A4.2 4.2 0 0 0 21.8 15.3 5.4 5.4 0 0 0 11.4 13.8 4.6 4.6 0 0 0 8.5 23.6Z"
          fill="url(#cFront)"
        />
      </Svg>
    );
  }

  if (safeCat === 'rain' || safeCat === 'drizzle') {
    return (
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Defs>
          <LinearGradient id="rCloud" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#F4F8FD" />
            <Stop offset="100%" stopColor="#BDD1E8" />
          </LinearGradient>
          <LinearGradient id="rDrop" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#6CE0FF" />
            <Stop offset="100%" stopColor="#1D9BF0" />
          </LinearGradient>
        </Defs>
        <Path
          d="M8.2 19.6H22.2A4.1 4.1 0 0 0 22.8 11.5 5.4 5.4 0 0 0 12.4 10 4.5 4.5 0 0 0 8.2 19.6Z"
          fill="url(#rCloud)"
        />
        <G stroke="url(#rDrop)" strokeWidth={2.3} strokeLinecap="round">
          <Line x1={11.5} y1={22.2} x2={10.1} y2={26.4} />
          <Line x1={16.4} y1={22.2} x2={15.0} y2={26.9} />
          <Line x1={21.2} y1={22.2} x2={19.8} y2={26.4} />
        </G>
      </Svg>
    );
  }

  if (safeCat === 'thunderstorm') {
    return (
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Defs>
          <LinearGradient id="tCloud" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#DCE6F5" />
            <Stop offset="100%" stopColor="#8EA3C0" />
          </LinearGradient>
          <LinearGradient id="tBolt" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FFF08A" />
            <Stop offset="100%" stopColor="#FF9F1C" />
          </LinearGradient>
        </Defs>
        <Path
          d="M8.2 19H22.4A4 4 0 0 0 23 11 5.3 5.3 0 0 0 12.6 9.5 4.4 4.4 0 0 0 8.2 19Z"
          fill="url(#tCloud)"
        />
        <Path
          d="M16.8 16.4L13.1 22.2H16.3L14.8 27.6L19.8 20.8H16.6Z"
          fill="url(#tBolt)"
        />
      </Svg>
    );
  }

  if (safeCat === 'snow') {
    return (
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Defs>
          <LinearGradient id="sCloud" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="100%" stopColor="#C8E0F4" />
          </LinearGradient>
        </Defs>
        <Path
          d="M8.2 19.2H22.2A4.1 4.1 0 0 0 22.8 11.2 5.4 5.4 0 0 0 12.4 9.7 4.5 4.5 0 0 0 8.2 19.2Z"
          fill="url(#sCloud)"
        />
        <Circle cx={11.5} cy={23.6} r={1.8} fill="#E6F7FF" />
        <Circle cx={16.5} cy={25.2} r={2.0} fill="#9FE0FF" />
        <Circle cx={21.4} cy={23.4} r={1.7} fill="#E6F7FF" />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Defs>
        <LinearGradient id="mCloud" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="100%" stopColor="#D3E2F2" />
        </LinearGradient>
      </Defs>
      <Path
        d="M9.2 17.5H22.2A3.7 3.7 0 0 0 22.8 10.2 4.8 4.8 0 0 0 13.6 9 4 4 0 0 0 9.2 17.5Z"
        fill="url(#mCloud)"
      />
      <G stroke="#DCEBFB" strokeWidth={2.1} strokeLinecap="round">
        <Line x1={7.5} y1={21.2} x2={24.5} y2={21.2} />
        <Line x1={10.2} y1={24.8} x2={21.8} y2={24.8} />
      </G>
    </Svg>
  );
}

