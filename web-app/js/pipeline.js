// Unbroken · web app · pipeline.js
// The trace pipeline: working image → line map → walk → spectrum → series → final line (untangling, spacing,
// measurements), the floating-size search and the term-count chart.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// crop + image prep, cached until the inputs change. The prep and blur run in a background engine (UNB.stagePrep):
// PIPE for traces, another (OPT) for Optimize and Auto threshold so they don't cancel each other.
async function working(res, engine = PIPE) {
  const s = settings(),
    src = st.source;
  if (res === undefined) res = s.res;
  const lv = s.levels && !st.text ? { count: s.levels.count, smooth: s.levels.smooth } : null;
  const key = [
    src.__id,
    JSON.stringify(st.sel),
    res,
    JSON.stringify(s.prep),
    s.invert,
    s.blur,
    JSON.stringify(lv),
  ].join("|");
  if (st.wk && st.wk.key === key) return st.wk;
  let sx = 0,
    sy = 0,
    sw = src.width,
    sh = src.height;
  if (st.sel) {
    // crop to the selection so it gets the full working resolution
    const xs = st.sel.map((p) => p[0] * src.width),
      ys = st.sel.map((p) => p[1] * src.height);
    const x0 = Math.max(0, Math.floor(Math.min(...xs)) - 2),
      y0 = Math.max(0, Math.floor(Math.min(...ys)) - 2);
    const x1 = Math.min(src.width, Math.ceil(Math.max(...xs)) + 2),
      y1 = Math.min(src.height, Math.ceil(Math.max(...ys)) + 2);
    if (x1 - x0 >= 8 && y1 - y0 >= 8) {
      sx = x0;
      sy = y0;
      sw = x1 - x0;
      sh = y1 - y0;
    }
  }
  const k = st.text ? 1 : Math.min(1, res / Math.max(sw, sh)); // text is rasterized at its own resolution
  const w = Math.max(8, Math.round(sw * k)),
    h = Math.max(8, Math.round(sh * k));
  // source → this working image (st.crop: the one on screen, set when a run commits)
  const crop = { sx, sy, kx: w / sw, ky: h / sh };
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, w, h);
  g.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
  const r = await engine.call("stagePrep", [
    g.getImageData(0, 0, w, h).data,
    w,
    h,
    {
      prep: { ...s.prep, bgAt: s.prep.bgAt ? toWork(s.prep.bgAt, crop) : null },
      invert: s.invert,
      blur: s.blur,
      levels: lv,
    },
  ]);
  g.putImageData(new ImageData(r.preview, w, h), 0, 0); // the prepared image as the preview background
  return (st.wk = { key, w, h, small: c, gray: r.gray, blurred: r.blurred, crop, levels: r.levels });
}

// line map for one threshold: detection + selection mask + erasing.
// lineSpec() describes it for the background engine (UNB.stageLines); detect() runs it here (auto threshold,
// optimizer).
function selMask(W) {
  if (!st.sel) return null;
  const { w, h } = W,
    src = st.source,
    { sx, sy, kx, ky } = W.crop;
  const mc = document.createElement("canvas");
  mc.width = w;
  mc.height = h;
  const mg = mc.getContext("2d");
  mg.beginPath();
  st.sel.forEach(([u, v], i) => {
    const x = (u * src.width - sx) * kx,
      y = (v * src.height - sy) * ky;
    i ? mg.lineTo(x, y) : mg.moveTo(x, y);
  });
  mg.closePath();
  mg.fill();
  const a = mg.getImageData(0, 0, w, h).data,
    m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = a[4 * i + 3] >= 128 ? 1 : 0;
  return m;
}
// textMask: one line of a text's letters instead of the whole text (pieces.js); the selection and erasing still apply
function lineSpec(W, sens, textMask) {
  const s = settings(),
    { w, h } = W,
    { sx, sy, kx } = W.crop;
  const erase =
    st.erase && st.erase.length
      ? st.erase.map((o) =>
          o.type === "brush"
            ? { type: "brush", r: o.r * kx, pts: o.pts.map((p) => toWork(p, W.crop)) }
            : { type: "part", ...(([x, y]) => ({ x, y }))(toWork(o.p, W.crop)) }
        )
      : null;
  if (st.text) {
    // typed text: the font strokes themselves, no image detection
    const lines = new Uint8Array(w * h),
      T = textMask || st.text.mask,
      TW = st.text.w;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) lines[y * w + x] = T[(y + sy) * TW + x + sx] || 0;
    const m = selMask(W);
    if (m) for (let i = 0; i < w * h; i++) if (!m[i]) lines[i] = 0;
    if (erase) UNB.erase(lines, w, h, erase);
    return { lines };
  }
  return {
    blurred: W.blurred,
    levels: W.levels ? { lab: W.levels.lab, edge: levelEdgeFlags() } : null, // grey levels: their edges (levels.js)
    mode: s.mode,
    sens,
    split: CFG.engine.packedStrokeSplit,
    selMask: selMask(W),
    erase,
  };
}
function detect(W, sens) {
  const sp = lineSpec(W, sens);
  return sp.lines || UNB.stageLines(sp.blurred, W.w, W.h, sp);
}

