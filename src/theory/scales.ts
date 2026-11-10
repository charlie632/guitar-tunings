import {
  displayName, intervalLabel, parseFormula, pc, pcOf, spellPc, transpose,
  type Accidental, type Interval, type Note, type Pc,
} from "./pitch";

const SCALE_SOURCE = {
  major: {
    name: "Major", formula: "1 2 3 4 5 6 7",
    feel: "Bright and resolved. The home of pop-punk and twinkly emo.",
  },
  minor: {
    name: "Natural minor", formula: "1 2 b3 4 5 b6 b7",
    feel: "Sad and heavy without sounding classical.",
  },
  dorian: {
    name: "Dorian", formula: "1 2 b3 4 5 6 b7",
    feel: "Minor with a hopeful raised 6th.",
  },
  mixolydian: {
    name: "Mixolydian", formula: "1 2 3 4 5 6 b7",
    feel: "Major with a flat 7: bright but unresolved. Open-string drone riffs live here.",
  },
  lydian: {
    name: "Lydian", formula: "1 2 3 #4 5 6 7",
    feel: "Floating and dreamy. The raised 4th is the shimmer.",
  },
  phrygian: {
    name: "Phrygian", formula: "1 b2 b3 4 5 b6 b7",
    feel: "Dark and tense, pulled down by the flat 2.",
  },
  locrian: {
    name: "Locrian", formula: "1 b2 b3 4 b5 b6 b7",
    feel: "Unstable. The flat 5 means the tonic chord never settles.",
  },
  harmonicMinor: {
    name: "Harmonic minor", formula: "1 2 b3 4 5 b6 7",
    feel: "Minor with a leading tone: dramatic, a little gothic.",
  },
  melodicMinor: {
    name: "Melodic minor", formula: "1 2 b3 4 5 6 7",
    feel: "Minor with bright 6th and 7th. Wistful rather than sad.",
  },
  majorPentatonic: {
    name: "Major pentatonic", formula: "1 2 3 5 6", harmonyFrom: "major",
    feel: "Major with the two tense notes removed. Hard to play wrong.",
  },
  minorPentatonic: {
    name: "Minor pentatonic", formula: "1 b3 4 5 b7", harmonyFrom: "minor",
    feel: "The riff scale: minor without the 2nd and 6th.",
  },
} as const;

type Source = typeof SCALE_SOURCE;
export type ScaleId = keyof Source;
export type HeptatonicId = {
  [K in ScaleId]: Source[K] extends { readonly harmonyFrom: string } ? never : K;
}[ScaleId];

export interface ScaleDef {
  readonly id: ScaleId;
  readonly name: string;
  readonly intervals: readonly Interval[];
  readonly feel: string;
  /** Which seven-note scale supplies chords. A heptatonic scale names itself. */
  readonly harmonyFrom: HeptatonicId;
}

export const SCALES = Object.fromEntries(
  Object.entries(SCALE_SOURCE).map(([id, s]) => [
    id,
    {
      id,
      name: s.name,
      intervals: parseFormula(s.formula),
      feel: s.feel,
      harmonyFrom: "harmonyFrom" in s ? s.harmonyFrom : id,
    },
  ]),
) as { readonly [K in ScaleId]: ScaleDef };

export const SCALE_IDS = Object.keys(SCALES) as ScaleId[];

export function isScaleId(x: string): x is ScaleId {
  return Object.hasOwn(SCALES, x);
}

export type Degree = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Key {
  readonly tonic: Note;
  readonly scale: ScaleDef;
  /** Degree order. 7 notes, or 5 for a pentatonic. */
  readonly notes: readonly Note[];
  /** Spelling used for chromatic tones outside the scale. */
  readonly prefer: Accidental;
  readonly name: string;
}

function build(tonic: Note, scale: ScaleDef): Key {
  const notes = scale.intervals.map((iv) => transpose(tonic, iv));
  const sharps = notes.filter((n) => n.alter > 0).length;
  const flats = notes.filter((n) => n.alter < 0).length;
  const prefer: Accidental = flats > sharps ? "flat" : "sharp";
  return { tonic, scale, notes, prefer, name: `${displayName(tonic)} ${scale.name.toLowerCase().replace(/^natural /, "")}` };
}

const keyCache = new Map<string, Key>();

/**
 * Picks the tonic spelling with the fewest accidentals across the scale,
 * rejecting spellings that need a double accidental. Sharp wins a tie, so pc 6
 * major is F# and pc 1 minor is C#.
 */
export function keyOf(tonic: Pc, scaleId: ScaleId): Key {
  const id = `${tonic}:${scaleId}`;
  const hit = keyCache.get(id);
  if (hit) return hit;
  const scale = SCALES[scaleId];
  const candidates: Note[] = [];
  for (let letter = 0; letter < 7; letter++) {
    for (const alter of [-2, -1, 0, 1, 2]) {
      const note = { letter: letter as Note["letter"], alter };
      if (pcOf(note) === tonic) candidates.push(note);
    }
  }
  const scored = candidates.map((c) => {
    const notes = scale.intervals.map((iv) => transpose(c, iv));
    return {
      c,
      worst: Math.max(...notes.map((x) => Math.abs(x.alter)), Math.abs(c.alter)),
      cost: notes.reduce((a, x) => a + Math.abs(x.alter), 0),
    };
  });
  scored.sort((a, b) => a.worst - b.worst || a.cost - b.cost || b.c.alter - a.c.alter);
  const key = build(scored[0]!.c, scale);
  keyCache.set(id, key);
  return key;
}

export function harmonyOf(key: Key): Key {
  return key.scale.harmonyFrom === key.scale.id ? key : build(key.tonic, SCALES[key.scale.harmonyFrom]);
}

export function spellIn(key: Key, p: Pc): Note {
  return key.notes.find((n) => pcOf(n) === p) ?? spellPc(p, key.prefer);
}

const CHROMATIC = ["1", "♭2", "2", "♭3", "3", "4", "♯4", "5", "♭6", "6", "♭7", "7"];

export interface DegreeInfo {
  readonly label: string;
  readonly inScale: boolean;
  readonly degree: Degree | null;
}

export function degreeLabel(key: Key, p: Pc): DegreeInfo {
  const i = key.notes.findIndex((n) => pcOf(n) === p);
  if (i >= 0) {
    const iv = key.scale.intervals[i]!;
    return { label: intervalLabel(iv), inScale: true, degree: (iv.steps + 1) as Degree };
  }
  return { label: CHROMATIC[pc(p - pcOf(key.tonic))]!, inScale: false, degree: null };
}
