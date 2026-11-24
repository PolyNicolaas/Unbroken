// Unbroken · web app · parts.js
// The parts of a picture, the way a logo is laid out: its ink's separate shapes, grouped into bands one above the other,
// then into groups side by side within each band. unbroken.parts() (agent.js) reports them; a picture printed in
// pieces (pieces.js) traces each group as its own piece.
// Plain script (not a module) so the app also works opened straight from disk.
"use strict";

// ink: Uint8Array (1 = ink), w × h. o: mmPerPx (or widthMM: the whole ink's width in mm), bandGapMM (default 1),
// sideGapMM (default: a fifth of each band's height, at least 4 mm), minArea (px, default 4: specks out).
// Returns null without ink, else { all (the ink's box), groups: [{ x0, y0, x1, y1, area, edge, shapes, ids }], lab
// (each pixel's shape, −1 off the ink), comps (the shapes), mmPerPx, inkArea }; groups sorted top to bottom, then left
// to right. Without a size, the gaps are shares of the ink's box (1% down, 4% across).
function inkParts(ink, w, h, o = {}) {
  // components
  const lab = new Int32Array(w * h).fill(-1),
    comps = [],
    stack = [];
  for (let s = 0; s < w * h; s++) {
    if (!ink[s] || lab[s] >= 0) continue;
    const C = { id: comps.length, x0: w, y0: h, x1: -1, y1: -1, area: 0, edge: 0 };
    lab[s] = comps.length;
    stack.push(s);
    while (stack.length) {
      const p = stack.pop(),
        x = p % w,
        y = (p / w) | 0;
      C.area++;
      if (x < C.x0) C.x0 = x;
      if (x > C.x1) C.x1 = x;
      if (y < C.y0) C.y0 = y;
      if (y > C.y1) C.y1 = y;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const X = x + dx,
            Y = y + dy;
          if (X < 0 || Y < 0 || X >= w || Y >= h || !ink[Y * w + X]) {
            if (!dx || !dy) C.edge++; // an outline step (4-neighbours only)
            continue;
          }
          const q = Y * w + X;
          if (lab[q] < 0) {
            lab[q] = comps.length;
            stack.push(q);
          }
        }
    }
    comps.push(C);
  }
  let all = { x0: w, y0: h, x1: -1, y1: -1 };
  const big = comps.filter((C) => C.area >= (o.minArea || 4)); // specks out
  for (const C of big)
    all = {
      x0: Math.min(all.x0, C.x0),
      y0: Math.min(all.y0, C.y0),
      x1: Math.max(all.x1, C.x1),
      y1: Math.max(all.y1, C.y1),
    };
  if (!big.length) return null;
  const mmPerPx = o.mmPerPx || (o.widthMM ? o.widthMM / (all.x1 - all.x0 + 1) : null);
  // Parts in two steps, the way a logo is laid out: bands one above the other (rows of ink with more than bandGapMM of
  // empty rows between them), then within a band, groups side by side with more than sideGapMM of empty columns
  // between them (letters of a word stay together; a mark beside a word doesn't). A band much narrower and shorter
  // than its nearest neighbour (a dot over an i between the lines) joins it.
  const gapPx = mmPerPx ? (+o.bandGapMM || 1) / mmPerPx : 0.01 * (all.y1 - all.y0 + 1),
    sidePx = mmPerPx ? (+o.sideGapMM || 4) / mmPerPx : 0.04 * (all.x1 - all.x0 + 1);
  const box = (L) =>
    L.reduce(
      (G, C) => ({
        x0: Math.min(G.x0, C.x0),
        y0: Math.min(G.y0, C.y0),
        x1: Math.max(G.x1, C.x1),
        y1: Math.max(G.y1, C.y1),
      }),
      { x0: w, y0: h, x1: -1, y1: -1 }
    );
  const runs = (L, a, b, gap) => {
    // members grouped where their [a, b] spans come within gap of each other
    const S = [...L].sort((p, q) => p[a] - q[a]),
      out = [];
    for (const C of S) {
      const R = out[out.length - 1];
      if (R && C[a] - R.end <= gap) {
        R.list.push(C);
        R.end = Math.max(R.end, C[b]);
      } else out.push({ list: [C], end: C[b] });
    }
    return out.map((R) => R.list);
  };
  let bands = runs(big, "y0", "y1", gapPx);
  for (let moved = true; moved && bands.length > 1;) {
    moved = false;
    const B = bands.map(box);
    for (let i = 0; i < bands.length; i++) {
      const near = [i - 1, i + 1]
          .filter((j) => j >= 0 && j < bands.length)
          .sort(
            (p, q) =>
              Math.min(Math.abs(B[p].y0 - B[i].y1), Math.abs(B[i].y0 - B[p].y1)) -
              Math.min(Math.abs(B[q].y0 - B[i].y1), Math.abs(B[i].y0 - B[q].y1))
          )[0],
        wi = B[i].x1 - B[i].x0,
        hi = B[i].y1 - B[i].y0;
      if (near != null && wi < 0.1 * (B[near].x1 - B[near].x0) && hi < 0.35 * (B[near].y1 - B[near].y0)) {
        bands[near] = bands[near].concat(bands[i]);
        bands.splice(i, 1);
        moved = true;
        break;
      }
    }
  }
  // side by side: sideGapMM when given, else a gap wider than about a fifth of the band's height (the space between two
  // words or a mark and a word, not between letters), at least 4 mm
  const groupsL = bands.flatMap((L) => {
    const B = box(L);
    return runs(L, "x0", "x1", o.sideGapMM || !mmPerPx ? sidePx : Math.max(sidePx, 0.2 * (B.y1 - B.y0 + 1)));
  });
  const groups = groupsL
    .map((L) => ({
      ...box(L),
      area: L.reduce((s, C) => s + C.area, 0),
      edge: L.reduce((s, C) => s + C.edge, 0),
      shapes: L.length,
      ids: L.map((C) => C.id),
    }))
    .sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  return { all, big, groups, lab, comps, mmPerPx, inkArea: big.reduce((s, C) => s + C.area, 0) };
}
