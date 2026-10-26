// Settings: few, calm, and each one explains itself.

import { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { type Appearance, guessedServerUrl, type HapticLevel, updateSettings, useSettings } from '../data/settings';
import { ping, useTasks } from '../data/tasks';
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
import { Txt } from '../ui/Txt';

/** Evening times: 6:00 PM to 11:45 PM in quarter hours. */
export const EVENING = Array.from({ length: 24 }, (_, i) => 18 * 60 + i * 15);

const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

export function Settings({ onClose, onReplay }: { onClose: () => void; onReplay: () => void }) {
  const p = useTheme();
  const s = useSettings((x) => x);
  const link = useTasks((x) => x.link);
  const [address, setAddress] = useState(s.serverUrl ?? '');
  const [trip, setTrip] = useState<number | null | 'testing'>('testing');
  const [showTime, setShowTime] = useState(false);

  const test = useCallback(async () => {
    setTrip('testing');
    const ms = await ping((address.trim() || guessedServerUrl()));
    setTrip(ms);
    if (ms === null) feel.nope();
    else feel.touch();
  }, [address]);

  useEffect(() => { void test(); }, []);

  const minutes = s.eveningHour * 60 + s.eveningMinute;
  const eveIndex = Math.max(0, EVENING.findIndex((m) => m >= minutes));
  const onEvening = useCallback((i: number) => {
    updateSettings({ eveningHour: Math.floor(EVENING[i] / 60), eveningMinute: EVENING[i] % 60 });
  }, []);
  useEffect(() => { void syncEvening(); }, [s.eveningOn, s.eveningHour, s.eveningMinute]);
  const eveLabel = useCallback((v: number) => (v % 60 === 0 ? `${(v / 60) % 12 || 12}PM` : null), []);

  const linkWords = trip === 'testing' ? 'Looking…' : trip === null ? 'Not linked' : `Linked · ${trip} ms`;

  let delay = 120;
  const next = () => (delay += 60);

  return (
    <View style={styles.fill}>
      <SheetHeader title="Settings" onClose={onClose} closeLabel="Close settings" />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Group title="DESK" delay={next()}>
          <View style={styles.linkRow}>
            <View style={[styles.liveDot, { backgroundColor: link === 'live' && trip !== null ? p.inkSoft : 'transparent', borderColor: p.inkFaint }]} />
            <Txt variant="body" style={{ flex: 1 }}>{linkWords}</Txt>
          </View>
          <View style={styles.addressRow}>
            <Icon name="link" size={18} color={p.inkFaint} />
            <TextInput
              underlineColorAndroid="transparent"
              value={address}
              onChangeText={setAddress}
              onEndEditing={() => { updateSettings({ serverUrl: address.trim() || null }); void test(); }}
              placeholder={guessedServerUrl()}
              placeholderTextColor={p.inkFaint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={[styles.address, { color: p.ink }, webNoOutline]}
              accessibilityLabel="Desk address"
            />
            <GlassButton onPress={() => { updateSettings({ serverUrl: address.trim() || null }); void test(); }} style={styles.test} radius={18} label="Test link">
              <Txt variant="label" style={{ fontSize: 13 }}>Test</Txt>
            </GlassButton>
          </View>
        </Group>

        <Group title="EVENING" delay={next()}>
          <Row
            icon="moon"
            title="Remind me"
            hint={s.eveningOn ? formatClock(s.eveningHour, s.eveningMinute) : undefined}
            onHint={() => { feel.touch(); setShowTime(!showTime); }}
          >
            <LiquidSwitch
              label="Evening question"
              value={s.eveningOn}
              onChange={async (v) => {
                if (v && !(await askPermission()) && Platform.OS !== 'web') feel.nope();
                updateSettings({ eveningOn: v });
                if (v) setShowTime(true);
              }}
            />
          </Row>
          {s.eveningOn && (
            <>
              {showTime && (
                <Reveal rise={6} duration={600}>
                  <Txt variant="numeral" align="center" style={styles.clock}>{formatClock(s.eveningHour, s.eveningMinute).replace(' PM', '')}</Txt>
                  <Dial values={EVENING} index={eveIndex} onChange={onEvening} label={eveLabel} step={22} subdivisions={1} />
                </Reveal>
              )}
            </>
          )}
        </Group>

        <Group title="HAPTICS" delay={next()}>
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
          <View style={{ height: space.m }} />
          <Row icon="sound" title="Sounds">
            <LiquidSwitch label="Glass sounds" value={s.sound} onChange={(v) => { updateSettings({ sound: v }); if (v) previewSound(); }} />
          </Row>
          <Row icon="drop" title="Calm motion">
            <LiquidSwitch label="Calm motion" value={s.calmMotion} onChange={(v) => updateSettings({ calmMotion: v })} />
          </Row>
        </Group>

        <Group title="APPEARANCE" delay={next()}>
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
          <Txt variant="label" tone="soft" onPress={onReplay} accessibilityRole="button" style={styles.replay}>Replay welcome</Txt>
          <Txt variant="whisper" tone="faint" style={{ marginTop: space.s }}>Shuchu 1.0</Txt>
        </Reveal>
      </ScrollView>
    </View>
  );
}

function Group({ title, delay, children }: { title: string; delay: number; children: React.ReactNode }) {
  return (
    <Reveal delay={delay} style={styles.group}>
      <Txt variant="caps" tone="soft" style={styles.groupTitle}>{title}</Txt>
      {children}
    </Reveal>
  );
}

function Row({ icon, title, hint, onHint, children }: { icon: IconName; title: string; hint?: string; onHint?: () => void; children: React.ReactNode }) {
  const p = useTheme();
  return (
    <View style={styles.row}>
      <Icon name={icon} size={20} color={p.inkSoft} />
      <Txt variant="body" style={{ flex: 1 }}>{title}</Txt>
      {hint ? (
        <Txt variant="body" tone="soft" onPress={onHint} accessibilityRole={onHint ? 'button' : undefined} style={styles.hint}>{hint}</Txt>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { paddingHorizontal: space.gutter, paddingBottom: 80 },
  group: { marginTop: space.xxl },
  groupTitle: { marginBottom: space.m },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  liveDot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: space.m, marginTop: space.m },
  address: { ...T.label, flex: 1, paddingVertical: space.s },
  test: { height: 36, paddingHorizontal: space.l },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.l, minHeight: 52 },
  hint: { paddingHorizontal: space.xs },
  clock: { fontSize: 60, lineHeight: 68, marginTop: space.s },
  footer: { marginTop: space.section, alignItems: 'center' },
  replay: { paddingVertical: space.s },
});
