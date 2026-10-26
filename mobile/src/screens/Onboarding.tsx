// The welcome. One shape of glass travels through every beat: a drop held in
// your hand, the stone you speak into, the desk it waits at, the evening moon.
//
// Layout is ordinary flowing columns, so it fits any screen. The glass and the
// light don't have fixed positions: each beat marks a placeholder, and every
// frame the glass springs towards wherever that placeholder actually is.

import { type ComponentRef, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedKeyboard,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { updateSettings, useSettings } from '../data/settings';
import { catchThought } from '../data/tasks';
import { askPermission, formatClock } from '../feel/evening';
import { feel } from '../feel/feel';
import type { Frame } from '../scene/Glass';
import { type FreeShape, useShape } from '../scene/useShape';
import { claimSpark, releaseSpark, ripple, writeSpark } from '../scene/world';
import { useTheme, useTypeScale } from '../theme/theme';
import { font, spring, type as T } from '../theme/tokens';
import { Dial } from '../ui/Dial';
import { GlassButton } from '../ui/GlassButton';
import { glide, melt, Reveal, RevealContext } from '../ui/motion';
import { placeOnScreen, ScrollArea, useScrollTrack } from '../ui/ScrollArea';
import { Eyes } from '../ui/Eyes';
import { Headline } from '../ui/Headline';
import { Txt } from '../ui/Txt';
import { EVENING } from './Settings';

type Beat = 'arrive' | 'catch' | 'desk' | 'evening' | 'clear';
const ORDER: Beat[] = ['arrive', 'catch', 'desk', 'evening', 'clear'];

/** Where the hero glass and the light should be. Beats write it; the stage follows. */
interface Stage {
  target: SharedValue<Frame>;
  radius: SharedValue<number>;
  /** The light's place inside the target, 0..1 on each axis. */
  anchor: SharedValue<{ x: number; y: number }>;
  hero: FreeShape;
  pebble: FreeShape;
  spark: { i: SharedValue<number>; r: SharedValue<number>; boost: SharedValue<number>; x: SharedValue<number>; y: SharedValue<number> };
  /** Dew: small drops around the hero that gather into it, fly off it and fall back. */
  drops: { show: SharedValue<number>; gather: SharedValue<number>; burst: SharedValue<number>; splash: SharedValue<number> };
}

const DROPS = 7;

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { width: W, height: H } = useWindowDimensions();
  const [beat, setBeat] = useState<Beat>('arrive');
  const hero = useShape({ cx: W / 2, cy: H * 0.5, hw: 2, hh: 2, radius: 2, presence: 0, melt: 30, lift: 0.7 }, 2.4);
  const pebble = useShape({ cx: W / 2, cy: H * 0.5, hw: 20, hh: 18, radius: 18, presence: 0, melt: 38, lift: 0.4, pearl: 0.3 }, 1.5);

  const target = useSharedValue<Frame>({ x: W / 2, y: H / 2, w: 0, h: 0 });
  const radius = useSharedValue(2);
  const anchor = useSharedValue({ x: 0.5, y: 0.5 });
  const sparkX = useSharedValue(W / 2);
  const sparkY = useSharedValue(H / 2);
  const sparkI = useSharedValue(0);
  const sparkR = useSharedValue(6);
  const sparkBoost = useSharedValue(0);
  const breath = useSharedValue(1);
  const vel = useSharedValue({ cx: 0, cy: 0, hw: 0, hh: 0, r: 0, sx: 0, sy: 0 });
  const [sparkSlot] = useState(claimSpark);
  useEffect(() => () => releaseSpark(sparkSlot), [sparkSlot]);

  // Dew. Each drop has its own orbit, size and pace, so the swarm never looks mechanical.
  const drops = Array.from({ length: DROPS }, () => useShape({ presence: 0, melt: 30, lift: 0.45, hw: 6, hh: 6, radius: 6 }, 0.8));
  const [dew] = useState(() => Array.from({ length: DROPS }, (_, i) => ({
    angle: (i / DROPS) * Math.PI * 2 + Math.random() * 0.6,
    orbit: 64 + Math.random() * 70,
    size: 5 + Math.random() * 7,
    pace: (0.16 + Math.random() * 0.14) * (i % 2 ? 1 : -1),
    bob: Math.random() * Math.PI * 2,
    fling: 0.7 + Math.random() * 0.8,
  })));
  const dropShow = useSharedValue(0);
  const dropGather = useSharedValue(0);
  const dropBurst = useSharedValue(0);
  const dropSplash = useSharedValue(0);
  const clock = useSharedValue(0);
  useFrameCallback((info) => {
    clock.value += Math.min(info.timeSincePreviousFrame ?? 16, 50) / 1000;
    const t = clock.value;
    const cx = hero.cx.value;
    const cy = hero.cy.value;
    const body = Math.max(hero.hw.value, hero.hh.value);
    const g = dropGather.value;
    const b = dropBurst.value;
    const sp = dropSplash.value;
    for (let i = 0; i < DROPS; i++) {
      const d = dew[i];
      // gathering spins the swarm inwards, faster as it closes, like water down a drain
      const ang = d.angle + t * d.pace * (1 + g * 5) + g * g * 4 * Math.sign(d.pace);
      const home = d.orbit * Math.pow(1 - g, 1.4) + body * 0.35 * g;
      const out = b * (body + d.orbit * 2.4 * d.fling) + sp * (body * 0.55 + 26 * d.fling);
      const r = home + out;
      const wobble = Math.sin(t * 0.9 + d.bob) * 6 * (1 - g);
      drops[i].cx.value = cx + Math.cos(ang) * (r + wobble);
      drops[i].cy.value = cy + Math.sin(ang) * (r + wobble) * 0.86 + b * b * 40 * d.fling;
      const size = d.size * (1 + g * 0.5) * (1 - b * 0.55) * (1 + sp * 0.25);
      drops[i].hw.value = size;
      drops[i].hh.value = size * (1 - 0.12 * Math.abs(Math.sin(t * 1.3 + d.bob)));
      drops[i].radius.value = size;
      // absorbed into the hero at the end of gathering, dissolving at the end of a burst
      // (a splash or burst pulls them back out of the hero first)
      const absorbed = (g > 0.85 ? (g - 0.85) / 0.15 : 0) * (1 - Math.min(1, (sp + b) * 4));
      drops[i].presence.value = dropShow.value * (1 - absorbed) * (1 - b * b);
    }
  });

  // A soft spring per frame: the glass flows to its target and overshoots a
  // touch, like something liquid settling. The light rides along inside it.
  useFrameCallback((info) => {
    const dt = Math.min((info.timeSincePreviousFrame ?? 16) / 1000, 0.05);
    const t = target.value;
    const round = Math.min(t.w, t.h) / 2;
    const goal = { cx: t.x + t.w / 2, cy: t.y + t.h / 2, hw: t.w / 2, hh: t.h / 2, r: radius.value < 0 ? round : Math.min(radius.value, round) };
    const v = { ...vel.value };
    const step = (x: number, g: number, key: 'cx' | 'cy' | 'hw' | 'hh' | 'r') => {
      v[key] = (v[key] + (g - x) * 170 * dt) * Math.exp(-15 * dt);
      return x + v[key] * dt;
    };
    hero.cx.value = step(hero.cx.value, goal.cx, 'cx');
    hero.cy.value = step(hero.cy.value, goal.cy, 'cy');
    hero.hw.value = step(hero.hw.value, goal.hw, 'hw');
    hero.hh.value = step(hero.hh.value, goal.hh, 'hh');
    hero.radius.value = Math.max(0, step(hero.radius.value, goal.r, 'r'));
    vel.value = v;
    const a = anchor.value;
    const k = 1 - Math.exp(-9 * dt);
    sparkX.value += (t.x + t.w * a.x - sparkX.value) * k;
    sparkY.value += (t.y + t.h * a.y - sparkY.value) * k;
    writeSpark(sparkSlot, sparkX.value, sparkY.value, sparkI.value * breath.value + sparkBoost.value, sparkR.value);
  });

  useEffect(() => {
    breath.value = withRepeat(withSequence(withTiming(1.12, { duration: 2400 }), withTiming(0.9, { duration: 2400 })), -1, true);
  }, []);

  const stage: Stage = {
    target, radius, anchor, hero, pebble,
    spark: { i: sparkI, r: sparkR, boost: sparkBoost, x: sparkX, y: sparkY },
    drops: { show: dropShow, gather: dropGather, burst: dropBurst, splash: dropSplash },
  };

  // Between beats the words breathe out first, then the next beat condenses
  // in, while the glass flings a few drops that fall back as it changes shape.
  const fade = useSharedValue(1);
  const switching = useRef(false);
  const go = useCallback((b: Beat) => {
    if (switching.current) return;
    switching.current = true;
    fade.value = withTiming(0, { duration: 300, easing: melt });
    if (b !== 'clear') {
      dropShow.value = withSequence(withTiming(1, { duration: 120 }), withDelay(520, withTiming(0, { duration: 380 })));
      dropSplash.value = withSequence(withTiming(1, { duration: 300, easing: glide }), withTiming(0, { duration: 700, easing: Easing.in(Easing.quad) }));
      dropGather.value = 1; // they leave from inside the glass
    }
    setTimeout(() => {
      setBeat(b);
      fade.value = 1;
      switching.current = false;
    }, 320);
  }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const step = ORDER.indexOf(beat);

  return (
    <View style={StyleSheet.absoluteFill}>
      <RevealContext.Provider value={fade}>
        <Animated.View style={[StyleSheet.absoluteFill, fadeStyle]} pointerEvents="box-none">
          {beat === 'arrive' && <Arrive stage={stage} onNext={() => go('catch')} />}
          {beat === 'catch' && <CatchBeat stage={stage} onNext={() => go('desk')} />}
          {beat === 'desk' && <DeskBeat stage={stage} onNext={() => go('evening')} />}
          {beat === 'evening' && <EveningBeat stage={stage} onNext={() => go('clear')} />}
          {beat === 'clear' && <ClearBeat stage={stage} onDone={onDone} />}
        </Animated.View>
      </RevealContext.Provider>
      {step > 0 && step < 4 && <TopBar step={step} onSkip={() => go('clear')} />}
    </View>
  );
}

/* ---------- layout helpers ---------- */

/** A column that centres its content and scrolls if a screen is too short. */
function Column({ children, gap, scroll = true }: { children: ReactNode; gap: number; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  // Android draws edge to edge, so both system bars are translucent
  const keyboard = useAnimatedKeyboard({ isStatusBarTranslucentAndroid: true, isNavigationBarTranslucentAndroid: true });
  const room = useAnimatedStyle(() => ({ height: Math.max(0, keyboard.height.value - insets.bottom) }));
  if (!scroll) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.column, { gap, paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]} pointerEvents="box-none">
        {children}
      </View>
    );
  }
  return (
    <ScrollArea
      style={StyleSheet.absoluteFill}
      contentContainerStyle={[styles.column, { gap, paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {children}
      {/* the keyboard takes room at the bottom, so the content re-centres above it */}
      <Animated.View style={[{ marginTop: -gap }, room]} />
    </ScrollArea>
  );
}

/** Marks where the hero glass should be; the stage follows it every frame. */
function useMark(stage: Stage, shape?: (m: Frame) => Frame) {
  const ref = useAnimatedRef<View>();
  const track = useScrollTrack();
  useFrameCallback(() => {
    const m = placeOnScreen(ref, track);
    if (!m || !m.w) return;
    const f = { x: m.x, y: m.y, w: m.w, h: m.h };
    stage.target.value = shape ? shape(f) : f;
  });
  return ref;
}

function TopBar({ step, onSkip }: { step: number; onSkip: () => void }) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.top, { top: insets.top + 14 }]} pointerEvents="box-none">
      <View style={styles.dots} accessibilityLabel={`Step ${step} of 3`}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={[styles.dotStep, { backgroundColor: i <= step ? p.inkSoft : p.inkFaint, width: i === step ? 16 : 5 }]} />
        ))}
      </View>
      <Pressable onPress={onSkip} hitSlop={14} style={styles.skip} accessibilityRole="button" accessibilityLabel="Skip the welcome">
        <Txt variant="whisper" tone="faint">skip</Txt>
      </Pressable>
    </View>
  );
}

