const { smooth, sheet, polyline } = require("./lib.js");
// A pine: three stacked tiers and a trunk
const A = smooth(polyline([[-3, -20], [3, -20], [3, -14], [17, -14], [8, -4], [13, -4], [5, 5], [9, 5], [0, 20], [-9, 5], [-5, 5], [-13, -4], [-8, -4], [-17, -14], [-3, -14]]), 0.7);
// B round tree: a lumpy crown on a trunk, crown leans right
function crown(cx, cy, R, bumps, amp) { const P = []; for (let i = 0; i < 360; i++) { const t = (2 * Math.PI * i) / 360; const r = R * (1 + amp * Math.abs(Math.sin((bumps * t) / 2))); P.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); } return P; }
const cr = crown(2, 6, 12, 7, 0.12);
const trunkTop = 6 - 11; // where the trunk meets the crown
const Bp = [[-2.5, -20], [2.5, -20], [2.5, trunkTop]];
// walk the crown from the right side of the trunk round to the left side
const angR = Math.atan2(trunkTop - 6, 2.5 - 2) , angL = Math.atan2(trunkTop - 6, -2.5 - 2);
const arcPts = []; for (let a = angR; a < angL + 2 * Math.PI; a += 0.01) { const r = 12 * (1 + 0.12 * Math.abs(Math.sin((7 * a) / 2))); arcPts.push([2 + r * Math.cos(a), 6 + r * Math.sin(a)]); }
const s0 = arcPts[0], s1 = arcPts[arcPts.length - 1];
const B = smooth([...arcPts, ...polyline([s1, [-2.5, -8], [-2.5, -20], [2.5, -20], [2.5, -8], s0]).slice(0, -80)], 0.9);
// C simple: smooth cone tree, slightly bent, with trunk
const C = smooth(polyline([[-2.5, -20], [2.5, -20], [2.5, -15], [13, -15], [1, 20], [-13, -15], [-2.5, -15]]).map(([x, y]) => [x + 2 * ((y + 20) / 40) ** 2, y]), 1.2);
sheet("tree.png", [["A · pine", A], ["B · round", B], ["C · simple", C]]);
