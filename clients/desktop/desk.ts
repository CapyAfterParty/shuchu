// Desk test view for step 1: tasks appear here the moment they are caught.
// The real overlay (hotkey, time question, shortlist) is step 4.

import type { Task } from "../../shared/task.js";
import { watchTasks } from "../sync.js";
import { render } from "./view.js";

const tasks = new Map<string, Task>();

watchTasks(
  (event) => {
    if (event.type === "snapshot") {
      tasks.clear();
      for (const task of event.tasks) tasks.set(task.id, task);
      render(waiting(), null);
      return;
    }
    const arrived = !tasks.has(event.task.id);
    tasks.set(event.task.id, event.task);
    render(waiting(), arrived ? event.task.id : null);
  },
  (live) => {
    document.body.dataset.live = String(live);
  },
);

// Open desk tasks, newest first. Errands stay on the phone.
function waiting(): Task[] {
  return [...tasks.values()]
    .filter((task) => task.status === "open" && task.place !== "errand")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
