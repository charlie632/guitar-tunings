# Tuning Explorer

A web app for guitarists who write in alternate tunings and want the theory behind what they already play. Pick a tuning, a key (tonic and scale) and a capo. The app shows:

- the scale on a 15-fret board, labeled by note, degree or shape note, with the tonic and ringing open strings marked
- the best keys for the tuning, ranked by how many open strings are in the scale, with the chords you can strum open
- the chords in the key (triads and colors such as add9, sus2, maj7) with generated voicings that prefer open strings
- progression templates and a builder, with voice-led diagrams and looped playback
- the capo both ways: which key your shapes sound in, and where to put the capo to sound in a given key

Presets: Standard, Drop D, DAEAC♯e, DADF♯Ae, DADF♯AD, DADGAD, FACGCE, DACGCe. Type any 4 to 8 string tuning to add your own. The browser synthesizes the sound with Karplus-Strong plucks, no samples. Settings live in the URL hash, so a copied address reopens the same view.

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

## Deploy

The app is static, so it ships as a Cloudflare Worker that serves `dist/` (see `wrangler.jsonc`). It needs no API keys or secrets.

```sh
pnpm exec wrangler login   # once, opens the browser
pnpm preview               # build, then serve locally with wrangler
pnpm run deploy            # build, then deploy (plain `pnpm deploy` is a pnpm builtin)
```

## Layout

`src/theory` is pure TypeScript with no React or DOM. `src/audio` renders the theory core's playback schedule with Web Audio. `src/app` is the React UI and the reducer. Read `docs/design.md` before changing any of them.
