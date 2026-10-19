// The one place task types live. Phone, desktop and server all import from here.

export type Place = "desk" | "errand";
export type Status = "open" | "done" | "later" | "not_doing";
export type NotDoingReason = "not_mine" | "not_needed" | "too_big";

export interface Task {
  id: string;
  originalText: string;          // never changed
  cleanTitle?: string;           // app guess, editable
  estimateMinutes?: number;      // app guess, editable, improves from real times
  place?: Place;                 // app guess, editable
  firstStep?: string;            // shown on the "Start here" task
  status: Status;
  notDoingReason?: NotDoingReason;
  leftOffNote?: string;          // one line, shown when the task returns
  minutesSpent?: number;         // from the user's own start and finish taps
  createdAt: string;             // ISO date, used for "still true?"
}

// What a device sends to create a task. The id is made on the device,
// so sending the same task twice never makes a duplicate.
export interface NewTask {
  id: string;
  originalText: string;
  createdAt: string;
}

// Messages the server pushes to every open app.
export type SyncEvent =
  | { type: "snapshot"; tasks: Task[] }
  | { type: "task"; task: Task };

export const MAX_TEXT_LENGTH = 2000;

// Works on plain http too (crypto.randomUUID needs https).
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function isNewTask(value: unknown): value is NewTask {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" && /^[a-zA-Z0-9-]{8,64}$/.test(v.id) &&
    typeof v.originalText === "string" &&
    v.originalText.trim() !== "" && v.originalText.length <= MAX_TEXT_LENGTH &&
    typeof v.createdAt === "string" && !Number.isNaN(Date.parse(v.createdAt))
  );
}

export function taskFrom(input: NewTask): Task {
  return {
    id: input.id,
    originalText: input.originalText,
    createdAt: input.createdAt,
    status: "open",
  };
}
