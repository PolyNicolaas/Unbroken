// Unbroken · web app · art.js
// The Art tab: where everything comes in. The art is a stack of layers (bottom first), each a source (a picture, the
// text, a pattern or a 3D model) with a pen colour and a place in the art's frame. What the shown layers make is handed
// to the trace (useSource, source.js): a 3D model on its own, a text layer on its own, or otherwise every layer drawn
// into one picture. The Art view (the big view's Art tab) shows the layers in their pens' colours, and the 2D tab can
// plot the art's lines as drawn, without tracing (plot.js, artVectors).
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// st.art = { layers: [layer, …] bottom first, sel: id of the chosen layer }
// layer = { id, kind: "picture" | "text" | "pattern" | "model", name, on (shown), pen (#rrggbb),
//           place: { s (size %), x, y (% of the frame across and down) },
//           picture: { canvas, sample } | pattern: { style, detail, twist, sides, shape, seed } }
// There is at most one text layer (the Text card's controls are its settings) and one model layer (st.model).
st.art = { layers: [], sel: 0 };
let layerSeq = 0;
const ART_LONG = 1600; // px: the long side a pattern is drawn at (UNB.patternLayout)
const ART_MAX = 2400; // px: the art is drawn at most this big on its long side
const KIND_LABEL = { picture: "Picture", text: "Text", pattern: "Pattern", model: "3D model" };
const layerById = (id) => st.art.layers.find((l) => l.id === id);
const selLayer = () => layerById(st.art.sel) || st.art.layers[st.art.layers.length - 1] || null;
const placed = (L) => L.place.s !== 100 || L.place.x !== 0 || L.place.y !== 0;
function newLayer(kind, extra) {
  const n = st.art.layers.length;
  return Object.assign(
    {
      id: ++layerSeq,
      kind,
      name: KIND_LABEL[kind],
      on: true,
      pen: n ? PEN_COLORS[n % PEN_COLORS.length] : $("penColor").value || PEN_COLORS[0],
      place: { s: 100, x: 0, y: 0 },
    },
    extra || {}
  );
}
function patternName(p) {
  const P = UNB.PATTERNS[p.style];
  return P ? P.label + (P.shape && p.shape && p.shape !== "square" ? ` · ${p.shape}` : "") : "Pattern";
}

// ---------- each layer as a drawing: its own size, and how to draw it ----------
// { w, h, vec: [{ pts: [x, y, …], closed }] (its lines, px), lw (their width, px), canvas (a picture's own) }
const artCache = new WeakMap();
function layerArt(L) {
  const key =
    L.kind === "pattern"
      ? JSON.stringify(L.pattern)
      : L.kind === "text"
        ? textKey()
        : L.kind === "picture"
          ? L.picture.canvas && L.picture.canvas.__art
          : "";
  const c = artCache.get(L);
  if (c && c.key === key) return c.art;
  let art = null;
  if (L.kind === "picture" && L.picture.canvas) {
    const cv = L.picture.canvas;
    art = { w: cv.width, h: cv.height, canvas: cv, vec: [] };
  } else if (L.kind === "pattern") {
    const r = UNB.pattern(L.pattern.style, L.pattern);
    if (r) {
      const Ly = UNB.patternLayout(r, ART_LONG),
        T = (v, i) => (v + Ly.m) * Ly.s;
      art = {
        w: Ly.w,
        h: Ly.h,
        lw: Ly.lineWidth,
        r,
        vec: r.paths.map((p, i) => ({ pts: p.map(T), closed: r.closed[i] })),
      };
    }
  } else if (L.kind === "text") {
    const t = textPicture();
    if (t)
      art = { w: t.canvas.width, h: t.canvas.height, lw: t.lw, vec: t.strokes.map((pts) => ({ pts, closed: false })) };
  }
  artCache.set(L, { key, art });
  return art;
}
// what the text's drawing depends on (the Text card's controls and the line spacing)
const textKey = () =>
  JSON.stringify(
    ["textIn", "font", "capH", "txtSpacing", "letterGap", "wordGap", "lineGap"]
      .map((id) => $(id).value)
      .concat([document.querySelector('input[name="align"]:checked').value, spacingMM(), lineWidthMM()])
  );

