// shape to shape: every ordered pair, even vs corners pairing, turns
const { UNB } = require("./shapes.js"), { SH } = require("./shp.js");
const D = 1.34, HOLD = 0.28;
const hx = [], hy = []; for (let i = 0; i < 1440; i++) { const t = (2 * Math.PI * i) / 1440; hx.push(16 * Math.sin(t) ** 3); hy.push(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)); }
const HO = UNB.vaseLineLoop(hx.reverse(), hy.reverse());
const ALL = Object.assign({}, SH, { heart: { kind: "drawing", loop: HO.loop, round: 0.12 } });
const names = (process.env.FROM || Object.keys(ALL).join(",")).split(","), tos = Object.keys(ALL), turns = (process.env.TURNS || "0").split(",").map(Number);
const R0 = +(process.env.R || 20);
for (const a of names) for (const b of tos) {
  if (a === b) continue;
  const row = { a, b };
  for (const match of ["even", "corners"]) row[match] = turns.map((turn) => {
    const V = Object.assign(UNB.vaseDefaults(), { height: +(process.env.H || 20), profile: [[0, R0], [1, +(process.env.R1 || R0)]], move: { kind: "none", size: 0, count: 1, shift: 0, flip: 0 }, plan: ALL[a], planTop: Object.assign({}, ALL[b], { match, turn }) });
    const it = UNB.vaseStack(V, { h: 0.3, base: 0, w: 0.84, d: D, overhang: HOLD }); let r; while (!(r = it.next()).done); const R = r.value, m = R.morph;
    return +(Math.max(0, R.overhang.worst - HOLD) + R.overhang.inWorst + Math.max(0, 0.9 * D - m.closest) + 0.2 * Math.max(0, m.moved - 2 * D)).toFixed(2);
  });
  console.log(JSON.stringify(row));
}
