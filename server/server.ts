// The one server that holds the truth. Devices POST new tasks and
// listen on /events, where every change is pushed the moment it is saved.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createServer as createSecureServer } from "node:https";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, normalize, resolve } from "node:path";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { cleanPatch, isNewTask, taskFrom, type SyncEvent } from "../shared/task.js";
import { allTasks, getTask, loadTasks, putTask } from "./store.js";

const PORT = Number(process.env.PORT ?? 4545);
const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const listeners = new Set<ServerResponse>();

const PAGES: Record<string, string> = {
  "/": "public/phone.html",
  "/phone": "public/phone.html",
  "/sw.js": "public/sw.js", // served from the root so it can look after the whole app
  "/manifest.webmanifest": "public/manifest.webmanifest",
};

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const path = new URL(req.url ?? "/", "http://x").pathname;
  // Any Shuchu app may talk to this server, wherever it is served from.
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET, POST, PATCH, OPTIONS");
  res.setHeader("access-control-allow-headers", req.headers["access-control-request-headers"] ?? "content-type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && path === "/tasks") return createTask(req, res);
  if (req.method === "GET" && path === "/tasks") return sendJson(res, 200, allTasks());
  if (req.method === "PATCH" && path.startsWith("/tasks/")) return updateTask(req, res, path.slice(7));
  if (req.method === "GET" && path === "/ping") return sendJson(res, 200, { ok: true, at: Date.now() });
  if (req.method === "GET" && path === "/events") return listen(req, res);
  if (req.method === "GET" && (path === "/desk" || path === "/desk/")) return sendDesk(res, "index.html");
  if (req.method === "GET" && path.startsWith("/desk/")) return sendDesk(res, path.slice(6));
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

async function updateTask(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  const existing = getTask(decodeURIComponent(id));
  if (!existing) return sendJson(res, 404, { error: "no such task" });
  let patch;
  try {
    patch = cleanPatch(JSON.parse(await readBody(req)));
  } catch {
    return sendJson(res, 400, { error: "bad json" });
  }
  if (!patch) return sendJson(res, 400, { error: "bad patch" });

  const task = { ...existing, ...patch };
  await putTask(task);
  broadcast({ type: "task", task });
  sendJson(res, 200, task);
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

// The desk app is built into desk/dist (npm run setup). Until it is, say so.
async function sendDesk(res: ServerResponse, relative: string): Promise<void> {
  try {
    await readFile(resolve(ROOT, "desk/dist/index.html"));
  } catch {
    res.writeHead(503, { "content-type": "text/plain; charset=utf-8" });
    res.end("The desk app isn't built yet. Run: npm run setup");
    return;
  }
  return sendFile(res, "desk/dist/" + relative);
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

// Set SHUCHU_CERT and SHUCHU_KEY to serve over https. Phones only let the
// app open offline (service worker) over https or on localhost.
const cert = process.env.SHUCHU_CERT, key = process.env.SHUCHU_KEY;
const secure = Boolean(cert && key);
const scheme = secure ? "https" : "http";

function onRequest(req: IncomingMessage, res: ServerResponse): void {
  handle(req, res).catch((error) => {
    console.error(error);
    if (!res.headersSent) sendJson(res, 500, { error: "server error" });
  });
}

await loadTasks();
const server = secure
  ? createSecureServer({ cert: readFileSync(cert!), key: readFileSync(key!) }, onRequest)
  : createServer(onRequest);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Shuchu server on port ${PORT}`);
  console.log(`  desk:  ${scheme}://localhost:${PORT}/desk`);
  for (const ip of lanAddresses()) console.log(`  phone: ${scheme}://${ip}:${PORT}/phone`);
});
