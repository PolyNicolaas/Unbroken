# Changelog

One entry per published version, newest first. The build reads the version from the top heading and shows it next to
the page's title (it shows "dev" when the page runs from the source folder). Add the next heading before building.

## v119 · 2026-10-29

- **A shorter Print step**: Printer, Plate, Layers and Export, then **More print settings** (Base, Infill,
  Fine-tuning, Test print, the printer profile) folded away under one button, remembered in this browser. A link to
  one of them (the ready list) opens it.
- **No doubled start**: while the app is empty, the Input card shows only what to start from (the preview has the
  examples, Take a picture and the file choice).
- **The play speed is in the View menu**: the toolbar has Trace, Play, Undo / Redo, File and View.
- **A printer's Line step has no Line card**: a printer makes one continuous line, so there's nothing to choose (with
  Trace off it shows, to say so).
- Tests: A38 checks these; A12, A22, A33 and the tests that start empty follow them.

## v118 · 2026-10-29

- **A molecule prints in pieces** (Print step, Plate card: Molecule, Bonds and labels apart, the default): the bonds
  print as one continuous line, then each atom's letters (N, O, NH, OH …) as a small piece of its own, in their places,
  so no connector strand runs from a label to the bonds. The pieces keep their places on the plate (copies are whole
  molecules), and the G-code prints them one after another. One piece prints it all as one line, as before; the Line
  step still shows the one joined line.
- Engine: `UNB.plateLayoutPieces` packs pieces together (`together`); `UNB.molecule` says which strokes are bonds and
  which a label's. Tests E31, A40.
- Fixed: tracing pieces before the line had a size could stop the layers' engine.

## v117 · 2026-10-29

- **The structure editor** (Molecule card, Draw or edit…): draw a structure by hand, or change the one shown, on the
  preview (full screen on a phone). Tap a space to place a carbon; drag from an atom to draw a bond (at 30° steps,
  onto another atom to join them); tap an atom to grow the chain the free way; tap a bond to make it double, triple,
  then single again. **Benzene**, **Ring 6** and **Ring 5**: tap a space, an atom (the ring hangs off it) or a bond
  (fused on it; an aromatic ring's double bonds go where there's room). The element strip (C N O S P F Cl Br I) makes a
  tapped atom that element; + and − add a charge. Hydrogens follow the bonds and charges. **Erase**, **Undo**
  (Ctrl/⌘ Z), **Clear**; **Clean up** lays it out again tidily with RDKit and gives its SMILES. **Use it** makes it the
  Molecule input; Cancel leaves the molecule as it was. The search button is Look up now.
- Engine: `UNB.molGrow`, `UNB.molRing`, `UNB.molCycleBond`, `UNB.molSetAtom`, `UNB.molErase`, `UNB.molHydrogens`,
  `UNB.molHit`, `UNB.molBlock` (16-molecule.js). Tests E40, A41.

## v116 · 2026-10-29

- **Molecule**, a fifth input on the Art step (experimental): a chemical structure drawn as a skeletal formula. Bonds
  as lines (double and triple bonds as parallel lines, a ring's double bonds inside the ring), carbons implied, every
  other atom as its letters with its hydrogens on the side away from its bonds (OH, HO, NH₂, H₂N), charges. Type a
  SMILES (CCO, c1ccccc1) or a name (caffeine): names are looked up on PubChem, and RDKit, the chemistry toolkit, lays
  it out, loaded from a CDN the first time (about 7 MB; both need the internet). Eight examples come laid out already
  and work offline: Theobromine (chocolate's own molecule, also on the start page), Caffeine, Vanillin, Aspirin,
  Dopamine, Serotonin, Capsaicin, Benzene. Like text and patterns it's exact lines: plotted as drawn with Trace off (a
  pen plotter starts that way), or traced into one line for chocolate; its bonds start long enough that a double bond's
  two lines are the line spacing apart. Saved with the design.
- Engine: a new part, `16-molecule.js`: `UNB.molecule` (atoms and bonds → strokes) and `UNB.molFromRDKit`. Tests E39,
  A40. Next: a structure editor (docs/CHEM-PLAN.md).

## v115 · 2026-10-29

Laptop and iPad first.
- **A slim top to the settings.** What it's for (a printer or a pen plotter) and the three steps are two slim rows, and
  the settings Wheel, Collapse all and Expand all are in the View menu: the cards start about 120 px higher on every
  step.
- **Export in the Next bar** on the last step: Export G-code (Print) or Export SVG (Plot), one tap away however far
  down the settings you are. The Export cards keep their options.
- **The trace's tools on the Line step only** (Select area, Erase, Set start, Draw, Crossing areas, Connector paths);
  the Art step's preview has just the toolbar.
- **Notices can be put away**: a × on the Printer card's "New." note, and it stays away.
- **A bigger preview on laptops**: on wide screens the page uses up to 1760 px, the preview takes the room, and it stays
  inside the window's height.
- Tests: A38 checks all of these; A12 and A34 follow the View menu.

## v114 · 2026-10-29

- **Cut out the object** (Image prep, Select the object): drag a box round the thing you want on the preview. What's
  in the box that looks like what's around it (the floor it stands on, the wall behind) is removed and the rest is the
  object; everything else is white paper before Grey levels and the trace. Then paint **Keep** over parts that went
  missing, or **Remove** over what isn't the object (a shadow, a bit of floor). Undo, Start over, and Remove the cut-out
  in the card. The cut-out is kept with undo and design files, and goes when another picture is used. On a phone the
  preview goes big to draw on.
- Engine: a new part, `15-cutout.js`: `UNB.cutout` (GrabCut: colour models of the object and its surroundings, then the
  cheapest cut between them along the picture's edges, a max-flow, four rounds; in its own worker). Tests E38, A39.

## v113 · 2026-10-29

- **Picture prep is on the Art step.** Image prep (brightness, contrast, background, lighting) and Grey levels change the
  picture, so they sit under the Picture card now; the Line step is only how it's traced (The line, Tracing, Line,
  Size, Fit). With Trace off the preview shows the picture as Image prep and Grey levels make it.
- **A Next bar** pinned at the foot of the settings replaces each step's Next card: Next: the line → on Art, ← Art and
  Next: print it / plot it → on Line, ← Line on Print or Plot, with a note on what the next step does. Always in reach
  on an iPad, however far down the settings you are.
- **Fewer small cards.** The Photo settings are part of the Picture card. Once something is in, the examples are one
  row that scrolls sideways. The suggestion box is put away: File → Suggestion box… opens it (Close puts it away).
  On a phone the toolbar's Play drawing reads Play, so the Trace switch, File and View fit.
- Tests: A38; A12, A19, A20, A32 and A36 follow the new places.

## v112 · 2026-10-28

- **The Trace switch**, under the preview on every step: tracing on and off in one place. On, the art becomes the line
  the Line step picks (one continuous line, or separate strokes on a pen plotter). Off, the art is left as it is: a
  pattern or text plots as its exact lines (the Line card's As drawn is gone: it's Trace off now), and a picture shows
  as the picture, so nothing re-traces while you adjust it. The Print step, or plotting a picture, needs the line: with
  Trace off they say so, with a Turn Trace on button. On a plotter a pattern or text still starts with Trace off. A 3D
  model is always sliced (the switch stays on). Designs saved As drawn open with Trace off.
- Tests: A37; A31, A32 and A33 follow the switch.

## v111 · 2026-10-28

- **Page corners fixed on touch screens.** The photo now sits clear of the message and the buttons, so a corner on the
  photo's edge (no page found, Whole photo, an object) is never under them; before, the bottom corners sat under the
  buttons and couldn't be grabbed. Each corner has a fingertip-sized grab area, a press near a corner takes it, and the
  corner keeps its distance from the finger instead of jumping under it. On an iPad or iPhone a finger on the camera no
  longer scrolls the page, which could cancel a drag. The shutter says when the camera is still starting.
- Tests: A36 checks every corner on the photo's edges can be grabbed, and a drag that starts beside a corner.

## v110 · 2026-10-28

- **Take a picture.** A live camera in the preview (full screen on a phone): on an iPad or phone, photograph a drawing,
  a print or anything else. The page it finds is outlined as you hold the camera over it; the shutter keeps the frame,
  and the page's four corners can be dragged (or moved with the arrow keys) if one is off. **Use it** straightens the
  page (its perspective undone) and cleans it into the picture to trace; **Whole photo** skips the straightening. Pick
  **Drawing**, **Printed** or **Object** first. Take a picture is on the empty preview and the Picture card. Without a
  live camera (refused, or an old browser) the device's own camera or photos open instead, and the photo goes to the
  same corners.
- **The Photo card** cleans the photo again: **Drawing** evens out the paper's light (shadows and a lamp's falloff go),
  makes the paper white and the ink black, darkens faint pencil and removes specks; **Printed** does the same more
  gently and keeps the greys (for Grey levels); **Object** finds no page and balances and stretches the colours (tap the
  background in Image prep to remove it); **As taken** only straightens. Sliders: Even out the light, Darken faint
  lines, Remove specks. **Page corners…** reopens the corners. An image you chose can be **Clean up as a photo**.
