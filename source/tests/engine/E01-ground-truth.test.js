const S = require("../lib/scenes.js"), { trace } = require("../lib/trace.js"), M = require("../lib/measure.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "E01", title: "Line accuracy against known drawings",
  guards: "wobbly or drifting lines; the trace not following the drawing",
  why: "The traced line is what gets printed, so it must sit on the drawing. Wobble crept in once without anyone noticing (the line copied the pixel staircase and the refinement step pulled it back onto whole pixels), because the old error number was measured against those same pixels. This test measures against the true geometry instead, so that can't happen again.",
  how: "Draws five scenes whose true line is known exactly (two rings; circles, a box and a diagonal; the leaf's curves; packed rings beside a spiral; filled shapes in Outline mode) and traces each at 500 px with the app's defaults. It measures two lines against the truth, sampled every 0.5 px with connectors skipped: the fitted Fourier series (the trace itself), and the final line after crossing removal (what is printed). Crossing removal deliberately keeps the two passes of a retraced stroke about 0.75 px apart, so the final line is allowed to sit a little further off on scenes with retraced strokes.",
  pass: "Fitted series: mean distance ≤ 0.16 px, mean 95th percentile ≤ 0.45 px, no scene's mean above 0.20 px. Final line: mean ≤ 0.24 px, no scene above 0.40 px, ≥ 94% of the truth covered within 1 px. (Measured 2026-10-14: series 0.131 / 0.39 px; final 0.19 px, 96% covered. Before the subpixel line the series was 0.345 / 0.95 px.)",
  async run() {
    const rows = [], checks = [];
    for (const [name, sc] of Object.entries(S.TRUTH)) {
      const r = trace(S.truthCanvas(sc), { mode: sc.mode });
      const truth = sc.truth().map(([x, y]) => [x * r.k - 0.5, y * r.k - 0.5]), n0 = r.open ? r.sg.S / 2 + 1 : r.sg.S, c = r.fit.curve, f = r.fin.final;
      const fit = M.distanceToTruth(c.re.slice(0, n0), c.im.slice(0, n0), !r.open, M.jumpMask(r.sg.jumpS.slice(0, n0), 4), truth);
      const fin = M.distanceToTruth(f.re, f.im, !r.open, M.jumpMask(r.fin.jumpF, 4), truth), cov = M.coverage(truth, f.re, f.im, !r.open, 1);
      rows.push({ name, fit, fin, cov, N: r.N });
      checks.push(check(`${name}: series mean distance (px)`, fit.mean, "<=", 0.20), check(`${name}: final line mean distance (px)`, fin.mean, "<=", 0.40));
    }
    const avg = (f) => rows.reduce((a, r) => a + f(r), 0) / rows.length;
    checks.unshift(
      check("series: mean distance (px)", avg((r) => r.fit.mean), "<=", 0.16), check("series: mean 95th percentile (px)", avg((r) => r.fit.p95), "<=", 0.45),
      check("final line: mean distance (px)", avg((r) => r.fin.mean), "<=", 0.24), check("final line: truth covered within 1 px", avg((r) => r.cov), ">=", 0.94));
    return { checks, notes: rows.map((r) => `${r.name}: ${r.N} terms · series ${r.fit.mean.toFixed(3)} / p95 ${r.fit.p95.toFixed(3)} · final ${r.fin.mean.toFixed(3)} · covered ${(100 * r.cov).toFixed(1)}%`).join("  \n") };
  },
};
