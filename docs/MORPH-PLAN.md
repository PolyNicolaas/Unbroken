# The morph: one shape at the bottom, another at the rim · plan and trials (26–27 November 2026)

Two new kinds of print from the "what can't we design yet" list. **Not built yet:** this waits for Nicolaas to read it and
say go. It's written against v175 (`source/engine/17-vase.js`, `05-fill.js`, `12-models.js`;
`web-app/features/vase/vase.js`).

---

## Part A · Morphing lofts: one shape at the bottom, another at the rim

### What's there already
More than it looks. A vase already has `planTop`. The wall blends from `plan` at the bottom to `planTop` at the rim
(`planPoint` in 17-vase.js), and `twist` turns the whole shape as it rises. The **At the rim** row in the Vase panel
offers Same, Circle, Polygon, Star and Flower. So a star-into-a-circle cup can be made today.

### What's missing
1. **The rim can't be a drawing.** The bottom can be a trace (*Make a vase from this line*), but the rim only takes
   the built-in shapes. That rules out a heart that turns into initials, or a logo mark that turns into a circle.
2. **How points pair up.** The blend pairs points by share of the way round, both counted from where the shape
   crosses +x. That works for a star and a circle, but two drawings pair up badly: a heart's dip lands halfway along a
   letter's side, and the middle laps twist and pinch.
3. **When the change happens.** The blend is a straight line from plate to rim. You can't keep the bottom shape for
   the first third and then change.
