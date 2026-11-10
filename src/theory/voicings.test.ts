import { describe, expect, test } from "vitest";
import { chordTones, diatonicChords, QUALITIES, type Chord } from "./chords";
import { instrument, TUNINGS, type Capo } from "./instrument";
import { noteName, pc, pcOf } from "./pitch";
import { keyOf } from "./scales";
import { DEFAULT_LIMITS, generateVoicings, type Voicing } from "./voicings";

const chord = (root: string, quality: Chord["quality"]): Chord => {
  const letter = "CDEFGAB".indexOf(root[0]!) as Chord["root"]["letter"];
  return { root: { letter, alter: root.length > 1 ? (root[1] === "#" ? 1 : -1) : 0 }, quality };
};
const pattern = (v: Voicing) => v.frets.map((f) => (f === null ? "x" : f)).join("");

describe("generateVoicings", () => {
  test("DADF#Ae rings Dadd9 on all six open strings", () => {
    const v = generateVoicings(chord("D", "add9"), instrument(TUNINGS.dadfsae.tuning, 0));
    expect(pattern(v[0]!)).toBe("000000");
    expect(v[0]!.score.openStrings).toBe(6);
  });

  test("FACGCE rings Fmaj9 open", () => {
    const v = generateVoicings(chord("F", "maj9"), instrument(TUNINGS.facgce.tuning, 0));
    expect(pattern(v[0]!)).toBe("000000");
  });

  test("an open G in standard tuning is found among the top shapes", () => {
    const v = generateVoicings(chord("G", "maj"), instrument(TUNINGS.standard.tuning, 0));
    expect(v.slice(0, 5).map(pattern)).toContain("320003");
  });

  test("open strings rank above fretted ones when everything else is equal", () => {
    const v = generateVoicings(chord("D", "maj"), instrument(TUNINGS.dadfsad.tuning, 0));
    expect(v[0]!.score.openStrings).toBeGreaterThanOrEqual(v[v.length - 1]!.score.openStrings);
    for (let i = 1; i < v.length; i++) expect(v[i - 1]!.score.total).toBeGreaterThanOrEqual(v[i]!.score.total);
  });

  test("every voicing respects span, fingers, interior mutes and required tones", () => {
    for (const id of ["dadfsae", "facgce", "dadgad", "standard"] as const) {
      for (const capo of [0, 3] as Capo[]) {
        const ins = instrument(TUNINGS[id].tuning, capo);
        for (const row of diatonicChords(keyOf(pc(2), "major"))) {
          for (const c of [row.triad, ...row.colors]) {
            const q = QUALITIES[c.quality];
            const required = q.intervals
              .filter((iv) => !q.optional.some((o) => o.semis === iv.semis))
              .map((iv) => pc(pcOf(c.root) + iv.semis));
            for (const v of generateVoicings(c, ins)) {
              const fretted = v.frets.filter((f): f is NonNullable<typeof f> => f !== null && f > 0);
              if (fretted.length) expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThan(DEFAULT_LIMITS.maxSpan);
              expect(v.score.fingers).toBeLessThanOrEqual(DEFAULT_LIMITS.maxFingers);
              expect(v.score.sounding).toBeGreaterThanOrEqual(DEFAULT_LIMITS.minSounding);
              const first = v.frets.findIndex((f) => f !== null);
              const last = v.frets.length - 1 - [...v.frets].reverse().findIndex((f) => f !== null);
              expect(v.frets.slice(first, last + 1).filter((f) => f === null).length).toBeLessThanOrEqual(1);
              const heard = new Set(v.tones.filter((t) => t).map((t) => t!.pc));
              for (const r of required) expect(heard.has(r), `${noteName(c.root)}${q.symbol} ${v.id}`).toBe(true);
              for (const f of v.frets) if (f !== null) expect(f).toBeLessThanOrEqual(ins.maxFret);
            }
          }
        }
      }
    }
  });

  test("tones sound at open + fret, so a capo raises them", () => {
    const base = generateVoicings(chord("D", "add9"), instrument(TUNINGS.dadfsae.tuning, 0))[0]!;
    expect(base.tones[0]!.midi).toBe(38);
    const capoed = generateVoicings(chord("E", "add9"), instrument(TUNINGS.dadfsae.tuning, 2))[0]!;
    expect(pattern(capoed)).toBe("000000");
    expect(capoed.tones[0]!.midi).toBe(40);
  });

  test("a barre is reported when one finger covers several strings", () => {
    const v = generateVoicings(chord("F", "maj"), instrument(TUNINGS.standard.tuning, 0));
    const barred = v.find((x) => pattern(x) === "133211");
    expect(barred?.barre).toEqual({ fret: 1, from: 0, to: 5 });
    expect(barred?.score.fingers).toBe(4);
  });

  test("inversions can be switched off", () => {
    const ins = instrument(TUNINGS.dadfsae.tuning, 0);
    const root = generateVoicings(chord("D", "maj"), ins, { ...DEFAULT_LIMITS, allowInversions: false });
    expect(root.every((v) => v.score.rootInBass)).toBe(true);
    expect(generateVoicings(chord("D", "maj"), ins).some((v) => !v.score.rootInBass)).toBe(true);
  });

  test("tone roles map back to the chord", () => {
    const c = chord("D", "maj");
    const v = generateVoicings(c, instrument(TUNINGS.dadfsae.tuning, 0))[0]!;
    const roles = new Set(chordTones(c).map((t) => t.role.semis));
    for (const t of v.tones) if (t) expect(roles.has(t.role.semis)).toBe(true);
  });
});
