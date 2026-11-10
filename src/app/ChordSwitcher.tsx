import type { Dispatch } from "react";
import { chordKey, type Chord, type ChordCard, type Degree, type Exploration } from "../theory";
import { degreeColor } from "./colors";
import type { AppAction } from "./settings";

export function ChordSwitcher({ ex, selected, dispatch }: { ex: Exploration; selected: Chord; dispatch: Dispatch<AppAction> }) {
  const selectedId = chordKey(selected);
  const chips: { card: ChordCard; degree: Degree | null }[] = ex.chords().flatMap(({ degree, triad, colors }) => {
    const picked = colors.find((c) => c.id === selectedId);
    return picked ? [{ card: triad, degree }, { card: picked, degree }] : [{ card: triad, degree }];
  });
  if (!chips.some((c) => c.card.id === selectedId)) chips.push({ card: ex.card(selected), degree: null });

  return (
    <div className="switcher" role="group" aria-label={`Chords in ${ex.key.name}`}>
      {chips.map(({ card, degree }) => (
        <button
          key={card.id}
          className="chip"
          style={{ ["--deg-color" as string]: degreeColor(degree) }}
          aria-pressed={card.id === selectedId}
          onClick={() => dispatch({ type: "select", chord: card.chord })}
        >
          <small>{card.numeral}</small>
          {card.name}
        </button>
      ))}
    </div>
  );
}
