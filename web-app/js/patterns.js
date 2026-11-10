// Unbroken · web app · patterns.js
// The Pattern card on the Art step: the settings of the chosen pattern (a style from the engine's UNB.PATTERNS,
// source/engine/13-patterns.js). Each style lists its own settings (params: sliders, choices and switches, some shown
// only with others); the card builds its controls from that list, so a new setting in the engine needs nothing here.
// The pattern itself, and drawing it, belong to art.js; this file shows its settings and hands every change back
// (patternEdited).
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

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

addExample(60, "labyrinth", "Labyrinth", "a pattern, one closed line", () => artExamplePattern("labyrinth"));
addExample(70, "spirograph", "Spirograph", "a pattern that crosses itself", () => artExamplePattern("spirograph"));
addExample(80, "portrait", "Wave portrait", "the face in wave rows", () => artExamplePattern("wavesTone"));

// ---------- the pattern as the art in use (the Art step, art.js) ----------
// { style, seed, and the style's own settings (UNB.PATTERNS params) }
st.art.pattern = UNB.patternDefaults("labyrinth");
st.art.width = null; // the pattern's print width in mm, or null for the width that fits the needle
function patternName(p) {
  const P = UNB.PATTERNS[p.style];
  const shaped = P && P.params.some((q) => q.key === "shape");
  return P ? P.label + (shaped && p.shape && p.shape !== "square" ? ` · ${p.shape}` : "") : "Pattern";
}
// the pattern drawn as exact lines (cached for the same settings): { r (UNB.pattern), L (UNB.patternLayout) }
let patternCache = null;
function patternDrawn() {
  const tone = patternTone(),
    plot = artForPlot(),
    key = JSON.stringify(st.art.pattern) + (tone ? `|${tone.key}` : "") + (plot ? "|plot" : "");
  if (patternCache && patternCache.key === key) return patternCache;
  const r = UNB.pattern(st.art.pattern.style, { ...st.art.pattern, tone, plot });
  patternCache = { key, r, L: r ? UNB.patternLayout(r, ART_LONG) : null };
  return patternCache;
}
// The picture's darkness for the patterns drawn from one (UNB.PATTERNS[…].tone): the Art step's picture, at most 400 px
// on its long side, 0 white … 1 black; the face sample instead of none or of a line-drawing sample (the leaf, shapes,
// smiley: thin lines on white, no light and dark to draw). null for the other patterns.
const LINE_SAMPLES = ["leaf", "shapes", "smiley"];
let faceSample = null;
function tonePicture() {
  const p = st.art.picture;
  if (p && !LINE_SAMPLES.includes(p.sample)) return p;
  return (faceSample = faceSample || { canvas: tagged(makeSample("face")), label: "face sample", sample: "face" });
}
let patternToneCache = null;
const TONE_LONG = 400;
function patternTone() {
  const P = UNB.PATTERNS[st.art.pattern.style];
  if (!P || !P.tone) return null;
  const src = tonePicture().canvas;
  if (patternToneCache && patternToneCache.key === src.__art) return patternToneCache;
  const k = Math.min(1, TONE_LONG / Math.max(src.width, src.height)),
    w = Math.max(2, Math.round(src.width * k)),
    h = Math.max(2, Math.round(src.height * k)),
    c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, w, h);
  g.drawImage(src, 0, 0, w, h);
  const px = g.getImageData(0, 0, w, h).data,
    d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++)
    d[i] = 1 - (0.2126 * px[4 * i] + 0.7152 * px[4 * i + 1] + 0.0722 * px[4 * i + 2]) / 255;
  return (patternToneCache = { key: src.__art, w, h, d });
}
// the width (mm) where the pattern's closest lines are the line spacing apart (3% over), or null
function patternFitWidth() {
  const { r } = patternDrawn(),
    P = UNB.PATTERNS[st.art.pattern.style];
  return r && P && P.evenGap && st.spacing > 0 ? (r.box[0] / r.gap) * st.spacing * 1.03 : null;
}
// the Pattern card's Width (mm) and how far apart its closest lines come, against the needle's line spacing
function artSizeUI() {
  if (st.art.kind !== "pattern") return;
  const { r, L } = patternDrawn();
  if (!r) return;
  $("artWidth").closest(".inline").hidden = artForPlot();
  $("artWidthLab").textContent = artForPlot() ? "Size" : "Width (mm)";
  if (artForPlot()) {
    // made for plotting: as wide as the Plot step's page allows (Art as drawn), measured against pen 1
    const P = paperSize(), // plot.js
      mg = Math.max(0, +$("paperMargin").value || 0),
      W = r.box[0] * L.s * Math.min((P.w - 2 * mg) / L.w, (P.h - 2 * mg) / L.h), // (as artOnPage places it)
      gapMM = (W * r.gap) / r.box[0],
      pen = Math.max(0.05, +$("penW").value || 0.5),
      h = $("artGapHint");
    $("artGapInfo").textContent = `${fmt(W, 0)} mm wide · lines ${fmt(gapMM, 2)} mm apart`;
    h.className = gapMM < pen ? "hint warn" : "hint";
    h.textContent =
      gapMM < pen
        ? `Closer than pen 1 (${fmt(pen, 2)} mm): neighbouring lines run into each other. Pick less detail, a finer pen, or a bigger page (Plot step).`
        : `Pen 1 is ${fmt(pen, 2)} mm: every line stays clear of its neighbours. The page size and margin (Plot step) set the width.`;
    return;
  }
  if (!st.outW) return;
  if (document.activeElement !== $("artWidth")) $("artWidth").value = +st.outW.toFixed(1);
  const gapMM = (st.outW * r.gap) / r.box[0],
    sp = st.spacing,
    P = UNB.PATTERNS[st.art.pattern.style],
    h = $("artGapHint");
  $("artGapInfo").textContent = `closest lines ${fmt(gapMM, 2)} mm apart`;
  $("artFit").hidden = !(P && P.evenGap && sp > 0);
  if (!(sp > 0) || !P || !P.evenGap) {
    h.className = "hint";
    h.textContent = "";
  } else if (gapMM < sp * 0.995) {
    h.className = "hint warn";
    h.textContent = `Closer than the needle's line spacing (${fmt(sp, 2)} mm): those lines get pushed apart, and the pattern loses its shape there. Make it wider, pick less detail, or Fit the needle.`;
  } else {
    h.className = "hint";
    h.textContent = `The needle's line spacing is ${fmt(sp, 2)} mm: every line prints clear of its neighbours.`;
  }
}
$("artWidth").addEventListener("change", () => {
  const v = +$("artWidth").value;
  if (!(v > 0)) return artSizeUI();
  setSize(v, true); // pipeline.js (it calls artSized, which keeps the width)
});
$("artFit").addEventListener("click", () => {
  const W = patternFitWidth();
  if (W) setSize(W, true);
  st.art.width = null; // follows the needle again (setSize kept it as set by hand)
  artSizeUI();
});
// a pattern setting moved
function patternEdited(p) {
  // a new style starts on the width that fits the needle; the same style keeps a width you set
  if (p.style !== st.art.pattern.style) st.art.width = null;
  st.art.pattern = p;
  $("artVal").textContent = patternName(p);
  if (st.art.kind === "pattern") artApplySoon();
}

