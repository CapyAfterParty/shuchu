// One thought, up close. Your words stay exactly as you said them; every
// guess around them can be fixed with one touch.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import type { NotDoingReason, Place, Task } from '../../../shared/task';
import { ESTIMATES } from '../data/guess';
import { rememberTiming } from '../data/learn';
import { updateTask, useTasks } from '../data/tasks';
import { feel } from '../feel/feel';
import { useTheme } from '../theme/theme';
import { font, space, type as T } from '../theme/tokens';
import { Dial } from '../ui/Dial';
import { GlassButton } from '../ui/GlassButton';
import { Icon } from '../ui/Icon';
import { LiquidChoice } from '../ui/Liquid';
import { Reveal } from '../ui/motion';
import { SheetHeader } from '../ui/SheetHeader';
import { ScrollArea } from '../ui/ScrollArea';
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

  // a re-timing teaches future guesses, once the dial has come to rest
  const lesson = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(lesson.current), []);
  const onDial = useCallback((i: number) => {
    setShown(ESTIMATES[i]);
    void updateTask(id, { estimateMinutes: ESTIMATES[i] });
    clearTimeout(lesson.current);
    const words = task?.originalText;
    if (words) lesson.current = setTimeout(() => rememberTiming(words, ESTIMATES[i]), 1200);
  }, [id, task?.originalText]);
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

  const spoken = task.originalText.trim();
  const sameWords = spoken.toLowerCase() === title.trim().toLowerCase();

  return (
    <View style={styles.fill}>
      <SheetHeader onClose={onClose} />

      <ScrollArea contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Reveal delay={120}>
          <TextInput
            underlineColorAndroid="transparent"
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
          {/* your own words, kept exactly, only when the title has changed them */}
          {!sameWords && (
            <Txt variant="whisper" tone="faint" style={styles.said} accessibilityLabel={`You said ${spoken}, ${said}`}>
              “{spoken}”
            </Txt>
          )}
        </Reveal>

        <Reveal delay={180} style={styles.block}>
          <View style={styles.reading} accessibilityLabel="How long">
            <View style={styles.numberRow}>
              <Txt variant="numeral" style={styles.numeral}>{shown < 60 ? shown : shown / 60}</Txt>
              <Txt variant="title" tone="faint" style={styles.unit}>{shown < 60 ? 'MIN' : shown === 60 ? 'HOUR' : 'HOURS'}</Txt>
            </View>
          </View>
          <Dial values={ESTIMATES} index={estIndex} onChange={onDial} label={dialLabel} step={50} subdivisions={5} />
        </Reveal>

        <Reveal delay={240} style={styles.block}>
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

        <Reveal delay={300} style={styles.block}>
          <View style={styles.stepRow}>
            <View style={styles.sparkDot} />
            <TextInput
              underlineColorAndroid="transparent"
              value={step}
              onChangeText={setStep}
              onEndEditing={saveStep}
              onBlur={saveStep}
              placeholder="First tiny step"
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

        <Reveal delay={360} style={styles.actions}>
          {letting ? (
            <View style={{ flex: 1 }}>
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
      </ScrollArea>
    </View>
  );
}

export type { Task };

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { paddingHorizontal: space.gutter, paddingBottom: 80 },
  title: { ...T.display, fontFamily: font.light, fontSize: 30, lineHeight: 36, letterSpacing: -0.6, padding: 0, marginTop: space.s, textAlignVertical: 'top' },
  said: { marginTop: space.s },
  block: { marginTop: space.section },
  hair: { height: StyleSheet.hairlineWidth },
  reading: { marginBottom: -space.s },
  numberRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.s },
  numeral: { fontSize: 72, lineHeight: 78 },
  unit: { fontFamily: font.thin, letterSpacing: 1 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.m, marginBottom: space.l },
  sparkDot: { width: 7, height: 7, borderRadius: 4, marginTop: 8, backgroundColor: '#FFC9A3', shadowColor: '#FFB27E', shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  step: { ...T.body, flex: 1, padding: 0, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: space.m, marginTop: space.section },
  primary: { flex: 1, height: 54 },
  secondary: { flex: 1, height: 54 },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  reason: { height: 40, paddingHorizontal: 14 },
  reasonInner: { flexDirection: 'row', alignItems: 'center', gap: space.s },
});
