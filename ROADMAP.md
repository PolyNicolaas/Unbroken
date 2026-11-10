# Roadmap

What the tracer should do next, what it might do one day, and what was taken out. This is the one list of open work:
the past audits and reviews in docs/history/ are kept as written, and whatever they left open is carried here. New
ideas and bugs come in as comments in the chat and go straight into this file. Every item says who it's for and what
it's used for: an idea without a use stays in "Maybe later".

Last sorted: 9 November 2026 (v143: the map of the steps and its next steps added; what's done since October moved to
"Done since the last sort"). Decisions made together are in PLAN.md.

## Now

- **Map the big picture** (19 October): the areas below, and the data and accounts plan in
  [`docs/DATA-PLAN.md`](docs/DATA-PLAN.md). Its decisions for Nicolaas come first.
- **Prove the tracer's own G-code on the choc mate 2** (v66–v67 follow choc OS's files: purge line, retraction and
  wipe, E per mm from the needle and the 50 cc syringe, copies one at a time, at least 20 s per layer). The goal is
  to stop paying for choc OS; its DXF upload stays as a fallback (3D tab, "DXF for choc OS") until then. Worth trying
  on the printer while at it: choc OS's 120 mm/s for the Z moves (settings.js `zTravelSpeed`, `zApproachSpeed`).
  *Prints were working really well on 18 October: confirm and close.*
- **Side-by-side checks on the Mac** (written for v92): the six drawing challenges (their SVGs are only on the Mac),
  then `compare.js` against the last run. *Now v99: replace with a fresh baseline run.*

## 1 · Bugs and quality

Known bugs:
- Solid fills: where a second filled area is joined into the wall, the join can cross the line once or twice before
  the clean-up step untangles it (found measuring v92's infill; the same before v92). Join it on a stretch where it
  can't.

Tests:
- Left from the code review of 16 October (docs/history/REVIEW.md): cover painting areas, Draw your own, image prep,
  shading, erase, the test print's speed / gap / flow kinds, the ready list's second-click export, height staying put
  on a chocolate or printer change, the per-card small-areas setting (review test 4); tighten the loose checks in A12,
  E14, E28 and A22 (test 5); move the timing tests A02, E13 and E26 into their own group (test 7).
- Tests for v92: painted areas at the same width after a re-trace at a new resolution; the ready list's Trace-tab
  lines switching tab; the test print's range following a chocolate change; a saved model design opened with another
  model loaded; nudging a model's height five times slicing once; the travel speed without retraction and the Z speeds
  (E28; E14 can check `zTravelSpeed` / `zApproachSpeed` like the other printer fields); the spectrum order unchanged
  (E17); sparse Lines infill in a small heart (rows in both lobes, row ends a line spacing from the ring); a design
  saved in mm/min opening as mm/s.
- A test for the term count above 4000 (v99): a busy image reaching the tolerance.

## 2 · Printing

- Time per layer for small models: every slice is its own lap, so small layers can't take 20 s even at the slowest
  speed (the ready list warns). Decide between a cooling pause off to the side and a bigger design (copies stay one
  at a time).
- Several different designs on one plate: a text's lines can print as separate pieces since v97 (the plate packs
  pieces of different sizes, `UNB.plateLayoutPieces`); drawings and models still print copies of one design.
