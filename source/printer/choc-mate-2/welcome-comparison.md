# Welcome: choc OS vs Unbroken G-code

17 October 2026, Unbroken v92. Comparing the same design printed two ways:

- **choc OS:** `Unbroken/source/printer/choc-mate-2/sample/choc-os-welcome.gcode` (1 copy, 14 layers)
  and `welcome-2x-0.84mm.gcode` (2 copies, 17 layers).
- **Unbroken:** `welcome_084_1x.gcode` and `welcome_084_2x.gcode`, made by the Unbroken engine.

The Unbroken files use choc OS's own line: its layer-1 points, taken straight from the file, not re-traced, because
the letters' outlines touch. They also use the same needle (0.84 mm), layer height (0.3 mm), speed (20 mm/s), layer
count and copy positions. So the only differences are in how each program turns that line into G-code.
`tools/summarize.js` and `tools/laps.js` do the measuring.

## The same

| | choc OS | Unbroken |
|---|---|---|
| Start code, needle size line, purge line | ✓ | identical |
| E per mm | 0.000457 | 0.000457 (needle × layer ÷ cartridge area) |
| Print speed | F1200 (20 mm/s) throughout | F1200 throughout (laps take ~31 s, so the 20 s minimum never slows them) |
| Before the first copy | retract 0.3 at F12, `G92 E-0.3` | same |
| Starting a copy | unretract at F12, `G4 P{{perm.unretractPauseTime}}` | same |
| Ending a copy | 4 mm wipe along the line at F1200, pulling back 0.3 | same, same point |
| End code | retract 0.3 at F3600, Z +3, park X335 Y232 | same lines |
| Top of the print | 5.1 mm (2 copies), 4.2 mm (1 copy) | same |
| Chocolate (E total) | 9.53 (2×), 3.92 (1×) | 9.56, 3.94 (+0.3%) |

## Different

1. **How the line climbs (the big one).** choc OS prints each layer flat and climbs 0.3 mm over the last 30 mm of
   the lap, at the same place every layer, which leaves a seam. Unbroken spirals: Z rises all the way round every
   lap, so there's no seam. To start and stop the spiral it adds a half-thickness lap at the bottom (the bead grows
   from nothing to full) and one at the top (the bead tapers away into a flat top). That's one more lap of travel
   for the same chocolate.
2. **Time.** 2 copies: 17.9 min vs 19.0 min. 1 copy: 7.7 vs 8.2. The extra lap explains it (about 31 s a copy).
3. **Travel between copies.** choc OS lifts 1.7 mm above the finished copy and moves Z at F7200 (120 mm/s) up and
   down. Unbroken lifts by the Lift setting (5 mm) at F3600 and lowers onto the next copy at F600 (10 mm/s): slower
   and higher, about a second longer per copy.
4. **The first move.** choc OS travels at the purge height (Z2) and drops to Z0.3 at F3600. Unbroken lifts to Z5.3
   first and lowers at F600.
5. **The very end.** Unbroken lifts 5 mm at F600 after the last wipe, before the printer's end lines (which lift 3 mm
   more).
6. **Bookkeeping (no effect on the print).** choc OS resets E every layer and writes every move's Z with long
   decimals. Unbroken resets E per copy, writes Z only when it changes, and rounds to 3 decimals. Unbroken's files
   are about the same size.

## To try on the printer

- The spiral vs the seam ramp is the one difference that could show in the chocolate: a smooth wall with no seam
  (Unbroken), or a known-good result with a seam (choc OS). Worth a side-by-side print of the Welcome from both
  files.
- Z at 120 mm/s works on this printer in choc OS's files. If Unbroken's slower Z moves are fine on the printer,
  nothing needs changing. If you want choc OS's speeds, set `zTravelSpeed` and `zApproachSpeed` in settings.js.
