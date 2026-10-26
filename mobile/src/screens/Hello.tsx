// Hello: the moment between opening Shuchu and using it.
//
// Dew drifts in out of the mist and melts into a drop. The drop opens its
// eyes, gives a small bounce, and says hello for the time of day. Then it
// flows into the capture stone, which condenses around it, and you're in.
// About two and a half seconds; a touch anywhere skips straight to the end.

import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { feel } from '../feel/feel';
import { useShape } from '../scene/useShape';
import { ripple, stoneFrame } from '../scene/world';
import { spring } from '../theme/tokens';
import { Eyes } from '../ui/Eyes';
import { Headline } from '../ui/Headline';
import { glide, melt } from '../ui/motion';
import { Txt } from '../ui/Txt';

const DEW = 6;

export function greeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning.';
  if (hour >= 12 && hour < 17) return 'Good afternoon.';
  if (hour >= 17 && hour < 22) return 'Good evening.';
  return 'Still up?';
}

export function Hello({ waiting, fromSplash = false, onLeave, onGone }: {
  /** How many thoughts are waiting, said quietly under the greeting. */
  waiting: number;
  /** On launch the drop is already there (it is the launch screen's), so it just wakes up. */
  fromSplash?: boolean;
  /** The drop starts flowing into the stone: bring the capture screen in. */
  onLeave: () => void;
  /** Fully handed over: unmount. */
  onGone: () => void;
}) {
  const { width: W, height: H } = useWindowDimensions();
  const R = Math.min(W * 0.17, 68);
  const cx = W / 2;
  const cy = H / 2; // where the launch screen draws the drop

  const start = fromSplash ? R : R * 0.3;
  const drop = useShape({ cx, cy, hw: start, hh: start * 0.95, radius: R, presence: fromSplash ? 1 : 0, melt: 34, lift: 0.75, pearl: 0.2, warm: 0.15 }, 1.8);
  const dew = Array.from({ length: DEW }, () => useShape({ cx, cy, hw: 6, hh: 6, radius: 6, presence: 0, melt: 34, lift: 0.45 }, 0.6));
  const [seeds] = useState(() => Array.from({ length: DEW }, (_, i) => ({
    angle: (i / DEW) * Math.PI * 2 + Math.random() * 0.8,
    from: Math.max(W, H) * (0.32 + Math.random() * 0.18),
    size: 5 + Math.random() * 7,
    spin: (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.6),
  })));

  const gather = useSharedValue(0); // dew: 0 far out in the mist, 1 melted into the drop
  const leave = useSharedValue(0); // 0 a drop, 1 the stone
  const words = useSharedValue(0);
  const eyes = useSharedValue(0);
  const [phase, setPhase] = useState<'forming' | 'here' | 'leaving'>('forming');
  const gone = useRef(false);

  useFrameCallback(() => {
    const g = gather.value;
    const l = leave.value;
    // the drop: grows from the gathered dew, then flows into wherever the stone is
    const s = stoneFrame.value;
    const toX = s.w ? s.x + s.w / 2 : cx;
    const toY = s.w ? s.y + s.h / 2 : H / 2;
    const toW = s.w ? s.w / 2 : W / 2 - 18;
    const toH = s.w ? s.h / 2 : 88;
    const size = R * (0.3 + 0.7 * Math.min(1, g * 1.15));
    drop.cx.value = cx + (toX - cx) * l;
    drop.cy.value = cy + (toY - cy) * l;
    drop.hw.value = size + (toW - size) * l;
    drop.hh.value = size * 0.95 + (toH - size * 0.95) * l;
    drop.radius.value = R + (52 - R) * l;
    for (let i = 0; i < DEW; i++) {
      const d = seeds[i];
      const k = Math.pow(1 - g, 1.6);
      const ang = d.angle + d.spin * g * 2.4;
      const r = d.from * k + R * 0.3 * (1 - k);
      dew[i].cx.value = cx + Math.cos(ang) * r;
      dew[i].cy.value = cy + Math.sin(ang) * r * 0.9;
      dew[i].hw.value = d.size * (1 + g * 0.6);
      dew[i].hh.value = d.size * (1 + g * 0.6);
      dew[i].radius.value = d.size * (1 + g * 0.6);
      dew[i].presence.value = Math.min(1, g * 6) * (g > 0.88 ? 1 - (g - 0.88) / 0.12 : 1);
    }
  });

  const handOver = () => {
    if (gone.current) return;
    gone.current = true;
    setPhase('leaving');
    words.value = withTiming(0, { duration: 260, easing: melt });
    eyes.value = withTiming(0, { duration: 220 });
    gather.value = withTiming(1, { duration: 200 });
    drop.presence.value = 1;
    drop.pearl.value = withTiming(0, { duration: 600 });
    drop.warm.value = withTiming(0, { duration: 600 });
    leave.value = withSpring(1, { damping: 20, stiffness: 120, mass: 1 });
    onLeave();
    // the stone condenses around the drop; then the drop dissolves into it
    drop.presence.value = withDelay(520, withTiming(0, { duration: 420, easing: melt }));
    setTimeout(onGone, 1000);
  };

  useEffect(() => {
    const formed = fromSplash ? 350 : 1150;
    if (fromSplash) {
      gather.value = 1;
      drop.presence.value = 1;
      eyes.value = 1; // the launch screen's drop already has its eyes open
    } else {
      gather.value = withTiming(1, { duration: 1150, easing: Easing.inOut(Easing.cubic) });
      drop.presence.value = withDelay(250, withTiming(1, { duration: 800, easing: glide }));
    }
    const t1 = setTimeout(() => {
      if (gone.current) return;
      setPhase('here');
      feel.touch();
      ripple(cx, cy, 0.7);
      // a small hop of joy: squash, stretch, settle
      drop.sy.value = withSequence(withTiming(0.86, { duration: 110 }), withSpring(1, spring.jelly));
      drop.sx.value = withSequence(withTiming(1.1, { duration: 110 }), withSpring(1, spring.jelly));
      eyes.value = withTiming(1, { duration: 260 });
      words.value = withTiming(1, { duration: 500 });
    }, formed);
    const t2 = setTimeout(handOver, formed + 1550);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const wordsStyle = useAnimatedStyle(() => ({ opacity: words.value }));

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={handOver} accessibilityRole="button" accessibilityLabel="Continue">
      <Eyes follow={drop} show={eyes} />
      <Animated.View style={[styles.words, { top: cy + R + 28 }, wordsStyle]} pointerEvents="none">
        {phase !== 'forming' && <Headline text={greeting(new Date().getHours())} stagger={110} />}
        {phase !== 'forming' && waiting > 0 && (
          <View style={styles.count}>
            <Txt variant="whisper" tone="soft" align="center">{waiting} waiting</Txt>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  words: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  count: { marginTop: 10 },
});
