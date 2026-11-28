// morphs 125 mm tall: pattern ↔ pattern, shape → word, word ↔ word. Uses the app's own check (UNB.morphCheck).
const B = __dirname + "/../";
const { UNB } = require(B + "shapes.js"), { wordShape } = require(B + "wordshape.js");
const D = 1.34, H = +(process.env.H || 125), W = +(process.env.W || 80);
const OPT = { h: 0.3, w: 0.84, d: D, overhang: 0.28, budget: +(process.env.BUDGET || 120000) };
const loopOf = (x, y) => UNB.vaseLineLoop(x, y) || UNB.vaseOutline(x, y);
function pat(style, o, w = W) {
  const r = UNB.pattern(style, o), p = r.paths[0], k = w / Math.max(r.box[0], r.box[1]), x = [], y = [], m = p.length / 2;
  for (let i = 0; i < m; i++) { const j = (i + 1) % m, ax = p[2 * i] * k, ay = -p[2 * i + 1] * k, bx = p[2 * j] * k, by = -p[2 * j + 1] * k, s = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.3)); for (let t = 0; t < s; t++) { x.push(ax + ((bx - ax) * t) / s); y.push(ay + ((by - ay) * t) / s); } }
  return loopOf(x, y);
}
function word(t, cap, font = "chocolate") { const S = wordShape(t, { font, cap, slit: 1.7, round: 1 }); return S.stats.loops >= 1 ? loopOf(S.loop.map((p) => p[0]), S.loop.map((p) => p[1])) : null; }
function shape(k) { const S = UNB.morphShape(k); return loopOf(S.x.map((v) => v * W / 40), S.y.map((v) => v * W / 40)); }
const circle = () => ({ kind: "circle" });
function check(lo, hi, name) {
  const t0 = Date.now();
  const P = lo.kind ? lo : { kind: "drawing", loop: lo.loop, exact: true, round: 0 };
  const rLo = lo.kind ? (hi.reach || W / 2) * 0.9 : lo.reach, rHi = hi.reach;
  const V = Object.assign(UNB.vaseDefaults(), { height: H, profile: [[0, rLo], [1, rHi]], move: { kind: "none", size: 0, count: 1, shift: 0, flip: 0 }, texture: { kind: "none" }, plan: P, planTop: { kind: "drawing", loop: hi.loop, exact: true, round: 0, match: "corners", keepApart: true, turn: 0 } });
  const it = UNB.morphCheck(V, OPT); let r; while (!(r = it.next()).done); r = r.value;
  console.log(JSON.stringify({ name, H, ok: r.ok, needH: r.needH, turn: r.turn, cut: r.cut, bad: r.bad && +r.bad.toFixed(2), closest: r.closest && +(+r.closest).toFixed(2), pts: hi.loop.length / 2, s: Math.round((Date.now() - t0) / 1000) }));
}
module.exports = { pat, word, shape, circle, check, UNB };
if (require.main === module) {
  const cases = { mh: () => check(pat("moore", { detail: 1 }), pat("hilbert", { detail: 2 }), "moore1→hilbert2") };
  cases[process.argv[2] || "mh"]();
}
