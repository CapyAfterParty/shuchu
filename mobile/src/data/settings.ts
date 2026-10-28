// Everything the person can tune. Calm defaults: sound off, haptics on.

import { createStore, load, save, useStore } from './store';

export type Appearance = 'auto' | 'mist' | 'night';
export type HapticLevel = 'full' | 'gentle' | 'off';

export interface Settings {
  onboarded: boolean;
  eveningOn: boolean;
  eveningHour: number;
  eveningMinute: number;
  haptics: HapticLevel;
  sound: boolean;
  appearance: Appearance;
  calmMotion: boolean;
  /** Porcelain: surfaces drawn flat and fast, for phones that find the glass heavy. */
  porcelain: boolean;
}

const KEY = 'shuchu.settings.v1';

export const defaults: Settings = {
  onboarded: false,
  eveningOn: true,
  eveningHour: 21,
  eveningMinute: 0,
  haptics: 'full',
  sound: false,
  appearance: 'auto',
  calmMotion: false,
  porcelain: false,
};

export const settings = createStore<Settings>(defaults);
export const settingsReady = load(KEY, defaults).then((s) => settings.set(s));

export function updateSettings(patch: Partial<Settings>): void {
  settings.set((s) => ({ ...s, ...patch }));
  void save(KEY, settings.get());
}

export function useSettings<S>(select: (s: Settings) => S): S {
  return useStore(settings, select);
}
