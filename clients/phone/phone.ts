// Phone capture: a text box and a save action. Nothing else.
// Save to the phone first, buzz, then send. Never lose a task.

import { newId } from "../../shared/task.js";
import { sendTask, watchTasks } from "../sync.js";
import { held, hold, release } from "./outbox.js";

const form = document.querySelector<HTMLFormElement>("#capture")!;
const text = document.querySelector<HTMLTextAreaElement>("#text")!;
const status = document.querySelector<HTMLElement>("#status")!;
const holding = document.querySelector<HTMLElement>("#holding")!;

// When each task was saved, to report how fast it reached the desk.
// The echo arrives the same way the desk receives it.
const savedAt = new Map<string, number>();
let retryDelay = 1000;
let retryTimer = 0;
let sending = false;

watchTasks(
  (event) => {
    if (event.type !== "task") return;
    const started = savedAt.get(event.task.id);
    if (started === undefined) return;
    savedAt.delete(event.task.id);
    const ms = Math.round(performance.now() - started);
    say(ms < 5000 ? `on your desk · ${ms} ms` : "on your desk");
  },
  (live) => {
    if (live) void sendHeld();
  },
);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  save();
});

text.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    save();
  }
});

text.addEventListener("input", updateReady);
addEventListener("online", () => void sendHeld());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    text.focus();
    void sendHeld();
  }
});

function save(): void {
  const originalText = text.value.trim();
  if (!originalText) return;

  const id = newId();
  hold({ id, originalText, createdAt: new Date().toISOString() });
  savedAt.set(id, performance.now());

  form.dispatchEvent(new CustomEvent("caught", { detail: originalText }));
  text.value = "";
  updateReady();
  text.focus();
  navigator.vibrate?.(12);
  void sendHeld();
}

// Sends everything held, oldest first. The server ignores repeats,
// so sending a task twice is always safe.
async function sendHeld(): Promise<void> {
  if (sending) return;
  sending = true;
  clearTimeout(retryTimer);
  try {
    // Re-read each time, so a task saved mid-send is picked up too.
    for (let task = held()[0]; task; task = held()[0]) {
      await sendTask(task);
      release(task.id);
    }
    retryDelay = 1000;
  } catch {
    retryTimer = window.setTimeout(() => void sendHeld(), retryDelay);
    retryDelay = Math.min(retryDelay * 2, 30_000);
  } finally {
    sending = false;
    showHolding();
  }
}

function showHolding(): void {
  const count = held().length;
  holding.textContent =
    count === 0 ? "" : count === 1 ? "1 thought kept here until you're online" : `${count} thoughts kept here until you're online`;
}

function updateReady(): void {
  form.toggleAttribute("data-ready", text.value.trim() !== "");
}

function say(message: string): void {
  status.textContent = message;
  status.classList.remove("show");
  void status.offsetWidth; // restart the fade
  status.classList.add("show");
}

showHolding();
void sendHeld();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {
    // Needs https (or localhost). Saving offline still works without it.
  });
}
