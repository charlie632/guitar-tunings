import { asCapo, explore, pc, TUNING_IDS, TUNINGS } from "../src/theory";

const BUDGET_MS = 100;
const RUNS = 15;

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

function once(id: (typeof TUNING_IDS)[number], capo: 0 | 2) {
  const tuning = TUNINGS[id].tuning;
  const best = explore({ tuning, capo: asCapo(capo), tonic: pc(2), scale: "major" }).keyFits("allScales")[0]!.key;
  const t0 = performance.now();
  const ex = explore({ tuning, capo: asCapo(capo), tonic: best.tonic, scale: best.scale });
  let chords = 0;
  for (const row of ex.chords()) {
    for (const card of [row.triad, ...row.colors]) {
      ex.voicings(card.chord, 12);
      chords++;
    }
  }
  return { ms: performance.now() - t0, key: best.name, chords };
}

for (const id of TUNING_IDS) once(id, 0);

let worst = 0;
console.log("tuning      capo  key            chords  median ms  max ms");
for (const id of TUNING_IDS) {
  for (const capo of [0, 2] as const) {
    const samples = Array.from({ length: RUNS }, () => once(id, capo));
    const ms = samples.map((s) => s.ms);
    worst = Math.max(worst, ...ms);
    console.log(
      `${TUNINGS[id].name.padEnd(11)} ${String(capo).padEnd(5)} ${samples[0]!.key.padEnd(14)} ${String(samples[0]!.chords).padEnd(7)} ${median(ms).toFixed(1).padStart(9)}  ${Math.max(...ms).toFixed(1).padStart(6)}`,
    );
  }
}
console.log(`worst single run: ${worst.toFixed(1)} ms (budget ${BUDGET_MS} ms)`);
if (worst > BUDGET_MS) process.exitCode = 1;
