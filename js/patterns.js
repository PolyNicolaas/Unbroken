// Unbroken · web app · patterns.js
// The Pattern card on the Art tab: the settings of the chosen pattern layer (a style from the engine's UNB.PATTERNS,
// source/engine/13-patterns.js). The layer itself, and drawing it, belong to art.js; this file shows its settings and
// hands every change back (patternEdited).
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

const artStyle = () => UNB.PATTERNS[$("artStyle").value] || UNB.PATTERNS.labyrinth;

(() => {
  for (const [key, P] of Object.entries(UNB.PATTERNS)) {
    const o = document.createElement("option");
    o.value = key;
    o.textContent = P.label;
    $("artStyle").appendChild(o);
  }
})();

// the sliders' ranges for a style
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
// show a pattern layer's settings (art.js, when it's the chosen layer)
function patternControls(p) {
  $("artStyle").value = p.style;
  artRanges(p.style);
  $("artDetail").value = p.detail;
  $("artTwist").value = p.twist;
  $("artSides").value = String(p.sides);
  $("artShape").value = p.shape;
  $("artSeed").value = String(p.seed);
  patternUI();
}
// the controls this style uses, their names and values, and what it suits
function patternUI() {
  const P = artStyle();
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
    ? `One unbroken ${P.line === "open" ? "open " : ""}line with even gaps: on its own it prints without doubled strokes.`
    : P.crosses
      ? "Where it crosses itself it suits the pen plotter best; for a printer every crossing is undone."
      : "Many separate pieces joined by connectors: best on the pen plotter.";
  $("artTip").textContent = `${P.tip}. ${suits}`;
  $("artVal").textContent = P.label;
}
// the settings as they stand
const patternNow = () => ({
  style: $("artStyle").value,
  detail: +$("artDetail").value,
  twist: +$("artTwist").value,
  sides: +$("artSides").value,
  shape: $("artShape").value,
  seed: +$("artSeed").value || 1,
});
// a new style starts from its own defaults
$("artStyle").addEventListener("change", () => {
  const P = artStyle();
  artRanges($("artStyle").value);
  $("artDetail").value = P.detail.value;
  if (P.twist) $("artTwist").value = P.twist.value;
  patternUI();
  patternEdited(patternNow());
});
for (const id of ["artDetail", "artTwist"])
  $(id).addEventListener("input", () => {
    patternUI();
    patternEdited(patternNow());
  });
for (const id of ["artSides", "artShape"]) $(id).addEventListener("change", () => patternEdited(patternNow()));
$("artShuffle").addEventListener("click", () => {
  $("artSeed").value = String(1 + Math.floor(Math.random() * 999999));
  patternEdited(patternNow());
});
patternUI();
