precision highp float;
#define SLOTS 16
uniform float canvasH;

uniform vec2 res;
uniform float time;
uniform float density;
uniform vec2 light;      // unit direction towards the light, screen space
uniform vec2 tilt;       // parallax, -1..1
uniform float haze;        // 0..1 deepens the depth of field behind sheets
uniform float quality;     // 1 = full, 0 = lighter path for slower phones
uniform float viewScale;   // canvas pixels per screen point, over density (<1 = rendered smaller, scaled up)
uniform float glassOn;     // 0 = Porcelain: atmosphere and sparks only, surfaces are drawn natively
uniform float shapeCount;  // live shapes, packed at the front of the arrays
uniform float upperCount;  // how many of them rest on sheets (layer 1)

uniform vec3 air;
uniform vec3 b0; uniform vec3 b1; uniform vec3 b2;
uniform vec3 b3; uniform vec3 b4; uniform vec3 b5;
uniform vec3 milk;
uniform vec3 shade;
uniform vec3 sparkColor;
uniform float glassStrength;
uniform float shadowStrength;
uniform float night;

uniform vec4 shapeA[SLOTS]; // cx, cy, half width, half height
uniform vec4 shapeB[SLOTS]; // corner radius, presence, melt, lift
uniform vec4 shapeC[SLOTS]; // squash x, squash y, wobble, seed
uniform vec4 shapeD[SLOTS]; // pearl (milky), warmth, layer, unused
uniform vec4 sparks[4]; // x, y, intensity, radius
uniform vec4 ripples[3]; // x, y, age (s), strength

float gauss(vec2 p, vec2 c, float s, float blur) {
  vec2 d = p - c;
  float v = s * s + blur * blur;
  return exp(-dot(d, d) / (2.0 * v)) * (s * s / v);
}

float stoneMask(vec2 p, vec2 c, float r, float soft) {
  return 1.0 - smoothstep(r - soft, r + soft, length(p - c));
}

vec3 atmosphere(vec2 p, float blur) {
  float u = res.y;
  float t = time * 0.001;
  blur += haze * 34.0;
  vec2 par = tilt * u * 0.035;

  vec3 col = air;
  vec2 c0 = vec2(0.14 + 0.05 * sin(t * 0.050), 0.20 + 0.04 * cos(t * 0.041)) * res + par * 0.6;
  vec2 c1 = vec2(0.86 + 0.04 * cos(t * 0.046), 0.14 + 0.05 * sin(t * 0.037)) * res + par * 0.8;
  vec2 c2 = vec2(0.28 + 0.06 * sin(t * 0.033 + 2.0), 0.96 + 0.03 * cos(t * 0.029)) * res + par * 0.5;
  vec2 c3 = vec2(0.64 + 0.07 * cos(t * 0.039 + 1.0), 0.36 + 0.06 * sin(t * 0.044 + 3.0)) * res + par * 1.1;
  vec2 c4 = vec2(0.50 + 0.05 * sin(t * 0.027 + 4.0), 0.58 + 0.05 * cos(t * 0.031 + 1.5)) * res + par * 1.4;
  vec2 c5 = vec2(0.98 + 0.03 * sin(t * 0.035), 0.78 + 0.05 * cos(t * 0.043 + 2.5)) * res + par * 0.7;

  col = mix(col, b0, 0.92 * gauss(p, c0, 0.44 * u, blur));
  col = mix(col, b1, 0.95 * gauss(p, c1, 0.36 * u, blur));
  col = mix(col, b2, 0.88 * gauss(p, c2, 0.40 * u, blur));
  col = mix(col, b3, 0.78 * gauss(p, c3, 0.17 * u, blur));
  // an out-of-focus figure: elongated shadow
  vec2 q = p - c4; q.x *= 1.7;
  col = mix(col, b4, 0.42 * gauss(q + c4, c4, 0.15 * u, blur));
  col = mix(col, b5, 0.65 * gauss(p, c5, 0.16 * u, blur));

  // distant glass stones, far out of focus, drifting
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 sc = vec2(0.18 + 0.62 * fract(fi * 0.618 + 0.11), 0.16 + 0.70 * fract(fi * 0.382 + 0.07)) * res;
    sc += vec2(sin(t * (0.06 + fi * 0.013) + fi * 2.1), cos(t * (0.05 + fi * 0.011) + fi)) * u * 0.03;
    sc += par * (1.8 + fi * 0.5);
    float r = u * (0.055 + 0.03 * fi);
    float soft = 10.0 + fi * 6.0 + blur * 0.9;
    float m = stoneMask(p, sc, r, soft);
    float hl = gauss(p, sc + vec2(-0.35, -0.45) * r, r * 0.45, soft * 0.6);
    col = mix(col, mix(col, milk, 0.4), m * 0.45);
    col = mix(col, milk, hl * 0.22 * (1.0 - night * 0.5));
  }

  // a gentle vignette keeps the eye in the middle
  vec2 v = (p / res - 0.5) * vec2(0.9, 1.1);
  col *= 1.0 - dot(v, v) * (0.10 + night * 0.25);
  return col;
}

