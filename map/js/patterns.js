// Unbroken · web app · patterns.js
// The Pattern card on the Art step: the settings of the chosen pattern (a style from the engine's UNB.PATTERNS,
// source/engine/13-patterns.js). Each style lists its own settings (params: sliders, choices and switches, some shown
// only with others); the card builds its controls from that list, so a new setting in the engine needs nothing here.
// The pattern itself, and drawing it, belong to art.js; this file shows its settings and hands every change back
// (patternEdited).
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// made for plotting (the Art step's Input card, Made for): the ranges go up to their plotMax, and nothing is traced
// until asked (art.js)
const artForPlot = () => $("artForPlot").checked;
const artStyle = () => UNB.PATTERNS[$("artStyle").value] || UNB.PATTERNS.labyrinth;
const patternMemory = {}; // this session: each style's last settings, so going back to a style finds them again

// the styles in two groups: patterns of their own, and patterns drawn from a picture
(() => {
  for (const [label, tone] of [
    ["Patterns", false],
    ["Drawn from a picture", true],
  ]) {
    const grp = document.createElement("optgroup");
    grp.label = label;
    for (const [key, P] of Object.entries(UNB.PATTERNS))
      if (!!P.tone === tone) {
        const o = document.createElement("option");
        o.value = key;
        o.textContent = P.label.replace(/ \(picture\)$/, "");
        grp.appendChild(o);
      }
    $("artStyle").appendChild(grp);
  }
})();

