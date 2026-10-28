const fs = require("fs"), path = require("path"), vm = require("vm"), { check } = require("../lib/check.js");
const FILE = path.resolve(__dirname, "../../../web-app/settings.js");
module.exports = {
  id: "E14", title: "The settings file is complete and consistent",
  guards: "a typo or wrong value in settings.js",
  why: "settings.js is meant to be edited by hand: chocolates, needles, the printer and the starting defaults. A missing comma stops the whole file from loading (the app then falls back to its built-in settings), and a wrong unit or a needle that isn't in the list quietly changes prints. Run the tests after editing the file.",
  how: "Loads web-app/settings.js the way the browser does and checks every entry: chocolates, needles, printer, every starting default (each against the values the app accepts), the starting-point presets, the rules and the engine tuning. It checks types, units and ranges, unique ids, colours written as #rrggbb, that every reference (a chocolate's needle, the default chocolate, needle and font) exists, and that no setting is misspelt or missing.",
  pass: "The file loads; every chocolate, needle, printer value and default passes its check. The report names any entry that doesn't, and why.",
  async run() {
    const sandbox = { window: {} }; let loadErr = null;
    try { vm.runInNewContext(fs.readFileSync(FILE, "utf8"), sandbox, { filename: "settings.js" }); } catch (e) { loadErr = e.message; }
    const S = sandbox.window.UNB_SETTINGS, bad = [];
    if (loadErr || !S) return { checks: [check(`settings.js loads${loadErr ? " (" + loadErr + ")" : ""}`, 0, "==", 1)] };
    const num = (v, lo, hi) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi, hex = (v) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
    const needles = Array.isArray(S.needles) ? S.needles : [], nIds = new Set();
    needles.forEach((n, i) => {
      const who = `needle ${i + 1} (${n && n.id})`;
      if (!n || typeof n.id !== "string" || !n.id) bad.push(`${who}: id missing`); else if (nIds.has(n.id)) bad.push(`${who}: id used twice`); else nIds.add(n.id);
      if (!num(n.insideDiameter, 0.05, 5)) bad.push(`${who}: insideDiameter should be mm between 0.05 and 5`);
      if (!hex(n.color)) bad.push(`${who}: color should look like "#2e9e4f"`);
    });
    const chocs = Array.isArray(S.chocolates) ? S.chocolates : [], cIds = new Set();
    chocs.forEach((c, i) => {
      const who = `chocolate ${i + 1} (${c && (c.name || c.id)})`;
      if (!c || typeof c.id !== "string" || !/^[\w-]+$/.test(c.id)) bad.push(`${who}: id should be letters, numbers and -`); else if (cIds.has(c.id)) bad.push(`${who}: id used twice`); else cIds.add(c.id);
      if (typeof c.name !== "string" || !c.name) bad.push(`${who}: name missing`);
      if (!hex(c.color)) bad.push(`${who}: color should look like "#3b2219"`);
      if (c.printSpeed != null && !num(c.printSpeed, 1, 200)) bad.push(`${who}: printSpeed should be mm/s (1–200)`);
      if (c.extrusionPerMM != null && !num(c.extrusionPerMM, 0, 5)) bad.push(`${who}: extrusionPerMM should be 0–5`);
      if (c.needle != null && !nIds.has(c.needle)) bad.push(`${who}: needle "${c.needle}" isn't in the needle list`);
      if (c.costPer100g != null && !num(c.costPer100g, 0, 1000)) bad.push(`${who}: costPer100g should be a price, e.g. 2.50`);
      if (c.density != null && !num(c.density, 0.8, 2)) bad.push(`${who}: density should be g/cm³ (chocolate is about 1.2–1.35)`);
      if (c.cocoaPercent != null && !num(c.cocoaPercent, 0, 100)) bad.push(`${who}: cocoaPercent should be 0–100`);
      if (c.workingTempC != null && !(Array.isArray(c.workingTempC) && c.workingTempC.length === 2 && num(c.workingTempC[0], 10, 60) && num(c.workingTempC[1], c.workingTempC[0], 60))) bad.push(`${who}: workingTempC should be [min, max] in °C`);
    });
    const printers = Array.isArray(S.printers) ? S.printers : [], pIds = new Set();
    if (!printers.length) bad.push("printers: the list is empty or missing");
    for (const p of printers) {
      if (typeof p.id !== "string" || !/^[a-z0-9-]+$/i.test(p.id) || pIds.has(p.id)) bad.push(`printers: id "${p.id}" missing, duplicated or not letters/numbers/-`); pIds.add(p.id);
      if (typeof p.name !== "string") bad.push(`printers ${p.id}: needs a name`);
      for (const [k, lo, hi] of [["bedWidth", 10, 2000], ["bedDepth", 10, 2000], ["buildHeight", 1, 2000], ["lift", 0, 100], ["layerHeight", 0.05, 3]]) if (!num(p[k], lo, hi)) bad.push(`printers ${p.id}: ${k} should be a number of mm (${lo}–${hi})`);
      for (const [k, lo, hi] of [["minPrintSpeed", 0.1, 100], ["retraction", 0, 5], ["retractSpeed", 0.01, 50], ["wipeTime", 0, 5], ["firstUnretractExtra", 0, 5], ["travelSpeed", 1, 1000], ["cartridgeDiameter", 1, 200]]) if (p[k] !== undefined && !num(p[k], lo, hi)) bad.push(`printers ${p.id}: ${k} should be ${lo}–${hi}`);
      if (p.unretractPause != null && typeof p.unretractPause !== "string") bad.push(`printers ${p.id}: unretractPause should be one line in quotes`);
      if (!num(p.minLayerTime, 0, 600)) bad.push(`printers ${p.id}: minLayerTime should be a number of seconds (0–600)`);
      for (const k of ["startGcode", "endGcode"]) if (p[k] != null && !(Array.isArray(p[k]) && p[k].every((l) => typeof l === "string"))) bad.push(`printers ${p.id}: ${k} should be a list of lines in quotes`);
    }
    const p = printers[0] || {};
    for (const c of S.chocolates || []) if (c.layerHeight != null && !num(c.layerHeight, 0.05, 3)) bad.push(`chocolates ${c.id}: layerHeight should be mm (0.05–3)`);
    const d = S.defaults || {}, FONTS = require("../../engine/fonts.js");
    const oneOf = (...v) => (x) => v.includes(x), rng = (lo, hi) => (x) => num(x, lo, hi), isBool = (x) => typeof x === "boolean", nullOr = (f) => (x) => x === null || f(x);
    const DEF = {   // every setting in defaults: what it must be (mirrors web-app/js/config.js)
      source: oneOf("image", "text"), sample: oneOf("none", "leaf", "shapes", "smiley", "face", "still"), startFrom: oneOf("", "drawing", "photo", "logo", "lettering"),
      traceStyle: oneOf("centerline", "outline"), path: oneOf("closed", "open"), threshold: rng(-60, 60), smoothing: rng(0, 3), ignoreSpecks: rng(0, 200), dropFarParts: rng(0, 40),
      looseEnds: oneOf("loop-back", "jump-much-shorter", "jump-shorter"), workingResolution: (x) => num(x, 200, 1500), lightLinesOnDark: isBool,
      imagePrep: (x) => x && rng(-100, 100)(x.brightness) && rng(-80, 150)(x.contrast) && rng(0, 60)(x.backgroundTolerance) && isBool(x.evenOutLighting),
      crossings: oneOf("remove-all", "remove-doubling-back", "keep"), allowOverlaps: isBool,
      cornerRounding: rng(0, 5), baseLayers: rng(0, 50), wallLayers: rng(0, 500), baseDensity: rng(0, 100), basePattern: oneOf("rings", "lines"), baseAngle: rng(-90, 90), baseTurn: rng(1, 50), infillDensity: rng(0, 100), infillPattern: oneOf("rings", "lines"), infillAngle: rng(-90, 90), infillTurn: rng(1, 50), baseMinArea: rng(0, 400), infillMinArea: rng(0, 400), size: (x) => oneOf("smallest", "medium", "high")(x) || rng(1, 5000)(x),
      needle: (x) => nIds.has(x), lineWidth: rng(0.05, 5), gapBetweenLines: rng(0, 20), limitToPlate: isBool,
      text: (x) => typeof x === "string", font: (x) => !!FONTS[x], letterHeight: rng(1, 500), letterSpacing: oneOf("font-default", "even", "joined"),
      letterGap: nullOr(rng(0, 100)), wordGap: nullOr(rng(0, 200)), lineGap: rng(1, 5), align: oneOf("left", "center", "right"),
      chocolate: (x) => cIds.has(x), copies: rng(1, 200), copySpacing: rng(0, 200), rotation: oneOf("auto", "straight"), textLines: oneOf("each", "one"),
      wallCount: (x) => num(x, 1, 5), closeGaps: (x) => num(x, 0, 10), smallestShape: (x) => num(x, 0, 100), drawBridges: isBool, showShapes: isBool, penColors: (x) => Array.isArray(x) && x.length >= 1 && x.length <= 8 && x.every(hex), smoothCurves: isBool, printer: (x) => (S.printers || []).some((q) => q.id === x), paper: oneOf("a6", "a5", "a4", "a3", "a2", "a1", "letter", "legal", "tabloid", "6x8", "9x12", "11x14", "18x24", "plate", "custom"), paperOrientation: oneOf("landscape", "portrait"), paperSize: (x) => Array.isArray(x) && x.length === 2 && x.every(rng(20, 2000)), paperMargin: rng(0, 100), penWidth: rng(0.05, 5), simplify: rng(0, 0.5),
      lineView: oneOf("centreline", "centerline", "width", "printed"), background: oneOf("source", "lines", "none"),
      circles: isBool, connectors: isBool, sizeBox: isBool, problems: isBool, movedLines: isBool, miniMap: isBool, animationSpeed: oneOf("slow", "normal", "fast"),
      eraseMode: oneOf("piece", "brush"), eraseBrush: rng(2, 30), areaBrush: rng(3, 40), drawPen: rng(2, 24), selectShape: oneOf("rect", "lasso"),
    };
    for (const [k, v] of Object.entries(d)) { if (!DEF[k]) bad.push(`defaults.${k} isn't a setting the app knows (misspelt?)`); else if (!DEF[k](v)) bad.push(`defaults.${k}: ${JSON.stringify(v)} isn't an allowed value (see the comment next to it)`); }
    const OPTIONAL = ["lineWidth"];   // only for a width that isn't a needle's (the needle sets it otherwise)
    for (const k of Object.keys(DEF)) if (!(k in d) && !OPTIONAL.includes(k)) bad.push(`defaults.${k} is missing (the app will use its built-in value)`);
    for (const [k, pr] of Object.entries(S.presets || {})) {
      if (!["drawing", "photo", "logo"].includes(k)) { bad.push(`presets.${k} isn't a starting point the app has`); continue; }
      for (const f of ["traceStyle", "smoothing", "ignoreSpecks", "dropFarParts", "looseEnds", "imagePrep"]) if (!DEF[f](pr[f])) bad.push(`presets.${k}.${f}: ${JSON.stringify(pr[f])} isn't an allowed value`);
    }
    const R = S.rules || {};
    for (const [k, lo, hi] of [["maxTextLines", 1, 20], ["letterGapShare", 0, 2], ["minLetterGap", 0, 10], ["wordGapShare", 0, 5], ["minWordGap", 0, 20], ["undoSteps", 1, 1000]]) if (!num(R[k], lo, hi)) bad.push(`rules.${k} should be a number from ${lo} to ${hi}`);
    if (!R.minLetterHeight || !num(R.minLetterHeight.default, 1, 50)) bad.push("rules.minLetterHeight needs a default (line widths)");
    else for (const [f, v] of Object.entries(R.minLetterHeight)) if (f !== "default" && (!FONTS[f] || !num(v, 1, 50))) bad.push(`rules.minLetterHeight.${f}: unknown font or not a number`);
    const E = S.engine || {};
    for (const [k, lo, hi] of [["termTolerance", 0.05, 5], ["minStrandGap", 0, 5], ["packedStrokeSplit", 0, 1], ["farGroupShare", 0, 1], ["loopRadius", 0.5, 3], ["maxWorkingResolution", 320, 6000]]) if (!num(E[k], lo, hi)) bad.push(`engine.${k} should be a number from ${lo} to ${hi}`);
    const SD = E.sizeDetail || {};
    if (!["smallest", "medium", "high"].every((k) => num(SD[k], 0.001, 0.2)) || !(SD.smallest >= SD.medium && SD.medium >= SD.high)) bad.push("engine.sizeDetail needs smallest ≥ medium ≥ high, each 0.001–0.2");
    return { checks: [check("settings.js loads", 1, "==", 1), check("chocolates", chocs.length, ">=", 1), check("needles", needles.length, ">=", 1), check("problems found", bad.length, "==", 0)], notes: bad.length ? bad.join("  \n") : `${chocs.length} chocolates, ${needles.length} needles, printer "${p.name}", defaults ok` };
  },
};
