// Linking a computer: point the camera at the code Shuchu shows on the
// computer (shuchu.app/app → Link your phone). The moment the code is read
// the phone joins, buzzes, and says so. Where there's no camera (the web
// preview), the link address can be pasted instead.

import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { joinLink } from '../data/tasks';
import { feel } from '../feel/feel';
import { useTheme } from '../theme/theme';
import { space, type as T } from '../theme/tokens';
import { GlassButton } from '../ui/GlassButton';
import { Txt } from '../ui/Txt';

export function LinkComputer({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const p = useTheme();
  const [permission, ask] = useCameraPermissions();
  const [state, setState] = useState<'looking' | 'linking' | 'linked' | 'wrong'>('looking');
  const [pasted, setPasted] = useState('');
  const busy = useRef(false);
  const camera = Platform.OS !== 'web';

  const tryLink = async (text: string) => {
    if (busy.current) return;
    busy.current = true;
    setState('linking');
    if (await joinLink(text)) {
      feel.bloom();
      setState('linked');
      setTimeout(onDone, 1300);
    } else {
      feel.nope();
      setState('wrong');
      setTimeout(() => { busy.current = false; setState('looking'); }, 1800);
    }
  };

  const words = state === 'linked' ? 'Linked.' : state === 'linking' ? 'Linking…' : state === 'wrong' ? 'That’s not a Shuchu code.' : 'Point at the code on your computer.';

  return (
    <View style={styles.fill}>
      <Txt variant="title" style={styles.title}>{words}</Txt>
      <Txt variant="label" tone="soft" style={styles.help}>
        On your computer, open Shuchu in the browser and choose Link your phone.
      </Txt>

      {camera && permission?.granted ? (
        <View style={[styles.window, { borderColor: state === 'linked' ? '#FFB27E' : p.hair }]}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={state === 'looking' ? (r) => void tryLink(r.data) : undefined}
          />
          <View style={[styles.corner, styles.tl, { borderColor: '#fff' }]} />
          <View style={[styles.corner, styles.tr, { borderColor: '#fff' }]} />
          <View style={[styles.corner, styles.bl, { borderColor: '#fff' }]} />
          <View style={[styles.corner, styles.br, { borderColor: '#fff' }]} />
        </View>
      ) : camera ? (
        <View style={styles.ask}>
          <Txt variant="body" tone="soft" style={styles.center}>
            {permission?.canAskAgain === false ? 'Camera access is off for Shuchu. Turn it on in your phone’s settings to scan.' : 'Shuchu needs the camera just to read the code.'}
          </Txt>
          {permission?.canAskAgain !== false && (
            <GlassButton onPress={() => void ask()} style={styles.button} radius={24} label="Allow the camera">
              <Txt variant="label">Allow the camera</Txt>
            </GlassButton>
          )}
        </View>
      ) : (
        <View style={styles.ask}>
          <TextInput
            value={pasted}
            onChangeText={setPasted}
            onSubmitEditing={() => void tryLink(pasted)}
            placeholder="Paste the link address"
            placeholderTextColor={p.inkFaint}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.paste, { color: p.ink, borderColor: p.hair }]}
            accessibilityLabel="Link address"
          />
          <GlassButton onPress={() => void tryLink(pasted)} style={styles.button} radius={24} label="Link">
            <Txt variant="label">Link</Txt>
          </GlassButton>
        </View>
      )}

      <Txt variant="label" tone="soft" onPress={onCancel} accessibilityRole="button" style={styles.cancel}>Not now</Txt>
    </View>
  );
}

const C = 26;
const styles = StyleSheet.create({
  fill: { alignItems: 'center', paddingTop: space.xl },
  title: { textAlign: 'center', paddingHorizontal: space.l },
  help: { textAlign: 'center', marginTop: space.s, paddingHorizontal: space.xl, maxWidth: 340 },
  window: { width: 260, height: 260, borderRadius: 34, overflow: 'hidden', marginTop: space.xl, borderWidth: 1.5, backgroundColor: '#000' },
  corner: { position: 'absolute', width: C, height: C, borderColor: '#fff' },
  tl: { top: 22, left: 22, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 10 },
  tr: { top: 22, right: 22, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 10 },
  bl: { bottom: 22, left: 22, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 10 },
  br: { bottom: 22, right: 22, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 10 },
  ask: { marginTop: space.xl, alignItems: 'center', gap: space.l, paddingHorizontal: space.xl, width: '100%' },
  center: { textAlign: 'center' },
  button: { height: 48, paddingHorizontal: 26 },
  paste: { ...T.label, width: '100%', maxWidth: 340, borderWidth: 1, borderRadius: 16, paddingHorizontal: space.l, paddingVertical: space.m },
  cancel: { marginTop: space.xl, paddingVertical: space.s, paddingHorizontal: space.l },
});
