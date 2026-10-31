// Settings: a few grouped rows. Label on the left, its control on the right.

import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { type Appearance, type HapticLevel, updateSettings, useSettings } from '../data/settings';
import { customerId, forgetEverywhere, refreshPlan, unlink, useTasks } from '../data/tasks';
import { buy, offers, restoreBought, type Offer } from '../data/purchases';
import { LinkComputer } from './LinkComputer';
import { askPermission, formatClock, syncEvening } from '../feel/evening';
import { feel, previewSound } from '../feel/feel';
import { useTheme } from '../theme/theme';
import { space, type as T } from '../theme/tokens';
import { Dial } from '../ui/Dial';
import { GlassButton } from '../ui/GlassButton';
import { Icon, type IconName } from '../ui/Icon';
import { LiquidChoice, LiquidSwitch } from '../ui/Liquid';
import { Reveal } from '../ui/motion';
import { SheetHeader } from '../ui/SheetHeader';
import { Glass } from '../scene/Glass';
import { Eyes } from '../ui/Eyes';
import { line } from '../shu/lines';
import { Bubble, useSpeech } from '../shu/Speech';
import { ScrollArea } from '../ui/ScrollArea';
import { Txt } from '../ui/Txt';

/** Evening times: 6:00 PM to 11:45 PM in quarter hours. */
export const EVENING = Array.from({ length: 24 }, (_, i) => 18 * 60 + i * 15);


