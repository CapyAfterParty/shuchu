// The welcome. One shape of glass travels through every beat: a drop held in
// your hand, the stone you speak into, the desk it waits at, the evening moon.

import { type ComponentRef, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
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
import { guessedServerUrl, updateSettings, useSettings } from '../data/settings';
import { catchThought, ping } from '../data/tasks';
import { askPermission, formatClock } from '../feel/evening';
import { feel } from '../feel/feel';
import { type FreeShape, useShape } from '../scene/useShape';
import { claimSpark, releaseSpark, ripple, writeSpark } from '../scene/world';
import { useTheme } from '../theme/theme';
import { font, spring, type as T } from '../theme/tokens';
import { Dial } from '../ui/Dial';
import { GlassButton } from '../ui/GlassButton';
import { melt, Reveal } from '../ui/motion';
import { Txt } from '../ui/Txt';
import { EVENING } from './Settings';

type Beat = 'arrive' | 'catch' | 'desk' | 'evening' | 'clear';
const ORDER: Beat[] = ['arrive', 'catch', 'desk', 'evening', 'clear'];

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [beat, setBeat] = useState<Beat>('arrive');
  const hero = useShape({ cx: W / 2, cy: H * 0.46, hw: 2, hh: 2, radius: 2, presence: 0, melt: 30, lift: 0.7 }, 2.4);
  const pebble = useShape({ cx: W / 2, cy: H * 0.5, hw: 22, hh: 20, radius: 20, presence: 0, melt: 38, lift: 0.4, pearl: 0.3 }, 1.5);

  // the one spark of the welcome
  const sparkX = useSharedValue(W / 2);
  const sparkY = useSharedValue(H * 0.46);
  const sparkI = useSharedValue(0);
  const sparkR = useSharedValue(6);
  const sparkBoost = useSharedValue(0);
  const breath = useSharedValue(1);
  const [sparkSlot] = useState(claimSpark);
  useEffect(() => () => releaseSpark(sparkSlot), [sparkSlot]);
  useFrameCallback(() => {
    writeSpark(sparkSlot, sparkX.value, sparkY.value, sparkI.value * breath.value + sparkBoost.value, sparkR.value);
  });
  useEffect(() => {
    breath.value = withRepeat(withSequence(withTiming(1.12, { duration: 2400 }), withTiming(0.9, { duration: 2400 })), -1, true);
  }, []);

  const go = useCallback((b: Beat) => setBeat(b), []);
  const step = ORDER.indexOf(beat);

  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {beat === 'arrive' && <Arrive hero={hero} spark={{ x: sparkX, y: sparkY, i: sparkI, r: sparkR, boost: sparkBoost }} onNext={() => go('catch')} />}
      {beat === 'catch' && <CatchBeat hero={hero} pebble={pebble} spark={{ x: sparkX, y: sparkY, i: sparkI, r: sparkR, boost: sparkBoost }} onNext={() => go('desk')} />}
      {beat === 'desk' && <DeskBeat hero={hero} pebble={pebble} spark={{ x: sparkX, y: sparkY, i: sparkI, r: sparkR, boost: sparkBoost }} onNext={() => go('evening')} />}
      {beat === 'evening' && <EveningBeat hero={hero} spark={{ x: sparkX, y: sparkY, i: sparkI, r: sparkR, boost: sparkBoost }} onNext={() => go('clear')} />}
      {beat === 'clear' && <ClearBeat hero={hero} spark={{ x: sparkX, y: sparkY, i: sparkI, r: sparkR, boost: sparkBoost }} onDone={onDone} />}

      {step > 0 && step < 4 && (
        <View style={[styles.top, { top: insets.top + 14 }]} pointerEvents="box-none">
          <Dots step={step} />
          <Txt variant="whisper" tone="faint" onPress={() => go('clear')} style={styles.skip} accessibilityRole="button">skip</Txt>
        </View>
      )}
    </View>
  );
}

interface Spark { x: SharedValue<number>; y: SharedValue<number>; i: SharedValue<number>; r: SharedValue<number>; boost: SharedValue<number> }

function Dots({ step }: { step: number }) {
  const p = useTheme();
  return (
    <View style={styles.dots} accessibilityLabel={`Step ${step} of 3`}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={[styles.dotStep, { backgroundColor: i <= step ? p.inkSoft : p.inkFaint, width: i === step ? 16 : 5 }]} />
      ))}
    </View>
  );
}

