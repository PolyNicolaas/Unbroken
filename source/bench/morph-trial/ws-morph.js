const { wordShape } = require("./wordshape.js"), { UNB } = require("./shapes.js");
const { createCanvas } = require("/home/claude/Unbroken/source/tests/node_modules/@napi-rs/canvas");
const fs = require("fs");
const heartXY = (R) => { const x = [], y = []; for (let i = 0; i < 2000; i++) { const t = (2 * Math.PI * i) / 2000; x.push(16 * Math.sin(t) ** 3 * R / 17); y.push((13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * R / 17); } return { x: x.reverse(), y: y.reverse() }; };
function plan(x, y) { const O = UNB.vaseLineLoop(x, y); return { P: { kind: "drawing", loop: O.loop, round: 0 }, reach: O.reach }; }
const out = [];
for (const [word, cap, flip] of JSON.parse(process.argv[2])) {
  const S = wordShape(word, { cap }), wl = plan(S.loop.map((p) => p[0]), S.loop.map((p) => p[1]));
  const hl = plan(...Object.values(heartXY(Math.max(18, wl.reach * 0.8))));
  const [b, t] = flip ? [wl, hl] : [hl, wl];
  const V = Object.assign(UNB.vaseDefaults(), { height: 30, profile: [[0, b.reach], [1, t.reach]], move: { kind: "none", size: 0, count: 1, shift: 0, flip: 0 }, plan: b.P, planTop: t.P });
  const t0 = Date.now(), it = UNB.vaseStack(V, { h: 0.3, base: 0, w: 0.84, d: 1.34, overhang: 0.28 }); let r; while (!(r = it.next()).done); const R = r.value, m = R.morph;
  const line = `${flip ? word + " → heart" : "heart → " + word} (cap ${cap} mm): ${Date.now() - t0} ms; laps kept apart ${m.kept} (${m.crossed} crossed), most moved ${m.moved.toFixed(2)} mm, closest ${m.closest.toFixed(2)} mm; overhang out ${R.overhang.worst.toFixed(2)} / in ${(R.overhang.inWorst).toFixed(2)} past the hold`;
  console.log(line);
  out.push({ R, line, reach: Math.max(b.reach, t.reach) });
}
const W = 1100, cv = createCanvas(W, out.length * 460), g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
out.forEach(({ R, line, reach }, q) => {
  const oy = q * 460, sc = 200 / reach, laps = R.walls;
  g.fillStyle = "#000"; g.font = "14px sans-serif"; g.fillText(line, 10, oy + 18);
  [0, 0.25, 0.5, 0.75, 1].forEach((f, j) => { const L = laps[Math.round(f * (laps.length - 1))]; g.strokeStyle = `hsl(${220 - j * 50},70%,${35 + j * 5}%)`; g.lineWidth = j === 2 ? 2 : 1.1; g.beginPath(); for (let i = 0; i < L.x.length; i++) { const X = 270 + L.x[i] * sc, Y = oy + 240 - L.y[i] * sc; i ? g.lineTo(X, Y) : g.moveTo(X, Y); } g.closePath(); g.stroke(); });
  for (let k = 0; k < laps.length; k += 2) { const L = laps[k]; g.strokeStyle = `hsla(${220 - (k / laps.length) * 200},60%,40%,0.5)`; g.beginPath(); for (let i = 0; i < L.x.length; i++) { const X = 820 + L.x[i] * sc, Y = oy + 440 - k * 0.3 * 10 - L.y[i] * sc * 0.3; i ? g.lineTo(X, Y) : g.moveTo(X, Y); } g.stroke(); }
});
fs.writeFileSync("out/ws-morph.png", cv.toBuffer("image/png"));
