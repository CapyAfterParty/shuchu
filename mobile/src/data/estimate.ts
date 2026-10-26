// How long will it take? A small, explainable estimator: no model, no
// network. It reads a thought the way a person would:
//
//   1. A time you said out loud wins ("call mum, 5 min", "an hour on taxes").
//   2. Otherwise the action sets the base: texting is quick, calling is a
//      few minutes, writing is long. Every word is read, not just the first.
//   3. The thing being acted on adjusts it: an essay is bigger than a note,
//      the garage bigger than a drawer.
//   4. Words of size scale it: "quick", "just", "tiny" shrink; "whole",
//      "big", "properly" grow. "Start" means only the first stretch.
//   5. Counts multiply, gently: three emails take longer than one, but not
//      three times as long.
//   6. Your own corrections teach it: words you keep re-timing pull future
//      guesses towards what you chose (see learn.ts).
//
// Pure functions only, so it can be tested without a phone.

export const ESTIMATES = [5, 10, 15, 25, 45, 60, 90, 120] as const;

type Verb = { words: RegExp; minutes: number };

// The action. Order matters only for ties: earlier entries are more specific.
const VERBS: Verb[] = [
  // a few minutes or less
  { words: /\b(text|txt|whatsapp|dm|reply|respond|rsvp|confirm|like|react|forward|sign|tick|remind|note|jot|save|bookmark|star|water|feed|charge|unsubscribe|cancel|vote|accept|decline|share|venmo|tip|top\s*up)\b/, minutes: 5 },
  // ten-ish minutes
  { words: /\b(call|phone|ring|facetime|email|e-mail|mail|message|ask|tell|invite|thank|book|reserve|schedule|reschedule|order|renew|pay|transfer|send|submit|upload|download|install|update|print|scan|post|backup|back\s*up|register|sign\s*up|log|track|refill|return|ship)\b/, minutes: 10 },
  // a sitting
  { words: /\b(read|review|check|look\s+(at|into|over)|go\s+through|watch|listen|fill\s*(in|out)?|apply|compare|decide|choose|pick|sort|tidy|wash|iron|fold|cook|bake|prep|shop|buy|grab|pick\s*up|get|collect|drop\s*off|meet|catch\s*up|chat|sync|discuss|test|try|edit|proofread|practi[sc]e|exercise|workout|run|walk|stretch|meditate|journal)\b/, minutes: 25 },
  // proper work
  { words: /\b(write|draft|finish|prepare|plan|outline|research|investigate|fix|debug|repair|solve|figure\s+out|work\s+(on|out)|design|sketch|build|make|create|set\s*up|configure|learn|study|revise|organi[sz]e|clean|declutter|budget|refactor|implement|migrate|analy[sz]e|interview|present|rehearse|record)\b/, minutes: 45 },
  // big jobs
  { words: /\b(move|pack|unpack|renovate|paint|assemble|overhaul|rewrite|redesign|deep\s*clean|spring\s*clean)\b/, minutes: 90 },
];

// Things with a size of their own. Applied as a multiplier on the action.
const THINGS: { words: RegExp; factor: number }[] = [
  { words: /\b(thesis|dissertation|novel|manuscript)\b/, factor: 2.4 },
  { words: /\b(taxes|tax\s*return|accounts|garages?|attic|basement|houses?|apartments?|flats?|wardrobe|closet|website|app|course|exams?)\b/, factor: 1.9 },
  { words: /\b(essay|report|proposal|presentation|deck|slides|chapter|paper|assignment|project|portfolio|resume|cv|cover\s*letter|application|plan|strategy|budget|spec|documentation|docs)\b/, factor: 1.5 },
  { words: /\b(inbox|emails|messages|backlog|paperwork|admin|bills|receipts|laundry|dishes|groceries)\b/, factor: 1.3 },
  { words: /\b(reminder|note|link|photo|pic|picture|text|message|password|alarm|appointment|slot|ticket|form|bill|invoice|receipt|parcel|package|pill|pills|meds|plant|plants)\b/, factor: 0.8 },
];

// Words of size.
const SMALLER: RegExp = /\b(quick|quickly|just|briefly|brief|simple|small|tiny|little|short|fast|easy|one\s+line|a\s+line|mini|5\s*sec|real\s+quick)\b/;
const BIGGER: RegExp = /\b(whole|entire|full|all\s+(of\s+)?the|every|properly|thoroughly|deep|big|huge|major|massive|long|complete|from\s+scratch|overhaul)\b/;
const STARTING: RegExp = /\b(start|begin|kick\s*off|first\s+(pass|draft|step)|outline)\b/;
const THINKING: RegExp = /\b(think\s+about|consider|ponder|mull\s+over|idea\s+(about|for)|figure\s+out\s+if)\b/;

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, couple: 2, three: 3, few: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, several: 4, some: 3,
};