/* ---------- 1. arrival: hold the light ---------- */

function Arrive({ hero, spark, onNext }: { hero: FreeShape; spark: Spark; onNext: () => void }) {
  const { width: W, height: H } = useWindowDimensions();
  const hold = useSharedValue(0);
  const [stage, setStage] = useState(0);
  const done = useSharedValue(0);

  useEffect(() => {
    spark.x.value = W / 2;
    spark.y.value = H * 0.5;
    spark.r.value = 6;
    spark.i.value = withDelay(500, withTiming(1, { duration: 2200, easing: melt }));
    const timers = [
      setTimeout(() => feel.heartbeat(), 1700),
      setTimeout(() => setStage(1), 900),
      setTimeout(() => setStage(2), 2300),
      setTimeout(() => setStage(3), 3600),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // the drop grows around the light as you hold
  useFrameCallback(() => {
    if (done.value === 1) return; // the next beat owns the glass now
    const h = hold.value;
    const size = 6 + h * 66;
    hero.cx.value = W / 2;
    hero.cy.value = H * 0.5;
    hero.hw.value = size;
    hero.hh.value = size * 0.94;
    hero.radius.value = size;
    hero.presence.value = Math.min(1, h * 2.2);
    hero.warm.value = 0.5 * h;
    spark.boost.value = h * 0.9;
    spark.r.value = 6 + h * 4;
  });

  // when the beat ends, the extra light settles back
  useEffect(() => () => { spark.boost.value = withTiming(0, { duration: 900 }); }, []);

  useAnimatedReaction(
    () => Math.floor(hold.value * 5),
    (now, before) => {
      if (before !== null && now > before && now < 5) scheduleOnRN(feel.swell, now / 5);
      if (hold.value >= 0.999 && done.value === 0) {
        done.value = 1;
        scheduleOnRN(onNext);
      }
    },
  );

  // a breathing ring invites the press, then dissolves as you hold
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (stage >= 3) pulse.value = withRepeat(withTiming(1, { duration: 2600, easing: melt }), -1, false);
  }, [stage]);
  const ring = useAnimatedStyle(() => ({
    opacity: (stage >= 3 ? 0.55 : 0) * (1 - pulse.value) * (1 - hold.value),
    transform: [{ scale: 0.6 + pulse.value * 0.7 + hold.value * 0.4 }],
  }));
  const p = useTheme();

  return (
    <Pressable
      style={StyleSheet.absoluteFill}
      onPressIn={() => {
        if (stage < 3) return;
        feel.touch();
        hold.value = withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) });
      }}
      onPressOut={() => {
        if (hold.value < 0.999) {
          cancelAnimation(hold);
          hold.value = withSpring(0, spring.settle);
        }
      }}
      accessibilityRole="button"
      accessibilityLabel="Press and hold to begin"
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => { hold.value = withTiming(1, { duration: 600 }); }}
    >
      <View style={[styles.arriveText, { top: H * 0.2 }]} pointerEvents="none">
        <Reveal show={stage >= 1} duration={1400}>
          <Txt variant="display" align="center" style={{ fontSize: 46, lineHeight: 50 }}>Breathe out.</Txt>
        </Reveal>
        <Reveal show={stage >= 2} duration={1400} style={{ marginTop: 14 }}>
          <Txt variant="body" tone="soft" align="center">Your head wasn't built{'\n'}to hold everything.</Txt>
        </Reveal>
      </View>
      <Animated.View pointerEvents="none" style={[styles.ring, { left: W / 2 - 70, top: H * 0.5 - 70, borderColor: p.inkSoft }, ring]} />
      <View style={[styles.holdHint, { top: H * 0.5 + 96 }]} pointerEvents="none">
        <Reveal show={stage >= 3} duration={1200}>
          <Txt variant="whisper" tone="soft" align="center">press and hold the light</Txt>
        </Reveal>
      </View>
    </Pressable>
  );
}

/* ---------- 2. catch your first thought ---------- */

