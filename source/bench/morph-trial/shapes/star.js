const { smooth, sheet, polyline, loopOf } = require("./lib.js");
const star = (n, R, r, a0 = Math.PI / 2, jit = []) => polyline(Array.from({ length: 2 * n }, (_, i) => { const a = a0 + (Math.PI * i) / n, k = i % 2 ? r : R * (jit[i / 2] || 1); return [k * Math.cos(a), k * Math.sin(a)]; }));
// A tilted 5-point star, one arm longer (hand-drawn feel)
const A = smooth(star(5, 20, 8.5, Math.PI / 2 + 0.25, [1, 0.92, 1.05, 0.95, 0.9]), 0.8);
// B chubby star with soft round points
const B = smooth(star(5, 20, 11, Math.PI / 2 + 0.15), 2.2);
// C four-point sparkle with curved-in sides
const C = smooth(loopOf((t) => { const p = 0.55, r = 20 / Math.pow(Math.abs(Math.cos(t)) ** p + Math.abs(Math.sin(t)) ** p, 1 / p); const a = t; return [r * Math.cos(a), r * Math.sin(a) * 1.3]; }, 2880), 1.2);
sheet("star.png", [["A · tilted", A], ["B · chubby", B], ["C · sparkle", C]]);
