const { UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");

// a 1-px line map from strokes of [x, y] points
function map(w, h, strokes) {
  const m = new Uint8Array(w * h);
  for (const s of strokes)
    for (let i = 1; i < s.length; i++) {
      const [x0, y0] = s[i - 1], [x1, y1] = s[i], n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
      for (let k = 0; k <= n; k++) m[Math.round(y0 + ((y1 - y0) * k) / n) * w + Math.round(x0 + ((x1 - x0) * k) / n)] = 1;
    }
  return UNB.thin(m, w, h);
}
const ring = (cx, cy, r) => Array.from({ length: 121 }, (_, i) => [cx + r * Math.cos((i / 120) * 2 * Math.PI), cy + r * Math.sin((i / 120) * 2 * Math.PI)]);
// how often the walk passes each line pixel (connector points left out)
function passes(walk, w, lines) {
  const n = new Map();
  for (let i = 0; i + 1 < walk.px.length; i++) {
    if (walk.jmp[i]) continue;
    const p = walk.py[i] * w + walk.px[i];
    if (lines[p]) n.set(p, (n.get(p) || 0) + 1);
  }
  return n;
}
module.exports = {
  id: "E56", title: "Lettering: every open stroke drawn out and back, a letter's loops once round (doubleOpen)",
  guards: "letters printed with some strokes as a single strand, so two neighbouring strokes read as one (ll as one l)",
  why: "The walk doubles as few strokes as it can. Joined by connectors, two l's were drawn up one, across the top and down the other, each once: two single strands a pair's width apart, which read as one l (6 November 2026). For lettering every stroke that isn't part of a loop is drawn twice, and the loops (o, the bowl of e) once round.",
  how: "Builds walks with doubleOpen on line maps: two upright strokes side by side (ll), a ring with a stem (b), a ring with a bar across it (θ: loop edges meeting three at a point), and checks how often the walk passes each line pixel.",
  pass: "ll: every pixel of both strokes passed twice; b: the stem twice, the ring once; θ: every pixel passed, none more than twice, the walk closed; without doubleOpen the ll strokes are passed once (the case this guards).",
  run() {
    const checks = [], w = 120, h = 90;
    // ll: two upright strokes 6 px apart
    const ll = map(w, h, [[[30, 15], [30, 75]], [[36, 15], [36, 75]]]);
    const opt = { minPix: 0, maxJump: 0, open: false };
    const a = UNB.buildWalk(ll, w, h, { ...opt, doubleOpen: true }), na = passes(a, w, ll);
    const b0 = UNB.buildWalk(ll, w, h, opt), nb = passes(b0, w, ll);
    const px = [...ll.keys()].filter((p) => ll[p]);
    checks.push(check("ll: pixels passed twice (doubleOpen)", px.filter((p) => na.get(p) === 2).length / px.length, ">=", 0.95),
      check("ll: pixels passed once without it (the old line)", px.filter((p) => nb.get(p) === 1).length / px.length, ">=", 0.5));
    // b: a ring and a stem on its left
    const bm = map(w, h, [ring(60, 55, 18), [[42, 10], [42, 55]]]), nbm = passes(UNB.buildWalk(bm, w, h, { ...opt, doubleOpen: true }), w, bm);
    let stem2 = 0, stemN = 0, ring1 = 0, ringN = 0;
    for (let p = 0; p < bm.length; p++) {
      if (!bm[p]) continue;
      const x = p % w, y = (p / w) | 0;
      if (x <= 43 && y < 40) { stemN++; if (nbm.get(p) === 2) stem2++; }
      else if (x > 50) { ringN++; if (nbm.get(p) === 1) ring1++; }
    }
    checks.push(check("b: stem passed twice", stem2 / stemN, ">=", 0.95), check("b: ring passed once", ring1 / ringN, ">=", 0.95));
    // θ: a ring with a bar across (three loop edges at each end of the bar)
    const tm = map(w, h, [ring(60, 45, 25), [[35, 45], [85, 45]]]), tw = UNB.buildWalk(tm, w, h, { ...opt, doubleOpen: true }), nt = passes(tw, w, tm);
    const tpx = [...tm.keys()].filter((p) => tm[p]), last = tw.px.length - 1;
    checks.push(check("θ: line pixels never passed", tpx.filter((p) => !nt.get(p)).length, "==", 0),
      check("θ: pixels passed more than twice", tpx.filter((p) => nt.get(p) > 2).length, "==", 0),
      check("θ: the walk closes", Math.hypot(tw.px[last] - tw.px[0], tw.py[last] - tw.py[0]), "<=", 1.5));
    return { checks };
  },
};
