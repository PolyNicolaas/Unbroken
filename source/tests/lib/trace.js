// Headless trace: the same engine stages, in the same order and with the same defaults, as web-app/index.html
// (extract → signal → term pick → series → finalize). Used by the engine tests so they measure what the app draws.
const UNB = require("../../engine/core.js");
const { createCanvas } = require("@napi-rs/canvas");

const DEFAULTS = {                     // the app's "Line drawing" tracing values, with spacing off (the app opens with Needle 18G + 0.5 mm)
  mode: "centerline", res: 500, blur: 1.2, sens: 0, minLen: 15, far: 12, loose: 2, open: false,
  uncross: 90, spacingMM: 0, lineMM: 0, outW: 100, snap: true, roundMM: 0, fill: null, fillAngle: 0,
};
const MIN_GAP_PX = 0.75;               // same constant as the app

function workingImage(src, res) {
  const k = Math.min(1, res / Math.max(src.width, src.height));
  const w = Math.max(8, Math.round(src.width * k)), h = Math.max(8, Math.round(src.height * k));
  const c = createCanvas(w, h), g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.drawImage(src, 0, 0, w, h);
  const gray = UNB.prep(g.getImageData(0, 0, w, h).data, w, h, { brightness: 0, contrast: 0, bgTol: 0, flatten: false });
  return { w, h, k, gray };
}

function trace(src, options) {
  const o = Object.assign({}, DEFAULTS, options || {}), t0 = performance.now(), ms = {};
  const { w, h, k, gray } = workingImage(src, o.res);
  const blurred = UNB.blur(gray, w, h, o.blur);
  let t = performance.now();
  const lines = o.lines || UNB.stageLines(blurred, w, h, { mode: o.mode, sens: o.sens, shade: { style: "off" }, selMask: null, erase: null });
  const walk = UNB.stageWalk(lines, w, h, { minPix: o.minLen, maxJump: o.far ? o.far / 100 * Math.hypot(w, h) : 0, open: o.open, jumpCost: o.loose },
    o.snap ? { blurred, edges: o.mode === "edges" } : null);
  ms.walk = performance.now() - t;
  if (!walk) return { w, h, k, lines, walk: null, ms };
  const bw = Math.max(1, walk.bbox.maxX - walk.bbox.minX), scale = o.outW / bw;          // mm per working px
  const dpx = o.spacingMM > 0 ? o.spacingMM / scale : 0;
  t = performance.now();
  const lineMM = o.lineMM || 0.8 * o.spacingMM;                                       // the app: needle diameter, or 80% of the spacing
  const fillPx = o.fill && o.fillDensity > 0 ? lineMM / scale / o.fillDensity : 0;     // fill rows a line width ÷ density apart (the app's base and infill)
  const sg = UNB.stageSignal(walk, dpx, w, h, { w: o.spacingMM > 0 ? dpx * lineMM / o.spacingMM : 0, round: o.roundMM / scale, fill: o.fill, fillAngle: o.fillAngle, fillMinArea: o.fillMinArea, fillSpacing: fillPx }), S = sg.S, open = sg.open, n0 = open ? S / 2 + 1 : S;
  const Ns = []; for (let n = 4; n < sg.Nmax; n = Math.max(n + 1, Math.round(n * 1.35))) Ns.push(n); Ns.push(sg.Nmax);
  const it = UNB.sweepSteps(sg.sp.ax, sg.sp.order, Ns, sg.jumpS, open); let r = it.next(); while (!r.done) r = it.next();
  const sweep = r.value, N = o.N || UNB.pickTerms(sweep, UNB.TERM_TOL);
  ms.signal = performance.now() - t; t = performance.now();
  const fit = { ax: sg.sp.ax, codes: sg.sp.order.slice(0, N), curve: UNB.synth(sg.sp.ax, sg.sp.order.slice(0, N)) };
  ms.fit = performance.now() - t; t = performance.now();
  const fin = UNB.stageFinal(fit.curve.re.slice(0, n0), fit.curve.im.slice(0, n0), {
    closed: !open, d: fillPx && sg.filled ? Math.min(dpx, fillPx) : dpx, unx: o.uncross, minGap: MIN_GAP_PX, allow: null,
    tags: { group: null, jid: sg.tagS.jid.slice(0, n0), jd: sg.tagS.jd.slice(0, n0) },
    jumps: sg.jumpS.slice(0, n0), pad: 0, walk, path: sg.path, w, h, driftTol: dpx > 0 ? 0.013 * bw : 0 });   // the app: engine.sizeDetail.medium × drawing width
  ms.final = performance.now() - t; ms.total = performance.now() - t0;
  return { w, h, k, lines, walk, sg, sweep, N, fit, fin, open, scale, dpx, ms };
}

module.exports = { trace, workingImage, DEFAULTS, UNB };
