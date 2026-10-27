// The shortlist: given the time you have, a calm plan of at most three
// things. Pure functions, tested in plan.test.ts.
//
// How it chooses:
//   - only open desk tasks (errands stay on the phone)
//   - oldest first: the longer something has waited, the louder it is in
//     your head; things you said were "still true" count from then
//   - a small nudge for short tasks and for ones with a first step, so a
//     plan usually starts with something easy to begin
//   - fill the time without going over, at most three; if nothing fits, the
//     most pressing task as "a start on it" (work on it for the time you have)

import type { Task } from '../../shared/task.ts';

export const MAX_PICKS = 3;

export interface Pick {
  task: Task;
  minutes: number;
  /** Bigger than the time you have: the plan is to start it, not finish it. */
  partial: boolean;
}

export interface Plan {
  picks: Pick[];
  /** Minutes the plan fills. */
  total: number;
  available: number;
}

const DAY = 86_400_000;

export function waiting(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.status === 'open' && t.place !== 'errand');
}

/** How loudly a task is asking for attention. Higher goes first. */
export function urgency(task: Task, now = Date.now()): number {
  const since = Date.parse(task.confirmedAt ?? task.createdAt);
  const days = Math.max(0, (now - since) / DAY);
  const minutes = task.estimateMinutes ?? 25;
  return (
    Math.log2(1 + days) * 2 // waiting grows louder, then levels off
    + (minutes <= 15 ? 0.8 : minutes <= 30 ? 0.4 : 0) // easy to begin
    + (task.firstStep ? 0.3 : 0)
    + (task.leftOffNote ? 0.6 : 0) // you've started it before
  );
}

export function shortlist(tasks: Task[], available: number, skip: Set<string> = new Set(), now = Date.now()): Plan {
  const pool = waiting(tasks)
    .filter((t) => !skip.has(t.id))
    .sort((a, b) => urgency(b, now) - urgency(a, now) || a.createdAt.localeCompare(b.createdAt));

  const picks: Pick[] = [];
  let left = available;
  for (const task of pool) {
    if (picks.length >= MAX_PICKS) break;
    const minutes = task.estimateMinutes ?? 25;
    if (minutes <= left) {
      picks.push({ task, minutes, partial: false });
      left -= minutes;
    }
  }
  if (!picks.length && pool.length) {
    picks.push({ task: pool[0], minutes: available, partial: true });
    left = 0;
  }
  return { picks, total: available - left, available };
}

/** Everything open at the desk, in the order the plan would take it. */
export function byUrgency(tasks: Task[], now = Date.now()): Task[] {
  return waiting(tasks).sort((a, b) => urgency(b, now) - urgency(a, now) || a.createdAt.localeCompare(b.createdAt));
}

export function formatMinutes(m: number): string {
  if (m < 60) return `${Math.round(m)} min`;
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return r ? `${h} h ${r}` : `${h} h`;
}

/** "today", "yesterday", "3 days ago". */
export function age(task: Task, now = Date.now()): string {
  const d = Math.floor((now - Date.parse(task.createdAt)) / DAY);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
}