- Make a vase (v139), next steps once it has printed: a polygon or star cross-section, image relief on the wall
  (Potterware's texture), the movement's size varying up the vase, and a cooling pause for narrow necks (their laps are
  short). Loops cross themselves: watch how chocolate takes the crossings on the first prints.
- **Ideas from clay printing tools** (looked at 9 November, after Make a vase; each with its use):
  - *Image relief on the wall* (Potterware's texture tab, Eazao's texture mapping): a picture's light and dark push
    the vase's wall in and out, so a name, a logo or a face becomes part of the wall. Plays to what Unbroken already
    does with pictures. **Next.**
  - *Movement that changes up the vase* (CoilCAM's shaping functions): the size, count or shift of the movement follow
    a small curve from bottom to rim, edited like the profile, so a texture can grow, fade or tighten towards the neck.
    **Next.**
  - *A cross-section editor* (DigitalClay3D, printpal's vase generator): a polygon, star or SVG outline in place of the
    circle, with symmetry, and lofting between outlines at different heights. Shapes beyond round vases.
  - *Texture on an STL's wall* (Eazao maps textures onto G-code it didn't make): the vase's ribs, waves and loops on a
    sliced model's outer wall, e.g. a knitted skull cup.
  - *Draw the movement* (SketchPath's hand-drawn toolpaths): sketch one repeat on a pad, like the Spirograph's path pad,
    and it repeats round every lap. A hand-made look the presets can't give.
  - *Height-dependent settings* (Claywoven's modifiers): speed or flow changing with height, e.g. slower round a narrow
    neck so short laps still get their setting time. Ties into the time-per-layer item above.
  - *Woven walls with Z* (WeaveSlicer): the movement goes up and down as well as in and out, so laps dip over each other
    like a basket. Uses the Z series planned since October (one Fourier series per axis). Maybe later: test how
    chocolate takes it first.
  - *Shape the vase on the 3D preview* (Clay ARtools' rib tool): drag the silhouette in the model view instead of the
    profile editor. Maybe later, if the editor feels too indirect.
  - *Scan a thrown pot* (Craft-Aligned Scanner): needs scanning hardware. Maybe later.
  - Already here: Potterware's bead-by-bead preview is the 3D layers view's Solid (as printed); clay printer profiles
    are the item above.
- STL: a solid top skin over sparse fill.
- Split a complex model into printable parts to glue (PLAN.md; first test: the tree).
- **Clay printers** (planned 19 October): add clay (paste-extrusion) 3D printers alongside the choc mate 2. Same
  limitation as chocolate: the flow can't be stopped or lifted, so every print stays one continuous line, supports
  included, with the minimum gap set by the nozzle. Needs a printer profile per clay printer (bed, nozzles, start and
  end G-code, speeds, `source/printer/<name>/`) and a materials list for clay next to the chocolates in `settings.js`.
- Sending the file straight to the printer (not for now, 17 October): the choc mate 2's start lines are Repetier-Server
  host commands, so its upload API is the likely route; download and copy over until then. Best after the design
  record (DATA-PLAN.md), so each print is tracked.

## 3 · Tracing, drawing and lettering

- **A simpler workflow** (decided 27 October, [`docs/WORKFLOW-PLAN.md`](docs/WORKFLOW-PLAN.md)): Printer or Pen plotter
  first; Art → Line → Print or Plot; one switch for the line (One continuous line, Separate strokes, As drawn); the
  preview follows the step. v107.

- **Modules** (decided 10 November: for chocolate printers, pen plotters and clay printers, and to build and try new
  features): a feature adds itself and can be left out. Started in v145; the measure is test A61 (15 of 36), the
  next steps are in DESIGN.md, Modules. The look and feel comes after this.

- **The map of the steps** (v140–v141, 9 November: the interface; a band of steps on top, the preview biggest,
  settings as rows beside it). Next, each for finding and keeping settings now that there are many:
  - *Search the settings*: type "thin line" and get Flow, with the step it's on.
  - *Save as recipe*: keep this print's changed values (the blue dots) as the chocolate and needle's recipe. Needs
    the chocolate database (DATA-PLAN.md stage 3) or the browser's storage until then.
  - *Keep or drop on a chocolate switch*: after changing Flow by hand, switching chocolate asks whether to keep the
    change or take the new recipe's value.
  - Small: the last chips' names are tight at about 900 px wide; sliders' names are bold where other rows' aren't.

- **Image prep and grey levels** (decided 27 October, [`docs/PREP-PLAN.md`](docs/PREP-PLAN.md)): a still-life sample;
  the picture reduced to 2–6 flat greys, each traced, filled or both; smooth blocks, crop and rotate, background by
  tapping (v105); fills per level on the 2D tab, hatch, cross-hatch, rings or a pattern, one pen each (v108 ✓).

- **More control in the patterns** (decided 27 October, [`docs/ART-PLAN.md`](docs/ART-PLAN.md)): fitting inside a
  shape (a picture's silhouette, text, an SVG outline) and seeds with a grid of variations: v105. (Patterns from
  pictures and sizes in mm came in v103; deeper settings per style, exact tracing and Allow overlaps in v104.)
- **Allow overlaps** (v104): try a spirograph in chocolate with it on, and see whether the bead over a crossing needs
  less flow there (a G-code change at each crossing) or prints fine as it is.

- Patterns (v100): try them on real prints in the challenges (a labyrinth and a double spiral in chocolate, a whirl and
  Truchet tiles on the plotter). Ideas waiting for a use: more styles (circle packing, Voronoi cells, a Greek-key
  border) and patterns in the 2D tab's fills.

- A text's pieces use the automatic term count and aren't shown on the Trace tab (it draws the text joined, as the
  2D tab plots it). If a piece needs looking after on its own, show the pieces there too.
- More fonts for lettering (raised 18 October; Chocolate and Dune Rise came in v98; Pebble and Bad Script, with
  Cyrillic and accents, in v130). Decided 2 November: cover accented Latin, Cyrillic and Greek; Hebrew and Arabic
  maybe later (right to left, and Arabic letters change shape by their neighbours); Chinese, Japanese and similar
  scripts are skipped (too many strokes for a needle): import them as a picture and trace it. Dune Rise's dots
  could be redone with the new center-font.py (they come out as specks).
- Chocolate Cyrillic (v132): printed 5 November 2026, the "Ты и красавица…" card in the Chocolate font with the
  1.19 mm needle, 5 mm tall (stacked layers), letters at the app's own letter height: printed great. The drawn
  Cyrillic letters hold up in chocolate as well as choc OS's own. Still open: how small the Chocolate font can go
  (its smallest height is the fixed 8 stroke widths, though its letters are already the printed outline, not strokes
  drawn out and back); choc OS's full stop is blank and its hyphen a wide pill: worth checking whether that's what
  Nicolaas wants in the font.
- Lettering for a printer (v131): check the measured smallest height against real prints (a few letters at three
  sizes per font, e.g. a comb in the test-print matrix), and whether joins along the baseline print clean. Ideas not
  built yet: sort the font list by how well a font prints (free stroke ends and separate pieces per letter; the
  Chocolate font has none), and telling a script's loop closing from an opening closing (э becoming ө) in the
  measured height.

## 4 · Data and accounts (the big picture)

The plan is in [`docs/DATA-PLAN.md`](docs/DATA-PLAN.md): every design kept as one record (source, trace, G-code,
metadata, who made it), in three stages. Decided 19 October: Unbroken is for Nicolaas first; other people (makers)
will make designs he prints, so designs need a submit → review → queue → print → log workflow. Makers send the
design, never G-code: the owner makes the G-code with his own printer and chocolate settings.

- **Stage 1, the design bundle** (no server): one `.unbroken` file with a manifest, the source, the trace and the
  outputs; G-code headers stamped with the design number and settings; a design number on every file
  (`welcome_084_2x_U0007-gcode.zip`, planned 17 October); "Send for printing" (the bundle with the maker's
  name and request) and a print queue in the owner's browser.
- **Stage 2, accounts and a cloud library**: sign-in, My designs with revisions, online submissions with the owner's
  inbox and print queue. Likely Supabase in front of the GitHub Pages site.
- **Stage 3, the workshop**: the chocolate and clay database with prices (grams and cost per print), print recipes,
  the print log with ratings and photos, sharing, personalized batches (PLAN.md).

## 5 · Code and publishing

- Code: read the controls once per run (DESIGN.md step 4), then ES modules (step 6), as commits after the GitHub move.
- Speed-ups found in the audit: the outline join in `modelLayer`, `minBox`, the pen-fill stroke order, the connector
  searches in `buildWalk` (see docs/history/AUDIT.md).
- Publish GitHub Pages automatically on every push to `main` (a GitHub Action, after the tests pass); for now each
  update is built and published by hand.

Done since the last sort (9 November): Make a vase (v139); the map of the steps (v140–v141); the Suggestion box taken
out (v141, see Removed); a solid base however big (v142); the weekly tidy-up (docs/TIDY.md); the step tabs retired
(v144, see Removed).

Done before that: Edit line (push, smooth, straighten the traced line by hand) and the Geometric art card
(v100, 26 October); the desktop app taken out for now (19 October, see Removed); the 4000-term limit lifted to
what the samples allow (v99, 19 October); the move to GitHub and the GitHub Pages site (19 October); v92's review
fixes (painted areas after a re-trace, cancelling stale layer runs, a saved model design matched by its model, the
ready list from the 3D tab, the test print's range, travel speed without retraction, the spectrum sort), sparse Lines
infill in small parts, Z speeds as printer settings; before that plate estimates (metres, minutes, chocolate per copy
and plate, cartridge warning), the test print, the ready list, cut-off, support for overhangs (flared skirt, thin
wall), connectors through the middle of 3D models, the challenge runner, and the v91 clean-up.

## Maybe later (each needs a real use first)

| Idea | The use that would justify it |
|---|---|
| Red/blue (anaglyph) drawing of a model | A 3D-looking plot for pen plotters: two pens, two views a few degrees apart |
| Video export of the drawing animation | Sharing a print's drawing on social media |
| Auto-pick the trace style | New users who don't know Centerline from Outline |
| 2D fills: stipple and scribble | Plotter art where hatching looks too mechanical |
| Exact vector plotting of a model's drawing (no trace) | Crisp technical drawings from STL, straight from the hidden-line edges |
| Saved presets of your own | Repeating a look across many designs |
| PDF / EPS export *(removed)* | Sending the line to a print shop or Illustrator. Plotter SVG covers most of this today |
| HPGL export *(removed)* | An old pen plotter or vinyl cutter that only reads HPGL |
| Plain SVG at the drawing's own size *(removed)* | Using the line in a design tool without the page around it |
| 3D DXF of the layer stack *(removed)* | Checking the printed path in CAD, or feeding it to a robot arm (choc OS's "Upload 3D curve" takes one, but the goal is the tracer's own G-code) |
| 2D DXF for the pen plotter *(moved to the 3D tab, v67)* | Saxi takes the SVG and sets the pen speeds, so only the chocolate DXF for choc OS stays |
| Chocolate product records *(removed)*: brand, UPC, bag serial, lot / trace number, diet, allergens, links | Selling prints: labels, allergen lists, batch traceability |
| Working-resolution menu *(removed)* | Forcing a faster or more detailed trace by hand; the print size now picks it (settings.js `workingResolution` sets the base) |

## Version 1

- **Embeddable web app**: details in [`web-app/README.md`](web-app/README.md).

## Removed

| When | What | Why |
|---|---|---|
| 2026-11-09 | The step tabs, the Next bar, More print settings, card folding (Collapse all / Expand all) and the settings Wheel (v107–v119) | The map of the steps does their job: one interface. A fold or a wheel could come back if a step's settings grow too long to scan |
| 2026-11-09 | The Suggestion box (notes.js, File ▸ Suggestion box…, v113) | Comments come in the chat instead; on GitHub Pages the notes stayed in the browser that typed them. Could come back with the shared database (DATA-PLAN.md stage 2) |
| 2026-10-27 | Edit line (push, smooth, straighten the traced line by hand, v100) | Not very useful in practice: hand edits are better made in a drawing app (export the SVG, edit, drop it back in) |
| 2026-10-27 | Shading in the Tracing card (hatch, cross-hatch, squiggle) | Didn't work well and was hard to use; patterns that draw a picture's tones replace it (v103) |
| 2026-10-27 | The Art tab's layers (v101): stacking, pen colours per layer, placement, the Art view | Too complicated: one input at a time is clearer. Layered plotter art could come back for multi-pen plots |
| 2026-10-19 | The desktop app (desktop/, the Electron Unbroken.app from v96) | Unbroken runs from GitHub Pages while it's still changing; a standalone app comes back when it's ready to roll out. The code is in the repo's history (commit 40a733b); its next steps were a Windows build, signing and notarising, opening designs from Finder and a `.dmg` |
| 2026-10-17 | Straight wall and Skirt + small wall supports; bridging; printing copies layer by layer | Thin wall replaced the first; the second made a web the line had to cross on every layer; chocolate can't span a gap; copies print one at a time (PLAN.md) |
| 2026-10-15 | The desktop-app track (taken up again in v96: desktop/) and the Simple / Advanced switch (one interface) | Not started / two views of one panel to maintain |
| 2026-10-15 | PDF, EPS, HPGL and plain SVG exports; 3D DXF; chocolate product records; working-resolution menu; the static "Planned" list on the 3D tab (now this file) | Never used |
| 2026-10-15 | `UNB.freqOf`, `UNB.closeOK` and group tags, `UNB.zLine`, text lane mask, units other than mm in exports, and other dead code (docs/history/AUDIT.md) | Never called |
