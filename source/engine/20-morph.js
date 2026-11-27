/* Unbroken · engine · 20-morph.js
   19. Morphs — a vase whose shape from above changes into another up the wall (a heart into a letter, a star into a
   flower): pairing the two outlines corner to corner, keeping each lap in between printable, a font for the rim (one
   capital letter, ! or ?, as one closed outline from the Chocolate font's own letters), and the check that finds a
   turn that prints and says which way up is better and how tall it needs to be. The vase (17-vase.js) reads it
   through UNB.morphPair and UNB.morphKeepApart, and only when the rim shape asks (planTop.match "corners",
   planTop.keepApart): without this part, or without those, a vase is as before.
   One part of the engine (no DOM), loaded after 19-relief.js; core.js lists every part and what's in it.
   Found on 26–27 November 2026 (docs/MORPH-PLAN.md, source/bench/morph-trial/): of four ways to pair the shapes
   (even shares, through a circle, a distance-field melt, corners), only corners with the laps kept apart printed a
   heart into a traced "NV"; the melt's holes open and close between letters, so its laps jump. */
(function (root) {
  "use strict";
  const UNB = root.UNB,
    { label4, plotLine, isoContours, resampleLoop } = UNB._u; // shared helpers (00-util.js)

  // ---------- pairing the two outlines ----------
  // planTop.match: "even" (by share of the way round, both from where the outline crosses +x: the vase as before) or
  // "corners": the rim's outline turned to sit best over the bottom's, then each point paired by dynamic time warping
  // on position and turning angle, so a heart's lobes go to a letter's arms and its dip to a notch. planTop.turn
  // (degrees): the rim's shape turned against the bottom's first (either pairing).
  const MORPH_N = 720,
    morphCache = new Map();
  // turning angle at N points round a plan (signed, radians, over about a degree's share either side)
  function morphTurning(T, N, rot, sampleAt) {
    const P = [],
      w = Math.max(2, Math.round(N / 180)),
      c = Math.cos(rot),
      sn = Math.sin(rot);
    for (let i = 0; i < N; i++) {
      const [x, y] = sampleAt(T, i / N);
      P.push([x * c - y * sn, x * sn + y * c]);
    }
    const k = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const a = P[(i - w + N) % N],
        b = P[i],
        q = P[(i + w) % N];
      let d = Math.atan2(q[1] - b[1], q[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]);
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      k[i] = d;
    }
    return { P, k };
  }
  // The pairing: W[i] (i = 0 … N) the share round B paired with share i / N round A, rising, W[N] = W[0] + 1.
  // 1. the offset round B whose points sit nearest A's; 2. dynamic time warping within a band about that offset
  // (a few offsets either side tried), costing distance² + 0.08 × (turning angle difference)², with a small charge
  // for every step that isn't along both; 3. the warp's offset smoothed over 2/15 of the way round (a B's two slits tangled at 1/20), kept rising.
  function morphWarp(A, B, turnDeg, sampleAt) {
    const key = `${A ? A.key : "circle"}>${B ? B.key : "circle"}>${turnDeg}`;
    let R = morphCache.get(key);
    if (R) return R;
    const N = MORPH_N,
      lam = 0.08,
      pen = 0.005,
      band = Math.round(N * 0.18),
      W2 = 2 * band + 1,
      a = morphTurning(A, N, 0, sampleAt),
      b = morphTurning(B, N, (turnDeg * Math.PI) / 180, sampleAt);
    let o0 = 0,
      bc = Infinity;
    for (let o = 0; o < N; o++) {
      let s = 0;
      for (let i = 0; i < N; i += 2) {
        const p = a.P[i],
          q = b.P[(i + o) % N];
        s += (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
      }
      if (s < bc) {
        bc = s;
        o0 = o;
      }
    }
    const cost = (i, j) => {
      const ii = i % N,
        jj = ((j % N) + N) % N,
        p = a.P[ii],
        q = b.P[jj],
        dk = a.k[ii] - b.k[jj];
      return (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + lam * dk * dk;
    };
    const D = new Float64Array((N + 1) * W2),
      from = new Int8Array((N + 1) * W2);
    let best = null,
      bestC = Infinity;
    for (let dd = -3; dd <= 3; dd++) {
      const o = o0 + Math.round((dd * N) / 72);
      D.fill(Infinity);
      from.fill(0);
      D[band] = 0;
      // cell (i, q): A's point i paired with B's point i + o + (q − band)
      for (let i = 0; i <= N; i++)
        for (let q = 0; q < W2; q++) {
          if (i === 0 && q === band) continue;
          const j = i + q - band;
          if (j < 0 || j > N) continue;
          let m = Infinity,
            f = 0;
          if (i > 0 && D[(i - 1) * W2 + q] < m) {
            m = D[(i - 1) * W2 + q];
            f = 1; // along both
          }
          if (i > 0 && q + 1 < W2 && D[(i - 1) * W2 + q + 1] < m) {
            m = D[(i - 1) * W2 + q + 1];
            f = 2; // along A only
          }
          if (q > 0 && D[i * W2 + q - 1] < m) {
            m = D[i * W2 + q - 1];
            f = 3; // along B only
          }
          if (m < Infinity) {
            D[i * W2 + q] = m + (f === 1 ? cost(i, j + o) : 0.5 * cost(i, j + o) + pen);
            from[i * W2 + q] = f;
          }
        }
      const end = D[N * W2 + band];
      if (end < bestC) {
        bestC = end;
        const sum = new Float64Array(N + 1),
          cnt = new Float64Array(N + 1);
        let i = N,
          q = band;
        while (i > 0 || q !== band) {
          sum[i] += i + q - band + o;
          cnt[i]++;
          const f = from[i * W2 + q];
          if (f === 1) i--;
          else if (f === 2) {
            i--;
            q++;
          } else if (f === 3) q--;
          else break;
        }
        sum[0] += o;
        cnt[0]++;
        best = Array.from(sum, (v, k) => (cnt[k] ? v / cnt[k] : k + o));
      }
    }
    const off = best.map((j, i) => j - i),
      W = new Float64Array(N + 1),
      K = Math.round(N / 15);
    for (let i = 0; i <= N; i++) {
      let v = 0;
      for (let d = -K; d <= K; d++) v += off[(((i + d) % N) + N) % N];
      W[i] = (i + v / (2 * K + 1)) / N;
    }
    for (let i = 1; i <= N; i++) W[i] = Math.max(W[i], W[i - 1] + 0.05 / N);
    const err = W[N] - (W[0] + 1);
    for (let i = 0; i <= N; i++) W[i] -= (err * i) / N;
    // and the share round A at even steps of the two shares together ((sA + sB) / 2), so a lap sampled at those
    // steps keeps both outlines' detail: where the pairing crowds much of B into a little of A (a letter's serif
    // onto a heart's side), A's even steps would sample B too sparsely and cut its corners
    const c = new Float64Array(N + 1),
      U = new Float64Array(N + 1);
    for (let i = 0; i <= N; i++) c[i] = (i / N + W[i] - W[0]) / 2;
    for (let k = 0, i = 0; k <= N; k++) {
      const u = k / N;
      while (i < N - 1 && c[i + 1] < u) i++;
      U[k] = (i + (u - c[i]) / Math.max(1e-12, c[i + 1] - c[i])) / N;
    }
    R = { W, U, N, offset: o0 / N };
    if (morphCache.size > 12) morphCache.clear();
    morphCache.set(key, R);
    return R;
  }
  // share round A for the lap's point at share u of the morph's even steps
  function morphShare(Mo, u) {
    const v = (((u % 1) + 1) % 1) * Mo.N,
      i = Math.floor(v),
      f = v - i;
    return Mo.U[i] + f * (Mo.U[Math.min(Mo.N, i + 1)] - Mo.U[i]);
  }
  // share round B paired with share s round A
  function morphWarpAt(Mo, s) {
    const u = (((s % 1) + 1) % 1) * Mo.N,
      i = Math.floor(u),
      f = u - i;
    return Mo.W[i] + f * (Mo.W[Math.min(Mo.N, i + 1)] - Mo.W[i]);
  }
  // How the rim's plan B pairs with the bottom's plan A for vase V (sampleAt(T, s): a plan's point at share s, from
  // 17-vase.js). Returns null (even shares, not turned: as before) or { share(u) (A's share for the lap's point u),
  // pair(s) (B's share for A's share s), turn, c, s (the turn's cos and sin) }.
  UNB.morphPair = function (V, A, B, sampleAt) {
    const P = V.planTop || {},
      turn = +P.turn || 0,
      corners = P.match === "corners";
    if (!corners && !turn) return null;
    const Mo = { turn, c: Math.cos((turn * Math.PI) / 180), s: Math.sin((turn * Math.PI) / 180) };
    if (corners) {
      const R = morphWarp(A, B, turn, sampleAt);
      Mo.share = (u) => morphShare(R, u);
      Mo.pair = (s) => morphWarpAt(R, s);
    }
    return Mo;
  };

  // ---------- keeping a lap printable ----------
  // Keep a lap's parts apart: where a lap in the middle of a morph crosses itself or two of its parts (more than ~3
  // spacings apart along it) come closer than the spacing d, untangle it the way a traced line is (UNB.uncross,
  // UNB.enforceSpacing at 0.95 d, so a traced rim's own gaps, made at d, aren't touched). Each lap is a little
  // different from the one below, so the pushes are too, and the laps still stack. x, y: the lap (closed; changed in
  // place). Returns how far a point moved (mm, 0: nothing needed), and whether it crossed.
  UNB.morphKeepApart = function (x, y, d) {
    const n = x.length;
    if (!(d > 0) || n < 16) return { moved: 0, crossed: false };
    // (evenly along its length first: the spacing tools count neighbours in points, and a morph's points crowd
    // where one outline's detail is paired with little of the other)
    const cum = new Float64Array(n + 1);
    for (let i = 1; i <= n; i++) cum[i] = cum[i - 1] + Math.hypot(x[i % n] - x[i - 1], y[i % n] - y[i - 1]);
    const ex = new Float64Array(n),
      ey = new Float64Array(n);
    for (let i = 0, j = 0; i < n; i++) {
      const sv = (i / n) * cum[n];
      while (j < n - 1 && cum[j + 1] < sv) j++;
      const f = (sv - cum[j]) / Math.max(1e-12, cum[j + 1] - cum[j]),
        b = (j + 1) % n;
      ex[i] = x[j] + f * (x[b] - x[j]);
      ey[i] = y[j] + f * (y[b] - y[j]);
    }
    const crossed = UNB.findCrossings(ex, ey, true).length > 0,
      pinched = !crossed && UNB.closestGap(ex, ey, 0.95 * d, true) < 0.95 * d;
    let rx = ex,
      ry = ey;
    if (crossed || pinched) {
      let u = crossed ? UNB.uncross(ex, ey, true, {}) : { re: ex, im: ey };
      const sp = UNB.enforceSpacing(u.re, u.im, 0.95 * d, 20, true); // (20 rounds: as good as 80 on every letter morph tried, in half the time)
      u = UNB.uncross(sp.re, sp.im, true, {});
      rx = Float64Array.from(u.re);
      ry = Float64Array.from(u.im);
    }
    // turns tighter than 0.36 of the spacing (a little over half a bead) rounded off: in the middle of a morph a narrow
    // part of one outline paired with little of the other folds into a sharp kink that the bead can't follow
    const rounded = morphRoundTight(rx, ry, 0.36 * d);
    if (!crossed && !pinched && !rounded) return { moved: 0, crossed: false };
    let moved = 0;
    for (let i = 0; i < n; i++) {
      if (!crossed) moved = Math.max(moved, Math.hypot(rx[i] - ex[i], ry[i] - ey[i]));
      x[i] = rx[i];
      y[i] = ry[i];
    }
    return { moved: crossed ? Math.max(moved, d) : Math.max(moved, 1e-9), crossed };
  };
  // Round off turns tighter than rmin (mm) on a closed line evenly spaced (changed in place): each point whose turn
  // (the circle through it and the points about 0.3 mm either side) is tighter is eased towards its neighbours, with
  // the points round it, until none is (at most 300 rounds, each looking again only near the last). Returns whether anything moved.
  function morphRoundTight(x, y, rmin) {
    const n = x.length;
    let len = 0;
    for (let i = 0; i < n; i++) len += Math.hypot(x[(i + 1) % n] - x[i], y[(i + 1) % n] - y[i]);
    const g = Math.max(1, Math.round((0.3 * n) / Math.max(len, 1e-9))),
      at = (i) => ((i % n) + n) % n,
      R = (i) => {
        const a = at(i - g),
          c = at(i + g),
          ax = x[a] - x[i],
          ay = y[a] - y[i],
          cx = x[c] - x[i],
          cy = y[c] - y[i],
          cr = Math.abs(ax * cy - ay * cx);
        return cr < 1e-12
          ? Infinity
          : (Math.hypot(ax, ay) * Math.hypot(cx, cy) * Math.hypot(cx - ax, cy - ay)) / (2 * cr);
      };
    // (only near the tight points: each round eases those and their neighbours, then looks again just there, so a
    // drawing whose own corners are tight costs its corners, not its whole length, every round)
    let tight = [];
    for (let i = 0; i < n; i++) if (R(i) < rmin) tight.push(i);
    const any = tight.length > 0;
    for (let pass = 0; pass < 300 && tight.length; pass++) {
      const mark = new Set();
      for (const i of tight) for (let k = -g; k <= g; k++) mark.add(at(i + k));
      const idx = [...mark],
        nx = idx.map((i) => x[i] + 0.5 * ((x[at(i - 1)] + x[at(i + 1)]) / 2 - x[i])),
        ny = idx.map((i) => y[i] + 0.5 * ((y[at(i - 1)] + y[at(i + 1)]) / 2 - y[i]));
      idx.forEach((i, k) => {
        x[i] = nx[k];
        y[i] = ny[k];
      });
      const near = new Set();
      for (const i of idx) for (let k = -g; k <= g; k++) near.add(at(i + k));
      tight = [...near].filter((i) => R(i) < rmin);
    }
    return any;
  }

  // ---------- the morph font: one capital, ! or ?, as one closed outline ----------
  // The Chocolate font's letters are choc OS print paths: hairline outlines of solid letters. Drawn on a fine grid
  // and flooded from outside, everything the flood can't reach is the letter, so choc OS's shapes and stroke width
  // stay. A counter (O, A, B …) gets a straight slit to the outside where choc OS's own thin opening is (the shortest
  // way, the bottom preferred, if there isn't one), so the line goes in, round it and out again; one too small to
  // print round is filled. Pieces (the dots of ! and ?) join their letter with a neck; corners are rounded to the
  // bead. G is redrawn without the bar into its bowl, which tangled every morph; "." and "-" are drawn here (the
  // Chocolate font's "." is empty and its "-" a full-height block). Only these characters morph cleanly as one
  // character on a 20 mm morph out of every built-in shape and a heart (27 November 2026); words don't yet.
  UNB.MORPH_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ!?";
  function morphGlyphs(f) {
    const pts = (P) => P.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join(" ");
    const vstad = (x, y0, y1, r, k = 12) => {
      const P = [];
      for (let i = 0; i <= k; i++) {
        const a = Math.PI + (Math.PI * i) / k;
        P.push([x + r * Math.cos(a), y0 + r * Math.sin(a)]);
      }
      for (let i = 0; i <= k; i++) {
        const a = (Math.PI * i) / k;
        P.push([x + r * Math.cos(a), y1 + r * Math.sin(a)]);
      }
      P.push(P[0]);
      return pts(P);
    };
    const out = {};
    // G: the C with its lower end turned up into a short upright (font units, cap 700, y up)
    if (f.glyphs.C) out.G = [613, f.glyphs.C[1] + "|" + vstad(497, 95, 330, 63)];
    return out;
  }
  // ch: one character (UNB.MORPH_CHARS); font: the Chocolate font (UNB_FONTS.chocolate, from fonts.js). opt (mm unless
  // noted): cap (letter height, 20), d (line spacing: slits, necks and rounding follow it), slit (× d, 1.7), neck
  // (× d, 1.5), round (× d, 1), g (grid, 0.06). Returns { x, y } (the outline, mm, y up, closed, anticlockwise,
  // evenly every 0.15 mm), loops (how many outlines it came to: 1), slits, filled; or null.
  UNB.morphLetter = function (ch, font, opt) {
    const o = opt || {},
      d = o.d || 1.34,
      cap = o.cap || 20,
      ws = (o.slit || 1.7) * d,
      neck = (o.neck || 1.5) * d,
      rc = (o.round || 1) * d,
      F = Object.assign({}, font, { glyphs: Object.assign({}, font.glyphs, morphGlyphs(font)) });
    if (!ch || !F.glyphs[ch]) return null;
    const lay = UNB.textLayout(ch, F, {
      cap,
      join: false,
      dots: "keep",
      spacing: "even",
      gap: 1.6 * d,
      word: 0.6 * cap,
    });
    if (!lay.strokes.length) return null;
    const g = o.g || Math.min(0.06, cap / 250),
      pad = 3 * d,
      w = Math.ceil((lay.width + 2 * pad) / g),
      h = Math.ceil((lay.height + 2 * pad) / g),
      N = w * h,
      P = (v) => (v + pad) / g;
    const fat = (m, r) => {
      const D = UNB.edt(m, w, h).dist,
        out = new Uint8Array(N),
        rr = r / g;
      for (let i = 0; i < N; i++) out[i] = D[i] <= rr ? 1 : 0;
      return out;
    };
    const thin = (m, r) => {
      const inv = new Uint8Array(N);
      for (let i = 0; i < N; i++) inv[i] = 1 - m[i];
      const D = UNB.edt(inv, w, h).dist,
        out = new Uint8Array(N),
        rr = r / g;
      for (let i = 0; i < N; i++) out[i] = D[i] > rr ? 1 : 0;
      return out;
    };
    // 1. the letter: its hairlines flooded from outside
    const line = new Uint8Array(N);
    for (const st of lay.strokes) {
      for (let i = 2; i < st.length; i += 2) plotLine(line, w, h, P(st[i - 2]), P(st[i - 1]), P(st[i]), P(st[i + 1]));
      if (st.length === 2) plotLine(line, w, h, P(st[0]), P(st[1]), P(st[0]), P(st[1]));
    }
    const B0 = label4(w, h, (q) => line[q] === 0);
    let ink = new Uint8Array(N);
    for (let i = 0; i < N; i++) ink[i] = B0.lab[i] === B0.lab[0] ? 0 : 1;
    const outsideFine = Uint8Array.from(ink, (v) => 1 - v),
      base = P(lay.baselines[0].y),
      bandTop = base - (0.35 * cap) / g,
      stats = { slits: 0, filled: 0, joins: 0 };
    const bar = (i, j) => {
      const L = new Uint8Array(N);
      plotLine(L, w, h, i % w, Math.floor(i / w), j % w, Math.floor(j / w));
      const add = fat(L, neck / 2);
      for (let k = 0; k < N; k++) ink[k] |= add[k];
    };
    // 2. pieces joined: a dot straight down to the piece under it; otherwise left to right, as low as it goes
    const joinAll = () => {
      for (let guard = 0; guard < 40; guard++) {
        const L = label4(w, h, (q) => ink[q] === 1);
        if (L.count <= 1) return;
        const info = Array.from({ length: L.count }, () => ({ n: 0, x0: w, x1: 0, y0: h, y1: 0 }));
        for (let i = 0; i < N; i++) {
          const l = L.lab[i];
          if (l < 0) continue;
          const I = info[l],
            x = i % w,
            y = Math.floor(i / w);
          I.n++;
          I.x0 = Math.min(I.x0, x);
          I.x1 = Math.max(I.x1, x);
          I.y0 = Math.min(I.y0, y);
          I.y1 = Math.max(I.y1, y);
        }
        const med = info.map((I) => I.n).sort((a, b) => a - b)[Math.floor(L.count / 2)];
        let a = info.findIndex((I) => I.n < 0.25 * med && I.y1 < bandTop),
          b,
          band = false;
        if (a >= 0) {
          const cx = (info[a].x0 + info[a].x1) / 2;
          b = info
            .map((I, k) => [
              k,
              k !== a && I.x0 <= cx + 4 && I.x1 >= cx - 4 && I.y0 > info[a].y0 ? I.y0 - info[a].y1 : Infinity,
            ])
            .sort((p, q) => p[1] - q[1])[0][0];
        } else {
          const order = info.map((I, k) => [k, (I.x0 + I.x1) / 2]).sort((p, q) => p[1] - q[1]);
          a = order[0][0];
          b = order[1][0];
          band = true;
        }
        const mA = new Uint8Array(N);
        for (let i = 0; i < N; i++) mA[i] = L.lab[i] === a && (!band || Math.floor(i / w) >= bandTop) ? 1 : 0;
        const E = UNB.edt(mA, w, h);
        let best = Infinity,
          bi = -1;
        for (let i = 0; i < N; i++)
          if (L.lab[i] === b && (!band || Math.floor(i / w) >= bandTop)) {
            const sc = E.dist[i] + (band ? 1.5 * Math.max(0, base - Math.floor(i / w)) : 0);
            if (sc < best) {
              best = sc;
              bi = i;
            }
          }
        if (bi < 0)
          for (let i = 0; i < N; i++)
            if (L.lab[i] === b && E.dist[i] < best) {
              best = E.dist[i];
              bi = i;
            }
        if (bi < 0) return;
        bar(bi, E.near[bi]);
        stats.joins++;
      }
    };
    // 3. counters: slit open (choc OS's own opening, straightened; else the shortest way) or filled
    const cutLine = (ax, ay, bx, by) => {
      const Lz = Math.hypot(bx - ax, by - ay) || 1,
        ux = (bx - ax) / Lz,
        uy = (by - ay) / Lz,
        ext = ws / g,
        M = new Uint8Array(N);
      plotLine(M, w, h, ax - ux * ext, ay - uy * ext, bx + ux * ext, by + uy * ext);
      return fat(M, ws / 2);
    };
    const holes = () => {
      for (let guard = 0; guard < 40; guard++) {
        const B = label4(w, h, (q) => ink[q] === 0),
          outside = B.lab[0];
        let hole = -1;
        for (let i = 0; i < N; i++)
          if (B.lab[i] >= 0 && B.lab[i] !== outside) {
            hole = B.lab[i];
            break;
          }
        if (hole < 0) return;
        const holeM = new Uint8Array(N),
          notHole = new Uint8Array(N);
        for (let i = 0; i < N; i++) {
          holeM[i] = B.lab[i] === hole ? 1 : 0;
          notHole[i] = 1 - holeM[i];
        }
        const Din = UNB.edt(notHole, w, h).dist;
        let deep = 0,
          y0 = h,
          y1 = 0;
        for (let i = 0; i < N; i++)
          if (holeM[i]) {
            deep = Math.max(deep, Din[i]);
            const y = Math.floor(i / w);
            y0 = Math.min(y0, y);
            y1 = Math.max(y1, y);
          }
        if (deep * g < 0.6 * d) {
          for (let i = 0; i < N; i++) if (holeM[i]) ink[i] = 1;
          stats.filled++;
          continue;
        }
        // choc OS's opening: the fine outside the rounding closed, touching this counter; slit straight from where
        // it meets the outside to the counter's nearest point
        const ch = new Uint8Array(N);
        for (let i = 0; i < N; i++) ch[i] = outsideFine[i] && ink[i] ? 1 : 0;
        const near = fat(holeM, 2 * g),
          C = label4(w, h, (q) => ch[q] === 1),
          touch = new Set();
        for (let i = 0; i < N; i++) if (ch[i] && near[i]) touch.add(C.lab[i]);
        let done = false;
        if (touch.size) {
          let mx = 0,
            my = 0,
            mn = 0;
          for (let i = w; i < N - w; i++)
            if (
              ch[i] &&
              touch.has(C.lab[i]) &&
              (B.lab[i - 1] === outside ||
                B.lab[i + 1] === outside ||
                B.lab[i - w] === outside ||
                B.lab[i + w] === outside)
            ) {
              mx += i % w;
              my += Math.floor(i / w);
              mn++;
            }
          if (mn) {
            mx /= mn;
            my /= mn;
            let bh = -1,
              bd = Infinity;
            for (let i = 0; i < N; i++)
              if (holeM[i]) {
                const dd = Math.hypot((i % w) - mx, Math.floor(i / w) - my);
                if (dd < bd) {
                  bd = dd;
                  bh = i;
                }
              }
            const cut = cutLine(mx, my, bh % w, Math.floor(bh / w)),
              trial = Uint8Array.from(ink);
            for (let i = 0; i < N; i++) if (cut[i]) trial[i] = 0;
            const T = label4(w, h, (q) => trial[q] === 0);
            if (T.lab[bh] === T.lab[0]) {
              ink = trial;
              done = true;
            }
          }
        }
        if (!done) {
          const om = new Uint8Array(N);
          for (let i = 0; i < N; i++) om[i] = B.lab[i] === outside ? 1 : 0;
          const E = UNB.edt(om, w, h);
          let best = Infinity,
            bi = -1;
          for (let i = w; i < N - w; i++) {
            if (!holeM[i] || !(ink[i - 1] || ink[i + 1] || ink[i - w] || ink[i + w])) continue;
            const below = (Math.floor(i / w) - y0) / Math.max(1, y1 - y0),
              sc = E.dist[i] * (1 + 0.5 * (1 - below));
            if (sc < best) {
              best = sc;
              bi = i;
            }
          }
          if (bi < 0) {
            for (let i = 0; i < N; i++) if (holeM[i]) ink[i] = 1;
            stats.filled++;
            continue;
          }
          const bj = E.near[bi],
            cut = cutLine(bi % w, Math.floor(bi / w), bj % w, Math.floor(bj / w));
          for (let i = 0; i < N; i++) if (cut[i]) ink[i] = 0;
        }
        stats.slits++;
      }
    };
    // 4. corners rounded: opened (outside corners), then closed (inside corners, gaps narrower than a bead)
    const roundIt = () => {
      ink = fat(thin(ink, rc), rc);
      const cr = Math.min(0.48 * d, 0.45 * ws);
      ink = thin(fat(ink, cr), cr);
    };
    joinAll();
    {
      const cr = 0.48 * d;
      ink = thin(fat(ink, cr), cr);
    }
    holes();
    roundIt();
    joinAll();
    holes();
    roundIt();
    joinAll();
    holes();
    // 5. the outline: marching squares on a lightly blurred copy, smoothed along its length
    const sm = new Float32Array(N),
      K = 2;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let v = 0,
          c = 0;
        for (let dy = -K; dy <= K; dy++)
          for (let dx = -K; dx <= K; dx++) {
            const X = x + dx,
              Y = y + dy;
            if (X >= 0 && Y >= 0 && X < w && Y < h) {
              v += ink[Y * w + X];
              c++;
            }
          }
        sm[y * w + x] = v / c;
      }
    const loops = isoContours(
      sm,
      new Int32Array(N),
      0,
      0.5,
      w,
      h,
      { x0: [1], y0: [1], x1: [w - 2], y1: [h - 2] },
      -pad,
      -pad,
      g
    );
    if (!loops.length) return null;
    loops.sort((p, q) => q.length - p.length);
    let L = resampleLoop(loops[0], 0.15);
    const sig = (0.3 * d) / 0.15,
      R = Math.ceil(2.5 * sig),
      wt = [];
    let wsum = 0;
    for (let k = -R; k <= R; k++) wsum += wt[k + R] = Math.exp(-(k * k) / (2 * sig * sig));
    const n = L.length;
    L = L.map((_, i) => {
      let x = 0,
        y = 0;
      for (let k = -R; k <= R; k++) {
        const p = L[(i + k + n) % n];
        x += wt[k + R] * p[0];
        y += wt[k + R] * p[1];
      }
      return [x / wsum, -y / wsum]; // (y up)
    });
    let A = 0;
    for (let i = 0; i < n; i++) A += L[i][0] * L[(i + 1) % n][1] - L[(i + 1) % n][0] * L[i][1];
    if (A < 0) L.reverse();
    return { x: L.map((p) => p[0]), y: L.map((p) => p[1]), loops: loops.length, ...stats };
  };

  // ---------- the check: a turn that prints, which way up, how tall ----------
  // How far a morph is from printing: the step a lap takes past what a bead holds (out, and in past it), how much
  // closer than 0.9 spacings two parts of a lap still come, and a fifth of how much more than two spacings a point had
  // to be moved to keep them apart. 0 prints; under 0.05 is counted as printing.
  UNB.MORPH_TURNS = [0, 20, -20, 45, -45, 90, 180];
  function morphBad(R, o) {
    const hold = o.overhang || (o.w || 0.8) / 3,
      d = Math.max(o.w || 0.8, o.d || 0),
      m = R.morph || { closest: Infinity, moved: 0 };
    return (
      Math.max(0, R.overhang.worst - hold) +
      R.overhang.inWorst +
      Math.max(0, 0.9 * d - m.closest) +
      0.2 * Math.max(0, m.moved - 2 * d)
    );
  }
  const morphFlip = (V) =>
    Object.assign({}, V, {
      plan: Object.assign({}, V.planTop, { match: undefined, keepApart: undefined, turn: undefined }),
      planTop: Object.assign({}, V.plan, {
        match: V.planTop.match,
        keepApart: V.planTop.keepApart,
        turn: V.planTop.turn,
      }),
      profile: V.profile.map(([t, r]) => [1 - t, r]).reverse(),
      blend: V.blend ? V.blend.map(([t, k]) => [1 - t, 1 - k]).reverse() : null,
    });
  // Generator (yields { done, of } after each try). V: a vase with a rim shape; opt: as UNB.vaseStack's (w, d, h, z0,
  // overhang). Tries the rim's turn as set and then UNB.MORPH_TURNS (opt.turns), stopping at the first that prints;
  // if none does, the vase the other way up too. Returns { ok, turn, bad, worst, inWorst, closest, needH (mm: the
  // height the best try would print at, from steps that scale with 1 ÷ height; 0 when it prints), cut (true: stopped
  // trying turns after opt.budget ms), flip (null, or
  // { ok, turn, bad }: the other way up, tried only when this way doesn't print) }.
  UNB.morphCheck = function* (V, opt) {
    const o = Object.assign({}, opt, { base: 0 }),
      hold = o.overhang || (o.w || 0.8) / 3,
      set = (V.planTop && +V.planTop.turn) || 0,
      turns = [set].concat((o.turns || UNB.MORPH_TURNS).filter((t) => t !== set)),
      of = turns.length * 2;
    let done = 0;
    const tryOne = (W, turn) => {
      const X = Object.assign({}, W, { planTop: Object.assign({}, W.planTop, { turn }) }),
        it = UNB.vaseStack(X, o);
      let r;
      while (!(r = it.next()).done);
      const R = r.value;
      return {
        turn,
        bad: morphBad(R, o),
        worst: R.overhang.worst,
        inWorst: R.overhang.inWorst,
        closest: R.morph ? R.morph.closest : Infinity,
      };
    };
    // (a detailed outline makes each try slow: after opt.budget ms (20 s) no more turns are tried, and the answer
    // says so: cut)
    const t0 = Date.now(),
      budget = o.budget || 20000;
    let best = null,
      cut = false;
    for (const t of turns) {
      if (best && Date.now() - t0 > budget) {
        cut = true;
        break;
      }
      const r = tryOne(V, t);
      yield { done: ++done, of };
      if (!best || r.bad < best.bad) best = r;
      if (r.bad < 0.05) break;
    }
    const ok = best.bad < 0.05,
      scale = Math.max(1, best.worst / hold, (best.inWorst + hold) / hold),
      res = Object.assign({ ok, needH: ok ? 0 : Math.ceil(V.height * scale), flip: null, cut }, best);
    if (!ok && !cut) {
      const F = morphFlip(V);
      let fb = null;
      for (const t of turns) {
        const r = tryOne(F, t);
        yield { done: ++done, of };
        if (!fb || r.bad < fb.bad) fb = r;
        if (r.bad < 0.05) break;
      }
      res.flip = { ok: fb.bad < 0.05, turn: fb.turn, bad: fb.bad };
    }
    return res;
  };
})(typeof window !== "undefined" ? window : globalThis);
