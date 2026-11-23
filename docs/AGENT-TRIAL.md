# Agent trial: point and click · 23 November 2026 (v155)

An agent (Claude in Chrome) took a picture to G-code through the live GitHub Pages site, the way a person would.
The point was to find what gets in an agent's way before building a CLI, MCP server or hosted service
(groundwork → CLI → MCP → hosted). Most of what it found was fixed in v156; see **Status** at the end, and
`web-app/AGENT.md` for how an agent drives the app now.

## The runs

Test picture: the **Polimeks** logo (Wikimedia Commons, PD-textlogo): a stylized "P" with a thin ring, over the bold
word POLIMEKS. Printer: choc mate 2, 0.84 mm needle, one copy, one layer. None of the files has been printed.

| | Terms | Error | Connectors | Size (as exported) | File |
|---|---|---|---|---|---|
| 1. Whole logo, defaults | 605 | 0.12 mm | 8 | 58.8 × 25.9 mm (app picked "medium detail") | `polimeks-logo_084_1x-gcode.zip` |
| 2. Whole logo, 90 mm + Optimize tracing | 710 | 0.03 mm | 15 | 90.9 × 39.3 mm | `polimeks-90mm_084_1x-gcode.zip` |
| 3a. Mark only (Select area) | 332 | 0.04 mm | 1 | 45.9 × 27.0 mm (app sized it) | `polimeks-mark_084_1x-gcode.zip` |
| 3b. Word only (Select area), width set to 88 mm | 448 | 0.03 mm | 12 | 88.9 × 14.4 mm | `polimeks-word_084_1x-gcode.zip` |

- Run 2 vs 1: cleaner letters, less wobble. Optimize changed threshold 0 → 30 and smoothing 0.24 → 0.12 mm
  (line to picture 0.24 → 0.15 mm, 16 tries).
- **Splitting (run 3) traced the mark much better**: the thin ring around the "P" came through whole, with a single
  connector. In the whole-logo runs the ring was only partly traced, because the line has to get from the mark to the
  word and back.
- **The two pieces don't match in scale.** Each selection is sized on its own (the mark 44 mm wide, the word 51.6 mm
  until the width was typed in). Next to an 88 mm word the mark is likely too big compared with the logo (roughly
  36–40 mm there). Picture pieces (docs/PICTURE-PIECES.md) trace every piece at the picture's own scale.
- Correction: the preview's "tilted 16°" on the mark meant the smallest box round the line sits at 16°; the drawing
  itself wasn't turned. v156 labels that box "as printed · smallest box at 16°".

## Direction: options first, then refine

People won't know what they want before they start (decided 23 November 2026). So the agent doesn't open with a
questionnaire: it makes a few distinct options, shows them side by side with their numbers, and the person picks one
and refines it in plain words.

For a logo like this, the first set of options could be:
1. **Whole logo, one line**, at the app's medium size
2. **Whole logo, larger**, after Optimize tracing
3. **Pieces, mark + word**, at the logo's own scale, each its own G-code, for one box
4. **Simplified**: text only, or the mark only

Then the person refines with feedback like "bigger", "keep the ring", "fewer lines between the letters", "make 12".
The agent turns each into settings (the table in `web-app/AGENT.md`) and shows the new version next to the old one.

Ask up front only what the options can't show: **printer or plotter**, and **a rough size or box** if there is one.

### Refinements the agent should know how to offer
- **Size**: width, height, fit inside a box, smallest letter height
- **What survives**: keep or drop thin decorative parts; crop or remove parts of the picture
- **Pieces**: one line, or split into pieces (each its own G-code)
- **Exact or simplified**: closer to the picture vs a smoother, simpler chocolate look
- **Centerline or outline**: one line down each stroke, or around each letter
- **Connectors**: fewer, or placed along the baseline / behind the mark
- **Flat or tall**: one layer, or stacked to a height
- **Copies** and the plate
- **Needle and chocolate**
- **Files**: G-code, DXF for choc OS, plotter SVG; the file name

## Answered

- **Centerline on bold letters looks like an outline.** Expected: Centerline draws each stroke out and back as two
  strands one line spacing apart (1.34 mm with the 0.84 mm needle). On strokes 2–3 mm wide those two strands sit
  near the stroke's edges, so the line looks like it outlines each letter.
- **Terms stayed at 605 after going from 58 to 90 mm.** Expected: the term count is picked again only when the print
  is traced at a finer resolution, which starts past about 100 mm along the picture's long side.

## Status (v156)

| # | Found | Status |
|---|---|---|
| 1 | Picture pieces | Planned: docs/PICTURE-PIECES.md (each piece its own G-code, one scale) |
| 2 | Variations side by side | Open: the core of options-first |
| 3 | Plain-word refinements mapped to controls | Done: the table in web-app/AGENT.md |
| 4 | Import from a link | Done: the Picture card's link box, a pasted link, `?src=` |
| 5 | SVG input | Fixed: a viewBox-only SVG came in at 300 × 150, stretched; now 1600 px in its own shape |
| 6 | A "ready" signal | Done: `body[data-state]`, `window.unbroken.whenReady()`, the corner label is a live region |
| 7 | Which option is chosen | Done: an accent outline on the chosen side of every switch; `status().trace.style` |
| 8 | Select area moves the preview | The hint says the preview now shows the whole picture (the switch is on purpose: you select on the picture) |
| 9 | Stale export message | Fixed: clears when the design, name, copies, width or needle changes |
| 10 | Two different "errors" | Done: Optimize reports "Line to picture"; AGENT.md explains both |
| 11 | Two different sizes | Done: "the line itself …" in the Size card, "as printed" on the preview's box, a tip on Width/Height |
| 12 | Say when the app picks the size | Done: "Size picked for you: medium detail, … mm" in the ready list and `status()` |
| 13 | Complexity after a resize | Expected (Answered, above) |
| 14 | Quality checks in the ready list | Done: far-away parts left out; how much of the picture the line misses (from 8%); line pushed off the drawing (from 2.5%). Not yet: smallest letter feature against the needle |
| 15 | A flat top view | Done: From above in the 3D layers view |
| 16 | Optimize tracing easy to find | Done: top of the Fit card (it stays on the Line step, where text uses it too), and the ready list points to it. Not yet: size as something to optimize |
| 17 | Stable ids documented | Done: web-app/AGENT.md |
| 18 | `window.unbroken.status()` | Done |
