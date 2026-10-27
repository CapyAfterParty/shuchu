// Shuchu at your desk.
//
//   home     everything waiting, live from your phone; catch thoughts here too
//   ask      "How long do you have?"
//   plan     a calm shortlist that fits that time
//   focus    one thing at a time, with a quiet timer
//   receipt  what you cleared, and how long it really took
//
// Plain DOM, no framework. Glass is drawn by the scene under every
// [data-glass] element; this file only builds and updates elements.

import './style.css';
import { newId, type NotDoingReason, type Task } from '../../shared/task.ts';
import { connect, createTask, store, updateTask } from './api.ts';
import { startScene } from './glass.ts';
import { ESTIMATES, guess } from './guess.ts';
import { line } from './lines.ts';
import { age, byUrgency, formatMinutes, shortlist, waiting } from './plan.ts';

// ---------- the scene ----------
const scene = startScene(document.querySelector<HTMLCanvasElement>('#scene')!);
if (!scene) document.body.classList.add('porcelain');
const view = document.querySelector<HTMLElement>('#view')!;

// ---------- tiny DOM helpers ----------
type Child = Node | string | null | undefined | false;
function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'glass') { el.dataset.glass = ''; Object.assign(el.dataset, v as object); }
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}
/** Glass condenses into view: mark it (and the glass inside it) as present. */
function condense(root: HTMLElement) {
  requestAnimationFrame(() => {
    if (root.matches('[data-glass]')) root.classList.add('in');
    root.querySelectorAll('[data-glass]').forEach((el) => el.classList.add('in'));
  });
}
const ICON = {
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  leaf: '<svg viewBox="0 0 24 24"><path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14"/><path d="M5 19l7-7"/></svg>',
};
const icon = (name: keyof typeof ICON) => { const s = document.createElement('span'); s.innerHTML = ICON[name]; return s.firstElementChild!; };
const feel = (ms = 8) => { try { navigator.vibrate?.(ms); } catch { /* no vibration here */ } };

// ---------- Shu ----------
const pointer = { x: innerWidth / 2, y: innerHeight / 3 };
addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });

function makeShu(cls: string, mood?: 'sleepy' | 'happy'): HTMLElement {
  const shu = h('div', { class: `shu ${cls} ${mood ?? ''}`, glass: { radius: 'round', lift: '0.8', pearl: '0.15', warm: '0.1', wobble: '2' }, 'data-shu': true },
    h('div', { class: 'eyes' }, h('i'), h('i')),
    h('div', { class: 'bubble', role: 'status' }));
  if (mood) shu.dataset.mood = mood;
  return shu;
}
// every Shu blinks at an unhurried, irregular pace
setInterval(() => {
  for (const shu of document.querySelectorAll<HTMLElement>('[data-shu]')) {
    if (Math.random() < 0.35 && !shu.classList.contains('sleepy')) {
      shu.classList.add('blink');
      setTimeout(() => shu.classList.remove('blink'), 110);
    }
  }
}, 1500);
// and looks at the pointer
const lookLoop = () => {
  for (const shu of document.querySelectorAll<HTMLElement>('[data-shu]')) {
    const r = shu.getBoundingClientRect();
    const dx = pointer.x - (r.left + r.width / 2);
    const dy = pointer.y - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / 260);
    shu.style.setProperty('--lx', ((dx / d) * k).toFixed(3));
    shu.style.setProperty('--ly', ((dy / d) * k).toFixed(3));
  }
  requestAnimationFrame(lookLoop);
};
requestAnimationFrame(lookLoop);

const hush = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
function say(shu: HTMLElement | null, text: string, mood: 'happy' | null = 'happy') {
  if (!shu) return;
  const bubble = shu.querySelector<HTMLElement>('.bubble')!;
  bubble.classList.remove('on');
  void bubble.offsetWidth;
  bubble.textContent = text;
  bubble.classList.add('on');
  const was = shu.dataset.mood;
  if (mood) { shu.classList.remove('sleepy'); shu.classList.add(mood); }
  clearTimeout(hush.get(shu));
  hush.set(shu, setTimeout(() => {
    bubble.classList.remove('on');
    if (mood) shu.classList.remove(mood);
    if (was) shu.classList.add(was);
  }, 1800 + text.length * 45));
  const r = shu.getBoundingClientRect();
  scene?.ripple(r.left + r.width / 2, r.top + r.height / 2, 0.6);
  feel(10);
}

