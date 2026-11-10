import { chordTones, QUALITIES, type Chord } from "./chords";
import type { Fret, Instrument, StringIndex } from "./instrument";
import { pc, pcOf, type Interval, type Midi, type Pc } from "./pitch";

/** Per string, low to high. `null` is muted. Capo-relative. */
export type FretPattern = readonly (Fret | null)[];

export interface VoicingLimits {
  /** Fretted span in frets, as a window of this width. */
  readonly maxSpan: number;
  /** A barre counts as one finger. */
  readonly maxFingers: number;
  readonly maxInteriorMutes: number;
  readonly minSounding: number;
  /** Inversions rank below root position, but emo leans on drones and non-root bass. */
  readonly allowInversions: boolean;
}

export const DEFAULT_LIMITS: VoicingLimits = {
  maxSpan: 4,
  maxFingers: 4,
  maxInteriorMutes: 1,
  minSounding: 3,
  allowInversions: true,
};

/** One table, so ranking is tuned in one place. Open strings are the heaviest reward. */
export const VOICING_WEIGHTS = {
  openString: 3,
  sounding: 1,
  finger: -1,
  span: -0.5,
  height: -0.25,
  rootInBass: 4,
} as const;

export interface VoicingScore {
  readonly total: number;
  /** Sounding open strings: the tuning's gift. */
  readonly openStrings: number;
  readonly sounding: number;
  readonly fingers: number;
  readonly span: number;
  /** Lowest fretted fret, counted from the capo. 0 when nothing is fretted. */
  readonly height: number;
  readonly rootInBass: boolean;
}

export interface Barre {
  readonly fret: Fret;
  readonly from: StringIndex;
  readonly to: StringIndex;
}

export interface Voicing {
  /** Frets joined, stable across renders: "x,0,2,2,x,0". */
  readonly id: string;
  readonly frets: FretPattern;
  readonly tones: readonly ({ readonly midi: Midi; readonly role: Interval; readonly pc: Pc } | null)[];
  readonly bass: Pc;
  readonly barre: Barre | null;
  readonly score: VoicingScore;
}

export function generateVoicings(
  chord: Chord,
  ins: Instrument,
  limits: VoicingLimits = DEFAULT_LIMITS,
): readonly Voicing[] {
  const tones = chordTones(chord);
  const rootPc = pcOf(chord.root);
  const roleByPc = new Map<number, Interval>(tones.map((t) => [pcOf(t.note), t.role]));
  const quality = QUALITIES[chord.quality];
  const required = new Set(
    quality.intervals
      .filter((iv) => !quality.optional.some((o) => o.semis === iv.semis))
      .map((iv) => pc(rootPc + iv.semis)),
  );

  const n = ins.open.length;
  const maxFret = ins.maxFret;
  const out: Voicing[] = [];
  const cur: (number | null)[] = new Array<number | null>(n).fill(null);

  for (let w = 1; w <= Math.max(1, maxFret - limits.maxSpan + 1); w++) {
    const options: (number | null)[][] = [];
    for (let s = 0; s < n; s++) {
      const opts: (number | null)[] = [null];
      if (roleByPc.has(pc(ins.open[s]!))) opts.push(0);
      for (let f = w; f <= Math.min(w + limits.maxSpan - 1, maxFret); f++) {
        if (roleByPc.has(pc(ins.open[s]! + f))) opts.push(f);
      }
      options.push(opts);
    }

    const leaf = (): void => {
      let sounding = 0;
      let fretted = 0;
      let minFret = Infinity;
      let maxF = 0;
      let open = 0;
      const pcs = new Set<number>();
      let bassPc = -1;
      for (let s = 0; s < n; s++) {
        const f = cur[s];
        if (f === null || f === undefined) continue;
        sounding++;
        const p = pc(ins.open[s]! + f);
        pcs.add(p);
        if (bassPc < 0) bassPc = p;
        if (f === 0) open++;
        else {
          fretted++;
          if (f < minFret) minFret = f;
          if (f > maxF) maxF = f;
        }
      }
      if (sounding < limits.minSounding) return;
      if (fretted === 0 ? w !== 1 : minFret !== w) return;
      for (const r of required) if (!pcs.has(r)) return;
      const rootInBass = bassPc === rootPc;
      if (!rootInBass && !limits.allowInversions) return;

      let barre: Barre | null = null;
      let fingers = fretted;
      if (fretted > 1) {
        const at: number[] = [];
        for (let s = 0; s < n; s++) if (cur[s] === w) at.push(s);
        if (at.length >= 2) {
          const from = at[0]!;
          const to = at[at.length - 1]!;
          let clear = true;
          for (let s = from; s <= to; s++) {
            const f = cur[s];
            if (f === null || f === undefined || f < w) clear = false;
          }
          if (clear) {
            barre = { fret: w as Fret, from, to };
            fingers = fretted - at.length + 1;
          }
        }
      }
      if (fingers > limits.maxFingers) return;

      const span = fretted ? maxF - minFret + 1 : 0;
      const height = fretted ? minFret - 1 : 0;
      const total =
        VOICING_WEIGHTS.openString * open +
        VOICING_WEIGHTS.sounding * sounding +
        VOICING_WEIGHTS.finger * fingers +
        VOICING_WEIGHTS.span * span +
        VOICING_WEIGHTS.height * height +
        (rootInBass ? VOICING_WEIGHTS.rootInBass : 0);

      out.push({
        id: cur.map((f) => (f === null ? "x" : f)).join(","),
        frets: cur.slice() as FretPattern,
        tones: cur.map((f, s) =>
          f === null ? null : { midi: (ins.open[s]! + f) as Midi, role: roleByPc.get(pc(ins.open[s]! + f))!, pc: pc(ins.open[s]! + f) },
        ),
        bass: bassPc as Pc,
        barre,
        score: { total, openStrings: open, sounding, fingers, span, height, rootInBass },
      });
    };

    const walk = (s: number, soundingSoFar: number, pendingMutes: number, interior: number): void => {
      if (s === n) return leaf();
      for (const f of options[s]!) {
        if (f === null) {
          cur[s] = null;
          walk(s + 1, soundingSoFar, soundingSoFar > 0 ? pendingMutes + 1 : 0, interior);
        } else {
          const next = interior + pendingMutes;
          if (next > limits.maxInteriorMutes) continue;
          cur[s] = f;
          walk(s + 1, soundingSoFar + 1, 0, next);
        }
      }
      cur[s] = null;
    };
    walk(0, 0, 0, 0);
  }

  out.sort((a, b) => b.score.total - a.score.total || a.score.height - b.score.height || (a.id < b.id ? -1 : 1));
  return out;
}
