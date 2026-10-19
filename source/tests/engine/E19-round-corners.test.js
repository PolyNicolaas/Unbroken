const S = require("../lib/scenes.js"), { trace, UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
const W = 0.84, D = 1.34;                                   // 18G needle and 0.5 mm gap

// The tightest turn along the drawn parts of a walk, as a circle radius: through points R/2 apart along the line,
// away (more than 2R) from the points rounding leaves alone (junctions, stroke ends, connectors) (on a closed walk the measure runs round past the start). Also the share of
// those points that turn tighter than R/2.
function turns(walk, R) {
  const { px, py, tip, jd, jmp } = walk, n = px.length, closed = !walk.open, fixed = (i) => tip[i] || jd[i] === 0 || jmp[i] || (i > 0 && jmp[i - 1]);
  const s = [0]; for (let i = 1; i < n; i++) s.push(s[i - 1] + Math.hypot(px[i] - px[i - 1], py[i] - py[i - 1]));
  const L = s[n - 1], fx = []; for (let i = 0; i < n; i++) if (fixed(i)) fx.push(s[i]);
  if (!closed) fx.push(0, L);                                // an open walk's ends count as fixed
  const near = (v) => fx.reduce((m, f) => Math.min(m, closed ? Math.min(Math.abs(v - f), L - Math.abs(v - f)) : Math.abs(v - f)), Infinity);
  const at = (v) => {
    if (closed) v = ((v % L) + L) % L; else v = Math.min(Math.max(v, 0), L);
    let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (s[m] <= v) lo = m; else hi = m; }
    const t = (v - s[lo]) / (s[hi] - s[lo] || 1); return [px[lo] + t * (px[hi] - px[lo]), py[lo] + t * (py[hi] - py[lo])];
  };
  let min = Infinity, tight = 0, all = 0;
  for (let i = 0; i < n - (closed ? 1 : 0); i++) {
    if (near(s[i]) < 2 * R + 3) continue;
    const a = at(s[i] - R / 2), b = [px[i], py[i]], c = at(s[i] + R / 2);
    const A = Math.hypot(b[0] - c[0], b[1] - c[1]), B = Math.hypot(a[0] - c[0], a[1] - c[1]), C = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const area2 = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])), r = area2 > 1e-9 ? A * B * C / (2 * area2) : Infinity;
    min = Math.min(min, r); all++; if (r < R / 2) tight++;
  }
  return { min: min / R, tight: all ? tight / all : 0 };
}

// a square and a triangle drawn as 6 px lines (corners turning 90° and 120°), and optionally a five-point star
// (points turning 144°, sharper than a full radius can round without moving the line more than the radius)
function cornersScene(star) {
  const c = S.createCanvas(640, 480), g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, 640, 480); g.strokeStyle = "#000"; g.lineWidth = 6; g.lineJoin = "miter";
  g.strokeRect(40, 60, 160, 160);
  g.beginPath(); g.moveTo(250, 220); g.lineTo(410, 220); g.lineTo(330, 70); g.closePath(); g.stroke();
  if (star) { g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 40 : 95; g.lineTo(530 + r * Math.cos(a), 150 + r * Math.sin(a)); } g.closePath(); g.stroke(); }
  g.beginPath(); g.moveTo(200, 140); g.lineTo(250, 140); if (star) { g.moveTo(410, 140); g.lineTo(440, 140); } g.stroke();   // joined, so the walk links them
  return c;
}

