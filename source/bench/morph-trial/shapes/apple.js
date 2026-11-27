const { smooth, sheet, loopOf, ln, qb } = require("./lib.js");
// apple body in polar form: dimple at top, small dent at bottom, wider top
const body = (t, lean = 0) => {
  const top = Math.exp(-(((t - Math.PI / 2) / 0.35) ** 2)), bot = Math.exp(-(((t + Math.PI / 2) / 0.3) ** 2));
  const r = 18 * (1 + 0.08 * Math.sin(t) - 0.22 * top - 0.05 * bot);
  return [r * Math.cos(t) * 1.05 + lean * Math.sin(t) * 2, r * Math.sin(t)];
};
const A = smooth(loopOf((t) => body(t)), 0.8);
// B with stem: cut the dimple and add a short stem rising from it
const withStem = (P, leaf) => {
  const i = P.reduce((b, p, k) => (Math.abs(p[0]) < Math.abs(P[b][0]) && p[1] > 0 ? k : b), 0);
  const y0 = P[i][1];
  const stem = [...ln([0.8, y0], [2.5, y0 + 7], 30), ...ln([2.5, y0 + 7], [1, y0 + 7.4], 10), ...ln([1, y0 + 7.4], [-0.9, y0], 30)];
  const L = leaf ? [...qb([2.2, y0 + 5], [6, y0 + 10], [11, y0 + 7]), ...qb([11, y0 + 7], [6, y0 + 3], [2.2, y0 + 4.5])] : [];
  // order: right of dimple -> stem up (with leaf) -> back down left
  const right = P.slice(0, i).filter((p) => !(Math.abs(p[0]) < 0.9 && p[1] > 0)), left = P.slice(i).filter((p) => !(Math.abs(p[0]) < 0.9 && p[1] > 0));
  return [...left, ...right, ...stem.slice(0, 30), ...L, ...stem.slice(30)];
};
const B = smooth(withStem(loopOf((t) => body(t), 1440), false), 0.5);
const C = smooth(withStem(loopOf((t) => body(t, 0.6), 1440), true), 0.5);
sheet("apple.png", [["A · plain", A], ["B · stem", B], ["C · stem + leaf", C]]);
