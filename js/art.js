// Unbroken · web app · art.js
// The Art tab: where everything comes in, one thing at a time. The Input switch picks what the trace starts from: a
// picture, the text, a geometric pattern or a 3D model. Each keeps its own settings while another is in use, so
// switching back finds it as it was. artApply hands the one in use to the trace (useSource, source.js). A pattern or
// the text can also go to the 2D tab exactly as drawn, without tracing (artVectors, for plot.js).
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// st.art = { kind: "picture" | "text" | "pattern" | "model",
//            picture: { canvas, label, sample } (the last picture: a sample, an image of yours, a sketch, a model's
//              drawing), pattern: { style, detail, twist, sides, shape, seed } }
// The text's settings are the Text card's controls, the model is st.model (model.js).
st.art = {
  kind: "picture",
  picture: null,
  pattern: { style: "labyrinth", detail: 12, twist: 30, sides: 4, shape: "square", seed: 1 },
};
const ART_LONG = 1600; // px: the long side a pattern is drawn at (UNB.patternLayout)
const KIND_RADIO = { picture: "srcImage", text: "srcText", pattern: "srcPattern", model: "srcModel" };
const KIND_NAME = { picture: "Picture", text: "Text", pattern: "Pattern", model: "3D model" };
let artSeq = 0; // tags each picture canvas, so undo can tell a new picture from the same one

function patternName(p) {
  const P = UNB.PATTERNS[p.style];
  return P ? P.label + (P.shape && p.shape && p.shape !== "square" ? ` · ${p.shape}` : "") : "Pattern";
}
// the pattern drawn as exact lines (cached for the same settings): { r (UNB.pattern), L (UNB.patternLayout) }
let patternCache = null;
function patternDrawn() {
  const key = JSON.stringify(st.art.pattern);
  if (patternCache && patternCache.key === key) return patternCache;
  const r = UNB.pattern(st.art.pattern.style, st.art.pattern);
  patternCache = { key, r, L: r ? UNB.patternLayout(r, ART_LONG) : null };
  return patternCache;
}
// the pattern as a picture to trace: black strokes on white
function patternPicture() {
  const { r, L } = patternDrawn();
  if (!r) return null;
  const c = document.createElement("canvas");
  c.width = L.w;
  c.height = L.h;
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, L.w, L.h);
  g.strokeStyle = "#000000";
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
const tagged = (c) => {
  c.__art = ++artSeq;
  return c;
};
function samplePicture(kind = CFG.defaults.sample || "leaf") {
  return { canvas: tagged(makeSample(kind)), label: "sample", sample: kind };
}

// ---------- what the trace starts from ----------
let applyTimer = null;
function artApplySoon(delay = 250) {
  clearTimeout(applyTimer);
  applyTimer = setTimeout(artApply, delay);
}
function artApply() {
  clearTimeout(applyTimer);
  const A = st.art;
  $(KIND_RADIO[A.kind]).checked = true;
  document.body.dataset.art = A.kind;
  if (A.kind === "model") {
    if (!st.model) setModel(sampleVase(), "sample vase");
    useSource("model");
  } else if (A.kind === "text") useSource("text");
  else if (A.kind === "pattern") {
    const c = patternPicture(),
      P = UNB.PATTERNS[A.pattern.style];
    if (c) {
      // traced as drawn: centreline, and the closed or open line it is
      $("modeCenter").checked = true;
      $("invert").checked = false;
      $(P.line === "open" ? "loopOpen" : "loopClosed").checked = true;
      labels();
      useSource("picture", c, patternName(A.pattern));
      // an even gap: start at the width where that gap is the line spacing (a little over), so it prints as drawn
      const { r } = patternDrawn();
      if (P.evenGap && st.spacing > 0)
        startSize((r.box[0] / r.gap) * st.spacing * 1.03, r.box[0] / Math.max(1e-9, r.box[1]));
      $("artMsg").textContent = "";
    } else $("artMsg").textContent = "Nothing left inside that shape: try more detail or another shape.";
  } else {
    if (!A.picture) A.picture = samplePicture();
    useSource("picture", A.picture.canvas, A.picture.label);
  }
  artUI();
}
// the Input switch
document.querySelectorAll('input[name="srcType"]').forEach((r) =>
  r.addEventListener("change", () => {
    st.art.kind = r.value;
    artApply();
  })
);
// another kind of input (start-up, the lettering preset, the tests)
function artUse(kind) {
  st.art.kind = kind;
  artApply();
}
const artShowOnly = artUse; // (the name the tests know)
// a picture (a file, a sample, a sketch, a model's drawing) becomes the picture in use
function artUsePicture(canvas, label, sample) {
  st.art.picture = { canvas: tagged(canvas), label, sample: sample || "user" };
  artUse("picture");
}
// a 3D model loaded (model.js has made it st.model)
function artModel() {
  artUse("model");
}
// a model's line drawing becomes the picture to trace
function artModelDrawing(canvas, label) {
  artUsePicture(canvas, label);
}
// the text changed while it isn't in use (source.js): nothing to trace
function artTextChanged() {}
// a pattern setting moved (patterns.js)
function patternEdited(p) {
  st.art.pattern = p;
  $("artVal").textContent = patternName(p);
  if (st.art.kind === "pattern") artApplySoon();
}

