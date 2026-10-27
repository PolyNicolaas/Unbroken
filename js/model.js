// Unbroken · web app · model.js
// 3D models as a source: load an STL (or the sample vase), turn it to the side it should print on, look at it in the
// preview, and hand it to the Print step, where it is sliced and every layer is fitted with a Fourier series
// (layers.js).
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// ---------- the model ----------
// st.model = { name, tri (as loaded), turns { x, y, z } (quarter turns), om (UNB.orientMesh: standing on z = 0,
// centred), heightMM (the whole model's height; it is scaled evenly to it), cut { bottom, top } (the share of that
// height cut off below and above, 0–0.95 together: only the part between is printed), yaw, pitch (preview only), id }
const MODEL_TOL = 0.05; // mm: each layer's series keeps 95% of the slice within this
let modelSeq = 0;
st.model = null;

function sampleVase() {
  // a 40 mm vase with a wavy side, as triangles
  const segs = 96,
    prof = [[0, 0]];
  for (let i = 0; i <= 40; i++) {
    const z = i;
    prof.push([11 + 4 * Math.sin(z / 6.5) + 2.5 * Math.sin(z / 2.2) * (z / 40), z]);
  }
  prof.push([0, 40]);
  const T = [];
  for (let i = 0; i < segs; i++) {
    const a0 = (2 * Math.PI * i) / segs,
      a1 = (2 * Math.PI * (i + 1 === segs ? 0 : i + 1)) / segs;
    for (let k = 0; k + 1 < prof.length; k++) {
      const [r0, z0] = prof[k],
        [r1, z1] = prof[k + 1],
        P = (r, z, a) => [r * Math.cos(a), r * Math.sin(a), z];
      const A = P(r0, z0, a0),
        B = P(r0, z0, a1),
        C = P(r1, z1, a1),
        D = P(r1, z1, a0);
      T.push(...A, ...B, ...C, ...A, ...C, ...D);
    }
  }
  return { tri: Float32Array.from(T), n: T.length / 9 };
}
function setModel(mesh, name) {
  const om = UNB.orientMesh(mesh.tri, {});
  st.model = {
    name,
    tri: mesh.tri,
    n: mesh.n,
    turns: { x: 0, y: 0, z: 0 },
    om,
    heightMM: fitHeight(om.size),
    cut: { bottom: 0, top: 0 },
    yaw: -0.6,
    pitch: 0.55,
    id: ++modelSeq,
  };
  modelChanged(true);
}
// a starting height: the model's own (STL units are mm), kept on the plate and under the printer's build height
function fitHeight(size) {
  const [w, d, h] = size;
  if (!(h > 0)) return 10;
  let k = 1;
  k = Math.min(k, (0.9 * BED.w) / Math.max(w, 1e-6), (0.9 * BED.h) / Math.max(d, 1e-6));
  if (CFG.printer.buildHeight) k = Math.min(k, (0.9 * CFG.printer.buildHeight) / h);
  if (h * k < 3) k = 3 / h; // tiny models (or ones in metres) come up to a printable size
  return +(h * k).toFixed(1);
}
const modelScale = () => (st.model ? st.model.heightMM / Math.max(st.model.om.size[2], 1e-9) : 1); // mm per model unit
// Cutting: the share of the model's height cut off at the bottom and the top, and what is left to print (mm)
const modelCut = () => (st.model && st.model.cut) || { bottom: 0, top: 0 };
const printedMM = () => (st.model ? st.model.heightMM * (1 - modelCut().bottom - modelCut().top) : 0);
// the printed height (mm), from the Height field on the Print step: the model is scaled so the part left after cutting
// is
// that tall
function setModelHeight(H) {
  const c = modelCut();
  st.model.heightMM = Math.min(500, Math.max(0.5, H)) / Math.max(0.05, 1 - c.bottom - c.top);
  modelChanged(true);
}
// the Cut boxes (mm at the current size): a cut moves with the model when it's scaled, and is cleared when it's turned
function cutUI() {
  const M = st.model;
  if (!M) return;
  const c = modelCut();
  for (const [id, k] of [
    ["cutBottom", "bottom"],
    ["cutTop", "top"],
  ])
    if (document.activeElement !== $(id)) $(id).value = +(c[k] * M.heightMM).toFixed(1);
  $("cutInfo").textContent =
    c.bottom || c.top ? `prints ${fmt(printedMM(), 1)} of ${fmt(M.heightMM, 1)} mm` : `${fmt(M.heightMM, 1)} mm, whole`;
}
for (const [id, k] of [
  ["cutBottom", "bottom"],
  ["cutTop", "top"],
])
  $(id).addEventListener("change", () => {
    const M = st.model;
    if (!M) return;
    const other = modelCut()[k === "top" ? "bottom" : "top"],
      f = Math.max(0, +$(id).value || 0) / M.heightMM;
    M.cut = Object.assign({}, modelCut(), { [k]: Math.min(f, 0.95 - other) }); // at least 5% of the model is left
    modelChanged(true);
  });
