import { useState, type Dispatch } from "react";
import type { Exploration, FitScope } from "../theory";
import type { AppAction } from "./settings";

const SHOWN = 6;

export function KeyFit({ ex, dispatch }: { ex: Exploration; dispatch: Dispatch<AppAction> }) {
  const [scope, setScope] = useState<FitScope>("thisScale");
  const [all, setAll] = useState(false);
  const fits = ex.keyFits(scope);
  const visible = all ? fits : fits.slice(0, SHOWN);

  return (
    <section className="panel" aria-labelledby="fit-h">
      <h2 id="fit-h">Best keys for this tuning</h2>
      <p className="sub">
        Keys ranked by how many of your open strings are in the scale. Each card shows the open strings as scale degrees,
        dimmed when they fall outside the scale, and the chords you can strum with the open strings ringing. Tap a key to switch to it.
      </p>
      <div className="seg" role="radiogroup" aria-label="Which scales to rank" style={{ marginBottom: 10 }}>
        <button role="radio" aria-checked={scope === "thisScale"} onClick={() => setScope("thisScale")}>This scale</button>
        <button role="radio" aria-checked={scope === "allScales"} onClick={() => setScope("allScales")}>All scales</button>
      </div>
      <div className="fits">
        {visible.map((f) => {
          const current = f.key.tonic === ex.key.tonic && f.key.scale === ex.key.scale;
          return (
            <button
              key={`${f.key.tonic}:${f.key.scale}`}
              className="fit"
              aria-current={current}
              onClick={() => dispatch({ type: "setKey", tonic: f.key.tonic, scale: f.key.scale, frame: "sounding" })}
            >
              <h3>{f.key.name}</h3>
              <p>{f.summary}</p>
              <span className="chips" aria-label="Open strings, low to high, as scale degrees">
                {f.strings.map((s, i) => (
                  <span
                    key={i}
                    className={`stringchip ${!s.inScale ? "out" : s.inTonicChord ? "in tonic" : "in"}`}
                    title={`String ${i + 1}: ${s.inScale ? `degree ${s.degree}` : "not in the scale"}${s.inTonicChord ? ", in the tonic chord" : ""}`}
                  >
                    {s.degree}
                  </span>
                ))}
              </span>
              {f.ringing.length > 0 && (
                <span className="chips" aria-label="Chords that ring open">
                  {f.ringing.slice(0, 6).map((r) => (
                    <span key={r.name} className={`ringchip${r.openStringsOutside ? " one" : ""}`} title={r.openStringsOutside ? "One open string is outside this chord" : "Every open string is in this chord"}>
                      {r.name}
                    </span>
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {fits.length > SHOWN && (
        <p style={{ marginBottom: 0 }}>
          <button className="btn small" onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show all ${fits.length}`}</button>
        </p>
      )}
    </section>
  );
}
