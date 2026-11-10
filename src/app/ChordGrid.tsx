import type { Dispatch } from "react";
import { chordKey, type ChordCard, type Chord, type Exploration } from "../theory";
import { degreeColor } from "./colors";
import type { AppAction } from "./settings";

interface Props {
  ex: Exploration;
  selected: Chord;
  dispatch: Dispatch<AppAction>;
}

export function ChordGrid({ ex, selected, dispatch }: Props) {
  const selectedId = chordKey(selected);
  const rows = ex.chords();

  const chip = (card: ChordCard, degree: number, color: boolean) => (
    <span key={card.id} className={`chord${color ? " color" : ""}`}>
      <button
        className="chip"
        style={{ ["--deg-color" as string]: degreeColor(degree as 1) }}
        aria-pressed={card.id === selectedId}
        onClick={() => dispatch({ type: "select", chord: card.chord })}
      >
        <span>{card.name}</span>
        {card.shapeName && !color && <small>{card.shapeName} shape</small>}
      </button>
      <button
        className="add"
        aria-label={`Add ${card.name} to progression`}
        title="Add to progression"
        onClick={() => dispatch({ type: "appendRoman", roman: card.roman })}
      >
        +
      </button>
    </span>
  );

  return (
    <section className="panel" aria-labelledby="chords-h">
      <h2 id="chords-h">Chords in {ex.key.name}</h2>
      <p className="sub">
        Numerals count from the major scale, so in minor you will see i, ♭III, iv, v, ♭VI, ♭VII. Click a chord for shapes, + to add it to a progression.
        {ex.capo > 0 && ` Under the capo each chord shows the shape you fret.`}
      </p>
      <div className="chordrows">
        {rows.map((row) => (
          <div className="chordrow" key={row.degree}>
            <div className="numeral">
              {row.triad.numeral}
              <small>deg {row.degree}</small>
            </div>
            <div className="chordset">
              {chip(row.triad, row.degree, false)}
              {row.colors.map((c) => chip(c, row.degree, true))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
