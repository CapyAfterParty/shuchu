// Liquid controls: a switch and a segmented choice. The selection is a glass
// bead that stretches as it travels and melts into the track it rests in.

import { useEffect, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { feel } from '../feel/feel';
import { Glass } from '../scene/Glass';
import { spring } from '../theme/tokens';
import { Icon, type IconName } from './Icon';
import { Txt } from './Txt';

const TW = 60;
const TH = 34;
const KNOB = 26;

export function LiquidSwitch({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const dx = useSharedValue(value ? TW - KNOB - 8 : 0);
  const sx = useSharedValue(1);
  const pearl = useSharedValue(value ? 1 : 0.15);
  const warm = useSharedValue(value ? 0.55 : 0);

  useEffect(() => {
    dx.value = withSpring(value ? TW - KNOB - 8 : 0, spring.jelly);
    sx.value = withSequence(withTiming(1.38, { duration: 140 }), withSpring(1, spring.jelly));
    pearl.value = withTiming(value ? 1 : 0.15, { duration: 360 });
    warm.value = withTiming(value ? 0.55 : 0, { duration: 360 });
  }, [value]);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      hitSlop={10}
      onPress={() => { feel.touch(); onChange(!value); }}
      style={styles.switchWrap}
    >
      <Glass style={styles.track} radius={TH / 2} lift={0.2} melt={6} pearl={0} />
      <View style={styles.knobSpot} pointerEvents="none">
        <Glass style={styles.knob} radius={KNOB / 2} lift={0.7} melt={6} pearl={pearl} warm={warm} dx={dx} sx={sx} />
      </View>
    </Pressable>
  );
}

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

export function LiquidChoice<T extends string>({
  options, value, onChange, label,
}: { options: ChoiceOption<T>[]; value: T; onChange: (v: T) => void; label: string }) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const seg = width / options.length;
  const dx = useSharedValue(0);
  const sx = useSharedValue(1);
  const ready = useSharedValue(0);

  useEffect(() => {
    if (!seg) return;
    if (ready.value === 0) {
      dx.value = index * seg;
      ready.value = withTiming(1, { duration: 500 });
      return;
    }
    dx.value = withSpring(index * seg, spring.jelly);
    sx.value = withSequence(withTiming(1.16, { duration: 150 }), withSpring(1, spring.jelly));
  }, [index, seg]);

  return (
    <View
      style={styles.choice}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width - 8)}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
    >
      <Glass style={StyleSheet.absoluteFill} radius={24} lift={0.2} melt={5} />
      {seg > 0 && (
        <View style={[styles.beadSpot, { width: seg }]} pointerEvents="none">
          <Glass style={styles.bead} radius={20} lift={0.6} melt={5} pearl={1} dx={dx} sx={sx} presence={ready} />
        </View>
      )}
      <View style={styles.options}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              style={styles.option}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={o.label}
              onPress={() => { if (!on) { feel.touch(); onChange(o.value); } }}
            >
              {o.icon && <Icon name={o.icon} size={17} />}
              <Txt variant="label" tone={on ? 'ink' : 'soft'} style={{ fontSize: 14 }}>{o.label}</Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  switchWrap: { width: TW, height: TH },
  track: { width: TW, height: TH },
  knobSpot: { position: 'absolute', left: 4, top: (TH - KNOB) / 2 },
  knob: { width: KNOB + 4, height: KNOB },
  choice: { height: 48, padding: 4, justifyContent: 'center' },
  beadSpot: { position: 'absolute', left: 4, top: 4, bottom: 4 },
  bead: { flex: 1 },
  options: { flexDirection: 'row', flex: 1 },
  option: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
