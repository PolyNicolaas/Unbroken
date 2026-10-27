const S = require("../lib/scenes.js"), M = require("../lib/measure.js"), { check } = require("../lib/check.js"), UNB = require("../../engine/core.js");
module.exports = {
  id: "E02", title: "Tightly packed strokes are traced separately",
  guards: "close lines merging into one blob",
  why: "Drawings often have lines closer together than the smoothing can resolve (hatching, concentric rings, spirals, lettering). They used to merge into one wide band of ink that was then outlined as a single blob, losing every line inside it.",
  how: "Draws six rings, eight parallel lines and a spiral with strokes 2, 3 and 4 px wide at centre spacings of 4–12 px (only spacings that leave paper between strokes), runs line detection and the walk exactly as the app does, and measures how much of each true line the traced path covers within 1 px.",
  pass: "Mean coverage over all cases ≥ 98%, and every case ≥ 88%. (Measured 2026-10-14: 99.4% mean, lowest 91%. Before stroke splitting: 80.6% mean, lowest 25%.)",
  async run(ctx) {
    const cases = [];
    for (const kind of ["rings", "lines", "spiral"]) for (const lw of ctx.quick ? [3] : [2, 3, 4]) for (const gap of ctx.quick ? [5, 8] : [4, 5, 6, 7, 8, 10, 12]) {
      if (gap <= lw + 0.5) continue;
      const { canvas, truth } = S.packed(kind, gap, lw), W = canvas.width, H = canvas.height;
      const gray = UNB.prep(canvas.getContext("2d").getImageData(0, 0, W, H).data, W, H, { brightness: 0, contrast: 0, bgTol: 0, flatten: false }), bl = UNB.blur(gray, W, H, 1.2);
      const walk = UNB.stageTrace({ blurred: bl, mode: "centerline", sens: 0 }, W, H, { minPix: 15, maxJump: 0, open: false }, { blurred: bl, edges: false });
      cases.push({ kind, lw, gap, cov: walk ? M.coverage(truth, walk.px, walk.py, false, 1) : 0 });
    }
    const mean = cases.reduce((a, c) => a + c.cov, 0) / cases.length, worst = cases.reduce((a, c) => (c.cov < a.cov ? c : a));
    return { checks: [check("mean coverage", mean, ">=", 0.98), check(`lowest coverage (${worst.kind}, ${worst.lw} px wide, ${worst.gap} px apart)`, worst.cov, ">=", 0.88)],
      notes: cases.map((c) => `${c.kind} lw${c.lw} gap${c.gap}: ${(100 * c.cov).toFixed(0)}%`).join(" · ") };
  },
};
