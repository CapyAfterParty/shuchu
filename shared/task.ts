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
  confirmedAt?: string;          // when the person last said "still true"
}

// What a device sends to create a task. The id is made on the device,
// so sending the same task twice never makes a duplicate.
export interface NewTask extends TaskPatch {
  id: string;
  originalText: string;
  createdAt: string;
}

// The fields anyone may change after a task is caught. originalText never changes.
export interface TaskPatch {
  cleanTitle?: string;
  estimateMinutes?: number;
  place?: Place;
  firstStep?: string;
  status?: Status;
  notDoingReason?: NotDoingReason;
  leftOffNote?: string;
  minutesSpent?: number;
  confirmedAt?: string;
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

const PLACES: readonly string[] = ["desk", "errand"];
const STATUSES: readonly string[] = ["open", "done", "later", "not_doing"];
const REASONS: readonly string[] = ["not_mine", "not_needed", "too_big"];

const shortText = (v: unknown) => typeof v === "string" && v.length <= 400;
const minutes = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 24 * 60;

// Keeps only valid, known fields. Returns null if anything is malformed.
export function cleanPatch(value: unknown): TaskPatch | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const patch: TaskPatch = {};
  if (v.cleanTitle !== undefined) { if (!shortText(v.cleanTitle)) return null; patch.cleanTitle = v.cleanTitle as string; }
  if (v.firstStep !== undefined) { if (!shortText(v.firstStep)) return null; patch.firstStep = v.firstStep as string; }
  if (v.leftOffNote !== undefined) { if (!shortText(v.leftOffNote)) return null; patch.leftOffNote = v.leftOffNote as string; }
  if (v.estimateMinutes !== undefined) { if (!minutes(v.estimateMinutes)) return null; patch.estimateMinutes = v.estimateMinutes as number; }
  if (v.minutesSpent !== undefined) { if (!minutes(v.minutesSpent)) return null; patch.minutesSpent = v.minutesSpent as number; }
  if (v.place !== undefined) { if (!PLACES.includes(v.place as string)) return null; patch.place = v.place as Place; }
  if (v.status !== undefined) { if (!STATUSES.includes(v.status as string)) return null; patch.status = v.status as Status; }
  if (v.confirmedAt !== undefined) { if (typeof v.confirmedAt !== "string" || Number.isNaN(Date.parse(v.confirmedAt))) return null; patch.confirmedAt = v.confirmedAt; }
  if (v.notDoingReason !== undefined) { if (!REASONS.includes(v.notDoingReason as string)) return null; patch.notDoingReason = v.notDoingReason as NotDoingReason; }
  return patch;
}

export function taskFrom(input: NewTask): Task {
  return {
    ...(cleanPatch(input) ?? {}),
    id: input.id,
    originalText: input.originalText,
    createdAt: input.createdAt,
    status: "open",
  };
}
