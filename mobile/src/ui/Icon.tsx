// Thin line icons, drawn for Shuchu. 1.2 pt strokes, round caps, nothing filled
// unless it is light.

import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../theme/theme';

export type IconName =
  | 'tune' | 'close' | 'back' | 'desk' | 'errand' | 'clock' | 'check' | 'arrow'
  | 'waves' | 'link' | 'moon' | 'sun' | 'drop' | 'leaf' | 'split' | 'hand' | 'sound';

export function Icon({ name, size = 22, color, weight = 1.2 }: { name: IconName; size?: number; color?: string; weight?: number }) {
  const p = useTheme();
  const c = color ?? p.ink;
  const s = { stroke: c, strokeWidth: weight, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'tune' && (
        <>
          <Path d="M5 8h9M18 8h1M5 16h1M10 16h9" {...s} />
          <Circle cx={16} cy={8} r={2} {...s} />
          <Circle cx={8} cy={16} r={2} {...s} />
        </>
      )}
      {name === 'close' && <Path d="M7 7l10 10M17 7L7 17" {...s} />}
      {name === 'back' && <Path d="M14.5 6l-6 6 6 6" {...s} />}
      {name === 'desk' && (
        <>
          <Rect x={5} y={6} width={14} height={9.5} rx={1.6} {...s} />
          <Path d="M3 18.5h18" {...s} />
        </>
      )}
      {name === 'errand' && (
        <>
          <Path d="M6.5 9.5h11l-1 9.5h-9z" {...s} />
          <Path d="M9.5 9.5V8a2.5 2.5 0 015 0v1.5" {...s} />
        </>
      )}
      {name === 'clock' && (
        <>
          <Circle cx={12} cy={12} r={7.5} {...s} />
          <Path d="M12 8v4.2l2.6 1.6" {...s} />
        </>
      )}
      {name === 'check' && <Path d="M6 12.5l4 4 8-9" {...s} />}
      {name === 'arrow' && <Path d="M8 16L16 8M9.5 8H16v6.5" {...s} />}
      {name === 'waves' && (
        <>
          <Path d="M4 9c2.7-2 5.3 2 8 0s5.3 2 8 0" {...s} />
          <Path d="M4 13c2.7-2 5.3 2 8 0s5.3 2 8 0" {...s} />
          <Path d="M4 17c2.7-2 5.3 2 8 0s5.3 2 8 0" {...s} />
        </>
      )}
      {name === 'link' && (
        <>
          <Path d="M10 14l4-4" {...s} />
          <Path d="M8.5 11.5l-1.7 1.7a3 3 0 004.2 4.2l1.7-1.7M15.5 12.5l1.7-1.7a3 3 0 00-4.2-4.2l-1.7 1.7" {...s} />
        </>
      )}
      {name === 'moon' && <Path d="M17.5 14.5A6.5 6.5 0 019.5 6.5a6.5 6.5 0 108 8z" {...s} />}
      {name === 'sun' && (
        <>
          <Circle cx={12} cy={12} r={3.6} {...s} />
          <Path d="M12 4v1.6M12 18.4V20M4 12h1.6M18.4 12H20M6.3 6.3l1.1 1.1M16.6 16.6l1.1 1.1M6.3 17.7l1.1-1.1M16.6 7.4l1.1-1.1" {...s} />
        </>
      )}
      {name === 'drop' && <Path d="M12 4.5c3 3.6 5 6.4 5 9a5 5 0 01-10 0c0-2.6 2-5.4 5-9z" {...s} />}
      {name === 'leaf' && (
        <>
          <Path d="M6 18c0-7 4.5-11 12-12-.5 7.5-4.5 12-12 12z" {...s} />
          <Path d="M6 18l6-6" {...s} />
        </>
      )}
      {name === 'split' && <Path d="M12 19v-6M12 13L7 6M12 13l5-7M5 8.5L7 6l2.5 1M14.5 7L17 6l2 2.5" {...s} />}
      {name === 'hand' && <Path d="M8.5 12V7.5a1.3 1.3 0 012.6 0V11M11.1 10.5V6a1.3 1.3 0 012.6 0v4.5M13.7 10.5V7.2a1.3 1.3 0 012.6 0V13c0 3.3-2.2 6-5.3 6-2.3 0-3.6-1.2-4.9-3.3l-1.4-2.4a1.2 1.2 0 012-1.3L8.5 13.5" {...s} />}
      {name === 'sound' && (
        <>
          <Path d="M5 10v4h3l4 3.5v-11L8 10z" {...s} />
          <Path d="M15.5 9.5a3.5 3.5 0 010 5M17.8 7.2a6.8 6.8 0 010 9.6" {...s} />
        </>
      )}
    </Svg>
  );
}
