// Presentation only: turns every `.glass` element into liquid glass.
//
// Everywhere: a specular highlight that follows your finger or cursor.
// In Chromium: real refraction. Each surface gets its own SVG filter with a
// displacement map shaped like its rim, so the mist behind bends at the edges
// like light through a thick lens, with a faint rainbow fringe.

const SVG = "http://www.w3.org/2000/svg";
const canRefract = "chrome" in window && !/Firefox/.test(navigator.userAgent);
let defs: SVGDefsElement | null = null;
let next = 0;

export function liquify(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>(".glass")) {
    if (el.dataset.liquid) continue;
    el.dataset.liquid = "on";
    if (canRefract) refract(el);
  }
}

// The highlight drifts toward wherever the light (your pointer) is.
export function followLight(): void {
  const move = (x: number, y: number) => {
    for (const el of document.querySelectorAll<HTMLElement>(".glass")) {
      const box = el.getBoundingClientRect();
      el.style.setProperty("--lx", `${((x - box.left) / box.width) * 100}%`);
      el.style.setProperty("--ly", `${((y - box.top) / box.height) * 100}%`);
    }
  };
  addEventListener("pointermove", (e) => move(e.clientX, e.clientY), { passive: true });
  addEventListener("pointerdown", (e) => move(e.clientX, e.clientY), { passive: true });
}

// A jelly squish on press, so touching glass feels physical.
export function squishOnPress(el: HTMLElement): void {
  el.addEventListener("pointerdown", () => {
    el.classList.remove("squish");
    void el.offsetWidth;
    el.classList.add("squish");
  });
  el.addEventListener("animationend", () => el.classList.remove("squish"));
}

function refract(el: HTMLElement): void {
  const id = `liquid-${next++}`;
  const filter = document.createElementNS(SVG, "filter");
  filter.id = id;
  filter.setAttribute("color-interpolation-filters", "sRGB");
  filter.setAttribute("filterUnits", "userSpaceOnUse");
  filter.setAttribute("primitiveUnits", "userSpaceOnUse");
  ensureDefs().append(filter);

  const draw = () => {
    const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
    if (!w || !h) return;
    const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || Math.min(w, h) / 2;
    const depth = Number(el.dataset.depth ?? 1);
    filter.replaceChildren(...lens(w, h, radius, depth));
    for (const attr of ["x", "y"]) filter.setAttribute(attr, "0");
    filter.setAttribute("width", String(w));
    filter.setAttribute("height", String(h));
    el.style.setProperty("--refract", `url(#${id})`);
  };
  new ResizeObserver(draw).observe(el);
}

// Map → three slightly different displacements (red, green, blue) → recombine.
function lens(w: number, h: number, radius: number, depth: number): SVGElement[] {
  const strength = Math.min(w, h) * 0.22 * depth;
  const image = node("feImage", {
    href: rimMap(w, h, radius), x: 0, y: 0, width: w, height: h,
    preserveAspectRatio: "none", result: "map",
  });
  const channel = (scale: number, matrix: string, result: string) => [
    node("feDisplacementMap", {
      in: "SourceGraphic", in2: "map", scale: -scale,
      xChannelSelector: "R", yChannelSelector: "G", result: `${result}-d`,
    }),
    node("feColorMatrix", { in: `${result}-d`, type: "matrix", values: matrix, result }),
  ];
  return [
    image,
    ...channel(strength, "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0", "r"),
    ...channel(strength * 1.05, "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0", "g"),
    ...channel(strength * 1.1, "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0", "b"),
    node("feComposite", { in: "r", in2: "g", operator: "arithmetic", k2: 1, k3: 1, result: "rg" }),
    node("feComposite", { in: "rg", in2: "b", operator: "arithmetic", k2: 1, k3: 1 }),
  ];
}

// Red = push left/right, green = push up/down, 128 = stay. Only the rim
// bends, steeply at the very edge, like the curved lip of a glass pebble.
function rimMap(w: number, h: number, radius: number): string {
  const scale = 0.5; // half resolution is plenty; the filter stretches it
  const cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;
  const pixels = ctx.createImageData(cw, ch);
  const r = Math.min(radius, w / 2, h / 2);
  const rim = Math.min(w, h) * 0.24;

  for (let py = 0; py < ch; py++) {
    for (let px = 0; px < cw; px++) {
      const x = (px + 0.5) / scale - w / 2, y = (py + 0.5) / scale - h / 2;
      const qx = Math.abs(x) - (w / 2 - r), qy = Math.abs(y) - (h / 2 - r);
      let nx = 0, ny = 0, inside: number;
      if (qx > 0 && qy > 0) {
        const len = Math.hypot(qx, qy) || 1;
        inside = r - len;
        nx = (qx / len) * Math.sign(x);
        ny = (qy / len) * Math.sign(y);
      } else if (qx > qy) {
        inside = r - qx;
        nx = Math.sign(x);
      } else {
        inside = r - qy;
        ny = Math.sign(y);
      }
      const t = Math.max(0, Math.min(1, 1 - inside / rim)); // 0 deep inside → 1 at edge
      const bend = 1 - Math.sqrt(1 - t * t);                 // circular lip profile
      const i = (py * cw + px) * 4;
      pixels.data[i] = 128 + nx * bend * 127;
      pixels.data[i + 1] = 128 + ny * bend * 127;
      pixels.data[i + 2] = 128;
      pixels.data[i + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas.toDataURL();
}

function ensureDefs(): SVGDefsElement {
  if (defs) return defs;
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  defs = document.createElementNS(SVG, "defs");
  svg.append(defs);
  document.body.append(svg);
  return defs;
}

function node(name: string, attrs: Record<string, string | number>): SVGElement {
  const el = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
}
