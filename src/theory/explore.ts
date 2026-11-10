import {
  chordKey, chordName, chordTones, diatonicChords, explainChord, isDiatonic, type Chord,
} from "./chords";
import { capoOptions as rankCapos, CAPO_SEARCH_MAX, rankKeys, type KeyFit } from "./fit";
import {
  BOARD_FRETS, instrument, shapeKey as toShapeKey, type BoardFret, type Capo, type Fret, type Instrument,
  type StringIndex, type Tuning,
} from "./instrument";
import { displayName, intervalLabel, midiOf, pc, pcOf, type Midi, type Pc } from "./pitch";
import {
  displayRoman, LIBRARY, resolveRoman, romanOf, voiceLead, VOICE_LEADING, type ProgressionTemplate, type RomanChord,
} from "./progressions";
import { degreeLabel, keyOf, SCALE_IDS, spellIn, type Degree, type Key, type ScaleId } from "./scales";
import { generateVoicings, type Barre, type Voicing, type VoicingScore } from "./voicings";

export interface ExploreInput {
  readonly tuning: Tuning;
  readonly capo: Capo;
  /** The sounding tonic. The shape key is derived from it. */
  readonly tonic: Pc;
  readonly scale: ScaleId;
}

export interface KeyView {
  readonly name: string;
  readonly tonic: Pc;
  readonly scale: ScaleId;
  readonly notes: readonly string[];
  readonly feel: string;
}

export interface FretCellView {
  readonly fret: BoardFret;
  readonly midi: Midi;
  readonly note: string;
  /** The note's name in the shape frame; equals `note` at capo 0. */
  readonly shapeNote: string;
  readonly degree: string | null;
  readonly degreeNo: Degree | null;
  readonly isTonic: boolean;
  /** The open string at the capo, when it is a scale tone. */
  readonly isOpenRinging: boolean;
  /** False behind the capo. */
  readonly playable: boolean;
}

export interface FretboardView {
  readonly capo: Capo;
  readonly frets: number;
  readonly strings: readonly { readonly index: StringIndex; readonly open: string; readonly cells: readonly FretCellView[] }[];
}

export interface ChordCard {
  readonly id: string;
  readonly chord: Chord;
  readonly roman: RomanChord;
  readonly numeral: string;
  readonly name: string;
  /** What the hands play under a capo; null at capo 0. */
  readonly shapeName: string | null;
  readonly diatonic: boolean;
}

export interface DegreeRowView {
  readonly degree: Degree;
  readonly triad: ChordCard;
  readonly colors: readonly ChordCard[];
}

export interface VoicingView {
  readonly id: string;
  /** Capo-relative: the capo is the nut of the diagram. */
  readonly frets: readonly (Fret | null)[];
  readonly baseFret: Fret;
  readonly barre: Barre | null;
  readonly strings: readonly (
    | { readonly note: string; readonly role: string; readonly degree: Degree | null; readonly open: boolean }
    | null
  )[];
  readonly name: string;
  readonly shapeName: string | null;
  /** Sounding pitches, low to high. */
  readonly midis: readonly Midi[];
  readonly score: VoicingScore;
  readonly badges: readonly string[];
}

export interface ProgressionStepView extends ChordCard {
  readonly voicing: VoicingView | null;
  /** The candidates the voice-leading pass chose among, plus the pinned one. */
  readonly alternatives: readonly VoicingView[];
  readonly pinned: boolean;
}

export interface ProgressionView {
  readonly steps: readonly ProgressionStepView[];
  readonly borrowedCount: number;
  /** Frets moved plus mute toggles along the loop, wrap-around included. */
  readonly movement: number;
}

export interface TemplateView extends ProgressionTemplate {
  readonly names: readonly string[];
  readonly numerals: readonly string[];
  readonly borrowedCount: number;
}

export interface KeyFitView {
  readonly key: KeyView;
  readonly strings: KeyFit["strings"];
  readonly inScale: number;
  readonly inTonicChord: number;
  readonly bassIsTonic: boolean;
  readonly ringing: readonly { readonly name: string; readonly openStringsOutside: number }[];
  readonly summary: string;
}

export interface CapoOptionView {
  readonly capo: Capo;
  readonly shapeKey: KeyView;
  readonly fit: KeyFitView;
  readonly sentence: string;
  /** Diatonic triads with an easy shape (2+ open strings, span of 3 or less). Top options only. */
  readonly easyChords: number | null;
}

export interface ChordExplanationView {
  readonly name: string;
  readonly stack: readonly { readonly from: string; readonly to: string; readonly interval: string }[];
  readonly tones: readonly {
    readonly note: string;
    readonly role: string;
    readonly interval: string;
    readonly degree: string;
    readonly inScale: boolean;
  }[];
  readonly borrowed: boolean;
}

export type FitScope = "thisScale" | "allScales";

