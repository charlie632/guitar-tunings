export const SECTIONS = [
  { id: "fretboard", label: "Fretboard" },
  { id: "chords", label: "Chords" },
  { id: "voicings", label: "Voicings" },
  { id: "progressions", label: "Progressions" },
] as const;

export type Section = (typeof SECTIONS)[number]["id"];

export const DEFAULT_SECTION: Section = "fretboard";

export function isSection(s: string | null): s is Section {
  return SECTIONS.some((x) => x.id === s);
}
