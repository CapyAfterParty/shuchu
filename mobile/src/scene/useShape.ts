// A free glass shape not tied to any view: for heroes that morph between
// forms (a drop, a stone, a desk, a moon) and for pebbles in flight.

import { useEffect, useState } from 'react';
import { type SharedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { claimSlot, releaseSlot, writeShape } from './world';

export interface FreeShape {
  cx: SharedValue<number>; cy: SharedValue<number>;
  hw: SharedValue<number>; hh: SharedValue<number>;
  radius: SharedValue<number>;
  presence: SharedValue<number>;
  melt: SharedValue<number>;
  lift: SharedValue<number>;
  pearl: SharedValue<number>;
  warm: SharedValue<number>;
  sx: SharedValue<number>; sy: SharedValue<number>;
}

export function useShape(initial: Partial<Record<keyof FreeShape, number>> = {}, wobble = 2): FreeShape {
  const [slot] = useState(claimSlot);
  const [seed] = useState(() => Math.random());
  useEffect(() => () => releaseSlot(slot), [slot]);
  const shape: FreeShape = {
    cx: useSharedValue(initial.cx ?? 0),
    cy: useSharedValue(initial.cy ?? 0),
    hw: useSharedValue(initial.hw ?? 40),
    hh: useSharedValue(initial.hh ?? 40),
    radius: useSharedValue(initial.radius ?? 40),
    presence: useSharedValue(initial.presence ?? 0),
    melt: useSharedValue(initial.melt ?? 0),
    lift: useSharedValue(initial.lift ?? 0.6),
    pearl: useSharedValue(initial.pearl ?? 0),
    warm: useSharedValue(initial.warm ?? 0),
    sx: useSharedValue(initial.sx ?? 1),
    sy: useSharedValue(initial.sy ?? 1),
  };
  useFrameCallback(() => {
    writeShape(slot, {
      cx: shape.cx.value, cy: shape.cy.value, hw: shape.hw.value, hh: shape.hh.value,
      radius: Math.min(shape.radius.value, shape.hw.value, shape.hh.value),
      presence: shape.presence.value, melt: shape.melt.value, lift: shape.lift.value,
      sx: shape.sx.value, sy: shape.sy.value, wobble, seed,
      pearl: shape.pearl.value, warm: shape.warm.value,
    });
  });
  return shape;
}
