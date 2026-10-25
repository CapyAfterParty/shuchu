// Tasks on this phone, and how they reach the desk.
//
// Local first: every change is written to the phone before anything else,
// then queued in an outbox. The outbox drains to the server in order and only
// forgets an operation once the server confirms it. The server ignores
// repeats, so retrying is always safe. Live updates arrive over SSE.

import { randomUUID } from 'expo-crypto';
import { AppState } from 'react-native';
import EventSource from 'react-native-sse';
import type { NewTask, SyncEvent, Task, TaskPatch } from '../../../shared/task';
import { guess } from './guess';
import { serverUrl, settings } from './settings';
import { createStore, loadList, save, useStore } from './store';

type Op = { kind: 'create'; task: NewTask } | { kind: 'update'; id: string; patch: TaskPatch };
export type Link = 'connecting' | 'live' | 'offline';

interface State {
  ready: boolean;
  tasks: Task[];
  outbox: Op[];
  link: Link;
  /** Phone → desk time of the most recent catch, in ms. */
  lastTrip: { id: string; ms: number } | null;
}

const TASKS_KEY = 'shuchu.tasks.v1';
const OUTBOX_KEY = 'shuchu.outbox.v1';

export const tasksStore = createStore<State>({ ready: false, tasks: [], outbox: [], link: 'connecting', lastTrip: null });
export const useTasks = <S,>(select: (s: State) => S) => useStore(tasksStore, select);

const savedAt = new Map<string, number>();
let source: EventSource | null = null;
let flushing = false;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let retryDelay = 1000;
let sending: Op | null = null; // the op currently in flight; never merged into
let linkTimer: ReturnType<typeof setTimeout> | undefined;
let linkDelay = 1000;

export async function startTasks(): Promise<void> {
  const [tasks, outbox] = await Promise.all([loadList<Task>(TASKS_KEY), loadList<Op>(OUTBOX_KEY)]);
  tasksStore.set((s) => ({ ...s, ready: true, tasks: sortTasks(tasks), outbox }));
  connect();
  // iOS drops sockets in the background: relink whenever we come back
  AppState.addEventListener('change', (state) => {
    if (state === 'active' && tasksStore.get().link !== 'live') connect();
    if (state === 'active') void flush();
  });
  let lastUrl = settings.get().serverUrl;
  settings.subscribe(() => {
    if (settings.get().serverUrl === lastUrl) return;
    lastUrl = settings.get().serverUrl;
    connect();
  });
}

/** Catch a thought. Resolves once it is safely stored on this phone. */
export async function catchThought(text: string): Promise<Task> {
  const originalText = text.trim();
  const history = tasksStore.get().tasks;
  const input: NewTask = { id: randomUUID(), originalText, createdAt: new Date().toISOString(), ...guess(originalText, history) };
  const task: Task = { ...input, status: 'open' };
  savedAt.set(task.id, Date.now());
  tasksStore.set((s) => ({ ...s, tasks: [task, ...s.tasks], outbox: [...s.outbox, { kind: 'create', task: input }] }));
  await persist();
  void flush();
  return task;
}

export async function updateTask(id: string, patch: TaskPatch): Promise<void> {
  tasksStore.set((s) => ({
    ...s,
    tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    outbox: queueUpdate(s.outbox, id, patch),
  }));
  await persist();
  void flush();
}

// Fold an edit into a waiting update for that task. Creates are never
// changed (the desk ignores repeated creates, so their fields would be lost),
// and the op already in flight is never touched.
function queueUpdate(outbox: Op[], id: string, patch: TaskPatch): Op[] {
  const pending = outbox.findIndex((op) => op !== sending && op.kind === 'update' && op.id === id);
  if (pending >= 0) {
    const op = outbox[pending] as Extract<Op, { kind: 'update' }>;
    return outbox.map((o, i) => (i === pending ? { kind: 'update', id, patch: { ...op.patch, ...patch } } : o));
  }
  return [...outbox, { kind: 'update', id, patch }];
}

async function persist(): Promise<void> {
  const { tasks, outbox } = tasksStore.get();
  await Promise.all([save(OUTBOX_KEY, outbox), save(TASKS_KEY, tasks)]);
}

