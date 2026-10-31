// Tasks on this phone, and how they reach your computer.
//
// Local first: every change is written to the phone before anything else.
// Once linked to a computer (it shows a QR code; see linkcore.ts), changed
// tasks are sealed on the phone and swapped with the sync server: what
// changed here goes up, what changed there comes down, and for each task the
// latest edit wins. Nothing readable ever leaves the phone. Offline, changes
// simply wait and go up when the connection returns.

import { getRandomBytes, randomUUID } from 'expo-crypto';
import { AppState, Platform } from 'react-native';
import type { NewTask, Task, TaskPatch } from '../../../shared/task';
import { guess } from './guess';
import { exchange, forget, liveUrl, newToken, parseLink, planFor, seal, spaceOf, SyncRefused, unseal, type Link, type Plan, type Sealed } from './linkcore';
import { createStore, load, loadList, save, useStore } from './store';

/** local: not linked · live: linked and in step · syncing · offline: can't reach the server · paused: the free trial is over */
export type LinkState = 'local' | 'live' | 'syncing' | 'offline' | 'paused';
export interface Device { id: string; name: string; platform: string; seen: number }

interface State {
  ready: boolean;
  tasks: Task[];
  /** Tasks changed here that the server hasn't confirmed yet. */
  pending: string[];
  link: LinkState;
  linked: Link | null;
  devices: Device[];
  /** Sync's free trial or subscription, as the server last said. */
  plan: Plan | null;
  /** Phone → server time of the most recent catch, in ms. */
  lastTrip: { id: string; ms: number } | null;
}

const TASKS_KEY = 'shuchu.tasks.v1';
const SYNC_KEY = 'shuchu.sync.v1';

interface Saved { link: Link | null; since: number; pending: string[]; me: string }

export const tasksStore = createStore<State>({ ready: false, tasks: [], pending: [], link: 'local', linked: null, devices: [], plan: null, lastTrip: null });
export const useTasks = <S,>(select: (s: State) => S) => useStore(tasksStore, select);

const random = (n: number) => getRandomBytes(n);
let saved: Saved = { link: null, since: 0, pending: [], me: '' };
const savedAt = new Map<string, number>();
const joinListeners = new Set<(d: Device) => void>();

/** A line for Shu to say about the link, wherever he is (just linked, say). */
export const linkNotice = createStore<{ text: string; key: number } | null>(null);
const notice = (text: string) => linkNotice.set({ text, key: Date.now() });

export async function startTasks(): Promise<void> {
  const [tasks, stored] = await Promise.all([loadList<Task>(TASKS_KEY), load<Saved>(SYNC_KEY, saved)]);
  saved = { ...stored, me: stored.me || newToken(random).slice(0, 16) };
  tasksStore.set((s) => ({ ...s, ready: true, tasks: sortTasks(tasks), pending: saved.pending, linked: saved.link, link: saved.link ? 'syncing' : 'local' }));
  void save(SYNC_KEY, saved);
  if (saved.link) void sync();
  AppState.addEventListener('change', (state) => {
    if (state === 'active') { quietSince = Date.now(); void sync(); }
    else { socket?.close(); socket = null; }
  });
}

const stamp = (t: Task) => Date.parse(t.updatedAt ?? t.createdAt) || 0;

function changed(task: Task, fresh = false) {
  tasksStore.set((s) => ({
    ...s,
    tasks: fresh ? [task, ...s.tasks] : s.tasks.map((t) => (t.id === task.id ? task : t)),
    pending: s.pending.includes(task.id) ? s.pending : [...s.pending, task.id],
  }));
}

/** Catch a thought. Resolves once it is safely stored on this phone. */
export async function catchThought(text: string): Promise<Task> {
  const originalText = text.trim();
  const history = tasksStore.get().tasks;
  const now = new Date().toISOString();
  const input: NewTask = { id: randomUUID(), originalText, createdAt: now, ...guess(originalText, history) };
  const task: Task = { ...input, status: 'open', updatedAt: now };
  savedAt.set(task.id, Date.now());
  changed(task, true);
  await persist();
  soon();
  return task;
}

export async function updateTask(id: string, patch: TaskPatch): Promise<void> {
  const current = tasksStore.get().tasks.find((t) => t.id === id);
  if (!current) return;
  changed({ ...current, ...patch, updatedAt: new Date().toISOString() });
  await persist();
  soon();
}