vec2 rippled(vec2 p) {
  for (int i = 0; i < 3; i++) {
    vec4 r = ripples[i];
    if (r.w < 0.001) continue;
    vec2 d = p - r.xy;
    float dist = length(d) + 0.0001;
    float front = r.z * 260.0;
    float x = dist - front;
    float wave = sin(x * 0.07) * exp(-abs(x) / 34.0) * exp(-r.z * 1.6) * r.w;
    p += d / dist * wave * 9.0;
  }
  return p;
}

float smin(float a, float b, float k) {
  if (k <= 0.0) return min(a, b);
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

float roundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// d, pearl, warmth, lift of the surfaces in one layer.
// Layer 0 rests on the atmosphere; layer 1 (controls on sheets) rests on layer 0.
vec4 surfaces(vec2 p, float layer) {
  float d = 100000.0;
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  float t = time * 0.001;
  for (int i = 0; i < SLOTS; i++) {
    if (float(i) >= shapeCount) break;
    vec4 a = shapeA[i];
    vec4 b = shapeB[i];
    if (b.y < 0.002 || abs(shapeD[i].z - layer) > 0.5) continue;
    vec4 c = shapeC[i];
    vec2 q = (p - a.xy) / c.xy;
    vec2 hs = a.zw * b.y;
    float di = roundBox(q, hs, min(b.x * b.y, min(hs.x, hs.y))) * min(c.x, c.y);
    if (c.z > 0.0 && di < 60.0) {
      vec2 n = q / (length(q) + 0.001);
      di += c.z * smoothstep(60.0, 20.0, di) * (n.x * n.y * sin(t * 0.55 + c.w * 6.2831)
                  + (n.x * n.x - n.y * n.y) * 0.5 * cos(t * 0.42 + c.w * 4.1));
    }
    d = smin(d, di, b.z);
    // blend materials smoothly between neighbours, so melted shapes have no
    // seams; inside overlapping shapes the innermost one (a bead on its
    // track) owns the material
    float w = di < 0.0 ? exp(max(di, -60.0) / 7.0) : exp(-min(di, 120.0) / 2.5);
    acc += w * vec3(shapeD[i].x, shapeD[i].y, b.w);
    wsum += w;
  }
  acc /= max(wsum, 0.000001);
  return vec4(d, acc);
}

// Each surface casts its own shadow, offset by its own height.
float shadowAt(vec2 p, float layer) {
  float lit = 1.0;
  for (int i = 0; i < SLOTS; i++) {
    if (float(i) >= shapeCount) break;
    vec4 a = shapeA[i];
    vec4 b = shapeB[i];
    if (b.y < 0.002 || abs(shapeD[i].z - layer) > 0.5) continue;
    vec4 c = shapeC[i];
    float lift = b.w;
    vec2 off = -light * (7.0 + lift * 16.0) + vec2(0.0, 5.0 + lift * 12.0);
    vec2 q = (p - off - a.xy) / c.xy;
    vec2 hs = a.zw * b.y;
    float ds = roundBox(q, hs, min(b.x * b.y, min(hs.x, hs.y))) * min(c.x, c.y);
    float sh = (1.0 - smoothstep(-10.0, 30.0 + lift * 34.0, ds)) * (0.55 + lift * 0.55);
    lit *= 1.0 - clamp(sh, 0.0, 1.0) * shadowStrength;
  }
  return 1.0 - lit;
}

vec2 normalAt(vec2 p, float d, float layer) {
  float e = 1.4;
  vec2 n = vec2(surfaces(p + vec2(e, 0.0), layer).x - d, surfaces(p + vec2(0.0, e), layer).x - d);
  return n / (length(n) + 0.0001);
}

// Light on a glass body. g is what is seen through it.
vec3 lightGlass(vec3 g, vec2 n, float d, float edge, float bend, float pearl, float warm) {
  g = mix(g, mix(milk, sparkColor, 0.55), warm * 0.4);

  vec3 N = normalize(vec3(n * bend * 1.9, 1.0));
  vec3 L = normalize(vec3(light, 0.7));
  g *= 0.93 + 0.12 * dot(N, L);

  float lit = max(dot(n, light), 0.0);
  float away = max(dot(n, -light), 0.0);
  vec3 R = reflect(-L, N);
  float spec = pow(max(R.z, 0.0), 90.0);
  g += vec3(1.0) * spec * 0.95;
  // a broad wet sheen, and a second, warmer glint from light bouncing back
  // up from below: the twin highlights of a drop of water
  g += milk * pow(max(R.z, 0.0), 10.0) * 0.10 * (1.0 - night * 0.4);
  vec3 L2 = normalize(vec3(-light * 0.7, 0.75));
  float spec2 = pow(max(reflect(-L2, N).z, 0.0), 70.0);
  g += mix(vec3(1.0), sparkColor, 0.35) * spec2 * 0.38;
  g += milk * pow(edge, 4.0) * lit * 0.42;

  // light focused through the body lands on the far inner edge
  float band = exp(-pow((-d - 8.0) / 6.5, 2.0));
  g += mix(milk, sparkColor, 0.18 + warm * 0.3) * band * away * (0.30 - night * 0.08);
  // the thick far edge swallows a little light
  g *= 1.0 - 0.13 * edge * edge * away;

  // a dark line just inside the rim: the edge of thick glass seen side-on
  g *= 1.0 - 0.16 * exp(-pow((-d - 3.2) / 1.8, 2.0)) * (0.5 + 0.5 * away);

  // hairline rim, brightest where it faces the light
  float rim = exp(min(d, 0.0) / 1.1);
  return mix(g, vec3(1.0), rim * (0.18 + 0.62 * lit) * (0.85 - night * 0.35));
}

// The first layer, complete: atmosphere, its shadows and its glass.
vec3 baseLayer(vec2 p) {
  vec4 s = surfaces(p, 0.0);
  float d = s.x;
  vec3 col = atmosphere(rippled(p), 0.0);

  if (d > -1.5 && d < 170.0) {
    float sh = shadowAt(p, 0.0);
    col = mix(col, col * mix(vec3(1.0), shade, 0.55) * 0.82, sh);
    // light scattered just outside the rim
    col += milk * exp(-max(d, 0.0) / 10.0) * 0.06 * (1.0 - night * 0.5);
  }

  if (d < 1.5) {
    vec2 n = normalAt(p, d, 0.0);
    float edge = 1.0 - clamp(-d / 30.0, 0.0, 1.0);
    float bend = edge * edge * (0.6 + 0.4 * edge);
    vec2 off = -n * bend * 42.0;
    float frost = 15.0;
    vec3 g;
    if (quality > 0.5) {
      // red, green and blue bend by slightly different amounts
      g.r = atmosphere(rippled(p + off * 1.00), frost).r;
      g.g = atmosphere(rippled(p + off * 1.10), frost).g;
      g.b = atmosphere(rippled(p + off * 1.22), frost).b;
    } else {
      g = atmosphere(p + off * 1.06, frost);
    }
    g = mix(g, milk, clamp(glassStrength * (0.75 + 0.7 * edge) + s.y * 0.72, 0.0, 0.92));
    g = lightGlass(g, n, d, edge, bend, s.y, s.z);
    col = mix(col, g, smoothstep(1.5, -0.8, d));
  }
  return col;
}

// A plain hash, not interleaved-gradient noise: IGN has a regular
// structure that turns into a visible mesh once the canvas is scaled up.
float grainNoise(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

float igNoise(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

void main() {
  vec2 pos = vec2(gl_FragCoord.x, canvasH - gl_FragCoord.y);
  // the canvas may be rendered smaller than the screen and scaled up; all
  // the world below is in screen points
  vec2 p = pos / viewScale;
  if (glassOn < 0.5) {
    // sparks are drawn natively above the porcelain surfaces. The room is
    // quiet: mostly the plain air colour, the drifting light only a whisper
    vec3 air0 = mix(air, atmosphere(rippled(p), 0.0), 0.3);
    vec2 vg = (p / res - 0.5) * vec2(0.9, 1.1);
    air0 *= 1.0 - dot(vg, vg) * (0.05 + night * 0.12);
    float g0 = grainNoise(floor(pos) + floor(time * 0.024) * vec2(37.0, 17.0)) - 0.5;
    gl_FragColor = vec4(air0 + g0 * (0.006 + night * 0.005), 1.0); return;
  }
  vec3 col = baseLayer(p);

  // beads and controls resting on the sheets: they cast shadows onto the
  // glass below and look through it, bent by their own lens
  vec4 s = upperCount > 0.5 ? surfaces(p, 1.0) : vec4(1000.0, 0.0, 0.0, 0.0);
  float d = s.x;
  if (d < 120.0) {
    if (d > -1.5) {
      float sh = shadowAt(p, 1.0);
      col = mix(col, col * mix(vec3(1.0), shade, 0.5) * 0.86, sh * 0.8);
    }
    if (d < 1.5) {
      vec2 n = normalAt(p, d, 1.0);
      float edge = 1.0 - clamp(-d / 18.0, 0.0, 1.0);
      float bend = edge * edge * (0.6 + 0.4 * edge);
      vec3 g = quality > 0.5 ? baseLayer(p - n * bend * 14.0) : col;
      g = mix(g, milk, clamp(0.12 + glassStrength * 0.5 * edge + s.y * 0.72, 0.0, 0.92));
      g = lightGlass(g, n, d, edge, bend, s.y, s.z);
      col = mix(col, g, smoothstep(1.5, -0.8, d));
    }
  }

  // sparks: core, halo, bloom and a faint horizontal streak
  for (int i = 0; i < 4; i++) {
    vec4 k = sparks[i];
    if (k.z < 0.001) continue;
    vec2 dv = p - k.xy;
    float r2 = dot(dv, dv);
    float rr = k.w * k.w;
    float core = exp(-r2 / rr);
    float glow = core + 0.40 * exp(-r2 / (rr * 9.0)) + 0.14 * exp(-r2 / (rr * 70.0));
    float streak = exp(-(dv.x * dv.x) / (rr * 500.0) - (dv.y * dv.y) / (rr * 0.7)) * 0.10;
    vec3 tint = mix(sparkColor, vec3(1.0, 0.985, 0.96), clamp(core * 1.4, 0.0, 1.0));
    col += tint * (glow + streak) * k.z;
  }

  // film grain + dither
  vec2 gp = floor(pos);
  float grain = grainNoise(gp + floor(time * 0.024) * vec2(37.0, 17.0)) - 0.5;
  col += grain * (0.007 + night * 0.006);
  gl_FragColor = vec4(col, 1.0); return;
}
