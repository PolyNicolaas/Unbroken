// Unbroken · web app · source.js
// The source the trace starts from, as the Art tab hands it over (useSource): built-in samples, reading the settings,
// setting the source image, and the Text source (fonts, layout, line limits).
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

const isModel = () => $("srcModel").checked; // the source is a 3D model (model.js), not a picture or text

// ---------- sample images ----------
function makeSample(kind) {
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 480;
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, 640, 480);
  g.strokeStyle = "#000";
  g.fillStyle = "#000";
  g.lineCap = "round";
  g.lineJoin = "round";
  if (kind === "smiley") {
    g.lineWidth = 9;
    g.beginPath();
    g.arc(320, 220, 170, 0, 7);
    g.stroke();
    g.beginPath();
    g.arc(255, 170, 22, 0, 7);
    g.fill();
    g.beginPath();
    g.arc(385, 170, 22, 0, 7);
    g.fill();
    g.beginPath();
    g.arc(320, 230, 95, 0.25 * Math.PI, 0.75 * Math.PI);
    g.stroke();
    g.font = "bold 64px Georgia, serif";
    g.textAlign = "center";
    g.fillText("Hi", 320, 460);
  } else if (kind === "shapes") {
    g.font = "bold 110px Georgia, serif";
    g.fillText("Fourier", 60, 140);
    for (let i = 0; i < 6; i++) {
      g.lineWidth = 5;
      g.beginPath();
      g.arc(80 + i * 96, 270, 26 + i * 4, 0, 7);
      g.stroke();
    }
    g.lineWidth = 5;
    g.strokeRect(50, 370, 540, 60);
    g.beginPath();
    g.moveTo(50, 370);
    g.lineTo(590, 430);
    g.stroke();
  } else {
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(140, 400);
    g.bezierCurveTo(150, 220, 330, 80, 520, 70);
    g.bezierCurveTo(500, 260, 340, 400, 140, 400);
    g.stroke();
    g.beginPath();
    g.moveTo(140, 400);
    g.quadraticCurveTo(320, 240, 500, 90);
    g.stroke();
    g.lineWidth = 4;
    for (const [x0, y0, x1, y1] of [
      [230, 318, 225, 245],
      [290, 266, 305, 180],
      [350, 214, 380, 140],
      [410, 163, 445, 110],
      [260, 292, 330, 330],
      [325, 240, 400, 270],
      [390, 186, 460, 200],
    ]) {
      g.beginPath();
      g.moveTo(x0, y0);
      g.quadraticCurveTo((x0 + x1) / 2 + 10, (y0 + y1) / 2, x1, y1);
      g.stroke();
    }
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(140, 400);
    g.quadraticCurveTo(110, 430, 90, 450);
    g.stroke();
  }
  return c;
}

// ---------- pipeline ----------
function settings() {
  return {
    mode: document.querySelector('input[name="mode"]:checked').value,
    open: document.querySelector('input[name="loop"]:checked').value === "open",
    sens: +$("sens").value,
    blur: +$("blur").value / 10,
    minLen: +$("minLen").value,
    far: +$("far").value,
    res: workRes(),
    invert: $("invert").checked,
    loose: +$("loose").value,
    prep: {
      brightness: +$("bright").value,
      contrast: +$("contrast").value,
      bgTol: +$("bgTol").value,
      flatten: $("flatten").checked,
    },
  };
}

// a new source: forget what was painted, erased or placed by hand on the old one
function resetHandEdits() {
  st.erase = [];
  st.start = null;
  st.zones = { cross: [], lane: [] };
  st.zoneVer = (st.zoneVer || 0) + 1;
  st.zm = {};
}
let srcCounter = 0;
function setSource(canvas, label) {
  clearTimeout(textTimer);
  stopOptimize(); // a new picture: pending text and a running Optimize are for the old one
  if (document.body.dataset.src === "text") {
    document.body.dataset.src = "image";
    st.text = null;
    st.imageSource = null;
    $("sizeRow").hidden = false;
  }
  canvas.__id = ++srcCounter;
  st.source = canvas;
  st.rr = 0;
  st.sizeUser = false;
  st.sel = null; // a new image: proportions unknown, size back to the starting mark
  resetHandEdits();
  if (st.penFill) st.penFill.areas = [];
  st.srcLabel = label;
  $("srcinfo").textContent = label;
  if (st.tool) exitTool();
  updateToolLabels();
  st.autoPending = true;
  launch(extract);
}

