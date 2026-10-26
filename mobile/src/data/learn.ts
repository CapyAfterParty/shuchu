// Remembers how you re-time things, so the next guess is closer (estimate.ts).

import { learn, type Lessons } from './estimate';
import { load, save } from './store';

const KEY = 'shuchu.lessons.v1';
let lessons: Lessons = {};
export const lessonsReady = load<Lessons>(KEY, {}).then((l) => { lessons = l; });

export function currentLessons(): Lessons {
  return lessons;
}

/** You chose a different time for this thought: remember it. */
export function rememberTiming(text: string, minutes: number): void {
  lessons = learn(lessons, text, minutes);
  void save(KEY, lessons);
}
