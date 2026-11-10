import { describe, expect, test } from "vitest";
import {
  describeTuningError, instrument, parseTuning, shapeKey, soundingKey, toBoard, TUNINGS, tuningText, type Fret,
} from "./instrument";
import { noteName, pc } from "./pitch";
import { keyOf } from "./scales";

const BRIEF_TABLE = {
  standard: "E2 A2 D3 G3 B3 E4",
  dropD: "D2 A2 D3 G3 B3 E4",
  daeacse: "D2 A2 E3 A3 C#4 E4",
  dadfsae: "D2 A2 D3 F#3 A3 E4",
  dadfsad: "D2 A2 D3 F#3 A3 D4",
  dadgad: "D2 A2 D3 G3 A3 D4",
  facgce: "F2 A2 C3 G3 C4 E4",
  dacgce: "D2 A2 C3 G3 C4 E4",
} as const;

describe("tunings", () => {
  test.each(Object.entries(BRIEF_TABLE))("preset %s matches the brief's octaves", (id, expected) => {
    expect(tuningText(TUNINGS[id as keyof typeof TUNINGS].tuning).replace(/♯/g, "#")).toBe(expected);
  });

  test("compact text infers the same octaves as the brief", () => {
    const r = parseTuning("DADF#Ae");
    expect(r.ok && tuningText(r.value)).toBe("D2 A2 D3 F#3 A3 E4");
  });

  test.each([
    ["D A D F# A E", "D2 A2 D3 F#3 A3 E4"],
    ["d,a,d,g,a,d", "D2 A2 D3 G3 A3 D4"],
    ["B1 E2 A2 D3 G3 B3 E4", "B1 E2 A2 D3 G3 B3 E4"],
    ["EbAbDbGbBbEb", "Eb2 Ab2 Db3 Gb3 Bb3 Eb4"],
  ])("parses %s", (text, expected) => {
    const r = parseTuning(text);
    expect(r.ok && tuningText(r.value)).toBe(expected);
  });

  test("a typed preset is recognized by name", () => {
    const r = parseTuning("D A D G A D");
    expect(r.ok && r.value.label).toBe("DADGAD");
  });

  test("a bad token names itself", () => {
    const r = parseTuning("D A H G");
    expect(r).toEqual({ ok: false, error: { kind: "badToken", token: "H" } });
    expect(describeTuningError({ kind: "badToken", token: "H" })).toContain('"H"');
  });

  test("string count is bounded", () => {
    expect(parseTuning("D A D")).toMatchObject({ ok: false, error: { kind: "stringCount", count: 3 } });
    expect(parseTuning("")).toMatchObject({ ok: false, error: { kind: "empty" } });
  });
});

describe("capo frames", () => {
  const tuning = TUNINGS.dadfsae.tuning;

  test("capo raises open strings and shortens the neck", () => {
    const ins = instrument(tuning, 2);
    expect(ins.open[0]).toBe(38 + 2);
    expect(ins.maxFret).toBe(13);
  });

  test("toBoard adds the capo", () => {
    expect(toBoard(instrument(tuning, 3), 5 as Fret)).toBe(8);
  });

  test("E major with capo 2 is D shapes, and back", () => {
    const e = keyOf(pc(4), "major");
    expect(shapeKey(e, 2).name).toBe("D major");
    expect(soundingKey(keyOf(pc(2), "major"), 2).name).toBe("E major");
  });

  test("D shapes with capo 1 sound as E♭, not D♯", () => {
    expect(noteName(soundingKey(keyOf(pc(2), "major"), 1).tonic)).toBe("Eb");
  });
});
