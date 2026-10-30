const { UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "E52", title: "Spirograph: up to six wheels, a centre path drawn by hand, and a frame that crops",
  guards: "a third wheel and on doing nothing, a design with Second wheel ticked losing it, a centre path that doesn't move the figure or closes a line that should be open, and a crop that draws outside its frame or sizes the canvas by the drawing instead of the frame",
  why: "Nicolaas (30 October 2026): keep adding wheels, move the centre along a path drawn by hand (smoothed), and let the drawing start off the canvas (cropped by a frame). v127.",
  how: "Draws the spirograph with 1, 3 and 6 wheels, with the old Second wheel setting, with a path from (−60, 0) to (60, 0) through a wiggle (Smooth 0 and 80), and cropped to a 100% frame with that path.",
  pass: "More wheels, more laps (1 < 3 < 6) and a different line; Second wheel alone is 2 wheels; with the path the line is open, starts about 60 units left of where it ends (± 2 ring widths), and spans over 100 units across; smoothing changes the line; cropped, every piece lies inside the frame, the box is the frame (100% of the ring each way), and there are several pieces.",
  run() {
    const P = (o) => UNB.pattern("spirograph", o);
    const w1 = P({}), w3 = P({ wheels: 3 }), w6 = P({ wheels: 6 }), old = UNB.patternDefaults("spirograph", { wheel2: true });
    const path = [-60, 0, -30, -15, 0, 10, 30, -15, 60, 0];
    const a = P({ path, pathSmooth: 0 }), b = P({ path, pathSmooth: 80 }), c = P({ path, pathSmooth: 40, frame: "crop", frameW: 100, frameH: 100 });
    const pa = a.paths[0], n = pa.length;
    const span = a.box[0], dx = pa[n - 2] - pa[0];
    let inside = true;
    for (const q of c.paths) for (let i = 0; i < q.length; i += 2) if (q[i] < -1e-6 || q[i] > c.box[0] + 1e-6 || q[i + 1] < -1e-6 || q[i + 1] > c.box[1] + 1e-6) inside = false;
    const same = (u, v) => u.paths[0].length === v.paths[0].length && u.paths[0].every((x, i) => Math.abs(x - v.paths[0][i]) < 1e-9);
    return { checks: [
      check("laps: 1 < 3 < 6 wheels", +(w1.laps < w3.laps && w3.laps <= w6.laps && !same(w1, w3)), "==", 1),
      check("Second wheel (older designs) is 2 wheels", old.wheels, "==", 2),
      check("with a path: an open line", +!a.closed[0], "==", 1),
      check("… from left to right: end − start (units)", Math.abs(dx - 120), "<=", 2 * a.ringW),
      check("… spanning (units across)", span, ">", 100),
      check("smoothing changes the line", +!same(a, b), "==", 1),
      check("cropped: every piece inside the frame", +inside, "==", 1),
      check("cropped: the box is the frame (ring widths)", +(c.box[0] / c.ringW).toFixed(3), "==", 1),
      check("cropped: pieces", c.paths.length, ">=", 2),
    ] };
  },
};
