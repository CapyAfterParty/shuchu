// The same world as the Shuchu app, in the browser.
//
// One full-screen WebGL shader (ported from the app's Skia shader) draws the
// mist, and glass exactly under every element marked `data-glass`. Elements
// are measured every frame, so anything that moves, scrolls or animates with
// plain CSS carries its glass with it. Text and controls stay ordinary HTML
// on top.
//
//   data-glass            make this element glass
//   data-radius="24"      corner radius (or "round")
//   data-lift / data-pearl / data-warm / data-melt / data-wobble   0..1 / px
//   data-layer="1"        glass resting on glass (a control on a panel)
//   data-spark="1.2"      a warm light at this element's centre
//
// Elements appear by condensing: they grow from their centre as they scroll
// into view (the `in` class, set by an IntersectionObserver).

import source from './scene.glsl?raw';

const SLOTS = 16;
const SPARKS = 4;
const RIPPLES = 3;

type Rgb = [number, number, number];
const hex = (h: string): Rgb => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

// The app's two atmospheres (mobile/src/theme/tokens.ts)
const MIST = {
  air: hex('#D9E2EB'),
  blobs: ['#AFC4D9', '#F4F6F8', '#7E95AE', '#E7BFA4', '#5C6D82', '#FFFFFF'].map(hex),
  milk: hex('#F3F7FB'), shade: hex('#3A5272'), spark: hex('#FFB27E'),
  glassStrength: 0.2, shadowStrength: 0.26,
};
const NIGHT = {
  air: hex('#0C1219'),
  blobs: ['#24384F', '#3E4E62', '#131E2B', '#5E4234', '#05080C', '#8FA6BF'].map(hex),
  milk: hex('#9DB0C6'), shade: hex('#000000'), spark: hex('#FFA466'),
  glassStrength: 0.08, shadowStrength: 0.55,
};

const mix = (a: Rgb, b: Rgb, k: number): Rgb => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

interface Tracked { presence: number; seed: number }

export interface Scene {
  ripple(x: number, y: number, strength?: number): void;
  setPorcelain(on: boolean): void;
}

