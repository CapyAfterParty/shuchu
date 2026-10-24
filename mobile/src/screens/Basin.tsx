// The basin: everything you've caught rests here as small glass pebbles.
// Bigger pebble, longer task. A new thought pinches off the stone like a
// drop, falls, squashes on landing and sends a ripple through the mist.

import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  measure,
  type SharedValue,
  useAnimatedRef,
  useFrameCallback,
  useSharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { Task } from '../../../shared/task';
import { feel } from '../feel/feel';
import type { Frame } from '../scene/Glass';
import { claimSlot, releaseSlot, ripple, writeShape } from '../scene/world';
import { spring } from '../theme/tokens';
import { Txt } from '../ui/Txt';

const MAX = 7;
const GAP = 12;

export function pebbleSize(task: Task): { w: number; h: number } {
  const m = Math.min(task.estimateMinutes ?? 25, 120);
  const d = 30 + 30 * Math.sqrt(m / 120);
  const errand = task.place === 'errand';
  return { w: d * (errand ? 1 : 1.16), h: d * (errand ? 1 : 0.92) };
}

interface Props {
  tasks: Task[];
  /** Where a new pebble is born (the stone). */
  origin: SharedValue<Frame>;
  /** The task that was just caught, if any. */
  arriving: string | null;
  onPress: () => void;
  /** 0..1, how present the basin is (it is absorbed when sheets open). */
  presence: SharedValue<number>;
  height?: number;
}

