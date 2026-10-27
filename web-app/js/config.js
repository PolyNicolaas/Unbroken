// Unbroken · web app · config.js
// Reads the editable settings (web-app/settings.js), checks every value, and applies it: needle and chocolate menus,
// printer, every control's starting value, the starting-point presets, the text rules and the engine tuning.
// A value that's missing or invalid is skipped (the control keeps the default written in index.html) and named in
// the Print step. If settings.js can't be read at all, the app runs entirely on those built-in defaults.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// built-in values for the parts the code needs even without settings.js (control defaults live in index.html)
const BUILTIN = {
  currency: "USD",
  baseResolution: 500, // px traced per 100 mm of print (settings.js defaults.workingResolution)
  chocolates: [
    {
      id: "dark",
      name: "Dark chocolate",
      color: "#3b2219",
      printSpeed: 20,
      needle: "18G",
      costPer100g: null,
      density: 1.3,
    },
  ],
  needles: [
    { id: "14G", gauge: 14, colorName: "olive", color: "#6b7a3a", insideDiameter: 1.54 },
    { id: "15G", gauge: 15, colorName: "amber", color: "#d99a2b", insideDiameter: 1.37 },
    { id: "16G", gauge: 16, colorName: "grey", color: "#9aa0a6", insideDiameter: 1.19 },
    { id: "18G", gauge: 18, colorName: "green", color: "#2e9e4f", insideDiameter: 0.84 },
    { id: "20G", gauge: 20, colorName: "pink", color: "#e87fb0", insideDiameter: 0.61 },
    { id: "21G", gauge: 21, colorName: "purple", color: "#8a4fc4", insideDiameter: 0.51 },
    { id: "22G", gauge: 22, colorName: "blue", color: "#2f6fd6", insideDiameter: 0.41 },
    { id: "23G", gauge: 23, colorName: "orange", color: "#ef7d22", insideDiameter: 0.33 },
    { id: "25G", gauge: 25, colorName: "red", color: "#d63a3a", insideDiameter: 0.25 },
    { id: "27G", gauge: 27, colorName: "clear", color: "#f4f4f4", insideDiameter: 0.2 },
  ],
  printers: [
    {
      id: "chocmate2",
      name: "choc mate 2",
      bedWidth: 340,
      bedDepth: 232,
      buildHeight: 160,
      lift: 5,
      layerHeight: 0.3,
      maxPrintSpeed: 50,
      minLayerTime: 20,
      minPrintSpeed: 5,
      retraction: 0.3,
      retractSpeed: 0.2,
      wipeTime: 0.2,
      firstUnretractExtra: 0,
      unretractPause: "",
      travelSpeed: 120,
      zTravelSpeed: 60,
      zApproachSpeed: 10,
      cartridge: "",
      cartridgeDiameter: 26.5,
      cartridgeVolume: 50,
      startGcode: [],
      endGcode: [],
    },
  ],
  defaults: { chocolate: "dark", startFrom: "", source: "image", sample: "leaf", size: "medium" },
  presets: {
    drawing: {
      label: "Line drawing",
      traceStyle: "centerline",
      smoothing: 1.2,
      ignoreSpecks: 15,
      dropFarParts: 12,
      looseEnds: "jump-much-shorter",
      imagePrep: { brightness: 0, contrast: 0, backgroundTolerance: 0, evenOutLighting: false },
    },
    photo: {
      label: "Photo",
      traceStyle: "outline",
      smoothing: 2.0,
      ignoreSpecks: 30,
      dropFarParts: 8,
      looseEnds: "jump-much-shorter",
      imagePrep: { brightness: 0, contrast: 0, backgroundTolerance: 0, evenOutLighting: true },
    },
    logo: {
      label: "Logo",
      traceStyle: "centerline",
      smoothing: 1.0,
      ignoreSpecks: 10,
      dropFarParts: 0,
      looseEnds: "jump-much-shorter",
      imagePrep: { brightness: 0, contrast: 0, backgroundTolerance: 20, evenOutLighting: false },
    },
  },
  rules: {
    maxTextLines: 5,
    minLetterHeight: { default: 8, allure: 10, elfin: 10 },
    letterGapShare: 0.15,
    minLetterGap: 1.2,
    wordGapShare: 0.5,
    minWordGap: 2,
    undoSteps: 100,
  },
  engine: {
    termTolerance: 0.35,
    minStrandGap: 0.75,
    packedStrokeSplit: 0.1,
    farGroupShare: 0.2,
    loopRadius: 1,
    sizeDetail: { smallest: 0.022, medium: 0.013, high: 0.007 },
    maxWorkingResolution: 2000,
  },
};