// the desk's own lines, alongside the app's
const DESK = {
  arrival: ['Fresh one.', 'From your phone.', 'Caught on the go.', 'Just landed.'],
  done: ['Nice.', 'One less thing.', 'Gone. Lighter?', 'Look at you.'],
  ask: ['How long do you have?'],
  receipt: ['Look at that.', 'That’s a good session.', 'Out of your head.'],
};
const pick = (pool: string[]) => pool[Math.floor(Math.random() * pool.length)];

// ---------- session: one sitting, from the time question to the receipt ----------
interface Outcome { id: string; title: string; minutes: number; outcome: 'done' | 'let_go' | 'paused' }
interface Session { available: number; plan: string[]; partial: string[]; skip: string[]; index: number; startedAt: number | null; log: Outcome[]; began: number }
type View = 'home' | 'ask' | 'plan' | 'focus' | 'receipt';

const KEY = 'shuchu.desk.session';
let session: Session | null = (() => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Session | null;
    // a sitting from yesterday is over
    return s && Date.now() - s.began < 12 * 3_600_000 ? s : null;
  } catch { return null; }
})();
const saveSession = () => { try { localStorage.setItem(KEY, JSON.stringify(session)); } catch { /* private mode */ } };
const endSession = () => { session = null; try { localStorage.removeItem(KEY); } catch { /* private mode */ } };

let current: View = session ? (session.startedAt ? 'focus' : 'plan') : 'home';
const title = (t: Task) => t.cleanTitle ?? t.originalText;

function go(next: View) {
  const old = view.firstElementChild as HTMLElement | null;
  current = next;
  const draw = () => {
    view.replaceChildren(render(next));
    condense(view);
    view.focus({ preventScroll: true });
  };
  if (old) {
    old.classList.add('leaving');
    old.querySelectorAll('[data-glass]').forEach((el) => el.classList.add('gone'));
    setTimeout(draw, 260);
  } else draw();
}

function render(v: View): HTMLElement {
  if (v === 'ask') return askView();
  if (v === 'plan') return planView();
  if (v === 'focus') return focusView();
  if (v === 'receipt') return receiptView();
  return homeView();
}

// ---------- home ----------
let homeShu: HTMLElement | null = null;
let listEl: HTMLUListElement | null = null;
let summaryEl: HTMLElement | null = null;
let errandsEl: HTMLElement | null = null;
let openMenu: string | null = null;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good morning.';
  if (hour >= 12 && hour < 17) return 'Good afternoon.';
  if (hour >= 17 && hour < 22) return 'Good evening.';
  return 'Still up?';
}

function homeView(): HTMLElement {
  homeShu = makeShu('home-shu');
  homeShu.addEventListener('click', () => say(homeShu, line('poke')));
  summaryEl = h('p', { class: 'lede' });
  const input = h('input', { id: 'catch', placeholder: 'Catch a thought…', autocomplete: 'off', 'aria-label': 'Catch a thought' }) as HTMLInputElement;
  const form = h('form', { class: 'catch', onsubmit: (e: Event) => {
    e.preventDefault();
    const words = input.value.trim();
    if (!words) { say(homeShu, line('empty'), null); return; }
    input.value = '';
    void createTask({ id: newId(), originalText: words, createdAt: new Date().toISOString(), ...guess(words, store.tasks()) })
      .catch(() => say(homeShu, 'Couldn’t reach the server.', null));
    feel(12);
  } }, input, h('kbd', {}, 'N'));
  listEl = h('ul', { class: 'list' });
  errandsEl = h('p', { class: 'errands' });
  const sheet = h('div', { class: 'sheet', glass: { radius: '30', lift: '0.5', pearl: '0.04' } }, form, listEl, errandsEl);
  const start = h('button', { class: 'pill big warm', id: 'start', glass: { radius: 'round', pearl: '1', lift: '0.7' }, onclick: () => go('ask') }, 'Start', h('kbd', {}, 'S'));
  const root = h('section', { class: 'view' }, homeShu, h('h1', { class: 'display' }, greeting()), summaryEl, h('div', { class: 'row-actions' }, start), sheet);
  updateHome();
  return root;
}

