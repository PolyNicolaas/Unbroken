const { loopOf, smooth, sheet } = require("./lib.js");
const rot = (P, a) => P.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
// teardrop: round bottom, point at top (t=pi/2)
const drop = (t, m = 2.2) => [14 * Math.cos(t) * Math.pow((1 - Math.sin(t)) / 2, m / 2) * 1.6, 20 * Math.sin(t)];
const A = smooth(loopOf((t) => drop(t)), 0.6);
// tip bends to one side, like a falling drop
const B = smooth(loopOf((t) => { const [x, y] = drop(t, 2.6); const u = (y + 20) / 40; return [x + 7 * u * u * u, y]; }), 0.8);
// fat and short, slight tilt
const C = smooth(loopOf((t) => { const [x, y] = drop(t, 1.4); return [x * 1.2 + 0.08 * y, y * 0.8]; }), 1.6); // fat, soft tip
sheet("drop.png", [["A · classic", A], ["B · falling", B], ["C · fat", C]]);
