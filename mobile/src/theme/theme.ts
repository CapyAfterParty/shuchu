// Which atmosphere is active, and a smooth crossfade between them.

import { useEffect } from 'react';
import { useColorScheme, useWindowDimensions } from 'react-native';
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

/**
 * How much large type shrinks on this screen: 1 on a roomy phone, down to
 * 0.7 on small or short ones (and in embedded web views).
 */
export function useTypeScale(): number {
  const { width, height } = useWindowDimensions();
  return Math.max(0.7, Math.min(1, width / 390, height / 780));
}

/**
 * The phone's text size setting, honoured up to 1.15x. Text is sized with
 * this directly (and the system scaling turned off), so the size Android
 * measures and the size it draws are always the same.
 */
export function useFontScale(): number {
  const { fontScale } = useWindowDimensions();
  return Math.min(Math.max(fontScale || 1, 0.85), 1.15);
}
