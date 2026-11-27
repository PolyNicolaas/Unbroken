// each glyph at the rim of the app's built-in shapes: 20 mm tall unless H
const { wordShape } = require("./wordshape.js"), { UNB } = require("./shapes.js");
const D = 1.34, HOLD = 0.28;
const plan = (x, y) => { const O = UNB.vaseLineLoop(x, y); return { P: { kind: "drawing", loop: O.loop, round: 0 }, reach: O.reach }; };
const SH = { square: { kind: "polygon", sides: 4, round: 0.25 }, hexagon: { kind: "polygon", sides: 6, round: 0.2 }, star: { kind: "star", sides: 5, depth: 0.4, round: 0.2 }, flower: { kind: "flower", sides: 5, depth: 0.3 }, circle: { kind: "circle" } };
const shapes = (process.env.SHAPES || "square,hexagon,star,flower").split(","), turns = (process.env.TURNS || "0,20,-20").split(",").map(Number), ratio = +(process.env.RATIO || 0.9);
const glyphs = (process.env.GLYPHS || "ABCDEFGHIJKLMNOPQRSTUVWXYZ!?").split("");
for (const ch of glyphs) {
  const S = wordShape(ch, { cap: 20, slit: 1.7, round: 1 }), gl = plan(S.loop.map((p) => p[0]), S.loop.map((p) => p[1])), row = { ch };
  for (const s of shapes) {
    row[s] = turns.map((turn) => {
      const V = Object.assign(UNB.vaseDefaults(), { height: +(process.env.H || 20), profile: [[0, gl.reach * ratio], [1, gl.reach]], move: { kind: "none", size: 0, count: 1, shift: 0, flip: 0 }, plan: SH[s], planTop: Object.assign({}, gl.P, { turn }) });
      const it = UNB.vaseStack(V, { h: 0.3, base: 0, w: 0.84, d: D, overhang: HOLD }); let r; while (!(r = it.next()).done); const R = r.value, m = R.morph;
      return +(Math.max(0, R.overhang.worst - HOLD) + R.overhang.inWorst + Math.max(0, 0.9 * D - m.closest) + 0.2 * Math.max(0, m.moved - 2 * D)).toFixed(2);
    });
  }
  console.log(JSON.stringify(row));
}
