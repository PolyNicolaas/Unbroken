const { UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
// a labyrinth's line (12 cells, 60 mm), as the vase takes it: mm, y up
function line() {
  const r = UNB.pattern("labyrinth", { seed: 5, detail: 12 }), p = r.paths[0], k = 60 / r.box[0], x = [], y = [];
  // (corners only, with long straight runs: filled in every 0.2 mm, so the checks below find the line's every piece)
  const m = p.length / 2;
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m, ax = p[2 * i] * k, ay = -p[2 * i + 1] * k, bx = p[2 * j] * k, by = -p[2 * j + 1] * k, s = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.2));
    for (let t = 0; t < s; t++) { x.push(ax + ((bx - ax) * t) / s); y.push(ay + ((by - ay) * t) / s); }
  }
  return { x, y, gap: k * r.gap };
}
module.exports = {
  id: "E62", title: "A vase from a traced line: the line itself as the shape from above, followed exactly",
  guards: "a long traced line (a labyrinth's) cut short by the plan's 1440-point table or the lap's point limit, so the vase's walls lose its corners and gaps",
  why: "Nicolaas (12 November 2026): a labyrinth made into a vase came out messy. Make a vase from this line uses the line itself (UNB.vaseLineLoop) instead of its outside edge on a coarse grid; the plan's table and the lap's points now grow with the plan's length.",
  how: "Takes a 12-cell, 60 mm labyrinth's line, makes its plan with UNB.vaseLineLoop and a straight 10 mm vase at its reach with no texture or movement; measures how far a wall lap's points are from the line, and the closest approach of parts of the lap more than 3 gaps apart along it.",
  pass: "The plan is exact, over 4000 points; every lap point within 0.1 mm of the line; parts of the lap keep at least 0.9 of the labyrinth's gap apart.",
  run() {
    const L = line(), O = UNB.vaseLineLoop(L.x, L.y);
    const V = Object.assign(UNB.vaseDefaults(), { height: 10, profile: [[0, O.reach], [1, O.reach]], move: { kind: "none", size: 0, count: 0, shift: 0, flip: 0 }, plan: { kind: "drawing", loop: O.loop, round: 0 } });
    const it = UNB.vaseStack(V, { h: 0.3, base: 0, w: 0.84, d: 1.34, tol: 0.05 }); let r; while (!(r = it.next()).done); const W = r.value.walls[5];
    // the lap is centred on the area's middle: move the line there too (the same middle the loop was made round)
    let A = 0, cx = 0, cy = 0; const n = L.x.length;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n, k = L.x[i] * L.y[j] - L.x[j] * L.y[i]; A += k; cx += (L.x[i] + L.x[j]) * k; cy += (L.y[i] + L.y[j]) * k; }
    cx /= 3 * A; cy /= 3 * A;
    const segD = (px, py, i) => { const j = (i + 1) % n, ax = L.x[i] - cx, ay = L.y[i] - cy, bx = L.x[j] - cx - ax, by = L.y[j] - cy - ay, l = bx * bx + by * by, t = l ? Math.max(0, Math.min(1, ((px - ax) * bx + (py - ay) * by) / l)) : 0; return Math.hypot(px - ax - t * bx, py - ay - t * by); };
    // grid of the line's segments, 2 mm cells
    const G = new Map(), key = (a, b) => a + "," + b;
    for (let i = 0; i < n; i++) { const a = Math.floor((L.x[i] - cx) / 2), b = Math.floor((L.y[i] - cy) / 2); for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) { const q = key(a + da, b + db); if (!G.has(q)) G.set(q, []); G.get(q).push(i); } }
    let worst = 0;
    for (let i = 0; i < W.x.length; i++) { const c = G.get(key(Math.floor(W.x[i] / 2), Math.floor(W.y[i] / 2))) || []; let b = Infinity; for (const s of c) b = Math.min(b, segD(W.x[i], W.y[i], s)); worst = Math.max(worst, b); }
    // closest approach of parts more than 3 gaps apart along the lap
    const m = W.x.length, cum = [0]; for (let i = 1; i < m; i++) cum.push(cum[i - 1] + Math.hypot(W.x[i] - W.x[i - 1], W.y[i] - W.y[i - 1])); const tot = cum[m - 1] + Math.hypot(W.x[0] - W.x[m - 1], W.y[0] - W.y[m - 1]);
    const H = new Map(); for (let i = 0; i < m; i++) { const q = key(Math.floor(W.x[i] / 2), Math.floor(W.y[i] / 2)); if (!H.has(q)) H.set(q, []); H.get(q).push(i); }
    let near = Infinity;
    for (let i = 0; i < m; i++) { const a = Math.floor(W.x[i] / 2), b = Math.floor(W.y[i] / 2); for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) for (const j of H.get(key(a + da, b + db)) || []) { let al = Math.abs(cum[j] - cum[i]); al = Math.min(al, tot - al); if (al > 3 * L.gap) near = Math.min(near, Math.hypot(W.x[i] - W.x[j], W.y[i] - W.y[j])); } }
    return { checks: [
      check("the plan: exact", O.exact, "==", true), check("… points", O.loop.length / 2, ">", 4000),
      check("lap points from the line, worst (mm)", worst, "<=", 0.1),
      check("closest approach of the lap's parts ÷ the labyrinth's gap", near / L.gap, ">=", 0.9),
    ], notes: [`${W.x.length} points a lap; gap ${L.gap.toFixed(2)} mm`] };
  },
};
