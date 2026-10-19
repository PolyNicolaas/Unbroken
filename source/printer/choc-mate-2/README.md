# choc mate 2 (chocolate³) printer profile

Source: email from the manufacturer, chocolate³ (Benedikt Daschner), received 2026-10-13. They note that
printing with anything other than choc OS is at your own risk, and that the attached slicer profile is about
8 months old. `start.gcode` and `end.gcode` in this folder are their scripts, copied verbatim.

## Manufacturer settings

| Setting | Value |
|---|---|
| Nozzle diameter / extrusion width | the actual nozzle diameter |
| Extrusion multiplier | 1.00 |
| Retraction distance | 1 mm |
| Layer height | 0.3 mm |
| Temperature | **none**: no temperature commands at all |
| Coordinates / units | absolute, metric (G90, G21) |
| Extruder | Tool 0 (T0) |
| Build volume | 340 (X) × 232 (Y) × 160 (Z) mm |
| Print speed | 50 mm/s (F3000) |
| Minimum layer time | 20 s |

**Never include:** temperature commands (M104/M109/M140/M190), motor-off (M84/M18) or heater-off commands
at the end. Many slicers add these by default; the manufacturer says to strip them.

## Notes from reading the scripts

- The start script draws a prime line along the back edge (Y232, X80→30), extruding E1.3 over 50 mm, then
  wipes sideways and finishes at Z2 with E reset to 0 in absolute extrusion mode (M82).
- Z moves the bed ("move bed up" lowers Z), so Z is the nozzle-to-bed gap.
- `@nosize` / `@size` are host directives, not G-code (they appear to mark the prime moves as excluded from
  the print-size calculation). Still to confirm: does choc OS / the printer accept them in a file, or should
  they be stripped when sending directly?
- The end script retracts 0.5 mm, lifts 3 mm and parks at X335 Y232.

## Still needed

- The slicer profile attachment from the email: it should hold the filament (cartridge) diameter, which
  sets how much E to extrude per mm of line. Without it, E per mm has to be calibrated by hand.
- The actual nozzle diameter(s) in use.

## The exporter today (`source/engine/10-export.js` → `UNB.exportGcode`), v66

Built from choc OS's own file (`sample/choc-os-welcome.gcode`, read 15 October 2026; see `choc-os.md`), which is
newer than the manufacturer's scripts above. Test E28 checks the tracer's files against it.

| Part | What the tracer writes | From |
|---|---|---|
| Start | power on, `@set global.JobNozzleDiameter {needle}` + `@call MatchNozzleSize`, the purge line along the back edge (E0.5 → E0.9, as choc OS) | settings.js `startGcode` |
| Before the first copy | retract 0.3 mm at 0.2 mm/s (F12), `G92 E-0.3` | `retraction`, `retractSpeed`, `firstUnretractExtra` |
| Each copy | lift, travel at 120 mm/s, lower, unretract at F12, `G4 P{{perm.unretractPauseTime}}` (the printer's own pause), `G92 E0`, print | `unretractPause`, `travelSpeed` |
| End of each copy | wipe: the last 0.2 s of the line (4 mm at 20 mm/s) prints while pulling back 0.3 mm | `wipeTime` |
| E per mm | needle × layer height ÷ cartridge cross-section (26.5 mm reproduces choc OS's 0.000457 for 0.84 mm at 0.3 mm) | `cartridgeDiameter` |
| End | retract, lift 3 mm, park at X335 Y232 | settings.js `endGcode` |

Not copied from choc OS, on purpose: the extrusion multiplier (set on the printer), nesting and mirroring.

**Settled (15 October, three more choc OS files):** the same Welcome, two copies, made with the 0.84, 1.19 and
1.60 mm needles (`sample/welcome-2x-*.gcode`). choc OS scales E by the needle in the file itself: 0.000457, 0.000647
and 0.000870 E/mm, exactly in proportion to the needle (the printer's `MatchNozzleSize` macro is told the size as
well). A 26.5 mm cartridge, a 50 cc syringe, gives all three within 1% (test E28). Between copies choc OS wipes,
lifts 1.7 mm above the top at F7200, travels, lowers, unretracts and pauses, as the tracer does (its lift is 5 mm).