function traceArgs(W, s, textMask) {
  // what stageTrace needs for one working image (textMask: one line of a text, pieces.js; it starts where it likes)
  const { w, h } = W,
    startAt = st.start && !textMask ? toWork(st.start, W.crop) : null;
  return [
    lineSpec(W, s.sens, textMask),
    w,
    h,
    {
      minPix: st.text ? 0 : s.minLen,
      maxJump: st.text || !s.far ? 0 : (s.far / 100) * Math.hypot(w, h),
      farShare: CFG.engine.farGroupShare,
      open: s.open,
      startAt,
      jumpCost: s.loose,
      lanes: zoneMask("lane", w, h, W.crop),
    },
    { blurred: W.blurred, edges: !st.text && (s.mode === "edges" || !!W.levels) },
  ]; // traced line moved onto the middle of the ink (or the edge), below a pixel
}
// the walk for one working image: a pattern drawn as one line is followed exactly (art.js gives its points: crossings
// stay crossings, nothing is doubled); anything else, or a pattern with a selection or erasing, is traced
function traceWalk(W, s, engine = PIPE) {
  const v = st.source && st.source.__vector;
  if (!v || st.text || st.sel || (st.erase && st.erase.length)) return engine.call("stageTrace", traceArgs(W, s));
  const { sx, sy, kx, ky } = W.crop;
  return engine.call("stageVector", [
    Float64Array.from(v.x, (x) => (x - sx) * kx),
    Float64Array.from(v.y, (y) => (y - sy) * ky),
    v.closed,
    W.w,
    W.h,
    { startAt: st.start ? toWork(st.start, W.crop) : null },
  ]);
}
async function extract(g, P = Object.create(st), again = false) {
  const s = settings(),
    W = await working();
  guard(g);
  const { w, h } = W;
  const walk = await traceWalk(W, s);
  guard(g);
  Object.assign(P, {
    w,
    h,
    crop: W.crop,
    small: W.small,
    gray: W.gray,
    walk,
    bgCache: null,
    resUsed: st.text ? 0 : s.res,
  });
  if (!walk) {
    // nothing to draw: every view of the old line is cleared too
    Object.assign(P, { final: null, plot: null, pfill: null, finalVer: (st.finalVer || 0) + 1 });
    Object.assign(st, P);
    forgetLayers();
    setChip("No lines found — lower the threshold or the speck filter");
    render();
    drawPlate();
    drawMini();
    drawPage();
    return;
  }
  const b = walk.bbox;
  P.bw = Math.max(1, b.maxX - b.minX);
  P.bh = Math.max(1, b.maxY - b.minY);
  if (!st.text) {
    // now the drawing's proportions are known (a new image, a new selection): trace once more if they call for another
    // resolution
    const old = st.rr;
    st.rr = P.rr = Math.max(w, h) / P.bw; // (workRes reads st.rr: set while the second trace is worked out)
    if (!again && workRes() !== s.res) {
      try {
        return await extract(g, P, true);
      } catch (e) {
        if (st.rr === P.rr && st.walk !== P.walk) st.rr = old;
        throw e;
      } // cancelled before it was committed: put it back
    }
    st.rr = old; // the page sees the new value when this run is committed
  }
  if (st.text) P.outW = P.bw / st.text.ppm;
  P.fitinfo = `${walk.nParts} part${walk.nParts === 1 ? "" : "s"}${walk.dropped ? ` · ${walk.dropped} far part${walk.dropped === 1 ? "" : "s"} dropped` : ""}`;
  await signal(g, P);
}

