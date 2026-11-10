import {
  asCapo, formatRoman, isScaleId, keyOf, parseRoman, parseTuning, pc, pcOf, shapeKey, soundingKey, TUNINGS, tuningText,
  type Capo, type Chord, type Pc, type RomanChord, type ScaleId, type Tuning,
} from "../theory";

export type LabelMode = "note" | "degree" | "shape";

/** Everything persisted in the URL hash. The key is always the sounding key. */
export interface Settings {
  readonly tuning: Tuning;
  readonly capo: Capo;
  readonly tonic: Pc;
  readonly scale: ScaleId;
  readonly labels: LabelMode;
  readonly progression: readonly RomanChord[];
}

export interface AppState {
  readonly settings: Settings;
  /** The chord whose voicings are shown. Not persisted. */
  readonly selected: Chord | null;
  /** Step index to voicing id. Not persisted. */
  readonly pins: Readonly<Record<number, string>>;
}

export type AppAction =
  | { readonly type: "setTuning"; readonly tuning: Tuning }
  /** "sound" keeps the sounding key and changes the shapes. "shapes" keeps the shapes and moves the sound. */
  | { readonly type: "setCapo"; readonly capo: Capo; readonly hold: "sound" | "shapes" }
  | { readonly type: "setKey"; readonly tonic: Pc; readonly scale: ScaleId; readonly frame: "sounding" | "shape" }
  | { readonly type: "setLabels"; readonly labels: LabelMode }
  | { readonly type: "select"; readonly chord: Chord | null }
  | { readonly type: "appendRoman"; readonly roman: RomanChord }
  | { readonly type: "removeStep"; readonly index: number }
  | { readonly type: "moveStep"; readonly from: number; readonly to: number }
  | { readonly type: "setProgression"; readonly romans: readonly RomanChord[] }
  | { readonly type: "pin"; readonly index: number; readonly id: string | null };

function roman(text: string): RomanChord {
  const r = parseRoman(text);
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

export const DEFAULT_SETTINGS: Settings = {
  tuning: TUNINGS.dadfsae.tuning,
  capo: 0,
  tonic: pc(2),
  scale: "major",
  labels: "note",
  progression: ["I", "V", "vi", "IV"].map(roman),
};

export function appReducer(state: AppState, action: AppAction): AppState {
  const { settings } = state;
  switch (action.type) {
    case "setTuning":
      return { ...state, settings: { ...settings, tuning: action.tuning }, pins: {} };
    case "setCapo": {
      let tonic = settings.tonic;
      if (action.hold === "shapes") {
        const played = shapeKey(keyOf(settings.tonic, settings.scale), settings.capo);
        tonic = pcOf(soundingKey(played, action.capo).tonic);
      }
      return rekey(state, { ...settings, capo: action.capo, tonic });
    }
    case "setKey": {
      const tonic =
        action.frame === "sounding"
          ? action.tonic
          : pcOf(soundingKey(keyOf(action.tonic, action.scale), settings.capo).tonic);
      return rekey(state, { ...settings, tonic, scale: action.scale });
    }
    case "setLabels":
      return { ...state, settings: { ...settings, labels: action.labels } };
    case "select":
      return { ...state, selected: action.chord };
    case "appendRoman":
      return { ...state, settings: { ...settings, progression: [...settings.progression, action.roman] } };
    case "removeStep": {
      const progression = settings.progression.filter((_, i) => i !== action.index);
      const pins = remapPins(state.pins, settings.progression.length, (i) =>
        i === action.index ? null : i > action.index ? i - 1 : i,
      );
      return { ...state, settings: { ...settings, progression }, pins };
    }
    case "moveStep": {
      const { from, to } = action;
      const n = settings.progression.length;
      if (from === to || from < 0 || to < 0 || from >= n || to >= n) return state;
      const progression = settings.progression.slice();
      const [moved] = progression.splice(from, 1);
      progression.splice(to, 0, moved!);
      const pins = remapPins(state.pins, n, (i) => {
        if (i === from) return to;
        if (from < to && i > from && i <= to) return i - 1;
        if (from > to && i >= to && i < from) return i + 1;
        return i;
      });
      return { ...state, settings: { ...settings, progression }, pins };
    }
    case "setProgression":
      return { ...state, settings: { ...settings, progression: action.romans }, pins: {} };
    case "pin": {
      const pins = { ...state.pins };
      if (action.id === null) delete pins[action.index];
      else pins[action.index] = action.id;
      return { ...state, pins };
    }
  }
}

/** Voicing ids are capo-relative, so a new key or capo drops pins. The selected chord is tuning-independent. */
function rekey(state: AppState, settings: Settings): AppState {
  const sameKey = settings.tonic === state.settings.tonic && settings.scale === state.settings.scale;
  return { ...state, settings, pins: {}, selected: sameKey ? state.selected : null };
}

function remapPins(
  pins: Readonly<Record<number, string>>,
  length: number,
  to: (i: number) => number | null,
): Record<number, string> {
  const out: Record<number, string> = {};
  for (let i = 0; i < length; i++) {
    const id = pins[i];
    const j = to(i);
    if (id !== undefined && j !== null) out[j] = id;
  }
  return out;
}

export function encodeSettings(s: Settings): string {
  const params = new URLSearchParams({
    t: tuningText(s.tuning).replace(/ /g, "."),
    c: String(s.capo),
    k: String(s.tonic),
    s: s.scale,
    l: s.labels,
    p: s.progression.map(formatRoman).join(","),
  });
  return params.toString();
}

const LABEL_MODES: readonly LabelMode[] = ["note", "degree", "shape"];

/** Total: each field falls back to its own default and the rest survive. */
export function decodeSettings(hash: string): Settings {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const d = DEFAULT_SETTINGS;

  const t = params.get("t");
  const tuned = t === null ? null : parseTuning(t);
  const c = params.get("c");
  const k = params.get("k");
  const s = params.get("s");
  const l = params.get("l");
  const p = params.get("p");

  const capo = c !== null && /^\d+$/.test(c) && Number(c) <= 12 ? asCapo(Number(c)) : d.capo;
  const tonic = k !== null && /^\d+$/.test(k) && Number(k) < 12 ? pc(Number(k)) : d.tonic;
  const progression = p === null ? d.progression : parseProgression(p) ?? d.progression;

  return {
    tuning: tuned?.ok ? tuned.value : d.tuning,
    capo,
    tonic,
    scale: s !== null && isScaleId(s) ? s : d.scale,
    labels: LABEL_MODES.find((m) => m === l) ?? d.labels,
    progression,
  };
}

function parseProgression(text: string): RomanChord[] | null {
  if (text === "") return [];
  const out: RomanChord[] = [];
  for (const part of text.split(",")) {
    const r = parseRoman(part);
    if (!r.ok) return null;
    out.push(r.value);
  }
  return out;
}

export function initAppState(hash: string): AppState {
  return { settings: decodeSettings(hash), selected: null, pins: {} };
}
