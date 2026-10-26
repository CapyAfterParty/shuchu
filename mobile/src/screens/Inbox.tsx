// Inbox: everything caught, grouped by where it belongs.
// Swipe right to clear it, left to let it go (with a reason, never a plain delete).

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { NotDoingReason, Task } from '../../../shared/task';
import { formatMinutes } from '../data/guess';
import { isOpen, isStale, isWaiting, updateTask, useTasks } from '../data/tasks';
import { feel } from '../feel/feel';
import { useTheme } from '../theme/theme';
import { space, spring } from '../theme/tokens';
import { GlassButton } from '../ui/GlassButton';
import { Icon } from '../ui/Icon';
import { Reveal } from '../ui/motion';
import { SheetHeader } from '../ui/SheetHeader';
import { ScrollArea } from '../ui/ScrollArea';
import { Txt } from '../ui/Txt';

const SWIPE = 90; // points of finger travel that commit a swipe

export const REASONS: { key: NotDoingReason; label: string; icon: 'hand' | 'leaf' | 'split' }[] = [
  { key: 'not_mine', label: 'Not mine', icon: 'hand' },
  { key: 'not_needed', label: 'Not needed', icon: 'leaf' },
  { key: 'too_big', label: 'Too big', icon: 'split' },
];

export function Inbox({ onClose, onOpen }: { onClose: () => void; onOpen: (id: string) => void }) {
  const p = useTheme();
  const tasks = useTasks((s) => s.tasks);
  const outbox = useTasks((s) => s.outbox);
  const [lettingGo, setLettingGo] = useState<string | null>(null);

  const groups = useMemo(() => {
    const open = tasks.filter(isOpen);
    const today = new Date().toDateString();
    return {
      stale: open.filter(isStale),
      desk: open.filter((t) => !isStale(t) && t.place !== 'errand'),
      errands: open.filter((t) => !isStale(t) && t.place === 'errand'),
      cleared: tasks.filter((t) => (t.status === 'done' || t.status === 'not_doing') && new Date(t.createdAt).toDateString() === today).length,
    };
  }, [tasks]);
  const empty = !groups.stale.length && !groups.desk.length && !groups.errands.length;

  function clear(t: Task) {
    feel.done();
    void updateTask(t.id, { status: 'done' });
  }
  function letGo(t: Task, reason: NotDoingReason) {
    feel.land(1);
    setLettingGo(null);
    void updateTask(t.id, { status: 'not_doing', notDoingReason: reason });
  }

  const row = (t: Task, i: number) => (
    <Reveal key={t.id} delay={120 + i * 45} rise={8}>
      <Row
        task={t}
        waiting={isWaiting(t.id, outbox)}
        onPress={() => onOpen(t.id)}
        onClear={() => clear(t)}
        onLetGo={() => { feel.touch(); setLettingGo(lettingGo === t.id ? null : t.id); }}
      />
      {lettingGo === t.id && <Reasons onPick={(r) => letGo(t, r)} />}
    </Reveal>
  );

  let n = 0;
  return (
    <View style={styles.fill}>
      <SheetHeader title="Inbox" onClose={onClose} closeLabel="Close inbox" />

      <ScrollArea contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {empty && (
          <Reveal delay={200} style={styles.empty}>
            <Txt variant="display" align="center" tone="soft">All clear.</Txt>
          </Reveal>
        )}

        {groups.stale.length > 0 && (
          <Section title="Still true?">
            {groups.stale.map((t) => (
              <Reveal key={t.id} delay={120 + n++ * 45}>
                <StillTrue task={t} onKeep={() => { feel.touch(); void updateTask(t.id, { confirmedAt: new Date().toISOString() }); }} onLetGo={() => letGo(t, 'not_needed')} />
              </Reveal>
            ))}
          </Section>
        )}
        {groups.desk.length > 0 && (
          <Section title="At your desk" hint={groups.desk.length > 1 ? totalTime(groups.desk) : undefined}>
            {groups.desk.map((t) => row(t, n++))}
          </Section>
        )}
        {groups.errands.length > 0 && (
          <Section title="Out and about">
            {groups.errands.map((t) => row(t, n++))}
          </Section>
        )}
        {groups.cleared > 0 && (
          <Reveal delay={300}>
            <View style={styles.cleared}>
              <Icon name="check" size={16} color={p.inkFaint} />
              <Txt variant="whisper" tone="faint">{groups.cleared} cleared today</Txt>
            </View>
          </Reveal>
        )}
      </ScrollArea>
    </View>
  );
}

