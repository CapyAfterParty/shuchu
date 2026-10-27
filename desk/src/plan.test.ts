// Run: npm test
import type { Task } from '../../shared/task.ts';
import { shortlist, urgency } from './plan.ts';

const NOW = Date.parse('2026-10-27T10:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
let n = 0;
const task = (title: string, minutes: number, days: number, extra: Partial<Task> = {}): Task => ({
  id: `t${n++}`, originalText: title, cleanTitle: title, estimateMinutes: minutes, createdAt: daysAgo(days), status: 'open', place: 'desk', ...extra,
});

let bad = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `  ${detail}`}`);
};

const tasks = [
  task('Call dentist', 10, 3),
  task('Write report', 60, 1),
  task('Reply to Mina', 5, 0),
  task('Fix login bug', 45, 6),
  task('Buy milk', 25, 4, { place: 'errand' }),
  task('Old done thing', 10, 9, { status: 'done' }),
];

const p30 = shortlist(tasks, 30, new Set(), NOW);
check('30 min fits without going over', p30.total <= 30, JSON.stringify(p30));
check('30 min: dentist and Mina, not the 45 min bug', p30.picks.map((p) => p.task.cleanTitle).join(',') === 'Call dentist,Reply to Mina', p30.picks.map((p) => p.task.cleanTitle).join(','));
check('errands and finished tasks never appear', !p30.picks.some((p) => p.task.place === 'errand' || p.task.status !== 'open'));

const p60 = shortlist(tasks, 60, new Set(), NOW);
check('1 h: the old bug comes first', p60.picks[0]?.task.cleanTitle === 'Fix login bug', p60.picks.map((p) => p.task.cleanTitle).join(','));
check('at most three picks', shortlist(tasks, 600, new Set(), NOW).picks.length <= 3);

const p5 = shortlist([task('Write thesis chapter', 120, 2)], 15, new Set(), NOW);
check('nothing fits: a start on the most pressing', p5.picks.length === 1 && p5.picks[0].partial && p5.picks[0].minutes === 15);

const skipped = shortlist(tasks, 30, new Set([tasks[0].id]), NOW);
check('"something else" skips a task', !skipped.picks.some((p) => p.task.id === tasks[0].id));

check('older is louder', urgency(task('a', 25, 10), NOW) > urgency(task('b', 25, 0), NOW));
check('"still true" resets the clock', urgency(task('a', 25, 10, { confirmedAt: daysAgo(0) }), NOW) < urgency(task('b', 25, 10), NOW));

check('empty desk: empty plan', shortlist([], 60, new Set(), NOW).picks.length === 0);

console.log(bad ? `\n${bad} failing` : '\nall passing');
process.exit(bad ? 1 : 0);
