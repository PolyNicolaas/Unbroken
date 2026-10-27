# The Art tab · plan

## Decided 27 October 2026 (after trying v101)

Nicolaas tried v101 (layers, pens, placement): the patterns make good chocolates, but the app was getting too
complicated, the shading didn't work well, and Edit line wasn't very useful. So:

- **One input at a time** (v102). The Art tab picks a picture, the text, a pattern or a 3D model; each keeps its own
  settings while another is in use. The layers, pens per layer, placement and the Art view are gone.
- **Keep the trace.** Art → Trace → 2D (plotter) or 3D (printers, chocolate now, clay next). A pattern or the text can
  also be plotted exactly as drawn.
- **Edit line goes** (v102). Hand edits are made in a drawing app: export the SVG from the 2D tab, edit it in
  Illustrator, Affinity or Inkscape, drop it back in as the picture.
- **Shading goes** (v102), replaced by **patterns from pictures**: a pattern draws a picture's light and dark, still as
  one continuous line, so it prints in chocolate. All four, in this order:
  1. **Space-filling curve by tone**: a Hilbert / Moore curve that subdivides finer where the picture is darker.
  2. **Wave rows by tone**: rows that wiggle tighter and stronger in dark areas.
  3. **Vibrating spiral**: one spiral from the centre, vibrating harder where it's dark (portraits).
  4. **Labyrinth by tone**: a maze with smaller cells in dark areas, one closed line.
- **More control in the patterns**, all four kinds:
  - **Sizes in mm**: the gap between lines, cell size and overall size, set directly for the needle.
  - **Fit inside a shape**: a circle, heart, star… or a picture's silhouette, text, an SVG outline.
  - **Deeper settings per style**: corner radius, randomness, symmetry, density curves.
  - **Mix and vary**: seeds, a grid of variations to pick from.
- Kept as they are: Select area, Erase, Set start, Draw, Crossing areas, Connector paths, Optimize tracing, the math
  panel and the circles.

## Phases

| # | What | Version |
|---|---|---|
| 1 | One input at a time; Edit line and Shading removed | v102 ✓ |
| 2 | Patterns from pictures (the four above); sizes in mm | v103 |
| 3 | Fit inside a shape; deeper settings per style; mix and vary (seeds, a variation grid) | v104 |

## Earlier: decided 26 October (superseded)

The first plan (26 October) had a layered Art tab: layers with pens, line and area styles on any shape, multi-line
traces for the plotter, five image generators. Phase 1 of it shipped as v101 and was simplified in v102. Ideas from it
that may come back with a use: layered multi-pen plotter art; styles along a line (a wave or zigzag following an
outline); flow lines, contours + hatch and a stipple path drawn from a picture; 3D models as vector art.
