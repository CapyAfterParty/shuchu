// Renders Shuchu's icon, adaptive icon layers and splash with the app's own
// scene shader, so the icon is literally a frame of the app: mist, a drop of
// glass, its warm light, and Shu's eyes.
// Run: node scripts/render-icons.mjs  (writes into assets/)
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const CanvasKitInit = require("canvaskit-wasm/bin/full/canvaskit.js");
const root = new URL("..", import.meta.url).pathname;

const src = readFileSync(root + "src/scene/shader.ts", "utf8");
const SLOTS = 32, SPARKS = 4, RIPPLES = 3;
const code = src.match(/sceneShader = \/\* glsl \*\/ `([\s\S]*?)`;/)[1]
  .replace(/\$\{SLOTS\}/g, SLOTS).replace(/\$\{SPARKS\}/g, SPARKS).replace(/\$\{RIPPLES\}/g, RIPPLES);
const tokens = readFileSync(root + "src/theme/tokens.ts", "utf8");
const pal = (name) => {
  const block = tokens.slice(tokens.indexOf(`export const ${name}: Palette`));
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  const get = (k) => hex(block.match(new RegExp(`${k}: hex\\('(#[0-9A-Fa-f]{6})'\\)`))[1]);
  const blobs = [...block.slice(block.indexOf("blobs:"), block.indexOf("],")).matchAll(/hex\('(#[0-9A-Fa-f]{6})'\)/g)].map((m) => hex(m[1]));
  const num = (k) => parseFloat(block.match(new RegExp(`${k}: ([0-9.]+)`))[1]);
  return { air: get("air"), blobs, milk: get("milk"), shade: get("shade"), spark: get("spark"), glassStrength: num("glassStrength"), shadowStrength: num("shadowStrength") };
};

const CK = await CanvasKitInit({ locateFile: (f) => root + "node_modules/canvaskit-wasm/bin/full/" + f });
const errs = [];
const effect = CK.RuntimeEffect.Make(code, (e) => errs.push(e));
if (!effect) throw new Error(errs.join("\n"));

function uniforms(values) {
  const out = new Float32Array(effect.getUniformFloatCount());
  for (let i = 0; i < effect.getUniformCount(); i++) {
    const u = effect.getUniform(i);
    const name = effect.getUniformName(i);
    const v = values[name];
    if (v === undefined) throw new Error("missing uniform " + name);
    const flat = Array.isArray(v) ? v.flat() : [v];
    const n = u.columns * u.rows;
    for (let j = 0; j < n; j++) out[u.slot + j] = flat[j] ?? 0;
  }
  return out;
}

function render({ size, night = false, drop, eyes = true, time = 41000, transparent = false }) {
  const P = pal(night ? "night" : "mist");
  const shapes = { A: [], B: [], C: [], D: [] };
  if (drop) {
    shapes.A.push([drop.x, drop.y, drop.r, drop.r * 0.96]);
    shapes.B.push([drop.r, 1, 0, 0.85]);
    shapes.C.push([1, 1, 0, 0.3]);
    shapes.D.push([0.1, 0.22, 0, 0]);
  }
  for (const k of "ABCD") while (shapes[k].length < SLOTS) shapes[k].push(k === "C" ? [1, 1, 0, 0] : [0, 0, 0, 0]);
  const sparks = [drop ? [drop.x + drop.r * 0.52, drop.y + drop.r * 0.5, 1.1, size * 0.011] : [0, 0, 0, 1]];
  while (sparks.length < SPARKS) sparks.push([0, 0, 0, 1]);
  const light = [-0.46, -0.89];
  const u = uniforms({
    res: [size, size], time, density: 1, light, tilt: [0, 0], haze: 0, quality: 1,
    viewScale: 1, glassOn: 1, shapeCount: drop ? 1 : 0, upperCount: 0,
    air: P.air, b0: P.blobs[0], b1: P.blobs[1], b2: P.blobs[2], b3: P.blobs[3], b4: P.blobs[4], b5: P.blobs[5],
    milk: P.milk, shade: P.shade, sparkColor: P.spark, glassStrength: P.glassStrength, shadowStrength: P.shadowStrength,
    night: night ? 1 : 0,
    shapeA: shapes.A, shapeB: shapes.B, shapeC: shapes.C, shapeD: shapes.D,
    sparks, ripples: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
  });
  const surface = CK.MakeSurface(size, size);
  const c = surface.getCanvas();
  const paint = new CK.Paint();
  paint.setShader(effect.makeShader(u));
  c.drawRect(CK.XYWHRect(0, 0, size, size), paint);
  if (drop && eyes) drawEyes(c, drop, night);
  surface.flush();
  const img = surface.makeImageSnapshot();
  let bytes = img.encodeToBytes();
  if (transparent) bytes = cutOut(img, size, drop);
  surface.delete();
  return bytes;
}

