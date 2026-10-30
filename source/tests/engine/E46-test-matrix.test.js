const { UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "E46", title: "The test matrix: the L9 array is balanced, main effects pick the best level, the comb counts",
  guards: "an L9 where a level of one setting misses a level of another (its effects would mix), main effects that average the wrong runs, and a comb with the wrong number of teeth",
  why: "The Test matrix (v124) prints nine copies with three settings at three levels; its use rests on every level of each setting meeting every level of the others exactly once.",
  how: "Counts every pair of levels across every pair of columns of UNB.L9; scores the runs with a known rule (+2 at setting 1's level 2, +1 at setting 2's level 0, nothing from setting 3) and reads UNB.mainEffects; leaves three runs unscored; makes combs of 1 and 9 teeth.",
  pass: "9 runs; each level 3 times in each column; each pair of levels once in each pair of columns; main effects: setting 1 best at level 2 by 2, setting 2 best at level 0 by 1, setting 3 flat; unscored runs left out (6 scored); combs with 4 and 36 points, the 9-tooth one 22.5 mm wide.",
  run() {
    const L = UNB.L9, checks = [];
    let balanced = true, pairs = true;
    for (let c = 0; c < 3; c++) for (let v = 0; v < 3; v++) if (L.filter((r) => r[c] === v).length !== 3) balanced = false;
    for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) for (let u = 0; u < 3; u++) for (let v = 0; v < 3; v++) if (L.filter((r) => r[a] === u && r[b] === v).length !== 1) pairs = false;
    checks.push(check("runs", L.length, "==", 9), check("each level three times in each column", +balanced, "==", 1), check("each pair of levels once in each pair of columns", +pairs, "==", 1));
    const sc = L.map((r) => 1 + (r[0] === 2 ? 2 : 0) + (r[1] === 0 ? 1 : 0));
    const fx = UNB.mainEffects(L, sc);
    checks.push(check("setting 1: best level 2, 2 above the others", +(fx.settings[0].best === 2 && Math.abs(fx.settings[0].mean[2] - fx.settings[0].mean[0] - 2) < 1e-9), "==", 1));
    checks.push(check("setting 2: best level 0, 1 above the others", +(fx.settings[1].best === 0 && Math.abs(fx.settings[1].mean[0] - fx.settings[1].mean[1] - 1) < 1e-9), "==", 1));
    checks.push(check("setting 3: flat (its means equal)", +(Math.max(...fx.settings[2].mean) - Math.min(...fx.settings[2].mean) < 1e-9), "==", 1));
    const part = UNB.mainEffects(L, sc.map((v, i) => (i < 3 ? null : v)));
    checks.push(check("unscored runs left out", part.scored, "==", 6));
    const c1 = UNB.testComb(0, 0, 1), c9 = UNB.testComb(10, 5, 9);
    checks.push(check("combs: points for 1 and 9 teeth", `${c1.x.length},${c9.x.length}`, "==", "4,36"), check("9 teeth: 22.5 mm wide", +(Math.max(...c9.x) - 10 + 1.25).toFixed(2), "==", 22.5));
    return { checks };
  },
};