// one control per setting, ids artP-<key>, built when the style changes
let paramsFor = null;
function buildParams(style) {
  const key = style + (artForPlot() ? "|plot" : "");
  if (paramsFor === key) return;
  paramsFor = key;
  const box = $("artParams");
  box.textContent = "";
  // settings with a group (the Spirograph's ring, each wheel, …) go together under its heading, a divider above
  let into = box,
    group = null;
  for (const q of UNB.PATTERNS[style].params) {
    if ((q.group || null) !== group) {
      group = q.group || null;
      if (group) {
        into = document.createElement("div");
        into.className = "pgroup";
        into.dataset.group = group;
        const h = document.createElement("div");
        h.className = "pgroup-h";
        h.textContent = group;
        into.appendChild(h);
        box.appendChild(into);
      } else into = box;
    }
    const id = `artP-${q.key}`,
      wrap = document.createElement("div");
    wrap.className = "row";
    wrap.dataset.key = q.key;
    if (q.type === "range") {
      wrap.innerHTML = `<div class="lab"><label for="${id}"></label><span class="val"></span></div><input type="range" id="${id}">`;
      wrap.querySelector("label").textContent = q.name;
      Object.assign(wrap.querySelector("input"), {
        min: q.min,
        max: artForPlot() && q.plotMax ? q.plotMax : q.max,
        step: q.step,
      });
    } else if (q.type === "path") {
      // a path drawn by hand (pathpad.js): kept as JSON in a hidden box, drawn on its pad
      wrap.innerHTML = `<div class="lab"><span class="name"></span><span class="val"></span></div><div class="inline"><button class="btn mini" type="button" data-path="draw">Draw the path…</button><button class="btn mini" type="button" data-path="clear">Clear</button></div><input type="hidden" id="${id}" value="null">`;
      wrap.querySelector(".name").textContent = q.name;
      wrap.querySelector('[data-path="draw"]').addEventListener("click", () => pathPadOpen(q.key)); // pathpad.js
      wrap.querySelector('[data-path="clear"]').addEventListener("click", () => {
        $(id).value = "null";
        patternUI();
        patternEdited(patternNow());
      });
      into.appendChild(wrap);
      continue;
    } else if (q.type === "select") {
      wrap.innerHTML = `<label class="field"><span></span><select id="${id}"></select></label>`;
      wrap.querySelector("span").textContent = q.name;
      const sel = wrap.querySelector("select");
      for (const [v, name] of q.options) sel.add(new Option(name, String(v)));
    } else {
      wrap.innerHTML = `<label class="check"><input type="checkbox" id="${id}"> <span></span></label>`;
      wrap.querySelector("span").textContent = q.name;
    }
    const el = wrap.querySelector(`#${CSS.escape(id)}`);
    el.addEventListener(q.type === "range" ? "input" : "change", () => {
      patternUI();
      patternEdited(patternNow());
    });
    into.appendChild(wrap);
  }
}
// a path setting's box: its points, or null
function patternPathOf(el) {
  try {
    const v = JSON.parse(el.value || "null");
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}
// the settings as the controls stand (UNB.patternDefaults fills in and clamps)
function patternNow() {
  const style = $("artStyle").value,
    o = { seed: +$("artSeed").value || 1 };
  for (const q of UNB.PATTERNS[style].params) {
    const el = $(`artP-${q.key}`);
    if (el)
      o[q.key] =
        q.type === "range"
          ? +el.value
          : q.type === "check"
            ? el.checked
            : q.type === "path"
              ? patternPathOf(el)
              : el.value;
  }
  return (patternMemory[style] = UNB.patternDefaults(style, { ...o, plot: artForPlot() }));
}
// show a pattern's settings (art.js)
function patternControls(p) {
  $("artStyle").value = p.style;
  buildParams(p.style);
  const v = UNB.patternDefaults(p.style, { ...p, plot: artForPlot() });
  for (const q of UNB.PATTERNS[p.style].params) {
    const el = $(`artP-${q.key}`);
    if (q.type === "check") el.checked = v[q.key];
    else if (q.type === "path") el.value = JSON.stringify(v[q.key]);
    else el.value = String(v[q.key]);
  }
  $("artSeed").value = String(v.seed);
  patternMemory[p.style] = v;
  patternUI();
}
// values beside the sliders, settings shown only with others (when), and what the style suits
function patternUI() {
  const P = artStyle(),
    v = UNB.patternDefaults($("artStyle").value, { ...readRaw(), plot: artForPlot() });
  for (const q of P.params) {
    const row = $("artParams").querySelector(`[data-key="${q.key}"]`);
    if (!row) continue;
    row.hidden = !!q.when && !q.when(v);
    if (q.type === "range") row.querySelector(".val").textContent = q.say(v[q.key]);
    if (q.type === "path") {
      row.querySelector(".val").textContent = v[q.key]
        ? "drawn: the centre moves along it"
        : "none: the centre stays put";
      row.querySelector('[data-path="clear"]').disabled = !v[q.key];
    }
  }
  // a group with nothing showing (Wheel 4 with 3 wheels) hidden, heading and all
  for (const g of $("artParams").querySelectorAll(".pgroup"))
    g.hidden = ![...g.querySelectorAll(".row")].some((r) => !r.hidden);
  $("artShuffle").hidden = !P.seed;
  const suits = artForPlot()
    ? "Made for plotting: drawn as exact lines on the Plot step (Plot as drawn), as fine as your pen allows."
    : P.tone
      ? "One unbroken line that draws the picture's light and dark: it prints in chocolate, the darkest parts at the line spacing."
      : P.oneLine
        ? `One unbroken ${P.line === "open" ? "open " : ""}line with even gaps: on its own it prints without doubled strokes.`
        : P.crosses
          ? `One unbroken line that crosses itself: to print it with its crossings, tick Allow overlaps on the Line step's Line card (${$("overlaps").checked ? "on now" : "off now: every crossing is undone"}); on the pen plotter it draws as it is.`
          : "Many separate pieces joined by connectors: best on the pen plotter.";
  $("artTip").textContent = `${P.tip}. ${suits}`;
  $("artVal").textContent = P.label;
}
// the controls' values without clamping (for when: patternUI)
function readRaw() {
  const o = {};
  $("artParams")
    .querySelectorAll("[data-key]")
    .forEach((row) => {
      const el = row.querySelector("input, select");
      o[row.dataset.key] =
        el.type === "checkbox"
          ? el.checked
          : el.type === "range"
            ? +el.value
            : el.type === "hidden"
              ? patternPathOf(el)
              : el.value;
    });
  return o;
}
// a new style starts from its last settings this session, or its own defaults
$("artStyle").addEventListener("change", () => {
  const style = $("artStyle").value;
  patternControls(patternMemory[style] || UNB.patternDefaults(style, { seed: +$("artSeed").value || 1 }));
  patternEdited(patternNow());
});
$("artShuffle").addEventListener("click", () => {
  $("artSeed").value = String(1 + Math.floor(Math.random() * 999999));
  patternEdited(patternNow());
});
$("overlaps").addEventListener("change", () => {
  if (st.art.kind === "pattern") patternUI();
});
patternControls(UNB.patternDefaults("labyrinth")); // (art.js shows the pattern in use once it loads)
