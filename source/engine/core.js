/* Unbroken — the engine (no DOM). Works in the browser (window.UNB), in a Web Worker and in Node.

   The engine is split into parts, one per stage, loaded in this order. Each adds its functions to the one UNB object;
   helpers that more than one part needs live in 00-util.js (UNB._u). UNB.name = public; plain names are helpers inside
   their own part.

    00-util.js Shared helpers (UNB._u): labelComponents, label4, labelBoxes, rasterPolyline, isoContours, cellGrid,
    bbox,
                      cumLength, resampleLoop, makeUF, makeHeap, gaussKernel, plotLine, bilinear, f3, svgPolylines
    01-image.js    1. Image in — RGBA pixels → a clean grayscale image.
                      UNB.toGray, UNB.blur, boxBlur, UNB.prep, smoothLabels, UNB.levels, toLab, UNB.colourLevels,
                      boxSum,
                      UNB.gradient
    02-lines.js 2. Line maps — grayscale → a 1-pixel map of the lines to draw: centerline or outline, erasing.
                      UNB.canny, UNB.lineStrokes, UNB.levelEdges, UNB.otsu, UNB.thin, UNB.centerline, UNB.pruneSpurs,
                      UNB.erase, UNB.lineScore
    03-text.js     3. Text — typed text → strokes in a single-stroke font → a line map.
                      UNB.textLayout, UNB.rasterText
    04-walk.js     4. The walk — line map → one continuous path over every line pixel, onto the middle of each stroke;
                      corners rounded; out-and-back strokes spread into strands with stroke-end loops.
                      UNB.edt, walkRouter, walkParts, walkGraph, walkPairEnds, walkDouble, walkTour, UNB.buildWalk,
                      UNB.roundCorners, UNB.offsetDoubled, UNB.cutSwallowtails, UNB.mirror,
                      smoothRun, UNB.snapWalk
    05-fill.js     4b. Fills — chocolate infill (areas the printed line encloses) and the 2D tab's pen fills.
                      UNB.infill, UNB.penFills, UNB.levelFills
    06-fourier.js  5. Fourier series — path → evenly spaced samples → one series per axis → the curve from chosen terms.
                      UNB.resample, UNB.fft, UNB.spectrum, UNB.termOf, UNB.synth
    07-measure.js  6. Measuring — how far a curve is from the traced line (error, stray, missing).
                      rasterize, UNB.chamfer, segGrid, distTo, UNB.pathError
    08-shape.js    7. Shaping the drawn line — no crossings, minimum spacing, problem spots, simplification.
                      arcSteps, pointGrid, skipPair, UNB.enforceSpacing, UNB.closestGap, UNB.drift, UNB.problemSpots,
                      UNB.findCrossings,
                      UNB.uncross, UNB.resampleCurve, UNB.untangle, UNB.simplify
    09-plate.js    8. Size, plate and layers — smallest size that keeps the spacing, the box round a design, copies on
                      the plate, layers stacked into one 3D path.
                      UNB.smallestPrintSteps, UNB.minBox, UNB.plateLayout, UNB.plateLocal, UNB.layerStack, UNB.lapFeeds,
                      UNB.testStrips
    10-export.js   9. Export — the files the app offers: plotter-page SVG, flat DXF, G-code, ZIP.
                      bezierRaw, svgPathD, dxfDoc, UNB.toBezier, UNB.exportDXF, UNB.exportPlotSVG, UNB.exportLayersSVG,
                      UNB.exportGcode,
                      UNB.readGcode, CRC,
                      UNB.zip
    11-stages.js  10. Pipeline stages — what the app calls, in order; pure data in and out (Web Worker or page).
                      UNB.stagePrep, UNB.stageLines, UNB.stageWalk, UNB.stageTrace, UNB.stageStrokes, UNB.stageVector,
                      UNB.overlapAllow,
                      UNB.allowFromMask, UNB.decodeArgs,
                      UNB.stageSignal,
                      UNB.sweepSteps, UNB.pickTerms, UNB.TERM_TOL, UNB.autoTerms, UNB.shapeLine, UNB.stageFinal,
                      UNB.stagePrint, UNB.scoreLines
    12-models.js  11. Models — STL meshes → slices → one fitted line per layer; or a hidden-line drawing of a view.
                      cornerKey, UNB.parseSTL, UNB.orientMesh, UNB.sliceMesh, pairs, loopArea, inLoop, UNB.modelLayer,
                      UNB.fillPlan,
                      regionGrid, boxOf, shareIn, UNB.unionOverlaps, UNB.modelOverhang, UNB.modelSupport,
                      UNB.modelStack, UNB.hiddenLines, UNB.chainSegments, UNB.exportLinesSVG
    13-patterns.js 12. Patterns — geometric abstract art as lines to trace (the Art tab's Pattern): labyrinths,
                      space-filling curves, spirals, a whirl, waves, harmonic curves, tiles; and patterns that draw a
                      picture's light and dark as one line.
                      seeded, polyInside, largestGroup, roundLoop, roundOpen, roundPts, gcd, ringTrack, labyrinth,
                      lsystem, boxed, moore, hilbert, gosper, doubleSpiral, whirl, waves, spirograph, lissajous, rose,
                      truchet, gammaOf, easeOut, toneIn, toneGrid, hilbertTone, wavesTone, spiralTone, labyrinthTone,
                      closeGaps, outlineLoop, rangeParam, choiceParam, checkParam, pct, ord, off0, SHAPE, SIDES,
                      CORNERS, CONTRAST, INVERT,
                      UNB.PATTERNS, UNB.PATTERN_SHAPES, UNB.patternDefaults, UNB.patternLayout, UNB.pattern
    14-photo.js   13. Photos — a camera photo → a clean picture: the page found and flattened, the light evened out,
                      the paper white and the ink kept, or an object's colours balanced.
                      photoCells, convexHull, quadArea, widestQuad, orderCorners, UNB.findPage, sharpenCorners,
                      homography, UNB.pageSize, UNB.warpQuad, paperLight, shareBelow, UNB.PHOTO_KINDS,
                      UNB.photoClean, UNB.photoPicture
    15-cutout.js  14. Cutting out an object — a box round it (and keep / remove strokes) → its mask: colour models of
                      the object and its surroundings, then the cheapest cut between them (GrabCut, a max-flow).
                      fitMix, mixCost, makeFlow, markStroke, UNB.cutout
    16-molecule.js 15. Molecules — atoms and bonds (a SMILES laid out by RDKit, or drawn) → a skeletal formula: bonds as
                      strokes (double and triple as parallel strokes), the other atoms' letters with their hydrogens.
                      ELEMENTS, UNB.molFromRDKit, ringOf, segOutside, UNB.molecule; editing: molCopy, bondLen,
                      UNB.molBondLength, bondAt, molNbrs, VALENCE, valences, UNB.molHydrogens, UNB.molHit, freeDir,
                      atomAt, molLink, UNB.molGrow, UNB.molRing, UNB.molCycleBond, UNB.molSetAtom, UNB.molErase,
                      UNB.molBlock

   Typical run (11-stages.js): stageLines → stageWalk → stageSignal → sweepSteps + pickTerms
   → synth → stageFinal.

   Loading: the page lists the parts in web-app/index.html (in this order); a Web Worker loads core.js, which loads
   the parts with importScripts; Node requires core.js, which requires them. Test E25 checks the lists agree.
*/
(function (root) {
  "use strict";
  const PARTS = [
    "00-util.js",
    "01-image.js",
    "02-lines.js",
    "03-text.js",
    "04-walk.js",
    "05-fill.js",
    "06-fourier.js",
    "07-measure.js",
    "08-shape.js",
    "09-plate.js",
    "10-export.js",
    "11-stages.js",
    "12-models.js",
    "13-patterns.js",
    "14-photo.js",
    "15-cutout.js",
    "16-molecule.js",
  ];
  if (typeof module !== "undefined" && module.exports) {
    // Node
    for (const p of PARTS) require("./" + p);
    root.UNB.PARTS = PARTS;
    module.exports = root.UNB;
  } else if (typeof importScripts === "function") {
    // a Web Worker (worker.js): the parts sit next to this file
    importScripts(...PARTS);
    root.UNB.PARTS = PARTS;
  } else if (root.UNB) root.UNB.PARTS = PARTS; // the page: index.html loads the parts itself, before this file
})(typeof window !== "undefined" ? window : globalThis);