function CatchBeat({ hero, pebble, spark, onNext }: { hero: FreeShape; pebble: FreeShape; spark: Spark; onNext: () => void }) {
  const p = useTheme();
  const { width: W, height: H } = useWindowDimensions();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [text, setText] = useState('');
  const [caught, setCaught] = useState(false);
  const advance = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(advance.current), []);
  const stone = { x: 18, w: W - 36, h: 176, cy: H * 0.43 };

  useEffect(() => {
    hero.cx.value = withSpring(W / 2, spring.sheet);
    hero.cy.value = withSpring(stone.cy, spring.sheet);
    hero.hw.value = withSpring(stone.w / 2, spring.sheet);
    hero.hh.value = withSpring(stone.h / 2, spring.sheet);
    hero.radius.value = withSpring(50, spring.sheet);
    hero.presence.value = withTiming(1, { duration: 400 });
    hero.warm.value = withTiming(0, { duration: 900 });
    spark.x.value = withSpring(W - 58, spring.sheet);
    spark.y.value = withSpring(stone.cy + stone.h / 2 - 26, spring.sheet);
    spark.i.value = withTiming(0.7, { duration: 900 });
    spark.r.value = withTiming(5, { duration: 900 });
    const t = setTimeout(() => input.current?.focus(), 900);
    return () => clearTimeout(t);
  }, []);

  async function save(words: string) {
    const t = words.trim();
    if (!t || caught) return;
    setCaught(true);
    setText('');
    input.current?.blur();
    feel.catch();
    hero.sy.value = withSequence(withTiming(0.95, { duration: 110 }), withSpring(1, spring.jelly));
    hero.sx.value = withSequence(withTiming(1.03, { duration: 110 }), withSpring(1, spring.jelly));
    spark.i.value = withSequence(withTiming(2.6, { duration: 120 }), withTiming(0.7, { duration: 900 }));
    // a drop pinches off the stone and falls
    pebble.cx.value = W / 2;
    pebble.cy.value = stone.cy + 20;
    pebble.melt.value = 38;
    pebble.presence.value = withTiming(1, { duration: 360 });
    pebble.cy.value = withDelay(240, withSpring(H * 0.74, spring.drop));
    pebble.melt.value = withDelay(600, withTiming(0, { duration: 400 }));
    setTimeout(() => { ripple(W / 2, H * 0.74 + 10, 1); feel.land(1); }, 820);
    await catchThought(t);
    advance.current = setTimeout(onNext, 2600);
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[styles.headline, { top: H * 0.13 }]}>
        <Reveal delay={200} duration={1100}>
          <Txt variant="display" align="center">{caught ? 'Caught.' : 'Catch it the moment\nit appears.'}</Txt>
        </Reveal>
        <Reveal delay={600} duration={1100} style={{ marginTop: 10 }}>
          <Txt variant="whisper" tone="soft" align="center">
            {caught ? "It's out of your head now. Feel that?" : "Messy is fine. Type what's circling right now."}
          </Txt>
        </Reveal>
      </View>

      <View style={[styles.stoneText, { top: stone.cy - stone.h / 2, left: stone.x, width: stone.w, height: stone.h }]}>
        <Reveal delay={700} show={!caught}>
          <Txt variant="whisper" tone="soft" style={{ marginBottom: 10 }}>your first thought</Txt>
          <TextInput
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
            style={[styles.thought, { color: p.ink }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
            selectionColor={p.inkSoft}
            accessibilityLabel="Your first thought"
          />
        </Reveal>
      </View>

      {!caught && (
        <Reveal delay={1100} style={[styles.under, { top: stone.cy + stone.h / 2 + 34 }]}>
          <GlassButton onPress={() => void save(text || 'call dentist thing')} style={styles.pill} radius={26} pearl={1} label="Catch it">
            <Txt variant="label">{text.trim() ? 'Catch it' : 'Try “call dentist thing”'}</Txt>
          </GlassButton>
        </Reveal>
      )}
    </View>
  );
}

/* ---------- 3. it waits at your desk ---------- */

