# How the code is built, and where it should go

A review of the code from the point of view of good software design, first written in October 2026 (after the audit
in docs/history/AUDIT.md and the removals in ROADMAP.md), brought up to date on 17 October (v91, after the
clean-up) and again on 9 November (v139, the vase and a tidy-up). Read it as a map: the principles we want, how far the code is from them in each direction, and the plan.

## Two ways to get it wrong

**Over-engineered** means building for uses that don't exist yet: features nobody asked for, options for every
case, layers of abstraction in case something changes, settings for things that never vary. The cost is code to
read, test and keep working that buys nothing today, and it hides the parts that matter.

**Badly engineered** means building only for today with no structure: logic tangled with the page, state anyone can
change, copies of the same code drifting apart, no tests. The cost arrives later: every change breaks something
else, and problems are hard to find.

The target is the boring middle: **build for the uses we have, and make it easy to change when a new one turns up.**
In practice:

1. **Every feature has a user and a use.** If nobody would notice it gone, it goes, with a line in ROADMAP.md
   ("Maybe later") saying what use would bring it back. Deleting is better than hiding.
2. **One owner per piece of state.** Each value is set in one place, and everything else reads it.
3. **Logic separate from the page.** The maths takes plain data and returns plain data, so it can be run and tested
   anywhere. The page reads the controls once, hands the values over, and draws the result.
4. **One copy of each idea.** Shared helpers live in one file, not pasted into four.
5. **Tests for what the user relies on.** They should be fast enough to run after every change.
6. **Readable over clever.** Short lines, plain names, a comment for the why.

## Where the code is today

### Already in the middle (keep doing this)

- **The engine is pure and split by stage** (`source/engine/00-util.js` … `17-vase.js`, 18 parts): data in, data
  out, no page. It runs the same in the page, a background worker and Node, which is why it can be tested properly.
  Shared helpers live in `00-util.js` only (test E25): the spatial grid (`cellGrid`), contours, labelling, heaps, and
  since v139 the distance to a line segment (`segParam`, `segDist2`, used by the fill, the measuring, the overhang
  check and the vase) and starting a loop nearest a point (`startNearest`, the model's and the vase's layers). No
  helper is defined in two parts (checked 9 November).
- **Background workers with cancellation** keep the page responsive. That is real complexity, but it's justified:
  tracing and slicing take seconds.
- **The tests describe intent.** Each one says why it exists, how it checks and what counts as passing (57 engine
  tests, 59 app tests on 10 November). App tests wait on the app's own "settled" signal, not the clock.
- **Challenges** (`source/challenges/`): practical prints taken through the app with every version, their renders
  reviewed. `compare.js` checks two runs file by file, so a change that shouldn't change the output (a refactor, a
  rename) is proved byte for byte: the v91 clean-up left all 35 files of 30 jobs, and the screenshots, identical.
- **settings.js is checked**, and a broken file can't stop the app opening.
- **The build only publishes after the tests pass**, and the page shows its version (CHANGELOG.md).
- **Formatted to 120 characters** (prettier, `.prettierrc.json`, then `source/tools/wrap-comments.js` for the
  comments it leaves). Long text strings stay on one line.

### Over-engineered (trimmed, and what's left)

- *Removed:* PDF, EPS, HPGL, plain SVG and 3D DXF exports; units other than mm; chocolate product records (UPC, lot
  numbers, allergens); the working-resolution menu; group-tag plumbing nobody set; a Z placeholder; a "Planned"
  list in the page; the desktop-app track (its plan is in ROADMAP.md, Maybe later); the Simple / Advanced switch
  (one interface); the Start-from presets; support shapes that didn't earn their place (Straight wall, Skirt + small
  wall: PLAN.md).
- *Still here, worth watching:*
  - **settings.js validation** (about 270 lines in `config.js`) guards a file only you edit. It's fine as it is, but
    don't grow it.
  - **Extras with a narrow use:** connector-path painting, the sketch pad, the circles
    animation and the math panel. You chose to keep them; each should still earn its place over time.
  - **New in v100:** the ten pattern styles (`13-patterns.js`); watch which get used. **New in v139:** Make a vase
    (`17-vase.js`, `vase.js`): one input inside the 3D model card, its path written straight from its settings rather
    than a mesh sliced; watch which textures and movements get printed. *Removed in v102:* Edit line,
    Shading and v101's layered Art tab (not used, or too complicated: ROADMAP.md, Removed).

### Badly engineered (the real risks left)

