// the engine's own morph: vaseStack with a rim shape, rendered
const { textLoop, UNB } = require("./shapes.js");
const { createCanvas } = require("/home/claude/Unbroken/source/tests/node_modules/@napi-rs/canvas");
const fs = require("fs");
const heart = () => { const x = [], y = []; for (let i = 0; i < 2000; i++) { const t = (2 * Math.PI * i) / 2000; x.push(16 * Math.sin(t) ** 3); y.push(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)); } return { xs: x.reverse(), ys: y.reverse() }; };
const loopOf = (t) => { const O = UNB.vaseLineLoop(t.xs, t.ys) || UNB.vaseOutline(t.xs, t.ys); return { kind: "drawing", loop: O.loop, round: 0 }; };
const SH = { heart: () => loopOf(heart()), N: () => loopOf(textLoop("N", 40)), NV: () => loopOf(textLoop("NV", 50)), circle: () => ({ kind: "circle" }), star: () => ({ kind: "star", sides: 5, depth: 0.5, round: 0 }), flower: () => ({ kind: "flower", sides: 5, depth: 0.3 }) };
function run(name, extra = {}) {
  const [a, b] = name.split("-");
  const V = Object.assign(UNB.vaseDefaults(), { height: 30, profile: [[0, 25], [1, 25]], move: { kind: "none", size: 0, count: 1, shift: 0, flip: 0 }, plan: SH[a](), planTop: SH[b]() }, extra);
  if (extra.planTop) V.planTop = Object.assign(SH[b](), extra.planTop);
  const t0 = Date.now(); const it = UNB.vaseStack(V, { h: 0.3, base: 0, w: 0.84, d: 1.34, tol: 0.05, overhang: 0.28 }); let r; while (!(r = it.next()).done); const R = r.value, ms = Date.now() - t0;
  const m = R.morph;
  console.log(name, JSON.stringify(extra), `${ms} ms`, JSON.stringify({ kept: m.kept, crossed: m.crossed, moved: +m.moved.toFixed(2), closest: +m.closest.toFixed(2), match: m.match, overhang: +R.overhang.worst.toFixed(2), inward: +R.overhang.inWorst.toFixed(2), tight: +R.tightest.r.toFixed(2) }));
  // render
  const W = 520, cv = createCanvas(W * 2, 560), g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
  const sc = 7.5, laps = R.walls;
  [0, 0.25, 0.5, 0.75, 1].forEach((f, q) => { const L = laps[Math.round(f * (laps.length - 1))]; g.strokeStyle = `hsl(${220 - q * 50},70%,${35 + q * 5}%)`; g.lineWidth = q === 2 ? 2 : 1.2; g.beginPath(); for (let i = 0; i < L.x.length; i++) { const X = W / 2 + L.x[i] * sc, Y = 270 - L.y[i] * sc; i ? g.lineTo(X, Y) : g.moveTo(X, Y); } g.closePath(); g.stroke(); });
  for (let k = 0; k < laps.length; k += 2) { const L = laps[k]; g.strokeStyle = `hsla(${220 - (k / laps.length) * 200},60%,40%,0.5)`; g.beginPath(); for (let i = 0; i < L.x.length; i++) { const X = W * 1.5 + L.x[i] * sc * 0.85, Y = 530 - k * 0.3 * 12 - L.y[i] * sc * 0.3; i ? g.lineTo(X, Y) : g.moveTo(X, Y); } g.stroke(); }
  g.fillStyle = "#000"; g.font = "15px sans-serif"; g.fillText(`${name}  ${JSON.stringify(extra)}  kept ${m.kept} laps apart, most moved ${m.moved.toFixed(2)} mm; closest ${m.closest.toFixed(2)} mm; overhang ${R.overhang.worst.toFixed(2)} mm`, 12, 20);
  fs.writeFileSync(`out/eng-${name}${extra.tag || ""}.png`, cv.toBuffer("image/png"));
  return R;
}
module.exports = { run, SH };
if (require.main === module) for (const c of process.argv.slice(2)) run(c);
