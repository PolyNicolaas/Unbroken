const S = require("../lib/scenes.js"), { trace, UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
const FONTS = require("../../engine/fonts.js");
const W = 0.84, D = 1.34;                                   // 18G needle and 0.5 mm gap: line width and centre-to-centre spacing (mm)

// "Happy" in the sans font, laid out and traced the way the app does it
function textTrace() {
  const cap = 20, lay = UNB.textLayout("Happy", FONTS.sans, { cap, spacing: "even", gap: 0.15 * cap, word: cap / 2, lineGap: 1.7, align: "center" });
  const ppm = Math.min(Math.max(4, 60 / cap), 1600 / Math.max(lay.width, lay.height, 1)), R = UNB.rasterText(lay, ppm, 3);
  const c = S.createCanvas(R.w, R.h), g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, R.w, R.h);
  return trace(c, { lines: R.mask, res: Math.max(R.w, R.h), outW: R.w / ppm, spacingMM: D, lineMM: W, snap: false });
}

// Every turn-back in the walk is a stroke end E. Look at the printed line around it: how far its centreline reaches past E
// (the chocolate edge sits w/2 further), and how wide it is across the stroke near the end (the loop).
function ends(r) {
  const w = r.walk, re = r.fin.final.re, im = r.fin.final.im, d = r.dpx, lw = W / r.scale, out = [];
  for (let i = 0; i < w.px.length; i++) {
    if (!w.tip[i] || w.jd[i] === 0) continue;               // a real stroke end (a turn-back at a junction is not one)
    let k = i, s = 0;                                       // a point about 3 spacings back along the stroke, for its direction
    while (k > 0 && s < 3 * d && w.dbl[k - 1] && w.jd[k - 1] !== 0) { s += Math.hypot(w.px[k] - w.px[k - 1], w.py[k] - w.py[k - 1]); k--; }   // up to the nearest junction
    if (s < 2.5 * d) continue;                              // stubs too short for a full loop (before a junction) are left out
    let tx = w.px[i] - w.px[k], ty = w.py[i] - w.py[k]; const tl = Math.hypot(tx, ty); tx /= tl; ty /= tl;
    const ex = w.px[i], ey = w.py[i], cx = ex - (d + lw / 2) * tx, cy = ey - (d + lw / 2) * ty;
    let reach = -Infinity, lo = Infinity, hi = -Infinity;
    for (let q = 0; q < re.length; q++) {
      const ax = re[q] - cx, ay = im[q] - cy, along = ax * tx + ay * ty, across = -ax * ty + ay * tx;
      if (Math.hypot(ax, ay) > 2.2 * d) continue;           // only the line round this end
      reach = Math.max(reach, (re[q] - ex) * tx + (im[q] - ey) * ty);
      if (along > -0.3 * d) { lo = Math.min(lo, across); hi = Math.max(hi, across); }
    }
    out.push({ reach: (reach + lw / 2) / d, width: (hi - lo) / d });   // reach of the chocolate edge past E, and loop width, in spacings
  }
  return out;
}

module.exports = {
  id: "E16", title: "Stroke ends turn in a round loop, never back over the line",
  guards: "the needle retracing its own line at the end of a stroke, or a stroke end printing past where it was drawn",
  why: "The needle can't go back over a line it has just laid. Any stroke the line has to travel out and back along is printed as two strands one spacing apart, and at the stroke's end the line turns round in a keyhole loop: a circle of radius r = d (the spacing) whose centre sits r + w/2 back from the end, so the chocolate's outer edge lands where the stroke ends. The loop is 2r + w across; the strands meet it where r·sin α = d/2 and the line runs 360° − 2α round it.",
  how: "Traces the leaf and the shapes sample at 100 mm wide, and \"Happy\" in the sans font at 20 mm, all with an 18G needle (0.84 mm) and a 0.5 mm gap (spacing 1.34 mm). At every stroke end long enough for a full loop it measures the printed line within 2.2 spacings of the loop's centre: how wide it is across the stroke near the end, and how far its chocolate edge reaches past the drawn end. Also reads the closest gap anywhere and the crossings.",
  pass: "At every stroke end the loop is at least 1.6 spacings wide (2 for a full circle; a plain turn-back would be 1), and the chocolate edge lands within half a spacing of the drawn end; closest gap ≥ 90% of the spacing; no crossings.",
  async run() {
    const checks = [];
    const runs = [["leaf", trace(S.sample("leaf"), { spacingMM: D, lineMM: W })], ["shapes", trace(S.sample("shapes"), { spacingMM: D, lineMM: W })], ["text", textTrace()]];
    for (const [name, r] of runs) {
      const e = ends(r);
      checks.push(check(`${name}: stroke ends measured`, e.length, ">=", { leaf: 4, shapes: 1, text: 6 }[name]));
      checks.push(check(`${name}: narrowest loop (spacings wide)`, e.length ? Math.min(...e.map((x) => x.width)) : 0, ">=", 1.6));
      checks.push(check(`${name}: furthest tip from the drawn end (spacings)`, e.length ? Math.max(...e.map((x) => Math.abs(x.reach))) : 99, "<=", 0.5));
      checks.push(check(`${name}: closest gap (spacings)`, Number.isFinite(r.fin.gap) ? r.fin.gap / r.dpx : 99, ">=", 0.9));
      checks.push(check(`${name}: crossings`, r.fin.after, "==", 0));
    }
    return { checks };
  },
};