async function persist(): Promise<void> {
  const { tasks, pending } = tasksStore.get();
  saved = { ...saved, pending };
  await Promise.all([save(TASKS_KEY, tasks), save(SYNC_KEY, saved)]);
}

// ---------- linking ----------

/** Join the link in a scanned code or an opened address. False if it isn't one. */
export async function joinLink(text: string): Promise<boolean> {
  const link = parseLink(text);
  if (!link) return false;
  if (saved.link?.token === link.token) { void sync(); return true; }
  // everything already on the phone goes up to the shared space
  const all = tasksStore.get().tasks.map((t) => t.id);
  saved = { ...saved, link, since: 0, pending: all };
  lastPresence = 0;
  tasksStore.set((s) => ({ ...s, linked: link, link: 'syncing', pending: all, devices: [] }));
  await save(SYNC_KEY, saved);
  notice('Linked! Your computer will see everything.');
  await sync();
  return true;
}

/** Delete the synced copy from the server, then unlink. False if the server couldn't be reached. */
export async function forgetEverywhere(): Promise<boolean> {
  const link = saved.link;
  if (!link) return true;
  const ok = await forget(link);
  if (ok) await unlink();
  return ok;
}

/** Forget the link on this phone. The tasks stay here, and on the computer. */
export async function unlink(): Promise<void> {
  socket?.close();
  socket = null;
  saved = { ...saved, link: null, since: 0 };
  tasksStore.set((s) => ({ ...s, linked: null, link: 'local', devices: [], plan: null }));
  await save(SYNC_KEY, saved);
}

/** The id purchases are filed under: the link's anonymous space id. */
export const customerId = () => (saved.link ? spaceOf(saved.link.token) : null);

/** Look up the plan again (fresh: just bought, ask the store now). */
export async function refreshPlan(fresh = false): Promise<void> {
  const link = saved.link;
  if (!link) return;
  try {
    const { plan } = await planFor(link, fresh);
    tasksStore.set((s) => ({ ...s, plan, link: plan.active && s.link === 'paused' ? 'syncing' : s.link }));
    if (plan.active) void sync();
  } catch { /* keep what we had */ }
}

/** Called when a computer joins the link (it shows the code; the phone scans). */
export function onJoin(fn: (d: Device) => void): () => void {
  joinListeners.add(fn);
  return () => joinListeners.delete(fn);
}

// ---------- the round trip ----------

let busy = false;
let again = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let quietSince = Date.now();
let lastPresence = 0;
let failures = 0;

function soon(ms = 200) {
  quietSince = Date.now();
  clearTimeout(timer);
  timer = setTimeout(() => void sync(), ms);
}

function nextDelay(): number {
  if (tasksStore.get().link === 'paused') return 10 * 60_000;
  if (failures) return Math.min(60_000, 2000 * 2 ** failures);
  if (AppState.currentState !== 'active') return 120_000;
  // with the live line open, the server tells us about changes; this is just a safety net
  if (socket?.readyState === WebSocket.OPEN) return 60_000;
  return Date.now() - quietSince < 10 * 60_000 ? 3000 : 10_000;
}

