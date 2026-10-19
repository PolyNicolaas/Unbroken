# Code and test review · 16 October 2026 (v76)

> History, kept as written. **Fixed by v91 (17 October 2026):** findings 1–4; the error readout, float readouts,
> E per mm refresh, needle hint and settings.js promises; connector-lane speed and the sample-cap note; tests 1–3 and 6;
> the maintainability items (dead code v83; long functions, one spatial grid, the print-settings signal and the
> 120-column formatting v91). **Everything still open is tracked in ../../ROADMAP.md (Next)**, not here.

How well Unbroken works, read from the code and the tests: measured (sizes, coverage, timings), three independent
read-throughs (engine, app, tests), and the most serious findings re-checked by hand. Nothing was changed.

## Verdict

**The core works and is well tested; the newest layer of features is the weak spot.** The tracing maths, the Fourier
fit, the spacing and crossing rules and the choc OS G-code recipe are correct and well guarded (engine tests cover 91%
of the engine). The problems cluster in two places: the 3D-tab features added in the last few days (height leads,
Fine-tuning, ready list), which lean on reading each other's input boxes and on listener order across files, and the
browser tests, which wait on the clock instead of on the app and barely check the G-code the app actually downloads.
One bug can make a wrong print today (finding 1).

## By the numbers

| | |
|---|---|
| Engine | 13 parts, 3,150 lines (329 k characters incl. fonts); 47 lines over 200 characters |
| App | 21 scripts + page + CSS, 4,750 lines; 111 script lines over 200 characters (longest 689) |
| Tests | 28 engine (Node, ~1.5 min) + 25 app (browser, ~11 min); 53 of 53 pass |
| Engine coverage by engine tests | 91% statements, 87% branches, 92% functions |
| Least covered engine parts | image prep 77%, shading/erase 75%, chamfer 70%, pipeline stages 86% |
| App functions run by app tests | 63–100% per file; painting areas (`zonesChanged`) and Draw your own (`renderDraw`) never run |
| Slowest tests | A14 150 s, A16 50 s, A20 33 s, A07 32 s (A14 alone is a quarter of the app run) |

## Fix before the next print (confirmed)

*Findings 1–3 fixed in v77 (test A26), with the float readouts, the E per mm refresh and the needle hint.*

1. **Height carried over from a 3D model.** Load a model (the vase, 40 mm), switch back to Image, change the
   chocolate: the drawing becomes **133 layers, 39.9 mm tall**. Reproduced in the browser. The Height box keeps the
   model's 40 mm and the height-leads logic reads it (`layers.js` `goalNow`). Fix: refresh the height when leaving
   model mode, and work from the layer count, not the box.
2. **Empty or negative First-layer Z / Lift go straight into the G-code** (`export.js` `gcodeSettings`, no `min` on
   the inputs). An emptied Z box prints at Z 0, into the plate; lift 0 drags across finished copies. Also the test
   print. Fix: clamp, add `min`, and a ready-list line.
3. **A typo in settings.js can silently break the chocolate menu.** `costPer100g: "2.50"` (a string) throws during
   start-up, so picking a chocolate stops doing anything. `cocoaPercent`, `workingTempC`, `maxPrintSpeed` aren't
   checked either; `cartridgeVolume` gives a false warning on older files.
4. *(Fixed in v78, test E29.)* **A kink near junctions on small prints** (`04-walk.js`): junction distances are only recorded up to 40 working
   px, but the strand eases over 2 × spacing. When the spacing is over 20 px (small prints, wide needles) the offset
   jumps by up to ~4 px next to a junction.
5. **Painted areas drawn at the wrong brush width** after a re-trace at a new resolution (`pipeline.js` uses the
   screen's crop, `st.crop`, instead of the run's). Crossing areas and connector paths can grow or shrink.

## Misleading readouts and small bugs

- *(Fixed in v78.)* **"Error" is mostly the strand offset, not the fit.** It measures the final line (which sits half a spacing off
  for doubled strokes, on purpose) against the centre line: a perfect fit of a plus shape scores 0.03 px with no
  spacing, 11 px at 20 px spacing. The 0.47 mm the sample shows is largely that offset. Measure against the path that
  was fitted, or show the two separately.
- Density readouts show float noise: 55% reads "55.00000000000001%".
- E per mm shows the old printer's value after a printer change (display only; export is right).
- Ready-list lines for Trace-tab cards (traced, spacing) don't go anywhere from the 3D tab.
- The Test print's ranges don't refresh after a chocolate change.
- settings.js promises things that don't happen: `defaults.position` is overwritten at once; `printer.printHeight`
  is checked but never used (the first layer now follows the layer height).
- G-code: travel speed only applies when retraction is on (otherwise F3000); Z moves are fixed at F3600 / F600.
- A saved design with a 3D model only stores the model's id, so reopening it in a new session can apply the turns
  and height to a different model (suspected).
