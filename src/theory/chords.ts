import {
  displayName, intervalBetween, intervalLabel, intervalName, noteName, parseFormula, pcOf, transpose,
  type Interval, type Note,
} from "./pitch";
import { degreeLabel, harmonyOf, type Degree, type Key } from "./scales";

/** `upper: null` means the numeral's case carries no meaning (sus chords, power chords). */
interface QualitySource {
  readonly symbol: string;
  readonly formula: string;
  readonly optional: string;
  readonly roman: { readonly upper: boolean | null; readonly suffix: string };
  readonly kind: "triad" | "color";
}

const QUALITY_SOURCE = {
  maj: { symbol: "", formula: "1 3 5", optional: "", roman: { upper: true, suffix: "" }, kind: "triad" },
  min: { symbol: "m", formula: "1 b3 5", optional: "", roman: { upper: false, suffix: "" }, kind: "triad" },
  dim: { symbol: "dim", formula: "1 b3 b5", optional: "", roman: { upper: false, suffix: "°" }, kind: "triad" },
  aug: { symbol: "aug", formula: "1 3 #5", optional: "", roman: { upper: true, suffix: "+" }, kind: "triad" },
  "5": { symbol: "5", formula: "1 5", optional: "", roman: { upper: null, suffix: "5" }, kind: "color" },
  sus2: { symbol: "sus2", formula: "1 2 5", optional: "", roman: { upper: null, suffix: "sus2" }, kind: "color" },
  sus4: { symbol: "sus4", formula: "1 4 5", optional: "", roman: { upper: null, suffix: "sus4" }, kind: "color" },
  add9: { symbol: "add9", formula: "1 3 5 9", optional: "5", roman: { upper: true, suffix: "add9" }, kind: "color" },
  madd9: { symbol: "madd9", formula: "1 b3 5 9", optional: "5", roman: { upper: false, suffix: "add9" }, kind: "color" },
  add11: { symbol: "add11", formula: "1 3 5 11", optional: "5", roman: { upper: true, suffix: "add11" }, kind: "color" },
  "6": { symbol: "6", formula: "1 3 5 6", optional: "5", roman: { upper: true, suffix: "6" }, kind: "color" },
  m6: { symbol: "m6", formula: "1 b3 5 6", optional: "5", roman: { upper: false, suffix: "6" }, kind: "color" },
  maj7: { symbol: "maj7", formula: "1 3 5 7", optional: "5", roman: { upper: true, suffix: "maj7" }, kind: "color" },
  m7: { symbol: "m7", formula: "1 b3 5 b7", optional: "5", roman: { upper: false, suffix: "7" }, kind: "color" },
  "7": { symbol: "7", formula: "1 3 5 b7", optional: "5", roman: { upper: true, suffix: "7" }, kind: "color" },
  m7b5: { symbol: "m7♭5", formula: "1 b3 b5 b7", optional: "", roman: { upper: false, suffix: "ø7" }, kind: "color" },
  maj9: { symbol: "maj9", formula: "1 3 5 7 9", optional: "5", roman: { upper: true, suffix: "maj9" }, kind: "color" },
  m9: { symbol: "m9", formula: "1 b3 5 b7 9", optional: "5", roman: { upper: false, suffix: "9" }, kind: "color" },
  maj7s11: { symbol: "maj7♯11", formula: "1 3 5 7 #11", optional: "5", roman: { upper: true, suffix: "maj7#11" }, kind: "color" },
} as const satisfies Record<string, QualitySource>;

export type QualityId = keyof typeof QUALITY_SOURCE;

export interface QualityDef {
  readonly id: QualityId;
  readonly symbol: string;
  /** From the root, root first. */
  readonly intervals: readonly Interval[];
  /** Tones the voicing generator may drop (the 5th, mostly). */
  readonly optional: readonly Interval[];
  readonly roman: QualitySource["roman"];
  readonly kind: "triad" | "color";
}

/**
 * Adding a row here makes the quality appear wherever it is diatonic, in the
 * Roman-numeral grammar, and in the voicing generator's required tones.
 */
