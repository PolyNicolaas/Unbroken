const { smooth, sheet } = require("./lib.js");
// path from line and quadratic pieces; smooth() evens it out
const qb = (a, c, b, n = 80) => Array.from({ length: n }, (_, i) => { const t = i / n, u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; });
const ln = (a, b, n = 80) => qb(a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b, n);
// A heater: flat top, sides bowing out to a point
const A = smooth([...ln([-16, 18], [16, 18]), ...ln([16, 18], [16, 6]), ...qb([16, 6], [16, -12], [0, -22]), ...qb([0, -22], [-16, -12], [-16, 6]), ...ln([-16, 6], [-16, 18])], 0.7);
// B crest: top dips in the middle, horns at the corners, longer point
const B = smooth([...qb([-17, 20], [0, 10], [17, 20]), ...qb([17, 20], [17, -8], [0, -24]), ...qb([0, -24], [-17, -8], [-17, 20])], 0.7);
// C badge: arched top, point leaning a little to the right
const C = smooth([...qb([-16, 12], [0, 26], [16, 12]), ...qb([16, 12], [17, -10], [3, -22]), ...qb([3, -22], [-15, -12], [-16, 12])], 0.7);
sheet("shield.png", [["A · heater", A], ["B · crest", B], ["C · badge", C]]);
