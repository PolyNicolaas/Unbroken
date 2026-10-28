# Test plan

Unbroken turns a picture into one continuous line that a chocolate printer draws without ever
stopping the flow. A bad line wastes chocolate and time. A bad G-code file can drive the needle somewhere it shouldn't
go. These tests check every promise the app makes, from the traced line to the printer file. Each test records **why it
exists** and **what counts as passing**, so a failure says exactly what broke.

Every test here traces back to a real problem, either one that happened or one the design depends on avoiding. The
*Why* line of each test says which.

## When to run

| Situation | Command (from `source/tests/`) | Time |
|---|---|---|
| After every change | `npm run test:fast` (quick engine tests + A01, A12, A19) | about 1 min |
| After changing the engine (`source/engine/`) | `npm test` | about 1 min |
| Before publishing (the build runs it too) | `npm run test:all` | about 9 min |
| One test | `node run.js --only E01,A05` | |

**Rules.** A change is published only when every test passes. If a limit has to change, the reason goes in the
results log below, in the same change. A limit may be tightened whenever the app gets better, and must never be
loosened quietly.

## Setting up

```
cd source/tests
npm install                     # canvas for the engine tests, Playwright for the app tests
npx playwright install chromium # once, for the app tests (or set UNB_CHROMIUM to a Chrome/Chromium binary)
npm run images                  # optional: photo test images (needs Python with scikit-image)
```

Without the photo images, the tests that use photos (E03, E05, E13) run on the drawn scenes only and say so in the
report.

## How the tests work

- **Two kinds.** *Engine tests* (E) run the tracing engine in Node without a browser, using
  [`lib/trace.js`](lib/trace.js). That file runs the same engine stages, in the same order and with the same defaults,
  as the app. *App tests* (A) open the real `web-app/index.html` in a headless browser from a local web server, click
  through it like a person would, and read what the page shows.
- **Known answers.** Wherever possible a test draws its own picture in code, so the true line is known exactly (see
  [`lib/scenes.js`](lib/scenes.js)). The tests measure against that truth instead of against another output of the
  app. That is how the wobble problem was found: the old error number compared the line with the same pixels it had
  copied.
- **One file per test.** Each file in `engine/` and `app/` exports its ID, title, *why*, *how*, *pass when* and a
  `run()` that returns pass/fail checks with the measured values. The catalogue below is generated from those fields
  (`npm run plan`), so the documentation and the tests can't drift apart.
- **Report.** Every run writes `results/latest.md`, a readable report with every measured value next to its limit,
  and `results/latest.json`. The command exits with an error if anything fails.
- **Proven to catch problems.** When a test is written, the behaviour it guards is broken on purpose to confirm that
  the test fails. On 2026-10-14: switching off stroke splitting made E02 fail at 81% coverage, switching off the
  subpixel line made E01 fail at 0.22 px, and switching off crossing removal made E05 fail with 123 crossings.

### Adding a test

1. Create `engine/E14-short-name.test.js` or `app/A11-short-name.test.js`, copying the shape of an existing test.
2. Fill in `title`, `guards` (a few words for the table), `why` (the problem it prevents), `how` and `pass` (numbers
   and the date they were measured). Mark it `slow: true` if it takes more than about 15 s.
3. Break the behaviour on purpose and check the test fails, then put it back.
4. Run `npm run test:all`, then `npm run plan` to refresh the catalogue below.

## Test catalogue

<!-- catalogue:start -->

### Engine tests