function modelChanged(record) {
  const M = st.model;
  if (!M) return;
  const [w, d, h] = M.om.size.map((v) => v * modelScale());
  $("modelInfo").textContent = `${M.n.toLocaleString()} triangles · ${fmt(w, 1)} × ${fmt(d, 1)} × ${fmt(h, 1)} mm`;
  cutUI();
  st.srcLabel = M.name;
  $("srcinfo").textContent = M.name;
  setChip(`${M.name} · ${fmt(w, 1)} × ${fmt(d, 1)} × ${fmt(h, 1)} mm`, true);
  plateCache = null;
  forgetLayers();
  showHeight();
  render();
  drawPlate();
  drawMini();
  if (record) recordSoon();
}
async function loadModelFile(file) {
  try {
    const mesh = UNB.parseSTL(new Uint8Array(await file.arrayBuffer()));
    setModel(mesh, file.name.replace(/\.stl$/i, ""));
    artModel(); // art.js: the model in use
  } catch (e) {
    toast(`Couldn't read ${file.name}: ${(e && e.message) || "not an STL file"}`, true);
  }
}
for (const [id, ax] of [
  ["turnX", "x"],
  ["turnY", "y"],
  ["turnZ", "z"],
])
  $(id).addEventListener("click", () => {
    const M = st.model;
    if (!M) return;
    M.turns[ax] = (M.turns[ax] + 1) % 4;
    M.om = UNB.orientMesh(M.tri, M.turns);
    M.heightMM = fitHeight(M.om.size);
    M.cut = { bottom: 0, top: 0 };
    modelChanged(true);
  });
$("turnReset").addEventListener("click", () => {
  const M = st.model;
  if (!M) return;
  M.turns = { x: 0, y: 0, z: 0 };
  M.om = UNB.orientMesh(M.tri, M.turns);
  M.heightMM = fitHeight(M.om.size);
  M.cut = { bottom: 0, top: 0 };
  modelChanged(true);
});
function enterModel() {
  if (!st.model) setModel(sampleVase(), "sample vase");
  else modelChanged(false);
  drawPage(); // plot.js: the 2D page no longer shows the last picture's drawing
}

