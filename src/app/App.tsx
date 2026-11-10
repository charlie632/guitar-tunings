import { useEffect, useMemo, useReducer, useState } from "react";
import { explore } from "../theory";
import { CapoPanel } from "./CapoPanel";
import { ChordGrid } from "./ChordGrid";
import { Controls, type CapoHold } from "./Controls";
import { Fretboard } from "./Fretboard";
import { KeyFit } from "./KeyFit";
import { ProgressionPanel } from "./ProgressionPanel";
import { appReducer, encodeSettings, initAppState } from "./settings";
import { usePlayer } from "./usePlayer";
import { VoicingPanel } from "./VoicingPanel";

export function App() {
  const [state, dispatch] = useReducer(appReducer, undefined, () => initAppState(window.location.hash));
  const [hold, setHold] = useState<CapoHold>("sound");
  const { settings } = state;
  const { tuning, capo, tonic, scale } = settings;

  const ex = useMemo(() => explore({ tuning, capo, tonic, scale }), [tuning, capo, tonic, scale]);
  const player = usePlayer();

  useEffect(() => {
    window.history.replaceState(null, "", "#" + encodeSettings(settings));
  }, [settings]);

  const selected = state.selected ?? ex.chords()[0]!.triad.chord;

  return (
    <div className="shell">
      <header className="top">
        <h1>Tuning Explorer</h1>
        <p>Pick a tuning, a key and a capo. See the scale, the chords that ring, and progressions that fit under your hands.</p>
      </header>

      <section className="panel" aria-labelledby="setup-h">
        <h2 id="setup-h" className="sr">Setup</h2>
        <Controls settings={settings} ex={ex} hold={hold} onHold={setHold} dispatch={dispatch} />
      </section>

      <Fretboard
        ex={ex}
        labels={settings.labels}
        onLabels={(labels) => dispatch({ type: "setLabels", labels })}
        onPluck={(m) => player.pluck(m)}
      />

      <div className="cols">
        <KeyFit ex={ex} dispatch={dispatch} />
        <CapoPanel ex={ex} settings={settings} dispatch={dispatch} />
      </div>

      <ChordGrid ex={ex} selected={selected} dispatch={dispatch} />
      <VoicingPanel ex={ex} chord={selected} onStrum={(ms) => player.strum(ms)} />
      <ProgressionPanel ex={ex} romans={settings.progression} pins={state.pins} dispatch={dispatch} player={player} />

      <footer>Settings live in the URL, so copy the address to share this view. Sound is synthesized in your browser.</footer>
    </div>
  );
}
