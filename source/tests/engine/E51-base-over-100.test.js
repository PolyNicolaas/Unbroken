const { UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js"), M = require("../lib/meshes.js");
const baseLine = (bd) => { const tri = UNB.parseSTL(M.stl(M.cylinder(15, 5, 0, 0))).tri, it = UNB.modelStack(tri, { scale: 1, z0: 0.3, h: 0.3, base: 1, w: 0.84, d: 1.34, walls: 1, tol: 0.05, baseDensity: bd, basePattern: "lines", infillDensity: 0 }); let r; while (!(r = it.next()).done); const L = r.value.base[0]; let n = 0; for (let i = 1; i < L.x.length; i++) n += Math.hypot(L.x[i] - L.x[i - 1], L.y[i] - L.y[i - 1]); return n; };
module.exports = {
  id: "E51", title: "A base denser than 100% (up to 125%): rows closer than a line width, for a surely solid base",
  guards: "a base density over 100% clamped back to 100% (no denser), or no limit (a base packed far past what the needle can lay)",
  why: "Nicolaas (30 October 2026): a base at 100% has its rows just touching; up to 125% overlaps them a little so the base is surely solid. The infill stays at most 100%.",
  how: "Reads UNB.fillPlan's row spacing for a base and an infill at 125%, and the length of a 30 mm disc's base line at 100%, 125% and 150%.",
  pass: "Base at 125%: rows 0.672 mm apart (0.84 ÷ 1.25); infill at 125%: 0.84 (held at 100%); the base line at 125% about 1.25× (over 1.15×) as long as at 100%; 150% no longer than 125%.",
  run() {
    const pb = UNB.fillPlan({ w: 0.84, baseDensity: 1.25 }, true, 0), pi = UNB.fillPlan({ w: 0.84, infillDensity: 1.25 }, false, 0);
    const a = baseLine(1), b = baseLine(1.25), c = baseLine(1.5);
    return { checks: [
      check("base 125%: row spacing (mm)", +pb.spacing.toFixed(3), "==", 0.672),
      check("infill 125%: row spacing (mm), held at 100%", +pi.spacing.toFixed(3), "==", 0.84),
      check("base line at 125% ÷ at 100%", b / a, ">", 1.15),
      check("base line at 150% ÷ at 125% (capped)", +(c / b).toFixed(3), "<=", 1.001),
    ] };
  },
};
