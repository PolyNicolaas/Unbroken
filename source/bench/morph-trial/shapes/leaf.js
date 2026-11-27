const { loopOf, smooth, sheet } = require("./lib.js");
const rot = (P, a) => P.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
// pointed both ends: y ~ s|s| gives a real tip; bulge moves the widest point (u=0 base, 1 tip)
const leaf = (t, w, bulge = 0, bend = 0) => {
  const c = Math.cos(t), s = Math.sin(t), x = 20 * c, u = (x + 20) / 40;
  const width = w * s * Math.abs(s) * (1 + bulge * (0.5 - u)) * 1.0;
  return [x, width + bend * (1 - (2 * u - 1) ** 2)];
};
const A = rot(smooth(loopOf((t) => leaf(t, 6.5, 0.4, 3.5)), 0.4), 0.45);   // willow
const B = rot(smooth(loopOf((t) => leaf(t, 10, 0.6, 1.5)), 0.5), 0.9);       // broad
const C = rot(smooth(loopOf((t) => leaf(t, 8, 0.2, 0)), 0.5), 0.785);   // plain, straight
sheet("leaf.png", [["A · willow", A], ["B · broad", B], ["C · plain", C]]);
