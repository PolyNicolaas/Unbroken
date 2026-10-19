# Challenges

Practical prints taken through the app the way a person would: load a drawing or a model, set it up on the 3D tab,
export the G-code (and the plotter SVG). Tests check that each feature does what it says; challenges check that the
features together make a good print, and turn up what gets in the way. The first run (v84) found two bugs that 56
passing tests had missed.

    node source/challenges/run.js              all jobs
    node source/challenges/run.js cup,heart    only these

Each run writes `results/<date-time>/report.md` with every job's readouts, ready list, the G-code read back move by
move (no travel inside a copy, the first layer at First-layer Z, travel above the print, on the plate, no move faster
than the set speed), screenshots of the layers and the plate, and the files. A job **breaks** on a page error, a ✗ in
the ready list, a readout that doesn't match its `expect`, or a G-code rule broken; ⚠ lines are findings to read.

**Workflow:** run the challenges with every version, read the report and the pictures (not only the summary), and add
new jobs aimed at what just changed (`jobs.js`: what it pushes on, in `why`). Old jobs stay, so each run is also a
regression check. Drawings live in `art/` as SVG; models are made by `models.js` (STLs aren't kept).
