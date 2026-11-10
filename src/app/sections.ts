export const SECTION_LABELS = {
  fretboard: "Fretboard",
  chords: "Chords",
  voicings: "Voicings",
  progressions: "Progressions",
} as const;

export type Section = keyof typeof SECTION_LABELS;

export const SECTIONS = Object.keys(SECTION_LABELS) as Section[];

export const DEFAULT_SECTION: Section = "fretboard";

export function isSection(s: string | null): s is Section {
  return s !== null && Object.hasOwn(SECTION_LABELS, s);
}