/* ---------- 1. arrival: touch the light ---------- */

function Arrive({ stage, onNext }: { stage: Stage; onNext: () => void }) {
  const k = useTypeScale();
  const p = useTheme();
  const hold = useSharedValue(0);
  const done = useSharedValue(0);
  const [phase, setPhase] = useState(0);
  const LIGHT = 150 * k;

  // the drop grows around the light as it fills
  const mark = useMark(stage, (m) => {
    'worklet';
    const s = 6 + hold.value * 62 * (m.w / 150);
    return { x: m.x + m.w / 2 - s, y: m.y + m.h / 2 - s * 0.94, w: s * 2, h: s * 1.88 };
  });

  useEffect(() => {
    stage.anchor.value = { x: 0.5, y: 0.5 };
    stage.radius.value = -1;
    stage.spark.r.value = 6;
    stage.spark.i.value = withDelay(500, withTiming(1, { duration: 2200, easing: melt }));
    stage.drops.gather.value = 0;
    stage.drops.show.value = withDelay(900, withTiming(1, { duration: 1800, easing: melt }));
    const timers = [
      setTimeout(() => setPhase(1), 700),
      setTimeout(() => feel.heartbeat(), 1600),
      setTimeout(() => setPhase(3), 2000),
    ];
    return () => {
      timers.forEach(clearTimeout);
      stage.spark.boost.value = withTiming(0, { duration: 900 });
    };
  }, []);

  useFrameCallback(() => {
    if (done.value === 1) return;
    const h = hold.value;
    stage.drops.gather.value = h;
    stage.hero.presence.value = Math.min(1, h * 2.2);
    stage.hero.warm.value = 0.5 * h;
    stage.spark.boost.value = h * 0.9;
    stage.spark.r.value = 6 + h * 4;
  });

  // The drop is someone: once it has formed it opens its eyes, the light
  // slides to a glint on its rim, and it gives a little hop before the next beat.
  const eyesOpen = useDerivedValue(() => Math.max(0, Math.min(1, (hold.value - 0.8) / 0.2)));
  const wake = () => {
    stage.anchor.value = { x: 0.76, y: 0.74 };
    stage.hero.sy.value = withSequence(withTiming(0.88, { duration: 120 }), withSpring(1, spring.jelly));
    stage.hero.sx.value = withSequence(withTiming(1.08, { duration: 120 }), withSpring(1, spring.jelly));
    feel.touch();
    setTimeout(onNext, 1000);
  };

  useAnimatedReaction(
    () => Math.floor(hold.value * 5),
    (now, before) => {
      if (before !== null && now > before && now < 5) scheduleOnRN(feel.swell, now / 5);
      if (hold.value >= 0.999 && done.value === 0) {
        done.value = 1;
        scheduleOnRN(wake);
      }
    },
  );

  // a breathing ring invites the touch, then dissolves as the glass fills
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (phase >= 3) pulse.value = withRepeat(withTiming(1, { duration: 2600, easing: melt }), -1, false);
  }, [phase]);
  const ring = useAnimatedStyle(() => ({
    opacity: (phase >= 3 ? 0.55 : 0) * (1 - pulse.value) * (1 - hold.value),
    transform: [{ scale: 0.6 + pulse.value * 0.7 + hold.value * 0.4 }],
  }));

  // Touching anywhere is enough: the glass fills and blooms on its own,
  // so a tap, a hold, or a touch the browser interrupts all work.
  const begin = () => {
    if (hold.value > 0 || done.value === 1) return;
    feel.touch();
    const t = stage.target.value;
    ripple(t.x + t.w / 2, t.y + t.h / 2, 0.9);
    hold.value = withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.cubic) });
  };

  // In a browser, listen to the page itself: React Native Web's responder
  // drops a tap that ends before it is granted, and mice never send touches.
  // Any touch while this beat shows counts, except on the skip button.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const start = (e: Event) => {
      const el = e.target as Element | null;
      if (el?.closest?.('[aria-label="Skip the welcome"]')) return;
      begin();
    };
    const kinds = ['pointerdown', 'touchstart', 'mousedown', 'keydown'] as const;
    kinds.forEach((t) => document.addEventListener(t, start, { capture: true, passive: true }));
    return () => kinds.forEach((t) => document.removeEventListener(t, start, { capture: true }));
  }, []);

  return (
    <View
      style={StyleSheet.absoluteFill}
      // a raw touch starts it on phones; no press or release is needed
      onTouchStart={begin}
      onStartShouldSetResponder={() => { begin(); return false; }}
      accessible
      accessibilityRole="button"
      accessibilityLabel="Touch the light to begin"
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={begin}
    >
      <Eyes follow={stage.hero} show={eyesOpen} />
      <Column gap={22 * k} scroll={false}>
        <Headline text="Breathe out." delay={700} stagger={160} style={{ fontSize: 44, lineHeight: 52 }} />
        <View ref={mark} collapsable={false} style={{ width: LIGHT, height: LIGHT, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
          <Animated.View style={[styles.ring, { borderColor: p.inkSoft, width: LIGHT * 0.93, height: LIGHT * 0.93, borderRadius: LIGHT }, ring]} />
        </View>
        <Reveal show={phase >= 3} duration={900}>
          <Txt variant="whisper" tone="soft" align="center">touch the light</Txt>
        </Reveal>
      </Column>
    </View>
  );
}

/* ---------- 2. catch your first thought ---------- */

function CatchBeat({ stage, onNext }: { stage: Stage; onNext: () => void }) {
  const p = useTheme();
  const k = useTypeScale();
  const { height: H } = useWindowDimensions();
  const roomy = H > 520;
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [text, setText] = useState('');
  const [caught, setCaught] = useState(false);
  const advance = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mark = useMark(stage);

  useEffect(() => {
    stage.radius.value = 48 * k;
    stage.anchor.value = { x: 0.88, y: 0.8 };
    stage.hero.presence.value = withTiming(1, { duration: 400 });
    stage.hero.warm.value = withTiming(0, { duration: 900 });
    stage.hero.pearl.value = withTiming(0, { duration: 600 });
    stage.spark.i.value = withTiming(0.7, { duration: 900 });
    stage.spark.r.value = withTiming(5, { duration: 900 });
    const t = setTimeout(() => input.current?.focus(), 900);
    return () => {
      clearTimeout(t);
      clearTimeout(advance.current);
    };
  }, []);

  async function save(words: string) {
    const t = words.trim();
    if (!t || caught) return;
    setCaught(true);
    setText('');
    input.current?.blur();
    feel.catch();
    const { hero, pebble, spark } = stage;
    hero.sy.value = withSequence(withTiming(0.95, { duration: 110 }), withSpring(1, spring.jelly));
    hero.sx.value = withSequence(withTiming(1.03, { duration: 110 }), withSpring(1, spring.jelly));
    spark.i.value = withSequence(withTiming(2.6, { duration: 120 }), withTiming(0.7, { duration: 900 }));
    // a drop pinches off the stone and falls below it
    const s = stage.target.value;
    const land = s.y + s.h + Math.min(110, (H - (s.y + s.h)) * 0.5);
    pebble.cx.value = s.x + s.w / 2;
    pebble.cy.value = s.y + s.h * 0.6;
    pebble.melt.value = 38;
    pebble.presence.value = withTiming(1, { duration: 360 });
    pebble.cy.value = withDelay(240, withSpring(land, spring.drop));
    pebble.melt.value = withDelay(600, withTiming(0, { duration: 400 }));
    setTimeout(() => { ripple(s.x + s.w / 2, land + 10, 1); feel.land(1); }, 820);
    await catchThought(t);
    advance.current = setTimeout(onNext, 2400);
  }

  return (
    <Column gap={(roomy ? 26 : 16) * k}>
      <View>
        <Headline text={caught ? 'Caught.' : 'What’s on your mind?'} delay={caught ? 120 : 220} />
      </View>

      <View ref={mark} collapsable={false} style={[styles.stone, { minHeight: 150 * k }]}>
        <Reveal delay={700} show={!caught}>
          <TextInput
              maxFontSizeMultiplier={1.15}
            underlineColorAndroid="transparent"
            ref={input}
            value={text}
            onChangeText={setText}
            placeholder="call dentist thing…"
            placeholderTextColor={p.inkFaint}
            multiline
            maxLength={2000}
            submitBehavior="submit"
            returnKeyType="send"
            onSubmitEditing={() => void save(text)}
            onKeyPress={(e) => {
              const ne = e.nativeEvent as { key: string; shiftKey?: boolean };
              if (Platform.OS === 'web' && ne.key === 'Enter' && !ne.shiftKey) {
                (e as unknown as { preventDefault: () => void }).preventDefault();
                void save(text);
              }
            }}
            keyboardAppearance={p.name === 'night' ? 'dark' : 'light'}
            style={[styles.thought, { color: p.ink, fontSize: T.thought.fontSize * k, lineHeight: T.thought.lineHeight * k, minHeight: 70 * k },
              Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
            selectionColor={p.inkSoft}
            accessibilityLabel="Your first thought"
          />
        </Reveal>
      </View>

      <View style={styles.center}>
        {!caught && (
          <Reveal delay={1100}>
            <GlassButton onPress={() => void save(text || 'call dentist thing')} style={styles.pill} radius={26} pearl={1} label="Catch it">
              <Txt variant="label">{text.trim() ? 'Catch it' : 'Try an example'}</Txt>
            </GlassButton>
          </Reveal>
        )}
      </View>
    </Column>
  );
}

/* ---------- 3. it waits at your desk ---------- */

function DeskBeat({ stage, onNext }: { stage: Stage; onNext: () => void }) {
  const p = useTheme();
  const k = useTypeScale();
  const { width: W, height: H } = useWindowDimensions();
  const roomy = H > 520;
  const mark = useMark(stage);
  const slabW = Math.min(300, W - 72);

  useEffect(() => {
    stage.radius.value = 22;
    stage.anchor.value = { x: 0.9, y: 0.82 };
    stage.hero.pearl.value = withTiming(0.1, { duration: 800 });
    stage.spark.i.value = withTiming(0.5, { duration: 600 });
    // the pebble rises into the desk and is absorbed by it
    const t0 = setTimeout(() => {
      const s = stage.target.value;
      stage.pebble.melt.value = 44;
      stage.pebble.cx.value = withSpring(s.x + s.w / 2, spring.sheet);
      stage.pebble.cy.value = withSpring(s.y + s.h / 2, spring.sheet);
      stage.pebble.presence.value = withDelay(500, withTiming(0, { duration: 700 }));
    }, 450);
    const t1 = setTimeout(() => feel.land(0.4), 1500);
    return () => { clearTimeout(t0); clearTimeout(t1); };
  }, []);

  return (
    <Column gap={(roomy ? 22 : 14) * k}>
      <View>
        <Headline text="It waits at your desk." delay={150} />
      </View>

      <View style={styles.center}>
        <View ref={mark} collapsable={false} style={[styles.slab, { width: slabW, height: 150 * k }]} pointerEvents="none">
          <Reveal delay={900}>
            <Txt variant="numeral" align="center" style={{ fontSize: 60, lineHeight: 66 }}>1</Txt>
            <Txt variant="whisper" tone="soft" align="center">waiting</Txt>
          </Reveal>
        </View>
      </View>

      <Reveal delay={1200} style={styles.center}>
        <GlassButton onPress={onNext} style={styles.pill} radius={26} pearl={1} label="Continue">
          <Txt variant="label">Continue</Txt>
        </GlassButton>
      </Reveal>
    </Column>
  );
}

/* ---------- 4. the evening question ---------- */

function EveningBeat({ stage, onNext }: { stage: Stage; onNext: () => void }) {
  const k = useTypeScale();
  const { height: H } = useWindowDimensions();
  const roomy = H > 560;
  const s = useSettings((x) => x);
  const minutes = s.eveningHour * 60 + s.eveningMinute;
  const index = Math.max(0, EVENING.findIndex((m) => m >= minutes));
  const mark = useMark(stage);
  const MOON = 64 * k;

  useEffect(() => {
    stage.radius.value = -1;
    stage.anchor.value = { x: 0.66, y: 0.3 };
    stage.hero.pearl.value = withTiming(0.75, { duration: 1000 });
    stage.hero.warm.value = withTiming(0.25, { duration: 1000 });
    stage.spark.i.value = withTiming(0.35, { duration: 800 });
  }, []);

  const onDial = useCallback((i: number) => {
    updateSettings({ eveningHour: Math.floor(EVENING[i] / 60), eveningMinute: EVENING[i] % 60 });
  }, []);
  const label = useCallback((v: number) => (v % 60 === 0 ? `${(v / 60) % 12 || 12}PM` : null), []);

  async function yes() {
    await askPermission();
    updateSettings({ eveningOn: true });
    onNext();
  }

  return (
    <Column gap={(roomy ? 16 : 10) * k}>
      <View style={styles.center}>
        <View ref={mark} collapsable={false} style={{ width: MOON, height: MOON }} />
      </View>
      <View>
        <Headline text={'One question,\neach evening.'} delay={200} />
      </View>

      <Reveal delay={900} style={styles.center}>
        <View style={styles.clockRow}>
          <Txt variant="numeral" style={{ fontSize: 76, lineHeight: 82 }}>{formatClock(s.eveningHour, s.eveningMinute).replace(/ (AM|PM)/, '')}</Txt>
          <Txt variant="title" tone="faint" style={{ fontFamily: font.thin }}>PM</Txt>
        </View>
        <View style={{ width: '100%' }}>
          <Dial values={EVENING} index={index} onChange={onDial} label={label} step={22} subdivisions={1} height={100} />
        </View>
        <GlassButton onPress={() => void yes()} style={[styles.pill, { marginTop: 10 * k }]} radius={26} pearl={1} label="Ask me each evening">
          <Txt variant="label">Remind me</Txt>
        </GlassButton>
        <Pressable onPress={() => { updateSettings({ eveningOn: false }); onNext(); }} hitSlop={12} accessibilityRole="button" style={{ marginTop: 12 }}>
          <Txt variant="label" tone="soft" align="center">Not now</Txt>
        </Pressable>
      </Reveal>
    </Column>
  );
}

/* ---------- 5. you're clear ---------- */

function ClearBeat({ stage, onDone }: { stage: Stage; onDone: () => void }) {
  const { width: W, height: H } = useWindowDimensions();
  const k = useTypeScale();
  const orb = useSharedValue(1); // 1 = the bright orb, 0 = settling into a stone
  // Shu smiles while it is an orb, then closes its eyes as it becomes your stone
  const smile = useSharedValue(0);

  useEffect(() => {
    feel.bloom();
    stage.anchor.value = { x: 0.5, y: 0.5 };
    stage.hero.presence.value = withTiming(1, { duration: 300 });
    stage.hero.pearl.value = withTiming(0, { duration: 1200 });
    stage.hero.warm.value = withSequence(withTiming(0.8, { duration: 300 }), withTiming(0, { duration: 1600 }));
    stage.spark.i.value = withSequence(withTiming(3.2, { duration: 350 }), withTiming(0, { duration: 1800, easing: melt }));
    stage.spark.r.value = withSequence(withTiming(14, { duration: 350 }), withTiming(6, { duration: 1800 }));
    ripple(W / 2, H / 2, 1.4);
    // the orb sheds its dew in every direction, which dissolves as it flies
    stage.drops.gather.value = 1;
    stage.drops.splash.value = 0;
    stage.drops.burst.value = 0;
    stage.drops.show.value = 1;
    stage.drops.burst.value = withDelay(120, withTiming(1, { duration: 1500, easing: glide }));
    setTimeout(() => ripple(W / 2, H / 2, 0.8), 380);
    smile.value = withSequence(withDelay(250, withTiming(1, { duration: 300 })), withDelay(500, withTiming(0, { duration: 250 })));
    stage.anchor.value = { x: 0.76, y: 0.74 };
    orb.value = withDelay(1100, withTiming(0, { duration: 10 }));
    const t1 = setTimeout(() => { stage.hero.presence.value = withTiming(0, { duration: 900, easing: melt }); }, 2100);
    const t2 = setTimeout(() => {
      updateSettings({ onboarded: true });
      onDone();
    }, 2700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // a bright orb, then a stone the width of the screen, ready for capture
  useFrameCallback(() => {
    const r = Math.min(96 * k, W * 0.3);
    if (orb.value > 0.5) {
      stage.radius.value = r;
      stage.target.value = { x: W / 2 - r, y: H / 2 - r, w: r * 2, h: r * 2 };
    } else {
      stage.radius.value = 50 * k;
      stage.target.value = { x: 18, y: H / 2 - 92 * k, w: W - 36, h: 184 * k };
    }
  });

  return (
    <View style={[StyleSheet.absoluteFill, styles.clear]} pointerEvents="none">
      <Eyes follow={stage.hero} show={smile} mood="happy" />
      <Headline text="You’re clear." delay={420} stagger={180} style={{ fontSize: 52, lineHeight: 60 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  column: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22 },
  center: { alignItems: 'center' },
  top: { position: 'absolute', left: 22, right: 22, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  skip: { position: 'absolute', right: 0 },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dotStep: { height: 5, borderRadius: 3 },
  ring: { borderWidth: 1 },
  stone: { paddingHorizontal: 26, paddingTop: 22, paddingBottom: 24 },
  thought: { ...T.thought, fontFamily: font.thin, padding: 0, textAlignVertical: 'top' },
  pill: { height: 52, paddingHorizontal: 26, minWidth: 190 },
  slab: { justifyContent: 'center' },
  clockRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  clear: { justifyContent: 'center', paddingHorizontal: 22 },
});

export type { Beat };
