// Phone capture: a text box and a save action. Nothing else.

import { newId } from "../../shared/task.js";
import { sendTask, watchTasks } from "../sync.js";

const form = document.querySelector<HTMLFormElement>("#capture")!;
const text = document.querySelector<HTMLTextAreaElement>("#text")!;
const status = document.querySelector<HTMLElement>("#status")!;

// Tasks we saved, waiting to see them come back from the server.
// The echo arrives the same way the desk receives it, so the gap is
// an honest upper bound on phone-to-desk time.
const savedAt = new Map<string, number>();

watchTasks((event) => {
  if (event.type !== "task") return;
  const started = savedAt.get(event.task.id);
  if (started === undefined) return;
  savedAt.delete(event.task.id);
  say(`on your desk · ${Math.round(performance.now() - started)} ms`);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void save();
});

text.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    void save();
  }
});

text.addEventListener("input", updateReady);

async function save(): Promise<void> {
  const originalText = text.value.trim();
  if (!originalText) return;

  const id = newId();
  savedAt.set(id, performance.now());
  form.dispatchEvent(new CustomEvent("caught", { detail: originalText }));
  text.value = "";
  updateReady();
  text.focus();
  navigator.vibrate?.(12);

  try {
    await sendTask({ id, originalText, createdAt: new Date().toISOString() });
  } catch {
    // Never lose it: put the words back. (Offline saving comes in step 2.)
    savedAt.delete(id);
    text.value = text.value ? `${originalText}\n${text.value}` : originalText;
    updateReady();
    say("not sent yet · still here");
  }
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
