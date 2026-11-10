import { loopSeconds, scheduleProgression, strum, type Midi, type NoteEvent } from "../theory";

export interface ProgressionPlayback {
  readonly bpm: number;
  readonly beatsPerChord?: number;
  /** Called as each step starts, in time with the audio. */
  readonly onStep?: (index: number) => void;
}

export interface Player {
  pluck(m: Midi): void;
  strum(ms: readonly Midi[]): void;
  /** Loops until stopped. Starting a new one stops the previous. */
  playProgression(steps: readonly (readonly Midi[])[], opts: ProgressionPlayback): void;
  stop(): void;
}

const LOOKAHEAD_S = 0.6;
const TICK_MS = 120;
const SEGMENT_S = 3;

/** Karplus-Strong: a noise burst through a damped delay line, rendered once per pitch. */
function renderPluck(ctx: BaseAudioContext, midi: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const freq = 440 * 2 ** ((midi - 69) / 12);
  const period = Math.max(2, Math.round(sr / freq));
  const length = Math.floor(sr * SEGMENT_S);
  const buffer = ctx.createBuffer(1, length, sr);
  const out = buffer.getChannelData(0);
  const line = new Float32Array(period);
  for (let i = 0; i < period; i++) line[i] = Math.random() * 2 - 1;
  const decay = 0.9965 - Math.min(0.004, freq / 200000);
  let p = 0;
  for (let i = 0; i < length; i++) {
    const next = (p + 1) % period;
    out[i] = line[p]!;
    line[p] = decay * 0.5 * (line[p]! + line[next]!);
    p = next;
  }
  return buffer;
}

export function createPlayer(): Player {
  let ctx: AudioContext | null = null;
  const buffers = new Map<number, AudioBuffer>();
  let timer: ReturnType<typeof setInterval> | null = null;
  const stepTimers = new Set<ReturnType<typeof setTimeout>>();
  const live = new Set<AudioScheduledSourceNode>();

  const context = (): AudioContext => {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  };

  const schedule = (events: readonly NoteEvent[], startAt: number): void => {
    const c = context();
    for (const e of events) {
      let buffer = buffers.get(e.midi);
      if (!buffer) {
        buffer = renderPluck(c, e.midi);
        buffers.set(e.midi, buffer);
      }
      const src = c.createBufferSource();
      src.buffer = buffer;
      const gain = c.createGain();
      const at = startAt + e.at;
      gain.gain.setValueAtTime(0.28, at);
      gain.gain.setTargetAtTime(0, at + e.duration * 0.6, e.duration * 0.25);
      src.connect(gain).connect(c.destination);
      src.start(at);
      src.stop(at + e.duration + 0.5);
      live.add(src);
      src.onended = () => live.delete(src);
    }
  };

  const stop = (): void => {
    if (timer) clearInterval(timer);
    timer = null;
    stepTimers.forEach(clearTimeout);
    stepTimers.clear();
    for (const s of live) {
      try {
        s.stop();
      } catch {
        // already stopped
      }
    }
    live.clear();
  };

  return {
    pluck(m) {
      const c = context();
      schedule([{ midi: m, at: 0, duration: 2.4 }], c.currentTime + 0.01);
    },
    strum(ms) {
      const c = context();
      schedule(strum(ms), c.currentTime + 0.01);
    },
    playProgression(steps, opts) {
      stop();
      if (steps.length === 0) return;
      const c = context();
      const events = scheduleProgression(steps, opts);
      const loop = loopSeconds(steps.length, opts);
      const bar = loop / steps.length;
      let nextLoopAt = c.currentTime + 0.05;
      const queueLoop = (): void => {
        const start = nextLoopAt;
        schedule(events, start);
        steps.forEach((_, i) => {
          const delay = Math.max(0, (start + i * bar - c.currentTime) * 1000);
          const id = setTimeout(() => {
            stepTimers.delete(id);
            opts.onStep?.(i);
          }, delay);
          stepTimers.add(id);
        });
        nextLoopAt = start + loop;
      };
      queueLoop();
      timer = setInterval(() => {
        if (c.currentTime + LOOKAHEAD_S >= nextLoopAt) queueLoop();
      }, TICK_MS);
    },
    stop,
  };
}
