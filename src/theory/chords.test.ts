import { describe, expect, test } from "vitest";
import {
  chordKey, chordName, chordTones, diatonicChords, explainChord, isDiatonic, QUALITIES, QUALITY_IDS, type Chord,
} from "./chords";
import { noteName, pc } from "./pitch";
import { keyOf } from "./scales";

const names = (c: Chord) => chordTones(c).map((t) => noteName(t.note));

describe("diatonic harmony", () => {
  const dMajor = diatonicChords(keyOf(pc(2), "major"));

  test("triads of D major are D Em F#m G A Bm C#dim", () => {
    expect(dMajor.map((r) => chordName(r.triad))).toEqual(["D", "Em", "F♯m", "G", "A", "Bm", "C♯dim"]);
  });

  test("colors are derived from scale membership, so IV gets maj7 and maj7♯11 but no sus4", () => {
    const iv = dMajor[3]!.colors.map((c) => c.quality);
    expect(iv).toContain("maj7");
    expect(iv).toContain("maj7s11");
    expect(iv).not.toContain("sus4");
    expect(dMajor[0]!.colors.map((c) => c.quality)).toEqual(
      expect.arrayContaining(["add9", "sus2", "sus4", "maj7", "6", "maj9"]),
    );
  });

  test("no color contains a tone outside the scale", () => {
    for (const row of dMajor) for (const c of row.colors) expect(isDiatonic(c, keyOf(pc(2), "major"))).toBe(true);
  });

  test("a pentatonic key takes its chords from the parent scale", () => {
    const am = diatonicChords(keyOf(pc(9), "minorPentatonic"));
    expect(am).toHaveLength(7);
    expect(chordName(am[0]!.triad)).toBe("Am");
  });

  test("harmonic minor has an augmented III", () => {
    expect(chordName(diatonicChords(keyOf(pc(9), "harmonicMinor"))[2]!.triad)).toBe("Caug");
  });
});

describe("chord tones", () => {
  test("spell by letter: F#m7 is F# A C# E, not G♭ based", () => {
    expect(names({ root: { letter: 3, alter: 1 }, quality: "m7" })).toEqual(["F#", "A", "C#", "E"]);
  });
  test("a borrowed Fm in C spells Ab, not G#", () => {
    expect(names({ root: { letter: 3, alter: 0 }, quality: "min" })).toEqual(["F", "Ab", "C"]);
  });
  test("keys are unique per chord", () => {
    expect(chordKey({ root: { letter: 2, alter: -1 }, quality: "maj7" })).toBe("Eb:maj7");
  });
  test("every quality starts on the root and has distinct pitch classes", () => {
    for (const id of QUALITY_IDS) {
      const q = QUALITIES[id];
      expect(q.intervals[0]).toEqual({ steps: 0, semis: 0 });
      expect(new Set(q.intervals.map((i) => i.semis % 12)).size).toBe(q.intervals.length);
      for (const o of q.optional) expect(q.intervals).toContainEqual(o);
    }
  });
});

describe("explainChord", () => {
  const dMajor = keyOf(pc(2), "major");
  test("a diatonic triad stacks a major then a minor third", () => {
    const e = explainChord({ root: { letter: 1, alter: 0 }, quality: "maj" }, dMajor);
    expect(e.stack.map((s) => s.interval)).toEqual(["major 3rd", "minor 3rd"]);
    expect(e.tones.map((t) => t.degree)).toEqual(["1", "3", "5"]);
    expect(e.borrowed).toBe(false);
  });
  test("Bb major in D is borrowed and says so", () => {
    const e = explainChord({ root: { letter: 6, alter: -1 }, quality: "maj" }, dMajor);
    expect(e.borrowed).toBe(true);
    expect(e.tones.filter((t) => !t.inScale).map((t) => t.degree)).toEqual(["♭6", "♭3"]);
  });
});
