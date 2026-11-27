# Driving Unbroken as an agent

How an agent (Claude in Chrome, a Playwright script, a test) works the web app the way a person does, and reads what
it did as data instead of screenshots. Written after the first agent trial (`docs/AGENT-TRIAL.md`); the calls since
v159.

The ids and calls here are kept stable: a change to any of them is a breaking change, listed in CHANGELOG.md.

## Start

| To | Do |
|---|---|
| Open a picture from a link | `index.html?src=https://…/logo.svg`, or type the link in the Picture card's link box (`#picUrl`, then `#picUrlGo`), or paste the link anywhere on the page. The site must let other pages load its pictures (Wikimedia and most image hosts do); if not, the chip says so. |
| Open a file | `#picFile` (pictures) or `#anyFile` (a picture, an STL or a saved design) |
| Start on an example | `?example=leaf` (also `still`, `face`, `shapes`, `smiley`, `lettering`) |
| Turn a feature off | `?off=vase,plotter` |

SVGs with only a viewBox (most logos) come in at 1600 px on their long side, in the viewBox's shape.

## Know when it's done

- `document.body.dataset.state`: `loading`, `empty` (nothing to trace yet), `working` or `ready`. Ready means every
  job (trace, size search, layers, Optimize tracing, the coverage check) has finished and the app has been quiet for
  half a second.
- `await window.unbroken.whenReady(ms)` resolves with `status()` once it's ready (or empty).
- The corner label (`#chip`) is a live region: terms · error · connectors.

## The calls (window.unbroken, since v159)

Every call works through the same controls a person uses, waits until the app is ready, and answers with plain data.
Prefer them to clicking: they don't depend on the layout and don't break when a panel moves.