function updateHome() {
  if (current !== 'home' || !listEl || !summaryEl || !errandsEl) return;
  const all = store.tasks();
  const desk = byUrgency(all);
  const total = desk.reduce((m, t) => m + (t.estimateMinutes ?? 25), 0);
  summaryEl.textContent = !store.ready()
    ? 'Finding your thoughts…'
    : desk.length ? `${desk.length} waiting · about ${formatMinutes(total)}` : 'Nothing waiting. Enjoy it.';
  const errands = all.filter((t) => t.status === 'open' && t.place === 'errand').length;
  errandsEl.textContent = errands ? `${errands} ${errands === 1 ? 'errand is' : 'errands are'} on your phone` : '';
  document.querySelector('#start')?.toggleAttribute('disabled', !desk.length);

  // keyed update: rows stay put, new ones arrive, finished ones leave
  const keep = new Set(desk.map((t) => t.id));
  for (const li of [...listEl.children] as HTMLElement[]) {
    if (li.dataset.id && !keep.has(li.dataset.id) && !li.classList.contains('leaving')) {
      li.classList.add('leaving');
      setTimeout(() => li.remove(), 350);
    }
    if (li.classList.contains('menu') && !keep.has(li.dataset.for ?? '')) li.remove();
  }
  let prev: Element | null = null;
  for (const t of desk) {
    let li = listEl.querySelector<HTMLElement>(`li.task[data-id="${CSS.escape(t.id)}"]`);
    const fresh = !li;
    if (!li) li = taskRow(t);
    else refreshRow(li, t);
    const anchor: Element | null = prev ? prev.nextElementSibling : listEl.firstElementChild;
    if (anchor !== li) listEl.insertBefore(li, anchor);
    prev = li;
    const menu = listEl.querySelector<HTMLElement>(`li.menu[data-for="${CSS.escape(t.id)}"]`);
    if (menu) { listEl.insertBefore(menu, li.nextElementSibling); prev = menu; }
    if (fresh && store.ready()) li.classList.add('fresh');
  }
  const empty = listEl.querySelector('.empty');
  if (!desk.length && store.ready() && !empty) {
    const napper = makeShu('small', 'sleepy');
    napper.addEventListener('click', () => say(napper, line('nap')));
    const e = h('li', { class: 'empty' }, napper, h('span', {}, 'All clear.'));
    listEl.append(e);
    condense(e);
  } else if (desk.length && empty) empty.remove();
}

function taskRow(t: Task): HTMLElement {
  const li = h('li', { class: 'task', 'data-id': t.id });
  li.append(
    h('div', { class: 'title', tabindex: '0', role: 'button', 'aria-label': 'Rename', onclick: () => editTitle(li), onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); editTitle(li); } } }),
    h('button', { class: 'est', title: 'How long', onclick: () => toggleMenu(t.id, 'time') }),
    h('div', { class: 'acts' },
      h('button', { class: 'act', title: 'Done', 'aria-label': 'Done', onclick: () => done(t.id, null) }, icon('check')),
      h('button', { class: 'act', title: 'Let go', 'aria-label': 'Let go', onclick: () => toggleMenu(t.id, 'letgo') }, icon('leaf'))),
  );
  refreshRow(li, t);
  return li;
}

function refreshRow(li: HTMLElement, t: Task) {
  const titleEl = li.querySelector<HTMLElement>('.title')!;
  if (!titleEl.querySelector('input')) {
    titleEl.replaceChildren(title(t), h('span', { class: 'sub' }, [age(t), t.leftOffNote && `left off: ${t.leftOffNote}`].filter(Boolean).join(' · ')));
  }
  li.querySelector('.est')!.textContent = formatMinutes(t.estimateMinutes ?? 25);
}

