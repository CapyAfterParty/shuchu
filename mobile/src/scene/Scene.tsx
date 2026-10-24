// The single canvas behind every screen. It never unmounts, so the
// atmosphere flows continuously through onboarding, capture and sheets.

import { Canvas, Fill, Shader, Skia, useClock } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { PixelRatio, StyleSheet, useWindowDimensions } from 'react-native';
import {
  SensorType,
  useAnimatedSensor,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import { mist, night, type Rgb } from '../theme/tokens';
import { RIPPLES, sceneShader, SLOTS, SPARKS } from './shader';
import { haze, motion, ripples, sceneClock, slots, sparks, themeBlend } from './world';

const effect = Skia.RuntimeEffect.Make(sceneShader);
if (!effect) throw new Error('Shuchu scene shader failed to compile');

const BASE_LIGHT = { x: -0.46, y: -0.89 };

export function Scene() {
  const { width, height } = useWindowDimensions();
  const density = PixelRatio.get();
  const clock = useClock();
  const rotation = useAnimatedSensor(SensorType.ROTATION, { interval: 16 });

  // Light follows tilt relative to however you naturally hold the phone:
  // a slow average becomes "rest", quick movements swing the light.
  const rest = useSharedValue({ pitch: 0, roll: 0, ready: false });
  const tilt = useSharedValue({ x: 0, y: 0 });
  // The atmosphere's own time runs at the motion speed, so calming it slows
  // the drift smoothly instead of jumping.
  const drift = useSharedValue(0);
  const lastClock = useSharedValue(0);
  const speed = useSharedValue(1);

  useFrameCallback(() => {
    sceneClock.value = clock.value;
    const dt = lastClock.value ? Math.min(clock.value - lastClock.value, 100) : 0;
    lastClock.value = clock.value;
    speed.value += (motion.value - speed.value) * 0.03;
    drift.value += dt * (0.25 + 0.75 * speed.value);
    const r = rotation.sensor.value;
    if (!r || (r.pitch === 0 && r.roll === 0 && r.yaw === 0)) return;
    const s = rest.value;
    const base = s.ready ? s : { pitch: r.pitch, roll: r.roll, ready: true };
    const next = {
      pitch: base.pitch + (r.pitch - base.pitch) * 0.004,
      roll: base.roll + (r.roll - base.roll) * 0.004,
      ready: true,
    };
    rest.value = next;
    const tx = Math.max(-1, Math.min(1, (r.roll - next.roll) * 2.2)) * speed.value;
    const ty = Math.max(-1, Math.min(1, (r.pitch - next.pitch) * 2.2)) * speed.value;
    const t = tilt.value;
    tilt.value = { x: t.x + (tx - t.x) * 0.12, y: t.y + (ty - t.y) * 0.12 };
  });

  const uniforms = useDerivedValue(() => {
    const k = themeBlend.value;
    const mixc = (a: Rgb, b: Rgb) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    const t = tilt.value;
    let lx = BASE_LIGHT.x + t.x * 0.9;
    let ly = BASE_LIGHT.y - t.y * 0.7;
    const ll = Math.sqrt(lx * lx + ly * ly) || 1;
    lx /= ll;
    ly /= ll;

    const A: number[][] = [];
    const B: number[][] = [];
    const C: number[][] = [];
    const D: number[][] = [];
    for (let i = 0; i < SLOTS; i++) {
      const v = slots[i].value;
      A.push([v[0], v[1], v[2], v[3]]);
      B.push([v[4], v[5], v[6], v[7]]);
      C.push([v[8] || 1, v[9] || 1, v[10], v[11]]);
      D.push([v[12], v[13], v[14], v[15]]);
    }
    const K: number[][] = [];
    for (let i = 0; i < SPARKS; i++) K.push(sparks[i].value);
    const now = clock.value;
    const W: number[][] = [];
    for (let i = 0; i < RIPPLES; i++) {
      const r = ripples[i].value;
      const age = (now - r[2]) / 1000;
      W.push([r[0], r[1], age, age < 3 ? r[3] : 0]);
    }

    return {
      res: [width, height],
      time: drift.value,
      density,
      light: [lx, ly],
      tilt: [t.x, t.y],
      haze: haze.value,
      air: mixc(mist.air, night.air),
      b0: mixc(mist.blobs[0], night.blobs[0]),
      b1: mixc(mist.blobs[1], night.blobs[1]),
      b2: mixc(mist.blobs[2], night.blobs[2]),
      b3: mixc(mist.blobs[3], night.blobs[3]),
      b4: mixc(mist.blobs[4], night.blobs[4]),
      b5: mixc(mist.blobs[5], night.blobs[5]),
      milk: mixc(mist.milk, night.milk),
      shade: mixc(mist.shade, night.shade),
      sparkColor: mixc(mist.spark, night.spark),
      glassStrength: mist.glassStrength + (night.glassStrength - mist.glassStrength) * k,
      shadowStrength: mist.shadowStrength + (night.shadowStrength - mist.shadowStrength) * k,
      night: k,
      shapeA: A,
      shapeB: B,
      shapeC: C,
      shapeD: D,
      sparks: K,
      ripples: W,
    };
  });

  const style = useMemo(() => StyleSheet.flatten([StyleSheet.absoluteFill, { width, height }]), [width, height]);

  return (
    <Canvas style={style} pointerEvents="none">
      <Fill>
        <Shader source={effect!} uniforms={uniforms} />
      </Fill>
    </Canvas>
  );
}
