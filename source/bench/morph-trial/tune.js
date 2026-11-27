// score each glyph's morph (shape at the bottom, glyph at the rim) for font settings
const { wordShape } = require("./wordshape.js"), { UNB } = require("./shapes.js");
const D = 1.34, HOLD = 0.28;
const shapeXY = (kind, R) => { const x = [], y = []; for (let i = 0; i < 1440; i++) { const t = (2 * Math.PI * i) / 1440; if (kind === "heart") { x.push((16 * Math.sin(t) ** 3 * R) / 17); y.push(((13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * R) / 17); } else { x.push(R * Math.cos(t)); y.push(R * Math.sin(t)); } } return kind === "heart" ? { x: x.reverse(), y: y.reverse() } : { x, y }; };
const plan = (x, y, rd = 0) => { const O = UNB.vaseLineLoop(x, y); return { P: { kind: "drawing", loop: O.loop, round: rd }, reach: O.reach }; };
function morph(b, t, flip) {
  const [lo, hi] = flip ? [t, b] : [b, t];
  const V = Object.assign(UNB.vaseDefaults(), { height: 30, profile: [[0, lo.reach], [1, hi.reach]], move: { kind: "none", size: 0, count: 1, shift: 0, flip: 0 }, plan: lo.P, planTop: Object.assign({}, hi.P, { turn: +(process.env.TURN || 0) }) });
  const it = UNB.vaseStack(V, { h: 0.3, base: 0, w: 0.84, d: D, overhang: HOLD }); let r; while (!(r = it.next()).done); const R = r.value, m = R.morph;
  const bad = Math.max(0, R.overhang.worst - HOLD) + R.overhang.inWorst + Math.max(0, 0.9 * D - m.closest) + 0.2 * Math.max(0, m.moved - 2 * D);
  return { bad: +bad.toFixed(3), out: +R.overhang.worst.toFixed(2), inn: +R.overhang.inWorst.toFixed(2), closest: +m.closest.toFixed(2), moved: +m.moved.toFixed(2) };
}
const glyphs = process.env.WORDS ? process.env.WORDS.split(",") : (process.env.GLYPHS || "ABCDEFGHIJKLMNOPQRSTUVWXYZ!?").split("");
const combos = process.env.COMBOS ? JSON.parse(process.env.COMBOS) : (process.argv[2] || "").startsWith("[{\"grow") ? JSON.parse(process.argv[2]) : [{ slit: 1.7, round: 1 }];
for (const c of combos) for (const ch of glyphs) {
  let S; try { S = wordShape(ch, Object.assign({ cap: 20 }, c)); } catch (e) { console.log(JSON.stringify({ c, ch, err: e.message })); continue; }
  const gl = plan(S.loop.map((p) => p[0]), S.loop.map((p) => p[1])), res = { c, ch, loops: S.stats.loops };
  for (const kind of ["circle", "heart"]) { const sh = plan(...Object.values(shapeXY(kind, Math.max(10, gl.reach * 0.9))), kind === "heart" ? +(process.env.HR || 0.12) : 0); res[kind] = morph(sh, gl, !!process.env.FLIP); }
  console.log(JSON.stringify(res));
}
