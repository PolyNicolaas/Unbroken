# Agent playbook and the fixes it needs · 24 November 2026 (v159)

How an agent takes a picture to a print with Unbroken, written from two trials on the live site: the Polimeks logo
(a mark over a bold word) and the +Jakarta logo (a word with a small "+" and a tagline). The controls and calls it
uses are in `web-app/AGENT.md`; the first trial is in `AGENT-TRIAL.md`.

## How the agent works

### 1 · Ask only what a preview can't show
- **Printer or pen plotter**, and **a rough size or box** if there is one (and copies, if it matters).
- **Several pieces, or one large decorative piece?** The two are made differently (Nicolaas, 24 November 2026):
  - **Several pieces** (a set in a box, a logo's parts, names): each piece small. The smaller pieces print best at
    about **10 mm tall** (each piece's height). Split the picture into parts (`parts()`), every piece at the same scale, each
    its own G-code.
  - **One large decorative piece**: one continuous line, as big as the detail needs (strokes wide enough for the
    needle, step 2), with small text dropped or folded in. Its separate parts (letters, rows, an arch) are held
    together only by the trace's few single-strand connectors, too weak for a tall print: offer **ties**
    (`set({ ties: true })`, struts across the gaps, the full wall height, no base; Nicolaas's pick for the Gateway
    City Big Band logo, 24 November 2026) or a base under it, and show them side by side. A single cartridge (50 ml)
    still sets the height: about 10–15 mm for a 150 × 210 mm logo in Outline.
  - **Ask what it's for.** A large piece is often a **cake topper**: printed flat, then stood on edge with its legs
    in the cake. Then the print's height is the topper's thickness (6–10 mm is plenty), and the weight runs down
    through it to the legs: the ties that matter join each row to the one below and the legs to the letters. Ties
    across a letter's own notch (a W's V, an E's arms) don't; Nicolaas took those away on the Gateway logo.
  When the person hasn't said, the options in step 3 show both.
- Everything else is shown as options, not asked (decided 23 November 2026: people don't know what they want until
  they see it).

### 2 · Load the picture and read it before tracing
- Open it from its link (`?src=`, the link box) or the file. Wait on `window.unbroken.whenReady()`.
- **Find its parts** with `unbroken.parts()`: the bands (a mark, a word, a tagline) and the groups side by side
  within them, each with its size and stroke width in mm.
- **Measure what's small**: at a candidate width, how tall is each line of text and how wide are the strokes, in mm?
  Compare with the needle. With the 0.84 mm needle the line spacing is 1.34 mm and a stroke prints as a loop 2.18 mm
  wide, so:
  - letters under about 10 mm tall, or strokes under about 2.5 mm, wobble or blob (Polimeks at 64 mm, the "+");
  - small text (the tagline, about 4 mm) can't be traced at any reasonable size: plan to drop it, or retype it as its
    own piece (the Text card's smallest readable height is the guide: 12.8 mm lowercase, 18.7 mm capitals in Sans);
  - treat these numbers as a starting rule, to be checked against real prints.
- **Don't take the app's picked size for lettering.** It picked 51–79 mm for both logos; both needed about 90 mm or
  more.

### 3 · Make 3–4 distinct options
- **Whole picture, one line**, at a size where its letters work.
- **Larger, after Optimize tracing**, run **at the final size** (Optimize's smoothing is in mm and stops fitting
  when the size changes afterwards).
- **Pieces**: the parts split at their gaps, every piece at the picture's own scale, each its own G-code
  (docs/PICTURE-PIECES.md). In the trials the mark alone traced far better (Polimeks' ring came through whole).
- **Simplified**: small text dropped, or retyped as its own piece.
- Options should differ in kind, not in one setting.

### 4 · Show them side by side
- One sheet: every option **at the same scale, as printed, from above** (`unbroken.snapshot()` at one `pxPerMM`), with its size,
  terms, error, connectors and ready-list warnings, and one plain line on what's good and bad about it.
- End with a recommendation and why, and ask which to refine.

### 5 · Refine in plain words
- Turn the person's words into controls (the table in AGENT.md): "bigger", "keep the ring", "clean up the text",
  "fewer lines between the letters", "make 12".
- Show the new version next to the last one. A few variants per round at most.
- When nothing works, say so and say why (e.g. "the strokes are 2.5 mm, too narrow for two strands"), with the next
  thing to try (bigger, a finer needle, retype).

### 6 · Judge it honestly
- An all-green ready list isn't enough: look at the as-printed view and read every letter.
- Watch the connectors count and the coverage line (how much of the picture the line misses).
- Things that made it worse in the trials: Round corners at 1.8 mm (letters melted into a scribble); Optimize's extra
  smoothing carried to a bigger size; the Outline style on bold logos (the P's bowl got lost, 24 connectors).

### 7 · Deliver
- Name the file (design and size, e.g. `jakarta-140mm`), export the G-code (and DXF or plotter SVG if asked), and say
  what hasn't been checked: no file from the trials has been printed yet.
- Never send to the printer (decided 17 October 2026): the person checks and prints.

## Fixes to the app

### Already done (v156–v158)
Picture from a link and viewBox-only SVGs; `body[data-state]`, `whenReady()` (waits for a linked picture),
`status()`; ready-list lines for the picked size, far-away parts, coverage and drift; Line to picture; labelled
sizes; Optimize at the top of the Fit card, busy and cleared from the click; From above; clearer chosen options; stale
export messages; the "as printed" label; ready-list wrapping.

### Next, biggest first
1. **Picture pieces** (docs/PICTURE-PIECES.md): split at gaps (Join within slider) or drawn; one scale; a G-code
   file per piece. The agent did this by hand with Select area and measured scales.
2. **Variations side by side**: keep several versions of a design (settings, size, pieces) with their numbers, and a
   sheet comparing them at one scale. The agent built these sheets from screenshots.
3. **Small parts, before tracing**: measure the picture's smallest letter height and stroke width in mm at the
   chosen size and say it against the needle ("tagline 4 mm tall: too small for the 0.84 mm needle; drop it, retype
   it, or make the print 3× bigger"), in the ready list and `status()`.
4. **A starting size for lettering**: for a picture with text, start where the strokes are wide enough for the needle
   (fix 3's measure), not at medium detail.
5. ~~**An agent API instead of poking internals**~~: done in v159 (`open`, `parts`, `select`, `set`, `optimize`,
   `export`, `view`; web-app/AGENT.md).
6. ~~**A picture of the result**~~: done in v159 (`unbroken.snapshot({ pxPerMM })`).

### Smaller
7. **Optimize and size**: offer size as something to try; when the size changes after optimizing, say the smoothing
   was picked for the old size and offer to run it again.
8. **Round corners**: limit or warn when the radius is large next to the letters (1.8 mm wrecked 10 mm letters).
9. **Text**: the Sans font has no İ (Polimeks' dotted I came out as a "?" shape); Auto left a retyped word at 448
   terms where more looked needed: check.
10. **status() on the Design step**: "Layers still being worked out" reads as a warning there; report layers pending
    separately.
11. **Plate view at a fixed scale** (an option), so two designs can be compared by eye.

## Open questions
- The size rules in step 2 come from screen previews, not prints. A test print of lettering at 8, 10, 13 and 16 mm
  letter height (the test-print matrix) would set them.
- Is a finer needle available for the choc mate 2? It would change every size rule above.
