import { describe, expect, test } from "vitest";
import { chordName } from "./chords";
import { capoOptions, compareFit, keyFit, rankKeys } from "./fit";
import { instrument, TUNINGS } from "./instrument";
import { pc } from "./pitch";
import { keyOf, SCALE_IDS } from "./scales";

const ins = (id: keyof typeof TUNINGS, capo = 0) => instrument(TUNINGS[id].tuning, capo as 0);
const top = (id: keyof typeof TUNINGS, scales: Parameters<typeof rankKeys>[1], n: number) =>
  rankKeys(ins(id), scales).slice(0, n).map((f) => f.key.name);

describe("rankKeys", () => {
  test("DADF♯Ae ranks D major first with every open string in key", () => {
    const best = rankKeys(ins("dadfsae"), ["major"])[0]!;
    expect(best.key.name).toBe("D major");
    expect(best.inScale).toBe(6);
    expect(best.inTonicChord).toBe(5);
    expect(best.bassIsTonic).toBe(true);
  });

  test("FACGCE ranks F major then C major among major keys", () => {
    expect(top("facgce", ["major"], 2)).toEqual(["F major", "C major"]);
  });

  test("FACGCE ranks A minor first among minor keys", () => {
    expect(top("facgce", ["minor"], 1)).toEqual(["A minor"]);
  });

  test("across all scales D major beats D Mixolydian for DADF♯Ae", () => {
    const all = rankKeys(ins("dadfsae"), SCALE_IDS).map((f) => f.key.name);
    expect(all[0]).toBe("D major");
    expect(all.indexOf("D major")).toBeLessThan(all.indexOf("D mixolydian"));
  });

  test("the order is a total preorder: sorting twice changes nothing", () => {
    const fits = rankKeys(ins("dadgad"), SCALE_IDS);
    for (let i = 1; i < fits.length; i++) expect(compareFit(fits[i - 1]!, fits[i]!)).toBeLessThanOrEqual(0);
  });
});

describe("keyFit", () => {
  test("per-string chips name the degree each open string plays", () => {
    const fit = keyFit(ins("dadfsae"), keyOf(pc(2), "major"));
    expect(fit.strings.map((s) => s.degree)).toEqual(["1", "5", "1", "3", "5", "2"]);
  });

  test("ringing chords include Dadd9 for DADF♯Ae in D and list zero-outside chords first", () => {
    const fit = keyFit(ins("dadfsae"), keyOf(pc(2), "major"));
    const names = fit.ringingChords.map((r) => chordName(r.chord));
    expect(names).toContain("Dadd9");
    expect(fit.ringingChords[0]!.openStringsOutside).toBe(0);
    for (const r of fit.ringingChords) expect(r.openStringsOutside).toBeLessThanOrEqual(1);
  });
});

describe("capoOptions", () => {
  test("DADGAD sounding E major: capo 2 plays D shapes with 6 of 6 open strings in key", () => {
    const opts = capoOptions(TUNINGS.dadgad.tuning, keyOf(pc(4), "major"));
    const two = opts.find((o) => o.capo === 2)!;
    expect(two.fit.inScale).toBe(6);
    expect(two.shapeKey.name).toBe("D major");
  });

  test("the best option sounds at least as in-key as capo 0, and capo 0 is always listed", () => {
    const opts = capoOptions(TUNINGS.dadfsae.tuning, keyOf(pc(4), "major"));
    expect(opts.map((o) => o.capo).sort()).toContain(0);
    const zero = opts.find((o) => o.capo === 0)!;
    expect(opts[0]!.fit.inScale).toBeGreaterThanOrEqual(zero.fit.inScale);
    expect(opts[0]!.capo).toBe(2);
  });

  test("ties go to the lower capo", () => {
    const opts = capoOptions(TUNINGS.dadfsae.tuning, keyOf(pc(2), "major"));
    expect(opts[0]!.capo).toBe(0);
  });
});
