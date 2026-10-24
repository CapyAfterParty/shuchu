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
  numeral: { fontFamily: font.thin, fontSize: 88, letterSpacing: -4, lineHeight: 92 },
  display: { fontFamily: font.serifItalic, fontSize: 40, lineHeight: 44, letterSpacing: -0.6 },
  title: { fontFamily: font.light, fontSize: 26, lineHeight: 32, letterSpacing: -0.4 },
  thought: { fontFamily: font.thin, fontSize: 30, lineHeight: 37, letterSpacing: -0.5 },
  body: { fontFamily: font.light, fontSize: 18, lineHeight: 25, letterSpacing: -0.1 },
  label: { fontFamily: font.regular, fontSize: 15, lineHeight: 20, letterSpacing: 0 },
  whisper: { fontFamily: font.lightItalic, fontSize: 14, lineHeight: 19, letterSpacing: 0.15 },
  caps: { fontFamily: font.regular, fontSize: 11, lineHeight: 14, letterSpacing: 1.6 },
} as const;

/** Motion: nothing snaps. Springs are tuned to feel heavy, wet and calm. */
export const spring = {
  /** Glass settling into place. */
  settle: { damping: 22, stiffness: 140, mass: 1.1 },
  /** Liquid wobble after a touch. */
  jelly: { damping: 9, stiffness: 260, mass: 0.7 },
  /** Quick but soft response to a finger. */
  touch: { damping: 18, stiffness: 420, mass: 0.6 },
  /** Big surfaces, sheets and screens. */
  sheet: { damping: 26, stiffness: 180, mass: 1.2 },
  /** Falling pebbles. */
  drop: { damping: 11, stiffness: 120, mass: 1 },
} as const;

export const duration = { whisper: 900, melt: 1100, breath: 5200 } as const;