// painted areas (crossing areas, connector paths) as masks at working resolution
st.zones = { cross: [], lane: [] };
st.zoneVer = 0;
st.zm = {};
function zoneMask(kind, w, h, crop = st.crop) {
  // crop: the working image's (a run in progress) or the one on screen; the brush width follows the same crop, so a
  // re-trace at a new resolution paints the areas as wide as they were drawn
  const list = st.zones[kind];
  if (!list.length || !crop) return null;
  const key = [st.zoneVer, w, h, JSON.stringify(crop)].join("|");
  if (st.zm[kind] && st.zm[kind].key === key) return st.zm[kind].m;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  g.lineCap = "round";
  g.lineJoin = "round";
  g.strokeStyle = "#000";
  for (const sk of list) {
    g.globalCompositeOperation = sk.erase ? "destination-out" : "source-over";
    g.lineWidth = 2 * sk.r * crop.kx;
    g.beginPath();
    sk.pts.forEach((p, i) => {
      const [x, y] = toWork(p, crop);
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    });
    if (sk.pts.length === 1) {
      const [x, y] = toWork(sk.pts[0], crop);
      g.lineTo(x + 0.1, y);
    }
    g.stroke();
  }
  const a = g.getImageData(0, 0, w, h).data,
    m = new Uint8Array(w * h);
  let any = 0;
  for (let i = 0; i < w * h; i++)
    if (a[4 * i + 3] > 64) {
      m[i] = 1;
      any = 1;
    }
  st.zm[kind] = { key, m: any ? m : null, tint: null };
  return st.zm[kind].m;
}
function zoneTint(kind) {
  // coloured overlay canvas for the preview
  const m = zoneMask(kind, st.w, st.h);
  if (!m) return null;
  const z = st.zm[kind];
  if (z.tint) return z.tint;
  const c = document.createElement("canvas");
  c.width = st.w;
  c.height = st.h;
  const g = c.getContext("2d"),
    im = g.createImageData(st.w, st.h);
  const col = cssRGBA(kind === "cross" ? "--zone-cross" : "--zone-lane"),
    a = Math.round(col[3] * 255); // theme.css
  for (let i = 0; i < m.length; i++)
    if (m[i]) {
      im.data[4 * i] = col[0];
      im.data[4 * i + 1] = col[1];
      im.data[4 * i + 2] = col[2];
      im.data[4 * i + 3] = a;
    }
  g.putImageData(im, 0, 0);
  return (z.tint = c);
}

const scale = () => st.outW / st.bw; // output units per working pixel
const pxSpacing = (P) => P.spacing / (P.outW / P.bw);
const cornerMM = () => +$("corner").value / 10;
// The 3D tab's Base (filled layers at the bottom) and Infill (inside the layers above): each a density (0–100%: 100
// puts
// the rows a line width apart, touching), a pattern, and for Lines an angle and how many layers keep it before turning
// 90°
const baseCount = () => intIn("baseLayers", 0, 50, 0);
// the base's pattern, null without a filled base
const infillPattern = () => (baseCount() > 0 && +$("baseDensity").value > 0 ? $("basePattern").value : null);
// Leave small areas open: 0–400 mm², finer steps at the small end (Base: infillMin, Infill: fillMin)
const minAreaMM2 = (id) => 400 * (+$(id).value / 100) ** 2;
const areaText = (a) => (a ? `under ${fmt(a, a < 10 ? 1 : 0)} mm²` : "fill all");
function fillSettings() {
  // for UNB.fillPlan (densities 0–1)
  return {
    baseDensity: +$("baseDensity").value / 100,
    basePattern: $("basePattern").value,
    baseAngle: +$("baseAngle").value || 0,
    baseTurn: intIn("baseTurn", 1, 50, 1),
    infillDensity: +$("fillDensity").value / 100,
    infillPattern: $("fillPattern").value,
    infillAngle: +$("fillAngle").value || 0,
    infillTurn: intIn("fillTurn", 1, 50, 2),
    baseMinArea: minAreaMM2("infillMin"),
    infillMinArea: minAreaMM2("fillMin"),
  }; // mm² (model.js); layerLine scales them to working px
}
const densityText = (v, none) =>
  v <= 0 ? `0% · ${none}` : v >= 100 ? "100% · touching" : `${v}% · rows ${fmt(100 / v, 1)} line widths apart`;
