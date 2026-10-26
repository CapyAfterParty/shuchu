// Shared, UI-thread state of the one scene everything is drawn in.
// Screens never draw glass themselves: they claim a slot and describe a shape.

import { makeMutable, type SharedValue } from 'react-native-reanimated';
import { RIPPLES, SLOTS, SPARKS } from './shader';

export interface Shape {
  cx: number; cy: number; hw: number; hh: number;
  radius: number;
  /** 0 = not there, 1 = fully formed. Shapes grow from a point, like a drop. */
  presence: number;
  /** How far it melts into neighbours (px). 0 = crisp edges. */
  melt: number;
  /** Height above the backdrop; deepens its shadow. 0..1 */
  lift: number;
  sx: number; sy: number;
  /** Slow organic breathing of the outline (px). */
  wobble: number;
  seed: number;
  /** Milky, opal-like body (selected beads). 0..1 */
  pearl: number;
  /** Warm light inside the glass. 0..1 */
  warm: number;
  /** 0 = rests on the mist, 1 = rests on a sheet of glass. */
  layer?: number;
}

const EMPTY = new Array<number>(16).fill(0);
export const slots: SharedValue<number[]>[] = Array.from({ length: SLOTS }, () => makeMutable(EMPTY));
export const sparks: SharedValue<number[]>[] = Array.from({ length: SPARKS }, () => makeMutable([0, 0, 0, 0]));
/** x, y, start time (ms, scene clock), strength */
export const ripples: SharedValue<number[]>[] = Array.from({ length: RIPPLES }, () => makeMutable([0, 0, 0, 0]));
export const sceneClock = makeMutable(0);
/** 1 = full drift and tilt light, lower = calmer. Eased, never jumps. */
export const motion = makeMutable(1);
/** Depth of field behind sheets. */
export const haze = makeMutable(0);
/** Where the capture stone is on screen, so other glass can flow into it. */
export const stoneFrame = makeMutable({ x: 0, y: 0, w: 0, h: 0 });
/** 0 = mist (day), 1 = night. Animated, so the world crossfades. */
export const themeBlend = makeMutable(0);

const freeSlots = new Set(Array.from({ length: SLOTS }, (_, i) => i));
const freeSparks = new Set(Array.from({ length: SPARKS }, (_, i) => i));

export function claimSlot(): number {
  const [first] = freeSlots;
  if (first === undefined) return -1;
  freeSlots.delete(first);
  return first;
}

// A frame callback may still write once after its owner unmounts, so a
// released slot is cleared again a few frames later before it is reused.
export function releaseSlot(i: number): void {
  if (i < 0) return;
  slots[i].value = EMPTY;
  setTimeout(() => {
    slots[i].value = EMPTY;
    freeSlots.add(i);
  }, 80);
}

export function claimSpark(): number {
  const [first] = freeSparks;
  if (first === undefined) return -1;
  freeSparks.delete(first);
  return first;
}

export function releaseSpark(i: number): void {
  if (i < 0) return;
  sparks[i].value = [0, 0, 0, 0];
  setTimeout(() => {
    sparks[i].value = [0, 0, 0, 0];
    freeSparks.add(i);
  }, 80);
}

export function writeShape(slot: number, s: Shape): void {
  'worklet';
  if (slot < 0) return;
  slots[slot].value = [
    s.cx, s.cy, s.hw, s.hh,
    s.radius, s.presence, s.melt, s.lift,
    s.sx, s.sy, s.wobble, s.seed,
    s.pearl, s.warm, s.layer ?? 0, 0,
  ];
}

export function writeSpark(i: number, x: number, y: number, intensity: number, radius: number): void {
  'worklet';
  if (i < 0) return;
  sparks[i].value = [x, y, intensity, radius];
}

// A shared value, not a plain variable: worklets can't reassign captured variables.
const nextRipple = makeMutable(0);
/** A ripple through the atmosphere, e.g. where a pebble lands. */
export function ripple(x: number, y: number, strength = 1): void {
  'worklet';
  const i = nextRipple.value;
  nextRipple.value = (i + 1) % RIPPLES;
  ripples[i].value = [x, y, sceneClock.value, strength];
}
