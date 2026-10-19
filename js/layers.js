// Unbroken · web app · layers.js
// Layers for the printer: a filled base and walls stacked into one continuous 3D path (UNB.layerStack), its
// readout and side-on preview, and the per-copy paths the G-code export prints.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// ---------- layers ----------
// The filled base and its infill live here, on the 3D tab: the first layers print with the areas the line encloses
// filled (Rings or Lines; with Lines the base alternates between the rows as set and the rows turned 90°), the rest
// are walls: the drawing as the Trace tab shows it. The filled lines are worked out by their own background engine and
// kept
// per drawing, so moving between tabs doesn't redo them.
const layerLinesCache = new WeakMap(); // walk → Map(key → { final, filled, skipped, tooFine }, working px)
let layerTok = 0,
  layerTimer = null;
// The layers engine (LAY) also makes the 2D page's pen line and Draw this view. A newer layers run cancels the layer
// jobs (a filled layer's line, a model's slicing) of the run before it when what it asks for has changed, so nudging a
// big model's height five times doesn't queue five full slices; an export waiting on the layers is never cancelled.
let layerSig = null,
  layerExports = 0;
const isLayerJob = (c) => c.fn === "modelStack" || (c.fn === "stagePrint" && !!(c.args[4] && c.args[4].fill));
function layerSigNow() {
  const M = isModel() && st.model;
  return JSON.stringify([
    isModel(),
    layerSettings(),
    st.finalVer,
    st.zones,
    st.outW,
    cornerMM(),
    +$("uncross").value,
    lineWidthMM(),
    spacingMM(),
    M ? [M.id, M.turns, M.heightMM, M.cut] : null,
    $("support").value,
    $("gOver").value,
    $("wallCount").value,
  ]);
}
// { key, base: [line], wall: line, stack, baseFinal, fillInfo, … } for one copy, mm, plate footprint coordinates
st.layers = null;
function forgetLayers() {
  st.layers = null;
} // st.layers is set only here (layersSoon, layerPaths) and cleared here

// N base layers (0: none) and M layers above; the base's and infill's fill settings (F, for UNB.fillPlan)
function layerSettings() {
  const N = baseCount(),
    F = fillSettings(),
    pat = N > 0 && F.baseDensity > 0 ? F.basePattern : null;
  return { on: N > 0, pat, N, M: intIn("wallLayers", N ? 0 : 1, 500, 1), h: layerHmm(), F };
}
function baseUI() {
  $("wallLayers").min = baseCount() ? 0 : 1;
  infillUI();
}
// Height leads: the height typed (heightGoal, mm) stays put while the base layers or the layer height change, and the
// layers above the base follow (whole layers). null: take it from the layers as they are (after a restore or settings).
// lastHeight: the drawing's height as last shown (never a 3D model's, which is the model's own and lives in st.model)
let heightGoal = null,
  lastHeight = null;
const goalNow = () => {
  if (heightGoal != null) return heightGoal;
  if (lastHeight != null) return lastHeight;
  const S = layerSettings();
  return (S.N + S.M) * S.h;
};
function layersFromHeight(H) {
  const S = layerSettings(),
    total = Math.max(1, Math.round(H / S.h + 1e-9));
  $("wallLayers").value = Math.min(500, Math.max(S.N ? 0 : 1, total - S.N));
}
// any base or infill setting: the readouts, the height (base layers count), and the layers again
for (const id of [
  "baseLayers",
  "baseDensity",
  "basePattern",
  "baseAngle",
  "baseTurn",
  "fillDensity",
  "fillPattern",
  "fillAngle",
  "fillTurn",
]) {
  if (id === "baseLayers")
    $(id).addEventListener(
      "input",
      () => {
        if (!isModel()) {
          const H = goalNow();
          heightGoal = H;
          layersFromHeight(H);
        }
      },
      true
    ); // before the listener below
  $(id).addEventListener(/Pattern$/.test(id) ? "change" : "input", () => {
    baseUI();
    showHeight();
    layersSoon();
    if (document.body.dataset.view === "choc") render();
  });
}
$("layerH").addEventListener(
  "input",
  () => {
    if (!isModel()) layersFromHeight(goalNow());
    showHeight();
    layersSoon(0);
  },
  true
);
// Height (mm): the chocolate from the plate to its top = layers × layer height (base layers + the layers above them).
// Typing a height sets the layers above the base (whole layers, so the height shown snaps to the nearest reachable).
function showHeight() {
  const model = isModel(),
    S = layerSettings(),
    n = S.N + S.M;
  $("layerCount").textContent = model
    ? ""
    : `${n} layer${n === 1 ? "" : "s"}: ${S.N ? `${S.N} base + ${S.M} above` : "no base"} · ${fmt(S.h, 2)} mm each`;
  if (!model) lastHeight = n * S.h;
  if (document.activeElement === $("printHeightMM")) return;
  if (model) {
    if (st.model) $("printHeightMM").value = +printedMM().toFixed(2);
    return;
  }
  $("printHeightMM").value = +(n * S.h).toFixed(2);
}
function forgetHeightGoal() {
  heightGoal = null;
  lastHeight = null;
}
$("printHeightMM").addEventListener("change", () => {
  const H = +$("printHeightMM").value;
  if (isModel()) {
    // a model: scale it evenly to this height
    if (!(H > 0) || !st.model) {
      showHeight();
      return;
    }
    setModelHeight(H);
    return;
  }
  if (!(H > 0)) {
    showHeight();
    return;
  }
  heightGoal = H;
  layersFromHeight(H);
  showHeight();
  recordSoon();
  layersSoon(0);
});
for (const id of ["infillMin", "fillMin"])
  $(id).addEventListener("input", () => {
    infillUI();
    layersSoon();
  });

