import { describe, expect, test } from "vitest";
import { chordName } from "./chords";
import { noteName, pc } from "./pitch";
import {
  displayRoman, formatRoman, LIBRARY, parseRoman, resolveRoman, romanOf, voiceLead, type RomanChord,
} from "./progressions";
import { keyOf } from "./scales";
import type { Fret } from "./instrument";
import type { Voicing } from "./voicings";

const roman = (t: string): RomanChord => {
  const r = parseRoman(t);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

describe("Roman numerals", () => {
  test.each(["I", "vi", "bVII", "#IV", "IVmaj7", "vi7", "ii°", "iiø7", "Vsus4", "I5", "Iadd9", "viadd9", "V7", "bIII", "iv"])(
    "round-trips %s",
    (t) => expect(formatRoman(roman(t))).toBe(t),
  );

  test("lowercase sus is accepted and prints uppercase", () => {
    expect(formatRoman(roman("vsus4"))).toBe("Vsus4");
  });

  test("bVI resolves to C in E, bVII to C in D", () => {
    expect(chordName(resolveRoman(roman("bVI"), keyOf(pc(4), "major")))).toBe("C");
    expect(chordName(resolveRoman(roman("bVII"), keyOf(pc(2), "major")))).toBe("C");
  });

  test("a flat numeral spells from the tonic's letters: bVI in F# is D", () => {
    expect(noteName(resolveRoman(roman("bVI"), keyOf(pc(6), "major")).root)).toBe("D");
  });

  test("romanOf inverts resolveRoman", () => {
    const key = keyOf(pc(2), "major");
    for (const t of ["I", "bVII", "iv", "IVmaj7", "vi7"]) {
      expect(formatRoman(romanOf(resolveRoman(roman(t), key), key))).toBe(t);
    }
  });

  test("display uses real accidentals", () => expect(displayRoman(roman("bVII"))).toBe("♭VII"));

  test("garbage is rejected with a message", () => {
    expect(parseRoman("Z").ok).toBe(false);
    expect(parseRoman("Imaj13").ok).toBe(false);
  });
});

describe("LIBRARY", () => {
  test("every template has steps, a note, tags and round-trips through formatRoman", () => {
    expect(LIBRARY.length).toBeGreaterThan(10);
    for (const t of LIBRARY) {
      expect(t.romans.length).toBeGreaterThan(1);
      expect(t.tags.length).toBeGreaterThan(0);
      expect(t.note.length).toBeGreaterThan(10);
      for (const r of t.romans) expect(parseRoman(formatRoman(r))).toEqual({ ok: true, value: r });
    }
    expect(new Set(LIBRARY.map((t) => t.id)).size).toBe(LIBRARY.length);
  });
});

function voicing(frets: (number | null)[], total: number): Voicing {
  return {
    id: frets.map((f) => (f === null ? "x" : f)).join(","),
    frets: frets as Voicing["frets"] & (Fret | null)[],
    tones: [],
    bass: pc(0),
    barre: null,
    score: { total, openStrings: 0, sounding: 0, fingers: 0, span: 0, height: 0, rootInBass: true },
  };
}

describe("voiceLead", () => {
  test("prefers the path that keeps open strings droning over a higher-scoring shape that jumps", () => {
    const drone = [voicing([0, 0, 0, 2, 0, 0], 20)];
    const jump = voicing([0, 0, 7, 7, 7, 0], 21);
    const near = voicing([0, 0, 0, 0, 2, 0], 20);
    const out = voiceLead([drone, [jump, near]]);
    expect(out.chosen[1]).toBe(near);
  });

  test("the loop closes: the first voicing is chosen with the last step in mind", () => {
    const a1 = voicing([0, 0, 0, 0, 0, 0], 10);
    const a2 = voicing([5, 5, 5, 5, 5, 5], 10.5);
    const b = [voicing([5, 5, 5, 5, 5, 5], 10)];
    const c = [voicing([5, 5, 5, 5, 5, 5], 10)];
    expect(voiceLead([[a1, a2], b, c]).chosen[0]).toBe(a2);
  });

  test("movement sums frets moved and mute toggles, including the wrap edge", () => {
    const a = voicing([0, 2, 2, 0, null, null], 10);
    const b = voicing([0, 2, 3, 0, 0, null], 10);
    const { movement } = voiceLead([[a], [b]]);
    expect(movement).toBe(2 * (1 + 0.5));
  });

  test("a step with no candidates stays null and does not break the chain", () => {
    const a = voicing([0, 0, 0, 0, 0, 0], 10);
    const out = voiceLead([[a], [], [a]]);
    expect(out.chosen).toEqual([a, null, a]);
  });

  test("an empty progression yields nothing", () => {
    expect(voiceLead([])).toEqual({ chosen: [], movement: 0 });
  });
});