export function Settings({ onClose, onReplay }: { onClose: () => void; onReplay: () => void }) {
  const p = useTheme();
  const s = useSettings((x) => x);
  const link = useTasks((x) => x.link);
  const linked = useTasks((x) => x.linked);
  const computer = useTasks((x) => x.devices.find((d) => !/Android|iPhone/.test(d.platform)));
  const plan = useTasks((x) => x.plan);
  const [scanning, setScanning] = useState(false);
  // Shuchu Sync, bought through this phone's store (RevenueCat); nothing shows if it isn't set up
  const [plans, setPlans] = useState<Offer[]>([]);
  const [buying, setBuying] = useState(false);
  const paid = plan?.paid ?? false;
  useEffect(() => {
    const id = customerId();
    if (linked && !paid && id) void offers(id).then(setPlans);
  }, [linked, paid]);
  const choose = async (o: Offer) => {
    const id = customerId();
    if (!id || buying) return;
    setBuying(true);
    feel.touch();
    const result = await buy(id, o);
    setBuying(false);
    if (result === 'done') { feel.bloom(); say('Thank you! Sync is yours.'); await refreshPlan(true); }
    else if (result === 'failed') feel.nope();
  };
  const restoreIt = async () => {
    const id = customerId();
    if (!id) return;
    feel.touch();
    const ok = await restoreBought(id);
    if (ok) { say('Found it. Sync is back.'); await refreshPlan(true); } else say('Nothing to restore on this store account.');
  };
  const [showTime, setShowTime] = useState(false);
  const { said, say } = useSpeech();

  const minutes = s.eveningHour * 60 + s.eveningMinute;
  const eveIndex = Math.max(0, EVENING.findIndex((m) => m >= minutes));
  const onEvening = useCallback((i: number) => {
    updateSettings({ eveningHour: Math.floor(EVENING[i] / 60), eveningMinute: EVENING[i] % 60 });
  }, []);
  useEffect(() => { void syncEvening(); }, [s.eveningOn, s.eveningHour, s.eveningMinute]);
  const eveLabel = useCallback((v: number) => (v % 60 === 0 ? `${(v / 60) % 12 || 12}PM` : null), []);

  const seen = computer ? ago(computer.seen) : null;
  const linkWords = link === 'paused' ? 'Sync paused' : link === 'offline' ? 'Offline · saved on this phone' : computer ? 'Linked to your computer' : 'Linked · waiting for your computer';
  // the subscription is managed on the computer (shuchu's web app), never sold in here
  const left = plan && !plan.paid ? Math.max(0, Math.ceil((plan.trialEnds - Date.now()) / 86_400_000)) : null;
  const planWords = link === 'paused' ? (plans.length ? 'Free trial over · keep Sync below' : 'Free trial over · add Shuchu Sync on your computer')
    : plan?.paid ? 'Shuchu Sync · encrypted on your devices'
    : left !== null ? `Free for ${left} more ${left === 1 ? 'day' : 'days'} · encrypted` : null;

  if (scanning) {
    return (
      <View style={styles.fill}>
        <SheetHeader title="Link a computer" onClose={() => setScanning(false)} closeLabel="Back to settings" />
        <LinkComputer onDone={() => { setScanning(false); say('Linked! I’ll keep both in step.'); }} onCancel={() => setScanning(false)} />
      </View>
    );
  }

  let delay = 100;
  const next = () => (delay += 50);

  return (
    <View style={styles.fill}>
      <SheetHeader title="Settings" onClose={onClose} closeLabel="Close settings" />

      <ScrollArea contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Group title="Computer" delay={next()}>
          {linked ? (
            <>
              <Row tall>
                <View style={[styles.dot, { backgroundColor: link === 'live' ? p.inkSoft : 'transparent', borderColor: p.inkSoft }]} />
                <View style={styles.grow}>
                  <Txt variant="body" numberOfLines={1}>{linkWords}</Txt>
                  <Txt variant="whisper" tone="faint" style={styles.sub} numberOfLines={2}>
                    {planWords ?? `${seen ? `Seen ${seen} · ` : ''}encrypted on your devices`}
                  </Txt>
                </View>
              </Row>
              {!paid && plans.length > 0 && (
                <>
                  <Rule />
                  <Row tall>
                    <Icon name="drop" size={18} color={p.inkSoft} />
                    <Txt variant="body" style={styles.grow}>Keep Sync</Txt>
                    {plans.map((o) => (
                      <GlassButton key={o.id} onPress={() => void choose(o)} style={styles.test} radius={16} label={`${o.price} a ${o.per}`}>
                        <Txt variant="label" style={styles.small}>{o.price}/{o.per === 'year' ? 'yr' : 'mo'}</Txt>
                      </GlassButton>
                    ))}
                  </Row>
                  <Txt variant="whisper" tone="soft" onPress={() => void restoreIt()} accessibilityRole="button" style={styles.restore}>Restore a purchase</Txt>
                </>
              )}
              <Rule />
              <Row>
                <Icon name="link" size={18} color={p.inkFaint} />
                <Txt variant="body" tone="soft" style={styles.grow} onPress={() => { feel.touch(); void unlink(); say('Unlinked. Everything’s still here.'); }} accessibilityRole="button">
                  Unlink this phone
                </Txt>
              </Row>
              <Txt
                variant="whisper"
                tone="faint"
                onPress={() => { feel.touch(); void forgetEverywhere().then((ok) => say(ok ? 'Deleted from the server. Everything’s still here.' : 'Couldn’t reach Shuchu. Try again.')); }}
                accessibilityRole="button"
                style={styles.restore}
              >
                Delete the synced copy
              </Txt>
            </>
          ) : (
            <Row tall>
              <Icon name="link" size={19} color={p.inkSoft} />
              <View style={styles.grow}>
                <Txt variant="body">Link a computer</Txt>
                <Txt variant="whisper" tone="faint" style={styles.sub}>Your thoughts wait on your desk</Txt>
              </View>
              <GlassButton onPress={() => { feel.touch(); setScanning(true); }} style={styles.test} radius={16} label="Scan the code">
                <Txt variant="label" style={styles.small}>Scan</Txt>
              </GlassButton>
            </Row>
          )}
        </Group>

        <Group title="Evening" delay={next()}>
          <Row tall={s.eveningOn}>
            <Icon name="moon" size={19} color={p.inkSoft} />
            <View style={styles.grow}>
              <Txt variant="body" numberOfLines={1}>Remind me</Txt>
              {s.eveningOn && (
                <Txt
                  variant="whisper"
                  tone="soft"
                  onPress={() => { feel.touch(); setShowTime(!showTime); }}
                  accessibilityRole="button"
                  accessibilityLabel="Change the time"
                  style={styles.sub}
                >
                  {formatClock(s.eveningHour, s.eveningMinute)} · {showTime ? 'done' : 'change'}
                </Txt>
              )}
            </View>
            <LiquidSwitch
              label="Evening question"
              value={s.eveningOn}
              onChange={async (v) => {
                if (v && !(await askPermission()) && Platform.OS !== 'web') feel.nope();
                updateSettings({ eveningOn: v });
                if (!v) setShowTime(false);
              }}
            />
          </Row>
          {s.eveningOn && showTime && (
            <Reveal duration={500} style={styles.dial}>
              <Dial values={EVENING} index={eveIndex} onChange={onEvening} label={eveLabel} step={22} subdivisions={1} />
            </Reveal>
          )}
        </Group>

        <Group title="Haptics" delay={next()} bare>
          <LiquidChoice<HapticLevel>
            label="Haptics"
            value={s.haptics}
            onChange={(v) => { updateSettings({ haptics: v }); setTimeout(() => feel.heartbeat(), 60); }}
            options={[
              { value: 'full', label: 'Full' },
              { value: 'gentle', label: 'Gentle' },
              { value: 'off', label: 'Off' },
            ]}
          />
        </Group>

        <Group title="Feel" delay={next()}>
          <Row>
            <Icon name="sound" size={19} color={p.inkSoft} />
            <Txt variant="body" style={styles.grow}>Sounds</Txt>
            <LiquidSwitch label="Sounds" value={s.sound} onChange={(v) => { updateSettings({ sound: v }); if (v) previewSound(); }} />
          </Row>
          <Rule />
          <Row>
            <Icon name="drop" size={19} color={p.inkSoft} />
            <Txt variant="body" style={styles.grow}>Calm motion</Txt>
            <LiquidSwitch label="Calm motion" value={s.calmMotion} onChange={(v) => updateSettings({ calmMotion: v })} />
          </Row>
          <Rule />
          <Row tall>
            <Icon name="waves" size={19} color={p.inkSoft} />
            <View style={styles.grow}>
              <Txt variant="body">Porcelain</Txt>
              <Txt variant="whisper" tone="faint" style={styles.sub}>Smooth and light on any phone</Txt>
            </View>
            <LiquidSwitch label="Porcelain" value={s.porcelain} onChange={(v) => { feel.bloom(); updateSettings({ porcelain: v }); }} />
          </Row>
        </Group>

        <Group title="Appearance" delay={next()} bare>
          <LiquidChoice<Appearance>
            label="Appearance"
            value={s.appearance}
            onChange={(v) => updateSettings({ appearance: v })}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'mist', label: 'Mist', icon: 'sun' },
              { value: 'night', label: 'Night', icon: 'moon' },
            ]}
          />
        </Group>

        <Reveal delay={next()} style={styles.footer}>
          {/* Shu keeps you company down here */}
          <Pressable onPress={() => say(line('hello'))} accessibilityRole="button" accessibilityLabel="Shu">
            <Glass style={styles.shu} radius={26} lift={0.6} wobble={1.4} pearl={0.2}>
              <Eyes size={54} mood={said ? 'happy' : s.calmMotion ? 'sleepy' : 'awake'} />
            </Glass>
            <Bubble said={said} side="center" style={styles.shuBubble} />
          </Pressable>
          <Txt variant="label" tone="soft" onPress={onReplay} accessibilityRole="button" style={styles.replay}>Replay welcome</Txt>
          <Txt variant="whisper" tone="faint">Shuchu 1.0</Txt>
        </Reveal>
      </ScrollArea>
    </View>
  );
}

