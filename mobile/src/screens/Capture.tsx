// Capture: a stone to speak into. Keyboard up, nothing else asked of you.

import { type ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { catchThought, isOpen, useTasks } from '../data/tasks';
import { feel } from '../feel/feel';
import { Glass, type Frame } from '../scene/Glass';
import { stoneFrame } from '../scene/world';
import { useTheme, useTypeScale } from '../theme/theme';
import { font, space, spring, type as T } from '../theme/tokens';
import { GlassButton } from '../ui/GlassButton';
import { Eyes, type Mood } from '../ui/Eyes';
import { line, MILESTONES } from '../shu/lines';
import { Bubble, useSpeech } from '../shu/Speech';
import { Icon } from '../ui/Icon';
import { emptyFrame, melt, Reveal, useSpark } from '../ui/motion';
import { Txt } from '../ui/Txt';
import { Basin } from './Basin';

const PLACEHOLDERS = [
  'call dentist thing…',
  'that idea about the logo…',
  'email Mina back…',
  'renew the passport…',
  'fix the invoice thing…',
];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Props {
  /** 0..1 how present the capture surface is (sheets absorb it). */
  presence: SharedValue<number>;
  active: boolean;
  onOpenInbox: () => void;
  onOpenSettings: () => void;
}

export function Capture({ presence, active, onOpenInbox, onOpenSettings }: Props) {
  const p = useTheme();
  const k = useTypeScale();
  const insets = useSafeAreaInsets();
  // Android draws edge to edge, so both system bars are translucent
  const keyboard = useAnimatedKeyboard({ isStatusBarTranslucentAndroid: true, isNavigationBarTranslucentAndroid: true });
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [text, setText] = useState('');
  const [arriving, setArriving] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ key: number; text: string } | null>(null);
  const tasks = useTasks((s) => s.tasks);
  const link = useTasks((s) => s.link);
  const held = useTasks((s) => s.outbox.length);
  const open = useMemo(() => tasks.filter(isOpen), [tasks]);
  const placeholder = useMemo(() => PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)], []);

  const stone = stoneFrame;
  const bead = useSharedValue<Frame>(emptyFrame);
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const ready = useSharedValue(0);
  const sparkGlow = useSharedValue(0.3);

  const hasText = text.trim().length > 0;
  const { said, say } = useSpeech();
  const saidLong = useRef(false);
  const [joy, setJoy] = useState(false);
  const joyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(joyTimer.current), []);
  const hour = new Date().getHours();
  const shuMood: Mood = joy ? 'happy' : !hasText && (hour >= 23 || hour < 5) ? 'sleepy' : 'awake';
  useEffect(() => {
    ready.value = withTiming(hasText ? 1 : 0, { duration: 500, easing: melt });
  }, [hasText, ready]);

  // The spark breathes slowly; brighter when there's something to save.
  useEffect(() => {
    sparkGlow.value = withRepeat(withSequence(withTiming(1, { duration: 2600 }), withTiming(0.72, { duration: 2600 })), -1, true);
  }, [sparkGlow]);
  const sparkI = useSharedValue(0);
  const beadGlow = useDerivedValue(() => (0.3 + ready.value * 0.7) * sparkGlow.value * presence.value + sparkI.value);
  // the bead's light is a glint on its rim, never in the middle of Shu's face
  useSpark(bead, beadGlow, 5, { x: 0.8, y: 0.8 });

  useEffect(() => {
    if (active) {
      const t = setTimeout(() => input.current?.focus(), 350);
      return () => clearTimeout(t);
    }
    input.current?.blur();
  }, [active]);

  async function save() {
    const words = text.trim();
    if (!words) {
      feel.nope();
      sx.value = withSequence(withTiming(1.025, { duration: 70 }), withSpring(1, spring.jelly));
      say(line('empty'));
      return;
    }
    setText('');
    setGhost({ key: Date.now(), text: words });
    feel.catch();
    sy.value = withSequence(withTiming(0.955, { duration: 110 }), withSpring(1, spring.jelly));
    sx.value = withSequence(withTiming(1.03, { duration: 110 }), withSpring(1, spring.jelly));
    sparkI.value = withSequence(withTiming(2.4, { duration: 120 }), withTiming(0, { duration: 900, easing: melt }));
    setJoy(true);
    clearTimeout(joyTimer.current);
    joyTimer.current = setTimeout(() => setJoy(false), 1600);
    // Shu remarks on milestones, and now and then on a catch; never every time
    const today = new Date().toDateString();
    const n = tasks.filter((t) => new Date(t.createdAt).toDateString() === today).length + 1;
    const remark = MILESTONES.has(n) ? line('milestone', n) : Math.random() < 0.3 ? line('caught') : null;
    if (remark) setTimeout(() => say(remark), 650);
    saidLong.current = false;
    const task = await catchThought(words);
    setArriving(task.id);
  }

  // A long press is a poke. Poke him a few times running and he gets a little indignant.
  const pokes = useRef<number[]>([]);
  function poke() {
    const now = Date.now();
    pokes.current = [...pokes.current.filter((t) => now - t < 6000), now];
    say(line(pokes.current.length >= 3 ? 'pokeAgain' : 'poke'));
    setJoy(true);
    clearTimeout(joyTimer.current);
    joyTimer.current = setTimeout(() => setJoy(false), 1200);
  }

  const lift = useAnimatedStyle(() => ({
    paddingBottom: Math.max(keyboard.height.value, insets.bottom) + 10,
  }));

  const now = new Date();

  return (
    <Animated.View style={[styles.fill, { paddingTop: insets.top + 8 }, lift]} pointerEvents={active ? 'box-none' : 'none'}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => Keyboard.dismiss()} accessible={false} />

      <Fade presence={presence} style={styles.header}>
        <View style={styles.title}>
          <Txt variant="display">{DAYS[now.getDay()]}</Txt>
          {/* the one sign of the desk link: a dot that fills when it's live */}
          <View
            style={[styles.dot, { backgroundColor: link === 'live' ? p.inkSoft : 'transparent', borderColor: held > 0 || link === 'live' ? p.inkSoft : p.inkFaint }]}
            accessibilityLabel={link === 'live' ? 'Desk linked' : held > 0 ? `${held} waiting on your phone` : 'Desk not linked'}
          />
        </View>
        <GlassButton onPress={onOpenSettings} style={styles.tune} radius={23} label="Settings" presence={presence}>
          <Icon name="tune" color={p.inkSoft} />
        </GlassButton>
      </Fade>

      <View style={styles.middle} pointerEvents="box-none">
        <View>
          <Glass
            style={styles.stone}
            contentStyle={styles.stoneInner}
            radius={52}
            wobble={2.2}
            melt={32}
            lift={0.6}
            sx={sx}
            sy={sy}
            presence={presence}
            frame={stone}
          >
            <TextInput
              allowFontScaling={false}
              underlineColorAndroid="transparent"
              ref={input}
              value={text}
              onChangeText={(t) => {
                // the stone breathes a little with every keystroke
                if (t.length > text.length) sy.value = withSequence(withTiming(1.012, { duration: 70 }), withSpring(1, spring.jelly));
                setText(t);
                if (t.length > 160 && !saidLong.current) { saidLong.current = true; say(line('long')); }
              }}
              placeholder={placeholder}
              placeholderTextColor={p.inkFaint}
              multiline
              maxLength={2000}
              submitBehavior="submit"
              returnKeyType="send"
              onSubmitEditing={() => void save()}
              onKeyPress={(e) => {
                // The web build has no submit-on-Enter for multiline inputs.
                const ne = e.nativeEvent as { key: string; shiftKey?: boolean };
                if (Platform.OS === 'web' && ne.key === 'Enter' && !ne.shiftKey) {
                  (e as unknown as { preventDefault: () => void }).preventDefault();
                  void save();
                }
              }}
              selectionColor={p.inkSoft}
              cursorColor={p.inkSoft}
              keyboardAppearance={p.name === 'night' ? 'dark' : 'light'}
              style={[styles.input, { color: p.ink, fontSize: T.thought.fontSize * k, lineHeight: T.thought.lineHeight * k, minHeight: T.thought.lineHeight * k }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
              accessibilityLabel="Catch a thought"
            />
            {ghost && <Ghost key={ghost.key} text={ghost.text} onDone={() => setGhost(null)} />}
          </Glass>
          <View style={styles.beadSpot} pointerEvents="box-none">
            <GlassButton
              onPress={() => void save()}
              onLongPress={poke}
              style={styles.bead}
              radius={30}
              warm={ready}
              melt={30}
              lift={0.8}
              frame={bead}
              label="Save thought"
              presence={presence}
            >
              {/* Shu lives in the save bead: watches your words, smiles when they're caught, dozes late at night */}
              <Eyes size={62} mood={shuMood} watch={hasText ? { x: -0.9, y: -0.55 } : null} />
            </GlassButton>
            <Bubble said={said} side="left" style={styles.bubble} />
          </View>
        </View>
      </View>

      <Basin tasks={open} origin={stone} arriving={arriving} onPress={onOpenInbox} presence={presence} />
    </Animated.View>
  );
}

