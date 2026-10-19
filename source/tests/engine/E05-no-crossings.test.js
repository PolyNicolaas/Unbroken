const S = require("../lib/scenes.js"), { trace, UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "E05", title: "No self-crossings, in the preview and in exported files",
  guards: "the printed line crossing itself (a blob of doubled chocolate)",
  why: "The choc mate 2 can't stop the flow, so every crossing deposits chocolate twice in one spot. Crossings once came back at export time: simplifying the path for the file cut corners across neighbouring strands.",
  how: "Traces the leaf, shapes and smiley samples (plus camera, logo and astronaut photos when present) with crossing removal at \"remove all\", counts crossings in the final line, then repeats the app's export step (simplify at 0.05 mm, untangle again) and counts crossings in the exported path.",
  pass: "Zero crossings in every final line and every exported path.",
  async run(ctx) {
    const cases = [["leaf", "centerline"], ["shapes", "centerline"], ["smiley", "centerline"]];
    if (!ctx.quick) for (const [n, m] of [["camera", "edges"], ["logo", "centerline"], ["astronaut", "edges"]]) if (S.hasImage(n)) cases.push([n, m, true]);
    const checks = [];
    for (const [name, mode, photo] of cases) {
      const r = trace(photo ? await S.image(name) : S.sample(name), { mode });
      const f = r.fin.final, closed = !r.open, n = f.re.length, sc = r.scale;
      let mx = Infinity, my = Infinity; for (let i = 0; i < n; i++) { mx = Math.min(mx, f.re[i]); my = Math.min(my, f.im[i]); }
      const x = Float64Array.from(f.re, (v) => (v - mx) * sc), y = Float64Array.from(f.im, (v) => (v - my) * sc);
      const simp = UNB.simplify(x, y, 0.05, closed), u = UNB.uncross(simp.x, simp.y, closed, { maxAngle: 90 });
      checks.push(check(`${name}: crossings in the line`, UNB.findCrossings(f.re, f.im, closed).length, "==", 0), check(`${name}: crossings in the export`, UNB.findCrossings(u.re, u.im, closed).length, "==", 0));
    }
    return { checks };
  },
};
