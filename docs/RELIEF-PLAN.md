# Reliefs: height from the picture, and tap-to-edit

Plan, 26 November 2026; built in v173 (`web-app/features/relief/relief.js`, `source/engine/19-relief.js`). The plan is
kept as written; **What was built** at the end says where the build went another way, and why.

## The flow

1. **Make something flat:** a picture, text or a pattern (Art step). A 3D model can't make a relief.
2. **Make a relief:** the button shows wherever there is something flat to use (Picture card, Line step). The
   first press makes a flat plaque, as today. Pressing it again never resets the shape: only the source changes.
3. **The Relief panel** (the vase's Texture, Picture): one style, its one slider, the inset, Depth, Direction.
4. **Print** as now.

The relief stays linked to its source. Editing the same source (prep, cutout, the typed text, a pattern's settings)
updates the relief straight away. A *different* source (a new picture, switching picture → text) changes the relief
only when Make a relief is pressed again, so going back to try something else can't silently replace it.

## The panel

| Control | What it does |
|---|---|
| **Style**: Smooth / Steps / Shapes | How greys become height. Starts from the source: Smooth for photos, Shapes for text and logos, Steps for patterns |
| One slider for the style | Smooth: *Contrast* (the curve). Steps: *Levels* 2–6. Shapes: *Bevel* (mm, rounded edge from a distance field) |
| **Line width** (text and patterns only) | How wide their strokes stand on the wall (mm). Starts at what reaches full depth (see below) |
| **Inset** | The face as it will print, after the slope and softening limits. Tap a part: out → pressed in → flat → out |
| **Swap out and in** | One tap for white-on-dark art (replaces *Light parts stand out*) |
| **Depth**, **Direction** | As today |
| Fine-tuning | *Soften edges* (stays at the bead width unless changed) |

The inset shows one copy: the flat face of a plaque, one face of a polygon, one span of a round wall. Darker is further
out, lighter pressed in, dashed is left flat. **Amber** marks what the printer can't make: detail under the bead width
(smoothed away) and parts that can't reach their depth (cut short by the slope limit). The readout counts parts out, in,
flat, and amber.

## What a part is

- Steps and Shapes: a connected area of one level (`label4` over the levelled grey). Each letter, ring or shape is a part.
- Parts smaller than the bead are merged into their neighbour (they're the amber ones anyway), so a photo in Steps
  doesn't give hundreds of tiny tap targets.
- Smooth: taps work on Steps' parts at 3 levels, outlined faintly so it's clear what a tap takes. If that's unclear in
  use, taps are for Steps and Shapes only.

## Stored with the design

`texture.height = { style, contrast, levels, bevel, lineW, swap }` and `texture.taps = [{ u, v, to }]` (u, v: share
of the picture's width and height; to: in or flat), recorded for Undo like `#tieEdits`. Taps are found again on
whatever part is under them, so they survive shape, depth and side changes and small source edits; a tap that lands on
no part is dropped. No reset buttons: tap a part back, or Undo; Make a relief never resets the shape. `texture.source = { kind, id }` for the link.

## Engine

`UNB.reliefHeight(P, height, taps)` in 17-vase.js, before `reliefGrid` samples the picture: curve or levels or
distance-field bevel (`UNB.edt`), then taps, then small parts merged. All of it joins the cache key. The stored grey
stays as it is (320 px), so nothing is lost by changing style. `UNB.reliefPrintable(...)` returns the depth after the
slope and softening limits, and the amber mask, for the inset.

## Evaluation

**What works well**
- One way in (push from the source), one panel for every source; four things on screen.
- Tapping parts is the Ties method: direct, undoable, nothing to learn.
- Showing the printable result (not the picture) answers "will this come out?" before printing.
- Cheap: the height map is 320 px; `label4`, `UNB.levels` and `UNB.edt` already exist.

**The real limit: horizontal strokes come out shallow.** A layer can lean at most 0.9 × overhang ÷ layer height over
the one below: about 0.84 mm out per mm up with the 0.84 mm needle at 0.3 mm layers. A raised part's top and bottom
are ramps, so a *horizontal* band only reaches full depth if it's at least 2 × depth ÷ slope tall: 4.8 mm for 2 mm
deep, 2.4 mm for 1 mm (corrected after building: depth ÷ slope, half that; see below). Vertical strokes are fine (sides along a layer are sharp). For lettering this means an E's arms
and a T's bar stand lower than its stems. Answers: text starts at about 1 mm deep with a line width that reaches it,
and the inset shows short parts in amber so it's visible. Worth a test print to see how it reads in chocolate.

**Other risks**
- Smooth's taps may be unclear (the fallback above).
- Text and patterns are drawn as strokes, not filled shapes: outline fonts come out as raised outlines, not solid
  letters. Shapes could fill closed letters (an option, or by default for text); decide after a first print.
- Live updates re-slice the vase on every source edit: debounce them, as Ties does.
- Removing *Light parts stand out* and moving *Soften edges* changes saved designs: fine while in beta.

## Build order

1. Make a relief keeps the shape; the source link with live updates; text and patterns as sources (Line width).
2. Styles: `UNB.reliefHeight`, the style choice and its slider; Soften edges to Fine-tuning.
3. The inset: printable view, amber, taps, Swap out and in.
4. Tests (engine: each style keeps order, levels give N heights, bevel within depth and slope, taps survive a shape
   change; app: re-make keeps shape, taps through Undo and design files) and four test prints: a logo (Shapes), a name
   plaque (text), a photo (Steps), a spiral pattern.

## What changes, and the cleanup that goes with it

**On screen**
- One **Make a relief** button, on the Art step's *Make it 3D* row, for a picture, text or a pattern. The Line step's
  copy (`#reliefFromPic`, beside Make a vase from this line) goes: a relief uses the source, not the traced line.
- The Relief panel gains Style, its slider, Line width (text and patterns), the inset and Swap out and in.
- It loses *Light parts stand out* (`#vtInvert`, the same flag now behind Swap out and in), the long `#vtPicMsg`
  hint (the inset's readout says it in one line) and *Soften edges* (`#vtSoft`, to Fine-tuning).
- Check whether *Strength up the wall* means anything on a relief; hide it there if not.

**Code**
- The relief moves out of the vase into its own feature, `web-app/features/relief/relief.js` (from vase.js's relief
  section, about 200 lines, and the inset), and its own engine part, `source/engine/18-relief.js` (from 17-vase.js's
  relief section, about 380 lines). The vase keeps a texture hook; turning the relief feature off leaves vases whole.
- `texture.kind: "picture"` becomes `"relief"` (the source isn't always a picture); `texture.picture` becomes
  `texture.source`. Old designs: none to keep (beta).
- The inset reuses the Ties card's canvas pattern (draw, hit-test, record for Undo) through one small shared helper
  rather than a second copy.
- One handler for Make a relief; the per-source part is only how the source becomes a grey image.

**Tests and docs**
- E65 and E66 move to the new engine part; E65's inverted case stays (the flag is the same). A72, A73, A74 and A75
  follow the button and control changes; new tests as in the build order.
- AGENT.md's control table, the README's relief section, ROADMAP (image relief done; brush left as maybe later) and
  the CHANGELOG.

**Bloat check when done:** vase.js and 17-vase.js shorter than now; no control that only one source uses shown for
the others; no setting both on screen and in Fine-tuning; the test count rises only by the new tests.

## What was built (v173), and where it differs from the plan

- **No live link.** A relief is the 3D model input, so while the source is being edited the relief isn't what's in
  use; following each edit live would rebuild something off screen. Instead **Make a relief** pressed again updates
  it: same shape and settings, the new source (a plaque's height follows the source's proportions), taps kept for
  the same kind of source and dropped for another.
- **Soften edges isn't in Fine-tuning (that card is gone): it's automatic.** Just enough softening that the line turns
  no tighter than about two thirds of the bead, which grows with the depth (0.65 mm at 1 mm deep with the 0.84 mm
  needle, 0.86 at 2, 1.03 at 3). The old fixed 1.3 mm flattened any stroke narrower than about 2.7 mm, so a name's
  letters barely stood out.
- **The horizontal-stroke limit is half what the plan said.** A band across the wall reaches its depth if it's about
  depth ÷ lean tall (2.4 mm for 2 mm deep at a 0.84 lean, 1.2 mm for 1 mm): the way back down spreads above the band
  rather than eating into it. Along a layer, a part needs to be about 2.1 × the softening wide (1.4 mm at 1 mm deep).
  The readout gives both numbers for the depth in use.
- **Text is drawn again from its layout** without the joins along the baseline (they help the trace; on a wall they
  were a raised bar under the word).
- **Line width starts from the source:** 60% of its narrow gaps (the narrowest fifth of the open space's middle line)
  plus the drawn stroke, at most 2.4 mm, so a word's letters and a pattern's lines don't run together.
- **Taps only in Steps and Shapes.** Smooth has no clear parts, so its inset has no outlines and says Steps and Shapes
  make parts to tap. A tap that misses a thin letter by a fingertip lands on it.
- **Shapes starts for flat art:** a picture with under 10% mid-greys (a logo, a drawing). Shapes leaves out ink lighter
  than mid-grey; when that's more than 15% of it the readout says so (Steps keeps it).
- **No reset button** (decided with Nicolaas): tap a part back, or Undo.
