const { smooth, sheet } = require("./lib.js");
// real phase: lit limb is the right half circle, the shadow edge is the half ellipse x = c·R·cos(t)
// c: 1 new moon, 0 half, -1 full
const phase = (c, R = 20, n = 720) => {
  const P = [];
  for (let i = 0; i <= n; i++) { const t = -Math.PI / 2 + (Math.PI * i) / n; P.push([R * Math.cos(t), R * Math.sin(t)]); }
  for (let i = 1; i < n; i++) { const t = Math.PI / 2 - (Math.PI * i) / n; P.push([R * c * Math.cos(t), R * Math.sin(t)]); }
  return P;
};
const set = [["1 · sliver", 0.75], ["2 · crescent", 0.45], ["3 · half", 0], ["4 · gibbous", -0.5], ["5 · full", -1]];
sheet("moons.png", set.map(([k, c]) => [k, smooth(phase(c), 0.6)]));
