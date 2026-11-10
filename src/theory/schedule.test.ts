import { describe, expect, test } from "vitest";
import type { Midi } from "./pitch";
import { chordSeconds, loopSeconds, scheduleProgression, strum } from "./schedule";

const m = (...n: number[]) => n as Midi[];

describe("strum", () => {
  test("starts low to high with a growing offset", () => {
    const ev = strum(m(38, 45, 50), { spreadMs: 20 });
    expect(ev.map((e) => e.midi)).toEqual([38, 45, 50]);
    expect(ev.map((e) => e.at)).toEqual([0, 0.02, 0.04]);
  });
  test("can start later", () => expect(strum(m(40), { at: 3 })[0]!.at).toBe(3));
});

describe("scheduleProgression", () => {
  const steps = [m(38, 45), m(), m(40, 47, 52)];

  test("at 120 bpm and 4 beats a chord lasts 2 seconds", () => {
    expect(chordSeconds({ bpm: 120 })).toBe(2);
    expect(loopSeconds(3, { bpm: 120 })).toBe(6);
  });

  test("each step starts on its bar and an empty step is silence", () => {
    const ev = scheduleProgression(steps, { bpm: 120 });
    expect(ev).toHaveLength(5);
    expect(ev.filter((e) => e.at >= 4).map((e) => e.midi)).toEqual([40, 47, 52]);
    expect(ev.filter((e) => e.at >= 2 && e.at < 4)).toHaveLength(0);
  });

  test("a faster tempo compresses the schedule", () => {
    const slow = scheduleProgression(steps, { bpm: 60 });
    const fast = scheduleProgression(steps, { bpm: 120 });
    expect(slow[slow.length - 1]!.at).toBeGreaterThan(fast[fast.length - 1]!.at);
  });
});
