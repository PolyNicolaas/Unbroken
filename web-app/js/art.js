// Unbroken · web app · art.js
// The Art step: where everything comes in, one thing at a time. The Input switch picks what the trace starts from: a
// picture, the text, a geometric pattern or a 3D model. Each keeps its own settings while another is in use, so
// switching back finds it as it was. artApply hands the one in use to the trace (useSource, source.js). A pattern or
// the text can also go to the Plot step exactly as drawn, without tracing (artVectors, for plot.js).
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// st.art = { kind: "picture" | "text" | "pattern" | "model",
//            picture: { canvas, label, sample } (the last picture: a sample, an image of yours, a sketch, a model's
//              drawing; the patterns drawn from a picture use it too), pattern: { style, seed, and
// the style's own settings, keyed as in its UNB.PATTERNS params }, width: the pattern's print width in mm, or null for
// the width that fits the needle }
// The text's settings are the Text card's controls, the model is st.model (model.js).
st.art = {
  kind: "picture",
  picture: null,
  pattern: UNB.patternDefaults("labyrinth"),
  width: null,
};
const ART_LONG = 1600; // px: the long side a pattern is drawn at (UNB.patternLayout)
const KIND_RADIO = {
  picture: "srcImage",
  text: "srcText",
  pattern: "srcPattern",
  molecule: "srcMolecule",
  model: "srcModel",
};
const KIND_NAME = { picture: "Picture", text: "Text", pattern: "Pattern", molecule: "Molecule", model: "3D model" };
let artSeq = 0; // tags each picture canvas, so undo can tell a new picture from the same one

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
// the pattern as a picture to trace: black strokes on white (or another drawing of exact lines: a molecule)
function patternPicture(D = patternDrawn()) {
  const { r, L } = D;
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
  // one line: its exact points go to the trace too (pipeline.js traces them as drawn, crossings and all)
  if (r.paths.length === 1) {
    const p = r.paths[0],
      n = p.length / 2,
      x = new Float64Array(n),
      y = new Float64Array(n);
    for (let j = 0; j < n; j++) {
      x[j] = (p[2 * j] + L.m) * L.s;
      y[j] = (p[2 * j + 1] + L.m) * L.s;
    }
    c.__vector = { x, y, closed: !!r.closed[0] };
  }
  return c;
}
const tagged = (c) => {
  c.__art = ++artSeq;
  return c;
};

