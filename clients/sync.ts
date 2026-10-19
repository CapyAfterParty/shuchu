// Talking to the server. Shared by the phone and the desk.

import type { NewTask, SyncEvent, Task } from "../shared/task.js";

export async function sendTask(input: NewTask): Promise<Task> {
  const res = await fetch("/tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`save failed: ${res.status}`);
  return res.json();
}

// Calls onEvent for every change. Reconnects by itself.
export function watchTasks(
  onEvent: (event: SyncEvent) => void,
  onLink: (live: boolean) => void = () => {},
): () => void {
  const source = new EventSource("/events");
  source.onopen = () => onLink(true);
  source.onerror = () => onLink(false);
  source.onmessage = (message) => onEvent(JSON.parse(message.data));
  return () => source.close();
}
