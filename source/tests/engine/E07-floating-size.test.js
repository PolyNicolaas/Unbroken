const S = require("../lib/scenes.js"), { trace, UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
const W = 0.84, D = 1.34;                                   // 18G needle and 0.5 mm gap: line width and centre-to-centre spacing (mm)
module.exports = {
  id: "E07", title: "Smallest print size that keeps the spacing, loops included",
  guards: "nonsense sizes from the \"Smallest that fits\" search; results that depend on history; a size that only fits before the strands and stroke-end loops are added",
  why: "\"Smallest that fits\" picks the print size, so a wrong answer wastes chocolate or gives an unprintable design. The search lays out the real print at every size it tries (doubled strokes as two strands, a keyhole loop at each stroke end) so the size it reports is one where the finished line keeps its spacing. It once returned tiny widths that broke the drawing's shape, and once gave High detail a smaller size than Medium depending on what had been run before.",
  how: "Traces the leaf and runs the search with an 18G needle and a 0.5 mm gap (spacing 1.34 mm) for Low, Medium and High detail, twice each, up to the 340 mm plate width. Then traces the leaf at the Medium width the way the app does and measures the finished line, and the share of it the preview shades as pushed off the drawing (more than the medium tolerance from the fitted series); and the same at 80% of the smallest width.",
  pass: "Every search reports that the spacing fits; widths are in order Low ≤ Medium ≤ High; repeating a search gives the same width; all widths are between 15 and 340 mm; at the Medium width the finished line has no crossings, its closest gap is at least 90% of the spacing and at most 3% of it is pushed off the drawing; below the smallest width more is pushed off.",
  slow: true,
  async run() {
    const r = trace(S.sample("leaf"), { spacingMM: D, lineMM: W }), bw = Math.max(1, r.walk.bbox.maxX - r.walk.bbox.minX);
    const runSearch = (...a) => { const it = UNB.smallestPrintSteps(...a); let x = it.next(); while (!x.done) x = it.next(); return x.value; };   // the search, run to the end
    const run = (maxShift) => runSearch(r.walk, r.w, r.h, { spacing: D, bboxW: bw, lineRatio: W / D, loop: 1, current: 100, maxW: 340, minW: 5, maxShift, maxAngle: 90, minGap: 0.75, allow: null });
    const res = {}; for (const [k, v] of [["low", 0.022], ["medium", 0.013], ["high", 0.007]]) res[k] = [run(v), run(v)];
    const w = (k) => res[k][0].width;
    const checks = [];
    for (const k of ["low", "medium", "high"]) checks.push(check(`${k}: spacing fits`, res[k][0].fits, "==", true), check(`${k}: repeat gives the same width (mm difference)`, Math.abs(res[k][0].width - res[k][1].width), "<=", 0.01), check(`${k}: width (mm)`, w(k), ">=", 15, 1), check(`${k}: width (mm)`, w(k), "<=", 340, 1));
    checks.push(check("low ≤ medium (mm difference)", w("medium") - w("low"), ">=", 0, 1), check("medium ≤ high (mm difference)", w("high") - w("medium"), ">=", 0, 1));
    const m = trace(S.sample("leaf"), { spacingMM: D, lineMM: W, outW: w("medium") });
    checks.push(check("medium width, finished line: crossings", m.fin.after, "==", 0), check("medium width, finished line: closest gap (spacings)", Number.isFinite(m.fin.gap) ? m.fin.gap / m.dpx : 99, ">=", 0.9));
    // what the preview shades as moved lines: little at the medium width, more below the smallest
    const below = trace(S.sample("leaf"), { spacingMM: D, lineMM: W, outW: 0.8 * w("low") });
    checks.push(check("medium width: share of the line pushed off the drawing (%)", 100 * m.fin.problems.driftShare, "<=", 3), check("80% of the smallest width: share pushed off (%)", 100 * below.fin.problems.driftShare, ">", 100 * m.fin.problems.driftShare));
    return { checks, notes: `widths: low ${w("low").toFixed(1)} · medium ${w("medium").toFixed(1)} · high ${w("high").toFixed(1)} mm · pushed off: ${(100 * m.fin.problems.driftShare).toFixed(1)}% at medium, ${(100 * below.fin.problems.driftShare).toFixed(1)}% at 80% of the smallest` };
  },
};
