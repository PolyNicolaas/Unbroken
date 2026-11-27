const { smooth, sheet, polyline, rot } = require("./lib.js");
const cross = (a, w, t = a) => polyline([[-w, t], [w, t], [w, w], [a, w], [a, -w], [w, -w], [w, -a], [-w, -a], [-w, -w], [-a, -w], [-a, w], [-w, w]].map(([x, y]) => [x, y === t && t !== a ? t : y]));
const plusOf = (a, w, top = a) => polyline([[-w, top], [w, top], [w, w], [a, w], [a, -w], [w, -w], [w, -a], [-w, -a], [-w, -w], [-a, -w], [-a, w], [-w, w]]);
const A = smooth(plusOf(20, 6.5), 1.2);                 // chunky plus, soft corners
const B = rot(smooth(plusOf(20, 4.5), 0.8), 0.2);       // slim plus, tilted a little
const C = smooth(plusOf(20, 5, 26).map(([x, y]) => [x, y]), 1.0); // cross with a longer top arm... flipped below
const C2 = C.map(([x, y]) => [x, -y + 3]);              // long arm at the bottom (church cross)
sheet("plus.png", [["A · chunky", A], ["B · slim tilt", B], ["C · cross", C2]]);
