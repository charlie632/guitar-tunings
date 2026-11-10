import { QUALITIES, QUALITY_IDS, type Chord, type QualityId } from "./chords";
import { accidentalPrefix, interval, intervalBetween, transpose, type Interval, type Result } from "./pitch";
import type { Key, ScaleId } from "./scales";
import type { Voicing } from "./voicings";

/**
 * `step` is the spelled interval from the tonic to the chord root, measured against
 * the major scale as songbooks do: bVII = m7, bIII = m3. The spelling makes bVI in E
 * come out as C, not B#. In a minor key the numerals read i bIII iv v bVI bVII.
 */
export interface RomanChord {
  readonly step: Interval;
  readonly quality: QualityId;
}

const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII"];
const MAJOR_SEMIS = [0, 2, 4, 5, 7, 9, 11];

const BY_NUMERAL_FORM = new Map<string, QualityId>();
for (const id of QUALITY_IDS) {
  const { numeralCase, suffix } = QUALITIES[id].roman;
  for (const u of numeralCase === "either" ? [true, false] : [numeralCase === "upper"]) BY_NUMERAL_FORM.set(`${u}|${suffix}`, id);
}

const ROMAN_RE = /^([#b]?)(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(.*)$/;

export function parseRoman(text: string): Result<RomanChord, string> {
  const m = ROMAN_RE.exec(text.trim().replace(/♯/g, "#").replace(/♭/g, "b"));
  if (!m) return { ok: false, error: `"${text}" is not a Roman numeral chord` };
  const numeral = m[2]!;
  const upper = numeral === numeral.toUpperCase();
  const quality = BY_NUMERAL_FORM.get(`${upper}|${m[3]!}`);
  if (!quality) return { ok: false, error: `"${text}" has an unknown chord suffix "${m[3]}"` };
  const degree = NUMERALS.indexOf(numeral.toUpperCase()) + 1;
  return { ok: true, value: { step: interval(m[1]! + degree), quality } };
}

function format(r: RomanChord, sharp: string, flat: string): string {
  const steps = r.step.steps % 7;
  const alter = r.step.semis - MAJOR_SEMIS[steps]!;
  const { numeralCase, suffix } = QUALITIES[r.quality].roman;
  const numeral = NUMERALS[steps]!;
  const accidental = alter >= 0 ? sharp.repeat(alter) : flat.repeat(-alter);
  return accidental + (numeralCase === "lower" ? numeral.toLowerCase() : numeral) + suffix;
}

/** ASCII accidentals for the URL: "bVII", "IVmaj7". */
export function formatRoman(r: RomanChord): string {
  return format(r, "#", "b");
}

/** With real accidental glyphs for display: "♭VII". */
export function displayRoman(r: RomanChord): string {
  const alter = r.step.semis - MAJOR_SEMIS[r.step.steps % 7]!;
  return accidentalPrefix(alter) + format({ ...r, step: { ...r.step, semis: MAJOR_SEMIS[r.step.steps % 7]! } }, "", "");
}

export function resolveRoman(r: RomanChord, key: Key): Chord {
  return { root: transpose(key.tonic, r.step), quality: r.quality };
}

export function romanOf(c: Chord, key: Key): RomanChord {
  return { step: intervalBetween(key.tonic, c.root), quality: c.quality };
}

export type ProgressionTag = "pop" | "emo" | "midwest" | "jazz" | "modal" | "minor";

export interface ProgressionTemplate {
  readonly id: string;
  readonly name: string;
  readonly tags: readonly ProgressionTag[];
  /** The scale it lives in. Every template resolves in any key. */
  readonly home: ScaleId;
  readonly romans: readonly RomanChord[];
  readonly note: string;
}

const TEMPLATE_SOURCE: readonly {
  id: string; name: string; tags: readonly ProgressionTag[]; home: ScaleId; romans: string; note: string;
}[] = [
  { id: "axis", name: "Four-chord axis", tags: ["pop"], home: "major", romans: "I V vi IV",
    note: "The most-used pop loop. vi is its only minor chord." },
  { id: "sensitive", name: "Sensitive axis", tags: ["pop", "emo"], home: "major", romans: "vi IV I V",
    note: "The axis loop started on vi. Home only arrives on the third chord." },
  { id: "fifties", name: "Fifties turnaround", tags: ["pop"], home: "major", romans: "I vi IV V",
    note: "Home, the relative minor, then IV and V lead back to home." },
  { id: "royal-road", name: "Royal road", tags: ["pop", "midwest"], home: "major", romans: "IVmaj7 V iii7 vi",
    note: "IV to V, then down to the minor iii and vi. IV and iii carry a 7th on top." },
  { id: "add9-drift", name: "Add9 drift", tags: ["midwest", "emo"], home: "major", romans: "Iadd9 IVadd9 vi7 Vsus4",
    note: "Every chord has an added 9th, a 7th or a sus4, and the loop ends on Vsus4 instead of V." },
  { id: "twinkle", name: "Twinkle loop", tags: ["midwest", "emo"], home: "major", romans: "Imaj7 iii7 IVmaj7 Vsus4",
    note: "iii, IV and V climb one scale step at a time. Vsus4 never resolves to V before the loop restarts." },
  { id: "unresolved", name: "Unresolved descent", tags: ["emo"], home: "major", romans: "vi IV V iii",
    note: "Ends on iii instead of I. iii shares two notes with I, so it sits close to home without landing." },
  { id: "bittersweet-iv", name: "Bittersweet iv", tags: ["emo", "pop"], home: "major", romans: "I IV iv I",
    note: "iv comes from the parallel minor. Going from IV to iv drops one note, the 3rd, a half step." },
  { id: "borrowed-lift", name: "Borrowed lift", tags: ["emo", "pop"], home: "major", romans: "I bVI bVII I",
    note: "bVI and bVII come from the parallel minor and climb by whole steps back to I." },
  { id: "ii-v-i", name: "ii V I", tags: ["jazz"], home: "major", romans: "ii7 V7 Imaj7",
    note: "The standard jazz cadence. Each root falls a fifth to the next." },
  { id: "minor-ii-v-i", name: "Minor ii V i", tags: ["jazz", "minor"], home: "minor", romans: "iiø7 V7 i",
    note: "V7 takes the raised 7th from harmonic minor, a half step below home." },
  { id: "mixo-vamp", name: "Mixolydian vamp", tags: ["modal"], home: "mixolydian", romans: "I bVII IV I",
    note: "bVII stands in for V, so no chord has a note a half step below home." },
  { id: "dorian-vamp", name: "Dorian vamp", tags: ["modal"], home: "dorian", romans: "i IV",
    note: "Minor home with a major IV. The scale's natural 6th is the 3rd of IV." },
  { id: "lydian-float", name: "Lydian float", tags: ["modal"], home: "lydian", romans: "I II",
    note: "II is major because its 3rd is the scale's #4." },
  { id: "minor-epic", name: "Minor epic", tags: ["minor", "emo"], home: "minor", romans: "i bVI bIII bVII",
    note: "Natural minor chords only, climbing to bVII and back to i." },
  { id: "minor-axis", name: "Minor shuttle", tags: ["minor", "emo"], home: "minor", romans: "i bVII bVI bVII",
    note: "Rocks between bVII and bVI under a minor home." },
  { id: "andalusian", name: "Andalusian descent", tags: ["minor", "modal"], home: "phrygian", romans: "i bVII bVI V",
    note: "Steps down from i to bVI, then lands on a major V. Common in flamenco." },
];

function parseOrThrow(text: string): RomanChord {
  const r = parseRoman(text);
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

export const LIBRARY: readonly ProgressionTemplate[] = TEMPLATE_SOURCE.map((t) => ({
  ...t,
  romans: t.romans.split(" ").map(parseOrThrow),
}));

export interface VoiceLeadingCost {
  readonly perFretMoved: number;
  readonly muteToggle: number;
  readonly sharedOpenString: number;
  readonly shapeScoreWeight: number;
  readonly candidatesPerStep: number;
}

export const VOICE_LEADING: VoiceLeadingCost = {
  perFretMoved: 1,
  muteToggle: 0.5,
  sharedOpenString: -1,
  shapeScoreWeight: 0.3,
  candidatesPerStep: 10,
};

function movementBetween(a: Voicing, b: Voicing): number {
  let m = 0;
  for (let s = 0; s < a.frets.length; s++) {
    const fa = a.frets[s]!;
    const fb = b.frets[s]!;
    if (fa !== null && fb !== null) m += VOICE_LEADING.perFretMoved * Math.abs(fa - fb);
    else if (fa !== fb) m += VOICE_LEADING.muteToggle;
  }
  return m;
}

function edgeCost(a: Voicing, b: Voicing): number {
  let drones = 0;
  for (let s = 0; s < a.frets.length; s++) if (a.frets[s] === 0 && b.frets[s] === 0) drones++;
  return movementBetween(a, b) + VOICE_LEADING.sharedOpenString * drones;
}

function nodeCost(v: Voicing): number {
  return -VOICE_LEADING.shapeScoreWeight * v.score.total;
}

export interface VoiceLed {
  readonly chosen: readonly (Voicing | null)[];
  readonly movement: number;
}

export function voiceLead(candidates: readonly (readonly Voicing[])[]): VoiceLed {
  const live = candidates
    .map((c, i) => ({ i, c: c.slice(0, VOICE_LEADING.candidatesPerStep) }))
    .filter((x) => x.c.length > 0);
  const chosen: (Voicing | null)[] = candidates.map(() => null);
  if (live.length === 0) return { chosen, movement: 0 };
  if (live.length === 1) {
    chosen[live[0]!.i] = live[0]!.c[0]!;
    return { chosen, movement: 0 };
  }

  let best: { cost: number; path: Voicing[] } | null = null;
  for (const first of live[0]!.c) {
    let costs = new Map<Voicing, { cost: number; path: Voicing[] }>([[first, { cost: nodeCost(first), path: [first] }]]);
    for (let k = 1; k < live.length; k++) {
      const next = new Map<Voicing, { cost: number; path: Voicing[] }>();
      for (const v of live[k]!.c) {
        let pick: { cost: number; path: Voicing[] } | null = null;
        let pickCost = Infinity;
        for (const [prev, entry] of costs) {
          const c = entry.cost + edgeCost(prev, v);
          if (c < pickCost) {
            pickCost = c;
            pick = entry;
          }
        }
        next.set(v, { cost: pickCost + nodeCost(v), path: [...pick!.path, v] });
      }
      costs = next;
    }
    for (const [last, entry] of costs) {
      const total = entry.cost + edgeCost(last, first);
      if (!best || total < best.cost) best = { cost: total, path: entry.path };
    }
  }

  const path = best!.path;
  let movement = movementBetween(path[path.length - 1]!, path[0]!);
  path.forEach((v, k) => {
    chosen[live[k]!.i] = v;
    if (k > 0) movement += movementBetween(path[k - 1]!, v);
  });
  return { chosen, movement };
}
