/* Unbroken · engine · 02-lines.js
   2. Line maps — grayscale → a 1-pixel map of the lines to draw: centerline or outline, erasing.
   One part of the engine (no DOM), loaded after 01-image.js; core.js lists every part and what's in it. */
(function (root) {
  "use strict";
  const UNB = root.UNB,
    { labelComponents } = UNB._u; // shared helpers (00-util.js)

  // Outline mode: Canny edges (Sobel with an L1 gradient, as OpenCV's default threshold scale; non-maximum
  // suppression; hysteresis between lo and hi), thinned to 1 px so each edge becomes a single stroke.
  UNB.canny = function (g, w, h, lo, hi) {
    const N = w * h,
      mag = new Float32Array(N),
      dir = new Uint8Array(N);
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const gx = -g[i - w - 1] - 2 * g[i - 1] - g[i + w - 1] + g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1];
        const gy = -g[i - w - 1] - 2 * g[i - w] - g[i - w + 1] + g[i + w - 1] + 2 * g[i + w] + g[i + w + 1];
        mag[i] = Math.abs(gx) + Math.abs(gy);
        let a = (Math.atan2(gy, gx) * 180) / Math.PI;
        if (a < 0) a += 180;
        dir[i] = a < 22.5 || a >= 157.5 ? 0 : a < 67.5 ? 1 : a < 112.5 ? 2 : 3;
      }
    const nms = new Float32Array(N);
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x,
          m = mag[i];
        if (m < lo) continue;
        let a, b;
        switch (dir[i]) {
          case 0:
            a = mag[i - 1];
            b = mag[i + 1];
            break;
          case 1:
            a = mag[i - w - 1];
            b = mag[i + w + 1];
            break;
          case 2:
            a = mag[i - w];
            b = mag[i + w];
            break;
          default:
            a = mag[i - w + 1];
            b = mag[i + w - 1];
        }
        if (m >= a && m > b) nms[i] = m;
      }
    const out = new Uint8Array(N),
      stack = [];
    for (let i = 0; i < N; i++)
      if (nms[i] >= hi && !out[i]) {
        out[i] = 1;
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
              if (!out[q] && nms[q] >= lo) {
                out[q] = 1;
                stack.push(q);
              }
            }
        }
      }
    return UNB.thin(out, w, h); // make edges strictly 1px so each becomes a single stroke
  };

  // A line map → separate strokes, for a pen that can lift (the Line step's Separate strokes). Pixels are joined to their
  // 4 neighbours, and to a diagonal one only where neither pixel between them is set, so a corner isn't a little
  // triangle. Strokes run between ends and junctions; closed rings with neither are loops. Each is smoothed (ends and
  // junctions stay put) and simplified (tol px), shorter ones than minLen px are dropped, and they're put in an order
  // that keeps the pen's travel short (nearest next, either way round). Returns { strokes: [[x, y, …]], closed: [bool],
  // travel (px the pen moves up), length (px drawn) }.
  UNB.lineStrokes = function (lines, w, h, opt) {
    const o = opt || {},
      minLen = o.minLen || 0,
      tol = o.tol == null ? 0.35 : o.tol,
      N = w * h,
      on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && lines[y * w + x] > 0;
    const nbrs = (p) => {
      const x = p % w,
        y = (p / w) | 0,
        out = [];
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        if (on(x + dx, y + dy)) out.push(p + dy * w + dx);
      for (const [dx, dy] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ])
        if (on(x + dx, y + dy) && !on(x + dx, y) && !on(x, y + dy)) out.push(p + dy * w + dx);
      return out;
    };
    const deg = new Uint8Array(N),
      adj = new Map();
    for (let p = 0; p < N; p++)
      if (lines[p]) {
        const a = nbrs(p);
        adj.set(p, a);
        deg[p] = a.length;
      }
    const seen = new Set(),
      key = (a, b) => (a < b ? a * N + b : b * N + a);
    const walk = (p, q) => {
      const path = [p, q];
      seen.add(key(p, q));
      let prev = p,
        cur = q;
      while (deg[cur] === 2) {
        const next = adj.get(cur).find((r) => r !== prev && !seen.has(key(cur, r)));
        if (next === undefined) break;
        seen.add(key(cur, next));
        path.push(next);
        prev = cur;
        cur = next;
      }
      return path;
    };
    const raw = [];
    for (const [p, a] of adj)
      if (deg[p] !== 2) for (const q of a) if (!seen.has(key(p, q))) raw.push({ px: walk(p, q), closed: false });
    for (const [p, a] of adj)
      if (deg[p] === 2) for (const q of a) if (!seen.has(key(p, q))) raw.push({ px: walk(p, q), closed: true });
    // pixel paths → smoothed, simplified polylines
    const strokes = [],
      closed = [];
    let length = 0;
    for (const r of raw) {
      let n = r.px.length;
      if (r.closed && r.px[n - 1] === r.px[0]) n--;
      if (n < 2) continue;
      let x = new Float64Array(n),
        y = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        x[i] = r.px[i] % w;
        y[i] = (r.px[i] / w) | 0;
      }
      for (let pass = 0; pass < 2; pass++) {
        const nx = Float64Array.from(x),
          ny = Float64Array.from(y);
        for (let i = r.closed ? 0 : 1; i < (r.closed ? n : n - 1); i++) {
          const a = (i - 1 + n) % n,
            b = (i + 1) % n;
          nx[i] = (x[a] + 2 * x[i] + x[b]) / 4;
          ny[i] = (y[a] + 2 * y[i] + y[b]) / 4;
        }
        x = nx;
        y = ny;
      }
      let L = 0;
      for (let i = 1; i < n; i++) L += Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]);
      if (r.closed) L += Math.hypot(x[0] - x[n - 1], y[0] - y[n - 1]);
      if (L < minLen) continue;
      const sp = UNB.simplify(x, y, tol, r.closed);
      const flat = [];
      for (let i = 0; i < sp.x.length; i++) flat.push(sp.x[i], sp.y[i]);
      if (r.closed) flat.push(sp.x[0], sp.y[0]);
      strokes.push(flat);
      closed.push(r.closed);
      length += L;
    }
    // order: nearest next start or end (turned round to start there), from the top left
    const left = strokes.map((_, i) => i),
      order = [],
      orderClosed = [];
    let at = [0, 0],
      travel = 0;
    while (left.length) {
      let best = 0,
        bd = Infinity,
        rev = false;
      left.forEach((i, k) => {
        const s = strokes[i],
          d0 = (s[0] - at[0]) ** 2 + (s[1] - at[1]) ** 2,
          d1 = (s[s.length - 2] - at[0]) ** 2 + (s[s.length - 1] - at[1]) ** 2;
        if (d0 < bd) [bd, best, rev] = [d0, k, false];
        if (d1 < bd && !closed[i]) [bd, best, rev] = [d1, k, true];
      });
      const i = left.splice(best, 1)[0];
      let s = strokes[i];
      if (rev) {
        const t = [];
        for (let j = s.length - 2; j >= 0; j -= 2) t.push(s[j], s[j + 1]);
        s = t;
      }
      if (order.length) travel += Math.sqrt(bd);
      order.push(s);
      orderClosed.push(closed[i]);
      at = [s[s.length - 2], s[s.length - 1]];
    }
    return { strokes: order, closed: orderClosed, travel, length };
  };

  // Grey levels → a line map: the edges between levels (UNB.levels), for the levels whose edges are wanted (edge[j]
  // true: Trace). An edge is drawn where either side wants it, on the darker side's pixel, so every block's outline is
  // one pixel wide; thinned so the tracer sees single strokes. Edges along the picture's border aren't drawn.
  UNB.levelEdges = function (lab, w, h, edge) {
    const m = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x,
          a = lab[i];
        for (const j of [x + 1 < w ? i + 1 : -1, y + 1 < h ? i + w : -1]) {
          if (j < 0) continue;
          const b = lab[j];
          if (a === b || !(edge[a] || edge[b])) continue;
          m[a < b ? i : j] = 1;
        }
      }
    return UNB.thin(m, w, h);
  };

  // Otsu's threshold: the gray level (0–255) that best splits the image into ink and paper
  UNB.otsu = function (g) {
    const hist = new Float64Array(256);
    for (let i = 0; i < g.length; i++) hist[Math.max(0, Math.min(255, g[i] | 0))]++;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sB = 0,
      wB = 0,
      best = 0,
      thr = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (!wB) continue;
      const wF = g.length - wB;
      if (!wF) break;
      sB += t * hist[t];
      const mB = sB / wB,
        mF = (sum - sB) / wF,
        v = wB * wF * (mB - mF) * (mB - mF);
      if (v > best) {
        best = v;
        thr = t;
      }
    }
    return thr;
  };

  // Zhang–Suen thinning: a mask → its 1-px skeleton (works on a copy; the border row and column are cleared)
  UNB.thin = function (mask, w, h) {
    const m = Uint8Array.from(mask);
    for (let x = 0; x < w; x++) {
      m[x] = 0;
      m[(h - 1) * w + x] = 0;
    }
    for (let y = 0; y < h; y++) {
      m[y * w] = 0;
      m[y * w + w - 1] = 0;
    }
    let changed = true;
    const del = [];
    while (changed) {
      changed = false;
      for (let step = 0; step < 2; step++) {
        del.length = 0;
        for (let y = 1; y < h - 1; y++)
          for (let x = 1; x < w - 1; x++) {
            const i = y * w + x;
            if (!m[i]) continue;
            const p2 = m[i - w],
              p3 = m[i - w + 1],
              p4 = m[i + 1],
              p5 = m[i + w + 1],
              p6 = m[i + w],
              p7 = m[i + w - 1],
              p8 = m[i - 1],
              p9 = m[i - w - 1];
            const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
            if (B < 2 || B > 6) continue;
            const A =
              (!p2 && p3) +
              (!p3 && p4) +
              (!p4 && p5) +
              (!p5 && p6) +
              (!p6 && p7) +
              (!p7 && p8) +
              (!p8 && p9) +
              (!p9 && p2);
            if (A !== 1) continue;
            if (step === 0 ? (p2 && p4 && p6) || (p4 && p6 && p8) : (p2 && p4 && p8) || (p2 && p6 && p8)) continue;
            del.push(i);
          }
        if (del.length) {
          changed = true;
          for (const i of del) m[i] = 0;
        }
      }
    }
    return m;
  };

  // Centerline: threshold ink, skeletonize. Shapes too thick to be a drawn stroke (solid areas, dots)
  // are outlined instead, so filled regions in photos don't get a line through their middle.
  // Strokes drawn closer than the blur can resolve merge into one wide band of "ink"; split (default 0.1) cuts such
  // bands along their light valleys — pixels lighter than both neighbours across them by split × the ink↔paper
  // contrast — but only in regions where the cut leaves thin strokes, so texture inside a filled area never punches
  // holes in it. split = 0 turns this off.
  UNB.centerline = function (g, w, h, bias, maxStroke, spur, split) {
    if (spur === undefined) spur = 1.5; // prune side branches up to spur × stroke width
    if (split === undefined) split = 0.1;
    const N = w * h,
      thr = UNB.otsu(g) + (bias || 0);
    const ink = new Uint8Array(N);
    for (let i = 0; i < N; i++) ink[i] = g[i] < thr ? 1 : 0;
    const limit = (maxStroke || Math.max(6, 0.016 * Math.max(w, h))) / 2;
    const stats = (m) => {
      // per component: area, skeleton length, median half-width on the skeleton
      const bg = new Uint8Array(N);
      for (let i = 0; i < N; i++) bg[i] = 1 - m[i];
      const skel = UNB.thin(m, w, h),
        half = UNB.edt(bg, w, h).dist,
        { lab, n } = labelComponents(m, w, h); // half: distance to paper = half the stroke width
      const area = new Int32Array(n),
        sk = new Int32Array(n),
        ws = Array.from({ length: n }, () => []);
      for (let i = 0; i < N; i++)
        if (lab[i] >= 0) {
          area[lab[i]]++;
          if (skel[i]) {
            sk[lab[i]]++;
            ws[lab[i]].push(half[i]);
          }
        }
      const med = ws.map((a) => (a.sort((p, q) => p - q), a.length ? a[a.length >> 1] : 0));
      return { lab, n, area, sk, med, skel, half };
    };
    if (split > 0) {
      let a = 0,
        na = 0,
        b = 0,
        nb = 0;
      for (let i = 0; i < N; i++)
        if (ink[i]) {
          a += g[i];
          na++;
        } else {
          b += g[i];
          nb++;
        }
      const delta = Math.max(6, split * (b / Math.max(1, nb) - a / Math.max(1, na)));
      const sep = new Uint8Array(N),
        D = [
          [1, 0],
          [0, 1],
          [1, 1],
          [1, -1],
        ];
      for (let y = 2; y < h - 2; y++)
        for (let x = 2; x < w - 2; x++) {
          const i = y * w + x;
          if (!ink[i]) continue;
          const v = g[i];
          let hit = false;
          for (const [dx, dy] of D) {
            for (let d = 1; d <= 2 && !hit; d++) {
              const o = d * (dy * w + dx);
              if (v - g[i - o] >= delta && v - g[i + o] >= delta) hit = true;
            }
            if (hit) break;
          }
          if (hit) sep[i] = 1;
        }
      const sc = labelComponents(sep, w, h),
        ssz = new Int32Array(sc.n);
      for (let i = 0; i < N; i++) if (sc.lab[i] >= 0) ssz[sc.lab[i]]++;
      let any = 0;
      for (let i = 0; i < N; i++)
        if (sep[i]) {
          if (ssz[sc.lab[i]] < 8) sep[i] = 0;
          else any = 1;
        } // specks aren't gaps between strokes
      if (any) {
        const before = labelComponents(ink, w, h),
          cut = ink.slice();
        for (let i = 0; i < N; i++) if (sep[i]) cut[i] = 0;
        const sp = stats(cut),
          thin = new Float64Array(before.n),
          rest = new Int32Array(before.n),
          has = new Uint8Array(before.n);
        for (let i = 0; i < N; i++) {
          const c = before.lab[i];
          if (c < 0) continue;
          if (sep[i]) {
            has[c] = 1;
            continue;
          }
          rest[c]++;
          const s2 = sp.lab[i];
          if (s2 >= 0 && sp.med[s2] <= limit && sp.sk[s2] >= 15) thin[c]++;
        }
        for (let i = 0; i < N; i++) {
          const c = before.lab[i];
          if (sep[i] && c >= 0 && has[c] && thin[c] >= 0.8 * rest[c]) ink[i] = 0;
        } // the cut leaves strokes: keep it
      }
    }
    const { lab, n, area, sk, med, skel, half } = stats(ink);
    const outline = new Uint8Array(n);
    for (let c = 0; c < n; c++) if ((sk[c] < 40 && area[c] > 30) || med[c] > limit) outline[c] = 1;
    for (let i = 0; i < N; i++) {
      const L = lab[i];
      if (L < 0 || !outline[L]) continue;
      skel[i] = 0;
      const x = i % w,
        y = (i / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || !ink[i - 1] || !ink[i + 1] || !ink[i - w] || !ink[i + w])
        skel[i] = 1;
    }
    const out = UNB.thin(skel, w, h);
    return spur > 0
      ? UNB.pruneSpurs(out, w, h, (j) => Math.max(3, spur * 2 * half[j]), Math.max(64, spur * 2 * limit + 2))
      : out; // kept strokes are at most 2 × limit wide
  };

  // Remove short side branches ("spurs") from a 1px skeleton: a run from a loose end to a junction that is no
  // longer than limit(junctionIndex) px. Each spur would otherwise become a small out-and-back bump in the line.
  // maxLen (default 64): stop following a run after this many px — no limit() answer can be larger than it.
  UNB.pruneSpurs = function (skel, w, h, limit, maxLen) {
    if (!(maxLen > 0)) maxLen = 64;
    const m = Uint8Array.from(skel),
      N8 = [-w - 1, -w, -w + 1, 1, w + 1, w, w - 1, -1];
    const at = (i, k) => {
      const x = (i % w) + [-1, 0, 1, 1, 1, 0, -1, -1][k],
        y = ((i / w) | 0) + [-1, -1, -1, 0, 1, 1, 1, 0][k];
      return x >= 0 && y >= 0 && x < w && y < h && m[i + N8[k]] ? i + N8[k] : -1;
    };
    const nb = (i) => {
      const out = [];
      for (let k = 0; k < 8; k++) {
        const j = at(i, k);
        if (j >= 0) out.push(j);
      }
      return out;
    };
    const branches = (i) => {
      let t = 0;
      for (let k = 0; k < 8; k++) if (at(i, k) < 0 && at(i, (k + 1) % 8) >= 0) t++;
      return t;
    };
    const ends = [];
    for (let i = 0; i < w * h; i++) if (m[i] && nb(i).length === 1) ends.push(i);
    let removed = 0;
    for (const e of ends) {
      if (!m[e]) continue;
      const path = [e],
        inPath = new Set(path);
      let cur = e,
        junction = -1,
        len = 0;
      for (;;) {
        const next = nb(cur).filter((j) => !inPath.has(j));
        if (!next.length) break; // isolated piece: leave it to the speck filter
        const j = next.find((q) => Math.abs(q - cur) === 1 || Math.abs(q - cur) === w) ?? next[0];
        len += Math.abs(j - cur) === 1 || Math.abs(j - cur) === w ? 1 : Math.SQRT2;
        if (branches(j) >= 3) {
          junction = j;
          break;
        }
        if (len > maxLen) break;
        path.push(j);
        inPath.add(j);
        cur = j;
      }
      if (junction >= 0 && len <= limit(junction)) {
        for (const p of path) m[p] = 0;
        removed += path.length;
      }
    }
    return removed ? UNB.thin(m, w, h) : m;
  };

  // Erase: brush strokes wipe line pixels; a tap removes the whole connected piece nearest to it. Coordinates in
  // working px.
  UNB.erase = function (lines, w, h, ops) {
    for (const op of ops) {
      if (op.type === "brush") {
        const r = op.r,
          r2 = r * r;
        for (let k = 0; k < op.pts.length; k++) {
          const [ax, ay] = op.pts[k],
            [bx, by] = op.pts[Math.min(k + 1, op.pts.length - 1)];
          const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / Math.max(1, r / 2)));
          for (let t = 0; t <= steps; t++) {
            const cx = ax + ((bx - ax) * t) / steps,
              cy = ay + ((by - ay) * t) / steps;
            for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(h - 1, Math.ceil(cy + r)); y++)
              for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(w - 1, Math.ceil(cx + r)); x++)
                if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) lines[y * w + x] = 0;
          }
        }
      } else {
        const R = op.r || 14;
        let best = -1,
          bd = R * R;
        for (let y = Math.max(0, Math.floor(op.y - R)); y <= Math.min(h - 1, Math.ceil(op.y + R)); y++)
          for (let x = Math.max(0, Math.floor(op.x - R)); x <= Math.min(w - 1, Math.ceil(op.x + R)); x++) {
            const i = y * w + x,
              d = (x - op.x) ** 2 + (y - op.y) ** 2;
            if (lines[i] && d <= bd) {
              bd = d;
              best = i;
            }
          }
        if (best < 0) continue;
        const st = [best];
        lines[best] = 0;
        while (st.length) {
          const p = st.pop(),
            x = p % w,
            y = (p / w) | 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx,
                yy = y + dy;
              if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
              const q = yy * w + xx;
              if (lines[q]) {
                lines[q] = 0;
                st.push(q);
              }
            }
        }
      }
    }
    return lines;
  };

  // Quality of a line map for auto-threshold: long, few, and sitting on strong gradients. Pieces under minPix px are
  // ignored. Returns L (line px), P (pieces), align (mean gradient under the lines).
  UNB.lineScore = function (lines, grad, w, h, minPix) {
    const { lab, n } = labelComponents(lines, w, h);
    const size = new Int32Array(n);
    for (let i = 0; i < w * h; i++) if (lab[i] >= 0) size[lab[i]]++;
    let L = 0,
      P = 0,
      G = 0;
    for (let c = 0; c < n; c++)
      if (size[c] >= minPix) {
        L += size[c];
        P++;
      }
    for (let i = 0; i < w * h; i++) if (lab[i] >= 0 && size[lab[i]] >= minPix) G += grad[i];
    return { L, P, align: L ? G / L : 0 };
  };
})(typeof window !== "undefined" ? window : globalThis);
