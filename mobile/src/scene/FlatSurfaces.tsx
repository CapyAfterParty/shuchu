// Porcelain: the same world, drawn flat and fast.
//
// Every screen already describes its surfaces as shapes in the scene's slots
// (sheets, stones, beads, pebbles in flight). Here each slot becomes a plain
// native view instead of a shader lens: a soft, milky porcelain body with a
// sheen along the top edge, a hairline rim and a shadow that deepens with
// lift. Nothing per pixel, so it runs smoothly on any phone, and because it
// reads the very same shapes, every animation (morphing heroes, falling
// pebbles, jelly presses) still plays.

import { StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';
import { SLOTS, SPARKS } from './shader';
import { slots, sparks, themeBlend } from './world';

// day and night bodies; warmth leans towards the spark colour
const BODY = ['rgba(250,252,254,0.78)', 'rgba(46,58,74,0.78)'];
const PEARL = ['rgba(255,255,255,0.96)', 'rgba(86,102,122,0.92)'];
const WARM = ['rgba(255,226,204,0.92)', 'rgba(120,84,62,0.9)'];
const RIM = ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.12)'];
const SHADE = ['rgba(40,62,92,0.16)', 'rgba(0,0,0,0.45)'];

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
    return {
      opacity: Math.min(1, presence * 1.6),
      left: v[0] - w / 2,
      top: v[1] - h / 2,
      width: w,
      height: h,
      borderRadius: r,
      backgroundColor: fill,
      borderColor: interpolateColor(n, [0, 1], RIM),
      boxShadow: [{
        offsetX: 0,
        offsetY: 3 + lift * 10,
        blurRadius: 10 + lift * 26,
        spreadDistance: 0,
        color: interpolateColor(n, [0, 1], SHADE),
      }],
    };
  });
  return (
    <Animated.View style={[styles.surface, body]}>
      <View style={styles.sheen} />
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
    borderWidth: StyleSheet.hairlineWidth,
  },
  // light pooled along the top edge, fading downwards
  sheen: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.08) 38%, rgba(255,255,255,0) 60%)',
  },
  spark: { position: 'absolute', backgroundColor: '#FFF6EC' },
});
