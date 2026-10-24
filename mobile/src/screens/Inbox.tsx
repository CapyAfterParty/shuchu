// Inbox: everything caught, grouped by where it belongs.
// Swipe right to clear it, left to let it go (with a reason, never a plain delete).

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
import { spring } from '../theme/tokens';
import { GlassButton } from '../ui/GlassButton';
import { Icon } from '../ui/Icon';
import { Reveal } from '../ui/motion';
import { Txt } from '../ui/Txt';

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
      <View style={styles.head}>
        <Reveal delay={60}>
          <Txt variant="display">Inbox</Txt>
          <Txt variant="whisper" tone="soft" style={{ marginTop: 2 }}>
            everything you've caught, in one calm place
          </Txt>
        </Reveal>
        <GlassButton onPress={onClose} style={styles.close} radius={22} label="Close inbox">
          <Icon name="close" color={p.inkSoft} size={20} />
        </GlassButton>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {empty && (
          <Reveal delay={200} style={styles.empty}>
            <Txt variant="display" align="center" style={{ fontSize: 34 }}>Nothing here.</Txt>
            <Txt variant="whisper" tone="soft" align="center" style={{ marginTop: 6 }}>Your head is clear. That's the point.</Txt>
          </Reveal>
        )}

        {groups.stale.length > 0 && (
          <Section title="From a while ago" hint="still true?">
            {groups.stale.map((t) => (
              <Reveal key={t.id} delay={120 + n++ * 45}>
                <StillTrue task={t} onKeep={() => { feel.touch(); void updateTask(t.id, { confirmedAt: new Date().toISOString() }); }} onLetGo={() => letGo(t, 'not_needed')} />
              </Reveal>
            ))}
          </Section>
        )}
        {groups.desk.length > 0 && (
          <Section title="At your desk" hint={totalTime(groups.desk)}>
            {groups.desk.map((t) => row(t, n++))}
          </Section>
        )}
        {groups.errands.length > 0 && (
          <Section title="Out and about" hint="these stay on your phone">
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
        <Txt variant="whisper" tone="faint" align="center" style={styles.hint}>
          swipe right to clear · left to let go
        </Txt>
      </ScrollView>
    </View>
  );
}

function totalTime(tasks: Task[]): string {
  const m = tasks.reduce((a, t) => a + (t.estimateMinutes ?? 0), 0);
  return m ? `about ${formatMinutes(m)} in all` : '';
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
    () => (x.value > 84 ? 1 : x.value < -84 ? -1 : 0),
    (v, prev) => {
      if (prev !== null && v !== prev && v !== 0) scheduleOnRN(feel.tick);
      crossed.value = v;
    },
  );

  const pan = usePanGesture({
    activeOffsetX: [-14, 14],
    failOffsetY: [-12, 12],
    onUpdate: (e) => {
      'worklet';
      const t = e.translationX;
      x.value = Math.sign(t) * Math.pow(Math.abs(t), 0.88);
    },
    onDeactivate: () => {
      'worklet';
      if (x.value > 84) {
        x.value = withTiming(420, { duration: 380 });
        fired.value = 1;
      } else {
        if (x.value < -84) fired.value = -1;
        x.value = withSpring(0, spring.jelly);
      }
    },
  });

  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { scale: 1 - pressed.value * 0.015 }],
    opacity: interpolate(x.value, [0, 300, 420], [1, 0.6, 0], 'clamp'),
  }));
  const clearHint = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [10, 84], [0, 1], 'clamp'), transform: [{ scale: interpolate(x.value, [10, 84, 120], [0.6, 1, 1.15], 'clamp') }] }));
  const goHint = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [-10, -84], [0, 1], 'clamp'), transform: [{ scale: interpolate(x.value, [-10, -84, -120], [0.6, 1, 1.15], 'clamp') }] }));

  const sub = task.place === 'errand' ? 'out and about' : task.firstStep ? `first: ${lower(task.firstStep)}` : '';

  return (
    <View style={styles.rowWrap}>
      <Animated.View style={[styles.hintLeft, clearHint]}><Icon name="check" color={p.inkSoft} /></Animated.View>
      <Animated.View style={[styles.hintRight, goHint]}><Icon name="leaf" color={p.inkSoft} /></Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.row, slide]}>
          <Pressable
            style={styles.rowText}
            onPress={onPress}
            onPressIn={() => { pressed.value = withTiming(1, { duration: 120 }); }}
            onPressOut={() => { pressed.value = withSpring(0, spring.jelly); }}
            accessibilityRole="button"
            accessibilityHint="Opens the details"
          >
            <Txt variant="body">{task.cleanTitle ?? task.originalText}</Txt>
            {sub ? <Txt variant="whisper" tone="soft" numberOfLines={1} style={{ marginTop: 2 }}>{sub}</Txt> : null}
          </Pressable>
          <View style={styles.meta}>
            <Txt variant="whisper" tone="faint">{task.estimateMinutes ? formatMinutes(task.estimateMinutes) : ''}</Txt>
            <View style={styles.metaIcons}>
              {waiting && <View style={[styles.waiting, { borderColor: p.inkFaint }]} />}
              <Icon name={task.place === 'errand' ? 'errand' : 'desk'} size={16} color={p.inkFaint} />
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
      <View style={[styles.hair, { backgroundColor: p.hair }]} />
    </View>
  );
}

function lower(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function Reasons({ onPick }: { onPick: (r: NotDoingReason) => void }) {
  const p = useTheme();
  return (
    <Reveal rise={6} duration={600} style={styles.reasons}>
      <Txt variant="whisper" tone="soft" style={{ marginBottom: 10 }}>Let it go because it's…</Txt>
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
          <Txt variant="whisper" tone="soft" style={{ marginTop: 2 }}>caught {days} days ago · still true?</Txt>
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
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 26, paddingTop: 4, paddingBottom: 8 },
  close: { width: 44, height: 44 },
  scroll: { paddingHorizontal: 26, paddingBottom: 60 },
  empty: { paddingTop: 120 },
  section: { marginTop: 26 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 },
  rowWrap: { position: 'relative' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, gap: 14 },
  rowText: { flex: 1, minWidth: 0 },
  meta: { alignItems: 'flex-end', gap: 5 },
  metaIcons: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  waiting: { width: 6, height: 6, borderRadius: 3, borderWidth: 1 },
  hair: { height: StyleSheet.hairlineWidth },
  hintLeft: { position: 'absolute', left: 0, top: 0, bottom: 0, justifyContent: 'center' },
  hintRight: { position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center' },
  reasons: { paddingTop: 6, paddingBottom: 18 },
  reasonRow: { flexDirection: 'row', gap: 10 },
  reason: { height: 42, paddingHorizontal: 14 },
  reasonInner: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  stillButtons: { flexDirection: 'row', gap: 8 },
  still: { width: 46, height: 34 },
  cleared: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 30 },
  hint: { marginTop: 22 },
});