- Engine: a new part, `14-photo.js`: `UNB.findPage` (the largest light, plain area, its corners made exact along each
  side's edge; a second look with the light divided out when the shade makes the page's far end darker than the
  table), `UNB.warpQuad`, `UNB.pageSize`, `UNB.photoClean`, `UNB.photoPicture` (in its own worker). Tests E37, A36.

## v109 · 2026-10-28

- **A clean start.** The app opens on an empty workspace: nothing traced, and the preview says how to start (drop,
  paste or choose a file). The **examples** are one tap away, as chips there and in the Input card: Leaf, Still life,
  Face, Shapes & text, Smiley, Labyrinth, Spirograph, Wave portrait, Lettering and the Vase. The Picture card's sample
  menu is gone. settings.js can still start on a sample (`defaults.sample`, now `"none"` by default), and so can the
  page's address (`?example=leaf`).
- Tests: A35; the app tests start on the leaf example (`?example=leaf`), as the app used to.

## v108 · 2026-10-28

- **Fills per grey** (Line step, Grey levels, making it for a pen plotter): a grey can be **Fill** (its blocks filled)
  or **Both** (traced and filled) as well as Trace or Skip. Each filled grey has its own style (hatch, cross-hatch,
  rings stepping in, or the Pattern card's pattern cut to the blocks), spacing (mm), angle and pen colour, and plots on
  its own pen, its own layer in the SVG. Darker greys start denser, neighbours at different angles. A grey that's filled
  but not traced still stops its fill at its edges. Fills draw with Separate strokes.
- **− and + on every number box**, finger-sized on touch screens; holding one repeats.
- **The preview stays in view** while the settings scroll: a sticky column on wide screens; on phones a compact preview
  pinned to the top (a third of the screen), with **Bigger** to see it in full with its tools.
- **The Wheel**: the settings turn like a drum. When scrolling stops, the card that reached the top opens and the others
  fold to their headers (with their readouts); cards further away tip back. The card stays where it landed. The Wheel
  switch (next to Collapse all) turns it off and puts the cards back as you left them.
- Engine: `UNB.levelFills`. Tests E36, A34.

## v107 · 2026-10-27

A simpler workflow (decided with Nicolaas, [`docs/WORKFLOW-PLAN.md`](docs/WORKFLOW-PLAN.md)):
- **Making it for: a printer or a pen plotter**, chosen first at the top (it replaces Made for). It decides the last
  step: the steps are now **1 Art → 2 Line → 3 Print** or **3 Plot**, never both.
- **The Line step has the one switch for tracing**: **One continuous line** (the Fourier trace; the only line a printer
  makes), **Separate strokes** (new: the art traced into strokes, the pen lifting between them) or **As drawn** (a
  pattern's or the text's own lines, nothing traced). On a plotter a pattern or text starts as drawn and a picture as
  separate strokes, until you pick. The cards the line doesn't use are hidden (no spacing, size or series for strokes;
  no tracing at all for as drawn).
- **The preview follows the step**: the art or the line on Art and Line, the page on Plot, the plate or the layers on
  Print (its only view switch). The Next card has one button per step (Next: the line → / Next: plot it → or print it
  →), and the 2D tab's Traced line / Art as drawn switch is gone.
- The tabs are steps in the app's text (the Line step, the Plot step, the Print step).
- Engine: `UNB.lineStrokes`, `UNB.stageStrokes`; `UNB.exportLayersSVG` notes how the lines were made. Tests E35, A33;
  the app tests reach Plot and Print through the new `plot` / `print` helpers.

## v106 · 2026-10-27

Usability fixes from a walkthrough of v105:
- **Made for Plotting now covers traced pictures too.** A traced drawing fills the 2D tab's page (inside the margins;
  **Fit the page** on the Size card puts it back after a size set by hand), and its lines are pen 1 + the gap apart
  instead of the needle's spacing.
- **A pattern that crosses itself, for printing, turns Allow overlaps on** (once per style, and the card says so): undoing
  every crossing was slow (47 s for the default Spirograph) and bent the pattern.
- **Grey levels have their own card** on the Trace tab, open; while they're on, the trace style and ink threshold (which
  they replace) are hidden.