// ---------- what the trace starts from ----------
let applyTimer = null;
function artApplySoon(delay = 250) {
  clearTimeout(applyTimer);
  applyTimer = setTimeout(artApply, delay);
}
// A pattern whose line is As drawn (the Line step, workflow.js) isn't traced at all: its exact lines go to the page.
function artApply() {
  clearTimeout(applyTimer);
  const A = st.art;
  $(KIND_RADIO[A.kind]).checked = true;
  document.body.dataset.art = A.kind;
  lineDefault(); // workflow.js: the line that suits this input, until one is picked
  A.untraced = asDrawnOK() && lineModeNow() === "drawn";
  if (A.untraced) {
    $("artMsg").textContent =
      A.kind !== "pattern" || patternDrawn().r
        ? ""
        : "Nothing left inside that shape: try more detail or another shape.";
    plotSoon(0); // (the preview shows the page, the pattern as drawn: workflow.js)
  } else if (A.kind === "model") {
    if (!st.model) setModel(sampleVase(), "sample vase");
    useSource("model");
  } else if (A.kind === "text") useSource("text");
  else if (A.kind === "molecule") {
    // a molecule (molecule.js): its skeletal formula traced as drawn, like a pattern
    const D = moleculeDrawn(),
      c = D.r ? patternPicture(D) : null;
    if (c) {
      $("modeCenter").checked = true;
      $("invert").checked = false;
      $("loopOpen").checked = true;
      labels();
      useSource("picture", c, moleculeName());
      const W = A.molWidth || moleculeWidth();
      if (W) startSize(W, D.r.box[0] / Math.max(1e-9, D.r.box[1]));
      $("artMsg").textContent = "";
    } else useSource("picture", blankPicture(), "no molecule yet");
  } else if (A.kind === "pattern") {
    const c = patternPicture(),
      P = UNB.PATTERNS[A.pattern.style];
    if (c) {
      // a pattern that crosses itself, for printing: Allow overlaps on (once per style, so unticking it sticks), or
      // every crossing is undone, which is slow and bends the pattern out of shape
      let note = "";
      if (P.crosses && !$("overlaps").checked && A.overlapsFor !== A.pattern.style) {
        $("overlaps").checked = true;
        note =
          "Allow overlaps is on now (Line step, Line card): the needle prints over each crossing. Untick it to undo every crossing instead (slow, and the pattern bends).";
      }
      if (P.crosses) A.overlapsFor = A.pattern.style;
      // traced as drawn: centreline, and the closed or open line it is
      $("modeCenter").checked = true;
      $("invert").checked = false;
      $(P.line === "open" ? "loopOpen" : "loopClosed").checked = true;
      labels();
      useSource("picture", c, patternName(A.pattern));
      // the width set in the Pattern card, or the width where the closest lines are the line spacing apart (so it
      // prints as drawn, nothing pushed apart)
      const { r } = patternDrawn(),
        W = A.width || patternFitWidth();
      if (W) startSize(W, r.box[0] / Math.max(1e-9, r.box[1]));
      $("artMsg").textContent = note;
    } else $("artMsg").textContent = "Nothing left inside that shape: try more detail or another shape.";
  } else {
    // no picture yet: a blank page to trace (examples.js shows how to start)
    useSource("picture", A.picture ? A.picture.canvas : blankPicture(), A.picture ? A.picture.label : "nothing yet");
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
// (while a pattern drawn from a picture is in use, it stays in use and draws the new picture)
function artUsePicture(canvas, label, sample) {
  st.art.picture = { canvas: tagged(canvas), label, sample: sample || "user" };
  $("picAngle").value = 0; // a new picture starts as loaded
  const P = UNB.PATTERNS[st.art.pattern.style];
  artUse(st.art.kind === "pattern" && P && P.tone ? "pattern" : "picture");
}
// A photo (camera.js) becomes the picture: the cleaned picture, with the photo it came from (photo: { raw, corners,
// kind, light, ink, specks }) kept beside it so the Photo card can clean it again. The same photo cleaned again keeps
// its turn and straightening.
function artUsePhoto(canvas, label, photo) {
  const p = st.art.picture,
    again = p && p.photo && p.photo.raw === photo.raw,
    c = tagged(canvas);
  st.art.picture = {
    canvas: c,
    orig: c,
    label,
    sample: "photo",
    photo,
    turn: again ? p.turn : 0,
    angle: again ? p.angle : 0,
  };
  if (!again) $("picAngle").value = 0;
  if (again && (p.turn || p.angle)) {
    pictureTurn(p.turn, p.angle);
    return;
  }
  const P = UNB.PATTERNS[st.art.pattern.style];
  artUse(st.art.kind === "pattern" && P && P.tone ? "pattern" : "picture");
}
// an example (examples.js): a picture example is the Picture in use even after a pattern drawn from a picture (which
// artUsePicture keeps); a pattern example starts from that style's own settings
function artExamplePicture(key) {
  st.art.picture = { canvas: tagged(makeSample(key)), label: "sample", sample: key };
  $("picAngle").value = 0;
  artUse("picture");
}
function artExamplePattern(style) {
  st.art.pattern = UNB.patternDefaults(style, { seed: 1 });
  st.art.width = null;
  patternControls(st.art.pattern); // patterns.js
  artUse("pattern");
}
// the print's width changed by hand (pipeline.js setSize): a pattern keeps it from now on
function artSized(W) {
  if (st.art.kind === "pattern") st.art.width = W;
  if (st.art.kind === "molecule") st.art.molWidth = W;
  artSizeUI();
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
// made for plotting, the width follows the Plot step's page and the closest lines its pen
for (const id of ["paper", "paperW", "paperH", "paperMargin", "penW", "paperOrient"])
  $(id).addEventListener(id === "paper" || id === "paperOrient" ? "change" : "input", artSizeUI);
$("artPicChoose").addEventListener("click", () => $("picFile").click());
$("artPicFace").addEventListener("click", () => artUsePicture(makeSample("face"), "face sample", "face"));
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
  // a new style starts on the width that fits the needle; the same style keeps a width you set
  if (p.style !== st.art.pattern.style) st.art.width = null;
  st.art.pattern = p;
  $("artVal").textContent = patternName(p);
  if (st.art.kind === "pattern") artApplySoon();
}

// ---------- the Plot step's Art as drawn ----------
// A pattern's or the text's lines exactly as made, in px of their own picture: { W, H, layers: [{ name, pen, strokes
// }], pictures } (one layer, pen 1's colour). A picture or a model has no lines until traced.
function artVectors() {
  const A = st.art,
    pen = $("penColor").value || "#111111";
  // separate strokes (the Line step): the traced strokes, in px of the working image
  if (lineModeNow() === "strokes") {
    const S = st.sepStrokes,
      fills = (S && S.fills) || [];
    if (!S || !(S.strokes.length || fills.length)) return null;
    // the strokes on pen 1, then each filled grey on its own pen (its own layer)
    const layers = S.strokes.length ? [{ name: "strokes", pen, strokes: S.strokes }] : [];
    for (const f of fills)
      if (f.strokes.length)
        layers.push({
          name: `${levelColour() ? "colour" : "grey"} ${f.level + 1} fill`,
          pen: f.color,
          strokes: f.strokes,
        });
    return { W: S.w, H: S.h, layers, pictures: 0 };
  }
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
  if (A.kind === "molecule") {
    const { r, L } = moleculeDrawn();
    if (!r) return null;
    const strokes = r.paths.map((p) => p.map((v) => (v + L.m) * L.s));
    return { W: L.w, H: L.h, layers: [{ name: moleculeName() || "molecule", pen, strokes }], pictures: 0 };
  }
  if (A.kind === "text") {
    const t = textPicture();
    if (!t) return null;
    return { W: t.canvas.width, H: t.canvas.height, layers: [{ name: "text", pen, strokes: t.strokes }], pictures: 0 };
  }
  return A.kind === "picture" ? { W: 1, H: 1, layers: [], pictures: 1 } : null;
}
const asDrawnOK = () => st.art.kind === "pattern" || st.art.kind === "text" || st.art.kind === "molecule";
// a molecule (molecule.js) becomes the input in use; its own size until it's sized by hand
function artUseMolecule(M) {
  st.art.molecule = M;
  st.art.molWidth = null;
  artUse("molecule");
}

// ---------- undo and design files (history.js) ----------
// The art without its picture (kept apart: by reference for undo, as an image in a file). The picture's tag makes a new
// picture a new undo step.
function artSaved() {
  const P = st.art.picture;
  return {
    kind: st.art.kind,
    pattern: { ...st.art.pattern },
    width: st.art.width,
    molecule: st.art.molecule || null,
    molWidth: st.art.molWidth || null,
    picture: P
      ? { label: P.label, sample: P.sample, key: P.canvas.__art, turn: P.turn || 0, angle: P.angle || 0 }
      : null,
  };
}
const artCanvas = () => (st.art.picture ? st.art.picture.canvas : null);
// what undo keeps by reference beside the picture's canvas: the picture as loaded (before its turn) and the photo it
// was cleaned from
function artPicMore() {
  const P = st.art.picture;
  return P ? { orig: P.orig || null, photo: P.photo || null, turn: P.turn || 0, angle: P.angle || 0 } : null;
}
// Put saved art back (pic: the picture's canvas; more: artPicMore's, from undo). A v101 design (layers) comes back as
// the top shown layer it had. A design file has no picture as loaded: the turned picture it saved is the one loaded.
function artRestore(a, pic, more) {
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
    // (a design saved before v104 keeps its detail, twist, sides and shape: the keys are the same)
    pattern: UNB.patternDefaults(a.pattern && UNB.PATTERNS[a.pattern.style] ? a.pattern.style : "labyrinth", a.pattern),
    width: a.width || null,
    molecule: a.molecule || null,
    molWidth: a.molWidth || null,
    picture: pic
      ? {
          canvas: pic.__art ? pic : tagged(pic),
          label: (a.picture && a.picture.label) || "picture",
          sample: (a.picture && a.picture.sample) || "user",
          ...(more && more.orig ? { orig: more.orig, turn: more.turn, angle: more.angle } : {}),
          ...(more && more.photo ? { photo: more.photo } : {}),
        }
      : null,
  };
  const P = st.art.picture;
  pictureTurnUI((P && P.turn) || 0, (P && P.angle) || 0);
  if (typeof moleculeUI === "function") moleculeUI(); // molecule.js: the Molecule card's box and message
}
// a design from before the Art step (v100 and older): its source as it was
function artFromOld(kind, canvas, label, pattern) {
  const pat = pattern && UNB.PATTERNS[pattern.style];
  st.art = {
    kind: kind === "model" ? "model" : kind === "text" ? "text" : pat ? "pattern" : "picture",
    pattern: Object.assign(
      { style: "labyrinth", detail: 12, twist: 30, sides: 4, shape: "square", seed: 1 },
      pat ? pattern : {}
    ),
    picture: canvas ? { canvas: tagged(canvas), label: label || "picture", sample: "user" } : null,
    width: null,
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
      : A.kind === "molecule"
        ? moleculeName()
        : A.kind === "picture"
          ? (A.picture && A.picture.label) || ""
          : A.kind === "model"
            ? (st.model && st.model.name) || ""
            : "";
  if (A.picture) {
    $("picVal").textContent = A.picture.label;
    const t = A.picture.turn || 0,
      a = A.picture.angle || 0;
    $("picAngle").value = a;
    $("picAngleVal").textContent = `${a > 0 ? "+" : ""}${a}°` + (t ? ` · ${t * 90}° turned` : "");
  }
  patternControls(A.pattern); // patterns.js
  const PT = UNB.PATTERNS[A.pattern.style];
  $("artPicRow").hidden = !(PT && PT.tone);
  $("artPicName").textContent = tonePicture().label;
  artSizeUI();
  $("fromArt").textContent = {
    picture: "The picture, traced into one line.",
    text: "The text, traced from its font's strokes.",
    pattern: `The ${patternName(A.pattern)} pattern, traced into one line.`,
    molecule: `${moleculeName() || "The molecule"}, traced into one line.`,
    model: "A 3D model: it is sliced on the Print step.",
  }[A.kind];
  workflowUI(); // workflow.js: what the Line step can do with this input
  if (typeof photoUI === "function") photoUI(); // camera.js: the Photo card
  emptyUI(); // examples.js: the empty preview, until there's something to start from
}
// ---------- the picture turned: quarter turns and a few degrees to straighten, from the picture as loaded ----------
function turnedCanvas(src, deg) {
  const a = (deg * Math.PI) / 180,
    c = Math.abs(Math.cos(a)),
    s = Math.abs(Math.sin(a));
  const w = Math.round(src.width * c + src.height * s),
    h = Math.round(src.width * s + src.height * c),
    out = document.createElement("canvas");
  out.width = Math.max(1, w);
  out.height = Math.max(1, h);
  const g = out.getContext("2d");
  g.fillStyle = "#ffffff"; // the corners that come in are paper
  g.fillRect(0, 0, w, h);
  g.translate(w / 2, h / 2);
  g.rotate(a);
  g.drawImage(src, -src.width / 2, -src.height / 2);
  return out;
}
let turnTimer = null;
function pictureTurnUI(t, a) {
  $("picAngle").value = a;
  $("picAngleVal").textContent = `${a > 0 ? "+" : ""}${a}°` + (t ? ` · ${t * 90}° turned` : "");
}
function pictureTurn(turn, angle) {
  const p = st.art.picture;
  if (!p) return;
  const orig = p.orig || p.canvas,
    t = (((turn ?? p.turn ?? 0) % 4) + 4) % 4,
    a = angle ?? p.angle ?? 0;
  const c = t || a ? turnedCanvas(orig, t * 90 + a) : orig;
  st.art.picture = { ...p, canvas: c === orig ? orig : tagged(c), orig, turn: t, angle: a };
  pictureTurnUI(t, a);
  const P = UNB.PATTERNS[st.art.pattern.style];
  artUse(st.art.kind === "pattern" && P && P.tone ? "pattern" : "picture");
  recordSoon();
}
$("picLeft").addEventListener("click", () => pictureTurn(((st.art.picture && st.art.picture.turn) || 0) + 3));
$("picRight").addEventListener("click", () => pictureTurn(((st.art.picture && st.art.picture.turn) || 0) + 1));
$("picUnturn").addEventListener("click", () => {
  $("picAngle").value = 0;
  pictureTurn(0, 0);
});
$("picAngle").addEventListener("input", () => {
  $("picAngleVal").textContent = `${+$("picAngle").value > 0 ? "+" : ""}${+$("picAngle").value}°`;
  clearTimeout(turnTimer);
  turnTimer = setTimeout(() => pictureTurn(undefined, +$("picAngle").value), 200);
});

// the picture card
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
document.querySelectorAll('input[name="artFor"]').forEach((r) =>
  r.addEventListener("change", () => {
    patternControls(st.art.pattern); // patterns.js: the ranges for this use
    patternEdited(patternNow());
    if (st.art.kind !== "pattern") artUI();
    recordSoon();
  })
);
for (const id of ["backLine", "backLine2"])
  $(id).addEventListener("click", () => {
    $("viewDesign").checked = true;
    viewChanged();
  });
$("toArt").addEventListener("click", () => {
  $("viewArt").checked = true;
  viewChanged();
});