/** Push what changed, pull what's new. Safe to call any time. */
export async function sync(): Promise<void> {
  const link = saved.link;
  if (!link) return;
  if (busy) { again = true; return; }
  busy = true;
  clearTimeout(timer);
  try {
    const { tasks, pending } = tasksStore.get();
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const push: Sealed[] = [];
    const sent = new Map<string, number>();
    for (const id of pending) {
      const t = byId.get(id);
      if (!t) continue;
      sent.set(id, stamp(t));
      push.push({ id, u: stamp(t), v: seal(link.token, t, random(24)) });
      if (push.length >= 200) break;
    }
    if (Date.now() - lastPresence > 5 * 60_000) {
      const d: Device = { id: saved.me, name: 'Phone', platform: Platform.OS === 'ios' ? 'iPhone' : Platform.OS === 'android' ? 'Android' : 'Android browser', seen: Date.now() };
      push.push({ id: `device:${saved.me}`, u: d.seen, v: seal(link.token, { kind: 'device', ...d }, random(24)) });
    }
    const { seq, records, plan } = await exchange(link, saved.since, push);
    if (saved.link?.token !== link.token) return;
    if (push.some((r) => r.id.startsWith('device:'))) lastPresence = Date.now();

    const firstLook = saved.since === 0;
    const devices = new Map(tasksStore.get().devices.map((d) => [d.id, d]));
    const incoming: Task[] = [];
    for (const r of records) {
      if (r.id.startsWith('device:')) {
        const d = unseal<Device>(link.token, r.v);
        if (!d || d.id === saved.me) continue;
        const known = devices.has(d.id);
        devices.set(d.id, { id: d.id, name: d.name, platform: d.platform, seen: d.seen });
        if (!known && !firstLook) joinListeners.forEach((fn) => fn(d));
        continue;
      }
      const t = unseal<Task>(link.token, r.v);
      if (t && t.id === r.id) incoming.push(t);
    }

    tasksStore.set((s) => {
      const map = new Map(s.tasks.map((t) => [t.id, t]));
      for (const t of incoming) {
        const mine = map.get(t.id);
        if (!mine || stamp(mine) < stamp(t)) map.set(t.id, t);
      }
      // confirmed: forget pending ids whose task hasn't changed since it was sent
      const still = s.pending.filter((id) => { const u = sent.get(id); const t = map.get(id); return u === undefined || (t !== undefined && stamp(t) !== u); });
      let lastTrip = s.lastTrip;
      for (const id of sent.keys()) {
        const at = savedAt.get(id);
        if (at !== undefined) { savedAt.delete(id); lastTrip = { id, ms: Date.now() - at }; }
      }
      return { ...s, tasks: sortTasks([...map.values()]), pending: still, devices: [...devices.values()].sort((a, b) => b.seen - a.seen), link: 'live', plan: plan ?? s.plan, lastTrip };
    });

    if (seq < saved.since) {
      // the server forgot this space (unused for a long time): send everything again
      saved = { ...saved, since: 0, pending: tasksStore.get().tasks.map((t) => t.id) };
      tasksStore.set((s) => ({ ...s, pending: saved.pending }));
      again = true;
    } else {
      saved = { ...saved, since: seq };
    }
    if (incoming.length) quietSince = Date.now();
    await persist();
    failures = 0;
    goLive(link);
    if (tasksStore.get().pending.length) again = true;
  } catch (e) {
    if (e instanceof SyncRefused && e.status === 402) {
      // the free trial is over: everything stays on the phone; syncing waits for a plan
      failures = 0;
      tasksStore.set((s) => ({ ...s, link: 'paused', plan: e.plan ?? s.plan }));
    } else {
      failures++;
      tasksStore.set((s) => ({ ...s, link: s.linked ? 'offline' : 'local' }));
    }
  } finally {
    busy = false;
    if (saved.link) {
      if (again) { again = false; soon(50); }
      else timer = setTimeout(() => void sync(), nextDelay());
    }
  }
}

// ---------- the live line ----------
// While the app is open, a WebSocket waits for the server to say "something
// changed" and we sync at once. If it can't connect, polling does the job.
let socket: WebSocket | null = null;
let socketFor = '';
let socketRetry = 2000;
function goLive(link: Link) {
  if (AppState.currentState !== 'active' || (socket && socketFor === link.token && socket.readyState <= WebSocket.OPEN)) return;
  socket?.close();
  socketFor = link.token;
  const ws = new WebSocket(liveUrl(link));
  socket = ws;
  ws.onopen = () => { socketRetry = 2000; };
  ws.onmessage = (e) => {
    try { const m = JSON.parse(String(e.data)) as { seq?: number; plan?: boolean }; if ((m.seq ?? 0) > saved.since || m.plan) void sync(); } catch { /* not for us */ }
  };
  ws.onclose = () => {
    if (socket !== ws) return;
    socket = null;
    if (saved.link?.token === link.token && AppState.currentState === 'active') setTimeout(() => { if (saved.link) goLive(saved.link); }, (socketRetry = Math.min(socketRetry * 2, 60_000)));
  };
}

/** Kept for callers that want to nudge the link (pull to refresh, coming online). */
export const flush = sync;

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const STALE_DAYS = 7;
export const isStale = (t: Task) => Date.now() - Date.parse(t.confirmedAt ?? t.createdAt) > STALE_DAYS * 86_400_000;
export const isOpen = (t: Task) => t.status === 'open' || t.status === 'later';
export const isWaiting = (id: string, pending: string[]) => pending.includes(id);
