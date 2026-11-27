const { smooth, sheet, ln, qb } = require("./lib.js");
const arc = (cx, cy, r, a0, a1, n = 120) => Array.from({ length: n }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
// A doorway: flat bottom, straight sides, half-circle top
const A = smooth([...ln([-13, -20], [13, -20]), ...ln([13, -20], [13, 7]), ...arc(0, 7, 13, 0, Math.PI), ...ln([-13, 7], [-13, -20])], 0.8);
// B gothic: pointed top from two arcs
const r = 20, B = smooth([...ln([-12, -20], [12, -20]), ...ln([12, -20], [12, 2]), ...arc(-8, 2, r, 0, Math.acos(8 / 20 * 1)), ...arc(8, 2, r, Math.PI - Math.acos(8 / 20), Math.PI), ...ln([-12, 2], [-12, -20])], 0.8);
// C rainbow: a thick arch band (the inside is part of the outline)
const C = smooth([...arc(0, -10, 22, 0, Math.PI), ...ln([-22, -10], [-12, -10]), ...arc(0, -10, 12, Math.PI, 0), ...ln([12, -10], [22, -10])], 0.8);
sheet("arch.png", [["A · doorway", A], ["B · gothic", B], ["C · rainbow", C]]);