function infillUI() {
  const bd = +$("baseDensity").value,
    fd = +$("fillDensity").value;
  $("baseDensityVal").textContent = densityText(bd, "open");
  $("fillDensityVal").textContent = densityText(fd, "hollow");
  $("baseDirRow").hidden = $("basePattern").value !== "lines";
  document
    .querySelectorAll("#fillTurnF, .field:has(#fillAngle)")
    .forEach((el) => (el.hidden = $("fillPattern").value !== "lines"));
  $("fillVal").textContent = fd > 0 ? `${fd}% ${$("fillPattern").value}` : "none";
  $("infillMinVal").textContent = areaText(minAreaMM2("infillMin"));
  $("fillMinVal").textContent = areaText(minAreaMM2("fillMin"));
} // Round corners: radius in mm (0 = off)
// line width ÷ spacing (needle ÷ needle + gap)
const lineRatio = () => (spacingMM() > 0 ? Math.min(1, lineWidthMM() / spacingMM()) : 0.6);
function allowSpec(w, h, crop = st.crop) {
  return { allowMask: zoneMask("cross", w, h, crop), allowW: w, allowH: h, overlaps: $("overlaps").checked };
}

async function signal(g, P = Object.create(st)) {
  const w = P.walk;
  if (!w) return;
  const d = pxSpacing(P); // strands and loops at the current size (in "Smallest that fits", the size the search found)
  const r = await PIPE.call("stageSignal", [
    w,
    d,
    P.w,
    P.h,
    { w: d * lineRatio(), loop: CFG.engine.loopRadius, round: cornerMM() / (P.outW / P.bw), fill: null },
  ]); // corners rounded, strands d apart, a loop at each stroke end (infill belongs to the 3D tab's base layers)
  guard(g);
  Object.assign(P, {
    open: r.open,
    S: r.S,
    sp: r.sp,
    tagS: r.tagS,
    jumpS: r.jumpS,
    connRuns: r.connRuns,
    Nmax: r.Nmax,
    path: r.path,
  });
  if (P.N > P.Nmax) P.N = P.Nmax;
  await fit(g, P, true);
}

async function fit(g, P = Object.create(st), newSignal = false) {
  if (!P.sp) return;
  const codes = P.sp.order.slice(0, P.N); // the N strongest axis terms (x or y at one frequency)
  P.fit = { ax: P.sp.ax, codes, curve: await PIPE.call("synth", [P.sp.ax, codes]) };
  guard(g);
  P.codes = codes;
  await finalize(g, P, newSignal);
  await sizeMarks(g);
}

