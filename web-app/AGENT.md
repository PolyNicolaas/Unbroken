# Driving Unbroken as an agent

How an agent (Claude in Chrome, a Playwright script, a test) works the web app the way a person does, and reads what
it did as data instead of screenshots. Written after the first agent trial (`docs/AGENT-TRIAL.md`). Since v156.

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

## Read what's on screen

`window.unbroken.status()` returns:

```js
{
  state, version, madeFor: "printer" | "pen plotter", input: "picture" | "text" | …, source, name,
  trace: { style: "centerline" | "outline", terms, errorMM, connectors, threshold, smoothing },
  size: { widthMM, heightMM, pickedByApp: { mark: "medium detail", widthMM } | null },
  line: { widthMM, spacingMM },
  ready: [{ level: "ok" | "warn" | "bad", text }],   // the Print step's ready list
  lastExport,                                        // "Exported … · …" for the design on screen, else null
}
```

- **error** is the line against the strokes that were traced. It can't see a part of the picture the trace left out.
- The ready list's **coverage** line catches that: the share of the picture's dark parts more than one line spacing
  from the line. **Line to picture** in Optimize tracing's result is the same yardstick, as an average distance.
- **pickedByApp**: the app sets the size of a new picture to its medium-detail mark. It's null once a size is typed.

## The controls an agent uses

| Refinement in plain words | Control |
|---|---|
| Bigger / smaller | `#outW` or `#outH` (then a `change` event), or Fit inside a box: `#fitW`, `#fitH`, `#fitBtn` |
| Closer to the picture, keep thin parts | `#optBtn` (Optimize tracing, at the top of the Line step's Fit card; can take a minute), then `#optAccept` or `#optUndo`. It changes `#sens`, `#blur`, `#minLen`, `#loose` and the terms; never the size, needle or painted areas. |
| One line down each stroke / around each edge | `#modeCenter` / `#modeOutline` |
| More or less of the light parts | `#sens` (ink threshold), `#autoSens` |
| Smoother / sharper | `#blur` |
| Leave out specks / far-away parts | `#minLen` / `#far` |
| Only part of the picture | `#selectBtn` (Select area): the preview switches to the whole picture; drag a box on it, then Trace selection |
| Fewer jumps between parts | `#loose` (Loose ends) |
| Needle, chocolate | `#needle`, `#chocolate` (Material); the line is `#lineW` + `#lineGapMM` |
| Copies | `#copies` |
| Taller | `#printHeightMM` |
| Name the files | `#designName` |
| Files | `#gcodeBtn` (G-code, zipped), `#dxfBtn` (DXF for choc OS), `#exportBtn` (plotter SVG) |
| Check the print by eye | 3D layers view, `#pvAbove` (From above: straight down on the plate) |

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
