import type { VoicingView } from "../theory";
import { degreeColor } from "./colors";

const FRETS_SHOWN = 5;
const SX = 18;
const SY = 20;
const PAD_X = 20;
const PAD_TOP = 26;

interface Props {
  voicing: VoicingView;
  /** Capo position, so the nut reads as the capo. */
  capo: number;
}

export function ChordDiagram({ voicing: v, capo }: Props) {
  const n = v.frets.length;
  const width = PAD_X * 2 + (n - 1) * SX;
  const height = PAD_TOP + FRETS_SHOWN * SY + 12;
  const x = (s: number) => PAD_X + s * SX;
  const y = (row: number) => PAD_TOP + (row - 0.5) * SY;
  const rowOf = (f: number) => f - v.baseFret + 1;
  const atNut = v.baseFret === 1;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true" focusable="false">
      {atNut ? (
        <line x1={x(0) - 2} x2={x(n - 1) + 2} y1={PAD_TOP} y2={PAD_TOP} stroke={capo > 0 ? "#ffb454" : "#e8ecf3"} strokeWidth="4" />
      ) : (
        <text x={4} y={y(1) + 4} fontSize="10" fill="#9aa6ba">{v.baseFret}fr</text>
      )}
      {Array.from({ length: FRETS_SHOWN }, (_, r) => (
        <line key={r} x1={x(0)} x2={x(n - 1)} y1={PAD_TOP + (r + 1) * SY} y2={PAD_TOP + (r + 1) * SY} stroke="#4a5568" strokeWidth="1" />
      ))}
      {Array.from({ length: n }, (_, s) => (
        <line key={s} x1={x(s)} x2={x(s)} y1={PAD_TOP} y2={PAD_TOP + FRETS_SHOWN * SY} stroke="#7a8599" strokeWidth="1" />
      ))}
      {v.barre && (
        <rect
          x={x(v.barre.from) - 6} y={y(rowOf(v.barre.fret)) - 6} width={x(v.barre.to) - x(v.barre.from) + 12} height="12" rx="6"
          fill="#e8ecf3" opacity="0.35"
        />
      )}
      {v.frets.map((f, s) => {
        const tone = v.strings[s];
        if (f === null || !tone) {
          return <text key={s} x={x(s)} y={PAD_TOP - 8} textAnchor="middle" fontSize="12" fill="#9aa6ba">×</text>;
        }
        if (f === 0) {
          return (
            <circle key={s} cx={x(s)} cy={PAD_TOP - 9} r="4.5" fill="none" stroke={degreeColor(tone.degree)} strokeWidth="2" />
          );
        }
        return (
          <g key={s}>
            <circle cx={x(s)} cy={y(rowOf(f))} r="7.5" fill={degreeColor(tone.degree)} stroke="#10131a" strokeWidth="1" />
            <text x={x(s)} y={y(rowOf(f)) + 3} textAnchor="middle" fontSize={tone.note.length > 1 ? 7.5 : 9} fontWeight="700" fill="#10131a">
              {tone.note}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
