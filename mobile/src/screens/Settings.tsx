// Settings: few, calm, and each one explains itself.

import { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { type Appearance, guessedServerUrl, type HapticLevel, updateSettings, useSettings } from '../data/settings';
import { ping, useTasks } from '../data/tasks';
import { askPermission, formatClock, syncEvening } from '../feel/evening';
import { feel, previewSound } from '../feel/feel';
import { useTheme } from '../theme/theme';
import { type as T } from '../theme/tokens';
import { Dial } from '../ui/Dial';
import { GlassButton } from '../ui/GlassButton';
import { Icon, type IconName } from '../ui/Icon';
import { LiquidChoice, LiquidSwitch } from '../ui/Liquid';
import { Reveal } from '../ui/motion';
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

  const linkWords = trip === 'testing'
    ? 'listening for your desk…'
    : trip === null
      ? 'not reachable · thoughts wait safely on your phone'
      : `linked · ${trip} ms away`;

  let delay = 120;
  const next = () => (delay += 60);

  return (
    <View style={styles.fill}>
      <View style={styles.head}>
        <Reveal delay={60}>
          <Txt variant="display">Settings</Txt>
          <Txt variant="whisper" tone="soft" style={{ marginTop: 2 }}>few choices, all reversible</Txt>
        </Reveal>
        <GlassButton onPress={onClose} style={styles.close} radius={22} label="Close settings">
          <Icon name="close" color={p.inkSoft} size={20} />
        </GlassButton>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Group title="YOUR DESK" delay={next()}>
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
          <Txt variant="whisper" tone="faint" style={styles.note}>
            Leave empty to find the desk on the computer you started Shuchu from.
          </Txt>
        </Group>

        <Group title="EVENING QUESTION" delay={next()}>
          <Row icon="moon" title="Anything still in your head?" hint={s.eveningOn ? `asks once, at ${formatClock(s.eveningHour, s.eveningMinute)}` : 'off'}>
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
              <Txt variant="whisper" tone="soft" onPress={() => setShowTime(!showTime)} style={styles.timeToggle}>
                {showTime ? 'done' : 'change the time'}
              </Txt>
              {showTime && (
                <Reveal rise={6} duration={600}>
                  <Txt variant="numeral" align="center" style={styles.clock}>{formatClock(s.eveningHour, s.eveningMinute).replace(' PM', '')}</Txt>
                  <Dial values={EVENING} index={eveIndex} onChange={onEvening} label={eveLabel} step={22} subdivisions={1} />
                </Reveal>
              )}
            </>
          )}
        </Group>

        <Group title="FEEL" delay={next()}>
          <Txt variant="whisper" tone="soft" style={{ marginBottom: 10 }}>Haptics</Txt>
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
          <View style={{ height: 18 }} />
          <Row icon="sound" title="Glass sounds" hint={s.sound ? 'a soft tink when you catch' : 'silent, the default'}>
            <LiquidSwitch label="Glass sounds" value={s.sound} onChange={(v) => { updateSettings({ sound: v }); if (v) previewSound(); }} />
          </Row>
          <Row icon="drop" title="Calm motion" hint="less drifting, no tilt light">
            <LiquidSwitch label="Calm motion" value={s.calmMotion} onChange={(v) => updateSettings({ calmMotion: v })} />
          </Row>
        </Group>

        <Group title="LOOK" delay={next()}>
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

        <Group title="ABOUT" delay={next()}>
          <Txt variant="body" tone="soft">Shuchu catches what's in your head so your desk time starts with a plan, not a search.</Txt>
          <Txt variant="whisper" tone="soft" onPress={onReplay} style={styles.replay}>replay the welcome</Txt>
          <Txt variant="whisper" tone="faint" style={{ marginTop: 18 }}>Shuchu 1.0 · made to lower your heart rate</Txt>
        </Group>
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

function Row({ icon, title, hint, children }: { icon: IconName; title: string; hint?: string; children: React.ReactNode }) {
  const p = useTheme();
  return (
    <View style={styles.row}>
      <Icon name={icon} size={20} color={p.inkSoft} />
      <View style={{ flex: 1 }}>
        <Txt variant="body">{title}</Txt>
        {hint ? <Txt variant="whisper" tone="soft" style={{ marginTop: 1 }}>{hint}</Txt> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 26, paddingTop: 4, paddingBottom: 8 },
  close: { width: 44, height: 44 },
  scroll: { paddingHorizontal: 26, paddingBottom: 80 },
  group: { marginTop: 30 },
  groupTitle: { marginBottom: 12 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  liveDot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  address: { ...T.label, flex: 1, paddingVertical: 8 },
  test: { height: 36, paddingHorizontal: 16 },
  note: { marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  timeToggle: { marginTop: 4, marginLeft: 34, textDecorationLine: 'underline' },
  clock: { fontSize: 64, lineHeight: 72, marginTop: 10 },
  replay: { marginTop: 14, textDecorationLine: 'underline' },
});
