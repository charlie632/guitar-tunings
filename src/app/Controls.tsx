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

  const refocus = useRef<SetupPopover | null>(null);

  const close = (andRefocus: boolean) => {
    if (andRefocus) refocus.current = open;
    setOpen(null);
  };

  // Runs after the popover's cleanup has lifted `inert`, which would otherwise block the focus.
  useEffect(() => {
    if (open || !refocus.current) return;
    barRef.current?.querySelector<HTMLElement>(`[data-pill="${refocus.current}"]`)?.focus();
    refocus.current = null;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    const onPointer = (e: PointerEvent) => {
      if (barRef.current?.contains(e.target as Node)) return;
      close(barRef.current?.contains(document.activeElement) ?? false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  });

  const pillProps = (id: SetupPopover) => ({
    id,
    open: open === id,
    onToggle: () => setOpen(open === id ? null : id),
    onClose: () => close(true),
  });

  return (
    <section className="toolbar" aria-label="Setup" ref={barRef}>
      <SetupPill {...pillProps("tuning")} label="Tuning" valueText={settings.tuning.label} className="shrink">
        <TuningPicker tuning={settings.tuning} dispatch={dispatch} />
      </SetupPill>

      <SetupPill {...pillProps("key")} label="Key" valueText={tonicName}>
        <div className="field">
          <span className="label" id="tonic-label">Key (sounding)</span>
          <div className="tonics" role="radiogroup" aria-labelledby="tonic-label">
            {Array.from({ length: 12 }, (_, t) => (
              <button
                key={t}
                role="radio"
                aria-checked={t === tonic}
                className="btn"
                onClick={() => dispatch({ type: "setKey", tonic: pc(t), scale, frame: "sounding" })}
              >
                {displayName(keyOf(pc(t), scale).tonic)}
              </button>
            ))}
          </div>
          <p className="hint">{ex.key.name}: {ex.key.notes.join(" ")}</p>
        </div>
      </SetupPill>

      <SetupPill {...pillProps("scale")} label="Scale" valueText={SCALES[scale].name} wide className="shrink">
        <div className="field">
          <span className="label" id="scale-label">Scale</span>
          <div className="scales" role="radiogroup" aria-labelledby="scale-label">
            {SCALE_IDS.map((id) => (
              <button
                key={id}
                role="radio"
                aria-checked={id === scale}
                onClick={() => dispatch({ type: "setKey", tonic, scale: id, frame: "sounding" })}
              >
                <strong>{SCALES[id].name}</strong>
                <span>{SCALES[id].feel}</span>
              </button>
            ))}
          </div>
        </div>
      </SetupPill>

      <div className="capo-pill">
        <button
          className="step-btn"
          aria-label="Capo down one fret"
          disabled={capo === 0}
          onClick={() => dispatch({ type: "setCapo", capo: asCapo(capo - 1), hold })}
        >
          −
        </button>
        <SetupPill
          {...pillProps("capo")}
          label="Capo"
          valueText={`${capo}, ${holdText}`}
          value={
            <>
              <output aria-live="polite">{capo}</output>
              <small>{holdText}</small>
            </>
          }
        >
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
          </div>
        </SetupPill>
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

interface SetupPillProps {
  id: SetupPopover;
  label: string;
  valueText: string;
  value?: ReactNode;
  wide?: boolean;
  className?: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: ReactNode;
}

function SetupPill({ id, label, valueText, value, wide = false, className, open, onToggle, onClose, children }: SetupPillProps) {
  return (
    <div className={className ? `pillwrap ${className}` : "pillwrap"}>
      <button
        data-pill={id}
        className="pill"
        aria-label={`${label}: ${valueText}. Change ${label.toLowerCase()}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `setup-${id}` : undefined}
        onClick={onToggle}
      >
        <span className="pill-k">{label}</span>
        <span className="pill-v">{value ?? valueText}</span>
      </button>
      {open && (
        <Popover id={`setup-${id}`} label={label} wide={wide} onClose={onClose}>
          {children}
        </Popover>
      )}
    </div>
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
  const backdrop = useRef<HTMLDivElement>(null);
  const [modal, setModal] = useState(false);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[aria-checked="true"], select, input, button:not(.sheet-close)')?.focus();

    // The stylesheet alone decides when a popover becomes a bottom sheet; the backdrop only renders in that mode.
    if (!backdrop.current || getComputedStyle(backdrop.current).display === "none") return;
    setModal(true);
    const dialog = ref.current!;
    const outside = Array.from(document.querySelectorAll<HTMLElement>(".shell > *, .rail > *, .toolbar > *")).filter(
      (el) => !el.contains(dialog),
    );
    outside.forEach((el) => (el.inert = true));
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      outside.forEach((el) => (el.inert = false));
      document.body.style.overflow = overflow;
    };
  }, []);

  return (
    <>
      <div ref={backdrop} className="sheet-backdrop" onClick={onClose} />
      <div id={id} ref={ref} className={wide ? "popover wide" : "popover"} role="dialog" aria-modal={modal || undefined} aria-label={label}>
        <div className="sheet-head">
          <strong>{label}</strong>
          <button className="btn small sheet-close" onClick={onClose}>Done</button>
        </div>
        {children}
      </div>
    </>
  );
}