function editTitle(li: HTMLElement) {
  const t = store.get(li.dataset.id!);
  if (!t) return;
  const box = li.querySelector<HTMLElement>('.title')!;
  if (box.querySelector('input')) return;
  const input = h('input', { value: title(t), 'aria-label': 'Title' }) as HTMLInputElement;
  const finish = (save: boolean) => {
    const v = input.value.trim();
    box.replaceChildren();
    if (save && v && v !== title(t)) void updateTask(t.id, { cleanTitle: v });
    refreshRow(li, store.get(t.id) ?? t);
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') finish(false);
    e.stopPropagation();
  });
  input.addEventListener('blur', () => finish(true));
  box.replaceChildren(input);
  input.focus();
  input.select();
}

function toggleMenu(id: string, kind: 'time' | 'letgo') {
  const key = `${id}:${kind}`;
  listEl?.querySelectorAll('li.menu').forEach((m) => m.remove());
  if (openMenu === key) { openMenu = null; return; }
  openMenu = key;
  const t = store.get(id);
  if (!t || !listEl) return;
  const menu = h('li', { class: 'menu', 'data-for': id });
  if (kind === 'time') {
    for (const m of ESTIMATES) {
      menu.append(h('button', { class: `chip ${m === (t.estimateMinutes ?? 25) ? 'on' : ''}`, onclick: () => { openMenu = null; menu.remove(); void updateTask(id, { estimateMinutes: m }); } }, formatMinutes(m)));
    }
  } else {
    const REASONS: [NotDoingReason, string][] = [['not_needed', 'Not needed'], ['not_mine', 'Not mine'], ['too_big', 'Too big']];
    for (const [r, label] of REASONS) menu.append(h('button', { class: 'chip', onclick: () => { openMenu = null; menu.remove(); letGo(id, r, null); } }, label));
  }
  const row = listEl.querySelector(`li.task[data-id="${CSS.escape(id)}"]`);
  row?.after(menu);
}

// ---------- finishing things (from home or from focus) ----------
function done(id: string, minutes: number | null) {
  const t = store.get(id);
  if (!t) return;
  void updateTask(id, { status: 'done', ...(minutes !== null ? { minutesSpent: Math.max(1, Math.round(minutes)) } : {}) });
  if (session && minutes !== null) { session.log.push({ id, title: title(t), minutes, outcome: 'done' }); saveSession(); }
  if (current === 'home' && Math.random() < 0.5) say(homeShu, pick(DESK.done));
  feel(14);
}
function letGo(id: string, reason: NotDoingReason, minutes: number | null) {
  const t = store.get(id);
  if (!t) return;
  void updateTask(id, { status: 'not_doing', notDoingReason: reason });
  if (session) { session.log.push({ id, title: title(t), minutes: minutes ?? 0, outcome: 'let_go' }); saveSession(); }
}

// ---------- ask ----------
const TIMES = [15, 30, 60, 120];
function askView(): HTMLElement {
  const shu = makeShu('ask-shu');
  const choices = h('div', { class: 'choices' },
    ...TIMES.map((m, i) => h('button', { class: 'choice', glass: { radius: 'round', lift: '0.6', pearl: '0.1' }, onclick: () => choose(m) },
      h('b', {}, m < 60 ? String(m) : String(m / 60)), h('span', {}, m < 60 ? 'min' : m === 60 ? 'hour' : 'hours'), h('kbd', {}, String(i + 1)))));
  setTimeout(() => say(shu, pick(DESK.ask), null), 500);
  return h('section', { class: 'view center-view' }, shu, h('h2', { class: 'display' }, 'How long do you have?'), choices,
    h('div', { class: 'row-actions' }, h('button', { class: 'quiet', onclick: () => go('home') }, 'Back ', h('kbd', {}, 'Esc'))));
}

function choose(minutes: number) {
  const plan = shortlist(store.tasks(), minutes);
  session = {
    available: minutes,
    plan: plan.picks.map((p) => p.task.id),
    partial: plan.picks.filter((p) => p.partial).map((p) => p.task.id),
    skip: [], index: 0, startedAt: null, log: [], began: Date.now(),
  };
  saveSession();
  feel(10);
  go('plan');
}

