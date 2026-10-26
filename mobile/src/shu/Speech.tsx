// Shu's speech bubble: pops out of Shu with a small spring, holds for a
// moment, then floats up and fades. One line at a time; a new line replaces
// the old one.

import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming, withDelay } from 'react-native-reanimated';
import { feel } from '../feel/feel';
import { useTheme } from '../theme/theme';
import { Txt } from '../ui/Txt';

export function useSpeech() {
  const [said, setSaid] = useState<{ text: string; key: number } | null>(null);
  const clear = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(clear.current), []);
  const say = useCallback((text: string) => {
    feel.tick();
    clearTimeout(clear.current);
    const hold = 1600 + text.length * 45;
    setSaid({ text, key: Date.now() });
    clear.current = setTimeout(() => setSaid(null), hold + 500);
  }, []);
  return { said, say };
}

/**
 * The bubble. Place it in a container positioned over Shu; `side` says which
 * way it leans so its tail points back at him.
 */
export function Bubble({ said, side = 'left', style }: {
  said: { text: string; key: number } | null;
  side?: 'left' | 'right' | 'center';
  style?: ViewStyle;
}) {
  if (!said) return null;
  return <Pop key={said.key} text={said.text} side={side} style={style} />;
}

function Pop({ text, side, style }: { text: string; side: 'left' | 'right' | 'center'; style?: ViewStyle }) {
  const p = useTheme();
  const t = useSharedValue(0);
  const out = useSharedValue(0);
  useEffect(() => {
    t.value = withSpring(1, { damping: 13, stiffness: 260, mass: 0.7 });
    out.value = withDelay(1600 + text.length * 45, withTiming(1, { duration: 450 }));
  }, []);
  const a = useAnimatedStyle(() => ({
    opacity: Math.min(1, t.value * 1.5) * (1 - out.value),
    transform: [
      { translateY: (1 - t.value) * 10 - out.value * 10 },
      { scale: 0.6 + 0.4 * t.value },
    ],
  }));
  const night = p.name === 'night';
  const fill = night ? 'rgba(36,46,60,0.94)' : 'rgba(255,255,255,0.92)';
  const align = side === 'left' ? 'flex-end' : side === 'right' ? 'flex-start' : 'center';
  return (
    <Animated.View style={[styles.wrap, side !== 'center' && styles.wide, { alignItems: align, transformOrigin: side === 'left' ? 'right bottom' : side === 'right' ? 'left bottom' : 'center bottom' }, style, a]} pointerEvents="none" accessibilityLiveRegion="polite">
      <View style={[styles.bubble, { backgroundColor: fill, boxShadow: night ? '0 4px 14px rgba(0,0,0,0.4)' : '0 4px 14px rgba(40,62,92,0.14)' }]}>
        <Txt variant="label" style={styles.text}>{text}</Txt>
      </View>
      <View style={[styles.tail, side === 'left' ? styles.tailRight : side === 'right' ? styles.tailLeft : null, { backgroundColor: fill }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
  // a fixed lane wide enough for a line, so short lines don't wrap early
  wide: { width: 240 },
  bubble: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, maxWidth: 220 },
  text: { fontSize: 14, lineHeight: 18 },
  tail: { width: 10, height: 10, borderRadius: 2, marginTop: -6, transform: [{ rotateZ: '45deg' }] },
  tailRight: { marginRight: 18 },
  tailLeft: { marginLeft: 18 },
});