export function startScene(canvas: HTMLCanvasElement): Scene | null {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
  if (!gl) return null;

  const vs = gl.createShader(gl.VERTEX_SHADER)!;
  gl.shaderSource(vs, 'attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }');
  gl.compileShader(vs);
  const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
  gl.shaderSource(fs, source);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(fs));
    return null;
  }
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = new Map<string, WebGLUniformLocation | null>();
  const u = (name: string) => {
    if (!U.has(name)) U.set(name, gl.getUniformLocation(prog, name));
    return U.get(name)!;
  };

  // state
  const tracked = new WeakMap<Element, Tracked>();
  const ripples: number[][] = Array.from({ length: RIPPLES }, () => [0, 0, -99, 0]);
  let nextRipple = 0;
  let porcelain = false;
  let night = matchMedia('(prefers-color-scheme: dark)').matches ? 1 : 0;
  let nightGoal = night;
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => { nightGoal = e.matches ? 1 : 0; });
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / innerWidth - 0.5) * 2;
    pointer.ty = (e.clientY / innerHeight - 0.5) * 2;
  }, { passive: true });

  let scale = 1;
  const resize = () => {
    const dpr = devicePixelRatio || 1;
    // like the app: the scene is soft, so about 1.5x is plenty (1x for Porcelain)
    scale = Math.min(dpr, porcelain ? 1 : 1.5);
    canvas.width = Math.round(innerWidth * scale);
    canvas.height = Math.round(innerHeight * scale);
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  resize();
  addEventListener('resize', resize);

  // adaptive quality, as in the app
  let frameAvg = 16;
  let quality = 1;
  let hold = 0;

  const A = new Float32Array(SLOTS * 4);
  const B = new Float32Array(SLOTS * 4);
  const C = new Float32Array(SLOTS * 4);
  const D = new Float32Array(SLOTS * 4);
  const K = new Float32Array(SPARKS * 4);
  const W = new Float32Array(RIPPLES * 4);

  const start = performance.now();
  let last = start;

  const frame = (now: number) => {
    const dt = Math.min(now - last, 100);
    last = now;
    frameAvg += (dt - frameAvg) * 0.05;
    if (++hold > 90) {
      if (quality === 1 && frameAvg > 26) { quality = 0; hold = 0; }
      else if (quality === 0 && frameAvg < 18) { quality = 1; hold = 0; }
    }
    night += (nightGoal - night) * Math.min(1, dt / 500);
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;

    const vw = innerWidth;
    const vh = innerHeight;
    A.fill(0); B.fill(0); C.fill(0); D.fill(0);
    let count = 0;
    let upper = 0;
    const els = document.querySelectorAll<HTMLElement>('[data-glass]');
    // sheets first, then what rests on them, so the shader layers them right
    const ordered = [...els].sort((a, b) => Number(a.dataset.layer ?? 0) - Number(b.dataset.layer ?? 0));
    for (const el of ordered) {
      if (count >= SLOTS) break;
      const r = el.getBoundingClientRect();
      let t = tracked.get(el);
      if (!t) { t = { presence: 0, seed: Math.random() }; tracked.set(el, t); }
      const goal = el.classList.contains('in') && !el.classList.contains('gone') ? 1 : 0;
      t.presence += (goal - t.presence) * Math.min(1, dt / 220);
      if (t.presence < 0.004 || r.bottom < -80 || r.top > vh + 80 || r.width < 1) continue;
      const i = count++;
      const layer = Number(el.dataset.layer ?? 0);
      if (layer > 0.5) upper++;
      const rad = el.dataset.radius === 'round' || el.dataset.radius === undefined
        ? Math.min(r.width, r.height) / 2
        : Math.min(Number(el.dataset.radius), r.width / 2, r.height / 2);
      // a little overshoot as the drop forms, like the app's springs
      const p = t.presence;
      const grow = p < 1 ? p * (1 + 0.06 * Math.sin(p * Math.PI)) : 1;
      A.set([r.left + r.width / 2, r.top + r.height / 2, r.width / 2, r.height / 2], i * 4);
      B.set([rad, grow, Number(el.dataset.melt ?? 0), Number(el.dataset.lift ?? 0.6)], i * 4);
      C.set([1, 1, Number(el.dataset.wobble ?? 0), t.seed], i * 4);
      D.set([Number(el.dataset.pearl ?? 0), Number(el.dataset.warm ?? 0), layer, 0], i * 4);
    }

    K.fill(0);
    let sparks = 0;
    for (const el of document.querySelectorAll<HTMLElement>('[data-spark]')) {
      if (sparks >= SPARKS) break;
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh || !el.classList.contains('in')) continue;
      K.set([r.left + r.width / 2, r.top + r.height / 2, Number(el.dataset.spark) || 1, Number(el.dataset.sparkSize ?? 5)], sparks++ * 4);
    }

    const sceneT = now - start;
    for (let i = 0; i < RIPPLES; i++) {
      const rp = ripples[i];
      const age = (sceneT - rp[2]) / 1000;
      W.set([rp[0], rp[1], age, age < 3 ? rp[3] : 0], i * 4);
    }

    const P = { air: mix(MIST.air, NIGHT.air, night) };
    gl.uniform1f(u('canvasH'), canvas.height);
    gl.uniform2f(u('res'), vw, vh);
    gl.uniform1f(u('time'), sceneT * 0.6);
    gl.uniform1f(u('density'), scale);
    let lx = -0.46 + pointer.x * 0.5;
    let ly = -0.89 - pointer.y * 0.3;
    const ll = Math.hypot(lx, ly) || 1;
    lx /= ll; ly /= ll;
    gl.uniform2f(u('light'), lx, ly);
    gl.uniform2f(u('tilt'), pointer.x * 0.5, pointer.y * 0.5);
    gl.uniform1f(u('haze'), 0);
    gl.uniform1f(u('quality'), quality);
    gl.uniform1f(u('viewScale'), scale);
    gl.uniform1f(u('glassOn'), porcelain ? 0 : 1);
    gl.uniform1f(u('shapeCount'), count);
    gl.uniform1f(u('upperCount'), upper);
    gl.uniform3fv(u('air'), P.air);
    for (let i = 0; i < 6; i++) gl.uniform3fv(u('b' + i), mix(MIST.blobs[i], NIGHT.blobs[i], night));
    gl.uniform3fv(u('milk'), mix(MIST.milk, NIGHT.milk, night));
    gl.uniform3fv(u('shade'), mix(MIST.shade, NIGHT.shade, night));
    gl.uniform3fv(u('sparkColor'), mix(MIST.spark, NIGHT.spark, night));
    gl.uniform1f(u('glassStrength'), MIST.glassStrength + (NIGHT.glassStrength - MIST.glassStrength) * night);
    gl.uniform1f(u('shadowStrength'), MIST.shadowStrength + (NIGHT.shadowStrength - MIST.shadowStrength) * night);
    gl.uniform1f(u('night'), night);
    gl.uniform4fv(u('shapeA'), A);
    gl.uniform4fv(u('shapeB'), B);
    gl.uniform4fv(u('shapeC'), C);
    gl.uniform4fv(u('shapeD'), D);
    gl.uniform4fv(u('sparks'), K);
    gl.uniform4fv(u('ripples'), W);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  return {
    ripple(x, y, strength = 1) {
      ripples[nextRipple] = [x, y, performance.now() - start, strength];
      nextRipple = (nextRipple + 1) % RIPPLES;
    },
    setPorcelain(on) {
      porcelain = on;
      resize();
    },
  };
}
