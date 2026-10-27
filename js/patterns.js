// Unbroken · web app · patterns.js
// The Geometric art card: a pattern from the engine (UNB.pattern, source/engine/13-patterns.js) drawn as a picture and
// traced like any other, so every rule of the line applies to it. Once a pattern is the picture, the card's controls
// change it as you go; otherwise they wait for Make and trace, so a picture of yours is never replaced by accident.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

const ART_SIZE = 1600; // px: the long side of the picture a pattern is drawn as
const artIsSource = () => !!(st.source && st.source.__pattern); // the picture on screen is a pattern
const artStyle = () => UNB.PATTERNS[$("artStyle").value] || UNB.PATTERNS.labyrinth;

(() => {
  for (const [key, P] of Object.entries(UNB.PATTERNS)) {
    const o = document.createElement("option");
    o.value = key;
    o.textContent = P.label;
    $("artStyle").appendChild(o);
  }
  $("artVal").textContent = `${Object.keys(UNB.PATTERNS).length} styles`;
})();

// the sliders' ranges for a style (history.js calls this before putting a saved design back, so its values fit)
function artRanges(style) {
  const P = UNB.PATTERNS[style];
  if (!P) return;
  for (const [id, spec] of [
    ["artDetail", P.detail],
    ["artTwist", P.twist],
  ])
    if (spec) {
      $(id).min = spec.min;
      $(id).max = spec.max;
    }
}
// the controls this style uses, their names and values, and what it suits
function artUI() {
  const P = artStyle();
  artRanges($("artStyle").value);
  $("artDetailLab").textContent = P.detail.name;
  $("artDetailVal").textContent = P.detail.say(+$("artDetail").value);
  $("artTwistRow").hidden = !P.twist;
  if (P.twist) {
    $("artTwistLab").textContent = P.twist.name;
    $("artTwistVal").textContent = P.twist.say(+$("artTwist").value);
  }
  $("artSidesF").hidden = !P.sides;
  $("artShapeF").hidden = !P.shape;
  $("artShuffle").hidden = !P.seed;
  const suits = P.oneLine
    ? `One unbroken ${P.line === "open" ? "open " : ""}line with even gaps: prints in chocolate without doubled strokes.`
    : P.crosses
      ? "Where it crosses itself it suits the pen plotter (2D tab) best; for chocolate every crossing is undone."
      : "Many separate pieces joined by connectors: best on the pen plotter (2D tab).";
  $("artTip").textContent = `${P.tip}. ${suits}`;
  $("artVal").textContent = artIsSource() ? P.label : `${Object.keys(UNB.PATTERNS).length} styles`;
}
// a new style starts from its own defaults
$("artStyle").addEventListener("change", () => {
  const P = artStyle();
  artRanges($("artStyle").value);
  $("artDetail").value = P.detail.value;
  if (P.twist) $("artTwist").value = P.twist.value;
  artUI();
  artChanged();
});
for (const id of ["artDetail", "artTwist"]) $(id).addEventListener("input", () => (artUI(), artChanged()));
for (const id of ["artSides", "artShape"]) $(id).addEventListener("change", artChanged);
$("artMake").addEventListener("click", makeArt);
$("artShuffle").addEventListener("click", () => {
  $("artSeed").value = String(1 + Math.floor(Math.random() * 999999));
  makeArt();
});
// a control moved: redraw the pattern when it's the picture on screen (after a short pause, as a slider is dragged)
let artTimer = null;
function artChanged() {
  clearTimeout(artTimer);
  if (artIsSource()) artTimer = setTimeout(makeArt, 250);
}

// The pattern drawn as a picture to trace: black strokes on white, laid out by UNB.patternLayout (a margin all round,
// strokes a third of the closest gap, so the centreline trace finds one clean line down each)
function drawArt(r) {
  const L = UNB.patternLayout(r, ART_SIZE),
    c = document.createElement("canvas");
  c.width = L.w;
  c.height = L.h;
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, L.w, L.h);
  g.strokeStyle = "#000";
  g.lineCap = g.lineJoin = "round";
  g.lineWidth = L.lineWidth;
  r.paths.forEach((p, i) => {
    g.beginPath();
    for (let j = 0; j < p.length; j += 2) {
      const x = (p[j] + L.m) * L.s,
        y = (p[j + 1] + L.m) * L.s;
      j ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    if (r.closed[i]) g.closePath();
    g.stroke();
  });
  return c;
}
function makeArt() {
  clearTimeout(artTimer);
  const key = $("artStyle").value,
    P = artStyle(),
    o = {
      detail: +$("artDetail").value,
      twist: +$("artTwist").value,
      sides: +$("artSides").value,
      shape: $("artShape").value,
      seed: +$("artSeed").value || 1,
    };
  const r = UNB.pattern(key, o);
  if (!r) {
    $("artMsg").textContent = "Nothing left inside that shape: try more detail or another shape.";
    return;
  }
  $("artMsg").textContent = "";
  const c = drawArt(r);
  c.__pattern = { style: key, ...o };
  // traced as drawn: one line down the middle of each stroke, closed or open as the pattern is
  $("modeCenter").checked = true;
  $("invert").checked = false;
  $(P.line === "open" ? "loopOpen" : "loopClosed").checked = true;
  $("sample").value = "pattern";
  labels();
  const extra =
    P.shape && $("artShape").value !== "square"
      ? ` · ${$("artShape").selectedOptions[0].textContent.toLowerCase()}`
      : "";
  setSource(c, `${P.label}${extra}`);
  // start at the width where the pattern's own gaps are the line spacing (a little over), so it prints as drawn;
  // Spirograph and Lissajous have no even gap and start on the usual mark
  if (P.evenGap && st.spacing > 0)
    startSize((r.box[0] / r.gap) * st.spacing * 1.03, r.box[0] / Math.max(1e-9, r.box[1]));
  artUI();
}
artUI();
