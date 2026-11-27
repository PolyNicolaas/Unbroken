const { smooth, sheet, polyline } = require("./lib.js");
// A classic zigzag bolt
const A = smooth(polyline([[4, 22], [-10, 1], [-1, 1], [-6, -22], [11, 4], [2, 4], [10, 22]]), 0.5);
// B chunky, fewer steps, soft corners
const B = smooth(polyline([[0, 22], [-12, -2], [-2, -2], [-5, -22], [12, 4], [3, 4], [12, 22]]), 1.2);
// C long thin streak with two kinks
const C = smooth(polyline([[2, 24], [-7, 6], [-1, 6], [-8, -8], [-2, -8], [-6, -24], [9, -3], [3, -3], [10, 10], [4, 10], [10, 24]]), 0.5);
sheet("bolt.png", [["A · classic", A], ["B · chunky", B], ["C · two kinks", C]]);