| ID | Test | Guards against | Time |
|---|---|---|---|
| [E01](#e01) | Line accuracy against known drawings | wobbly or drifting lines; the trace not following the drawing | – |
| [E02](#e02) | Tightly packed strokes are traced separately | close lines merging into one blob | – |
| [E03](#e03) | Filled areas are not broken up by stroke splitting | holes punched in pale fills; a logo turning into dozens of specks | – |
| [E04](#e04) | Far-away groups: specks dropped, real elements kept | half a drawing silently disappearing | – |
| [E05](#e05) | No self-crossings, in the preview and in exported files | the printed line crossing itself (a blob of doubled chocolate) | – |
| [E06](#e06) | Minimum line spacing is kept | neighbouring chocolate lines flowing into each other | – |
| [E07](#e07) | Smallest print size that keeps the spacing, loops included | nonsense sizes from the "Smallest that fits" search; results that depend on history; a size that only fits before the strands and stroke-end loops are added | – |
| [E08](#e08) | Copies are packed on the plate without touching | copies printed off the plate or into each other | – |
| [E09](#e09) | G-code stays on the plate and is well formed | the printer head driven outside the plate; broken or partial G-code | – |
| [E10](#e10) | Lettering: height, letters never touching, even spacing | letters printed into each other; uneven or wrong-sized lettering | – |
| [E11](#e11) | Every export format is a complete, readable file | truncated or malformed exports | – |
| [E12](#e12) | Background engine gives the same answers as the page | the worker and the page computing different traces | – |
| [E13](#e13) | Tracing time stays within budget | a change making tracing several times slower | – |
| [E14](#e14) | The settings file is complete and consistent | a typo or wrong value in settings.js | – |
| [E15](#e15) | The theme file defines everything the app draws with | a renamed or deleted colour in theme.css leaving parts of the app unstyled | – |
| [E16](#e16) | Stroke ends turn in a round loop, never back over the line | the needle retracing its own line at the end of a stroke, or a stroke end printing past where it was drawn | – |
| [E17](#e17) | The line is three real series, x(t), y(t) and z(t) | the X/Y/Z series drifting from what is drawn, exported or printed, or Z changing a flat print | – |
| [E18](#e18) | Where strokes meet: no crossings, and the full spacing | strands swapping sides at junctions (crossings the clean-up unties into knots), and strands squeezing together where strokes meet | – |
| [E19](#e19) | Round corners: the drawing's sharp corners get the chosen radius, nothing else moves | corners left sharp, smooth curves bent out of shape, junctions, stroke ends or connectors moved, and strands crossing or crowding after rounding | – |
| [E20](#e20) | Infill: enclosed areas filled with the same line, one spacing apart | fills that cross the line, crowd it, leave big holes or break it into pieces; small areas filled when they were meant to be left open; the infill counted as error | – |
| [E21](#e21) | Layers: flat filled base, spiralling walls, one continuous 3D path | layers that collide or leave gaps, a flow that doesn't ease in and out, a stack that stops or jumps, and G-code that travels through a finished print | – |
| [E22](#e22) | Pen fills: the areas the pen line closes off, hatched one pen per layer | gaps that don't close (or close too far), slivers that don't merge, fills that spill over a line into the next area, stop short or overlap the outline's ink, miss spots, or end up in the wrong layer | – |
| [E23](#e23) | Models: STL slices become one fitted line per layer, stacked into a spiral | STL files read wrongly, slices that miss or break a loop, walls on the wrong side of the surface, separate parts or holes left out, layers that don't add up to the model's height, and seams between layers | – |
| [E24](#e24) | 3D → 2D: a model drawn as lines, hidden lines removed | hidden edges drawn through the model, outlines lost on curved surfaces, the flat-face diagonals of a mesh drawn as lines, and a fold angle that doesn't thin the drawing | – |
| [E25](#e25) | The engine's parts load in the same order everywhere, and share helpers only through 00-util.js | a part missing from the page or the worker, parts loaded in a different order in different places, and a part quietly using another part's private helper (which would break as soon as the files are reordered) | – |
| [E26](#e26) | Edge cases found in the October 2026 bug hunt stay fixed | NaN lines from a one-pixel drawing, straight lines measured as a dot, closed walks offset differently at their seam, open slices split in two, line ends that don't join across a grid boundary, padded STL files rejected, and small mm drawings or many small shapes that take seconds | – |
| [E27](#e27) | Each field of the app's shared state is set by its owner | a file quietly changing state another file is responsible for, which is how stale views and "who changed this?" bugs start | – |
| [E28](#e28) | G-code starts, stops and moves between copies the way choc OS does | a blob or a string of chocolate at the end of each copy, an empty needle at the start of the next, no purge line, and a plunger speed that ignores the needle | – |
| [E29](#e29) | Engine fixes from the October 2026 code review stay fixed, and models can be cut | a kink in the line beside a junction on small prints, an error readout that reports the strands' deliberate offset as fitting error, connector lanes that slow to seconds on a drawing with many loose ends, a model cut that slices the wrong part, a hollow model whose inside surface is traced too, a sparse fill that leaves out an inner ring, and a model of overlapping shells whose body is taken for a hole | – |
| [E30](#e30) | Support: overhangs measured, and held up by the print's own wall (a flared skirt or a thin wall) | a model that reaches out over nothing without a warning, a support that still leaves a layer stepping out too far, a skirt that ends in the air under a thin arm, a support that leaves a slit beside the model or stands apart from it (the line would have to join a second loop on every layer), a skirt that shrinks an arm from its sides instead of bracing it back into the model, and a thin wall that fills the whole space under an overhang | – |
| [E31](#e31) | Text pieces: a line map per line of text, and different pieces packed on one plate | a line's letters missing from its own line map or leaking into another's, the whole text's line map changing, pieces placed over each other or off the plate when they'd fit, and pieces left out when they don't | – |
| [E33](#e33) | Geometric art: every style draws the line it promises, and the one-line styles trace as one line | a pattern that crosses itself or touches where it promises an even gap, a closed style that doesn't close, a seed that doesn't give the same pattern again, and a one-line pattern the tracer breaks up or doubles | – |
| [E34](#e34) | Grey levels: a picture as a few flat greys, their edges as lines, and the background removed from a tap | levels that miss a grey the picture has, specks that survive Smooth blocks, edges drawn where nothing is traced or missing round a traced block, a tapped background that isn't removed, and patterns made for plotting that break the printing limits or take too long | – |
| [E35](#e35) | Separate strokes: a line map as strokes the pen draws one by one | strokes broken up along a plain line, a junction that isn't split, a closed ring drawn as an open stroke, specks kept, strokes in an order that sends the pen back and forth, and points off the drawn line | – |
| [E36](#e36) | Fills per grey: each grey level's blocks filled with its own style, inside its edges | a fill that strays outside its grey or onto the grey's edge, hatch rows at the wrong spacing or angle, cross-hatch without its second direction, rings that don't step in, a pattern that isn't cut to the grey, and a grey with no pixels that still draws | – |
| [E37](#e37) | Photos: the page found in a photo, straightened, and cleaned for the line | a page in a photo not found or its corners off, the perspective not undone, a shadow left on the paper, ink lost or table left along the edges, a faint line not darkened, a page claimed in a photo with none, and an object's colour cast kept | – |

### App tests

| ID | Test | Guards against | Time |
|---|---|---|---|
| [A01](#a01) | The app opens and traces the sample | a blank or broken page | – |
| [A02](#a02) | The page stays responsive while tracing | the page freezing while a trace is worked out | – |
| [A03](#a03) | Line width, gap and needle settings hold in the trace | needle sizes and gaps not reaching the trace; the 3D tab's needle and the Trace tab's line width disagreeing | – |
| [A04](#a04) | Text source: fonts, readable height, five-line limit | unreadable or unprintable lettering | – |
| [A05](#a05) | Plate, copies and G-code export, end to end | the plate view, copies or the exported G-code disagreeing with the design | – |
| [A06](#a06) | View menu works on desktop and phone widths | display options unreachable, or the menu cut off on a phone | – |
| [A07](#a07) | Undo, redo, and saving and opening designs | lost work; a saved design that doesn't come back the same | – |
| [A08](#a08) | Optimize tracing improves or keeps the trace, and undoes cleanly | the optimizer making things worse, or leaving settings changed after Undo | – |
| [A09](#a09) | Select area and erase tools | hand edits not reaching the trace | – |
| [A10](#a10) | Works without background workers, with the same result | the app breaking when opened straight from disk | – |
| [A11](#a11) | The app follows settings.js, and survives a broken one | edited settings not reaching the app; a typo in settings.js breaking the app | – |
| [A12](#a12) | One interface: every control on its tab, less-used cards start folded, one level only | a control that can't be reached, a 'More…' group that doesn't open, a panel wider than its card on a phone, and a Simple / Advanced switch coming back | – |
| [A13](#a13) | One size slider: never below the smallest that fits, marks for detail, bigger prints traced finer | a print sized below what the needle can keep apart, marks out of order or in the wrong place, typed sizes slipping under the minimum, and big prints traced no finer than small ones | – |
| [A14](#a14) | Layers: a base and an infill on the 3D tab, walls as Design draws them; the G-code climbs | infill leaking back into the Design trace, a base or infill whose fill doesn't show or reach the G-code, a density that doesn't change the fill, a layer readout that doesn't follow the settings, and G-code that stays flat | – |
| [A15](#a15) | 2D tab: the pen line on the page, SVG for Saxi (and the DXF for choc OS on the 3D tab) | a pen file that still carries the chocolate's doubled strands and stroke-end loops, a page that doesn't match the paper chosen, a drawing off the page, and a missing too-big warning | – |
| [A16](#a16) | 2D tab: shapes to click and fill, one pen per layer | a click that fills the wrong thing or nothing, an area holding two pens at once, a removed pen leaving its fills behind, fills missing from the files or from undo and design files | – |
| [A17](#a17) | 3D models: load an STL, turn it, slice it on the 3D tab, set its height, export | a model that doesn't load, image controls left showing for a model, turns that don't change how it stands, a height that doesn't scale it, G-code that doesn't reach the top, and a model that can't be left again | – |
| [A18](#a18) | 3D → 2D: Draw this view turns a model into a traced line drawing | a drawing preview that doesn't follow the fold angle, a drawing that doesn't become the traced picture, and losing the model or the drawing when switching sources | – |
| [A19](#a19) | Suggestion box: a line typed on any tab is kept as a note | ideas and bugs typed into the page being lost, filed under the wrong kind, or not kept after a reload | – |
| [A20](#a20) | Races found in the October 2026 bug hunt stay fixed | a cancelled background worker breaking the next run, an old term-count sweep overwriting a new trace, typed text coming back after switching to an image, the 2D page keeping a drawing that's gone, and two open tabs overwriting each other's notes | – |
| [A21](#a21) | Size card: the gap leaves the size alone, fit inside a box, the plate limit, and text's size and letter height linked | the size jumping when the gap between lines changes, a print that can't be made bigger than the plate for 2D, a plate limit that doesn't hold, a box fit that overflows, and text whose size and letter height disagree | – |
| [A22](#a22) | The big view: the 2D page and the 3D layers, played, and the layers turned | fills and layers squeezed into the side panel, a big view that doesn't follow the tab, an animation that only works on the line, and a 3D view that can't be turned | – |
| [A23](#a23) | Zoom in every view, and One copy / Whole plate | a zoom that moves what's under the pointer, clicks and tools that land in the wrong place once zoomed, a zoom shared between views, and the copies crowding the view while you work on the design | – |
| [A24](#a24) | One drop area for every input file | an STL or a design file dropped on the page being refused as 'not an image', a drop area that doesn't open the file chooser, and a wrong file changing anything | – |
| [A25](#a25) | Print checks: help behind ⓘ, the cartridge warning, the ready list, the layer slider and the test print | explanations crowding the panel again, a plate that runs the cartridge dry without a warning, an export with a problem that says nothing, a layer slider that doesn't follow the layers, and a test print whose strips don't step | – |
| [A26](#a26) | Print safety: a model's height doesn't follow you back, bad Fine-tuning boxes never reach the G-code, a typo in settings.js can't break the menus | a drawing printed as a tall tower after visiting a 3D model, a needle sent into the plate by an emptied First-layer Z, and a chocolate menu that stops working because of one quoted number in settings.js | – |
| [A27](#a27) | The G-code the app downloads: start lines, flow, feeds, layers, one copy at a time, travel above finished copies | a print file that pushes the wrong amount of chocolate, prints too fast for a layer to set, travels through a finished copy, starts the next copy before the last is done, skips the purge line, or leaves a copy without its unretract and wipe | – |
| [A28](#a28) | Support on the 3D tab: overhangs flagged, a skirt or a wall chosen, the step set in Fine-tuning | a model that reaches out over nothing exporting without a word, a Support choice that doesn't change the print, and an Overhang per layer box that's ignored | – |
| [A29](#a29) | A text of several lines prints a piece for each line, all on one plate, in one G-code file | lines of a text joined by a connector strand when they should print apart, a line left off the plate or out of the file, pieces laid over each other, a piece that isn't one continuous line, and the Trace tab's drawing changing because of how the 3D tab prints it | – |
| [A31](#a31) | The Art tab: one input at a time, traced, or plotted as drawn | an input that doesn't reach the trace, an input that forgets its settings when another is picked, a pattern that loses its one-line promise, art that can't be plotted without a trace, and the input lost by undo or a design file | – |
| [A32](#a32) | Image prep and plotting: grey levels, the background tapped, a picture turned, and art made for plotting | grey levels that don't change the trace, a grey set to Skip that is still traced, a tap that doesn't remove the background, a turned picture that doesn't turn, the printing limits holding back art made for plotting, a plotting pattern traced before it's asked for, and any of it lost by a design file | – |
| [A33](#a33) | The workflow: made for a printer or a pen plotter, Art → Line → Print or Plot, one switch for the line | both last steps showing (or the wrong one), the line switch offering a printer something it can't make, a picture offered As drawn, a picture on the plotter traced into one joined line instead of strokes, a pattern traced when it's plotted as drawn, the preview not following the step, and the Next buttons going nowhere | – |
| [A34](#a34) | Touch and scrolling: number steppers, the preview in view, the settings wheel; fills per grey | a number box without − and +, a stepper that skips its step or limits or doesn't reach the app, the preview scrolling away with the settings, a phone's pinned preview taking the screen or not growing, the wheel leaving several cards open or opening the wrong one, a card jumping away when the others fold, the wheel's off switch not putting the cards back, and filled greys missing from the page or the SVG | – |
| [A35](#a35) | A clean start: the app opens empty, and every example is one tap away | a start that isn't empty, an empty preview that doesn't say how to start, later steps showing an old input while empty, an example chip that loads the wrong kind of input or nothing, and a picture example that leaves a picture pattern in use | – |
| [A36](#a36) | Take a picture: the live camera finds the page, its corners can be dragged, and the photo becomes a clean picture | the camera not opening, the page not outlined, corners that can't be dragged, a photo that isn't straightened or cleaned, the camera left running, the Photo card's settings not cleaning it again, Page corners or Clean up as a photo not working, and a refused camera leaving no way in | 23.7 s |

#### E01

**Line accuracy against known drawings** · `engine/E01-ground-truth.test.js`

- **Why:** The traced line is what gets printed, so it must sit on the drawing. Wobble crept in once without anyone noticing (the line copied the pixel staircase and the refinement step pulled it back onto whole pixels), because the old error number was measured against those same pixels. This test measures against the true geometry instead, so that can't happen again.
- **How:** Draws five scenes whose true line is known exactly (two rings; circles, a box and a diagonal; the leaf's curves; packed rings beside a spiral; filled shapes in Outline mode) and traces each at 500 px with the app's defaults. It measures two lines against the truth, sampled every 0.5 px with connectors skipped: the fitted Fourier series (the trace itself), and the final line after crossing removal (what is printed). Crossing removal deliberately keeps the two passes of a retraced stroke about 0.75 px apart, so the final line is allowed to sit a little further off on scenes with retraced strokes.
- **Pass when:** Fitted series: mean distance ≤ 0.16 px, mean 95th percentile ≤ 0.45 px, no scene's mean above 0.20 px. Final line: mean ≤ 0.24 px, no scene above 0.40 px, ≥ 94% of the truth covered within 1 px. (Measured 2026-10-14: series 0.131 / 0.39 px; final 0.19 px, 96% covered. Before the subpixel line the series was 0.345 / 0.95 px.)

#### E02

**Tightly packed strokes are traced separately** · `engine/E02-packed-strokes.test.js`

- **Why:** Drawings often have lines closer together than the smoothing can resolve (hatching, concentric rings, spirals, lettering). They used to merge into one wide band of ink that was then outlined as a single blob, losing every line inside it.
- **How:** Draws six rings, eight parallel lines and a spiral with strokes 2, 3 and 4 px wide at centre spacings of 4–12 px (only spacings that leave paper between strokes), runs line detection and the walk exactly as the app does, and measures how much of each true line the traced path covers within 1 px.
- **Pass when:** Mean coverage over all cases ≥ 98%, and every case ≥ 88%. (Measured 2026-10-14: 99.4% mean, lowest 91%. Before stroke splitting: 80.6% mean, lowest 25%.)

#### E03

**Filled areas are not broken up by stroke splitting** · `engine/E03-filled-areas.test.js`

- **Why:** Stroke splitting (E02) cuts along light valleys inside dark areas. Inside a pale filled area, faint texture also makes light valleys; a first version cut those too and turned the logo's fills into 50 small outlines. Splitting must only happen where it leaves thin strokes.
- **How:** Draws pale filled shapes with faint darker texture lines and noise inside (like a printed logo), and traces with splitting on and off; repeats on the logo photo if the bench images are present.
- **Pass when:** Splitting on gives the same number of parts as splitting off, and the traced line length changes by under 5%, for the synthetic fills and the logo.

#### E04

**Far-away groups: specks dropped, real elements kept** · `engine/E04-far-groups.test.js`

- **Why:** "Drop far-away parts" exists to remove stray specks. It used to keep only the group around the single biggest piece, so a cluster of rings next to a spiral (seven smaller pieces) was thrown away entirely.
- **How:** Draws five concentric rings on the left, a spiral on the right (well beyond the 12% jump limit) and one short stray mark in a far corner, then builds the walk with the app's default far-part limit.
- **Pass when:** All 6 real parts (5 rings + spiral) are kept, and exactly 1 part (the stray mark) is dropped.

#### E05

**No self-crossings, in the preview and in exported files** · `engine/E05-no-crossings.test.js`

- **Why:** The choc mate 2 can't stop the flow, so every crossing deposits chocolate twice in one spot. Crossings once came back at export time: simplifying the path for the file cut corners across neighbouring strands.
- **How:** Traces the leaf, shapes and smiley samples (plus camera, logo and astronaut photos when present) with crossing removal at "remove all", counts crossings in the final line, then repeats the app's export step (simplify at 0.05 mm, untangle again) and counts crossings in the exported path.
- **Pass when:** Zero crossings in every final line and every exported path.

#### E06

**Minimum line spacing is kept** · `engine/E06-spacing.test.js`

- **Why:** A printed chocolate line is about a needle's width; strands closer than that merge. The spacing setting (or the needle + gap) must hold everywhere in the final line, including between the two passes of a retraced stroke.
- **How:** Traces the leaf, shapes and smiley samples at 100 mm wide with a 1.2 mm minimum spacing (a 0.84 mm needle + 0.36 mm gap) and reads the closest gap between non-neighbouring parts of the final line.
- **Pass when:** Closest gap ≥ 90% of the spacing on every sample (the app's own warning threshold is 80%).

#### E07

**Smallest print size that keeps the spacing, loops included** · `engine/E07-floating-size.test.js` · slow

- **Why:** "Smallest that fits" picks the print size, so a wrong answer wastes chocolate or gives an unprintable design. The search lays out the real print at every size it tries (doubled strokes as two strands, a keyhole loop at each stroke end) so the size it reports is one where the finished line keeps its spacing. It once returned tiny widths that broke the drawing's shape, and once gave High detail a smaller size than Medium depending on what had been run before.
- **How:** Traces the leaf and runs the search with an 18G needle and a 0.5 mm gap (spacing 1.34 mm) for Low, Medium and High detail, twice each, up to the 340 mm plate width. Then traces the leaf at the Medium width the way the app does and measures the finished line, and the share of it the preview shades as pushed off the drawing (more than the medium tolerance from the fitted series); and the same at 80% of the smallest width.
- **Pass when:** Every search reports that the spacing fits; widths are in order Low ≤ Medium ≤ High; repeating a search gives the same width; all widths are between 15 and 340 mm; at the Medium width the finished line has no crossings, its closest gap is at least 90% of the spacing and at most 3% of it is pushed off the drawing; below the smallest width more is pushed off.

#### E08

**Copies are packed on the plate without touching** · `engine/E08-plate-layout.test.js`

- **Why:** Copies are rotated and packed onto the 340 × 232 mm plate. A copy off the plate prints into the air or the frame; copies closer than the chosen spacing flow together.
- **How:** Lays out the leaf at 60 mm (12 and 40 copies), a 380 × 30 mm banner (1 copy; only fits rotated) and the leaf at 420 mm (fits at no angle), with 5 mm spacing and a 0.84 mm line, and checks every placed copy's printed line and footprint.
- **Pass when:** Every point of every placed copy lies on the plate; footprints of different copies are at least the spacing apart; the reported number that fit is never more than requested; a design that fits straight is not rotated; a design longer than the plate is rotated to fit; a design too big at any angle is reported as not fitting.

#### E09

**G-code stays on the plate and is well formed** · `engine/E09-gcode.test.js`

- **Why:** G-code goes to a real machine. Every move must stay inside the 340 × 232 mm plate, use the set height and feed, and extrude a steadily increasing amount — a bad number here crashes the needle or ruins a print.
- **How:** Builds G-code with the engine's export, close to the app's but without the printer's start lines or retraction (plate layout, 0.05 mm simplification, each copy closed, Z 0.3 mm, lift 3 mm, feed 1500, E 0.05 per mm) for 1 and 12 copies of the leaf at 60 mm, then reads every line back.
- **Pass when:** Every X and Y within the plate; no NaN or Infinity anywhere; printing moves at the set Z; E never decreases; the file starts with the units and absolute-mode commands and ends with a lift.

#### E10

**Lettering: height, letters never touching, even spacing** · `engine/E10-text-layout.test.js`

- **Why:** Typed text is printed with a needle-wide line, so neighbouring letters closer than the line width merge into a blob, and uneven gaps look sloppy. Letter height is what the customer asks for ("15 mm letters").
- **How:** Lays out "Happy Birthday" in every bundled font at 15 mm letter height with the app's gap rule (15% of the height, never under 1.2 × a 1 mm line), measures the height of a capital H, and the closest distance between each pair of neighbouring letters within a word in the fonts with separate letters.
- **Pass when:** Capital H within 3% of 15 mm in every font; no two neighbouring letters closer than 1.2 mm in any separate-letter font; in those fonts the closest gaps vary by under 35% (coefficient of variation).

#### E11

**Every export format is a complete, readable file** · `engine/E11-export-formats.test.js`

- **Why:** Exports go into other programs (Illustrator, CAD, plotters, slicers). A file missing its header or end marker is rejected or, worse, half-imported.
- **How:** Exports the traced leaf (100 mm, simplified at 0.05 mm, untangled again) to every file the app offers: the pen-plotter page (SVG for Saxi) on landscape A4 with the drawing centred, plain and smooth; flat DXF; and the zip wrapper. (G-code has its own tests, E09 and E21.)
- **Pass when:** The plotter SVG is 297 × 210 mm with a matching viewBox, one path, every point inside the page and the pen width as the stroke, and the smooth one uses curve (C) commands; the flat DXF has its ENTITIES section, one closed polyline and ends with EOF; zips start with the PK signature.

#### E12

**Background engine gives the same answers as the page** · `engine/E12-background-engine.test.js`

- **Why:** The heavy maths runs in a Web Worker (worker.js) when the browser allows it, and on the page when it doesn't (e.g. opened from disk). Both paths must give identical results, including crossing-area masks, which can't be sent to a worker as functions and are rebuilt from a mask.
- **How:** Loads worker.js in a sandbox the way a browser would (importScripts of core.js, which imports the engine's parts), sends it the app's messages (stageSignal, a step-by-step sweep, stageFinal with a crossing-area mask), and compares each reply with calling the same function directly.
- **Pass when:** The worker announces it is ready; stageSignal and stageFinal replies match the direct calls exactly; the sweep sends one progress message per term count and the same final list; an error in a call comes back as an error message, not a crash.

#### E13

**Tracing time stays within budget** · `engine/E13-speed.test.js`

- **Why:** Every setting change re-traces. The page stays responsive because the work runs in the background, but the result still has to arrive quickly enough to adjust settings by eye. Budgets are about three times the time measured on 2026-10-14, so normal machine differences pass and real slowdowns don't.
- **How:** Times the full trace (detection, walk, fit, crossing removal and measurements) of the leaf sample, the smiley, and the camera photo in Outline mode when present.
- **Pass when:** Leaf ≤ 4 s, smiley ≤ 4 s, camera ≤ 12 s. (Measured 2026-10-14: about 1.2 s, 1.1 s and 3.5 s.)

#### E14

**The settings file is complete and consistent** · `engine/E14-settings-file.test.js`

- **Why:** settings.js is meant to be edited by hand: chocolates, needles, the printer and the starting defaults. A missing comma stops the whole file from loading (the app then falls back to its built-in settings), and a wrong unit or a needle that isn't in the list quietly changes prints. Run the tests after editing the file.
- **How:** Loads web-app/settings.js the way the browser does and checks every entry: chocolates, needles, printer, every starting default (each against the values the app accepts), the starting-point presets, the rules and the engine tuning. It checks types, units and ranges, unique ids, colours written as #rrggbb, that every reference (a chocolate's needle, the default chocolate, needle and font) exists, and that no setting is misspelt or missing.
- **Pass when:** The file loads; every chocolate, needle, printer value and default passes its check. The report names any entry that doesn't, and why.

#### E15

**The theme file defines everything the app draws with** · `engine/E15-theme-file.test.js`

- **Why:** theme.css holds every colour, font and the corner / text / spacing dials, and is meant to be edited by hand. If a name the styles or the preview use goes missing, that part silently falls back to black or transparent; if the two dark-mode blocks drift apart, dark mode looks different depending on how it was switched on.
- **How:** Reads theme.css, app.css and the app's scripts; lists every theme name they use (var(--…) in the styles, any "--…" name in the scripts) and checks each is defined in theme.css; checks the two dark-mode blocks set the same names to the same values; and checks the three dials are numbers.
- **Pass when:** Every name used is defined in theme.css; both dark-mode blocks are identical; --corner, --text and --space are plain numbers.

#### E16

**Stroke ends turn in a round loop, never back over the line** · `engine/E16-stroke-end-loops.test.js`

- **Why:** The needle can't go back over a line it has just laid. Any stroke the line has to travel out and back along is printed as two strands one spacing apart, and at the stroke's end the line turns round in a keyhole loop: a circle of radius r = d (the spacing) whose centre sits r + w/2 back from the end, so the chocolate's outer edge lands where the stroke ends. The loop is 2r + w across; the strands meet it where r·sin α = d/2 and the line runs 360° − 2α round it.
- **How:** Traces the leaf and the shapes sample at 100 mm wide, and "Happy" in the sans font at 20 mm, all with an 18G needle (0.84 mm) and a 0.5 mm gap (spacing 1.34 mm). At every stroke end long enough for a full loop it measures the printed line within 2.2 spacings of the loop's centre: how wide it is across the stroke near the end, and how far its chocolate edge reaches past the drawn end. Also reads the closest gap anywhere and the crossings.
- **Pass when:** At every stroke end the loop is at least 1.6 spacings wide (2 for a full circle; a plain turn-back would be 1), and the chocolate edge lands within half a spacing of the drawn end; closest gap ≥ 90% of the spacing; no crossings.

#### E17

**The line is three real series, x(t), y(t) and z(t)** · `engine/E17-xyz-series.test.js`

- **Why:** The engine writes the line as one real Fourier series per axis: x(t) = x₀ + Σ a_k cos(2πkt + φ_k), the same for y, and z(t) = 0 for a flat print (later the climb of a continuous spiral). The terms are worked out with one complex FFT, so this checks the per-axis form is exact: that the formula shown in The math and saved in the coefficients file is the line that is drawn, and that the G-code reads Z from the line without changing a flat print.
- **How:** Traces the leaf, shapes and smiley samples. Rebuilds each path from all its terms and compares with the path; evaluates x(t) and y(t) term by term from the written formula at 64 points and compares with the line the app draws (same N terms); checks the two offsets come first and the rest are ordered by size. Then writes the leaf's G-code with Z = 0 per point and without any Z, and with a 0–1 mm ramp.
- **Pass when:** All terms rebuild the path within 1e-6 px; the written formula matches the drawn line within 1e-6 px; offsets first, then strongest first; the flat G-code is byte-identical with and without a Z of 0; the ramp G-code climbs to 1 mm above the print height.

#### E18

**Where strokes meet: no crossings, and the full spacing** · `engine/E18-no-crossings-at-junctions.test.js`

- **Why:** Where strokes meet, the line has to pass from one stroke to another. If it picks the next stroke without regard to the strands' sides, the two strands of a stroke swap over and cross, and removing the crossing afterwards reverses a short stretch and leaves a knot. The walk is built as a non-crossing tour instead: at each point only neighbouring strands are joined, each strand sits in the corner it turns round, and the two passes of a stroke keep to opposite sides. Small loops an offset strand makes on the inside of a sharp bend are cut out. Single strokes ease half a spacing into their corner near a junction, so with every strand in its own corner the spacing holds at junctions too, with no slack.
- **How:** Traces the leaf, shapes and smiley samples with an 18G needle and a 0.5 mm gap and counts crossings in the offset path (before the Fourier fit) and in the fitted line (before any clean-up). In the final line it checks there are no crossings and measures the closest gap anywhere, junctions included.
- **Pass when:** Leaf and smiley: no crossings at either stage; shapes: at most 2 (one stretch the walk must cover twice turns back at a junction; the earlier walk had 20). No crossings in the final line, and the closest gap anywhere is at least 90% of the spacing (it was 0.20–0.37 spacings at junctions before).

#### E19

**Round corners: the drawing's sharp corners get the chosen radius, nothing else moves** · `engine/E19-round-corners.test.js`

- **Why:** A needle laying chocolate can't turn on the spot: a hard corner piles chocolate up or drags the line. Round corners sets the tightest turn the drawing may make (a radius in mm). Only corners in the drawing itself are rounded; junctions, stroke-end loops and connectors keep their geometry, because that's what keeps the strands the spacing apart. Smooth curves (a small circle, say) are drawn as they are.
- **How:** Traces the leaf at 30 mm, the shapes sample at 60 mm a square and a triangle at 60 mm, and the same with a five-point star, and rounds each walk to 1, 2 and 3 mm. Measures the tightest turn along the drawn parts (as a circle radius, through points half a radius apart, away from junctions, stroke ends and connectors) and how far any point moved; checks junctions, stroke ends and connectors don't move, the point count is unchanged, and the smiley's round eyes stay as drawn. Then traces the three at 2 mm with an 18G needle and a 0.5 mm gap and reads crossings and the closest gap.
- **Pass when:** Off (0 mm) changes nothing; leaf, square and triangle: tightest turn ≥ 0.85 × the radius at every setting (0.2–0.5 before); the star's points (too sharp to round fully without moving the line more than the radius): tightest turn at least 1.4× wider than before; no point moves further than the radius (so small features like the shapes sample's lettering are softened, not cut away); fixed points don't move; the smiley moves less than a line width; with 2 mm rounding no crossings and a closest gap ≥ 90% of the spacing.

#### E20

**Infill: enclosed areas filled with the same line, one spacing apart** · `engine/E20-infill.test.js` · slow

- **Why:** Infill fills every area the line encloses with more of the same continuous line, one spacing apart, so a design can print as solid chocolate (gap 0) or as an open hatch (a gap). Each area's fill is a set of closed loops merged into one by short bridges, and that loop is bridged into the printed line on a straight stretch, so nothing crosses and nothing is drawn twice. Rings follow the area's edge; Lines are straight rows paired into narrow loops inside one ring.
- **How:** Traces the leaf at 80 mm with an 18G needle, gap 0.5 mm and gap 0, and the smiley at 60 mm with gap 0, with no infill, Rings and Lines. Measures crossings, the closest gap, and how far every point enclosed by the printed line is from the nearest line (99th percentile and worst, in spacings). Then fills the shapes sample with a 'leave small areas open' size and counts what is left open, and compares the error with and without infill.
- **Pass when:** Density 100% (rows a line width apart) with a 0.5 mm gap: no crossings, lines at least 0.85 line widths apart and every enclosed point within 0.9 line widths of a line for 99% of the area with Lines, 1.1 with Rings (solid); 50%: within 1.6. With infill: no crossings, closest gap ≥ 90% of the spacing, every enclosed point within 1 spacing of a line for 99% of the area (about 4–8 spacings without infill) and within 1.6 at worst; at least one area filled. Leaving areas under 80 mm² open on the shapes sample leaves some open and fills fewer; the error with infill is within 0.1 mm of the error without.

#### E21

**Layers: flat filled base, spiralling walls, one continuous 3D path** · `engine/E21-layers.test.js`

- **Why:** The choc mate 2 can't stop the flow, so the whole object is one path. A filled base prints flat (its layers are different paths, so they can't spiral onto each other), stepping up one layer height between layers. The walls are the same line every lap, so they spiral: every point one layer height above the same point of the lap below, with no seam. The first spiral lap climbs off the flat layer below, so its flow ramps up from nothing; a last level lap evens the rim, its flow ramping down. Copies print one after another, the needle lifting above everything printed before travelling.
- **How:** Traces the leaf at 50 mm with an 18G needle and 0.5 mm gap, with Lines infill (and the rows turned 90°) for the base and without for the walls, and stacks 2 base + 5 wall layers at 0.3 mm. Checks each lap's height and flow, the height difference between matching points of consecutive wall laps, that the path never breaks, and the total height. Repeats with no base and with an open path. Then writes G-code for 2 copies and reads back Z, E and the moves.
- **Pass when:** Base laps flat at 0, 0.3 mm; wall laps rise exactly 0.3 mm per lap with every point 0.3 mm above the lap below (within 1 µm); first spiral lap's flow goes 0 → 1, the last level lap's 1 → 0, all others 1; no step between points longer than 3 mm inside a copy; height = (layers − 1) × 0.3 mm; without a base the first wall layer is flat; open paths alternate direction, each layer flat, stepping straight up one layer where it turns, full flow; G-code: Z never above the top + lift, travel only between copies (2 G0 moves each) and E never decreases.

#### E22

**Pen fills: the areas the pen line closes off, hatched one pen per layer** · `engine/E22-pen-fills.test.js`

- **Why:** On the 2D tab an area picked for a fill pen is hatched with straight strokes (the pen lifts between them). The strokes have to fill the area right up to the outline without their ink running over it, keep to the area that was clicked even where a line divides two areas, and land in their own layer of the SVG and DXF so the pen can be changed between layers.
- **How:** Draws a 40 × 20 mm box divided down the middle, as the pen line does it (one continuous line, the divider drawn out and back). Finds its areas; fills the left half with a 0.5 mm pen at 0.5 mm spacing (solid), then at 45° with cross-hatch and 2 mm spacing; checks every stroke against the box and the divider. Writes the page SVG and the DXF with two fill pens. Then stops the divider 1.5 mm short of the edge and adds a 3 × 3 mm cell in a corner, and tries Close gaps at 1 and 2 mm and Smallest shape at 10 mm². Fills the left half with contours 1 mm apart, and a 40 × 20 box with vertical hatching that follows a black-to-white gradient (white beyond 30 mm).
- **Pass when:** Two areas besides the outside; a point in each half finds its own area and a point on the divider finds one of them; every solid-fill stroke stays in the left half with its ink clear of the outline's (centre at least 0.5 mm from the line, within the 0.05 mm grid) and reaches to within 0.1 mm of that limit; rows are exactly 0.5 mm apart and run from one fill limit to the other (within 0.1 mm); the cross-hatch has strokes both ways, all in the left half; the SVG has 3 layers with the pens' colours, the DXF a PEN2 and a PEN3 layer. Close gaps leaves the 1.5 mm gap open at 1 mm and closes it at 2 mm with one bridge from the divider's end, 1.5 mm long; Smallest shape at 10 mm² joins the corner cell to the half next to it, so a click in it fills that half. Contours: 9 or more rings in the half, all inside it and clear of the outline's ink. Tone: under a black-to-white gradient, the darkest strip gets over 2.5 times the ink of a light strip, and no stroke reaches where the image is white.

#### E23

**Models: STL slices become one fitted line per layer, stacked into a spiral** · `engine/E23-models.test.js`

- **Why:** A sliced model has to print the model: the chocolate's outside edge on its surface, every part and hole of a layer joined into the one line the needle can't stop, as many layers as the height holds, and each layer starting where the last one ended so the walls spiral up without a jump.
- **How:** Builds a 20 mm cylinder (64 sides), a 10 / 8 mm tube, two 5 mm posts 20 mm apart and a cone, as binary STL (and the cylinder as ASCII too). Reads them, stands them on the plate, slices them at 0.3 mm with an 18G needle (0.84 mm line, 1.34 mm spacing) and fits each layer with a series (0.05 mm). Measures radii, loops, connectors, layer counts, the start of each layer and the filled base. Then a 40 mm disc with 3 walls, and filled at 100, 50 and 25%, and a solid 24 mm cylinder at 25% on a 2-layer base.
- **Pass when:** Binary and ASCII read the same 384 triangles; a slice of the cylinder is one closed loop; its fitted line sits half a line width inside the surface (9.58 mm ± 0.05, the 64-sided polygon's middle) in under 20 terms; the tube's layer is its outside only (1 loop, no connector, nothing on its inner wall at 8.42 mm; was both walls until October 2026), its line at 9.58 mm; the posts' layer joins both posts; layers = ⌊(20 − 0.8) / 0.3⌋ + 1 = 65; each layer starts within 0.3 mm of the one below; a 2-layer filled base is longer than the wall; the cone's walls shrink from about 14.6 to 5 mm. A 40 mm disc with 3 walls has 3 loops joined by 2 connectors, the innermost 16.9 mm out; its fill at 50% is 35–65% as long as at 100%, at 25% under 40%; a solid model at 25% fills its wall layers (over 1.5× a hollow layer) while its base stays solid (over 1.5× a 25% layer).

#### E24

**3D → 2D: a model drawn as lines, hidden lines removed** · `engine/E24-hidden-lines.test.js`

- **Why:** Draw this view turns a model into a line drawing to trace (after plotter.vision). Only what you'd see should be drawn: the outline, open edges and folds, with everything behind the model removed, and no lines where the mesh splits a flat face into triangles.
- **How:** Draws a 30 × 20 × 10 mm box, a cone and a torus seen from the preview's starting angle (yaw −0.6, pitch 0.55) at 600 px, with folds over 1° and over 30°, and counts the visible pieces of edge.
- **Pass when:** The box shows 9 of its 12 edges (the 3 at the back corner are hidden) and none of its 6 face diagonals; the cone at 30° is its outline and rims only (under 120 pieces, far fewer than at 1°), and at 1° shows the side's facets; the torus at 30° has a line in every direction round its centre (its outline has no gaps).

#### E25

**The engine's parts load in the same order everywhere, and share helpers only through 00-util.js** · `engine/E25-engine-parts.test.js`

- **Why:** The engine is split into one file per stage so problems are easy to find. The page loads the parts itself (index.html), a Web Worker and Node load them through core.js, and the build copies every file in source/engine. All three must agree, and each part must only use its own helpers, the public UNB functions, or the shared ones in 00-util.js.
- **How:** Reads the part list in core.js, the engine <script> tags in web-app/index.html and the files in source/engine. Then, for each part, collects its own top-level helper names and looks for them in every other part.
- **Pass when:** The three lists hold the same parts in the same order (core.js and index.html), every part file on disk is listed, and no part mentions another part's private helper by name.

#### E26

**Edge cases found in the October 2026 bug hunt stay fixed** · `engine/E26-edge-cases.test.js`

- **Why:** Each of these was a real bug found by an independent review: a crash or a near-hang on a full stop in a small font, a wrong plate footprint, a strand kinked at the seam of a closed line, a broken wall on a model with a hole, a plotter drawing with gaps, a valid STL that wouldn't open, and a page that froze on Smooth curves or Smallest shape.
- **How:** Builds the smallest input for each case and checks the result: a one-pixel line map through buildWalk; minBox of three points in a row; mirror of 0 and 1 points; offsetDoubled of a closed square with only the edges before the seam doubled; sliceMesh of an open folded wall listed out of order; chainSegments with ends either side of a cell boundary; a binary STL with 16 padding bytes; toBezier of an 8000-point spiral 40 mm wide; penFills with Smallest shape on a grid of 6400 cells.
- **Pass when:** No walk (null) for one pixel; the straight line's box is 12 × 2; mirror returns the points as given; the seam point is offset the same at both ends; one open chain of 9 points; the two segments join into one line; the padded STL reads 4 triangles; the spiral smooths in under 1 s; the grid's shapes merge in under 2 s.

#### E27

**Each field of the app's shared state is set by its owner** · `engine/E27-state-owners.test.js`

- **Why:** The app's files share one state object (st). When any file can change any field, a wrong value could come from anywhere. Each field has an owner (the table at the top of this test, also in web-app/README.md); only the owner sets it, plus config.js for starting values and history.js when a design is put back.
- **How:** Reads every file in web-app/js and finds each place that sets a field of st (st.x = …, st.x++, st.x.push(…), and nested fields like st.model.yaw). Compares the file with the field's owners.
- **Pass when:** Every field set anywhere is in the table, and only its owners (or config.js / history.js) set it.

#### E28

**G-code starts, stops and moves between copies the way choc OS does** · `engine/E28-retraction.test.js`

- **Why:** choc OS (the choc mate 2's own slicer) writes files the printer is known to print well. Its sample file (source/printer/choc-mate-2/sample) shows the recipe: the needle size for the printer, a purge line, a slow pull-back before travelling, a push forward and the printer's pause before printing, and a wipe that pulls back while finishing the line. The tracer's files should follow the same recipe, with the plunger speed set by the needle.
- **How:** Measures choc OS's own files: E per mm and the length of the wipe move in its Welcome, and E per mm in the same Welcome made with three needles (two copies each). Then writes G-code for two copies of a 40 mm square (4 layers, as layerStack would close them) with the choc mate 2's settings.js values, and reads it back.
- **Pass when:** E per mm from the formula (needle × layer height ÷ cartridge area) is within 1% of choc OS's, for its 0.84, 1.19 and 1.60 mm needle files too; the start lines carry the needle size and the purge line; the first copy is preceded by a retract and the first-unretract offset; each copy starts with an unretract and the pause; each copy ends with a wipe along its own line, as long as print speed × wipe time (choc OS's own wipe is the same length), pulling back exactly the retraction; E only grows while printing; travel moves extrude nothing. Time per layer: a lap too quick for 20 s is slowed until it takes 20 s (F480 for a 160 mm lap), or counted when it would have to go below the floor, and the G-code carries that feed. Read back for the preview, the file gives walls, fill, travel, the purge line along the back edge and a wipe per copy.

#### E29

**Engine fixes from the October 2026 code review stay fixed, and models can be cut** · `engine/E29-review-fixes.test.js`

- **Why:** Found by the review in REVIEW.md. Junction distances were only recorded 40 px out, but single strokes ease over twice the spacing, so past a 20 px spacing the ease stopped short and the line jumped up to 4 px. The error compared the drawn line with the drawing's centre line, which doubled strokes sit half a spacing off on purpose (the leaf read 0.47 mm). Each loose end ran a route search over the whole image with lanes painted.
- **How:** A circle with one spoke, offset at 10 and 30 px spacing: the largest change in offset between neighbouring single-stroke points. The leaf traced at 37 mm with a 1.34 mm spacing: its error. A comb of 64 teeth (128 loose ends) on a 400 px grid, walked with and without a painted lane: the time and the points. A 20 mm cone (point on top) sliced whole and cut 2 mm from the bottom and 8 mm from the top. A tube with a 1.5 mm wall. A 32 mm heart outline filled with rings at 25% (found printing a heart in October 2026: a ring that neither ran beside the others nor came near the line was left out). A 10 mm cylinder with a block overlapping its side where its outline starts (found with a mug and its handle: the body's first point fell inside the handle, so the body counted as a hole and only the handle printed).
- **Pass when:** Offset changes at most 1 px between neighbours at both spacings; the walk records junction distances at least 120 px out; the leaf's error is under 0.15 mm (a third of the old reading); the comb with a lane walks in under 1.5 s and covers at least as many points as without; the cut cone is 10 mm tall in 33 layers, its top layer at least 3.3 mm in radius and its first at least 8.3 mm; the tube prints one loop at radius 9.58 ± 0.1 mm (its outside only); the heart's line is at least 210 mm (203 with the ring left out); every layer of the cylinder + block prints at least the cylinder's outline (60 mm, not just the block's 16).

#### E30

**Support: overhangs measured, and held up by the print's own wall (a flared skirt or a thin wall)** · `engine/E30-support.test.js`

- **Why:** October 2026: one continuous line can't print a separate support, so the support is the outside wall widened from the plate up and stays on the piece. Overhangs found in the challenge prints (a pawn's collar 0.62 mm a layer) went unflagged. Tried and dropped along the way: a skirt that shrank evenly from every edge (a standing r's arm thinned away and dropped to the plate as a block), a skirt + small wall standing apart from the model (a second island the line joined on every layer, a web across the gap), and a straight wall under the whole overhang (the r became a block; v88 replaced it with the thin wall, the same chocolate since only outsides print).
- **How:** A standing letter r (a 7 mm arm on one side of a 3 mm stem, 13–16 mm up, 5 mm deep), a mushroom (a 4 mm stem under a 14 mm cap) and a T (a flat 11 mm arm each side of an 8 mm post), sliced at 0.3 mm with a 0.84 mm line and a 1.34 mm spacing, a step of 0.28 mm (a third of the line): without support, with a skirt and with a thin wall. Measures the worst step-out left (UNB.modelOverhang over the printed outlines), the layer count, how much was added, how many layers join a second loop, and how wide the r's thin wall is near the plate.
- **Pass when:** Without support the mushroom reaches out more than 1 mm at the cap; with either support the worst step left is at most 0.5 mm (the step plus grid rounding) and no layer is lost (73, 66 and 53 layers); no layer of any supported model joins a second loop; the r on a skirt is a brace (it stops at least 4 mm above the plate); the r on a thin wall reaches the plate, and 2 mm up its middle is at most 3 mm deep (the arm is 5; one narrow loop is 2.18); the mushroom's thin wall is its skirt (round: the middle is the stem).

#### E31

**Text pieces: a line map per line of text, and different pieces packed on one plate** · `engine/E31-text-pieces.test.js`

- **Why:** A text of several lines can print as a piece per line (A29): each line is traced from its own line map (UNB.rasterText's lines), and the pieces, all different sizes, are laid out together on the plate (UNB.plateLayoutPieces), several sets of them for copies.
- **How:** Lays out three lines (and one line, and a text with an empty line) in the sans font and rasterizes them; compares the line maps with the whole one. Packs three boxes of different widths on a 200 × 150 mm plate, one and two sets; packs two pieces too long for a narrow plate; packs more pieces than fit.
- **Pass when:** One line map per line with letters (none for one line; the empty line gets none); together they hold every pixel of the whole map and no pixel is in two; the whole map is the same as without the line maps; packed pieces are in reading order, set after set, inside the plate, never overlapping, at least the gap apart in a row; pieces too long are turned 90°; pieces that don't fit are still placed (off the plate) and counted out of fits.

#### E33

**Geometric art: every style draws the line it promises, and the one-line styles trace as one line** · `engine/E33-geometric-art.test.js`

- **Why:** The Geometric art card makes patterns as pictures to trace (UNB.pattern, source/engine/13-patterns.js). Labyrinth, Moore loop and Double spiral promise one closed line, and Hilbert, Gosper, Whirl and Waves one open line, with an even gap between neighbouring lines: that is what makes them print in chocolate without doubled strokes. The app draws them with UNB.patternLayout and starts them at the width where that gap is the line spacing.
- **How:** Makes every style at its starting values and at both ends of its sliders (and with other sides and shapes where it has them); checks each path's points, its crossings (a loop's closing step included) and the closest approach of non-neighbouring parts against the gap it reports; makes the seeded styles twice with one seed and once with another; measures how much line the picture patterns put in dark and light parts of a test portrait; follows each crossing style's exact line at 100 mm and prints it with and without Allow overlaps; then draws each one-line style at the app's size and traces it with the app's defaults at the working resolution for the width where its gap is the line spacing.
- **Pass when:** Every pattern has points and a box; the one-line styles are one path with no crossings and nothing closer than 0.75 × their gap; the same seed gives the same pattern and another seed a different one; a pattern drawn from a picture needs one, and, at fine detail, puts at least 1.25 × as much line per area in the dark parts of a test portrait as in the light ones; every one-line style traces as 1 part with no doubled strokes (under 1% of the walk) and no connectors; Spirograph, Lissajous and Rose are one line each, and followed exactly they print with their crossings kept under Allow overlaps (nothing else closer than 0.9 × the spacing) and with none left without it.

#### E34

**Grey levels: a picture as a few flat greys, their edges as lines, and the background removed from a tap** · `engine/E34-grey-levels.test.js`

- **Why:** The Image prep card can reduce a picture to 2–6 flat greys (UNB.levels) and trace the edges between the greys you pick (UNB.levelEdges); Tap the background floods the background from the point tapped (UNB.prep's bgAt). Patterns made for plotting go up to each setting's plotMax, printing keeps max.
- **How:** Makes a picture of five flat greys (bands, two discs and a square) with and without 1% specks; finds 5 levels, without and with Smooth blocks; traces the edges of every level, of the darkest only, and of none; preps a picture whose grey background is cut off from the border by a frame, with the border flood and with a tap inside; traces the levels picture through the app's stages. Then makes every pattern at its plotting limit and checks the printing limit still clamps.
- **Pass when:** The five greys are found within 6 of the truth; with Smooth blocks (2 px) no pixel differs from all four neighbours, without it the specks are still there; the darkest disc's edge is a closed ring as long as its circumference (±15%), and no edges come when no grey is traced; the tap turns the framed background white where the border flood can't; the levels picture traces (one walk, from the edges); every pattern at its plotting limit is under 2.5 million points and made in under 3 s, and without plot the setting is clamped to the printing limit.

#### E35

**Separate strokes: a line map as strokes the pen draws one by one** · `engine/E35-separate-strokes.test.js`

- **Why:** On a pen plotter the Line step can trace the art into separate strokes instead of one continuous line (UNB.lineStrokes, UNB.stageStrokes): the pen lifts between them, so nothing is joined or doubled.
- **How:** Draws a line map with a ring, a T (three strokes meeting), a 3-pixel speck and a slanting line; traces it into strokes with a minimum length of 8 px; checks the count, the ring, every point against the line map, and the pen's travel against the same strokes in reverse order.
- **Pass when:** 5 strokes: the ring as one closed stroke, the T as three, the slanting line as one; the speck dropped; every stroke point within 1.5 px of the line map; the strokes drawn add up to the line map's pixel count within −15% … +25% (smoothing cuts the pixel steps short); the travel between them is no more than in the reverse order.

#### E36

**Fills per grey: each grey level's blocks filled with its own style, inside its edges** · `engine/E36-level-fills.test.js`

- **Why:** Making it for a pen plotter, a grey level set to Fill or Both has its blocks filled with its own pen (UNB.levelFills): hatch, cross-hatch, rings stepping in from the edge, or the Pattern card's pattern cut to the blocks. The blocks are exactly the grey's pixels, so a grey that isn't traced still stops its fill at its edges.
- **How:** Makes a label map with a disc, a band and the paper; fills the disc with hatch (5 px, 0°), cross-hatch, rings (4 px) and a Labyrinth pattern, and the band with hatch at 90°; fills a level that has no pixels; checks every stroke point against the label map and the inset, the hatch rows' spacing and direction, the cross-hatch's two directions, the rings' count against the disc's radius.
- **Pass when:** Every point of every fill lies on its own grey, at least the inset (1 px) inside its edge; the hatch's rows run at 0° (or 90°), 5 px apart (±0.6 px); cross-hatch has rows both ways; the rings step in about radius ÷ spacing times (±2); the pattern's strokes all lie on the disc and there are more than 5 (one closed maze cut by the disc); an empty grey draws nothing.

#### E37

**Photos: the page found in a photo, straightened, and cleaned for the line** · `engine/E37-photos.test.js`

- **Why:** Take a picture (v110) photographs a drawing, a print or an object, often at an angle and in uneven light. UNB.findPage finds the page (the largest light, plain area: its four corners, made exact along each side's edge), UNB.photoPicture flattens it to a rectangle (UNB.warpQuad) and UNB.photoClean evens out the paper's light, makes the paper white and the ink black, darkens faint lines and removes specks; an object's colours are stretched and balanced instead.
- **How:** Makes a 640 × 480 photo of a page seen in perspective on a dark table, with light falling off by 45% across it and camera grain; the page has a circle, a line and a faint pencil stroke. Finds the page, makes the picture as a drawing and compares it pixel by pixel with the drawing as drawn. Then three in harder light (a grey table and 45% falloff, a darker table and 70%, a light grey table), a photo where the paper fills the frame, one of only the table, and a dim, blue-tinted photo of an object.
- **Pass when:** The page is found, each corner within 3 px; the picture is the page's shape (width ÷ height within 5% of the page's); at least 95% of the ink is dark (below mid grey) and under 1% of the paper is; the paper's 5th percentile is white (≥ 235) though the photo's paper is down to ~130 in the shadow; the faint stroke comes out darker than it was on the photo; the three in harder light are found, corners within 3 px; the photo filled by paper and the photo of only table are not taken for a page; the object's picture spans black to white with its wall's colour balanced (channels within 12 of each other).

#### A01

**The app opens and traces the sample** · `app/A01-loads-and-traces.test.js`

- **Why:** The most basic promise: open the page and see a traced line. Any script error, a missing engine file, or a background engine that fails to start shows up here first.
- **How:** Opens web-app/index.html from a local web server, waits for the first trace to finish, and reads the corner label, the background workers, the default tab, the line setting and the error log. The app opens set for chocolate (line width 0.84 mm from the 18G needle + 0.5 mm gap), which draws out-and-back strokes as two strands 1.34 mm apart; that separation is on purpose, so tracing accuracy is read with Line spacing at 0.
- **Pass when:** No page or console errors; opens with a 0.84 mm line width (18G) and 0.5 mm gap, and the closest gap in the trace is at least 1.34 mm (to 0.01); with spacing off the label shows a term count and an error under 0.3 mm (about a working pixel at 100 mm wide); at least one background worker is running; the Trace tab is shown.

#### A02

**The page stays responsive while tracing** · `app/A02-responsive.test.js` · slow

- **Why:** Tracing a photo takes seconds. That work runs in background workers so sliders, buttons and scrolling keep working; if something heavy slips back onto the page, the app stutters and feels broken.
- **How:** Measures the longest gap between 10 ms timer ticks on the page while applying the Photo, Line drawing and Lettering presets and while dragging the threshold slider through 17 positions, each until the trace is finished.
- **Pass when:** Longest freeze ≤ 200 ms in every case (a preset over it is measured once more, and the better of the two counts), and the app is not stuck in "working" afterwards. (Measured 2026-10-15: 46–110 ms alone, up to about 160 ms when the machine is busy; the limit leaves room for that. Before background workers: 260–580 ms.)

#### A03

**Line width, gap and needle settings hold in the trace** · `app/A03-line-spacing-needle.test.js`

- **Why:** The printer's needle (inside diameter) is the line width, and line width plus the gap between lines sets how far apart printed lines must be. The needle is picked on the 3D tab, the width and gap are on the Trace tab's Line card; they have to agree, turn into the right spacing, and the trace has to honour it, with no crossings.
- **How:** Steps through the 18G needle + 0.5 mm, 16G + 0.5 mm (picked on the 3D tab), 16G + 0.2 mm, and a typed 1.0 mm width + 0.2 mm, reading the line width box, the needle menu, the spacing, the closest gap in the trace and the crossings.
- **Pass when:** Picking a needle sets the line width to its diameter; typing a width no needle has shows Custom; spacing equals width + gap in every step (to 0.01 mm); the closest gap is at least 90% of it; zero crossings; no page errors.

#### A04

**Text source: fonts, readable height, five-line limit** · `app/A04-text.test.js` · slow

- **Why:** Typed text has its own rules: letters too small for the line width become blobs, so the height is raised to a readable minimum (8 line widths, 10 for the thin script fonts) with a warning; more than five lines is refused; every font must trace.
- **How:** Switches to Text, types six lines, asks for 3 mm letters at a 1 mm line, then traces "Choco love" in every font.
- **Pass when:** Only five lines are kept; 3 mm is raised to the font's minimum with a warning; every font traces with zero crossings and no page errors.

#### A05

**Plate, copies and G-code export, end to end** · `app/A05-plate-gcode.test.js`

- **Why:** The 3D tab is where a design becomes a print: it must say truthfully whether the design fits, pack copies, and export G-code whose every move is on the plate. E08 and E09 test the maths; this tests what the user actually clicks and downloads.
- **How:** Sets Lettering at 40 mm (wider than the plate straight), reads the mini-map, opens the 3D tab, asks for 12 copies of the leaf, exports the G-code preview and reads the downloaded file.
- **Pass when:** The 356 mm lettering is reported as fitting rotated; the mini-map agrees; 12 copies are reported as fitting; the downloaded G-code has 12 lift-and-lower sequences and every X/Y on the 340 × 232 mm plate; no page errors.

#### A06

**View menu works on desktop and phone widths** · `app/A06-view-menu.test.js`

- **Why:** All display options live in one View menu. It must open fully on screen at desktop and phone widths, its toggles must work, and it must close the way people expect (click outside, Esc).
- **How:** At 1300 px and 390 px wide: opens View, checks the panel is fully on screen, switches line view and background, turns the plate mini-map off and on, closes with an outside click and with Esc.
- **Pass when:** At both widths: panel fully visible; mini-map hides and comes back; outside click and Esc both close the menu; no page errors.

#### A07

**Undo, redo, and saving and opening designs** · `app/A07-undo-design-files.test.js` · slow

- **Why:** Undo is the safety net while experimenting, and a saved design file is how work is kept and shared. Both must restore exactly the same trace, image designs and text designs alike, and opening a file must itself be undoable.
- **How:** Changes the threshold, then loose ends; undoes twice and redoes once, comparing each state with the original; saves the design, changes everything with the Photo preset, opens the file; does the same with a text design; undoes the open; opens a design saved with the speed in mm/min; tries to open a file that isn't a design.
- **Pass when:** Each undo/redo returns exactly the earlier trace and settings; reopened image and text designs match what was saved; undoing an open returns the previous design; a design saved with the speed in mm/min opens in mm/s; a wrong file gives a clear message; no page errors.

#### A08

**Optimize tracing improves or keeps the trace, and undoes cleanly** · `app/A08-optimize.test.js` · slow

- **Why:** Optimize tracing tries tracing settings for you and shows a before/after. It must never hand back something worse, must say what it changed, and Undo must put every setting back.
- **How:** With the 18G needle on the leaf, runs Optimize tracing, reads its result, applies Undo and compares the settings with the starting ones; then runs it on the Lettering preset.
- **Pass when:** Each run finishes with either an improvement ("Closer to the image … → …" with a lower number) or "already the best"; the result has no crossings; Undo restores threshold, smoothing, specks and loose ends; no page errors.

#### A09

**Select area and erase tools** · `app/A09-tools.test.js`

- **Why:** Selecting part of an image and erasing stray lines are the main hand edits. Line detection now runs in the background, so the selection and erase marks must be passed along correctly and undone cleanly.
- **How:** Drags a rectangle over the top right of the leaf and applies it, clears it, brushes an erase stroke across the middle, then uses the erase tool's Undo.
- **Pass when:** Selecting changes the traced parts and clearing restores the original; the erase stroke cuts the leaf into more parts and its Undo restores the original; no page errors.

#### A10

**Works without background workers, with the same result** · `app/A10-without-workers.test.js`

- **Why:** Browsers don't allow background workers for pages opened straight from a folder (file://), and some embedding pages block them. The app then runs the same engine calls on the page itself; it must still work and give the same trace.
- **How:** Opens the app over http (workers) and from disk (no workers), lets each trace the sample, and compares the corner labels and crossing counts.
- **Pass when:** Over http at least one worker runs; from disk none do; both traces show the same terms, error and crossings; no page errors in either.

#### A11

**The app follows settings.js, and survives a broken one** · `app/A11-settings.test.js`

- **Why:** settings.js is where chocolates, needles, the printer and the starting defaults are edited. The app must show what the file says, apply a chocolate's print speed and needle when it's picked, and E per mm from the needle, and keep working (on built-in values, with a clear message) if the file has a mistake.
- **How:** Opens the app and compares the needle and chocolate menus, the default chocolate and its G-code feed with settings.js; checks E per mm against choc OS's for the 0.84 mm needle and that it scales with the needle; picks each chocolate in turn and checks the feed, line colour and details line; then serves a settings.js with a syntax error, one with a bad chocolate entry, and one with fourteen starting defaults and a rule changed.
- **Pass when:** Menus match the file; each chocolate sets feed = print speed × 60, changes the preview colour and shows its price per 100 g; with a broken file the app still traces, uses the built-in needles and says settings.js couldn't be read; a bad entry is skipped and named in the 3D tab; every changed default shows up on its control and the changed rule is followed; no other page errors.

#### A12

**One interface: every control on its tab, less-used cards start folded, one level only** · `app/A12-one-interface.test.js`

- **Why:** There is one interface (Simple / Advanced was removed in October 2026): each tab shows all its controls, with the less-used ones folded into 'More…' groups so the panel stays readable, and the explanations on the page under the controls they explain.
- **How:** Opens the app at desktop and phone widths: no level switch; the main controls of each tab visible; the Input card reads top to bottom; Save / Open in a File menu that opens and closes like View; connector jumps in the readout; explanations behind ⓘ on the Trace tab; warnings visible; Image prep, Shading and Fine-tuning start folded and open to their controls; the 3D tab's cards in order; no menus inside cards; on a phone, every card open, nothing wider than its card.
- **Pass when:** No level switch; every listed control visible on its tab; each folded card opens to all its controls; ⓘ explanations and warnings on the page; no details menus inside cards; on a phone nothing is wider than its card; no page errors.

#### A13

**One size slider: never below the smallest that fits, marks for detail, bigger prints traced finer** · `app/A13-size-slider.test.js`

- **Why:** The print size and the detail it can hold are tied together: the needle and gap set how close lines may run, so a small print loses fine detail and a bigger one keeps more. One slider makes that a single move. Its low end is the smallest size where the finished line (strands, stroke-end loops) keeps the spacing; marks show where medium and high detail start; the far end is the widest that fits on the plate. A bigger print is also traced from the image at a finer resolution, so it really gains detail.
- **How:** Opens the app (leaf sample, 18G needle + 0.5 mm gap) and waits for the size marks. Reads the marks and the opening size; drags the slider far up and checks the width, the working resolution and the spacing; types 5 mm and checks it lands on the smallest; clicks the high-detail mark; checks the hint and that there are no page errors. Repeats the first checks at phone width, where the mark labels must not run into each other (the marks take turns below and above the track).
- **Pass when:** Marks in order smallest < medium < high < plate, left to right; opens on the medium mark; the slider far up gives a print over 80 mm, traced finer than the base resolution, with no crossings or tight spots; typing 5 mm gives the smallest; clicking high gives the high width; marks alternate below and above the track, labels in a row don't overlap and none sits on the slider, at both widths; no page errors.

#### A14

**Layers: a base and an infill on the 3D tab, walls as Design draws them; the G-code climbs** · `app/A14-layers.test.js` · slow

- **Why:** Fill helps a print stand up, so it lives with the layers on the 3D tab: a Base (filled layers at the bottom, 0 by default) and an Infill (inside the layers above, 0% by default: hollow). Each has a density (100% puts the rows a line width apart, touching), a pattern, and for Lines an angle and how many layers keep it before turning 90°. Design is the drawing alone, so its trace must not change, while the 3D tab and the G-code show the layers.
- **How:** Opens the app, sets the leaf to 60 mm, notes Design's term count, goes to the 3D tab: 0 base layers and one layer 0.3 mm tall. Sets 2 base layers and 6 above; reads the readouts and the preview; puts the layer slider on layer 2 and makes the print taller; exports G-code and reads its Z range; types a height of 10 mm, then undoes. Sets the base density to 50% and 0%, then Rings at 100%; sets the infill to 30% and reads the line of the layers above and the turning angles.
- **Pass when:** Design shows no base or infill controls and its term count doesn't change; 0 base layers and one 0.3 mm layer to start; 2 base layers are filled at 100%; 8 layers, 2.4 mm; the preview shows the filled base; the slider shows every layer again after the print changes; printing Z from 0.3 to 2.4 mm; 10 mm gives 31 layers above (9.9 mm) and undo goes back; 50% makes the base line under 0.85 × as long, 0% leaves it open; Rings fills at 100% and hides the angle; 30% infill puts over 1.3 × as much line in the layers above, and the infill turns 45, 45, 135, 135, 45°; no page errors.

#### A15

**2D tab: the pen line on the page, SVG for Saxi (and the DXF for choc OS on the 3D tab)** · `app/A15-pen-plotter.test.js` · slow

- **Why:** A pen plotter (the AxiDraw, run through Saxi) can lift and go over a line twice, so the 2D files should hold the traced drawing itself, not the version spread apart for a nozzle. Saxi plots the SVG at the size it says, so the page has to be the paper chosen, in mm, with the drawing where the preview shows it.
- **How:** Opens the app, sets the leaf to 60 mm and goes to the 2D tab. Measures how much of the pen line runs back over itself (points within 0.1 mm of a stretch of line at least 3 mm further along) against the same measure for the chocolate line. Picks US Letter portrait, exports the SVG and reads its page size and coordinates; exports the DXF for choc OS from the 3D tab. Then picks A5 with 70 mm margins and reads the warning; a 40 × 40 mm custom paper (smaller than the drawing) and reads what the view frames; then the printer plate as the paper.
- **Pass when:** The pen line goes back over itself where the leaf's veins are (over 5% of its points) and the chocolate line doesn't (under 1%); the SVG page is 215.9 × 279.4 mm with a matching viewBox, one path, every point inside the margins; the DXF downloads as a zip holding one closed curve; A5 with 70 mm margins warns that it's too big; on paper smaller than the drawing the view frames the whole drawing and the paper, in the canvas's shape; Printer plate gives the plate's size, named in the note; no page errors.

#### A16

**2D tab: shapes to click and fill, one pen per layer** · `app/A16-pen-fills.test.js` · slow

- **Why:** Fills on the 2D tab are picked by clicking areas on the page: the chosen pen fills the area, the same pen clears it, another pen takes it over. Each pen must end up in its own layer of the SVG so the pen can be changed between layers in Saxi, and every change must undo and save with the design like any other.
- **How:** Opens the app, makes it for a pen plotter, sets the leaf to 60 mm on the Line step, goes to the Plot step and clicks the blade with Pen 2. Adds Pen 3 and clicks the blade again, then again, then once more. Undoes and redoes the last click. Exports the SVG and reads its layers. Removes Pen 3 and reads what's left. Checks a click outside the leaf does nothing. Then sets Close gaps to 4.9 mm, counts the shapes, turns on Draw bridges and exports the SVG again, drags across the blade and undoes back. Finally loads a picture of an outlined light-red circle, light-blue square and white triangle, adds a blue pen and presses Colour from image.
- **Pass when:** Pen 2's click fills the blade (hatch strokes on the page); Pen 3 takes the area over (still one filled area); clicking it with Pen 3 again clears it, and once more fills it; a click outside the drawing changes nothing; undo goes back a step and redo forward; the SVG has 2 layers (drawing, Pen 3) with Pen 3's colour on the fill; the design state holds the fills; removing Pen 3 removes its fill; Close gaps splits the blade into at least 3 more shapes, the shapes are tinted, drawn bridges are a second path in pen 1's layer, undo opens the gaps again; dragging across the split blade fills 3 or more shapes and one undo takes it back; Colour from image gives a light-red circle the red pen and a light-blue square the blue pen and leaves a white triangle empty; the Design tab's readouts are untouched; no page errors.

#### A17

**3D models: load an STL, turn it, slice it on the 3D tab, set its height, export** · `app/A17-models.test.js` · slow

- **Why:** A 3D model is a source like an image: picked in Design, turned to the side it should print on, then sliced and fitted on the 3D tab, where its height is set and the G-code comes from. Undo has to cover turning it, and going back to an image has to trace the image again.
- **How:** Opens the app and picks 3D model (the sample vase loads). Loads an STL of two 5 mm posts 20 mm apart (30 × 10 × 10 mm) through the file box and slices it on the 3D tab; tips it sideways and goes back to the 3D tab; tries the infill at 100%, then hollow with 2 walls, then back; types a height of 15 mm; exports G-code and reads its Z range. Checks the 2D tab's note, undoes back past the turn, and goes back to Image.
- **Pass when:** The sample vase shows (29.1 × 29.1 × 40 mm) and the tracing controls are hidden; the posts load as 768 triangles, 30 × 10 × 10 mm; the 3D tab slices them (layers in the readout) with one line reaching both posts; tipped sideways they stand 30 mm tall and the Height field shows 30; the infill shows its density and pattern and at 100% makes more line than hollow; hollow with 2 walls more than 1; 15 mm makes 50 layers and the G-code tops out at 0.3 + 49 × 0.3 = 15 mm; the 2D tab points to Draw this view; undoing back past the turn stands the posts 10 mm tall again; Image traces the leaf again; no page errors. Cutting 1 mm off the bottom and 2 mm off the top leaves a 7 mm print (the Height box and the layers agree); the solid layers view shows a brightness spread over 20 of 255.

#### A18

**3D → 2D: Draw this view turns a model into a traced line drawing** · `app/A18-draw-view.test.js` · slow

- **Why:** A model's 2D life (the pen plotter, or a single chocolate line of it) goes through a line drawing of one view: Draw this view renders it (hidden lines removed) and hands it to the tracer like any picture. The model stays loaded so the view can be changed and drawn again.
- **How:** Picks 3D model (the sample vase), turns on the drawing preview and reads how much of the preview is drawn at folds over 60° and over 1°. Sets 20°, exports the drawing as SVG and reads it, then presses Draw this view, waits for the trace, goes to the 2D tab, then switches to 3D model and back to Image.
- **Pass when:** The drawing preview draws less at 60° than at 1°; Export SVG saves sample-vase-view.svg at the vase's size in mm (plus a 5 mm margin each side) with its edge pieces joined into under half as many strokes; Draw this view switches to Image with the source named 'sample vase · drawing' and traces it (terms in the readout); the 2D tab places the pen line on the page; 3D model brings the vase back, and Image brings the drawing back; no page errors.

#### A19

**Suggestion box: a line typed on any tab is kept as a note** · `app/A19-suggestion-box.test.js`

- **Why:** The suggestion box is where ideas and bugs are written down while using the app, to be sorted into ROADMAP.md later. A note that silently disappears is worse than no box.
- **How:** Opens the app (outside Claude, so notes are kept in the browser), types an idea on the Trace tab and a "bug: …" line on the 3D tab, ticks the bug as done, reloads the page and reads the list again.
- **Pass when:** Both notes are listed with their kind (idea, bug) and the tab they were written on; the open count is 1 after ticking the bug; after the reload both notes are still there and the bug is still done; no page errors.

#### A20

**Races found in the October 2026 bug hunt stay fixed** · `app/A20-races.test.js` · slow

- **Why:** Each of these was a real bug found by an independent review. They only show when things overlap in time (switching quickly, cancelling, two tabs), which ordinary tests don't do, and they leave the page showing or exporting something other than what you set.
- **How:** In one page: starts and cancels a background call 40 times (0–19 ms apart) and checks the next call each time; starts a term-count sweep and loads a new 300 × 900 image straight after; types text and switches to Image at once; on the 2D tab, loads a blank image. Then opens a second tab and adds a note in each.
- **Pass when:** No second call rejected; the committed trace is the new image's (its working size is 3 times taller than wide); the source stays the image, not the text; the 2D page has no drawing after the blank image; both tabs' notes are kept after a reload; no page errors.

#### A21

**Size card: the gap leaves the size alone, fit inside a box, the plate limit, and text's size and letter height linked** · `app/A21-size-card.test.js`

- **Why:** Size is its own card on the Trace tab. A drawing for the pen plotter can be bigger than the chocolate printer's plate, so the slider goes to 1 m unless Keep the size within the build plate is ticked on the 3D tab (per printer). Fit inside a box scales to the biggest size that fits a given width and height. For text the print size leads: changing the width or height changes the letter height, and the other way round.
- **How:** Opens the app (the leaf). Reads the slider's top; sets the gap to 0.2, 2 and back to 0.5 mm, reading the size each time; fits the leaf inside 50 × 50 mm; ticks Keep within the plate and types a 400 mm width; unticks it. Then switches to Text, doubles the width and reads the letter height, and fits the text inside a box 300 mm wide. (Text can't shrink below the smallest readable letter height, so the box is a big one.)
- **Pass when:** A smaller gap leaves the size as it is; a 2 mm gap grows it to the new smallest and says so, and going back to 0.5 mm keeps that size; the slider reaches 1000 mm without the limit and the plate's width with it; the box fit is at most 50 × 50 mm with one side at 50 (to 0.2 mm); with the limit a typed 400 mm stops at the plate's widest; text: doubling the width doubles the letter height (to 3%), and the 300 mm box gives a print at most 300 mm wide (to 2%), at least 285 mm; no page errors.

#### A22

**The big view: the 2D page and the 3D layers, played, and the layers turned** · `app/A22-big-view.test.js`

- **Why:** The 2D page (where fills are clicked) and the 3D layers are part of the big view, with tabs (Line, 2D page, Plate, 3D layers); each settings tab brings its view. Play drawing plays whichever view is showing: the circles drawing the line, the pen drawing the page and then the fills, or the needle stacking the layers. The layers can be turned by dragging.
- **How:** Opens the app (the leaf). Goes to the 2D tab and counts the inked pixels on the page; plays it at Fast and counts again partway and at the end. Goes to the 3D tab, waits for the layers and counts the drawn pixels; plays it partway and at the end. Drags across the layers and compares the picture; double-clicks and compares with the first.
- **Pass when:** Each tab brings its view (2D: 2D page, 3D: 3D layers, Trace: Line); partway through playing, the page and the layers show less than at the end (under 90%), and at the end as much as before (within 2%); dragging changes the layers' picture and a double-click brings the first one back; no page errors.

#### A23

**Zoom in every view, and One copy / Whole plate** · `app/A23-zoom-copies.test.js`

- **Why:** Every view of the big view zooms (the − / + / Fit buttons, pinch or Ctrl / ⌘ + scroll about the pointer) and keeps its own zoom. Clicks (the image tools, filling shapes on the 2D page) must still land where you point. The Plate and 3D layers views show either one copy, to work on the design, or the whole plate with every copy, to see how they fit.
- **How:** Opens the app (the leaf). Line view: + twice and reads the scale and where the image tools map the centre; Ctrl + scroll about a corner point; Fit; − until it stops, then Fit. 2D page: zooms in and checks a click at the centre maps to the same paper point as before. Sets 6 copies; 3D tab: compares the layers with One copy and Whole plate, adds a base layer and looks for its fill moves; reads the whole print's moves by kind and hides travel and purge; then the Plate view the same way.
- **Pass when:** + twice is 225% and the line view's scale grows 2.25×; the point under the centre and under the pointer stay put (to 1 px); Fit is back to 100%; each view keeps its own zoom; a click at the page's centre maps to the same mm point zoomed or not (to 0.05 mm, under a screen pixel); Whole plate shows the 6 copies and a different picture from One copy, in the layers and on the Plate; adding a base layer adds fill moves to the whole print and changes the picture; the whole print has walls, travel, the purge line and a wipe per copy, and hiding travel and purge changes the picture; with One copy only the walls and fill switches show; − zooms out to 25% and stops there, and Fit brings it back to 100%; no page errors.

#### A24

**One drop area for every input file** · `app/A24-drop-area.test.js`

- **Why:** The Art tab's Layers card starts with one drop area: click it to choose a file, or drop one there or anywhere on the page. An image is traced, an STL model is sliced and a saved design is opened, whichever source was showing.
- **How:** Opens the app. Clicks the drop area and waits for the file chooser. Drops an STL (two posts) on the page, then a PNG drawn in the page, then a text file, reading the source each time.
- **Pass when:** Clicking opens the file chooser; the STL switches to the 3D model source; the PNG switches back to an image; the text file shows a message and leaves the image as it was; no page errors.

#### A25

**Print checks: help behind ⓘ, the cartridge warning, the ready list, the layer slider and the test print** · `app/A25-print-checks.test.js`

- **Why:** October 2026 simplification: explanations sit behind an ⓘ (readouts and warnings stay on the page); a cartridge can't be changed mid-print, so the 3D tab says when a plate needs more chocolate than one holds; a checklist above Export G-code says whether the print is ready; a slider shows the print up to a layer; and a test print steps one setting across numbered strips.
- **How:** Opens the app: counts ⓘ buttons and visible help paragraphs, opens one. 3D tab: reads the ready list; sets a 15 mm height and 20 copies and reads the cartridge line and the list; clicks Export G-code, which still exports (only a red line holds it back). Sets 2 base layers, opens the layers view and moves the slider to 2. Opens Test print, exports it and reads the strips' layer heights from the G-code; Use it on strip 4.
- **Pass when:** At least 10 ⓘ and no help paragraph showing until one is opened; ready list starts all ✓; 20 copies × 15 mm: the cartridge line warns and names the copy to refill after, the list shows ⚠; the slider reads 2 of N and names the base; the test G-code has strips at 0.2–0.4 mm (first-layer Z 0.2, 0.25, 0.3, 0.35, 0.4); strip 4 sets the layer height to 0.35; no page errors.

#### A26

**Print safety: a model's height doesn't follow you back, bad Fine-tuning boxes never reach the G-code, a typo in settings.js can't break the menus** · `app/A26-print-safety.test.js`

- **Why:** Found in the October 2026 review (REVIEW.md): the Height box kept a model's 40 mm and the height-leads logic read it (133 layers); Z, lift and speed went from the boxes straight into the G-code; and a chocolate's costPer100g written as a string threw during start-up, so the chocolate menu stopped switching.
- **How:** Opens the app, loads the sample model, goes to the 3D tab, back to Image, changes the chocolate and reads the layer count. Empties First-layer Z and sets Lift to −3, reads the ready list, exports G-code and reads its first printing move and its travel height. Then opens the app with costPer100g: "2.50" in settings.js and switches chocolate.
- **Pass when:** After the model the drawing is still 1 layer; with Z empty the ready list warns and the G-code's first layer is at the layer height (0.3), never Z 0, with travel at least 0.5 mm above it; the quoted price is named in the 3D tab, switching chocolate still changes the speed, and there are no page errors.

#### A27

**The G-code the app downloads: start lines, flow, feeds, layers, one copy at a time, travel above finished copies** · `app/A27-gcode-contract.test.js`

- **Why:** The engine's G-code writer is tested on its own (E09, E28), but this is the file the printer actually gets: the 3D tab's settings, the layers, the copies and the printer profile together. Found missing in the October 2026 review (REVIEW.md).
- **How:** Opens the app, goes to the 3D tab, sets 2 copies, 2 base layers and a height of 1.5 mm, exports G-code through the button and reads the whole file back move by move (lib/gcode.js). Compares it with the app's own numbers: E per mm (#gE), speed (#gFeed), first-layer Z (#gZ), lift (#gLift), the seconds per layer, the plate and the layer count.
- **Pass when:** The file is named design_needle_copies (e.g. leaf_084_2x-gcode.zip). Printer start lines with the purge line come first, then mm / absolute XYZ / absolute E; two copies, each with its layers 1 … N in order (N = the app's laps), one unretract before its first layer and one wipe or retract at its end, no travel inside a copy; every full layer pushes E per mm within 1% of #gE (the first and last wall laps ease in and out, 40–60%); every printing feed between the printer's slowest and #gFeed, and each layer at least the seconds per layer unless already at the slowest; first layer at #gZ, top at the height; every travel at least #gLift above everything printed so far; all printing on the plate; the end lines after a final lift; no page errors.

#### A28

**Support on the 3D tab: overhangs flagged, a skirt or a wall chosen, the step set in Fine-tuning** · `app/A28-support.test.js`

- **Why:** October 2026: supports are the print's own wall widened from the plate up (one continuous line can't print a separate one). The ready list has to say when a model needs one.
- **How:** Loads a mushroom (a 4 mm stem under a 14 mm cap) and opens the 3D tab with Support off: reads the ready list and the Overhang box's auto value. Picks Flared skirt, then Thin wall: reads the ready list and the line's length. Then Support off with Overhang per layer 2 mm.
- **Pass when:** Off: the ready list warns of an overhang over 1 mm at the cap and the box shows auto 0.28 (a third of the 0.84 mm line); each support: the ready list names it and the warning is gone, both lines are longer than with none; 2 mm a layer: no overhang warning; no page errors.

#### A29

**A text of several lines prints a piece for each line, all on one plate, in one G-code file** · `app/A29-text-pieces.test.js`

- **Why:** A list of names (or any text of several lines) should come off the printer as separate pieces: one continuous line each, with no strand of chocolate from one line to the next. From the Suggestion box (18 October 2026). The Trace and 2D tabs keep the text as one drawing; the 3D tab's Plate card decides how it prints (Lines of text: a piece for each line, or one piece with the lines joined).
- **How:** Opens the app, picks Text and types three names on three lines, notes the Trace tab's line, goes to the 3D tab and waits for the pieces. Reads the Plate card, the placements and the ready list; exports G-code and reads it back move by move (lib/gcode.js). Sets 2 copies of each line and reads the plate again; picks the second piece for One copy; then switches Lines of text to One piece.
- **Pass when:** The Plate card offers Lines of text with A piece for each line chosen; three pieces named after the lines, each traced on its own (no connector between lines), different widths; all three on the plate, none overlapping; the G-code has three copies, each one continuous line (no travel inside) printed inside its own footprint; the Trace tab's line is unchanged; 2 copies of each line gives six pieces; One copy shows the piece picked; One piece goes back to one copy of the joined text; no page errors.

#### A31

**The Art tab: one input at a time, traced, or plotted as drawn** · `app/A31-art-tab.test.js`

- **Why:** Everything comes in through the Art tab's Input switch, one thing at a time: a picture, the text, a geometric pattern or a 3D model. Each keeps its settings while another is in use. The Trace tab traces the one in use; the 2D tab can plot a pattern or the text exactly as drawn, without tracing.
- **How:** Opens the app (the Art tab, the sample leaf as the picture); picks Pattern (a Labyrinth), changes it to Waves and shuffles it; types a width of 40 mm, changes the rows, fits the needle; picks the Vibrating spiral (drawn from a picture) and the face sample in the Pattern card; picks Picture and Pattern again; picks the Spirograph with Allow overlaps on, turns its second wheel on and off, sets a 60-tooth wheel, then turns Allow overlaps off, then back to Waves; picks Text and 3D model; makes it for a pen plotter, as drawn, and exports the SVG; checks As drawn is off for a picture; back to a printer; undoes a switch; saves the design and opens it again.
- **Pass when:** The app opens on the Art tab with the picture in use; the Labyrinth traces as 1 part, a closed loop with no connectors, no smaller than the smallest mark; Waves as 1 part, an open line; Shuffle re-traces; a typed width is the print's and stays through a change of rows, with a warning when the lines come closer than the spacing, and Fit the needle puts the closest lines at the spacing (up to 5% over); the Vibrating spiral traces as 1 part from the face sample (not the leaf, a line drawing), and a picture chosen there keeps the pattern in use; back on Picture that picture returns, and back on Pattern the Waves; the Spirograph shows its second wheel's settings only with one, is followed exactly as 1 part, keeps its crossings with Allow overlaps and none without, and Waves come back with their rows as left; Text and 3D model take over the trace; the Plot step shows the pattern as drawn, its SVG one Inkscape layer; As drawn is off for a picture, which gets separate strokes; undo returns to the previous input; a saved design reopens on the pattern with the leaf still kept; no page errors.

#### A32

**Image prep and plotting: grey levels, the background tapped, a picture turned, and art made for plotting** · `app/A32-prep-levels-plotting.test.js`

- **Why:** The Image prep card can reduce a picture to a few flat greys and trace the edges of the ones you pick, and remove the background from a point you tap; the Picture card turns and straightens the picture. The Art tab's Made for switch sets whether art is for printing (one line at the needle's spacing) or plotting (much finer patterns, plotted as drawn, traced only when asked).
- **How:** Opens the app; picks the still-life sample; on the Trace tab sets 5 grey levels, then sets the second grey to Skip; taps the background with the tool; turns the picture right on the Art tab; picks Pattern and makes it for a pen plotter, picks Wave rows (from a picture) and sets 200 rows; goes on to the Plot step (as drawn); exports the SVG; picks One continuous line; picks the Spirograph for printing; saves the design and opens it again.
- **Pass when:** Grey levels make the trace follow the greys' edges (the line changes) and the Grey levels card lists 5 greys; Skip changes the line again; the tap sets the background point and some tolerance; the turned picture is as tall as it was wide; for a pen plotter Wave rows go to 200 rows (printing stops at 120) and start as drawn, nothing traced; the 2D page shows the rows; its SVG is named after it; One continuous line traces them, filling the page with lines pen 1 + the gap apart; a Spirograph for printing turns Allow overlaps on and says so; the reopened design keeps 5 greys, the skipped grey and made for a pen plotter; no page errors.

#### A33

**The workflow: made for a printer or a pen plotter, Art → Line → Print or Plot, one switch for the line** · `app/A33-workflow.test.js`

- **Why:** What the art is made for comes first (a printer or a pen plotter, at the top) and decides the last step: Art → Line → Print, or Art → Line → Plot. The Line step has the one switch for how the art becomes lines: One continuous line (the Fourier trace, the only one a printer can make), Separate strokes (traced, the pen lifting between them) or As drawn (a pattern's or text's own lines, nothing traced). The preview follows the step.
- **How:** Opens the app (a printer, the leaf); checks the steps, the line switch and the preview's tabs on Art, Line and Print; makes it for a pen plotter; checks the Plot step replaces Print, the leaf becomes separate strokes, the page plots them and the SVG has a path per stroke; picks a pattern (As drawn, nothing traced) and then One continuous line (traced); follows Next from Art to Line to Plot; goes back to a printer.
- **Pass when:** For a printer: steps Art, Line, Print (no Plot), only One continuous line offered, no preview tabs on Art or Line, Plate and 3D layers on Print. For a pen plotter: Plot replaces Print; the leaf is separate strokes (more than 5, the readout counts the pen lifts) shown on the line view and plotted on the page, its SVG a path per stroke; As drawn is off for a picture; a pattern starts As drawn with the page as its preview and isn't traced; One continuous line traces it (1 part); Next goes Art → Line → Plot; back to a printer, One continuous line and the Print step; no page errors.

#### A34

**Touch and scrolling: number steppers, the preview in view, the settings wheel; fills per grey** · `app/A34-touch-wheel-fills.test.js`

- **Why:** On touch screens a number is easier to nudge than to type, so every number box has − and + (finger-sized on touch screens). The preview stays in view while the settings scroll: a sticky column on wide screens, a compact pinned preview on phones (Bigger shows it in full). The Wheel turns the settings like a drum: when the scrolling stops, the card that reached the top opens and the others fold. Making it for a pen plotter, grey levels can be filled (Fill, or Both with their edges traced), each with its own pen.
- **How:** Opens the app on a laptop-sized window with the wheel on; checks every visible number box has its buttons; presses + on Copies (Print step) and holds − on the margin; scrolls the settings and checks the preview stays put; scrolls to the Plate card and checks it alone is open and stays where it landed; turns the wheel off. Then a phone-sized window: the pinned preview's height, Bigger and Smaller. Then fills per grey: a pen plotter, the still-life sample, 5 greys, the darkest two Both and Fill; the page and the SVG.
- **Pass when:** Every number box on the Print step has − and +; + makes Copies 2 and the plate shows two copies; holding − on the margin steps it down more than once and never below its minimum; after scrolling 600 px the preview's top hasn't moved; the wheel lands on the Plate card, which is the only one open and within 40 px of where it landed; the wheel off puts back the cards it folded; on a phone the pinned preview is under 40% of the screen and Bigger makes it taller; the two filled greys plot as their own layers (3 in the SVG: strokes and two fills); no page errors.

#### A35

**A clean start: the app opens empty, and every example is one tap away** · `app/A35-clean-start.test.js`

- **Why:** The app opens on a clean workspace: nothing traced, the preview saying how to start (drop, paste or choose a file) with the examples — pictures, patterns, lettering and a 3D model — as chips there and in the Input card. settings.js can still name a sample to start on (defaults.sample), and the page's address can (?example=leaf).
- **How:** Opens the app with no example; checks the empty preview, its chips and the readout; visits the Line and Print steps; taps each example in the Input card and checks the input it makes; taps the Wave portrait then the Leaf.
- **Pass when:** Empty at the start: the empty preview showing with all ten examples, the readout saying nothing yet, nothing traced on Line and Print; each example becomes its input (five pictures, three patterns, the text, the vase) and the preview is no longer empty; after the Wave portrait the Leaf is the Picture in use; no page errors.

#### A36

**Take a picture: the live camera finds the page, its corners can be dragged, and the photo becomes a clean picture** · `app/A36-camera.test.js`

- **Why:** On an iPad or phone the quickest way in is a photo of a drawing (v110): a live camera in the preview (full screen on a phone) outlines the page it finds, the photo taken has its four corners to drag, and Use it straightens and cleans it into the picture to trace. The Photo card cleans it again as a drawing, printed art, an object or as taken; Clean up as a photo does the same to an image chosen. Without a live camera the device's own camera or photos open instead.
- **How:** Opens the app empty with a fake camera: a 800 × 600 photo of a page at an angle on a table, with a shadow. Taps Take a picture on the empty preview, waits for the outline, takes it, drags a corner and back, and uses it. Then on the Photo card picks Printed and As taken, opens Page corners and cancels. Then the leaf example, Clean up as a photo: checks each corner can be grabbed and drags one from beside it; Use it. Last, a camera that refuses: Take a picture opens the file chooser, and the photo given goes to the corners.
- **Pass when:** The live view says the page is found and outlines it; taken, the corners are within 6 px of the page's (on the 800 × 600 photo); a dragged corner moves by the distance dragged (within 3 px) and back; Use it closes the camera and stops its stream, and the picture is the page's shape (within 6%) with a photo label and a trace; Printed cleans it again (a new picture, Printed's settings) and As taken turns the cleaning sliders off; Page corners opens the corners and Cancel leaves the picture as it was; the leaf cleaned as a photo finds no page (it fills the frame), so the whole picture is used, and its four corners (on the photo's edges) are all grabbable, clear of the message and buttons, and a press near a corner (not on it) drags it without it jumping; the refused camera opens the file chooser, and its photo's page is found; no page errors.

<!-- catalogue:end -->

## Results log

| Date | Change | Result |
|---|---|---|
| 2026-10-14 | Test suite created: 13 engine tests, 10 app tests | all 23 pass |
| 2026-10-14 | Cleanup: refinement and the Python version removed, pen-lift and unused code removed, benchmark moved onto the shared trace | all 23 pass; each trace about 15–30 ms faster (no refinement target to build) |
| 2026-10-14 | `index.html` split into a stylesheet and 14 script files; `settings.js` added (chocolates, needles, printer, defaults); tests E14 and A11 added | all 25 pass; split page renders pixel-identical to before |
| 2026-10-14 | `theme.css` added: all colours, fonts and corner / text / spacing dials, preview overlays included; test E15 added | all 26 pass; page renders pixel-identical in light and dark mode, desktop and phone |
| 2026-10-14 | `settings.js` holds every program default (all controls, presets, rules, engine tuning); E14 and A11 extended | all 26 pass; start-up screens pixel-identical to before |
| 2026-10-14 | Simple / Advanced cleanup: Simple shows the tracing sliders, line spacing or needle, size (fixed or smallest that fits) and export, with help as hover tips; Advanced folds the details into 'More…' groups; test A12 added | all 27 pass; A12 fails when help paragraphs show in Simple |
| 2026-10-14 | `core.js` reordered into ten sections in pipeline order with a contents list; no code changed | all 27 pass; every trace, measurement and export byte-identical to before (fingerprint of 22 outputs) |
| 2026-10-14 | `web-app/build.js` added: tests first, then the flat `dist/` copy, file check and a headless check of the built page | built copy identical to the hand-made one; stops on a failing test, a missing file and a page error (each tried on purpose) |
| 2026-10-14 | Simple / Advanced on the choc mate 2 tab (machine numbers, printer profile and planned list in Advanced); folded groups no longer overflow on a phone; A12 extended | all 27 pass; A12's new phone check fails without the fix (43 px over on Design, 21 px on choc mate 2) |
| 2026-10-14 | Source card reordered: source → starting point → style → sliders → Optimize; the Lettering button removed (the Text switch does it); A02, A05, A08 click the switch; A12 checks the order | all 27 pass |
| 2026-10-14 | Toolbar: Save / Open in a File menu (opens and closes like View); Crossing areas and Connector paths Advanced only, closed when switching to Simple; A07 and A12 updated; A12's visibility check now uses the browser's own `checkVisibility` | all 27 pass; phone toolbar one row shorter |
| 2026-10-14 | Tidy-ups: connector jumps moved into the preview readout (Export's Connectors row removed); Collapse / Expand all Advanced only; smaller mini-map on phones; empty status lines take no space; A12 extended | all 27 pass |
| 2026-10-14 | The app opens in Needle mode (18G + 0.5 mm) instead of Line spacing 0; built-in fallback matches. A01 now checks the opening needle and its 1.34 mm gap, and reads accuracy with spacing off; A03 and A12 start from Line spacing where they need it | all 27 pass; at open the readout shows error 1.41 px (two strands 1.35 mm apart), 0.25 px with spacing off |
| 2026-10-14 | No retracing: out-and-back strokes print as two strands one spacing apart with a keyhole loop at each end (r = d, centre r + w/2 back from the end); 'Draw back over the same line' removed everywhere (text, Logo preset, Optimize, design files); letter height counts 2w + g stroke widths; test E16 added | all 28 pass; E16 fails without the loop (stroke ends 1.0 spacing wide instead of ≥ 1.6, tips overshoot) |
| 2026-10-14 | X/Y/Z engine: the line is one real series per axis (x(t), y(t); z(t) = 0), terms chosen per axis; Play drawing shows an X chain and a Y chain; the math panel, term table and coefficients file are per axis; G-code reads a Z offset per point; test E17 added, E12 updated | all 29 pass; all terms rebuild the path within 1e-11 px; E17 fails when the axis amplitude is wrong (off by 80+ px) |
| 2026-10-14 | Millimetres only: the mm / px switch removed; error, stray, missing, the error chart, the math panel, Optimize messages and the coefficients file in mm; image-side sliders show mm at the current size; working resolution reads Fast / Standard / Detailed; older px design files converted on open; A01, A08, A11, A12 read mm | all 29 pass; A12's new check fails if any px label shows on the Design panel |
| 2026-10-14 | Non-crossing walk: strands joined only to their neighbours at each junction, loops merged by swapping neighbours, each strand on the side of the corner it turns round, copies of a stroke kept to their own side, small offset loops at sharp bends cut out; loops never reach back past a junction; test E18 added, E16 measures real stroke ends only | all 30 pass; crossings before clean-up: leaf 13 → 0, smiley 8 → 2, shapes 20 → 2; E18 fails with the old walk |
| 2026-10-14 | Full spacing at junctions: strokes drawn once ease half a spacing into the corner they turn round near a junction; junctions get no spacing slack; folds on the inside of narrow corners cut out up to 10 spacings long; E18 also measures the closest gap anywhere | all 30 pass; closest gap anywhere, junctions included: leaf 0.31 → 1.01, smiley 0.37 → 1.00, shapes 0.20 → 1.01 spacings; E18 fails on the previous engine |
| 2026-10-14 | "Smallest that fits" with strands and loops: the size search lays out the real print (strands, stroke-end loops, crossings removed) at every width it tries, and the app traces again at the width found; E07 rewritten | all 30 pass; leaf at 18G + 0.5 mm: Low 20.5, Medium 23.0, High 30.0 mm, 0 crossings, closest gap 1.0 spacing |
| 2026-10-14 | One size slider replaces Fixed / Smallest that fits: its low end is the smallest that fits, marks at medium and high detail and the plate width, typed sizes never below the smallest; the image is traced at the working resolution per 100 mm of print (up to 2000 px), so bigger prints keep finer detail; automatic size moves aren't undo steps; settings: defaults.size, engine.sizeDetail, engine.maxWorkingResolution; test A13 added, A05, A12, E14 updated | all 31 pass; leaf opens at 23.0 mm (medium), smallest 20.5, high 30.0; at 88 mm traced at 640 px instead of 500 |
| 2026-10-14 | Round corners: a slider (0–5 mm) rounds the drawing's own corners to at least that radius before the strands and the fit (`UNB.roundCorners`); junctions, stroke ends and connectors never move, smooth curves are left as drawn, no point moves more than the radius; the size marks and Optimize use it; settings: defaults.cornerRounding; test E19 added, A12 and E14 updated | all 32 pass; tightest drawn turn: leaf 0.37 → 1.05 / 1.09 / 1.20 × R at 1 / 2 / 3 mm, square and triangle 0.3 → 0.89–1.00 × R |
| 2026-10-14 | Size marks stricter: 98% of the line within the detail tolerance (was 90%); moved lines shaded orange in the preview (`UNB.drift`, View → Moved lines, defaults.movedLines) with a note under Size past 2.5%; E07 checks the share pushed off | all 32 pass; leaf marks 20.5 / 23.0 / 30.0 → 27.5 / 36.3 / 46.6 mm; shapes 35 / 48 / 63 → 50 / 78 / 111; pushed off at the leaf's medium mark 2.0%, at 80% of the smallest 11.3% |
| 2026-10-14 | Infill: Off / Rings / Lines fills every enclosed area with the same continuous line one spacing apart (`UNB.infill`: distance field on a fine grid, ring contours or paired rows, loops merged by bridges, bridged into the printed line); Leave small areas open (0–400 mm²); infill points left out of the error; the term count is re-picked when infill is on; settings: defaults.infill, infillAngle, infillMinArea; test E20 added, A12 and E14 updated | all 33 pass; leaf 80 mm 18G: emptiest 1% of the enclosed area 4.5 → 0.69 (Rings) / 0.67 (Lines) spacings at gap 0.5, 7.5 → 0.75 / 0.67 at gap 0; no crossings, closest gap ≥ 1.0 |
| 2026-10-14 | Clean-up after an independent review: size marks draw crossing areas at the base resolution; undo / redo reuse cached marks (keyed on the painted areas, not a counter); a new image or selection is traced once more at the resolution its proportions call for, and starts at the default mark; working resolution in 10% steps; size changes are undo steps even when nothing re-traces; Rings infill scans only each area's box (shapes at 300 mm, 0.84 mm spacing: 35.6 s → 1.7 s); "too fine to fill" shown; stale names and comments removed | all 33 pass (A09 caught a stale term count after a re-trace, fixed: a resolution change re-picks the term count); every control on both tabs (61), the three samples, text, infill and rounding combinations, all six exports, G-code and 8× undo / redo run with no page errors |
| 2026-10-14 | Layers on the choc mate 2 tab: Filled base (the same switch as Design's Infill) for 1–50 layers, then wall layers spiralling up one layer height per lap (`UNB.layerStack`), flow easing in on the first spiral lap and out on a level finishing lap; Lines bases alternate 90°; layer height from the chocolate or printer; readout, minimum-layer-time warning and a tilted preview; G-code prints every layer of each copy and travels above everything printed; base/wall variants worked out in their own background engine (`UNB.stagePrint`); tests E21 and A14 added, E14 updated | all 35 pass; leaf at 60 mm with 2 filled + 6 wall layers: 8 layers, 2.9 mm, 4.5 m of line, G-code Z 0.8 → 2.9 mm |
| 2026-10-14 | Outputs split into a **2D** tab (pen plotter: the pen version of the line with no strands or loops, paper / orientation / margins / pen width, page preview, SVG for Saxi at the paper size in mm, flat DXF) and a **3D** tab (a printer menu from the `printers` list in `settings.js`, layers, G-code with the printer's start / end lines, or 3D DXF of the whole stack); PDF, EPS, HPGL and JSON no longer offered in the app; a broken settings.js no longer stops the app now that the printer comes from a list; tests A15 added, E11, A12 extended | all 36 pass; leaf at 60 mm: the pen line goes back over itself at 55% of its points (the veins), the chocolate line at 0%; SVG 215.9 × 279.4 mm on Letter portrait, every point inside the margins |
| 2026-10-14 | Fill pens on the 2D tab: click an area the pen line closes off to hatch it with the chosen pen (colour, width, spacing, angle, cross-hatch; up to 7 fill pens), the same pen clears it, another takes it over; strokes stop where their ink would touch the drawing's, rows centred across the area (`UNB.penFills`); SVG has one Inkscape layer per pen with its own stroke colour (Saxi splits by group or colour), DXF one layer per pen; fills undo and save with the design; tests E22 and A16 added, E11, E14 updated | all 38 pass; 40 × 20 mm divided box: two areas, solid fill 39 rows exactly 0.5 mm apart reaching both fill limits, no stroke over the divider; shapes sample at 120 mm: 19 areas, letters' insides included |
| 2026-10-14 | Infill moved off the Design tab into the 3D tab's Layers (Filled base: Rings or Lines, angle, leave small areas open, areas-filled readout): Design traces the drawing alone, the filled base is fitted on its own in the layers engine, and the big preview on the 3D tab shows the first base layer; older settings and design files keep working; A14 rewritten, A12 updated | all 38 pass; leaf at 60 mm: Design keeps its term count with the base filled, 1 area filled, base line ×2+ longer than Design's, G-code Z 0.8 → 2.9 mm |
| 2026-10-14 | 2D shapes: Show shapes tints every fillable shape and counts them; Close gaps bridges stroke ends to the line ahead within 0–10 mm (dashed, bounding fills only, or drawn with pen 1 by Draw bridges); Smallest shape joins shapes under 0–100 mm² to their neighbouring shape; page preview moved above the pens; a duplicate element id that made the 2D tab overwrite Design's 'Lines set by' readout caught and fixed; E22 and A16 extended | all 38 pass; divided box: a 1.5 mm gap stays open at 1 mm and closes at 2 mm with one 1.5 mm bridge, a 3 × 3 mm corner cell joins its half at 10 mm²; leaf at 60 mm: 1 → 7 shapes at 4.9 mm |
| 2026-10-14 | 2D fills: drag across shapes to fill or clear them (one undo step; a waiting undo step is taken first so it can't swallow part of a drag); per-pen style Hatch or Contours; Follow tone (rows or rings dropped by a van der Corput threshold so spacing follows the image's darkness, none where white); Colour from image (each shape gets the nearest fill pen in CIE Lab by hue, light colourless shapes stay empty); strokes are polylines; stray screenshots removed from the repo folder; E22 and A16 extended | all 38 pass; contours: 10 rings in a 20 mm square half, all clear of the outline; tone: 3.5× the ink in the darkest strip of a gradient as in a light one, none where white; a drag fills 4 leaf shapes, one undo takes it back; light red / light blue / white shapes → red pen / blue pen / empty |
| 2026-10-14 | 3D tab: Height (mm) field in Layers: shows first layer + (layers − 1) × layer height, and typing a height sets the wall layers (snapping to whole layers); follows base / wall layers, layer height, print Z, printer and chocolate; A14 extended | all 38 pass; leaf at 60 mm with a 2-layer filled base: 10 mm → 30 wall layers, 10.1 mm, readout 32 layers; undo back to 2.9 mm |
| 2026-10-14 | 3D models: STL (binary or ASCII) as a third source with a sample vase, quarter turns and a shaded preview you can look round; the 3D tab slices it every layer height, moves outlines in half a line width, joins parts and holes with connector strands one spacing apart, fills the base layers if asked, fits each layer with a Fourier series (0.05 mm) and spirals the walls; Height scales the model; footprint on the plate from its hull; tests E23 and A17 added | all 40 pass; 20 mm cylinder: 65 layers, mean radius 9.575 mm (10 − 0.42), 8 terms, no jump between layer starts; tube: 2 loops, 1 connector; posts at 15 mm: 48 layers, G-code top 14.9 mm |
| 2026-10-14 | 3D models: Hollow or Solid; solid fills every layer at a fill density of 5–100% (rows spread to spacing ÷ density, the joins stay one spacing wide), walls and filled base stay solid; 1–5 walls one spacing apart, alternating direction so their connectors don't cross; infill's grid follows the join width so sparse fills keep a clean edge; E23, A17 and E14 extended | all 40 pass; 40 mm disc: 3 walls → 3 loops, 2 connectors, innermost 16.9 mm; fill length at 50% about half of 100%, at 25% under 40%; sample vase: hollow 8.7 m, solid 20% 12.1 m, 2 walls 18.8 m |
| 2026-10-15 | 3D → 2D after plotter.vision: `UNB.hiddenLines` draws a model's outlines, open edges and folds sharper than an angle (1–90°, default 20°; low = wireframe), hidden lines removed by a depth buffer; the Design preview can show it live; Draw this view renders it and makes it the image to trace; tests E24 and A18 added, A17 updated | all 42 pass; a box shows 9 of 12 edges and no face diagonals; the torus outline has no gaps; the sample vase at 20° traces in 3.6 s (246 terms), at 1° (wireframe) fills the 4000-term limit |
| 2026-10-15 | Export SVG of a model's view (the line drawing as vectors before tracing: edge pieces chained into strokes, model size in mm); the Design tab renamed Trace; A18 extended | all 42 pass; sample vase at 20°: 35 strokes from ~400 pieces; at 1°: 105 strokes from 4014 |
| 2026-10-15 | Code audit (see `AUDIT.md`): the engine split into thirteen parts with shared helpers in `00-util.js` (E25 added: the part lists agree, no private helper used across parts); duplicated code merged (labelling, contours, resampling, term count, line shaping, DXF / SVG writing; app helpers in `ui.js`); bugs fixed (mirrored tags one point off, NaN gap, layer and cache keys, busy label, empty model layers, open-line rasters, G-code size); "can be slow" notes on the page | 43 tests pass (A02 and A17 each timed out once under full-suite load and passed on their own) |
| 2026-10-15 | Unused features removed (PDF, EPS, HPGL, plain SVG, 3D DXF, chocolate product records, working-resolution menu, the Planned list); exports take mm only. E11 now checks only the files the app offers. A19 added: the Suggestion box keeps ideas and bugs across a reload | 44 tests |
| 2026-10-15 | One interface: the Simple / Advanced switch removed (details stay folded into 'More…' groups, explanations on the page); A12 rewritten for it. The desktop-app track dropped (plan kept in ROADMAP.md) | 44 tests |
| 2026-10-15 | Second audit round: bugs from two independent reviews fixed; E26 (engine edge cases), E27 (state owners) and A20 (races) added; a fast tier (`npm run test:fast`, about 1 min); A02's limit 150 → 200 ms (it measured 153–159 ms only when the machine was busy, 46–110 ms alone) and A17's wait for slicing 60 → 120 s under load | 47 tests |
| 2026-10-15 | G-code follows choc OS's own file: E28 checks the purge line, retraction, wipe and E per mm from the needle against the sample in source/printer/choc-mate-2/sample; A11 checks E per mm follows the needle (the chocolates' typed extrusion is gone) | 48 tests |
| 2026-10-15 | Your notes: the big view's tabs and the Trace tab's cards. A21 (Size card: fit in a box, the plate limit, text size and letter height linked) and A22 (the big view: 2D page and 3D layers played and turned) added; A03 now drives the 3D tab's needle and the line width; E21 checks open lines step up at the ends; E28 checks three choc OS needle files and the time per layer | 50 tests |
| 2026-10-15 | Zoom in every view and One copy / Whole plate: A23 added | 51 tests |
| 2026-10-15 | Every path in the views: E28 reads the G-code back by kind; A23 checks the whole print's moves and the view switches | 51 tests |
| 2026-10-15 | From the Suggestion box: A21 checks the gap leaves the size alone (and grows it only when the lines no longer fit); A12 and A16 open the 2D Fills group | 51 tests |
| 2026-10-15 | From the Suggestion box: A12 checks the 3D tab's four folding cards, A23 the Solid view, A17 that a model clears the 2D page | 51 tests |
| 2026-10-15 | One drop area for every input file: A24 added; A07 and A17 open files through it | 52 tests |
| 2026-10-15 | Height = layers × layer height, the first layer at Z 0.3: A14 and A17 expect the new heights; A14 checks 0 filled layers without a filled base and one layer reading 0.3 mm | 52 tests |
| 2026-10-18 | v97, from the Suggestion box: a piece for each line of text (E31 the line maps and the pieces' plate layout, A29 the app and the G-code); A14 checks the layer slider goes back to every layer after a change; A13 checks the size marks alternate below and above the track | all 60 pass; the model and lettering challenges come out byte for byte the same as v96 |

## Related

- [`../bench/`](../bench/README.md) is the place to explore and measure, with free-form benchmarks, comparison
  images and history. These tests are the pass/fail gate; a benchmark finding becomes a test once it describes
  something the app must always do.