/** A titled group. Rows sit on a faint inset panel; `bare` groups hold one control. */
function Group({ title, delay, bare, children }: { title: string; delay: number; bare?: boolean; children: React.ReactNode }) {
  const p = useTheme();
  return (
    <Reveal delay={delay} style={styles.group}>
      <Txt variant="caps" tone="soft" style={styles.groupTitle}>{title.toUpperCase()}</Txt>
      {bare ? children : (
        <View style={[styles.panel, { backgroundColor: p.name === 'night' ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.32)', borderColor: p.hair }]}>
          {children}
        </View>
      )}
    </Reveal>
  );
}

function Row({ tall, children }: { tall?: boolean; children: React.ReactNode }) {
  return <View style={[styles.row, tall && styles.tall]}>{children}</View>;
}

function Rule() {
  const p = useTheme();
  return <View style={[styles.rule, { backgroundColor: p.hair }]} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { paddingHorizontal: space.gutter - 4, paddingBottom: 80 },
  group: { marginTop: space.xl + 4 },
  groupTitle: { marginBottom: space.s, marginLeft: space.l },
  panel: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.l },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 54 },
  tall: { minHeight: 64 },
  grow: { flex: 1, minWidth: 0 },
  sub: { marginTop: 1 },
  rule: { height: StyleSheet.hairlineWidth, marginLeft: 31 },
  dot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1, marginHorizontal: 5 },
  test: { height: 32, paddingHorizontal: 14 },
  small: { fontSize: 13 },
  dial: { paddingBottom: space.m },
  footer: { marginTop: space.section, alignItems: 'center', gap: space.xs },
  shu: { width: 56, height: 52, marginBottom: space.m },
  shuBubble: { bottom: 62, left: -80, right: -80 },
  replay: { paddingVertical: space.s },
  restore: { paddingBottom: space.m, paddingLeft: 31 },
});

function ago(t: number): string {
  const m = Math.round((Date.now() - t) / 60_000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 48 * 60 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
}
