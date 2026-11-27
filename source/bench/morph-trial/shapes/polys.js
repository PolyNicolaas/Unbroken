const { smooth, sheet } = require("./lib.js");
// regular polygon (circumradius 20) with every corner filleted at the same radius rc
function roundNgon(n, a0, rc = 2.5) {
  const V = Array.from({ length: n }, (_, i) => { const a = a0 + (2 * Math.PI * i) / n; return [20 * Math.cos(a), 20 * Math.sin(a)]; });
  const P = [], half = Math.PI / n;          // half the turn at each corner
  const inset = rc / Math.sin(Math.PI / 2 - half); // corner to fillet centre
  V.forEach(([x, y]) => {
    const a = Math.atan2(y, x), r = Math.hypot(x, y) - inset, cx = r * Math.cos(a), cy = r * Math.sin(a);
    for (let k = 0; k <= 40; k++) { const t = a - half + (2 * half * k) / 40; P.push([cx + rc * Math.cos(t), cy + rc * Math.sin(t)]); }
  });
  return smooth(P, 0); // even spacing only
}
sheet("polys.png", [
  ["square", roundNgon(4, Math.PI / 4)],
  ["triangle", roundNgon(3, Math.PI / 2)],
  ["pentagon", roundNgon(5, Math.PI / 2)],
  ["hexagon", roundNgon(6, 0)],
]);
module.exports = { roundNgon };
