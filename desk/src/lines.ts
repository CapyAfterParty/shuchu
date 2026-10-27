// What Shu says. Short, warm, a little dry; never needy, never a notification.
// Shu only speaks when you do something to him or for him.

export type Moment =
  | 'poke' // a long press on Shu
  | 'pokeAgain' // poked several times in a row
  | 'empty' // tried to catch nothing
  | 'caught' // a thought was caught (said now and then, not every time)
  | 'milestone' // the nth thought today
  | 'long' // a very long thought
  | 'nap' // woken from a nap (empty inbox)
  | 'hello' // tapped somewhere calm (settings)
  | 'late'; // anything, after 11 pm

const LINES: Record<Moment, string[]> = {
  poke: ['Hi.', 'That tickles.', 'Yes?', 'Still here.', 'Boop.', 'I’m listening.', 'Mm?'],
  pokeAgain: ['Okay, okay.', 'I’m awake, promise.', 'You’re very pokey today.', 'Careful, I’m glass.'],
  empty: ['Tell me something first.', 'Nothing yet?', 'Take your time.', 'I’ll wait.'],
  caught: ['Got it.', 'Safe with me.', 'Out of your head.', 'Held.', 'One less thing.', 'I’ll keep that.'],
  milestone: [],
  long: ['That’s a big one.', 'Keep going, I’ve got room.'],
  nap: ['Zzz… oh. Hi.', 'Nothing to do. Bliss.', 'All clear. I was resting.', 'Five more minutes.'],
  hello: ['That’s me.', 'Hi!', 'Everything’s tidy here.', 'Make yourself at home.'],
  late: ['Shh. Late one.', 'Let it go for tonight.', 'Put it down, then sleep.'],
};

const last = new Map<Moment, string>();

/** A line for the moment, never the same one twice in a row. */
export function line(moment: Moment, count?: number): string {
  if (moment === 'milestone') {
    if (count === 3) return 'Three today.';
    if (count === 5) return 'Five today. Busy mind.';
    if (count === 10) return 'Ten! You’re emptying out.';
    return `${count} today.`;
  }
  const hour = new Date().getHours();
  const pool = (hour >= 23 || hour < 5) && (moment === 'poke' || moment === 'caught') ? LINES.late : LINES[moment];
  const choices = pool.filter((l) => l !== last.get(moment));
  const pick = choices[Math.floor(Math.random() * choices.length)] ?? pool[0];
  last.set(moment, pick);
  return pick;
}

/** Thought counts worth remarking on. */
export const MILESTONES = new Set([3, 5, 10, 20]);