async function request(path: string, method: string, body?: unknown): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    return await fetch(`${serverUrl()}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function send(op: Op): Promise<void> {
  if (op.kind === 'create') {
    const res = await request('/tasks', 'POST', op.task);
    if (res.ok || res.status === 400) return; // 400 can never succeed: let it go, the task stays on the phone
    throw new Error(`create ${res.status}`);
  }
  const res = await request(`/tasks/${encodeURIComponent(op.id)}`, 'PATCH', op.patch);
  if (res.status === 404) {
    // The desk never got this task: send the whole thing, then its state.
    const local = tasksStore.get().tasks.find((t) => t.id === op.id);
    if (local) {
      await send({ kind: 'create', task: local });
      await send(op);
    }
    return;
  }
  if (res.ok || res.status === 400) return;
  throw new Error(`update ${res.status}`);
}

export async function flush(): Promise<void> {
  if (flushing) return;
  flushing = true;
  clearTimeout(retryTimer);
  try {
    for (let op = tasksStore.get().outbox[0]; op; op = tasksStore.get().outbox[0]) {
      sending = op;
      await send(op);
      // remove exactly the op that was sent
      tasksStore.set((s) => ({ ...s, outbox: s.outbox.filter((o) => o !== op) }));
      sending = null;
      await save(OUTBOX_KEY, tasksStore.get().outbox);
    }
    retryDelay = 1000;
  } catch {
    retryTimer = setTimeout(() => void flush(), retryDelay);
    retryDelay = Math.min(retryDelay * 2, 30_000);
  } finally {
    sending = null;
    flushing = false;
  }
}

function connect(): void {
  clearTimeout(linkTimer);
  source?.removeAllEventListeners();
  source?.close();
  tasksStore.set((s) => ({ ...s, link: s.link === 'offline' ? 'offline' : 'connecting' }));
  const es = new EventSource(`${serverUrl()}/events`, { pollingInterval: 3000, timeoutBeforeConnection: 0 });
  source = es;
  es.addEventListener('open', () => {
    linkDelay = 1000;
    tasksStore.set((s) => ({ ...s, link: 'live' }));
    void flush();
  });
  // react-native-sse does not retry after a network error, so we do, gently
  es.addEventListener('error', () => {
    if (source !== es) return;
    tasksStore.set((s) => ({ ...s, link: 'offline' }));
    es.removeAllEventListeners();
    es.close();
    clearTimeout(linkTimer);
    linkTimer = setTimeout(() => { if (source === es) connect(); }, linkDelay);
    linkDelay = Math.min(linkDelay * 2, 30_000);
  });
  es.addEventListener('message', (event) => {
    if (!event.data) return;
    try {
      receive(JSON.parse(event.data) as SyncEvent);
    } catch {
      // ignore a malformed message
    }
  });
}

function withPending(task: Task, outbox: Op[]): Task {
  let t = task;
  for (const op of outbox) {
    if (op.kind === 'update' && op.id === task.id) t = { ...t, ...op.patch };
    if (op.kind === 'create' && op.task.id === task.id) t = { ...t, ...op.task };
  }
  return t;
}

function receive(event: SyncEvent): void {
  if (event.type === 'snapshot') {
    tasksStore.set((s) => {
      const server = new Map(event.tasks.map((t) => [t.id, withPending(t, s.outbox)]));
      // never let a snapshot make a thought disappear from the phone
      for (const local of s.tasks) if (!server.has(local.id)) server.set(local.id, local);
      return { ...s, tasks: sortTasks([...server.values()]) };
    });
  } else {
    const started = savedAt.get(event.task.id);
    if (started !== undefined) savedAt.delete(event.task.id);
    tasksStore.set((s) => {
      const task = withPending(event.task, s.outbox);
      const exists = s.tasks.some((t) => t.id === task.id);
      const tasks = exists ? s.tasks.map((t) => (t.id === task.id ? task : t)) : sortTasks([task, ...s.tasks]);
      return { ...s, tasks, lastTrip: started !== undefined ? { id: task.id, ms: Date.now() - started } : s.lastTrip };
    });
  }
  void save(TASKS_KEY, tasksStore.get().tasks);
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Round trip to the desk, in ms, or null if it can't be reached. */
export async function ping(url = serverUrl()): Promise<number | null> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${url.replace(/\/+$/, '')}/ping`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok ? Date.now() - start : null;
  } catch {
    return null;
  }
}

const STALE_DAYS = 7;
export const isStale = (t: Task) => Date.now() - Date.parse(t.confirmedAt ?? t.createdAt) > STALE_DAYS * 86_400_000;
export const isOpen = (t: Task) => t.status === 'open' || t.status === 'later';
export const isWaiting = (id: string, outbox: Op[]) =>
  outbox.some((op) => (op.kind === 'create' ? op.task.id === id : op.id === id));
