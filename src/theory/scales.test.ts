import { describe, expect, test } from "vitest";
import { noteName, pc, pcOf } from "./pitch";
import { degreeLabel, keyOf, SCALES, SCALE_IDS, spellIn, type ScaleId } from "./scales";

const spelled = (tonic: number, scale: ScaleId) => keyOf(pc(tonic), scale).notes.map(noteName);

describe("keyOf spelling", () => {
  test("F# major has A# and E#", () => {
    expect(spelled(6, "major")).toEqual(["F#", "G#", "A#", "B", "C#", "D#", "E#"]);
  });
  test("Bb major keeps flats", () => {
    expect(spelled(10, "major")).toEqual(["Bb", "C", "D", "Eb", "F", "G", "A"]);
  });
  test("pc 1 is Db major but C# minor", () => {
    expect(keyOf(pc(1), "major").name).toBe("D♭ major");
    expect(keyOf(pc(1), "minor").name).toBe("C♯ minor");
  });
  test("pc 8 major is Ab", () => expect(keyOf(pc(8), "major").name).toBe("A♭ major"));
  test("Lydian reads a raised fourth", () => {
    expect(degreeLabel(keyOf(pc(0), "lydian"), pc(6))).toMatchObject({ label: "♯4", inScale: true, degree: 4 });
  });

  test("no scale tone needs a double accidental for any tonic and scale", () => {
    for (const id of SCALE_IDS) {
      for (let t = 0; t < 12; t++) {
        const key = keyOf(pc(t), id);
        const worst = Math.max(...key.notes.map((n) => Math.abs(n.alter)));
        expect(worst, `${key.name}`).toBeLessThanOrEqual(1);
      }
    }
  });

  test("every spelled note lands on the pitch class its interval demands", () => {
    for (const id of SCALE_IDS) {
      for (let t = 0; t < 12; t++) {
        const key = keyOf(pc(t), id);
        key.notes.forEach((n, i) => expect(pcOf(n)).toBe(pc(t + key.scale.intervals[i]!.semis)));
      }
    }
  });
});

describe("registry", () => {
  test("every scale parses to 5 or 7 intervals starting at the root", () => {
    for (const id of SCALE_IDS) {
      const s = SCALES[id];
      expect([5, 7]).toContain(s.intervals.length);
      expect(s.intervals[0]).toEqual({ steps: 0, semis: 0 });
      expect(SCALES[s.harmonyFrom].intervals).toHaveLength(7);
      expect(s.feel.length).toBeGreaterThan(10);
    }
  });
  test("major and minor come first, which is the key-fit tie-break", () => {
    expect(SCALE_IDS.slice(0, 2)).toEqual(["major", "minor"]);
  });
});

describe("spellIn and degreeLabel", () => {
  test("chromatic tones use the key's preference", () => {
    expect(noteName(spellIn(keyOf(pc(2), "major"), pc(10)))).toBe("A#");
    expect(noteName(spellIn(keyOf(pc(5), "major"), pc(1)))).toBe("Db");
  });
  test("tones outside the scale get the fixed label", () => {
    expect(degreeLabel(keyOf(pc(0), "major"), pc(3))).toEqual({ label: "♭3", inScale: false, degree: null });
  });
});
