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
import { useTheme } from '../theme/theme';
import { font, spring, type as T } from '../theme/tokens';
import { GlassButton } from '../ui/GlassButton';
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

/** The stone's whisper follows the day. */
function promptFor(hour: number): string {
  if (hour >= 5 && hour < 11) return "what's on your mind this morning?";
  if (hour >= 17 && hour < 22) return 'anything still in your head?';
  if (hour >= 22 || hour < 5) return 'put it down, then rest';
  return 'catch a thought';
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface Props {
  /** 0..1 how present the capture surface is (sheets absorb it). */
  presence: SharedValue<number>;
  active: boolean;
  onOpenInbox: () => void;
  onOpenSettings: () => void;
}

export function Capture({ presence, active, onOpenInbox, onOpenSettings }: Props) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [text, setText] = useState('');
  const [arriving, setArriving] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ key: number; text: string } | null>(null);
  const tasks = useTasks((s) => s.tasks);
  const link = useTasks((s) => s.link);
  const held = useTasks((s) => s.outbox.length);
  const lastTrip = useTasks((s) => s.lastTrip);
  const open = useMemo(() => tasks.filter(isOpen), [tasks]);
  const placeholder = useMemo(() => PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)], []);

  const stone = useSharedValue<Frame>(emptyFrame);
  const bead = useSharedValue<Frame>(emptyFrame);
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const ready = useSharedValue(0);
  const sparkGlow = useSharedValue(0.3);

  const hasText = text.trim().length > 0;
  useEffect(() => {
    ready.value = withTiming(hasText ? 1 : 0, { duration: 500, easing: melt });
  }, [hasText, ready]);

  // The spark breathes slowly; brighter when there's something to save.
  useEffect(() => {
    sparkGlow.value = withRepeat(withSequence(withTiming(1, { duration: 2600 }), withTiming(0.72, { duration: 2600 })), -1, true);
  }, [sparkGlow]);
  const sparkI = useSharedValue(0);
  const beadGlow = useDerivedValue(() => (0.3 + ready.value * 0.7) * sparkGlow.value * presence.value + sparkI.value);
  useSpark(bead, beadGlow, 5.5);

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
      return;
    }
    setText('');
    setGhost({ key: Date.now(), text: words });
    feel.catch();
    sy.value = withSequence(withTiming(0.955, { duration: 110 }), withSpring(1, spring.jelly));
    sx.value = withSequence(withTiming(1.03, { duration: 110 }), withSpring(1, spring.jelly));
    sparkI.value = withSequence(withTiming(2.4, { duration: 120 }), withTiming(0, { duration: 900, easing: melt }));
    const task = await catchThought(words);
    setArriving(task.id);
  }

  const lift = useAnimatedStyle(() => ({
    paddingBottom: Math.max(keyboard.height.value, insets.bottom) + 10,
  }));

  const now = new Date();
  const status = link === 'live'
    ? lastTrip && Date.now() - Date.parse(tasks.find((t) => t.id === lastTrip.id)?.createdAt ?? '0') < 6000
      ? `on your desk · ${lastTrip.ms} ms`
      : 'linked to your desk'
    : link === 'connecting'
      ? 'finding your desk…'
      : held > 0
        ? `${held === 1 ? 'one thought' : `${held} thoughts`} kept safe here`
        : 'desk not linked yet';

  return (
    <Animated.View style={[styles.fill, { paddingTop: insets.top + 8 }, lift]} pointerEvents={active ? 'box-none' : 'none'}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => Keyboard.dismiss()} accessible={false} />

      <Fade presence={presence} style={styles.header}>
        <View>
          <Txt variant="display" style={{ fontSize: 30, lineHeight: 34 }}>{DAYS[now.getDay()]}</Txt>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: link === 'live' ? p.inkSoft : 'transparent', borderColor: p.inkFaint }]} />
            <Txt variant="whisper" tone="soft">{now.getDate()} {MONTHS[now.getMonth()]} · {status}</Txt>
          </View>
        </View>
        <GlassButton onPress={onOpenSettings} style={styles.tune} radius={23} label="Settings" presence={presence}>
          <Icon name="tune" color={p.inkSoft} />
        </GlassButton>
      </Fade>

      <View style={styles.middle} pointerEvents="box-none">
        <View>
          <Glass
            style={styles.stone}
            radius={52}
            wobble={2.2}
            melt={32}
            lift={0.6}
            sx={sx}
            sy={sy}
            presence={presence}
            frame={stone}
          >
            <Txt variant="whisper" tone="soft" style={styles.label}>{promptFor(now.getHours())}</Txt>
            <TextInput
              ref={input}
              value={text}
              onChangeText={setText}
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
              style={[styles.input, { color: p.ink }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
              accessibilityLabel="Catch a thought"
            />
            {ghost && <Ghost key={ghost.key} text={ghost.text} onDone={() => setGhost(null)} />}
          </Glass>
          <View style={styles.beadSpot} pointerEvents="box-none">
            <GlassButton
              onPress={() => void save()}
              style={styles.bead}
              radius={30}
              warm={ready}
              melt={30}
              lift={0.8}
              frame={bead}
              label="Save thought"
              presence={presence}
            />
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
  return (
    <Animated.Text numberOfLines={3} style={[styles.input, styles.ghost, { color: p.ink }, a]} pointerEvents="none">
      {text}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 26 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 },
  dot: { width: 5, height: 5, borderRadius: 3, borderWidth: 1 },
  tune: { width: 46, height: 46, marginTop: 2 },
  middle: { flex: 1, justifyContent: 'center', paddingHorizontal: 18 },
  stone: { minHeight: 188, paddingHorizontal: 28, paddingTop: 26, paddingBottom: 40 },
  label: { marginBottom: 10 },
  input: { ...T.thought, fontFamily: font.thin, padding: 0, minHeight: 80, textAlignVertical: 'top' },
  ghost: { position: 'absolute', left: 0, right: 0, top: 29 },
  beadSpot: { position: 'absolute', right: 26, bottom: -26 },
  bead: { width: 66, height: 60 },
});