export interface Exploration {
  readonly key: KeyView;
  /** What the hands play; null at capo 0. */
  readonly shapeKey: KeyView | null;
  readonly capo: Capo;
  readonly tuningLabel: string;
  readonly capoSentence: string;
  fretboard(): FretboardView;
  keyFits(scope: FitScope): readonly KeyFitView[];
  capoOptions(): readonly CapoOptionView[];
  chords(): readonly DegreeRowView[];
  card(chord: Chord): ChordCard;
  voicings(chord: Chord, limit?: number): readonly VoicingView[];
  explain(chord: Chord): ChordExplanationView;
  progression(romans: readonly RomanChord[], pins?: Readonly<Record<number, string>>): ProgressionView;
  library(): readonly TemplateView[];
}

const EASY_TOP = 3;
const EASY_MAX_SPAN = 3;
const EASY_MIN_OPEN = 2;

function keyView(key: Key): KeyView {
  return {
    name: key.name,
    tonic: pcOf(key.tonic),
    scale: key.scale.id,
    notes: key.notes.map(displayName),
    feel: key.scale.feel,
  };
}

export function explore(input: ExploreInput): Exploration {
  const { tuning, capo } = input;
  const key = keyOf(input.tonic, input.scale);
  const ins = instrument(tuning, capo);
  const shape = capo === 0 ? null : toShapeKey(key, capo);
  const frameKey = shape ?? key;

  const voicingCache = new Map<string, readonly Voicing[]>();
  const generated = (chord: Chord, forIns: Instrument = ins): readonly Voicing[] => {
    const id = `${forIns.capo}|${chordKey(chord)}`;
    let hit = voicingCache.get(id);
    if (!hit) {
      hit = generateVoicings(chord, forIns);
      voicingCache.set(id, hit);
    }
    return hit;
  };

  const shapeChordName = (chord: Chord): string | null => {
    if (!shape) return null;
    const root = spellIn(shape, pc(pcOf(chord.root) - capo));
    return chordName({ root, quality: chord.quality });
  };

  const card = (chord: Chord): ChordCard => {
    const roman = romanOf(chord, key);
    return {
      id: chordKey(chord),
      chord,
      roman,
      numeral: displayRoman(roman),
      name: chordName(chord),
      shapeName: shapeChordName(chord),
      diatonic: isDiatonic(chord, key),
    };
  };

  const voicingView = (v: Voicing, chord: Chord): VoicingView => {
    const tones = chordTones(chord);
    const noteAt = (p: Pc) => tones.find((t) => pcOf(t.note) === p)!.note;
    const bassNote = noteAt(v.bass);
    const inverted = !v.score.rootInBass;
    const fretted = v.frets.filter((f): f is Fret => f !== null && f > 0);
    const badges: string[] = [];
    if (v.score.openStrings > 0) badges.push(`${v.score.openStrings} open string${v.score.openStrings === 1 ? "" : "s"} ring`);
    if (v.barre) badges.push("barre");
    if (inverted) badges.push("bass is not the root");
    const shapeBass = shape ? spellIn(shape, pc(v.bass - capo)) : null;
    const shapeBase = shapeChordName(chord);
    return {
      id: v.id,
      frets: v.frets,
      baseFret: (fretted.length && Math.max(...fretted) > 4 ? Math.min(...fretted) : 1) as Fret,
      barre: v.barre,
      strings: v.tones.map((t, i) =>
        t === null
          ? null
          : {
              note: displayName(noteAt(t.pc)),
              role: intervalLabel(t.role),
              degree: degreeLabel(key, t.pc).degree,
              open: v.frets[i] === 0,
            },
      ),
      name: chordName(chord) + (inverted ? `/${displayName(bassNote)}` : ""),
      shapeName: shapeBase && shapeBase + (inverted && shapeBass ? `/${displayName(shapeBass)}` : ""),
      midis: v.tones.flatMap((t) => (t ? [t.midi] : [])),
      score: v.score,
      badges,
    };
  };

  const keyFitView = (fit: KeyFit): KeyFitView => {
    const n = fit.strings.length;
    const low = fit.strings[0]!.degree;
    return {
      key: keyView(fit.key),
      strings: fit.strings,
      inScale: fit.inScale,
      inTonicChord: fit.inTonicChord,
      bassIsTonic: fit.bassIsTonic,
      ringing: fit.ringingChords.map((r) => ({ name: chordName(r.chord), openStringsOutside: r.openStringsOutside })),
      summary:
        `${fit.inScale}/${n} open strings in key, ${fit.inTonicChord} in the tonic chord, ` +
        (fit.bassIsTonic ? "low string is the root" : `low string is the ${low}`),
    };
  };

  const fitCache = new Map<FitScope, readonly KeyFitView[]>();
  let capoCache: readonly CapoOptionView[] | null = null;
  let boardCache: FretboardView | null = null;

  const capoSentence = (() => {
    if (capo === 0) return "No capo, so the open strings sound as tuned.";
    const raised = tuning.strings.map((s) => displayName(spellIn(key, pc(midiOf(s) + capo))));
    const shapeName = shape!.name;
    return (
      `Capo ${capo} raises every open string ${capo} semitone${capo === 1 ? "" : "s"}. ` +
      `${tuning.strings.map((s) => displayName(s.note)).join(" ")} becomes ${raised.join(" ")}, ` +
      `so ${shapeName} shapes sound as ${key.name}.`
    );
  })();

  const easyCount = (forIns: Instrument): number =>
    diatonicChords(key).filter((row) =>
      generated(row.triad, forIns).some((v) => v.score.openStrings >= EASY_MIN_OPEN && v.score.span <= EASY_MAX_SPAN),
    ).length;

  return {
    key: keyView(key),
    shapeKey: shape && keyView(shape),
    capo,
    tuningLabel: tuning.label,
    capoSentence,

    fretboard() {
      if (boardCache) return boardCache;
      boardCache = {
        capo,
        frets: BOARD_FRETS,
        strings: tuning.strings.map((open, s) => ({
          index: s,
          open: displayName(open.note),
          cells: Array.from({ length: BOARD_FRETS + 1 }, (_, f): FretCellView => {
            const midi = (midiOf(open) + f) as Midi;
            const d = degreeLabel(key, pc(midi));
            return {
              fret: f as BoardFret,
              midi,
              note: displayName(spellIn(key, pc(midi))),
              shapeNote: displayName(spellIn(frameKey, pc(midi - capo))),
              degree: d.inScale ? d.label : null,
              degreeNo: d.degree,
              isTonic: pc(midi) === pcOf(key.tonic),
              isOpenRinging: f === capo && d.inScale,
              playable: f >= capo,
            };
          }),
        })),
      };
      return boardCache;
    },

    keyFits(scope) {
      let hit = fitCache.get(scope);
      if (!hit) {
        hit = rankKeys(ins, scope === "thisScale" ? [input.scale] : SCALE_IDS).map(keyFitView);
        fitCache.set(scope, hit);
      }
      return hit;
    },

    capoOptions() {
      capoCache ??= rankCapos(tuning, key)
        .filter((o) => o.capo <= CAPO_SEARCH_MAX)
        .map((o, i): CapoOptionView => ({
          capo: o.capo,
          shapeKey: keyView(o.shapeKey),
          fit: keyFitView(o.fit),
          sentence:
            o.capo === 0
              ? `No capo: play ${o.shapeKey.name} shapes.`
              : `Capo ${o.capo}: play ${o.shapeKey.name} shapes.`,
          easyChords: i < EASY_TOP ? easyCount(instrument(tuning, o.capo)) : null,
        }));
      return capoCache;
    },

    chords() {
      return diatonicChords(key).map((row) => ({
        degree: row.degree,
        triad: card(row.triad),
        colors: row.colors.map(card),
      }));
    },

    card,

    voicings(chord, limit = 12) {
      return generated(chord).slice(0, limit).map((v) => voicingView(v, chord));
    },

    explain(chord) {
      const e = explainChord(chord, key);
      return {
        name: chordName(chord),
        stack: e.stack.map((s) => ({ from: displayName(s.from), to: displayName(s.to), interval: s.interval })),
        tones: e.tones.map((t) => ({ ...t, note: displayName(t.note) })),
        borrowed: e.borrowed,
      };
    },

    progression(romans, pins = {}) {
      const chords = romans.map((r) => resolveRoman(r, key));
      const all = chords.map((c) => generated(c));
      const pinned = all.map((list, i) => (pins[i] === undefined ? undefined : list.find((v) => v.id === pins[i])));
      const led = voiceLead(all.map((list, i) => (pinned[i] ? [pinned[i]!] : list)));
      const steps = chords.map((chord, i): ProgressionStepView => {
        const chosen = led.chosen[i] ?? null;
        const alts = all[i]!.slice(0, VOICE_LEADING.candidatesPerStep);
        const withPin = pinned[i] && !alts.includes(pinned[i]!) ? [pinned[i]!, ...alts] : alts;
        return {
          ...card(chord),
          voicing: chosen && voicingView(chosen, chord),
          alternatives: withPin.map((v) => voicingView(v, chord)),
          pinned: pinned[i] !== undefined,
        };
      });
      return { steps, borrowedCount: steps.filter((s) => !s.diatonic).length, movement: led.movement };
    },

    library() {
      return LIBRARY.map((t) => {
        const chords = t.romans.map((r) => resolveRoman(r, key));
        return {
          ...t,
          names: chords.map(chordName),
          numerals: t.romans.map(displayRoman),
          borrowedCount: chords.filter((c) => !isDiatonic(c, key)).length,
        };
      });
    },
  };
}
