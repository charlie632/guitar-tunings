import type { Midi } from "./pitch";

export interface NoteEvent {
  readonly midi: Midi;
  /** Seconds from the start of the schedule. */
  readonly at: number;
  readonly duration: number;
}

export interface StrumOptions {
  readonly at?: number;
  readonly spreadMs?: number;
  readonly duration?: number;
}

export function strum(midis: readonly Midi[], opts: StrumOptions = {}): readonly NoteEvent[] {
  const { at = 0, spreadMs = 22, duration = 2.2 } = opts;
  return midis.map((midi, i) => ({ midi, at: at + (i * spreadMs) / 1000, duration }));
}

export interface ProgressionOptions {
  readonly bpm: number;
  readonly beatsPerChord?: number;
}

const DEFAULT_BEATS = 4;

export function chordSeconds(opts: ProgressionOptions): number {
  return ((opts.beatsPerChord ?? DEFAULT_BEATS) * 60) / opts.bpm;
}

export function loopSeconds(stepCount: number, opts: ProgressionOptions): number {
  return stepCount * chordSeconds(opts);
}

export function scheduleProgression(
  steps: readonly (readonly Midi[])[],
  opts: ProgressionOptions,
): readonly NoteEvent[] {
  const bar = chordSeconds(opts);
  return steps.flatMap((midis, i) => strum(midis, { at: i * bar, duration: Math.min(bar * 1.5, 3) }));
}
