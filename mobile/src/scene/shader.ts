// The whole world of Shuchu is one fragment shader.
//
// 1. Atmosphere: soft light sources drifting behind frosted air, with a few
//    out-of-focus glass stones far away. Evaluated analytically, so blurring
//    it is free (a blurred gaussian is just a wider gaussian).
// 2. Glass: up to 32 rounded, slightly living shapes, melted together with a
//    smooth union so nearby surfaces flow into each other like liquid.
//    Inside, the atmosphere is re-sampled through a lens: bent at the rim,
//    split into red, green and blue, frosted, and lit by a light that moves
//    as you tilt the phone (specular glint, lit rim, focused caustic on the
//    far edge, darker thick edge away from the light).
// 3. Shadows the glass casts away from the light, ripples when something
//    lands, and the warm sparks that pull the eye.
// 4. Film grain and dithering, so gradients never band.

export const SLOTS = 32;
export const SPARKS = 4;
export const RIPPLES = 3;

export const sceneShader = /* glsl */ `
uniform float2 res;
uniform float time;
uniform float density;
uniform float2 light;      // unit direction towards the light, screen space
uniform float2 tilt;       // parallax, -1..1
uniform float haze;        // 0..1 deepens the depth of field behind sheets
uniform float quality;     // 1 = full, 0 = lighter path for slower phones
uniform float shapeCount;  // live shapes, packed at the front of the arrays
uniform float upperCount;  // how many of them rest on sheets (layer 1)

uniform float3 air;
uniform float3 b0; uniform float3 b1; uniform float3 b2;
uniform float3 b3; uniform float3 b4; uniform float3 b5;
uniform float3 milk;
uniform float3 shade;
uniform float3 sparkColor;
uniform float glassStrength;
uniform float shadowStrength;
uniform float night;

uniform float4 shapeA[${SLOTS}]; // cx, cy, half width, half height
uniform float4 shapeB[${SLOTS}]; // corner radius, presence, melt, lift
uniform float4 shapeC[${SLOTS}]; // squash x, squash y, wobble, seed
uniform float4 shapeD[${SLOTS}]; // pearl (milky), warmth, layer, unused
uniform float4 sparks[${SPARKS}]; // x, y, intensity, radius
uniform float4 ripples[${RIPPLES}]; // x, y, age (s), strength

float gauss(float2 p, float2 c, float s, float blur) {
  float2 d = p - c;
  float v = s * s + blur * blur;
  return exp(-dot(d, d) / (2.0 * v)) * (s * s / v);
}

float stoneMask(float2 p, float2 c, float r, float soft) {
  return 1.0 - smoothstep(r - soft, r + soft, length(p - c));
}

float3 atmosphere(float2 p, float blur) {
  float u = res.y;
  float t = time * 0.001;
  blur += haze * 34.0;
  float2 par = tilt * u * 0.035;

  float3 col = air;
  float2 c0 = float2(0.14 + 0.05 * sin(t * 0.050), 0.20 + 0.04 * cos(t * 0.041)) * res + par * 0.6;
  float2 c1 = float2(0.86 + 0.04 * cos(t * 0.046), 0.14 + 0.05 * sin(t * 0.037)) * res + par * 0.8;
  float2 c2 = float2(0.28 + 0.06 * sin(t * 0.033 + 2.0), 0.96 + 0.03 * cos(t * 0.029)) * res + par * 0.5;
  float2 c3 = float2(0.64 + 0.07 * cos(t * 0.039 + 1.0), 0.36 + 0.06 * sin(t * 0.044 + 3.0)) * res + par * 1.1;
  float2 c4 = float2(0.50 + 0.05 * sin(t * 0.027 + 4.0), 0.58 + 0.05 * cos(t * 0.031 + 1.5)) * res + par * 1.4;
  float2 c5 = float2(0.98 + 0.03 * sin(t * 0.035), 0.78 + 0.05 * cos(t * 0.043 + 2.5)) * res + par * 0.7;

  col = mix(col, b0, 0.92 * gauss(p, c0, 0.44 * u, blur));
  col = mix(col, b1, 0.95 * gauss(p, c1, 0.36 * u, blur));
  col = mix(col, b2, 0.88 * gauss(p, c2, 0.40 * u, blur));
  col = mix(col, b3, 0.78 * gauss(p, c3, 0.17 * u, blur));
  // an out-of-focus figure: elongated shadow
  float2 q = p - c4; q.x *= 1.7;
  col = mix(col, b4, 0.42 * gauss(q + c4, c4, 0.15 * u, blur));
  col = mix(col, b5, 0.65 * gauss(p, c5, 0.16 * u, blur));

  // distant glass stones, far out of focus, drifting
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float2 sc = float2(0.18 + 0.62 * fract(fi * 0.618 + 0.11), 0.16 + 0.70 * fract(fi * 0.382 + 0.07)) * res;
    sc += float2(sin(t * (0.06 + fi * 0.013) + fi * 2.1), cos(t * (0.05 + fi * 0.011) + fi)) * u * 0.03;
    sc += par * (1.8 + fi * 0.5);
    float r = u * (0.055 + 0.03 * fi);
    float soft = 10.0 + fi * 6.0 + blur * 0.9;
    float m = stoneMask(p, sc, r, soft);
    float hl = gauss(p, sc + float2(-0.35, -0.45) * r, r * 0.45, soft * 0.6);
    col = mix(col, mix(col, milk, 0.4), m * 0.45);
    col = mix(col, milk, hl * 0.22 * (1.0 - night * 0.5));
  }

  // a gentle vignette keeps the eye in the middle
  float2 v = (p / res - 0.5) * float2(0.9, 1.1);
  col *= 1.0 - dot(v, v) * (0.10 + night * 0.25);
  return col;
}

float2 rippled(float2 p) {
  for (int i = 0; i < ${RIPPLES}; i++) {
    float4 r = ripples[i];
    if (r.w < 0.001) continue;
    float2 d = p - r.xy;
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

float roundBox(float2 p, float2 b, float r) {
  float2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// d, pearl, warmth, lift of the surfaces in one layer.
// Layer 0 rests on the atmosphere; layer 1 (controls on sheets) rests on layer 0.
float4 surfaces(float2 p, float layer) {
  float d = 100000.0;
  float3 acc = float3(0.0);
  float wsum = 0.0;
  float t = time * 0.001;
  for (int i = 0; i < ${SLOTS}; i++) {
    if (float(i) >= shapeCount) break;
    float4 a = shapeA[i];
    float4 b = shapeB[i];
    if (b.y < 0.002 || abs(shapeD[i].z - layer) > 0.5) continue;
    float4 c = shapeC[i];
    float2 q = (p - a.xy) / c.xy;
    float2 hs = a.zw * b.y;
    float di = roundBox(q, hs, min(b.x * b.y, min(hs.x, hs.y))) * min(c.x, c.y);
    if (c.z > 0.0 && di < 60.0) {
      float2 n = q / (length(q) + 0.001);
      di += c.z * smoothstep(60.0, 20.0, di) * (n.x * n.y * sin(t * 0.55 + c.w * 6.2831)
                  + (n.x * n.x - n.y * n.y) * 0.5 * cos(t * 0.42 + c.w * 4.1));
    }
    d = smin(d, di, b.z);
    // blend materials smoothly between neighbours, so melted shapes have no
    // seams; inside overlapping shapes the innermost one (a bead on its
    // track) owns the material
    float w = di < 0.0 ? exp(max(di, -60.0) / 7.0) : exp(-min(di, 120.0) / 2.5);
    acc += w * float3(shapeD[i].x, shapeD[i].y, b.w);
    wsum += w;
  }
  acc /= max(wsum, 0.000001);
  return float4(d, acc);
}

// Each surface casts its own shadow, offset by its own height.
float shadowAt(float2 p, float layer) {
  float lit = 1.0;
  for (int i = 0; i < ${SLOTS}; i++) {
    if (float(i) >= shapeCount) break;
    float4 a = shapeA[i];
    float4 b = shapeB[i];
    if (b.y < 0.002 || abs(shapeD[i].z - layer) > 0.5) continue;
    float4 c = shapeC[i];
    float lift = b.w;
    float2 off = -light * (7.0 + lift * 16.0) + float2(0.0, 5.0 + lift * 12.0);
    float2 q = (p - off - a.xy) / c.xy;
    float2 hs = a.zw * b.y;
    float ds = roundBox(q, hs, min(b.x * b.y, min(hs.x, hs.y))) * min(c.x, c.y);
    float sh = (1.0 - smoothstep(-10.0, 30.0 + lift * 34.0, ds)) * (0.55 + lift * 0.55);
    lit *= 1.0 - clamp(sh, 0.0, 1.0) * shadowStrength;
  }
  return 1.0 - lit;
}

float2 normalAt(float2 p, float d, float layer) {
  float e = 1.4;
  float2 n = float2(surfaces(p + float2(e, 0.0), layer).x - d, surfaces(p + float2(0.0, e), layer).x - d);
  return n / (length(n) + 0.0001);
}

// Light on a glass body. g is what is seen through it.
float3 lightGlass(float3 g, float2 n, float d, float edge, float bend, float pearl, float warm) {
  g = mix(g, mix(milk, sparkColor, 0.55), warm * 0.4);

  float3 N = normalize(float3(n * bend * 1.9, 1.0));
  float3 L = normalize(float3(light, 0.7));
  g *= 0.93 + 0.12 * dot(N, L);

  float lit = max(dot(n, light), 0.0);
  float away = max(dot(n, -light), 0.0);
  float3 R = reflect(-L, N);
  float spec = pow(max(R.z, 0.0), 90.0);
  g += float3(1.0) * spec * 0.95;
  // a broad wet sheen, and a second, warmer glint from light bouncing back
  // up from below: the twin highlights of a drop of water
  g += milk * pow(max(R.z, 0.0), 10.0) * 0.10 * (1.0 - night * 0.4);
  float3 L2 = normalize(float3(-light * 0.7, 0.75));
  float spec2 = pow(max(reflect(-L2, N).z, 0.0), 70.0);
  g += mix(float3(1.0), sparkColor, 0.35) * spec2 * 0.38;
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
  return mix(g, float3(1.0), rim * (0.18 + 0.62 * lit) * (0.85 - night * 0.35));
}

// The first layer, complete: atmosphere, its shadows and its glass.
float3 baseLayer(float2 p) {
  float4 s = surfaces(p, 0.0);
  float d = s.x;
  float3 col = atmosphere(rippled(p), 0.0);

  if (d > -1.5 && d < 170.0) {
    float sh = shadowAt(p, 0.0);
    col = mix(col, col * mix(float3(1.0), shade, 0.55) * 0.82, sh);
    // light scattered just outside the rim
    col += milk * exp(-max(d, 0.0) / 10.0) * 0.06 * (1.0 - night * 0.5);
  }

  if (d < 1.5) {
    float2 n = normalAt(p, d, 0.0);
    float edge = 1.0 - clamp(-d / 30.0, 0.0, 1.0);
    float bend = edge * edge * (0.6 + 0.4 * edge);
    float2 off = -n * bend * 42.0;
    float frost = 15.0;
    float3 g;
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

float igNoise(float2 p) {
  return fract(52.9829189 * fract(dot(p, float2(0.06711056, 0.00583715))));
}

half4 main(float2 p) {
  float3 col = baseLayer(p);

  // beads and controls resting on the sheets: they cast shadows onto the
  // glass below and look through it, bent by their own lens
  float4 s = upperCount > 0.5 ? surfaces(p, 1.0) : float4(1000.0, 0.0, 0.0, 0.0);
  float d = s.x;
  if (d < 120.0) {
    if (d > -1.5) {
      float sh = shadowAt(p, 1.0);
      col = mix(col, col * mix(float3(1.0), shade, 0.5) * 0.86, sh * 0.8);
    }
    if (d < 1.5) {
      float2 n = normalAt(p, d, 1.0);
      float edge = 1.0 - clamp(-d / 18.0, 0.0, 1.0);
      float bend = edge * edge * (0.6 + 0.4 * edge);
      float3 g = quality > 0.5 ? baseLayer(p - n * bend * 14.0) : col;
      g = mix(g, milk, clamp(0.12 + glassStrength * 0.5 * edge + s.y * 0.72, 0.0, 0.92));
      g = lightGlass(g, n, d, edge, bend, s.y, s.z);
      col = mix(col, g, smoothstep(1.5, -0.8, d));
    }
  }

  // sparks: core, halo, bloom and a faint horizontal streak
  for (int i = 0; i < ${SPARKS}; i++) {
    float4 k = sparks[i];
    if (k.z < 0.001) continue;
    float2 dv = p - k.xy;
    float r2 = dot(dv, dv);
    float rr = k.w * k.w;
    float core = exp(-r2 / rr);
    float glow = core + 0.40 * exp(-r2 / (rr * 9.0)) + 0.14 * exp(-r2 / (rr * 70.0));
    float streak = exp(-(dv.x * dv.x) / (rr * 500.0) - (dv.y * dv.y) / (rr * 0.7)) * 0.10;
    float3 tint = mix(sparkColor, float3(1.0, 0.985, 0.96), clamp(core * 1.4, 0.0, 1.0));
    col += tint * (glow + streak) * k.z;
  }

  // film grain + dither
  float2 gp = floor(p * density);
  float grain = igNoise(gp + floor(time * 0.024) * float2(37.0, 17.0)) - 0.5;
  col += grain * (0.018 + night * 0.012);
  return half4(col, 1.0);
}
`;
