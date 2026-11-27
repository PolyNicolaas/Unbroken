const { smooth, sheet, ln, qb, rot } = require("./lib.js");
const arc = (cx, cy, r, a0, a1, n = 80) => Array.from({ length: n }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
// bell body: domed top, flaring skirt, flat lip; optional clapper bump under the lip
const bell = (w = 18, clap = 0) => [
  ...ln([-w, -12], [w, -12]),
  ...qb([w, -12], [w - 3, -9], [w - 6, -6]),
  ...qb([w - 6, -6], [10, 2], [9, 10]),
  ...arc(0, 10, 9, 0, Math.PI),
  ...qb([-9, 10], [-10, 2], [-w + 6, -6]),
  ...qb([-w + 6, -6], [-w + 3, -9], [-w, -12]),
];
const withClapper = (P, w = 18) => { const i = P.findIndex(([x, y]) => y === -12 && x >= 0); const L = ln([-w, -12], [-4, -12]).concat(arc(0, -12, 4, Math.PI, 2 * Math.PI)).concat(ln([4, -12], [w, -12])); return L.concat(P.slice(160)); };
const A = smooth(bell(), 0.8);
const B = smooth(withClapper(bell()), 0.7);
const C = smooth(withClapper(bell(22), 22).map(([x, y]) => [x, y * 0.8]), 0.8); // wide and low
sheet("bell.png", [["A · plain", A], ["B · clapper", B], ["C · wide", C]]);
