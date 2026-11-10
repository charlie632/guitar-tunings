import { describe, expect, test } from "vitest";
import {
  displayName, interval, intervalBetween, intervalLabel, intervalName, midiOf, noteName, parseNote, pc, pcOf,
  spellPc, transpose, type Letter, type Note,
} from "./pitch";

const n = (name: string): Note => {
  const r = parseNote(name);
  if (!r.ok) throw new Error(name);
  return r.value.note;
};

describe("transpose", () => {
  test.each([
    ["B", "3", "D#"],
    ["F#", "3", "A#"],
    ["F#", "7", "E#"],
    ["E", "b6", "C"],
    ["D", "b7", "C"],
    ["Bb", "5", "F"],
    ["Db", "3", "F"],
    ["C", "#4", "F#"],
    ["C", "9", "D"],
    ["G", "b5", "Db"],
  ])("%s up a %s is %s", (from, iv, expected) => {
    expect(noteName(transpose(n(from), interval(iv)))).toBe(expected);
  });

  test("spells the same pitch class by the interval's letter, not by a lookup", () => {
    expect(noteName(transpose(n("C"), interval("#2")))).toBe("D#");
    expect(noteName(transpose(n("C"), interval("b3")))).toBe("Eb");
  });

  test("lands on the right pitch class for every natural/sharp/flat root and simple interval", () => {
    const simple = ["1", "b2", "2", "b3", "3", "4", "b5", "5", "#5", "6", "b7", "7"].map(interval);
    for (let letter = 0; letter < 7; letter++) {
      for (const alter of [-1, 0, 1]) {
        for (const iv of simple) {
          const out = transpose({ letter: letter as Letter, alter }, iv);
          expect(pcOf(out)).toBe(pc(pcOf({ letter: letter as Letter, alter }) + iv.semis));
        }
      }
    }
  });
});

describe("pitch numbers", () => {
  test("midiOf handles enharmonic edge spellings", () => {
    expect(midiOf({ note: n("B#"), octave: 3 })).toBe(60);
    expect(midiOf({ note: n("Cb"), octave: 4 })).toBe(59);
    expect(midiOf({ note: n("E"), octave: 2 })).toBe(40);
  });

  test("pc reduces negatives", () => expect(pc(-1)).toBe(11));

  test("spellPc picks sharps or flats on request", () => {
    expect(noteName(spellPc(pc(1), "sharp"))).toBe("C#");
    expect(noteName(spellPc(pc(1), "flat"))).toBe("Db");
    expect(noteName(spellPc(pc(0), "flat"))).toBe("C");
  });
});

describe("names and intervals", () => {
  test("display names use real accidentals, ids stay ASCII", () => {
    expect(displayName(n("Bb"))).toBe("B♭");
    expect(noteName(n("F#"))).toBe("F#");
  });

  test("parseNote accepts unicode, lowercase and octaves", () => {
    expect(parseNote("f♯3")).toEqual({ ok: true, value: { note: { letter: 3, alter: 1 }, octave: 3 } });
    expect(parseNote("H").ok).toBe(false);
  });

  test("labels and names", () => {
    expect(intervalLabel(interval("b3"))).toBe("♭3");
    expect(intervalLabel(interval("#4"))).toBe("♯4");
    expect(intervalLabel(interval("9"))).toBe("9");
    expect(intervalName(interval("3"))).toBe("major 3rd");
    expect(intervalName(interval("b3"))).toBe("minor 3rd");
    expect(intervalName(interval("5"))).toBe("perfect 5th");
    expect(intervalName(interval("9"))).toBe("major 9th");
  });

  test("intervalBetween is the inverse of transpose within an octave", () => {
    expect(intervalBetween(n("D"), n("F#"))).toEqual(interval("3"));
    expect(intervalBetween(n("C"), n("Bb"))).toEqual(interval("b7"));
  });
});
