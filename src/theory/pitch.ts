declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/** Pitch class 0..11, C = 0. Construct only through `pc()`. */
export type Pc = Brand<number, "Pc">;
/** Sounding pitch as a MIDI number (E2 = 40). */
export type Midi = Brand<number, "Midi">;

/** C D E F G A B as 0..6. Letter arithmetic is what makes spelling correct. */
export type Letter = 0 | 1 | 2 | 3 | 4 | 5 | 6;
/** Sharps minus flats. Almost always -1..1; `keyOf` rejects spellings that need more. */
export type Alter = number;

export interface Note {
  readonly letter: Letter;
  readonly alter: Alter;
}

/** A spelled note in an octave. Tunings keep the user's spelling (C#4 stays C#4). */
export interface Pitch {
  readonly note: Note;
  readonly octave: number;
}

/**
 * `steps` is the generic size minus one (third = 2, ninth = 8) and `semis` the
 * chromatic size, so b3 = {2,3} and #2 = {1,3} stay distinct values.
 */
export interface Interval {
  readonly steps: number;
  readonly semis: number;
}

export type Accidental = "sharp" | "flat";

const LETTERS = "CDEFGAB";
const NATURAL_PC = [0, 2, 4, 5, 7, 9, 11] as const;
const MAJOR_SEMIS = NATURAL_PC;

export function pc(n: number): Pc {
  return (((n % 12) + 12) % 12) as Pc;
}

export function natural(letter: number): number {
  return NATURAL_PC[letter]!;
}

export function pcOf(note: Note): Pc {
  return pc(natural(note.letter) + note.alter);
}

export function midiOf(p: Pitch): Midi {
  return (12 * (p.octave + 1) + natural(p.note.letter) + p.note.alter) as Midi;
}

export function pcOfMidi(m: Midi): Pc {
  return pc(m);
}

export function sameNote(a: Note, b: Note): boolean {
  return a.letter === b.letter && a.alter === b.alter;
}

/** "1", "b3", "#4", "9" -> Interval. Throws on a malformed token: only registry literals reach it. */
export function interval(token: string): Interval {
  const m = /^([b#]*)(\d+)$/.exec(token);
  if (!m) throw new Error(`bad interval token "${token}"`);
  const mods = m[1]!;
  const n = Number(m[2]);
  if (n < 1) throw new Error(`bad interval token "${token}"`);
  const steps = n - 1;
  const alter = [...mods].reduce((a, c) => a + (c === "#" ? 1 : -1), 0);
  const semis = MAJOR_SEMIS[steps % 7]! + 12 * Math.floor(steps / 7) + alter;
  return { steps, semis };
}

export function parseFormula(text: string): readonly Interval[] {
  return text.trim().split(/\s+/).map(interval);
}

/**
 * Spell `note` up by `iv`. Every spelled note in the app (scale tones, chord
 * tones, borrowed roots, shape keys) comes from here or from `spellPc`.
 */
export function transpose(note: Note, iv: Interval): Note {
  const raw = note.letter + iv.steps;
  const letter = (raw % 7) as Letter;
  const octaves = Math.floor(raw / 7);
  const naturalDistance = natural(letter) - natural(note.letter) + 12 * octaves;
  return { letter, alter: note.alter + iv.semis - naturalDistance };
}

/** The interval from `a` up to `b` within one octave of letters (steps 0..6). */
export function intervalBetween(a: Note, b: Note): Interval {
  const steps = (b.letter - a.letter + 7) % 7;
  const semis = (((pcOf(b) - pcOf(a)) % 12) + 12) % 12;
  return { steps, semis };
}

/** Spell a bare pitch class with |alter| <= 1, choosing sharps or flats for black keys. */
export function spellPc(p: Pc, prefer: Accidental): Note {
  const whiteIdx = NATURAL_PC.indexOf(p as 0);
  if (whiteIdx >= 0) return { letter: whiteIdx as Letter, alter: 0 };
  const below = NATURAL_PC.indexOf((p - 1) as 0);
  if (prefer === "sharp") return { letter: below as Letter, alter: 1 };
  return { letter: ((below + 1) % 7) as Letter, alter: -1 };
}

function accidentals(alter: number, sharp: string, flat: string): string {
  return alter >= 0 ? sharp.repeat(alter) : flat.repeat(-alter);
}

/** ASCII name used for ids and the URL: "C", "F#", "Bb", "F##". */
export function noteName(n: Note): string {
  return LETTERS[n.letter]! + accidentals(n.alter, "#", "b");
}

/** Name shown to the user, with real accidental glyphs. */
export function displayName(n: Note): string {
  return LETTERS[n.letter]! + accidentals(n.alter, "♯", "♭");
}

export function accidentalPrefix(alter: number): string {
  return accidentals(alter, "♯", "♭");
}

export function pitchName(p: Pitch): string {
  return noteName(p.note) + p.octave;
}

const NOTE_RE = /^([A-Ga-g])([#b♯♭]*)(-?\d+)?$/;

/** Boundary parser for one note token: "F#", "f#", "Bb", "C#4". The octave is optional. */
export function parseNote(text: string): Result<{ note: Note; octave: number | null }, string> {
  const m = NOTE_RE.exec(text.trim());
  if (!m) return { ok: false, error: text };
  const letter = LETTERS.indexOf(m[1]!.toUpperCase()) as Letter;
  const alter = [...m[2]!].reduce((a, c) => a + (c === "#" || c === "♯" ? 1 : -1), 0);
  return { ok: true, value: { note: { letter, alter }, octave: m[3] === undefined ? null : Number(m[3]) } };
}

const ORDINALS = ["unison", "2nd", "3rd", "4th", "5th", "6th", "7th"];

/** Degree label relative to a major scale: "1", "♭3", "♯4", "9". */
export function intervalLabel(iv: Interval): string {
  const base = MAJOR_SEMIS[iv.steps % 7]! + 12 * Math.floor(iv.steps / 7);
  return accidentals(iv.semis - base, "♯", "♭") + (iv.steps + 1);
}

/** "major 3rd", "perfect 5th", "minor 7th", "major 9th". */
export function intervalName(iv: Interval): string {
  const simple = iv.steps % 7;
  const base = MAJOR_SEMIS[simple]! + 12 * Math.floor(iv.steps / 7);
  const diff = iv.semis - base;
  const perfect = simple === 0 || simple === 3 || simple === 4;
  const quality = perfect
    ? ({ [-1]: "diminished", 0: "perfect", 1: "augmented" } as Record<number, string>)[diff]
    : ({ [-2]: "diminished", [-1]: "minor", 0: "major", 1: "augmented" } as Record<number, string>)[diff];
  const size = iv.steps >= 7 ? `${iv.steps + 1}th` : ORDINALS[simple]!;
  return `${quality ?? "altered"} ${size}`;
}
