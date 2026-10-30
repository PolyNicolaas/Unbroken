const S = require("../lib/scenes.js"), { trace, UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
const FONTS = require("../../engine/fonts.js");
const W = 0.84, D = 1.34;                                   // 18G needle and 0.5 mm gap: line width and centre-to-centre spacing (mm)

// "Happy" in the sans font, laid out and traced the way the app does it
function textTrace() {
  const cap = 20, lay = UNB.textLayout("Happy", FONTS.sans, { cap, spacing: "even", gap: 0.15 * cap, word: cap / 2, lineGap: 1.7, align: "center" });
  const ppm = Math.min(Math.max(4, 60 / cap), 1600 / Math.max(lay.width, lay.height, 1)), R = UNB.rasterText(lay, ppm, 3);
  const c = S.createCanvas(R.w, R.h), g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, R.w, R.h);
  return trace(c, { lines: R.mask, res: Math.max(R.w, R.h), outW: R.w / ppm, spacingMM: D, lineMM: W, snap: false, loop: 0.5 });
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
  id: "E48", title: "Stroke ends as a smooth turn: as wide as the strands beside it, no bulb, the spacing kept",
  guards: "a bulb (a loop wider than the stroke) at every tip when Stroke ends is Smooth turn, and a smooth turn that brings the strands closer than the spacing or crosses the line",
  why: "Nicolaas (30 October 2026): the tips of letters like H had small nubs instead of a smooth turn. They were the stroke-end loops, a circle twice the spacing wide (E16). v125's Line card has Stroke ends; Smooth turn (0.5 × the spacing, the start) turns round in a plain U-turn.",
  how: "Traces the leaf, the shapes sample and \"Happy\" (as E16) with the stroke-end radius at 0.5 × the spacing, and measures every stroke end as E16 does.",
  pass: "The typical turn at most 1.15 spacings wide (a round loop is about 1.8) and at least 80% of tips under 1.3 (a tip with another strand close by reads wider), and the chocolate edge within half a spacing of the drawn end; closest gap ≥ 90% of the spacing; no crossings.",
  async run() {
    const checks = [];
    const runs = [["leaf", trace(S.sample("leaf"), { spacingMM: D, lineMM: W, loop: 0.5 })], ["shapes", trace(S.sample("shapes"), { spacingMM: D, lineMM: W, loop: 0.5 })], ["text", textTrace()]];
    for (const [name, r] of runs) {
      const e = ends(r);
      checks.push(check(`${name}: stroke ends measured`, e.length, ">=", { leaf: 4, shapes: 1, text: 6 }[name]));
      // (a tip with another strand inside the measuring circle reads wide whatever the turn: the typical tip, and nearly every tip)
      const ws = e.map((x) => x.width).sort((a, b) => a - b);
      checks.push(check(`${name}: typical turn (median, spacings wide)`, ws.length ? ws[Math.floor(ws.length / 2)] : 99, "<=", 1.15), check(`${name}: tips at most 1.3 spacings wide (share)`, ws.length ? ws.filter((w) => w <= 1.3).length / ws.length : 0, ">=", 0.8));
      checks.push(check(`${name}: furthest tip from the drawn end (spacings)`, e.length ? Math.max(...e.map((x) => Math.abs(x.reach))) : 99, "<=", 0.5));
      checks.push(check(`${name}: closest gap (spacings)`, Number.isFinite(r.fin.gap) ? r.fin.gap / r.dpx : 99, ">=", 0.9));
      checks.push(check(`${name}: crossings`, r.fin.after, "==", 0));
    }
    return { checks };
  },
};