// ---------- size: one slider from the smallest size that fits up to the plate (Keep within the plate, 3D tab) or 1 m
// ----------
// The slider's marks are the smallest widths where the finished print (strands, a loop at each stroke end, crossings
// removed) keeps the spacing, at three detail levels: how far lines may move from the drawing to make room
// (settings.js engine.sizeDetail). They're found on the trace at the base working resolution, the one every print up
// to about 100 mm uses; bigger prints are traced finer (workRes), so they keep finer detail from the image.
const SIZE_MARKS = [
  ["smallest", "smallest"],
  ["medium", "medium detail"],
  ["high", "high detail"],
];
st.marks = null; // { smallest, medium, high, fits } in mm, or null (no spacing, or text)
let marksKey = null;
const marksCache = new Map(); // marks for recent inputs, so undo / redo don't search again
const baseRes = () => CFG.baseResolution; // settings.js defaults.workingResolution
// px to trace at for the current print size: the base per 100 mm of the image's long side, in 10% steps (so a slider
// drag doesn't re-trace at every pixel), never fewer than the base, never finer than the image or maxWorkingResolution
function workRes() {
  const base = baseRes(),
    src = st.source;
  // the image's long side in the print (rr: image long side ÷ drawing width, found by the last trace of this image)
  const longMM = st.outW * (st.rr || 1);
  const want = (longMM * base) / 100,
    steps = want > base ? Math.ceil(Math.log(want / base) / Math.log(1.1) - 1e-9) : 0;
  const r = Math.min(CFG.engine.maxWorkingResolution, Math.round(base * 1.1 ** steps));
  return src ? Math.min(r, Math.max(base, src.width, src.height)) : r;
}
// widest drawing that fits on the plate
const plateW = () => (st.bh ? Math.min(BED.w, (BED.h * st.bw) / st.bh) : BED.w);
const SIZE_TOP = 1000; // mm: the slider's top when the size isn't kept to the plate
const limitToPlate = () => $("limitPlate").checked;
function sizeAnchors() {
  // [width mm, slider position 0–1]: the marks evenly spread, then up to the top
  const m = st.marks,
    hi = limitToPlate() ? plateW() : Math.max(SIZE_TOP, plateW(), st.outW || 0),
    a = [];
  if (m && m.fits)
    for (const [k] of SIZE_MARKS) if (m[k] < hi && (!a.length || m[k] > a[a.length - 1][0] * 1.005)) a.push([m[k], 0]);
  if (!a.length) a.push([Math.min(5, hi / 2), 0]);
  a.push([hi * 1.0001, 0]);
  const n = a.length - 1;
  // marks a quarter of the track apart, the rest of the track up to the plate
  a.forEach((p, i) => (p[1] = n === 1 ? i : i < n ? i * 0.25 : 1));
  return a;
}
function sliderFromW(W) {
  const a = sizeAnchors();
  W = Math.min(Math.max(W, a[0][0]), a[a.length - 1][0]);
  for (let i = 1; i < a.length; i++)
    if (W <= a[i][0]) {
      const [w0, p0] = a[i - 1],
        [w1, p1] = a[i];
      return p0 + ((p1 - p0) * Math.log(W / w0)) / Math.log(w1 / w0);
    }
  return 1;
}
function wFromSlider(p) {
  const a = sizeAnchors();
  for (let i = 1; i < a.length; i++)
    if (p <= a[i][1]) {
      const [w0, p0] = a[i - 1],
        [w1, p1] = a[i];
      return w0 * Math.pow(w1 / w0, (p - p0) / (p1 - p0));
    }
  return a[a.length - 1][0];
}
function syncSizeUI() {
  if (st.text) return;
  $("sizeSlider").value = Math.round(1000 * sliderFromW(st.outW));
  const box = $("sizeMarks"),
    a = sizeAnchors(),
    m = st.marks;
  box.textContent = "";
  const mark = (W, label, tip) => {
    const el = document.createElement("span"),
      p = sliderFromW(W);
    el.style.left = `${100 * p}%`;
    el.textContent = `${label}\n${fmt(W, W < 100 ? 1 : 0)}`;
    el.title = tip;
    el.dataset.w = W;
    if (p < 0.02) el.className = "first";
    else if (p > 0.98) el.className = "last";
    if (Math.abs(W - st.outW) / W < 0.01) el.classList.add("on");
    if (box.children.length % 2) el.classList.add("up"); // every other mark above the track, so labels don't collide
    box.appendChild(el);
  };
  if (m && m.fits)
    for (const [k, name] of SIZE_MARKS)
      if (a.some(([w]) => w === m[k]))
        mark(m[k], k, `${name[0].toUpperCase() + name.slice(1)}: ${fmt(m[k], 1)} mm wide`);
  mark(plateW(), "plate", `Widest that fits on the ${BED.w} × ${BED.h} mm plate`);
  box.parentElement.classList.toggle("has-up", !!box.querySelector(".up"));
  const h = $("sizeHint"),
    u = "mm";
  if (!(st.spacing > 0)) {
    h.className = "hint";
    h.textContent = "Set a line spacing or needle to find the smallest size that fits.";
  } else if (!m) {
    h.className = "hint";
    h.textContent = "Finding the smallest size that fits (a few seconds)…";
  } else if (!m.fits) {
    h.className = "hint warn";
    h.textContent = `Even at the plate size some lines can't be kept ${fmt(st.spacing, 2)} ${u} apart. Lower the spacing, or simplify the image.`;
  } else {
    const more = SIZE_MARKS.slice(1)
      .filter(([k]) => Number.isFinite(m[k]))
      .map(([k, name]) => `${name} from ${fmt(m[k], 1)} ${u}`)
      .join(", ");
    h.className = "hint";
    h.textContent = `Smallest that keeps every line ${fmt(st.spacing, 2)} ${u} apart: ${fmt(m.smallest, 1)} ${u}${more ? `; ${more}` : ""}.`;
  }
}
// A new picture that knows its own best width (geometric art: where its gaps between neighbouring lines are the line
// spacing, so nothing needs pushing apart) starts there instead of on the starting mark. Call it right after setSource,
// before the trace starts. aspect: the drawing's width ÷ height, to keep it on the plate.
function startSize(W, aspect) {
  if (!(W > 0)) return;
  st.outW = limitToPlate() ? Math.min(W, BED.w, BED.h * (aspect || 1)) : W;
  st.sizeUser = true;
  $("outW").value = +st.outW.toFixed(1);
}
// a new width (slider, a mark, the boxes, or the marks moving): trace again finer if the print got bigger, else lay out
// the strands again
function setSize(W, byUser) {
  const m = st.marks;
  if (limitToPlate()) W = Math.min(W, plateW());
  if (m && m.fits) W = Math.max(W, m.smallest);
  if (!(W > 0)) return;
  st.outW = W;
  if (byUser) {
    st.sizeUser = true;
    recordSoon();
    artSized(W); // art.js: a pattern keeps the width set by hand
  } // an undo step even when nothing needs tracing again
  $("outW").value = +W.toFixed(1);
  syncHeight();
  syncSizeUI();
  if (!byUser) {
    amendHistory();
    autoRun = true;
  } // part of the change that moved the marks, not an undo step
  afterSize();
}
function marksKeyNow() {
  const s = settings();
  delete s.res;
  return JSON.stringify([
    st.source && st.source.__id,
    s,
    baseRes(),
    st.sel,
    st.erase,
    st.start,
    st.zones,
    st.spacing,
    lineRatio(),
    CFG.engine.loopRadius,
    CFG.engine.sizeDetail,
    +$("uncross").value,
    $("overlaps").checked,
    cornerMM(),
    BED.w,
  ]); // BED.w: the search goes up to 1.5 × the plate
}
async function sizeMarks(g) {
  if (st.text || !st.walk) return;
  if (!(st.spacing > 0)) {
    if (st.marks) {
      st.marks = null;
      marksKey = null;
    }
    syncSizeUI();
    return;
  }
  const key = marksKeyNow();
  if (key === marksKey) return;
  const known = marksCache.get(key);
  if (known) {
    st.marks = known;
    marksKey = key;
    return placeSize();
  }
  st.marks = null;
  syncSizeUI();
  let walk = st.walk,
    w = st.w,
    h = st.h,
    allow = null;
  if (st.resUsed !== baseRes()) {
    // the print is traced finer than the base: trace the base for the marks
    const keepWk = st.wk,
      s = settings(),
      W = await working(baseRes());
    guard(g);
    allow = allowSpec(W.w, W.h, W.crop); // crossing areas drawn at the base resolution
    st.wk = keepWk; // the working image on screen stays the cached one
    walk = await traceWalk(W, s);
    guard(g);
    w = W.w;
    h = W.h;
    if (!walk) {
      st.marks = { fits: false };
      marksKey = key;
      syncSizeUI();
      return;
    }
  }
  const bw = Math.max(1, walk.bbox.maxX - walk.bbox.minX),
    m = { fits: true },
    maxW = BED.w * 1.5;
  let cur = st.outW;
  for (const [k] of SIZE_MARKS) {
    const res = await PIPE.call(
      "smallestPrintSteps",
      [
        walk,
        w,
        h,
        {
          spacing: st.spacing,
          bboxW: bw,
          lineRatio: lineRatio(),
          loop: CFG.engine.loopRadius,
          roundMM: cornerMM(),
          termTol: CFG.engine.termTolerance,
          current: cur,
          maxW,
          minW: 2,
          maxShift: CFG.engine.sizeDetail[k],
          maxAngle: +$("uncross").value,
          minGap: MIN_GAP_PX,
          ...(allow || allowSpec(w, h)),
        },
      ],
      (v) => {
        if (g === gen) $("sizeInfo").textContent = `finding sizes… ${fmt(v.width, 1)} mm`;
      }
    );
    guard(g);
    m[k] = res.width;
    cur = res.width;
    if (!res.fits) {
      if (k === "smallest") {
        m.fits = false;
        break;
      }
      m[k] = Infinity;
    } // a level that never fits gets no mark
  }
  st.marks = m;
  marksKey = key;
  marksCache.set(key, m);
  if (marksCache.size > 30) marksCache.delete(marksCache.keys().next().value);
  placeSize();
}
// After the marks change. A new picture starts on the starting mark (settings.js defaults.size), once; from then on the
// size stays where it is when the line width, gap or anything else moves the marks, so changing the gap doesn't change
// the print's size. Only when the size has become too small to keep the lines apart does it grow, to the new smallest,
// and says so.
function placeSize() {
  const m = st.marks,
    pref = CFG.defaults.size,
    first = !st.sizeUser;
  let target = first && m.fits && typeof pref === "string" ? m[pref] : st.outW;
  if (!Number.isFinite(target)) target = st.outW;
  if (first && m.fits) st.sizeUser = true; // placed once: the size is yours now
  syncSizeUI();
  const grow = !first && m.fits && m.smallest > st.outW * 1.003;
  if (grow)
    toast(
      `Made bigger, ${fmt(st.outW, 1)} → ${fmt(m.smallest, 1)} mm: lines ${fmt(st.spacing, 2)} mm apart don't fit any smaller`,
      true
    );
  if (Math.abs(Math.max(target, m.fits ? m.smallest : 0) - st.outW) / st.outW > 0.003) setSize(target, false);
  else finalizeReadout();
}
$("sizeSlider").addEventListener("input", () => setSize(wFromSlider(+$("sizeSlider").value / 1000), true));
$("sizeMarks").addEventListener("click", (e) => {
  const el = e.target.closest("span");
  if (el) setSize(+el.dataset.w, true);
});