// ---------- the plate: the model's footprint ----------
// the convex hull of every corner seen from above (mm, y up), for packing copies and drawing the footprint
function modelPlate(n, gap, straight) {
  const M = st.model,
    k = modelScale(),
    C = modelCut(),
    key = [
      M.id,
      M.turns.x,
      M.turns.y,
      M.turns.z,
      k,
      C.bottom,
      C.top,
      n,
      gap,
      straight,
      lineWidthMM(),
      BED.w,
      BED.h,
    ].join("|");
  if (plateCache && plateCache.key === key) return plateCache.lay;
  // only the part left after cutting: its corners, and the outlines where the cuts go through it
  const t = M.om.tri,
    step = Math.max(1, Math.floor(t.length / 3 / 20000)),
    P = [],
    Zs = M.om.size[2],
    zb = C.bottom * Zs,
    zt = (1 - C.top) * Zs;
  for (let i = 0; i < t.length / 3; i += step)
    if (t[3 * i + 2] >= zb - 1e-9 && t[3 * i + 2] <= zt + 1e-9) P.push([t[3 * i] * k, t[3 * i + 1] * k]);
  for (const z of [C.bottom > 0 ? zb : null, C.top > 0 ? zt : null])
    if (z !== null)
      for (const f of UNB.sliceMesh(t, z)) for (let j = 0; j + 1 < f.length; j += 2) P.push([f[j] * k, f[j + 1] * k]);
  P.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]),
    lo = [],
    hi = [];
  for (const p of P) {
    while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
    lo.push(p);
  }
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i];
    while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop();
    hi.push(p);
  }
  const hull = lo.slice(0, -1).concat(hi.slice(0, -1));
  const lay = UNB.plateLayout(
    Float64Array.from(hull, (p) => p[0]),
    Float64Array.from(hull, (p) => p[1]),
    { bedW: BED.w, bedH: BED.h, copies: n, gap, pad: 0.5 * lineWidthMM(), straight, extraAngles: [] }
  );
  plateCache = { key, lay };
  return lay;
}

// ---------- slicing (the Print step) ----------
// Every layer of the model: sliced, moved in by half a line width, joined into one loop, filled for the filled base,
// and fitted with a Fourier series (UNB.modelStack, in the layers engine), then placed on the plate and stacked.
const modelStacks = new Map(); // key → UNB.modelStack result (mm, model centred)
async function buildModelLayers() {
  const M = st.model,
    lay = plateNow();
  if (!M || !lay) return null;
  const S0 = layerSettings(),
    z0 = firstZ(),
    w = lineWidthMM(),
    d = Math.max(w, spacingMM() || 0);
  const opt = Object.assign(
    {
      scale: modelScale(),
      z0,
      h: S0.h,
      base: S0.N,
      w,
      d,
      walls: intIn("wallCount", 1, 5, 1),
      tol: MODEL_TOL,
      cutBottom: modelCut().bottom * M.heightMM,
      cutTop: modelCut().top * M.heightMM,
      support: $("support").value === "off" ? null : $("support").value,
      overhang: overhangMM(),
    },
    S0.F
  ); // the base and infill (UNB.fillPlan)
  const key = JSON.stringify([M.id, M.turns, opt]);
  let R = modelStacks.get(key);
  if (!R) {
    $("layerInfo").textContent = "slicing… (can take a while for a big or solid model)";
    R = await LAY.call("modelStack", [M.om.tri, opt], (p) => {
      $("layerInfo").textContent = `slicing ${p.done} / ${p.of}`;
    });
    modelStacks.set(key, R);
    if (modelStacks.size > 6) modelStacks.delete(modelStacks.keys().next().value);
  }
  const place = (L) => UNB.plateLocal(L.x, L.y, lay.xf);
  const base = R.base.map(place),
    walls = R.walls.map(place),
    N = base.length,
    Mw = walls.length;
  const stack = UNB.layerStack({ base, baseLayers: N, walls, wallLayers: Mw, h: S0.h, open: false });
  const S = { on: N > 0, pat: S0.pat, N, M: Mw, h: S0.h, F: S0.F };
  return {
    key: key + "|" + JSON.stringify(lay.xf),
    S,
    base,
    wall: walls[0] || null,
    stack,
    lay,
    walk: null,
    baseFinal: null,
    fillInfo: null,
    model: true,
    terms: R.terms,
    empty: R.empty,
    walls: opt.walls,
    overhang: R.overhang,
    support: R.support,
  };
}

