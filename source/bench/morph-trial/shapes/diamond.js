const { smooth, sheet, polyline, qb } = require("./lib.js");
// A gem: flat table on top, short crown, long pavilion to a point
const A = smooth(polyline([[-8, 12], [8, 12], [18, 4], [0, -22], [-18, 4]]), 0.6);
// B kite: tall rhombus, tipped and uneven
const B = smooth(polyline([[1, 22], [13, 2], [-1, -22], [-14, 4]]), 0.8);
// C soft: four puffed-out sides (like a playing-card diamond)
const C = smooth([...qb([0, 22], [6, 9], [15, 0]), ...qb([15, 0], [6, -9], [0, -22]), ...qb([0, -22], [-6, -9], [-15, 0]), ...qb([-15, 0], [-6, 9], [0, 22])].map(([x, y]) => [x * 1.0, y]), 0.6);
sheet("diamond.png", [["A · gem", A], ["B · kite", B], ["C · card", C]]);
