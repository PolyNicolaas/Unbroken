const S = require("../lib/scenes.js"), { trace, UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
// the leaf's walk at the app's defaults (a closed walk: every vein is a stroke out and back, with junctions and tips)
const leafWalk = () => trace(S.sample("leaf"), {});
const moved = (a, b, i) => Math.hypot(a.px[i] - b.px[i], a.py[i] - b.py[i]);
// mean bend (second difference) of the points in idx: how jagged that stretch is
const bend = (w, idx) => idx.reduce((s, i) => s + Math.hypot(w.px[i - 1] + w.px[i + 1] - 2 * w.px[i], w.py[i - 1] + w.py[i + 1] - 2 * w.py[i]), 0) / Math.max(1, idx.length);
// the two passes of an out-and-back stroke share their points: the most any shared pair ends up apart
function split(before, after) {
  const seen = new Map(); let worst = 0;
  for (let i = 0; i < before.px.length; i++) {
    const k = before.px[i].toFixed(4) + "," + before.py[i].toFixed(4);
    if (seen.has(k)) worst = Math.max(worst, Math.hypot(after.px[i] - after.px[seen.get(k)], after.py[i] - after.py[seen.get(k)])); else seen.set(k, i);
  }
  return worst;
}
// distance from a point to a brush's path (a polyline)
const toPath = (x, y, P) => P.slice(1).reduce((m, [bx, by], k) => { const [ax, ay] = P[k], dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)) : 0; return Math.min(m, Math.hypot(x - ax - t * dx, y - ay - t * dy)); }, Math.hypot(x - P[0][0], y - P[0][1]));
const fixedMoved = (a, b) => { let m = 0; for (let i = 0; i < a.px.length; i++) if (a.tip[i] || a.jd[i] === 0) m = Math.max(m, moved(a, b, i)); return m; };
module.exports = {
  id: "E32", title: "Edit line: push, smooth and straighten move the traced line where asked, and keep it one line",
  guards: "a hand edit that moves the wrong part of the line, tears an out-and-back stroke's two passes apart, moves stroke ends or junctions it should leave alone, or leaves crossings in the printed line",
  why: "The Edit line tool lets you fix a stretch of the traced line by hand (an ugly connector, a wobble, a bend that should be straight). The edits are applied to the walk right after it is traced (UNB.editWalk in stageTrace), so the preview, the 2D pen line, the layers and the G-code all follow them. They must only touch what the brush covers, keep every point's tags (so the strands, loops and junction spacing still work), and leave a line the rest of the pipeline can print.",
  how: "Traces the leaf sample, then: pushes a point on a vein 25 px; smooths the leaf's outline after adding a jagged wobble to it; straightens a stretch of the midrib; and runs a push through stageTrace (edits given with the line map) and the full fit with spacing.",
  pass: "Every edit keeps the point count and tags; push moves the grabbed point by the drag (within 10%) and nothing farther than the brush; the passes of out-and-back strokes stay together (under 0.5 px apart); smoothing halves the wobble's bend and leaves points outside the brush, stroke ends and junctions where they were; straightened points lie within 0.5 px of one straight line; stageTrace gives the same walk as editing after it; the fitted, spaced line has no crossings.",
  async run() {
    const T = leafWalk(), w = T.walk, n = w.px.length, checks = [];
    // push: grab a point on a vein, away from junctions and tips
    let g = -1; for (let i = 0; i < n; i++) if (!w.dbl[i] || w.jd[i] < 12 || w.tip[i]) continue; else { g = i; break; }
    const from = [w.px[g], w.py[g]], to = [from[0] + 20, from[1] + 15], R = 18;
    const P = UNB.editWalk(w, [{ type: "push", r: R, pts: [from], to }]);
    let far = 0; for (let i = 0; i < n; i++) if (Math.hypot(w.px[i] - from[0], w.py[i] - from[1]) >= R) far = Math.max(far, moved(w, P, i));
    checks.push(check("push: points and tags kept", +(P.px.length === n && P.tip === w.tip && P.jd === w.jd && P.dbl === w.dbl), "==", 1));
    checks.push(check("push: the grabbed point moves by the drag (share)", moved(w, P, g) / 25, ">=", 0.9));
    checks.push(check("push: farthest move beyond the brush (px)", far, "<=", 1e-9));
    checks.push(check("push: an out-and-back stroke's passes apart (px)", split(w, P), "<", 0.5));
    // smooth: the outline with a jagged wobble added (every other point out 1.5 px), brushed over
    const wob = Object.assign({}, w, { px: Float64Array.from(w.px), py: Float64Array.from(w.py) }), idx = [];
    const cx = 330, cy = 235;   // the leaf's outer outline, upper side: single (not doubled) points far from junctions
    for (let i = 1; i < n - 1; i++) if (!w.dbl[i] && !w.dbl[i - 1] && w.jd[i] > 40 && !w.tip[i] && w.py[i] < 150 && w.px[i] > 250 && w.px[i] < 420) idx.push(i);
    idx.forEach((i, k) => { if (k % 2) { wob.px[i] += 1.5 * (w.px[i] - cx) / Math.hypot(w.px[i] - cx, w.py[i] - cy); wob.py[i] += 1.5 * (w.py[i] - cy) / Math.hypot(w.px[i] - cx, w.py[i] - cy); } });
    const brush = idx.filter((_, k) => k % 10 === 0).map((i) => [w.px[i], w.py[i]]);
    const Sm = UNB.editWalk(wob, [{ type: "smooth", r: 14, pts: brush }]);
    const inner = idx.filter((i) => toPath(wob.px[i], wob.py[i], brush) < 6);
    let out = 0; for (let i = 0; i < n; i++) if (toPath(wob.px[i], wob.py[i], brush) >= 14) out = Math.max(out, moved(wob, Sm, i));
    checks.push(check("smooth: wobble's bend after ÷ before", bend(Sm, inner) / bend(wob, inner), "<=", 0.5));
    checks.push(check("smooth: farthest move outside the brush (px)", out, "<=", 1e-9));
    const brushMid = [w.px[idx[idx.length >> 1]], w.py[idx[idx.length >> 1]]];
    const Sw = UNB.editWalk(w, [{ type: "smooth", r: 60, pts: [[330, 250], brushMid] }]);
    checks.push(check("smooth: stroke ends and junctions moved (px)", fixedMoved(w, Sw), "<=", 1e-9));
    checks.push(check("smooth: an out-and-back stroke's passes apart (px)", split(w, Sw), "<", 0.5));
    // straighten: brush along the midrib's middle (doubled points, between junctions)
    const mid = []; for (let i = 0; i < n; i++) if (w.dbl[i] && Math.abs((w.py[i] - 0.5 * (240 + 0.75 * w.px[i]))) < 30 && w.px[i] > 240 && w.px[i] < 300) mid.push(i);
    const a = [w.px[mid[0]], w.py[mid[0]]], b = [w.px[mid[mid.length - 1]], w.py[mid[mid.length - 1]]];
    const St = UNB.editWalk(w, [{ type: "straighten", r: 8, pts: [a, b] }]);
    // each run of changed points lies on the straight line through the points either side of it
    let dev = 0, runs = 0;
    for (let i = 1; i < n - 1; i++) {
      if (!(moved(w, St, i) > 1e-9) || moved(w, St, i - 1) > 1e-9) continue;
      let j = i; while (j < n - 1 && moved(w, St, j) > 1e-9) j++;
      const A = [St.px[i - 1], St.py[i - 1]], B = [St.px[j], St.py[j]], L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1; runs++;
      for (let k = i; k < j; k++) dev = Math.max(dev, Math.abs((B[0] - A[0]) * (A[1] - St.py[k]) - (A[0] - St.px[k]) * (B[1] - A[1])) / L);
    }
    checks.push(check("straighten: stretches made straight", runs, ">", 0));
    checks.push(check("straighten: farthest from its straight line (px)", dev, "<=", 0.5));
    checks.push(check("straighten: stroke ends and junctions moved (px)", fixedMoved(w, St), "<=", 1e-9));
    // through the pipeline: the edits arrive with the line map, and the line still prints
    const big = [{ type: "push", r: 30, pts: [from], to: [from[0] + 30, from[1] - 25] }];
    const viaStage = UNB.stageTrace({ lines: T.lines, edits: big }, T.w, T.h, { minPix: 15, maxJump: 0.12 * Math.hypot(T.w, T.h), open: false, jumpCost: 2 }, null);
    const plain = UNB.stageTrace({ lines: T.lines }, T.w, T.h, { minPix: 15, maxJump: 0.12 * Math.hypot(T.w, T.h), open: false, jumpCost: 2 }, null);
    const after = UNB.editWalk(plain, big);
    let same = 0; for (let i = 0; i < after.px.length; i++) same = Math.max(same, moved(viaStage, after, i));
    checks.push(check("stageTrace with edits = editing after it (px)", same, "<=", 1e-9));
    const d = 6, pr = UNB.stagePrint(viaStage, d, T.w, T.h, { w: 0.6 * d, unx: 90, minGap: 0.75 });
    checks.push(check("pushed leaf, fitted with spacing: crossings left", pr.after, "==", 0));
    return { checks, notes: `${n} walk points; push grabbed point ${g}; ${inner.length} wobbly points smoothed; ${runs} straightened stretch${runs === 1 ? "" : "es"}` };
  },
};
