const { UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
// a closed line round two squares joined by a narrow neck: two areas the infill can fill
function twoSquares() {
  const x = [], y = [];
  const P = [[20, 20], [120, 20], [120, 67], [160, 67], [160, 20], [260, 20], [260, 120], [160, 120], [160, 73], [120, 73], [120, 120], [20, 120]];
  for (let i = 0; i < P.length; i++) { const [a, b] = P[i], [c, d] = P[(i + 1) % P.length], n = Math.ceil(Math.hypot(c - a, d - b)); for (let k = 0; k < n; k++) { x.push(a + ((c - a) * k) / n); y.push(b + ((d - b) * k) / n); } }
  return { x, y, idx: x.map((_, i) => i) };
}
module.exports = {
  id: "E42", title: "Infill on a mask: only the areas asked for are filled (a printer's filled levels)",
  guards: "a level set to Fill filling every enclosed area, or none, and the fill no longer one line with the outline",
  why: "On a printer a level set to Fill prints solid inside its traced outline (v121): the layers' infill (UNB.infill) is told which areas to fill with a mask of the level's blocks (areaMask), so the other enclosed areas stay open.",
  how: "A closed line round two 100 × 100 px squares joined by a 6 px neck (narrower than the wall the infill keeps from a line, so two areas); fills it with rows 8 px apart three ways: no mask, a mask over the left square, a mask over neither.",
  pass: "No mask: 2 areas filled; the left square's mask: 1, and every fill point on the left; no area on the mask: 0 filled, the line as it was; the filled line longer than the outline (the rows are in it).",
  async run() {
    const checks = [], P = twoSquares(), w = 300, h = 150;
    const mask = (fn) => { const m = new Uint8Array(w * h); for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) m[yy * w + xx] = fn(xx, yy) ? 1 : 0; return { mask: m, w, h }; };
    const all = UNB.infill(P, 8, { rows: 8, pattern: "lines" });
    const left = UNB.infill(P, 8, { rows: 8, pattern: "lines", areaMask: mask((x) => x < 120) });
    const none = UNB.infill(P, 8, { rows: 8, pattern: "lines", areaMask: mask(() => false) });
    const fillX = []; for (let i = 0; i < left.x.length; i++) if (left.idx[i] === -1) fillX.push(left.x[i]);
    checks.push(check("no mask: areas filled", all.areas, "==", 2), check("left square's mask: areas filled", left.areas, "==", 1), check("… fill points right of the left square", fillX.filter((x) => x > 125).length, "==", 0));
    checks.push(check("no area on the mask: none filled, the line unchanged", +(none.areas === 0 && none.x.length === P.x.length), "==", 1), check("the filled line ÷ the outline (points)", left.x.length / P.x.length, ">", 1.5));
    return { checks, notes: `points: outline ${P.x.length}, left filled ${left.x.length}, both ${all.x.length}` };
  },
};
