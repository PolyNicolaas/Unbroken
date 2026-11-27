const { smooth, sheet, loopOf, polyline, ln } = require("./lib.js");
// round bubble: ellipse with a tail cut in at the bottom left
function roundBubble(tx, ty, a0, a1) {
  const P = []; const N = 1440;
  for (let i = 0; i < N; i++) { const t = a1 + ((2 * Math.PI - (a1 - a0)) * i) / N; P.push([20 * Math.cos(t), 14 * Math.sin(t)]); }
  const end = P[P.length - 1], start = P[0];
  return [...P, ...ln(end, [tx, ty], 60), ...ln([tx, ty], start, 60)];
}
// A: oval bubble, tail down-left
const A = smooth(roundBubble(-15, -21, 3.6, 3.95), 0.6);
// B: rounded rectangle bubble with a straight tail
const B = smooth(polyline([[-20, -8], [-12, -8], [-15, -18], [-3, -8], [20, -8], [20, 14], [-20, 14]]), 1.6);
// C: thought-ish cloud with a curly tail? keep it simple: tall oval, tail to the right
const C = smooth(roundBubble(19, -19, -1.25, -0.85).map(([x, y]) => [x, y]), 0.6);
sheet("bubble.png", [["A · oval", A], ["B · box", B], ["C · tail right", C]]);
