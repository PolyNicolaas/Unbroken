const { loopOf, smooth, sheet } = require("./lib.js");
// union of circles traced as an outline: sample angle from a center, take the farthest boundary hit
function blob(circles, cx = 0, cy = 0) {
  return loopOf((t) => {
    const dx = Math.cos(t), dy = Math.sin(t); let best = 0;
    for (const [x, y, r] of circles) { const ox = x - cx, oy = y - cy, b = ox * dx + oy * dy, c = ox * ox + oy * oy - r * r, D = b * b - c; if (D >= 0) best = Math.max(best, b + Math.sqrt(D)); }
    return [cx + best * dx, cy + best * dy];
  }, 1440);
}
// flat bottom: a wide low rounded box plus bumps on top
const A = smooth(blob([[-12, -3, 7], [-3, 3, 9.5], [9, 1, 8], [16, -4, 5.5], [0, -5, 7.5], [-8, -6, 6], [9, -6, 6]], 0, -1), 0.8);
const B = smooth(blob([[-14, -2, 6], [-5, 4, 8], [6, 6, 10], [16, 0, 7], [2, -5, 8], [-9, -6, 5.5], [13, -6, 5]], 0, 0), 0.8);
const C = smooth(blob([[-10, 0, 8], [3, 5, 9], [13, -1, 7], [2, -4, 8]], 0, 0), 1.0);
sheet("cloud.png", [["A · fluffy", A], ["B · tall puff", B], ["C · simple", C]]);
