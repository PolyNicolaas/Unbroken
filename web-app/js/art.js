// Unbroken · web app · art.js
// The Art step: where everything comes in, one thing at a time. The Input switch picks what the trace starts from: a
// picture, the text, a geometric pattern or a 3D model. Each keeps its own settings while another is in use, so
// switching back finds it as it was. artApply hands the one in use to the trace (useSource, source.js). A pattern or
// the text can also go to the Plot step exactly as drawn, without tracing (artVectors, for plot.js).
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// st.art = { kind: "picture" | "text" | a kind a feature added (state.js ART_KINDS: a pattern, a molecule, a 3D model),
//            picture: { canvas, label, sample } (the last picture: a sample, an image of yours, a sketch, a model's
//              drawing; the patterns drawn from a picture use it too), and what each added kind keeps of its own }
// The text's settings are the Text card's controls.
st.art = { kind: "picture", picture: null };
const ART_LONG = 1600; // px: the long side a drawing of exact lines is laid out at (UNB.patternLayout)
// the Input switch's radio for a kind (none: a kind this app doesn't have, its feature being off)
const kindRadio = (k) => (ART_KINDS[k] ? ART_KINDS[k].radio : { picture: "srcImage", text: "srcText" }[k]);
// a new picture becomes the Picture in use, unless the kind in use draws from the picture (it stays, and draws it)
const artKeepKind = () => (artKind() && artKind().keepsPicture && artKind().keepsPicture() ? st.art.kind : "picture");
let artSeq = 0; // tags each picture canvas, so undo can tell a new picture from the same one

// a drawing of exact lines (a pattern, a molecule: { r, L }) as a picture to trace: black strokes on white
function linesPicture(D) {
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
// A kind whose line is As drawn (the Line step, workflow.js) isn't traced at all: its exact lines go to the page.
function artApply() {
  clearTimeout(applyTimer);
  const A = st.art;
  if (!kindRadio(A.kind)) A.kind = "picture"; // (a kind whose feature is off: the picture instead)
  const K = artKind();
  $(kindRadio(A.kind)).checked = true;
  document.body.dataset.art = A.kind;
  lineDefault(); // workflow.js: the line that suits this input, until one is picked
  A.untraced = asDrawnOK() && lineModeNow() === "drawn";
  if (A.untraced) {
    $("artMsg").textContent = (K && K.nothing && K.nothing()) || "";
    ask("lineReady", 0); // (the preview shows the page, the art as drawn: workflow.js)
  } else if (K) K.apply(A);
  else if (A.kind === "text") useSource("text");
  else {
    // no picture yet: a blank page to trace (the preview shows how to start)
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
  artUse(artKeepKind());
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
  artUse(artKeepKind());
}
// an example: a picture example is the Picture in use even after a pattern drawn from a picture (which
// artUsePicture keeps); a pattern example starts from that style's own settings
function artExamplePicture(key) {
  st.art.picture = { canvas: tagged(makeSample(key)), label: "sample", sample: key };
  $("picAngle").value = 0;
  artUse("picture");
}
// the print's width changed by hand (pipeline.js setSize): the kind in use keeps it from now on
function artSized(W) {
  const K = artKind();
  if (K && K.sized) K.sized(W);
  ask("sized");
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
          name: `${answer("levelWord") || "grey"} ${f.level + 1} fill`,
          pen: f.color,
          strokes: f.strokes,
        });
    return { W: S.w, H: S.h, layers, pictures: 0 };
  }
  if (artKind()) return artKind().vectors ? artKind().vectors(pen) : null;
  if (A.kind === "text") {
    const t = textPicture();
    if (!t) return null;
    return { W: t.canvas.width, H: t.canvas.height, layers: [{ name: "text", pen, strokes: t.strokes }], pictures: 0 };
  }
  return A.kind === "picture" ? { W: 1, H: 1, layers: [], pictures: 1 } : null;
}
// its exact lines can go to the page without a trace: the text, or a kind that says so (a pattern, a molecule)
const asDrawnOK = () => st.art.kind === "text" || !!(artKind() && artKind().drawnOK);