// ---------- text source ----------
// Text's size: the letter height lays the words out; the width and height boxes (and Fit inside a box) scale the letter
// height, so the print size leads and the letter height follows. The size slider is for images.
function textSizeUI(t) {
  $("sizeRow").hidden = t;
  if (t) {
    $("sizeHint").className = "hint";
    $("sizeHint").textContent =
      "Type a width or height, or fit it inside a box: the letter height follows (and the other way round).";
  }
}
function scaleText(f) {
  // the print f times as big: the letter height (and set gaps) with it
  if (!(f > 0) || !st.text) return;
  $("capH").value = +(st.text.cap * f).toFixed(2);
  for (const id of ["letterGap", "wordGap"]) if ($(id).value !== "") $(id).value = +(+$(id).value * f).toFixed(2);
  recordSoon();
  textChanged();
}
const textMode = () => $("srcText").checked;
// letter height ≥ ratio × line width to stay readable (settings.js rules)
const MIN_CAP_RATIO = CFG.rules.minLetterHeight;
function spacingMM() {
  return st.spacing;
}
// Line width in mm (Trace tab, Line card): the needle's inside diameter, set by the needle picked on the 3D tab
function lineWidthMM() {
  return Math.min(5, Math.max(0.05, +$("lineW").value || 0.84));
}
function buildText() {
  const font = UNB_FONTS[$("font").value],
    lw = spacingMM() || 1,
    ratio = MIN_CAP_RATIO[$("font").value] || MIN_CAP_RATIO.default;
  // Readability is about the printed stroke. Each letter stroke is drawn out and back as a narrow loop: two lines one
  // spacing apart, so the stroke is line width + spacing wide (2 × needle + gap). Without a spacing it's one line.
  const lineW = lineWidthMM(),
    band = spacingMM() > 0 ? lineW + spacingMM() : lineW;
  const minCap = ratio * band;
  let cap = +$("capH").value || 15;
  const hint = $("capHint"),
    what =
      spacingMM() > 0
        ? `${fmt(band, 2)} mm letter stroke (two ${fmt(lineW, 2)} mm lines ${fmt(spacingMM(), 2)} mm apart)`
        : `${fmt(lineW, 2)} mm line`;
  if (cap < minCap + 0.005) {
    // at (or pushed up to) the smallest: the boxes say so, and what the print really is
    cap = minCap;
    $("capH").value = +minCap.toFixed(2);
    hint.className = "hint warn";
    hint.textContent = `At the smallest: ${fmt(minCap, 1)} mm is the smallest readable letter height in this font for a ${what}, ${ratio} stroke widths. A smaller letter height, width or height comes back to this.`;
    $("sizeHint").className = "hint warn";
    $("sizeHint").textContent =
      `As small as this lettering goes with this needle (letters ${fmt(minCap, 1)} mm tall): a smaller width or height comes back to this size. A finer needle or a plainer font goes smaller.`;
  } else {
    hint.className = "hint";
    hint.textContent = `Smallest readable height in this font for a ${what}: ${fmt(minCap, 1)} mm.`;
    textSizeUI(true);
  }
  const mode = $("txtSpacing").value === "auto" ? (font.joined ? "font" : "even") : $("txtSpacing").value;
  const TR = CFG.rules,
    gapIn = $("letterGap").value === "" ? TR.letterGapShare * cap : +$("letterGap").value;
  const gap = Math.max(gapIn, TR.minLetterGap * lw); // letters never closer than the line spacing
  const wordIn = $("wordGap").value === "" ? TR.wordGapShare * cap : +$("wordGap").value;
  const lay = UNB.textLayout(($("textIn").value || " ").split("\n").slice(0, MAX_LINES).join("\n"), font, {
    cap,
    spacing: mode,
    gap,
    track: 0,
    word: Math.max(wordIn, TR.minWordGap * lw),
    lineGap: Math.max(1, +$("lineGap").value || 1.7),
    align: document.querySelector('input[name="align"]:checked').value,
  });
  if (!lay.strokes.length) {
    setChip("Type some text to trace");
    return null;
  }
  const ppm = Math.min(Math.max(4, 60 / cap), 1600 / Math.max(lay.width, lay.height, 1)),
    margin = Math.max(3, 3 * lw);
  const R = UNB.rasterText(lay, ppm, margin);
  const c = document.createElement("canvas");
  c.width = R.w;
  c.height = R.h; // preview background: the letters
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, R.w, R.h);
  g.strokeStyle = "#000";
  g.lineWidth = Math.max(1.5, 0.8 * lw * ppm);
  g.lineCap = g.lineJoin = "round";
  g.beginPath();
  for (const s2 of lay.strokes) {
    for (let i = 0; i < s2.length; i += 2) {
      const x = s2[i] * ppm + margin * ppm,
        y = s2[i + 1] * ppm + margin * ppm;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    if (s2.length === 2) g.lineTo(s2[0] * ppm + margin * ppm + 0.1, s2[1] * ppm + margin * ppm);
  }
  g.stroke();
  // each line with letters, by its text (a piece per line on the 3D tab, pieces.js)
  const typed = ($("textIn").value || " ").split("\n");
  const lineNames = [...new Set(lay.lineOf)].sort((a, b) => a - b).map((i) => (typed[i] || "").trim());
  st.text = { ...R, cap, layout: lay, lineNames };
  return c;
}
let textTimer = null;
function textChanged() {
  clearTimeout(textTimer);
  textTimer = setTimeout(() => {
    if (!textMode()) return artTextChanged(); // art.js: the text is one of several layers, drawn into the art
    const c = buildText();
    if (!c) return;
    c.__id = ++srcCounter;
    st.source = c;
    st.sel = null;
    st.wk = null;
    st.srcLabel = `${UNB_FONTS[$("font").value].label.split(" (")[0]} · ${fmt(st.text.cap, 1)} mm`;
    $("srcinfo").textContent = st.srcLabel;
    st.autoPending = true;
    schedule(extract);
  }, 150);
}
// What the trace starts from, as the Art tab's Input switch decides it (art.js sets the switch first): "picture" (a
// picture to trace: an image, or a pattern drawn as one), "text" (traced from its font strokes) or "model" (a 3D model,
// sliced on the 3D tab)
function useSource(kind, canvas, label) {
  clearTimeout(textTimer);
  stopOptimize(); // a text change or an Optimize run still going is for the old source
  if (st.tool) exitTool();
  if (kind === "model") {
    document.body.dataset.src = "model";
    st.text = null;
    textSizeUI(false);
    enterModel();
    return;
  }
  if (kind === "text") {
    const was = document.body.dataset.src === "text";
    document.body.dataset.src = "text";
    if (!was) resetHandEdits();
    textSizeUI(true);
    textChanged();
    return;
  }
  document.body.dataset.src = "image";
  st.text = null;
  textSizeUI(false);
  setSource(canvas, label);
  syncSizeUI();
}
// The text drawn as a picture: the canvas, and its strokes in canvas px (for
// plotting the art as drawn). The text on screen (st.text) is left as it was.
function textPicture() {
  const keep = st.text,
    c = buildText(),
    T = st.text;
  st.text = keep;
  if (!c || !T) return null;
  const k = T.ppm,
    m = T.margin;
  return {
    canvas: c,
    strokes: T.layout.strokes.map((s2) => s2.map((v) => (v + m) * k)),
    lw: Math.max(1.5, 0.8 * (spacingMM() || 1) * k), // as buildText draws them
  };
}
const MAX_LINES = CFG.rules.maxTextLines;
function limitLines() {
  // text is limited to 5 lines; extra line breaks are dropped
  const el = $("textIn"),
    lines = el.value.split("\n");
  if (lines.length > MAX_LINES) {
    const pos = el.selectionStart,
      keep = lines.slice(0, MAX_LINES - 1).concat([lines.slice(MAX_LINES - 1).join(" ")]);
    el.value = keep.join("\n");
    el.selectionStart = el.selectionEnd = Math.min(pos, el.value.length);
  }
  const n = el.value.split("\n").length;
  $("lineCount").textContent =
    `${n} of ${MAX_LINES} lines` + (n > 1 && $("textPieces").value === "each" ? ` · ${n} pieces` : "");
  $("lineCount").title =
    n > 1 ? "On the 3D tab each line prints as a piece of its own, or joined into one (Plate card, Lines of text)" : "";
  $("lineCount").style.color = n >= MAX_LINES ? "var(--warn)" : "";
}
$("textIn").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && $("textIn").value.split("\n").length >= MAX_LINES) e.preventDefault();
});
$("textIn").addEventListener("input", limitLines);
for (const id of ["textIn", "capH", "letterGap", "wordGap", "lineGap"]) $(id).addEventListener("input", textChanged);
for (const id of ["font", "txtSpacing"]) $(id).addEventListener("change", textChanged);
document.querySelectorAll('input[name="align"]').forEach((r) => r.addEventListener("change", textChanged));

// source-normalized (u,v) <-> working pixels
const toWork = ([u, v], c = st.crop) => {
  return [(u * st.source.width - c.sx) * c.kx, (v * st.source.height - c.sy) * c.ky];
};
const fromWork = (x, y, c = st.crop) => {
  return [(c.sx + x / c.kx) / st.source.width, (c.sy + y / c.ky) / st.source.height];
};