// one line of the print with this fill (UNB.fillPlan: pattern, spacing px, angle; no pattern: the line on screen in
// Trace). D: the design it's for, st itself or one piece of a text (pieces.js), anything with walk, w, h, crop, outW,
// bw, spacing and final.
async function layerLine(plan, D = st) {
  if (!plan || !plan.pattern) return { final: D.final };
  const fill = plan.pattern,
    angle = plan.angle;
  const walk = D.walk,
    d = pxSpacing(D),
    sc = D.outW / D.bw,
    key = JSON.stringify([
      fill,
      angle,
      plan.spacing,
      d,
      lineRatio(),
      cornerMM(),
      +$("uncross").value,
      CFG.engine.loopRadius,
      st.zones,
      D.outW,
      plan.minArea,
    ]);
  let m = layerLinesCache.get(walk);
  if (!m) layerLinesCache.set(walk, (m = new Map()));
  if (m.has(key)) return m.get(key);
  const r = await LAY.call("stagePrint", [
    walk,
    d,
    D.w,
    D.h,
    {
      w: d * lineRatio(),
      loop: CFG.engine.loopRadius,
      round: cornerMM() / sc,
      fill,
      fillAngle: angle,
      fillSpacing: plan.spacing,
      fillMinArea: (plan.minArea || 0) / sc ** 2,
      termTol: CFG.engine.termTolerance,
      unx: +$("uncross").value,
      minGap: MIN_GAP_PX,
      ...allowSpec(D.w, D.h, D.crop),
    },
  ]);
  const out = { final: r.final, filled: r.filled, skipped: r.skipped, tooFine: r.tooFine };
  m.set(key, out);
  if (m.size > 12) m.delete(m.keys().next().value);
  return out;
}
// a final line (working px) → plate footprint mm (xf: the plate layout's turn and shift for this design),
// simplified like every export
function lineToPlate(f, xf, D = st) {
  const k = D.outW / D.bw,
    b = D.fb,
    n = f.re.length,
    x = new Float64Array(n),
    y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = (f.re[i] - b.x0) * k;
    y[i] = (b.y1 - f.im[i]) * k;
  }
  const L = UNB.plateLocal(x, y, xf),
    s = UNB.simplify(L.x, L.y, st.simplify, !D.open);
  return { x: s.x, y: s.y };
}
async function buildLayers() {
  if (isModel()) return buildModelLayers(); // model.js: a sliced model
  if (piecesOn()) return buildPieceLayers(); // pieces.js: a piece for each line of a text
  const lay = plateNow();
  if (!lay || !st.final) return null;
  const ver = st.finalVer,
    L = await designLayers(st, lay.xf);
  // a new trace landed while the layer lines were worked out: start again on it
  if (st.finalVer !== ver) return buildLayers();
  return L;
}
// One design's layers (D: st, or a piece), its lines turned and moved into its plate footprint by xf. Kept for the
// last few designs and settings, so moving between tabs or pieces doesn't redo them.
const designLayersCache = new Map();
async function designLayers(D, xf) {
  const S = layerSettings();
  const key = JSON.stringify([S, D.finalVer, st.simplify, xf, D.open]);
  if (designLayersCache.has(key)) return designLayersCache.get(key);
  // each layer's line: the base's and the infill's fill plan per layer; the same plan is worked out (and turned to mm)
  // once
  const Fo = Object.assign({}, S.F, { w: pxSpacing(D) * lineRatio() }),
    plans = new Map();
  const lineFor = async (isBase, j) => {
    const P = UNB.fillPlan(Fo, isBase, j),
      k = JSON.stringify(P);
    if (!plans.has(k)) {
      const r = await layerLine(P, D);
      plans.set(k, { r, line: lineToPlate(r.final, xf, D) });
    }
    return plans.get(k);
  };
  const baseL = [],
    wallL = [];
  for (let i = 0; i < S.N; i++) baseL.push(await lineFor(true, i));
  for (let j = 0; j < S.M; j++) wallL.push(await lineFor(false, j));
  const base = baseL.map((q) => q.line),
    walls = wallL.map((q) => q.line),
    wall = walls[0] || null;
  const stack = UNB.layerStack({ base, baseLayers: S.N, wall, walls, wallLayers: S.M, h: S.h, open: D.open });
  const firstFilled = (L) => (L.find((q) => q.r.filled !== undefined) || {}).r || null;
  const L = {
    key,
    S,
    base,
    wall,
    stack,
    walk: D.walk,
    baseFinal: S.pat && baseL.length ? baseL[0].r.final : null,
    fillInfo: firstFilled(baseL),
    infillInfo: firstFilled(wallL),
  };
  designLayersCache.set(key, L);
  if (designLayersCache.size > 16) designLayersCache.delete(designLayersCache.keys().next().value);
  return L;
}
// recompute (debounced) and show: readout, warnings, preview
function layersSoon(delay = 250) {
  clearTimeout(layerTimer);
  layerTimer = setTimeout(async () => {
    if (!layersWanted() || (!st.final && !isModel())) return;
    const my = ++layerTok,
      sig = layerSigNow();
    if (sig !== layerSig && !layerExports) LAY.cancel(isLayerJob); // the older run's layer jobs aren't wanted now
    layerSig = sig;
    $("layerInfo").textContent = "working… (a filled base or many layers can take a few seconds)";
    try {
      const L = await buildLayers();
      if (my !== layerTok || !L) return;
      // a different print (any setting that changed the layers): the slider goes back to every layer, so a view
      // left on a few layers doesn't hide the rest of the new print
      if (!st.layers || st.layers.stack !== L.stack) showEveryLayer();
      st.layers = L;
      layerReadout();
      drawStack();
      render();
      if (stageNow() === "plate") paintPlate($("plate"), true);
    } catch (e) {
      // the plate's fills and moves need the layers
      if (e === CANCELLED) return;
      console.error(e);
      if (my === layerTok) $("layerInfo").textContent = "couldn't build the layers";
    }
  }, delay);
}
// the feed per point: each layer slowed to take at least the seconds per layer (UNB.lapFeeds)
const layerTimeS = () => Math.max(0, +$("layerTime").value || 0);
function stackFeeds(stack) {
  return UNB.lapFeeds(stack, feedMMmin(), layerTimeS(), (CFG.printer.minPrintSpeed || 5) * 60);
}
// Chocolate per copy and per plate (ml), against one full cartridge: the purge line (from the printer's start lines),
// then each copy's line (length × line width × layer height). A cartridge can't be swapped mid-print without a new
// calibration, so the warning says how many copies one cartridge prints.
function cartridgeUse() {
  const L = st.layers;
  if (!L) return null;
  const P = CFG.printer,
    A = (Math.PI * P.cartridgeDiameter ** 2) / 4,
    V = (P.cartridgeVolume || 50) * 1000; // mm²; mm³
  let purge = 0,
    run = 0;
  for (const l of P.startGcode || []) {
    if (/^G92\b/.test(l)) {
      purge += run;
      run = 0;
    }
    const m = /^G[01]\b[^;]*\bE(-?[\d.]+)/.exec(l);
    if (m) run = Math.max(run, +m[1]);
  }
  purge += run; // plunger mm pushed in the start lines (each G92 E0 starts a new count)
  const vol = (Q) => Q.stack.laps.reduce((a, q) => a + q.length, 0) * lineWidthMM() * L.S.h,
    pv = purge * A,
    lay = plateNow(),
    pl = lay ? placements(lay) : [null];
  if (!pl.length) pl.push(null);
  // each placement in print order (a text's pieces differ); how many print before the cartridge runs out
  const each = pl.map((p) => vol(pieceLayersOf(L, p))),
    per = each[0],
    n = each.length;
  let used = pv,
    fit = 0;
  for (const v of each) {
    if (used + v > V + 1e-6) break;
    used += v;
    fit++;
  }
  if (fit === n && !L.pieces) fit = Math.max(n, Math.floor((V - pv) / per + 1e-9)); // room for this many copies
  const total = pv + each.reduce((a, v) => a + v, 0);
  return {
    per: per / 1000,
    purge: pv / 1000,
    total: total / 1000,
    V: V / 1000,
    n,
    fit,
    ok: fit >= n,
    pieces: !!L.pieces,
  };
}
function cartridgeUI() {
  const c = cartridgeUse(),
    h = $("cartHint");
  if (!h) return;
  if (!c) {
    h.hidden = true;
    return;
  }
  h.hidden = false;
  h.className = c.ok ? "hint" : "hint warn";
  const ml = (v) => `${fmt(v, v < 10 ? 1 : 0)} ml`;
  if (c.pieces) {
    // a text's pieces: each line takes its own amount
    h.textContent = c.ok
      ? `Chocolate: ${ml(c.total - c.purge)} for the ${c.n} pieces, ${ml(c.total)} with the purge line, of a ${ml(c.V)} cartridge.`
      : c.fit === 0
        ? `The first piece needs more than a full ${ml(c.V)} cartridge holds. Make the letters smaller or use fewer layers.`
        : `${c.n} pieces need ${ml(c.total)}, more than one ${ml(c.V)} cartridge: it runs out during piece ${c.fit + 1}. Print fewer copies, or refill after piece ${c.fit}.`;
    return;
  }
  h.textContent = c.ok
    ? `Chocolate: ${ml(c.per)} a copy, ${ml(c.total)} with the purge line, of a ${ml(c.V)} cartridge.`
    : c.fit === 0
      ? `One copy needs ${ml(c.per)}, more than a full ${ml(c.V)} cartridge holds. Make it smaller or with fewer layers.`
      : `${c.n} copies need ${ml(c.total)}, more than one ${ml(c.V)} cartridge: it runs out during copy ${c.fit + 1}. Print ${c.fit} cop${c.fit === 1 ? "y" : "ies"}, or refill after copy ${c.fit}.`;
}
function layerReadout() {
  const L = st.layers,
    S = L.S,
    laps = L.stack.laps,
    feed = feedMMs();
  // a text's pieces: metres and minutes for all of them, one of each line
  const all = L.pieces || [L],
    len = all.reduce((a, Q) => a + Q.stack.laps.reduce((b, q) => b + q.length, 0), 0),
    z0 = firstZ(),
    layers = S.N + S.M,
    feeds = all.map((Q) => stackFeeds(Q.stack)),
    lf = { seconds: feeds.reduce((a, f) => a + f.seconds, 0), short: Math.max(...feeds.map((f) => f.short || 0)) };
  const tall = S.h + L.stack.height,
    mins = lf.seconds / 60,
    need = layerTimeS(),
    // by layer: the rim lap belongs to the top one
    slowed = Math.max(
      ...all.map((Q) => Q.stack.laps.filter((q) => q.kind !== "wall-finish" && q.length / feed < need).length)
    );
  const timing = lf.short
    ? `${lf.short} layer${lf.short === 1 ? " is" : "s are"} too short to take ${need} s even at ${fmt(CFG.printer.minPrintSpeed || 5, 0)} mm/s (the slowest the printer goes). Make the design bigger, add copies, or add a filled base. `
    : slowed
      ? `${slowed} of ${layers} layer${layers === 1 ? "" : "s"} slowed to take ${need} s each so the chocolate sets. `
      : "";
  if (!L.model) showHeight(); // the Height box shows this print (not a model left behind)
  cartridgeUI();
  layerSliderUI();
  readyOverride = false;
  readyUI();
  $("fromOver").textContent = $("gOver").value === "" ? `auto: ${fmt(overhangMM(), 2)}` : "";
  $("layerInfo").textContent =
    `${layers} layer${layers === 1 ? "" : "s"} · ${fmt(tall, 1)} mm · ${L.pieces ? `${all.length} lines: ` : ""}${fmt(len / 1000, len < 10000 ? 2 : 1)} m · ~${fmt(mins, mins < 10 ? 1 : 0)} min`;
  const F = L.fillInfo,
    d = pxSpacing(st),
    dens = Math.round(S.F.baseDensity * 100);
  $("infillVal").textContent = !S.N
    ? "none"
    : `${S.N} layer${S.N === 1 ? "" : "s"} · ` +
      (!S.pat
        ? "open (0%)"
        : !(d > 0)
          ? "needs a line spacing (Trace tab)"
          : F && F.tooFine
            ? "too fine to fill at this size"
            : F
              ? `${F.filled || 0} area${F.filled === 1 ? "" : "s"} at ${dens}%` +
                (F.skipped ? ` · ${F.skipped} left open` : "")
              : "");
  const I = L.infillInfo;
  if (I && S.F.infillDensity > 0)
    $("fillVal").textContent =
      `${Math.round(S.F.infillDensity * 100)}% ${S.F.infillPattern} · ${I.filled || 0} area${I.filled === 1 ? "" : "s"}`;
  if (L.model) {
    // a sliced model: say how it was fitted
    $("infillVal").textContent = S.N ? `${S.N} layer${S.N === 1 ? "" : "s"} at ${dens}%` : "none";
    const t = L.terms || [],
      lo = t.length ? Math.min(...t) : 0,
      hi = t.length ? Math.max(...t) : 0,
      hint = $("layerHint");
    hint.className = lf.short ? "hint warn" : "hint";
    hint.hidden = false;
    hint.textContent =
      timing +
      `Sliced every ${fmt(S.h, 2)} mm through the model (the first at ${fmt(z0 / 2, 2)} mm); each layer's outside contour is moved in half a line width${L.walls > 1 ? ` with ${L.walls} walls` : ""} (inside surfaces and holes aren't traced; separate parts are joined by connector strands), ${S.N ? `filled at ${dens}% for the base, ` : ""}${S.F.infillDensity > 0 ? `filled at ${Math.round(S.F.infillDensity * 100)}% above it, ` : ""}and fitted with a Fourier series (${lo === hi ? lo : `${lo}–${hi}`} terms). The layers spiral up with no seam${S.F.infillDensity > 0 ? "" : "; the top is open"}.` +
      (L.empty ? ` ${L.empty} layer${L.empty === 1 ? " had" : "s had"} nothing to cut and repeat the one below.` : "") +
      (L.support && L.support.layers
        ? ` Support: ${L.support.layers} layer${L.support.layers === 1 ? "" : "s"} widened from the plate up so no layer steps out more than ${fmt(overhangMM(), 2)} mm.`
        : "");
    return;
  }
  const h = $("layerHint");
  h.className = lf.short ? "hint warn" : "hint";
  h.textContent = timing.trim();
  h.hidden = !timing;
  $("layerCount").title =
    (S.N
      ? `The ${S.N} base layer${S.N === 1 ? " prints" : "s print"} flat${S.pat ? ` and filled at ${dens}%` : ""}; `
      : "") +
    (st.open
      ? `the line is open, so each wall layer is flat: at the end of the line the needle steps straight up ${fmt(S.h, 2)} mm and traces it back the other way.`
      : `the walls spiral up ${fmt(S.h, 2)} mm per lap with no seam, the flow easing in on the first lap and out on a last level lap.`) +
    ` The line never stops between layers. Height = ${layers} layer${layers === 1 ? "" : "s"} × ${fmt(S.h, 2)} mm = ${fmt(layers * S.h, 2)} mm.`;
}
// The layers in 3D, in the big view: turned about the vertical (stackTurn.az) and tilted (stackTurn.el, 0 = side on,
// π/2 =
// from above); drag to turn, double-click to go back. The height is exaggerated so a few layers stay visible. While
// Play drawing runs on this view, the line grows from the first point with the needle at its tip.
const STACK_TURN0 = { az: -0.55, el: 0.45 },
  stackTurn = { ...STACK_TURN0 };
