// Presentation only: draws the waiting tasks and the day dial.

import type { Task } from "../../shared/task.js";

const count = document.querySelector<HTMLElement>("#count")!;
const list = document.querySelector<HTMLOListElement>("#list")!;
const dial = document.querySelector<SVGSVGElement>("#dial")!;
const SVG = "http://www.w3.org/2000/svg";

export function render(tasks: Task[], arrivedId: string | null): void {
  document.body.dataset.empty = String(tasks.length === 0);
  count.textContent = String(tasks.length);
  renderList(tasks, arrivedId);
  renderDial(tasks, arrivedId !== null);
}

function renderList(tasks: Task[], arrivedId: string | null): void {
  list.replaceChildren(
    ...tasks.map((task) => {
      const item = document.createElement("li");
      if (task.id === arrivedId) item.className = "arrive";
      const words = document.createElement("span");
      words.textContent = task.cleanTitle ?? task.originalText;
      const time = document.createElement("time");
      time.dateTime = task.createdAt;
      time.textContent = clock(new Date(task.createdAt));
      item.append(words, time);
      return item;
    }),
  );
}

// A gentle arc across the day. Fine ticks every 15 minutes; a taller
// tick wherever a thought was caught; the newest one holds the spark.
const CX = 160, CY = 640, R = 600, SPAN = 15; // degrees either side
const SLOTS = 96;

function renderDial(tasks: Task[], flare: boolean): void {
  const caught = new Array<number>(SLOTS).fill(0);
  for (const task of tasks) caught[slotOf(task.createdAt)]++;

  const parts: SVGElement[] = [];
  const [x0, y0] = point(0, R), [x1, y1] = point(1, R);
  parts.push(el("path", { class: "arc", d: `M${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1}` }));

  for (let slot = 0; slot <= SLOTS; slot++) {
    const share = slot / SLOTS;
    const hits = caught[slot] ?? 0;
    const length = hits ? 9 + 5 * Math.min(hits, 3) : slot % 4 === 0 ? 6 : 3;
    const [ax, ay] = point(share, R + 3), [bx, by] = point(share, R + 3 + length);
    parts.push(el("line", { class: hits ? "tick hit" : "tick", x1: ax, y1: ay, x2: bx, y2: by }));
  }

  for (const [hour, label] of [[6, "6AM"], [12, "12PM"], [18, "6PM"]] as const) {
    const share = hour / 24;
    const [lx, ly] = point(share, R - 14);
    const angle = (share * 2 - 1) * SPAN;
    parts.push(el("text", { class: "hour", x: lx, y: ly, transform: `rotate(${angle} ${lx} ${ly})` }, label));
  }

  const newest = tasks[0];
  if (newest) {
    const [sx, sy] = point(slotOf(newest.createdAt) / SLOTS, R);
    parts.push(el("circle", { class: flare ? "spark flare" : "spark", cx: sx, cy: sy, r: 2.4 }));
  }

  dial.replaceChildren(...parts);
}

function slotOf(iso: string): number {
  const d = new Date(iso);
  return Math.floor(((d.getHours() * 60 + d.getMinutes()) / 1440) * SLOTS);
}

function point(share: number, radius: number): [number, number] {
  const angle = (((share * 2 - 1) * SPAN) * Math.PI) / 180;
  return [round(CX + radius * Math.sin(angle)), round(CY - radius * Math.cos(angle))];
}

function el(name: string, attrs: Record<string, string | number>, text?: string): SVGElement {
  const node = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text) node.textContent = text;
  return node;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function clock(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