// ---------- the frame, and where each layer sits in it ----------
// The bottom shown layer sets the frame (its own size, at most ART_MAX on the long side); every other layer is fitted
// inside it, then sized and moved by its Placement (the bottom one too, about the middle).
function artFrame(layers) {
  const base = layers.map(layerArt).find(Boolean);
  if (!base) return null;
  const k = Math.min(1, ART_MAX / Math.max(base.w, base.h));
  return { W: Math.round(base.w * k), H: Math.round(base.h * k) };
}
// layer L's own px → frame px: x' = ox + k·x
function layerFit(L, A, F) {
  const k0 = Math.min(F.W / A.w, F.H / A.h),
    k = (k0 * L.place.s) / 100;
  return {
    k,
    ox: F.W / 2 + (L.place.x / 100) * F.W - (A.w * k) / 2,
    oy: F.H / 2 + (L.place.y / 100) * F.H - (A.h * k) / 2,
  };
}
const shownLayers = () => st.art.layers.filter((l) => l.on && l.kind !== "model");
// Draw the shown layers into g (frame px): pictures as they are, lines in black, or in their pens' colours (colour).
// Layers are multiplied in, so a picture's white background doesn't hide what's under it.
function paintArt(g, F, colour, layers = shownLayers()) {
  g.save();
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, F.W, F.H);
  g.globalCompositeOperation = "multiply";
  for (const L of layers) {
    const A = layerArt(L);
    if (!A) continue;
    const { k, ox, oy } = layerFit(L, A, F);
    if (A.canvas) {
      g.imageSmoothingEnabled = true;
      g.drawImage(A.canvas, ox, oy, A.w * k, A.h * k);
      continue;
    }
    g.strokeStyle = colour ? L.pen : "#000000";
    g.lineWidth = Math.max(1, A.lw * k);
    g.lineCap = g.lineJoin = "round";
    for (const v of A.vec) {
      g.beginPath();
      for (let i = 0; i < v.pts.length; i += 2) {
        const x = ox + v.pts[i] * k,
          y = oy + v.pts[i + 1] * k;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      if (v.pts.length === 2) g.lineTo(ox + v.pts[0] * k + 0.1, oy + v.pts[1] * k);
      if (v.closed) g.closePath();
      g.stroke();
    }
  }
  g.restore();
}
// the art as one picture to trace
function artPicture() {
  const layers = shownLayers(),
    F = artFrame(layers);
  if (!F) return null;
  const c = document.createElement("canvas");
  c.width = F.W;
  c.height = F.H;
  paintArt(c.getContext("2d"), F, false, layers);
  return c;
}
// The art's lines as drawn, for the 2D tab (plot.js): per shown layer with lines, its pen and its strokes in frame px;
// pictures have no lines until they're traced, so they're counted apart. null without anything shown.
function artVectors() {
  const layers = shownLayers(),
    F = artFrame(layers);
  if (!F) return null;
  const out = { W: F.W, H: F.H, layers: [], pictures: 0 };
  for (const L of layers) {
    const A = layerArt(L);
    if (!A) continue;
    if (A.canvas) {
      out.pictures++;
      continue;
    }
    const { k, ox, oy } = layerFit(L, A, F),
      strokes = A.vec.map((v) => {
        const p = v.pts.map((t, i) => (i % 2 ? oy + t * k : ox + t * k));
        if (v.closed && p.length > 4) p.push(p[0], p[1]);
        return p;
      });
    out.layers.push({ id: L.id, name: L.name, pen: L.pen, strokes });
  }
  return out;
}

