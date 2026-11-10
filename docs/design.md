# Design

This is the synthesized design for Tuning Explorer: the base design, the amendments applied on top of it, and where the implementation departs from both. Read it before changing `src/theory`.

## The problem

A guitarist plays by feel in seven alternate tunings and wants to learn the theory underneath. Three things make the shape non-obvious.

1. Spelling has to be right per key (A♯ in F♯ major, B♭ in B♭ major, C for ♭VI in E). Pitch-class integers cannot express that.
2. The capo puts two frames on every fact: what sounds and what the hands play. Mixing them is the likeliest bug in any guitar app.
3. Voicings must be generated for arbitrary tunings, then ranked so the tuning's ringing open strings come first.

## Data shape (decided, not up for change)

- `Note {letter, alter}` and `Interval {steps, semis}`. Spelling happens only in `transpose` (and `spellPc` for bare pitch classes) and in `keyOf`. Scale tones, chord tones, borrowed roots and shape keys all come out spelled by construction.
- Branded `Pc`, `Midi`, `Fret` (capo-relative) and `BoardFret` (absolute). `toBoard` is the only crossing.
- Registries as data: `SCALES`, `QUALITIES`, `TUNINGS`, `LIBRARY`. Scales and qualities are degree-formula strings ("1 2 b3 4 5 b6 b7") parsed at load into `Interval`s. Ids are `keyof` the source tables.
- One bound `Exploration` from `explore({tuning, capo, tonic, scale})`. The UI never threads tuning or capo into a theory function.
- App state is one reducer persisted to the URL hash. The sounding key is stored. The shape key is derived.

## Modules

| File | Owns |
| --- | --- |
| `theory/pitch.ts` | Pc, Midi, Note, Pitch, Interval, `transpose`, `spellPc`, note and interval names, parsers |
| `theory/scales.ts` | `SCALES`, `Key`, `keyOf` (tonic spelling), `spellIn`, `degreeLabel`, `harmonyOf` |
| `theory/chords.ts` | `QUALITIES`, `Chord`, `chordTones`, `diatonicChords` (colors derived from scale membership), `explainChord` |
| `theory/instrument.ts` | `Tuning`, `TUNINGS`, `parseTuning`, `Instrument`, Fret/BoardFret, `shapeKey`/`soundingKey`. The only file that adds or subtracts the capo |
| `theory/voicings.ts` | `generateVoicings`, `DEFAULT_LIMITS`, `VOICING_WEIGHTS` |
| `theory/fit.ts` | `keyFit`, `compareFit`, `rankKeys`, `capoOptions` |
| `theory/progressions.ts` | Roman numerals, `LIBRARY`, cyclic `voiceLead` |
| `theory/schedule.ts` | Pure `NoteEvent[]` for strums and progressions |
| `theory/explore.ts` | Binding, voicing memo, view projections with display strings |
| `audio/player.ts` | Renders `NoteEvent[]` with a Karplus-Strong pluck and owns the stop handle |
| `app/settings.ts` | `Settings`, `AppState`, reducer, URL codec |
| `app/*.tsx` | UI. Lint forbids importing theory except through `theory/index.ts` |

Algorithms in brief:

- **Voicings.** For each window of the neck (lowest fretted fret = window start, span 4), every string may be muted, open (if a chord tone) or fretted on a chord tone inside the window. DFS prunes interior mutes. A leaf must sound 3+ strings, contain every non-optional tone and fit 4 fingers (a barre counts once). Ranking is one weighted table where an open ringing string is the biggest reward. The lowest fretted fret equalling the window start removes duplicates across windows.
- **Key fit.** Lexicographic: open strings in scale, then in the tonic triad, then low string is the tonic, then scale registry order (major and minor before modes), then fewer accidentals. The UI can say why in one sentence. `capoOptions` is `keyFit` mapped over capo 0 to 7, so the two cannot disagree.
- **Voice leading.** Viterbi over the top 10 candidates per step. Cost is frets moved, mute toggles, a drone bonus for open strings that ring through both chords, and the voicing's own score. Progressions loop, so the DP runs once per choice of first voicing and keeps the cheapest cycle.
- **Numerals.** `RomanChord {step, quality}` where `step` is the spelled interval above the tonic measured against the major scale. A progression keeps its sound when the tonic changes, and borrowed chords are visible. In a minor key the diatonic chords read i, ♭III, iv, v, ♭VI, ♭VII, which the chord list says out loud.

## Amendments applied to the base