- *(The Fit card now says "at the limit", v78.)* Big drawings: samples are capped at 16,384 (open lines effectively half), and the term count quietly gives up at
  4,000 without saying the target accuracy wasn't reached.
- *(Done in v92.)* Units and words: Fine-tuning speed is mm/min while everything else says mm/s; "Machine settings" still appears in
  the needle hint; Centreline / Centerline; a "0.35 px" tooltip; Height steps by 0.1 while layers step by 0.05.

## Speed

- *(Fixed in v78: 1.4 → 0.4 s, 5.0 → 1.2 s.)* **Connector lanes are slow:** each loose end refills three whole-image arrays (`04-walk.js` `gridRun`): a comb
  shape goes from 0.17 s to 1.5 s at 400 px, 0.7 s to 4.8 s at 800 px. Reset only the cells touched.
- The spectrum sort recomputes each term's size on every comparison (55–126 ms vs 1–4 ms for the FFT itself).
- The layers engine is never cancelled: nudging a big model's height five times queues five full slices, and the 2D
  tab and Draw this view wait behind them.

## Tests

**Strong:** tracing accuracy against known drawings, spacing and crossings, junctions, stroke-end loops, the
choc OS recipe (E28), settings validation (E14), the engine's structure (E25) and shared-state ownership (E27). Each
test explains what it guards and why, and the catalogue is generated from them.

**Weak:**

*Items 1, 2 and 6 fixed on 16 October (after v77): the settle probe, the runner, check(), and the descriptions; the full run is 408 s.*

1. **Waiting on the clock.** The `idle()` helper gives up silently after 60 s and returns early if a trace hasn't
   started; tests stack it (A14 calls a 6.7 s wait ~21 times) and add 89 fixed sleeps. That is where the 11 minutes
   and the occasional flaky test (A02, A17) come from. Fix: the app exposes a "settled" counter; tests wait for it
   and fail on time-out.
2. **The runner can let a broken test pass:** a test with no checks passes; a test that throws leaves its page and
   workers running into later timing tests; `!=` is true for NaN and an unknown operator quietly becomes `>`.
3. *(Covered by test A27 since 16 October.)* **The G-code the app downloads is barely checked.** Only Z levels and plate bounds. Nothing checks, in the
   downloaded file: E per mm, feeds, the purge line, one unretract and one wipe per copy, travel above finished copies,
   each copy finished before the next. (The engine function is well tested; the app's use of it is not.)
4. **Untested behaviour:** painting crossing areas and connector paths, Draw your own, image prep, shading, erase,
   the test print's speed / gap / flow kinds, the ready list's second-click export, height staying put on a chocolate
   or printer change, the per-card small-areas setting.
5. **Loose checks:** A12 writes a warning into the page and checks it shows; E14 "settings.js loads" is 1 == 1;
   E28 accepts 2–6 wipes for "one wipe per copy"; A22 compares pictures by string length.
6. **Out-of-date descriptions:** A17 (48 layers / 14.9 mm, now 50 / 15), A12 ("More…" groups), A14, A25, E03, E09.
7. **Timing tests in the normal run** (A02, E13, E26) fail when the machine is busy; they belong in their own group.

## Maintainability

- **Long functions:** `buildWalk` 408 lines; `penFills` 173; `infill` 131; `render` (preview) and `drawStack`
  ~7.5 k characters each; `applyDesign` and `layerReadout` ~3 k.
- **Long lines:** ~460 engine lines over 120 characters; app lines up to 689.
- **Repeated code:** seven hand-built spatial grids with four key schemes; arc-length and Bézier code still
  duplicated despite the shared helpers.
- **Coupling in the app:** files write each other's variables (`readyOverride`, `plateCache`, `posManual`); the
  layer-height box has listeners in four files that rely on order and `queueMicrotask`; restoring a design depends
  on one hand-kept list of ~15 refresh calls. One "settings changed" event would replace most of this.
- *(Removed in v83.)* **Dead code:** CSS `.presets`, `details.sub`, `.sub-body`; hidden inputs `#file`, `#modelFile` and their handlers
  (the drop area replaced them); `FLT.smallestPrint` (tests only); an impossible branch in `uncross`; walk fields
  nothing reads; settings `printHeight`, `defaults.position`, `lineMode`.

## Suggested clean-up order

1. **Print safety (small):** findings 1–3, clamp Z / lift / speeds, the float readouts.
2. **Test foundation:** a "settled" signal in the app and waits on it; fail tests with no checks or on time-out;
   always close pages; a separate perf group. Expect the app run to drop from 11 minutes to a few.
3. **App G-code contract test**, plus tests for the test print, painting areas and the ready list.
4. **Engine fixes:** junction reach, the error readout, lane speed, the sample cap message.
5. **Structure:** a single settings-changed event; split `buildWalk`, `render`, `drawStack`; one spatial-grid helper;
   remove the dead code; wrap long lines. Done with the GitHub move, each step becomes its own commit.
