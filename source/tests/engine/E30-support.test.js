const { UNB } = require("../lib/trace.js"), M = require("../lib/meshes.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "E30", title: "Support: overhangs measured, and held up by the print's own wall (a flared skirt or a thin wall)",
  guards: "a model that reaches out over nothing without a warning, a support that still leaves a layer stepping out too far, a skirt that ends in the air under a thin arm, a support that leaves a slit beside the model or stands apart from it (the line would have to join a second loop on every layer), a skirt that shrinks an arm from its sides instead of bracing it back into the model, and a thin wall that fills the whole space under an overhang",
  why: "October 2026: one continuous line can't print a separate support, so the support is the outside wall widened from the plate up and stays on the piece. Overhangs found in the challenge prints (a pawn's collar 0.62 mm a layer) went unflagged. Tried and dropped along the way: a skirt that shrank evenly from every edge (a standing r's arm thinned away and dropped to the plate as a block), a skirt + small wall standing apart from the model (a second island the line joined on every layer, a web across the gap), and a straight wall under the whole overhang (the r became a block; v88 replaced it with the thin wall, the same chocolate since only outsides print).",
  how: "A standing letter r (a 7 mm arm on one side of a 3 mm stem, 13–16 mm up, 5 mm deep), a mushroom (a 4 mm stem under a 14 mm cap) and a T (a flat 11 mm arm each side of an 8 mm post), sliced at 0.3 mm with a 0.84 mm line and a 1.34 mm spacing, a step of 0.28 mm (a third of the line): without support, with a skirt and with a thin wall. Measures the worst step-out left (UNB.modelOverhang over the printed outlines), the layer count, how much was added, how many layers join a second loop, and how wide the r's thin wall is near the plate.",
  pass: "Without support the mushroom reaches out more than 1 mm at the cap; with either support the worst step left is at most 0.5 mm (the step plus grid rounding) and no layer is lost (73, 66 and 53 layers); no layer of any supported model joins a second loop; the r on a skirt is a brace (it stops at least 4 mm above the plate); the r on a thin wall reaches the plate, and 2 mm up its middle is at most 3 mm deep (the arm is 5; one narrow loop is 2.18); the mushroom's thin wall is its skirt (round: the middle is the stem).",
  async run() {
    const checks = [], step = 0.28;
    const run = (tri, o) => { const it = UNB.modelStack(UNB.orientMesh(UNB.parseSTL(M.stl(tri)).tri, {}).tri, Object.assign({ scale: 1, z0: 0.3, h: 0.3, base: 0, w: 0.84, d: 1.34, tol: 0.05, overhang: step }, o)); let r = it.next(); while (!r.done) r = it.next(); return r.value; };
    const ones = (r) => r.joins.filter((n) => n > 0).length;
    const mush = M.mushroom(), bare = run(mush, {});
    checks.push(check("mushroom, no support: worst step-out (mm)", bare.overhang.worst, ">", 1), check("… and no support added", +(bare.support === null), "==", 1));
    const R = {};
    for (const mode of ["skirt", "thin"]) {
      const m = run(mush, { support: mode }), t = run(M.tee(), { support: mode }), r = run(M.letterR(), { support: mode }); R[mode] = { m, t, r };
      for (const [name, x, n] of [["mushroom", m, 73], ["T", t, 66], ["r", r, 53]])
        checks.push(check(`${name}, ${mode}: worst step left (mm)`, x.support.after, "<=", 0.5), check(`… layers`, x.T - x.empty, "==", n),
          check(`… layers joining a second loop (a slit, or a support standing apart)`, ones(x), "==", 0));
    }
    checks.push(check("r, skirt: a brace into the stem, not down to the plate: the lowest layer it widens (mm up; the arm is at 13)", R.skirt.r.support.from * 0.3, ">=", 4),
      check("r, thin wall: reaches the plate (lowest widened layer)", R.thin.r.support.from, "==", 0));
    // how deep the r's support is 2 mm up, beside the stem (4–7 mm from its left edge; its far end widens into a foot under the arm's tip): a thin wall, not the arm's full 5 mm
    const L = R.thin.r.walls[6], left = Math.min(...L.x); let y0 = Infinity, y1 = -Infinity;   // (the model is centred: x from its left edge)
    for (let i = 0; i < L.x.length; i++) if (L.x[i] - left > 4 && L.x[i] - left < 7) { y0 = Math.min(y0, L.y[i]); y1 = Math.max(y1, L.y[i]); }
    checks.push(check("r, thin wall 2 mm up: its depth beside the stem (mm; the arm is 5)", y1 - y0 + 0.84, "<=", 3));
    checks.push(check("mushroom: the thin wall is the skirt (area, fraction)", R.thin.m.support.area / R.skirt.m.support.area, "==", 1));
    return { checks, notes: `mushroom ${bare.overhang.worst.toFixed(2)} mm a layer bare; r thin wall ${(y1 - y0 + 0.84).toFixed(2)} mm deep 2 mm up` };
  },
};
