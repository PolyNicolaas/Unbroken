const { trace, UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js"), { createCanvas } = require("@napi-rs/canvas");
// segments of one path (flat [x, y, …]), with the closing one for a loop
function segments(p, closed) {
  const s = [], n = p.length / 2;
  for (let i = 0; i + 1 < n; i++) s.push([p[2 * i], p[2 * i + 1], p[2 * i + 2], p[2 * i + 3]]);
  if (closed) s.push([p[2 * n - 2], p[2 * n - 1], p[0], p[1]]);
  return s;
}
const side = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
const crosses = (s, t) => side([s[0], s[1]], [s[2], s[3]], [t[0], t[1]]) * side([s[0], s[1]], [s[2], s[3]], [t[2], t[3]]) < 0 && side([t[0], t[1]], [t[2], t[3]], [s[0], s[1]]) * side([t[0], t[1]], [t[2], t[3]], [s[2], s[3]]) < 0;
const ptSeg = (x, y, s) => { const dx = s[2] - s[0], dy = s[3] - s[1], L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((x - s[0]) * dx + (y - s[1]) * dy) / L)) : 0; return Math.hypot(x - s[0] - t * dx, y - s[1] - t * dy); };
const segDist = (a, b) => Math.min(ptSeg(a[0], a[1], b), ptSeg(a[2], a[3], b), ptSeg(b[0], b[1], a), ptSeg(b[2], b[3], a));
// crossings, and the closest two parts of the line come that are more than 3 gaps apart along it (÷ the gap it
// reports). Segments go in a grid of cells a gap wide, so only neighbours are compared.
function shape(r) {
  const S = segments(r.paths[0], r.closed[0]), m = S.length, cum = [0], G = r.gap, cells = new Map();
  for (const s of S) cum.push(cum[cum.length - 1] + Math.hypot(s[2] - s[0], s[3] - s[1]));
  S.forEach((s, i) => {
    for (let x = Math.floor(Math.min(s[0], s[2]) / G) - 1; x <= Math.floor(Math.max(s[0], s[2]) / G) + 1; x++)
      for (let y = Math.floor(Math.min(s[1], s[3]) / G) - 1; y <= Math.floor(Math.max(s[1], s[3]) / G) + 1; y++) {
        const k = x + "," + y;
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k).push(i);
      }
  });
  let cross = 0, near = Infinity;
  const done = new Set();
  for (const list of cells.values())
    for (let a = 0; a < list.length; a++)
      for (let b = a + 1; b < list.length; b++) {
        const i = Math.min(list[a], list[b]), j = Math.max(list[a], list[b]);
        if (j - i < 2 || (r.closed[0] && i === 0 && j === m - 1) || done.has(i * m + j)) continue;
        done.add(i * m + j);
        if (crosses(S[i], S[j])) cross++;
        let along = cum[j] - cum[i + 1];
        if (r.closed[0]) along = Math.min(along, cum[m] - (cum[j + 1] - cum[i]));
        if (along > 3 * G) near = Math.min(near, segDist(S[i], S[j]));
      }
  return { cross, near: near / G };
}
// the picture the app traces (web-app/js/patterns.js drawArt), at the app's 1600 px
function picture(r) {
  const L = UNB.patternLayout(r, 1600), c = createCanvas(L.w, L.h), g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, L.w, L.h); g.strokeStyle = "#000"; g.lineCap = g.lineJoin = "round"; g.lineWidth = L.lineWidth;
  r.paths.forEach((p, i) => { g.beginPath(); for (let j = 0; j < p.length; j += 2) { const x = (p[j] + L.m) * L.s, y = (p[j + 1] + L.m) * L.s; j ? g.lineTo(x, y) : g.moveTo(x, y); } if (r.closed[i]) g.closePath(); g.stroke(); });
  return c;
}
module.exports = {
  id: "E33", title: "Geometric art: every style draws the line it promises, and the one-line styles trace as one line",
  guards: "a pattern that crosses itself or touches where it promises an even gap, a closed style that doesn't close, a seed that doesn't give the same pattern again, and a one-line pattern the tracer breaks up or doubles",
  why: "The Geometric art card makes patterns as pictures to trace (UNB.pattern, source/engine/13-patterns.js). Labyrinth, Moore loop and Double spiral promise one closed line, and Hilbert, Gosper, Whirl and Waves one open line, with an even gap between neighbouring lines: that is what makes them print in chocolate without doubled strokes. The app draws them with UNB.patternLayout and starts them at the width where that gap is the line spacing.",
  how: "Makes every style at its starting values and at both ends of its sliders (and with other sides and shapes where it has them); checks each path's points, its crossings (a loop's closing step included) and the closest approach of non-neighbouring parts against the gap it reports; makes the seeded styles twice with one seed and once with another; then draws each one-line style at the app's size and traces it with the app's defaults.",
  pass: "Every pattern has points and a box; the one-line styles are one path with no crossings and nothing closer than 0.75 × their gap; the same seed gives the same pattern and another seed a different one; every one-line style traces as 1 part with no doubled strokes (under 1% of the walk) and no connectors.",
  async run(ctx) {
    const checks = [], bad = [], notes = [];
    for (const [key, P] of Object.entries(UNB.PATTERNS)) {
      const vars = [{}, { detail: P.detail.min }, { detail: P.detail.max }];
      if (P.twist) vars.push({ twist: P.twist.min }, { twist: P.twist.max });
      if (P.sides) vars.push({ sides: 0 }, { sides: 3 }, { sides: 6 });
      if (P.shape) for (const s of UNB.PATTERN_SHAPES) vars.push({ shape: s });
      for (const v of vars) {
        const o = { seed: 5, sides: 4, shape: "square", ...v }, r = UNB.pattern(key, o), name = `${key} ${JSON.stringify(v)}`;
        if (!r || !r.paths.length || !r.paths.every((p) => p.length >= 4 && p.every(Number.isFinite)) || !(r.box[0] > 0 && r.box[1] > 0 && r.gap > 0)) { bad.push(`${name}: empty or not finite`); continue; }
        if (!P.oneLine) continue;
        if (r.paths.length !== 1) { bad.push(`${name}: ${r.paths.length} paths`); continue; }
        const sh = shape(r);   // (a loop's closing step counts like every other)
        if (sh.cross) bad.push(`${name}: ${sh.cross} crossings`);
        if (sh.near < 0.75) bad.push(`${name}: parts ${sh.near.toFixed(2)} × the gap apart`);
      }
      if (P.seed) {
        const a = UNB.pattern(key, { seed: 11 }), b = UNB.pattern(key, { seed: 11 }), c = UNB.pattern(key, { seed: 12 });
        if (JSON.stringify(a.paths) !== JSON.stringify(b.paths)) bad.push(`${key}: the same seed gave another pattern`);
        if (JSON.stringify(a.paths) === JSON.stringify(c.paths)) bad.push(`${key}: another seed gave the same pattern`);
      }
    }
    checks.push(check("patterns that break their promise", bad.length, "==", 0));
    // traced like the app: one part, nothing doubled, no connectors
    let traced = 0;
    for (const [key, P] of Object.entries(UNB.PATTERNS)) {
      if (!P.oneLine) continue;
      const r = UNB.pattern(key, { seed: 3, sides: 4, shape: "square" }), t = trace(picture(r), { open: P.line === "open" }), w = t.walk;
      const parts = w ? w.nParts : 0, dbl = w ? w.doubledFrac : 1, jumps = t.sg ? t.sg.connRuns : -1;
      notes.push(`${key} ${parts} part, ${(100 * dbl).toFixed(1)}% doubled, ${t.N} terms, error ${t.fin ? (t.fin.err.score * t.scale).toFixed(3) : "–"} mm`);
      if (parts !== 1 || dbl > 0.01 || jumps !== 0) bad.push(`${key} traced: ${parts} parts, ${(100 * dbl).toFixed(1)}% doubled, ${jumps} connectors`); else traced++;
    }
    checks.push(check("one-line styles that trace as one line", traced, "==", Object.values(UNB.PATTERNS).filter((P) => P.oneLine).length));
    return { checks, notes: (bad.length ? bad.join("  \n") + "  \n" : "") + notes.join("  \n") };
  },
};
