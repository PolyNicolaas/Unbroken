# Unbroken by dimension: 2D · 2.5D · 3D · plan (27 November 2026)

Status: a plan for Nicolaas to review. Nothing is built yet. Written against v183.

Nicolaas: *"we have 2D (plotter), 2.5D for any line that is extended in layers, 3D having full shape. What if we
organize based on these."* Keep the D names: they make sense to the people who use the app.

---

## 1. The idea

Today the app is organised by **where the design comes from**: Input is Picture, Text, Pattern, Molecule or 3D
model, and *For* picks a pen plotter or a printer. What a design *is* gets worked out from those choices, and the
tools follow from that. That's why a vase showed Infill and Trace, and why "Make it 3D" buttons sit in two places.

The plan makes **the dimension** the first choice, beside the machine:

| | **2D** | **2.5D** | **3D** |
|---|---|---|---|
| What it is | One line, flat | A line or a picture built up in layers | A full shape |
| Made from | Picture, Text, Pattern, Molecule | The same | Vase, Morph, Relief, STL |
| Its own tools | Tracing, Line, Size, Math, Drawing | 2D's, plus Layers (Height, Base, Infill, Ties) | Profile, Shape, Top, Change, Texture, Movement, Rim; a relief's Depth; for an STL: turn, cut, walls, support |
| Machines | Pen plotter | Printer (one layer or more) | Printer |
| Comes out as | SVG, DXF | G-code | G-code, STL |

The rule the rail follows: **a tool shows only in the dimensions it does something in.**

**Decided (Nicolaas, 27 November 2026):**
- The names are 2D, 2.5D and 3D.
- **Reliefs are 3D** (a plaque and a relief round a vase alike).
- **A one-layer print is 2.5D with one layer.** 2D is the line itself: what a pen plotter draws, and SVG or DXF.
- The morph gets a limited set (of patterns and words) that works.
- **M1 is the target for now** (built in v184); the 2D · 2.5D · 3D change comes after.

## 2. The top bar

```
[ Pen plotter | Printer ]   [ 2D | 2.5D | 3D ]        Undo Redo   File  View
```

- **Pen plotter** offers 2D only. **Printer** offers 2.5D (one layer by default) and 3D. 2.5D and 3D are greyed out with the reason in their hover text ("a plotter draws flat").
  Picking the plotter while in 2.5D or 3D asks first: a 3D design can still be plotted as a view of it (*Draw this
  view*), which makes a 2D design.
- (A clay printer, later, would offer 2.5D and 3D too.)
- The bar also shows what the design is, in words: "2.5D · picture · 6 layers, 1.8 mm".

## 3. The workflow, per dimension

### 2D: a line
1. **Source**: Picture (with Camera, Cut out, Image prep), Text, Pattern or Molecule. Examples are grouped under 2D.
2. **Tracing** (a picture only), Grey levels.
3. **Line**: spacing, path, crossings, round corners. **Drawing** (Watch) and **Math** below it.
4. **Size**.
5. **Out**: *Plot…* (page, pens, fills, export SVG). Printing it is 2.5D: one layer to start.

### 2.5D: a line in layers
Everything in 2D, then:
- **Layers** joins the design rail (it's on the Print screen today): Height, Base, Infill, Ties. Lines of text as
  separate pieces lives here too.
- **Height starts at one layer**: a flat chocolate drawing is a 2.5D print one layer high.
- **Out**: *Print…*.

### 3D: a full shape
1. **Kind**: Vase, Morph, Relief or STL (where *3D model* sits in Input today). Examples are grouped under 3D. A relief
   takes a 2D source (a picture, text or pattern) and makes its greys depth on an upright plaque or round a wall.
2. Its own tools (as now): a vase's Profile, Shape, Texture, Movement, Rim; a morph's Bottom, Top, Change, Profile, Rim;
   an STL's turn and cut.
3. **Out**: *Print…* (Material, Machine, Plate, Tests, Layers kept to what a 3D print uses).

### Moving between dimensions
| From → to | What happens |
|---|---|
| 2D → 2.5D | Everything is kept; Layers is added, starting at the height the material suggests |
| 2.5D → 2D | Kept; the height goes back to one layer (the 2.5D settings are remembered, for going back) |
| 2D or 2.5D → 3D | Asks: *A vase from this line*, *A morph from this line* (the line is the bottom; the top starts as a letter) or *Start empty*. This replaces the "Make it 3D" buttons |
| 3D → 2D | *Draw this view*: the 3D preview's view as one line (a vase from above, a profile, an STL's outline) |
| 3D → 2.5D | Not offered (a 3D design has no flat source to raise). A relief goes back to its source in 2D |

