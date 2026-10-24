// Tasks saved on this phone that the server hasn't confirmed yet.
// Written synchronously, so a task is on the phone before the buzz.
// A task only leaves the outbox once the server says it has it.

import type { NewTask } from "../../shared/task.js";

const KEY = "shuchu.outbox";
let memory: NewTask[] = []; // used only if storage is blocked

export function held(): NewTask[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as NewTask[]) : [];
  } catch {
    return memory;
  }
}

export function hold(task: NewTask): void {
  write([...held(), task]);
}

export function release(id: string): void {
  write(held().filter((task) => task.id !== id));
}

function write(tasks: NewTask[]): void {
  memory = tasks;
  try {
    localStorage.setItem(KEY, JSON.stringify(tasks));
  } catch {
    // Storage full or blocked: keep it in memory and keep trying to send.
  }
}
