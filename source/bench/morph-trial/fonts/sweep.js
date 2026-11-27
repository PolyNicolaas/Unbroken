// FONT json × bottoms → morphCheck pass/fail per character (20 mm letters on 20 mm tall morphs)
const UNB = require("../../../engine/core.js"), fs = require("fs");
const font = JSON.parse(fs.readFileSync(process.argv[2] + ".json")), OPT = { h: 0.3, w: 0.84, d: 1.34, overhang: 0.28 };
const shapes = Object.fromEntries(JSON.parse(fs.readFileSync("../shapes/approved-shapes.json")));
const bottoms = (process.argv[3] || "oval pebble,heart hand-drawn,square,star chubby").split(",");
const row = { font: process.argv[2], ok: {}, fail: {}, bad: [] };
const letters = {};
for (const ch of UNB.MORPH_CHARS) { const L = UNB.morphLetter(ch, font, { cap: 20, d: 1.34 }); if (L && L.loops === 1) letters[ch] = UNB.vaseLineLoop(L.x, L.y); else row.bad.push(ch); }
for (const b of bottoms) {
  const P = shapes[b], B = UNB.vaseLineLoop(P.map((p) => p[0]), P.map((p) => p[1])); row.ok[b] = 0; row.fail[b] = "";
  for (const [ch, O] of Object.entries(letters)) {
    const V = Object.assign(UNB.vaseDefaults(), { height: 20, profile: [[0, 0.9 * O.reach], [0.5, 0.95 * O.reach], [1, O.reach]], move: { kind: "none", size: 0, count: 1, shift: 0, flip: 0 }, texture: { kind: "none" }, plan: { kind: "drawing", loop: B.loop, round: 0.12 }, planTop: { kind: "drawing", loop: O.loop, round: 0, match: "corners", keepApart: true, turn: 0 } });
    const it = UNB.morphCheck(V, OPT); let r; while (!(r = it.next()).done); r = r.value;
    if (r.ok) row.ok[b]++; else row.fail[b] += ch;
  }
}
row.of = Object.keys(letters).length;
console.log(JSON.stringify(row));
