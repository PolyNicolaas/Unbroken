// every basic shape at the bottom, every morph character on top (20 mm letters, 20 mm tall), through UNB.morphCheck
const UNB = require("../../engine/core.js"), F = require("../../engine/fonts.js");
const OPT = { h: 0.3, w: 0.84, d: 1.34, overhang: 0.28 };
const keys = (process.env.SHAPES || Object.keys(UNB.MORPH_SHAPES).join(",")).split(","), font = F[process.env.FONT || "chocolate"];
const letters = {};
for (const ch of UNB.MORPH_CHARS) { const L = UNB.morphLetter(ch, font, Object.assign({ cap: 20, d: 1.34 }, process.env.FONTOPT ? JSON.parse(process.env.FONTOPT) : {})); if (L && L.loops === 1) letters[ch] = UNB.vaseLineLoop(L.x, L.y); }
for (const k of keys) {
  const S = UNB.morphShape(k), B = UNB.vaseLineLoop(S.x, S.y), row = { shape: k, ok: 0, turned: [], fail: [] };
  for (const [ch, O] of Object.entries(letters)) {
    const V = Object.assign(UNB.vaseDefaults(), { height: 20, profile: [[0, 0.9 * O.reach], [0.5, 0.95 * O.reach], [1, O.reach]], move: { kind: "none", size: 0, count: 1, shift: 0, flip: 0 }, texture: { kind: "none" }, plan: { kind: "drawing", loop: B.loop, round: 0.12 }, planTop: { kind: "drawing", loop: O.loop, round: 0, match: "corners", keepApart: true, turn: 0 } });
    const it = UNB.morphCheck(V, OPT); let r; while (!(r = it.next()).done); r = r.value;
    if (r.ok) { row.ok++; if (r.turn) row.turned.push(ch + r.turn); } else row.fail.push(ch);
  }
  row.of = Object.keys(letters).length;
  console.log(JSON.stringify(row));
}
