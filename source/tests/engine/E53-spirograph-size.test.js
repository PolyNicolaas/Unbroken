const { UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "E53", title: "Spirograph: the figure's size changes along the line (Size at start → Size at end)",
  guards: "a size that doesn't change the figure, a growing figure left closed (its ends joined across the drawing), a figure that grows the wrong way, and designs from before v128 drawn differently",
  why: "Nicolaas (30 October 2026): let the spirograph's scale change along the centre path, to see if it makes fun designs. v128 adds Size at start and Size at end.",
  how: "Draws the spirograph at rest, with Size 100% → 100% (the default), 30% → 100% with no path (a spiral out) and 100% → 30%, and with a path from (−60, 0) to (60, 0) at 20% → 150%. Measures how far the line is from the centre near its start and near its end.",
  pass: "100% → 100% is the drawing at rest, point for point, and closed; 30% → 100% is an open line, its first tenth within 45% of the full figure's reach and its last tenth past 85%; 100% → 30% the other way round; along the path, the last tenth's figure spans over twice the first tenth's.",
  run() {
    const P = (o) => UNB.pattern("spirograph", o), checks = [];
    const rest = P({}), same = P({ sizeStart: 100, sizeEnd: 100 }), out = P({ sizeStart: 30, sizeEnd: 100 }), inn = P({ sizeStart: 100, sizeEnd: 30 });
    const eq = (u, v) => u.paths[0].length === v.paths[0].length && u.paths[0].every((x, i) => Math.abs(x - v.paths[0][i]) < 1e-9);
    // reach from the figure's centre: drawn in a frame much bigger than the figure, which puts its centre at the frame's
    const raw = (o) => { const r = P({ ...o, frame: "crop", frameW: 400, frameH: 400 }), q = [].concat(...r.paths); return q.map((v, k) => v - (k % 2 ? r.box[1] : r.box[0]) / 2); };
    const R = (q, a, b) => { let m = 0; const n = q.length / 2; for (let i = Math.floor(a * n); i < Math.floor(b * n); i++) m = Math.max(m, Math.hypot(q[2 * i], q[2 * i + 1])); return m; };
    const full = R(raw({}), 0, 1), o = raw({ sizeStart: 30, sizeEnd: 100 }), i = raw({ sizeStart: 100, sizeEnd: 30 });
    checks.push(check("100% → 100%: the drawing at rest", +(eq(rest, same) && same.closed[0]), "==", 1));
    checks.push(check("30% → 100%: an open line", +!out.closed[0], "==", 1), check("100% → 30%: an open line", +!inn.closed[0], "==", 1));
    checks.push(check("30% → 100%: first tenth's reach (share of full)", +(R(o, 0, 0.1) / full).toFixed(3), "<=", 0.45), check("30% → 100%: last tenth's reach", +(R(o, 0.9, 1) / full).toFixed(3), ">=", 0.85));
    checks.push(check("100% → 30%: first tenth's reach", +(R(i, 0, 0.1) / full).toFixed(3), ">=", 0.85), check("100% → 30%: last tenth's reach", +(R(i, 0.9, 1) / full).toFixed(3), "<=", 0.45));
    // along a path: the figure's width near the start against near the end
    const path = [-60, 0, 60, 0], a = P({ path, pathSmooth: 0, sizeStart: 20, sizeEnd: 150 }).paths[0], n = a.length / 2;
    const span = (u, v) => { let lo = 1e9, hi = -1e9; for (let k = Math.floor(u * n); k < Math.floor(v * n); k++) { lo = Math.min(lo, a[2 * k + 1]); hi = Math.max(hi, a[2 * k + 1]); } return hi - lo; };
    checks.push(check("along the path: end figure ÷ start figure (height)", +(span(0.9, 1) / span(0, 0.1)).toFixed(2), ">", 2));
    return { checks, notes: `full reach ${full.toFixed(1)}; 30→100% start ${R(o, 0, 0.1).toFixed(1)}, end ${R(o, 0.9, 1).toFixed(1)}` };
  },
};
