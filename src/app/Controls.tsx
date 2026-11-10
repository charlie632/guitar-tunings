import type { Dispatch } from "react";
import { asCapo, displayName, keyOf, pc, SCALE_IDS, SCALES, type Exploration } from "../theory";
import type { AppAction, Settings } from "./settings";
import { TuningPicker } from "./TuningPicker";

export type CapoHold = "sound" | "shapes";

interface Props {
  settings: Settings;
  ex: Exploration;
  hold: CapoHold;
  onHold: (h: CapoHold) => void;
  dispatch: Dispatch<AppAction>;
}

export function Controls({ settings, ex, hold, onHold, dispatch }: Props) {
  const { capo, tonic, scale } = settings;
  return (
    <div className="controls">
      <TuningPicker tuning={settings.tuning} dispatch={dispatch} />

      <div className="field">
        <span className="label" id="tonic-label">Key (sounding)</span>
        <div className="tonics" role="radiogroup" aria-labelledby="tonic-label">
          {Array.from({ length: 12 }, (_, t) => {
            const name = displayName(keyOf(pc(t), scale).tonic);
            return (
              <button
                key={t}
                role="radio"
                aria-checked={t === tonic}
                className="btn"
                onClick={() => dispatch({ type: "setKey", tonic: pc(t), scale, frame: "sounding" })}
              >
                {name}
              </button>
            );
          })}
        </div>
        <p className="hint">{ex.key.name}: {ex.key.notes.join(" ")}</p>
      </div>

      <div className="field">
        <span className="label" id="scale-label">Scale</span>
        <div className="scales" role="radiogroup" aria-labelledby="scale-label">
          {SCALE_IDS.map((id) => (
            <button
              key={id}
              role="radio"
              aria-checked={id === scale}
              onClick={() => dispatch({ type: "setKey", tonic, scale: id, frame: "sounding" })}
            >
              <strong>{SCALES[id].name}</strong>
              <span>{SCALES[id].feel}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="label" id="capo-label">Capo</span>
        <div className="stepper" role="group" aria-labelledby="capo-label">
          <button
            className="btn"
            aria-label="Capo down one fret"
            disabled={capo === 0}
            onClick={() => dispatch({ type: "setCapo", capo: asCapo(capo - 1), hold })}
          >
            −
          </button>
          <output aria-live="polite">{capo}</output>
          <button
            className="btn"
            aria-label="Capo up one fret"
            disabled={capo === 12}
            onClick={() => dispatch({ type: "setCapo", capo: asCapo(capo + 1), hold })}
          >
            +
          </button>
        </div>
        <div className="seg" role="radiogroup" aria-label="What stays fixed when the capo moves">
          <button role="radio" aria-checked={hold === "sound"} onClick={() => onHold("sound")}>Keep sound</button>
          <button role="radio" aria-checked={hold === "shapes"} onClick={() => onHold("shapes")}>Keep shapes</button>
        </div>
        <p className="hint">
          {hold === "sound"
            ? "Keep sound: the key stays put and the shapes you play change."
            : "Keep shapes: you play the same shapes and the key moves up."}
        </p>
      </div>
    </div>
  );
}