- **Logic reads the page directly.** The pipeline, layers, plot and model code read controls by id in the middle of
  their work (`$("…").value`). That ties the logic to the page, so it can only be tested in a browser, and the same
  control is read in several places. Counted on 9 November: plot.js 78 reads, export.js 64, pipeline.js 56,
  layers.js 44, vase.js 40 (its own controls, read where they change), model.js 33. (Step 4: start with layers.js
  and export.js, the Print step's.)
- **Hidden dependencies.** The app files call each other's functions with no imports; the only map is the load order
  in `index.html`. Eased in v91: the printer, chocolate, needle and layer height announce a change once
  (`printSettingsChanged`, state.js) and what depends on them subscribes, instead of listening to those controls in
  four files and relying on listener order. (Step 6 removes the rest.)
- **Shared state** is written by its owners only (test E27), but there is still one shared `st`.

## Modules: features that can be switched off

Decided 10 November 2026: the app is to be used for chocolate printers, pen plotters and clay printers, and each
feature is to be worked on and made better on its own. So a feature is a module: the core doesn't name it, and it
adds itself when its script loads. Switched off, it's as if it had never been built.

**What a feature is.** Three things, and nothing else:

1. a folder, `web-app/features/<name>/`, with its scripts;
2. the parts of `web-app/index.html` marked `data-feature="<name>"` (its cards, buttons, panes);
3. a line in `web-app/settings.js` (`features: { <name>: true }`) and its script tags in index.html, written
   `feature("<name>", "features/<name>/<file>.js")`.

Off (false in settings.js, or `?off=<name>` in the address to try it), its scripts aren't loaded and its parts are
taken off the page before any other script runs (`state.js`). `docs/FEATURES.md` lists every feature with its
files, its parts of the page, what it joins and its tests; `node source/tools/feature-map.js` writes it from the code.

**How a feature joins in** (`web-app/js/state.js`):

| It adds | With | Read by |
|---|---|---|
| an example | `addExample(order, key, name, what, use)` | the Examples tray (map.js) |
| a step or chip of the map | `addMapNode(id, node)`; `MAP_SHAPERS.push(fn)` for chips that depend on the design | the map (map.js) |
| something to make the line for | `addOutput(key, { name, radio, before, step, up, down })` | the map's line and the For chips |
| a kind of art | `addArtKind(key, { radio, name, note, apply, drawnOK, vectors, sized, … })` | the Art step (art.js) |
| controls saved with a design | `addSaved(...ids)` | history.js |
| an answer to a moment | `on(moment, fn)` | whoever announces it: `ask(moment, …)` for every answer, `answer(moment, …)` for the first |

The core announces a moment and doesn't know who answers: `ask("redraw")`, `answer("fitWidth")`. With no feature
listening, `ask` gives an empty list and `answer` gives null, and the core carries on. FEATURES.md lists the
moments each feature answers.

**The rules, and the tests that hold them:**

- *The core never names a feature* (test E58): no core script uses a name a feature's script defines. A feature
  uses another's names only when it needs it (`FEATURE_NEEDS` in state.js: the vase needs the model).
- *Every feature switches off clean* (test A61): with each one off in turn the app opens, traces the leaf, opens
  every step of the map and exports, with no errors and none of the feature's parts left on the page; and with all
  of them off at once the core alone does the same. 36 of 36 on 10 November (13 of 39 that morning).

**Working on a feature.** Its folder, its marked parts of the page and its tests (FEATURES.md) are all of it.
`?off=` the others to see it alone with the core. A feature in progress can ship switched off (`false` in
settings.js) and be tried with `?on=<name>`.

**Adding a feature.** Make its folder and script; mark its parts of the page; add its line to settings.js, its
`feature(…)` tag to index.html (after the core scripts it calls), and its record to A61. In the script: add what it
offers to the lists above, and answer the moments it cares about. If the core has to ask something new, add a
moment (one `ask` in the core), never a call by name. Run `node source/tools/feature-map.js`.

**What's still shared, on purpose or for now:**

- *Styles.* A feature's styles are in `css/app.css` with everyone's. An off feature's rules match nothing, so
  they do no harm; they move to the feature's folder when one needs restyling on its own.
- *The page.* A feature's parts are marked in index.html rather than kept in its folder: the page stays one file
  that opens straight from disk.
- *Reads across a boundary.* A few core lines read the plotter's controls where the code only runs made for a
  plotter (`#penW` in controls.js, `#penColor` in art.js); the Line step's Separate strokes and As drawn are the
  plotter's line modes but live in workflow.js. They can't run with the plotter off; moving them is tidying.
- *Clay.* A clay printer is expected to be a printer with its own machine and material profile and a few rules that
  differ, not a new output. Not started: it needs a real printer's numbers.

## The plan

Done: 1 (version and changelog, v65), 2 (fast test tier), 3 (image prep in the worker), 5 (state owners, E27),
7 (formatted, v91). Also done in the October reviews (docs/history/REVIEW.md): the long functions split into named
steps (`buildWalk`, the preview's `render`, the layers' `drawStack`), one spatial-grid helper, the print-settings
signal. Next: 4, then 6.

| # | Step | Fixes | Effort |
|---|---|---|---|
| 4 | Read the controls once per run into a plain options object (`readControls()`), and pass it to the pipeline, layers and plot code instead of reading the page inside them | logic tied to the page; repeated reads | medium |
| 6 | Switch the app to ES modules: each file imports what it uses, and the build bundles them into one script for the published page | hidden dependencies | medium |

**About step 6.** Switching to ES modules removes the global names the app's files share, and the app tests reach
into the page through those names (`st`, `setSource`, `chartSweep` …). So the switch also means giving the tests one
small, deliberate window into the page (a `window.FLTApp` with the few things they need), which is a good thing in
itself: it becomes the list of what tests are allowed to touch. With the GitHub move, each step is its own commit.

Not planned: frameworks (React and similar), TypeScript, or a server. The app is small enough that they would add
more than they save.

## Keeping notes

- **ROADMAP.md**: the one list of open work. Ideas and bugs sorted into Now / Next / Later / Maybe later, each with its use.
  Removed features go to Maybe later with the use that would bring them back.
- **DESIGN.md** (this file): the principles and the plan above. Update the "Where the code is today" section when a
  step is done.
- **docs/history/** (AUDIT.md, REVIEW.md): what the audits found and fixed, kept as written; whatever they left open
  moves to ROADMAP.md. CHANGELOG.md says what each version changed.
- **PLAN.md**: decisions made together, the rules, later and not doing.
- **docs/TIDY.md**: the recurring tidy-up (every Monday, a scheduled task): `source/tools/tidy-report.js` looks,
  the mechanical fixes go on a branch, and anything that removes or restructures is proposed first.
