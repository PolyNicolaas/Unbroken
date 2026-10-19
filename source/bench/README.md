# Trace-quality benchmark

Traces 11 images (the app's three samples plus line art, text, a logo and photos) with the app's own pipeline and
reports quality numbers plus a preview per image. It runs the same shared trace as the test suite
(`../tests/lib/trace.js`), so its numbers describe exactly what the app draws.

This folder is for exploring and comparing. The pass/fail checks live in [`../tests`](../tests/README.md): the
ground-truth accuracy and packed-lines experiments that started here are now tests E01 and E02.

```
cd source/tests && npm install   # once: the benchmark uses the test suite's libraries
cd ../bench
python3 make_images.py           # photo test images from scikit-image → images/
node bench.js out                # results → out/results.json and out/<image>.png
```

`node bench.js out camera` runs only the images whose name matches the pattern.

Preview: on the left, the detected lines over the faint source (blue kept, orange dropped); on the right, the final
line, with connectors in orange.

| Column | Meaning |
|---|---|
| `N` | Terms picked: the fewest that keep 95% of the line within 0.35 px of the traced path |
| `err` | The app's error: ½ (stray + missing) against the traced path, in working px |
| `parts` / `drop` | Separate pieces of line kept / dropped as far-away specks |
| `path/pix` | Length of the drawn path ÷ length of the lines; 1.0 means nothing is drawn twice |
| `doubled` | Share of the path that retraces a line already drawn |
| `jumps` | Total connector length in px |
| `crossings` | Self-crossings before → after crossing removal |

## Results log

| Date | Change | mean err | path/pix | doubled | crossings |
|---|---|---|---|---|---|
| 2026-10-13 | Baseline | 0.607 | 1.78 | 62% | 161 |
| 2026-10-13 | Loose-end pairing (jump cost 2), shortest-path retracing, spur pruning | 0.641 | 1.56 | 43% | 119 |
| 2026-10-13 | Untangle step (`UNB.uncross`), all crossings (`UNX=90`) | 0.641 | 1.56 | 43% | 174 → 0 |
| 2026-10-13 | Untangle, shallow crossings only (`UNX=30`) | 0.641 | 1.56 | 43% | 174 → 54 |
| 2026-10-13 | `UNB.untangle`: untangle + keep strands ≥ 0.75 px apart; untangle again after export simplification; smoothing straightens segments that would cross | 0.82 | 1.56 | 43% | 0 in preview and in exported SVG (plain and smooth), on 6 images end to end |
| 2026-10-14 | Subpixel line (`UNB.snapWalk`), term count by distance from the line (`UNB.pickTerms`, p95 ≤ 0.35 px), refinement off by default | see ground truth below | – | – | – |
| 2026-10-14 | Packed strokes split along light valleys (`UNB.centerline` split), far groups dropped only when small | see packed lines below | – | – | – |
| 2026-10-14 | Refinement removed; benchmark now runs the app's pipeline (`../tests/lib/trace.js`). New baseline: mean err 0.30 px against the traced path, 1748 terms, path/pix 1.46, 43% doubled, all crossings removed | – | 1.46 | 43% | 0 |

## Floating size (smallest size that keeps the spacing)

*History: this measured the first search, `UNB.smallestSize`, since replaced by `UNB.smallestPrint`, which lays out the strands and stroke-end loops at every width it tries (see the main README, Size and detail).*

`UNB.smallestSize` searched the output width at which a minimum line spacing holds (closest gap ≥ 90% of it) while
90% of the line stays within *detail* × drawing width of the fitted curve. Spacing is applied on a copy of the curve with
points spacing/3 apart, which is what makes the gap actually reachable (finer sampling stalled at ~0.2 of the gap).
At 1 mm spacing (widths in mm, low / medium / high detail = 0.022 / 0.013 / 0.007):

| Image | Low | Medium | High |
|---|---|---|---|
| leaf (sample) | 44 | 69 | 106 |
| smiley (sample) | 34 | 60 | 112 |
| camera (Outline) | 56 | 80 | 123 |
| logo | 33 | 41 | 50 |
| astronaut (Outline) | 41 | 65 | 112 |

Search time: under 1 s for line drawings, 4–8 s for busy photos.

## Ground-truth accuracy (wobble)

Test E01 (`../tests/engine/E01-ground-truth.test.js`) traces synthetic drawings whose true line is known exactly (two rings, circles + rectangle +
diagonal, the leaf's curves, tightly packed rings and a spiral, and filled shapes in Outline mode) and measures how far
the final line sits from the truth, in working px (500 px wide). Lower is better.

| Pipeline | mean | p95 | truth covered within 1 px |
|---|---|---|---|
| Before: pixel line, term count by chamfer error, 6 refinement passes | 0.345 | 0.95 | 83.2% |
| Subpixel line + term count by distance from the line, no refinement | 0.132 | 0.39 | 86.7% |

Why: the pixel walk wanders ±1.5 px around the true middle of a stroke (thinning artefacts), the Fourier fit copied
that, refinement pulled the curve back onto whole pixels, and the old term rule stopped early enough to leave ringing.
Snapping each point onto the centre of the ink run it sits in (or the peak of the edge) takes a 9 px ring's line from
0.58 px to 0.08 px off the true circle (p90). Term counts go up (about 2× on drawings, up to 4000 on busy photos); that
only affects the animation and formula, not the printed line.

## Packed lines

Test E02 (`../tests/engine/E02-packed-strokes.test.js`) draws six rings, eight parallel lines and a spiral at centre spacings of 4–12 px with stroke
widths 2–4 px, and measures how much of each true line the traced line covers (within 1 px).

| | 4 px | 5 px | 6 px+ | mean |
|---|---|---|---|---|
| Before | 26–50% | 26–51% | 97–100% (lw ≤ 3) | 80.6% |
| After  | 91–100% | 100% | 99–100% | 99.4% |

Before, strokes with less than about 3 px of paper between them merged into one wide band at the ink threshold, and the
band was outlined as a shape. Now `UNB.centerline` marks pixels lighter than the pixels on both sides of them (by 10% of
the ink↔paper contrast) as gaps and cuts along them, but only where the cut leaves thin strokes; inside filled areas
(the logo's pale fills) the cut is rejected, so texture never punches holes.

Ground-truth coverage also rose from 87% to 96%: the "drop far-away parts" rule kept only the group holding the single
biggest piece, so five rings 18% of the image away from a spiral were discarded. Far groups are now dropped only when
they are under a fifth of the biggest group's line length; sizeable ones are joined with the shortest connectors.
