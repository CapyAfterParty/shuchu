// Porcelain: the same world, made of glazed ceramic instead of glass.
//
// Every screen already describes its surfaces as shapes in the scene's slots
// (sheets, stones, beads, pebbles in flight). Here each slot becomes a native
// view shaped like a piece of porcelain: an opaque body, a bright glazed rim
// along the top where light catches the curve, soft shade pooling inside the
// lower edge, a small glaze highlight, a contact shadow and a softer ambient
// one that deepens with lift. Nothing per pixel, so it runs smoothly on any
// phone, and because it reads the very same shapes, every animation (morphing
// heroes, falling pebbles, jelly presses) still plays.

import { StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';
import { SLOTS, SPARKS } from './shader';
import { slots, sparks, themeBlend } from './world';

// day and night glazes: warm white china and a deep slate glaze;
// pearl is a brighter glaze, warmth a blush of the spark colour
const BODY = ['#F4F2EF', '#2A333F'];
const PEARL = ['#FFFFFF', '#384352'];
const WARM = ['#FBE6D7', '#4A3B33'];
const RIM = ['rgba(255,255,255,1)', 'rgba(255,255,255,0.16)'];
const POOL = ['rgba(70,84,108,0.13)', 'rgba(0,0,0,0.38)'];
const CONTACT = ['rgba(30,42,62,0.16)', 'rgba(0,0,0,0.55)'];
const AMBIENT = ['rgba(40,62,92,0.12)', 'rgba(0,0,0,0.4)'];
const GLAZE = ['rgba(255,255,255,0.5)', 'rgba(255,255,255,0.06)'];

const ORDER = [
  ...Array.from({ length: SLOTS }, (_, i) => ({ i, layer: 0 })),
  ...Array.from({ length: SLOTS }, (_, i) => ({ i, layer: 1 })),
];

export function FlatSurfaces() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* sheets and stones first, then the controls resting on them */}
      {ORDER.map(({ i, layer }) => <Surface key={`${layer}-${i}`} slot={i} layer={layer} />)}
      {Array.from({ length: SPARKS }, (_, i) => <Spark key={`s${i}`} slot={i} />)}
    </View>
  );
}

function Surface({ slot, layer }: { slot: number; layer: number }) {
  const body = useAnimatedStyle(() => {
    const v = slots[slot].value;
    const presence = v[5];
    const onLayer = Math.abs(v[14] - layer) < 0.5;
    if (presence < 0.002 || !onLayer) return { opacity: 0, width: 0, height: 0 };
    // the shader grows shapes from their centre with presence; so does this
    const w = Math.max(0, v[2] * 2 * presence * (v[8] || 1));
    const h = Math.max(0, v[3] * 2 * presence * (v[9] || 1));
    const r = Math.min(v[4] * presence, w / 2, h / 2);
    const lift = v[7];
    const n = themeBlend.value;
    const pearl = Math.min(1, v[12]);
    const warm = Math.min(1, v[13]);
    const base = interpolateColor(n, [0, 1], BODY);
    const lit = interpolateColor(pearl, [0, 1], [base, interpolateColor(n, [0, 1], PEARL)]);
    const fill = interpolateColor(warm, [0, 1], [lit, interpolateColor(n, [0, 1], WARM)]);
    // the curve of the piece: deeper bodies pool more shade inside the lower edge
    const depth = Math.min(1, Math.min(w, h) / 120);
    return {
      opacity: Math.min(1, presence * 1.6),
      left: v[0] - w / 2,
      top: v[1] - h / 2,
      width: w,
      height: h,
      borderRadius: r,
      backgroundColor: fill,
      boxShadow: [
        { offsetX: 0, offsetY: 1.5, blurRadius: 1, spreadDistance: 0, color: interpolateColor(n, [0, 1], RIM), inset: true },
        { offsetX: 0, offsetY: -(3 + depth * 7), blurRadius: 8 + depth * 14, spreadDistance: 0, color: interpolateColor(n, [0, 1], POOL), inset: true },
        { offsetX: 0, offsetY: 1, blurRadius: 2, spreadDistance: 0, color: interpolateColor(n, [0, 1], CONTACT) },
        { offsetX: 0, offsetY: 4 + lift * 12, blurRadius: 12 + lift * 26, spreadDistance: -2, color: interpolateColor(n, [0, 1], AMBIENT) },
      ],
    };
  });
  // the glaze catches the light as one soft highlight near the top
  const glaze = useAnimatedStyle(() => {
    const v = slots[slot].value;
    const w = v[2] * 2 * v[5] * (v[8] || 1);
    const h = v[3] * 2 * v[5] * (v[9] || 1);
    const gw = w * 0.34;
    const gh = Math.max(3, Math.min(h * 0.12, 12));
    return {
      width: gw,
      height: gh,
      borderRadius: gh,
      left: Math.min(w * 0.12, 26),
      top: Math.max(2, Math.min(h * 0.08, 12)),
      backgroundColor: interpolateColor(themeBlend.value, [0, 1], GLAZE),
      // only small and medium pieces show it; on a sheet it reads as a smear
      opacity: w > 18 && w < 240 && h < 200 ? 1 : 0,
    };
  });
  return (
    <Animated.View style={[styles.surface, body]}>
      <Animated.View style={[styles.glaze, glaze]} />
    </Animated.View>
  );
}

function Spark({ slot }: { slot: number }) {
  const glow = useAnimatedStyle(() => {
    const [x, y, intensity, r] = sparks[slot].value;
    const i = Math.min(1, intensity);
    if (i < 0.01) return { opacity: 0 };
    const d = Math.max(4, r * 1.6);
    return {
      opacity: i,
      left: x - d / 2,
      top: y - d / 2,
      width: d,
      height: d,
      borderRadius: d / 2,
      boxShadow: [
        { offsetX: 0, offsetY: 0, blurRadius: r * 3, spreadDistance: r * 0.6, color: 'rgba(255,178,126,0.85)' },
        { offsetX: 0, offsetY: 0, blurRadius: r * 10, spreadDistance: r, color: 'rgba(255,190,150,0.35)' },
      ],
    };
  });
  return <Animated.View style={[styles.spark, glow]} />;
}

const styles = StyleSheet.create({
  surface: {
    position: 'absolute',
    overflow: 'hidden',
  },
  glaze: { position: 'absolute', transform: [{ rotateZ: '-4deg' }] },
  spark: { position: 'absolute', backgroundColor: '#FFF6EC' },
});
