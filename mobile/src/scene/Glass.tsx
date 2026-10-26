// Any view can become glass. <Glass> claims a slot in the scene and keeps
// the shader's shape exactly under itself every frame, so the glass follows
// layout, scrolling and the keyboard for free.
//
// Rule: never put <Glass> inside a transformed parent. Motion goes through
// the `dx`, `dy` and `scale` props, which move the view and the glass together.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedRef,
  useAnimatedStyle,
  useFrameCallback,
} from 'react-native-reanimated';
import { useReveal } from '../ui/motion';
import { placeOnScreen, useScrollTrack } from '../ui/ScrollArea';
import { claimSlot, releaseSlot, writeShape } from './world';

type Num = number | SharedValue<number>;

export interface GlassProps {
  style?: StyleProp<ViewStyle>;
  /** Layout of the content inside the glass. */
  contentStyle?: StyleProp<ViewStyle>;
  children?: ReactNode;
  radius?: number;
  presence?: Num;
  melt?: Num;
  lift?: Num;
  wobble?: number;
  pearl?: Num;
  warm?: Num;
  dx?: Num;
  dy?: Num;
  scale?: Num;
  /** Squash and stretch, for jelly responses. */
  sx?: Num;
  sy?: Num;
  /** Content opacity follows presence unless turned off. */
  fadeContent?: boolean;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
  /** Receives where this glass is on screen, every frame. */
  frame?: SharedValue<Frame>;
}

export interface Frame {
  x: number; y: number; w: number; h: number;
}

/** Glass inside glass rests on the layer above (controls on a sheet). */
const LayerContext = createContext(0);

function read(v: Num | undefined, fallback: number): number {
  'worklet';
  if (v === undefined) return fallback;
  return typeof v === 'number' ? v : v.value;
}

export function Glass({
  style,
  contentStyle: inner,
  children,
  radius = 40,
  presence = 1,
  melt = 0,
  lift = 0.5,
  wobble = 0,
  pearl = 0,
  warm = 0,
  dx = 0,
  dy = 0,
  scale = 1,
  sx = 1,
  sy = 1,
  fadeContent = true,
  pointerEvents,
  frame,
}: GlassProps) {
  const ref = useAnimatedRef<View>();
  const [slot] = useState(claimSlot);
  const [seed] = useState(() => Math.random());
  useEffect(() => () => releaseSlot(slot), [slot]);
  const reveal = useReveal();
  const layer = useContext(LayerContext);
  const track = useScrollTrack();

  useFrameCallback(() => {
    const m = placeOnScreen(ref, track);
    if (!m) return;
    const k = read(scale, 1);
    if (frame) frame.value = { x: m.x + read(dx, 0), y: m.y + read(dy, 0), w: m.w, h: m.h };
    writeShape(slot, {
      cx: m.x + m.w / 2 + read(dx, 0),
      cy: m.y + m.h / 2 + read(dy, 0),
      hw: (m.w / 2) * k,
      hh: (m.h / 2) * k,
      radius: radius * k,
      presence: Math.max(0, read(presence, 1)) * (reveal ? reveal.value : 1) * m.inView,
      melt: read(melt, 0),
      lift: read(lift, 0.5),
      sx: read(sx, 1),
      sy: read(sy, 1),
      wobble,
      seed,
      pearl: read(pearl, 0),
      warm: read(warm, 0),
      layer,
    });
  });

  const contentStyle = useAnimatedStyle(() => {
    // The content belongs to the glass: it grows from the same centre at the
    // same rate as the shape (the shader scales shapes by presence) and
    // condenses into view as the body forms, so it is never outside it.
    const p = Math.max(0, Math.min(1, read(presence, 1) * (reveal ? reveal.value : 1)));
    const grow = fadeContent ? 0.2 + 0.8 * p : 1;
    return {
      opacity: fadeContent ? Math.max(0, Math.min(1, (p - 0.5) / 0.4)) : 1,
      transform: [
        { translateX: read(dx, 0) },
        { translateY: read(dy, 0) },
        { scale: read(scale, 1) * grow },
        { scaleX: read(sx, 1) },
        { scaleY: read(sy, 1) },
      ],
    };
  });

  return (
    <View ref={ref} style={style} collapsable={false} pointerEvents={pointerEvents}>
      <Animated.View style={[styles.content, inner, contentStyle]} pointerEvents="box-none">
        <LayerContext.Provider value={Math.min(1, layer + 1)}>{children}</LayerContext.Provider>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
});