| Call | Does |
|---|---|
| `await open(url)` | Opens a picture from a link. Answers `status()`. |
| `parts({ widthMM, bandGapMM = 1, sideGapMM })` | The picture's parts, the way a logo is laid out: bands one above the other, then groups side by side within a band, split where the gap is wider than `sideGapMM` (default: a fifth of the band's height, at least 4 mm, so letters stay together and a mark beside a word doesn't); a dot over an i joins its line. Each: `box` (fractions of the picture, for `select`), `widthMM`, `heightMM`, `strokeMM` (typical stroke width), `shapes`, `share` of the ink. Sizes are for the whole picture's ink at `widthMM` (default: the width now, with no selection). |
| `await select(box \| null)` | Traces only that part (`[x0, y0, x1, y1]`, fractions), or the whole picture again. A new selection starts at the app's size: set the width after. |
| `await set({ … })` | Settings by name, applied in this order, each settled before the next: `madeFor` ("printer" / "plotter"), `input`, `text`, `font`, `needle`, `chocolate` (by value or part of the name: "0.84", "Dark"), `style` ("centerline" / "outline"), `threshold` (−60 … 60), `smoothing` (the slider, 0 … 30), `ignoreSpecks` (0 … 200), `fillNarrowGaps` (an outline for a printer: gaps narrower than the needle can draw filled before tracing; on), `dropFarAway` (0 … 40), `looseEnds`, `cornersMM`, `crossings`, `allowOverlaps`, `lineGapMM`, `widthMM`, `pieces` (a picture: true for a G-code file a part), `splitMM`, `heightMM`, `letterHeightMM`, `fitInside` ([w, h]), `terms` (a number or "auto"), `copies`, `printHeightMM`, a base (`baseLayers`, `baseDensity` %, `basePattern` "lines" / "rings", `baseCover` "outline" / "inside", `baseTurn`), ties (`ties` true / false, `tieMaxMM` 2 … 20, `tieEveryMM` 4 … 40, `tiesInsideLetters` true / false, `tiesStandUp` true / false: a cake topper, ties row to row first), `name`. An unknown name is refused. Answers `status()`. |
| `await optimize({ keep = true })` | Optimize tracing at the size now. Answers `{ ok, kept, changed: { sens: { from, to }, … }, message, status }`; `keep: false` shows what it would change and puts the settings back. Run it after the last size change. |
| `snapshot({ pxPerMM = 8 })` | The printed line from above at a fixed scale, as `{ png (data URL), widthMM, heightMM }`. Snapshots at the same `pxPerMM` compare truly: use them for option sheets. |
| `await export(kind, { download = true, anyway })` | `"gcode"`, `"dxf"` (for choc OS) or `"svg"` (the plotter's page). `download: false` answers the file's text instead (a picture in pieces: `files`, a `{ name, text }` each). A red line in the ready list stops a G-code export unless `anyway: true`: answers `{ ok: false, notReady }`. |
| `await view(v)` | What the big view shows: `"line"`, `"plate"`, `"layers"`, `"page"`. |
| `status()` | What's on screen (below). |
| `await whenReady(ms)` | Waits for ready (or empty), answers `status()`. |

## Read what's on screen

`window.unbroken.status()` returns:

```js
{
  state, version, madeFor: "printer" | "pen plotter", input: "picture" | "text" | …, source, selection, name,
  pieces: [{ name, widthMM, terms, open }] | null,   // a picture in pieces, a text's lines …
  trace: { style: "centerline" | "outline", terms, errorMM, connectors, threshold, smoothing, smoothingSlider },
  size: { widthMM, heightMM, pickedByApp: { mark: "medium detail", widthMM } | null },
  line: { widthMM, spacingMM, needle },
  layers,                                            // the Print step's layers readout, or null
  ties: { count, addedMMPerLayer, leftOut } | null,  // ties on: how many, line added, how many left out
  ready: [{ level: "ok" | "warn" | "bad", text }],   // the Print step's ready list
  lastExport,                                        // "Exported … · …" for the design on screen, else null
}
```

- **error** is the line against the strokes that were traced. It can't see a part of the picture the trace left out.
- The ready list's **coverage** line catches some of that: the share of the picture's dark parts more than one line
  spacing from the line. It reads the picture with the trace's own threshold, so a part too light for the threshold
  doesn't count: compare `parts()` with a `snapshot()` to see what's missing.
- **pickedByApp**: the app sets the size of a new picture to its medium-detail mark. It's null once a size is typed.

## The controls behind the calls

For an agent that clicks instead (or to find a setting on screen):

| Refinement in plain words | Control |
|---|---|
| Bigger / smaller | `#outW` or `#outH` (then a `change` event), or Fit inside a box: `#fitW`, `#fitH`, `#fitBtn` |
| Closer to the picture, keep thin parts | `#optBtn` (Optimize tracing, at the top of the Line step's Fit card; can take a minute), then `#optAccept` or `#optUndo`. It changes `#sens`, `#blur`, `#minLen`, `#loose` and the terms; never the size, needle or painted areas. |
| One line down each stroke / around each edge | `#modeCenter` / `#modeOutline` |
| More or less of the light parts | `#sens` (ink threshold), `#autoSens` |
| Smoother / sharper | `#blur` |
| Cleaner outline in tight spots (a W's notch, between serifs) | `#fillNarrow` (Fill gaps too narrow for the needle: on) |
| Leave out specks / far-away parts | `#minLen` / `#far` |
| Only part of the picture | `#selectBtn` (Select area): the preview switches to the whole picture; drag a box on it, then Trace selection |
| Fewer jumps between parts | `#loose` (Loose ends) |
| Needle, chocolate | `#needle`, `#chocolate` (Material); the line is `#lineW` + `#lineGapMM` |
| Copies | `#copies` |
| Taller | `#printHeightMM` |
| Hold a large print's parts together | `#ties` (Print: Ties), `#tieStand`, `#tieInside`, `#tieMax`, `#tieEvery`; tap ties on `#tieEdit` (the person's taps, kept in `#tieEdits`), `#tieReset`; or a base: `#baseLayers` |
| Name the files | `#designName` |
| Files | `#gcodeBtn` (G-code, zipped), `#dxfBtn` (DXF for choc OS), `#exportBtn` (plotter SVG) |
| A picture, text or pattern in relief on a wall (flat plaque or round) | `#reliefMake` (Input card: Make a relief; made again it keeps the shape), then the vase's Shape (`#vpPlaque` Flat, `#vpThick`; `#vpCircle`) and Texture (`#vtRelief`; height: `#rlSmooth` + `#rlContrast`, `#rlSteps` + `#rlLevels`, `#rlShapes` + `#rlBevel`; `#rlLineW` (text, pattern); `#rlInset` (tap a part: in, flat, out; `texture.taps`); `#rlSwap`; `#vtDirOut` / `#vtDirIn` / `#vtDirBoth`; `#vtSideFront` / `#vtSideBack` / `#vtSideBoth`, `#vtFace` (a polygon), `#vtTurn`, `#vtSpan` (round); `#vtDepth`) |
| A shape that changes into a letter at the top (a morph) | `#mfMorph` (3D model card: Make a morph), or `#moFromLine` (Line tool: Make a morph from this line: the traced line at the bottom). Then the rail's Bottom (`[data-node=mbottom]`: `#vpCircle` …), Top (`[data-node=mtop]`: `#vrLetter`, `#moLetter` one capital, ! or ?, `#moCap` letter size in mm; or `#vrCircle` … ; `#moTopFromLine` a traced line at the top) and Change (`[data-node=mchange]`: `#moFrom` / `#moTo` %, `#moCorners` / `#moEven`, `#moTurn`, `#moAuto`, `#moMsg` says whether it prints or how tall it needs to be, `#moFlip` Turn it over). `#mfVase` turns it back into a vase |
| Check the print by eye | 3D layers view, `#pvAbove` (From above: straight down on the plate); View menu `#pvLight` (auto, front, raking: raking shows a relief best) and `#pvLightFrom` (degrees clockwise from the top) |

Steps: `label[for=viewArt]`, `label[for=viewDesign]` (Line), `label[for=viewChoc]` (Print), `label[for=view2D]`
(Plot). The map opens the panel a control is in when it's clicked (see the tests' `mapNav` in
`source/tests/lib/app.js`).

## How to work with a person

The full playbook, with what the trials taught (sizes for lettering, when to split into pieces, what made things
worse): [`docs/AGENT-PLAYBOOK.md`](../docs/AGENT-PLAYBOOK.md).

Make options first, then refine (decided 23 November 2026): people rarely know what they want before they see it.
Ask up front only what a preview can't show: printer or plotter, and a rough size or box. Then show a few distinct
options side by side with their numbers (whole picture at the app's size; larger after Optimize tracing; split into
parts; simplified), let the person pick, and turn their words into the refinements above, showing each new version
next to the last.

Never send a file to a printer: export only, for the person to check (decided 17 October 2026).
