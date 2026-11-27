const { smooth, sheet, rot } = require("./lib.js");
// crescent: outer circle R at 0, cut by circle r at (dx,dy); walk outer arc outside the cutter then inner arc inside the outer
function crescent(R, r, dx, dy = 0) {
  const P = [], N = 2000;
  const inCut = (x, y) => (x - dx) ** 2 + (y - dy) ** 2 < r * r;
  // outer arc
  const outer = []; for (let i = 0; i < N; i++) { const t = (2 * Math.PI * i) / N, x = R * Math.cos(t), y = R * Math.sin(t); if (!inCut(x, y)) outer.push([t, x, y]); }
  // rotate so the run is contiguous
  let k = outer.findIndex((p, i) => i && p[0] - outer[i - 1][0] > 2 * Math.PI / N * 1.5); if (k > 0) outer.push(...outer.splice(0, k));
  const a = outer[outer.length - 1], b = outer[0];
  const inner = []; let ta = Math.atan2(a[2] - dy, a[1] - dx), tb = Math.atan2(b[2] - dy, b[1] - dx);
  while (tb > ta) tb -= 2 * Math.PI; // go clockwise around the cutter
  for (let i = 0; i <= 400; i++) { const t = ta + ((tb - ta) * i) / 400; inner.push([dx + r * Math.cos(t), dy + r * Math.sin(t)]); }
  return [...outer.map((p) => [p[1], p[2]]), ...inner];
}
const A = smooth(crescent(20, 17, 9, 3), 0.8);          // classic crescent
const B = rot(smooth(crescent(20, 19, 6.5, 1), 0.5), -0.3); // thin sliver
const C = smooth(crescent(20, 15, 12, 6), 1.0);         // fat moon, cut high
sheet("moon.png", [["A · crescent", A], ["B · sliver", B], ["C · fat", C]]);
