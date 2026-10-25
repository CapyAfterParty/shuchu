// Text in the house styles. Colour comes from the active atmosphere.

import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTheme, useTypeScale } from '../theme/theme';
import { type as T } from '../theme/tokens';

export type Variant = keyof typeof T;
export type Tone = 'ink' | 'soft' | 'faint';

export interface TxtProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
  align?: TextStyle['textAlign'];
}

export function Txt({ variant = 'body', tone = 'ink', align, style, ...rest }: TxtProps) {
  const p = useTheme();
  const k = useTypeScale();
  const color = tone === 'ink' ? p.ink : tone === 'soft' ? p.inkSoft : p.inkFaint;
  const flat = StyleSheet.flatten([T[variant], { color, textAlign: align }, style]) as TextStyle;
  // Large type breathes with the screen; small type stays readable.
  const size = flat.fontSize ?? 16;
  const f = size >= 22 ? k : Math.max(k, 0.94);
  const scaled = f === 1 ? flat : {
    ...flat,
    fontSize: size * f,
    lineHeight: flat.lineHeight ? flat.lineHeight * f : undefined,
    letterSpacing: flat.letterSpacing ? flat.letterSpacing * f : undefined,
  };
  return <Text {...rest} style={scaled} />;
}

export const AnimatedTxt = Animated.createAnimatedComponent(Txt);
