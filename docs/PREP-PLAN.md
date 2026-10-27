# Image prep and grey levels · plan

## Decided 27 October 2026 (after v104)

Nicolaas wants imported pictures easier to get ready, mostly for drawings (the pen plotter), and an example picture to
show the pattern fills. Answers to the questions that day:

- **A new sample: a still life in flat tones.** A vase, fruit and a cloth in 4–5 clear greys, drawn by the app like the
  other samples. Good for the grey levels and the fills; the face sample stays for the picture patterns.
- **Grey levels (posterize)** in the Image prep card: the picture reduced to 2–6 flat greys, with a preview of the
  blocks. Each grey gets **Trace** (its edges are lines), **Fill**, **Both** or **Skip**.
- **Fill is picked per level:** hatch, cross-hatch, rings (contours stepping in), or a pattern from the Pattern card
  clipped to the level's shape. One pen per level (each its own Inkscape layer, as the 2D fills are now); darker levels
  start denser.
- **More prep tools** in the same card:
  - **Smooth blocks**: specks removed and each grey block's edges rounded, so its outline traces clean;
  - **Crop and rotate**: straighten and trim an imported photo;
  - **Background removal**: the plain-background flood there is now, plus picking the background colour by tapping it.
- **Made for: Printing / Plotting** (added the same day, after trying the wave rows): the printing limits (needle
  spacing, traceable detail) shouldn't hold back art for the plotter. Plotting lifts them and plots as drawn.

## How it fits the pipeline

- Prep stays an image step (01-image.js, `UNB.prep`): levels and smoothing make a labelled image (level per pixel).
- **Trace** levels: the line map is the edges between levels, for the levels set to Trace or Both (an edge is drawn when
  either side asks for it), traced as now (one line, or the walk with connectors).
- **Fill** levels: the 2D tab's pen fills (`UNB.penFills`) are seeded per level instead of by tapping: every area whose
  pixels are mostly that level is filled with the level's style. A level set to Fill only still separates its area (its
  edges are walls the fill stops at, not drawn).
- Chocolate: Trace levels print as the line; filled levels are a plotter feature first (infill by level could follow).

## Phases

| # | What | Version |
|---|---|---|
| 1 | Still life sample; Image prep card: Levels (Trace / Skip), Smooth blocks, background by tapping; turn and straighten (crop stays Select area); Made for Printing / Plotting | v105 ✓ |
| 2 | Fill and Both per grey; level fills on the 2D tab: hatch, cross-hatch, rings or a pattern per level, one pen per level, walls for Fill-only levels | v108 |
