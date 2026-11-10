import type { Chord, Exploration, Midi } from "../theory";
import { ChordDiagram } from "./ChordDiagram";

interface Props {
  ex: Exploration;
  chord: Chord;
  onStrum: (ms: readonly Midi[]) => void;
}

export function VoicingPanel({ ex, chord, onStrum }: Props) {
  const card = ex.card(chord);
  const voicings = ex.voicings(chord, 12);
  const why = ex.explain(chord);
  const outside = why.tones.filter((t) => !t.inScale).map((t) => t.note);

  return (
    <section className="panel" aria-labelledby="voicings-h">
      <h2 id="voicings-h">
        Voicings for {card.name}
        {card.shapeName && ` (you fret ${card.shapeName})`}
      </h2>
      <div className="why">
        <p>
          <strong>{why.name}</strong> stacks{" "}
          {why.stack.map((s, i) => (
            <span key={i}>
              {i > 0 && (i === why.stack.length - 1 ? ", then " : ", ")}a {s.interval} ({s.from} to {s.to})
            </span>
          ))}
          .
        </p>
        <p>
          Its tones are{" "}
          {why.tones.map((t, i) => (
            <span key={i}>
              {i > 0 && ", "}
              {t.note} ({t.role}, degree {t.degree} of {ex.key.name})
            </span>
          ))}
          .{" "}
          {why.borrowed
            ? `${outside.join(" and ")} ${outside.length > 1 ? "are" : "is"} outside ${ex.key.name}, so this chord is borrowed.`
            : `Every tone is in ${ex.key.name}, so the chord belongs to the key.`}
        </p>
      </div>
      {voicings.length === 0 ? (
        <p className="hint">No playable shape within a 4-fret span and 4 fingers on this tuning and capo.</p>
      ) : (
        <div className="diagrams">
          {voicings.map((v) => (
            <button
              key={v.id}
              className="diagram"
              onClick={() => onStrum(v.midis)}
              aria-label={`Strum ${v.name}, frets ${v.frets.map((f) => (f === null ? "muted" : f)).join(" ")}. ${v.badges.join(", ")}`}
            >
              <span className="name">{v.name}</span>
              <ChordDiagram voicing={v} capo={ex.capo} />
              <span className="frets">{v.frets.map((f) => (f === null ? "x" : f)).join(" ")}</span>
              <span className="badges">
                {v.badges.map((b) => (
                  <span key={b} className={`badge ${b.includes("open") ? "good" : "warn"}`}>{b}</span>
                ))}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
