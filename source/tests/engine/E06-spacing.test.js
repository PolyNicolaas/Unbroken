const S = require("../lib/scenes.js"), { trace } = require("../lib/trace.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "E06", title: "Minimum line spacing is kept",
  guards: "neighbouring chocolate lines flowing into each other",
  why: "A printed chocolate line is about a needle's width; strands closer than that merge. The spacing setting (or the needle + gap) must hold everywhere in the final line, including between the two passes of a retraced stroke.",
  how: "Traces the leaf, shapes and smiley samples at 100 mm wide with a 1.2 mm minimum spacing (a 0.84 mm needle + 0.36 mm gap) and reads the closest gap between non-neighbouring parts of the final line.",
  pass: "Closest gap ≥ 90% of the spacing on every sample (the app's own warning threshold is 80%).",
  async run() {
    const checks = [];
    for (const name of ["leaf", "shapes", "smiley"]) {
      const r = trace(S.sample(name), { spacingMM: 1.2 });
      checks.push(check(`${name}: closest gap (mm)`, Number.isFinite(r.fin.gap) ? r.fin.gap * r.scale : 99, ">=", 0.9 * 1.2, 2));
    }
    return { checks };
  },
};
