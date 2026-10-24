// Text in the house styles. Colour comes from the active atmosphere.

import { Text, type TextProps, type TextStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTheme } from '../theme/theme';
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
  const color = tone === 'ink' ? p.ink : tone === 'soft' ? p.inkSoft : p.inkFaint;
  return <Text {...rest} style={[T[variant], { color, textAlign: align }, style]} />;
}

export const AnimatedTxt = Animated.createAnimatedComponent(Txt);