function DeskBeat({ hero, pebble, spark, onNext }: { hero: FreeShape; pebble: FreeShape; spark: Spark; onNext: () => void }) {
  const p = useTheme();
  const { width: W, height: H } = useWindowDimensions();
  const [trip, setTrip] = useState<number | null | 'looking'>('looking');
  const slab = { w: Math.min(300, W - 80), h: 172, cy: H * 0.43 };

  useEffect(() => {
    hero.hw.value = withSpring(slab.w / 2, spring.sheet);
    hero.hh.value = withSpring(slab.h / 2, spring.sheet);
    hero.radius.value = withSpring(22, spring.sheet);
    hero.cy.value = withSpring(slab.cy, spring.sheet);
    hero.pearl.value = withTiming(0.1, { duration: 800 });
    // the pebble rises into the desk and is absorbed by it
    pebble.melt.value = 44;
    pebble.cy.value = withDelay(500, withSpring(slab.cy + 10, spring.sheet));
    pebble.presence.value = withDelay(1000, withTiming(0, { duration: 700 }));
    spark.x.value = withSpring(W / 2, spring.sheet);
    spark.y.value = withSpring(slab.cy + slab.h / 2 + 30, spring.sheet);
    spark.i.value = withTiming(0.5, { duration: 600 });
    const t = setTimeout(() => feel.land(0.4), 1500);
    void ping(guessedServerUrl()).then((ms) => setTrip(ms));
    return () => clearTimeout(t);
  }, []);

  const status = trip === 'looking' ? 'looking for your desk…' : trip === null ? 'no desk yet · everything waits safely here' : `found your desk · ${trip} ms away`;

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[styles.headline, { top: H * 0.13 }]}>
        <Reveal delay={150} duration={1100}>
          <Txt variant="display" align="center">It waits at your desk.</Txt>
        </Reveal>
        <Reveal delay={500} duration={1100} style={{ marginTop: 10 }}>
          <Txt variant="whisper" tone="soft" align="center">
            One key on your computer opens Shuchu.{'\n'}Everything you caught is already there.
          </Txt>
        </Reveal>
      </View>

      <View style={[styles.slabText, { top: slab.cy - slab.h / 2, height: slab.h, left: (W - slab.w) / 2, width: slab.w }]} pointerEvents="none">
        <Reveal delay={900}>
          <Txt variant="caps" tone="soft" align="center">AT YOUR DESK</Txt>
          <Txt variant="numeral" align="center" style={{ fontSize: 64, lineHeight: 70 }}>1</Txt>
          <Txt variant="whisper" tone="soft" align="center">thought waiting · how long do you have?</Txt>
        </Reveal>
      </View>
      <View style={[styles.deskBase, { top: slab.cy + slab.h / 2 + 12, left: (W - slab.w - 60) / 2, width: slab.w + 60, backgroundColor: p.inkFaint }]} />

      <Reveal delay={1300} style={[styles.under, { top: slab.cy + slab.h / 2 + 60 }]}>
        <View style={styles.statusRow}>
          <View style={[styles.liveDot, { backgroundColor: typeof trip === 'number' ? p.inkSoft : 'transparent', borderColor: p.inkFaint }]} />
          <Txt variant="whisper" tone="soft">{status}</Txt>
        </View>
        <GlassButton onPress={onNext} style={[styles.pill, { marginTop: 22 }]} radius={26} pearl={1} label="Continue">
          <Txt variant="label">Continue</Txt>
        </GlassButton>
        <Txt variant="whisper" tone="faint" align="center" style={{ marginTop: 12 }}>you can link a desk any time in Settings</Txt>
      </Reveal>
    </View>
  );
}

/* ---------- 4. the evening question ---------- */

