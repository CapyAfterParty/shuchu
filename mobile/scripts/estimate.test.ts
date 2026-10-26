// Run: node --experimental-strip-types scripts/estimate.test.ts
import { baseEstimate, learn, personalEstimate, spokenMinutes, type Lessons } from '../src/data/estimate.ts';

const cases: [string, number, number][] = [
  // text, at least, at most (minutes)
  ['text mom', 5, 5],
  ['quick reply to sarah', 5, 5],
  ['call dentist thing', 5, 10],
  ['call the bank about the card', 10, 15],
  ['email Mina back', 10, 10],
  ['reply to 3 emails', 15, 25],
  ['pay the electricity bill', 5, 10],
  ['book a haircut', 10, 10],
  ['renew passport', 10, 15],
  ['buy milk', 15, 25],
  ['pick up dry cleaning', 15, 25],
  ['read the article Tom sent', 15, 25],
  ['review the contract', 25, 25],
  ['write the quarterly report', 60, 90],
  ['write a quick note to the landlord', 15, 25],
  ['draft the proposal', 60, 90],
  ['start the essay', 25, 45],
  ['fix the invoice thing', 25, 45],
  ['fix the login bug', 45, 45],
  ['clean the whole garage', 120, 120],
  ['tidy desk', 25, 25],
  ['do taxes', 25, 60],
  ['finish thesis chapter', 90, 120],
  ['think about the logo idea', 15, 15],
  ['prepare slides for monday', 60, 90],
  ['gym', 25, 25],
  ['call mum 5 min', 5, 5],
  ['spend an hour on the budget', 60, 60],
  ['half an hour of spanish practice', 25, 45],
  ['water the plants', 5, 5],
  ['take my meds', 5, 25],
  ['move apartments', 120, 120],
  ['plan the trip to lisbon', 45, 60],
  ['study for the exam', 90, 120],
];

let bad = 0;
for (const [text, lo, hi] of cases) {
  const e = baseEstimate(text);
  const ok = e.minutes >= lo && e.minutes <= hi;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${String(e.minutes).padStart(3)} min  ${text}${ok ? '' : `   (wanted ${lo}-${hi}, raw ${e.raw.toFixed(1)}, ${e.because})`}`);
}

// spoken durations
const spoken: [string, number | null][] = [['call mum 5 min', 5], ['2h on taxes', 120], ['an hour', 60], ['1.5 hours', 90], ['meet at 5pm', null], ['3 emails', null]];
for (const [t, want] of spoken) {
  const got = spokenMinutes(t);
  if (got !== want) { bad++; console.log(`FAIL spoken "${t}" = ${got}, wanted ${want}`); }
}

// learning: someone whose "gym" takes an hour
let lessons: Lessons = {};
const before = personalEstimate('gym', lessons);
lessons = learn(lessons, 'gym', 60);
const once = personalEstimate('gym', lessons);
lessons = learn(lessons, 'gym session', 60);
lessons = learn(lessons, 'gym', 60);
const thrice = personalEstimate('gym legs day', lessons);
console.log(`learning: gym ${before} → after one correction ${once} → after three ${thrice}`);
if (!(once > before && thrice >= once && thrice >= 45)) { bad++; console.log('FAIL learning did not move towards 60'); }
// a said time is never overridden
if (personalEstimate('gym 10 min', lessons) !== 10) { bad++; console.log('FAIL said time overridden'); }
// unrelated words are untouched
if (personalEstimate('text mom', lessons) !== 5) { bad++; console.log('FAIL learning leaked to unrelated words'); }

console.log(bad ? `\n${bad} failing` : '\nall passing');
process.exit(bad ? 1 : 0);