4. **Nothing checks the laps in between.** Halfway between two very different shapes, a lap can cross itself, or two
   parts of it can come closer than a bead apart (they'd merge). The overhang check covers the slope but not these.

### The flow (push, as decided on 12 November)
1. Trace the bottom shape → Line step → **Make a vase from this line** (as today).
2. Trace the rim shape (a new picture, text or pattern) → Line step → **Use as the rim shape**. This button shows only
   while there's a vase. It copies the line's loop into `planTop` the way `vaseFromLine` does for `plan`: exact for a
   closed line that doesn't cross itself, the outline for anything else. The vase keeps its own copy, so tracing
   something else afterwards doesn't change it.
3. Vase panel → **At the rim** shows *A drawing* (selected), alongside the built-in shapes. Picking another shape
   replaces it; Undo brings it back.

### The panel: three additions to the shape section
| Control | What it does |
|---|---|
| **Blend** (a curve, the strength-curve editor reused) | How far the change has got at each height. The default is straight. Flat at the start keeps the bottom shape for a while; an S shape changes in the middle. Stored as `V.blend: [[t, k], …]`, read by `UNB.vaseStrength` |
| **Match**: Corners / Even | *Corners* (the default for drawings) pairs corners with corners and dips with dips. *Even* is today's pairing by share of the way round (kept for the built-in shapes, which pair well that way) |
| **Turn rim shape** (a dial, −180° to 180°) | Turns the rim shape against the bottom one, for when the automatic line-up isn't the one you want |
| **Route**: Direct / Through round | *Through round* goes bottom shape → circle at half height → rim shape. Each half is then a shape blending with a circle, which hardly ever pinches. This is the fallback when Direct can't print |

With **All settings** off, Match, Turn and Route show only when the rim is a drawing.

### Engine
- **`planTop` takes `kind: "drawing"`.** `planTable` already builds a drawing's table, so the rim just stops being
  limited to the built-in shapes.
- **Line-up (`UNB.vaseMatch(A, B)`):** both tables are resampled to the same count. First, the best rotation of B
  against A, found by trying 720 starting offsets (with the Turn dial added on top). Then, for *Corners*, a warp from A's
  share round to B's: dynamic time warping on the two shapes' turning angle (the curvature along each), kept inside a
  band so it can't wander more than a fifth of the way round, and smoothed so the step from one point's partner to the
  next stays even. The result is a lookup `s → s′`, cached by both tables' keys like `planCache`.
- **`planPoint(A, B, s, t)`** reads B at the warped share, and `t` comes from the Blend curve instead of z/H. Through
  round inserts the circle as B at t = 0.5 and A′ = the rim above it.
- **Checks (`UNB.vaseLoftCheck(V, opt)`):** sample one lap every 0.5 mm up the wall and report:
  - *crossings*: a lap that crosses itself (segment grid, `cellGrid`);
  - *pinches*: two parts of a lap closer than the line spacing that aren't neighbours along it;
  - *overhang*: as now (the step from the lap below, against the overhang already set).

  These go into `vaseStack`'s result next to `overhang`, and into the Print step's ready list. The 3D preview marks
  each failing height in **amber**, the same way the relief inset does.

### Things to know
- **Lap length changes with height** (a circle into a word's outline can be four times as long). The minimum layer
  time already slows short laps; long laps are just slow. The readout should show the longest layer's time.
- **Text as the rim** works only when the trace is one closed line that doesn't cross itself, which a traced word
  usually is. Its narrow channels become pinches part-way up unless the blend keeps them a spacing wide. That's
  exactly what the check is for. If it fails, Through round or a bolder font are the fixes.
- **Reliefs and textures** keep working: they're added on top of the wall wherever it is.

### Tests
- **E68** (engine): a heart → a circle, a heart → a traced "N", and a star (5) → a flower (5).
  - With Corners, each of the heart's two lobes pairs with its own side (not both with one).
  - No lap crosses itself; the narrowest pinch is reported correctly against a hand-made case.
  - Through round gives no crossings for the heart → "N" when Direct does.
  - Blend flat to 0.3: laps below 30% of the height match the bottom shape within 0.05 mm.
- **A79** (app): trace → Make a vase; trace text → Use as the rim shape; the panel shows A drawing; Match, Turn and
  Route change the preview; Undo restores the previous rim; the ready list lists a pinch when one is forced.

---

### Trial results (26 November 2026, branch `morph`, engine only)

Nicolaas chose to focus on the morph. The engine trial is in 17-vase.js on the `morph` branch (not published). All
engine tests still pass.

- **Four ways to pair the shapes were tried**, each on heart → circle, heart → star, star → flower, heart → a traced
  "N" and heart → a traced "NV":
  - *Even* (today's): twists, and crosses itself on letters.
  - *Through round*: a fat circle in the middle that doesn't look like either shape, and it still crossed. Dropped.
  - *Melt* (blending the two shapes' distance fields): the smoothest middle laps, but holes open and close between
    the letters, so the lap jumps; those laps can't stand on the ones below. Dropped.
  - *Corners* (dynamic time warping on position and turning angle): the best middle shapes. On its own it still
    crosses at serifs and thin parts.
- **Corners + keep apart works.** Each lap that crosses itself or pinches is untangled and pushed apart to the
  spacing with the trace's own tools (`UNB.uncross`, `UNB.enforceSpacing`). The lap is first resampled evenly, because
  the spacing tools count neighbours in points. Result: no lap crosses, the closest parts are ≥ 1.27 mm (spacing
  1.34), and layer-to-layer steps are mostly within the 0.28 mm hold. It takes about 0.6 s for a 30 mm vase.
- **The lap's points follow both outlines.** They're spaced evenly in (bottom share + rim share) / 2, so a letter's
  detail isn't cut short where it's paired with a short stretch of the other shape.
- **Which way up matters** (Nicolaas): circle → NV steps inwards 0.79 mm too far near the top, while NV → circle is
  within 0.04 mm of the hold. Heart ↔ NV both pass. So the app should work out both directions and say which prints
  better. There are also print reasons the numbers don't show: a letter outline as the first layer has small parts
  that have to stick to the plate, and letters at the rim are what you read from above.
- **Fonts** (Nicolaas: "we might have to invent a font"): most of the laps that need fixing are at serifs and thin
  joins. A rim word works best as one closed outline with no serifs, strokes at least two spacings wide, round
  corners, and counters opened to the outside (a single wall can't hold a hole). Such a font can be made from the
  existing single-line fonts by thickening each stroke and joining the letters into one outline.

### The morph font (trial, 26 November 2026)

Nicolaas: the inside and outside of each letter must be one continuous line, and every letter must connect to the
letter before and after it. Start from the Chocolate font, since it's unique to Unbroken.

**How it's made:**
1. Lay out the text in the Chocolate font with the letters joined along the baseline (`UNB.textLayout`, `join`).
2. Thicken every stroke to 2.2 spacings.
3. Join any loose pieces.
4. Deal with each counter. One too small to print round is filled; the others get a slit (1.15 spacings wide) to the
   outside, by the shortest way, preferring the bottom.
5. Round the corners.
6. Take the outline.

That's repeated twice, because rounding can close tiny new holes. The prototype is in `proto/wordshape.js`.

**Result:** every word tried, plus the whole alphabet (upper and lower case) and the digits, comes out as exactly one
closed outline. That takes 0.1–0.7 s a word.

**In a morph:**
- heart ↔ NV: both ways work.
- Happy → heart: nearly works (steps 0.08 mm past the hold).
- heart → Happy and heart → BOAT: fail. A long, detailed word outline paired with a simple shape leaves many thin
  fingers in the middle laps.
- So the direction matters a lot, and words need another route. The idea: morph to the word's silhouette (the word
  with its notches closed) first, then let the letters' notches grow in from the edge (a distance-field melt, which
  has no holes to jump over between a shape and its own silhouette).

**Version 2 (capitals and limited punctuation, as Nicolaas asked):**
- **The letters themselves.** The Chocolate glyphs are choc OS print paths, hairline outlines of solid letters, so
  they aren't thickened. They're drawn on a fine grid (0.06 mm) and flooded from outside, and whatever the flood
  can't reach is the letter. That keeps choc OS's letter shapes and stroke width.
- **Counters.** They get a straight slit (1.2 spacings) where choc OS's own thin opening meets the outside, to the
  nearest point of the counter. If that doesn't open it, they get the shortest slit instead.
- **Joins.** Letters are joined left to right by a 1.5-spacing neck kept as low as possible, near the baseline. Dots
  and the tops of "!" and "?" are joined straight down. Joins run again after rounding, in case rounding splits a
  letter.
- **Punctuation.** "." and "-" are drawn by Unbroken, because the Chocolate font's "." is empty and its "-" is a
  full-height block. "!", "?" and "," come from the font.
- **Result.** A–Z on their own, plus HI!, WHY?, YES, NO., X-RAY, DON'T, BOAT and NV, each come out as exactly one
  outline.
- **Still open.**
  - A space becomes a long bar along the baseline.
  - The apostrophe joins to the letters beside it at the top.
  - The O in DON'T opens to the left, into the D.

**Decided (Nicolaas, 26 November):** no spaces and no apostrophe in the morph font; morph words get a strict
character limit; check which way up is cleaner.

**Sweep (`source/bench/morph-trial/sweep.js`).** Every capital letter and 22 words of 2–6 letters were tried as the
rim of a heart and of a circle, both ways up. Words were made at most 50 mm wide. A morph passes when:
- no step between laps is more than 0.03 mm past the 0.28 mm hold;
- no lap's parts come closer than 0.9 spacings;
- no lap had to be moved more than 2 spacings.

| Characters | Circle: either way up | Heart: either way up |
|---|---|---|
| 1 | 25 of 26 | 22 of 26 |
| 2 | 3 of 4 | 1 of 4 |
| 3 | 1 of 5 | 1 of 5 |
| 4–6 | 0 of 13 | 0 of 13 |

- **Which way up.** Single letters are about even. Words pass more often with the word at the rim: 5 times that way
  against once the other way.
- **The limit with this pairing.** One character works reliably (a monogram), and two sometimes. Longer words need
  the silhouette route.
- **Letters that fail.** With a heart: B, E, F and P. With a circle: G one way up.
- **A bug.** The engine's step measure (`vaseStacking`) searches only near the same share of the lap below. After a
  lap is untangled, that share no longer lines up, so it reports steps of 30 mm or more. A search of the whole lap
  below gives 1.6–7.5 mm for the same failures: still failures, but the measure must search the whole lap.

**Version 3 (Nicolaas: a better morph font; capitals plus ! and ? only):**

Each glyph was scored as the rim of a circle and of a heart: 30 mm tall, 0.3 mm layers, spacing 1.34 mm, hold
0.28 mm.
- **The font's own settings barely matter.** Weight, slit width and rounding were tried in 12 combinations. The same
  letters failed every time (B, E, F and G, sometimes O, P and S), so the fixes are per letter.
- **G is redrawn:** the C with its lower end turned up into a short upright, with no crossbar into the bowl. The
  inward hook was what tangled. It now passes both shapes.
- **B is fixed in the pairing.** The warp's offset is now smoothed over 2/15 of the way round (it was 1/20). That's
  the engine default now, and the engine tests still pass.
- **E and F need a turn against a heart.** Turning the letter 20° clears both. Pairing settings didn't help them.
- **The step measure is fixed.** For a morph it now searches the whole lap below, so the earlier 30 mm readings are
  gone.

**Result:**
- **Against the circle**, all 28 glyphs pass straight.
- **Against the heart**, 26 pass straight, and E and F pass turned 20°.
- **Best of 0° and ±20°**, every glyph passes against both shapes.
- **Letter on the plate instead of the rim** is worse (22 of 28 against the heart), so the letter goes at the rim.

**Two letters:** about half pass for a given shape, even with turns. NV, IT, MA and JO do; GO, ED, AL and OK don't.
So the limit is **one character**. Two characters only if the check passes for that pair and shape.

**How tall (26 November):** best of turns 0° and ±20°, letter at the rim.

| Letters | Morph height | Circle | Heart |
|---|---|---|---|
| 20 mm | 25 mm | 28 of 28 | 28 of 28 |
| 20 mm | 20 mm | 28 of 28 | 28 of 28 |
| 20 mm | 15 mm | 21 of 28 (fails B D P Q R U W) | 28 of 28 |
| 20 mm | 10 mm | 4 of 28 | 23 of 28 |
| 12 mm | 12 mm | 14 of 17 | 16 of 17 |
| 12 mm | 10 mm | 10 of 17 | 15 of 17 |

- **The rule:** the morph needs about as much height as the letter is tall. Each layer can step only 0.28 mm, so the
  wall needs enough layers to travel from the shape to the letter.
- **The circle needs more height than the heart.** It sits further from the letter's notches, so the wall has
  further to travel.
- **A bug at small sizes:** at 12 mm the font fails to make an outline for 11 glyphs (C G H I J O P S U ! ?). It has
  to be fixed before small pieces about 10 mm tall can work.

**Decided (Nicolaas, 26 November):**
- A morph made from the font starts 20 mm tall. That's fine for 20 mm letters out of any shape.
- When a morph is too short to work, the app says so (in the ready list, with the height that would work). It
  doesn't block or change the height on its own.

**Other shapes (26 November):** square, hexagon, five-point star and five-petal flower; letter at the rim, 20 mm
tall.
- **A bug.** A vase pushes points closer than 1 mm to the middle out to a 1 mm circle. Drawings were exempt only
  when the *bottom* was the drawing. With a built-in shape at the bottom, half the letters failed. It's fixed: a
  drawing at either end is now followed exactly.
- **After the fix, with turns 0° and ±20°:**

  | Shape | Pass |
  |---|---|
  | Square | 27 of 28 (G fails, O needs a turn) |
  | Hexagon | 28 of 28 |
  | Star | 27 of 28 (G fails) |
  | Flower | 28 of 28 |

- **Fixing G:** with ±45°, 90° or 180° added, G passes every shape. The shape's size against the letter (0.8–1.1)
  made no difference.

**More shapes for letters (27 November):** triangle, pentagon, octagon, 4-, 6- and 8-point stars, and 3-, 4-, 6-
and 8-petal flowers.
- Every glyph passes every one of these shapes with some turn.
- 24 to 27 of 28 pass straight on each shape. All 28 pass within ±20° on all but three of the shapes.
- G needs 45° on the 4-point star and the 3- and 4-petal flowers.

**Shape to shape:** 16 shapes (all of the above, circle, square, hexagon, 5-point star, 5-petal flower and the
heart), every ordered pair (240), with even pairing against corner pairing.

| Test | Even, straight | Corners, straight | Either, with ±20° |
|---|---|---|---|
| 20 mm tall, same size | 240 | 240 | 240 |
| 10 mm tall, same size | 215 | 219 | 226 |
| 20 mm tall, rim twice as wide | 211 | 217 | 225 |

- **Corners is never worse than even.** It's better in 11–14 pairs, so it can be the pairing for every morph, not
  only drawings.
- **What fails is too little height for the change.** At 10 mm the failures all involve the heart (its point and
  dip have far to go). Growing to twice the width, the failures are from the triangle (its sides sit at half its
  reach) and from the heart to round shapes.
- **The too-short warning covers these.** Steps scale with 1 ÷ height, so the height that would work is about
  height × worst step ÷ hold.

**Patterns (27 November):** the patterns that make a closed outline not crossing itself are the labyrinth, the
Moore curve and the spiral. Hilbert, Gosper and waves are open lines; spirograph, rose and Lissajous cross
themselves.
- **40 mm wide, 20 mm tall:**
  - Moore: works with the square (20° turn), flower, star and N, both ways up.
  - Labyrinth: only at detail 4, and only into the flower and star.
  - Spiral: fails.
- **80 mm wide, 40 mm tall:**
  - Moore: works with the square and the flower.
  - Labyrinth (detail 4): only with the flower.
- Like words, patterns are long outlines with many narrow channels. The Moore curve (angular, even channels) is the
  friendly one.

**Bigger words (Nicolaas: they can be bigger, maybe more letters):** 35 mm letters on a 35 mm tall morph, out of a
circle and a square.
- **Without counters**, words nearly pass: AL 0.03–0.09, NV 0.06–0.2, MOM 0.17–0.47 (badness).
- **With counters**, words fail badly (8–12): GO, OK, ED, DAD, LOVE, JOY.
- **So the slits block multi-letter words, not the size.**
- **With counters filled** instead of slit:
  - OK, DAD, LOVE and MOM drop to 0.08–0.45, just over the hold. They'd likely pass at about 1.3× the letter
    height.
  - JOY passes out of the square.
  - GO, ED and BOAT still fail.
  - The trade-off: filled counters read by silhouette only (O is a solid disc).

**Decided (Nicolaas, 27 November):** the morph font is **one character only** (A–Z, ! and ?). Multi-letter words
(a word mode with filled counters, or another route) are a later project.

**For the app:** try turns 0°, ±20°, ±45°, 90° and 180°, in that order (the smallest that works). On a symmetric
shape a big turn only changes which side the letter faces. On a heart it tilts the letter against the heart, but
there 0° and ±20° are enough.

Previously: try turns 0°, +20° and −20° (and the other way up), and keep the first that passes. Show the turn it
needed.

## Evaluation

**What works well**
- Both reuse what's there. A is mostly `planTop` taking a drawing plus a better pairing. B is new loops fed into the
  bridging that already keeps fills one line.
- Both are things only printing makes: a shape that changes up its height, and cells inside a solid piece.
- Honeycomb is low-risk for the printer: no overhang, no bridging when the top is open.

**What I'd watch**
- **A's middle laps** are where it can go wrong. The checks and Through round are the safety net, but very different
  shapes (a round heart and a spiky word) may just not loft well. That's a limit of the method, like some 3D shapes.
- **B's lids** depend on how far chocolate bridges, which we don't know yet. Run the bridge strip before building lids.
- **Is the inside worth it if nobody sees it?** Open tops (filling cups) and broken pieces show it off; a closed lid
  hides it. That might mean starting with open honeycomb only.
- **G-code size:** gyroid loops on every layer add points. Watch the file size on a big piece (as with big reliefs).

## Questions for Nicolaas
1. For A: is *Use as the rim shape* from the Line step right? Or should the vase hold a short list of shapes at
   different heights (bottom, middle, rim), which is more power but more panel?
2. For B: open-top honeycomb first (filling cups, no bridging), then gyroid and lids after the bridge strip? Or
   everything together?
3. Should built interiors also work for a vase from a closed trace (a thick-walled solid piece), or only for models
   and traced designs with walls?

## Suggested order
1. **B1:** Honeycomb, open top. Engine, card, E69's honeycomb part. A test print: a honeycomb heart cup.
2. **A1:** The rim as a drawing, plus the Blend curve (with Even pairing). That already makes heart → circle.
3. **A2:** Corners matching, the checks with amber marks, Through round.
4. **B2:** The bridge strip. Then Gyroid, Firm edge, lids and the ramp under them.
5. Docs (README Infill and Vase sections, ROADMAP, CHANGELOG) at each step.

---

## What was built (v176, 27 November 2026)

- **Engine** `source/engine/20-morph.js`: `UNB.morphPair` (corner pairing), `UNB.morphKeepApart` (untangle, keep a
  spacing apart, round turns tighter than 0.36 of the spacing), `UNB.morphLetter` (the morph font: capitals, ! and ?),
  `UNB.morphCheck` (turns 0°, ±20°, ±45°, 90°, 180°, the other way up, the height that would print). The vase
  (`17-vase.js`) reads it only when the rim shape asks (`planTop.match`, `planTop.keepApart`), so a vase without them
  is as before (E68 checks it).
- **App** `web-app/features/morph/morph.js` (a feature: `?off=morph`): Letter and Drawing at the rim, Use as the rim
  shape on the Line tool, Letter size, Change starts / ends (the vase's `blend`), Pair the shapes, Turn the rim shape
  with Auto, the verdict in the panel and the ready list, Turn it over. The check runs in its own background engine,
  so the shared engines' cancellations don't stop it.
- **Where the build went another way from the plan:**
  - Through round and the melt were dropped after the trials.
  - The Blend curve is two sliders, Change starts and Change ends, not a curve editor.
  - Corner pairing is used for every rim shape, since it was never worse than even.
  - Turns tighter than half a bead are rounded off on the morph's laps: 74 of 112 letter morphs had them, 29 after.
- **Tests:** E68, A79; A61's record has the morph switching off clean.
- **Part B** (built interiors) stays a plan, in the Project's `claude/loft-and-interior-plan.md`.

## v177 (27 November 2026): the morph as its own design

Nicolaas asked for all of the morph's settings in one place, with shape to letter first and the vase left as vases.
- **Make a morph** (3D model card) and **Make a morph from this line** (Line tool: a drawn or imported shape, traced,
  at the bottom) make one. The rail says **Morph**, with Bottom, Top, Change, Profile and Rim, and no Texture or
  Movement.
- A vase's Shape tool no longer has a top shape while the morph is on.
- **Fixed resets.** A shape at the top after a letter kept the letter's outline, so the letter came straight back.
  A letter after a shape started over at 20 mm. Now the top's own data is cleared when it becomes a shape, and only
  making a morph sets the height.

## v179 (27 November 2026): shapes and lettering

**Shapes.** Nicolaas asked for lots of basic shapes for the top or the bottom, clean, not all symmetric, and went
over each with three versions to choose from (drawings: `source/bench/morph-trial/shapes/`, `approved.json`).
- **Kept:**
  - The hand-drawn heart, the pebble and the tall-puff cloud.
  - The soft six-tooth gear, the gem, the chunky plus and the rainbow.
  - The bell with a clapper, both trees (round, and the simple fir) and a crescent.
  - The chunky bolt, the boxed speech bubble and the chubby star.
  - Asked for after: a square, a triangle, a pentagon and a hexagon, with 2.5 mm corners.
- **Left out:** the egg, drop, leaf, bean, shield, house, apple and fish.
- **The moon** was tried as a set from sliver to full, in true phases. The simple crescent was kept.

**Lettering.** The aim was a fancy font, likely made for the job. The trials are in `source/bench/morph-trial/fonts/`:
`sheet.js` shows the letters, `sweep.js` runs the check.
- **Made from our own single-stroke fonts, with a broad nib (failed).** Roman with serifs, an italic, a Didone with
  ball ends and a script.
  - The morph rounds anything thinner than about two lines (3 mm at a 20 mm letter, 110 of 700 font units) away.
  - With the thinnest stroke held at 3 mm, a broad nib leaves almost no thick and thin.
  - The single-stroke outlines are too coarse, so the letters came out lumpy.
- **Display fonts, drawn heavier (worked).**
  - Each was drawn heavier all round until its hairlines print.
  - Every closed counter got a hairline cut to the outside, the shortest way, going down preferred. The morph
    straightens it into its slit, as it does for choc OS's own openings.
  - Each was then traced back to outlines.
- **Eleven display fonts tried (OFL, from npm @fontsource):**
  - **Lobster** (script) and **Playfair Display Black** (serif) were the clean ones.
  - **Cinzel Decorative** swaps in ornate letters (its H, I, B, G).
  - **Berkshire Swash** lost N and Y.
  - **Abril Fatface** filled its counters.
  - **Rye** is rough and lost its Z.
  - **Pacifico**'s P came out solid.
  - **Yeseva One** is close to Playfair.
  - **Fascinate**, **Sancreek** and **Lilita One** look odd, have a broken Z, or are too plain.
- **The check, letters 20 mm tall on 20 mm morphs:**

  | Font | Pebble | Heart | Square | Star |
  |---|---|---|---|---|
  | Lobster | 27/28 (G) | 28/28 | 28/28 | 28/28 |
  | Playfair Display | 26/28 (C, G) | 28/28 | 28/28 | 28/28 |
  | Cinzel Decorative | 28/28 | 28/28 | 28/28 | 28/28 |
  | Rye | 25/27 (L, ?) | 26/27 (L) | 25/27 (L, ?) | 25/27 (L, ?) |

- **Shipped:** **Swirl** (from Lobster) and **Grand** (from Playfair Display). Both reserve their names, so the
  changed versions have new ones.
