// Small motion helpers shared by every screen.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import type { Frame } from '../scene/Glass';
import { claimSpark, releaseSpark, writeSpark } from '../scene/world';

export const melt = Easing.bezier(0.22, 0.61, 0.36, 1);

/** How revealed the surrounding content is; glass inside grows in with it. */
export const RevealContext = createContext<SharedValue<number> | null>(null);
export const useReveal = () => useContext(RevealContext);

/** Content condenses into view: rising a little, fading in, settling. */
export function Reveal({
  children, delay = 0, show = true, rise = 10, duration = 900, style,
}: { children: ReactNode; delay?: number; show?: boolean; rise?: number; duration?: number; style?: StyleProp<ViewStyle> }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = show
      ? withDelay(delay, withTiming(1, { duration, easing: melt }))
      : withTiming(0, { duration: duration * 0.5, easing: melt });
  }, [show, delay, duration, p]);
  const a = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * rise }, { scale: 0.985 + p.value * 0.015 }],
  }));
  const parent = useReveal();
  const combined = useDerivedValue(() => p.value * (parent ? parent.value : 1));
  return (
    <RevealContext.Provider value={combined}>
      <Animated.View style={[style, a]}>{children}</Animated.View>
    </RevealContext.Provider>
  );
}

/**
 * Pins one of the scene's sparks to a glass frame.
 * `at` is where in the frame, 0..1 on each axis (default: centre).
 */
export function useSpark(
  frame: SharedValue<Frame>,
  intensity: SharedValue<number>,
  radius: number | SharedValue<number> = 5,
  at: { x: number; y: number } = { x: 0.5, y: 0.5 },
): void {
  const [slot] = useState(claimSpark);
  useEffect(() => () => releaseSpark(slot), [slot]);
  useFrameCallback(() => {
    const f = frame.value;
    if (!f.w) return;
    const r = typeof radius === 'number' ? radius : radius.value;
    writeSpark(slot, f.x + f.w * at.x, f.y + f.h * at.y, intensity.value, r);
  });
}

export const emptyFrame: Frame = { x: 0, y: 0, w: 0, h: 0 };
