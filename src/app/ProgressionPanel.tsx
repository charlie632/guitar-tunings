import { useEffect, useMemo, useState, type Dispatch, type FormEvent } from "react";
import { parseRoman, type Chord, type Exploration, type ProgressionTag, type RomanChord } from "../theory";
import type { Player } from "../audio/player";
import { ChordDiagram } from "./ChordDiagram";
import type { AppAction } from "./settings";

interface Props {
  ex: Exploration;
  romans: readonly RomanChord[];
  pins: Readonly<Record<number, string>>;
  dispatch: Dispatch<AppAction>;
  player: Player;
  onOpenChord: (chord: Chord) => void;
}

const TAGS: readonly ProgressionTag[] = ["pop", "emo", "midwest", "modal", "minor", "jazz"];
const DEFAULT_BPM = 84;

export function ProgressionPanel({ ex, romans, pins, dispatch, player, onOpenChord }: Props) {
  const prog = useMemo(() => ex.progression(romans, pins), [ex, romans, pins]);
  const library = useMemo(() => ex.library(), [ex]);
  const [tag, setTag] = useState<ProgressionTag | "all">("all");
  const [bpm, setBpm] = useState(DEFAULT_BPM);
  const [playing, setPlaying] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playing) return;
    player.loopProgression(prog.steps.map((s) => s.voicing?.midis ?? []), { bpm, onStep: setActive });
    return () => {
      player.stop();
      setActive(null);
    };
  }, [playing, prog, bpm, player]);

  const shown = tag === "all" ? library : library.filter((t) => t.tags.includes(tag));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = parseRoman(draft);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setError(null);
    setDraft("");
    dispatch({ type: "appendRoman", roman: r.value });
  };

  return (
    <section className="panel" aria-labelledby="prog-h">
      <h2 id="prog-h">Progressions</h2>
      <p className="sub">
        Load a template, type a numeral, or add chords with the + buttons in the Chords section. The app picks voicings that keep your hand movement small, counting the move from the last chord back to the first. Click a chord name to see all its voicings.
      </p>

      <h3 style={{ margin: "0 0 6px", fontSize: "0.95rem" }}>Your progression in {ex.key.name}</h3>
      {prog.steps.length === 0 ? (
        <p className="hint">Empty. Load a template, type a numeral below, or add chords with + in the Chords section.</p>
      ) : (
        <ol className="steps">
          {prog.steps.map((s, i) => {
            const at = s.voicing ? s.alternatives.findIndex((a) => a.id === s.voicing!.id) : -1;
            const cycle = (d: number) => {
              const n = s.alternatives.length;
              const next = s.alternatives[(((at < 0 ? 0 : at) + d) % n + n) % n];
              if (next) dispatch({ type: "pin", index: i, id: next.id });
            };
            return (
              <li key={`${i}:${s.id}`} className="step" aria-current={playing && active === i ? "step" : undefined}>
                <header>
                  <b>{s.numeral}</b>
                  <button className="to-voicings" aria-label={`Voicings for ${s.name}`} onClick={() => onOpenChord(s.chord)}>
                    {s.name}
                    {s.shapeName ? ` (shape ${s.shapeName})` : ""}
                  </button>
                </header>
                {!s.diatonic && <span className="badge warn">borrowed</span>}
                {s.voicing ? (
                  <button
                    className="diagram"
                    onClick={() => player.strum(s.voicing!.midis)}
                    aria-label={`Strum ${s.voicing.name}, frets ${s.voicing.frets.map((f) => (f === null ? "muted" : f)).join(" ")}`}
                  >
                    <span className="name">{s.voicing.name}</span>
                    <ChordDiagram voicing={s.voicing} capo={ex.capo} />
                    <span className="frets">{s.voicing.frets.map((f) => (f === null ? "x" : f)).join(" ")}</span>
                  </button>
                ) : (
                  <span className="nov">No playable shape</span>
                )}
                {s.voicing && (
                  <div className="row">
                    <button className="btn small" aria-label={`Previous voicing for step ${i + 1}`} onClick={() => cycle(-1)}>◀</button>
                    <span className="hint">{at + 1}/{s.alternatives.length}</span>
                    <button className="btn small" aria-label={`Next voicing for step ${i + 1}`} onClick={() => cycle(1)}>▶</button>
                    <button
                      className="btn small"
                      aria-pressed={s.pinned}
                      onClick={() => dispatch({ type: "pin", index: i, id: s.pinned ? null : s.voicing!.id })}
                    >
                      {s.pinned ? "Unpin" : "Pin"}
                    </button>
                  </div>
                )}
                <div className="row">
                  <button className="btn small" aria-label={`Move step ${i + 1} left`} disabled={i === 0} onClick={() => dispatch({ type: "moveStep", from: i, to: i - 1 })}>←</button>
                  <button className="btn small" aria-label={`Move step ${i + 1} right`} disabled={i === prog.steps.length - 1} onClick={() => dispatch({ type: "moveStep", from: i, to: i + 1 })}>→</button>
                  <button className="btn small" aria-label={`Remove step ${i + 1}, ${s.name}`} onClick={() => dispatch({ type: "removeStep", index: i })}>Remove</button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="transport">
        <button className="btn primary" aria-pressed={playing} onClick={() => setPlaying(!playing)} disabled={prog.steps.length === 0}>
          {playing ? "Stop" : "Play loop"}
        </button>
        <label>
          BPM
          <input type="range" min={50} max={160} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} aria-label="Tempo in beats per minute" />
          <output>{bpm}</output>
        </label>
        <span className="hint" title="Frets the hand moves plus half a point per string that starts or stops sounding, including the jump from the last chord back to the first.">
          Hand movement per loop: <strong>{prog.movement.toFixed(1)}</strong>
        </span>
        <button className="btn small" disabled={romans.length === 0} onClick={() => dispatch({ type: "setProgression", romans: [] })}>Clear</button>
      </div>

      <form className="addrow" onSubmit={submit} style={{ marginTop: 10 }}>
        <label htmlFor="roman-in" className="hint">Add a numeral</label>
        <input
          id="roman-in" type="text" value={draft} placeholder="bVII, IVmaj7, vi7" aria-invalid={error !== null}
          onChange={(e) => setDraft(e.target.value)} autoComplete="off" spellCheck={false}
        />
        <button className="btn small" type="submit">Add</button>
        {error && <span className="error" role="alert">{error}</span>}
      </form>

      <h3 style={{ margin: "18px 0 6px", fontSize: "0.95rem" }}>Templates</h3>
      <div className="seg tagfilter" role="radiogroup" aria-label="Filter templates by tag">
        {(["all", ...TAGS] as const).map((t) => (
          <button key={t} role="radio" aria-checked={tag === t} onClick={() => setTag(t)}>{t}</button>
        ))}
      </div>
      <div className="templates">
        {shown.map((t) => (
          <div className="tpl" key={t.id}>
            <div>
              <h3>
                {t.name} <span className="hint">{t.numerals.join(" ")}</span>
              </h3>
              <div className="names">{t.names.join("  ")}</div>
            </div>
            <button className="btn small" aria-label={`Load ${t.name}`} onClick={() => dispatch({ type: "setProgression", romans: t.romans })}>Load</button>
            <p>
              {t.note}{" "}
              <span className="tags">
                {t.tags.map((x) => <span key={x} className="badge">{x}</span>)}
                {t.borrowedCount > 0 && <span className="badge warn">{t.borrowedCount} borrowed here</span>}
              </span>
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
