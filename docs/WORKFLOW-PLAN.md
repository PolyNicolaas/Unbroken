# Workflow · plan

## Decided 27 October 2026 (after v106)

Nicolaas: the workflow still seems complicated, and it isn't obvious how to toggle tracing. Tracing was set in three
places (Made for, Next → Trace it / Plot as drawn, the 2D tab's Traced line / Art as drawn), pictures were traced
without a visible step, and there were two rows of tabs (Art / Trace / 2D / 3D and the preview's Line / 2D page / Plate
/ 3D layers). Decided:

- **Output first.** At the top: **Printer** (chocolate, clay) or **Pen plotter**. It replaces Made for and decides the
  last step: **Art → Line → Print** or **Art → Line → Plot**.
- **The Line step has one switch** for how the art becomes lines:
  - **One continuous line**: traced (the Fourier line); the only choice for a printer.
  - **Separate strokes**: traced into strokes, the pen lifting between them (the multi-line trace asked for on 26
    October, new).
  - **As drawn**: no trace, the exact lines of a pattern or text (a picture has no lines until traced).
- **The preview follows the step**: the art on Art, the line on Line, the page on Plot, the plate or layers on Print
  (a small switch there). The preview's own row of tabs goes, and so do the Next card's two buttons and the 2D tab's
  Traced line / Art as drawn switch: the Line step's switch is the one place.

Version v107 ✓ (27 October); fills per grey move to v108 (docs/PREP-PLAN.md).

## The Trace switch (28 October, v112)

Nicolaas: "I still think we need a trace button, to turn trace on and off." Decided: one switch under the preview, on
every step (beside Play drawing). Off leaves the art as it is: As drawn merges into it (a pattern or text plots as its
exact lines), a picture shows as the picture, and nothing re-traces. Printing, or plotting a picture, asks for Trace on.
The Line card keeps how it's traced: one continuous line, or separate strokes on a plotter.