// smallest gap kept between strands when removing all crossings (settings.js engine)
const MIN_GAP_PX = CFG.engine.minStrandGap;
async function finalize(g, P = Object.create(st), newSignal = false) {
  const d = pxSpacing(P),
    n0 = P.open ? P.S / 2 + 1 : P.S,
    closed = !P.open,
    unx = +$("uncross").value;
  const f = P.fit.curve;
  const r = await PIPE.call("stageFinal", [
    f.re.slice(0, n0),
    f.im.slice(0, n0),
    {
      closed,
      d,
      unx,
      minGap: MIN_GAP_PX,
      ...allowSpec(P.w, P.h, P.crop),
      tags: { group: null, jid: P.tagS.jid.slice(0, n0), jd: P.tagS.jd.slice(0, n0) },
      jumps: P.jumpS.slice(0, n0),
      pad: (0.5 * lineWidthMM()) / (P.outW / P.bw),
      walk: P.walk,
      path: P.path,
      driftTol: d > 0 ? CFG.engine.sizeDetail.medium * P.bw : 0,
    },
  ]);
  guard(g);
  Object.assign(P, {
    final: r.final,
    jumpF: r.jumpF,
    fb: r.fb,
    mbox: r.mbox,
    err: r.err,
    gap: r.gap,
    gapProbe: r.gapProbe,
    problems: r.problems,
  });
  // ---- commit: everything above was worked out on a draft; the page only ever sees a finished result ----
  const fitinfo = P.fitinfo;
  delete P.fitinfo;
  P.finalVer = (st.finalVer || 0) + 1; // a new final line: caches built from it (plate, layers, pen line) key on this
  Object.assign(st, P);
  if (fitinfo) $("fitinfo").textContent = fitinfo;
  if (st.text) $("outW").value = +st.outW.toFixed(1);
  syncHeight();
  if (newSignal) setSliderFromN();
  buildEpicycles();
  labels(); // labels: image-side sliders show mm at this size
  $("uncrossVal").textContent =
    r.inArea && $("overlaps").checked
      ? `${r.inArea} kept (overlaps)` + (r.after ? ` · ${r.after} left` : "") // (the rest were undone)
      : (unx > 0 ? `${r.before} → ${r.after}` : `${r.after}`) + (r.inArea ? ` · ${r.inArea} in crossing areas` : "");
  finalizeReadout();
  const pc = st.problems.crossings.length,
    pt = st.problems.tight.length;
  $("probInfo").textContent = pc + pt ? `${pc}${d > 0 ? "+" + pt : ""}` : "none";
  $("viewBadge").textContent = pc + pt;
  $("viewBadge").hidden = !$("showProb").checked || !(pc + pt);
  $("probInfo").title =
    `${pc} crossing${pc === 1 ? "" : "s"}` +
    (d > 0 ? `, ${pt} spot${pt === 1 ? "" : "s"} closer than the spacing` : "");
  readouts();
  render();
  renderMath();
  drawPlate();
  drawMini();
  if (newSignal) chartSweep();
}

