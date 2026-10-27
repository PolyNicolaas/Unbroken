/* Unbroken — settings you can edit
 *
 * Edit the values below in any text editor, save, and reload the app. Keep the punctuation as it is: text goes in
 * "quotes", numbers don't, and every entry ends with a comma. If the file has a mistake the app still opens, using
 * its built-in settings, and says that this file couldn't be read. To check the file, run the tests (test E14).
 *
 * Fields marked "(used)" change what the app does today. The others are kept as records and shown where useful;
 * cost and density will feed the chocolate and cost estimates planned for the G-code build-out.
 */
window.UNB_SETTINGS = {

  currency: "USD",                  // shown next to prices

  // ---------- Chocolates ----------
  // Pick one in the 3D tab. The first one is used when the app opens (unless defaults.chocolate says otherwise).
  chocolates: [
    {
      id: "dark",                     // short name used inside the app and in saved designs; letters, numbers and - only
      name: "Dark chocolate",         // shown in the menu
      color: "#3b2219",               // (used) colour of the printed line in the preview and on the plate
      cocoaPercent: 70,               // % cocoa solids

      // printing
      printSpeed: 20,                 // (used) mm/s along the line; the G-code feed is this × 60 (mm/min)
      needle: "18G",                  // (used) preferred needle, an id from the needle list below; picked with the chocolate
      workingTempC: [31, 32],         // tempered working range, °C (min, max)
      notes: "Temper before loading. Keep the cartridge at working temperature; let lines set before moving the plate.",

      // cost and material
      costPer100g: 2.50,              // price per 100 g, in the currency above
      density: 1.30,                  // g/cm³, turns line volume into grams
    },
    {
      id: "milk",
      name: "Milk chocolate",
      color: "#7b4a2d",
      cocoaPercent: 35,
      printSpeed: 20,
      needle: "18G",
      workingTempC: [29, 30],
      notes: "Softer than dark; may need a slightly slower speed on fine detail.",
      costPer100g: 2.20,
      density: 1.28,
    },
    {
      id: "white",
      name: "White chocolate",
      color: "#efe3c8",
      cocoaPercent: 30,
      printSpeed: 18,
      needle: "18G",
      workingTempC: [28, 29],
      notes: "Sets slowest of the three; allow extra time between layers.",
      costPer100g: 2.60,
      density: 1.27,
    },
  ],

  // ---------- Needles ----------
  // (used) The Needle menu, in this order. insideDiameter is the printed line width in mm; color is the needle's hub colour.
  // Colour codes follow the common blunt-needle code; check your packaging, as brands vary slightly.
  needles: [
    { id: "14G", gauge: 14, colorName: "olive",  color: "#6b7a3a", insideDiameter: 1.54 },
    { id: "15G", gauge: 15, colorName: "amber",  color: "#d99a2b", insideDiameter: 1.37 },
    { id: "16G", gauge: 16, colorName: "grey",   color: "#9aa0a6", insideDiameter: 1.19 },
    { id: "18G", gauge: 18, colorName: "green",  color: "#2e9e4f", insideDiameter: 0.84 },
    { id: "20G", gauge: 20, colorName: "pink",   color: "#e87fb0", insideDiameter: 0.61 },
    { id: "21G", gauge: 21, colorName: "purple", color: "#8a4fc4", insideDiameter: 0.51 },
    { id: "22G", gauge: 22, colorName: "blue",   color: "#2f6fd6", insideDiameter: 0.41 },
    { id: "23G", gauge: 23, colorName: "orange", color: "#ef7d22", insideDiameter: 0.33 },
    { id: "25G", gauge: 25, colorName: "red",    color: "#d63a3a", insideDiameter: 0.25 },
    { id: "27G", gauge: 27, colorName: "clear",  color: "#f4f4f4", insideDiameter: 0.20 },
  ],

  // ---------- 3D printers ----------
  // (used) The Printer menu in the 3D tab, in this order; the first is used when the app opens (unless defaults.printer
  // says otherwise). Copy an entry to add another printer; ids are letters, numbers and - only.
  printers: [
    {
      id: "chocmate2",
      name: "choc mate 2",
      bedWidth: 340,                  // (used) plate size X, mm
      bedDepth: 232,                  // (used) plate size Y, mm
      buildHeight: 160,               // (used) Z travel, mm: the stack must fit under it
      lift: 5,                        // (used) extra Z above everything printed when travelling between copies, mm
      layerHeight: 0.3,               // (used) layer height, mm, unless the chocolate sets its own (layerHeight on a chocolate)
      maxPrintSpeed: 50,              // manufacturer's print speed, mm/s
      minLayerTime: 20,               // (used) seconds per layer to start with: quicker layers are slowed down (3D tab)
      minPrintSpeed: 5,               // (used) mm/s: layers are never slowed below this, even if they print quicker
      // Retraction and wipe, as choc OS writes them (source/printer/choc-mate-2/choc-os.md and its sample G-code)
      retraction: 0.3,                // (used) mm the plunger pulls back at the end of each copy (0 = no retraction)
      retractSpeed: 0.2,              // (used) mm/s for pulling back and pushing forward again
      wipeTime: 0.2,                  // (used) s: the pull-back starts this long before the end of each copy's line
      firstUnretractExtra: 0,         // (used) mm extra on the very first push forward (a lack of chocolate at the start)
      unretractPause: "G4 P{{perm.unretractPauseTime}}",   // (used) after each push forward: the pause set in the printer
      travelSpeed: 120,               // (used) mm/s moving between copies
      // Z moves between copies. choc OS does the lift, the travel and the lowering all at 120 mm/s; these start slower
      // (the tracer's speeds before October 2026) until the faster ones are tried on the printer.
      zTravelSpeed: 60,               // (used) mm/s lifting clear of everything printed before travelling
      zApproachSpeed: 10,             // (used) mm/s lowering onto the plate for the next copy, and the last lift off the print
      // The cartridge: E per mm of line = needle inside diameter × layer height ÷ the cartridge's cross-section, so the
      // plunger speed follows the needle (and another printer's cartridge). 26.5 mm reproduces choc OS's own files
      // (0.84 mm needle, 0.3 mm layers: 0.000457 E/mm). Fine-tune the flow on the printer itself.
      cartridge: "50 cc plastic syringe",   // (shown) what holds the chocolate
      cartridgeDiameter: 26.5,        // (used) its inside diameter, mm
      cartridgeVolume: 50,            // (used) ml of chocolate in a full cartridge: the 3D tab warns when a plate needs more
      // (used) lines before and after the print, from choc OS's own file: power, the needle size for the printer's
      // MatchNozzleSize macro ("{needle}" becomes the needle's inside diameter), and the purge line along the back edge
      startGcode: [
        "G21 ; set units to mm", "G90 ; set to absolute positioning", "M80 ; turn on the power supply",
        "G54 ; switch to first (machine) coordinate system", "T0 ; select tool 0", "G92 E0 ; reset extruder",
        "@set global.JobNozzleDiameter {needle}", "@call MatchNozzleSize",
        "; purge line",
        "@nosize", "G1 X80.0 Y232 Z10 F3000.0 ; move to start position", "G1 E0.5 ; undo retraction",
        "G1 X30.0 E0.9 F150 ; extrude and move", "G92 E0 ; reset extruder", "G1 X25.0 F900 ; move to side a little",
        "G1 Z4 F5000 ; move bed up a bit", "G1 X20.0 ; move to side a little again", "G1 Z2 F5000 ; move bed up a bit", "@size",
        "G1 Z2 F3600",
      ],
      endGcode: [
        "G92 E0 ; reset extruder", "G1 F3600 E-0.3 ; retract", "M400 ; finish all moves", "G91 ; relative positioning",
        "G1 Z3 ; move up by 3mm", "G90 ; absolute positioning", "G54 ; first (machine) coordinate system", "G1 X335 Y232 ; park",
      ],
    },
    // {
    //   id: "my-printer", name: "My printer", bedWidth: 220, bedDepth: 220, buildHeight: 250, lift: 5,
    //   layerHeight: 0.2, maxPrintSpeed: 60, minLayerTime: 10, retraction: 0, cartridgeDiameter: 20, startGcode: ["G28"], endGcode: ["M84"],
    // },
  ],

  // ---------- Starting defaults ----------
  // (used) Everything the app shows when it opens, panel by panel. Undo, saved designs and presets work on top of these.
  defaults: {
    // --- Source
    source: "image",                  // "image" or "text"
    sample: "leaf",                   // the picture shown at start: "leaf", "shapes" or "smiley"
    startFrom: "",                    // a starting point applied at start: "", "drawing", "photo", "logo" or "lettering" (see presets below)

    // --- Tracing
    traceStyle: "centerline",         // "centerline" (one line per stroke) or "outline" (double line along edges)
    path: "closed",                   // "closed" (ends where it starts) or "open"
    threshold: 0,                     // ink threshold / edge sensitivity, -60 to 60
    smoothing: 1.2,                   // blur before tracing, px (0 to 3)
    ignoreSpecks: 15,                 // ignore bits of line shorter than this, px (0 = keep all)
    dropFarParts: 12,                 // drop small groups further than this % of the image from the rest (0 = keep all)
    looseEnds: "jump-much-shorter",   // "loop-back" (back along the stroke as a narrow loop), "jump-much-shorter" or "jump-shorter"
    workingResolution: 500,           // px the image is traced at per 100 mm of print, and never fewer (200–1500; 320 is faster, 720 more detailed). Bigger prints trace finer, up to engine.maxWorkingResolution
    lightLinesOnDark: false,          // true for light drawings on a dark background
    imagePrep: { brightness: 0, contrast: 0, backgroundTolerance: 0, evenOutLighting: false },   // -100–100, -80–150, 0–60 %, true/false
    crossings: "remove-all",          // "remove-all", "remove-doubling-back" or "keep"

    // --- Lines and size
    cornerRounding: 0,                // mm: rounds the drawing's sharp corners to at least this radius (0 = off, up to 5)
    size: "medium",                   // where the size slider starts: "smallest", "medium" or "high" (its detail marks), or a width in mm
    needle: "18G",                    // the needle on the 3D tab; it sets the line width (wins over the chocolate's needle)
    // lineWidth: 0.84,               // mm: a line width that isn't a needle's (wins over the needle)
    gapBetweenLines: 0.5,             // mm edge to edge; line spacing = line width + gap

    // --- Text source
    text: "Happy Birthday",           // up to rules.maxTextLines lines; use \n for a new line
    font: "sans",                     // sans, readability, readability-italic, nixish, script, allure, tech, osmotron, elfin
    letterHeight: 15,                 // mm (raised automatically if too small to read; see rules)
    letterSpacing: "font-default",    // "font-default", "even" or "joined"
    letterGap: null,                  // mm between letters (null = rules.letterGapShare × letter height)
    wordGap: null,                    // mm between words (null = rules.wordGapShare × letter height)
    lineGap: 1.7,                     // line pitch, × letter height
    align: "center",                  // "left", "center" or "right"

    // --- 3D print
    printer: "chocmate2",             // an id from the printer list

    // --- 2D plot
    paper: "a4",                      // "a6" … "a1", "letter", "legal", "tabloid", "6x8", "9x12", "11x14", "18x24",
                                      // "plate" (the printer's plate) or "custom"
    paperOrientation: "landscape",    // "landscape" or "portrait"
    paperSize: [210, 297],            // mm, width and height for "custom"
    paperMargin: 20,                  // mm kept clear on every side
    penWidth: 0.5,                    // mm, the pen's line width (preview and SVG stroke)
    closeGaps: 0,                     // mm: 2D shapes, close gaps this wide where a line stops short of another (0 = off, up to 10)
    smallestShape: 0,                 // mm²: 2D shapes smaller than this join a neighbour (0 = off, up to 100)
    drawBridges: false,               // draw the gap bridges with pen 1 (otherwise they only bound the fills)
    showShapes: true,                 // tint each fillable shape on the 2D page preview
    penColors: ["#111111", "#d1342f", "#2f6fd1", "#2a9d58", "#e0a422", "#8e44ad", "#e86fa0", "#1f9aa8"],   // "#rrggbb": pen 1 (the drawing), then each fill pen as it's added (also its stroke colour in the SVG, so Saxi can split by colour)

    // --- 3D plate
    limitToPlate: false,              // keep the Trace tab's size within the printer's plate (the size slider stops there)

    // --- 3D layers
    // Base: filled layers at the bottom. Density (%): 100 puts the rows a line width apart (touching, solid), 50 two
    // line widths apart, 0 no fill. Lines rows turn 90° every baseTurn layers.
    baseLayers: 0,                    // how many base layers (0 = no base; up to 50)
    baseDensity: 100,
    basePattern: "lines",             // "lines" (straight rows) or "rings" (following the edge)
    baseAngle: 0,                     // degrees, direction of the rows for "lines" (-90 to 90)
    baseTurn: 1,                      // the rows turn 90° every this many layers (1–50)
    // Infill: inside the layers above the base, as part of the same line. Density 0 = hollow (walls only).
    infillDensity: 0,
    infillPattern: "lines",
    infillAngle: 45,
    infillTurn: 2,                    // the same direction for this many layers, then turned 90° (builds strength)
    baseMinArea: 0,                   // mm²: in the base, enclosed areas smaller than this are left open (0 = fill all; up to 400)
    infillMinArea: 0,                 // mm²: the same for the infill above the base
    wallLayers: 1,                    // layers above the base (0–500; at least 1 without a base)
    wallCount: 1,                     // 3D models: walls, one line spacing inside each other (1–5)

    // --- the plate (3D tab)
    chocolate: "dark",                // an id from the chocolate list
    copies: 1,
    copySpacing: 5,                   // mm between copies on the plate
    rotation: "auto",                 // "auto" (rotate to fit) or "straight"
    textLines: "each",                // a text of several lines: "each" (a piece for each line) or "one" (one piece, lines joined)

    // --- Export
    smoothCurves: false,              // 2D SVG: smooth curves instead of straight segments
    simplify: 0.05,                   // mm: how far the exported path may cut corners to save points (0 to 0.5)

    // --- View
    lineView: "width",                // "centerline", "width" (faded band) or "printed"
    background: "source",             // behind the line: "source", "lines" (detected lines) or "none"
    circles: true,                    // rotating circles while the drawing plays
    connectors: true,                 // highlight connectors
    sizeBox: true,                    // smallest box and its size
    problems: false,                  // mark crossings and too-close spots
    movedLines: true,                 // shade in orange where making room for the spacing pushed the line off the drawing
    miniMap: true,                    // plate mini-map in the corner
    animationSpeed: "normal",         // "slow", "normal" or "fast"

    // --- Tools
    eraseMode: "piece",               // "piece" (click a piece) or "brush"
    eraseBrush: 8,                    // px (2–30)
    areaBrush: 12,                    // brush for crossing areas and connector paths, px (3–40)
    drawPen: 6,                       // "Draw your own" pen, px (2–24)
    selectShape: "rect",              // "rect" or "lasso"
  },

  // ---------- Starting points ----------
  // (used) The "Start from" buttons. Each sets these tracing values; size, needle, painted areas and the image stay as they are.
  presets: {
    drawing: { label: "Line drawing", traceStyle: "centerline", smoothing: 1.2, ignoreSpecks: 15, dropFarParts: 12, looseEnds: "jump-much-shorter", imagePrep: { brightness: 0, contrast: 0, backgroundTolerance: 0, evenOutLighting: false } },
    photo:   { label: "Photo",        traceStyle: "outline",    smoothing: 2.0, ignoreSpecks: 30, dropFarParts: 8,  looseEnds: "jump-much-shorter", imagePrep: { brightness: 0, contrast: 0, backgroundTolerance: 0, evenOutLighting: true } },
    logo:    { label: "Logo",         traceStyle: "centerline", smoothing: 1.0, ignoreSpecks: 10, dropFarParts: 0,  looseEnds: "jump-much-shorter", imagePrep: { brightness: 0, contrast: 0, backgroundTolerance: 20, evenOutLighting: false } },
  },

  // ---------- Rules ----------
  // (used) Fixed rules the app follows.
  rules: {
    maxTextLines: 5,                  // lines of typed text
    minLetterHeight: { default: 8, allure: 10, elfin: 10 },   // smallest readable letter height, in line widths, per font
    letterGapShare: 0.15,             // default letter gap, × letter height
    minLetterGap: 1.2,                // letters never closer than this × line width
    wordGapShare: 0.5,                // default word gap, × letter height
    minWordGap: 2,                    // words never closer than this × line width
    undoSteps: 100,                   // how many steps Undo remembers
  },

  // ---------- Engine tuning ----------
  // (used) Deeper tracing numbers. Change with care, and run the tests afterwards (npm test in source/tests): they
  // measure accuracy against known drawings and will show if a change makes the trace worse.
  engine: {
    termTolerance: 0.35,              // px: the automatic term count keeps 95% of the line this close to the traced path
    minStrandGap: 0.75,               // px: smallest gap kept between strands when removing crossings
    packedStrokeSplit: 0.1,           // how readily strokes drawn close together are split apart (0 = never; share of ink↔paper contrast)
    farGroupShare: 0.2,               // a far-away group is dropped only if its line is shorter than this × the main group's
    loopRadius: 1.0,                  // × line spacing: radius of the loop that turns the line round at each stroke end (0.5 = tightest)
    sizeDetail: { smallest: 0.022, medium: 0.013, high: 0.007 },   // size slider marks: how far (× drawing width) lines may move from the drawing to keep the spacing
    maxWorkingResolution: 2000,       // px: the most a big print is traced at
  },
};
