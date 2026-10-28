// Unbroken · web app · plot.js
// The Plot step: the pen version of the line (for a pen plotter, the AxiDraw through Saxi), placed on a page, areas
// filled
// with other pens, and the files made from it (SVG for Saxi with one layer per pen, flat DXF).
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// ---------- 2D: pen plotter ----------
// A pen can lift and go over a line twice, so the pen version is the traced drawing itself: the walk fitted with no
// spacing, so a stroke the line travels out and back along is drawn twice on the same spot, with no doubled strands
// and no stroke-end loops. Corner rounding applies; infill doesn't. Worked out by the layers engine (layers.js) and
// kept per drawing.
// Paper sizes in mm (short side, long side); "plate" is the printer's plate (settings.js), so a drawing can be laid
// out at the size the chocolate printer would print it.
const PAPER = {
  a6: [105, 148],
  a5: [148, 210],
  a4: [210, 297],
  a3: [297, 420],
  a2: [420, 594],
  a1: [594, 841],
  letter: [215.9, 279.4],
  legal: [215.9, 355.6],
  tabloid: [279.4, 431.8],
  "6x8": [152.4, 203.2],
  "9x12": [228.6, 304.8],
  "11x14": [279.4, 355.6],
  "18x24": [457.2, 609.6],
};
const PEN_COLORS = ["#111111", "#d1342f", "#2f6fd1", "#2a9d58", "#e0a422", "#8e44ad", "#e86fa0", "#1f9aa8"];
const MAX_PENS = 8; // the drawing's pen + 7 fill pens
const penCache = new WeakMap(); // walk → Map(key → pen line, mm)
let plotTok = 0,
  plotTimer = null;
st.plot = null; // { x, y (mm, y down, from its own top-left), W, H, open }

