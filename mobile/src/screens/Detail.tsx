// One thought, up close. Your words stay exactly as you said them; every
// guess around them can be fixed with one touch.

import { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { NotDoingReason, Place, Task } from '../../../shared/task';
import { ESTIMATES } from '../data/guess';
import { updateTask, useTasks } from '../data/tasks';
import { feel } from '../feel/feel';
import { useTheme } from '../theme/theme';
import { font, type as T } from '../theme/tokens';
import { Dial } from '../ui/Dial';
import { GlassButton } from '../ui/GlassButton';
import { Icon } from '../ui/Icon';
import { LiquidChoice } from '../ui/Liquid';
import { Reveal } from '../ui/motion';
import { Txt } from '../ui/Txt';
import { REASONS } from './Inbox';

const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

export function Detail({ id, onClose }: { id: string; onClose: () => void }) {
  const p = useTheme();
  const task = useTasks((s) => s.tasks.find((t) => t.id === id));
  const [title, setTitle] = useState(task?.cleanTitle ?? task?.originalText ?? '');
  const [step, setStep] = useState(task?.firstStep ?? '');
  const [letting, setLetting] = useState(false);
  const est = task?.estimateMinutes ?? 25;
  const estIndex = Math.max(0, ESTIMATES.findIndex((m) => m >= est));
  const [shown, setShown] = useState(ESTIMATES[estIndex]);

  useEffect(() => setShown(ESTIMATES[estIndex]), [estIndex]);

  const onDial = useCallback((i: number) => {
    setShown(ESTIMATES[i]);
    void updateTask(id, { estimateMinutes: ESTIMATES[i] });
  }, [id]);
  const dialLabel = useCallback((v: number) => (v < 60 ? `${v}m` : `${v / 60}h`), []);

  if (!task) return null;

  const when = new Date(task.createdAt);
  const said = `${when.toLocaleDateString([], { weekday: 'long' })}, ${when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;

  function saveTitle() {
    const t = title.trim();
    if (t && t !== task!.cleanTitle) void updateTask(id, { cleanTitle: t });
  }
  function saveStep() {
    const s = step.trim();
    if (s !== (task!.firstStep ?? '')) void updateTask(id, { firstStep: s });
  }
  function letGo(r: NotDoingReason) {
    feel.land(1);
    void updateTask(id, { status: 'not_doing', notDoingReason: r });
    onClose();
  }

  return (
    <View style={styles.fill}>
      <View style={styles.head}>
        <Reveal delay={80}>
          <Txt variant="whisper" tone="soft">you said, {said}</Txt>
        </Reveal>
        <GlassButton onPress={onClose} style={styles.close} radius={22} label="Close">
          <Icon name="close" color={p.inkSoft} size={20} />
        </GlassButton>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Reveal delay={140}>
          <Txt variant="display" style={styles.quote}>“{task.originalText}”</Txt>
        </Reveal>

        <Reveal delay={220} style={styles.block}>
          <Txt variant="caps" tone="soft">WHAT IT IS</Txt>
          <TextInput
            value={title}
            onChangeText={setTitle}
            onEndEditing={saveTitle}
            onBlur={saveTitle}
            style={[styles.title, { color: p.ink }, webNoOutline]}
            selectionColor={p.inkSoft}
            multiline
            submitBehavior="blurAndSubmit"
            returnKeyType="done"
            accessibilityLabel="Title"
          />
          <View style={[styles.hair, { backgroundColor: p.hair }]} />
        </Reveal>

        <Reveal delay={300} style={styles.block}>
          <View style={styles.reading}>
            <Txt variant="caps" tone="soft">HOW LONG</Txt>
            <View style={styles.numberRow}>
              <Txt variant="numeral" style={styles.numeral}>{shown < 60 ? shown : shown / 60}</Txt>
              <Txt variant="title" tone="faint" style={styles.unit}>{shown < 60 ? 'MIN' : shown === 60 ? 'HOUR' : 'HOURS'}</Txt>
            </View>
          </View>
          <Dial values={ESTIMATES} index={estIndex} onChange={onDial} label={dialLabel} step={50} subdivisions={5} />
        </Reveal>

        <Reveal delay={380} style={styles.block}>
          <Txt variant="caps" tone="soft" style={{ marginBottom: 12 }}>WHERE</Txt>
          <LiquidChoice<Place>
            label="Where it happens"
            value={task.place ?? 'desk'}
            onChange={(v) => void updateTask(id, { place: v })}
            options={[
              { value: 'desk', label: 'At my desk', icon: 'desk' },
              { value: 'errand', label: 'Out and about', icon: 'errand' },
            ]}
          />
        </Reveal>

        <Reveal delay={460} style={styles.block}>
          <Txt variant="caps" tone="soft">FIRST TINY STEP</Txt>
          <View style={styles.stepRow}>
            <View style={styles.sparkDot} />
            <TextInput
              value={step}
              onChangeText={setStep}
              onEndEditing={saveStep}
              onBlur={saveStep}
              placeholder="the smallest way in"
              placeholderTextColor={p.inkFaint}
              style={[styles.step, { color: p.ink }, webNoOutline]}
              selectionColor={p.inkSoft}
              multiline
              submitBehavior="blurAndSubmit"
              returnKeyType="done"
              accessibilityLabel="First step"
            />
          </View>
          <View style={[styles.hair, { backgroundColor: p.hair }]} />
        </Reveal>

        <Reveal delay={540} style={styles.actions}>
          {letting ? (
            <View style={{ flex: 1 }}>
              <Txt variant="whisper" tone="soft" style={{ marginBottom: 10 }}>Let it go because it's…</Txt>
              <View style={styles.reasonRow}>
                {REASONS.map((r) => (
                  <GlassButton key={r.key} onPress={() => letGo(r.key)} style={styles.reason} radius={20} label={r.label}>
                    <View style={styles.reasonInner}>
                      <Icon name={r.icon} size={17} color={p.inkSoft} />
                      <Txt variant="label" style={{ fontSize: 14 }}>{r.label}</Txt>
                    </View>
                  </GlassButton>
                ))}
              </View>
            </View>
          ) : (
            <>
              <GlassButton
                onPress={() => { feel.done(); void updateTask(id, { status: 'done' }); onClose(); }}
                style={styles.primary}
                radius={26}
                pearl={1}
                label="Mark as done"
              >
                <View style={styles.reasonInner}>
                  <Icon name="check" size={18} />
                  <Txt variant="label">Done</Txt>
                </View>
              </GlassButton>
              <GlassButton onPress={() => { feel.touch(); setLetting(true); }} style={styles.secondary} radius={26} label="Let it go">
                <View style={styles.reasonInner}>
                  <Icon name="leaf" size={18} color={p.inkSoft} />
                  <Txt variant="label" tone="soft">Let go</Txt>
                </View>
              </GlassButton>
            </>
          )}
        </Reveal>
      </ScrollView>
    </View>
  );
}

export type { Task };

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 26, paddingBottom: 4 },
  close: { width: 44, height: 44 },
  scroll: { paddingHorizontal: 26, paddingBottom: 80 },
  quote: { fontSize: 34, lineHeight: 40, marginTop: 8 },
  block: { marginTop: 30 },
  title: { ...T.title, padding: 0, marginTop: 8, marginBottom: 12 },
  hair: { height: StyleSheet.hairlineWidth },
  reading: { marginBottom: -6 },
  numberRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 },
  numeral: { fontSize: 76, lineHeight: 84 },
  unit: { fontFamily: font.thin, letterSpacing: 1 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 10, marginBottom: 12 },
  sparkDot: { width: 7, height: 7, borderRadius: 4, marginTop: 9, backgroundColor: '#FFC9A3', shadowColor: '#FFB27E', shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  step: { ...T.body, flex: 1, padding: 0 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 34 },
  primary: { flex: 1, height: 54 },
  secondary: { flex: 1, height: 54 },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  reason: { height: 42, paddingHorizontal: 14 },
  reasonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
