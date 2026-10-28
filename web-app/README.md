# Web application

The browser app: UI, preview, drawing animation, editing tools, and three tabs: Trace, 2D (pen plotter) and 3D (printers).
It loads the engine parts from `../source/engine/` (listed in `index.html`) and runs the heavy maths in `../source/engine/worker.js` (a Web Worker), so keep the folder layout intact. Workers need the page served over http(s) (e.g. `python3 -m http.server` in the repo root); opened straight from disk it still works, just with short freezes while tracing.

## Files

| File | What's in it |
|---|---|
| `index.html` | The page: layout and controls only. Loads the files below in order. |
| **`settings.js`** | **Settings you can edit:** chocolates, needles, the printers, paper, every control's starting value, the Start-from presets, the text and undo rules, and engine tuning. See below. |
| **`css/theme.css`** | **The look, in one file you can edit:** every colour (light and dark mode), the fonts, and three dials for corner roundness, text size and spacing. See below. |
| `css/app.css` | Layout and styling, built entirely on the names in `theme.css`. |
| `js/state.js` | Shared state (`st`: the current design and its trace), the `$` helper, and the print-settings signal (`printSettingsChanged` / `onPrintSettings`: the printer, chocolate, needle or layer height applied). |
| `js/ui.js` | Small page helpers every file uses: `fmt`, `clamp`, `intIn`, `hexRGB`, `toast`, `setStatus`, theme colours (`css`, `cssRGBA`), `fitCanvas`, `saveFile` / `saveError`, and `busyFor` (the "working…" label, one reason per job). |
| `js/config.js` | Reads and checks `settings.js`, falls back to built-in values for anything missing or wrong, and applies it: needle menu, chocolate menu and details, printer menu, starting defaults. |
| `js/engine-bridge.js` | Background engines: runs engine calls in Web Workers with cancellation, or on the page when workers aren't allowed. Four of them: `PIPE` (the trace), `AUX` (the term chart), `OPT` (Optimize tracing), `LAY` (the 3D and 2D tabs' lines and model slicing). |
| `js/source.js` | Which source is in use (`isModel`, `textMode`), built-in samples, reading the settings, setting the source image, and the Text source. |
| `js/pipeline.js` | The trace pipeline: line map → walk → spectrum → series → final line, the smallest-size search and the term chart. |
| `js/preview.js` | Drawing the preview, in layers (`render`: under the line, the line, marks on it, the turning circles), the size box and the error chart. |
| `js/tools.js` | Hand tools (select area, erase, set start, draw, crossing areas, connector paths), auto threshold, drag-and-drop and paste. |
| `js/patterns.js` | The Pattern card on the Art tab: the pattern's settings, built from the style's own list (`UNB.PATTERNS[style].params`: sliders, choices, switches), handed back to art.js. |
| `js/art.js` | The Art tab: the Input switch (`st.art`: a picture, the text, a pattern or a 3D model, one at a time, each keeping its settings), what the trace starts from (`artApply` → `useSource` in source.js), and a pattern's or the text's lines for Plot as drawn (`artVectors`). |
| `js/readouts.js` | The corner label, error and gap numbers, and the formula panel. |
| `js/steppers.js` | − and + beside every number box (touch-friendly; holding repeats), boxes made later included. |
| `js/scroll.js` | The preview kept in view (the phone's pinned preview: Bigger / Smaller) and the settings Wheel. |
| `js/workflow.js` | The workflow: made for a printer or a pen plotter, the steps Art → Line → Print or Plot, the Line step's switch (one continuous line, separate strokes, as drawn), and tracing separate strokes. |
| `js/levels.js` | The Image prep card's grey levels (a row per grey: Trace or Skip) and the Tap the background tool. |
| `js/controls.js` | The run scheduler (start, debounce and cancel traces) and the control wiring: sliders, size, line spacing and needles. |
| `js/export.js` | The Export buttons: 2D files (through `plot.js`) and the 3D file (G-code) for every copy on the plate. |
| `js/optimize.js` | Starting-point presets and Optimize tracing. |
| `js/views.js` | The printer menu, the plate, copies and mini-map, the View menu, the Trace / 2D / 3D tabs, the big view's tabs and collapsible sections. |
| `js/zoom.js` | Zoom and pan in each view of the big view, and the One copy / Whole plate switch. |
| `js/layers.js` | Layers on the 3D tab: Filled base and walls stacked into one 3D path (`UNB.layerStack`), the base / wall line variants (own background engine), readout, preview and the per-copy paths for G-code. |
| `js/pieces.js` | A text of several lines printed as a piece per line (Plate card, Lines of text): each line traced again on its own, the pieces packed on the plate (`UNB.plateLayoutPieces`), each with its own layers; One copy shows the piece picked. |
| `js/plot.js` | The 2D tab: the pen version of the line (no strands or loops), paper, margins and pens, shapes (gap closing, smallest shape), fill pens (click or drag across shapes to fill them; hatch or contours, following the image's tone; colour from image), the page preview, and the SVG for Saxi (one layer per pen) and flat DXF. |
| `js/model.js` | 3D models as a source: STL loading (and the sample vase), quarter turns, the shaded preview you can look round, the footprint on the plate, slicing for the 3D tab (`UNB.modelStack` in the layers engine), and the line drawing of a view (`UNB.hiddenLines`) that Draw this view hands to the tracer. |
| `js/notes.js` | The Suggestion box at the bottom of every tab: ideas and bugs written down while using the app, kept with the published page (its database) or, elsewhere, in the browser. |
| `js/history.js` | Undo / redo and design files. |
| `js/main.js` | Start-up. |

The scripts are plain scripts, not ES modules, so the app still works when `index.html` is opened straight from disk
(browsers block modules there). They share top-level names, so the load order in `index.html` matters: a file may use
anything from an earlier file at load time, and anything from any file inside functions.

### Who owns which state

The files share one state object, `st` (`js/state.js`). Each field has an owner, the only file that sets it: the trace
results (`pipeline.js`, committed in one step when a run finishes), the source (`source.js`), the model (`model.js`),
line settings (`controls.js`), hand edits (`tools.js`: the selection, erasing, the start point), the Art tab's input (`art.js`), and each view its own (`preview.js`, `layers.js`, `plot.js`); a text's pieces belong to `pieces.js`.
`config.js` may also set starting values and `history.js` puts a whole design back. The full table is at the top of
test E27, which fails when a file sets a field it doesn't own: change the table on purpose, or ask the owner (a small
function like `setModelHeight`) to do it.

### Finding a problem in the app

- **Where a value comes from:** every control is read where it is used (`$("id")`), so searching the `js/` folder for the control's id finds every reader. `settings.js` values arrive through `CFG` (`js/config.js`).
- **Stale results:** caches built from the traced line key on `st.finalVer`, which goes up every time a trace finishes (`finalize` in `pipeline.js`): the plate (`plateNow`), the layers (`buildLayers`) and the pen line (`penLine`). A view that doesn't follow a change usually means its cache key is missing that setting.
- **Engine or page:** every heavy step is an engine call (`PIPE.call("stageFinal", …)` and so on). The same call can be run in Node on the same inputs (see `source/README.md`, Finding a problem); if the result is right there, the problem is on the page.
- **"working…" never clears:** `busyFor(reason, on)` in `ui.js`; each job sets and clears its own reason.
- **Slow steps** say so on the page: Auto threshold, Optimize tracing, the size search, the first 2D page, the layers with a filled base, slicing a big or solid model, and drawing a model's view.


## One interface

**The big view** (left) has four tabs: **Line** (the traced line, the tools and the plate mini-map; a 3D model turns
here), **2D page** (the pen plotter's paper; click shapes to fill), **Plate** (every copy on the printer's plate) and
**3D layers** (drag to turn, double-click to go back). The **settings tabs** (right) are Art, Trace, 2D and 3D; picking
one brings its view (Art and Trace: Line, 2D: 2D page, 3D: 3D layers), and the view tabs can change it. **Play drawing** plays whichever view is showing:
the circles drawing the line, the pen drawing the page and then its fills, or the needle stacking the layers
(`redrawStage` in views.js; preview.js runs the clock). Every view zooms, from 25% to 3000% (− / + / Fit at the top right; pinch or Ctrl / ⌘ +
scroll about the pointer; scroll, Space + drag or the middle button to pan, once zoomed in), each keeping its own zoom
(`zoom.js`).
The Plate and 3D layers views switch between **One copy** (the design alone, framed to fill the view) and **Whole
plate** (every copy where it prints: the 3D view then draws the print from its own G-code, read back with
`UNB.readGcode`, so the purge line, travel and wipes show too). Switches at the bottom turn Walls, Fill, Travel and
Purge & wipes on and off. **Solid (as printed)** in the 3D layers view draws each line as its chocolate bead (the needle's
width, one layer tall, true height).

The **Art tab** (it opens first) is in cards: **Input** (Picture, Text, Pattern or 3D model, and the drop area), the
input's own card (**Picture**, **Text**, **Pattern** or **3D model**) and **Next** (Trace it, Plot as drawn). The
**Trace tab** is in cards: **From the Art tab** (what it traces) · **Tracing** (images only: start from, style,
threshold, smoothing, more tracing settings, image prep) · **Line** (line width + gap, closed or open, loose
ends, round corners, more line settings) · **Size** (slider, width and height, fit inside a box; for text the letter
height, linked to the size) · **Fit** (terms, the error chart, Optimize tracing).

Each tab shows all its controls (the Simple / Advanced switch was removed in October 2026). The less-used ones are
folded into groups that open with a click and remember whether they were open: **More tracing settings**, **Image
prep**, **More text settings**, **More line settings** on the Trace tab, **Fine-tuning** and
**Printer profile** on the 3D tab. **Collapse all / Expand all** fold whole cards. The explanations sit on the page under
the controls they explain; warnings use the warning colour. Save and Open sit in the **File ▾** menu next to **View ▾**.

The app opens set for chocolate: the 18G needle (3D tab) gives a 0.84 mm line width, with a 0.5 mm gap, so lines start at least 1.34 mm apart. Out-and-back strokes are then two strands that far apart with a round loop at each end (see "Stroke ends: the loop" in the main README), which the error readout counts as distance from the traced line. Change `needle` (or `lineWidth`) and `gapBetweenLines` in `settings.js` to open differently.

The readout at the top of the preview shows terms, error and, when there are any, the jumps between separate parts ("· 3 jumps"). They are always drawn, since the printer can't stop the flow; hover the readout to see that note.


To fold a control away, move it into one of the `details.more` groups in `index.html`. Test A12 lists the controls each
tab must show and the groups that must open.

## Changing the look

Open `css/theme.css`, change values, save, and reload. Everything the app shows takes its colours from here, including
the preview's overlays (crossing areas, connector paths, the plate's fit shading) and the "Draw your own" pad.

