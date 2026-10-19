# choc OS (the choc mate 2's own slicer), as of 15 October 2026

Read from https://www.choc-mate.de/app/ while signed in (subscription "standard_business", 50 credits; each G-code
export costs credits and can't be changed afterwards). Values are the ones set in the account at the time; the help
text is the app's own tooltip, quoted.

## Settings and their help text

| Group | Setting | Value | Range | choc OS help text |
|---|---|---|---|---|
| Basic | Nozzle size | 0.84 – Green | 0.41 blue, 0.58 pink, 0.84 green, 1.00 transparent, 1.19 black, 1.36 brown, 1.60 olive … | Diameter of the nozzle used. Custom values can be set at 'Extrusion Settings'. |
| Basic | Printer model | choc mate 2 | choc mate 1, choc mate 2, Custom | Select printer to set dimensions and available features. (Bed shown as X 340, Y 232, Z 160 before signing in.) |
| Basic | Filename | (free text) | | Overwrites the file name with a custom string. |
| Advanced | Purge line | on | | Line at the beginning of every print to provide constant chocolate flow. Recommendation: active |
| Advanced | Layer height | 0.3 mm | 0.1–1, step 0.1 | Recommendation 0.3mm. Higher layers speed up printing but decrease quality. |
| Advanced | Mirror | off | | Mirrors all objects in Y direction. |
| Retraction | Extra unretract distance | 0.3 | 0–5, step 0.1 | Length of retraction. (Stops oozing of chocolate) |
| Retraction | Retraction speed | 0.2 mm/s | 0.1–10 | Speed of retraction move in mm/s. Depending on the viscosity different settings can improve results. |
| Retraction | Use printer unretract pause time | on | | Uses the unretract pause time set in the printer. |
| Retraction | Wipe time | 0.2 s | 0–0.2 | Time in seconds the retraction starts before the actual end of the curve. This prevents blobs at the end. A good starting point is half the time needed for a retraction. |
| Retraction | Retraction distance | 0 | 0–1, step 0.001 | Extra length of first Unretract. (Can help with a lack of chocolate at print start.) |
| Arrangement | Object spacing | 5 mm | 0–100 | Space between objects. Prevents collisions of the print head with finished prints. Can be decreased for flat prints. |
| Arrangement | Center | on | | Places the object (or the arranged objects) in the center of the print bed. If deactivated prints can be outside the printable area! |
| Arrangement | Sort print sequence | on | | If active the sequence of prints will be sorted. |
| Arrangement | Sorting direction | Prioritize X | X / Y | X means line by line, Y means column by column. |
| Arrangement | Nesting | on | | Arranges the objects on the print bed. If inactive objects can overlap. |
| Speed | Print speed | 20 mm/s | 10–100 | Movement speed while printing. Sets the maximum speed if 'Time per layer' is active. |
| Speed | Use time per layer | on | | The print speed will be adjusted depending on the size of the print. This will give the chocolate time to harden. |
| Speed | Time per layer | 20 s | 1–100 | Minimum time for one layer. For larger prints the speed will be limited by the 'Print speed'. |
| Extrusion | Extrusion multiplier | 1.00 | 0.5–1.5 | Factor to set the amount of chocolate extruded. (>1: more chocolate; <1: less chocolate) |
| Presets | Preset | Words | Words, Milk Chocolate, Samples, [save as new] | |
| Print mode | Print mode | 2.5D-print | 2.5D-print, Bar mode | Bar mode will only create single layer prints which are supposed to go on top of something. In 2.5D Mode you can set the desired height but each print needs to be one single closed curve. |
| Input | Upload 2D curve | | .dxf | In 'bar mode' the curves are used as uploaded and the file can contain multiple curves. For 2.5D printing each object must be made from one single closed curve! |
| Input | Upload 3D curve | | .dxf | Curves are transformed into .gcode without further changes. Each object needs to be one single curve. Makes altering layers possible. |
| Input | Text input 1–5 | "Welcome" | | Each text input will be one line. In 2.5D mode spaces will be ignored! |
| Font | Font | Quicksand | Quicksand, EMS Invite, EMS Readability | Please select Quicksand for 2.5D |
| Font | Equal font size | No | | Whether all lines share the same font size or each is scaled to the maximum size. |
| Size | Size | Custom (X 340, Y 20, Z 1 when read) | Box 126×126 (9), Box 198×94 (10), Box 198×162 (20), Miniature box, Business card, 100×100 bar, 94×64 bar, Custom | Maximum size of your object, scaled proportionally in X and Y until either dimension hits its maximum. Z: for precise dimensions set a height divisible by the layer height. |
| Quantity | Quantity | 10 | | Number of copies. |
| Quantity | Fill print bed | on | | Fits as many objects as possible onto the print bed. The spacing is defined by 'Object spacing'. |

## What this means for the tracer

- **choc OS takes DXF.** "Upload 2D curve" (one closed curve per object for 2.5D) and "Upload 3D curve" ("transformed
  into .gcode without further changes") mean the tracer's single closed line can go into choc OS as a DXF and come out
  as G-code the printer is known to accept, with its purge line, retraction and speed rules. The 3D DXF export that
  was removed on 15 October (ROADMAP.md, Maybe later) now has a real use.
- **Speeds and layers match:** 0.3 mm layers, 20 mm/s, at least 20 s per layer are the tracer's settings.js values.
- **Added to the tracer in v66** (from the sample, `sample/choc-os-welcome.gcode`): the needle size and purge line at
  the start, retraction with a wipe at the end of each copy and an unretract plus the printer's pause before the
  next, and E per mm worked out from the needle. Left out on purpose: the extrusion multiplier (set on the printer),
  nesting, mirroring.
- **What the sample shows:** one copy, 14 layers of 0.3 mm, each layer's E reset to 0 (`G92 E0`), the last ~25 mm
  of each lap climbing to the next layer, 0.000457 E per mm, a 4.0 mm wipe move (20 mm/s × 0.2 s) pulling back to
  E-0.3, then the end lines. CRLF line endings.
- **Three needles, two copies** (`sample/welcome-2x-0.84mm.gcode`, `-1.19mm`, `-1.60mm`): E per mm in the file is
  proportional to the needle (0.000457 / 0.000647 / 0.000870), so the needle sets the plunger speed in the file.
  Copies print one after the other, all 17 layers each; between them: the wipe, then "; starting connection" at F7200
  (lift to 1.7 mm above the top, travel, lower to the first layer), then unretract F12 and the pause. Every layer at
  F1200 (each lap is about 600 mm, 30 s, longer than the 20 s minimum, so nothing is slowed).
