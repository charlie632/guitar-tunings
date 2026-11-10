import { chordTones, diatonicChords, type Chord } from "./chords";
import { instrument, shapeKey, type Capo, type Instrument, type Tuning } from "./instrument";
import { pc, pcOf, pcOfMidi, type Midi } from "./pitch";
import { degreeLabel, keyOf, SCALE_IDS, type Key, type ScaleId } from "./scales";

export interface RingingChord {
  readonly chord: Chord;
  /** Open strings that are not tones of the chord: 0 or 1. */
  readonly outside: number;
}

export interface KeyFit {
  readonly key: Key;
  readonly strings: readonly {
    readonly midi: Midi;
    readonly degree: string;
    readonly inScale: boolean;
    readonly inTonicChord: boolean;
  }[];
  readonly inScale: number;
  readonly inTonicChord: number;
  readonly bassIsTonic: boolean;
  /** Diatonic chords with at most one open string outside them: why the key fits. */
  readonly ringingChords: readonly RingingChord[];
}

export function keyFit(ins: Instrument, key: Key): KeyFit {
  const rows = diatonicChords(key);
  const tonicPcs = new Set(chordTones(rows[0]!.triad).map((t) => pcOf(t.note)));
  const openPcs = ins.open.map(pcOfMidi);
  const strings = ins.open.map((midi, s) => {
    const d = degreeLabel(key, openPcs[s]!);
    return { midi, degree: d.label, inScale: d.inScale, inTonicChord: tonicPcs.has(openPcs[s]!) };
  });

  const ringingChords: RingingChord[] = [];
  for (const row of rows) {
    for (const chord of [row.triad, ...row.colors]) {
      const pcs = new Set(chordTones(chord).map((t) => pcOf(t.note)));
      const outside = openPcs.filter((p) => !pcs.has(p)).length;
      if (outside <= 1) ringingChords.push({ chord, outside });
    }
  }
  ringingChords.sort((a, b) => a.outside - b.outside);

  return {
    key,
    strings,
    inScale: strings.filter((s) => s.inScale).length,
    inTonicChord: strings.filter((s) => s.inTonicChord).length,
    bassIsTonic: openPcs[0] === pcOf(key.tonic),
    ringingChords,
  };
}

function accidentals(key: Key): number {
  return key.notes.reduce((a, n) => a + Math.abs(n.alter), 0);
}

/**
 * Lexicographic so the UI can say why in one sentence: scale tones on open strings,
 * then tonic-chord tones, then bass is the tonic, then registry order (major and
 * minor before the modes), then fewer accidentals.
 */
export function compareFit(a: KeyFit, b: KeyFit): number {
  return (
    b.inScale - a.inScale ||
    b.inTonicChord - a.inTonicChord ||
    Number(b.bassIsTonic) - Number(a.bassIsTonic) ||
    SCALE_IDS.indexOf(a.key.scale.id) - SCALE_IDS.indexOf(b.key.scale.id) ||
    accidentals(a.key) - accidentals(b.key) ||
    pcOf(a.key.tonic) - pcOf(b.key.tonic)
  );
}

/** All 12 tonics for each scale in `scales`, best first. */
export function rankKeys(ins: Instrument, scales: readonly ScaleId[]): readonly KeyFit[] {
  const fits: KeyFit[] = [];
  for (const scale of scales) for (let t = 0; t < 12; t++) fits.push(keyFit(ins, keyOf(pc(t), scale)));
  return fits.sort(compareFit);
}

export interface CapoOption {
  readonly capo: Capo;
  /** What the hands play. */
  readonly shapeKey: Key;
  /** The sounding key on the capo'd instrument. */
  readonly fit: KeyFit;
}

/** Higher capos are rarely useful. One constant. */
export const CAPO_SEARCH_MAX = 7;

/** "I want to sound in key Y. Where should the capo go?" Ties go to the lower capo. */
export function capoOptions(tuning: Tuning, sounding: Key): readonly CapoOption[] {
  const options: CapoOption[] = [];
  for (let capo = 0; capo <= CAPO_SEARCH_MAX; capo++) {
    options.push({
      capo: capo as Capo,
      shapeKey: shapeKey(sounding, capo as Capo),
      fit: keyFit(instrument(tuning, capo as Capo), sounding),
    });
  }
  return options.sort((a, b) => compareFit(a.fit, b.fit) || a.capo - b.capo);
}