// ---------- plan ----------
function planView(): HTMLElement {
  if (!session) return homeView();
  const s = session;
  const tasks = s.plan.map((id) => store.get(id)).filter((t): t is Task => !!t && t.status === 'open');
  if (!tasks.length) {
    return h('section', { class: 'view center-view' }, makeShu('ask-shu', 'sleepy'), h('h2', { class: 'display' }, 'Nothing to plan.'),
      h('p', { class: 'lede' }, 'Your desk is clear.'),
      h('div', { class: 'row-actions' }, h('button', { class: 'pill', glass: { radius: 'round', lift: '0.6' }, onclick: () => { endSession(); go('home'); } }, 'Back')));
  }
  const total = tasks.reduce((m, t) => m + (s.partial.includes(t.id) ? s.available : t.estimateMinutes ?? 25), 0);
  const cards = h('div', { class: 'cards' }, ...tasks.map((t, i) => {
    const partial = s.partial.includes(t.id);
    const mins = partial ? s.available : t.estimateMinutes ?? 25;
    return h('article', { class: `card ${i === 0 ? 'lead' : ''}`, glass: { radius: i === 0 ? '30' : '26', lift: i === 0 ? '0.7' : '0.5', pearl: i === 0 ? '0.08' : '0' } },
      h('div', { class: 'eyebrow' }, h('span', { class: 'caps' }, i === 0 ? (partial ? 'Make a start' : 'Start here') : 'Then'), h('span', { class: 'soft' }, partial ? `${formatMinutes(mins)} of ${formatMinutes(t.estimateMinutes ?? 25)}` : formatMinutes(mins))),
      h('h3', {}, title(t)),
      i === 0 && t.firstStep ? h('p', { class: 'step' }, t.firstStep) : null,
      i === 0 && t.leftOffNote ? h('p', { class: 'left-off' }, `Last time: ${t.leftOffNote}`) : null);
  }));
  const somethingElse = () => {
    s.skip.push(s.plan[0]);
    const again = shortlist(store.tasks(), s.available, new Set(s.skip));
    if (!again.picks.length) { s.skip = []; return; }
    s.plan = again.picks.map((p) => p.task.id);
    s.partial = again.picks.filter((p) => p.partial).map((p) => p.task.id);
    saveSession();
    go('plan');
  };
  return h('section', { class: 'view center-view' },
    h('h2', { class: 'display' }, 'A calm plan.'),
    h('p', { class: 'lede' }, `${formatMinutes(total)} of your ${formatMinutes(s.available)}`),
    cards,
    h('div', { class: 'row-actions' },
      h('button', { class: 'pill big warm', id: 'begin', glass: { radius: 'round', pearl: '1', lift: '0.7' }, onclick: begin }, 'Begin', h('kbd', {}, 'Enter')),
      h('button', { class: 'quiet', onclick: somethingElse }, 'Something else'),
      h('button', { class: 'quiet', onclick: () => { endSession(); go('home'); } }, 'Back')));
}

function begin() {
  if (!session) return;
  session.startedAt = Date.now();
  saveSession();
  go('focus');
}

