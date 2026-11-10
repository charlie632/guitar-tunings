import { useEffect, useMemo, useReducer, useRef, useState, type MouseEvent } from "react";
import { explore } from "../theory";
import { CapoPanel } from "./CapoPanel";
import { ChordGrid } from "./ChordGrid";
import { ChordSwitcher } from "./ChordSwitcher";
import { Controls, type CapoHold } from "./Controls";
import { Fretboard } from "./Fretboard";
import { KeyFit } from "./KeyFit";
import { ProgressionPanel } from "./ProgressionPanel";
import { SECTIONS, type Section } from "./sections";
import { appReducer, encodeHash, initAppState } from "./settings";
import { usePlayer } from "./usePlayer";
import { VoicingPanel } from "./VoicingPanel";

export function App() {
  const [state, dispatch] = useReducer(appReducer, undefined, () => initAppState(window.location.hash));
  const [hold, setHold] = useState<CapoHold>("keepSound");
  const [setupOpen, setSetupOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const { settings, section } = state;
  const { tuning, capo, soundingTonic: tonic, scale } = settings;

  const ex = useMemo(() => explore({ tuning, capo, tonic, scale }), [tuning, capo, tonic, scale]);
  const player = usePlayer();

  useEffect(() => {
    window.history.replaceState(null, "", "#" + encodeHash(state));
  }, [state]);

  const selected = state.selected ?? ex.chords()[0]!.triad.chord;
  const selectedName = ex.card(selected).name;

  const sectionLink = (to: Section, moveFocus: boolean) => ({
    href: "#" + encodeHash({ ...state, section: to }),
    onClick: (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      dispatch({ type: "setSection", section: to });
      window.scrollTo({ top: 0 });
      if (moveFocus) mainRef.current?.focus({ preventScroll: true });
    },
  });

  const panels = () => {
    switch (section) {
      case "fretboard":
        return (
          <>
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
          </>
        );
      case "chords":
        return (
          <>
            <ChordGrid ex={ex} selected={selected} dispatch={dispatch} />
            <p className="selbar">
              <span><strong>{selectedName}</strong> selected</span>
              <a className="btn primary" {...sectionLink("voicings", true)}>Voicings for {selectedName} →</a>
            </p>
          </>
        );
      case "voicings":
        return (
          <>
            <div className="selbar top">
              <ChordSwitcher ex={ex} selected={selected} dispatch={dispatch} />
              <a className="btn small" {...sectionLink("chords", true)}>All chords</a>
            </div>
            <VoicingPanel ex={ex} chord={selected} onStrum={(ms) => player.strum(ms)} />
          </>
        );
      case "progressions":
        return <ProgressionPanel ex={ex} romans={settings.progression} pins={state.pins} dispatch={dispatch} player={player} />;
    }
  };

  return (
    <div className="shell">
      <header className="brand">
        <h1>Tuning Explorer</h1>
        <a className="repo" href="https://github.com/charlie632/guitar-tunings" target="_blank" rel="noreferrer" aria-label="Source on GitHub" title="Source on GitHub">
          <svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>
      </header>

      <aside className="rail" data-open={setupOpen}>
        <nav className="sections" aria-label="Sections">
          <ul>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a aria-current={s.id === section ? "page" : undefined} {...sectionLink(s.id, false)}>{s.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <button className="summary" aria-expanded={setupOpen} aria-controls="setup" onClick={() => setSetupOpen(!setupOpen)}>
          <span className="summary-v">{tuning.label} · {ex.key.name} · capo {capo}</span>
          <span className="summary-k">{setupOpen ? "Done" : "Change"}</span>
        </button>
        <div id="setup" className="setup">
          <Controls settings={settings} ex={ex} hold={hold} onHold={setHold} dispatch={dispatch} />
        </div>
      </aside>

      <main ref={mainRef} className="main" tabIndex={-1} aria-label={SECTIONS.find((s) => s.id === section)!.label}>
        {panels()}
        <footer>Settings and the open section live in the URL, so copy the address to share this view. Your browser synthesizes the sound.</footer>
      </main>
    </div>
  );
}
