// Everything the person can tune. Calm defaults: sound off, haptics on.

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { createStore, load, save, useStore } from './store';

export type Appearance = 'auto' | 'mist' | 'night';
export type HapticLevel = 'full' | 'gentle' | 'off';

export interface Settings {
  onboarded: boolean;
  /** null = find the desk automatically (same computer as the dev server). */
  serverUrl: string | null;
  eveningOn: boolean;
  eveningHour: number;
  eveningMinute: number;
  haptics: HapticLevel;
  sound: boolean;
  appearance: Appearance;
  calmMotion: boolean;
}

const KEY = 'shuchu.settings.v1';

export const defaults: Settings = {
  onboarded: false,
  serverUrl: null,
  eveningOn: true,
  eveningHour: 21,
  eveningMinute: 0,
  haptics: 'full',
  sound: false,
  appearance: 'auto',
  calmMotion: false,
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

/** Where the desk server probably is: the same machine that serves this app. */
export function guessedServerUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:4545`;
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:4545`;
}

export function serverUrl(): string {
  return (settings.get().serverUrl ?? guessedServerUrl()).replace(/\/+$/, '');
}
