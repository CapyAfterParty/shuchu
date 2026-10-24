// Which atmosphere is active, and a smooth crossfade between them.

import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { withTiming, Easing } from 'react-native-reanimated';
import { useSettings } from '../data/settings';
import { themeBlend } from '../scene/world';
import { mist, night, type Palette } from './tokens';

export function useTheme(): Palette {
  const appearance = useSettings((s) => s.appearance);
  const system = useColorScheme();
  const dark = appearance === 'night' || (appearance === 'auto' && system === 'dark');
  return dark ? night : mist;
}

/** Mount once: drives the scene's crossfade whenever the theme changes. */
export function useThemeBlend(palette: Palette): void {
  useEffect(() => {
    themeBlend.value = withTiming(palette.name === 'night' ? 1 : 0, {
      duration: 1400,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [palette.name]);
}
