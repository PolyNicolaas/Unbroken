const { UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js"), { vaseScene } = require("../lib/photos.js");
module.exports = {
  id: "E38", title: "Cut out the object: a box round it, and keep / remove strokes, give its mask",
  guards: "the floor an object stands on kept with it, the wall behind it kept, part of the object lost, a Remove stroke that doesn't remove, a Keep stroke that doesn't keep, and a box round the whole picture keeping everything",
  why: "Removing a plain background by colour can't tell the floor under an object from the object (v114). UNB.cutout takes a box drawn round the object: colour models of what's inside and outside it, then the cheapest cut between them along the picture's edges (GrabCut), so the floor at the box's sides teaches it what the floor under the object looks like. Keep and Remove strokes fix what it gets wrong.",
  how: "Draws a 480 × 360 photo of a teal vase standing on striped wooden floorboards in front of a wall, its shadow on the floor; cuts it out with a box round the vase (some wall and floor in it); again with a Remove stroke across the shadow; with a Keep stroke on the vase's neck where the box is cut too tight; and with a box round the whole picture. Compares each mask with the vase as drawn (the share of the two that overlaps, intersection over union).",
  pass: "The box alone: overlap ≥ 0.9, and no more than 3% of the floor kept; with the Remove stroke ≥ 0.95, and the stroke's pixels removed; a box cutting through the neck with a Keep stroke there keeps the stroke's pixels; a box round the whole picture still ≥ 0.7; each under 4 s.",
  async run() {
    const checks = [], V = vaseScene();
    const score = (r) => { let tp = 0, fp = 0, fn = 0, floor = 0, floorKept = 0; for (let y = 0; y < r.mh; y++) for (let x = 0; x < r.mw; x++) { const X = (x + 0.5) / r.k, Y = (y + 0.5) / r.k, v = V.inVase(X, Y), m = r.mask[y * r.mw + x]; if (v && m) tp++; else if (m) fp++; else if (v) fn++; if (!v && Y > V.h * 0.6) { floor++; floorKept += m; } } return { iou: tp / Math.max(1, tp + fp + fn), floor: floorKept / Math.max(1, floor) }; };
    const at = (r, x, y) => r.mask[Math.min(r.mh - 1, Math.floor(y * r.k)) * r.mw + Math.min(r.mw - 1, Math.floor(x * r.k))];
    const time = (f) => { const t = Date.now(), r = f(); return [r, Date.now() - t]; };
    const [a, ta] = time(() => UNB.cutout(V.rgba, V.w, V.h, { box: V.box })), sa = score(a);
    checks.push(check("box: overlap with the vase", sa.iou, ">=", 0.9), check("… floor kept (share)", sa.floor, "<=", 0.03));
    const drop = [290, 297, 380, 297];
    const [b, tb] = time(() => UNB.cutout(V.rgba, V.w, V.h, { box: V.box, drop: [drop], brush: 14 })), sb = score(b);
    checks.push(check("box + Remove across the shadow: overlap", sb.iou, ">=", 0.95), check("… the stroke's pixels removed", at(b, 330, 297) + at(b, 375, 297), "==", 0));
    // a box cut too tight at the top (through the neck), a Keep stroke up the neck
    const tight = [V.box[0], V.h * 0.3, V.box[2], V.box[3]];
    const [c, tc] = time(() => UNB.cutout(V.rgba, V.w, V.h, { box: tight, keep: [[240, 82, 240, 120]], brush: 8 }));
    checks.push(check("tight box + Keep up the neck: the stroke's pixels kept (of 2)", at(c, 240, 90) + at(c, 240, 115), "==", 2));
    const [d, td] = time(() => UNB.cutout(V.rgba, V.w, V.h, { box: [0, 0, V.w, V.h] })), sd = score(d);
    checks.push(check("a box round the whole picture: overlap", sd.iou, ">=", 0.7));
    checks.push(check("slowest (s)", Math.max(ta, tb, tc, td) / 1000, "<", 4));
    return { checks, notes: `overlap ${sa.iou.toFixed(3)} (box), ${sb.iou.toFixed(3)} (+ Remove), ${sd.iou.toFixed(3)} (whole picture); ${ta}, ${tb}, ${tc}, ${td} ms; mask ${a.mw} × ${a.mh}` };
  },
};
