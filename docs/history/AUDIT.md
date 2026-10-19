# Code audit · October 2026

> History, kept as written: the first audits (v62 and v65). The later review is [REVIEW.md](REVIEW.md) (v76), next to
> this file; the design notes are in ../../DESIGN.md, and ../../CHANGELOG.md says what each version changed. Anything
> still open is in ../../ROADMAP.md.

A pass over every engine and app file to annotate the code, remove duplicated code, fix the bugs found along the
way, and split the code into parts small enough to find and diagnose problems. Slow steps got a short "this can be
slow" note on the page instead of a rewrite. Every test passes after it (see `source/tests/README.md`).

## Structure

- **The engine is split into thirteen parts** (`source/engine/00-util.js` … `12-models.js`), one per stage, in the
  order the data flows. `core.js` is now the contents list and the loader. Helpers used by more than one part live in
  `00-util.js` (`FLT._u`); everything else stays private to its part. Test **E25** checks that `core.js`, `index.html`
  and the files on disk list the same parts in the same order, and that no part uses another part's private helper.
- **New app file `web-app/js/ui.js`** with the page helpers that were spread over several files.
- `source/README.md` and `web-app/README.md` each have a **Finding a problem** section: which file to look in for
  which symptom, which test covers it, and how to rerun a stage in Node.

## Duplicated code removed