// Shu's eyes, exactly as the app draws them: two soft upright ovals a little above centre.
function drawEyes(c, drop, night) {
  const w = drop.r * 2;
  const e = w * 0.088;
  const gap = w * 0.2;
  const cy = drop.y - w * 0.03;
  const paint = new CK.Paint();
  paint.setAntiAlias(true);
  paint.setColor(night ? CK.Color(232, 240, 248, 0.92) : CK.Color(23, 33, 44, 0.8));
  for (const s of [-1, 1]) {
    const cx = drop.x + s * (gap / 2 + e / 2);
    c.drawRRect(CK.RRectXY(CK.XYWHRect(cx - e / 2, cy - e * 0.675, e, e * 1.35), e / 2, e / 2), paint);
  }
}

// For splash images: keep the drop and its soft shadow, fade the mist to nothing.
function cutOut(img, size, drop) {
  const pixels = img.readPixels(0, 0, { width: size, height: size, colorType: CK.ColorType.RGBA_8888, alphaType: CK.AlphaType.Unpremul, colorSpace: CK.ColorSpace.SRGB });
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x - drop.x, (y - drop.y) / 0.96) - drop.r;
    const a = Math.max(0, Math.min(1, 1 - (d - 2) / (drop.r * 0.16)));
    pixels[(y * size + x) * 4 + 3] = Math.round(255 * a * a);
  }
  const out = CK.MakeImage({ width: size, height: size, colorType: CK.ColorType.RGBA_8888, alphaType: CK.AlphaType.Unpremul, colorSpace: CK.ColorSpace.SRGB }, pixels, size * 4);
  return out.encodeToBytes();
}

function monochrome(size, drop) {
  const surface = CK.MakeSurface(size, size);
  const c = surface.getCanvas();
  c.clear(CK.TRANSPARENT);
  const paint = new CK.Paint();
  paint.setAntiAlias(true);
  paint.setColor(CK.WHITE);
  c.drawOval(CK.XYWHRect(drop.x - drop.r, drop.y - drop.r * 0.96, drop.r * 2, drop.r * 1.92), paint);
  const hole = new CK.Paint();
  hole.setAntiAlias(true);
  hole.setBlendMode(CK.BlendMode.Clear);
  const w = drop.r * 2, e = w * 0.088, gap = w * 0.2, cy = drop.y - w * 0.03;
  for (const s of [-1, 1]) {
    const cx = drop.x + s * (gap / 2 + e / 2);
    c.drawRRect(CK.RRectXY(CK.XYWHRect(cx - e / 2, cy - e * 0.675, e, e * 1.35), e / 2, e / 2), hole);
  }
  surface.flush();
  const bytes = surface.makeImageSnapshot().encodeToBytes();
  surface.delete();
  return bytes;
}

const S = 1024;
const out = (name, bytes) => { writeFileSync(root + "assets/" + name, bytes); console.log("wrote", name); };
// app icon: the drop large and centred
out("icon.png", render({ size: S, drop: { x: S / 2, y: S * 0.5, r: S * 0.3 } }));
// Android adaptive icon: the drop inside the 66% safe zone, mist behind it
out("android-icon-foreground.png", render({ size: S, drop: { x: S / 2, y: S * 0.5, r: S * 0.215 } }));
out("android-icon-background.png", render({ size: S }));
out("android-icon-monochrome.png", monochrome(S, { x: S / 2, y: S * 0.5, r: S * 0.215 }));
// splash: the drop alone, in both atmospheres
out("splash-icon.png", render({ size: S, drop: { x: S / 2, y: S / 2, r: S * 0.34 }, transparent: true }));
out("splash-icon-dark.png", render({ size: S, night: true, drop: { x: S / 2, y: S / 2, r: S * 0.34 }, transparent: true }));
// favicon
out("favicon.png", render({ size: 196, drop: { x: 98, y: 98, r: 196 * 0.32 } }));