Undo goes back across a change of dimension.

### Opening a saved design
| Saved as | Opens in |
|---|---|
| Picture, Text, Pattern, Molecule, made for a pen plotter | 2D |
| The same, made for a printer (one layer or more) | 2.5D |
| Vase, Morph, Relief, STL | 3D |

Nothing in a saved file changes. The dimension is worked out on opening, and saved from then on.

## 4. The rail per dimension (design screen)

| Tool | 2D | 2.5D | 3D |
|---|---|---|---|
| Source (Picture/Text/Pattern/Molecule) | ✓ | ✓ | — |
| Kind (Vase/Morph/STL) | — | — | ✓ |
| Tracing, Grey levels | ✓ | ✓ | — |
| Line, Drawing, Math | ✓ | ✓ | — |
| Size | ✓ | ✓ | (in Profile) |
| Layers (Height, Base, Infill, Ties) | — | ✓ | — |
| Vase / Morph / Relief / STL tools | — | — | ✓ |

On the Print screen: Material, Machine, Plate and Tests for all three. Layers (as a Print tool) shows only Seconds per
layer and the warnings in 2D and 3D, since their height comes from the design.

## 5. Modules

Each stays a module that can be switched off with `?off=name`. The new **`dims`** module is the switch itself.
Turned off, the app works as it does today.

| Module | What it does | Dimension | Change |
|---|---|---|---|
| core: art, line, size, math, watch | Sources, the trace, the line, its size | 2D, 2.5D | None |
| camera | Take a picture | 2D, 2.5D | None |
| cutout | Cut out the object | 2D, 2.5D | None |
| levels | Grey levels, background tap | 2D, 2.5D | None |
| optimize | Presets, Optimize tracing | 2D, 2.5D | None |
| patterns | Pattern settings | 2D, 2.5D; a morph's bottom or top | Patterns become morph shapes (§7) |
| molecule | Molecules | 2D, 2.5D | None |
| plotter | Page, pens, fills, SVG | 2D | 2D is the plotter's |
| pieces | Lines of text as separate pieces | 2D, 2.5D | Moves with Layers |
| ties | Struts across gaps in tall prints | 2.5D | Shown only in 2.5D |
| relief | A picture's greys as depth on a plaque or wall | 3D | Under Kind; takes a 2D source |
| vase | Vases | 3D | Under Kind; *from this line* comes from the 2D → 3D step |
| morph | Morphs | 3D | Under Kind; big morphs (§7) |
| model | STL, the 3D preview, Draw this view | 3D | Under Kind |
| testprint, matrix | Test strips, the test matrix | All (printer) | None |
| **dims** (new) | The 2D · 2.5D · 3D switch, the rail filter, moving between dimensions | All | New |

The rail filter is the `off()` each tool already has (v183), plus the tool's dimensions: `dims: ["2d", "2.5d"]`.

## 6. Building it

1. **The switch and the filter.** `dims` module; each tool says its dimensions; the bar shows the dimension; opening a
   saved design picks it. Nothing moves yet.
