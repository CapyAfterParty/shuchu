// Haptics and sound, composed as signatures rather than random buzzes.
// Each moment in the app has its own feel; all of them respect Settings.

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { settings } from '../data/settings';

const { ImpactFeedbackStyle: Impact } = Haptics;
const canBuzz = Platform.OS !== 'web';

function level() {
  return settings.get().haptics;
}

function impact(style: Haptics.ImpactFeedbackStyle): void {
  if (!canBuzz || level() === 'off') return;
  const gentle = level() === 'gentle';
  const soften: Partial<Record<Haptics.ImpactFeedbackStyle, Haptics.ImpactFeedbackStyle>> = {
    [Impact.Heavy]: Impact.Medium,
    [Impact.Medium]: Impact.Soft,
    [Impact.Rigid]: Impact.Light,
  };
  void Haptics.impactAsync(gentle ? soften[style] ?? style : style).catch(() => {});
}

function later(ms: number, fn: () => void): void {
  setTimeout(fn, ms);
}

export const feel = {
  /** Fingertip on glass. */
  touch() {
    impact(Impact.Soft);
  },
  /** One notch on a dial. */
  tick() {
    if (!canBuzz || level() === 'off') return;
    void Haptics.selectionAsync().catch(() => {});
  },
  /** A thought leaves your head: a soft press, then the pebble pinching off. */
  catch() {
    impact(Impact.Soft);
    if (level() === 'full') later(90, () => impact(Impact.Light));
    sound('catch');
  },
  /** A pebble comes to rest. */
  land(strength = 1) {
    impact(strength > 0.6 ? Impact.Light : Impact.Soft);
    if (strength > 0.6) sound('settle', 0.5);
  },
  /** Two soft beats, a calm resting heart. */
  heartbeat() {
    impact(Impact.Soft);
    if (level() === 'full') later(150, () => impact(Impact.Soft));
  },
  /** Holding the light: the pressure rises with progress 0..1. */
  swell(progress: number) {
    impact(progress < 0.35 ? Impact.Soft : progress < 0.7 ? Impact.Light : Impact.Medium);
  },
  /** Something completed, without fanfare. */
  done() {
    if (!canBuzz || level() === 'off') return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  /** Arrival at the end of onboarding. */
  bloom() {
    impact(Impact.Medium);
    if (level() === 'full') {
      later(110, () => impact(Impact.Light));
      later(260, () => impact(Impact.Soft));
    }
    sound('chime', 0.8);
  },
  /** A gentle no. */
  nope() {
    if (!canBuzz || level() === 'off') return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
};

type SoundName = 'catch' | 'settle' | 'chime';
const SOURCES: Record<SoundName, number> = {
  catch: require('../../assets/sounds/catch.wav'),
  settle: require('../../assets/sounds/settle.wav'),
  chime: require('../../assets/sounds/chime.wav'),
};
const players: Partial<Record<SoundName, AudioPlayer>> = {};
let audioReady = false;

function sound(name: SoundName, volume = 0.7): void {
  if (!settings.get().sound) return;
  try {
    if (!audioReady) {
      audioReady = true;
      void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
    }
    const player = (players[name] ??= createAudioPlayer(SOURCES[name]));
    player.volume = volume;
    void player.seekTo(0);
    player.play();
  } catch {
    // Sound is a garnish; never let it break anything.
  }
}

/** Play a sound regardless of the setting, e.g. to preview it in Settings. */
export function previewSound(): void {
  const was = settings.get().sound;
  settings.set((s) => ({ ...s, sound: true }));
  sound('catch');
  settings.set((s) => ({ ...s, sound: was }));
}
