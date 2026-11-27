const { loopOf, smooth, sheet } = require("./lib.js");
// radius switches between root and tip with sloped flanks; then smoothed
const gear = (n, r0, r1, duty = 0.5, slope = 0.12) => loopOf((t) => {
  const f = ((t / (2 * Math.PI)) * n) % 1, d = duty / 2, s = slope;
  let k; const g = Math.abs(f - 0.5);
  if (g < d - s / 2) k = 1; else if (g > d + s / 2) k = 0; else k = (d + s / 2 - g) / s;
  const r = r0 + (r1 - r0) * k; return [r * Math.cos(t), r * Math.sin(t)];
}, 2880);
const A = smooth(gear(8, 15, 20, 0.45), 0.5);      // classic 8 teeth
const B = smooth(gear(12, 16.5, 20, 0.5), 0.4);    // fine 12 teeth
const C = smooth(gear(6, 13, 20, 0.5, 0.2), 1.4);  // chunky 6, soft
sheet("gear.png", [["A · 8 teeth", A], ["B · 12 fine", B], ["C · 6 soft", C]]);
