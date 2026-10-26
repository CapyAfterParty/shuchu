// On-device guesses for a freshly caught thought. Instant, offline, private.
// Every guess is only a suggestion: one tap fixes it, and the original
// words are never touched.

import type { Place, Task, TaskPatch } from '../../../shared/task';

import { ESTIMATES, nearestEstimate, personalEstimate } from './estimate';
import { currentLessons } from './learn';

export { ESTIMATES, nearestEstimate };

const FILLER = [
  /^(i\s+)?(need|have|got|want)\s+to\s+/i,
  /^(remember|don'?t\s+forget)\s+to\s+/i,
  /^(gotta|should|must|maybe|todo:?|to\s*do:?)\s+/i,
  /\s+(thing|things|stuff|asap|later|today|tomorrow)$/i,
  /\s+(or\s+something|and\s+stuff|etc\.?)$/i,
];

const ERRAND = /\b(buy|pick\s*up|grab|groceries|grocery|supermarket|store|shop|shopping|pharmacy|chemist|post\s*office|parcel|drop\s*off|return\s+\w+\s+(to|at)|gym|bank|atm|haircut|barber|car\s*wash|petrol|gas\s+station|dry\s*clean|laundry|collect|vet)\b/i;

const RULES: { match: RegExp; step: (thing: string) => string }[] = [
  { match: /^(call|phone|ring)\s+(.+)/i, step: (x) => `Find ${possessive(x)} number` },
  { match: /^(email|e-mail|reply\s+to|reply|message|text|write\s+back\s+to)\s+(.+)/i, step: (x) => `Open the thread with ${x}` },
  { match: /^(book|schedule|arrange)\s+(.+)/i, step: () => 'Open the calendar and pick two times' },
  { match: /^(pay|invoice|bill)\s*(.*)/i, step: () => 'Open the invoice' },
  { match: /^(fix|debug|repair|sort\s+out)\s+(.+)/i, step: (x) => `Make ${x} go wrong once, on purpose` },
  { match: /^(write|draft|finish)\s+(.+)/i, step: () => 'Open the doc and write the first heading' },
  { match: /^(read|review|check)\s+(.+)/i, step: (x) => `Open ${x} and read the first page` },
  { match: /^(plan|design|prepare|prep|research|think\s+about)\s+(.+)/i, step: (x) => `Write three bullet points about ${x}` },
  { match: /^(clean|tidy|organi[sz]e)\s+(.+)/i, step: (x) => `Clear one corner of ${x}` },
  { match: /^(buy|grab|pick\s*up|get)\s+(.+)/i, step: (x) => `Add ${x} to the list` },
  { match: /^(send|submit|upload)\s+(.+)/i, step: (x) => `Find ${x}` },
  { match: /^(do|complete|start|begin|work\s+on|continue|get\s+through)\s+(.+)/i, step: (x) => (
    /\b(assignment|homework|essay|worksheet|exercises?|problems?|questions?|coursework|lab|report|project)\b/i.test(x)
      ? `Open ${x} and read what's asked`
      : `Open ${x} and do the first two minutes`
  ) },
  { match: /^(study|revise|learn|practi[sc]e|memori[sz]e)\s+(.+)/i, step: (x) => `Set a ten-minute timer and start on ${x}` },
  { match: /^(ask|tell|remind|invite|thank)\s+(.+)/i, step: (x) => `Open the chat with ${x}` },
  { match: /^(go\s+to|visit|drop\s+by|stop\s+by)\s+(.+)/i, step: (x) => `Check when ${x} is open` },
  { match: /^(cancel|renew|apply\s+for|sign\s+up\s+for|register\s+for)\s+(.+)/i, step: (x) => `Find the page for ${x}` },
];

function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

export function cleanTitle(text: string): string {
  let t = text.trim().replace(/\s+/g, ' ').replace(/[.!?,;:]+$/, '');
  for (let pass = 0; pass < 2; pass++) for (const f of FILLER) t = t.replace(f, '');
  t = t.trim();
  if (t.length < 2) t = text.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function guessPlace(text: string): Place {
  return ERRAND.test(text) ? 'errand' : 'desk';
}

/** Your own history nudges future estimates: if things take you longer, guesses grow. */
export function calibration(tasks: Task[]): number {
  const done = tasks.filter((t) => t.minutesSpent && t.estimateMinutes);
  if (done.length < 3) return 1;
  const ratios = done.slice(-20).map((t) => t.minutesSpent! / t.estimateMinutes!);
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  return Math.max(0.6, Math.min(2, mean));
}

export function guess(text: string, history: Task[] = []): TaskPatch {
  const title = cleanTitle(text);
  const place = guessPlace(text);
  const rule = RULES.find((r) => r.match.test(title));
  // "Mina about friday" → "Mina": the object is what comes before the details
  const thing = rule ? (title.match(rule.match)?.[2] ?? '').split(/\s+(about|re|regarding|for|on|before|after|by)\s+/i)[0].trim() : '';
  return {
    cleanTitle: title,
    place,
    // read the whole original sentence: "quick", "3 emails" and "for 20 min" live there
    estimateMinutes: personalEstimate(text, currentLessons(), calibration(history)),
    firstStep: rule && thing ? rule.step(thing) : 'Give it two minutes, then decide',
  };
}

export function formatMinutes(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r}` : `${h} h`;
}
