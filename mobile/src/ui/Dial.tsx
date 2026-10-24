// An instrument dial: a gently curved scale of fine ticks that glides under a
// fixed, glowing needle. Drag it, flick it; it settles on a value with a tick
// you can feel at every step.

import { BlurMask, Canvas, Circle, Group, Line, Path, Skia, Text, useFont, vec } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { useAnimatedReaction, useDerivedValue, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { feel } from '../feel/feel';
import { useTheme } from '../theme/theme';
import type { Rgb } from '../theme/tokens';

interface Props {
  values: readonly number[];
  index: number;
  onChange: (index: number) => void;
  label: (value: number, index: number) => string | null;
  /** Points of travel per step. */
  step?: number;
  /** Fine ticks between steps. */
  subdivisions?: number;
  height?: number;
}

const ARC_R = 760;
const css = (c: Rgb, a = 1) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;

export function Dial({ values, index, onChange, label, step = 44, subdivisions = 4, height = 118 }: Props) {
  const p = useTheme();
  const font = useFont(require('@expo-google-fonts/urbanist/300Light_Italic/Urbanist_300Light_Italic.ttf'), 11);
  const [width, setWidth] = useState(0);
  const pos = useSharedValue(index);
  const start = useSharedValue(index);
  const n = values.length;

  useEffect(() => {
    if (Math.round(pos.value) !== index) pos.value = withSpring(index, { damping: 20, stiffness: 160 });
  }, [index]);

  useAnimatedReaction(
    () => Math.round(Math.max(0, Math.min(n - 1, pos.value))),
    (now, before) => {
      if (before === null || now === before) return;
      scheduleOnRN(feel.tick);
      scheduleOnRN(onChange, now);
    },
  );

  const settled = useSharedValue(true);
  const pan = usePanGesture({
    minDistance: 2,
    onBegin: () => {
      'worklet';
      settled.value = false;
      start.value = pos.value;
    },
    // a cancelled drag still lands on a value
    onFinalize: () => {
      'worklet';
      if (!settled.value) pos.value = withSpring(Math.round(Math.max(0, Math.min(n - 1, pos.value))), { damping: 18, stiffness: 140 });
      settled.value = true;
    },
    onUpdate: (e) => {
      'worklet';
      const raw = start.value - e.translationX / step;
      // rubber band beyond the ends
      pos.value = raw < 0 ? raw * 0.3 : raw > n - 1 ? n - 1 + (raw - n + 1) * 0.3 : raw;
    },
    onDeactivate: (e) => {
      'worklet';
      settled.value = true;
      const target = Math.round(Math.max(0, Math.min(n - 1, pos.value - (e.velocityX / step) * 0.16)));
      pos.value = withSpring(target, { damping: 18, stiffness: 140, mass: 1, velocity: -e.velocityX / step });
    },
  });

  const cx = width / 2;
  const cy = ARC_R + 46; // arc crest sits 46pt from the top
  const deg = (step / ARC_R) * (180 / Math.PI); // one step, as an angle on the arc

  const ticks = useDerivedValue(() => {
    const path = Skia.PathBuilder.Make();
    const first = Math.floor(pos.value) - 12;
    for (let i = first * subdivisions; i <= (first + 25) * subdivisions; i++) {
      const v = i / subdivisions;
      if (v < 0 || v > n - 1) continue;
      const a = ((v - pos.value) * deg * Math.PI) / 180;
      if (Math.abs(a) > 0.32) continue;
      const major = i % subdivisions === 0;
      const len = major ? 12 : 6;
      const sin = Math.sin(a);
      const cos = Math.cos(a);
      path.moveTo(cx + ARC_R * sin, cy - ARC_R * cos);
      path.lineTo(cx + (ARC_R + len) * sin, cy - (ARC_R + len) * cos);
    }
    return path.detach();
  });

  const arc = useMemo(() => {
    const path = Skia.PathBuilder.Make();
    if (width) path.addArc({ x: cx - ARC_R, y: cy - ARC_R, width: ARC_R * 2, height: ARC_R * 2 }, 270 - 18, 36);
    return path.detach();
  }, [width]);

  const labels = useMemo(() => values.map((v, i) => label(v, i)), [values, label]);
  const widths = useMemo(() => labels.map((l) => (font && l ? font.measureText(l).width : 0)), [labels, font]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.wrap, { height }]} onLayout={onLayout} accessibilityRole="adjustable"
        accessibilityValue={{ text: labels[index] ?? String(values[index]) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const next = e.nativeEvent.actionName === 'increment' ? Math.min(n - 1, index + 1) : Math.max(0, index - 1);
          onChange(next);
        }}
      >
        {width > 0 && (
          <Canvas style={StyleSheet.absoluteFill}>
            <Path path={arc} style="stroke" strokeWidth={1} color={p.inkSoft} />
            <Path path={ticks} style="stroke" strokeWidth={0.9} strokeCap="round" color={p.inkFaint} />
            {font && labels.map((l, i) => (l ? (
              <DialLabel key={i} i={i} text={l} w={widths[i]} pos={pos} cx={cx} cy={cy} deg={deg} font={font} color={p.inkSoft} />
            ) : null))}
            {/* the needle and its light */}
            <Line p1={vec(cx, cy - ARC_R + 2)} p2={vec(cx, cy - ARC_R - 26)} color={p.ink} strokeWidth={1.2} strokeCap="round" />
            <Group>
              <Circle cx={cx} cy={cy - ARC_R} r={9} color={css(p.spark, 0.55)}>
                <BlurMask blur={8} style="normal" />
              </Circle>
              <Circle cx={cx} cy={cy - ARC_R} r={3.2} color="#FFFBF5" />
            </Group>
          </Canvas>
        )}
      </View>
    </GestureDetector>
  );
}

function DialLabel({ i, text, w, pos, cx, cy, deg, font, color }: {
  i: number; text: string; w: number; pos: { value: number }; cx: number; cy: number; deg: number;
  font: NonNullable<ReturnType<typeof useFont>>; color: string;
}) {
  const transform = useDerivedValue(() => {
    const a = (i - pos.value) * deg;
    const r = ARC_R - 16;
    const rad = (a * Math.PI) / 180;
    const x = cx + r * Math.sin(rad);
    const y = cy - r * Math.cos(rad);
    return [{ translateX: x }, { translateY: y }, { rotate: rad }];
  });
  const opacity = useDerivedValue(() => {
    const a = Math.abs((i - pos.value) * deg);
    return Math.max(0, 1 - a / 17) * (Math.abs(i - pos.value) < 0.5 ? 1 : 0.75);
  });
  return (
    <Group transform={transform} opacity={opacity}>
      <Text x={-w / 2} y={11} text={text} font={font} color={color} />
    </Group>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
});
