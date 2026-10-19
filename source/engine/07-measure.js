/* Unbroken · engine · 07-measure.js
   6. Measuring — how far a curve is from the traced line (error, stray, missing).
   One part of the engine (no DOM), loaded after 06-fourier.js; core.js lists every part and what's in it. */
(function (root) {
  "use strict";
  const UNB = root.UNB;

  // A curve (closed unless closed === false) drawn into a w × h pixel grid, 1 where it passes
  function rasterize(re, im, w, h, closed) {
    const grid = new Uint8Array(w * h),
      S = re.length,
      last = closed === false ? S - 1 : S;
    const dot = (X, Y) => {
      const x = Math.round(X),
        y = Math.round(Y);
      if (x >= 0 && y >= 0 && x < w && y < h) grid[y * w + x] = 1;
    };
    // an open curve's last point (the segments below stop short of their ends)
    if (S && last < S) dot(re[S - 1], im[S - 1]);
    for (let s = 0; s < last; s++) {
      const t = (s + 1) % S;
      const x0 = re[s],
        y0 = im[s];
      const dx = re[t] - x0,
        dy = im[t] - y0,
        steps = Math.max(1, Math.ceil(Math.hypot(dx, dy)));
      for (let k = 0; k < steps; k++) dot(x0 + (dx * k) / steps, y0 + (dy * k) / steps);
    }
    return grid;
  }

  // Error on the pixel grid (symmetric chamfer distance), used to pick terms. stray: mean distance from the curve's
  // points to the traced line (walk.edt); missing: mean distance from the traced line's pixels (walk.mask) to the
  // curve. score = their mean, in px.

  UNB.chamfer = function (re, im, walk, w, h, closed) {
    const S = re.length,
      ld = walk.edt.dist;
    let stray = 0;
    for (let s = 0; s < S; s++) {
      const cx = Math.min(w - 1, Math.max(0, re[s])),
        cy = Math.min(h - 1, Math.max(0, im[s]));
      const outside = Math.hypot(re[s] - cx, im[s] - cy); // how far off the grid the point is (0 on it)
      const x = Math.round(cx),
        y = Math.round(cy);
      stray += ld[y * w + x] + outside;
    }
    stray /= S;
    const cd = UNB.edt(rasterize(re, im, w, h, closed), w, h).dist;
    let miss = 0,
      n = 0;
    for (let i = 0; i < w * h; i++)
      if (walk.mask[i]) {
        miss += cd[i];
        n++;
      }
    miss /= Math.max(1, n);
    return { score: 0.5 * (stray + miss), stray, missing: miss };
  };

  // Error measured against the traced line itself (subpixel), not against whole pixels
  // stray: average distance from the drawn line to the traced line; missing: the other way round. Capped at `cap` px.
  // segGrid: the polyline's segments bucketed in cells of `cell` px; distTo: distance from a point to the nearest
  // segment, searching outward ring by ring, at most `cap`.
  function segGrid(x, y, closed, cell) {
    const n = x.length,
      last = closed ? n : n - 1,
      G = new Map(),
      key = (i, j) => (i * 73856093) ^ (j * 19349663);
    for (let s = 0; s < last; s++) {
      const t = (s + 1) % n,
        i0 = Math.floor(Math.min(x[s], x[t]) / cell),
        i1 = Math.floor(Math.max(x[s], x[t]) / cell),
        j0 = Math.floor(Math.min(y[s], y[t]) / cell),
        j1 = Math.floor(Math.max(y[s], y[t]) / cell);
      for (let i = i0; i <= i1; i++)
        for (let j = j0; j <= j1; j++) {
          const k = key(i, j);
          let L = G.get(k);
          if (!L) G.set(k, (L = []));
          L.push(s);
        }
    }
    return { G, key, cell, x, y, n };
  }

  function distTo(gr, px, py, cap) {
    const { G, key, cell, x, y, n } = gr,
      ci = Math.floor(px / cell),
      cj = Math.floor(py / cell),
      rings = Math.ceil(cap / cell);
    let best = cap * cap;
    for (let r = 0; r <= rings; r++) {
      if (r > 0 && (r - 1) * cell > Math.sqrt(best)) break;
      for (let i = ci - r; i <= ci + r; i++)
        for (let j = cj - r; j <= cj + r; j++) {
          if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r) continue;
          const L = G.get(key(i, j));
          if (!L) continue;
          for (const s of L) {
            const t = (s + 1) % n,
              ax = x[s],
              ay = y[s],
              dx = x[t] - ax,
              dy = y[t] - ay,
              ll = dx * dx + dy * dy;
            const u = ll > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / ll)) : 0;
            const ex = ax + u * dx - px,
              ey = ay + u * dy - py,
              d2 = ex * ex + ey * ey;
            if (d2 < best) best = d2;
          }
        }
    }
    return Math.sqrt(best);
  }

  UNB.pathError = function (cx, cy, cClosed, px, py, pClosed, cap, skip) {
    // skip[i]: curve point i isn't meant to follow the path (infill)
    cap = cap || 30;
    const gp = segGrid(px, py, pClosed, 4),
      gc = segGrid(cx, cy, cClosed, 4);
    let a = 0,
      na = 0;
    for (let i = 0; i < cx.length; i++) {
      if (skip && skip[i]) continue;
      a += distTo(gp, cx[i], cy[i], cap);
      na++;
    }
    let b = 0;
    for (let i = 0; i < px.length; i++) b += distTo(gc, px[i], py[i], cap);
    const stray = a / Math.max(1, na),
      missing = b / Math.max(1, px.length);
    return { score: 0.5 * (stray + missing), stray, missing };
  };
})(typeof window !== "undefined" ? window : globalThis);