// what the views show (the switches at the bottom of the Plate and 3D layers views): walls, fill, travel, purge + wipes
const pathShown = () => ({
  wall: $("pvWall").checked,
  fill: $("pvFill").checked,
  travel: $("pvTravel").checked,
  purge: $("pvPurge").checked,
  solid: $("pvSolid").checked,
});
// UNB.readGcode's kinds 0–4 (a wipe shows with the purge)
const PATH_KINDS = ["wall", "fill", "travel", "purge", "purge"];
// The layer slider (3D layers view): the print up to layer k, layer k highlighted and named. At the top: every layer.
function layerUpTo() {
  const L = st.layers,
    n = L ? L.stack.laps.length : 0,
    k = +$("layerUpTo").value;
  return k >= n ? n : Math.max(1, k);
}
function showEveryLayer() {
  const el = $("layerUpTo");
  el.value = el.max; // at the top: layerSliderUI keeps it there whatever the new count is
}
function layerSliderUI() {
  const L = st.layers,
    n = L ? L.stack.laps.length : 0,
    el = $("layerUpTo"),
    all = +el.value >= +el.max;
  el.max = Math.max(1, n);
  if (all || +el.value > n) el.value = n;
  el.disabled = n < 2;
  const m = L ? L.S.N + L.S.M : 0; // layers; a closed line's walls end with one more, level lap
  $("layerUpToVal").textContent =
    n < 2 || +el.value >= n ? `all ${m}` : +el.value > m ? `last lap` : `${el.value} of ${m}`;
}
// what layer k (from 1) is: base or wall, and its fill (UNB.fillPlan, as the layers were built)
function layerName(k) {
  const L = st.layers,
    S = L.S,
    j = k - 1,
    base = j < S.N,
    F = Object.assign({ w: lineWidthMM() }, S.F);
  if (j >= S.N + S.M) return "the last lap: level, the flow easing out";
  const plan = UNB.fillPlan(F, base, base ? j : j - S.N),
    fill = plan.pattern
      ? `${plan.pattern === "lines" ? `lines at ${fmt(((plan.angle % 180) + 180) % 180, 0)}°` : "rings"} · ${Math.round((base ? S.F.baseDensity : S.F.infillDensity) * 100)}%`
      : base
        ? "open"
        : "no infill";
  return `${base ? "base" : "above the base"} · ${fill}`;
}
$("layerUpTo").addEventListener("input", () => {
  layerSliderUI();
  drawStack();
});
// The 3D layers view: the projection, the beads, the plate (Whole plate: the G-code's path for every copy) or one
// copy's
// layers, then the needle and the label. drawStack sets up and runs them.
function drawStack() {
  const cv = $("stackView"),
    L = st.layers;
  if (!cv.getBoundingClientRect().width) return;
  const { dpr } = fitCanvas(cv),
    g = cv.getContext("2d");
  g.clearRect(0, 0, cv.width, cv.height);
  if (!L) return;
  const S = L.stack,
    n = S.x.length;
  if (!n) return;
  const show = pathShown(),
    anim = st.playing || (st.t > 0 && st.t < 1),
    choc = css("--choc"),
    acc = css("--accent");
  const all = copiesShown() ? printPath() : null; // Whole plate: the print as the G-code makes it
  const solid = show.solid,
    P = stackProjection(cv, dpr, S, n, all, solid),
    { TP, zx, pad, k } = P;
  const lw = Math.max(0.6, 0.9 * dpr) / zoomOn(g, "layers", cv).z; // zoom.js
  g.lineJoin = g.lineCap = "round";
  // Solid (as printed): each line a chocolate bead the needle's width, at true height (litBeads)
  const B = lineWidthMM() * k; // a bead's width on screen
  // the layer slider: layers above the chosen one hidden, the chosen one drawn over in the accent colour
  const cut = anim ? S.laps.length : layerUpTo(),
    picked = cut < S.laps.length;
  const mark = (path) => {
    g.globalAlpha = 1;
    g.strokeStyle = acc;
    g.lineWidth = solid ? B : 2 * lw;
    g.stroke(path);
  };
  const zCut = all && picked ? firstZ() + S.z[S.laps[cut - 1].to] + 0.01 : Infinity,
    zLow = all && picked ? firstZ() + (cut > 1 ? S.z[S.laps[cut - 2].to] : -1) + 0.01 : -Infinity;
  const c = { g, S, n, all, show, anim, solid, choc, acc, lw, B, cut, picked, mark, zCut, zLow, ...P };
  let { tip, note } = all ? drawPlateStack(c) : drawLapStack(c);
  const pc = st.layers.pieces && !all && st.pieces && st.pieces.list[st.layers.piece]; // a text's piece: say which
  if (pc) note = `${pc.name} (piece ${st.layers.piece + 1} of ${st.layers.pieces.length})${note ? " · " + note : ""}`;
  if (tip) {
    const [X, Y] = tip;
    g.fillStyle = acc;
    g.beginPath();
    g.arc(X, Y, (4 * lw) / 0.9, 0, 2 * Math.PI);
    g.fill();
    g.strokeStyle = acc;
    g.lineWidth = 1.5 * lw;
    g.beginPath();
    g.moveTo(X, Y);
    g.lineTo(X, Y - 40 * lw);
    g.stroke();
  } // the needle
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = css("--muted");
  g.font = `${10.5 * dpr}px ${css("--font-mono")}`;
  g.textAlign = "left";
  $("layerWhat").textContent = picked && !anim ? layerName(cut) : "";
  g.fillText(
    `${note ? note + " · " : ""}${solid ? `as printed: ${fmt(lineWidthMM(), 2)} mm lines, true height` : `height ×${fmt(zx, 0)}`}`,
    pad,
    pad + 4 * dpr
  );
}
// the view's projection: turned (stackTurn) and tilted, the height exaggerated unless Solid, scaled to the canvas
function stackProjection(cv, dpr, S, n, all, solid) {
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (let i = 0; i < n; i++) {
    x0 = Math.min(x0, S.x[i]);
    x1 = Math.max(x1, S.x[i]);
    y0 = Math.min(y0, S.y[i]);
    y1 = Math.max(y1, S.y[i]);
  }
  const W = all ? BED.w : x1 - x0,
    D = all ? BED.h : y1 - y0,
    H = all ? Math.max(all.zTop, 0.1) : Math.max(S.height, 0.1);
  const zx = solid ? 1 : Math.max(1, Math.min(30, (0.35 * Math.max(W, D)) / H)),
    cx = all ? BED.w / 2 : (x0 + x1) / 2,
    cy = all ? BED.h / 2 : (y0 + y1) / 2;
  const ca = Math.cos(stackTurn.az),
    sa = Math.sin(stackTurn.az),
    ce = Math.cos(stackTurn.el),
    se = Math.sin(stackTurn.el);
  const proj = (x, y, z) => {
    const u = x - cx,
      v = y - cy;
    return [u * ca - v * sa, -((u * sa + v * ca) * se + z * zx * ce)];
  }; // screen x, y (up is negative)
  let a0 = Infinity,
    a1 = -Infinity,
    b0 = Infinity,
    b1 = -Infinity;
  const grow = ([a, b]) => {
    a0 = Math.min(a0, a);
    a1 = Math.max(a1, a);
    b0 = Math.min(b0, b);
    b1 = Math.max(b1, b);
  };
  const bed = [
    [0, 0],
    [BED.w, 0],
    [BED.w, BED.h],
    [0, BED.h],
  ];
  if (all) {
    for (const [x, y] of bed) {
      grow(proj(x, y, 0));
      grow(proj(x, y, H));
    }
  } else for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 20000))) grow(proj(S.x[i], S.y[i], S.z[i]));
  const pad = 16 * dpr,
    label = 18 * dpr,
    k = Math.min(
      (cv.width - 2 * pad) / Math.max(a1 - a0, 1e-6),
      (cv.height - 2 * pad - label) / Math.max(b1 - b0, 1e-6)
    );
  const ox = (cv.width - (a1 - a0) * k) / 2 - a0 * k,
    oy = label + (cv.height - label - (b1 - b0) * k) / 2 - b0 * k;
  const TP = (x, y, z) => {
    const [a, b] = proj(x, y, z);
    return [ox + a * k, oy + b * k];
  };
  return { proj, TP, k, zx, cx, cy, ca, sa, bed, pad };
}
// Lit beads (Solid): each bead shaded by which way its side faces a light from the upper left, with a dark groove
// where it meets its neighbours, so the form and the layer texture read. Segments are drawn layer by layer from the
// bottom and, within a layer, from the back, so nearer beads cover farther ones. seg: [x0, y0, z0, x1, y1, z1] in mm.
function litBeads(c, segs, layerOf) {
  const { g, TP, B, sa, ca, cx, cy } = c;
  const rgb = cssRGBA("--choc"),
    LEVELS = 10;
  const tone = (f) =>
    `rgb(${Math.min(255, Math.round(rgb[0] * f))}, ${Math.min(255, Math.round(rgb[1] * f))}, ${Math.min(255, Math.round(rgb[2] * f))})`;
  const toneOf = Array.from({ length: LEVELS }, (_, i) => {
    const t = i / (LEVELS - 1),
      b = 0.38 + 0.92 * t;
    return { body: tone(b) };
  });
  const groove = tone(0.3),
    shine = "rgba(255, 255, 255, 0.16)";
  const toward = [-sa, -ca],
    left = [-ca, sa],
    lh = [0.8 * left[0] + 0.6 * toward[0], 0.8 * left[1] + 0.6 * toward[1]],
    ll = Math.hypot(lh[0], lh[1]);
  const m = segs.length / 6,
    order = new Uint32Array(m),
    key = new Float64Array(m),
    lev = new Uint8Array(m),
    lay = new Float64Array(m);
  for (let j = 0; j < m; j++) {
    const q = 6 * j,
      dx = segs[q + 3] - segs[q],
      dy = segs[q + 4] - segs[q + 1],
      l = Math.hypot(dx, dy) || 1;
    let nx = -dy / l,
      ny = dx / l;
    if (nx * toward[0] + ny * toward[1] < 0) {
      nx = -nx;
      ny = -ny;
    } // the side facing us
    const diff = Math.max(0, (nx * lh[0] + ny * lh[1]) / ll);
    lev[j] = Math.min(LEVELS - 1, Math.round(Math.pow(diff, 0.8) * (LEVELS - 1)));
    const u = (segs[q] + segs[q + 3]) / 2 - cx,
      v = (segs[q + 1] + segs[q + 4]) / 2 - cy;
    lay[j] = layerOf(j);
    key[j] = lay[j] * 1e6 - (u * sa + v * ca); // bottom layers first; within a layer, the back first
    order[j] = j;
  }
  order.sort((a, b) => key[a] - key[b]);
  const seg = (path, j) => {
    const q = 6 * j,
      [X0, Y0] = TP(segs[q], segs[q + 1], segs[q + 2]),
      [X1, Y1] = TP(segs[q + 3], segs[q + 4], segs[q + 5]);
    path.moveTo(X0, Y0);
    path.lineTo(X1, Y1);
  };
  g.globalAlpha = 1;
  // a layer at a time: its groove (the dark edge where beads meet) under it, then its beads by brightness, then one
  // light streak along their tops, so the colour steps never draw marks across a bead
  for (let a = 0; a < m; ) {
    let b = a;
    while (b < m && lay[order[b]] === lay[order[a]]) b++;
    const gp = new Path2D();
    for (let i = a; i < b; i++) seg(gp, order[i]);
    g.strokeStyle = groove;
    g.lineWidth = B;
    g.stroke(gp);
    let path = null,
      cur = -1;
    const flush = () => {
      if (path) {
        g.strokeStyle = toneOf[cur].body;
        g.lineWidth = 0.8 * B;
        g.stroke(path);
      }
    };
    for (let i = a; i < b; i++) {
      const j = order[i];
      if (lev[j] !== cur) {
        flush();
        path = new Path2D();
        cur = lev[j];
      }
      seg(path, j);
    }
    flush();
    g.save();
    g.translate(0, -0.2 * B);
    g.strokeStyle = shine;
    g.lineWidth = 0.26 * B;
    g.stroke(gp);
    g.restore(); // one unbroken streak per layer
    a = b;
  }
}
// Whole plate: the plate, then every copy's path as the G-code prints it (beads or lines by kind), the slider's layer
function drawPlateStack(c) {
  const { g, all, anim, show, solid, choc, acc, lw, TP, bed, picked, zCut, zLow, mark } = c;
  let tip = null,
    note = "";
  g.strokeStyle = css("--rule");
  g.lineWidth = lw;
  g.beginPath(); // the plate, at z = 0
  bed.forEach(([x, y], i) => {
    const [X, Y] = TP(x, y, 0);
    i ? g.lineTo(X, Y) : g.moveTo(X, Y);
  });
  g.closePath();
  g.stroke();
  const sg = all.seg,
    kd = all.kind,
    m = kd.length,
    upTo = anim ? Math.floor(st.t * m) : m;
  const look = {
    wall: [choc, 1, []],
    fill: [acc, 0.8, []],
    travel: [css("--muted"), 0.7, [4 * lw, 4 * lw]],
    purge: [css("--warn"), 1, []],
  };
  if (solid) {
    // the chocolate as lit beads, layer by layer
    const segs = [];
    for (let i = 0; i < upTo; i++) {
      const nm = PATH_KINDS[kd[i]];
      if ((nm !== "wall" && nm !== "fill") || !show[nm]) continue;
      // above the slider's layer; the layer itself is drawn below
      if (sg[6 * i + 5] > zCut || (picked && sg[6 * i + 5] > zLow)) continue;
      for (let c = 0; c < 6; c++) segs.push(sg[6 * i + c]);
    }
    litBeads(c, segs, (j) => Math.round(segs[6 * j + 5] / 0.05));
  }
  for (const name of ["travel", "fill", "wall", "purge"]) {
    // one path per kind, in this order (walls over fill)
    if (!show[name] || (solid && (name === "fill" || name === "wall"))) continue;
    const [col, alpha, dash] = look[name];
    g.strokeStyle = col;
    g.globalAlpha = alpha;
    g.setLineDash(dash);
    g.lineWidth = name === "travel" ? lw * 0.8 : lw;
    g.beginPath();
    for (let i = 0; i < upTo; i++) {
      if (PATH_KINDS[kd[i]] !== name || sg[6 * i + 5] > zCut || (picked && name !== "travel" && sg[6 * i + 5] > zLow))
        continue;
      const q = 6 * i,
        [X0, Y0] = TP(sg[q], sg[q + 1], sg[q + 2]),
        [X1, Y1] = TP(sg[q + 3], sg[q + 4], sg[q + 5]);
      g.moveTo(X0, Y0);
      g.lineTo(X1, Y1);
    }
    g.stroke();
  }
  g.setLineDash([]);
  g.globalAlpha = 1;
  if (picked) {
    // the chosen layer, every copy
    const path = new Path2D();
    for (let i = 0; i < m; i++) {
      const nm = PATH_KINDS[kd[i]],
        q = 6 * i;
      if ((nm !== "wall" && nm !== "fill") || sg[q + 5] > zCut || sg[q + 5] <= zLow) continue;
      const [X0, Y0] = TP(sg[q], sg[q + 1], sg[q + 2]),
        [X1, Y1] = TP(sg[q + 3], sg[q + 4], sg[q + 5]);
      path.moveTo(X0, Y0);
      path.lineTo(X1, Y1);
    }
    mark(path);
  }
  if (anim && upTo > 0 && upTo < m) {
    const q = 6 * (upTo - 1);
    tip = TP(sg[q + 3], sg[q + 4], sg[q + 5]);
    note = ` · ${PATH_KINDS[kd[upTo - 1]] === "travel" ? "travelling" : PATH_KINDS[kd[upTo - 1]] === "purge" ? (kd[upTo - 1] === 3 ? "purge line" : "wipe") : "printing"}`;
  }
  const pl = placements(plateNow()),
    pc = !!st.layers.pieces;
  note = `${pl.length} ${pc ? "piece" : "cop"}${pl.length === 1 ? (pc ? "" : "y") : pc ? "s" : "ies"} on the plate, as the G-code prints them${note}`;
  return { tip, note };
}
// One copy: its layers (beads, or lines darker towards the top), the slider's layer marked
function drawLapStack(c) {
  const { g, S, n, anim, show, solid, choc, acc, lw, TP, cut, picked, mark } = c;
  let tip = null,
    note = "";
  const upTo = anim ? Math.max(1, Math.floor(st.t * (n - 1))) : n - 1,
    step = Math.max(1, Math.floor(n / 40000));
  if (solid) {
    // the chocolate as lit beads; the slider's layer is marked below
    const segs = [],
      lapOf = [];
    S.laps.forEach((lap, li) => {
      if (lap.from > upTo || li >= cut - (picked ? 1 : 0) || !show[lap.kind === "base" ? "fill" : "wall"]) return;
      const end = Math.min(lap.to, upTo);
      for (let i = lap.from; i < end; i += step) {
        const j = Math.min(end, i + step);
        segs.push(S.x[i], S.y[i], S.z[i], S.x[j], S.y[j], S.z[j]);
        lapOf.push(li);
      }
    });
    litBeads(c, segs, (j) => lapOf[j]);
  }
  S.laps.forEach((lap, li) => {
    if (lap.from > upTo || li >= cut || !show[lap.kind === "base" ? "fill" : "wall"]) return;
    const end = Math.min(lap.to, upTo),
      path = new Path2D();
    for (let i = lap.from; i <= end; i += i + step <= end ? step : 1) {
      const [X, Y] = TP(S.x[i], S.y[i], S.z[i]);
      i === lap.from ? path.moveTo(X, Y) : path.lineTo(X, Y);
    }
    if (picked && li === cut - 1) {
      mark(path);
      return;
    }
    if (solid) return; // drawn above as lit beads
    g.strokeStyle = lap.kind === "base" ? acc : choc;
    g.globalAlpha = 0.35 + (0.65 * (li + 1)) / S.laps.length;
    g.lineWidth = lw;
    g.stroke(path);
  });
  g.globalAlpha = 1;
  if (anim && upTo < n - 1) {
    tip = TP(S.x[upTo], S.y[upTo], S.z[upTo]);
    note = `layer ${S.laps.findIndex((l) => l.to >= upTo) + 1} of ${S.laps.length}`;
  }
  return { tip, note };
}
// drag to turn (left–right about the vertical, up–down to tilt), double-click to go back to the starting angle
(() => {
  const cv = $("stackView");
  let drag = null;
  cv.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY, az: stackTurn.az, el: stackTurn.el };
    cv.setPointerCapture(e.pointerId);
    cv.classList.add("turning");
  });
  cv.addEventListener("pointermove", (e) => {
    if (!drag) return;
    stackTurn.az = drag.az + (e.clientX - drag.x) * 0.01;
    stackTurn.el = Math.min(Math.PI / 2, Math.max(0, drag.el + (e.clientY - drag.y) * 0.01));
    drawStack();
  });
  for (const ev of ["pointerup", "pointercancel"])
    cv.addEventListener(ev, () => {
      drag = null;
      cv.classList.remove("turning");
    });
  cv.addEventListener("dblclick", () => {
    Object.assign(stackTurn, STACK_TURN0);
    drawStack();
  });
})();
new ResizeObserver(() => drawStack()).observe($("stackView"));
for (const id of ["gFeed", "gZ", "layerTime"])
  $(id).addEventListener("input", () => {
    showHeight();
    if (st.layers) layerReadout();
  });
