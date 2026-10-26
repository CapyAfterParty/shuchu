// The design system in one place: two atmospheres, one type scale,
// one set of motion curves. Every screen draws from here.

export type Rgb = readonly [number, number, number];

export interface Palette {
  name: 'mist' | 'night';
  /** Base air colour behind everything. */
  air: Rgb;
  /** The drifting light sources of the backdrop, back to front. */
  blobs: readonly Rgb[];
  /** What frosted glass leans towards. */
  milk: Rgb;
  /** Shade cast under glass. */
  shade: Rgb;
  /** The one warm accent. */
  spark: Rgb;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  hair: string;
  /** Text that sits on the spark-lit bead. */
  onSpark: string;
  statusBar: 'dark' | 'light';
  glassStrength: number; // how milky glass is (0 = clear)
  shadowStrength: number;
}

const hex = (h: string): Rgb => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export const mist: Palette = {
  name: 'mist',
  air: hex('#D9E2EB'),
  blobs: [
    hex('#AFC4D9'), // icy blue
    hex('#F4F6F8'), // milk
    hex('#7E95AE'), // deep slate
    hex('#E7BFA4'), // warmth bleeding through
    hex('#5C6D82'), // a figure's shadow, out of focus
    hex('#FFFFFF'), // window light
  ],
  milk: hex('#F3F7FB'),
  shade: hex('#3A5272'),
  spark: hex('#FFB27E'),
  ink: '#17212C',
  inkSoft: 'rgba(23,33,44,0.58)',
  inkFaint: 'rgba(23,33,44,0.32)',
  hair: 'rgba(23,33,44,0.14)',
  onSpark: '#3B2A20',
  statusBar: 'dark',
  glassStrength: 0.2,
  shadowStrength: 0.26,
};

export const night: Palette = {
  name: 'night',
  air: hex('#0C1219'),
  blobs: [
    hex('#24384F'),
    hex('#3E4E62'),
    hex('#131E2B'),
    hex('#5E4234'),
    hex('#05080C'),
    hex('#8FA6BF'),
  ],
  milk: hex('#9DB0C6'),
  shade: hex('#000000'),
  spark: hex('#FFA466'),
  ink: '#EEF3F8',
  inkSoft: 'rgba(238,243,248,0.62)',
  inkFaint: 'rgba(238,243,248,0.34)',
  hair: 'rgba(238,243,248,0.13)',
  onSpark: '#2A1B12',
  statusBar: 'light',
  glassStrength: 0.08,
  shadowStrength: 0.55,
};

/** Type: ultra-thin sans for information, a soft italic serif for the human moments. */
export const font = {
  thin: 'Urbanist_200ExtraLight',
  light: 'Urbanist_300Light',
  regular: 'Urbanist_400Regular',
  medium: 'Urbanist_500Medium',
  lightItalic: 'Urbanist_300Light_Italic',
  thinItalic: 'Urbanist_200ExtraLight_Italic',
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
} as const;

export const type = {
  numeral: { fontFamily: font.thin, fontSize: 80, letterSpacing: -3.5, lineHeight: 86 },
  display: { fontFamily: font.serifItalic, fontSize: 36, lineHeight: 40, letterSpacing: -0.5 },
  title: { fontFamily: font.light, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  thought: { fontFamily: font.thin, fontSize: 28, lineHeight: 35, letterSpacing: -0.4 },
  body: { fontFamily: font.light, fontSize: 17, lineHeight: 23, letterSpacing: -0.1 },
  label: { fontFamily: font.regular, fontSize: 16, lineHeight: 20, letterSpacing: 0 },
  whisper: { fontFamily: font.lightItalic, fontSize: 14, lineHeight: 19, letterSpacing: 0.1 },
  caps: { fontFamily: font.medium, fontSize: 11, lineHeight: 14, letterSpacing: 1.4 },
} as const;

/** Space: one 4-point grid. Screens breathe at `gutter`, sections at `section`. */
export const space = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
  section: 40,
  gutter: 24,
} as const;

/** Motion: nothing snaps, nothing wobbles for long. Critically damped by default. */
export const spring = {
  /** Glass settling into place. */
  settle: { damping: 24, stiffness: 160, mass: 1 },
  /** A single soft wobble after a touch. */
  jelly: { damping: 12, stiffness: 300, mass: 0.7 },
  /** Quick but soft response to a finger. */
  touch: { damping: 20, stiffness: 420, mass: 0.6 },
  /** Big surfaces, sheets and screens. */
  sheet: { damping: 28, stiffness: 220, mass: 1 },
  /** Falling pebbles. */
  drop: { damping: 13, stiffness: 140, mass: 1 },
} as const;

export const duration = { whisper: 600, melt: 800, breath: 5200 } as const;