export function Basin({ tasks, origin, arriving, onPress, presence, height = 96 }: Props) {
  const ref = useAnimatedRef<View>();
  const box = useSharedValue<Frame>({ x: 0, y: 0, w: 0, h: 0 });
  useFrameCallback(() => {
    const m = measure(ref);
    if (m) box.value = { x: m.pageX, y: m.pageY, w: m.width, h: m.height };
  });

  // as many pebbles as fit comfortably across the screen
  const { width } = useWindowDimensions();
  const room = width - 56;
  const shown: Task[] = [];
  let used = 0;
  for (const t of tasks.slice(0, MAX)) {
    const w = pebbleSize(t).w + (shown.length ? GAP : 0);
    if (used + w > room) break;
    used += w;
    shown.push(t);
  }
  const layout = useMemo(() => {
    let x = 0;
    return shown.map((t) => {
      const s = pebbleSize(t);
      const slot = { id: t.id, x: x + s.w / 2, ...s };
      x += s.w + GAP;
      return slot;
    });
  }, [shown.map((t) => `${t.id}:${t.estimateMinutes}:${t.place}`).join('|')]);
  const rowWidth = layout.length ? layout[layout.length - 1].x + layout[layout.length - 1].w / 2 : 0;

  const desk = tasks.filter((t) => t.place !== 'errand').length;
  const errands = tasks.length - desk;
  const words = tasks.length === 0
    ? 'nothing waiting · your head is clear'
    : [desk && `${desk} at your desk`, errands && `${errands} out and about`].filter(Boolean).join(' · ');

  // swipe up to open: the pebbles lift under your finger
  const drag = useSharedValue(0);
  const opened = useSharedValue(0);
  const pan = usePanGesture({
    activeOffsetY: [-10, 10],
    failOffsetX: [-24, 24],
    onUpdate: (e) => {
      'worklet';
      drag.value = Math.min(0, e.translationY) * 0.45;
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY < -50 || e.velocityY < -600) opened.value += 1;
    },
    onFinalize: () => {
      'worklet';
      drag.value = withSpring(0, spring.jelly);
    },
  });
  useAnimatedReaction(
    () => opened.value,
    (now, before) => {
      if (before !== null && now > before) scheduleOnRN(onPress);
    },
  );

  const wordsStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, (presence.value - 0.4) / 0.6),
    transform: [{ translateY: drag.value * 0.5 }],
  }));

  return (
    <GestureDetector gesture={pan}>
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open inbox. ${words}`} accessibilityHint="Swipe up or tap" style={{ height }}>
      <View ref={ref} collapsable={false} style={styles.row}>
        {layout.map((l, i) => (
          <Pebble
            key={l.id}
            task={shown[i]}
            target={{ x: l.x, w: l.w, h: l.h }}
            rowWidth={rowWidth}
            box={box}
            origin={origin}
            fresh={l.id === arriving || Date.now() - Date.parse(shown[i].createdAt) < 1500}
            order={i}
            presence={presence}
            drag={drag}
          />
        ))}
      </View>
      <Animated.View style={[styles.words, wordsStyle]}>
        <Txt variant="whisper" tone="soft" align="center">{words}</Txt>
      </Animated.View>
    </Pressable>
    </GestureDetector>
  );
}

function Pebble({
  task, target, rowWidth, box, origin, fresh, order, presence, drag,
}: {
  task: Task;
  target: { x: number; w: number; h: number };
  rowWidth: number;
  box: SharedValue<Frame>;
  origin: SharedValue<Frame>;
  fresh: boolean;
  order: number;
  presence: SharedValue<number>;
  drag: SharedValue<number>;
}) {
  const [slot] = useState(claimSlot);
  const [seed] = useState(() => Math.random());
  useEffect(() => () => releaseSlot(slot), [slot]);

  // Position relative to the row's centre line, so the whole row stays centred.
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const grow = useSharedValue(0);
  const flying = useSharedValue(fresh ? 1 : 0);
  const melt = useSharedValue(fresh ? 36 : 14);
  const last = useSharedValue({ x: 0, y: 0, vy: 0 });
  const landed = useSharedValue(!fresh);
  const placed = useSharedValue(false);

  const tx = target.x - rowWidth / 2;

  useEffect(() => {
    if (!placed.value) {
      placed.value = true;
      if (fresh) {
        // Born inside the stone, then let go.
        const o = origin.value;
        const b = box.value;
        x.value = o.x + o.w * 0.5 - (b.x + b.w / 2);
        y.value = o.y + o.h * 0.62 - (b.y + b.h / 2 - 12);
        grow.value = withTiming(1, { duration: 380 });
        x.value = withDelay(220, withSpring(tx, spring.drop));
        y.value = withDelay(220, withSpring(0, spring.drop));
        melt.value = withDelay(520, withTiming(14, { duration: 500 }));
      } else {
        x.value = tx;
        y.value = 0;
        grow.value = withDelay(order * 70, withSpring(1, spring.settle));
      }
      return;
    }
    x.value = withSpring(tx, spring.settle);
  }, [tx]);

  useFrameCallback(() => {
    const b = box.value;
    if (!b.w) return;
    const px = x.value;
    const py = y.value;
    const vy = py - last.value.y;
    last.value = { x: px, y: py, vy };

    // squash and stretch with speed
    const speed = Math.min(Math.abs(vy) * 0.045, 0.32);
    let sy = 1 + speed;
    let sx = 1 / sy;
    if (flying.value > 0 && !landed.value && Math.abs(py) < 2 && Math.abs(vy) < 0.6 && grow.value > 0.95) {
      landed.value = true;
      flying.value = 0;
      ripple(b.x + b.w / 2 + px, b.y + b.h / 2 - 12 + py, 0.9);
      scheduleOnRN(feel.land, 1);
    }
    if (vy < -0.5 && Math.abs(py) < 6) { sy = 0.86; sx = 1.12; } // bounce flattening

    const k = presence.value;
    writeShape(slot, {
      cx: b.x + b.w / 2 + px,
      cy: b.y + b.h / 2 - 12 + py + drag.value * (1 + (order % 3) * 0.15),
      hw: target.w / 2,
      hh: target.h / 2,
      radius: Math.min(target.w, target.h) / 2,
      presence: grow.value * k,
      melt: melt.value,
      lift: 0.35,
      sx, sy,
      wobble: 1.6,
      seed,
      pearl: task.place === 'errand' ? 0.12 : 0.28,
      warm: task.place === 'errand' ? 0.32 : 0,
    });
  });

  return null;
}

const styles = StyleSheet.create({
  row: { flex: 1 },
  words: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});

