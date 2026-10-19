# Unbroken

*One continuous line.* (Called the Fourier Line Tracer until October 2026.)

Traces an image into one continuous line built from a Fourier series (chained rotating circles),
scores the fit, and exports it for pen plotters (the AxiDraw through Saxi) and chocolate 3D printers.

**Try it in your browser:** https://polynicolaas.github.io/Unbroken/

## Overview

Unbroken turns a picture, typed text or a 3D model into a single unbroken line, and writes that line out as
printer-ready G-code or a plotter drawing.

**Why one line?** A chocolate printer can't stop the flow mid-print and can't lift the nozzle, so every move it makes
leaves chocolate behind. A normal slicer's travel moves and separate strokes don't work. Unbroken plans the whole design
as one continuous path that never crosses itself, never goes back over a line it has laid, and keeps a minimum gap
(about one nozzle width) between neighbouring lines so the chocolate doesn't merge. It also replaces the printer
maker's paid slicer (choc OS) for these prints.

**What it does**

- **Sources:** images (photos, drawings, logos), text in single-stroke fonts, and 3D models (STL) sliced into layers.
- **Tracing:** centreline or outline tracing with optional hatch, cross-hatch or squiggle shading, then a
  non-crossing tour of every stroke, fitted with a Fourier series per axis (X, Y and Z).
- **Printing (3D tab):** G-code for the choc mate 2 with needle size, line spacing, layers, infill, supports built
  into the same line, and several copies on one plate, each finished before the next starts.
- **Drawing (2D tab):** SVG for the AxiDraw through Saxi, or DXF, on standard paper sizes.
- **Checks:** an error score in mm, the closest gap between lines, print-safety checks, and a test suite that runs
  before every build.
- Runs in the browser (`web-app/index.html`) or as a Mac desktop app (`desktop/`).

**Printers**

| Printer | Status |
|---|---|
| choc mate 2 (chocolate) | Supported: profile in `source/printer/choc-mate-2/` |
| AxiDraw pen plotter (via Saxi) | Supported: 2D SVG export |
| Clay printers | Planned |

**Planned: clay printers.** Unbroken will add clay (paste-extrusion) 3D printers. They have the same limitation as the
chocolate printer: the material can't be stopped or lifted mid-print, so every print must be one continuous line,
with supports built into that line and a minimum gap set by the nozzle width. The same engine and rules apply; what
changes is a printer profile (bed size, nozzle sizes, start and end G-code, speeds) and material settings in place of
the chocolate list. See [`ROADMAP.md`](ROADMAP.md).

**Status:** beta. Prints from the choc mate 2 are working well; settings and file formats may still change.

## Folder layout

```
Unbroken/
├── source/                 Shared source code
│   ├── engine/            The tracing engine (no DOM), one file per stage (00-util.js … 12-models.js);
│   │                       core.js lists them and loads them. Also runs in Node.
│   ├── engine/worker.js    Runs the engine in the background so the app stays responsive
│   ├── engine/fonts.js     Single-stroke fonts for the Text source
│   ├── tests/              The test suite and test plan: what is tested, why, and what counts as passing
│   ├── challenges/         Practical prints taken through the app with every version; renders to review
│   ├── bench/              Benchmarks for exploring trace quality
│   ├── printer/            Printer profiles (choc mate 2: settings, start/end G-code)
│   └── tools/              Formatting helpers (wrap-comments.js)
├── web-app/                The browser app (UI, preview, animation, tools, export)
│   ├── index.html          The page; loads the engine parts from ../source/engine/
│   ├── settings.js         Settings you can edit: chocolates, needles, printers, paper, starting defaults
│   ├── css/theme.css       The look you can edit: colours, fonts, corner / text / spacing dials
│   ├── css/app.css         Styles
│   ├── js/                 The app's scripts, one file per area (see web-app/README.md)
│   └── build.js            Tests, then builds the publishable copy in web-app/dist/
├── desktop/                The desktop app (Electron): main.js around the same page, build.js makes Unbroken.app
└── docs/history/           Past audits and reviews, as written (AUDIT.md, REVIEW.md)
```

