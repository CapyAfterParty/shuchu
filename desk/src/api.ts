// The desk's view of the truth: every task, live from the Shuchu server.
//
// The server pushes a snapshot and then each change over Server-Sent Events.
// If the stream drops (sleep, Wi-Fi), we reconnect with a gentle backoff and
// take a fresh snapshot, so the desk never shows a stale list for long.

import type { NewTask, SyncEvent, Task, TaskPatch } from '../../shared/task.ts';

export type Link = 'connecting' | 'live' | 'offline';

type Listener = () => void;

const tasks = new Map<string, Task>();
let link: Link = 'connecting';
const listeners = new Set<Listener>();
const arrivals = new Set<(task: Task) => void>();
let ready = false;

export const store = {
  tasks: () => [...tasks.values()],
  get: (id: string) => tasks.get(id),
  link: () => link,
  ready: () => ready,
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  /** Called for each task that appears after the first snapshot (caught on the phone, say). */
  onArrival(fn: (task: Task) => void): () => void {
    arrivals.add(fn);
    return () => arrivals.delete(fn);
  },
};

const emit = () => listeners.forEach((fn) => fn());

let source: EventSource | null = null;
let backoff = 500;
let retry: ReturnType<typeof setTimeout> | undefined;

export function connect(): void {
  clearTimeout(retry);
  source?.close();
  source = new EventSource('/events');
  source.onopen = () => {
    backoff = 500;
    link = 'live';
    emit();
  };
  source.onmessage = (message) => {
    const event = JSON.parse(message.data) as SyncEvent;
    if (event.type === 'snapshot') {
      const before = new Set(tasks.keys());
      tasks.clear();
      for (const t of event.tasks) tasks.set(t.id, t);
      // after a reconnect, anything new since we last looked still "arrives"
      if (ready) for (const t of event.tasks) if (!before.has(t.id)) arrivals.forEach((fn) => fn(t));
      ready = true;
    } else {
      const fresh = !tasks.has(event.task.id);
      tasks.set(event.task.id, event.task);
      if (fresh && ready) arrivals.forEach((fn) => fn(event.task));
    }
    emit();
  };
  source.onerror = () => {
    link = 'offline';
    emit();
    source?.close();
    retry = setTimeout(connect, backoff);
    backoff = Math.min(backoff * 2, 15_000);
  };
}

// Waking a laptop or coming back to the tab: check the line at once.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && link !== 'live') connect();
});
addEventListener('online', () => connect());

export async function createTask(input: NewTask): Promise<Task> {
  // shown at once; the server's echo confirms it
  const optimistic: Task = { ...input, status: 'open' } as Task;
  tasks.set(input.id, optimistic);
  emit();
  const res = await fetch('/tasks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`save failed: ${res.status}`);
  const saved = (await res.json()) as Task;
  tasks.set(saved.id, saved);
  emit();
  return saved;
}

export async function updateTask(id: string, patch: TaskPatch): Promise<void> {
  const current = tasks.get(id);
  if (current) {
    tasks.set(id, { ...current, ...patch });
    emit();
  }
  const res = await fetch(`/tasks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    // put it back the way the server has it
    if (current) tasks.set(id, current);
    emit();
    throw new Error(`update failed: ${res.status}`);
  }
}