| Was | Now |
|---|---|
| Region labelling (flood fill) written out in the infill and the pen fills | `label4`, `labelBoxes` (00-util) |
| Marching-squares contours, twice (the infill's copy could divide by zero) | `isoContours` (00-util) |
| Drawing a polyline into a grid, twice | `rasterPolyline` (00-util) |
| Cumulative length along a line, about eight copies | `cumLength` (00-util) |
| Even resampling of a closed loop, three copies | `resampleLoop` (00-util) |
| Union-find, four copies | `makeUF` (00-util) |
| Priority queue in the walk, two copies | `makeHeap` (00-util) |
| Bounding box, five copies | `bbox` (00-util) |
| Gaussian kernel | `gaussKernel` (00-util) |
| SVG path data for polylines (2D export and the model's view) | `svgPolylines` (00-util), `svgPathD` (10-export) |
| The DXF header and footer, twice | `dxfDoc` (10-export) |
| The automatic term count (sweep + pick + synth), four copies | `FLT.autoTerms` (11-stages) |
| Untangle-or-space the fitted line, three copies | `FLT.shapeLine` (11-stages) |
| Point grid for the spacing checks, three copies | `pointGrid` (08-shape) |
| A mesh corner's key (slicing, hidden lines) | `cornerKey` (12-models) |
| App: `toast`, `fmt`, `css`, `cssRGBA`, `hexRGB`, `intIn`, the download code, canvas sizing (seven copies) | `ui.js` (`fitCanvas`, `saveFile`, …) |
| App: stopping the animation, clearing hand edits | `stopPlay` (preview.js), `resetHandEdits` (source.js) |

## Bugs fixed

**Engine**

- An open line's per-point tags (connectors, junctions) were mirrored one point off from the line itself (`stageSignal`).
- `minGap` missing → NaN spacing in `stageFinal` / `scoreLines`.
- Layers: `Math.max(...z)` could overflow the call stack on a tall stack; empty layers at the bottom of a model shifted
  walls into the base list; a model layer counted outlines too small to join as joined (`dropped` now reported).
- Mean point spacing counted the closing segment of open lines (`arcSteps`).
- Problem marks used their own crossing test; now the same `findCrossings` as everything else.
- `toBezier` didn't check the last sample of an open line for crossings.
- G-code header said `size 0 x 0 mm`; it now gives the printed extent.
- Pen fills: the stroke-end search went wrong across the seam of a closed line; `q.push(...big)` could throw on a large
  grid.
- The infill contours could divide by zero on a flat stretch of the distance field.
- `chamfer` added up to 0.7 px of rounding to every point; the curve raster missed the last point of open lines.
- `pruneSpurs` stopped following a branch at a fixed 64 px, so wide strokes kept long spurs.
- `sliceMesh` dropped a real point from chains that don't close (meshes with holes).
- `chainSegments` rebuilt the whole line on every step backwards (slow on big drawings).

**App**

- The pen line, plate and layer caches keyed on a few sample points of the line; they now key on `st.finalVer`.
  The pen line also ignored Simplify, and the model's layer key turned the placement into "[object Object]".
- Simplify didn't record an undo step or update the 3D / 2D tabs.
- The plate cache and size marks ignored a printer change.
- A printer or chocolate change updated the print height only through a `setTimeout` listener-order hack.
- Auto threshold left "working…" on after an error; Optimize and the trace cleared each other's "working…".
- A cancelled re-trace could leave the image proportions (`st.rr`) half-changed.
- Switching to a model kept an image tool open; tools could open while a model was the source.
- Loading a non-image switched the source before checking the file; loading an image while a model was shown didn't
  switch back to the image.
- Draw this view traced twice (the preset after the source); a theme change didn't redraw the layer side view or
  the 2D page; the line-map background broke with short or rgb() accent colours.
- Exporting before the layers were ready failed with a TypeError; it now says why.
- Show problems had two change handlers in different files; now one.

## Dead code removed

`FLT.freqOf`, `FLT.closeOK` and the unused group-tag plumbing in the spacing checks, the text lane mask, `pairJumps`,
`snapped`, an unused row index, `fillScale`, `tagF`, the `w, h` passed to `stageFinal`, `rasterize`'s label grid;
in the app `allowFn`, `st.unit` / `unitLabel`, `spacingRange`, an unreachable `st.text` check, the `text` option
sent to `scoreLines`, and two unused CSS rules. Element ids not used by code were kept: they mark the page's sections
for styling and for finding things.

## Slow steps (noted on the page, not changed)

| Step | Why | Note shown |
|---|---|---|
| Auto threshold | 11 full line maps on the page | in the corner label and the button's tip |
| Optimize tracing | a full trace and fit per candidate | "Can take a minute." |
| The size marks | a full fit per size tried | "Finding the smallest size that fits (a few seconds)…" |
| Detailed working resolution, big sizes | more pixels to trace | "Detailed (slower)" |
| Filled base | infill grid and fit per base variant | in the infill hint and the layer readout |
| Slicing a model | every layer fitted; the join search compares every point pair | "slicing… (can take a while for a big or solid model)", "Solid · slower to slice" |
| Big STL files | loading, turning and the shaded preview | in the model hint |
| Draw this view / Export SVG | depth buffer at 1400 px; a wireframe draws every edge | in the drawing hint |
| The first 2D page | a separate pen-line fit | "working… (the first time takes a few seconds)" |
| Export with many copies | every copy's path and the G-code text | "Making the file…" |
| Save design | the image as PNG or JPEG | in the menu item |

Candidates to speed up later: the outline join in `modelLayer` (compares every point pair), `minBox` (every hull
edge against every hull point), the pen-fill stroke order (nearest-next, quadratic), the drift window and the
connector searches in `buildWalk`.

## Left as they are

- Hidden lines skip zero-area triangles entirely (edges included). Registering their edges would turn the shared
  edges of a fan into open edges and draw them; the current behaviour is what E24 checks.
- The tool and model-orbit pointer handlers stay in their own files (`tools.js`, `model.js`); they never act at once.

## Follow-up, same day

Removed as never used: PDF, EPS, HPGL and plain SVG exports, 3D DXF, units other than mm (exports now take mm only:
`exportDXF(paths, H, closed)`, `exportGcode(paths, g)` with paths in bed mm, y up), `FLT.zLine`, the chocolate product
records, the working-resolution menu (settings.js `workingResolution` still sets the base) and the Planned list on the
3D tab. Each is listed in ROADMAP.md under "Maybe later" with the use that would bring it back. The 2D DXF now keeps
the drawing closed when fill strokes follow it. Added: the Suggestion box (`js/notes.js`, test A19), ROADMAP.md and
DESIGN.md.

Later the same day: the Simple / Advanced switch was removed (one interface; `adv-only`, `data-level`, the level
setting and the hover-tip copies of the help text are gone; A12 now checks the one interface), and the desktop-app
folder was deleted (its plan is in ROADMAP.md under Maybe later).

## Round 2 · 15 October 2026

Two independent reviews (one for the engine, one for the app) hunted for bugs with scripts that reproduce them. Every
confirmed bug below is fixed and covered by a test (E26 engine edge cases, A20 races).

**Engine**
- A one-pixel line map (a full stop in a small font) gave a NaN walk, then a crash in `minBox` or a near-hang in the
  spacing step: `buildWalk` now returns no walk when there is no edge.
- `findCrossings` used a fixed 4-unit grid, so smooth plotter SVGs (mm) of small drawings took seconds; the grid now
  follows the line's own point spacing.
- `sliceMesh` split an open chain (a model with a hole) when it started mid-chain; it now follows the chain both ways.
- Pen fills' Smallest shape scanned every contact for every small area (quadratic); now each area keeps its
  neighbour list.
- `offsetDoubled` treated the two ends of a closed walk differently at the seam; both now see the edges either side.
- `snapWalk` copied the whole walk for every connector run; it copies only the run.
- `minBox` gave a 2-pad square for a straight line; the plate layout measured every other point and could undersize
  a footprint; `chainSegments` missed joins across a grid boundary; padded binary STL files were refused;
  `Math.max(...groups)` could overflow; `mirror` and `resampleLoop` broke on 0–1 points.

**App**
- A worker cancelled while loading could report its error late and reject the next worker's calls.
- An old term-count sweep could finish after a new image was loaded and re-fit the old trace over it.
- Typed text still waiting (150 ms) came back after switching to Image or Model.
- Undo to a model state lost your image; switching Text → Model could store the text as the image.
- Optimize kept running on the old picture and then overwrote newer settings; it now stops on a new source, an
  undo or a tracing setting changed by hand.
- Tool clicks and painted areas during a re-trace used the new crop with the old image size; the crop is now part
  of each run and committed with its result.
- Line spacing and needle changes didn't rebuild a model's layers.
- "No lines found" left the old drawing on the 2D page and 3D plate.
- Two open tabs overwrote each other's notes.
- Layers built for export could mix a trace that landed meanwhile; they start again on the new one.
- A printer change now finds the size marks again.

**Practices**
- The version shows next to the title, from CHANGELOG.md (the build writes it).
- `npm run test:fast` (about a minute) for every change; the full suite before publishing. Two timing limits were
  given room for a busy machine (A02, A17), with the reason in the test README.
- Image prep and blur run in the background engine (`FLT.stagePrep`); the photo preset's longest freeze went from
  about 100 ms to 84 ms.
- Each field of the shared state has an owner, checked by E27.

**Left, and why**
- `uncross` carries per-edge flags (connectors) as per-point values, so inside a reversed stretch they sit one point
  off; the connector flags are widened by one point either side, which covers it.
- Rings infill scans the whole area once per ring (slow on big areas); noted on the page already.
- Optimize still blurs each candidate on the page (one short pause per candidate).