// ---------- handing the art to the trace ----------
// model: a shown 3D model, on its own. text: the text layer alone, where it is. Otherwise the shown layers drawn as one
// picture (a single picture layer where it is: its own image, untouched).
function artMode() {
  const V = st.art.layers.filter((l) => l.on);
  if (V.some((l) => l.kind === "model")) return "model";
  if (V.length === 1 && V[0].kind === "text" && !placed(V[0])) return "text";
  return "picture";
}
let applyTimer = null;
function artApplySoon(delay = 250) {
  clearTimeout(applyTimer);
  applyTimer = setTimeout(artApply, delay);
}
function artApply() {
  clearTimeout(applyTimer);
  const mode = artMode(),
    V = shownLayers();
  if (mode === "model") useSource("model");
  else if (mode === "text") useSource("text");
  else {
    const one = V.length === 1 ? V[0] : null,
      c = one && one.kind === "picture" && !placed(one) ? one.picture.canvas : artPicture();
    if (c) {
      if (one && one.kind === "pattern") {
        // a pattern on its own is traced as drawn: centreline, and the closed or open line it is
        const P = UNB.PATTERNS[one.pattern.style];
        $("modeCenter").checked = true;
        $("invert").checked = false;
        $(P.line === "open" ? "loopOpen" : "loopClosed").checked = true;
        labels();
      }
      useSource("picture", c, V.map((l) => l.name).join(" + ") || "art");
      // a pattern with an even gap starts at the width where that gap is the line spacing (a little over), so it
      // prints as drawn and nothing needs pushing apart
      const A = one && one.kind === "pattern" ? layerArt(one) : null;
      if (A && UNB.PATTERNS[one.pattern.style].evenGap && st.spacing > 0 && !placed(one))
        startSize((A.r.box[0] / A.r.gap) * st.spacing * 1.03, A.r.box[0] / Math.max(1e-9, A.r.box[1]));
    } else useSource("picture", blankPicture(), "nothing shown");
  }
  artUI();
}
function blankPicture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, 64, 64);
  return c;
}
// the text changed while it is one of several layers (source.js)
function artTextChanged() {
  if (st.art.layers.some((l) => l.on && l.kind === "text") && artMode() === "picture") artApply();
  else artUI();
}

// ---------- changing the layers ----------
function addLayer(L) {
  st.art.layers.push(L);
  st.art.sel = L.id;
  artApply();
}
// a picture (a file, a sample, a sketch, a model's drawing) goes into the chosen picture layer, or a new one on top
function artUsePicture(canvas, label, sample) {
  canvas.__art = ++layerSeq;
  for (const l of st.art.layers) if (l.kind === "model") l.on = false; // a picture to trace: the model steps aside
  const L = selLayer();
  if (L && L.kind === "picture") {
    L.picture = { canvas, sample: sample || "user" };
    L.name = label;
    L.on = true;
    artApply();
  } else addLayer(newLayer("picture", { name: label, picture: { canvas, sample: sample || "user" } }));
}
// the art as one layer of a kind (start-up, and the lettering preset)
function artOnly(kind, extra) {
  st.art.layers = [];
  const L = newLayer(kind, extra);
  if (kind === "picture" && L.picture && L.picture.canvas) L.picture.canvas.__art = ++layerSeq;
  st.art.layers.push(L);
  st.art.sel = L.id;
  artApply();
}
// Show only the layers of one kind: "text" (the text layer, added if there's none), "picture" (the picture and
// pattern layers; a sample picture if there are none) or "model" (the model layer; the sample vase if there's none).
// The quick way to switch between what was the Trace tab's Image, Text and 3D model.
function artShowOnly(kind) {
  const A = st.art.layers,
    is = (l) => (kind === "picture" ? l.kind === "picture" || l.kind === "pattern" : l.kind === kind);
  if (!A.some(is)) {
    if (kind === "model" && !st.model) setModel(sampleVase(), "sample vase");
    A.push(
      kind === "text"
        ? newLayer("text")
        : kind === "model"
          ? newLayer("model", { name: st.model.name })
          : newLayer("picture", { name: "sample", picture: { canvas: tag(makeSample("leaf")), sample: "leaf" } })
    );
  }
  for (const l of A) l.on = is(l);
  st.art.sel = [...A].reverse().find(is).id;
  artApply();
}
// a 3D model loaded (model.js has made it st.model): into the model layer, shown, or a new one
function artModel(name) {
  let L = st.art.layers.find((l) => l.kind === "model");
  if (!L) {
    L = newLayer("model", { name });
    st.art.layers.push(L);
  }
  L.name = name;
  L.on = true;
  st.art.sel = L.id;
  artApply();
}
// a model's line drawing becomes a picture layer, and the model is hidden so the drawing is what's traced
function artModelDrawing(canvas, label) {
  for (const l of st.art.layers) if (l.kind === "model") l.on = false;
  canvas.__art = ++layerSeq;
  addLayer(newLayer("picture", { name: label, picture: { canvas, sample: "user" } }));
}
$("addPicture").addEventListener("click", () => {
  addLayer(newLayer("picture", { name: "leaf", picture: { canvas: tag(makeSample("leaf")), sample: "leaf" } }));
});
$("addText").addEventListener("click", () => {
  const T = st.art.layers.find((l) => l.kind === "text");
  if (T) {
    T.on = true;
    st.art.sel = T.id;
    return artApply();
  }
  addLayer(newLayer("text", { name: "Text" }));
});
$("addPattern").addEventListener("click", () => {
  const p = {
    style: "labyrinth",
    detail: 12,
    twist: 30,
    sides: 4,
    shape: "square",
    seed: 1 + Math.floor(Math.random() * 99999),
  };
  addLayer(newLayer("pattern", { name: patternName(p), pattern: p }));
});
$("addModel").addEventListener("click", () => {
  if (!st.model) setModel(sampleVase(), "sample vase");
  artModel(st.model.name);
});
const tag = (c) => ((c.__art = ++layerSeq), c);