- **Dials:** `--corner` (0 = square corners), `--text` (e.g. 1.15 for bigger text) and `--space` (e.g. 0.85 for a
  denser layout). At 1 the app looks exactly as designed.
- **Colours:** set once for light mode and once for dark mode. The dark-mode values appear twice, and both copies
  must match; test E15 checks this.
- **Fonts:** three families (title, body, numbers). They load from Google Fonts in `index.html`; change the link there
  too if you pick other fonts.
- The printed-line colour comes from the chosen chocolate in `settings.js`, not from the theme.

Run the tests after editing: E15 names any colour the app uses that the theme no longer defines.

## Editing settings

Open `settings.js` in any text editor, change values, save, and reload the app. Each value has a comment with its
unit, its allowed values, and whether the app uses it today (`(used)`) or keeps it as a record. Add a chocolate by
copying a whole `{ … },` block and giving it a new `id`.

| Section | What it sets |
|---|---|
| `chocolates` | Each chocolate: colour, print speed, needle, cost per 100 g, density, temperatures, product and dietary details, links |
| `needles` | The Needle menu: gauge, hub colour, inside diameter |
| `printers` | Each printer: bed, build height, print height, lift, layer height, speed, minimum layer time, retraction and wipe, travel speed, cartridge diameter (sets E per mm with the needle), start and end G-code (choc OS's purge line). The first is the default (or `defaults.printer`). |
| `defaults` | Every control's starting value, panel by panel: source, tracing, lines and size, text, plate, layers, paper and pen, export formats, view, tools |
| `presets` | What the Start-from buttons (Line drawing, Photo, Logo) set |
| `rules` | Text limits (lines, readable letter height per font, letter and word gaps) and how many steps Undo remembers |
| `engine` | Deeper tracing numbers: term-count tolerance, minimum strand gap, packed-stroke splitting, far-group size. Change with care and run the tests. |

- Picking a chocolate in the 3D tab sets its preview colour, the G-code feed (print speed × 60) and its
  preferred needle (E per mm follows the needle and layer height), and shows its details: cocoa, price per 100 g, working temperature,
  dietary flags, allergens, notes and a link. Cost and density are stored for the planned chocolate and cost estimates.
- The chosen chocolate is saved with a design file.
- If the file has a mistake, the app still opens on built-in values and says what's wrong in the 3D tab.
  Run the tests (`npm test` in `source/tests`) after editing: test E14 names any wrong entry.

## Run locally

Open `index.html` in Chrome, Safari, Edge or Firefox. Everything runs in the browser; nothing is uploaded.

## Build for publishing

`node web-app/build.js` (or `npm run build` in `source/tests`) makes `web-app/dist/`, the copy to publish:

1. runs the full test suite and stops if any test fails (`--quick` runs the quick set, `--no-tests` skips them for a try-out build);
2. copies the page, `settings.js`, `css/`, `js/` and the three engine files into one flat folder, so it works on its own;
3. checks every file the page loads is in the folder and nothing still points at `../source/`;
4. opens the built copy in a headless browser and checks it traces the sample with its background engine and no errors;
5. writes `dist/BUILD.txt`: when it was built, the test result, and a checksum per file.

If any step fails the build stops with the reason, and the previous `dist/` stays as it was. `dist/` is not kept in git.

## Version 1 plan: embeddable web app

Package this so it drops into any website:
- bundle the files in `dist/` into fewer files;
- self-host the fonts (currently Google Fonts);
- offer an `<iframe>` embed, or a `<unbroken-line>` web component with attributes for defaults;
- remove Claude-specific code paths (the `window.claude` download hook already falls back to browser downloads).

## Design files

**File ▾ → Save design** downloads one `.unbroken.json` file holding the image (PNG, or JPEG for large photos) or the typed text, every design setting, the selection, erasing, start point and painted areas, the Art tab's input with the pattern's settings and the picture kept while another input is in use, and the plate, layer and paper settings and the fill pens with the areas they fill. **File ▾ → Open design…** (or dropping the file on the page) restores it exactly. View options (line view, box, mini-map, …) are not saved. Undo / redo (Ctrl/⌘ Z, Shift Ctrl/⌘ Z) steps through the same design state, up to 100 steps.
