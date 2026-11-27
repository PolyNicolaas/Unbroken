const { loopOf, smooth, sheet } = require("./lib.js");
const A = loopOf((t) => [20 * Math.cos(t), 13 * Math.sin(t)]);
// B: a pebble: a little fuller at one end and tilted, like a stone
const B = smooth(loopOf((t) => { const x = 20 * Math.cos(t), y = 13 * Math.sin(t) * (1 + 0.12 * Math.cos(t)), a = 0.18; return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]; }), 0.5);
// C: a soft oblong (a superellipse): flatter sides, round ends
const C = loopOf((t) => { const c = Math.cos(t), s = Math.sin(t), p = 2 / 3.2; return [20 * Math.sign(c) * Math.abs(c) ** p, 12 * Math.sign(s) * Math.abs(s) ** p]; });
sheet("oval.png", [["A · ellipse", A], ["B · pebble", B], ["C · soft oblong", C]]);