// the layer list (top first)
function renderLayers() {
  const ol = $("layerList"),
    sel = selLayer();
  ol.textContent = "";
  const L = st.art.layers;
  for (let i = L.length - 1; i >= 0; i--) {
    const l = L[i],
      li = document.createElement("li");
    li.className = "layer" + (sel === l ? " sel" : "") + (l.on ? "" : " off");
    li.dataset.id = l.id;
    li.innerHTML =
      `<button type="button" class="lay-eye" aria-pressed="${l.on}" title="${l.on ? "Shown: tap to hide" : "Hidden: tap to show"}" aria-label="${l.on ? "Hide" : "Show"} ${esc(l.name)}">` +
      `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10Z" fill="none" stroke="currentColor" stroke-width="1.6"/>${l.on ? '<circle cx="10" cy="10" r="2.6" fill="currentColor"/>' : '<path d="M4 16 16 4" stroke="currentColor" stroke-width="1.6"/>'}</svg></button>` +
      `<input type="color" class="lay-pen" value="${l.pen}" aria-label="Pen colour for ${esc(l.name)}" title="Pen colour"${l.kind === "model" ? " hidden" : ""}>` +
      `<button type="button" class="lay-name" aria-pressed="${sel === l}">${esc(l.name)}<small>${KIND_LABEL[l.kind].toLowerCase()}</small></button>` +
      `<button type="button" class="lay-up btn mini" aria-label="Move ${esc(l.name)} up" ${i === L.length - 1 ? "disabled" : ""}>↑</button>` +
      `<button type="button" class="lay-down btn mini" aria-label="Move ${esc(l.name)} down" ${i === 0 ? "disabled" : ""}>↓</button>` +
      `<button type="button" class="lay-del btn mini" aria-label="Remove ${esc(l.name)}" ${L.length === 1 ? "disabled" : ""}>×</button>`;
    ol.appendChild(li);
  }
}
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
$("layerList").addEventListener("click", (e) => {
  const li = e.target.closest("li.layer");
  if (!li) return;
  const L = layerById(+li.dataset.id),
    A = st.art.layers,
    i = A.indexOf(L);
  if (e.target.closest(".lay-eye")) {
    L.on = !L.on;
    artApply();
  } else if (e.target.closest(".lay-up") && i < A.length - 1) {
    [A[i], A[i + 1]] = [A[i + 1], A[i]];
    artApply();
  } else if (e.target.closest(".lay-down") && i > 0) {
    [A[i], A[i - 1]] = [A[i - 1], A[i]];
    artApply();
  } else if (e.target.closest(".lay-del") && A.length > 1) {
    A.splice(i, 1);
    if (st.art.sel === L.id) st.art.sel = A[Math.min(i, A.length - 1)].id;
    artApply();
  } else if (e.target.closest(".lay-name")) {
    st.art.sel = L.id;
    artUI();
    recordSoon();
  }
});
$("layerList").addEventListener("input", (e) => {
  if (!e.target.classList.contains("lay-pen")) return;
  const L = layerById(+e.target.closest("li.layer").dataset.id);
  L.pen = e.target.value;
  drawArtView();
  if (plotFromArt()) drawPage();
  recordSoon();
});