| Section | Start here |
|---|---|
| Source code | [`source/README.md`](source/README.md) |
| Web application | [`web-app/README.md`](web-app/README.md) — open `web-app/index.html` in a browser |
| Tests | [`source/tests/README.md`](source/tests/README.md): the test plan |
| Challenges | [`source/challenges/README.md`](source/challenges/README.md): `node source/challenges/run.js`, then `compare.js` to check a run against another |
| Publishing | `node web-app/build.js` runs every test and only then builds `web-app/dist/`, the copy to publish |
| Desktop app | [`desktop/README.md`](desktop/README.md): `node desktop/build.js` makes Unbroken.app for the Mac |

The engine in `source/engine/` has no page code, so it can also run in Node (tests) or in another app later. The
October 2026 code audit and review are kept in [`docs/history/`](docs/history/): what was checked, fixed and left,
and the slow spots. Anything still open from them is in [`ROADMAP.md`](ROADMAP.md).

## Pipeline

0. **Source**: an image, or typed text laid out in a single-stroke font (letter height in mm, even gaps, minimum readable height of 8–10 stroke widths depending on the font; a stroke is two lines one spacing apart, so 2 × needle + gap).
1. **Prep**: brightness, contrast, even-out lighting, plain-background removal.
2. **Lines**: Centerline (skeleton of strokes; thick shapes are outlined; strokes packed closer than the blur can resolve are split along the light gaps between them) or Outline (Canny edges), plus optional hatch / cross-hatch / squiggle shading in dark areas.
3. **Edit**: area selection (rectangle / freehand), erase pieces or brush, chosen start point.
4. **Path**: pixel graph → minimum spanning tree of jumps between parts (small far-away groups dropped, sizeable ones kept) → T-join doubling → a non-crossing tour (closed, or open between the best two ends): at every point only neighbouring strands are joined, and loops are merged by swapping one pair of neighbours, so the line never crosses itself where strokes meet → every point moved onto the middle of its ink stroke (or the peak of its edge), below a pixel.
5. **No retracing**: the needle can't go back over its own line. A stroke the path travels twice becomes two strands one spacing apart, and every stroke end becomes a keyhole loop (see [Stroke ends](#stroke-ends-the-loop)).
6. **Fourier, one series per axis**: arc-length resample → one FFT → split into an X series and a Y series → keep the fewest strongest axis terms that stay within 0.35 px of the path for 95% of it (open paths are fitted out-and-back and the outbound half is used). Z is 0 for now (see [X, Y and Z](#x-y-and-z)).
7. **Untangle and spacing**: crossings removed (the tour leaves almost none), then a relaxation pass enforces a minimum gap.
8. **Score**: error = ½ (stray + missing), measured against the traced path, shown in mm.
9. **Output**: the 2D tab (a pen plotter: SVG for Saxi, flat DXF) or the 3D tab (a printer: G-code). See [Outputs](#outputs-2d-and-3d). The line is always continuous: the chocolate printer can't stop the flow, so connectors are drawn, never lifted.

## Units

Everything you see and set is in millimetres: size, spacing, needle and gap, error, the closest gap, the coefficients file and every export. The engine itself works on the image in pixels at the working resolution (Fast / Standard / Detailed); sliders that act on the image (smoothing, the speck filter, shading spacing) show what they mean in mm at the drawing's current size. Engine tuning in `settings.js` (term tolerance, strand gap) stays in working pixels. Design files saved in pixels by older versions are converted when opened.

## Stroke ends: the loop

The needle can't stop and can't go back over a line it has just laid. So every stroke the line has to travel out and back along is printed as a narrow loop:

- **Strands.** Two strands, each d/2 off the traced centre, each on the side of the corner it turns round at the junctions (so the two passes of a stroke always keep to opposite sides), where d = line width w + gap g (the needle's inside diameter plus the gap, centre to centre). The stroke prints d + w = 2w + g wide with a g-wide channel down the middle. With an 18G needle and a 0.5 mm gap: w = 0.84, d = 1.34, stroke 2.18 mm.
- **Loop.** At the stroke's end E the line turns round a circle of radius r (r = loopRadius × d in `settings.js`, default 1 × d = 1.34 mm) centred at C = E − (r + w/2) along the stroke, so the chocolate's outer edge lands on E.
- **Joining.** The strands meet the circle where r·sin α = d/2, so α = asin(d / 2r): 30° when r = d. The line runs round the far side through 360° − 2α (300°). The loop is 2r + w = 3.52 mm across.
- **Why r ≥ d/2.** Round the turn the inner chocolate edge has radius r − w/2, so opposite inner edges are 2r − w apart; that is at least the gap g exactly when r ≥ d/2. r = d/2 is the tightest legal turn (a plain half circle, no bulb).
- **Junctions.** Every strand at a junction sits in the corner it turns round, half a spacing from the strokes on both sides. Strokes drawn once (like a leaf's outline) ease half a spacing into their corner near a junction and back to their centre further out, so two of them meeting at a junction don't touch. With every strand in its own corner the minimum spacing holds at junctions too: there is no slack there.
- **Short stubs.** A full loop needs r + w/2 + r·cos α of stroke (2.9 mm at the defaults). On shorter stubs r shrinks, down to d/2.
- **Text.** Letter strokes are loops too, so the smallest readable letter height counts stroke widths of 2w + g (17.4 mm for the sans font at 18G + 0.5 mm, 8 stroke widths).
- **Size.** See [Size and detail](#size-and-detail): the smallest size the app allows is worked out with the strands and loops in place.

Test E16 measures every stroke end: loop width, where the tip lands, the gap and crossings.

## Size and detail

The needle and gap fix how close two lines may run, so the size of a print decides how much detail it can hold: a small print loses fine detail (a leaf's side veins become bulbs), a bigger one keeps more. Size is one slider:

- **Low end: the smallest that fits.** The smallest width where the finished print (two strands for every doubled stroke, a loop at every stroke end, crossings removed) keeps every line the spacing apart, while 98% of the line stays within 2.2% of the drawing's width of where it was traced. The slider and the width boxes never go below it.
- **Marks.** Medium and high detail: the smallest widths where 98% of the line moves no more than 1.3% and 0.7% of the width (`settings.js` engine.sizeDetail). The marks sit a quarter of the track apart, the rest of the track runs up to the widest drawing that fits on the plate. Click a mark to jump to it. The readout shows the printed size and how many times the smallest it is.
- **Where it starts.** On the medium mark (`settings.js` defaults.size: smallest, medium, high, or a width in mm). Once you move it, the size stays where you put it; it only moves up if a change (a wider needle, say) makes the smallest bigger than it.
- **Detail follows size.** The image is traced at the working resolution (Fast / Standard / Detailed = 320 / 500 / 720 px) per 100 mm of the image's long side in the print, in 10% steps, and never fewer, up to 2000 px (`settings.js` engine.maxWorkingResolution) or the image's own size. A new image (or selection) is traced once more if its proportions call for another resolution. Smoothing and the speck filter work in working pixels, so on a bigger print they act on finer detail too. Prints up to about 100 mm all use the same trace; bigger ones are traced finer, so they pick up detail a small print couldn't hold.
- **How the marks are found.** On the trace at the base working resolution. For each level the search tries widths (starting where the previous level landed, growing or shrinking by 1.6×, then halving the bracket six times to within 2%), and at each one lays out the full print and measures the closest gap and how far the line moved. About 10 tries per level, under a second each on the samples, in the background engine. Results are kept for recent settings, so undo and redo don't search again.

- **Moved lines.** Where making room for the spacing pushed the line more than the medium-detail tolerance off the drawing, the preview shades it orange (View → Moved lines; `settings.js` defaults.movedLines). Each point of the fitted line is compared with the final line around the same place along it (within 3% of its length), so a strand that merely runs past from elsewhere doesn't hide a loss (`UNB.drift`). When more than 2.5% of the line is pushed off, a note under Size says how much and where medium detail starts.

Leaf at 18G + 0.5 mm: smallest 27.5, medium 36.3, high 46.6 mm wide (2% of the line pushed off at medium, 11% at 80% of the smallest). Until October 2026 the marks allowed 10% of the line to drift instead of 2%, which put them at 20.5 / 23.0 / 30.0. Tests E07 (the search and the shading) and A13 (the slider).

## Round corners

A needle laying chocolate can't turn on the spot: at a hard corner chocolate piles up or the line drags. **Round corners** (Output card, 0–5 mm, `settings.js` defaults.cornerRounding) sets the tightest turn the drawing may make, as a radius in mm.

- **Where.** On the traced path, before the strands, loops and the Fourier fit (`UNB.roundCorners`, run by `stageSignal`), so the preview, the spacing, the size marks and every export all see the rounded line. The radius is converted to working pixels at the current size, so it means the same in the print at any size.
- **Which corners.** Only the drawing's own corners. The walk is split at junctions, stroke ends and connectors, and those points never move, so stroke-end loops, junction spacing and jumps keep their shape. Along each stretch between them, a corner is where the line turns more than about 30° within one radius, concentrated rather than spread out: smooth curves, even ones tighter than the radius (a small circle), are drawn as they are.
- **How.** Each corner's two sides are joined by a cubic curve close to a circular arc of the radius: tangent length R·tan(θ/2) for a turn θ, centred on the middle of the turn, shortened when the stretch is short or the next corner is near. No point of the line moves more than the radius from where it was drawn: a 90° corner moves 0.41 R and gets the full radius; very sharp corners (a star's points) and narrow hairpins get a tighter curve instead of being cut back. A second pass catches corners the first left tight. Points keep their count and order, so the out and back passes of a doubled stroke are rounded the same way and their strands stay parallel.

Leaf at 30 mm: tightest drawn turn 0.4 → 1.0–1.2 × the radius at 1–3 mm. Test E19.

## Infill (3D tab)

**Infill** belongs to the 3D tab's Base and Infill cards (density, Rings or Lines, angle, turn 90° every N layers). It's there to help a print stand up, so it isn't part of the Trace tab, which is the drawing alone; the 2D tab has its own fills for art (see [Outputs](#outputs-2d-and-3d)). It fills every area the line encloses with more of the same line, one spacing apart, still one continuous line with no retracing (`UNB.infill`, run by `stageSignal` after the strands and loops are laid out, before the Fourier fit).

- **Spacing.** Fill lines are one spacing (line width + gap) apart, counted from the centre of the printed line, plus 5% so the series' small wobble doesn't make the spacing step push the fill around. **For solid chocolate set the gap between lines to 0**: the lines then touch. With a gap the fill keeps it, which saves chocolate; the gap stays a rule like everywhere else.
- **Areas.** The printed line is drawn on a fine grid (a fifth of a spacing); every region more than 0.6 spacings from it that is closed off from the outside is an area. The narrow channel between a stroke's two strands and the openings where strokes meet count as closed, so a leaf's blade is one area whichever way the line runs round its stem (mathematically, the inside of the one closed line is just those channels or just the blade, depending on that). Areas too narrow for one ring are left alone. **Leave small areas open** (0–400 mm², one per card: `settings.js` defaults.baseMinArea and defaults.infillMinArea) skips areas smaller than that, e.g. the little spaces inside lettering or between close strokes.
- **Rings** follow the area's edge at 1, 2, 3 … spacings in (contours of the distance from the printed line); where an area narrows, a ring splits in two. **Lines** put one ring at one spacing, then straight rows one spacing apart inside it (angle set next to the pattern, `defaults.infillAngle`), paired into narrow loops with a half circle at each end.
- **One line.** Each area's loops are merged into one loop by bridges: where two loops run side by side, cut both and join them with two short parallel links one spacing apart. That loop is bridged into the printed line the same way, on a straight stretch away from junctions, stroke ends and connectors. Nothing crosses and nothing is drawn twice.
- **The series.** A filled base layer is a separate line from the one on the Trace tab, fitted on its own in the layers engine (`UNB.stagePrint`): much longer, so it is sampled finer (up to 65 536 samples) and may use up to 30 000 terms. The Design line and the walls keep their own term count, so their stroke ends stay sharp. Infill points are left out of the error (they aren't meant to follow the drawing).
- **Not yet:** the size marks are found without infill (a fill makes the search several times slower), so at the medium mark a filled design can show more orange "moved lines" than the same design unfilled. Small stroke-end loops can soften in a filled base layer, since its term count is picked over the whole, much longer line. Gaps of up to about one spacing remain where bridges cut a loop and in sharp corners of an area.

Leaf at 80 mm, 18G: without infill the emptiest 1% of the enclosed area is 4.5 spacings (gap 0.5) / 7.5 (gap 0) from a line; with Rings 0.69 / 0.75, with Lines 0.67 / 0.67 (0.5 is even coverage). Test E20.

## X, Y and Z

The line is three real series over one cycle, 0 ≤ t < 1:

- x(t) = x₀ + Σ a_k cos(2πkt + φ_k)
- y(t) = y₀ + Σ b_k cos(2πkt + ψ_k)
- z(t) = 0

A term is one axis at one frequency k. The terms come from a single complex FFT of x + iy, split per axis: X_k = (Z_k + conj Z₋ₖ)/2 and Y_k = (Z_k − conj Z₋ₖ)/2i. The amplitude is 2|X_k| and the phase arg X_k. Terms are chosen strongest first across both axes; for the same accuracy this costs the same as the earlier single complex series (within ±3% on the samples). Play drawing shows it directly: a chain of X circles above the drawing sets the pen's left–right position, a chain of Y circles to the left sets its height.

**Z.** Every exported path carries a Z offset per point, and the G-code adds it to the print height; a move only carries Z when it changes, so a flat print reads exactly as before. The layers (below) fill it in: flat base layers, then a steady climb of one layer height per lap. That is a ramp, not a repeating wave, so it is written directly rather than as a Fourier series.

Test E17 checks the per-axis form is exact (all terms rebuild the path; the written formula is the drawn line) and that Z = 0 leaves G-code byte-identical while a ramp comes through.

## Outputs: 2D and 3D

The app has three tabs: **Trace** (trace and shape the line; called Design until October 2026), **2D** (a pen plotter and flat files) and **3D** (a printer, layers and G-code). Size and corner rounding are set in the Trace tab, which is the drawing alone; fills belong to the outputs: the 2D tab's fill pens (art) and the 3D tab's Base and Infill (structure).

- **2D: the pen version.** A pen can lift and go over a line twice, so the 2D files hold the traced drawing itself: the walk fitted with no spacing, one continuous line that goes back over a stroke it travels out and back along, with no doubled strands and no stroke-end loops (`web-app/js/plot.js`, `UNB.stagePrint` with spacing 0). Corner rounding applies; infill doesn't. The preview shows it on the page.
- **Paper.** A6 to A1; US Letter, Legal and Tabloid; drawing pads 6×8, 9×12, 11×14 and 18×24 in; **Printer plate** (the chosen printer's plate, from settings.js, to lay a drawing out at the size the chocolate printer would print it); or a custom size. Portrait or landscape; margins (default 20 mm); pen width (0.5 mm, the stroke width in the file). The drawing is centred; a warning shows when it doesn't fit inside the margins (change the size in the Trace tab, the paper or the margins). The page view always frames the whole drawing as well as the paper, so a drawing bigger than the paper shows hanging over its edge. `settings.js` defaults: paper, paperOrientation, paperSize (custom), paperMargin, penWidth, plotFormat.
- **Fill pens.** Areas the pen line closes off can be filled with other pens, for colour. Pick a pen (Pen 2, 3 … up to 8; colour, width, spacing between strokes, style, angle, cross-hatch, follow tone), then click a shape on the page; the same pen clears it, another pen takes it over. Drag across shapes to do the same to each one you pass over (the first shape decides whether the drag fills or clears; one undo step per drag; a finger only taps, so it can still scroll). Strokes are ordered to keep pen-up travel short.
  - **Hatch**: straight strokes the pen lifts between, rows centred across the shape; cross-hatch adds a pass at 90°. **Contours**: rings following the shape's edge, stepping in by the spacing.
  - **Follow tone**: strokes run at the pen's spacing where the image (the prepared working image) is darkest, every other one at half darkness, every fourth at a quarter and so on (each row or ring has a threshold from the van der Corput sequence), and none where it's white (under 4%), so one pen shades a shape like the picture.
  - **Colour from image**: gives every shape the fill pen whose colour is nearest the image's average colour inside it, comparing in CIE Lab by hue and colourfulness with lightness counting less (image colours are usually lighter than ink); shapes that are light and nearly colourless stay empty. It replaces the current fills (one undo step), so set the pen colours to match your real pens first. Each stroke stops where its ink would touch the drawing's ink, (pen 1 width + fill pen width) / 2 from the line; spacing = pen width fills solid. Lines closer than pen 1's width count as touching, so a gap the ink closes anyway doesn't join two areas (`UNB.penFills`). A filled area is remembered as a point inside it, relative to the drawing, so it follows a change of size or trace; if the point ends up outside every area the hint says so. Fills undo and save with the design. `settings.js` defaults.penColors sets pen 1's colour and each new pen's.
- **Shapes.** The page preview tints every shape that can be filled in its own light colour (Show shapes), and the Fill pens readout counts them. **Close gaps** (0–10 mm) bridges a stroke end (where the line turns back on itself, or an open line's end) to the part of the line ahead of it when that's within the distance, so a shape the eye sees as closed splits there: on the leaf at 60 mm, 4.9 mm closes the midrib's tip and the veins, splitting the blade into 7 shapes. The bridges are dashed on the preview and only bound the fills; **Draw bridges** adds them to pen 1 as short strokes. **Smallest shape** (0–100 mm²) joins smaller shapes to the neighbouring shape they share the most edge with (the outside only if they touch no other shape), so slivers at junctions and inside small letters don't need clicking. `settings.js` defaults: closeGaps, smallestShape, drawBridges, showShapes.
- **SVG for Saxi (AxiDraw).** One page at the paper size in mm (`width="297mm"`, viewBox in mm). Pen 1 (the drawing) and each fill pen are separate Inkscape layers (`inkscape:groupmode="layer"`, labelled "1 drawing", "2 fill" …), each with its own stroke colour, so Saxi can split them by group or by stroke colour and you can change pens between them (`UNB.exportPlotSVG`; Smooth curves optional). Open it in Saxi and pick the same paper there, so it isn't rescaled.
- **DXF (flat, zipped).** The pen line in mm, y up, from its own corner, for CAD and laser software; one DXF layer per pen (PEN1, PEN2 …).
- **3D: printers.** `settings.js` has a list of printers (`printers`: bed, build height, print and lift height, layer height, speed, minimum layer time, start and end G-code); the menu picks one and the plate, mini-map, profile table and machine fields follow it. The choc mate 2 is the first. The chocolate line (strands, loops, infill, layers) is what prints.
- **3D file.** G-code (zipped, with the printer's start and end lines): every copy's whole layer stack. The readout warns when the stack is taller than the printer can build.

PDF, EPS, HPGL, plain SVG and 3D DXF were removed in October 2026 (never used); they're listed under "Maybe later" in [ROADMAP.md](ROADMAP.md) with the use that would bring them back. Tests E11 (the files), E22 (fills), A15 (the 2D tab) and A16 (picking fills).

## Layers (3D tab)

The 3D tab builds the object up from the drawing (`UNB.layerStack`, `web-app/js/layers.js`). The flow can't stop, so the whole object is one continuous 3D path.

- **Base.** Base layers start at 0; raising the number adds flat layers at the bottom, filled as set in the Base card: **density** (100% puts the rows one line width apart, touching, for solid chocolate; 50% two widths; 0% leaves them open), **pattern** (Lines or Rings), **angle**, and **turn 90° every N layers** (1 = cross every layer). Leave small areas open sets the smallest area filled. Base layers are flat; between two of them the line steps up one layer height at the start point (`UNB.fillPlan`, `UNB.infill`).
- **Infill.** The Infill card fills the layers above the base, as part of the same line: density 0% (the default) leaves them hollow, 20–30% is a light support, 100% solid; pattern, angle and turn 90° every N layers as for the base (default 2, so pairs of layers cross).
- **Walls.** The same drawing without infill (0–500 layers; at least 1 without a base). They spiral: Z rises steadily round each lap, one layer height per lap, so every point sits one layer height above the same point of the lap below and there's no seam. The first spiral lap climbs off the flat layer below, so its flow ramps up from 0 to full; a last level lap at the top height evens the rim, its flow ramping back down. Without a base, the first wall layer is flat (it is the first layer).
- **Height (mm)** is what you type: the layers follow (the base layers, then as many above as reach it; whole layers), and changing the base, the layer height, the chocolate or the printer keeps it. Layer height, speed, first-layer Z and lift are in the folded Fine-tuning card, starting from the chocolate and printer profiles.
- **Test print, layer slider, ready list.** The Test print card makes numbered strips stepping one setting (layer height, speed, gap or flow); the 3D layers view has a slider to show the print up to a layer; the Export card lists what is ready (spacing, plate, height, layer times, one cartridge). A traced design with a filled base and walls is a vase: set the height and the walls spiral up to it.
- **Layer height** comes from the chocolate (`layerHeight` on a chocolate in `settings.js`) or else the printer (0.3 mm). Height = layers × layer height; the first layer prints at Z = one layer height (First-layer Z in Fine-tuning, which follows the layer height).
- **Readout and preview.** Layers, height, metres of line and print time at the feed; a warning when a layer takes less than the printer's minimum layer time (20 s), since each layer must set before the next lands on it. The preview shows the stack from the front, tilted back, with the height exaggerated (blue: filled base, brown: walls).
- **G-code.** Each copy prints all its layers, then the needle lifts to the lift height above everything printed so far before travelling to the next copy. E is the flow per mm times the per-point flow multiplier.
- **A piece for each line of text.** A text of several lines (a list of names, say) prints each line as a piece of its own by default (Plate card, **Lines of text**: A piece for each line / One piece, lines joined; `settings.js` defaults.textLines). The Trace and 2D tabs keep the text as one drawing; for the printer every line is traced again from its own letters (`UNB.rasterText`'s `lines`), with the automatic term count, so each piece is one continuous line with no strand to the next line. The pieces are laid out together (`UNB.plateLayoutPieces`: all turned the same way, straight or a quarter turn when that fits more, packed in reading order in rows from the back, Copies = sets of every line), each gets its own layers, and the G-code prints them one after another like copies. **One copy shows** picks the piece the One copy views show; the layers readout counts metres and minutes for all of them. Tests E31, A29.
- **Copies one at a time.** Each copy is finished before the next starts (a rule, see PLAN.md). The G-code follows choc OS's recipe: the printer's start and end lines, the purge line, a retract before travelling, and an unretract and a wipe for each copy (test E28).

Test E21 (the stack and the G-code) and A14 (the controls).

## 3D models

**3D model** is the third source in the Trace tab, next to Image and Text (`web-app/js/model.js`, `UNB.parseSTL`, `UNB.orientMesh`, `UNB.sliceMesh`, `UNB.modelLayer`, `UNB.modelStack`).

- **Loading.** Load STL… reads binary or ASCII STL (units taken as mm). Picking 3D model with nothing loaded shows a sample vase. The model stands on the plate, centred; its starting height is its own, kept on the plate and under the printer's build height (at least 3 mm).
- **Which way up.** Tip forward, Tip sideways and Turn give quarter turns; As loaded undoes them. Drag the preview to look round it (that only moves the view). Undo covers turns and height; design files keep the turns and height but not the mesh itself.
- **Cut off (3D tab, Layers).** Bottom and Top (mm) cut the model: only the part between is sliced, so a domed or pointed top (a few tiny, wobbly last layers) or a round bottom can be cut flat. The preview fades the parts cut off and outlines the cuts; the 3D tab's Height is the part left, and typing it scales the model so that part is that tall. Turning the model clears the cuts.
- **Slicing (3D tab).** Layer k is printed with the nozzle at z0 + k·h (z0: the first layer, the print Z) and cut through the middle of its band. Only the outside contours are printed (a hollow model's inner surface and any hole are left to Base and Infill): they are moved in by half a line width so the chocolate's outside edge is the model's surface, and joined into one loop: each further outline (another separate part) is reached by two straight connector strands one line spacing apart, out and back without crossing, from the nearest point of the loop so far; where many points are about as near (a standing letter's two arms, a handle), straight across through the middle of the layer, so the stacked strands sit back inside the model and the parts stand out in relief. That makes the print one line and ties the parts together. A model of overlapping shells (a mug and its handle) has each layer's partly overlapping loops merged into one outline first (`UNB.unionOverlaps`).
- **Through the Fourier series.** Each layer's loop is fitted with the fewest strongest terms that keep 95% of it within 0.05 mm, like a traced drawing; a 64-sided cylinder becomes a smooth circle in 8 terms. Layers start at the point nearest the previous layer's start, so the walls spiral up with no seam; the top is open (chocolate can't bridge a lid).
- **Inside.** The Infill card sets the inside (0% = hollow, walls only), filling every layer inside the walls with its pattern (Rings or Lines; Lines turn 90° each layer so the layers cross), at a **fill density** of 5–100%: the rows (or rings) sit one line spacing ÷ density apart, so 25% puts them four spacings apart, while the joins between fill loops, and into the wall, stay one line spacing wide (`UNB.infill`'s bridge width). Density changes only the fill: the walls and the filled base stay solid. A part narrower than about two fill spacings gets no fill at low density. `settings.js` defaults: wallCount, infillDensity, infillPattern, infillAngle, infillTurn.
- **Walls.** 1–5 walls, each one line spacing inside the last, run the other way round so their connector strands don't cross; a fill only reaches inside the innermost.
- **Base.** The Base card fills the first layers of the model as set there. Wall layers follow from the model's height, so that box is off; the Height field scales the model evenly.
- **Line drawing of a view (3D → 2D).** After [plotter.vision](https://trmm.net/Plotter-Vision/): the model seen from the preview's angle, drawn as lines with the hidden ones removed (`UNB.hiddenLines`). Drawn edges are outlines (between a face turned towards you and one turned away), open edges, and folds sharper than **Draw folds sharper than** (1–90°, starting at 20°); at the far left every edge between faces that aren't flat together is drawn, a wireframe, and the flat diagonals a mesh splits faces with never are. Hidden parts are found with a depth buffer: every face is filled in, then each edge is walked in half-pixel steps and kept where nothing lies in front of it (compared with the farthest of the pixel and its neighbours, so outlines on curved surfaces stay whole). **Show the preview as a drawing** shows it live as you turn the view. **Export SVG** saves the drawing itself as vectors before any tracing (`UNB.chainSegments`, `UNB.exportLinesSVG`): rendered at 2000 px, edge pieces that meet joined into strokes (the sample vase's 4014 wireframe pieces become 105 strokes), at the model's size in mm with a 5 mm margin and the 2D tab's pen width; set the height on the 3D tab for a bigger drawing. **Draw this view** renders it at 1400 px and makes it the image to trace (with the Line drawing starting point), so it can be printed in chocolate or plotted on the 2D tab with fill pens; 3D model brings the model back, Image the drawing. A dense wireframe is more than one line can follow (the sample vase at 1° fills the 4000-term limit), so keep the angle up for tracing.
- **Overhangs and support.** A bead can only reach a little past the layer under it: **Overhang per layer** (Fine-tuning; empty = a third of the line width, 0.28 mm with the 0.84 mm needle). The ready list says how far the model steps out (`UNB.modelOverhang`). **Support** (Layers card) widens the print's own outside wall from the plate up, since one continuous line can't print a separate support; it stays on the piece (`UNB.modelSupport`, worked top-down on a grid):
  - **Flared skirt:** each layer pulls back towards the model one overhang step from its far edge only, so a cap gets a cone under it and an arm a brace back into the model at the overhang slope (least chocolate).
  - **Thin wall:** everything under the overhangs, dropped to the plate, thinned down its middle to one narrow loop (line width + spacing) running into the model, flaring out near the top. A standing letter keeps its arms, with a recessed wall under them; on a round model it is the skirt.
  - Gaps narrower than a bead between support and model are closed, so each layer stays one loop. Not every shape suits the technique (PLAN.md): letters print best lying flat, and chocolate can't bridge a gap. Tests E30, A28.
- **Not yet:** a solid top skin over sparse fill, a two-pen red/blue (anaglyph) drawing, and splitting a complex model into parts to glue (PLAN.md).

Tests E23 (slicing and fitting), E29 (cutting, outside only, overlapping shells), E30 (support) and A17, A28 (the app).

## Roadmap and notes

- [`CHANGELOG.md`](CHANGELOG.md): what each published version changed (the page shows its version next to the title).
- [`ROADMAP.md`](ROADMAP.md): what's next, what might come later (with the use that would justify it), and what was removed. The one list of open work.
- [`PLAN.md`](PLAN.md): decisions made with Nicolaas, the rules (one line per copy; the technique's limits), later and not doing.
- [`DESIGN.md`](DESIGN.md): how the code is meant to be built: the principles, where it is over- or under-engineered, and the plan.
- [`docs/history/`](docs/history/): the October 2026 code audit (AUDIT.md) and code review (REVIEW.md), as written. Their open items are carried in ROADMAP.md.
- The **Suggestion box** at the bottom of every tab: one line for an idea or a bug while using the app. Notes are sorted into ROADMAP.md from time to time.
