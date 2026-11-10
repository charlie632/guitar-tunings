import { useId, useState, type Dispatch } from "react";
import { describeTuningError, parseTuning, TUNING_IDS, TUNINGS, tuningText, type Tuning } from "../theory";
import type { AppAction } from "./settings";

const CUSTOM = "custom";

export function TuningPicker({ tuning, dispatch }: { tuning: Tuning; dispatch: Dispatch<AppAction> }) {
  const id = useId();
  const [draft, setDraft] = useState(() => tuningText(tuning));
  const [error, setError] = useState<string | null>(null);

  const current = tuningText(tuning);
  const presetId = TUNING_IDS.find((p) => tuningText(TUNINGS[p].tuning) === current) ?? CUSTOM;

  const onDraft = (text: string) => {
    setDraft(text);
    const r = parseTuning(text);
    if (r.ok) {
      setError(null);
      dispatch({ type: "setTuning", tuning: r.value });
    } else setError(describeTuningError(r.error));
  };

  return (
    <div className="field">
      <label className="label" htmlFor={`${id}-preset`}>Tuning</label>
      <select
        id={`${id}-preset`}
        value={presetId}
        onChange={(e) => {
          const p = TUNING_IDS.find((x) => x === e.target.value);
          if (!p) return;
          const t = TUNINGS[p].tuning;
          setDraft(tuningText(t));
          setError(null);
          dispatch({ type: "setTuning", tuning: t });
        }}
      >
        {TUNING_IDS.map((p) => (
          <option key={p} value={p}>{TUNINGS[p].name}</option>
        ))}
        {presetId === CUSTOM && <option value={CUSTOM}>Custom: {tuning.label}</option>}
      </select>
      <label className="label" htmlFor={`${id}-text`}>Custom, low string first</label>
      <input
        id={`${id}-text`}
        type="text"
        value={draft}
        spellCheck={false}
        autoComplete="off"
        aria-invalid={error !== null}
        aria-describedby={`${id}-msg`}
        onChange={(e) => onDraft(e.target.value)}
        onBlur={() => {
          if (!error) setDraft(current);
        }}
      />
      <p id={`${id}-msg`} className={error ? "error" : "hint"} role={error ? "alert" : undefined}>
        {error ?? "Try DADGAD, D A D F# A E, or D2 A2 D3 G3 A3 D4."}
      </p>
    </div>
  );
}