function artExamplePattern(style) {
  st.art.pattern = UNB.patternDefaults(style, { seed: 1 });
  st.art.width = null;
  patternControls(st.art.pattern); // patterns.js
  artUse("pattern");
}
addArtKind("pattern", {
  radio: "srcPattern",
  name: () => patternName(st.art.pattern),
  note: () => `The ${patternName(st.art.pattern)} pattern, traced into one line.`,
  drawnOK: true,
  keepsPicture: () => !!(UNB.PATTERNS[st.art.pattern.style] || {}).tone, // (a pattern drawn from a picture)
  nothing: () => (patternDrawn().r ? "" : "Nothing left inside that shape: try more detail or another shape."),
  sized(W) {
    st.art.width = W;
  },
  // traced as drawn: its picture, centreline, and the closed or open line it is
  apply(A) {
    const D = patternDrawn(),
      c = D.r ? linesPicture(D) : null,
      P = UNB.PATTERNS[A.pattern.style];
    if (!c) {
      $("artMsg").textContent = "Nothing left inside that shape: try more detail or another shape.";
      return;
    }
    // a pattern that crosses itself, for printing: Allow overlaps on (once per style, so unticking it sticks), or
    // every crossing is undone, which is slow and bends the pattern out of shape
    let note = "";
    if (P.crosses && !$("overlaps").checked && A.overlapsFor !== A.pattern.style) {
      $("overlaps").checked = true;
      note =
        "Allow overlaps is on now (Line step, Line card): the needle prints over each crossing. Untick it to undo every crossing instead (slow, and the pattern bends).";
    }
    if (P.crosses) A.overlapsFor = A.pattern.style;
    $("modeCenter").checked = true;
    $("invert").checked = false;
    $(P.line === "open" ? "loopOpen" : "loopClosed").checked = true;
    labels();
    useSource("picture", c, patternName(A.pattern));
    // the width set in the Pattern card, or the width where the closest lines are the line spacing apart (so it
    // prints as drawn, nothing pushed apart)
    const W = A.width || patternFitWidth();
    if (W) startSize(W, D.r.box[0] / Math.max(1e-9, D.r.box[1]));
    $("artMsg").textContent = note;
  },
  // its lines exactly as made, in px of its own picture (the Plot step's Art as drawn)
  vectors(pen) {
    const { r, L } = patternDrawn();
    if (!r) return null;
    const strokes = r.paths.map((p, i) => {
      const q = p.map((v) => (v + L.m) * L.s);
      if (r.closed[i] && q.length > 4) q.push(q[0], q[1]);
      return q;
    });
    return { W: L.w, H: L.h, layers: [{ name: patternName(st.art.pattern), pen, strokes }], pictures: 0 };
  },
});
on("sized", artSizeUI); // the print's size changed: the Pattern card's width and gap follow
on("artUI", (A) => {
  patternControls(A.pattern);
  const PT = UNB.PATTERNS[A.pattern.style];
  $("artPicRow").hidden = !(PT && PT.tone);
  $("artPicName").textContent = tonePicture().label;
  artSizeUI();
});
on("artSave", () => ({ pattern: { ...st.art.pattern }, width: st.art.width }));
on("artRestore", (a) => {
  // (a design saved before v104 keeps its detail, twist, sides and shape: the keys are the same)
  st.art.pattern = UNB.patternDefaults(
    a.pattern && UNB.PATTERNS[a.pattern.style] ? a.pattern.style : "labyrinth",
    a.pattern
  );
  st.art.width = a.width || null;
});
on("fillPattern", () => patternDrawn().r); // a grey filled with the pattern (workflow.js)
// made for a printer or a plotter: the ranges for this use
document.querySelectorAll('input[name="artFor"]').forEach((r) =>
  r.addEventListener("change", () => {
    patternControls(st.art.pattern);
    patternEdited(patternNow());
  })
);
// the Pattern card's picture (for the patterns drawn from one)
$("artPicChoose").addEventListener("click", () => $("picFile").click());
$("artPicFace").addEventListener("click", () => artUsePicture(makeSample("face"), "face sample", "face"));