- Size marks at the same width share one label ("smallest · medium · high") instead of printing over each other.
- Messages close when another tab opens, or on a click.
- A pattern plotted as drawn exports as e.g. `wave-rows-picture-art.svg`, not under the last traced picture's name.
- Base, Infill, Fit and the suggestion box start folded on a first visit (their headers still show what's set).
- Tests: A32 (page fit and pen spacing, the SVG name, overlaps for a crossing pattern).

## v105 · 2026-10-27

- **Made for: Printing / Plotting** (Art tab, Input). Plotting lifts the printing limits on the patterns (200 wave rows,
  200 spiral turns, order 8 curves, 120 labyrinth cells…), shows the pattern on the 2D page as it will be plotted,
  measures its closest lines against pen 1 instead of the needle, and traces only when you ask.
- **Grey levels** (Trace tab, Image prep): the picture as 2–6 flat greys, each traced (its edges become the line) or
  skipped; **Smooth blocks** removes specks and rounds their corners.
- **Tap the background**: removes the background from the point you tap, through every colour close to it.
- **Turn and straighten** the picture (Art tab, Picture card).
- **A still-life sample** in flat greys, for grey levels and the picture patterns.
- Engine: `UNB.levels`, `UNB.levelEdges`, `UNB.prep`'s `bgAt`, pattern settings' `plotMax`. Tests E34, A32.

## v104 · 2026-10-27

- **Many more pattern settings.** Every style now has its own settings, and the Pattern card builds them from the
  engine's list (a slider, a choice or a switch; some appear only with others). Going back to a style finds its
  settings as you left them.
  - **Spirograph**: the ring can be a circle, oval, stadium or a rounded triangle, square, pentagon or hexagon; ring and
    wheel teeth; the wheel rolls inside or outside; **Hole** is the pen's distance from the wheel's centre (past 100%
    it loops); an optional **second wheel** riding on the first (size, hole, direction); rotate.
  - **Lissajous / harmonograph**: swings across and up-down, phase, drift, damping (spirals in like a harmonograph).
  - **Rose** (new): petals and divider, or a Maurer rose of straight chords.
  - Labyrinth: Straight runs. Moore, Hilbert, Gosper, Double spiral, Whirl: Rounded corners. Waves: Waves across, Calm
    ends. Patterns drawn from a picture: Levels, Wiggle, Invert.
- **Allow overlaps** (Trace tab, Line card): the line may cross itself where the drawing does, and the needle prints
  over each crossing; the spacing is still kept everywhere else. Off by default (every crossing undone, as before).
- **Patterns traced exactly.** A pattern that is one line is followed point for point instead of re-traced from its
  picture, so a spirograph stays one line through its crossings (a trace would have gone round each crossing twice).
- Engine: `UNB.stageVector`, `UNB.overlapAllow`, `UNB.patternDefaults`; each style's `params`. Tests E33 (every setting
  at both ends; crossing styles with and without Allow overlaps), E14, A31.

## v103 · 2026-10-27

- **Patterns drawn from a picture.** Four new styles in the Pattern card, in a group of their own, draw a picture's
  light and dark as one continuous line, so they print in chocolate as well as plot: **Space-filling curve** (a Hilbert
  curve with finer cells where it's darker), **Wave rows** (wiggling harder and tighter in the dark), **Vibrating
  spiral** (portraits) and **Labyrinth** (a maze with smaller cells in the dark). They use the Art tab's picture, or the
  new **face sample** (the Picture row in the card picks either); **Contrast** bends the darkness. They replace the old
  Shading. The darkest parts keep the line spacing, so nothing merges.
- **Sizes in mm for patterns.** The Pattern card's **Width (mm)** sets the print's width and shows how far apart the
  closest lines come, warning when that is under the needle's line spacing; **Fit the needle** picks the width where
  they are exactly the spacing apart. A width set by hand stays when the detail changes.
- Engine: `UNB.pattern` takes the picture's darkness (`o.tone`). Tests E33 (each picture pattern stays one line and
  puts more line in the dark), A31.

## v102 · 2026-10-27

Simpler, after trying v101 (decided with Nicolaas, [`docs/ART-PLAN.md`](docs/ART-PLAN.md)):
- **One input at a time.** The Art tab's layers are gone: its **Input** switch picks a **Picture**, **Text**, a
  **Pattern** or a **3D model**, and each keeps its settings while another is in use. Pen colours per layer, Placement
  and the Art view went with the layers. Plot as drawn stays, for a pattern or the text.
- **Edit line removed.** Hand edits to the line are better made in a drawing app: export the SVG from the 2D tab, edit
  it in Illustrator, Affinity or Inkscape, and drop it back in as the picture.
- **Shading removed** (hatch, cross-hatch and squiggle in the Tracing card). Light and dark will come back as patterns
  that draw a picture's tones as one line (next, v103).
- Tests: A31 rewritten for one input; E32 and A30 (Edit line) removed.

## v101 · 2026-10-27

The Art tab, phase 1 of the plan in [`docs/ART-PLAN.md`](docs/ART-PLAN.md): **Art → Trace → 2D or 3D**.
- **Everything comes in through the Art tab**, now the first tab. The art is a stack of **layers**: pictures (a sample,
  your image, a sketch), the text, any number of **patterns** (the ten geometric styles, moved here from the Trace tab)
  and a 3D model. Each has an eye, a **pen colour**, up / down and remove; tap one for its own card, and **Placement**
  sizes it and moves it within the art. The big view's new **Art** view shows the layers in their pens' colours. A
  dropped image goes into the chosen picture layer, an STL into the model layer.
- **The Trace tab traces the art:** the shown layers drawn as one picture and traced into one line (the text on its own,
  and a pattern on its own, are traced as before, the pattern starting at the width where its gap is the line
  spacing). A shown 3D model is sliced on its own and the other layers wait; Draw this view adds the model's drawing as
  a picture layer. The Trace tab's first card says what it is tracing.
- **Plot as drawn:** the 2D tab can plot the art's lines exactly as made, without tracing (**Art as drawn**): each layer
  with lines on its own pen, a layer each in the SVG for Saxi (`UNB.exportLayersSVG`). Pictures still need the trace,
  and so does every printer: the page says so. **Traced line** works as before.
- Undo and design files keep the layers, pens, places, patterns and pictures; older designs open as one layer.
  Tests A31 (new), A24, A07; the app tests now start on the Trace tab where they need it.

## v100 · 2026-10-26

- **Edit line: fix the traced line by hand.** A new tool under the preview (Tools → Edit line) with three brushes:
  **Push** (grab the line and drag it where it should be; it bends rather than kinks, and a stroke end can be dragged
  longer or shorter), **Smooth** (brush over a wobble or a jagged connector to even it out) and **Straighten** (brush
  along a stretch to make it one straight line). Smooth and Straighten leave stroke ends and junctions where they are,
  so loops and the spacing at junctions keep their shape. The edits go into the traced path before the strands, loops
  and Fourier fit (`UNB.editWalk`, applied in `stageTrace`), so the preview, the 2D pen line, the layers and the G-code
  all follow them; they are kept against the picture like erasing, so they stay put when the threshold or the size
  changes, and they undo, save and open with the design. The edited line shows while you drag. Tests E32, A30.
- **Geometric art: patterns to trace, made in the app.** A new card under Input with ten styles: **Labyrinth** (one
  line round a random maze, in a square, circle, hexagon, diamond, heart or star), **Moore loop**, **Hilbert curve**,
  **Gosper curve**, **Double spiral** (round or polygon, with twist), **Whirl** (twisted polygons), **Waves**,
  **Spirograph**, **Lissajous** and **Truchet tiles**. Make and trace draws the pattern and traces it; the sliders then
  change it as you go, and Shuffle makes another random version. The first seven are one unbroken line with an even
  gap between neighbouring lines, so they trace with nothing doubled and print in chocolate as drawn: Make and trace
  sets the Line card's Closed loop or Open to suit, and starts the print at the width where the pattern's gap is the
  line spacing. Spirograph loops, Lissajous and Truchet tiles suit the pen plotter. Design files keep what a pattern
  was made from. Engine: `source/engine/13-patterns.js` (`UNB.pattern`, `UNB.patternLayout`); app:
  `web-app/js/patterns.js`. Tests E33, A30.

## v99 · 2026-10-19

