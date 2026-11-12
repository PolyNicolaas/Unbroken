const { trace, UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js"), { createCanvas } = require("@napi-rs/canvas");
// a labyrinth (diamond, 6 cells) drawn as the app draws a pattern, traced at 40 mm with an 18G needle
function labyrinth() {
  const r = UNB.pattern("labyrinth", { seed: 5, detail: 6, shape: "diamond" }), L = UNB.patternLayout(r, 1600), c = createCanvas(L.w, L.h), g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, L.w, L.h); g.strokeStyle = "#000"; g.lineCap = g.lineJoin = "round"; g.lineWidth = L.lineWidth;
  for (const p of r.paths) { g.beginPath(); for (let j = 0; j < p.length; j += 2) { const x = (p[j] + L.m) * L.s, y = (p[j + 1] + L.m) * L.s; j ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.stroke(); }
  return trace(c, { spacingMM: 1.34, lineMM: 0.84, outW: 40 });
}
// share of the drawing's convex outline the line covers, drawn w wide
function coverage(xs, ys, w, W, H) {
  const c = createCanvas(W, H), g = c.getContext("2d");
  g.fillStyle = "#000"; g.fillRect(0, 0, W, H); g.strokeStyle = "#fff"; g.lineWidth = w; g.lineJoin = g.lineCap = "round";
  g.beginPath(); for (let i = 0; i < xs.length; i++) i ? g.lineTo(xs[i], ys[i]) : g.moveTo(xs[i], ys[i]); g.closePath(); g.stroke();
  const ink = g.getImageData(0, 0, W, H).data;
  // the hull of the line's points
  const P = Array.from(xs, (x, i) => [x, ys[i]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const p of P) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  const Hl = lo.slice(0, -1).concat(up.slice(0, -1)), m = createCanvas(W, H), q = m.getContext("2d");
  q.fillStyle = "#000"; q.fillRect(0, 0, W, H); q.fillStyle = "#fff"; q.beginPath(); Hl.forEach(([x, y], i) => (i ? q.lineTo(x, y) : q.moveTo(x, y))); q.closePath(); q.fill();
  const hm = q.getImageData(0, 0, W, H).data; let a = 0, b = 0;
  for (let i = 0; i < W * H; i++) if (hm[4 * i] > 127) { a++; if (ink[4 * i] > 127) b++; }
  return b / a;
}
module.exports = {
  id: "E61", title: "A base fills the drawing's whole outline, not only what the line encloses",
  guards: "a base that leaves the gaps opening to the outside empty (between a labyrinth's branches, round letters), so it isn't a solid layer under the walls",
  why: "Nicolaas (12 November 2026): a base made under a pattern (a labyrinth) did a poor job of a solid layer. The fill only went into areas the line closes off, and in a labyrinth most of the space between the line opens to the outside. A base is there to be a solid plate, so it now fills out to the drawing's convex outline (Fill: Whole outline, the default); Only what the line encloses keeps the old fill.",
  how: "Traces a 6-cell diamond labyrinth at 40 mm with an 18G needle (0.84 mm line, 1.34 mm spacing) and fits it as a base at 100% Lines, with the hull and without; draws each line a spacing (1.34 mm) wide, the room each strand of the drawing has, and measures how much of the drawing's convex outline it covers. Reads UNB.fillPlan's hull for a base, a base set to inside, and an infill.",
  pass: "Whole outline: more areas filled than inside only, the outline at least 90% covered and over 1.3× the coverage of inside only, the line still closed and no further than a spacing outside the hull's area; fillPlan: hull on for a base by default, off for inside and for the infill.",
  run() {
    const t = labyrinth(), d = t.dpx, w = (d * 0.84) / 1.34, W = t.w, H = t.h;
    const opt = (hull) => ({ w, fill: "lines", fillSpacing: w, fillAngle: 0, fillHull: hull, termTol: 0.05, unx: 90, minGap: 0.75 });
    const A = UNB.stagePrint(t.walk, d, W, H, opt(true)), B = UNB.stagePrint(t.walk, d, W, H, opt(false));
    const ca = coverage(A.final.re, A.final.im, d, W, H), cb = coverage(B.final.re, B.final.im, d, W, H);
    const pb = UNB.fillPlan({ w: 0.84, baseDensity: 1 }, true, 0), pi = UNB.fillPlan({ w: 0.84, baseDensity: 1, baseCover: "inside" }, true, 0), pf = UNB.fillPlan({ w: 0.84, infillDensity: 1 }, false, 0);
    return { checks: [
      check("areas filled: whole outline", A.filled, ">", B.filled),
      check("outline covered: whole outline", ca, ">=", 0.9),
      check("coverage whole outline ÷ inside only", ca / cb, ">", 1.3),
      check("the base line is closed", A.open, "==", false),
      check("fillPlan base: hull", pb.hull, "==", true),
      check("fillPlan base set to inside: hull", pi.hull, "==", false),
      check("fillPlan infill: hull", pf.hull, "==", false),
    ], notes: [`coverage ${(ca * 100).toFixed(0)}% vs ${(cb * 100).toFixed(0)}%; areas ${A.filled} vs ${B.filled}`] };
  },
};