2. **2.5D.** Layers joins the design rail, one layer by default; Infill and Base only here; 2D ↔ 2.5D keeps settings.
3. **3D.** Kind replaces *3D model* in Input; 2D → 3D asks how to start; Draw this view goes to 2D; Examples grouped.
4. **The plotter** offers 2D only, and Draw this view from 3D.
5. **Tests:**
   - A82: each dimension's rail.
   - Every move between dimensions, with Undo.
   - Every example opens in the right dimension.
   - `?off=dims` gives today's app.

   A12 and A61 need updating (controls per dimension). The full run must pass.
6. **Docs:** README (the D's first), AGENT.md, CHANGELOG.

---

## 7. The morph, bigger: 125 mm tall, patterns and words

Nicolaas: *"see if it can work on complex shapes as well where the prints are a lot bigger, 125 mm tall; pattern to
pattern or things like that would be amazing, full words would also be great."*

### Trials (27 November 2026, the app's own check, `UNB.morphCheck`)

All morphs are 125 mm tall with 0.3 mm layers. Patterns are 80 mm across, words 16–30 mm tall. Spacing is 1.34 mm and
each layer can step 0.28 mm. Scripts: `source/bench/morph-trial/big/`.

| Morph | Prints? | Height it needs |
|---|---|---|
| Moore 2 → Moore 3 (the same pattern, finer) | ✓ | |
| Moore 3 → Moore 4 | ✓ | |
| Circle → Moore 3 | ✓ | |
| Spiral → spiral with more twist | ✓ | |
| Moore 3 → LOVE | ✓ | |
| Heart → LOVE, star → LOVE, pebble → LOVE | ✓ | |
| Circle → LOVE | ✗ | 723 mm |
| Circle → JOY | ✗ | 765 mm |
| MOM → DAD | ✗ | 206 mm |
| LOVE → HOPE | ✗ | 1650 mm |
| Heart → HAPPY, heart → NICOLAAS | ✗ | ~1760 mm |
| A pebble stretched to the word's shape → HAPPY, NICOLAAS | ✗ | ~2000 mm |
| Moore → Hilbert, Gosper 1 → 2, Hilbert 2 → 3 | ✗ (Hilbert and Gosper are open lines, so their loop doubles back) | 870–1565 mm |
| Labyrinth → another labyrinth; Labyrinth twist 30 → 80 | ✗ | 409–1979 mm |

**With the counters filled** (O as a solid shape, no slits), the same check:

| Morph | Prints? | Height it needs |
|---|---|---|
| LOVE → HOPE | ✓ (turned 20°) | |
| MOM → DAD | ✓ (turned −20°) | |
| Pebble → HAPPY | ✗ | 1444 mm |
| Heart → NICOLAAS | ✗ | 1263 mm |

**Word to word works with solid letters**, because each letter mostly turns into the letter in its place. A long
word from a simple shape still fails, filled or not.

**What it shows:**
- **More height helps a lot** where the change is mostly *how far* the wall goes (pattern growth, a 4-letter word from
  a shape): 125 mm gives 400 layers to get there.
- **It doesn't help where the wall would have to cross itself.** That happens with long words from a shape, word to
  word with slit counters, and two different patterns. The pairing sends neighbouring parts of the wall to far-apart
  places, the keep-apart repair runs out of room, and the walls meet (closest 0.01–0.12 mm). No height fixes that.
- **The shape at the bottom matters more than its size.** The heart, star and pebble make LOVE where a circle can't,
  because their lobes give the letters somewhere to start from.

### A second way to morph: blending distance fields

Each layer is the contour where a blend of the two shapes' distance fields crosses zero. Walls can never cross,
because each layer is a contour of one smooth field. A prototype measured the step between layers, with the layers
spread to where the outline changes most:

| Morph | Pieces mid-way | Height it needs | Biggest jump |
|---|---|---|---|
| Moore 3 → Moore 4 | 1 | 50 mm | 0.26 mm ✓ |
| LOVE → HOPE (a shared baseline bar) | up to 5 | 69 mm | 0.99 mm |
| MOM → DAD (bar) | up to 6 | 92 mm | 3.99 mm |
| Moore 3 → Labyrinth 8 | up to 12 | 105 mm | 3.7 mm |
| Pebble → LOVE | up to 4 | 130 mm | 1.43 mm |

- **The total travel fits in 125 mm for all of them.** What stops them is **topology**: mid-way the outline splits
  into pieces (and holes) and joins again, and where it does, the wall jumps further than a layer can step. Swelling the
  shape mid-way made it worse (more holes).
- **The fix to try:** keep every layer one outline the way the morph font keeps every letter one outline. Join pieces
  with a neck, open holes with a slit, and do it on every layer from the layer below, so the necks and slits move
  smoothly rather than jumping.

### The plan for the morph

**M1, big morphs in the app (small, from what works now):**
- Height up to 200 mm. Check budget scaled to the size; the check runs on its own worker so the page stays usable.
- A **Pattern** as the bottom or the top: Moore, Spiral and Labyrinth, with their own settings. *Same pattern, finer*
  and *same pattern, more twist* are the reliable ones; the check says when another pairing will work.
- **Words of up to 4 letters** at the top from a shape or a pattern, 125 mm tall. The check warns about longer words
  and gives the height they'd need.
- **Word to word** (the same number of letters, up to 4 or 5) with **Solid letters**: a switch in Top that fills the
  counters. LOVE → HOPE and MOM → DAD print at 125 mm.
- The 3D preview of a 125 mm morph keeps a lap budget (it already skips the preview repair above 2500 points).

**M2, the distance-field morph (research, then build if it works):**
- Per-layer topology control: one outline every layer (necks, slits carried up from the layer below).
- Trials: LOVE → HOPE, MOM → DAD, Moore → Labyrinth, pebble → HAPPY, heart → NICOLAAS, all at 125 mm. Pass means:
  - one outline every layer;
  - no step past the hold;
  - nothing closer than 0.9 spacings.
- If it passes, it becomes a third **Pair** choice in Change (Corners, Even, **Melt**), picked automatically when
  Corners fails.

**M3, long words:** a word of 5 letters or more out of a shape. That depends on M2. A middle step to try first: a
morph in two stages, shape → the word's silhouette (its letters as one blob, which is a shape-to-shape morph) →
the word (a melt from its own silhouette, which has nothing to split).

### Words over two lines (Nicolaas: "the letters on multiple lines should touch")

Two lines, centred, the second's capitals just overlapping the first's baseline (line spacing 0.98 × the letter
height), so the letters meet and the word is one block. 125 mm tall:

| Morph | Lines joined by a bar | Touching | Touching, solid |
|---|---|---|---|
| Heart → LO/VE | ✓ | ✓ | |
| Pebble → HAP/PY | ✗ | ✗ | ✓ |
| Heart → HAP/PY | | | ✓ |
| MOM → HAP/PY | | | ✓ |
| Heart → NICO/LAAS | ✗ | ✗ | ✗ |
| Square → HAP/PY | ✗ | ✗ | |
| Pebble → CHE/ERS, THA/NKS | | | ✗ |

So two touching lines with solid letters take **5 letters** (one line: 4). 6 fail.

### M1 as built (v184)
- **Letters**, Top: up to 4 on a line; a "/" starts a second line, touching the first, 5 in all. A word raises the
  height to about its width (60–150 mm) and grows a small bottom to about the word's size.
- **Solid letters**: every counter filled.
- **Letters at the bottom** (Bottom): for word to word, at the top's size, lettering and solidity.
- **Patterns** in the Bottom and Top shape grids: Moore coarse, Moore, Moore fine, Spiral, Spiral twisted
  (`UNB.MORPH_PATTERNS`). The end a pattern is at is made at least its width (40–72 mm) so its channels print.
- The check's time budget grows with the morph (20 s at 20 mm, up to 3 minutes).
- Labyrinth left out: it didn't morph into anything but itself at 125 mm.
