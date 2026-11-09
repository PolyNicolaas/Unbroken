/* Unbroken · engine · 15-cutout.js
   14. Cutting out an object — a box drawn round the thing to keep (and strokes marking more of it, or what isn't it)
   → a mask of the object. GrabCut (Rother, Kolmogorov and Blake, 2004): colour models of the object and of its
   surroundings, then the cheapest cut between them along the picture's edges (a max-flow), repeated a few times.
   One part of the engine (no DOM), loaded after 14-photo.js; core.js lists every part and what's in it. */
(function (root) {
  "use strict";
  const UNB = root.UNB,
    { labelComponents } = UNB._u; // shared helpers (00-util.js)

  // ---------- colour models: a mix of a few Gaussians in RGB ----------
  // k clusters (k-means from spread-out starts) of the pixels idx, each a Gaussian with a full 3 × 3 covariance
  function fitMix(R, G, B, idx, k) {
    const n = idx.length;
    if (!n) return [];
    // a sample is plenty for the clusters
    const step = Math.max(1, Math.floor(n / 6000)),
      S = [];
    for (let i = 0; i < n; i += step) S.push(idx[i]);
    k = Math.min(k, S.length);
    // starts: the farthest-point spread (each new start the sample farthest from those so far)
    const cen = [[R[S[0]], G[S[0]], B[S[0]]]],
      near = new Float64Array(S.length).fill(Infinity);
    while (cen.length < k) {
      const c = cen[cen.length - 1];
      let far = 0,
        at = 0;
      for (let j = 0; j < S.length; j++) {
        const p = S[j],
          d = (R[p] - c[0]) ** 2 + (G[p] - c[1]) ** 2 + (B[p] - c[2]) ** 2;
        if (d < near[j]) near[j] = d;
        if (near[j] > far) ((far = near[j]), (at = j));
      }
      cen.push([R[S[at]], G[S[at]], B[S[at]]]);
    }
    const lab = new Int32Array(S.length);
    for (let it = 0; it < 6; it++) {
      const sum = cen.map(() => [0, 0, 0, 0]);
      for (let j = 0; j < S.length; j++) {
        const p = S[j];
        let best = Infinity,
          bi = 0;
        for (let c = 0; c < cen.length; c++) {
          const d = (R[p] - cen[c][0]) ** 2 + (G[p] - cen[c][1]) ** 2 + (B[p] - cen[c][2]) ** 2;
          if (d < best) ((best = d), (bi = c));
        }
        lab[j] = bi;
        const s = sum[bi];
        s[0] += R[p];
        s[1] += G[p];
        s[2] += B[p];
        s[3]++;
      }
      for (let c = 0; c < cen.length; c++)
        if (sum[c][3]) cen[c] = [sum[c][0] / sum[c][3], sum[c][1] / sum[c][3], sum[c][2] / sum[c][3]];
    }
    // each cluster's Gaussian: weight, mean, inverse covariance and log normaliser
    const out = [];
    for (let c = 0; c < cen.length; c++) {
      let m = 0;
      const mu = [0, 0, 0],
        C = [0, 0, 0, 0, 0, 0]; // xx xy xz yy yz zz
      for (let j = 0; j < S.length; j++)
        if (lab[j] === c) {
          const p = S[j];
          m++;
          mu[0] += R[p];
          mu[1] += G[p];
          mu[2] += B[p];
        }
      if (!m) continue;
      mu[0] /= m;
      mu[1] /= m;
      mu[2] /= m;
      for (let j = 0; j < S.length; j++)
        if (lab[j] === c) {
          const p = S[j],
            a = R[p] - mu[0],
            b = G[p] - mu[1],
            d = B[p] - mu[2];
          C[0] += a * a;
          C[1] += a * b;
          C[2] += a * d;
          C[3] += b * b;
          C[4] += b * d;
          C[5] += d * d;
        }
      for (let i = 0; i < 6; i++) C[i] /= m;
      C[0] += 12; // (a floor under the variance: a flat colour, camera grain)
      C[3] += 12;
      C[5] += 12;
      const [a, b, d, e, f, g] = C,
        det = a * (e * g - f * f) - b * (b * g - f * d) + d * (b * f - e * d);
      const inv = [
        (e * g - f * f) / det,
        (d * f - b * g) / det,
        (b * f - d * e) / det,
        (a * g - d * d) / det,
        (b * d - a * f) / det,
        (a * e - b * b) / det,
      ];
      out.push({
        w: m / S.length,
        mu,
        inv,
        logn: Math.log(m / S.length) - 0.5 * Math.log(Math.max(1e-9, det)) - 2.757,
      });
    }
    return out;
  }
  // −log of the mix's density at a colour
  function mixCost(M, r, g, b) {
    let best = -Infinity,
      sum = 0;
    const L = new Float64Array(M.length);
    for (let c = 0; c < M.length; c++) {
      const { mu, inv, logn } = M[c],
        x = r - mu[0],
        y = g - mu[1],
        z = b - mu[2];
      const q =
        inv[0] * x * x + inv[3] * y * y + inv[5] * z * z + 2 * (inv[1] * x * y + inv[2] * x * z + inv[4] * y * z);
      L[c] = logn - 0.5 * q;
      if (L[c] > best) best = L[c];
    }
    for (let c = 0; c < M.length; c++) sum += Math.exp(L[c] - best);
    return -(best + Math.log(sum));
  }

  // ---------- the cut: max-flow on the pixel grid (Dinic) ----------
  // A graph of n nodes plus a source (n) and a sink (n + 1); edges in pairs (e, e ^ 1).
  function makeFlow(n, edges) {
    const head = new Int32Array(n + 2).fill(-1),
      to = new Int32Array(edges),
      nxt = new Int32Array(edges),
      cap = new Float64Array(edges);
    let m = 0;
    const add = (u, v, c, rc) => {
      to[m] = v;
      cap[m] = c;
      nxt[m] = head[u];
      head[u] = m++;
      to[m] = u;
      cap[m] = rc;
      nxt[m] = head[v];
      head[v] = m++;
    };
    const run = () => {
      const S = n,
        T = n + 1,
        N = n + 2,
        level = new Int32Array(N),
        it = new Int32Array(N),
        q = new Int32Array(N),
        stack = new Int32Array(N),
        via = new Int32Array(N);
      for (let phase = 0; phase < 2000; phase++) {
        level.fill(-1);
        level[S] = 0;
        let qh = 0,
          qt = 0;
        q[qt++] = S;
        while (qh < qt) {
          const u = q[qh++];
          for (let e = head[u]; e >= 0; e = nxt[e])
            if (cap[e] > 1e-9 && level[to[e]] < 0) {
              level[to[e]] = level[u] + 1;
              q[qt++] = to[e];
            }
        }
        if (level[T] < 0) break;
        for (let u = 0; u < N; u++) it[u] = head[u];
        // augmenting paths along the levels, depth first with an explicit stack
        for (;;) {
          let sp = 0,
            u = S;
          stack[sp++] = S;
          while (u !== T && sp) {
            let e = it[u];
            while (e >= 0 && !(cap[e] > 1e-9 && level[to[e]] === level[u] + 1)) e = nxt[e];
            it[u] = e;
            if (e < 0) {
              // a dead end: back up
              level[u] = -1;
              sp--;
              if (!sp) break;
              u = stack[sp - 1];
              it[u] = nxt[it[u]];
              continue;
            }
            via[to[e]] = e;
            u = to[e];
            stack[sp++] = u;
          }
          if (u !== T) break;
          let f = Infinity;
          for (let v = T; v !== S; v = to[via[v] ^ 1]) f = Math.min(f, cap[via[v]]);
          for (let v = T; v !== S; v = to[via[v] ^ 1]) {
            cap[via[v]] -= f;
            cap[via[v] ^ 1] += f;
          }
        }
      }
      // the source's side of the cut: reachable from it in what's left
      const side = new Uint8Array(n);
      level.fill(-1);
      let qh = 0,
        qt = 0;
      q[qt++] = S;
      level[S] = 0;
      while (qh < qt) {
        const u = q[qh++];
        if (u < n) side[u] = 1;
        for (let e = head[u]; e >= 0; e = nxt[e])
          if (cap[e] > 1e-9 && level[to[e]] < 0) {
            level[to[e]] = 0;
            q[qt++] = to[e];
          }
      }
      return side;
    };
    return { add, run };
  }

  // a stroke's pixels (a polyline [x0, y0, x1, y1, …] px, radius r), marked v in L
  function markStroke(L, w, h, pts, r, v) {
    const dot = (cx, cy) => {
      for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(h - 1, Math.ceil(cy + r)); y++)
        for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(w - 1, Math.ceil(cx + r)); x++)
          if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) L[y * w + x] = v;
    };
    for (let i = 0; i < pts.length; i += 2) {
      if (i === 0) dot(pts[0], pts[1]);
      else {
        const x0 = pts[i - 2],
          y0 = pts[i - 1],
          x1 = pts[i],
          y1 = pts[i + 1],
          n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / Math.max(1, r / 2)));
        for (let k = 1; k <= n; k++) dot(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n);
      }
    }
  }

  // Cut out the object. rgba w × h; o: box [x0, y0, x1, y1] px (the object is inside it; outside is background),
  // keep and drop (strokes [[x, y, x, y, …]…] px: more of the object, or not the object; a stroke can be { pts, r }
  // with its own radius), brush (the radius of strokes without one, px), side (the longest side worked at, px; default
  // 240), rounds (default 4). Returns { mask (Uint8Array 0/1, mw ×
  // mh), mw, mh, k (mask px per picture px), share (the object's share of the box) }.
  UNB.cutout = function (rgba, w, h, o = {}) {
    const side = o.side || 240,
      k = Math.min(1, side / Math.max(w, h)),
      mw = Math.max(4, Math.round(w * k)),
      mh = Math.max(4, Math.round(h * k)),
      N = mw * mh;
    // the picture at the working size (box averages)
    const R = new Float32Array(N),
      G = new Float32Array(N),
      B = new Float32Array(N),
      cnt = new Float32Array(N);
    for (let y = 0; y < h; y++) {
      const my = Math.min(mh - 1, Math.floor((y * mh) / h));
      for (let x = 0; x < w; x++) {
        const c = my * mw + Math.min(mw - 1, Math.floor((x * mw) / w)),
          i = 4 * (y * w + x),
          a = rgba[i + 3] / 255;
        R[c] += rgba[i] * a + 255 * (1 - a);
        G[c] += rgba[i + 1] * a + 255 * (1 - a);
        B[c] += rgba[i + 2] * a + 255 * (1 - a);
        cnt[c]++;
      }
    }
    for (let i = 0; i < N; i++) {
      R[i] /= cnt[i] || 1;
      G[i] /= cnt[i] || 1;
      B[i] /= cnt[i] || 1;
    }
    // what's fixed: outside the box and the drop strokes are background (2), the keep strokes the object (1)
    const fixed = new Uint8Array(N),
      bx = o.box || [0, 0, w, h],
      x0 = Math.max(0, Math.floor(Math.min(bx[0], bx[2]) * k)),
      y0 = Math.max(0, Math.floor(Math.min(bx[1], bx[3]) * k)),
      x1 = Math.min(mw, Math.ceil(Math.max(bx[0], bx[2]) * k)),
      y1 = Math.min(mh, Math.ceil(Math.max(bx[1], bx[3]) * k));
    for (let y = 0; y < mh; y++)
      for (let x = 0; x < mw; x++) if (x < x0 || x >= x1 || y < y0 || y >= y1) fixed[y * mw + x] = 2;
    // (a stroke is its points, drawn with the brush, or { pts, r }: its points and its own radius, px)
    const cutStroke = (s, v) => {
      const pts = Array.isArray(s) ? s : s.pts,
        r = Math.max(1.5, ((!Array.isArray(s) && s.r > 0 ? s.r : o.brush) || 12) * k);
      markStroke(
        fixed,
        mw,
        mh,
        pts.map((q) => q * k),
        r,
        v
      );
    };
    for (const s of o.keep || []) cutStroke(s, 1);
    for (const s of o.drop || []) cutStroke(s, 2);
    // a box that covers the whole picture leaves no background to learn from: a band along its edge counts as
    // background
    // then (a photo's edges are nearly always background)
    let bgSeen = 0;
    for (let i = 0; i < N; i++) if (fixed[i] === 2) bgSeen++;
    if (bgSeen < N * 0.02) {
      const t = Math.max(2, Math.round(Math.min(mw, mh) * 0.04));
      for (let y = 0; y < mh; y++)
        for (let x = 0; x < mw; x++)
          if ((x < x0 + t || x >= x1 - t || y < y0 + t || y >= y1 - t) && !fixed[y * mw + x]) fixed[y * mw + x] = 2;
    }
    // the edges between neighbours: cheap to cut where the colour changes (β from the picture's own contrast)
    const NB = [
      [1, 0],
      [0, 1],
      [1, 1],
      [-1, 1],
    ];
    let sum = 0,
      count = 0;
    for (let y = 0; y < mh; y++)
      for (let x = 0; x < mw; x++)
        for (const [dx, dy] of NB) {
          const X = x + dx,
            Y = y + dy;
          if (X < 0 || X >= mw || Y >= mh) continue;
          const p = y * mw + x,
            q = Y * mw + X;
          sum += (R[p] - R[q]) ** 2 + (G[p] - G[q]) ** 2 + (B[p] - B[q]) ** 2;
          count++;
        }
    const beta = 1 / (2 * Math.max(1, sum / Math.max(1, count))),
      gamma = 50;
    // start: the object is inside the box (where not fixed)
    let lab = new Uint8Array(N);
    for (let i = 0; i < N; i++) lab[i] = fixed[i] === 2 ? 0 : 1;
    const rounds = o.rounds || 4,
      HARD = 1e9;
    for (let round = 0; round < rounds; round++) {
      const fg = [],
        bg = [];
      for (let i = 0; i < N; i++) (lab[i] ? fg : bg).push(i);
      if (!fg.length || !bg.length) break;
      const MF = fitMix(R, G, B, fg, 5),
        MB = fitMix(R, G, B, bg, 5);
      const F = makeFlow(N, 2 * (N + 4 * N));
      for (let i = 0; i < N; i++) {
        let toS, toT; // cost of the pixel being background (cut from the source) / being the object
        if (fixed[i] === 1) ((toS = HARD), (toT = 0));
        else if (fixed[i] === 2) ((toS = 0), (toT = HARD));
        else {
          toS = mixCost(MB, R[i], G[i], B[i]);
          toT = mixCost(MF, R[i], G[i], B[i]);
          const m = Math.min(toS, toT); // (only the difference matters)
          toS -= m;
          toT -= m;
        }
        if (toS > 0) F.add(N, i, toS, 0);
        if (toT > 0) F.add(i, N + 1, toT, 0);
      }
      for (let y = 0; y < mh; y++)
        for (let x = 0; x < mw; x++)
          for (const [dx, dy] of NB) {
            const X = x + dx,
              Y = y + dy;
            if (X < 0 || X >= mw || Y >= mh) continue;
            const p = y * mw + x,
              q = Y * mw + X,
              d2 = (R[p] - R[q]) ** 2 + (G[p] - G[q]) ** 2 + (B[p] - B[q]) ** 2,
              wgt = (gamma / Math.hypot(dx, dy)) * Math.exp(-beta * d2);
            F.add(p, q, wgt, wgt);
          }
      lab = F.run();
    }
    // tidy: only the parts of the object that touch a keep stroke (or the biggest one), and its holes filled
    const { lab: parts, n } = labelComponents(lab, mw, mh);
    if (n > 1) {
      const size = new Int32Array(n),
        kept = new Uint8Array(n);
      for (let i = 0; i < N; i++)
        if (parts[i] >= 0) {
          size[parts[i]]++;
          if (fixed[i] === 1) kept[parts[i]] = 1;
        }
      let big = 0;
      for (let c = 1; c < n; c++) if (size[c] > size[big]) big = c;
      kept[big] = 1;
      // (and any part at least a fifth of the biggest: a second object in the box)
      for (let c = 0; c < n; c++) if (size[c] >= size[big] * 0.2) kept[c] = 1;
      for (let i = 0; i < N; i++) if (parts[i] >= 0 && !kept[parts[i]]) lab[i] = 0;
    }
    const out = new Uint8Array(N);
    for (let i = 0; i < N; i++) out[i] = lab[i] ? 0 : 1;
    const holes = labelComponents(out, mw, mh),
      edge = new Uint8Array(holes.n);
    for (let y = 0; y < mh; y++)
      for (let x = 0; x < mw; x++) {
        const c = holes.lab[y * mw + x];
        if (c >= 0 && (x === 0 || y === 0 || x === mw - 1 || y === mh - 1 || fixed[y * mw + x] === 2)) edge[c] = 1;
      }
    for (let i = 0; i < N; i++) if (holes.lab[i] >= 0 && !edge[holes.lab[i]]) lab[i] = 1;
    let inBox = 0,
      obj = 0;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        inBox++;
        obj += lab[y * mw + x];
      }
    return { mask: lab, mw, mh, k, share: obj / Math.max(1, inBox) };
  };
})(typeof window !== "undefined" ? window : globalThis);