function paperSize() {
  const v = $("paper").value,
    wh =
      v === "custom"
        ? [+$("paperW").value || 210, +$("paperH").value || 297]
        : v === "plate"
          ? [BED.w, BED.h]
          : PAPER[v] || PAPER.a4;
  const [a, b] = [Math.min(...wh), Math.max(...wh)];
  return $("paperOrient").value === "portrait" ? { w: a, h: b } : { w: b, h: a };
}
async function penLine() {
  const walk = st.walk,
    key = JSON.stringify([cornerMM(), +$("uncross").value, $("overlaps").checked, st.zones, st.outW, st.simplify]);
  let m = penCache.get(walk);
  if (!m) penCache.set(walk, (m = new Map()));
  if (m.has(key)) return m.get(key);
  const r = await LAY.call("stagePrint", [
    walk,
    0,
    st.w,
    st.h,
    {
      w: 0,
      round: cornerMM() / scale(),
      fill: null,
      termTol: CFG.engine.termTolerance,
      unx: +$("uncross").value,
      minGap: 0,
      ...allowSpec(st.w, st.h),
    },
  ]);
  const f = r.final,
    k = scale(),
    n = f.re.length;
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (let i = 0; i < n; i++) {
    x0 = Math.min(x0, f.re[i]);
    x1 = Math.max(x1, f.re[i]);
    y0 = Math.min(y0, f.im[i]);
    y1 = Math.max(y1, f.im[i]);
  }
  const x = Float64Array.from(f.re, (v) => (v - x0) * k),
    y = Float64Array.from(f.im, (v) => (v - y0) * k),
    s = UNB.simplify(x, y, st.simplify, !st.open);
  // px0, py0, k: where the drawing sits on the working image (for tone and colour)
  const out = { x: s.x, y: s.y, W: (x1 - x0) * k, H: (y1 - y0) * k, open: r.open, px0: x0, py0: y0, k };
  m.set(key, out);
  if (m.size > 8) m.delete(m.keys().next().value);
  return out;
}
// where the drawing sits on the page: centred, and whether it stays inside the margins. F is what the view fits (mm,
// in page coordinates): the paper, grown to take in a drawing bigger than it, so the whole drawing always shows.
function placeOnPage(L) {
  const P = paperSize(),
    mg = Math.max(0, +$("paperMargin").value || 0),
    fits = L.W <= P.w - 2 * mg + 1e-6 && L.H <= P.h - 2 * mg + 1e-6,
    ox = (P.w - L.W) / 2,
    oy = (P.h - L.H) / 2,
    pad = L.W > P.w || L.H > P.h ? 0.03 * Math.max(L.W, L.H) : 0,
    x0 = Math.min(0, ox - pad),
    y0 = Math.min(0, oy - pad);
  const F = { x0, y0, w: Math.max(P.w, ox + L.W + pad) - x0, h: Math.max(P.h, oy + L.H + pad) - y0 };
  return { P, mg, fits, ox, oy, F };
}
// ---------- the art as drawn (Art as drawn): its lines straight from the Art step, no trace ----------
const plotFromArt = () => $("plotArt").checked;
// the art's lines fitted inside the margins, each shown layer on its own pen (mm, page coordinates)
function artOnPage() {
  const V = artVectors(); // art.js
  if (!V) return null;
  const P = paperSize(),
    mg = Math.max(0, +$("paperMargin").value || 0),
    k = Math.max(1e-6, Math.min((P.w - 2 * mg) / V.W, (P.h - 2 * mg) / V.H)),
    ox = (P.w - V.W * k) / 2,
    oy = (P.h - V.H * k) / 2;
  const layers = V.layers.map((l) => ({
    ...l,
    strokes: l.strokes.map((s) => s.map((v, i) => (i % 2 ? oy + v * k : ox + v * k))),
  }));
  return { P, mg, W: V.W * k, H: V.H * k, layers, pictures: V.pictures };
}
function drawArtPage() {
  const cv = $("pageView"),
    A = artOnPage(),
    P = A ? A.P : paperSize(),
    mg = A ? A.mg : 0,
    pen = Math.max(0.05, +$("penW").value || 0.5);
  cv.style.aspectRatio = `${P.w} / ${P.h}`;
  cv.style.setProperty("--ar", P.w / P.h);
  const fit = fitCanvas(cv);
  if (fit) {
    const g = cv.getContext("2d"),
      s = cv.width / P.w;
    let dpr = fit.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = css("--paper");
    g.fillRect(0, 0, cv.width, cv.height);
    dpr /= zoomOn(g, "page", cv).z;
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, P.w * s, P.h * s);
    g.strokeStyle = "#9aa3ad";
    g.lineWidth = dpr;
    g.strokeRect(0, 0, P.w * s, P.h * s);
    g.setLineDash([4 * dpr, 4 * dpr]);
    g.strokeRect(mg * s, mg * s, (P.w - 2 * mg) * s, (P.h - 2 * mg) * s);
    g.setLineDash([]);
    g.lineJoin = g.lineCap = "round";
    for (const L of A ? A.layers : []) {
      g.strokeStyle = L.pen;
      g.lineWidth = Math.max(0.6 * dpr, pen * s);
      g.beginPath();
      for (const q of L.strokes) {
        g.moveTo(q[0] * s, q[1] * s);
        for (let i = 2; i + 1 < q.length; i += 2) g.lineTo(q[i] * s, q[i + 1] * s);
      }
      g.stroke();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
  const name = $("paper").selectedOptions[0].textContent.split(" ·")[0],
    n = A ? A.layers.length : 0,
    h = $("pageHint");
  const strokes = lineModeNow() === "strokes"; // workflow.js: separate strokes, or as drawn
  $("plotInfo").textContent = A
    ? `${fmt(A.W, 0)} × ${fmt(A.H, 0)} mm on ${name}`
    : strokes
      ? "tracing…"
      : "art as drawn";
  h.className = !A || A.pictures ? "hint warn" : "hint";
  h.textContent =
    !A || A.pictures
      ? strokes
        ? "No strokes yet: the Line step traces them (or lower the threshold or the speck filter there)."
        : "Only a pattern or text can be plotted as drawn: a picture has no lines until it is traced (the Line step: separate strokes or one continuous line), and a 3D model needs Draw this view."
      : strokes
        ? `${A.layers[0].name === "strokes" ? A.layers[0].strokes.length : 0} separate strokes, the pen lifting between them` +
          (n > 1 || A.layers[0].name !== "strokes"
            ? `, and ${A.layers.filter((l) => l.name !== "strokes").length} filled grey${A.layers.length === 2 ? "" : "s"}, each on its own pen (layer)`
            : "") +
          `: ${fmt(A.W, 1)} × ${fmt(A.H, 1)} mm, fitted inside the margins of ${name} ${$("paperOrient").value}.`
        : `The ${A.layers[0].name} exactly as drawn, not traced: ${fmt(A.W, 1)} × ${fmt(A.H, 1)} mm, fitted inside the margins of ${name} ${$("paperOrient").value}.`;
}
// the art as drawn has no fills (fill pens fill the traced drawing's shapes)
function plotFromUI() {
  $("card-h-fills").hidden = plotFromArt();
}
document.querySelectorAll('input[name="plotFrom"]').forEach((r) =>
  r.addEventListener("change", () => {
    plotFromUI();
    if (plotFromArt()) drawPage();
    else plotSoon(0);
  })
);
function plotSoon(delay = 150) {
  clearTimeout(plotTimer);
  plotTimer = setTimeout(async () => {
    if (!plotWanted()) return;
    if (plotFromArt()) return drawPage();
    if (isModel()) {
      $("plotInfo").textContent = "3D model";
      $("pageHint").className = "hint";
      $("pageHint").textContent =
        "To plot a model, use Draw this view in Trace: it makes a line drawing of the model from the preview's angle and traces it, and the Plot step plots that.";
      return;
    }
    if (!st.walk || !st.final) return;
    const my = ++plotTok;
    $("plotInfo").textContent = st.plot ? "working…" : "working… (the first time takes a few seconds)";
    try {
      const L = await penLine();
      if (my !== plotTok) return;
      st.plot = L;
      drawPage();
      fillsSoon(0);
    } catch (e) {
      if (e === CANCELLED) return;
      console.error(e);
      if (my === plotTok) $("plotInfo").textContent = "couldn't make the pen line";
    }
  }, delay);
}

// ---------- fill pens ----------
// Pen 1 draws the line. Each fill pen has a colour, width, spacing between strokes (= width: solid), angle and an
// optional cross-hatch. A filled area is remembered as a point inside it, as a share of the drawing's width and height,
// so it stays with the same part of the drawing when the size or the trace changes (UNB.penFills finds the area again).
const penColorAt = (k) =>
  (Array.isArray(CFG.defaults.penColors) && CFG.defaults.penColors[k]) || PEN_COLORS[k % PEN_COLORS.length];
const newPen = (k) => {
  const w = +$("penW").value || 0.5;
  return { color: penColorAt(k), width: w, spacing: w, style: "hatch", angle: 45, cross: false, tone: false };
};
// The image's darkness for pens that follow its tone: the prepared working image (what the trace sees), averaged down
// to at most 500 px, as 0 (white) to 1 (black). Kept until the working image changes.
let toneCache = null;
function toneGrid() {
  const W = st.wk;
  if (!W || !W.gray) return null;
  if (toneCache && toneCache.key === W.key) return toneCache.t;
  const f = Math.min(1, 500 / Math.max(W.w, W.h)),
    tw = Math.max(2, Math.round(W.w * f)),
    th = Math.max(2, Math.round(W.h * f)),
    d = new Float32Array(tw * th),
    n = new Float32Array(tw * th);
  for (let y = 0; y < W.h; y++)
    for (let x = 0; x < W.w; x++) {
      const q = Math.min(th - 1, Math.floor(y * f)) * tw + Math.min(tw - 1, Math.floor(x * f));
      d[q] += 1 - W.gray[y * W.w + x] / 255;
      n[q]++;
    }
  for (let i = 0; i < d.length; i++) d[i] = n[i] ? d[i] / n[i] : 0;
  const t = { w: tw, h: th, d, f: tw / W.w };
  toneCache = { key: W.key, t };
  return t;
}
function defaultPenFill() {
  return { pens: [newPen(1)], areas: [], active: 0 };
}
st.penFill = defaultPenFill();
st.pfill = null; // { key, res (UNB.penFills), bb: per area [x0, y0, x1, y1] grid box }
let fillTok = 0,
  fillTimer = null,
  hoverArea = -1;

function fillArgs(L) {
  const P = st.penFill,
    fills = P.pens.map((p, k) => ({
      seeds: P.areas.filter((a) => a.pen === k).map((a) => [a.u * L.W, a.v * L.H]),
      width: p.width,
      spacing: p.spacing,
      style: p.style || "hatch",
      angle: p.angle,
      cross: p.cross,
      tone: !!p.tone,
    }));
  return { pen: Math.max(0.05, +$("penW").value || 0.5), gap: gapMM(), minShape: minShapeMM2(), fills };
}
// Close gaps (0–10 mm) and Smallest shape (0–100 mm²): finer steps at the small end
const gapMM = () => 10 * (+$("gapClose").value / 100) ** 2;
const minShapeMM2 = () => 100 * (+$("minShape").value / 100) ** 2;
function shapesUI() {
  const gp = gapMM(),
    ms = minShapeMM2();
  $("gapCloseVal").textContent = gp ? `up to ${fmt(gp, gp < 1 ? 2 : 1)} mm` : "off";
  $("minShapeVal").textContent = ms ? `under ${fmt(ms, ms < 10 ? 1 : 0)} mm²` : "off";
  $("drawBridges").disabled = !gp;
}
for (const id of ["gapClose", "minShape"])
  $(id).addEventListener("input", () => {
    shapesUI();
    fillsSoon();
  });
$("drawBridges").addEventListener("change", drawPage);
$("showShapes").addEventListener("change", drawPage);
// a light colour per shape (golden-angle hues), cached per result and set of filled shapes
function shapeTint(F) {
  const R = F.res,
    filled = new Set(R.seedAreas.flat().filter((i) => i >= 0)),
    key = [...filled].sort().join();
  if (F.tint && F.tintKey === key) return F.tint;
  const c = document.createElement("canvas");
  c.width = R.w;
  c.height = R.h;
  const g = c.getContext("2d"),
    img = g.createImageData(R.w, R.h),
    col = new Map();
  for (let i = 0; i < R.lab.length; i++) {
    const l = R.lab[i];
    if (l < 0 || l === R.outside || filled.has(l)) continue;
    let rgb = col.get(l);
    if (!rgb) {
      const h = (l * 137.508) % 360,
        f = (n) => {
          const k = (n + h / 30) % 12;
          return Math.round(255 * (0.78 - 0.16 * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
        };
      col.set(l, (rgb = [f(0), f(8), f(4)]));
    }
    img.data[4 * i] = rgb[0];
    img.data[4 * i + 1] = rgb[1];
    img.data[4 * i + 2] = rgb[2];
    img.data[4 * i + 3] = 110;
  }
  g.putImageData(img, 0, 0);
  F.tint = c;
  F.tintKey = key;
  return c;
}
async function computeFills() {
  const L = st.plot;
  if (!L) return null;
  const args = fillArgs(L),
    T = st.penFill.pens.some((p) => p.tone) ? toneGrid() : null;
  const key = JSON.stringify(args) + (T ? "|tone:" + st.wk.key : "");
  if (st.pfill && st.pfill.line === L && st.pfill.key === key) return st.pfill;
  // drawing mm → tone pixel
  if (T) args.tone = { w: T.w, h: T.h, d: T.d, a: T.f / L.k, bx: L.px0 * T.f, by: L.py0 * T.f };
  const res = await LAY.call("penFills", [{ x: L.x, y: L.y }, !L.open, args]);
  const bb = [];
  for (let i = 0; i < res.count; i++) bb.push([res.w, res.h, -1, -1]);
  for (let s = 0; s < res.lab.length; s++) {
    const a = res.lab[s];
    if (a < 0) continue;
    const x = s % res.w,
      y = (s / res.w) | 0,
      b = bb[a];
    if (x < b[0]) b[0] = x;
    if (y < b[1]) b[1] = y;
    if (x > b[2]) b[2] = x;
    if (y > b[3]) b[3] = y;
  }
  return { line: L, key, res, bb };
}
function fillsSoon(delay = 120) {
  clearTimeout(fillTimer);
  fillTimer = setTimeout(async () => {
    if (!plotWanted() || !st.plot) return;
    const my = ++fillTok;
    try {
      const F = await computeFills();
      if (my !== fillTok || !F) return;
      st.pfill = F;
      drawPage();
    } catch (e) {
      if (e === CANCELLED) return;
      console.error(e);
    }
  }, delay);
}
// the area under a point of the drawing (mm, its own top-left), as the engine finds it: -1 outside or none
function areaAtMM(X, Y) {
  const F = st.pfill;
  if (!F || F.line !== st.plot) return -1;
  const R = F.res,
    cx = Math.round((X - R.ox) / R.g),
    cy = Math.round((Y - R.oy) / R.g),
    r = Math.ceil(Math.max(0.05, +$("penW").value || 0.5) / R.g) + 1;
  let best = Infinity,
    id = -1;
  for (let b = -r; b <= r; b++)
    for (let a = -r; a <= r; a++) {
      const x = cx + a,
        y = cy + b;
      if (x < 0 || y < 0 || x >= R.w || y >= R.h) continue;
      const l = R.lab[y * R.w + x];
      if (l < 0) continue;
      const d2 = a * a + b * b;
      if (d2 < best) {
        best = d2;
        id = l;
      }
    }
  return id === R.outside ? -1 : id;
}
function eventMM(e) {
  const L = st.plot,
    cv = $("pageView");
  if (!L) return null;
  const r = cv.getBoundingClientRect(),
    { ox, oy, F } = placeOnPage(L),
    d = cv.width / r.width;
  const [x, y] = unzoom("page", cv, (e.clientX - r.left) * d, (e.clientY - r.top) * d); // zoom.js
  return [F.x0 + (x / cv.width) * F.w - ox, F.y0 + (y / cv.height) * F.h - oy];
}
// Click a shape to fill it with the chosen pen (or clear it, if that pen already fills it); drag across shapes to do
// the
// same to every shape you pass over: the first shape decides whether the drag fills or clears. One undo step per drag.
// A touch only taps, so a finger can still scroll the page.
let drag = null; // { mode: "fill" | "clear", done: Set(area ids), idOf: Map(entry → area id) }
function areaEntryIds() {
  // each saved fill → the area it's in now (the grid doesn't change while painting)
  const F = st.pfill,
    P = st.penFill,
    m = new Map();
  if (!F) return m;
  const seen = P.pens.map(() => 0);
  for (const a of P.areas) {
    const j = seen[a.pen]++,
      ids = F.res.seedAreas[a.pen];
    m.set(a, ids ? ids[j] : -1);
  }
  return m;
}
function paintShape(id, p) {
  const P = st.penFill,
    D = drag;
  if (id < 0 || D.done.has(id)) return;
  D.done.add(id);
  const here = P.areas.filter((a) => D.idOf.get(a) === id);
  if (D.mode === null) D.mode = here.some((a) => a.pen === P.active) ? "clear" : "fill";
  P.areas = P.areas.filter((a) => D.idOf.get(a) !== id); // one pen per shape
  if (D.mode === "fill" && P.pens.length) {
    const a = { u: p[0] / st.plot.W, v: p[1] / st.plot.H, pen: P.active };
    P.areas.push(a);
    D.idOf.set(a, id);
  }
  fillsSoon(60);
  penReadout();
}
$("pageView").addEventListener("pointerdown", (e) => {
  if (e.button !== 0 || !st.pfill) return;
  const p = eventMM(e);
  if (!p) return;
  const id = areaAtMM(...p);
  if (id < 0) return;
  if (recTimer) {
    clearTimeout(recTimer);
    record();
  } // an undo step still waiting is taken before painting, so the drag is a step of its own
  drag = { mode: null, done: new Set(), idOf: areaEntryIds(), touch: e.pointerType === "touch", start: p, id };
  if (!drag.touch) {
    $("pageView").setPointerCapture(e.pointerId);
    paintShape(id, p);
  }
});
$("pageView").addEventListener("pointermove", (e) => {
  if (!drag || drag.touch) return;
  const p = eventMM(e);
  if (p) paintShape(areaAtMM(...p), p);
});
for (const ev of ["pointerup", "pointercancel"])
  $("pageView").addEventListener(ev, (e) => {
    if (!drag) return;
    if (drag.touch && ev === "pointerup") {
      const p = eventMM(e);
      if (p && Math.hypot(p[0] - drag.start[0], p[1] - drag.start[1]) < 2) paintShape(drag.id, drag.start);
    }
    const changed = drag.done.size > 0;
    drag = null;
    if (changed) {
      recordSoon();
      fillsSoon(0);
    }
  });
$("pageView").addEventListener("mousemove", (e) => {
  const p = eventMM(e),
    id = p ? areaAtMM(...p) : -1;
  $("pageView").classList.toggle("picking", id >= 0);
  if (id !== hoverArea) {
    hoverArea = id;
    drawPage();
  }
});
$("pageView").addEventListener("mouseleave", () => {
  if (hoverArea >= 0) {
    hoverArea = -1;
    drawPage();
  }
  $("pageView").classList.remove("picking");
});

// the pen list
function renderPens() {
  const P = st.penFill,
    list = $("penList");
  list.textContent = "";
  P.active = Math.min(P.active, P.pens.length - 1);
  P.pens.forEach((p, k) => {
    const row = document.createElement("div"),
      n = k + 2;
    row.className = "pen-row" + (k === P.active ? " active" : "");
    row.dataset.k = k;
    row.innerHTML =
      `<label class="pen-pick" title="Click areas on the page to fill them with this pen"><input type="radio" name="activePen" ${k === P.active ? "checked" : ""}> Pen ${n}</label>` +
      `<label class="field f-c"><span>Colour</span><input type="color" data-f="color" value="${p.color}" aria-label="Pen ${n} colour"></label>` +
      `<label class="field f-w"><span>Width mm</span><input type="number" data-f="width" min="0.05" max="5" step="0.05" value="${p.width}" aria-label="Pen ${n} width (mm)"></label>` +
      `<label class="field f-sp"><span>Spacing mm</span><input type="number" data-f="spacing" min="0.05" max="20" step="0.05" value="${p.spacing}" aria-label="Pen ${n} spacing between strokes (mm)"></label>` +
      `<label class="field f-a"><span>Angle °</span><input type="number" data-f="angle" min="-180" max="180" step="5" value="${p.angle}" ${p.style === "contours" ? "disabled" : ""} aria-label="Pen ${n} hatch angle (degrees)"></label>` +
      `<label class="check f-x"><input type="checkbox" data-f="cross" ${p.cross ? "checked" : ""} ${p.style === "contours" ? "disabled" : ""}> Cross</label>` +
      `<label class="field f-st"><span>Style</span><select data-f="style" aria-label="Pen ${n} fill style"><option value="hatch"${p.style !== "contours" ? " selected" : ""}>Hatch</option><option value="contours"${p.style === "contours" ? " selected" : ""}>Contours</option></select></label>` +
      `<label class="check f-t" title="Strokes closer where the image is darker, further apart where it's lighter, none where it's white"><input type="checkbox" data-f="tone" ${p.tone ? "checked" : ""}> Follow tone</label>` +
      `<button class="btn mini pen-del" type="button" aria-label="Remove pen ${n}" title="Remove pen ${n} and its fills">×</button>`;
    list.appendChild(row);
  });
  $("addPen").disabled = P.pens.length >= MAX_PENS - 1;
  penReadout();
}
$("penList").addEventListener("change", (e) => {
  const row = e.target.closest(".pen-row");
  if (!row) return;
  const P = st.penFill,
    k = +row.dataset.k,
    f = e.target.dataset.f;
  if (e.target.name === "activePen") {
    P.active = k;
    renderPens();
    return;
  }
  if (!f) return;
  const p = P.pens[k];
  if (f === "color") p.color = e.target.value;
  else if (f === "cross") p.cross = e.target.checked;
  else if (f === "tone") p.tone = e.target.checked;
  else if (f === "style") {
    p.style = e.target.value;
    renderPens();
  } else {
    const lim = { width: [0.05, 5], spacing: [0.05, 20], angle: [-180, 180] }[f],
      v = +e.target.value;
    if (!Number.isFinite(v)) {
      e.target.value = p[f];
      return;
    }
    p[f] = Math.min(lim[1], Math.max(lim[0], v));
    e.target.value = p[f];
  }
  recordSoon();
  drawPage();
  fillsSoon(0);
});
$("penList").addEventListener("click", (e) => {
  const b = e.target.closest(".pen-del");
  if (!b) return;
  const P = st.penFill,
    k = +b.closest(".pen-row").dataset.k;
  P.pens.splice(k, 1);
  P.areas = P.areas.filter((a) => a.pen !== k).map((a) => (a.pen > k ? Object.assign({}, a, { pen: a.pen - 1 }) : a));
  if (P.active >= k && P.active > 0) P.active--;
  renderPens();
  recordSoon();
  fillsSoon(0);
});
$("addPen").addEventListener("click", () => {
  const P = st.penFill;
  if (P.pens.length >= MAX_PENS - 1) return;
  P.pens.push(newPen(P.pens.length + 1));
  P.active = P.pens.length - 1;
  renderPens();
  recordSoon();
});
function penReadout() {
  const P = st.penFill,
    used = new Set(P.areas.map((a) => a.pen)),
    n = P.areas.length,
    F = st.pfill && st.pfill.line === st.plot ? st.pfill : null;
  const shapes = F ? `${F.res.shapes} shape${F.res.shapes === 1 ? "" : "s"} · ` : "";
  $("penFillInfo").textContent = shapes + (n ? `${n} filled · ${used.size + 1} pens` : "none filled");
}

// ---------- colour from image ----------
// Each shape gets the fill pen whose colour is closest to the source image's average colour inside it; shapes that are
// light and nearly colourless (paper) stay empty. Colours are compared in CIE Lab, by hue and colourfulness with
// lightness counting less, since an image's colours are usually lighter than a pen's ink. One undo step.
let colourCache = null;
function colourImage() {
  // the source, cropped and scaled like the working image, as RGBA
  const W = st.wk;
  if (!W || !st.source || !W.crop) return null;
  if (colourCache && colourCache.key === W.key) return colourCache.img;
  const c = document.createElement("canvas");
  c.width = W.w;
  c.height = W.h;
  const g = c.getContext("2d"),
    { sx, sy, kx, ky } = W.crop;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, W.w, W.h);
  g.drawImage(st.source, sx, sy, W.w / kx, W.h / ky, 0, 0, W.w, W.h);
  const img = { w: W.w, h: W.h, d: g.getImageData(0, 0, W.w, W.h).data };
  colourCache = { key: W.key, img };
  return img;
}
function toLab([r, g, b]) {
  const f = (v) => {
      v /= 255;
      return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92;
    },
    R = f(r),
    G = f(g),
    B = f(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.9505,
    Y = 0.2126 * R + 0.7152 * G + 0.0722 * B,
    Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.089;
  const t = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  return [116 * t(Y) - 16, 500 * (t(X) - t(Y)), 200 * (t(Y) - t(Z))];
}
$("autoColour").addEventListener("click", async () => {
  const msg = $("autoColourMsg"),
    P = st.penFill;
  if (!P.pens.length) {
    msg.textContent = "Add a fill pen first.";
    return;
  }
  const F = await computeFills(),
    L = st.plot,
    img = colourImage();
  if (!F || !L) return;
  if (!img) {
    msg.textContent = "No image to take colours from.";
    return;
  }
  const R = F.res,
    sum = new Map(); // shape → [r, g, b, n, best seed cell, its depth]
  for (let i = 0; i < R.lab.length; i++) {
    const l = R.lab[i];
    if (l < 0 || l === R.outside) continue;
    const X = R.ox + (i % R.w) * R.g,
      Y = R.oy + Math.floor(i / R.w) * R.g,
      px = Math.round(X / L.k + L.px0),
      py = Math.round(Y / L.k + L.py0);
    if (px < 0 || py < 0 || px >= img.w || py >= img.h) continue;
    const q = 4 * (py * img.w + px);
    let e = sum.get(l);
    if (!e) sum.set(l, (e = [0, 0, 0, 0, i, -1]));
    e[0] += img.d[q];
    e[1] += img.d[q + 1];
    e[2] += img.d[q + 2];
    e[3]++;
  }
  // each shape's cells, for a seed point: the cell nearest the shape's centre
  const cells = new Map();
  for (let i = 0; i < R.lab.length; i++) {
    const l = R.lab[i];
    if (sum.has(l)) {
      let A = cells.get(l);
      if (!A) cells.set(l, (A = []));
      A.push(i);
    }
  }
  const cand = P.pens.map((p, k) => ({ pen: k, lab: toLab(hexRGB(p.color)) }));
  const areas = [];
  let filled = 0;
  for (const [l, e] of sum) {
    if (e[3] < 4) continue;
    const c = toLab([e[0] / e[3], e[1] / e[3], e[2] / e[3]]);
    if (c[0] > 80 && Math.hypot(c[1], c[2]) < 10) continue; // light and nearly colourless: paper, left empty
    // nearest pen by hue and colourfulness, lightness counting less (an image's colours are usually lighter than a
    // pen's ink)
    let best = cand[0],
      bd = Infinity;
    for (const k of cand) {
      const d = (0.3 * (k.lab[0] - c[0])) ** 2 + (k.lab[1] - c[1]) ** 2 + (k.lab[2] - c[2]) ** 2;
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    const A = cells.get(l);
    let mx = 0,
      my = 0;
    for (const i of A) {
      mx += i % R.w;
      my += Math.floor(i / R.w);
    }
    mx /= A.length;
    my /= A.length;
    let pick = A[0],
      pd = Infinity;
    for (const i of A) {
      const d = ((i % R.w) - mx) ** 2 + (Math.floor(i / R.w) - my) ** 2;
      if (d < pd) {
        pd = d;
        pick = i;
      }
    } // the shape's cell nearest its centre
    const X = R.ox + (pick % R.w) * R.g,
      Y = R.oy + Math.floor(pick / R.w) * R.g;
    areas.push({ u: X / L.W, v: Y / L.H, pen: best.pen });
    filled++;
  }
  P.areas = areas;
  recordSoon();
  fillsSoon(0);
  penReadout();
  msg.textContent =
    `${filled} of ${sum.size} shapes coloured` +
    (sum.size - filled ? `; ${sum.size - filled} white or nearly white in the image, left empty.` : ".");
});

// ---------- the page ----------
// the paper, the shapes, bridges, fills and the drawing; progress (0–1) while Play drawing runs on this view
function paintPage(cv, dpr, L, P, mg, fits, ox, oy, pen, F, progress, B) {
  const g = cv.getContext("2d"),
    s = cv.width / B.w;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = css("--paper");
  g.fillRect(0, 0, cv.width, cv.height); // round the paper (a drawing bigger than it, or zoomed out)
  dpr /= zoomOn(g, "page", cv).z; // zoom.js; hairlines stay hairlines when zoomed in
  g.translate(-B.x0 * s, -B.y0 * s); // page coordinates: the paper's top-left corner at 0, 0
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, P.w * s, P.h * s); // paper is white in both themes
  g.strokeStyle = "#9aa3ad";
  g.lineWidth = dpr;
  g.strokeRect(0, 0, P.w * s, P.h * s); // its edge
  g.strokeStyle = "#9aa3ad";
  g.setLineDash([4 * dpr, 4 * dpr]);
  g.lineWidth = dpr;
  g.strokeRect(mg * s, mg * s, (P.w - 2 * mg) * s, (P.h - 2 * mg) * s);
  g.setLineDash([]);
  if (F && $("showShapes").checked) {
    // every shape that can be filled, in its own light colour
    const R = F.res;
    g.imageSmoothingEnabled = false;
    g.drawImage(shapeTint(F), (ox + R.ox - 0.5 * R.g) * s, (oy + R.oy - 0.5 * R.g) * s, R.w * R.g * s, R.h * R.g * s);
  }
  // the area under the pointer, tinted in the chosen pen's colour
  if (F && hoverArea >= 0 && hoverArea < F.bb.length) {
    const R = F.res,
      b = F.bb[hoverArea],
      bw = b[2] - b[0] + 1,
      bh = b[3] - b[1] + 1,
      img = new ImageData(bw, bh),
      col = st.penFill.pens[st.penFill.active];
    const c = col ? col.color : "#888888",
      [rr, gg, bl] = hexRGB(c);
    for (let y = 0; y < bh; y++)
      for (let x = 0; x < bw; x++)
        if (R.lab[(b[1] + y) * R.w + b[0] + x] === hoverArea) {
          const q = 4 * (y * bw + x);
          img.data[q] = rr;
          img.data[q + 1] = gg;
          img.data[q + 2] = bl;
          img.data[q + 3] = 60;
        }
    const off = document.createElement("canvas");
    off.width = bw;
    off.height = bh;
    off.getContext("2d").putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(
      off,
      (ox + R.ox + (b[0] - 0.5) * R.g) * s,
      (oy + R.oy + (b[1] - 0.5) * R.g) * s,
      bw * R.g * s,
      bh * R.g * s
    );
  }
  // gap bridges: drawn with pen 1, or dashed where they only bound the fills
  if (F && F.res.bridges.length) {
    const drawn = $("drawBridges").checked;
    g.save();
    g.strokeStyle = drawn ? $("penColor").value : "#6b7682";
    g.lineWidth = drawn ? Math.max(0.7 * dpr, pen * s) : dpr;
    g.lineCap = "round";
    if (!drawn) g.setLineDash([3 * dpr, 2 * dpr]);
    g.beginPath();
    for (const b of F.res.bridges) {
      g.moveTo((b[0] + ox) * s, (b[1] + oy) * s);
      g.lineTo((b[2] + ox) * s, (b[3] + oy) * s);
    }
    g.stroke();
    g.restore();
  }
  // fills under the drawing, each in its pen's colour and width
  // while playing: the drawing first (pen 1), then each fill pen's strokes, as the plotter would
  const anim = progress !== undefined,
    pLine = anim ? Math.min(1, progress / 0.6) : 1;
  let fillLeft = anim
    ? Math.floor(Math.max(0, (progress - 0.6) / 0.4) * (F ? F.res.fills.reduce((n, q) => n + q.length, 0) : 0))
    : Infinity;
  if (F)
    F.res.fills.forEach((strokes, k) => {
      const p = st.penFill.pens[k];
      if (!p || !strokes.length || fillLeft <= 0) return;
      g.strokeStyle = p.color;
      g.lineWidth = Math.max(0.6 * dpr, p.width * s);
      g.lineCap = "round";
      g.beginPath();
      for (const q of strokes) {
        if (fillLeft-- <= 0) break;
        g.moveTo((q[0] + ox) * s, (q[1] + oy) * s);
        for (let k = 2; k + 1 < q.length; k += 2) g.lineTo((q[k] + ox) * s, (q[k + 1] + oy) * s);
      }
      g.stroke();
    });
  g.strokeStyle = fits ? $("penColor").value : "#b5541f";
  g.lineWidth = Math.max(0.7 * dpr, pen * s);
  g.lineJoin = g.lineCap = "round";
  g.beginPath();
  const upTo = anim ? Math.floor(pLine * (L.x.length - 1)) : L.x.length - 1;
  for (let i = 0; i <= upTo; i++) {
    const X = (L.x[i] + ox) * s,
      Y = (L.y[i] + oy) * s;
    i ? g.lineTo(X, Y) : g.moveTo(X, Y);
  }
  if (!L.open && !anim) g.closePath();
  g.stroke();
  if (anim && pLine < 1) {
    g.fillStyle = css("--accent");
    g.beginPath();
    g.arc((L.x[upTo] + ox) * s, (L.y[upTo] + oy) * s, 4 * dpr, 0, 2 * Math.PI);
    g.fill();
  } // the pen
  g.setTransform(1, 0, 0, 1, 0, 0);
}
function drawPage() {
  const L = st.plot,
    cv = $("pageView");
  if (plotFromArt()) return drawArtPage();
  if (isModel()) {
    // a 3D model: no drawing on the page until Draw this view traces one
    const fit = fitCanvas(cv);
    if (!fit) return;
    const g = cv.getContext("2d"),
      d = fit.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = "#6b7682";
    g.textAlign = "center";
    g.font = `${13 * d}px ${css("--font-body")}`;
    g.fillText("A 3D model is loaded.", cv.width / 2, cv.height / 2 - 10 * d);
    g.fillText(
      "Use Draw this view on the Line step to make a line drawing to plot.",
      cv.width / 2,
      cv.height / 2 + 12 * d
    );
    $("plotInfo").textContent = "3D model";
    return;
  }
  if (!L) {
    const g = cv.getContext("2d");
    g.clearRect(0, 0, cv.width, cv.height);
    $("plotInfo").textContent = st.final ? "" : "nothing traced";
    return;
  } // nothing traced: an empty page
  const { P, mg, fits, ox, oy, F: B } = placeOnPage(L),
    pen = Math.max(0.05, +$("penW").value || 0.5);
  cv.style.aspectRatio = `${B.w} / ${B.h}`;
  cv.style.setProperty("--ar", B.w / B.h);
  const F = st.pfill && st.pfill.line === L ? st.pfill : null;
  const fit = fitCanvas(cv);
  if (fit)
    paintPage(cv, fit.dpr, L, P, mg, fits, ox, oy, pen, F, st.playing || (st.t > 0 && st.t < 1) ? st.t : undefined, B);
  const name = $("paper").selectedOptions[0].textContent.split(" ·")[0];
  $("plotInfo").textContent = `${fmt(L.W, 1)} × ${fmt(L.H, 1)} mm on ${name}`;
  const h = $("pageHint");
  h.className = fits ? "hint" : "hint warn";
  h.textContent = fits
    ? `Centred on ${name} ${$("paperOrient").value} (${fmt(P.w, 0)} × ${fmt(P.h, 0)} mm) with ${fmt(mg, 0)} mm margins. ` +
      (pageFitW() ? "Made for plotting: it fills the page." : "The size comes from the Line step.")
    : `Too big for ${name} ${$("paperOrient").value} with ${fmt(mg, 0)} mm margins (room for ${fmt(P.w - 2 * mg, 0)} × ${fmt(P.h - 2 * mg, 0)} mm). It shows hanging over the paper's edge: make it smaller in the Line step, or pick bigger paper or smaller margins.`;
  if (F && st.penFill.areas.length) {
    // a saved fill whose spot is no longer inside an area (the drawing changed)
    const lost = F.res.seedAreas.reduce((n, ids) => n + ids.filter((i) => i < 0).length, 0);
    if (lost)
      h.textContent += ` ${lost} filled spot${lost === 1 ? " is" : "s are"} no longer inside an area, so ${lost === 1 ? "it isn't" : "they aren't"} filled; click the area again to fill it.`;
  }
  penReadout();
}
onPrintSettings(() => {
  if ($("paper").value === "plate") drawPage();
}); // a new printer, a new plate
$("paper").addEventListener("change", () => {
  $("paperCustomRow").hidden = $("paper").value !== "custom";
  drawPage();
});
for (const id of ["paperOrient"]) $(id).addEventListener("change", drawPage);
for (const id of ["paperMargin", "paperW", "paperH", "penColor"]) $(id).addEventListener("input", drawPage);
$("penW").addEventListener("input", () => {
  drawPage();
  fillsSoon();
}); // the outline's width sets where fills stop
new ResizeObserver(() => drawPage()).observe($("pageView"));

// Made for plotting: a traced drawing fills the page inside its margins, unless a size was set by hand on the Line step
// (st.pageFit false; Fit the page sets it again). The width (mm) that does, or null.
function pageFitW() {
  if (!artForPlot() || st.pageFit === false || st.text || isModel() || !(st.bw > 0 && st.bh > 0)) return null;
  const P = paperSize(),
    mg = Math.max(0, +$("paperMargin").value || 0);
  return Math.max(5, Math.min(P.w - 2 * mg, ((P.h - 2 * mg) * st.bw) / st.bh));
}
let pageFitTimer = null;
function fitPageSoon() {
  clearTimeout(pageFitTimer);
  pageFitTimer = setTimeout(() => {
    const W = pageFitW();
    if (W && st.walk && Math.abs(W - st.outW) / W > 0.003) setSize(W, false);
  }, 300);
}
for (const id of ["paper", "paperOrient", "paperMargin", "paperW", "paperH"])
  $(id).addEventListener(id === "paper" || id === "paperOrient" ? "change" : "input", fitPageSoon);

// the file: the SVG page for Saxi (one layer per pen); Saxi sets the pen speeds
async function plotFile() {
  if (plotFromArt()) {
    const A = artOnPage();
    if (!A || !A.layers.length) throw new Error("only a pattern or text can be plotted as drawn: pick Traced line");
    const w = +$("penW").value || 0.5;
    return {
      // (a pattern made for plotting isn't the traced source)
      name: designSlug(20, st.art.kind === "pattern" ? patternName(st.art.pattern) : null) + "-art.svg",
      data: UNB.exportLayersSVG(
        A.layers.map((l, i) => ({ label: `${i + 1} ${l.name}`, color: l.pen, width: w, strokes: l.strokes })),
        { paperW: A.P.w, paperH: A.P.h, what: lineModeNow() === "strokes" ? "traced into separate strokes" : null }
      ),
      info: `the ${A.layers[0].name} as drawn, ${fmt(A.W, 1)} × ${fmt(A.H, 1)} mm on a ${fmt(A.P.w, 0)} × ${fmt(A.P.h, 0)} mm page`,
    };
  }
  const L = await penLine();
  st.plot = L;
  const F = await computeFills();
  st.pfill = F;
  const { P, fits, ox, oy } = placeOnPage(L),
    base = designSlug(),
    closed = !L.open;
  const fills = st.penFill.pens
    .map((p, k) => ({
      n: k + 2,
      label: `${k + 2} fill`,
      color: p.color,
      width: p.width,
      strokes: F ? F.res.fills[k] || [] : [],
    }))
    .filter((f) => f.strokes.length);
  const bridges = F && $("drawBridges").checked && gapMM() > 0 ? F.res.bridges : [];
  const pens = fills.length + 1,
    nStrokes = fills.reduce((n, f) => n + f.strokes.length, 0);
  const info = `${fmt(L.W, 1)} × ${fmt(L.H, 1)} mm, ${closed ? "closed loop" : "open path"}, ${L.x.length} points${pens > 1 ? `, ${pens} pens (${nStrokes} fill strokes)` : ""}${fits ? "" : ", NOT inside the margins"}`;
  return {
    name: base + "-plot.svg",
    data: UNB.exportPlotSVG(
      { x: L.x, y: L.y },
      {
        paperW: P.w,
        paperH: P.h,
        ox,
        oy,
        pen: +$("penW").value || 0.5,
        color: $("penColor").value,
        closed,
        smooth: $("smooth").checked,
        fills,
        extra: bridges,
      }
    ),
    info: `${info} on a ${fmt(P.w, 0)} × ${fmt(P.h, 0)} mm page`,
  };
}
$("paperCustomRow").hidden = $("paper").value !== "custom";
$("penColor").value = penColorAt(0);
renderPens();
shapesUI();
