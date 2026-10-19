/* Unbroken · engine · 00-util.js
   Shared helpers used by more than one part of the engine, and the UNB object every part adds to.
   Loaded first; core.js lists every part and what's in it. */
(function (root) {
  "use strict";
  const UNB = (root.UNB = root.UNB || {}),
    U = (UNB._u = UNB._u || {}); // UNB: the public engine; UNB._u: helpers shared between parts

  // ---------- rasters ----------
  // 8-connected parts of a mask: lab[i] = part number (−1 off the mask), n parts
  function labelComponents(mask, w, h) {
    const lab = new Int32Array(w * h).fill(-1),
      stack = [];
    let n = 0;
    for (let i = 0; i < w * h; i++)
      if (mask[i] && lab[i] < 0) {
        lab[i] = n;
        stack.push(i);
        while (stack.length) {
          const p = stack.pop(),
            px = p % w,
            py = (p / w) | 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const xx = px + dx,
                yy = py + dy;
              if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
              const q = yy * w + xx;
              if (mask[q] && lab[q] < 0) {
                lab[q] = n;
                stack.push(q);
              }
            }
        }
        n++;
      }
    return { lab, n };
  }

  // 4-connected regions of the cells where open(i) is true: lab[i] = region number (−1 elsewhere), count regions.
  // Used for areas a line closes off (infill, pen fills), so a region can't slip through a diagonal gap in the line.
  function label4(w, h, open) {
    const lab = new Int32Array(w * h).fill(-1),
      stack = [];
    let count = 0;
    const free = (q) => lab[q] < 0 && open(q);
    for (let s = 0; s < w * h; s++) {
      if (!free(s)) continue;
      lab[s] = count;
      stack.push(s);
      while (stack.length) {
        const p = stack.pop(),
          px = p % w,
          py = (p / w) | 0;
        if (px > 0 && free(p - 1)) {
          lab[p - 1] = count;
          stack.push(p - 1);
        }
        if (px < w - 1 && free(p + 1)) {
          lab[p + 1] = count;
          stack.push(p + 1);
        }
        if (py > 0 && free(p - w)) {
          lab[p - w] = count;
          stack.push(p - w);
        }
        if (py < h - 1 && free(p + w)) {
          lab[p + w] = count;
          stack.push(p + w);
        }
      }
      count++;
    }
    return { lab, count };
  }
  // every labelled region's bounding box in cells (x0, y0, x1, y1 arrays; x1 = −1 for an empty region)
  function labelBoxes(lab, count, w, h) {
    const x0 = new Int32Array(count).fill(w),
      y0 = new Int32Array(count).fill(h),
      x1 = new Int32Array(count).fill(-1),
      y1 = new Int32Array(count).fill(-1);
    for (let s = 0; s < w * h; s++) {
      const a = lab[s];
      if (a < 0) continue;
      const x = s % w,
        y = (s / w) | 0;
      if (x < x0[a]) x0[a] = x;
      if (x > x1[a]) x1[a] = x;
      if (y < y0[a]) y0[a] = y;
      if (y > y1[a]) y1[a] = y;
    }
    return { x0, y0, x1, y1 };
  }
  // A polyline marked on a grid (cell size g, origin ox, oy), sampled every `step` cells so a 4-connected region can't
  // slip between two marked cells. closed: also the segment from the last point back to the first.
  function rasterPolyline(mask, w, x, y, closed, ox, oy, g, step) {
    const n = x.length,
      m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % n,
        L = Math.hypot(x[j] - x[i], y[j] - y[i]),
        k = Math.max(1, Math.ceil(L / (g * step)));
      for (let s = 0; s <= k; s++)
        mask[
          Math.round((y[i] + ((y[j] - y[i]) * s) / k - oy) / g) * w +
            Math.round((x[i] + ((x[j] - x[i]) * s) / k - ox) / g)
        ] = 1;
    }
  }
  // Closed contours at `level` of a distance field, inside region `id` of `lab` (marching squares over the region's
  // box). Returns loops as arrays of [x, y] (cell → ox + cell × g). Shared by the chocolate infill (rings) and the 2D
  // pen fills (contours).
  function isoContours(dist, lab, id, level, w, h, box, ox, oy, g) {
    const inside = (i) => lab[i] === id && dist[i] >= level,
      pts = new Map(),
      adj = new Map();
    const link = (a, b) => {
      let A = adj.get(a);
      if (!A) adj.set(a, (A = []));
      A.push(b);
      let B = adj.get(b);
      if (!B) adj.set(b, (B = []));
      B.push(a);
    };
    const crossing = (xa, ya, xb, yb) => {
      // where the level crosses the cell edge a–b (interpolated), under a key both cells share
      const key = xa === xb ? `v${xa},${Math.min(ya, yb)}` : `h${Math.min(xa, xb)},${ya}`;
      if (!pts.has(key)) {
        const da = dist[ya * w + xa],
          db = dist[yb * w + xb],
          t = db === da ? 0.5 : Math.min(1, Math.max(0, (level - da) / (db - da)));
        pts.set(key, [ox + (xa + t * (xb - xa)) * g, oy + (ya + t * (yb - ya)) * g]);
      }
      return key;
    };
    for (let y = Math.max(0, box.y0[id] - 1); y < Math.min(h - 1, box.y1[id] + 1); y++)
      for (let x = Math.max(0, box.x0[id] - 1); x < Math.min(w - 1, box.x1[id] + 1); x++) {
        const c = [
            [x, y],
            [x + 1, y],
            [x + 1, y + 1],
            [x, y + 1],
          ],
          v = c.map(([cx, cy]) => inside(cy * w + cx)),
          nIn = v[0] + v[1] + v[2] + v[3];
        if (nIn === 0 || nIn === 4) continue;
        const E = [];
        for (let e = 0; e < 4; e++)
          if (v[e] !== v[(e + 1) % 4]) {
            const a = c[e],
              b = c[(e + 1) % 4];
            E.push(crossing(a[0], a[1], b[0], b[1]));
          }
        if (E.length === 2) link(E[0], E[1]);
        else if (v[0]) {
          link(E[0], E[3]);
          link(E[1], E[2]);
        } else {
          link(E[0], E[1]);
          link(E[2], E[3]);
        } // saddle: keep the inside corners apart
      }
    const seen = new Set(),
      loops = [];
    for (const s0 of adj.keys()) {
      if (seen.has(s0)) continue;
      const loop = [s0];
      seen.add(s0);
      let prev = null,
        cur = s0;
      for (;;) {
        const nb = adj.get(cur).find((k) => k !== prev && !seen.has(k));
        if (!nb) break;
        seen.add(nb);
        loop.push(nb);
        prev = cur;
        cur = nb;
      }
      if (loop.length > 3 && adj.get(cur).includes(s0)) loops.push(loop.map((k) => pts.get(k))); // closed loops only
    }
    return loops;
  }

  // Things bucketed in square cells of size `cell` (cell → the indices put there), to find near ones fast. add(x, y, i)
  // puts i in the cell holding (x, y), addCell(gx, gy, i) in cell (gx, gy) (at(v): a coordinate's cell); near(x, y, fn)
  // calls fn(i) for everything in the 3 × 3 cells round (x, y) (everything closer than `cell`, and some further), the
  // cells left to right, each top to bottom; cells() gives the buckets in the order they were made.
  function cellGrid(cell) {
    const m = new Map(),
      key = (gx, gy) => gx * 1000003 + gy,
      at = (v) => Math.floor(v / cell);
    const addCell = (gx, gy, i) => {
      const k = key(gx, gy);
      let a = m.get(k);
      if (!a) m.set(k, (a = []));
      a.push(i);
    };
    const near = (x, y, fn) => {
      const gx = at(x),
        gy = at(y);
      for (let ox = -1; ox <= 1; ox++)
        for (let oy = -1; oy <= 1; oy++) {
          const a = m.get(key(gx + ox, gy + oy));
          if (a) for (const i of a) fn(i);
        }
    };
    return { cell, at, addCell, add: (x, y, i) => addCell(at(x), at(y), i), near, cells: () => m.values() };
  }

  // ---------- polylines ----------
  // bounding box of x, y (any array-likes)
  function bbox(x, y) {
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (let i = 0; i < x.length; i++) {
      const X = x[i],
        Y = y[i];
      if (X < x0) x0 = X;
      if (X > x1) x1 = X;
      if (Y < y0) y0 = Y;
      if (Y > y1) y1 = Y;
    }
    return { x0, y0, x1, y1 };
  }
  // Cumulative length along a polyline: S[i] = length from point 0 to point i; S[n] = the whole loop back to point 0
  // when closed, else S[n − 1]. Length n + 1 either way.
  function cumLength(x, y, closed) {
    const n = x.length,
      S = new Float64Array(n + 1);
    for (let i = 1; i < n; i++) S[i] = S[i - 1] + Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]);
    if (n) S[n] = S[n - 1] + (closed && n > 1 ? Math.hypot(x[0] - x[n - 1], y[0] - y[n - 1]) : 0);
    return S;
  }
  // A closed loop of [x, y] points → about length / step evenly spaced points (at least 8), as [x, y]
  function resampleLoop(P, step) {
    if (P.length < 2) return P.map((p) => p.slice()); // nothing to space out
    const m = P.length,
      cum = cumLength(
        P.map((p) => p[0]),
        P.map((p) => p[1]),
        true
      );
    const L = cum[m],
      k = Math.max(8, Math.round(L / step)),
      out = [];
    let q = 0;
    for (let s = 0; s < k; s++) {
      const u = (L * s) / k;
      while (q < m - 1 && cum[q + 1] < u) q++;
      const t = (u - cum[q]) / (cum[q + 1] - cum[q] || 1),
        j = (q + 1) % m;
      out.push([P[q][0] + t * (P[j][0] - P[q][0]), P[q][1] + t * (P[j][1] - P[q][1])]);
    }
    return out;
  }

  // ---------- small structures ----------
  // union-find over 0 … n − 1 (path halving): find(i), union(a, b) → true if they were apart
  function makeUF(n) {
    const parent = Int32Array.from({ length: n }, (_, i) => i);
    const find = (i) => {
      while (parent[i] !== i) i = parent[i] = parent[parent[i]];
      return i;
    };
    return {
      parent,
      find,
      union: (a, b) => {
        a = find(a);
        b = find(b);
        if (a !== b) parent[a] = b;
        return a !== b;
      },
    };
  }
  // binary min-heap of values with numeric keys: push(v, key), pop() → the value with the smallest key, topKey(),
  // size(), clear(). Used by the shortest-route searches in buildWalk.
  function makeHeap() {
    const hv = [],
      hk = [];
    return {
      size: () => hv.length,
      topKey: () => hk[0],
      clear: () => {
        hv.length = 0;
        hk.length = 0;
      },
      push(v, d) {
        let i = hv.length;
        hv.push(v);
        hk.push(d);
        while (i) {
          const p = (i - 1) >> 1;
          if (hk[p] <= d) break;
          hv[i] = hv[p];
          hk[i] = hk[p];
          i = p;
        }
        hv[i] = v;
        hk[i] = d;
      },
      pop() {
        const v = hv[0],
          lv = hv.pop(),
          ld = hk.pop(),
          n = hv.length;
        if (n) {
          let i = 0;
          for (;;) {
            let c = 2 * i + 1;
            if (c >= n) break;
            if (c + 1 < n && hk[c + 1] < hk[c]) c++;
            if (hk[c] >= ld) break;
            hv[i] = hv[c];
            hk[i] = hk[c];
            i = c;
          }
          hv[i] = lv;
          hk[i] = ld;
        }
        return v;
      },
    };
  }
  // normalised Gaussian kernel of radius ⌈3σ⌉
  function gaussKernel(sigma) {
    const r = Math.ceil(sigma * 3),
      k = new Float32Array(2 * r + 1);
    let s = 0;
    for (let i = -r; i <= r; i++) {
      k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma));
      s += k[i + r];
    }
    for (let i = 0; i < k.length; i++) k[i] /= s;
    return k;
  }

  // a line from (x0, y0) to (x1, y1) marked on a mask (Bresenham; points off the mask are skipped)
  function plotLine(m, w, h, x0, y0, x1, y1) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0),
      dy = -Math.abs(y1 - y0),
      sx = x0 < x1 ? 1 : -1,
      sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (x0 >= 0 && y0 >= 0 && x0 < w && y0 < h) m[y0 * w + x0] = 1;
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  // value of grid f at a fractional cell (x, y), bilinear, clamped to the grid
  function bilinear(f, w, h, x, y) {
    x = Math.max(0, Math.min(w - 1.001, x));
    y = Math.max(0, Math.min(h - 1.001, y));
    const x0 = x | 0,
      y0 = y | 0,
      a = x - x0,
      b = y - y0,
      i = y0 * w + x0;
    return f[i] * (1 - a) * (1 - b) + f[i + 1] * a * (1 - b) + f[i + w] * (1 - a) * b + f[i + w + 1] * a * b;
  }

  // a number for a file: rounded to 0.001, no trailing zeros
  const f3 = (v) => (Math.round(v * 1000) / 1000).toString();
  // SVG path data for flat polylines [x0, y0, x1, y1, …], X and Y mapping each coordinate to text; returned as
  // <path> elements of at most `per` polylines each (very long path data slows some editors down)
  function svgPolylines(lines, X, Y, per, attrs) {
    const parts = lines.map((L) => {
      let d = `M${X(L[0])} ${Y(L[1])}`;
      for (let k = 2; k + 1 < L.length; k += 2) d += ` L${X(L[k])} ${Y(L[k + 1])}`;
      return d;
    });
    let out = "";
    for (let k = 0; k < parts.length; k += per)
      out += `<path d="${parts.slice(k, k + per).join(" ")}"${attrs ? " " + attrs : ""}/>\n`;
    return out;
  }

  Object.assign(U, {
    labelComponents,
    label4,
    labelBoxes,
    rasterPolyline,
    isoContours,
    cellGrid,
    bbox,
    cumLength,
    resampleLoop,
    makeUF,
    makeHeap,
    gaussKernel,
    plotLine,
    bilinear,
    f3,
    svgPolylines,
  });
})(typeof window !== "undefined" ? window : globalThis);
