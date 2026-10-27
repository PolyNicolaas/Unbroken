# Roadmap

What the tracer should do next, what it might do one day, and what was taken out. This is the one list of open work:
the past audits and reviews in docs/history/ are kept as written, and whatever they left open is carried here. New
ideas and bugs start in the **Suggestion box** at the bottom of every tab; from time to time they're sorted into this
file (and ticked off in the box). Every item says who it's for and what it's used for: an idea without a use stays in
"Maybe later".

Last sorted: 19 October 2026 (v99: grouped into areas; the data and accounts plan added). Decisions made together are in PLAN.md.

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
- Suggestion box on GitHub Pages: notes stay in the browser that typed them, so notes from friends never reach this
  file. Fixed for good by the shared notes in DATA-PLAN.md stage 2; until then, an "Export notes" button.

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

- **Patterns from pictures, and more control** (decided 27 October, [`docs/ART-PLAN.md`](docs/ART-PLAN.md)): trace a
  picture with a pattern that draws its light and dark as one line (a space-filling curve, wave rows, a vibrating
  spiral and a labyrinth, by tone), and give the patterns sizes in mm, fitting inside a shape, deeper settings per
  style, and seeds with a grid of variations. v103.

- Patterns (v100): try them on real prints in the challenges (a labyrinth and a double spiral in chocolate, a whirl and
  Truchet tiles on the plotter). Ideas waiting for a use: more styles (circle packing, Voronoi cells, a Greek-key
  border, rose curves) and patterns in the 2D tab's fills.

- A text's pieces use the automatic term count and aren't shown on the Trace tab (it draws the text joined, as the
  2D tab plots it). If a piece needs looking after on its own, show the pieces there too.
- More fonts for lettering (raised 18 October; Chocolate and Dune Rise came in v98).

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
  inbox and print queue, the Suggestion box shared by every user. Likely Supabase in front of the GitHub Pages site.
- **Stage 3, the workshop**: the chocolate and clay database with prices (grams and cost per print), print recipes,
  the print log with ratings and photos, sharing, personalized batches (PLAN.md).

## 5 · Code and publishing

- Code: read the controls once per run (DESIGN.md step 4), then ES modules (step 6), as commits after the GitHub move.
- Speed-ups found in the audit: the outline join in `modelLayer`, `minBox`, the pen-fill stroke order, the connector
  searches in `buildWalk` (see docs/history/AUDIT.md).
- Publish GitHub Pages automatically on every push to `main` (a GitHub Action, after the tests pass); for now each
  update is built and published by hand.

Done since the last sort: Edit line (push, smooth, straighten the traced line by hand) and the Geometric art card
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
| 2026-10-27 | Edit line (push, smooth, straighten the traced line by hand, v100) | Not very useful in practice: hand edits are better made in a drawing app (export the SVG, edit, drop it back in) |
| 2026-10-27 | Shading in the Tracing card (hatch, cross-hatch, squiggle) | Didn't work well and was hard to use; patterns that draw a picture's tones replace it (v103) |
| 2026-10-27 | The Art tab's layers (v101): stacking, pen colours per layer, placement, the Art view | Too complicated: one input at a time is clearer. Layered plotter art could come back for multi-pen plots |
| 2026-10-19 | The desktop app (desktop/, the Electron Unbroken.app from v96) | Unbroken runs from GitHub Pages while it's still changing; a standalone app comes back when it's ready to roll out. The code is in the repo's history (commit 40a733b); its next steps were a Windows build, signing and notarising, opening designs from Finder and a `.dmg` |
| 2026-10-17 | Straight wall and Skirt + small wall supports; bridging; printing copies layer by layer | Thin wall replaced the first; the second made a web the line had to cross on every layer; chocolate can't span a gap; copies print one at a time (PLAN.md) |
| 2026-10-15 | The desktop-app track (taken up again in v96: desktop/) and the Simple / Advanced switch (one interface) | Not started / two views of one panel to maintain |
| 2026-10-15 | PDF, EPS, HPGL and plain SVG exports; 3D DXF; chocolate product records; working-resolution menu; the static "Planned" list on the 3D tab (now this file and the Suggestion box) | Never used |
| 2026-10-15 | `UNB.freqOf`, `UNB.closeOK` and group tags, `UNB.zLine`, text lane mask, units other than mm in exports, and other dead code (docs/history/AUDIT.md) | Never called |
