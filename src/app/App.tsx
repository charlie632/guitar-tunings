import { useEffect, useMemo, useReducer, useRef, useState, type MouseEvent } from "react";
import { explore, type Chord } from "../theory";
import { CapoPanel } from "./CapoPanel";
import { ChordGrid } from "./ChordGrid";
import { ChordSwitcher } from "./ChordSwitcher";
import { Controls, type CapoHold } from "./Controls";
import { Fretboard } from "./Fretboard";
import { KeyFit } from "./KeyFit";
import { ProgressionPanel } from "./ProgressionPanel";
import { Rail } from "./Rail";
import { SECTION_LABELS, type Section } from "./sections";
import { appReducer, decodeSection, encodeHash, initAppState } from "./settings";
import { usePlayer } from "./usePlayer";
import { VoicingPanel } from "./VoicingPanel";

export function App() {
  const [state, dispatch] = useReducer(appReducer, undefined, () => initAppState(window.location.hash));
  const [hold, setHold] = useState<CapoHold>("keepSound");
  const mainRef = useRef<HTMLElement>(null);
  const { settings, section } = state;
  const { tuning, capo, soundingTonic: tonic, scale } = settings;

  const ex = useMemo(() => explore({ tuning, capo, tonic, scale }), [tuning, capo, tonic, scale]);
  const player = usePlayer();

  useEffect(() => {
    const hash = "#" + encodeHash(state);
    if (hash === window.location.hash) return;
    const leavingSection = decodeSection(window.location.hash) !== state.section;
    window.history[leavingSection ? "pushState" : "replaceState"](null, "", hash);
  }, [state]);

  useEffect(() => {
    // The browser would otherwise restore the old scroll offset after our scroll-to-top on Back.
    window.history.scrollRestoration = "manual";
    const hydrate = () => dispatch({ type: "hydrate", hash: window.location.hash });
    window.addEventListener("popstate", hydrate);
    window.addEventListener("hashchange", hydrate);
    return () => {
      window.removeEventListener("popstate", hydrate);
      window.removeEventListener("hashchange", hydrate);
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [section]);

  const selected = state.selected ?? ex.chords()[0]!.triad.chord;
  const selectedName = ex.card(selected).name;

  const open = (to: Section, moveFocus: boolean, chord?: Chord) => {
    dispatch({ type: "open", section: to, chord });
    if (moveFocus) mainRef.current?.focus({ preventScroll: true });
  };

  const sectionLink = (to: Section, moveFocus: boolean) => ({
    href: "#" + encodeHash({ ...state, section: to }),
    onClick: (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      open(to, moveFocus);
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
        return (
          <ProgressionPanel
            ex={ex}
            romans={settings.progression}
            pins={state.pins}
            dispatch={dispatch}
            player={player}
            onOpenChord={(chord) => open("voicings", true, chord)}
          />
        );
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

      <Rail section={section} link={(to) => sectionLink(to, false)} summary={`${tuning.label} · ${ex.key.name} · capo ${capo}`}>
        <Controls settings={settings} ex={ex} hold={hold} onHold={setHold} dispatch={dispatch} />
      </Rail>

      <main ref={mainRef} className="main" tabIndex={-1} aria-label={SECTION_LABELS[section]}>
        {panels()}
        <footer>Settings and the open section live in the URL, so copy the address to share this view. Your browser synthesizes the sound.</footer>
      </main>
    </div>
  );
}