// ---------- the preview: the model, shaded; on the Print step, its layers ----------
// Orthographic, turned by yaw (about the vertical) and pitch (tipped towards you); drag the preview to look around.
function modelProj(M, cv) {
  const k = modelScale(),
    [w, d, h] = M.om.size.map((v) => v * k),
    cy = Math.cos(M.yaw),
    sy = Math.sin(M.yaw),
    cp = Math.cos(M.pitch),
    sp = Math.sin(M.pitch);
  const P = (x, y, z) => {
    const X = x * cy - y * sy,
      Y = x * sy + y * cy,
      Zc = z - h / 2;
    return [X, -(Zc * cp + Y * sp), Zc * sp - Y * cp];
  }; // screen x, screen y (down), depth (towards you: seen from above when pitch > 0)
  const R = Math.hypot(w, d, h) / 2 || 1,
    pad = 30 * (window.devicePixelRatio || 1),
    s = Math.min(cv.width - 2 * pad, cv.height - 2 * pad) / (2 * R);
  return { P, s, cx: cv.width / 2, cy: cv.height / 2, k };
}
function drawModel() {
  const M = st.model,
    cv = $("view");
  if (!M) return;
  const fit = fitCanvas(cv, true);
  if (!fit) return;
  const dpr = fit.dpr;
  const g = cv.getContext("2d");
  g.clearRect(0, 0, cv.width, cv.height);
  const { P, s, cx, cy, k } = modelProj(M, cv),
    L = st.layers;
  const choc = cssRGBA("--choc");
  if (document.body.dataset.view === "choc" && L && L.model) {
    // the sliced layers, darker towards the top
    const S = L.stack,
      lay = L.lay,
      laps = S.laps,
      inv = lay.xf;
    // stack points are plate-local; undo the placement to draw them where the model is
    const ca = Math.cos((inv.angle * Math.PI) / 180),
      sa = Math.sin((inv.angle * Math.PI) / 180);
    const back = (x, y) => {
      const X = x - inv.sx,
        Y = y - inv.sy;
      return [X * ca + Y * sa + inv.cx, -X * sa + Y * ca + inv.cy];
    }; // UNB.plateLocal, undone
    g.lineWidth = Math.max(0.8, 0.9 * dpr);
    g.lineJoin = g.lineCap = "round";
    laps.forEach((lap, li) => {
      g.strokeStyle = lap.kind === "base" ? css("--accent") : `rgb(${choc[0]}, ${choc[1]}, ${choc[2]})`;
      g.globalAlpha = 0.25 + (0.75 * (li + 1)) / laps.length;
      g.beginPath();
      for (let i = lap.from; i <= lap.to; i++) {
        const [x, y] = back(S.x[i], S.y[i]),
          q = P(x, y, S.z[i]);
        const X = cx + q[0] * s,
          Y = cy + q[1] * s;
        i === lap.from ? g.moveTo(X, Y) : g.lineTo(X, Y);
      }
      g.stroke();
    });
    g.globalAlpha = 1;
    return;
  }
  if ($("hlPreview").checked) {
    drawModelLines(g, cv);
    return;
  } // the line drawing this view would make
  // shaded triangles, back to front (painter's order), lit from the upper left
  const t = M.om.tri,
    n = t.length / 9,
    order = new Uint32Array(n),
    depth = new Float32Array(n),
    shade = new Float32Array(n),
    sc = [];
  // a light from the upper left, more from the side than the front so curves and steps read (the old one lit both
  // sides of every face alike and mostly from the front, which flattened the model)
  const lx = -0.62,
    ly = -0.58,
    lz = 0.53,
    ll = Math.hypot(lx, ly, lz);
  for (let i = 0; i < n; i++) {
    const o = 9 * i,
      a = P(t[o] * k, t[o + 1] * k, t[o + 2] * k),
      b = P(t[o + 3] * k, t[o + 4] * k, t[o + 5] * k),
      c = P(t[o + 6] * k, t[o + 7] * k, t[o + 8] * k);
    sc.push(a, b, c);
    order[i] = i;
    depth[i] = a[2] + b[2] + c[2];
    const ux = b[0] - a[0],
      uy = b[1] - a[1],
      uz = b[2] - a[2],
      vx = c[0] - a[0],
      vy = c[1] - a[1],
      vz = c[2] - a[2];
    const nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx,
      nl = Math.hypot(nx, ny, nz) || 1;
    const sg = nz < 0 ? -1 : 1; // the side facing us
    shade[i] = Math.max(0, (sg * (nx * lx + ny * ly + nz * lz)) / nl / ll);
  }
  order.sort((p, q) => depth[p] - depth[q]);
  // cut parts (Cut off, Line step) are drawn faint, and each cut is outlined where it goes through the model
  const C = modelCut(),
    Zs = M.om.size[2],
    zb = C.bottom * Zs,
    zt = (1 - C.top) * Zs;
  for (const i of order) {
    const o = 9 * i,
      zm = (t[o + 2] + t[o + 5] + t[o + 8]) / 3;
    g.globalAlpha = zm < zb || zm > zt ? 0.16 : 1;
    const [a, b, c] = [sc[3 * i], sc[3 * i + 1], sc[3 * i + 2]],
      d = shade[i],
      f = 0.38 + 0.98 * d,
      hi = 70 * Math.pow(d, 14); // diffuse, and a soft highlight
    g.fillStyle = `rgb(${Math.min(255, choc[0] * f + 12 + hi)}, ${Math.min(255, choc[1] * f + 10 + hi)}, ${Math.min(255, choc[2] * f + 8 + hi)})`;
    g.beginPath();
    g.moveTo(cx + a[0] * s, cy + a[1] * s);
    g.lineTo(cx + b[0] * s, cy + b[1] * s);
    g.lineTo(cx + c[0] * s, cy + c[1] * s);
    g.closePath();
    g.fill();
    g.strokeStyle = g.fillStyle;
    g.lineWidth = 0.6;
    g.stroke(); // close hairline gaps between neighbours
  }
  g.globalAlpha = 1;
  for (const z of [C.bottom > 0 ? zb : null, C.top > 0 ? zt : null]) {
    if (z === null) continue;
    g.strokeStyle = css("--accent");
    g.lineWidth = 2 * dpr;
    g.beginPath();
    for (const f of UNB.sliceMesh(t, z))
      for (let j = 0; j + 1 < f.length; j += 2) {
        const q = P(f[j] * k, f[j + 1] * k, z * k),
          X = cx + q[0] * s,
          Y = cy + q[1] * s;
        j ? g.lineTo(X, Y) : g.moveTo(X, Y);
      }
    g.stroke();
  }
}
// dragging the preview turns the model (the image tools' handlers are in tools.js; tools are off for a model)
let orbit = null;
$("view").addEventListener("pointerdown", (e) => {
  if (!isModel() || !st.model) return;
  orbit = { x: e.clientX, y: e.clientY, yaw: st.model.yaw, pitch: st.model.pitch };
  $("view").setPointerCapture(e.pointerId);
});
$("view").addEventListener("pointermove", (e) => {
  if (!orbit || !st.model) return;
  st.model.yaw = orbit.yaw + (e.clientX - orbit.x) * 0.01;
  st.model.pitch = Math.max(-1.5, Math.min(1.5, orbit.pitch + (e.clientY - orbit.y) * 0.01));
  if (!orbit.raf)
    orbit.raf = requestAnimationFrame(() => {
      if (orbit) orbit.raf = 0;
      render();
    });
});
for (const ev of ["pointerup", "pointercancel"])
  $("view").addEventListener(ev, () => {
    orbit = null;
  });