// ---------- undo and design files (history.js) ----------
// the art without its pictures (they're kept apart: by reference for undo, as images in a file); a picture is named by
// its canvas's tag, so a new picture makes a new undo step
function artSaved() {
  return {
    sel: st.art.sel,
    layers: st.art.layers.map((l) =>
      Object.assign(
        {},
        l,
        l.picture ? { picture: { sample: l.picture.sample, key: l.picture.canvas && l.picture.canvas.__art } } : {}
      )
    ),
  };
}
const artCanvases = () => new Map(st.art.layers.filter((l) => l.picture).map((l) => [l.id, l.picture.canvas]));
// put saved art back, with its pictures (pics: layer id → canvas); the source on screen is put back by history.js
function artRestore(a, pics) {
  st.art = {
    sel: a.sel,
    layers: a.layers.map((l) =>
      Object.assign(
        structuredClone(l),
        l.picture ? { picture: { sample: l.picture.sample, canvas: pics.get(l.id) || blankPicture() } } : {}
      )
    ),
  };
  for (const l of st.art.layers) {
    layerSeq = Math.max(layerSeq, l.id);
    if (l.picture && !l.picture.canvas.__art) l.picture.canvas.__art = ++layerSeq;
  }
}
// a design from before the Art tab: one layer, as its source was (a picture, a pattern it was made from, the text, or
// a 3D model with the picture it had under it, hidden)
function artFromOld(kind, canvas, label, pattern) {
  st.art = { layers: [], sel: 0 };
  if (kind === "model" && canvas)
    st.art.layers.push(
      newLayer("picture", { name: "picture", on: false, picture: { canvas: tag(canvas), sample: "user" } })
    );
  const L =
    kind === "model"
      ? newLayer("model", { name: (st.model && st.model.name) || "3D model" })
      : kind === "text"
        ? newLayer("text", { name: "Text" })
        : pattern && UNB.PATTERNS[pattern.style]
          ? newLayer("pattern", {
              name: patternName(pattern),
              pattern: Object.assign({ twist: 0, sides: 4, shape: "square", seed: 1 }, pattern),
            })
          : newLayer("picture", {
              name: label || "picture",
              picture: { canvas: tag(canvas || blankPicture()), sample: "user" },
            });
  st.art.layers.push(L);
  st.art.sel = L.id;
}

