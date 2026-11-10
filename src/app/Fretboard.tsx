import { useState, type KeyboardEvent } from "react";
import type { Exploration, Midi } from "../theory";
import { degreeColor, DEGREES } from "./colors";
import type { LabelMode } from "./settings";

const W = 52;
const GAP = 30;
const LEFT = 34;
const TOP = 22;
const INLAYS = [3, 5, 7, 9, 15];
const ARROWS: Record<string, [number, number]> = {
  ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowUp: [1, 0], ArrowDown: [-1, 0],
};

interface Props {
  ex: Exploration;
  labels: LabelMode;
  onLabels: (l: LabelMode) => void;
  onPluck: (m: Midi) => void;
}

const LABEL_NAMES: readonly [LabelMode, string][] = [
  ["note", "Note"],
  ["degree", "Degree"],
  ["shape", "Shape note"],
];

export function Fretboard({ ex, labels, onLabels, onPluck }: Props) {
  const board = ex.fretboard();
  const n = board.strings.length;
  const cols = board.frets + 1;
  const height = TOP + (n - 1) * GAP + 30;
  const width = LEFT + cols * W + 8;
  const colX = (f: number) => LEFT + f * W + W / 2;
  const stringY = (s: number) => TOP + (n - 1 - s) * GAP;
  const [active, setActive] = useState<string | null>(null);

  const firstKey = (() => {
    for (const row of board.strings) for (const c of row.cells) if (c.degree !== null) return `${row.index}:${c.fret}`;
    return null;
  })();
  const tabbable = active ?? firstKey;

  const move = (e: KeyboardEvent<SVGGElement>, s: number, f: number) => {
    const d = ARROWS[e.key];
    if (!d) return;
    e.preventDefault();
    const ns = s + d[0];
    if (ns < 0 || ns >= n) return;
    const cells = [...e.currentTarget.ownerSVGElement!.querySelectorAll<SVGGElement>(`[data-s="${ns}"]`)].map((el) => ({
      el,
      f: Number(el.dataset.f),
    }));
    const pool = d[0] === 0 ? cells.filter((c) => (d[1] > 0 ? c.f > f : c.f < f)) : cells;
    pool.sort((a, b) => Math.abs(a.f - f) - Math.abs(b.f - f));
    pool[0]?.el.focus();
  };

  return (
    <section className="panel" aria-labelledby="board-h">
      <h2 id="board-h">Fretboard</h2>
      <p className="sub">
        {ex.tuningLabel}, {ex.key.name}
        {ex.capo > 0 ? `, capo ${ex.capo}` : ""}. Click a note to hear it. Arrow keys move between notes.
      </p>
      <div className="seg" role="radiogroup" aria-label="Fretboard labels" style={{ marginBottom: 8 }}>
        {LABEL_NAMES.map(([id, name]) => (
          <button key={id} role="radio" aria-checked={labels === id} onClick={() => onLabels(id)}>{name}</button>
        ))}
      </div>
      <div className="board-scroll">
        <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`Fretboard for ${ex.key.name}`}>
          <rect x={LEFT} y={TOP - 12} width={cols * W} height={(n - 1) * GAP + 24} fill="#2a2118" rx="4" />
          {INLAYS.map((f) => (
            <circle key={f} cx={colX(f)} cy={TOP + ((n - 1) * GAP) / 2} r="5" fill="#4a3d2c" />
          ))}
          {[0, 1].map((k) => (
            <circle key={k} cx={colX(12)} cy={TOP + ((n - 1) * GAP) / 2 + (k ? 20 : -20)} r="5" fill="#4a3d2c" />
          ))}
          {Array.from({ length: cols }, (_, f) => (
            <g key={f}>
              <line
                x1={LEFT + (f + 1) * W} x2={LEFT + (f + 1) * W} y1={TOP - 12} y2={TOP + (n - 1) * GAP + 12}
                stroke={f === 0 ? "#cfc6b4" : "#6a5f4e"} strokeWidth={f === 0 ? 4 : 1.5}
              />
              {f > 0 && (
                <text x={colX(f)} y={height - 6} textAnchor="middle" fontSize="11" fill="#9aa6ba">{f}</text>
              )}
            </g>
          ))}
          {board.strings.map((row) => (
            <line
              key={row.index} x1={LEFT} x2={LEFT + cols * W} y1={stringY(row.index)} y2={stringY(row.index)}
              stroke="#b9b1a0" strokeWidth={Math.max(0.8, 2.4 - row.index * 0.35)}
            />
          ))}
          {board.capo > 0 && (
            <rect
              className="capo-mark" style={{ transform: `translateX(${board.capo * W}px)` }}
              x={LEFT + 3} y={TOP - 16} width="12" height={(n - 1) * GAP + 32} rx="5"
              fill="#ffb454" stroke="#10131a"
            >
              <title>{`Capo at fret ${board.capo}`}</title>
            </rect>
          )}
          {board.strings.map((row) => (
            <text key={row.index} x={LEFT - 8} y={stringY(row.index) + 4} textAnchor="end" fontSize="13" fontWeight="700" fill="#e8ecf3">
              {row.open}
            </text>
          ))}
          {board.strings.flatMap((row) =>
            row.cells.map((c) => {
              if (c.degree === null) return null;
              const key = `${row.index}:${c.fret}`;
              const label = labels === "degree" ? c.degree : labels === "shape" ? c.shapeNote : c.note;
              const x = colX(c.fret) + (c.fret === board.capo && board.capo > 0 ? 8 : 0);
              return (
                <g
                  key={key}
                  className="dot"
                  data-s={row.index}
                  data-f={c.fret}
                  role="button"
                  tabIndex={tabbable === key ? 0 : -1}
                  aria-label={`String ${row.index + 1}, fret ${c.fret}: ${c.note}, degree ${c.degree}${c.isTonic ? ", tonic" : ""}${c.isOpenRinging ? ", rings open" : ""}`}
                  opacity={c.playable ? 1 : 0.28}
                  onFocus={() => setActive(key)}
                  onClick={() => onPluck(c.midi)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onPluck(c.midi);
                    } else move(e, row.index, c.fret);
                  }}
                >
                  {c.isOpenRinging && (
                    <circle cx={x} cy={stringY(row.index)} r="17" fill="none" stroke="#ffb454" strokeWidth="2" strokeDasharray="3 2" />
                  )}
                  <circle
                    className="body" cx={x} cy={stringY(row.index)} r={c.isTonic ? 14 : 12}
                    fill={degreeColor(c.degreeNo)} stroke={c.isTonic ? "#ffffff" : "#10131a"} strokeWidth={c.isTonic ? 3 : 1.5}
                  />
                  <text x={x} y={stringY(row.index) + 4} textAnchor="middle" fontSize={label.length > 2 ? 10 : 12} fontWeight="700" fill="#10131a" pointerEvents="none">
                    {label}
                  </text>
                </g>
              );
            }),
          )}
        </svg>
      </div>
      <ul className="legend" aria-label="Degree colors">
        {DEGREES.map((d) => (
          <li key={d}>
            <span className="swatch" style={{ background: degreeColor(d) }} />
            {d}
          </li>
        ))}
        <li><span className="swatch" style={{ border: "3px solid #fff", background: "transparent" }} />tonic</li>
        <li><span className="swatch" style={{ border: "2px dashed #ffb454", background: "transparent" }} />open string rings</li>
      </ul>
    </section>
  );
}
