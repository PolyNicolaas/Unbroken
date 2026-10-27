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
// a test portrait for the patterns drawn from a picture (300 × 400): light background, a darker face, dark eyes,
// nose, mouth and hair; as the app hands it over: darkness 0 (white) … 1 (black) per pixel
function portraitTone() {
  const c = createCanvas(300, 400), g = c.getContext("2d");
  g.fillStyle = "#f4f4f4"; g.fillRect(0, 0, 300, 400);
  const r = g.createRadialGradient(140, 170, 20, 150, 190, 130); r.addColorStop(0, "#e0e0e0"); r.addColorStop(1, "#555"); g.fillStyle = r;
  g.beginPath(); g.ellipse(150, 190, 100, 130, 0, 0, 7); g.fill();
  g.fillStyle = "#111"; g.beginPath(); g.ellipse(110, 160, 18, 9, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(190, 160, 18, 9, 0, 0, 7); g.fill();
  g.fillStyle = "#333"; g.fillRect(140, 180, 18, 50); g.beginPath(); g.ellipse(150, 270, 40, 12, 0, 0, 7); g.fill();
  g.fillStyle = "#222"; g.beginPath(); g.ellipse(150, 70, 110, 50, 0, Math.PI, 2 * Math.PI); g.fill();
  const d = g.getImageData(0, 0, 300, 400).data, out = new Float32Array(300 * 400);
  for (let i = 0; i < out.length; i++) out[i] = 1 - (0.2126 * d[4 * i] + 0.7152 * d[4 * i + 1] + 0.0722 * d[4 * i + 2]) / 255;
  return { w: 300, h: 400, d: out };
}
const TONE = portraitTone();
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
  how: "Makes every style at its starting values and at both ends of its sliders (and with other sides and shapes where it has them); checks each path's points, its crossings (a loop's closing step included) and the closest approach of non-neighbouring parts against the gap it reports; makes the seeded styles twice with one seed and once with another; measures how much line the picture patterns put in dark and light parts of a test portrait; follows each crossing style's exact line at 100 mm and prints it with and without Allow overlaps; then draws each one-line style at the app's size and traces it with the app's defaults at the working resolution for the width where its gap is the line spacing.",
  pass: "Every pattern has points and a box; the one-line styles are one path with no crossings and nothing closer than 0.75 × their gap; the same seed gives the same pattern and another seed a different one; a pattern drawn from a picture needs one, and, at fine detail, puts at least 1.25 × as much line per area in the dark parts of a test portrait as in the light ones; every one-line style traces as 1 part with no doubled strokes (under 1% of the walk) and no connectors; Spirograph, Lissajous and Rose are one line each, and followed exactly they print with their crossings kept under Allow overlaps (nothing else closer than 0.9 × the spacing) and with none left without it.",
  async run(ctx) {
    const checks = [], bad = [], notes = [];
    for (const [key, P] of Object.entries(UNB.PATTERNS)) {
      // every setting at both ends of its slider, every choice, every switch on (the others at their starting values)
      const vars = [{}], detail = P.params.find((q) => q.key === "detail");
      for (const q of P.params)
        if (q.type === "range") vars.push({ [q.key]: q.min }, { [q.key]: q.max });
        else if (q.type === "select") for (const [v] of q.options) vars.push({ [q.key]: v });
        else vars.push({ [q.key]: !q.value });
      for (const v of vars) {
        const o = { seed: 5, tone: P.tone ? TONE : undefined, ...v }, r = UNB.pattern(key, o), name = `${key} ${JSON.stringify(v)}`;
        if (ctx.quick && P.tone && detail && v.detail === detail.max) continue;   // the densest picture patterns take seconds
        if (!r || !r.paths.length || !r.paths.every((p) => p.length >= 4 && p.every(Number.isFinite)) || !(r.box[0] > 0 && r.box[1] > 0 && r.gap > 0)) { bad.push(`${name}: empty or not finite`); continue; }
        if (P.crosses && r.paths.length !== 1) bad.push(`${name}: ${r.paths.length} paths`);   // (a damped or drifting Lissajous is open)
        if (!P.oneLine) continue;
        if (r.paths.length !== 1) { bad.push(`${name}: ${r.paths.length} paths`); continue; }
        const sh = shape(r);   // (a loop's closing step counts like every other)
        if (sh.cross) bad.push(`${name}: ${sh.cross} crossings`);
        if (sh.near < 0.75) bad.push(`${name}: parts ${sh.near.toFixed(2)} × the gap apart`);
      }
      if (P.seed) {
        const tone = P.tone ? TONE : undefined, a = UNB.pattern(key, { seed: 11, tone }), b = UNB.pattern(key, { seed: 11, tone }), c = UNB.pattern(key, { seed: 12, tone });
        if (JSON.stringify(a.paths) !== JSON.stringify(b.paths)) bad.push(`${key}: the same seed gave another pattern`);
        if (JSON.stringify(a.paths) === JSON.stringify(c.paths)) bad.push(`${key}: another seed gave the same pattern`);
      }
    }
    for (const [key, P] of Object.entries(UNB.PATTERNS)) if (P.tone && UNB.pattern(key, {})) bad.push(`${key}: drawn without a picture`);
    // drawn from a picture: darker parts get more line. Measured at fine detail (three quarters of the way up each
    // style's Detail slider), as line length per area of the picture where it is dark (over 0.55) against light
    // (under 0.25)
    for (const [key, P] of Object.entries(UNB.PATTERNS)) {
      if (!P.tone) continue;
      const D = P.params.find((q) => q.key === "detail"), detail = Math.round(D.min + 0.75 * (D.max - D.min)), r = UNB.pattern(key, { seed: 3, tone: TONE, detail });
      const p = r.paths[0], [bw, bh] = r.box, n = p.length / 2, a = TONE.w / TONE.h;
      const fitW = a >= bw / bh ? bw : bh * a, fitH = a >= bw / bh ? bw / a : bh;   // the picture fitted inside the box
      const ink = [0, 0], area = [0, 0], cls = (dk) => (dk > 0.55 ? 1 : dk < 0.25 ? 0 : -1);
      for (let i = 0; i + 1 < n; i++) {
        const x = (p[2 * i] + p[2 * i + 2]) / 2, y = (p[2 * i + 1] + p[2 * i + 3]) / 2, pu = (x - (bw - fitW) / 2) / fitW, pv = (y - (bh - fitH) / 2) / fitH;
        if (pu < 0 || pv < 0 || pu >= 1 || pv >= 1) continue;
        const c = cls(TONE.d[Math.floor(pv * TONE.h) * TONE.w + Math.floor(pu * TONE.w)]);
        if (c >= 0) ink[c] += Math.hypot(p[2 * i + 2] - p[2 * i], p[2 * i + 3] - p[2 * i + 1]);
      }
      for (const v of TONE.d) { const c = cls(v); if (c >= 0) area[c]++; }
      const ratio = ink[1] / area[1] / (ink[0] / area[0]);
      notes.push(`${key} (detail ${detail}): line per area, dark ÷ light ${ratio.toFixed(2)}`);
      // (waves and the spiral can only wiggle so far and keep their gap: at most about 1.8 × as much line)
      if (!(ratio > 1.25)) bad.push(`${key}: the dark parts don't get more line (${ratio.toFixed(2)} ×)`);
    }
    checks.push(check("patterns that break their promise", bad.length, "==", 0));
    // traced like the app: one part, nothing doubled, no connectors
    let traced = 0;
    for (const [key, P] of Object.entries(UNB.PATTERNS)) {
      if (!P.oneLine) continue;
      // traced at the working resolution the app would use at the width where the gap is the 18G line spacing
      const r = UNB.pattern(key, { seed: 3, tone: P.tone ? TONE : undefined }), mm = (r.box[0] / r.gap) * 1.34;
      const t = trace(picture(r), { open: P.line === "open", res: Math.min(2000, Math.max(500, 5 * mm * Math.max(1, r.box[1] / r.box[0]))) }), w = t.walk;
      const parts = w ? w.nParts : 0, dbl = w ? w.doubledFrac : 1, jumps = t.sg ? t.sg.connRuns : -1;
      notes.push(`${key} ${parts} part, ${(100 * dbl).toFixed(1)}% doubled, ${t.N} terms, error ${t.fin ? (t.fin.err.score * t.scale).toFixed(3) : "–"} mm`);
      if (parts !== 1 || dbl > 0.01 || jumps !== 0) bad.push(`${key} traced: ${parts} parts, ${(100 * dbl).toFixed(1)}% doubled, ${jumps} connectors`); else traced++;
    }
    checks.push(check("one-line styles that trace as one line", traced, "==", Object.values(UNB.PATTERNS).filter((P) => P.oneLine).length));
    // the styles that cross themselves, followed exactly (UNB.stageVector) and printed with Allow overlaps: their
    // crossings stay, and the line keeps the spacing everywhere else; without it, every crossing is undone
    const over = [];
    for (const [key, P] of Object.entries(UNB.PATTERNS)) {
      if (!P.crosses) continue;
      const r = UNB.pattern(key, {}), k = 600 / Math.max(...r.box), p = r.paths[0], x = [], y = [];
      for (let j = 0; j < p.length; j += 2) { x.push(40 + p[j] * k); y.push(40 + p[j + 1] * k); }
      const walk = UNB.stageVector(x, y, r.closed[0], 680, 680), d = 1.34 / (100 / 600);   // 100 mm wide, 18G spacing
      const on = UNB.stagePrint(walk, d, 680, 680, { w: d * 0.6, loop: 1.4, overlaps: true }), off = UNB.stagePrint(walk, d, 680, 680, { w: d * 0.6, loop: 1.4 });
      const kept = UNB.findCrossings(on.final.re, on.final.im, !on.open).length, left = UNB.findCrossings(off.final.re, off.final.im, !off.open).length;
      notes.push(`${key} at 100 mm: ${walk.nParts} part, ${kept} crossings kept with Allow overlaps (closest elsewhere ${(on.gap / d).toFixed(2)} × the spacing), ${left} without`);
      over.push(+(walk.nParts === 1 && walk.doubledFrac === 0 && kept > 0 && on.after === 0 && on.gap >= 0.9 * d && left === 0));
    }
    checks.push(check("crossing styles kept with Allow overlaps, spacing kept elsewhere; undone without", over.reduce((a, b) => a + b, 0), "==", over.length));
    return { checks, notes: (bad.length ? bad.join("  \n") + "  \n" : "") + notes.join("  \n") };
  },
};
