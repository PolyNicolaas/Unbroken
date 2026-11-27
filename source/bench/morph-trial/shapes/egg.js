const { loopOf, smooth, sheet } = require("./lib.js");
const egg = (t, k = 0.2) => [14 * Math.cos(t) * (1 + k * Math.sin(t)), 19 * Math.sin(t)];
const A = loopOf((t) => egg(t));
const rot = (P, a) => P.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
const B = rot(loopOf((t) => egg(t, 0.24)), 0.28); // leaning
const C = loopOf((t) => egg(t, 0.32)).map(([x, y]) => [x * 1.15, y * 0.95]); // plump
sheet("egg.png", [["A · upright", A], ["B · leaning", B], ["C · plump", C]]);