function finalizeReadout() {
  // the printed size (strands and loops included), and how far above the smallest
  if (st.text || !st.fb) {
    $("driftHint").hidden = true;
    return;
  }
  const sc = scale(),
    b = st.fb,
    m = st.marks;
  $("sizeInfo").textContent =
    `${fmt((b.x1 - b.x0) * sc, 1)} × ${fmt((b.y1 - b.y0) * sc, 1)} mm` +
    (m && m.fits ? ` · ×${fmt(st.outW / m.smallest, 1)} smallest` : "");
  const share = (st.problems && st.problems.driftShare) || 0,
    dh = $("driftHint"); // the line pushed off the drawing (shaded in the preview)
  dh.hidden = share < 0.025; // the marks allow 2%: say so only past that
  if (!dh.hidden)
    dh.textContent = `At this size ${fmt(100 * share, 0)}% of the line is pushed more than ${fmt(CFG.engine.sizeDetail.medium * st.outW, 1)} mm off the drawing to keep the spacing${$("showDrift").checked ? " (shaded orange)" : ""}.${m && m.fits && Number.isFinite(m.medium) && st.outW < m.medium ? ` Medium detail from ${fmt(m.medium, 1)} mm.` : " Make it bigger to bring it back."}`;
  syncSizeUI();
  artSizeUI(); // art.js: the Pattern card's width and gap
}

