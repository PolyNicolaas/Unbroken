// patterns as one end of a morph: pattern → shape, shape → pattern, pattern ↔ letter
const { UNB } = require("./shapes.js"), { SH } = require("./shp.js"), { wordShape } = require("./wordshape.js");
const D = 1.34, HOLD = 0.28, H = +(process.env.H || 20), W = +(process.env.W || 40);
function patPlan(style, o) {
  const r = UNB.pattern(style, o), p = r.paths[0], k = W / Math.max(r.box[0], r.box[1]), x = [], y = [];
  const m = p.length / 2;
  for (let i = 0; i < m; i++) { const j = (i + 1) % m, ax = p[2 * i] * k, ay = -p[2 * i + 1] * k, bx = p[2 * j] * k, by = -p[2 * j + 1] * k, s = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.2)); for (let t = 0; t < s; t++) { x.push(ax + ((bx - ax) * t) / s); y.push(ay + ((by - ay) * t) / s); } }
  const O = UNB.vaseLineLoop(x, y) || UNB.vaseOutline(x, y);
  const lx = [], ly = []; for (let i = 0; i < O.loop.length; i += 2) { lx.push(O.loop[i] * O.reach); ly.push(O.loop[i + 1] * O.reach); }
  return { P: { kind: "drawing", loop: O.loop, round: 0 }, reach: O.reach, exact: !!O.exact, gap: UNB.closestGap(lx, ly, D, true) };
}
const letter = (ch) => { const S = wordShape(ch, { cap: 20, slit: 1.7, round: 1 }), O = UNB.vaseLineLoop(S.loop.map((p) => p[0]), S.loop.map((p) => p[1])); return { P: { kind: "drawing", loop: O.loop, round: 0 }, reach: O.reach }; };
function morph(lo, hi, turn) {
  const V = Object.assign(UNB.vaseDefaults(), { height: H, profile: [[0, lo.reach], [1, hi.reach]], move: { kind: "none", size: 0, count: 1, shift: 0, flip: 0 }, plan: lo.P, planTop: Object.assign({}, hi.P, { match: "corners", turn }) });
  const it = UNB.vaseStack(V, { h: 0.3, base: 0, w: 0.84, d: D, overhang: HOLD }); let r; while (!(r = it.next()).done); const R = r.value, m = R.morph;
  return +(Math.max(0, R.overhang.worst - HOLD) + R.overhang.inWorst + Math.max(0, 0.9 * D - m.closest) + 0.2 * Math.max(0, m.moved - 2 * D)).toFixed(2);
}
const pats = JSON.parse(process.argv[2]), turns = [0, 20, -20, 45];
const others = { circle: { P: SH.circle }, square: { P: SH.square }, flower: { P: SH.flower }, N: letter("N") };
for (const [style, o] of pats) {
  const pt = patPlan(style, o), row = { pat: style + JSON.stringify(o), exact: pt.exact, reach: +pt.reach.toFixed(1), ownGap: +pt.gap.toFixed(2) };
  for (const [nm, X] of Object.entries(others)) {
    const x = Object.assign({ reach: pt.reach * 0.9 }, X);
    const best = (f) => { for (const t of turns) { const b = f(t); if (b < 0.05) return t; } return "x"; };
    row[nm] = `to:${best((t) => morph(x, pt, t))} from:${best((t) => morph(pt, x, t))}`;
  }
  console.log(JSON.stringify(row));
}