function totalTime(tasks: Task[]): string {
  const m = tasks.reduce((a, t) => a + (t.estimateMinutes ?? 0), 0);
  return m ? formatMinutes(m) : '';
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Txt variant="caps" tone="soft">{title.toUpperCase()}</Txt>
        {hint ? <Txt variant="whisper" tone="faint">{hint}</Txt> : null}
      </View>
      {children}
    </View>
  );
}

function Row({ task, waiting, onPress, onClear, onLetGo }: {
  task: Task; waiting: boolean; onPress: () => void; onClear: () => void; onLetGo: () => void;
}) {
  const p = useTheme();
  const x = useSharedValue(0);
  const fired = useSharedValue(0); // 1 = clear, -1 = let go
  const pressed = useSharedValue(0);
  const travel = useSharedValue(0); // how far the finger moved, so a swipe is never also a tap
  const raw = useSharedValue(0); // the finger's real travel; the row itself moves a little less

  useAnimatedReaction(
    () => fired.value,
    (v, prev) => {
      if (v === prev || v === 0) return;
      if (v === 1) scheduleOnRN(onClear);
      if (v === -1) scheduleOnRN(onLetGo);
      fired.value = 0;
    },
  );
  const crossed = useSharedValue(0);
  useAnimatedReaction(
    () => (raw.value > SWIPE ? 1 : raw.value < -SWIPE ? -1 : 0),
    (v, prev) => {
      if (prev !== null && v !== prev && v !== 0) scheduleOnRN(feel.tick);
      crossed.value = v;
    },
  );

  const pan = usePanGesture({
    activeOffsetX: [-14, 14],
    failOffsetY: [-12, 12],
    onBegin: () => {
      'worklet';
      travel.value = 0;
      raw.value = 0;
    },
    onUpdate: (e) => {
      'worklet';
      const t = e.translationX;
      travel.value = Math.max(travel.value, Math.abs(t));
      raw.value = t;
      x.value = Math.sign(t) * Math.pow(Math.abs(t), 0.88);
    },
    // onFinalize always runs, even when the gesture is cancelled, so a row
    // can never be left stuck halfway
    onFinalize: () => {
      'worklet';
      if (raw.value > SWIPE) {
        x.value = withTiming(420, { duration: 380 });
        fired.value = 1;
      } else {
        if (raw.value < -SWIPE) fired.value = -1;
        x.value = withSpring(0, spring.jelly);
      }
      raw.value = 0;
    },
  });

  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { scale: 1 - pressed.value * 0.015 }],
    opacity: interpolate(x.value, [0, 300, 420], [1, 0.6, 0], 'clamp'),
  }));
  // the hint icons swell as you near the point of no return
  const clearHint = useAnimatedStyle(() => ({ opacity: interpolate(raw.value, [10, SWIPE], [0, 1], 'clamp'), transform: [{ scale: interpolate(raw.value, [10, SWIPE, SWIPE + 40], [0.6, 1, 1.15], 'clamp') }] }));
  const goHint = useAnimatedStyle(() => ({ opacity: interpolate(raw.value, [-10, -SWIPE], [0, 1], 'clamp'), transform: [{ scale: interpolate(raw.value, [-10, -SWIPE, -SWIPE - 40], [0.6, 1, 1.15], 'clamp') }] }));

  return (
    <View style={styles.rowWrap}>
      <Animated.View style={[styles.hintLeft, clearHint]}><Icon name="check" color={p.inkSoft} /></Animated.View>
      <Animated.View style={[styles.hintRight, goHint]}><Icon name="leaf" color={p.inkSoft} /></Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.row, slide]}>
          <Pressable
            style={styles.rowText}
            onPress={() => { if (travel.value < 8) onPress(); }}
            onPressIn={() => { travel.value = 0; pressed.value = withTiming(1, { duration: 120 }); }}
            onPressOut={() => { pressed.value = withSpring(0, spring.jelly); }}
            accessibilityRole="button"
            accessibilityHint="Opens the details"
          >
            <Txt variant="body" numberOfLines={2}>{task.cleanTitle ?? task.originalText}</Txt>
          </Pressable>
          <View style={styles.meta}>
            {waiting && <View style={[styles.waiting, { borderColor: p.inkFaint }]} accessibilityLabel="Waiting to reach your desk" />}
            {task.estimateMinutes ? <Txt variant="whisper" tone="faint">{formatMinutes(task.estimateMinutes)}</Txt> : null}
          </View>
        </Animated.View>
      </GestureDetector>
      <View style={[styles.hair, { backgroundColor: p.hair }]} />
    </View>
  );
}

