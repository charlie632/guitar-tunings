import type { Dispatch } from "react";
import { keyOf, pc, type Exploration } from "../theory";
import type { AppAction, Settings } from "./settings";

export function CapoPanel({ ex, settings, dispatch }: { ex: Exploration; settings: Settings; dispatch: Dispatch<AppAction> }) {
  const options = ex.capoOptions().slice(0, 4);
  const shapeTonic = ex.shapeKey?.tonic ?? ex.key.tonic;

  return (
    <section className="panel" aria-labelledby="capo-h">
      <h2 id="capo-h">Capo</h2>
      <p className="sentence">{ex.capoSentence}</p>

      <div className="capo-grid">
        <div className="field" style={{ marginTop: 12 }}>
          <label className="label" htmlFor="shape-tonic">If I play the shapes of</label>
          <select
            id="shape-tonic"
            value={shapeTonic}
            onChange={(e) =>
              dispatch({ type: "setKey", tonic: pc(Number(e.target.value)), scale: settings.scale, frame: "shape" })
            }
          >
            {Array.from({ length: 12 }, (_, t) => (
              <option key={t} value={t}>
                {keyOf(pc(t), settings.scale).name}
              </option>
            ))}
          </select>
          <p className="hint">
            {ex.capo === 0
              ? "With no capo, the shapes sound in the key you play. Move the capo to see them split."
              : `With the capo at ${ex.capo}, they sound in ${ex.key.name}.`}
          </p>
        </div>

        <div className="field">
          <span className="label">To sound in {ex.key.name}, put the capo at</span>
          {options.map((o) => (
            <button
              key={o.capo}
              className="capo-opt"
              aria-current={o.capo === ex.capo}
              onClick={() => dispatch({ type: "setCapo", capo: o.capo, hold: "keepSound" })}
            >
              <strong>{o.sentence}</strong>
              <span>
                {o.fit.summary}.
                {o.easyChords !== null && ` ${o.easyChords} of 7 triads have an easy open shape.`}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
