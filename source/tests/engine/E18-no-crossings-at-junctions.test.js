const S = require("../lib/scenes.js"), { trace, UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
const W = 0.84, D = 1.34;                                   // 18G needle and 0.5 mm gap
module.exports = {
  id: "E18", title: "Where strokes meet: no crossings, and the full spacing",
  guards: "strands swapping sides at junctions (crossings the clean-up unties into knots), and strands squeezing together where strokes meet",
  why: "Where strokes meet, the line has to pass from one stroke to another. If it picks the next stroke without regard to the strands' sides, the two strands of a stroke swap over and cross, and removing the crossing afterwards reverses a short stretch and leaves a knot. The walk is built as a non-crossing tour instead: at each point only neighbouring strands are joined, each strand sits in the corner it turns round, and the two passes of a stroke keep to opposite sides. Small loops an offset strand makes on the inside of a sharp bend are cut out. Single strokes ease half a spacing into their corner near a junction, so with every strand in its own corner the spacing holds at junctions too, with no slack.",
  how: "Traces the leaf, shapes and smiley samples with an 18G needle and a 0.5 mm gap and counts crossings in the offset path (before the Fourier fit) and in the fitted line (before any clean-up). In the final line it checks there are no crossings and measures the closest gap anywhere, junctions included.",
  pass: "Leaf and smiley: no crossings at either stage; shapes: at most 2 (one stretch the walk must cover twice turns back at a junction; the earlier walk had 20). No crossings in the final line, and the closest gap anywhere is at least 90% of the spacing (it was 0.20–0.37 spacings at junctions before).",
  async run() {
    const checks = [];
    for (const [name, maxOff, maxFit] of [["leaf", 0, 0], ["smiley", 0, 0], ["shapes", 2, 2]]) {
      const r = trace(S.sample(name), { spacingMM: D, lineMM: W });
      const off = UNB.offsetDoubled(r.walk, r.dpx, { loops: true, w: r.dpx * W / D });
      checks.push(check(`${name}: crossings in the offset path`, UNB.findCrossings(off.x, off.y, !r.walk.open).length, "<=", maxOff));
      checks.push(check(`${name}: crossings in the fitted line, before clean-up`, r.fin.before, "<=", maxFit));
      checks.push(check(`${name}: crossings in the final line`, r.fin.after, "==", 0));
      const f = r.fin.final, all = UNB.closestGap(f.re, f.im, 2 * r.dpx, true, null);
      checks.push(check(`${name}: closest gap anywhere, junctions included (spacings)`, Number.isFinite(all) ? all / r.dpx : 9, ">=", 0.9));
    }
    return { checks };
  },
};
