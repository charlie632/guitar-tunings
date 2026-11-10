import { describe, expect, test } from "vitest";
import { explore, type Exploration } from "./explore";
import { asCapo, TUNINGS, type TuningId } from "./instrument";
import { pc } from "./pitch";
import { parseRoman, type RomanChord } from "./progressions";

const ex = (id: TuningId, tonic: number, scale: Parameters<typeof explore>[0]["scale"] = "major", capo = 0): Exploration =>
  explore({ tuning: TUNINGS[id].tuning, capo: asCapo(capo), tonic: pc(tonic), scale });

const romans = (text: string): RomanChord[] =>
  text.split(" ").map((t) => {
    const r = parseRoman(t);
    if (!r.ok) throw new Error(r.error);
    return r.value;
  });

describe("keys and capo", () => {
  test("the sounding key and the shape key are both named, and capo 0 has no shape key", () => {
    const e = ex("dadfsae", 4, "major", 2);
    expect(e.key.name).toBe("E major");
    expect(e.shapeKey?.name).toBe("D major");
    expect(ex("dadfsae", 2).shapeKey).toBeNull();
  });

  test("the capo sentence names strings before and after and the shape key", () => {
    expect(ex("dadfsae", 4, "major", 2).capoSentence).toBe(
      "Capo 2 raises every open string 2 semitones. D A D F♯ A E becomes E B E G♯ B F♯, so D major shapes sound as E major.",
    );
    expect(ex("dadfsae", 2).capoSentence).toContain("No capo");
  });

  test("chord cards carry sounding and shape names under a capo", () => {
    const row = ex("dadfsae", 4, "major", 2).chords()[0]!;
    expect(row.triad.name).toBe("E");
    expect(row.triad.shapeName).toBe("D");
    expect(row.triad.numeral).toBe("I");
  });

  test("capo options rank the capo that brings the key in tune first and attach easyChords to the top three", () => {
    const opts = ex("dadfsae", 4).capoOptions();
    expect(opts[0]!.capo).toBe(2);
    expect(opts[0]!.shapeKey.name).toBe("D major");
    expect(opts.slice(0, 3).every((o) => o.easyChords !== null)).toBe(true);
    expect(opts.slice(3).every((o) => o.easyChords === null)).toBe(true);
    expect(opts[0]!.easyChords).toBeGreaterThan(0);
  });
});

describe("key fit view", () => {
  test("DADF♯Ae in D major reads as a sentence with ringing chords", () => {
    const top = ex("dadfsae", 2).keyFits("thisScale")[0]!;
    expect(top.key.name).toBe("D major");
    expect(top.summary).toBe("6/6 open strings in key, 5 in the tonic chord, low string is the root");
    expect(top.ringing.map((r) => r.name)).toContain("Dadd9");
  });
  test("scope all scales covers every scale and tonic", () => {
    expect(ex("dadfsae", 2).keyFits("allScales")).toHaveLength(12 * 11);
  });
});

describe("fretboard", () => {
  const board = ex("dadfsae", 2).fretboard();
  test("has 16 cells per string and marks scale tones with degrees", () => {
    expect(board.strings).toHaveLength(6);
    expect(board.strings[0]!.cells).toHaveLength(16);
    expect(board.strings[0]!.cells[0]).toMatchObject({ note: "D", degree: "1", isTonic: true, isOpenRinging: true });
    expect(board.strings[0]!.cells[1]!.degree).toBeNull();
  });
  test("under a capo the frets behind it are unplayable and the open string moves to the capo", () => {
    const e = ex("dadfsae", 4, "major", 2).fretboard();
    expect(e.strings[0]!.cells[1]!.playable).toBe(false);
    expect(e.strings[0]!.cells[2]).toMatchObject({ playable: true, isOpenRinging: true, note: "E", shapeNote: "D" });
  });
});

describe("voicings and explanations", () => {
  test("Dadd9 in DADF♯Ae leads with an all-open diagram and a badge saying so", () => {
    const e = ex("dadfsae", 2);
    const add9 = e.chords()[0]!.colors.find((c) => c.chord.quality === "add9")!;
    const top = e.voicings(add9.chord)[0]!;
    expect(top.frets.join("")).toBe("000000");
    expect(top.badges).toContain("6 open strings ring");
    expect(top.midis).toHaveLength(6);
  });
  test("a borrowed Fm in C labels the minor third A♭", () => {
    const e = ex("standard", 0);
    const fm = e.progression(romans("iv")).steps[0]!;
    expect(fm.diatonic).toBe(false);
    expect(fm.voicing!.strings.filter(Boolean).map((s) => s!.note)).toContain("A♭");
    expect(fm.voicing!.strings.filter(Boolean).map((s) => s!.note)).not.toContain("G♯");
  });
  test("explain returns spelled strings", () => {
    const e = ex("dadfsae", 2);
    const why = e.explain(e.chords()[1]!.triad.chord);
    expect(why.name).toBe("Em");
    expect(why.stack.map((s) => s.interval)).toEqual(["minor 3rd", "major 3rd"]);
  });
  test("voicings are memoized per chord", () => {
    const e = ex("dadfsae", 2);
    const c = e.chords()[0]!.triad.chord;
    expect(e.voicings(c)[0]).toEqual(e.voicings(c)[0]);
  });
});

describe("progressions", () => {
  const e = ex("dadfsae", 2);

  test("resolves numerals into names, one voicing per step, with a movement total", () => {
    const p = e.progression(romans("I V vi IV"));
    expect(p.steps.map((s) => s.name)).toEqual(["D", "A", "Bm", "G"]);
    expect(p.steps.every((s) => s.voicing)).toBe(true);
    expect(p.movement).toBeGreaterThanOrEqual(0);
    expect(p.borrowedCount).toBe(0);
  });

  test("a borrowed chord is flagged", () => {
    expect(e.progression(romans("I bVII IV I")).borrowedCount).toBe(1);
  });

  test("a pin overrides the voice leading for that step; a stale pin id is ignored", () => {
    const base = e.progression(romans("I V vi IV"));
    const alt = base.steps[1]!.alternatives.find((v) => v.id !== base.steps[1]!.voicing!.id)!;
    const pinned = e.progression(romans("I V vi IV"), { 1: alt.id });
    expect(pinned.steps[1]!.voicing!.id).toBe(alt.id);
    expect(pinned.steps[1]!.pinned).toBe(true);
    const stale = e.progression(romans("I V vi IV"), { 1: "nope" });
    expect(stale.steps[1]!.voicing!.id).toBe(base.steps[1]!.voicing!.id);
    expect(stale.steps[1]!.pinned).toBe(false);
  });

  test("movement is zero for one chord and grows when the hand has to travel", () => {
    expect(e.progression(romans("I")).movement).toBe(0);
    expect(e.progression(romans("I V")).movement).toBeGreaterThan(0);
  });

  test("the library resolves in the current key with borrowed counts", () => {
    const lib = e.library();
    const axis = lib.find((t) => t.id === "axis")!;
    expect(axis.names).toEqual(["D", "A", "Bm", "G"]);
    expect(axis.borrowedCount).toBe(0);
    expect(lib.find((t) => t.id === "borrowed-lift")!.borrowedCount).toBe(2);
  });
});