// ---------- focus ----------
let tick: ReturnType<typeof setInterval> | undefined;
function focusView(): HTMLElement {
  clearInterval(tick);
  const s = session;
  const id = s?.plan[s.index];
  const t = id ? store.get(id) : undefined;
  if (!s || !t) return receiptOrHome();
  const target = (s.partial.includes(t.id) ? s.available : t.estimateMinutes ?? 25) * 60;
  const R = 112;
  const C = 2 * Math.PI * R;
  const timeEl = h('span', { class: 'time' }, '0:00');
  const arc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  arc.setAttribute('class', 'done');
  const ring = h('div', { class: 'ring', role: 'timer', 'aria-label': 'Time on this' });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 240 240');
  const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  for (const c of [track, arc]) { c.setAttribute('cx', '120'); c.setAttribute('cy', '120'); c.setAttribute('r', String(R)); }
  track.setAttribute('class', 'track');
  arc.setAttribute('stroke-dasharray', String(C));
  svg.append(track, arc);
  ring.append(svg, timeEl, h('span', { class: 'of' }, `of ${formatMinutes(target / 60)}`));
  const update = () => {
    const secs = Math.max(0, (Date.now() - (s.startedAt ?? Date.now())) / 1000);
    timeEl.textContent = `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;
    arc.setAttribute('stroke-dashoffset', String(C * (1 - Math.min(1, secs / target))));
  };
  update();
  tick = setInterval(update, 1000);

  const note = h('form', { class: 'note-in', glass: { radius: 'round', lift: '0.5' }, hidden: true, onsubmit: (e: Event) => {
    e.preventDefault();
    const v = (note.querySelector('input') as HTMLInputElement).value.trim();
    finish('paused', v);
  } }, h('input', { placeholder: 'Where did you leave off? (optional)', 'aria-label': 'Where you left off' }), h('button', { class: 'quiet', type: 'submit' }, 'Save ', h('kbd', {}, 'Enter')));

  return h('section', { class: 'view center-view focus' },
    ring,
    h('h2', { class: 'focus-title' }, title(t)),
    t.firstStep ? h('p', { class: 'step' }, t.firstStep) : null,
    t.leftOffNote ? h('p', { class: 'left-off' }, `Last time: ${t.leftOffNote}`) : null,
    h('div', { class: 'row-actions', id: 'focus-actions' },
      h('button', { class: 'pill big warm', glass: { radius: 'round', pearl: '1', lift: '0.7' }, onclick: () => finish('done') }, 'Done', h('kbd', {}, 'D')),
      h('button', { class: 'pill', glass: { radius: 'round', lift: '0.55' }, onclick: () => askNote(note) }, 'Not now', h('kbd', {}, 'N')),
      h('button', { class: 'quiet', onclick: () => finish('let_go') }, 'Let go ', h('kbd', {}, 'L'))),
    note);
}

function askNote(note: HTMLElement) {
  note.hidden = false;
  condense(note);
  document.querySelector('#focus-actions')?.setAttribute('hidden', '');
  note.querySelector('input')?.focus();
}

function finish(how: 'done' | 'paused' | 'let_go', leftOff = '') {
  const s = session;
  if (!s) return;
  const id = s.plan[s.index];
  const t = store.get(id);
  const minutes = s.startedAt ? (Date.now() - s.startedAt) / 60_000 : 0;
  clearInterval(tick);
  if (t) {
    if (how === 'done') done(id, minutes);
    else if (how === 'let_go') letGo(id, 'not_needed', minutes);
    else {
      void updateTask(id, { ...(leftOff ? { leftOffNote: leftOff } : {}) });
      s.log.push({ id, title: title(t), minutes, outcome: 'paused' });
    }
  }
  s.index += 1;
  s.startedAt = s.index < s.plan.length ? Date.now() : null;
  saveSession();
  go(s.index < s.plan.length ? 'focus' : 'receipt');
}

function receiptOrHome(): HTMLElement {
  return session && session.log.length ? receiptView() : (endSession(), homeView());
}

// ---------- receipt ----------
function receiptView(): HTMLElement {
  const s = session;
  if (!s) return homeView();
  const shu = makeShu('ask-shu', 'happy');
  setTimeout(() => say(shu, pick(DESK.receipt)), 900);
  const cleared = s.log.filter((l) => l.outcome === 'done');
  const spent = s.log.reduce((m, l) => m + l.minutes, 0);
  const when = new Date(s.began);
  const receipt = h('div', { class: 'receipt', role: 'document', 'aria-label': 'Receipt' },
    h('h3', {}, 'Receipt'),
    h('p', { class: 'when' }, when.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' }) + ' · ' + when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })),
    h('ul', {}, ...s.log.map((l) => h('li', { class: l.outcome === 'let_go' ? 'let' : '' },
      h('span', {}, `${l.outcome === 'done' ? '✓ ' : l.outcome === 'paused' ? '… ' : ''}${l.title}`),
      h('span', {}, l.outcome === 'let_go' ? 'let go' : formatMinutes(Math.max(1, Math.round(l.minutes))))))),
    h('div', { class: 'total' }, h('span', {}, 'Time well spent'), h('span', {}, formatMinutes(Math.max(1, Math.round(spent))))),
    h('div', { class: 'total' }, h('span', {}, 'Out of your head'), h('span', {}, String(cleared.length + s.log.filter((l) => l.outcome === 'let_go').length))),
    h('p', { class: 'thanks' }, 'Breathe out.'));
  const text = () => ['Shuchu receipt', ...s.log.map((l) => `${l.outcome === 'let_go' ? '(let go) ' : ''}${l.title}  ${l.outcome === 'let_go' ? '' : formatMinutes(Math.max(1, Math.round(l.minutes)))}`), `Total ${formatMinutes(Math.max(1, Math.round(spent)))}`].join('\n');
  return h('section', { class: 'view center-view' }, shu, receipt,
    h('div', { class: 'row-actions' },
      h('button', { class: 'pill big warm', id: 'home-btn', glass: { radius: 'round', pearl: '1', lift: '0.7' }, onclick: () => { endSession(); go('home'); } }, 'Back to calm', h('kbd', {}, 'Enter')),
      h('button', { class: 'quiet', onclick: (e: Event) => { void navigator.clipboard?.writeText(text()); (e.currentTarget as HTMLElement).textContent = 'Copied'; } }, 'Copy')));
}

// ---------- keyboard ----------
document.addEventListener('keydown', (e) => {
  const typing = (e.target as HTMLElement).closest('input, textarea');
  if (e.key === '?' && !typing) { toggleKeys(); return; }
  if (e.key === 'Escape') {
    if (!keys.hidden) { toggleKeys(); return; }
    if (typing) { (typing as HTMLElement).blur(); return; }
    if (current === 'ask' || current === 'plan') { if (current === 'plan') endSession(); go('home'); }
    return;
  }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (current === 'home') {
    if (k === 'n') { e.preventDefault(); document.querySelector<HTMLInputElement>('#catch')?.focus(); }
    if (k === 's' && waiting(store.tasks()).length) go('ask');
  } else if (current === 'ask') {
    const i = ['1', '2', '3', '4'].indexOf(k);
    if (i >= 0) choose(TIMES[i]);
  } else if (current === 'plan') {
    if (k === 'enter') begin();
  } else if (current === 'focus') {
    if (k === 'd') finish('done');
    if (k === 'l') finish('let_go');
    if (k === 'n') { e.preventDefault(); const note = document.querySelector<HTMLElement>('.note-in'); if (note) askNote(note); }
  } else if (current === 'receipt') {
    if (k === 'enter') { endSession(); go('home'); }
  }
});
const keys = document.querySelector<HTMLElement>('#keys')!;
function toggleKeys() {
  keys.hidden = !keys.hidden;
  if (!keys.hidden) condense(keys.querySelector('.keys-card')!);
  else keys.querySelector('.keys-card')?.classList.remove('in');
}
document.querySelector('#keys-btn')!.addEventListener('click', toggleKeys);
keys.addEventListener('click', (e) => { if (e.target === keys) toggleKeys(); });

// ---------- Porcelain ----------
const pb = document.querySelector<HTMLButtonElement>('#porcelain-btn')!;
const setPorcelain = (on: boolean) => {
  document.body.classList.toggle('porcelain', on || !scene);
  pb.setAttribute('aria-pressed', String(on));
  scene?.setPorcelain(on);
  try { localStorage.setItem('shuchu.porcelain', on ? '1' : '0'); } catch { /* private mode */ }
};
pb.addEventListener('click', () => setPorcelain(pb.getAttribute('aria-pressed') !== 'true'));
try { if (localStorage.getItem('shuchu.porcelain') === '1') setPorcelain(true); } catch { /* private mode */ }

// ---------- live ----------
const linkEl = document.querySelector<HTMLElement>('#link')!;
store.subscribe(() => {
  const l = store.link();
  linkEl.className = `link ${l}`;
  linkEl.querySelector('.label')!.textContent = l === 'live' ? 'linked' : l === 'offline' ? 'reconnecting…' : 'connecting';
  if (current === 'home') updateHome();
});
store.onArrival((t) => {
  if (current === 'home' && t.place !== 'errand') setTimeout(() => say(homeShu, pick(DESK.arrival)), 400);
});
condense(document.querySelector('.bar')!);
document.querySelectorAll<HTMLElement>('.bar [data-glass]').forEach((el) => el.classList.add('in'));
connect();
go(current);