// per copy: the whole stack moved to the copy's place on the plate (bed mm, y up)
async function layerPaths(pl) {
  layerExports++; // a newer layers run won't cancel the jobs this export is waiting on
  try {
    const L = await buildLayers();
    if (!L) return null;
    st.layers = L;
    return copyPaths(L, pl);
  } finally {
    layerExports--;
  }
}
function copyPaths(L, pl) {
  const feeds = new Map(); // each layer slowed to take the seconds per layer, worked out once per stack
  return pl.map((pos) => {
    const Q = pieceLayersOf(L, pos), // a text's pieces: the piece placed here
      S = Q.stack;
    if (!feeds.has(S)) feeds.set(S, stackFeeds(S).f);
    return {
      x: Float64Array.from(S.x, (v) => v + pos.x),
      y: Float64Array.from(S.y, (v) => v + pos.y),
      z: S.z,
      e: S.e,
      f: feeds.get(S),
      laps: S.laps,
    };
  });
}
// the layers printed at a placement: its piece's (a text printed as a piece per line, pieces.js), or the design's
const pieceLayersOf = (L, p) => (L.pieces && p && p.piece != null ? L.pieces[p.piece] || L : L);
// The whole print as the printer will make it: the G-code the export would write, read back (UNB.readGcode) into
// segments by kind (wall, fill, travel, purge, wipe), for the Whole plate views. Kept until something changes.
let printPathCache = null;
function printPath() {
  const L = st.layers,
    lay = L && plateNow();
  if (!lay) return null;
  const pl = placements(lay),
    g = gcodeSettings(),
    key = JSON.stringify([L.key, pl, g, layerTimeS(), CFG.printer.id]);
  if (printPathCache && printPathCache.key === key && printPathCache.L === L) return printPathCache.path;
  const path = UNB.readGcode(UNB.exportGcode(copyPaths(L, pl), g));
  let zTop = 0;
  for (let i = 2; i < path.seg.length; i += 3) zTop = Math.max(zTop, path.seg[i]);
  path.zTop = zTop;
  printPathCache = { key, L, path };
  return path;
}
baseUI();
showHeight();
for (const id of ["copies", "copyGap", "plateRot"])
  $(id).addEventListener("input", () => {
    cartridgeUI();
    readyUI();
  });
