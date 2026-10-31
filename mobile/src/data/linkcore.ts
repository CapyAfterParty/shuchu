// Linking and sealing, the same on the phone and in the browser.
// (The same file as mobile/src/data/linkcore.ts in the app's repo; keep them identical.)
//
// A link is one random secret, shared by QR code. From it:
//   space  what the sync server files records under (a hash; reveals nothing)
//   key    seals every record (XChaCha20-Poly1305) before it leaves a device
// The secret itself never reaches the server: in the link URL it sits after
// the `#`, which browsers don't send.

import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

export interface Link {
  /** The shared secret, base64url. */
  token: string;
  /** Where the sync server lives, e.g. https://shuchu.app */
  origin: string;
}

export interface Sealed { id: string; u: number; v: string }

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export function toB64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64[n & 63];
  }
  return out;
}
export function fromB64(text: string): Uint8Array {
  const out: number[] = [];
  let buf = 0, bits = 0;
  for (const ch of text) {
    const v = B64.indexOf(ch);
    if (v < 0) throw new Error('bad base64');
    buf = (buf << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 255); }
  }
  return new Uint8Array(out);
}

/** UTF-8 to text, by hand (not every phone runtime has TextDecoder). */
function fromUtf8(b: Uint8Array): string {
  let out = '';
  for (let i = 0; i < b.length;) {
    const c = b[i++];
    let cp = c;
    if (c >= 0xf0) cp = ((c & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else if (c >= 0xe0) cp = ((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else if (c >= 0xc0) cp = ((c & 31) << 6) | (b[i++] & 63);
    out += String.fromCodePoint(cp);
  }
  return out;
}

/** A fresh secret from 32 random bytes. */
export const newToken = (random: (n: number) => Uint8Array) => toB64(random(32));

export const spaceOf = (token: string) => bytesToHex(sha256(utf8ToBytes(`shuchu/space/${token}`))).slice(0, 40);
const keys = new Map<string, Uint8Array>();
const keyOf = (token: string) => {
  let k = keys.get(token);
  if (!k) keys.set(token, (k = sha256(utf8ToBytes(`shuchu/key/${token}`))));
  return k;
};

/** Seal a record's contents. `nonce` must be 24 fresh random bytes. */
export function seal(token: string, value: unknown, nonce: Uint8Array): string {
  const box = xchacha20poly1305(keyOf(token), nonce).encrypt(utf8ToBytes(JSON.stringify(value)));
  const out = new Uint8Array(nonce.length + box.length);
  out.set(nonce); out.set(box, nonce.length);
  return toB64(out);
}

/** Open a sealed record, or null if it isn't ours (or was tampered with). */
export function unseal<T>(token: string, sealed: string): T | null {
  try {
    const raw = fromB64(sealed);
    const plain = xchacha20poly1305(keyOf(token), raw.slice(0, 24)).decrypt(raw.slice(24));
    return JSON.parse(fromUtf8(plain)) as T;
  } catch {
    return null;
  }
}

/** What the QR code holds: a web address any phone camera can open. */
export const linkUrl = (link: Link) => `${link.origin.replace(/\/+$/, '')}/link#k=${link.token}`;

/** Read a link from a scanned code or an opened address (web or shuchu://). */
export function parseLink(text: string): Link | null {
  const t = text.trim();
  const token = /[#?&]k=([A-Za-z0-9_-]{40,64})/.exec(t)?.[1];
  if (!token) return null;
  const http = /^(https?:\/\/[^/#?]+)/i.exec(t)?.[1];
  const named = /[?&]o=([^&#]+)/.exec(t)?.[1];
  const origin = http ?? (named ? decodeURIComponent(named) : null);
  if (!origin || !/^https?:\/\/[^/]+$/i.test(origin)) return null;
  return { token, origin };
}

/** The address that opens the phone app straight onto the link. */
export const appUrl = (link: Link) => `shuchu://link?k=${link.token}&o=${encodeURIComponent(link.origin)}`;

/** What Sync allows this link right now (free trial, paid, or paused). */
export interface Plan { paid: boolean; trialEnds: number; active: boolean }
/** Where to subscribe on the web, for this link (null until the site has a checkout set up). */
export interface Checkout { web: string | null }

/** The server said no: `plan` is set when it's because the free trial is over. */
export class SyncRefused extends Error {
  constructor(public status: number, public plan?: Plan, public checkout?: Checkout) { super(`sync ${status}`); }
}

const api = (link: Link, path: string) => `${link.origin.replace(/\/+$/, '')}/api/${path}`;

/** One round trip: send what changed here, get back everything newer than `since`. */
export async function exchange(link: Link, since: number, push: Sealed[]): Promise<{ seq: number; records: Sealed[]; plan?: Plan }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(api(link, 'sync'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ space: spaceOf(link.token), since, push }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { plan?: Plan; checkout?: Checkout };
      throw new SyncRefused(res.status, body.plan, body.checkout);
    }
    return (await res.json()) as { seq: number; records: Sealed[]; plan?: Plan };
  } finally {
    clearTimeout(timer);
  }
}

/** The link's plan and where to subscribe. `fresh`: just back from paying, ask the store again. */
export async function planFor(link: Link, fresh = false): Promise<{ plan: Plan; checkout: Checkout }> {
  const res = await fetch(`${api(link, 'plan')}?space=${spaceOf(link.token)}${fresh ? '&fresh' : ''}`);
  if (!res.ok) throw new SyncRefused(res.status);
  return (await res.json()) as { plan: Plan; checkout: Checkout };
}

/** Delete this link's synced copy from the server (each device keeps its own). */
export async function forget(link: Link): Promise<boolean> {
  const res = await fetch(api(link, 'forget'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ space: spaceOf(link.token) }) }).catch(() => null);
  return !!res?.ok;
}

/** The live line: the server says "changed" the moment another device syncs. */
export const liveUrl = (link: Link) => `${api(link, 'live').replace(/^http/, 'ws')}?space=${spaceOf(link.token)}`;

/** Whole days left of the free trial (0 once it's over). */
export const daysLeft = (plan: Plan, now = Date.now()) => Math.max(0, Math.ceil((plan.trialEnds - now) / 86_400_000));