function Reasons({ onPick }: { onPick: (r: NotDoingReason) => void }) {
  const p = useTheme();
  return (
    <Reveal rise={6} duration={600} style={styles.reasons}>
      <View style={styles.reasonRow}>
        {REASONS.map((r) => (
          <GlassButton key={r.key} onPress={() => onPick(r.key)} style={styles.reason} radius={20} lift={0.4} label={r.label}>
            <View style={styles.reasonInner}>
              <Icon name={r.icon} size={17} color={p.inkSoft} />
              <Txt variant="label" style={{ fontSize: 14 }}>{r.label}</Txt>
            </View>
          </GlassButton>
        ))}
      </View>
    </Reveal>
  );
}

function StillTrue({ task, onKeep, onLetGo }: { task: Task; onKeep: () => void; onLetGo: () => void }) {
  const p = useTheme();
  const days = Math.round((Date.now() - Date.parse(task.confirmedAt ?? task.createdAt)) / 86_400_000);
  return (
    <View style={styles.rowWrap}>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Txt variant="body">{task.cleanTitle ?? task.originalText}</Txt>
          <Txt variant="whisper" tone="faint" style={{ marginTop: space.xs }}>{days} days ago</Txt>
        </View>
        <View style={styles.stillButtons}>
          <GlassButton onPress={onKeep} style={styles.still} radius={16} pearl={0.5} label="Yes, keep it">
            <Txt variant="label" style={{ fontSize: 13 }}>Yes</Txt>
          </GlassButton>
          <GlassButton onPress={onLetGo} style={styles.still} radius={16} label="Let it go">
            <Icon name="leaf" size={16} color={p.inkSoft} />
          </GlassButton>
        </View>
      </View>
      <View style={[styles.hair, { backgroundColor: p.hair }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { paddingHorizontal: space.gutter, paddingBottom: 64 },
  empty: { paddingTop: 140 },
  section: { marginTop: space.xxl },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: space.xs },
  rowWrap: { position: 'relative' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, gap: space.l, userSelect: 'none' },
  rowText: { flex: 1, minWidth: 0 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  waiting: { width: 6, height: 6, borderRadius: 3, borderWidth: 1 },
  hair: { height: StyleSheet.hairlineWidth },
  hintLeft: { position: 'absolute', left: 0, top: 0, bottom: 0, justifyContent: 'center' },
  hintRight: { position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center' },
  reasons: { paddingTop: space.xs, paddingBottom: space.l },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  reason: { height: 40, paddingHorizontal: 14 },
  reasonInner: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  stillButtons: { flexDirection: 'row', gap: space.s },
  still: { width: 46, height: 34 },
  cleared: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: space.xxl },
});