- **The 4000-term limit is gone.** A line can now use as many terms as its samples allow (up to 16,384; filled areas
  keep their 30,000), so busy photos and fine pencil drawings come as close to their traced path as everything else.
  On the astronaut sample traced as outlines the line used 6677 terms instead of stopping at 4000, and its worst 5%
  came in from 0.12 mm to 0.07 mm off the path. Drawings and lettering need far fewer terms and are unchanged; working
  the terms out is about as fast at any count. The error chart marks 10000 when it reaches that far. 3D models too.

## v98 · 2026-10-18

- **Two new fonts for lettering.** **Chocolate (choc OS lettering)**: Nicolaas's font made from choc OS's text, where
  every letter is already the closed line choc OS prints (rounded outline letters that run into their neighbours),
  so it prints the lettering choc OS makes. **Dune Rise (thin, capitals)**: Fontswan's open-licensed (SIL OFL 1.1)
  thin geometric capitals, made single-stroke by taking the middle line of each stroke, so it loops at the stroke
  ends like the other fonts. Both read from 17.4 mm with the 0.84 mm needle (the usual 8 stroke widths: below about
  16 mm the Chocolate letters' sides come closer than the line spacing). Two tools make more of them from fonts on the
  Mac: `source/tools/line-font.py` (a font whose letters are already lines, like Chocolate) and
  `source/tools/center-font.py` (thin, even strokes, like Dune Rise). E10 and A04 check every font, the new ones too.

## v97 · 2026-10-18

From the Suggestion box (the notes of 18 October, from the Mac app):
- **A piece for each line of text.** A text of several lines (a list of names, say) now prints each line as a piece
  of its own: one continuous line each, with no strand of chocolate joining one line to the next. The Plate card has
  **Lines of text** (A piece for each line, the default / One piece, lines joined; `settings.js` defaults.textLines)
  and **One copy shows** (which piece the One copy views show). Every line is traced again from its own letters
  (`UNB.rasterText` now returns a line map per line), the pieces are packed on the plate together
  (`UNB.plateLayoutPieces`: different sizes, turned the same way, in reading order, rows from the back; Copies becomes
  "Copies of each line"), each gets its own layers, and the G-code prints them one after another like copies. The
  Plate card, the ready list, the cartridge note, the layers readout (metres and minutes for one of each line), the
  plate and Whole plate views and the export all count the pieces. The Trace and 2D tabs keep the text as one
  drawing. Tests E31, A29; challenges `birthday-pieces` and `names` (the two older birthday jobs keep the lines
  joined).
- **The layer slider shows the whole print again after a change.** Left on a few layers (to look inside), a change to
  the print kept the slider there, so the new print showed only those layers. A new print now puts the slider back on
  every layer. A14 checks it.
- **The size marks take turns below and above the slider,** so neighbouring labels (high detail and the plate, say)
  no longer run into each other. A13 checks each row and that no label sits on the slider.
- The 4000-term limit, asked about in the box: measured and written up in ROADMAP.md (Next); not changed.
- Code: the layers of a design are built by `designLayers(D, xf)` for any design (the drawing, or a text's piece);
  `layerLine`, `lineToPlate` and the per-copy paths take the design they're for. Checked: the model and lettering
  challenges come out byte for byte the same as v96 (the drawing challenges need their SVGs, which only the Mac has).

## v96 · 2026-10-18

- **Unbroken is a Mac app.** `desktop/` wraps the same page in Electron: `Unbroken.app` for Apple silicon, in its own
  window, working offline (the fonts are bundled), with Save dialogs for every export that start in the folder used
  last, its own `settings.js` (File ▸ Edit Settings…, kept in ~/Library/Application Support/Unbroken so edits
  survive updates), and the window, notes and folded cards kept between launches. Pages load from `unbroken://app/`
  so the background engines run. `node desktop/build.js` tests and builds the web app, then packages, signs (ad hoc)
  and zips the app; the icon is one continuous line (`desktop/icon.svg`). See desktop/README.md.
- Checked in the app itself (Electron on Linux, before packaging): it opens, traces with the background engines,
  loads the bundled fonts, exports G-code through the save path and remembers the folder, keeps a Suggestion box note
  and uses the user's settings.js after a restart, with no page errors.

## v95 · 2026-10-17

From trying v94 (the first notes from the app on the Mac):
- **The 2D page shows the whole drawing.** It used to fit the paper only, so a drawing bigger than the paper was cut
  off at the view's edge, and − stopped at 100%. The view now frames the paper and the drawing together; a drawing
  bigger than the paper hangs over its edge on a grey surround (with the "too big" note, as before).
- **Every view zooms out to 25%** (the line, the 2D page, the plate and the layers); Fit brings it back to 100%.
- **More paper sizes:** A6, A2, A1, US Legal and an 18 × 24 in drawing pad, grouped (ISO, US, drawing pads), and
  **Printer plate**: the chosen printer's plate as the paper, so a drawing can be laid out at the size the chocolate
  printer would print it. settings.js accepts the new names (`paper: "plate"`, …).
- Tests: A15 checks the page frame for a drawing bigger than the paper and the plate as paper; A23 checks zooming out
  to 25% and back.

## v94 · 2026-10-17

- **The last of the old name is gone** (still in beta, so no old files to keep working). The engine is `UNB` (was
  `FLT`), with `UNB_SETTINGS` in settings.js, `UNB_FONTS` and `UNB_CHROMIUM` for the tests. Design files end
  `.unbroken.json` and say `unbroken-design` inside; files saved before v94 no longer open. The browser's own storage
  uses `unbroken-` keys (folded cards, Suggestion box notes kept without a database), and anything saved under the
  old `flt-` keys moves across the first time the page loads. The project and the folders are called Unbroken too.

## v93 · 2026-10-17

- **Exported files are named after the design.** G-code is `design_needle_copies`: `welcome_084_2x-gcode.zip` holds
  `welcome_084_2x.gcode` (0.84 mm needle, 2 copies; the needle as three digits so there's only one dot in the name).
  The design name comes from the image or STL file name, or the first line of typed text, lower case, up to 20
  letters, numbers and dashes. The choc OS DXF, the pen plotter's SVG, a model's view and a saved design use the same
  name (`welcome-dxf.zip`, `welcome-plot.svg`, `welcome-view.svg`, `welcome.flt.json`), and a test print is
  `test-speed_084`. Every file used to be called `unbroken`. A project number joins the name when designs move into
  a database (ROADMAP.md, Later). A27 checks the G-code's name.
- **Compared with choc OS:** its Welcome sample against the same line through this app's G-code writer
  (`source/printer/choc-mate-2/welcome-comparison.md`). The same start, flow, retraction, wipe and end; the
  differences are the spiral climb (no seam, one extra lap), and slower, higher Z moves between copies.

## v92 · 2026-10-17

The fixes left from the code review (docs/history/REVIEW.md), two roadmap items, and a documentation tidy-up. Checked
before the Mac sync: all 58 tests pass, and the model and lettering challenges run without a break (heart-sparse now
has rows in both lobes). The six drawing challenges need their SVGs in `source/challenges/art/`, which only the Mac
has.
- **Painted areas keep their width after a re-trace at a new resolution.** The crossing-area and connector-path brush
  was scaled by the crop on screen while the run used its own, so a bigger or smaller print could paint them wider or
  narrower than drawn (`pipeline.js` `zoneMask`).
- **Stale layer runs are stopped.** The background engines now hand their worker one call at a time and can cancel
  only the calls asked for (`engine-bridge.js` `cancel(pred)`). A new layers run cancels the previous run's layer jobs
  (a filled layer's line, a model's slicing) when its settings changed, so nudging a big model's height five times no
  longer queues five full slices; the 2D page's pen line, Draw this view and an export waiting on the layers are
  left alone.
- **A saved design finds its own 3D model.** It used to match the model by an id that restarts every session, so it
  could put its turns and height on a different model. It now matches by the model's name, triangle count and size;
  when the loaded model isn't the one, the message says which STL to load.
- **The ready list works from the 3D tab:** a line for a Trace-tab card (traced, line spacing) switches to the Trace tab
  and opens the card.
- **The test print's range follows the chocolate:** From and To for layer height and speed move with the setting
  (a new chocolate, printer or speed) until you type in them; Use it keeps the strips you printed.
- **Travel speed without retraction:** travel between copies uses the printer's travel speed whether or not
  retraction is on (it was F3000 without). Files with no travel speed set are unchanged.
- **Spectrum sort:** each term's size is worked out once instead of on every comparison (16 384 samples: about
  20 → 8 ms; the order is identical).
- **Sparse "Lines" infill reaches small parts** (the heart-sparse challenge: a ring and no rows). The ring now sits one
  line spacing in, as at 100%, whatever the density, and the rows start a line spacing plus half a row spacing inside
  it, so their turnaround ends keep a line spacing from the ring (they came to about 0.85 before). Where a row splits
  round a dip (a heart's two lobes) and the next row runs across both, both sides now get their loop. A 34 mm heart
  at 25%: the emptiest 1% of the inside 3.4 → 2.5 spacings from a line; a 50 mm heart 3.6 → 2.1; solid hearts
  0.77–0.86 → 0.56. 100% fills of shapes that don't split (a disc) are unchanged byte for byte; at 50% some shapes are
  up to 0.2 spacings emptier near the ring (the row ends now keep their distance). Rings fills are unchanged.
- **Z speeds are printer settings:** `zTravelSpeed` (lifting clear before travelling, 60 mm/s) and `zApproachSpeed`
  (lowering onto a copy and the last lift, 10 mm/s) in settings.js, checked like the other printer fields. They
  default to the speeds the G-code always used (F3600 / F600), so files don't change until you change them; choc OS
  uses 120 mm/s for both.
- **Speed is in mm/s** in Fine-tuning, like the chocolate profiles, the test print and the choc OS manual (it was
  mm/min). The G-code still gets mm/min, so files don't change. Design files saved before v92 are converted when
  opened (1200 mm/min → 20 mm/s); A07 checks it.
- **Wording:** Centerline everywhere (the View menu said Centreline); Auto's tooltip gives its tolerance in mm for the
  current trace instead of "0.35 px"; Height steps by 0.05 mm like the layer height; the web-app README says
  Fine-tuning where it said Machine settings.
- **Challenges:** `models.js` makes `art/` when it's missing (a fresh copy has none).
- Docs: AUDIT.md and REVIEW.md moved to docs/history/ (kept as written); ROADMAP.md is the one list of open work; the
  README's "Start here" table, its Layers notes (start/end lines and retraction are done; `printHeight` is gone) and
  its folder layout brought up to date; DESIGN.md's paths.

## v91 · 2026-10-17

Clean-up: no changes to what the app makes. Checked by running all 30 challenges before and after each step: every
G-code and SVG file (35), and the screenshots, came out byte for byte the same (`source/challenges/compare.js`); all 58
tests pass.
- **Long functions split into named steps:** the walk (`buildWalk`: router, parts, graph, loose ends, doubling, tour,
  tags), the preview (`render`: under the line, the line, marks, circles) and the 3D layers view (`drawStack`:
  projection, lit beads, whole plate, one copy).
- **One print-settings signal** (`printSettingsChanged`, state.js): the printer, chocolate, needle and layer height
  announce a change once it's applied, and E per mm, the Fine-tuning notes and the test print follow it. Replaces
  listeners on those controls in four files that depended on running in the right order.
- **One spatial grid** (`cellGrid`, 00-util.js) instead of five hand-built ones; one region grid for overlapping shells
  and support (`regionGrid`, 12-models.js).
- **Formatted to 120 characters** with prettier (`.prettierrc.json`), comments wrapped by
  `source/tools/wrap-comments.js` (checked: the code parses to the same program before and after).
- Docs brought up to date: README (support, overhang, connectors, challenges), DESIGN.md, ROADMAP.md (re-sorted),
  REVIEW.md (status at the top: what's fixed and what's open), AUDIT.md; old challenge runs pruned.

## v90 · 2026-10-17

From the review of the v89 challenge set with Nicolaas:
- **"Jumps" are now "connectors".** The line never stops; a connector is the straight strand it prints to reach a
  part it doesn't touch (a cat's eyes inside its head). The trace readout ("· 9 connectors"), the Loose ends options
  (Connect across when much shorter / whenever shorter) and their help say so. Settings keys are unchanged.
- **Model connectors go through the middle.** Where two separate parts of a layer are about as close all along (a
  standing Y's arms, a handle), the connector used to join them at an edge, and the strands stacked into a ledge on
  the model's face. It now runs straight across between points near the middle of the layer, so the stacked strands
  sit back inside the model and the parts stand out in relief.
- PLAN.md: no bridging (chocolate can't span a gap); the Happy Birthday challenge also runs as an open line.

## v89 · 2026-10-17

Found with a new set of challenges (lettering, a snowflake, a cat, a mandala, a tree, a mug, a standing Y, a bridge):
- **Models of overlapping shells lost their body.** A mug made of a body and a handle that overlaps it: which loop of
  a layer is a hole was decided from each loop's first point, and the body's fell inside the handle, so the body was
  dropped and only the handle printed in those layers. Loops that partly overlap are now merged into one outline
  first (FLT.unionOverlaps). Test E29.
- **Text at its smallest says so.** Typing a width below what the lettering can be with this needle snapped back
  silently, and the letter-height box kept the number typed (13.27) while the letters were 17.4 mm. The box now
  shows the real letter height and the Size card says the print is as small as this lettering goes, and why. Test A04.
- PLAN.md: the technique's limits written down as a rule, and a future idea: split complex models into parts to glue.

## v88 · 2026-10-17

- **Thin wall replaces Straight wall** (Support is Off / Flared skirt / Thin wall). Everything under the model's
  overhangs, dropped to the plate, is thinned down its middle to the thinnest wall one narrow loop prints (line width +
  spacing, 2.2 mm with the 0.84 mm needle), running into the model, and flares out at the overhang slope near the top
  to hold the whole overhang. A standing r keeps its arm, with a thin wall under it (the straight wall made it a
  block); the T gets one under each arm. It uses about the same chocolate as the straight wall did (only outsides
  print, so that wall was a shell too), and every layer stays one loop. On a round model the middle is inside the
  model, so it comes out as the flared skirt. A design saved with Straight wall gets Thin wall. Tests E30, A28.

## v87 · 2026-10-17

- **Skirt + small wall removed** (Support is Off / Flared skirt / Straight wall). On a one-sided overhang the small
  wall is a second island the one continuous line has to join on every layer, a web across the gap, so it used more
  chocolate than the straight wall; on a round model it was the straight wall.

## v86 · 2026-10-17

Support for overhangs on one side (found with a challenge: a lowercase r standing up):
- **Flared skirt is now a brace.** It pulled back evenly from every edge, so a standing r's 5 mm-deep arm thinned
  away from its front and back (which overhang nothing) and dropped to the plate as a block. It now pulls back from
  its far edge only, towards the model: the r gets a gusset from the arm's tip into the stem at the overhang slope,
  the T one under each arm, and nothing reaches the plate. Round models (a mushroom's cap) still get a cone.
- **New: Skirt + small wall.** A small wall (one narrow loop wide) drops straight to the plate under the far edge of
  each overhang, and the skirt arches between it and the model. On a round model it comes out as the straight wall.
  On a one-sided overhang the small wall is a second island in every layer below the arch, so the one continuous line
  joins it to the model with a pair of connector strands on every layer: they stack into a thin web across the gap.
- Challenges: the r standing (none, skirt, skirt + small wall, wall) and lying flat (no overhang), the T and the pawn
  on a skirt + small wall. Tests E30, A28.

## v85 · 2026-10-17

**Support for 3D models.** A part that reaches out further than a bead can step (a mushroom's cap, a pawn's collar,
an arm) has nothing under it. One continuous line can't print a separate support, so the support is the print's own
outside wall, widened from the plate up, and it stays on the piece.
- Layers card (models): **Support** · Off / Flared skirt / Straight wall. Flared skirt: each layer covers the one
  above less the overhang, so the support fans out at that slope and meets the model where it can carry the rest
  (least chocolate); a narrow arm that would shrink away gets a bead-wide fin carried down instead, so no layer ends
  in the air. Straight wall: whatever the model can't reach drops straight down to the plate. Gaps narrower than a
  bead between the support and the model are closed (they'd print the model as a second loop inside).
- Fine-tuning: **Overhang per layer (mm)**, how far a layer may step out past the one below; empty = a third of the
  line width (0.28 mm with the 0.84 mm needle).
- The ready list says how far the model steps out with Support off ("Overhang: a layer steps out 1.28 mm at
  13.2 mm … turn on Support"), and which support is on.
- Engine: `FLT.modelOverhang`, `FLT.modelSupport`; `FLT.modelStack` takes `support` and `overhang` and returns the
  overhang, the support and the connector joins per layer. Tests E30, A28.
- **Challenges** (`source/challenges/`): practical prints taken through the app (load, set up, export, G-code read
  back), run with each version; new jobs aim at what changed. Seven support jobs added (pawn, mushroom, T).

## v84 · 2026-10-16

Found by using the app end to end (three drawings and three models taken through to G-code):
- **Sparse fills no longer leave out an inner ring.** A ring that neither runs beside the others (to be bridged) nor
  comes near the line (to be spliced in) was dropped without a word; it is now linked in with two connector strands
  (a 32 mm heart filled with rings at 25%: 203 → 215 mm of line). Test E29.
- **Layer counts agree.** The last lap that evens a closed line's rim was counted as a layer of its own in the ready
  list and the "slowed" note (101 layers where the readout said 100). Test E28.
- Tests: `lib/gcode.js` reads a one-copy file (it has no "; copy" line).
- Known limit, not changed: Infill "Lines" puts a ring a row spacing in from the wall and starts its rows a row spacing
  inside that, so a narrow part at a low density (a 34 mm heart at 25%) gets the ring and no rows. Use Rings, or a
  higher density, for small models.

## v83 · 2026-10-16

Dead code removed (REVIEW.md), each checked unused first; no behaviour changes:
- CSS for the old Start-from buttons (`.presets`) and the old folding groups (`details.sub`, `.sub-body`).
- The hidden file boxes `#file` and `#modelFile` and their handlers (the drop area's `#anyFile` replaced them).
- `FLT.smallestPrint`, a wrapper only test E07 used (E07 now runs `smallestPrintSteps` to the end itself).
- An impossible branch in `uncross` (an open line has no segment past its last point).
- settings.js `printHeight` (the first layer follows the layer height since v75) and `defaults.position` (the plate
  set the position anyway); an older file that has them is still read without a warning. The built-in `lineMode`.
- A systematic scan of the app's top-level functions and the engine's public ones found nothing else unused (the
  walk's `doubledFrac`, `linePix`, `jumpLen` stay: the benchmark reads them).

## v82 · 2026-10-16

- **Cut off moved to the 3D tab** (the Layers card, under Height, when a model is loaded): cutting decides what is
  printed, so it sits with the height and the layers. The model's preview on the Trace tab still fades the parts cut
  off.

## v81 · 2026-10-16

3D models:
- **Cut off the bottom and the top.** A model whose top isn't flat (a dome or a point ends in a few tiny, wobbly last
  layers) or whose bottom is round can be cut: Cut off · Bottom and Top (mm) under the model on the Trace tab. Only
  the part between is sliced and printed; the preview fades the parts cut off and outlines each cut in blue; the
  3D tab's Height is the part left (typing it scales the model so that part is that tall); the plate footprint is the
  part left; undo and design files keep the cuts; turning the model clears them (`modelStack` cutBottom / cutTop).
- **Outside contour only.** A hollow model (a cup, a vase with a real wall) used to print both surfaces of its wall:
  the outside, then a connector, then the inside. Each layer now prints its outside contour only; the inside of a
  wall and any hole are never traced, and how much of the inside gets chocolate is up to Base and Infill (Walls adds
  lines inside the outside contour). Tests E23 (a tube is one loop on its outside), E29, A17.

## v80 · 2026-10-16

From the Suggestion box ("the preview does not give a lot of shadow contrast, so it is hard to see textures"):
- **Lit beads in the 3D layers view (Solid).** Each bead is shaded by which way its side faces a light from the upper
  left, with a dark groove where beads meet and one light streak along each layer's top; layers are drawn from the
  bottom and, within a layer, from the back, so nearer beads cover farther ones. The layer texture and the model's
  form now read (brightness spread over the beads ~6 → ~35 of 255); one copy and Whole plate alike.
- **The model's own preview** is lit more from the side, faces turned away from the light go darker, and there is a
  soft highlight, so curves and steps show. Test A17.

## v79 · 2026-10-16

- **Gap between lines has its own ⓘ** saying what the spacing means: the line keeps its parts at least line width +
  gap apart, centre to centre (strands, stroke-end loops, the smallest size); only junctions may touch; for chocolate
  the flow is set for a bead exactly the needle's width, so a gap of 0 puts beads side by side, just touching, and a
  little gap leaves room for chocolate that spreads; Base and Infill at 100% work the same way; for a pen the gap is
  only how much white you want. An ⓘ can now sit next to a single box (`data-anchor`). Test A25.

## v78 · 2026-10-16

Engine fixes from the code review (REVIEW.md):
- **No more kink beside junctions on small prints.** Junction distances were recorded only 40 px out while single
  strokes ease over twice the spacing, so past a 20 px spacing (small prints, wide needles) the line jumped up to
  4 px next to a junction. Now recorded 160 px out (the walk says how far: `walk.jr`), and the ease never goes past it:
  a 30 px spacing changes by at most 0.5 px between neighbours.
- **The error readout measures the fit.** It compared the drawn line with the drawing's centre line, which doubled
  strokes sit half a spacing off on purpose, so it mostly reported that offset (the leaf: 0.47 mm). It now compares
  with the path the series was fitted to (`stageSignal` returns it as `path`): the leaf reads 0.04 mm. Stray and
  missing follow; the error box has a tooltip saying what it measures.
- **Connector lanes are faster:** each loose end's route search stops once it has the nearest 8 loose ends, and a
  matched jump's route stops at its far end (and only the cells a search reached are reset). A comb with 128 loose
  ends: 1.4 → 0.4 s at 400 px, 5.0 → 1.2 s at 800 px, the same line.
- **"At the limit":** when even the most terms can't bring 95% of the line within the tolerance, the Fit card says
  so (with how far off, in a tooltip) instead of quietly settling for the limit. Test E29.

## v77 · 2026-10-16

Print-safety fixes from the code review (REVIEW.md):
- **A 3D model's height no longer follows you back to a drawing.** Visiting a model and switching back to Image left
  the model's height (e.g. 40 mm) in the Height box, and the next chocolate or layer-height change turned the
  drawing into a 133-layer tower. The height now comes from the drawing's own layers.
- **Fine-tuning boxes are checked before they reach the G-code.** An empty or out-of-range First-layer Z, Lift,
  Speed or Layer height is replaced by the profile's value (never Z 0 into the plate, never a lift of 0 across
  finished copies), the boxes have limits, and the ready list says which box was replaced. The same values feed the
  layers readout, the model slicing and the test print.
- **settings.js:** a chocolate's costPer100g, cocoaPercent, workingTempC, layerHeight and notes are checked (a
  quoted number used to break the chocolate menu at start-up); printer maxPrintSpeed and cartridge too;
  cartridgeVolume and printHeight no longer warn when missing (printHeight isn't used any more).
- Small: density readouts are rounded (no more "55.00000000000001%"); E per mm follows a printer change at once;
  the needle hint says Fine-tuning. Test A26.
- **Tests wait for the app, not the clock** (no app change). Every browser context gets a probe (lib/app.js
  `SETTLE`) that counts the app's pending debounces and asks its background engines whether a job is running;
  `A.idle` waits until that has been quiet three checks in a row and fails after 120 s instead of carrying on. Stacked
  waits and ~25 fixed sleeps went. The runner closes every page a test opened even when it throws, fails a test that
  made no checks, and `check()` no longer passes NaN or an unknown operator. Full run 699 s → 408 s (A14 150 s → 18 s).
  Out-of-date test descriptions fixed (A12, A17, A25, E09).
- **Test A27 reads the G-code the app downloads, move by move** (lib/gcode.js): printer start lines and purge line
  first; two copies, each with its layers in order, one unretract and one wipe, no travel inside; E per mm over every
  full layer within 1% of the app's value (first and last wall laps easing in and out); feeds between the printer's
  slowest and the set speed, each layer at least the seconds per layer; first layer at First-layer Z, top at the
  height; every travel at least the lift above what's printed; a final lift before the end lines; all on the plate.
  Checked against two planted bugs (5% too much chocolate, travel 0.5 mm above the print): both caught.

## v76 · 2026-10-16

- **New name: Unbroken** · one continuous line (was the Fourier Line Tracer). The page title and header, the files
  it exports (unbroken-gcode.zip, unbroken-plot.svg, unbroken-dxf.zip, unbroken-test-….zip) and the comment at the top
  of each file. Saved designs (.flt.json), notes and settings in the browser carry on as before. The folders get the
  new name with the move to GitHub.

## v75 · 2026-10-16

The simplification round decided item by item (PLAN.md):
- **Height leads.** On the 3D tab you type the height; the layers follow (shown as "8 layers: 2 base + 6 above ·
  0.30 mm each"). Changing the base layers, the layer height, the chocolate or the printer keeps the height.
- **Fine-tuning** (was Machine, folded): layer height, speed, first-layer Z and lift start from the chocolate and
  printer profiles and can be changed per print; a changed value shows the profile's, and Back to the profile values
  resets them. First-layer Z follows the layer height. Position and E per mm stay here.
- **No Start from presets** on the Trace tab: the sliders are the controls (settings.js startFrom still works).
- **Explanations behind ⓘ:** next to the control's name (or the card's title), on hover or click; readouts and
  warnings stay on the page. The spacing and size readouts are shorter.
- **Leave small areas open** on both Base and Infill, each its own (settings.js baseMinArea, infillMinArea; an older
  file's infillMinArea sets both).
- **Cartridge warning:** chocolate per copy and per plate against one full cartridge (settings.js cartridgeVolume,
  50 ml for the choc mate 2), saying which copy it runs out in.
- **Test print** (3D tab, folded): numbered strips with one setting stepped across them (layer height, speed, gap or
  flow), the layers going round every strip; Use it puts the best strip's value into the setting (`FLT.testStrips`).
- **Layer slider** in the 3D layers view: the print up to a layer, that layer highlighted and named (base or above,
  lines and angle, density).
- **Ready to print** checklist above Export G-code: traced, line spacing, on the plate, height, layer times,
  cartridge; each line opens its card; with a red line, Export G-code asks for a second click. Test A25.

## v74 · 2026-10-15

- **One level of folding.** Cards fold; nothing folds inside a card any more. The "More…" groups are gone: their
  controls sit in their card (Tracing, Line), Image prep and Shading are their own cards (start folded), the 2D Fills
  and Export are cards, the Suggestion box shows its notes, and the 3D tab is Printer, Printer profile, Plate, Layers,
  Base, Infill, Machine (folded) and Export.
- **Base and Infill replace the Filled base switch.** Base layers start at 0; raise the number to add them. Each has
  a density (100% = rows a line width apart, touching; 0% = no fill), a pattern (Lines or Rings), an angle, and
  "Turn 90° every … layers", so a few layers can run the same way and then cross them for strength (`FLT.fillPlan`).
  Infill fills the layers above the base (default 0%, hollow); for 3D models it replaces Hollow / Solid. Old saved
  designs and settings files are read into the new boxes. Tests A12, A14, A16, A17, A19, E20, E23.

## v73 · 2026-10-15

- **Height = layers × layer height.** One 0.3 mm layer now reads 0.3 mm (it read 0.8 mm: the first layer's Z was
  counted as chocolate). The first layer prints at Z = one layer height, as choc OS does (settings.js `printHeight`
  0.3, was 0.8); typing a height sets the layers to match.
- **Filled layers read 0 without a filled base,** and at least 1 with one (the boxes are now "Filled layers" and
  "Layers above"); the total is the two added up.

## v72 · 2026-10-15

- **One drop area for every input file** at the top of the Input card: click it to choose a file, or drop one there
  or anywhere on the page. Images are traced, STL models sliced and saved designs (.flt.json) opened, whichever source
  was showing (an STL dropped on the page used to be refused as "not an image"). The separate Load image… and Load
  STL… buttons are gone; the samples stay. Test A24.

## v71 · 2026-10-15

From the Suggestion box:
- **The 3D tab in four cards that fold:** Printer (printer, chocolate, needle, profile), Plate (plate limit, copies,
  centre), Layers (filled base, height, seconds per layer, layer counts) and Export (machine settings, DXF, G-code).
- **Solid (as printed)** in the 3D layers view, on by default: every line drawn as the chocolate bead it prints, the
  needle's width and one layer tall, at true height, lit from above, layer on layer. Untick it for the thin lines with
  the height stretched.
- **A 3D model no longer leaves the last picture's drawing on the 2D page;** the page says to use Draw this view.

## v70 · 2026-10-15

From the Suggestion box:
- **The gap between lines no longer changes the print's size.** A new picture starts on the medium-detail mark once;
  after that, changing the gap or the line width moves the Size card's marks but leaves the size where it is. Only
  when lines that far apart no longer fit does the size grow, to the new smallest, with a note saying so. A new selection is a new drawing, so it starts on the mark again.
- **Fills on the 2D tab fold into a "Fills" group** (it remembers whether it was open; its heading shows how many
  shapes are filled).

## v69 · 2026-10-15

- **See every path:** on the Whole plate, the 3D layers view now shows the print exactly as the G-code makes it: the
  purge line, every copy's walls and filled base, the travel between copies (dashed, needle up) and the wipe at the end
  of each copy. Play drawing follows the same order. The Plate view shows the same from above: the base's fill lines
  under each copy, the travel and the purge line.
- Switches at the bottom of the Plate and 3D layers views turn Walls, Fill, Travel and Purge & wipes on and off
  (Travel and Purge & wipes on the Whole plate only).
- The G-code marks each layer ("; layer 3 of 12 (wall)") and the printer's start and end lines; `FLT.readGcode`
  reads a file back into moves by kind (test E28).

## v68 · 2026-10-15

- **Zoom in every view** (Line, 2D page, Plate, 3D layers): the − / + / Fit buttons at the top right, pinch or
  Ctrl / ⌘ + scroll to zoom where you point, scroll, Space + drag or the middle button to move around. Each view keeps
  its own zoom; the image tools and clicking shapes on the 2D page still land where you point.
- **One copy / Whole plate** on the Plate and 3D layers views: one copy shows just the design, framed to fill the view,
  so you can work on it; the whole plate shows every copy where it prints. In 3D, playing the whole plate prints the
  copies one after another, as the G-code does.
- Test A23.

## v67 · 2026-10-15

Your notes on the app (15 October), and choc OS's files with three needles.

- **The big view has tabs:** Line, 2D page, Plate and 3D layers. The 2D page (click shapes to fill) and the layers
  moved out of the side panel; each settings tab brings its own view. **Play drawing plays the view that's showing:**
  the circles drawing the line, the pen drawing the page and then the fills, or the needle stacking the layers.
  **Drag the 3D layers to turn them** (double-click to go back).
- **The Trace tab in cards:** Input (image, text or model) · Tracing (images only: style, threshold, smoothing, prep,
  shading) · Line (line width + gap, closed or open, loose ends, round corners) · Size · Fit (terms, Optimize).
- **Size:** its own card, with Fit inside a box. Not capped at the plate any more (the slider goes to 1 m);
  "Keep the size within the build plate" on the 3D tab caps it per printer. For text the size leads: the width and
  height boxes set the letter height, and the other way round.
- **Needle on the 3D tab:** it sets the Trace tab's line width (0.84 mm, the 18G, to start); a typed width that no
  needle has shows Custom. The Line spacing / Needle switch is gone: spacing = line width + gap.
- **Open lines in 3D:** each layer flat; at the end the needle steps straight up one layer and traces the line back.
- **Seconds per layer** (at least, 20 to start, 3D tab): quicker layers are slowed in the G-code so the chocolate
  sets, never below the printer's slowest speed (settings.js `minPrintSpeed`).
- **The printer's cartridge** (the choc mate 2's 50 cc syringe, 26.5 mm inside) is shown with the printer and edited
  only in settings.js. choc OS's files for the 0.84, 1.19 and 1.60 mm needles confirm E per mm grows with the needle
  as the tracer works it out (test E28).
- **2D exports the SVG for Saxi only** (Saxi sets the pen speeds). The flat DXF moved to the 3D tab as "DXF for choc
  OS" (one closed curve), a fallback while the tracer's own G-code is proven.
- Tests: A21 (Size card), A22 (the big view); A03, A12, A15, A16, E21, E28 updated.

## v66 · 2026-10-15

G-code made the way choc OS (the choc mate 2's own slicer) makes it, from its sample file.

- The start: the needle size for the printer (`@set global.JobNozzleDiameter`, `@call MatchNozzleSize`) and choc
  OS's purge line along the back edge.
- Retraction and wipe: the plunger pulls back 0.3 mm before travelling; each copy starts with a push forward and the
  printer's own pause, and ends with a wipe (the last 0.2 s of the line prints while pulling back).
- E per mm now follows the needle (needle × layer height ÷ cartridge cross-section), shown read-only under Machine
  settings. The typed E per mm and the chocolates' extrusionPerMM are gone: the old 0.05 was about 100 times what
  choc OS uses. Fine-tune the flow on the printer.
- New settings.js printer fields: retraction, retractSpeed, wipeTime, firstUnretractExtra, unretractPause,
  travelSpeed, cartridgeDiameter; start and end G-code filled in from choc OS.
- Test E28 checks all of this against choc OS's own file.

## v65 · 2026-10-15

Second audit round and good-practice steps (see AUDIT.md, "Round 2").

- Bugs found by two independent reviews fixed, with regression tests E26 (engine edge cases) and A20 (races):
  a one-pixel drawing no longer crashes or hangs; straight lines get a real box; closed walks are offset the same at
  their seam; open slices of a model with a hole stay one chain; line ends join across grid boundaries; padded STL
  files open; smooth plotter SVGs and Smallest shape are fast on small drawings and many shapes; a cancelled worker
  can't break the next run; an old term-count sweep can't overwrite a new trace; text typed just before switching to
  Image no longer comes back; Optimize stops when the picture or a tracing setting changes; tool clicks during a
  re-trace land in the right place; line spacing updates a model's layers; a blank image clears the 2D page; notes in
  two open tabs are both kept; undo to a model keeps your image.
- The version shows next to the title; this changelog.
- Image prep runs in the background engine (shorter pauses on big images and photos).
- A fast test run for everyday changes; a test that each piece of shared state is set only by its owner (E27).

## v64 · 2026-10-15

- One interface: the Simple / Advanced switch removed; details stay folded into "More…" groups.
- The desktop-app track dropped for now (plan kept in ROADMAP.md).

## v63 · 2026-10-15

- Never-used features removed: PDF, EPS, HPGL and plain SVG exports, 3D DXF, chocolate product records, the
  working-resolution menu, the Planned list (all in ROADMAP.md under Maybe later).
- The Suggestion box at the bottom of every tab. ROADMAP.md and DESIGN.md.

## v62 · 2026-10-15

- Code audit: the engine split into thirteen parts, duplicated code merged, about 30 bugs fixed, "can be slow" notes
  on the page (AUDIT.md).

## v1 – v61 · 2026-10-13 to 2026-10-15

Earlier versions: see the results log at the end of source/tests/README.md.
