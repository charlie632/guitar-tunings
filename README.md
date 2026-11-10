# Tuning Explorer

An interactive learning place for guitarists who write in alternate tunings and want the theory behind what their hands already find. Pick a tuning, a key (tonic and scale) and a capo. The app shows:

- the scale on a 15-fret board, labeled by note, degree or shape note, with the tonic and ringing open strings marked
- which keys ring in the tuning, ranked, with a per-string breakdown and the chords that ring open
- the chords in the key (triads and colors such as add9, sus2, maj7) with generated voicings that prefer open strings
- progression templates and a builder, with voice-led diagrams and looped playback
- the capo in both directions: "these shapes sound in key Y" and "to sound in key Y, try these capo positions"

Presets: Standard, Drop D, DAEAC♯e, DADF♯Ae, DADF♯AD, DADGAD, FACGCE, DACGCe. Type any 4 to 8 string tuning to add your own. Sound is synthesized in the browser (Karplus-Strong), with no samples. Settings live in the URL hash, so a copied address reopens the same view.

## Run

```sh
pnpm install
pnpm dev          # http://localhost:5173
```

## Checks

```sh
pnpm typecheck
pnpm lint         # includes the rule that keeps UI code behind src/theory/index.ts
pnpm test
pnpm build
pnpm bench        # times explore() plus voicings for every preset at capo 0 and 2
```

## Layout

`src/theory` is pure TypeScript with no React or DOM. `src/audio` renders the theory core's playback schedule with Web Audio. `src/app` is the React UI and the reducer. Read `docs/design.md` before changing any of them.
