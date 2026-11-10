# The features

Written by `source/tools/feature-map.js` from the code (run it again after adding or changing a feature; don't edit
this file by hand). How modules work, and how to add one, is in DESIGN.md, Modules.

Each feature is a folder in `web-app/features/`, a line in `web-app/settings.js` (`features`), and the parts of
`web-app/index.html` marked `data-feature="name"`. To try the app without one, add `?off=name` to the address; to
work on one, its folder, its marked parts of the page and its tests are everything it is.

| Feature | What it is | Scripts | Lines | Parts of the page | Tests |
|---|---|---|---|---|---|
| **plotter** | made for a pen plotter: the Plot step, pens, fills, SVG | `plot.js` | 1062 | 6 | E22, A15, A16, A32 |
| **model** | a 3D model (STL) sliced into layers | `model.js`, `sample-skull.js` | 796 | 8 | E23, E30, E50, A17, A28 |
| **vase** | Make a vase (needs model) | `vase.js` | 462 | 2 | E57, A59 |
| **patterns** | the pattern styles (labyrinth, spirograph, wave portrait …) | `pathpad.js`, `patterns.js` | 570 | 4 | E33, A31 |
| **molecule** | a molecule drawn from its name | `molecule.js`, `moleditor.js` | 939 | 5 | E39, E40, E44, A40, A45, A50 |
| **pieces** | a text printed as a piece per line | `pieces.js` | 357 | 1 | E31, A29 |
| **camera** | a photo of a drawing, straightened | `camera.js` | 508 | 5 | E37, E43, A36, A44 |
| **cutout** | cut the subject out of a picture | `cutout.js` | 311 | 2 | E38, E43, A39 |
| **levels** | Grey levels | `levels.js` | 279 | 2 | E34, E36, E41, E45, A32, A42, A43, A46 |
| **optimize** | Optimize and the starting points | `optimize.js` | 266 | 2 | A08 |
| **testprint** | the test print | `testprint.js` | 169 | 1 | A25, A48 |
| **matrix** | the test matrix | `matrix.js` | 277 | 1 | E46, A49 |

## How each one joins the app

### plotter

made for a pen plotter: the Plot step, pens, fills, SVG

- steps and chips of the map: plot, fills, pexport
- made for: plot
- controls saved with a design: 13
- moments it answers: save, restore, designUI, redraw, lineReady, fitWidth, drawnAsIs, buildFile, lineMode, pageBox
- moments it announces: sized

### model

a 3D model (STL) sliced into layers

- examples: skull
- kinds of art: model
- moments it answers: ready, buildFile, save, modelRestore, modelEnter, modelFile, modelDraw, modelPlate, modelLayers, modelPrintedMM, modelHeight
- moments it announces: modelSized, redraw, preset, modelSave, modelRestoring

### vase

Make a vase (needs model) Needs: model.

- examples: wavyvase
- steps and chips of the map: vprofile, vtexture, vmove
- moments it answers: ready, modelSave, modelRestoring, modelSized, artUI

### patterns

the pattern styles (labyrinth, spirograph, wave portrait …)

- examples: labyrinth, spirograph, portrait
- kinds of art: pattern
- moments it answers: sized, artUI, artSave, artRestore, fillPattern
- moments it announces: pageBox

### molecule

a molecule drawn from its name

- examples: theobromine
- kinds of art: molecule
- controls saved with a design: 1
- moments it answers: artSave, artRestore
- moments it announces: plateUI

### pieces

a text printed as a piece per line

- moments it answers: piecesOn, piecePlate, pieceLayers, lineLifts, plateUI, piecePlateText, pieceShown

### camera

a photo of a drawing, straightened

- moments it answers: artUI

### cutout

cut the subject out of a picture

- moments it answers: pictureCut, workingKey, workingPicture, toolRender, toolDown:cut, toolMove:cut, toolUp:cut, handEditsReset, keepCut, save, restoredSource

### levels

Grey levels

- steps and chips of the map: levels
- moments it answers: prepUI, levelSettings, levelFlags, noLinesAdvice, fillMask, levelFills, levelWord

### optimize

Optimize and the starting points

- moments it answers: sourceChanged, preset

### testprint

the test print

- steps and chips of the map: tests

### matrix

the test matrix

- steps and chips of the map: tests
- controls saved with a design: 11
- moments it answers: designUI, layersReady
- moments it announces: piecesOn, modelLayers
