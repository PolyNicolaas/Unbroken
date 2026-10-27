# Source code

Code shared by every version of the tracer.

| Path | What it is |
|---|---|
| `engine/fonts.js` | Nine single-stroke fonts for the Text source (Hershey and EMS fonts; acknowledgement and licence notes are in the file header). Loaded after the engine. |
| `engine/00-util.js` … `engine/13-patterns.js` | The engine, with no DOM, split into fourteen parts in the order the data flows: shared helpers (00), image in, line maps, text, the walk (and hand edits to it), fills, Fourier series, measuring, shaping the drawn line, size / plate / layers, export, the pipeline stages the app calls, 3D models, and geometric art. Every part adds its functions to one `UNB` object; helpers more than one part needs live in `00-util.js` (`UNB._u`), everything else stays private to its part. Both the web app and the desktop app load these files — edit them here only. |
| `engine/core.js` | The engine's contents list (every part and the functions in it) and its loader: in Node and in a Web Worker it loads the parts itself; the page lists them in `web-app/index.html`. Exposes `window.UNB` in a browser and `module.exports` in Node. Test E25 checks the three lists agree. |
| `engine/worker.js` | Background engine for the web app: a Web Worker that loads `core.js` (which loads the parts) and runs its functions off the page (`{ id, fn, args }` in, `{ id, result }` / `{ id, progress }` out), so the controls stay responsive. Calls it runs: `stageTrace`, `stageSignal`, `synth`, `stageFinal`, `sweepSteps`, `smallestPrintSteps`, `scoreLines`, `stagePrint`, `penFills`, `modelStack`, `hiddenLines`. If workers aren't allowed (e.g. the page opened straight from disk) the app runs the same calls on the page instead. |
| `tests/` | The test suite (engine and app) and the test plan: each test's purpose and pass criteria. Run before publishing. See `tests/README.md`. |
| `challenges/` | Practical prints taken through the app with every version (`run.js`), and `compare.js` to check two runs file by file. See `challenges/README.md` |
| `tools/` | `wrap-comments.js`: wraps comments to 120 characters after the formatter (prettier, `.prettierrc.json` at the top); `line-font.py` and `center-font.py`: turn a font on the computer into an entry for `engine/fonts.js` (letters that are already lines, or the middle line of thin strokes) |
| `bench/` | Trace-quality benchmark: traces 11 test images with the app's pipeline and reports error, retracing, connectors and crossings, with a preview per image. See `bench/README.md`. |
| `printer/choc-mate-2/` | The choc mate 2 printer profile: manufacturer settings, start and end G-code, and what the exporter still needs. |

## Using the engine from Node

```js
const UNB = require("./source/engine/core.js");
```

## Finding a problem

Each stage of the line is one engine part, so a wrong result usually points straight at a file:

| What looks wrong | Where to look | Test that covers it |
|---|---|---|
| Lines missing, doubled or in the wrong place before any fitting | `02-lines.js` (centreline, outline, shading, erasing) | E01, E02, E03 |
| Lettering size or spacing | `03-text.js` | E10 |
| The path jumps, retraces, drops a part, crosses where strokes meet, or the loops at stroke ends | `04-walk.js` (`buildWalk`, `offsetDoubled`, `snapWalk`, `roundCorners`) | E04, E16, E18, E19 |
| Infill or pen fills | `05-fill.js` | E20, E22 |
| Too many or too few terms, wobble | `06-fourier.js`, `11-stages.js` (`autoTerms`, `pickTerms`) | E12, E17 |
| Error numbers | `07-measure.js` | E01 |
| Crossings left, strands too close, problem marks | `08-shape.js` (`shapeLine` in `11-stages.js` calls it) | E05, E06, E18 |
| Smallest size, plate layout, layers | `09-plate.js` | E07, E08, E21 |
| A file that won't open, or G-code off the plate | `10-export.js` | E09, E11 |
| STL slicing or the line drawing of a view | `12-models.js` | E23, E24 |
| An Edit line edit moving the wrong part, or not reaching the trace | `04-walk.js` (`editWalk`), `11-stages.js` (`stageTrace`) | E32, A30 |
| A geometric pattern crossing, touching, or tracing as more than one line | `13-patterns.js` (`pattern`, `patternLayout`) | E33, A30 |
| Slow tracing | `04-walk.js` and `08-shape.js` take most of the time | E13 (time budget) |

To reproduce something outside the app, run the same stage in Node:

```js
const UNB = require("./source/engine/core.js");
const walk = UNB.stageTrace({ blurred, mode: "centerline", sens: 0 }, w, h, { minPix: 15 });
const sg = UNB.stageSignal(walk, d, w, h, {});                 // d: spacing in working px
const { curve } = UNB.autoTerms(sg.sp.ax, sg.sp.order, sg.Nmax, sg.jumpS, sg.open);
const fin = UNB.stageFinal(curve.re, curve.im, { closed: !sg.open, d, unx: 90, walk });
```

`source/tests/lib/trace.js` does exactly this for the tests and is the quickest starting point. `cd source/tests; node run.js --only E20 -v` runs one test with its details.
