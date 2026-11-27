const { smooth, sheet, polyline } = require("./lib.js");
// A classic: box with a gable roof, small eaves
const A = smooth(polyline([[-14, -18], [14, -18], [14, 2], [18, 2], [0, 20], [-18, 2], [-14, 2]]), 0.8);
// B with chimney, roof off-centre (not symmetric)
const B = smooth(polyline([[-15, -18], [15, -18], [15, 2], [5, 18], [-3, 11.6], [-3, 17], [-8, 17], [-8, 7.6], [-15, 2]].map(([x, y]) => [x, y])), 0.8);
// C cottage: tall narrow, steep roof, soft
const C = smooth(polyline([[-10, -20], [10, -20], [10, 4], [0, 22], [-10, 4]]), 1.5);
sheet("house.png", [["A · classic", A], ["B · chimney", B], ["C · tall", C]]);