// Walls: model only, on the Print step (the base and infill settings are layers.js's)
$("wallCount").addEventListener("input", () => layersSoon(0));
$("support").addEventListener("change", () => layersSoon(0));
for (const ev of ["input", "change"])
  $("gOver").addEventListener(ev, () => {
    $("fromOver").textContent = $("gOver").value === "" ? `auto: ${fmt(overhangMM(), 2)}` : "";
    if (st.model) layersSoon(0);
  });

// ---------- 3D → 2D: a line drawing of the view (after plotter.vision) ----------
// UNB.hiddenLines finds the outlines, open edges and folds sharper than the chosen angle, and keeps the parts nothing
// lies in front of. The preview can show it live; Draw this view renders it large and makes it the image to trace.
const creaseDeg = () => +$("crease").value;
function creaseUI() {
  const c = creaseDeg();
  $("creaseVal").textContent = c <= 1 ? "every fold" : `folds over ${c}°`;
}
function hlCanvas(r, lw) {
  const c = document.createElement("canvas");
  c.width = r.w;
  c.height = r.h;
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, r.w, r.h);
  g.strokeStyle = "#000000";
  g.lineWidth = lw;
  g.lineCap = "round";
  g.beginPath();
  for (let i = 0; i < r.segs.length; i += 4) {
    g.moveTo(r.segs[i], r.segs[i + 1]);
    g.lineTo(r.segs[i + 2], r.segs[i + 3]);
  }
  g.stroke();
  return c;
}
function drawModelLines(g, cv) {
  // the preview as the drawing will come out (computed here, at the preview's size)
  const M = st.model,
    size = Math.min(cv.width, cv.height) * 0.9;
  const r = UNB.hiddenLines(M.om.tri, { yaw: M.yaw, pitch: M.pitch, size, crease: creaseDeg() });
  g.save();
  g.translate((cv.width - r.w) / 2, (cv.height - r.h) / 2);
  g.strokeStyle = css("--ink");
  g.lineWidth = Math.max(1, (window.devicePixelRatio || 1) * 1.2);
  g.lineCap = "round";
  g.beginPath();
  for (let i = 0; i < r.segs.length; i += 4) {
    g.moveTo(r.segs[i], r.segs[i + 1]);
    g.lineTo(r.segs[i + 2], r.segs[i + 3]);
  }
  g.stroke();
  g.restore();
}
$("crease").addEventListener("input", () => {
  creaseUI();
  if (!$("hlPreview").checked) $("hlPreview").checked = true;
  render();
});
$("hlPreview").addEventListener("change", render);
$("drawView").addEventListener("click", async () => {
  const M = st.model;
  if (!M) return;
  $("drawView").disabled = true;
  try {
    const r = await LAY.call("hiddenLines", [
      M.om.tri,
      { yaw: M.yaw, pitch: M.pitch, size: 1400, crease: creaseDeg() },
    ]);
    const c = hlCanvas(r, 3);
    applyPreset("drawing", true); // first, so the trace already uses it (one trace, not two)
    artModelDrawing(c, `${M.name} · drawing`); // art.js: the drawing becomes the picture
    toast("Drawing made: tracing it as a line drawing");
  } catch (e) {
    if (e !== CANCELLED) toast(`Couldn't draw the view: ${(e && e.message) || "error"}`, true);
  } finally {
    $("drawView").disabled = false;
  }
});
creaseUI();
// the drawing as vectors, before any tracing: rendered at 2000 px for precision, pieces that meet joined into strokes,
// scaled to the model's size in mm (its height as set on the Print step)
async function modelViewSVG() {
  const M = st.model,
    r = await LAY.call("hiddenLines", [
      M.om.tri,
      { yaw: M.yaw, pitch: M.pitch, size: 2000, crease: creaseDeg(), pad: 0 },
    ]);
  const mm = modelScale() / r.k,
    lines = UNB.chainSegments(r.segs, 0.75).map((L) => L.map((v) => v * mm));
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const L of lines)
    for (let i = 0; i < L.length; i += 2) {
      x0 = Math.min(x0, L[i]);
      x1 = Math.max(x1, L[i]);
      y0 = Math.min(y0, L[i + 1]);
      y1 = Math.max(y1, L[i + 1]);
    }
  const shifted = lines.map((L) => L.map((v, i) => v - (i % 2 ? y0 : x0))),
    W = x1 - x0,
    H = y1 - y0;
  return {
    name: `${designSlug()}-view.svg`,
    data: UNB.exportLinesSVG(shifted, {
      W,
      H,
      margin: 5,
      pen: +$("penW").value || 0.3,
      title: `${M.name}, line drawing of a view`,
    }),
    info: `${fmt(W, 1)} × ${fmt(H, 1)} mm, ${lines.length} strokes (${r.segs.length / 4} visible edge pieces)`,
  };
}
$("drawSvg").addEventListener("click", () => exportAs("viewsvg", $("drawMsg")));