// ---------- error sweep for the chart (its own background engine, so it doesn't hold up the trace) ----------
let sweepTok = 0;
function chartSweep() {
  const my = ++sweepTok,
    g0 = gen,
    Ns = []; // g0: the run this sweep belongs to
  for (let n = 4; n < st.Nmax; n = Math.max(n + 1, Math.round(n * 1.35))) Ns.push(n);
  Ns.push(st.Nmax);
  st.sweep = [];
  AUX.cancel();
  drawChart();
  AUX.call("sweepSteps", [st.sp.ax, st.sp.order, Ns, st.jumpS, st.open], (p) => {
    if (my === sweepTok) {
      st.sweep.push(p);
      drawChart();
    }
  })
    .then(() => {
      if (my !== sweepTok) return;
      drawChart();
      if (st.autoPending && g0 === gen) {
        st.autoPending = false;
        applyAuto();
      }
    }) // a newer run started meanwhile: its own sweep picks the terms
    .catch((e) => {
      if (e === CANCELLED) return;
      console.error(e);
      if (my === sweepTok) {
        st.autoPending = false;
        if (!PIPE.busy) setBusy(false);
      }
    });
}
function applyAuto() {
  if (!st.sweep || !st.sweep.length) return;
  // fewest terms that keep 95% of the line within the tolerance (settings.js engine)
  st.N = UNB.pickTerms(st.sweep, CFG.engine.termTolerance);
  setSliderFromN();
  amendHistory();
  autoRun = true;
  schedule(fit);
  // even the most terms didn't reach the tolerance: say so, rather than quietly settling for the limit
  const last = st.sweep[st.sweep.length - 1],
    short = st.N >= st.Nmax && last.p95 > CFG.engine.termTolerance;
  if (short) $("termsVal").textContent += " · at the limit";
  $("auto").title =
    `Fewest terms that keep 95% of the line within ${fmt(CFG.engine.termTolerance * scale(), 2)} mm of its path`;
  $("termsVal").title = short
    ? `Even ${st.Nmax} terms leave some of the line up to ${fmt(last.p95 * scale(), 2)} mm from its path, so the finest detail is smoothed. A bigger print or a simpler image helps.`
    : "";
}