function EveningBeat({ hero, spark, onNext }: { hero: FreeShape; spark: Spark; onNext: () => void }) {
  const { width: W, height: H } = useWindowDimensions();
  const s = useSettings((x) => x);
  const minutes = s.eveningHour * 60 + s.eveningMinute;
  const index = Math.max(0, EVENING.findIndex((m) => m >= minutes));
  const moon = { cy: H * 0.2, r: 36 };

  useEffect(() => {
    hero.cx.value = withSpring(W / 2, spring.sheet);
    hero.cy.value = withSpring(moon.cy, spring.sheet);
    hero.hw.value = withSpring(moon.r, spring.sheet);
    hero.hh.value = withSpring(moon.r, spring.sheet);
    hero.radius.value = withSpring(moon.r, spring.sheet);
    hero.pearl.value = withTiming(0.75, { duration: 1000 });
    hero.warm.value = withTiming(0.25, { duration: 1000 });
    spark.x.value = withSpring(W / 2 + 12, spring.sheet);
    spark.y.value = withSpring(moon.cy - 10, spring.sheet);
    spark.i.value = withTiming(0.35, { duration: 800 });
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
    <View style={StyleSheet.absoluteFill}>
      <View style={[styles.headline, { top: moon.cy + moon.r + 34 }]}>
        <Reveal delay={200} duration={1100}>
          <Txt variant="display" align="center">One quiet question,{'\n'}each evening.</Txt>
        </Reveal>
        <Reveal delay={600} duration={1100} style={{ marginTop: 10 }}>
          <Txt variant="whisper" tone="soft" align="center">“Anything still in your head?” Nothing else, ever.</Txt>
        </Reveal>
      </View>

      <Reveal delay={900} style={[styles.under, { top: H * 0.52 }]}>
        <View style={styles.clockRow}>
          <Txt variant="numeral">{formatClock(s.eveningHour, s.eveningMinute).replace(/ (AM|PM)/, '')}</Txt>
          <Txt variant="title" tone="faint" style={{ fontFamily: font.thin }}>PM</Txt>
        </View>
        <View style={{ width: '100%' }}>
          <Dial values={EVENING} index={index} onChange={onDial} label={label} step={22} subdivisions={1} />
        </View>
        <GlassButton onPress={() => void yes()} style={[styles.pill, { marginTop: 18 }]} radius={26} pearl={1} label="Ask me each evening">
          <Txt variant="label">Ask me at {formatClock(s.eveningHour, s.eveningMinute)}</Txt>
        </GlassButton>
        <Txt variant="whisper" tone="soft" align="center" style={{ marginTop: 14 }} onPress={() => { updateSettings({ eveningOn: false }); onNext(); }} accessibilityRole="button">
          not now
        </Txt>
      </Reveal>
    </View>
  );
}

/* ---------- 5. you're clear ---------- */

function ClearBeat({ hero, spark, onDone }: { hero: FreeShape; spark: Spark; onDone: () => void }) {
  const { width: W, height: H } = useWindowDimensions();
  useEffect(() => {
    feel.bloom();
    hero.cx.value = withSpring(W / 2, spring.sheet);
    hero.cy.value = withSpring(H * 0.46, spring.sheet);
    hero.hw.value = withSequence(withSpring(96, spring.jelly), withDelay(900, withSpring(W / 2 - 18, spring.sheet)));
    hero.hh.value = withSequence(withSpring(96, spring.jelly), withDelay(900, withSpring(94, spring.sheet)));
    hero.radius.value = withSequence(withSpring(96, spring.jelly), withDelay(900, withSpring(52, spring.sheet)));
    hero.pearl.value = withTiming(0, { duration: 1200 });
    hero.warm.value = withSequence(withTiming(0.8, { duration: 300 }), withTiming(0, { duration: 1600 }));
    spark.x.value = withSpring(W / 2, spring.sheet);
    spark.y.value = withSpring(H * 0.46, spring.sheet);
    spark.i.value = withSequence(withTiming(3.2, { duration: 350 }), withTiming(0, { duration: 1800, easing: melt }));
    spark.r.value = withSequence(withTiming(14, { duration: 350 }), withTiming(6, { duration: 1800 }));
    ripple(W / 2, H * 0.46, 1.4);
    const t1 = setTimeout(() => { hero.presence.value = withTiming(0, { duration: 900, easing: melt }); }, 2100);
    const t2 = setTimeout(() => {
      updateSettings({ onboarded: true });
      onDone();
    }, 2700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <View style={[styles.headline, { top: H * 0.46 - 30 }]} pointerEvents="none">
      <Reveal delay={350} duration={1200}>
        <Txt variant="display" align="center" style={{ fontSize: 52, lineHeight: 58 }}>You're clear.</Txt>
      </Reveal>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', left: 26, right: 26, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  skip: { position: 'absolute', right: 0 },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dotStep: { height: 5, borderRadius: 3 },
  arriveText: { position: 'absolute', left: 30, right: 30 },
  holdHint: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  ring: { position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 1 },
  headline: { position: 'absolute', left: 28, right: 28 },
  stoneText: { position: 'absolute', paddingHorizontal: 28, paddingTop: 26 },
  thought: { ...T.thought, fontFamily: font.thin, padding: 0, minHeight: 80, textAlignVertical: 'top' },
  under: { position: 'absolute', left: 28, right: 28, alignItems: 'center' },
  pill: { height: 54, paddingHorizontal: 28, minWidth: 200 },
  slabText: { position: 'absolute', justifyContent: 'center' },
  deskBase: { position: 'absolute', height: StyleSheet.hairlineWidth * 2, borderRadius: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 6, height: 6, borderRadius: 3, borderWidth: 1 },
  clockRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
});

export type { Beat };
