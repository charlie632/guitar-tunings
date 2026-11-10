import {
  displayName, midiOf, natural, parseNote, pc, pcOf, pitchName, type Brand, type Midi, type Pitch, type Result,
} from "./pitch";
import { keyOf, type Key } from "./scales";

export type Capo = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export function asCapo(n: number): Capo {
  return Math.min(12, Math.max(0, Math.round(n))) as Capo;
}

/** Fret counted from the capo (capo = nut = 0). Voicings and chord diagrams use this. */
export type Fret = Brand<number, "Fret">;
/** Fret counted from the real nut. Only the full-neck fretboard uses this. */
export type BoardFret = Brand<number, "BoardFret">;
/** 0 = lowest-pitched string. */
export type StringIndex = number;

export const BOARD_FRETS = 15;

export type Tuning = Brand<{ readonly strings: readonly Pitch[]; readonly label: string }, "Tuning">;

export type TuningError =
  | { readonly kind: "empty" }
  | { readonly kind: "badToken"; readonly token: string }
  | { readonly kind: "stringCount"; readonly count: number };

const SEPARATORS = /[\s,.\-/|]/;
const TOKEN = /([A-Ga-g])([#b♯♭]*)(-?\d+)?/y;
const LOW_BOUND = 35;
const HIGH_BOUND = 46;

/**
 * Boundary parser for user text and URL params. Accepts "DADF#Ae", "D A D F# A E"
 * and "D2 A2 D3 F#3 A3 E4". A "b" right after a letter is a flat.
 * Strings without an octave get the lowest pitch above the previous string,
 * and the first one lands between B1 and A#2.
 */
export function parseTuning(text: string): Result<Tuning, TuningError> {
  const r = parseStrings(text);
  return r.ok ? { ok: true, value: makeTuning(r.value) } : r;
}

function parseStrings(text: string): Result<readonly Pitch[], TuningError> {
  const notes: { note: Pitch["note"]; octave: number | null }[] = [];
  let i = 0;
  while (i < text.length) {
    if (SEPARATORS.test(text[i]!)) {
      i++;
      continue;
    }
    TOKEN.lastIndex = i;
    const m = TOKEN.exec(text);
    const parsed = m ? parseNote(m[0]) : null;
    if (!m || !parsed || !parsed.ok) return { ok: false, error: { kind: "badToken", token: m ? m[0] : text[i]! } };
    notes.push(parsed.value);
    i = TOKEN.lastIndex;
  }
  if (notes.length === 0) return { ok: false, error: { kind: "empty" } };
  if (notes.length < 4 || notes.length > 8) return { ok: false, error: { kind: "stringCount", count: notes.length } };

  const strings: Pitch[] = [];
  for (const { note, octave } of notes) {
    if (octave !== null) {
      strings.push({ note, octave });
      continue;
    }
    const prev = strings.length ? midiOf(strings[strings.length - 1]!) : null;
    let m = LOW_BOUND + (((pcOf(note) - LOW_BOUND) % 12) + 12) % 12;
    if (prev === null) {
      if (m > HIGH_BOUND) m -= 12;
    } else {
      while (m <= prev) m += 12;
    }
    strings.push({ note, octave: (m - natural(note.letter) - note.alter) / 12 - 1 });
  }
  return { ok: true, value: strings };
}

function makeTuning(strings: readonly Pitch[]): Tuning {
  const preset = PRESETS.find((p) => sameStrings(p.strings, strings));
  const label = preset ? preset.name : strings.map((s) => displayName(s.note)).join(" ");
  return { strings, label } as Tuning;
}

function sameStrings(a: readonly Pitch[], b: readonly Pitch[]): boolean {
  return a.length === b.length && a.every((p, i) => midiOf(p) === midiOf(b[i]!));
}

export function describeTuningError(e: TuningError): string {
  switch (e.kind) {
    case "empty":
      return "Enter 4 to 8 notes, low string first, like D A D F# A E.";
    case "badToken":
      return `"${e.token}" is not a note. Use letters A to G with optional # or b.`;
    case "stringCount":
      return `Found ${e.count} strings. Tunings need 4 to 8.`;
  }
}

const PRESET_SOURCE = {
  standard: { name: "Standard", pitches: "E2 A2 D3 G3 B3 E4" },
  dropD: { name: "Drop D", pitches: "D2 A2 D3 G3 B3 E4" },
  daeacse: { name: "DAEAC♯e", pitches: "D2 A2 E3 A3 C#4 E4" },
  dadfsae: { name: "DADF♯Ae", pitches: "D2 A2 D3 F#3 A3 E4" },
  dadfsad: { name: "DADF♯AD", pitches: "D2 A2 D3 F#3 A3 D4" },
  dadgad: { name: "DADGAD", pitches: "D2 A2 D3 G3 A3 D4" },
  facgce: { name: "FACGCE", pitches: "F2 A2 C3 G3 C4 E4" },
  dacgce: { name: "DACGCe", pitches: "D2 A2 C3 G3 C4 E4" },
} as const;

export type TuningId = keyof typeof PRESET_SOURCE;

const PRESETS = Object.entries(PRESET_SOURCE).map(([id, p]) => {
  const r = parseStrings(p.pitches);
  if (!r.ok) throw new Error(`bad preset ${id}`);
  return { id: id as TuningId, name: p.name, strings: r.value };
});

/** Built through the same parser as typed input, so a preset and a typed tuning are one type. */
export const TUNINGS = Object.fromEntries(
  PRESETS.map((p) => [p.id, { name: p.name, tuning: { strings: p.strings, label: p.name } as Tuning }]),
) as { readonly [K in TuningId]: { readonly name: string; readonly tuning: Tuning } };

export const TUNING_IDS = Object.keys(TUNINGS) as TuningId[];

/** Pitches as parseable text with octaves: round-trips through `parseTuning`. */
export function tuningText(t: Tuning): string {
  return t.strings.map(pitchName).join(" ");
}

export interface Instrument {
  readonly tuning: Tuning;
  readonly capo: Capo;
  /** Sounding open pitch of each string with the capo on. */
  readonly open: readonly Midi[];
  readonly maxFret: Fret;
}

export function instrument(tuning: Tuning, capo: Capo): Instrument {
  return {
    tuning,
    capo,
    open: tuning.strings.map((s) => (midiOf(s) + capo) as Midi),
    maxFret: (BOARD_FRETS - capo) as Fret,
  };
}

/** The only place a capo-relative fret becomes a board fret. */
export function toBoard(ins: Instrument, f: Fret): BoardFret {
  return (f + ins.capo) as BoardFret;
}

export function soundingAt(ins: Instrument, s: StringIndex, f: Fret): Midi {
  return (ins.open[s]! + f) as Midi;
}

/** What the hands play for a key that sounds as `sounding` under the capo. */
export function shapeKey(sounding: Key, capo: Capo): Key {
  return keyOf(pc(pcOf(sounding.tonic) - capo), sounding.scale.id);
}

/** What sounds when the hands play `shape` with the capo on. */
export function soundingKey(shape: Key, capo: Capo): Key {
  return keyOf(pc(pcOf(shape.tonic) + capo), shape.scale.id);
}
