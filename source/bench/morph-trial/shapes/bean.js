const { loopOf, smooth, sheet } = require("./lib.js");
const rot = (P, a) => P.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
// ellipse with the top pushed in in the middle
const bean = (t, dent, w = 11, lop = 0) => { const x = 20 * Math.cos(t), s = Math.sin(t); let y = w * s * (1 + lop * Math.cos(t)); if (s > 0) y -= dent * Math.exp(-((x / 8) ** 2)) * s; return [x, y]; };
const A = smooth(loopOf((t) => bean(t, 5)), 0.6);                         // kidney bean
const B = rot(smooth(loopOf((t) => bean(t, 4, 12, 0.18)), 0.6), 0.2);     // one end bigger
const C = rot(smooth(loopOf((t) => bean(t, 7.5, 13, 0.1)), 0.8), -0.15);   // deep peanut-ish
sheet("bean.png", [["A · kidney", A], ["B · lopsided", B], ["C · deep", C]]);
