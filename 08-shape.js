/* Unbroken · engine · 08-shape.js
   7. Shaping the drawn line — no crossings, minimum spacing between strands, problem spots, simplification.
   One part of the engine (no DOM), loaded after 07-measure.js; core.js lists every part and what's in it. */
(function (root) {
  "use strict";
  const UNB = root.UNB,
    { cumLength, cellGrid } = UNB._u; // shared helpers (00-util.js)

  // mean distance between neighbouring points (the closing segment counts only when closed)
  function arcSteps(re, im, closed) {
    const S = re.length,
      segs = closed ? S : S - 1;
    return segs > 0 ? cumLength(re, im, closed)[S] / segs : 0;
  }
  // points bucketed in square cells of size `cell`; near(s, fn) calls fn(t) for every point in the 3 × 3 cells round
  // point s (so every point closer than `cell`, and some further)
  function pointGrid(re, im, cell) {
    const G = cellGrid(cell);
    for (let s = 0; s < re.length; s++) G.add(re[s], im[s], s);
    return (s, fn) => G.near(re[s], im[s], fn);
  }

  // Minimum spacing: push non-neighbouring parts of the line (more than ~3d apart along it) at least d apart, up to
  // `iters` rounds, with light smoothing so pushed parts don't kink. skip(x, y): leave points there alone (areas
  // where crossings are allowed). Returns { re, im }.
  UNB.enforceSpacing = function (re0, im0, d, iters, closed, skip) {
    closed = closed !== false;
    const S = re0.length,
      re = Float64Array.from(re0),
      im = Float64Array.from(im0);
    if (d <= 0) return { re, im };
    const step = arcSteps(re, im, closed) || 1,
      win = Math.ceil((3 * d) / step) + 2;
    const dxA = new Float64Array(S),
      dyA = new Float64Array(S);
    for (let it = 0; it < (iters || 120); it++) {
      const near = pointGrid(re, im, d * 1.05);
      dxA.fill(0);
      dyA.fill(0);
      let viol = 0;
      for (let s = 0; s < S; s++)
        near(s, (t) => {
          if (t <= s) return;
          const sep = closed ? Math.min(t - s, S - (t - s)) : t - s;
          if (sep <= win) return;
          let dx = re[t] - re[s],
            dy = im[t] - im[s];
          const dd = Math.hypot(dx, dy);
          if (dd >= d) return;
          if (skip && (skip(re[s], im[s]) || skip(re[t], im[t]))) return;
          viol++;
          if (dd < 1e-6) {
            dx = 1;
            dy = 0;
          } else {
            dx /= dd;
            dy /= dd;
          }
          const push = (d * 1.05 - dd) * 0.5;
          dxA[s] -= dx * push;
          dyA[s] -= dy * push;
          dxA[t] += dx * push;
          dyA[t] += dy * push;
        });
      if (!viol) break;
      for (let s = 0; s < S; s++) {
        re[s] += 0.9 * dxA[s];
        im[s] += 0.9 * dyA[s];
      }
      // light smoothing keeps the pushed parts from kinking
      const r2 = Float64Array.from(re),
        i2 = Float64Array.from(im);
      for (let s = closed ? 0 : 1; s < (closed ? S : S - 1); s++) {
        const a = (s + S - 1) % S,
          b = (s + 1) % S;
        re[s] = r2[s] + 0.15 * ((r2[a] + r2[b]) / 2 - r2[s]);
        im[s] = i2[s] + 0.15 * ((i2[a] + i2[b]) / 2 - i2[s]);
      }
    }
    return { re, im };
  };

  // Closest approach between parts of the line more than ~3r apart along it, searching up to about radius r
  // (Infinity if none is that close). skip(x, y): ignore points there.
  UNB.closestGap = function (re, im, r, closed, skip) {
    closed = closed !== false;
    const S = re.length,
      step = arcSteps(re, im, closed) || 1,
      win = Math.ceil((3 * r) / step) + 2,
      near = pointGrid(re, im, r);
    let best = Infinity;
    for (let s = 0; s < S; s++)
      near(s, (t) => {
        if (t <= s) return;
        const sep = closed ? Math.min(t - s, S - (t - s)) : t - s;
        if (sep <= win) return;
        if (skip && (skip(re[s], im[s]) || skip(re[t], im[t]))) return;
        const dd = Math.hypot(re[t] - re[s], im[t] - im[s]);
        if (dd < best) best = dd;
      });
    return best;
  };

  // Drift: where making room for the spacing moved the line away from the drawing. For every point of the fitted series
  // (where the line should be), the distance to the nearest point of the final line among those at about the same place
  // along it (within 3% of its length, so a strand that runs past from elsewhere doesn't count). Points further than
  // tol
  // are drift; returns the drifted stretches as polylines on the fitted series, and their share of it.
  UNB.drift = function (re, im, fre, fim, closed, tol) {
    const n = re.length,
      m = fre.length;
    if (!(tol > 0) || n < 2 || m < 2) return { spans: [], share: 0 };
    const frac = (x, y, k) => {
      const c = cumLength(x, y, closed),
        L = c[k] || 1;
      for (let i = 0; i <= k; i++) c[i] /= L;
      return c;
    }; // share of the length at each point
    const ca = frac(re, im, n),
      cb = frac(fre, fim, m),
      win = 0.03,
      far = new Uint8Array(n);
    let lo = 0,
      count = 0;
    for (let i = 0; i < n; i++) {
      const t = ca[i];
      while (lo < m - 1 && cb[lo] < t - win) lo++;
      let best = Infinity;
      const look = (j) => {
        const dd = Math.hypot(fre[j] - re[i], fim[j] - im[i]);
        if (dd < best) best = dd;
      };
      for (let j = lo; j < m && cb[j] <= t + win; j++) look(j);
      if (closed) {
        // round the join between end and start
        if (t + win > 1) for (let j = 0; j < m && cb[j] <= t + win - 1; j++) look(j);
        if (t - win < 0) for (let j = m - 1; j >= 0 && cb[j] >= t - win + 1; j--) look(j);
      }
      if (best > tol) {
        far[i] = 1;
        count++;
      }
    }
    const spans = [];
    let cur = null;
    for (let i = 0; i < n; i++) {
      if (far[i]) {
        if (!cur) spans.push((cur = []));
        cur.push([re[i], im[i]]);
      } else cur = null;
    }
    if (closed && spans.length > 1 && far[0] && far[n - 1]) {
      const first = spans.shift();
      spans[spans.length - 1].push(...first);
    }
    return { spans: spans.filter((sp) => sp.length > 1), share: count / n };
  };

  // Problem spots to mark on the preview: self-crossings, and places where non-neighbouring parts come closer than
  // 0.95 d. Returns { crossings, tight }: marker positions [x, y], merged within max(6, 2d), at most ~400 each.
  UNB.problemSpots = function (re, im, d, closed) {
    closed = closed !== false;
    const S = re.length,
      cross = UNB.findCrossings(re, im, closed).map((c) => [c[3], c[4]]),
      tight = [];
    if (d > 0) {
      const win = Math.ceil((3 * Math.max(d, 2)) / (arcSteps(re, im, closed) || 1)) + 2,
        near = pointGrid(re, im, Math.max(4, d));
      const sep = (a, b) => {
        const k = Math.abs(a - b);
        return closed ? Math.min(k, S - k) : k;
      };
      for (let s = 0; s < S; s++)
        near(s, (t) => {
          if (t > s && sep(s, t) > win && Math.hypot(re[t] - re[s], im[t] - im[s]) < d * 0.95)
            tight.push([(re[s] + re[t]) / 2, (im[s] + im[t]) / 2]);
        });
    }
    const cluster = (pts, r) => {
      // merge markers closer than r
      const out = [];
      for (const p of pts) {
        if (!out.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < r)) out.push(p);
        if (out.length > 400) break;
      }
      return out;
    };
    const R = Math.max(6, (d || 0) * 2);
    return { crossings: cluster(cross, R), tight: cluster(tight, R) };
  };

  // All self-crossings of a polyline: [a, b, angleDeg, x, y] where segment a→a+1 crosses segment b→b+1 (a < b), at (x,
  // y).
  // Segments are bucketed in cells of 8 × the mean segment length, so it works the same in px or mm.
  UNB.findCrossings = function (re, im, closed) {
    closed = closed !== false;
    const S = re.length,
      segs = closed ? S : S - 1,
      cell = Math.max(1e-6, 8 * (arcSteps(re, im, closed) || 0.5)),
      grid = cellGrid(cell),
      out = [];
    for (let s = 0; s < segs; s++) {
      const t = (s + 1) % S;
      const x0 = Math.floor(Math.min(re[s], re[t]) / cell),
        x1 = Math.floor(Math.max(re[s], re[t]) / cell);
      const y0 = Math.floor(Math.min(im[s], im[t]) / cell),
        y1 = Math.floor(Math.max(im[s], im[t]) / cell);
      for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) grid.addCell(gx, gy, s);
    }
    const seen = new Set();
    for (const list of grid.cells())
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++) {
          let a = list[i],
            b = list[j];
          if (a > b) [a, b] = [b, a];
          if (b - a < 2 || (closed && S - (b - a) < 2)) continue;
          const key = a * S + b;
          if (seen.has(key)) continue;
          const a2 = (a + 1) % S,
            b2 = (b + 1) % S;
          const d1x = re[a2] - re[a],
            d1y = im[a2] - im[a],
            d2x = re[b2] - re[b],
            d2y = im[b2] - im[b];
          const den = d1x * d2y - d1y * d2x;
          if (Math.abs(den) < 1e-12) continue;
          const ex = re[b] - re[a],
            ey = im[b] - im[a],
            u = (ex * d2y - ey * d2x) / den,
            v = (ex * d1y - ey * d1x) / den;
          if (u > 0 && u < 1 && v > 0 && v < 1) {
            seen.add(key);
            const t = (Math.abs(Math.atan2(den, d1x * d2x + d1y * d2y)) * 180) / Math.PI;
            out.push([a, b, Math.min(t, 180 - t), re[a] + u * d1x, im[a] + u * d1y]);
          }
        }
    return out;
  };

  // Untangle: remove self-crossings by 2-opt moves. Where segment a→a+1 crosses b→b+1, reversing the stretch
  // a+1..b swaps those two segments for a→b and a+1→b+1, which no longer cross; the line keeps exactly the same
  // shape except at that one point, where the crossing becomes a touch. Each move shortens the line, so it settles.
  // maxAngle limits it to shallow crossings (where the line runs back over itself); 90 removes every crossing.
  UNB.uncross = function (re0, im0, closed, opt) {
    opt = opt || {};
    closed = closed !== false;
    const maxAngle = opt.maxAngle === undefined ? 90 : opt.maxAngle,
      passes = opt.passes || 60;
    const allow = opt.allow || null; // (x, y) → true where a crossing is allowed to stay
    const re = Float64Array.from(re0),
      im = Float64Array.from(im0),
      S = re.length;
    // per-sample arrays (e.g. connector flags) that move with the points
    const carry = (opt.carry || []).map((a) => a.slice());
    const before = UNB.findCrossings(re, im, closed).length;
    let removed = 0;
    for (let p = 0; p < passes; p++) {
      const cr = UNB.findCrossings(re, im, closed).filter((c) => c[2] <= maxAngle && !(allow && allow(c[3], c[4])));
      if (!cr.length) break;
      cr.sort((x, y) => x[1] - x[0] - (y[1] - y[0])); // innermost first
      const acc = [],
        usedSeg = new Set();
      for (const [a, b] of cr) {
        if (usedSeg.has(a) || usedSeg.has(b) || usedSeg.has(a + 1) || usedSeg.has(b + 1)) continue;
        // accepted intervals must nest or be disjoint (laminar), so every move stays valid in the same pass
        let ok = true;
        for (const [c, d] of acc)
          if ((a < c && c <= b && b < d) || (c < a && a <= d && d < b)) {
            ok = false;
            break;
          }
        if (!ok) continue;
        acc.push([a, b]);
        usedSeg.add(a);
        usedSeg.add(b);
        usedSeg.add(a + 1);
        usedSeg.add(b + 1);
      }
      if (!acc.length) break;
      acc.sort((x, y) => x[1] - x[0] - (y[1] - y[0])); // apply inner reversals before the ones around them
      for (const [a, b] of acc) {
        for (let i = a + 1, j = b; i < j; i++, j--) {
          let t = re[i];
          re[i] = re[j];
          re[j] = t;
          t = im[i];
          im[i] = im[j];
          im[j] = t;
          for (const c of carry) {
            t = c[i];
            c[i] = c[j];
            c[j] = t;
          }
        }
        removed++;
      }
    }
    const left = UNB.findCrossings(re, im, closed);
    return {
      re,
      im,
      carry,
      before,
      after: left.length,
      allowed: allow ? left.filter((c) => allow(c[3], c[4])).length : 0,
      moves: removed,
    };
  };

  // Even arc-length resampling (open or closed) to points `step` apart; per-sample arrays in `carry` are
  // resampled by nearest source point.
  UNB.resampleCurve = function (re, im, closed, step, carry) {
    closed = closed !== false;
    const n = re.length,
      last = closed ? n : n - 1,
      cum = cumLength(re, im, closed);
    const L = cum[last],
      m = Math.max(16, Math.ceil(L / step) + (closed ? 0 : 1));
    const x = new Float64Array(m),
      y = new Float64Array(m),
      outC = (carry || []).map((c) => new c.constructor(m));
    let k = 0;
    for (let s = 0; s < m; s++) {
      const u = closed ? (L * s) / m : (L * s) / (m - 1);
      while (k < last - 1 && cum[k + 1] < u) k++;
      const seg = cum[k + 1] - cum[k],
        t = seg > 0 ? Math.min(1, (u - cum[k]) / seg) : 0,
        j = (k + 1) % n;
      x[s] = re[k] + t * (re[j] - re[k]);
      y[s] = im[k] + t * (im[j] - im[k]);
      outC.forEach((o, ci) => {
        o[s] = carry[ci][t < 0.5 ? k : j];
      });
    }
    return { re: x, im: y, carry: outC, length: L };
  };

  // Untangle and separate: remove crossings, then push strands that touch at least `gap` apart and remove any
  // crossings that pushing created. Without a gap, removed crossings are left as touch points.
  // opt: gap, maxAngle, iters, allow(x, y) (crossings allowed there), carry (per-point arrays that move with the
  // points), tags ({ group, jid, jd } per point: carried the same way and returned as tags).
  UNB.untangle = function (re, im, closed, opt) {
    opt = opt || {};
    const gap = opt.gap || 0;
    let carry = opt.carry || [];
    const allow = opt.allow || null,
      T = opt.tags || null,
      ti = carry.length;
    const tagKeys = T ? ["group", "jid", "jd"].filter((k) => T[k]) : [];
    if (T) carry = carry.concat(tagKeys.map((k) => T[k].slice())); // tags travel with the points
    const tagsNow = (c) => {
      if (!T) return null;
      const o = {};
      tagKeys.forEach((k, i) => {
        o[k] = c[ti + i];
      });
      return o;
    };
    let u = UNB.uncross(re, im, closed, { maxAngle: opt.maxAngle, carry, allow }),
      before = u.before;
    if (gap > 0) {
      // Pushing strands apart only converges when points are a fraction of the gap apart; finer detail than
      // gap/3 can't be kept apart anyway. So separate on a copy with points ~gap/3 apart (never finer than given).
      const n = u.re.length,
        L = cumLength(u.re, u.im, closed)[n];
      const step = Math.max(0.5, gap / 3);
      if (L / n < step * 0.8) {
        const r = UNB.resampleCurve(u.re, u.im, closed, step, u.carry);
        u = { re: r.re, im: r.im, carry: r.carry, moves: 1 };
      }
    }
    for (let it = 0; it < 3 && gap > 0; it++) {
      const sp = UNB.enforceSpacing(u.re, u.im, gap, opt.iters || 120, closed, allow);
      u = UNB.uncross(sp.re, sp.im, closed, { maxAngle: opt.maxAngle, carry: u.carry, allow });
      if (!u.moves) break;
    }
    return {
      re: u.re,
      im: u.im,
      carry: u.carry.slice(0, ti),
      tags: tagsNow(u.carry),
      before,
      after: u.after,
      allowed: u.allowed || 0,
    };
  };

  // Douglas–Peucker: drop points within tol of the simplified line (closed unless closed === false)
  UNB.simplify = function (x, y, tol, closed) {
    if (closed === false) {
      // open: plain DP between the two ends
      const n0 = x.length;
      if (tol <= 0 || n0 < 3) return { x: Float64Array.from(x), y: Float64Array.from(y) };
      const keep = new Uint8Array(n0);
      keep[0] = keep[n0 - 1] = 1;
      const st = [[0, n0 - 1]];
      while (st.length) {
        const [a, b] = st.pop();
        const dx = x[b] - x[a],
          dy = y[b] - y[a],
          L = Math.hypot(dx, dy);
        let best = -1,
          bi = -1;
        for (let i = a + 1; i < b; i++) {
          const d =
            L > 0 ? Math.abs(dy * (x[i] - x[a]) - dx * (y[i] - y[a])) / L : Math.hypot(x[i] - x[a], y[i] - y[a]);
          if (d > best) {
            best = d;
            bi = i;
          }
        }
        if (best > tol) {
          keep[bi] = 1;
          st.push([a, bi], [bi, b]);
        }
      }
      const ox = [],
        oy = [];
      for (let i = 0; i < n0; i++)
        if (keep[i]) {
          ox.push(x[i]);
          oy.push(y[i]);
        }
      return { x: Float64Array.from(ox), y: Float64Array.from(oy) };
    }
    const n = x.length;
    if (tol <= 0 || n < 4) return { x: Float64Array.from(x), y: Float64Array.from(y) };
    const keep = new Uint8Array(n + 1);
    keep[0] = keep[n] = 1;
    const X = (i) => x[i % n],
      Y = (i) => y[i % n],
      stack = [[0, n]];
    while (stack.length) {
      const [a, b] = stack.pop();
      const ax = X(a),
        ay = Y(a),
        dx = X(b) - ax,
        dy = Y(b) - ay,
        L = Math.hypot(dx, dy);
      let best = -1,
        bi = -1;
      for (let i = a + 1; i < b; i++) {
        const d = L > 0 ? Math.abs(dy * (X(i) - ax) - dx * (Y(i) - ay)) / L : Math.hypot(X(i) - ax, Y(i) - ay);
        if (d > best) {
          best = d;
          bi = i;
        }
      }
      if (best > tol) {
        keep[bi] = 1;
        stack.push([a, bi], [bi, b]);
      }
    }
    const ox = [],
      oy = [];
    for (let i = 0; i < n; i++)
      if (keep[i]) {
        ox.push(x[i]);
        oy.push(y[i]);
      }
    return { x: Float64Array.from(ox), y: Float64Array.from(oy) };
  };
})(typeof window !== "undefined" ? window : globalThis);