// names used in settings.js → the values the controls use
const MAP = {
  traceStyle: { centerline: "centerline", outline: "edges" },
  // "retrace": older name for loop-back
  looseEnds: { "loop-back": "0", retrace: "0", "jump-much-shorter": "2", "jump-shorter": "1.2" },
  crossings: { "remove-all": "90", "remove-doubling-back": "30", keep: "0" },
  letterSpacing: { "font-default": "auto", even: "even", joined: "font" },
  lineView: { centreline: "thin", centerline: "thin", width: "band", printed: "print" },
  animationSpeed: { slow: "24", normal: "10", fast: "4" },
};

const num = (v, lo, hi) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
const hexColor = (v) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);

// printer fields an older settings.js may not have yet: the built-in value, without a note
const OPTIONAL_PRINTER = [
  "minPrintSpeed",
  "retraction",
  "retractSpeed",
  "wipeTime",
  "firstUnretractExtra",
  "travelSpeed",
  "zTravelSpeed",
  "zApproachSpeed",
  "cartridgeDiameter",
  "cartridgeVolume",
  "maxPrintSpeed",
];

// ---- read and check the lists and sections: keep every valid entry, drop the rest with a note of why
const CFG = (() => {
  const raw = window.UNB_SETTINGS,
    notes = [];
  if (!raw || typeof raw !== "object")
    return Object.assign(structuredClone(BUILTIN), {
      printer: structuredClone(BUILTIN.printers[0]),
      problems: [
        "settings.js couldn't be read (missing, or a typo such as a missing comma or quote), so the built-in settings are in use.",
      ],
      raw: null,
    });
  const out = { currency: typeof raw.currency === "string" ? raw.currency : BUILTIN.currency, raw };
  out.needles = (Array.isArray(raw.needles) ? raw.needles : []).filter((n, i) => {
    const ok = n && typeof n.id === "string" && num(n.insideDiameter, 0.05, 5) && hexColor(n.color);
    if (!ok) notes.push(`needle ${i + 1} skipped: it needs an id, a colour like "#2e9e4f" and an insideDiameter in mm`);
    return ok;
  });
  if (!out.needles.length) {
    out.needles = BUILTIN.needles;
    notes.push("no usable needles, so the built-in list is in use");
  }
  const needleIds = new Set(out.needles.map((n) => n.id));
  out.chocolates = (Array.isArray(raw.chocolates) ? raw.chocolates : []).filter((c, i) => {
    const ok = c && typeof c.id === "string" && typeof c.name === "string" && hexColor(c.color);
    if (!ok) {
      notes.push(`chocolate ${i + 1} skipped: it needs an id, a name and a colour like "#3b2219"`);
      return false;
    }
    if (c.printSpeed != null && !num(c.printSpeed, 0.1, 500)) {
      notes.push(`${c.name}: printSpeed should be mm/s, e.g. 20; ignored`);
      c.printSpeed = null;
    }
    // the optional facts shown under the menu: a bad one is dropped with a note, never left to break the page later
    if (c.costPer100g != null && !num(c.costPer100g, 0, 100000)) {
      notes.push(`${c.name}: costPer100g should be a number, e.g. 2.5 (no quotes); ignored`);
      c.costPer100g = null;
    }
    if (c.cocoaPercent != null && !num(c.cocoaPercent, 0, 100)) {
      notes.push(`${c.name}: cocoaPercent should be a number from 0 to 100; ignored`);
      c.cocoaPercent = null;
    }
    if (
      c.workingTempC != null &&
      !(Array.isArray(c.workingTempC) && c.workingTempC.length === 2 && c.workingTempC.every((t) => num(t, -50, 200)))
    ) {
      notes.push(`${c.name}: workingTempC should be two numbers, e.g. [31, 32]; ignored`);
      c.workingTempC = null;
    }
    if (c.layerHeight != null && !num(c.layerHeight, 0.05, 3)) {
      notes.push(`${c.name}: layerHeight should be mm, e.g. 0.3; ignored`);
      c.layerHeight = null;
    }
    if (c.notes != null && typeof c.notes !== "string") {
      notes.push(`${c.name}: notes should be text in quotes; ignored`);
      c.notes = null;
    }
    if (c.needle != null && !needleIds.has(c.needle)) {
      notes.push(`${c.name}: needle "${c.needle}" isn't in the needle list; ignored`);
      c.needle = null;
    }
    return true;
  });
  if (!out.chocolates.length) {
    out.chocolates = BUILTIN.chocolates;
    notes.push("no usable chocolates, so a built-in one is in use");
  }
  // printers: the list (or, in older files, one printer); each number checked, a bad one falls back to the built-in
  // value
  const bp = BUILTIN.printers[0],
    rawPrinters = Array.isArray(raw.printers)
      ? raw.printers
      : raw.printer
        ? [Object.assign({ id: "printer" }, raw.printer)]
        : [];
  out.printers = rawPrinters.filter((q, i) => {
    if (!q || typeof q.id !== "string" || typeof q.name !== "string") {
      notes.push(`printer ${i + 1} skipped: it needs an id and a name`);
      return false;
    }
    for (const [k, lo, hi] of [
      ["bedWidth", 10, 2000],
      ["bedDepth", 10, 2000],
      ["buildHeight", 1, 2000],
      ["lift", 0, 100],
      ["layerHeight", 0.05, 3],
      ["minLayerTime", 0, 600],
      ["minPrintSpeed", 0.1, 100],
      ["retraction", 0, 5],
      ["retractSpeed", 0.01, 50],
      ["wipeTime", 0, 5],
      ["firstUnretractExtra", 0, 5],
      ["travelSpeed", 1, 1000],
      ["zTravelSpeed", 0.5, 500],
      ["zApproachSpeed", 0.5, 500],
      ["cartridgeDiameter", 1, 200],
      ["cartridgeVolume", 1, 5000],
      ["maxPrintSpeed", 0.1, 1000],
    ])
      if (q[k] === undefined && OPTIONAL_PRINTER.includes(k)) q[k] = bp[k];
      else if (!num(q[k], lo, hi)) {
        notes.push(`${q.name}: ${k} isn't a sensible number; using ${bp[k]}`);
        q[k] = bp[k];
      }
    if (q.cartridge != null && typeof q.cartridge !== "string") {
      notes.push(`${q.name}: cartridge should be a name in quotes; ignored`);
      q.cartridge = "";
    }
    if (q.unretractPause != null && typeof q.unretractPause !== "string") {
      notes.push(`${q.name}: unretractPause should be one line in quotes; ignored`);
      q.unretractPause = "";
    }
    for (const k of ["startGcode", "endGcode"])
      if (q[k] != null && !(Array.isArray(q[k]) && q[k].every((l) => typeof l === "string"))) {
        notes.push(`${q.name}: ${k} should be a list of lines in quotes; ignored`);
        q[k] = [];
      }
    return true;
  });
  if (!out.printers.length) {
    out.printers = BUILTIN.printers;
    if (rawPrinters.length) notes.push("no usable printers, so the built-in choc mate 2 is in use");
  }
  out.printer = out.printers[0]; // the one in use; the Printer menu changes it
  // presets: each field checked like the matching default; a broken preset falls back to the built-in one
  out.presets = {};
  for (const key of ["drawing", "photo", "logo"]) {
    const pr = raw.presets && raw.presets[key],
      b = BUILTIN.presets[key];
    const ok =
      pr &&
      MAP.traceStyle[pr.traceStyle] &&
      num(pr.smoothing, 0, 3) &&
      num(pr.ignoreSpecks, 0, 200) &&
      num(pr.dropFarParts, 0, 40) &&
      MAP.looseEnds[pr.looseEnds];
    if (pr && !ok) notes.push(`presets.${key} has a value out of range or misspelt; using the built-in one`);
    out.presets[key] = Object.assign({}, b, ok ? pr : {}, {
      imagePrep: Object.assign({}, b.imagePrep, (ok && pr.imagePrep) || {}),
    });
  }
  const r = Object.assign({}, BUILTIN.rules, raw.rules || {}),
    br = BUILTIN.rules;
  for (const [k, lo, hi] of [
    ["maxTextLines", 1, 20],
    ["letterGapShare", 0, 2],
    ["minLetterGap", 0, 10],
    ["wordGapShare", 0, 5],
    ["minWordGap", 0, 20],
    ["undoSteps", 1, 1000],
  ])
    if (!num(r[k], lo, hi)) {
      notes.push(`rules.${k} isn't a sensible number; using ${br[k]}`);
      r[k] = br[k];
    }
  if (!r.minLetterHeight || typeof r.minLetterHeight !== "object" || !num(r.minLetterHeight.default, 1, 50)) {
    notes.push("rules.minLetterHeight needs a default; using the built-in values");
    r.minLetterHeight = br.minLetterHeight;
  }
  out.rules = r;
  const e = Object.assign({}, BUILTIN.engine, raw.engine || {}),
    be = BUILTIN.engine;
  for (const [k, lo, hi] of [
    ["termTolerance", 0.05, 5],
    ["minStrandGap", 0, 5],
    ["packedStrokeSplit", 0, 1],
    ["farGroupShare", 0, 1],
    ["loopRadius", 0.5, 3],
    ["maxWorkingResolution", 320, 6000],
  ])
    if (!num(e[k], lo, hi)) {
      notes.push(`engine.${k} isn't a sensible number (${lo}–${hi}); using ${be[k]}`);
      e[k] = be[k];
    }
  const sd = e.sizeDetail;
  if (
    !sd ||
    typeof sd !== "object" ||
    !["smallest", "medium", "high"].every((k) => num(sd[k], 0.001, 0.2)) ||
    !(sd.smallest >= sd.medium && sd.medium >= sd.high)
  ) {
    notes.push("engine.sizeDetail needs smallest ≥ medium ≥ high, each 0.001–0.2; using the built-in values");
    e.sizeDetail = be.sizeDetail;
  }
  out.engine = e;
  // defaults: checked and applied one by one below; these few are read elsewhere in the code
  const d = raw.defaults || {};
  out.baseResolution = BUILTIN.baseResolution; // defaults.workingResolution, applied below
  out.defaults = {
    chocolate: out.chocolates.some((c) => c.id === d.chocolate) ? d.chocolate : out.chocolates[0].id,
    startFrom: ["", "drawing", "photo", "logo", "lettering"].includes(d.startFrom)
      ? d.startFrom
      : (notes.push(`defaults.startFrom "${d.startFrom}" isn't a starting point; none used`), ""),
    source: d.source === "text" ? "text" : "image",
    sample: ["leaf", "shapes", "smiley"].includes(d.sample) ? d.sample : "leaf",
    size: ["smallest", "medium", "high"].includes(d.size) || num(d.size, 1, 5000) ? d.size : "medium",
    penColors:
      Array.isArray(d.penColors) && d.penColors.length && d.penColors.every((c) => /^#[0-9a-f]{6}$/i.test(c))
        ? d.penColors.slice(0, 8)
        : (d.penColors !== undefined &&
            notes.push('defaults.penColors needs a list of colours like "#d1342f"; using the built-in ones'),
          null),
  };
  out.problems = notes;
  return out;
})();
const needleById = (id) => CFG.needles.find((n) => n.id === id);
const chocolateById = (id) => CFG.chocolates.find((c) => c.id === id) || CFG.chocolates[0];

// ---- font menu (the Text source's fonts, from fonts.js)
for (const [k, f] of Object.entries(window.UNB_FONTS || {})) {
  const o = document.createElement("option");
  o.value = k;
  o.textContent = f.label;
  $("font").appendChild(o);
}

// ---- needle menu
(() => {
  const sel = $("needle");
  sel.textContent = "";
  for (const n of CFG.needles) {
    const o = document.createElement("option");
    o.value = String(n.insideDiameter);
    o.dataset.id = n.id;
    o.dataset.c = n.color;
    o.textContent = `${n.id} · ${n.colorName || ""} · ${n.insideDiameter.toFixed(2)} mm`.replace(" ·  ·", " ·");
    sel.appendChild(o);
  }
  const c = document.createElement("option");
  c.value = "custom";
  c.dataset.c = "transparent";
  c.textContent = "Custom…";
  sel.appendChild(c);
})();
function selectNeedle(id) {
  const o = [...$("needle").options].find((x) => x.dataset.id === id);
  if (o) {
    $("needle").value = o.value;
    $("lineW").value = o.value;
  }
} // the needle sets the line width

// ---- chocolate menu and details
(() => {
  const sel = $("chocolate");
  for (const c of CFG.chocolates) {
    const o = document.createElement("option");
    o.value = c.id;
    o.textContent = c.name;
    sel.appendChild(o);
  }
})();
// the line colour shown in the preview: the chocolate's own colour, pushed toward the text colour only if it would
// otherwise vanish into the background (white chocolate on a light page, dark chocolate in dark mode)
function chocolateDisplayColor(hex) {
  const rgb = hexRGB; // (ui.js)
  const parse = (v) => {
    v = (v || "").trim();
    if (v.startsWith("#")) return rgb(v.length === 4 ? "#" + [...v.slice(1)].map((ch) => ch + ch).join("") : v);
    const m = v.match(/[\d.]+/g);
    return m ? m.slice(0, 3).map(Number) : [255, 255, 255];
  };
  const lum = (c) => {
    const [r, g, b] = c.map((x) => {
      x /= 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const c = rgb(hex),
    bg = parse(getComputedStyle(document.documentElement).getPropertyValue("--surface")),
    ink = parse(getComputedStyle(document.documentElement).getPropertyValue("--ink"));
  const contrast = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  let t = 0,
    out = c;
  while (contrast(out, bg) < 2.2 && t < 0.8) {
    t += 0.1;
    out = c.map((v, i) => Math.round(v + (ink[i] - v) * t));
  }
  return `rgba(${out.join(", ")}, 0.9)`;
}
function applyChocolateLook() {
  const c = chocolateById($("chocolate").value);
  document.documentElement.style.setProperty("--choc", chocolateDisplayColor(c.color));
  $("chocSwatch").style.background = c.color;
  const bits = [];
  if (c.cocoaPercent != null) bits.push(`${c.cocoaPercent}% cocoa`);
  if (c.costPer100g != null) bits.push(`${c.costPer100g.toFixed(2)} ${CFG.currency} per 100 g`);
  if (Array.isArray(c.workingTempC) && c.workingTempC.length === 2)
    bits.push(`works at ${c.workingTempC[0]}–${c.workingTempC[1]} °C`);
  if (c.printSpeed) bits.push(`prints at ${c.printSpeed} mm/s`);
  $("chocInfo").textContent = bits.join(" · ") + (c.notes ? `. ${c.notes}` : "");
}
// picking a chocolate also sets its print speed, layer height and preferred needle (and so the line width)
function applyChocolatePrinting() {
  const c = chocolateById($("chocolate").value);
  if (c.printSpeed) $("gFeed").value = c.printSpeed;
  if (c.needle) selectNeedle(c.needle);
  // the chocolate's own, else the printer's
  $("layerH").value = num(c.layerHeight, 0.05, 3) ? c.layerHeight : CFG.printer.layerHeight;
  $("gZ").value = $("layerH").value; // the first layer is one layer height
}

// the Plot step's paper sizes (plot.js has their sizes; "plate" is the printer's plate)
const PAPER_IDS = "a6 a5 a4 a3 a2 a1 letter legal tabloid 6x8 9x12 11x14 18x24 plate custom".split(" ");

// ---- printer menu (the Print step), from settings.js
for (const q of CFG.printers) {
  const o = document.createElement("option");
  o.value = q.id;
  o.textContent = q.name;
  $("printer").appendChild(o);
}

// ---- every starting value onto its control. Each entry: [settings name, check, apply]. An invalid value is skipped
// and named; a missing one is left at the default in index.html.
(() => {
  const d = (CFG.raw && CFG.raw.defaults) || {},
    p = CFG.printer,
    notes = CFG.problems;
  const set = (id, v) => {
    $(id).value = String(v);
  };
  const radio = (id) => {
    $(id).checked = true;
  };
  const tick = (id, v) => {
    $(id).checked = !!v;
  };
  const oneOf = (m) => (v) => Object.prototype.hasOwnProperty.call(m, v);
  const list =
    (...vals) =>
    (v) =>
      vals.includes(v);
  const range = (lo, hi) => (v) => num(v, lo, hi);
  const bool = (v) => typeof v === "boolean";
  const RULES = [
    ["source", list("image", "text"), (v) => radio(v === "text" ? "srcText" : "srcImage")],
    ["sample", list("leaf", "shapes", "smiley"), (v) => set("sample", v)],
    ["traceStyle", oneOf(MAP.traceStyle), (v) => radio(v === "outline" ? "modeOutline" : "modeCenter")],
    ["path", list("closed", "open"), (v) => radio(v === "open" ? "loopOpen" : "loopClosed")],
    ["threshold", range(-60, 60), (v) => set("sens", Math.round(v))],
    ["smoothing", range(0, 3), (v) => set("blur", Math.round(v * 10))],
    ["ignoreSpecks", range(0, 200), (v) => set("minLen", Math.round(v))],
    ["dropFarParts", range(0, 40), (v) => set("far", Math.round(v))],
    ["looseEnds", oneOf(MAP.looseEnds), (v) => set("loose", MAP.looseEnds[v])],
    [
      "workingResolution",
      (v) => num(v, 200, 1500),
      (v) => {
        CFG.baseResolution = v;
      },
    ], // no control: the print size picks the resolution from here
    ["lightLinesOnDark", bool, (v) => tick("invert", v)],
    [
      "imagePrep",
      (v) => v && typeof v === "object",
      (v) => {
        if (num(v.brightness, -100, 100)) set("bright", v.brightness);
        else if (v.brightness != null) notes.push("defaults.imagePrep.brightness should be -100 to 100");
        if (num(v.contrast, -80, 150)) set("contrast", v.contrast);
        else if (v.contrast != null) notes.push("defaults.imagePrep.contrast should be -80 to 150");
        if (num(v.backgroundTolerance, 0, 60)) set("bgTol", v.backgroundTolerance);
        else if (v.backgroundTolerance != null) notes.push("defaults.imagePrep.backgroundTolerance should be 0 to 60");
        if (bool(v.evenOutLighting)) tick("flatten", v.evenOutLighting);
      },
    ],
    ["crossings", oneOf(MAP.crossings), (v) => set("uncross", MAP.crossings[v])],
    ["allowOverlaps", bool, (v) => tick("overlaps", v)],
    ["baseDensity", range(0, 100), (v) => set("baseDensity", Math.round(v / 5) * 5)],
    ["basePattern", list("rings", "lines"), (v) => set("basePattern", v)],
    ["baseAngle", range(-90, 90), (v) => set("baseAngle", v)],
    ["baseTurn", range(1, 50), (v) => set("baseTurn", Math.round(v))],
    ["infillDensity", range(0, 100), (v) => set("fillDensity", Math.round(v / 5) * 5)],
    ["infillPattern", list("rings", "lines"), (v) => set("fillPattern", v)],
    ["infillAngle", range(-90, 90), (v) => set("fillAngle", v)],
    ["infillTurn", range(1, 50), (v) => set("fillTurn", Math.round(v))],
    ["baseMinArea", range(0, 400), (v) => set("infillMin", Math.round(Math.sqrt(v / 400) * 100))],
    [
      "infillMinArea",
      range(0, 400),
      (v) => {
        set("fillMin", Math.round(Math.sqrt(v / 400) * 100));
        if (!("baseMinArea" in d)) set("infillMin", Math.round(Math.sqrt(v / 400) * 100));
      },
    ], // older files: one value for both
    ["cornerRounding", range(0, 5), (v) => set("corner", Math.round(v * 10))],
    [
      "size",
      (v) => ["smallest", "medium", "high"].includes(v) || num(v, 1, 5000),
      (v) => {
        if (typeof v === "number") {
          set("outW", v);
          st.outW = v;
          st.sizeUser = true;
        }
      },
    ],
    ["needle", (v) => !!needleById(v), (v) => selectNeedle(v)],
    ["lineWidth", range(0.05, 5), (v) => set("lineW", v)],
    ["gapBetweenLines", range(0, 20), (v) => set("lineGapMM", v)],
    [
      "text",
      (v) => typeof v === "string",
      (v) => {
        $("textIn").value = v.split("\n").slice(0, CFG.rules.maxTextLines).join("\n");
      },
    ],
    ["font", (v) => !!(window.UNB_FONTS && UNB_FONTS[v]), (v) => set("font", v)],
    ["letterHeight", range(1, 500), (v) => set("capH", v)],
    ["letterSpacing", oneOf(MAP.letterSpacing), (v) => set("txtSpacing", MAP.letterSpacing[v])],
    ["letterGap", (v) => v === null || num(v, 0, 100), (v) => set("letterGap", v === null ? "" : v)],
    ["wordGap", (v) => v === null || num(v, 0, 200), (v) => set("wordGap", v === null ? "" : v)],
    ["lineGap", range(1, 5), (v) => set("lineGap", v)],
    [
      "align",
      list("left", "center", "right"),
      (v) => radio({ left: "alLeft", center: "alCenter", right: "alRight" }[v]),
    ],
    ["chocolate", (v) => CFG.chocolates.some((c) => c.id === v), (v) => set("chocolate", v)],
    ["copies", range(1, 200), (v) => set("copies", Math.round(v))],
    ["copySpacing", range(0, 200), (v) => set("copyGap", v)],
    ["rotation", list("auto", "straight"), (v) => set("plateRot", v)],
    ["textLines", list("each", "one"), (v) => set("textPieces", v)],
    [
      "printer",
      (v) => CFG.printers.some((q) => q.id === v),
      (v) => {
        set("printer", v);
        CFG.printer = CFG.printers.find((q) => q.id === v);
      },
    ],
    ["paper", list(...PAPER_IDS), (v) => set("paper", v)],
    ["paperOrientation", list("landscape", "portrait"), (v) => set("paperOrient", v)],
    [
      "paperSize",
      (v) => Array.isArray(v) && v.length === 2 && v.every((x) => num(x, 20, 2000)),
      (v) => {
        set("paperW", v[0]);
        set("paperH", v[1]);
      },
    ],
    ["paperMargin", range(0, 100), (v) => set("paperMargin", v)],
    ["penWidth", range(0.05, 5), (v) => set("penW", v)],
    ["closeGaps", range(0, 10), (v) => set("gapClose", Math.round(Math.sqrt(v / 10) * 100))],
    ["smallestShape", range(0, 100), (v) => set("minShape", Math.round(Math.sqrt(v / 100) * 100))],
    ["drawBridges", bool, (v) => tick("drawBridges", v)],
    ["limitToPlate", bool, (v) => tick("limitPlate", v)],
    ["showShapes", bool, (v) => tick("showShapes", v)],
    ["smoothCurves", bool, (v) => tick("smooth", v)],
    [
      "simplify",
      range(0, 0.5),
      (v) => {
        st.simplify = v;
      },
    ],
    ["lineView", oneOf(MAP.lineView), (v) => set("lineView", MAP.lineView[v])],
    ["background", list("source", "lines", "none"), (v) => set("bg", v)],
    ["circles", bool, (v) => tick("circles", v)],
    ["connectors", bool, (v) => tick("showConn", v)],
    ["sizeBox", bool, (v) => tick("dims", v)],
    ["problems", bool, (v) => tick("showProb", v)],
    ["movedLines", bool, (v) => tick("showDrift", v)],
    ["miniMap", bool, (v) => tick("showMini", v)],
    ["animationSpeed", oneOf(MAP.animationSpeed), (v) => set("speed", MAP.animationSpeed[v])],
    ["eraseMode", list("piece", "brush"), (v) => radio(v === "brush" ? "erBrush" : "erPiece")],
    ["eraseBrush", range(2, 30), (v) => set("brush", v)],
    ["areaBrush", range(3, 40), (v) => set("zoneBrush", v)],
    ["drawPen", range(2, 24), (v) => set("pen", v)],
    ["selectShape", list("rect", "lasso"), (v) => radio(v === "lasso" ? "selLasso" : "selRect")],
    ["wallCount", range(1, 5), (v) => set("wallCount", Math.round(v))],
    // filledBase false: older files, no base
    ["baseLayers", range(0, 50), (v) => set("baseLayers", d.filledBase === false ? 0 : Math.round(v))],
    ["wallLayers", range(0, 500), (v) => set("wallLayers", Math.round(v))],
  ];
  const known = new Set(
    RULES.map((r) => r[0]).concat([
      "startFrom",
      "filledBase",
      "infill",
      "modelInside",
      "fillDensity",
      "lineMode",
      "position",
      "lineSpacing",
      "customLineWidth",
      "plotFormat",
      "retracedStrokes",
      "width",
      "sizeMode",
      "sizeDetail",
      "maxWidth",
      "exportFormat",
      "penColors",
      "printFormat",
      "level",
    ])
    // no longer used, ignored in older files: retracedStrokes (stroke ends always loop); width, sizeMode, sizeDetail,
    // maxWidth (replaced by size); exportFormat (replaced by plotFormat / printFormat)
  );
  for (const [key, ok, apply] of RULES) {
    if (!(key in d)) continue;
    if (ok(d[key])) apply(d[key]);
    else
      notes.push(
        `defaults.${key} has a value the app doesn't recognise (${JSON.stringify(d[key])}); left at the built-in default`
      );
  }
  for (const key of Object.keys(d))
    if (!known.has(key)) notes.push(`defaults.${key} isn't a setting the app knows (misspelt?)`);
  // printer and the chosen chocolate
  const P = CFG.printer;
  $("gZ").value = $("layerH").value;
  $("gLift").value = P.lift;
  $("layerTime").value = P.minLayerTime;
  applyChocolatePrinting();
  // an explicit default needle wins over the chocolate's
  if ("needle" in d && needleById(d.needle)) selectNeedle(d.needle);
  // and an explicit line width over both (customLineWidth: older files)
  const lw = "lineWidth" in d ? d.lineWidth : d.customLineWidth;
  if (num(lw, 0.05, 5)) $("lineW").value = lw;
  applyChocolateLook();
})();
$("chocolate").addEventListener("change", () => {
  const H = goalNow();
  applyChocolatePrinting();
  applyChocolateLook();
  if (!isModel()) layersFromHeight(H);
  showHeight(); // the height stays; its layer height changes the layer count
  lineChanged();
  render();
  drawPlate();
  drawMini();
});
