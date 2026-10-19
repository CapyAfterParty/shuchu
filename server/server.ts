// The one server that holds the truth. Devices POST new tasks and
// listen on /events, where every change is pushed the moment it is saved.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, normalize, resolve } from "node:path";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { isNewTask, taskFrom, type SyncEvent } from "../shared/task.js";
import { allTasks, getTask, loadTasks, putTask } from "./store.js";

const PORT = Number(process.env.PORT ?? 4545);
const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const listeners = new Set<ServerResponse>();

const PAGES: Record<string, string> = {
  "/": "public/phone.html",
  "/phone": "public/phone.html",
  "/desk": "public/desk.html",
};

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const path = new URL(req.url ?? "/", "http://x").pathname;

  if (req.method === "POST" && path === "/tasks") return createTask(req, res);
  if (req.method === "GET" && path === "/tasks") return sendJson(res, 200, allTasks());
  if (req.method === "GET" && path === "/events") return listen(req, res);
  if (req.method === "GET" && PAGES[path]) return sendFile(res, PAGES[path]);
  if (req.method === "GET" && path.startsWith("/public/")) return sendFile(res, path.slice(1));
  if (req.method === "GET" && path.startsWith("/js/")) return sendFile(res, "dist/" + path.slice(4));
  sendJson(res, 404, { error: "not found" });
}

async function createTask(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: unknown;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return sendJson(res, 400, { error: "bad json" });
  }
  if (!isNewTask(body)) return sendJson(res, 400, { error: "bad task" });

  const existing = getTask(body.id);
  if (existing) return sendJson(res, 200, existing); // a retry, already saved

  const task = taskFrom(body);
  await putTask(task);
  broadcast({ type: "task", task });
  sendJson(res, 201, task);
}

function listen(req: IncomingMessage, res: ServerResponse): void {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  res.socket?.setNoDelay(true);
  res.write(`retry: 1000\n\n`);
  push(res, { type: "snapshot", tasks: allTasks() });
  listeners.add(res);
  req.on("close", () => listeners.delete(res));
}

function broadcast(event: SyncEvent): void {
  for (const res of listeners) push(res, event);
}

function push(res: ServerResponse, event: SyncEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

// Keeps idle connections open through proxies and phone networks.
setInterval(() => {
  for (const res of listeners) res.write(": ping\n\n");
}, 15_000);

async function sendFile(res: ServerResponse, relative: string): Promise<void> {
  const file = resolve(ROOT, normalize(relative));
  if (!file.startsWith(ROOT + "/")) return sendJson(res, 404, { error: "not found" });
  try {
    const content = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(content);
  } catch {
    sendJson(res, 404, { error: "not found" });
  }
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(value));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((done, fail) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      body += chunk;
      if (body.length > 16_000) req.destroy(new Error("body too large"));
    });
    req.on("end", () => done(body));
    req.on("error", fail);
  });
}

function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === "IPv4" && !a.internal)
    .map((a) => a!.address);
}

await loadTasks();
createServer((req, res) => {
  handle(req, res).catch((error) => {
    console.error(error);
    if (!res.headersSent) sendJson(res, 500, { error: "server error" });
  });
}).listen(PORT, "0.0.0.0", () => {
  console.log(`Shuchu server on port ${PORT}`);
  console.log(`  desk:  http://localhost:${PORT}/desk`);
  for (const ip of lanAddresses()) console.log(`  phone: http://${ip}:${PORT}/phone`);
});