// ---------- the chosen layer's cards ----------
function artUI() {
  const L = selLayer();
  document.body.dataset.layer = L ? L.kind : "";
  renderLayers();
  const n = st.art.layers.length,
    shown = st.art.layers.filter((l) => l.on).length;
  $("layersVal").textContent = `${n} layer${n === 1 ? "" : "s"}${shown < n ? ` · ${shown} shown` : ""}`;
  if (L && L.kind === "picture") {
    $("sample").value = [...$("sample").options].some((o) => o.value === L.picture.sample) ? L.picture.sample : "user";
    $("picVal").textContent = L.name;
  }
  if (L && L.kind === "pattern") patternControls(L.pattern); // patterns.js
  if (L) {
    $("placeSize").value = L.place.s;
    $("placeX").value = L.place.x;
    $("placeY").value = L.place.y;
  }
  placeUI();
  const mode = artMode();
  $("fromArt").textContent =
    mode === "model"
      ? "A 3D model: it is sliced on the 3D tab. Hide it in the Art tab to trace the other layers."
      : mode === "text"
        ? "The text, traced from its font's strokes."
        : `${shownLayers().length > 1 ? `${shownLayers().length} layers drawn as one picture` : "The picture"}, traced into one line.`;
  $("layerMsg").textContent =
    mode === "model" && st.art.layers.some((l) => l.on && l.kind !== "model")
      ? "A shown 3D model prints on its own: the other layers wait until it's hidden."
      : "";
  $("goPlot").disabled = mode === "model";
  drawArtView();
}
function placeUI() {
  const L = selLayer(),
    p = L ? L.place : { s: 100, x: 0, y: 0 };
  $("placeSizeVal").textContent = `${p.s}%`;
  $("placeXVal").textContent = p.x ? `${p.x > 0 ? "+" : ""}${p.x}%` : "centre";
  $("placeYVal").textContent = p.y ? `${p.y > 0 ? "+" : ""}${p.y}%` : "centre";
  $("placeVal").textContent = L && placed(L) ? `${p.s}%` : "as drawn";
}
for (const [id, k] of [
  ["placeSize", "s"],
  ["placeX", "x"],
  ["placeY", "y"],
])
  $(id).addEventListener("input", () => {
    const L = selLayer();
    if (!L) return;
    L.place[k] = +$(id).value;
    placeUI();
    drawArtView();
    artApplySoon();
  });
$("placeReset").addEventListener("click", () => {
  const L = selLayer();
  if (!L || !placed(L)) return;
  L.place = { s: 100, x: 0, y: 0 };
  artApply();
});
// a pattern's control moved (patterns.js)
function patternEdited(p) {
  const L = selLayer();
  if (!L || L.kind !== "pattern") return;
  L.pattern = p;
  L.name = patternName(p);
  renderLayers();
  drawArtView();
  artApplySoon();
}
// the picture card
$("sample").addEventListener("change", () => {
  const v = $("sample").value;
  if (v !== "user") artUsePicture(makeSample(v), "sample", v);
});
$("picChoose").addEventListener("click", () => $("picFile").click());
$("picFile").addEventListener("change", () => {
  loadFile($("picFile").files[0]); // controls.js: into this picture layer
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

// ---------- the Art view ----------
// the shown layers in their pens' colours on white, the chosen one outlined; a 3D model shows in the Line view
function drawArtView() {
  const cv = $("artView");
  // (views.js and zoom.js load after this file: a resize can come before them)
  if (typeof stageNow !== "function" || typeof zoomOn !== "function" || stageNow() !== "art") return;
  const layers = shownLayers(),
    F = artFrame(layers) || { W: 400, H: 300 };
  cv.style.aspectRatio = `${F.W} / ${F.H}`;
  cv.style.setProperty("--ar", F.W / F.H);
  const fit = fitCanvas(cv);
  if (!fit) return;
  const g = cv.getContext("2d"),
    s = cv.width / F.W;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = css("--paper");
  g.fillRect(0, 0, cv.width, cv.height);
  const z = zoomOn(g, "art", cv); // zoom.js
  g.transform(s, 0, 0, s, 0, 0);
  if (layers.length) paintArt(g, F, true, layers);
  else {
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, F.W, F.H);
  }
  const L = selLayer(),
    A = L && L.on && L.kind !== "model" ? layerArt(L) : null;
  if (A) {
    const { k, ox, oy } = layerFit(L, A, F);
    g.strokeStyle = css("--accent");
    g.lineWidth = (1.5 * fit.dpr) / s / z.z;
    g.setLineDash([(5 * fit.dpr) / s / z.z, (4 * fit.dpr) / s / z.z]);
    g.strokeRect(ox, oy, A.w * k, A.h * k);
    g.setLineDash([]);
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (artMode() === "model" || !layers.length) {
    g.fillStyle = css("--muted");
    g.textAlign = "center";
    g.font = `${13 * fit.dpr}px ${css("--font-body")}`;
    g.fillText(
      artMode() === "model"
        ? "The 3D model shows in the Line view (drag it there to look round it)."
        : "No layer shown.",
      cv.width / 2,
      cv.height / 2
    );
  }
}
new ResizeObserver(() => drawArtView()).observe($("artView"));