function Fade({ presence, style, children }: { presence: SharedValue<number>; style?: object; children: React.ReactNode }) {
  const a = useAnimatedStyle(() => ({ opacity: Math.max(0, (presence.value - 0.4) / 0.6) }));
  return <Animated.View style={[style, a]} pointerEvents="box-none">{children}</Animated.View>;
}

/** The caught words lift off and dissolve while the box is already empty. */
function Ghost({ text, onDone }: { text: string; onDone: () => void }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: 1000, easing: melt });
    const timer = setTimeout(onDone, 1050);
    return () => clearTimeout(timer);
  }, []);
  const a = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [{ translateY: -t.value * 26 }, { scale: 1 - t.value * 0.06 }],
    letterSpacing: -0.5 + t.value * 3,
  }));
  const p = useTheme();
  const k = useTypeScale();
  return (
    <View style={styles.ghostWrap} pointerEvents="none">
      <Animated.Text numberOfLines={3} allowFontScaling={false} style={[styles.input, styles.ghost, { color: p.ink, fontSize: T.thought.fontSize * k, lineHeight: T.thought.lineHeight * k }, a]}>
        {text}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.gutter, paddingTop: space.s },
  title: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  dot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1, marginTop: 6 },
  tune: { width: 44, height: 44 },
  middle: { flex: 1, justifyContent: 'center', paddingHorizontal: space.l },
  stone: { minHeight: 176, paddingHorizontal: space.xl + 4, paddingVertical: space.xl + 4 },
  // the caret waits in the middle of the stone, and words grow out from there
  stoneInner: { justifyContent: 'center' },
  input: { ...T.thought, fontFamily: font.thin, padding: 0, textAlign: 'center', textAlignVertical: 'center' },
  ghostWrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center' },
  ghost: {},
  beadSpot: { position: 'absolute', right: 26, bottom: -26 },
  bead: { width: 66, height: 60 },
  bubble: { right: 4, bottom: 68 },
});
