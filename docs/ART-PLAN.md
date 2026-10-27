# The Art tab · plan, decided 26 October 2026

Worked out with Nicolaas, question by question, after v100 (Edit line, the Geometric art card). The phases at the end
are the order of work, each published as its own version. **Phase 1 is done (v101).**

## The flow

**Art → Trace → 2D (plotter) or 3D (printers)**

- **Art** is where everything comes in: pictures, text, 3D models and generators. Nothing is imported anywhere else.
- **Trace** turns the art into the line a machine needs:
  - **Single line**: one continuous Fourier line. Required for the 3D printers (chocolate now, clay next: neither can
    stop the flow). Also fine on the plotter.
  - **Multi-line**: separate strokes, for the plotter only. For art made from geometry (already clean vectors) it is a
    cleanup: smooth, join pieces whose ends touch, drop specks, order the pieces to keep pen-up travel short. For an
    imported picture it is the picture tracer, keeping strokes separate instead of joining them.
- **2D** can take the art straight from the Art tab, skipping Trace (exact vectors). It then says that printing needs a
  trace.
- **3D** takes only the single line from Trace. The exception: a 3D model sent to print as a model goes straight from
  Art to the 3D tab's slicing (a sliced model is printer lines already).
- Wording is "printer" and "material", not "chocolate", wherever the clay printer will use the same thing.

## Inside the Art tab

1. **Sources make shapes.** Every source gives **lines** (strokes, outlines, edges) and **areas** (the closed regions
   between lines).
   - Picture: its traced strokes and the regions they close off.
   - Text: letter strokes; the insides of letters are areas.
   - 3D model: the line drawing of a view (outlines and folds; faces as areas) or its slices as contour lines; or
     "print this model", straight to 3D.
   - Generator: its pattern (today's ten styles, deepened, and new ones), or a plain shape (circle, heart, frame).
   - Image-driven generators: an imported picture drives the drawing (below).
2. **Styles dress the shapes.**
   - **Area style**: fill the area with any generator, clipped to its edge (a labyrinth in a heart, Truchet tiles in a
     letter, hatch following the picture's tone).
   - **Line style**: run a generator along the line (a wave or zigzag following it, small spirals along it, a
     telephone-cord loop, a vibration following the picture's darkness), or leave it plain.
   - Chosen **per layer** (one style for its lines, one for its areas) as the default; **tap a line or area** on the
     preview to override it. Styles can nest: a style's own lines can be styled again.
3. **Layers and pens.** Each source is a layer; every line or area has a pen (colour, width), and each pen is its own
   Saxi layer in the SVG. The 2D tab's fill pens and shapes move here (they are the area styles); the 2D tab keeps
   paper, layout and export.

## Single line and layers

A print uses one material (one cartridge), so the printer gets one line: by default **every layer merged into one
line**, with a menu to **pick one layer** instead.

## Image-driven art in the printer

Allowed to try: the single-line route takes it like anything else, and the size marks and the moved-lines shading show
how big it must be and where detail is lost, so a full print is a judgement made on the preview.

## Image generators, in this order

1. Flow lines: strokes following the picture's edges and shapes, denser where it's darker.
2. Contours + hatch: lines at even brightness steps (a topo map's height lines), hatched between, denser in darker
   bands.
3. Tone hatch / cross-hatch: rows whose spacing and number of crossing passes follow the darkness.
4. Stipple path: dots by darkness, joined into one line through them (a TSP path).
5. Vibrating spiral: one spiral from the centre, wiggling harder where it's darker (portraits).

## Phases

| # | What | Done when |
|---|---|---|
| 1 ✓ v101 | The Art tab: layers and pens; sources moved in (picture, text, 3D model, the ten styles); the Trace tab reads the art; Art straight to 2D with the "printing needs a trace" note | Everything that worked in v100 works through Art |
| 2 | Lines and areas: shapes from every source, area and line styles, per layer with taps to override, nesting; the 2D fill pens moved in | A labyrinth fills a letter and a wave runs along a leaf's outline, each on its own pen |
| 3 | Trace modes: single line (merge all or pick a layer) and multi-line (cleanup, or picture trace); 3D takes single lines only; printer / material wording | Art reaches 2D three ways and the printer one way |
| 4 | The image generators, in the order above | Each draws a test portrait and a topo map |
| 5 | Deeper and new generators (flow fields, circle packing, Voronoi, string art, phyllotaxis…), transforms (symmetry, repeat, clip), 3D models as geometric art | |

**Design files:** a file saved before the Art tab opens as an art of one layer (its picture or text), so old designs
keep working.

**Phase 1 as built (v101), and what it leaves for later:** one text layer and one model layer (their controls are
single cards); pens are a colour per layer (the 2D tab's pen width applies to all; the fill pens still live on the 2D
tab until phase 2); Placement is size and move (rotation, symmetry and repeat are phase 5's transforms); a 3D model
prints on its own, and its view comes in as a picture via Draw this view (models as vector art: phase 5).

**Open later:** a variation gallery (a grid of random versions to pick from).
