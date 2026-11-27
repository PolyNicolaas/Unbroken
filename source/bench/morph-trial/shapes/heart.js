const { loopOf, smooth, sheet } = require("./lib.js");
const classic = (t) => [16 * Math.sin(t) ** 3, 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)];
const A = smooth(loopOf(classic), 1.2);
// B: hand-drawn: the left lobe a little bigger and higher, the point off to the right
const B = smooth(loopOf((t) => { const [x, y] = classic(t); const s = x < 0 ? 1.08 : 0.95; return [x * s + 0.12 * y, y + (x < 0 ? 0.9 * Math.max(0, y) / 13 : 0)]; }), 1.3);
// C: fuller: rounder lobes, a shallow dip, a soft point
const C = smooth(loopOf((t) => [16 * Math.sin(t) ** 3 * 1.1, 12 * Math.cos(t) - 4 * Math.cos(2 * t) - 1.2 * Math.cos(3 * t) - 0.6 * Math.cos(4 * t)]), 1.8);
sheet("heart.png", [["A · classic, softened", A], ["B · hand-drawn", B], ["C · fuller", C]]);
module.exports = { A, B, C };
