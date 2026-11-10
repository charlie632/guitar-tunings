import { describe, expect, test } from "vitest";
import { keyOf, parseRoman, parseTuning, pc, TUNINGS, tuningText, type Chord, type RomanChord } from "../theory";
import {
  appReducer, DEFAULT_SETTINGS, decodeSettings, encodeSettings, initAppState, type AppAction, type AppState,
} from "./settings";

const roman = (t: string): RomanChord => {
  const r = parseRoman(t);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
const run = (s: AppState, ...actions: AppAction[]) => actions.reduce(appReducer, s);
const fresh = () => initAppState("");
const soundingName = (s: AppState) => keyOf(s.settings.soundingTonic, s.settings.scale).name;

describe("URL codec", () => {
  test("round-trips every field, including a custom tuning and borrowed numerals", () => {
    const custom = parseTuning("D A D F# A C#");
    if (!custom.ok) throw new Error("setup");
    const settings = {
      tuning: custom.value, capo: 5 as const, soundingTonic: pc(9), scale: "dorian" as const, labels: "degree" as const,
      progression: ["i", "bVII", "IVmaj7", "iiø7", "I+"].map(roman),
    };
    const back = decodeSettings("#" + encodeSettings(settings));
    expect(tuningText(back.tuning)).toBe(tuningText(settings.tuning));
    expect({ ...back, tuning: null }).toEqual({ ...settings, tuning: null });
  });

  test("garbage fields fall back individually while the rest survive", () => {
    const s = decodeSettings("#t=ZZZ&c=99&k=x&s=bogus&l=wat&p=I,Q&unknown=1");
    expect(s).toEqual(DEFAULT_SETTINGS);
    const mixed = decodeSettings("#c=3&s=lydian&k=banana&p=I,V");
    expect(mixed.capo).toBe(3);
    expect(mixed.scale).toBe("lydian");
    expect(mixed.soundingTonic).toBe(DEFAULT_SETTINGS.soundingTonic);
    expect(mixed.progression).toHaveLength(2);
  });

  test("an empty hash gives the default of DADF♯Ae in D major", () => {
    expect(decodeSettings("")).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.tuning).toBe(TUNINGS.dadfsae.tuning);
  });

  test("an explicit empty progression stays empty", () => {
    expect(decodeSettings("#p=").progression).toEqual([]);
  });
});

describe("capo and key actions", () => {
  test("setKey in the sounding frame stores the key as given", () => {
    expect(soundingName(run(fresh(), { type: "setKey", tonic: pc(4), scale: "major", frame: "sounding" }))).toBe("E major");
  });

  test("setKey in the shape frame adds the capo through soundingKey: D shapes with capo 1 store E♭", () => {
    const s = run(
      fresh(),
      { type: "setCapo", capo: 1, hold: "keepSound" },
      { type: "setKey", tonic: pc(2), scale: "major", frame: "shape" },
    );
    expect(soundingName(s)).toBe("E♭ major");
    expect(s.settings.soundingTonic).toBe(3);
  });

  test("hold sound: moving the capo keeps the sounding key", () => {
    const s = run(fresh(), { type: "setCapo", capo: 3, hold: "keepSound" });
    expect(s.settings.soundingTonic).toBe(2);
    expect(s.settings.capo).toBe(3);
  });

  test("hold shapes: moving the capo keeps the played shapes and the sound moves", () => {
    const s = run(fresh(), { type: "setCapo", capo: 2, hold: "keepShapes" });
    expect(soundingName(s)).toBe("E major");
    const again = run(s, { type: "setCapo", capo: 5, hold: "keepShapes" });
    expect(soundingName(again)).toBe("G major");
    const back = run(again, { type: "setCapo", capo: 0, hold: "keepShapes" });
    expect(soundingName(back)).toBe("D major");
  });

  test("changing the key clears the selected chord; changing the capo with sound held keeps it", () => {
    const chord: Chord = { root: { letter: 1, alter: 0 }, quality: "maj" };
    const picked = run(fresh(), { type: "select", chord });
    expect(run(picked, { type: "setCapo", capo: 2, hold: "keepSound" }).selected).toEqual(chord);
    expect(run(picked, { type: "setKey", tonic: pc(4), scale: "major", frame: "sounding" }).selected).toBeNull();
  });
});

describe("progression editing and pins", () => {
  const base = () => run(fresh(), { type: "setProgression", romans: ["I", "V", "vi", "IV"].map(roman) });

  test("append adds to the end", () => {
    expect(run(base(), { type: "appendRoman", roman: roman("ii") }).settings.progression).toHaveLength(5);
  });

  test("remove drops a step and moves later pins with their steps", () => {
    const s = run(base(), { type: "pin", index: 2, id: "x" }, { type: "pin", index: 1, id: "y" }, { type: "removeStep", index: 1 });
    expect(s.settings.progression).toHaveLength(3);
    expect(s.pins).toEqual({ 1: "x" });
  });

  test("move reorders and pins follow", () => {
    const s = run(base(), { type: "pin", index: 0, id: "a" }, { type: "moveStep", from: 0, to: 2 });
    expect(s.settings.progression.map((r) => r.step.steps)).toEqual([4, 5, 0, 3]);
    expect(s.pins).toEqual({ 2: "a" });
  });

  test("move out of range is a no-op", () => {
    const b = base();
    expect(run(b, { type: "moveStep", from: 0, to: 9 })).toBe(b);
  });

  test("unpin clears one pin; changing tuning clears all", () => {
    const pinned = run(base(), { type: "pin", index: 0, id: "a" }, { type: "pin", index: 1, id: "b" });
    expect(run(pinned, { type: "pin", index: 0, id: null }).pins).toEqual({ 1: "b" });
    expect(run(pinned, { type: "setTuning", tuning: TUNINGS.dadgad.tuning }).pins).toEqual({});
  });
});