module.exports = {
  id: "E19", title: "Round corners: the drawing's sharp corners get the chosen radius, nothing else moves",
  guards: "corners left sharp, smooth curves bent out of shape, junctions, stroke ends or connectors moved, and strands crossing or crowding after rounding",
  why: "A needle laying chocolate can't turn on the spot: a hard corner piles chocolate up or drags the line. Round corners sets the tightest turn the drawing may make (a radius in mm). Only corners in the drawing itself are rounded; junctions, stroke-end loops and connectors keep their geometry, because that's what keeps the strands the spacing apart. Smooth curves (a small circle, say) are drawn as they are.",
  how: "Traces the leaf at 30 mm, the shapes sample at 60 mm a square and a triangle at 60 mm, and the same with a five-point star, and rounds each walk to 1, 2 and 3 mm. Measures the tightest turn along the drawn parts (as a circle radius, through points half a radius apart, away from junctions, stroke ends and connectors) and how far any point moved; checks junctions, stroke ends and connectors don't move, the point count is unchanged, and the smiley's round eyes stay as drawn. Then traces the three at 2 mm with an 18G needle and a 0.5 mm gap and reads crossings and the closest gap.",
  pass: "Off (0 mm) changes nothing; leaf, square and triangle: tightest turn ≥ 0.85 × the radius at every setting (0.2–0.5 before); the star's points (too sharp to round fully without moving the line more than the radius): tightest turn at least 1.4× wider than before; no point moves further than the radius (so small features like the shapes sample's lettering are softened, not cut away); fixed points don't move; the smiley moves less than a line width; with 2 mm rounding no crossings and a closest gap ≥ 90% of the spacing.",
  async run() {
    const checks = [], notes = [];
    const scenes = [["leaf", trace(S.sample("leaf"), { outW: 30 })], ["shapes", trace(S.sample("shapes"), { outW: 60 })], ["corners", trace(cornersScene(false), { outW: 60 })], ["star", trace(cornersScene(true), { outW: 60 })]];
    const smiley = trace(S.sample("smiley"), { outW: 40 });
    checks.push(check("0 mm: walk returned unchanged", +(UNB.roundCorners(scenes[0][1].walk, 0) === scenes[0][1].walk), "==", 1));
    for (const mm of [1, 2, 3]) {
      for (const [name, r] of scenes) {
        const R = mm / r.scale, w2 = UNB.roundCorners(r.walk, R), before = turns(r.walk, R), after = turns(w2, R);
        let fixedMoved = 0, far = 0;
        for (let i = 0; i < w2.px.length; i++) {
          const d = Math.hypot(w2.px[i] - r.walk.px[i], w2.py[i] - r.walk.py[i]); far = Math.max(far, d);
          if ((r.walk.tip[i] || r.walk.jd[i] === 0 || r.walk.jmp[i]) && d > 0) fixedMoved++;
        }
        if (name === "leaf" || name === "corners") checks.push(check(`${name} ${mm} mm: tightest turn (× radius)`, after.min, ">=", 0.85));
        if (name === "star") checks.push(check(`star ${mm} mm: tightest turn, after ÷ before`, after.min / before.min, ">=", 1.4));
        checks.push(check(`${name} ${mm} mm: furthest any point moved (× radius)`, far / R, "<=", 1.0001));
        checks.push(check(`${name} ${mm} mm: junctions, stroke ends and connectors moved`, fixedMoved, "==", 0), check(`${name} ${mm} mm: point count unchanged`, +(w2.px.length === r.walk.px.length), "==", 1));
        notes.push(`${name} ${mm} mm: tightest ${before.min.toFixed(2)} → ${after.min.toFixed(2)} × R`);
      }
      const R = mm / smiley.scale, w2 = UNB.roundCorners(smiley.walk, R);
      let moved = 0; for (let i = 0; i < w2.px.length; i++) moved = Math.max(moved, Math.hypot(w2.px[i] - smiley.walk.px[i], w2.py[i] - smiley.walk.py[i]));
      checks.push(check(`smiley ${mm} mm: furthest any point moved (mm)`, moved * smiley.scale, "<", W));
    }
    for (const [name, W0, src] of [["leaf", 30, S.sample("leaf")], ["shapes", 60, S.sample("shapes")], ["star", 60, cornersScene(true)]]) {
      const r = trace(src, { outW: W0, spacingMM: D, lineMM: W, roundMM: 2 });
      checks.push(check(`${name} at 2 mm rounding, 18G + 0.5 mm: crossings`, r.fin.after, "==", 0), check(`${name} at 2 mm rounding: closest gap (spacings)`, Number.isFinite(r.fin.gap) ? r.fin.gap / r.dpx : 99, ">=", 0.9));
    }
    return { checks, notes: notes.join(" · ") };
  },
};
