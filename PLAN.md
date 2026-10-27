# Plan · decided 2026-10-16

Gone over one at a time with Nicolaas. The first list was built in v75.

## Done in v75 (2026-10-16)
1. **Height only.** On the 3D tab you type the height (mm); "layers above the base" becomes a readout. Layer height stays adjustable per print (it depends on the chocolate and its temperature).
2. **Machine card → folded "Fine-tuning".** Layer height, feed and lift start from the chocolate / printer profile, can be changed per print, and show when they differ from the profile. Z follows the layer height. Position X/Y and E per mm stay.
3. **Presets go.** Remove Start from (Line drawing / Photo / Logo); the tracing sliders stay visible. Optimize tracing stays.
4. **Help text → ⓘ tooltips.** Live readouts and warnings stay on the page; explanations of what a control does move to a tooltip on its name.
5. **DXF for choc OS stays** until the tracer's own G-code is proven on a few prints.
6. **Leave small areas open: one per card** (Base and Infill each have their own).
7. **Cartridge refill warning.** Says when a plate needs more than one cartridge, and after which copy to refill.
8. **Test print.** A small G-code of numbered test strips, varying one of: layer height, speed, line spacing, flow.
9. **Layer slider** in the 3D Layers view: shows the print up to a chosen layer, that layer highlighted and labelled; arrow keys step.
10. **Ready-to-print checklist** above Export G-code: traced, fits the needle, on the plate, layer times, cartridges; each line links to its card; asks before exporting with a problem.

## This weekend
- **GitHub.** Move the project to a GitHub repository: history, `git pull` on the Mac instead of the sync, possibly GitHub Pages.

## Later
- **Chocolate database** with prices, designed together with **print recipes** (saved 3D settings by name), **grams and cost** readouts, and a **print log** (settings stamped on each export, rated after printing).
- **Personalized batches** (a list of names → one plate). Secondary idea.
- **Split a model into printable parts** to glue together after printing (chocolate glues with chocolate): cut a
  complex model (a mug and its handle, a tree's tiers, letters standing up) where it overhangs or branches, lay each
  part on its flattest side, and print them as copies on one plate. Suggested 17 October after the support challenges.

## Decided 26 October: the Art tab
Every source comes in through an Art tab, then Art → Trace → 2D or 3D; single line for the printers (all layers merged
by default, or one picked), multi-line for the plotter, 2D may skip Trace; styles per layer with taps to override;
image-driven art may try the printer. The whole plan and its phases: [`docs/ART-PLAN.md`](docs/ART-PLAN.md).

## Not doing
- Backing plate under the drawing.
- Bridging (a line spanning open air between two supports): chocolate can't span even short gaps. A span is
  supported (the thin wall's recessed arch reads well) or split into parts.

## Rules
- One chocolate per print: cartridges can't be changed mid-print (each needs a calibration).
- One continuous line per copy, always: supports, fills and joins are part of that line.
- Not every 3D shape suits the technique: only outsides print, layer by layer, as one line. Shapes with big
  overhangs, hanging parts or loops print with support (Flared skirt or Thin wall) or not at all; that is a limit of
  the technique, not something to engineer away. Letters and flat designs print best lying flat.
- Challenges with every version (`source/challenges/`): practical prints through the app; the renders are reviewed.
