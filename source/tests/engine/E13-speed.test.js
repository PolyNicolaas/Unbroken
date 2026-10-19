const S = require("../lib/scenes.js"), { trace } = require("../lib/trace.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "E13", title: "Tracing time stays within budget",
  guards: "a change making tracing several times slower",
  why: "Every setting change re-traces. The page stays responsive because the work runs in the background, but the result still has to arrive quickly enough to adjust settings by eye. Budgets are about three times the time measured on 2026-10-14, so normal machine differences pass and real slowdowns don't.",
  how: "Times the full trace (detection, walk, fit, crossing removal and measurements) of the leaf sample, the smiley, and the camera photo in Outline mode when present.",
  pass: "Leaf ≤ 4 s, smiley ≤ 4 s, camera ≤ 12 s. (Measured 2026-10-14: about 1.2 s, 1.1 s and 3.5 s.)",
  async run(ctx) {
    const checks = [], notes = [];
    for (const [name, mode, budget, photo] of [["leaf", "centerline", 4], ["smiley", "centerline", 4], ["camera", "edges", 12, true]]) {
      if (photo && (!S.hasImage(name) || ctx.quick)) continue;
      const r = trace(photo ? await S.image(name) : S.sample(name), { mode });
      checks.push(check(`${name}: trace time (s)`, r.ms.total / 1000, "<=", budget, 2));
      notes.push(`${name}: walk ${(r.ms.walk / 1000).toFixed(2)} · signal+sweep ${(r.ms.signal / 1000).toFixed(2)} · fit ${(r.ms.fit / 1000).toFixed(2)} · final ${(r.ms.final / 1000).toFixed(2)} s`);
    }
    return { checks, notes: notes.join("  \n") };
  },
};
