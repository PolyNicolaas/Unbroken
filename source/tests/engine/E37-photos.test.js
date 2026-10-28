const { UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js"), { pagePhoto, inkAt } = require("../lib/photos.js");
// a dim, blue-tinted photo of a grey object on a lighter wall (no page): an object to balance
function objectPhoto() {
  const w = 320, h = 240, a = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = 4 * (y * w + x), inObj = Math.hypot(x - 160, y - 130) < 70, v = inObj ? 60 + 0.2 * y : 150;
    a[i] = v * 0.7; a[i + 1] = v * 0.8; a[i + 2] = v * 1.05; a[i + 3] = 255;
  }
  return { rgba: a, w, h };
}
module.exports = {
  id: "E37", title: "Photos: the page found in a photo, straightened, and cleaned for the line",
  guards: "a page in a photo not found or its corners off, the perspective not undone, a shadow left on the paper, ink lost or table left along the edges, a faint line not darkened, a page claimed in a photo with none, and an object's colour cast kept",
  why: "Take a picture (v110) photographs a drawing, a print or an object, often at an angle and in uneven light. UNB.findPage finds the page (the largest light, plain area: its four corners, made exact along each side's edge), UNB.photoPicture flattens it to a rectangle (UNB.warpQuad) and UNB.photoClean evens out the paper's light, makes the paper white and the ink black, darkens faint lines and removes specks; an object's colours are stretched and balanced instead.",
  how: "Makes a 640 × 480 photo of a page seen in perspective on a dark table, with light falling off by 45% across it and camera grain; the page has a circle, a line and a faint pencil stroke. Finds the page, makes the picture as a drawing and compares it pixel by pixel with the drawing as drawn. Then three in harder light (a grey table and 45% falloff, a darker table and 70%, a light grey table), a photo where the paper fills the frame, one of only the table, and a dim, blue-tinted photo of an object.",
  pass: "The page is found, each corner within 3 px; the picture is the page's shape (width ÷ height within 5% of the page's); at least 95% of the ink is dark (below mid grey) and under 1% of the paper is; the paper's 5th percentile is white (≥ 235) though the photo's paper is down to ~130 in the shadow; the faint stroke comes out darker than it was on the photo; the three in harder light are found, corners within 3 px; the photo filled by paper and the photo of only table are not taken for a page; the object's picture spans black to white with its wall's colour balanced (channels within 12 of each other).",
  async run() {
    const checks = [], P = pagePhoto();
    let t = Date.now();
    const f = UNB.findPage(P.rgba, P.w, P.h), tf = Date.now() - t;
    const err = f ? Math.max(...f.corners.map((c, i) => Math.hypot(c[0] - P.corners[i][0], c[1] - P.corners[i][1]))) : Infinity;
    checks.push(check("page found", +!!(f && f.found), "==", 1), check("… its corners off by (px, worst)", err, "<=", 3));
    t = Date.now();
    const r = UNB.photoPicture(P.rgba, P.w, P.h, { corners: f.corners, kind: "drawing" }), tp = Date.now() - t;
    // the page's true shape: the width and height of the page drawn (its sides' lengths are close to these)
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]), [a, b, c, e] = P.corners, aspect = (d(a, b) + d(e, c)) / (d(a, e) + d(b, c));
    checks.push(check("picture's shape: width ÷ height against the page's, off by", Math.abs(r.w / r.h / aspect - 1), "<=", 0.05));
    let ink = 0, inkDark = 0, paper = 0, paperDark = 0, faint = 0, faintN = 0;
    const paperV = [];
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      const u = (x + 0.5) / r.w, v = (y + 0.5) / r.h, k = inkAt(u, v), g = r.rgba[4 * (y * r.w + x)];
      // (a pixel's width from a line's edge either way is left out: the warp blends there)
      const near = [[-1.5, 0], [1.5, 0], [0, -1.5], [0, 1.5]].some(([dx, dy]) => inkAt(u + dx / r.w, v + dy / r.h) !== k);
      if (near) continue;
      if (k === 1) { ink++; if (g < 128) inkDark++; }
      else if (k > 0) { faint += g; faintN++; }
      else { paper++; if (g < 128) paperDark++; if ((x * 7 + y * 3) % 5 === 0) paperV.push(g); }
    }
    paperV.sort((p, q) => p - q);
    // the faint stroke on the photo (its grey there, before cleaning), in the lit part
    const faintPhoto = 236 * (1 - 0.55 * 0.85);
    checks.push(
      check("ink dark (share)", inkDark / ink, ">=", 0.95),
      check("paper dark (share)", paperDark / paper, "<", 0.01),
      check("paper's 5th percentile (0–255)", paperV[(paperV.length * 0.05) | 0], ">=", 235),
      check("faint stroke: its grey ÷ on the photo", faint / faintN / faintPhoto, "<", 1)
    );
    // harder light: a grey table in strong shadow (the page's shaded end darker than the lit table), a light table
    let worst = 0, missed = 0;
    for (const [shadow, t] of [[0.45, 150], [0.7, 120], [0.45, 190]]) {
      const Q = pagePhoto({ shadow, table: [t, t - 5, t - 10] }), q = UNB.findPage(Q.rgba, Q.w, Q.h);
      if (!q || !q.found) { missed++; continue; }
      worst = Math.max(worst, ...q.corners.map((c, i) => Math.hypot(c[0] - Q.corners[i][0], c[1] - Q.corners[i][1])));
    }
    checks.push(check("harder light (3 photos): pages missed", missed, "==", 0), check("… their corners off by (px, worst)", worst, "<=", 3));
    // no page: the paper fills the frame; only the table
    const full = pagePhoto({ corners: [[-20, -20], [660, -20], [660, 500], [-20, 500]] }), table = pagePhoto({ corners: [[-50, -50], [-40, -50], [-40, -40], [-50, -40]] });
    const fFull = UNB.findPage(full.rgba, full.w, full.h), fTable = UNB.findPage(table.rgba, table.w, table.h);
    checks.push(check("paper filling the frame: not taken for a page", +!!(fFull && fFull.found), "==", 0), check("only the table: no page", +!!(fTable && fTable.found), "==", 0));
    // an object: stretched and balanced
    const O = objectPhoto(), o = UNB.photoPicture(O.rgba, O.w, O.h, { kind: "object" });
    let lo = 255, hi = 0;
    for (let i = 0; i < O.w * O.h; i++) { const g = o.rgba[4 * i + 1]; lo = Math.min(lo, g); hi = Math.max(hi, g); }
    const wall = [0, 1, 2].map((ch) => o.rgba[4 * (10 * O.w + 10) + ch]);
    checks.push(check("object: from black (darkest, 0–255)", lo, "<=", 5), check("… to white (lightest)", hi, ">=", 250), check("… its wall's colour cast (channel spread)", Math.max(...wall) - Math.min(...wall), "<=", 12));
    return { checks, notes: `page found in ${tf} ms (fill ${f.fill.toFixed(2)}, share ${f.share.toFixed(2)}); picture ${r.w} × ${r.h} in ${tp} ms; paper share/fill of the full-frame photo ${fFull ? fFull.share.toFixed(2) : "–"}` };
  },
};
