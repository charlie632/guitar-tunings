import { useEffect, useRef, useState, type Dispatch, type ReactNode } from "react";
import { asCapo, displayName, keyOf, pc, SCALE_IDS, SCALES, type Exploration } from "../theory";
import type { AppAction, Settings } from "./settings";
import { TuningPicker } from "./TuningPicker";

export type CapoHold = "keepSound" | "keepShapes";

type SetupPopover = "tuning" | "key" | "scale" | "capo";

interface Props {
  settings: Settings;
  ex: Exploration;
  hold: CapoHold;
  onHold: (h: CapoHold) => void;
  dispatch: Dispatch<AppAction>;
}

export function Controls({ settings, ex, hold, onHold, dispatch }: Props) {
  const { capo, soundingTonic: tonic, scale } = settings;
  const tonicName = displayName(keyOf(tonic, scale).tonic);
  const holdText = hold === "keepSound" ? "keep sound" : "keep shapes";
  const [open, setOpen] = useState<SetupPopover | null>(null);
  const barRef = useRef<HTMLElement>(null);
  const pills = useRef<Partial<Record<SetupPopover, HTMLButtonElement | null>>>({});

  const close = (refocus: boolean) => {
    if (refocus && open) pills.current[open]?.focus();
    setOpen(null);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      pills.current[open]?.focus();
      setOpen(null);
    };
    const onPointer = (e: PointerEvent) => {
      if (barRef.current?.contains(e.target as Node)) return;
      const focusInside = barRef.current?.contains(document.activeElement) ?? false;
      if (focusInside) pills.current[open]?.focus();
      setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const pill = (id: SetupPopover, label: string, valueText: string, value: ReactNode, body: ReactNode, wide = false) => (
    <div className="pillwrap">
      <button
        ref={(el) => {
          pills.current[id] = el;
        }}
        className="pill"
        aria-label={`${label} ${valueText}`}
        aria-haspopup="dialog"
        aria-expanded={open === id}
        aria-controls={open === id ? `setup-${id}` : undefined}
        onClick={() => setOpen(open === id ? null : id)}
      >
        <span className="pill-k">{label}</span>
        <span className="pill-v">{value}</span>
      </button>
      {open === id && (
        <Popover id={`setup-${id}`} label={label} wide={wide} onClose={() => close(true)}>
          {body}
        </Popover>
      )}
    </div>
  );

  return (
    <section className="toolbar" aria-label="Setup" ref={barRef}>
      {pill("tuning", "Tuning", settings.tuning.label, settings.tuning.label, <TuningPicker tuning={settings.tuning} dispatch={dispatch} />)}

      {pill(
        "key",
        "Key",
        tonicName,
        tonicName,
        <div className="field">
          <span className="label" id="tonic-label">Key (sounding)</span>
          <div className="tonics" role="radiogroup" aria-labelledby="tonic-label">
            {Array.from({ length: 12 }, (_, t) => (
              <button
                key={t}
                role="radio"
                aria-checked={t === tonic}
                className="btn"
                onClick={() => {
                  dispatch({ type: "setKey", tonic: pc(t), scale, frame: "sounding" });
                  close(true);
                }}
              >
                {displayName(keyOf(pc(t), scale).tonic)}
              </button>
            ))}
          </div>
          <p className="hint">{ex.key.name}: {ex.key.notes.join(" ")}</p>
        </div>,
      )}

      {pill(
        "scale",
        "Scale",
        SCALES[scale].name,
        SCALES[scale].name,
        <div className="field">
          <span className="label" id="scale-label">Scale</span>
          <div className="scales" role="radiogroup" aria-labelledby="scale-label">
            {SCALE_IDS.map((id) => (
              <button
                key={id}
                role="radio"
                aria-checked={id === scale}
                onClick={() => {
                  dispatch({ type: "setKey", tonic, scale: id, frame: "sounding" });
                  close(true);
                }}
              >
                <strong>{SCALES[id].name}</strong>
                <span>{SCALES[id].feel}</span>
              </button>
            ))}
          </div>
        </div>,
        true,
      )}

      <div className="capo-pill">
        <button
          className="step-btn"
          aria-label="Capo down one fret"
          disabled={capo === 0}
          onClick={() => dispatch({ type: "setCapo", capo: asCapo(capo - 1), hold })}
        >
          −
        </button>
        {pill(
          "capo",
          "Capo",
          `${capo}, ${holdText}`,
          <>
            <output aria-live="polite">{capo}</output>
            <small>{holdText}</small>
          </>,
          <div className="field">
            <span className="label">When the capo moves</span>
            <div className="seg" role="radiogroup" aria-label="What stays fixed when the capo moves">
              <button role="radio" aria-checked={hold === "keepSound"} onClick={() => onHold("keepSound")}>Keep sound</button>
              <button role="radio" aria-checked={hold === "keepShapes"} onClick={() => onHold("keepShapes")}>Keep shapes</button>
            </div>
            <p className="hint">
              {hold === "keepSound"
                ? "Keep sound: the key stays put and the shapes you play change."
                : "Keep shapes: you play the same shapes and the key moves up."}
            </p>
          </div>,
        )}
        <button
          className="step-btn"
          aria-label="Capo up one fret"
          disabled={capo === 12}
          onClick={() => dispatch({ type: "setCapo", capo: asCapo(capo + 1), hold })}
        >
          +
        </button>
      </div>
    </section>
  );
}

function Popover({ id, label, wide, onClose, children }: {
  id: string;
  label: string;
  wide: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const first = ref.current?.querySelector<HTMLElement>('[aria-checked="true"], select, input, button:not(.sheet-close)');
    first?.focus();
  }, []);

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div id={id} ref={ref} className={wide ? "popover wide" : "popover"} role="dialog" aria-label={label}>
        <div className="sheet-head">
          <strong>{label}</strong>
          <button className="btn small sheet-close" onClick={onClose}>Done</button>
        </div>
        {children}
      </div>
    </>
  );
}
