// Holds every task in memory and on disk. A task is written to disk
// before anyone is told it was saved.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Task } from "../shared/task.js";

const FILE = resolve(process.env.SHUCHU_DATA ?? "data/tasks.json");
const tasks = new Map<string, Task>();
let writing: Promise<void> = Promise.resolve();

export async function loadTasks(): Promise<void> {
  try {
    const saved = JSON.parse(await readFile(FILE, "utf8")) as Task[];
    for (const task of saved) tasks.set(task.id, task);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export function allTasks(): Task[] {
  return [...tasks.values()];
}

export function getTask(id: string): Task | undefined {
  return tasks.get(id);
}

export async function putTask(task: Task): Promise<void> {
  tasks.set(task.id, task);
  // One write at a time, each with the latest state.
  writing = writing.then(saveToDisk, saveToDisk);
  await writing;
}

async function saveToDisk(): Promise<void> {
  await mkdir(dirname(FILE), { recursive: true });
  const temp = `${FILE}.tmp`;
  await writeFile(temp, JSON.stringify(allTasks(), null, 2));
  await rename(temp, FILE); // atomic swap, so a crash never leaves half a file
}
