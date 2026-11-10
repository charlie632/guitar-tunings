import type { Dispatch } from "react";
import { chordKey, type Chord, type Exploration } from "../theory";
import { degreeColor } from "./colors";
import type { AppAction } from "./settings";

export function ChordSwitcher({ ex, selected, dispatch }: { ex: Exploration; selected: Chord; dispatch: Dispatch<AppAction> }) {
  const selectedId = chordKey(selected);
  return (
    <div className="switcher" role="group" aria-label={`Chords in ${ex.key.name}`}>
      {ex.chords().map(({ degree, triad }) => (
        <button
          key={triad.id}
          className="chip"
          style={{ ["--deg-color" as string]: degreeColor(degree) }}
          aria-pressed={triad.id === selectedId}
          onClick={() => dispatch({ type: "select", chord: triad.chord })}
        >
          <small>{triad.numeral}</small>
          {triad.name}
        </button>
      ))}
    </div>
  );
}
