// one glyph's morph from a heart, drawn: top view at 0–100% and the laps
const { wordShape } = require("./wordshape.js"), { UNB } = require("./shapes.js");
const { createCanvas } = require("/home/claude/Unbroken/source/tests/node_modules/@napi-rs/canvas");
const fs = require("fs");
const D = 1.34;
const heart = (R) => { const x = [], y = []; for (let i = 0; i < 1440; i++) { const t = (2 * Math.PI * i) / 1440; x.push((16 * Math.sin(t) ** 3 * R) / 17); y.push(((13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * R) / 17); } return [x.reverse(), y.reverse()]; };
const plan = (x, y, rd = 0) => { const O = UNB.vaseLineLoop(x, y); return { P: { kind: "drawing", loop: O.loop, round: rd }, reach: O.reach }; };
const chars = process.argv[2].split(""), opt = JSON.parse(process.argv[3] || '{"slit":1.7,"round":1}');
const cv = createCanvas(380 * chars.length, 640), g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
chars.forEach((ch, q) => {
  const S = wordShape(ch, Object.assign({ cap: 20 }, opt)), gl = plan(S.loop.map((p) => p[0]), S.loop.map((p) => p[1])), sh = plan(...heart(Math.max(10, gl.reach * 0.9)), +(process.env.HR || 0.12));
  const V = Object.assign(UNB.vaseDefaults(), { height: 30, profile: [[0, sh.reach], [1, gl.reach]], move: { kind: "none", size: 0, count: 1, shift: 0, flip: 0 }, plan: sh.P, planTop: gl.P });
  const it = UNB.vaseStack(V, { h: 0.3, base: 0, w: 0.84, d: D, overhang: 0.28 }); let r; while (!(r = it.next()).done); const R = r.value, m = R.morph, laps = R.walls;
  const ox = q * 380, sc = 150 / gl.reach;
  g.fillStyle = "#000"; g.font = "14px sans-serif"; g.fillText(`${ch}: step ${R.overhang.worst.toFixed(2)} (layer ${R.overhang.at}), in ${R.overhang.inWorst.toFixed(2)}`, ox + 8, 18); g.fillText(`closest ${m.closest.toFixed(2)} (layer ${m.closestAt}), moved ${m.moved.toFixed(2)}`, ox + 8, 36);
  [0, 0.25, 0.5, 0.75, 1].forEach((f, j) => { const L = laps[Math.round(f * (laps.length - 1))]; g.strokeStyle = `hsl(${220 - j * 50},70%,${35 + j * 5}%)`; g.lineWidth = j === 2 ? 2 : 1.1; g.beginPath(); for (let i = 0; i < L.x.length; i++) { const X = ox + 190 + L.x[i] * sc, Y = 220 - L.y[i] * sc; i ? g.lineTo(X, Y) : g.moveTo(X, Y); } g.closePath(); g.stroke(); });
  // the worst layers in red
  for (const k of [R.overhang.at, m.closestAt]) { const L = laps[k - R.N]; if (!L) continue; g.strokeStyle = "#e00"; g.lineWidth = 1; g.beginPath(); for (let i = 0; i < L.x.length; i++) { const X = ox + 190 + L.x[i] * sc, Y = 220 - L.y[i] * sc; i ? g.lineTo(X, Y) : g.moveTo(X, Y); } g.closePath(); g.stroke(); }
  for (let k = 0; k < laps.length; k += 2) { const L = laps[k]; g.strokeStyle = `hsla(${220 - (k / laps.length) * 200},60%,40%,0.5)`; g.beginPath(); for (let i = 0; i < L.x.length; i++) { const X = ox + 190 + L.x[i] * sc * 0.9, Y = 620 - k * 0.3 * 7 - L.y[i] * sc * 0.3; i ? g.lineTo(X, Y) : g.moveTo(X, Y); } g.stroke(); }
});
fs.writeFileSync("out/one.png", cv.toBuffer("image/png"));