// ---------- the 2D tab's Art as drawn ----------
// A pattern's or the text's lines exactly as made, in px of their own picture: { W, H, layers: [{ name, pen, strokes
// }], pictures } (one layer, pen 1's colour). A picture or a model has no lines until traced.
function artVectors() {
  const A = st.art,
    pen = $("penColor").value || "#111111";
  if (A.kind === "pattern") {
    const { r, L } = patternDrawn();
    if (!r) return null;
    const strokes = r.paths.map((p, i) => {
      const q = p.map((v) => (v + L.m) * L.s);
      if (r.closed[i] && q.length > 4) q.push(q[0], q[1]);
      return q;
    });
    return { W: L.w, H: L.h, layers: [{ name: patternName(A.pattern), pen, strokes }], pictures: 0 };
  }
  if (A.kind === "text") {
    const t = textPicture();
    if (!t) return null;
    return { W: t.canvas.width, H: t.canvas.height, layers: [{ name: "text", pen, strokes: t.strokes }], pictures: 0 };
  }
  return A.kind === "picture" ? { W: 1, H: 1, layers: [], pictures: 1 } : null;
}
const asDrawnOK = () => st.art.kind === "pattern" || st.art.kind === "text";

// ---------- undo and design files (history.js) ----------
// The art without its picture (kept apart: by reference for undo, as an image in a file). The picture's tag makes a new
// picture a new undo step.
function artSaved() {
  const P = st.art.picture;
  return {
    kind: st.art.kind,
    pattern: { ...st.art.pattern },
    picture: P ? { label: P.label, sample: P.sample, key: P.canvas.__art } : null,
  };
}
const artCanvas = () => (st.art.picture ? st.art.picture.canvas : null);
// Put saved art back (pic: the picture's canvas). A v101 design (layers) comes back as the top shown layer it had.
function artRestore(a, pic) {
  if (a.layers) {
    const shown = a.layers.filter((l) => l.on),
      top = shown.find((l) => l.kind === "model") || shown[shown.length - 1] || a.layers[a.layers.length - 1],
      pat = a.layers.find((l) => l.kind === "pattern"),
      picL = a.layers.find((l) => l.kind === "picture");
    a = {
      kind: top ? top.kind : "picture",
      pattern: pat ? pat.pattern : st.art.pattern,
      picture: picL ? { label: picL.name, sample: (picL.picture && picL.picture.sample) || "user" } : null,
    };
    pic = picL && pic instanceof Map ? pic.get(picL.id) : pic instanceof Map ? null : pic;
  }
  st.art = {
    kind: a.kind || "picture",
    pattern: Object.assign(
      { style: "labyrinth", detail: 12, twist: 30, sides: 4, shape: "square", seed: 1 },
      a.pattern
    ),
    picture: pic
      ? {
          canvas: pic.__art ? pic : tagged(pic),
          label: (a.picture && a.picture.label) || "picture",
          sample: (a.picture && a.picture.sample) || "user",
        }
      : null,
  };
}
// a design from before the Art tab (v100 and older): its source as it was
function artFromOld(kind, canvas, label, pattern) {
  const pat = pattern && UNB.PATTERNS[pattern.style];
  st.art = {
    kind: kind === "model" ? "model" : kind === "text" ? "text" : pat ? "pattern" : "picture",
    pattern: Object.assign(
      { style: "labyrinth", detail: 12, twist: 30, sides: 4, shape: "square", seed: 1 },
      pat ? pattern : {}
    ),
    picture: canvas ? { canvas: tagged(canvas), label: label || "picture", sample: "user" } : null,
  };
}

// ---------- the cards ----------
function artUI() {
  const A = st.art;
  document.body.dataset.art = A.kind;
  $(KIND_RADIO[A.kind]).checked = true;
  $("inputVal").textContent =
    A.kind === "pattern"
      ? patternName(A.pattern)
      : A.kind === "picture"
        ? (A.picture && A.picture.label) || ""
        : A.kind === "model"
          ? (st.model && st.model.name) || ""
          : "";
  if (A.picture) {
    $("sample").value = [...$("sample").options].some((o) => o.value === A.picture.sample) ? A.picture.sample : "user";
    $("picVal").textContent = A.picture.label;
  }
  patternControls(A.pattern); // patterns.js
  $("fromArt").textContent = {
    picture: "The picture, traced into one line.",
    text: "The text, traced from its font's strokes.",
    pattern: `The ${patternName(A.pattern)} pattern, traced into one line.`,
    model: "A 3D model: it is sliced on the 3D tab.",
  }[A.kind];
  $("goPlot").disabled = !asDrawnOK();
  $("goPlot").title = asDrawnOK()
    ? "Plot it exactly as drawn on the 2D tab, without tracing"
    : "Only a pattern or text can be plotted as drawn: a picture needs tracing, and a model its view drawn";
}
// the picture card
$("sample").addEventListener("change", () => {
  const v = $("sample").value;
  if (v !== "user") artUsePicture(makeSample(v), "sample", v);
});
$("picChoose").addEventListener("click", () => $("picFile").click());
$("picFile").addEventListener("change", () => {
  loadFile($("picFile").files[0]); // controls.js: becomes the picture
  $("picFile").value = "";
});
$("picDraw").addEventListener("click", () => {
  setStage("line");
  enterTool("draw");
});
$("goTrace").addEventListener("click", () => {
  $("viewDesign").checked = true;
  viewChanged();
});
$("goPlot").addEventListener("click", () => {
  $("plotArt").checked = true;
  plotFromUI(); // plot.js
  $("view2D").checked = true;
  viewChanged();
  plotSoon(0);
});
$("toArt").addEventListener("click", () => {
  $("viewArt").checked = true;
  viewChanged();
});