1. Formula-string registries for scales and qualities. A test asserts every entry parses.
2. Capo stays in `instrument.ts`. `setKey` with frame "shape" calls `soundingKey`. `setCapo` takes `hold: "sound" | "shapes"`, and "shapes" moves the sounding key through `shapeKey` then `soundingKey`.
3. `barre` lives on `Voicing`. Views read it and never re-derive it.
4. Voicing tone labels come from `chordTones`, so a borrowed Fm in C shows A♭.
5. `Alter` is a plain number. `keyOf` rejects tonic spellings that need a double accidental, and the test asserts at most one accidental per scale tone for all 12 tonics and all scales.
6. Key-fit tie-break order as above. With scope major, FACGCE ranks F then C. With minor, A minor first. With all scales, D major beats D Mixolydian for DADF♯Ae.
7. No thin `*View` types. A view exists only when it adds display fields.
8. Pure playback schedule in `theory/schedule.ts`. The player only renders events.
9. Cyclic voice leading.
10. `ringingChords` on `KeyFit`: diatonic chords with at most one open string outside them.
11. The capo sentence ("Capo 2 raises every open string 2 semitones: ...") on the `Exploration`.
12. Alternatives and an ephemeral pin per progression step. Pins live in `AppState`, not the URL, and a stale id is ignored.
13. `movement` total on the resolved progression.
14. `easyChords` on the top three capo options only, and not used for ranking.

## Implementation reconciliation

Deviations from the base and amendments, with reasons.

- **`ScaleDef` is one flat shape with `harmonyFrom`** (a heptatonic names itself), not a discriminated union. The registry is built from formula strings, so a union would need a cast anyway. `harmonyOf(key)` is the single place that chooses the chord-bearing scale, and `diatonicChords` only ever sees seven notes.
- **`spellPc(pc, prefer)` replaces `respell`.** The only caller needs "spell a bare pitch class", not "move a note by semitones".
- **Accidental glyphs live in the core's display strings.** `noteName` and `formatRoman` stay ASCII for ids and the URL. `displayName`, `displayRoman`, scale names and quality symbols carry ♯ and ♭. A regex that prettifies ASCII strings in the UI would turn "About" into "A♭out", so the core produces display strings at construction instead.
- **`QualityDef.roman.upper` can be `null`.** Sus and power chords have no case meaning, so the parser accepts either case and the formatter prints upper.
- **`voiceLead` returns `{chosen, movement}`.** `movement` is frets moved plus 0.5 per string that starts or stops, wrap edge included. It leaves out the drone bonus so the number is never negative and reads as hand travel. The drone bonus still steers the DP. Width K is `VOICE_LEADING.width = 10`.
- **`strum` and `scheduleProgression` take `Midi[]`**, not voicings, so the core schedule does not depend on the voicing type. `loopSeconds` gives the loop point. The player owns the lookahead loop and per-step callbacks.
- **`Exploration` additions.** `card(chord)` (the chord list and voicing panel need a card for a selected chord), `capoSentence`, `explain` returning display strings, `progression(romans, pins)`, `CapoOptionView.sentence`, `KeyFitView.ringing`. The key-fit summary says "in the tonic chord" rather than "in the I chord", which would need case logic per mode.
- **`library()` keeps authored order** instead of sorting by borrowed count then tag. Reordering the list every time the key changes made it hard to scan. Each template carries `borrowedCount` and the UI filters by tag.
- **Voicing search keeps non-chord open strings out.** An open string is only allowed when it is a chord tone. A drone that is not in the chord (D drone under Em) is not generated. Intentional for v1.
- **TypeScript is pinned to 5.9.** typescript-eslint does not support TypeScript 7.
- **Capo options cover 0 to 7** while the stepper allows 0 to 12.
- **Tuning parser separators.** Whitespace, comma, dot, dash, slash and bar are separators, so the URL form "D2.A2.D3.F%233.A3.E4" parses. A "b" right after a letter is a flat.
- **Pins are cleared** on tuning, key and capo changes, since voicing ids are capo-relative frets.

## Performance

`pnpm bench` times a cold `explore()` plus voicings for every diatonic triad and color chord (46 chords) of the best-fit key, for every preset tuning at capo 0 and 2. Budget is 100 ms per change. Measured on this machine (Node 26, 15 cold runs per row), medians are 36 to 53 ms and the worst single run was 60 to 92 ms across runs, so the margin is roughly 2x with an occasional spike.

What limits it: about 1 ms per chord inside `generateVoicings`, which materializes about 560 voicings per chord (25.7k across the 46 chords) and sorts them. `explore()` itself takes 0.2 ms and `chords()` 0.3 ms. The app generates lazily, so a real change costs one chord for the voicing panel plus four for the progression, roughly 5 ms. The bench is the worst case where every chord is generated. If a custom 8-string tuning is slow, cap per-string options or keep only the top N while enumerating.

## Known gaps

- The ranked voicing list has near-duplicates that differ only by which string is muted.
- Audio is typechecked and unit-tested through its pure schedule, but playback was not heard or measured in this pass.
- Chord diagrams for tunings with more than 6 strings are untested visually.
- No undo, no rhythm patterns, no forced enharmonic tonic (F♯ versus G♭ is chosen by fewest accidentals, sharp on a tie), no `hashchange` listener.