/** A duration said out loud, in minutes, or null. */
export function spokenMinutes(text: string): number | null {
  const t = text.toLowerCase();
  if (/\bhalf\s+an?\s+hour\b/.test(t)) return 30;
  if (/\b(quarter\s+of\s+an\s+hour|quarter\s+hour)\b/.test(t)) return 15;
  if (/\b(an|one)\s+hour\b/.test(t)) return 60;
  if (/\bcouple\s+(of\s+)?hours\b/.test(t)) return 120;
  if (/\b(a\s+)?few\s+min(ute)?s?\b/.test(t)) return 5;
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)\b/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(',', '.'));
  if (!isFinite(n) || n <= 0) return null;
  const minutes = /^h/.test(m[2]) ? n * 60 : n;
  return minutes >= 1 && minutes <= 600 ? minutes : null;
}

/** How many of the thing: "3 emails", "a few calls". */
function count(text: string): number {
  const t = text.toLowerCase();
  const digit = t.match(/\b(\d{1,2})\s+(?!min|mins|minute|minutes|h|hr|hrs|hour|hours|am|pm)[a-z]/);
  if (digit) return Math.max(1, Math.min(20, parseInt(digit[1], 10)));
  const word = t.match(/\b(two|three|four|five|six|seven|eight|nine|ten|couple|few|several)\s+(of\s+)?[a-z]+s\b/);
  return word ? NUMBER_WORDS[word[1]] : 1;
}

export interface Estimate {
  minutes: number;
  /** Which cue decided it, for tests and for a future "why this time?". */
  because: 'said' | 'action' | 'default';
  raw: number;
}

/** The rule-based estimate before any personal learning. */
export function baseEstimate(text: string, fallback = 25): Estimate {
  const said = spokenMinutes(text);
  if (said !== null) return { minutes: nearestEstimate(said), because: 'said', raw: said };

  const t = ` ${text.toLowerCase().replace(/[’']/g, "'")} `;
  let minutes = fallback;
  let because: Estimate['because'] = 'default';
  // the earliest action in the sentence is usually the main one
  let at = Infinity;
  for (const v of VERBS) {
    const m = v.words.exec(t);
    if (m && m.index < at) { at = m.index; minutes = v.minutes; because = 'action'; }
  }
  if (THINKING.test(t)) { minutes = 15; because = 'action'; }

  for (const th of THINGS) if (th.words.test(t)) { minutes *= th.factor; break; }
  if (STARTING.test(t)) minutes *= 0.6;
  if (SMALLER.test(t)) minutes *= 0.5;
  if (BIGGER.test(t)) minutes *= 1.7;

  const n = count(t);
  if (n > 1) minutes *= 1 + 0.55 * (n - 1);

  // a long description usually means a bigger thing; a word or two means nothing either way
  const words = t.trim().split(/\s+/).length;
  if (words > 8) minutes *= Math.min(1.35, 1 + (words - 8) * 0.03);

  return { minutes: nearestEstimate(minutes), because, raw: minutes };
}

export function nearestEstimate(minutes: number): number {
  // compare on a log scale: 7 is nearer 5 than 10 feels, 100 nearer 90 than 120
  const l = Math.log(Math.max(1, minutes));
  return ESTIMATES.reduce((best, m) => (Math.abs(Math.log(m) - l) < Math.abs(Math.log(best) - l) ? m : best), ESTIMATES[0]);
}

/** Words that carry meaning for learning: lower case, no filler. */
export function keywords(text: string): string[] {
  const STOP = new Set(['the', 'a', 'an', 'to', 'and', 'or', 'of', 'for', 'on', 'in', 'at', 'my', 'me', 'i', 'it', 'is', 'be', 'with', 'about', 'thing', 'things', 'stuff', 'need', 'have', 'got', 'gotta', 'should', 'must', 'want', 'remember', 'dont', "don't", 'forget', 'maybe', 'later', 'today', 'tomorrow', 'asap', 'this', 'that', 'some', 'up', 'back']);
  return [...new Set(text.toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w) && !/^\d+$/.test(w)))];
}

// ---------- learning from you ----------
//
// Each word you have re-timed remembers, as a running average, how far your
// choice was from the rule-based guess (on a log scale, so "twice as long"
// and "half as long" weigh the same). A new thought containing those words is
// nudged by their average, more firmly the more evidence there is.

export type Lessons = Record<string, { lean: number; seen: number }>;

const RATE = 0.4; // how quickly a word's lean follows your latest correction

export function learn(lessons: Lessons, text: string, chosen: number): Lessons {
  const base = baseEstimate(text).minutes;
  const r = Math.log(chosen / base);
  const next = { ...lessons };
  for (const w of keywords(text)) {
    const old = next[w];
    next[w] = old ? { lean: old.lean + (r - old.lean) * RATE, seen: Math.min(old.seen + 1, 50) } : { lean: r, seen: 1 };
  }
  return next;
}

export function personalEstimate(text: string, lessons: Lessons, calibration = 1): number {
  const base = baseEstimate(text);
  let sum = 0;
  let weight = 0;
  for (const w of keywords(text)) {
    const l = lessons[w];
    if (!l) continue;
    const k = Math.min(l.seen, 4);
    sum += l.lean * k;
    weight += k;
  }
  // one correction moves things halfway; a few make it trust you fully
  const trust = Math.min(1, weight / 3);
  const lean = weight ? (sum / weight) * (0.5 + 0.5 * trust) : 0;
  // a time you said out loud is never overridden
  if (base.because === 'said') return base.minutes;
  return nearestEstimate(base.raw * Math.exp(lean) * calibration);
}
