# Roadmap

What the tracer should do next, what it might do one day, and what was taken out. This is the one list of open work:
the past audits and reviews in docs/history/ are kept as written, and whatever they left open is carried here. New
ideas and bugs start in the **Suggestion box** at the bottom of every tab; from time to time they're sorted into this
file (and ticked off in the box). Every item says who it's for and what it's used for: an idea without a use stays in
"Maybe later".

Last sorted: 18 October 2026 (v97: the Suggestion box notes of 18 October). Decisions made together are in PLAN.md.

## Now

- **Side-by-side checks of v92 on the Mac:** the suite (58 tests) and the model and lettering challenges passed
  before the sync. Still to do there: the six drawing challenges (their SVGs are only on the Mac), then `compare.js`
  against the v91 run. Expected to change: G-code with a travel speed set and retraction off, and Lines infill below
  100% (and solid Lines fills of shapes whose rows split, like a heart's two lobes). Everything else should come out
  byte for byte the same.
- **Prove the tracer's own G-code on the choc mate 2** (v66–v67 follow choc OS's files: purge line, retraction and
  wipe, E per mm from the needle and the 50 cc syringe, copies one at a time, at least 20 s per layer). The goal is
  to stop paying for choc OS; its DXF upload stays as a fallback (3D tab, "DXF for choc OS") until then. Worth trying
  on the printer while at it: choc OS's 120 mm/s for the Z moves (settings.js `zTravelSpeed`, `zApproachSpeed`).

## Next

- Left from the code review of 16 October (docs/history/REVIEW.md):
  - Tests: cover painting areas, Draw your own, image prep, shading, erase, the test print's speed / gap / flow kinds,
    the ready list's second-click export, height staying put on a chocolate or printer change, the per-card
    small-areas setting (review test 4); tighten the loose checks in A12, E14, E28 and A22 (test 5); move the timing
    tests A02, E13 and E26 into their own group (test 7).
- Tests for v92: painted areas at the same width after a re-trace at a new resolution; the ready list's Trace-tab
  lines switching tab; the test print's range following a chocolate change; a saved model design opened with another
  model loaded; nudging a model's height five times slicing once; the travel speed without retraction and the Z speeds
  (E28; E14 can check `zTravelSpeed` / `zApproachSpeed` like the other printer fields); the spectrum order unchanged
  (E17); sparse Lines infill in a small heart (rows in both lobes, row ends a line spacing from the ring); a design
  saved in mm/min opening as mm/s.
- Solid fills: where a second filled area is joined into the wall, the join can cross the line once or twice before
  the clean-up step untangles it (found measuring v92's infill; the same before v92). Join it on a stretch where it
  can't.
- Time per layer for small models: every slice is its own lap, so small layers can't take 20 s even at the slowest
  speed (the ready list warns). Decide between a cooling pause off to the side and a bigger design (copies stay one
  at a time).
- Several different designs on one plate: a text's lines can print as separate pieces since v97 (the plate packs
  pieces of different sizes, `UNB.plateLayoutPieces`); drawings and models still print copies of one design.
- A text's pieces use the automatic term count and aren't shown on the Trace tab (it draws the text joined, as the
  2D tab plots it). If a piece needs looking after on its own, show the pieces there too.
- **The 4000-term limit** (Suggestion box, 18 October: why is it there?). Only busy photos reach it: at 4000 terms
  their line stays up to 0.1–0.2 mm off its traced path (95th percentile), and they'd need 6000–8000 to come within
  the tolerance. Working the terms out is cheap at any count (about 50 ms for every count up to 16 000), so the limit
  isn't about speed any more; it dates from the early versions, when only the animation and the formula grew with it.
  Decide whether to raise it to what the samples allow (16 384); drawings and lettering are unaffected either way.
- Code: read the controls once per run (DESIGN.md step 4), then ES modules (step 6), as commits after the GitHub move.

Done since the last sort: v92's review fixes (painted areas after a re-trace, cancelling stale layer runs, a saved
model design matched by its model, the ready list from the 3D tab, the test print's range, travel speed without
retraction, the spectrum sort), sparse Lines infill in small parts, Z speeds as printer settings; before that plate
estimates (metres, minutes, chocolate per copy and plate, cartridge warning), the test print, the ready list, cut-off,
support for overhangs (flared skirt, thin wall), connectors through the middle of 3D models, the challenge runner, and
the v91 clean-up. Cost per print waits for the chocolate database (PLAN.md).

## Later

- Sending the file straight to the printer (not for now, 17 October): the choc mate 2's start lines are Repetier-Server
  host commands, so its upload API is the likely route; download and copy over until then.
- **A design database** (planned 17 October): each design gets a project number, kept for life and added to its file
  names (`welcome_084_2x_U0007-gcode.zip`), with the details stored against that number rather than in the files:
  the design file, app version, needle, layer height, height, chocolate, speed, copies, and how the print came out.
  File names already have the parts that don't need the database (design, needle, copies; v93).
- STL: a solid top skin over sparse fill.
- Desktop app, next steps (the Mac app exists since v96, desktop/README.md): a Windows build; signing and notarising
  with an Apple developer account (no first-launch question); recent files and opening designs from Finder; a
  `.dmg` with the drag-to-Applications window.
- Split a complex model into printable parts to glue (PLAN.md; first test: the tree).
- Speed-ups found in the audit: the outline join in `modelLayer`, `minBox`, the pen-fill stroke order, the connector
  searches in `buildWalk` (see docs/history/AUDIT.md).

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
| 2026-10-17 | Straight wall and Skirt + small wall supports; bridging; printing copies layer by layer | Thin wall replaced the first; the second made a web the line had to cross on every layer; chocolate can't span a gap; copies print one at a time (PLAN.md) |
| 2026-10-15 | The desktop-app track (taken up again in v96: desktop/) and the Simple / Advanced switch (one interface) | Not started / two views of one panel to maintain |
| 2026-10-15 | PDF, EPS, HPGL and plain SVG exports; 3D DXF; chocolate product records; working-resolution menu; the static "Planned" list on the 3D tab (now this file and the Suggestion box) | Never used |
| 2026-10-15 | `UNB.freqOf`, `UNB.closeOK` and group tags, `UNB.zLine`, text lane mask, units other than mm in exports, and other dead code (docs/history/AUDIT.md) | Never called |
