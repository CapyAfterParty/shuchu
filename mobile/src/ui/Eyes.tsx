// Shu, the drop. Shuchu's companion is the glass itself: two small eyes are
// all it takes for the drop to be someone. They live inside the glass,
// blink at an unhurried, irregular pace, glance about, and change mood:
//
//   awake  ● ●   round, curious
//   happy  ◠ ◠   when something good just happened
//   sleepy ◡ ◡   when there is nothing to do
//
// Eyes can sit inside any view (they fill it), or follow a free glass shape
// via `follow` (centre and half size), for the heroes that morph.

import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme/theme';

export type Mood = 'awake' | 'happy' | 'sleepy';

interface Follow {
  cx: SharedValue<number>; cy: SharedValue<number>;
  hw: SharedValue<number>; hh: SharedValue<number>;
  presence: SharedValue<number>;
}

export function Eyes({ size = 64, mood = 'awake', follow, show, gaze, watch = null }: {
  /** Width of the body the eyes sit in (when not following a shape). */
  size?: number;
  mood?: Mood;
  follow?: Follow;
  /** 0..1, extra visibility on top of the shape's presence. */
  show?: SharedValue<number>;
  /** Where to look, -1..1 on each axis. */
  gaze?: SharedValue<{ x: number; y: number }>;
  /** Something to keep looking at (e.g. the words you are typing); null to look about freely. */
  watch?: { x: number; y: number } | null;
}) {
  const p = useTheme();
  const lid = useSharedValue(1); // 1 open, 0 shut
  const look = useSharedValue({ x: 0, y: 0 });
  const watching = useRef(watch);
  useEffect(() => {
    watching.current = watch;
    look.value = withTiming(watch ?? { x: 0, y: 0 }, { duration: watch ? 240 : 420 });
  }, [watch?.x, watch?.y]);

  // Blinks come at 2.5 to 6 s, now and then a double blink. Glances are rarer.
  useEffect(() => {
    let alive = true;
    let t: ReturnType<typeof setTimeout>;
    const blink = () => {
      if (!alive) return;
      const twice = Math.random() < 0.22;
      lid.value = twice
        ? withSequence(withTiming(0, { duration: 70 }), withTiming(1, { duration: 110 }), withDelay(90, withTiming(0, { duration: 70 })), withTiming(1, { duration: 130 }))
        : withSequence(withTiming(0, { duration: 80 }), withTiming(1, { duration: 140 }));
      if (!gaze && !watching.current && Math.random() < 0.4) {
        const x = (Math.random() - 0.5) * 1.4;
        const y = (Math.random() - 0.5) * 0.8;
        look.value = withTiming({ x, y }, { duration: 260 });
      }
      t = setTimeout(blink, 2500 + Math.random() * 3500);
    };
    t = setTimeout(blink, 900 + Math.random() * 1200);
    return () => { alive = false; clearTimeout(t); };
  }, []);

  const ink = p.name === 'night' ? 'rgba(232,240,248,0.92)' : 'rgba(23,33,44,0.78)';

  const frame = useAnimatedStyle(() => {
    if (!follow) return {};
    const w = follow.hw.value * 2 * Math.max(follow.presence.value, 0.001);
    const h = follow.hh.value * 2 * Math.max(follow.presence.value, 0.001);
    return {
      position: 'absolute',
      left: follow.cx.value - w / 2,
      top: follow.cy.value - h / 2,
      width: w,
      height: h,
    };
  });

  const body = useAnimatedStyle(() => {
    const w = follow ? follow.hw.value * 2 * follow.presence.value : size;
    const g = gaze ? gaze.value : look.value;
    const seen = (follow ? Math.max(0, (follow.presence.value - 0.6) / 0.4) : 1) * (show ? show.value : 1);
    return {
      opacity: seen,
      gap: w * 0.2,
      transform: [{ translateX: g.x * w * 0.07 }, { translateY: g.y * w * 0.05 - w * 0.03 }],
    };
  });

  const eye = useAnimatedStyle(() => {
    const w = follow ? follow.hw.value * 2 * follow.presence.value : size;
    const e = Math.max(3, w * 0.088);
    return {
      width: mood === 'awake' ? e : e * 1.6,
      height: mood === 'awake' ? e * 1.35 : e * 0.8,
      borderRadius: e,
      transform: [{ scaleY: mood === 'awake' ? Math.max(0.08, lid.value) : 1 }],
    };
  });

  // a tiny catchlight makes the eyes look alive; a blush when happy
  const glint = useAnimatedStyle(() => {
    const w = follow ? follow.hw.value * 2 * follow.presence.value : size;
    const e = Math.max(3, w * 0.088);
    const d = Math.max(1.2, e * 0.34);
    return { width: d, height: d, borderRadius: d, top: e * 0.16, right: e * 0.14, opacity: lid.value > 0.5 ? 1 : 0 };
  });
  const blush = useAnimatedStyle(() => {
    const w = follow ? follow.hw.value * 2 * follow.presence.value : size;
    const e = Math.max(3, w * 0.088);
    return { width: e * 1.9, height: e * 0.85, borderRadius: e, top: e * 1.05, marginLeft: -e * 0.15 };
  });
  const night = p.name === 'night';

  return (
    <Animated.View style={[follow ? null : StyleSheet.absoluteFill, frame, styles.center]} pointerEvents="none">
      <Animated.View style={[styles.row, body]}>
        {[0, 1].map((i) => (
          <View key={i} style={styles.eyeSpot}>
            {mood === 'happy' && <Animated.View style={[styles.blush, blush, { backgroundColor: night ? 'rgba(255,150,120,0.22)' : 'rgba(255,140,120,0.32)' }]} />}
            {mood === 'awake'
              ? (
                <Animated.View style={[eye, { backgroundColor: ink }]}>
                  {!night && <Animated.View style={[styles.glint, glint]} />}
                </Animated.View>
              )
              : <Animated.View style={[eye, styles.arc, mood === 'happy' ? { borderTopWidth: 2, borderColor: ink } : { borderBottomWidth: 2, borderColor: ink }]} />}
          </View>
        ))}
      </Animated.View>
    </Animated.View>
  );
}

/** A tiny standalone drop face for static places, e.g. a list that's empty. */
export function EyesInline({ size, mood }: { size: number; mood: Mood }) {
  return (
    <View style={{ width: size, height: size }}>
      <Eyes size={size} mood={mood} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  arc: { backgroundColor: 'transparent' },
  eyeSpot: { alignItems: 'center' },
  glint: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.92)' },
  blush: { position: 'absolute' },
});
