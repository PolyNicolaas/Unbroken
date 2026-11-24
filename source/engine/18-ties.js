/* Unbroken · engine · 18-ties.js
   17. Ties — more connectors for a large print. The trace joins the separate parts of a drawing (the letters of a
   word, the rows of a logo, an arch over them) into one line with as few, as short connectors as it can: a single
   strand here and there, a tree that holds every part on by one thin wall. Printed tall, that flexes and snaps. Ties
   add short struts across the open gaps between parts, at full wall height, so each part is held from several sides.
   Each tie is two strands side by side, a spacing apart (one out to the other part's wall, one back), spliced into
   the line where it leaves, so the line stays one continuous path that never runs over itself.
   One part of the engine (no DOM), loaded after 17-vase.js; core.js lists every part and what's in it. */
(function (root) {
  "use strict";
  const UNB = root.UNB;

  // The open background: the picture's paper that reaches the edge of the picture (4-neighbours, not through ink). A
  // tie crosses it; the inside of a letter's bowl (closed off by its ink) isn't a gap between parts.
  function openOutside(ink, w, h) {
    const open = new Uint8Array(w * h),
      q = new Int32Array(w * h);
    let n = 0;
    const push = (i) => {
      if (!ink[i] && !open[i]) {
        open[i] = 1;
        q[n++] = i;
      }
    };
    for (let x = 0; x < w; x++) push(x), push((h - 1) * w + x);
    for (let y = 0; y < h; y++) push(y * w), push(y * w + w - 1);
    for (let k = 0; k < n; k++) {
      const i = q[k],
        x = i % w,
        y = (i - x) / w;
      if (x > 0) push(i - 1);
      if (x < w - 1) push(i + 1);
      if (y > 0) push(i - w);
      if (y < h - 1) push(i + w);
    }
    return open;
  }

  // the ink's pieces (8-neighbours), numbered from 1 (0: not ink)
  function labelParts(ink, w, h) {
    const lab = new Int32Array(w * h),
      q = new Int32Array(w * h);
    let next = 0;
    for (let s = 0; s < w * h; s++) {
      if (!ink[s] || lab[s]) continue;
      lab[s] = ++next;
      let n = 0;
      q[n++] = s;
      for (let t = 0; t < n; t++) {
        const i = q[t],
          x = i % w,
          y = (i - x) / w;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const X = x + dx,
              Y = y + dy;
            if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
            const j = Y * w + X;
            if (ink[j] && !lab[j]) {
              lab[j] = next;
              q[n++] = j;
            }
          }
      }
    }
    return lab;
  }

  // UNB.ties(re, im, o): the line (px, the picture's working frame) with ties spliced in.
  //   o: { ink (Uint8Array w × h, 1 where the picture is ink), w, h, mmPerPx, closed (the line is a loop),
  //        maxMM (longest tie, default 7), everyMM (ties at least this far apart, default 10), spacingMM (the two
  //        strands of a tie this far apart, and parts closer than 1.2 of it already touch: default 1.34), lineMM (the
  //        bead: a tie stops half of it short of the far wall, so the bead meets it; default 0.84), withinParts (ties
  //        from a part to itself too: across a letter's own notch or opening; default not), leaveOut ([[x, y], …] px:
  //        places a tie was taken away, none within everyMM of one), only ([[x, y], …] px: just the ties with their
  //        middle within 2.5 mm of one of these, a set chosen before) }
  //   → { re, im (Float64Array), ties: [[x0, y0, x1, y1], …] (px, where each tie leaves and where it lands), count,
  //       addedMM (line added, mm) }
  // A tie is the shortest way across a gap of open background between two stretches of the line that are far apart
  // along it (two parts, or two ends of one part that the trace reached separately). It's kept when it is at most
  // maxMM long, its middle is in the open background, neither strand crosses the line or another tie, and both its
  // ends are at least everyMM from every other tie's and half that from a connector the trace already put there (a
  // stretch of the line out in the open), and it joins two parts (pieces of ink) rather than closing one part's notch.
  // Shortest first. (Nicolaas went through the 32 ties of a logo meant to stand up as a cake topper and took 10 away:
  // 7 of them closed a letter's notch or opening, a W's V, a Y's, an E's arms, a G's mouth. Such a tie is left out
  // but keeps its place, so another doesn't move in beside it: what's left then differs from his choice by 6 of 32.)
  UNB.ties = function (re, im, o) {
    const k = o.mmPerPx,
      w = o.w,
      h = o.h,
      maxMM = o.maxMM || 7,
      every = o.everyMM || 10,
      sp = o.spacingMM || 1.34,
      H = sp / 2,
      fused = 1.2 * sp,
      short = (o.lineMM || 0.84) / 2,
      n = re.length;
    const none = { re: Float64Array.from(re), im: Float64Array.from(im), ties: [], count: 0, addedMM: 0 };
    if (n < 4 || !(k > 0)) return none;
    const open = openOutside(o.ink, w, h);
    // how far each open pixel is from anything that isn't open (px): the trace's own connectors run out in the open
    const notOpen = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) notOpen[i] = open[i] ? 0 : 1;
    const far = UNB.edt(notOpen, w, h).dist;
    const px = (x) => x / k; // mm → px
    const at = (A, x, y) => {
      const ix = Math.round(px(x)),
        iy = Math.round(px(y));
      return ix >= 0 && iy >= 0 && ix < w && iy < h ? A[iy * w + ix] : 0;
    };
    // the line in mm, and its length along the way
    const X = new Float64Array(n),
      Y = new Float64Array(n),
      S = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      X[i] = re[i] * k;
      Y[i] = im[i] * k;
      if (i) S[i] = S[i - 1] + Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1]);
    }
    const L = S[n - 1] + (o.closed ? Math.hypot(X[0] - X[n - 1], Y[0] - Y[n - 1]) : 0);
    const pointAt = (s) => {
      let lo = 0,
        hi = n - 1;
      while (hi - lo > 1) {
        const m = (lo + hi) >> 1;
        if (S[m] <= s) lo = m;
        else hi = m;
      }
      const g = S[hi] - S[lo],
        t = g > 0 ? Math.min(1, Math.max(0, (s - S[lo]) / g)) : 0;
      return [X[lo] + t * (X[hi] - X[lo]), Y[lo] + t * (Y[hi] - Y[lo])];
    };
    // samples every half millimetre (none in the first and last two: a tie is spliced in where it leaves)
    const step = 0.5,
      ss = [];
    for (let s = 2; s < S[n - 1] - 2; s += step) ss.push(s);
    const m = ss.length,
      SX = new Float64Array(m),
      SY = new Float64Array(m),
      onConn = new Uint8Array(m);
    for (let i = 0; i < m; i++) [SX[i], SY[i]] = pointAt(ss[i]);
    // the trace's own connectors: samples a good way out in the open (more than half a bead from anything else)
    const deep = Math.max(1.5, px(0.6));
    for (let i = 0; i < m; i++) if (at(open, SX[i], SY[i]) && at(far, SX[i], SY[i]) > deep) onConn[i] = 1;
    const spots = [];
    for (let i = 0; i < m; i++)
      if (onConn[i] && (!i || !onConn[i - 1] || i === m - 1 || !onConn[i + 1])) spots.push([SX[i], SY[i]]);
    // the drawing's parts: pieces of ink (touching, corners too), and the part nearest any point
    const part = labelParts(o.ink, w, h),
      nearInk = UNB.edt(o.ink, w, h).near;
    const partAt = (x, y) => {
      const ix = Math.min(w - 1, Math.max(0, Math.round(px(x)))),
        iy = Math.min(h - 1, Math.max(0, Math.round(px(y)))),
        c = nearInk[iy * w + ix];
      return c >= 0 ? part[c] : 0;
    };
    // places left out (a tie taken away): no tie with its middle within the spacing of ties of one, so none takes its place
    const out = (o.leaveOut || []).map(([x, y]) => [x * k, y * k]);
    // or only the ties at these places (their middles, px): a set chosen before, on the same line
    const only = o.only ? o.only.map(([x, y]) => [x * k, y * k]) : null;
    // a grid of the samples, cells maxMM wide
    const gx = (x) => Math.floor(x / maxMM),
      cells = new Map(),
      key = (a, b) => a * 100003 + b;
    for (let i = 0; i < m; i++) {
      const c = key(gx(SX[i]), gx(SY[i]));
      if (!cells.has(c)) cells.set(c, []);
      cells.get(c).push(i);
    }
    const d2 = (i, j) => (SX[i] - SX[j]) ** 2 + (SY[i] - SY[j]) ** 2;
    const along = (i, j) => {
      const a = Math.abs(ss[i] - ss[j]);
      return o.closed ? Math.min(a, L - a) : a;
    };
    // locally shortest: no neighbouring pair of samples is closer
    const shortest = (i, j, d) => {
      for (const [a, b] of [
        [i + 1, j],
        [i - 1, j],
        [i, j + 1],
        [i, j - 1],
      ])
        if (a >= 0 && b >= 0 && a < m && b < m && Math.sqrt(d2(a, b)) < d - 1e-9) return false;
      return true;
    };
    const cands = [];
    for (let i = 0; i < m; i++) {
      if (onConn[i]) continue;
      const cx = gx(SX[i]),
        cy = gx(SY[i]);
      for (let a = cx - 1; a <= cx + 1; a++)
        for (let b = cy - 1; b <= cy + 1; b++) {
          const list = cells.get(key(a, b));
          if (!list) continue;
          for (const j of list) {
            if (j <= i || onConn[j]) continue;
            const d = Math.sqrt(d2(i, j));
            if (d < fused || d > maxMM || along(i, j) < 3 * d + 4) continue;
            if (shortest(i, j, d)) cands.push([d, i, j]);
          }
        }
    }
    cands.sort((a, b) => a[0] - b[0]);
    // the line's segments in a grid, for the crossing test
    const segCell = 4,
      segs = new Map(),
      nSeg = o.closed ? n : n - 1;
    for (let i = 0; i < nSeg; i++) {
      const j = (i + 1) % n,
        a0 = Math.floor(Math.min(X[i], X[j]) / segCell),
        a1 = Math.floor(Math.max(X[i], X[j]) / segCell),
        b0 = Math.floor(Math.min(Y[i], Y[j]) / segCell),
        b1 = Math.floor(Math.max(Y[i], Y[j]) / segCell);
      for (let a = a0; a <= a1; a++)
        for (let b = b0; b <= b1; b++) {
          const c = key(a, b);
          if (!segs.has(c)) segs.set(c, []);
          segs.get(c).push(i);
        }
    }
    const cr = (ax, ay, bx, by) => ax * by - ay * bx;
    const meets = (px0, py0, px1, py1, ax, ay, bx, by) => {
      const d1 = cr(px1 - px0, py1 - py0, ax - px0, ay - py0),
        d2_ = cr(px1 - px0, py1 - py0, bx - px0, by - py0),
        d3 = cr(bx - ax, by - ay, px0 - ax, py0 - ay),
        d4 = cr(bx - ax, by - ay, px1 - ax, py1 - ay);
      return d1 * d2_ < 0 && d3 * d4 < 0;
    };
    const crossesLine = (x0, y0, x1, y1) => {
      const seen = new Set(),
        a0 = Math.floor(Math.min(x0, x1) / segCell),
        a1 = Math.floor(Math.max(x0, x1) / segCell),
        b0 = Math.floor(Math.min(y0, y1) / segCell),
        b1 = Math.floor(Math.max(y0, y1) / segCell);
      for (let a = a0; a <= a1; a++)
        for (let b = b0; b <= b1; b++)
          for (const i of segs.get(key(a, b)) || []) {
            if (seen.has(i)) continue;
            seen.add(i);
            const j = (i + 1) % n;
            if (meets(x0, y0, x1, y1, X[i], Y[i], X[j], Y[j])) return true;
          }
      return false;
    };
    const near = (x, y, list, r) => list.some((q) => (q[0] - x) ** 2 + (q[1] - y) ** 2 < r * r);
    const ends = [],
      strands = [],
      acc = [];
    for (const [d, i, j] of cands) {
      const p = [SX[i], SY[i]],
        q = [SX[j], SY[j]];
      if (!at(open, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2)) continue; // across a gap, not through ink or a bowl
      if (near(p[0], p[1], spots, every / 2) || near(q[0], q[1], spots, every / 2)) continue;
      // between two parts: a tie from a part to itself only closes a letter's notch or opening (a W's V, an E's arms)
      const a = partAt(...p),
        b = partAt(...q),
        mx = (p[0] + q[0]) / 2,
        my = (p[1] + q[1]) / 2;
      // (a tie from a part to itself, left out, still keeps its place: no tie moves in beside it)
      const own = a === b && !o.withinParts;
      if (near(mx, my, out, every)) continue;
      if (only && !near(mx, my, only, 2.5)) continue;
      if (near(p[0], p[1], ends, every) || near(q[0], q[1], ends, every)) continue;
      const ux = (q[0] - p[0]) / d,
        uy = (q[1] - p[1]) / d,
        nx = -uy,
        ny = ux;
      const two = [1, -1].map((g) => [
        p[0] + g * nx * H + ux * 0.2,
        p[1] + g * ny * H + uy * 0.2,
        q[0] + g * nx * H - ux * 0.2,
        q[1] + g * ny * H - uy * 0.2,
      ]);
      if (two.some((t) => crossesLine(...t))) continue;
      if (two.some((t) => strands.some((u) => meets(...t, ...u)))) continue;
      strands.push(...two);
      ends.push(p, q);
      if (own) continue;
      acc.push({ s: ss[i], p, q, d, u: [ux, uy], nrm: [nx, ny] });
    }
    if (!acc.length) return none;
    // splice: the line is cut a spacing wide where the tie leaves (c0 to c1), out from c0 along one strand, a short
    // step beside the far wall (half a bead off it, so the bead meets it), back along the other to c1, and on
    acc.sort((a, b) => a.s - b.s);
    const ox = [],
      oy = [];
    let e = 0,
      skipTo = -1,
      added = 0;
    const put = (x, y) => {
      ox.push(x / k);
      oy.push(y / k);
    };
    for (let i = 0; i < n; i++) {
      while (e < acc.length && S[i] > acc[e].s - H) {
        const T = acc[e],
          c0 = pointAt(T.s - H),
          c1 = pointAt(T.s + H),
          [nx, ny] = T.nrm,
          [ux, uy] = T.u,
          // the strand that starts at c0 ends on c0's side of the tie
          g = (c0[0] - T.p[0]) * nx + (c0[1] - T.p[1]) * ny >= 0 ? 1 : -1,
          qx = T.q[0] - ux * short,
          qy = T.q[1] - uy * short;
        put(...c0);
        put(qx + g * nx * H, qy + g * ny * H);
        put(qx - g * nx * H, qy - g * ny * H);
        put(...c1);
        skipTo = T.s + H;
        e++;
      }
      if (S[i] < skipTo) continue;
      put(X[i], Y[i]);
    }
    // the line added: its length now less its length before
    const lenOf = (A, B) => {
      let t = 0;
      for (let i = 1; i < A.length; i++) t += Math.hypot(A[i] - A[i - 1], B[i] - B[i - 1]);
      return t;
    };
    added = (lenOf(ox, oy) - lenOf(re, im)) * k;
    return {
      re: Float64Array.from(ox),
      im: Float64Array.from(oy),
      ties: acc.map((T) => [T.p[0] / k, T.p[1] / k, T.q[0] / k, T.q[1] / k]),
      count: acc.length,
      addedMM: added,
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