// ---------- undo and design files (history.js) ----------
// The art without its picture (kept apart: by reference for undo, as an image in a file). The picture's tag makes a new
// picture a new undo step.
function artSaved() {
  const P = st.art.picture;
  return {
    kind: st.art.kind,
    ...Object.assign({}, ...ask("artSave")), // what each added kind keeps (a pattern's settings, a molecule)
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
    kind: kindRadio(a.kind) ? a.kind : "picture",
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
  ask("artRestore", a); // what each added kind kept
}
// a design from before the Art step (v100 and older): its source as it was
function artFromOld(kind, canvas, label, pattern) {
  const pat = pattern && UNB.PATTERNS[pattern.style] && ART_KINDS.pattern,
    k = kind === "model" ? "model" : kind === "text" ? "text" : pat ? "pattern" : "picture";
  st.art = {
    kind: kindRadio(k) ? k : "picture",
    picture: canvas ? { canvas: tagged(canvas), label: label || "picture", sample: "user" } : null,
  };
  ask("artRestore", {
    pattern: { style: "labyrinth", detail: 12, twist: 30, sides: 4, shape: "square", seed: 1, ...(pat ? pattern : {}) },
  });
}

// ---------- the cards ----------
function artUI() {
  const A = st.art;
  document.body.dataset.art = A.kind;
  const K = artKind();
  $(kindRadio(A.kind)).checked = true;
  $("inputVal").textContent = K ? K.name() || "" : A.kind === "picture" ? (A.picture && A.picture.label) || "" : "";
  if (A.picture) {
    $("picVal").textContent = A.picture.label;
    const t = A.picture.turn || 0,
      a = A.picture.angle || 0;
    $("picAngle").value = a;
    $("picAngleVal").textContent = `${a > 0 ? "+" : ""}${a}°` + (t ? ` · ${t * 90}° turned` : "");
  }
  $("fromArt").textContent = K
    ? K.note()
    : A.kind === "text"
      ? "The text, traced from its font's strokes."
      : "The picture, traced into one line.";
  workflowUI(); // workflow.js: what the Line step can do with this input
  ask("artUI", A); // each feature's own cards follow (the Pattern card, the Photo card)
  emptyUI(); // the empty preview, until there's something to start from
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
  artUse(artKeepKind());
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
document.querySelectorAll('input[name="artFor"]').forEach((r) =>
  r.addEventListener("change", () => {
    artUI();
    recordSoon();
  })
);

// ---------- a clean start, and the examples ----------
// The app opens empty (the Art step's preview says how to start) unless settings.js names a sample (defaults.sample)
// or the page's address does (?example=leaf: the tests start that way). The examples are a tray on the map (map.js);
// each becomes the input in use just as choosing it by hand would. The pictures and the lettering are added here;
// a pattern, a molecule, a model and the vase by their own scripts (state.js addExample).
addExample(10, "leaf", "Leaf", "a line drawing", () => artExamplePicture("leaf"));
addExample(20, "still", "Still life", "flat greys: try Grey levels", () => artExamplePicture("still"));
addExample(30, "face", "Face", "soft greys: try a picture pattern", () => artExamplePicture("face"));
addExample(40, "shapes", "Shapes & text", "outlines and letters", () => artExamplePicture("shapes"));
addExample(50, "smiley", "Smiley", "a simple drawing", () => artExamplePicture("smiley"));
addExample(90, "lettering", "Lettering", "text in a single-stroke font", () => artUse("text"));
function useExample(key) {
  const e = EXAMPLES.find((x) => x.key === key);
  if (!e) return false;
  e.use();
  return true;
}
$("esChoose").addEventListener("click", () => $("anyFile").click());

// Empty: the Art step's Picture with no picture yet. The preview says how to start; the trace has nothing to do.
const isEmpty = () => st.art.kind === "picture" && !st.art.picture;
function emptyUI() {
  const e = isEmpty(),
    was = document.body.dataset.empty === "1";
  document.body.dataset.empty = e ? "1" : "";
  $("emptyState").hidden = !e;
  // the readout and the Trace note were set while it was empty (an opened design, the art as drawn): again, now
  if (was && !e && typeof workflowUI === "function") workflowUI(); // workflow.js (not loaded yet at the start)
}
// a blank page to trace while empty (so the steps after Art show nothing, not the last input)
function blankPicture() {
  const c = document.createElement("canvas");
  c.width = 400;
  c.height = 300;
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 400, 300);
  return c;
}
// the start: a sample named in settings.js, or one in the page's address, or empty
function startInput() {
  const named = CFG.defaults.sample && CFG.defaults.sample !== "none" ? CFG.defaults.sample : null,
    asked = new URLSearchParams(location.search).get("example");
  let key = named || asked || "";
  if (key === "vase") key = "skull"; // (the sample was a plain vase until v124)
  // an example that isn't a picture to trace (a model, a vase) starts as from empty: the blank picture first (the
  // design's saved image, and undo, need a source)
  if ((EXAMPLES.find((x) => x.key === key) || {}).blank) artUse("picture");
  if (useExample(key)) return;
  artUse("picture"); // empty: no picture yet
}