export const QUALITIES = Object.fromEntries(
  Object.entries(QUALITY_SOURCE).map(([id, q]) => [
    id,
    {
      id,
      symbol: q.symbol,
      intervals: parseFormula(q.formula),
      optional: q.optional ? parseFormula(q.optional) : [],
      roman: q.roman,
      kind: q.kind,
    },
  ]),
) as { readonly [K in QualityId]: QualityDef };

export const QUALITY_IDS = Object.keys(QUALITIES) as QualityId[];

/** A spelled root and a quality. Bass and inversion belong to a voicing. */
export interface Chord {
  readonly root: Note;
  readonly quality: QualityId;
}

/** Stable identity for memo maps and React keys: "Eb:maj7". */
export function chordKey(c: Chord): string {
  return `${noteName(c.root)}:${c.quality}`;
}

export function chordName(c: Chord): string {
  return displayName(c.root) + QUALITIES[c.quality].symbol;
}

export interface ChordTone {
  readonly note: Note;
  readonly role: Interval;
}

/** Spelled tones with the interval each plays in the chord. */
export function chordTones(c: Chord): readonly ChordTone[] {
  return QUALITIES[c.quality].intervals.map((role) => ({ note: transpose(c.root, role), role }));
}

export interface DegreeHarmony {
  readonly degree: Degree;
  readonly triad: Chord;
  /** Every color quality whose tones are all scale tones. */
  readonly colors: readonly Chord[];
}

const TRIAD_BY_SEMIS: Record<string, QualityId> = { "4,7": "maj", "3,7": "min", "3,6": "dim", "4,8": "aug" };

const harmonyCache = new WeakMap<Key, readonly DegreeHarmony[]>();

export function diatonicChords(key: Key): readonly DegreeHarmony[] {
  const hit = harmonyCache.get(key);
  if (hit) return hit;
  const h = harmonyOf(key);
  const scalePcs = new Set(h.notes.map(pcOf));
  const colorIds = QUALITY_IDS.filter((id) => QUALITIES[id].kind === "color");
  const rows = h.notes.map((root, d): DegreeHarmony => {
    const third = intervalBetween(root, h.notes[(d + 2) % 7]!);
    const fifth = intervalBetween(root, h.notes[(d + 4) % 7]!);
    const quality = TRIAD_BY_SEMIS[`${third.semis},${fifth.semis}`];
    if (!quality) throw new Error(`no triad for ${third.semis},${fifth.semis} in ${h.name}`);
    const colors = colorIds
      .filter((id) => QUALITIES[id].intervals.every((iv) => scalePcs.has(pcOf(transpose(root, iv)))))
      .map((id): Chord => ({ root, quality: id }));
    return { degree: (d + 1) as Degree, triad: { root, quality }, colors };
  });
  harmonyCache.set(key, rows);
  return rows;
}

export function isDiatonic(c: Chord, key: Key): boolean {
  const h = harmonyOf(key);
  const pcs = new Set(h.notes.map(pcOf));
  return chordTones(c).every((t) => pcs.has(pcOf(t.note)));
}

export interface ChordExplanation {
  /** Neighbouring tones, low to high: "D to F♯: major 3rd". */
  readonly stack: readonly { readonly from: Note; readonly to: Note; readonly interval: string }[];
  readonly tones: readonly {
    readonly note: Note;
    readonly role: string;
    readonly interval: string;
    readonly degree: string;
    readonly inScale: boolean;
  }[];
  readonly borrowed: boolean;
}

export function explainChord(c: Chord, key: Key): ChordExplanation {
  const h = harmonyOf(key);
  const tones = chordTones(c);
  const stack = tones.slice(1).map((t, i) => {
    const from = tones[i]!;
    return {
      from: from.note,
      to: t.note,
      interval: intervalName({ steps: t.role.steps - from.role.steps, semis: t.role.semis - from.role.semis }),
    };
  });
  const rows = tones.map((t) => {
    const d = degreeLabel(h, pcOf(t.note));
    return {
      note: t.note,
      role: intervalLabel(t.role),
      interval: intervalName(t.role),
      degree: d.label,
      inScale: d.inScale,
    };
  });
  return { stack, tones: rows, borrowed: rows.some((r) => !r.inScale) };
}
