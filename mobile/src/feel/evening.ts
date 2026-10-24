// The one gentle prompt of the day: "Anything still in your head?"

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { settings } from '../data/settings';

const PROMPTS = [
  'Anything still in your head?',
  'Before you rest: anything still in your head?',
  'One breath. Anything left to put down?',
];

export async function askPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const asked = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: false, allowBadge: false } });
    return asked.granted;
  } catch {
    return false;
  }
}

/** Keep the scheduled prompt in line with Settings. */
export async function syncEvening(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const s = settings.get();
    if (!s.eveningOn || !s.onboarded) return;
    const granted = (await Notifications.getPermissionsAsync()).granted;
    if (!granted) return;
    if (Platform.OS === 'android') {
      // Android 8+ shows nothing without a channel; this one is quiet by design
      await Notifications.setNotificationChannelAsync('evening', {
        name: 'Evening question',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: null,
        vibrationPattern: [0, 40],
      });
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: PROMPTS[new Date().getDate() % PROMPTS.length],
        body: 'Catch it here so it stops circling.',
        sound: false,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: s.eveningHour, minute: s.eveningMinute, channelId: 'evening' },
    });
  } catch {
    // Notifications are optional; capture never depends on them.
  }
}

export function formatClock(hour: number, minute: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}
