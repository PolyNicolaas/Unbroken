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
  // the most characters a morph's word may have (27 November 2026: 4-letter words print 125 mm tall out of a heart, a
  // star, a pebble or the Moore pattern; 5 and more don't, at any height: docs/DIMENSIONS-PLAN.md §7)
  UNB.MORPH_MAX = 4;
  // over two lines (a "\n" between them), touching, one under the other and centred: up to 5 letters print, with solid
  // letters (HAP/PY out of a pebble, a heart or MOM; 6 don't: CHE/ERS, THA/NKS)
  UNB.MORPH_MAX2 = 5;
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
  // ch: one character, or a word of up to UNB.MORPH_MAX (UNB.MORPH_CHARS); font: the Chocolate font (UNB_FONTS.chocolate,
  // from fonts.js) or a morph font. opt (mm unless noted): cap (letter height, 20), d (line spacing: slits, necks and
  // rounding follow it), slit (× d, 1.7), neck (× d, 1.5), round (× d, 1), g (grid, 0.06; coarser for a long word),
  // solid (every counter filled, no slits: an O is a solid shape; what makes word to word print). Returns { x, y }
  // (the outline, mm, y up, closed, anticlockwise, evenly every 0.15 mm), loops (how many outlines it came to: 1),
  // slits, filled; or null.
  UNB.morphLetter = function (ch, font, opt) {
    const o = opt || {},
      d = o.d || 1.34,
      cap = o.cap || 20,
      ws = (o.slit || 1.7) * d,
      neck = (o.neck || 1.5) * d,
      rc = (o.round || 1) * d,
      F = Object.assign({}, font, { glyphs: Object.assign({}, font.glyphs, morphGlyphs(font)) });
    const lines = String(ch || "").split("\n"),
      count = lines.join("").length;
    if (!count || lines.length > 2 || lines.some((l) => !l) || count > (lines.length > 1 ? UNB.MORPH_MAX2 : UNB.MORPH_MAX))
      return null;
    if ([...lines.join("")].some((c) => !F.glyphs[c])) return null;
    // (two lines touch: the second's capitals just overlap the first's baseline, so the letters meet)
    const lay = UNB.textLayout(ch, F, {
      cap,
      join: false,
      dots: "keep",
      spacing: "even",
      gap: 1.6 * d,
      word: 0.6 * cap,
      lineGap: 0.98,
      align: "center",
    });
    if (!lay.strokes.length) return null;
    const g = o.g || Math.max(Math.min(0.06, cap / 250), (lay.width + 6 * d) / 1600),
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
        if (o.solid || deep * g < 0.6 * d) {
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

  // ---------- basic shapes, for the bottom or the top ----------
  // Outlines that morph, each one drawn and approved by eye (27 November 2026; the drawings: source/bench/morph-trial/
  // shapes/): a closed loop of points about 40 units across (y up), simplified to 0.03. They needn't be symmetric. The
  // square, triangle, pentagon and hexagon are regular, every corner rounded 2.5 units. UNB.morphShape(key) → { x, y }
  // (40 mm across its widest) or null; UNB.MORPH_SHAPES lists them { key: name }, in the order they're offered.
  const MS = {
    square: ["Square", "14.14,11.64 14.03,12.38 13.84,12.84 13.55,13.25 13.19,13.6 12.77,13.87 12.31,14.05 11.81,14.14 -11.71,14.14 -12.44,14.01 -12.9,13.8 -13.3,13.51 -13.64,13.14 -13.9,12.72 -14.07,12.25 -14.14,11.5 -14.14,-11.77 -13.99,-12.5 -13.77,-12.95 -13.47,-13.35 -13.09,-13.68 -12.66,-13.93 -12.19,-14.08 -11.44,-14.14 11.83,-14.13 12.32,-14.05 12.79,-13.87 13.39,-13.43 13.71,-13.04 13.95,-12.6 14.1,-12.13 14.14,-11.63"],
    triangle: ["Triangle", "2.17,16.25 1.87,16.66 1.3,17.13 0.61,17.42 -0.13,17.5 -0.86,17.35 -1.31,17.13 -1.71,16.83 -2.17,16.24 -15.27,-6.47 -15.43,-6.95 -15.49,-7.44 -15.39,-8.18 -15.21,-8.64 -14.94,-9.06 -14.39,-9.57 -13.72,-9.89 -12.98,-10 12.99,-10 13.49,-9.95 14.19,-9.69 14.6,-9.41 15.09,-8.85 15.4,-8.17 15.49,-7.43 15.36,-6.7 15.15,-6.24"],
    pentagon: ["Pentagon", "1.47,18.93 0.81,19.28 0.07,19.41 -0.67,19.32 -1.35,19.01 -17.55,7.25 -18.08,6.72 -18.44,6.06 -18.58,5.33 -18.5,4.59 -12.32,-14.45 -12.12,-14.91 -11.65,-15.5 -11.26,-15.8 -10.81,-16.02 -10.33,-16.15 -9.83,-16.18 10.19,-16.17 10.68,-16.07 11.35,-15.74 11.9,-15.23 12.27,-14.58 18.46,4.45 18.58,5.19 18.48,5.93 18.16,6.61 17.66,7.16"],
    hexagon: ["Hexagon", "19.28,-1.25 19.55,-0.56 19.61,0.19 19.52,0.68 19.21,1.36 10.59,16.28 10.26,16.65 9.64,17.07 9.17,17.24 8.68,17.32 -8.56,17.32 -9.05,17.27 -9.75,17.02 -10.35,16.56 -10.79,15.96 -19.28,1.25 -19.55,0.56 -19.61,0.06 -19.57,-0.44 -19.34,-1.14 -10.72,-16.07 -10.26,-16.65 -9.86,-16.95 -9.41,-17.17 -8.68,-17.32 8.56,-17.32 9.05,-17.27 9.75,-17.02 10.17,-16.73 10.66,-16.17"],
    heart: ["Heart", "0.73,6 0.92,6.13 1.86,7.69 2.76,8.87 3.83,9.9 4.83,10.62 5.48,10.98 6.16,11.28 7.33,11.64 8.55,11.8 9.78,11.74 10.5,11.6 11.21,11.39 12.31,10.86 12.92,10.45 13.48,9.97 14.29,9.05 14.93,8 15.21,7.32 15.42,6.62 15.61,5.4 15.63,4.66 15.57,3.92 15.45,3.19 15.26,2.48 15.02,1.77 14.62,0.86 14.14,-0.01 13.6,-0.84 12.36,-2.41 11.16,-3.68 9.52,-5.21 3.95,-9.85 1.72,-11.85 0.84,-12.73 0.01,-13.66 -1.6,-15.81 -1.79,-15.98 -1.97,-16.03 -2.14,-15.94 -2.31,-15.72 -3.03,-14.43 -3.71,-13.4 -4.33,-12.62 -5.15,-11.69 -6.93,-9.93 -12.12,-5.25 -13.68,-3.62 -14.77,-2.26 -15.32,-1.44 -15.8,-0.57 -16.11,0.11 -16.43,1.05 -16.6,1.77 -16.73,2.75 -16.75,3.49 -16.7,4.23 -16.59,4.96 -16.42,5.68 -16.18,6.38 -15.77,7.28 -14.98,8.54 -14.51,9.12 -13.83,9.83 -13.27,10.33 -12.48,10.92 -11.85,11.32 -10.96,11.77 -10.28,12.06 -9.33,12.36 -8.61,12.52 -7.87,12.61 -7.13,12.65 -6.39,12.62 -5.66,12.53 -4.94,12.36 -4.24,12.13 -3.56,11.83 -2.92,11.46 -2.32,11.03 -1.43,10.18 -0.96,9.61 -0.55,8.99 -0.1,8.12 0.57,6.18"],
    star: ["Star", "-2.76,18.29 -3.01,18.21 -3.35,17.96 -3.88,17.22 -4.55,15.79 -6.04,12.12 -6.73,10.54 -7.43,9.29 -8.15,8.4 -9.03,7.66 -10.27,6.96 -11.84,6.28 -15.99,4.66 -17.37,4 -17.93,3.58 -18.18,3.24 -18.25,2.87 -18.21,2.61 -18.1,2.33 -17.68,1.76 -16.92,0.99 -12.97,-2.35 -11.89,-3.35 -11.11,-4.23 -10.49,-5.2 -10.07,-6.27 -9.79,-7.66 -9.64,-9.13 -9.39,-13.58 -9.24,-14.93 -9.11,-15.5 -8.93,-15.97 -8.68,-16.3 -8.47,-16.44 -8.22,-16.5 -7.78,-16.48 -6.91,-16.17 -5.72,-15.52 -2.15,-13.3 -0.67,-12.43 0.64,-11.85 1.75,-11.57 2.9,-11.51 4.07,-11.64 5.51,-11.95 9.59,-13.02 10.96,-13.34 11.96,-13.46 12.46,-13.42 12.73,-13.34 13.03,-13.11 13.22,-12.76 13.29,-12.29 13.26,-11.73 12.98,-10.2 11.91,-5.87 11.61,-4.43 11.47,-3.01 11.55,-1.87 11.86,-0.76 12.47,0.53 13.22,1.8 15.63,5.54 16.29,6.72 16.6,7.58 16.62,8.01 16.55,8.26 16.41,8.47 16.07,8.72 15.22,9 13.66,9.2 9.21,9.52 7.75,9.68 6.37,9.99 5.31,10.43 4.35,11.07 3.31,12.05 2.19,13.36 -0.47,16.61 -1.39,17.6 -2.11,18.14 -2.51,18.29"],
    pebble: ["Pebble", "19.66,3.58 19.37,4.79 18.83,6.19 18.11,7.5 17.38,8.51 16.54,9.43 15.42,10.42 14.19,11.28 12.87,12 11.49,12.58 10.07,13.04 8.61,13.38 6.88,13.62 5.13,13.73 3.38,13.7 1.64,13.55 -0.09,13.29 -2.04,12.86 -3.96,12.31 -5.84,11.64 -7.91,10.75 -9.69,9.84 -11.41,8.82 -13.06,7.7 -14.63,6.45 -15.91,5.26 -17.08,3.97 -18.12,2.56 -18.86,1.26 -19.41,-0.13 -19.69,-1.34 -19.76,-2.59 -19.66,-3.58 -19.32,-4.78 -18.77,-5.89 -18.05,-6.91 -17.02,-7.99 -15.85,-8.93 -14.59,-9.73 -13.03,-10.53 -11.41,-11.19 -9.51,-11.8 -7.57,-12.28 -5.6,-12.62 -3.62,-12.84 -1.62,-12.95 0.63,-12.91 2.62,-12.75 4.6,-12.47 6.31,-12.1 8.23,-11.55 9.87,-10.95 11.46,-10.22 12.98,-9.36 14.22,-8.51 15.38,-7.56 16.45,-6.51 17.4,-5.36 18.23,-4.11 18.9,-2.77 19.33,-1.6 19.64,-0.39 19.82,1.09 19.82,2.34"],
    crescent: ["Crescent", "0.47,-19.97 2.25,-19.86 4.22,-19.54 6.15,-19.02 8.02,-18.31 9.81,-17.42 11.29,-16.5 12.88,-15.29 14.35,-13.92 15.66,-12.42 16.83,-10.79 17.82,-9.06 18.54,-7.47 19.2,-5.58 19.61,-3.88 19.9,-1.9 19.99,0.1 19.88,2.09 19.57,4.07 19.14,5.76 18.47,7.64 17.62,9.45 16.58,11.16 15.54,12.57 14.21,14.06 12.74,15.41 11.34,16.46 9.64,17.51 8.07,18.29 6.21,19 4.28,19.53 2.3,19.86 0.54,19.98 0.5,19.96 1.63,19.63 2.3,19.3 3.12,18.73 3.85,18.05 4.65,17.1 5.35,16.06 5.96,14.97 6.59,13.61 7.12,12.21 7.58,10.78 7.96,9.33 8.36,7.37 8.63,5.64 8.82,3.9 8.96,1.91 9,-0.1 8.96,-1.84 8.83,-3.84 8.61,-5.83 8.33,-7.56 8.03,-9.03 7.59,-10.72 7.06,-12.39 6.51,-13.79 5.87,-15.14 5.25,-16.22 4.54,-17.25 3.71,-18.19 2.97,-18.85 2.13,-19.39 1.46,-19.7"],
    cloud: ["Cloud", "22.95,0 22.88,0.99 22.6,2.2 22.1,3.33 21.57,4.17 20.74,5.09 20.16,5.57 19.55,5.98 18.43,6.52 16.8,6.99 16.24,7.28 16.11,7.42 15.9,7.78 15.29,9.63 14.64,10.97 13.8,12.21 12.78,13.3 12.02,13.95 11.2,14.51 10.32,14.98 9.4,15.37 8.45,15.66 7.47,15.86 6.48,15.96 5.49,15.96 4.5,15.85 3.52,15.65 2.33,15.27 1.43,14.86 0.78,14.49 -0.05,13.93 -0.81,13.28 -1.85,12.26 -2.39,11.9 -3.02,11.81 -4.47,11.94 -5.22,11.96 -6.45,11.83 -7.18,11.66 -8.12,11.32 -8.79,11 -9.63,10.47 -10.22,10.01 -10.76,9.5 -11.25,8.94 -11.81,8.12 -12.17,7.46 -12.46,6.78 -12.69,6.07 -12.97,4.89 -13.22,4.35 -13.35,4.23 -13.69,4.07 -15.32,3.8 -16.03,3.59 -16.49,3.4 -17.14,3.05 -17.75,2.62 -18.29,2.12 -18.62,1.74 -19.05,1.14 -19.3,0.71 -19.67,-0.21 -19.89,-1.18 -19.95,-1.92 -19.93,-2.41 -19.78,-3.39 -19.47,-4.33 -19.01,-5.21 -18.57,-5.8 -18.24,-6.17 -17.49,-6.82 -16.86,-7.21 -16.19,-7.53 -14.8,-7.99 -14.4,-8.19 -13.89,-8.63 -13.12,-9.56 -12.6,-10.09 -12.01,-10.54 -11.36,-10.9 -10.44,-11.25 -9.71,-11.4 -8.97,-11.44 -8.23,-11.39 -7.51,-11.23 -6.81,-10.98 -6.15,-10.64 -5.17,-10.02 -4.82,-9.9 -4.66,-9.91 -4.49,-9.95 -4.16,-10.16 -3.1,-11.12 -2.5,-11.56 -1.87,-11.96 -1.2,-12.29 -0.5,-12.56 0.46,-12.81 1.44,-12.94 2.44,-12.95 3.43,-12.83 4.15,-12.66 4.86,-12.43 5.76,-12.01 6.41,-11.63 7.01,-11.19 7.57,-10.69 8.39,-9.83 8.87,-9.51 9.03,-9.48 9.37,-9.55 10.54,-10.28 11.2,-10.6 11.91,-10.81 12.64,-10.92 13.38,-10.92 14.11,-10.81 14.82,-10.59 15.7,-10.14 16.28,-9.69 16.95,-8.96 17.35,-8.34 17.91,-7.27 18.18,-6.91 18.52,-6.61 19.76,-5.85 20.55,-5.26 21.09,-4.74 21.71,-3.97 22.22,-3.12 22.6,-2.2 22.88,-0.99"],
    gear: ["Gear", "13.02,0 13.05,0.69 13.19,1.35 13.34,1.75 13.69,2.3 14.32,2.96 16,4.39 16.9,5.25 17.52,5.98 17.96,6.76 18.11,7.37 18.11,7.8 18.03,8.23 17.72,9.11 17.27,9.97 16.75,10.79 16.14,11.5 15.8,11.78 15.44,11.99 14.83,12.17 13.94,12.18 12.99,12.01 11.81,11.66 9.5,10.85 8.62,10.68 8.19,10.68 7.55,10.8 6.92,11.05 6.31,11.39 5.75,11.79 5.43,12.09 5.16,12.43 4.85,13 4.6,13.88 4.03,16.78 3.75,17.72 3.48,18.37 3.13,18.93 2.83,19.23 2.49,19.48 1.89,19.73 1.21,19.87 0.49,19.93 -0.49,19.93 -1.21,19.87 -1.89,19.73 -2.3,19.58 -2.67,19.36 -2.99,19.09 -3.26,18.75 -3.48,18.37 -3.83,17.49 -4.2,16.06 -4.65,13.65 -4.94,12.8 -5.28,12.26 -5.58,11.94 -5.93,11.65 -6.51,11.27 -7.13,10.96 -7.55,10.8 -8.19,10.68 -8.62,10.68 -9.5,10.85 -11.81,11.66 -13.23,12.06 -14.17,12.2 -14.61,12.2 -15.04,12.13 -15.44,11.99 -15.8,11.78 -16.14,11.5 -16.6,10.98 -17.02,10.39 -17.51,9.54 -17.82,8.89 -18.03,8.23 -18.11,7.58 -18.07,7.16 -17.96,6.76 -17.65,6.17 -17.22,5.61 -16.55,4.9 -14.32,2.96 -13.69,2.3 -13.34,1.75 -13.19,1.35 -13.09,0.92 -13.02,0.23 -13.03,-0.46 -13.13,-1.13 -13.34,-1.75 -13.56,-2.12 -14.15,-2.8 -16,-4.39 -16.9,-5.25 -17.52,-5.98 -17.96,-6.76 -18.11,-7.37 -18.11,-7.8 -18.03,-8.23 -17.72,-9.11 -17.27,-9.97 -16.75,-10.79 -16.14,-11.5 -15.8,-11.78 -15.44,-11.99 -14.83,-12.17 -13.94,-12.18 -12.99,-12.01 -11.81,-11.66 -9.5,-10.85 -8.62,-10.68 -8.19,-10.68 -7.55,-10.8 -6.92,-11.05 -6.31,-11.39 -5.75,-11.79 -5.43,-12.09 -5.16,-12.43 -4.85,-13 -4.6,-13.88 -4.03,-16.78 -3.75,-17.72 -3.48,-18.37 -3.13,-18.93 -2.83,-19.23 -2.49,-19.48 -1.89,-19.73 -1.21,-19.87 -0.49,-19.93 0.49,-19.93 1.21,-19.87 1.89,-19.73 2.3,-19.58 2.67,-19.36 2.99,-19.09 3.26,-18.75 3.48,-18.37 3.83,-17.49 4.2,-16.06 4.65,-13.65 4.94,-12.8 5.28,-12.26 5.58,-11.94 6.12,-11.52 6.92,-11.05 7.55,-10.8 7.97,-10.7 8.4,-10.67 8.84,-10.7 9.72,-10.92 11.81,-11.66 12.76,-11.95 13.7,-12.15 14.39,-12.21 15.04,-12.13 15.62,-11.9 16.14,-11.5 16.6,-10.98 17.39,-9.76 17.9,-8.67 18.11,-7.8 18.11,-7.37 18.03,-6.96 17.87,-6.56 17.65,-6.17 17.06,-5.43 16,-4.39 14.15,-2.8 13.56,-2.12 13.34,-1.75 13.13,-1.13 13.05,-0.69"],
    gem: ["Gem", "-7.95,11.85 -7.49,11.96 -6.75,12 6.26,12 7.26,11.98 7.96,11.85 8.39,11.64 8.99,11.21 16.81,4.95 17.51,4.32 17.68,3.97 17.68,3.79 17.54,3.4 17.02,2.58 0.78,-20.87 0.35,-21.41 0.07,-21.6 -0.08,-21.59 -0.36,-21.4 -0.93,-20.66 -17.03,2.6 -17.44,3.21 -17.64,3.61 -17.67,3.98 -17.61,4.16 -17.17,4.65 -8.98,11.22 -8.38,11.65"],
    plus: ["Plus", "-6.03,19.52 -5.73,19.73 -5.37,19.87 -4.71,19.96 -3.99,19.99 4.24,19.99 5.16,19.91 5.73,19.73 6.03,19.52 6.23,19.23 6.37,18.87 6.44,18.44 6.5,17.25 6.52,8.52 6.63,7.63 6.77,7.27 6.97,6.97 7.27,6.77 7.63,6.63 8.52,6.52 17.25,6.5 18.44,6.44 19.06,6.31 19.39,6.14 19.64,5.89 19.87,5.37 19.96,4.71 20,3.75 20,-3.75 19.94,-4.94 19.87,-5.37 19.73,-5.73 19.52,-6.03 19.23,-6.23 18.87,-6.37 18.44,-6.44 17.25,-6.5 8.52,-6.52 7.63,-6.63 7.27,-6.77 6.97,-6.97 6.77,-7.27 6.63,-7.63 6.52,-8.52 6.5,-17.25 6.44,-18.44 6.31,-19.06 6.14,-19.39 5.89,-19.64 5.37,-19.87 4.71,-19.96 3.75,-20 -3.75,-20 -4.94,-19.94 -5.37,-19.87 -5.73,-19.73 -6.03,-19.52 -6.23,-19.23 -6.37,-18.87 -6.44,-18.44 -6.5,-17.25 -6.52,-8.52 -6.63,-7.63 -6.77,-7.27 -6.97,-6.97 -7.27,-6.77 -7.63,-6.63 -8.52,-6.52 -17.25,-6.5 -18.44,-6.44 -19.06,-6.31 -19.39,-6.14 -19.64,-5.89 -19.87,-5.37 -19.96,-4.71 -20,-3.75 -19.99,4.24 -19.87,5.37 -19.73,5.73 -19.52,6.03 -19.23,6.23 -18.87,6.37 -17.98,6.48 -9.25,6.5 -8.06,6.56 -7.63,6.63 -7.27,6.77 -6.97,6.97 -6.77,7.27 -6.59,7.84 -6.51,8.76 -6.48,17.98 -6.37,18.87 -6.23,19.23"],
    rainbow: ["Rainbow", "21.68,-9.69 21.86,-9.37 21.93,-8.73 21.87,-7.75 21.75,-6.76 21.53,-5.53 21.24,-4.32 20.88,-3.12 20.45,-1.94 19.64,-0.12 18.53,1.83 17.22,3.67 15.73,5.35 14.28,6.72 12.49,8.09 10.8,9.15 8.79,10.15 6.68,10.95 4.75,11.46 2.78,11.81 0.54,11.98 -1.71,11.92 -3.69,11.67 -5.89,11.18 -7.79,10.56 -9.62,9.77 -11.38,8.81 -13.04,7.7 -14.78,6.28 -16.36,4.68 -17.63,3.13 -18.75,1.48 -19.82,-0.5 -20.69,-2.57 -21.28,-4.48 -21.73,-6.68 -21.93,-8.66 -21.87,-9.31 -21.71,-9.64 -21.43,-9.85 -21.03,-9.95 -20.08,-10 -13.83,-10 -13.11,-9.97 -12.5,-9.82 -12.22,-9.59 -12.04,-9.24 -11.73,-7.6 -11.49,-6.63 -11.07,-5.45 -10.66,-4.54 -10.17,-3.67 -9.45,-2.65 -8.81,-1.89 -8.1,-1.19 -7.34,-0.54 -6.32,0.17 -5.45,0.66 -4.31,1.17 -3.12,1.56 -1.9,1.82 -0.66,1.96 0.33,1.97 1.58,1.87 2.56,1.7 3.76,1.37 4.7,1.01 5.6,0.58 6.67,-0.06 7.47,-0.65 8.41,-1.47 9.09,-2.2 9.71,-2.99 10.26,-3.82 10.73,-4.7 11.14,-5.61 11.54,-6.79 12.02,-9.18 12.18,-9.54 12.45,-9.79 12.82,-9.93 13.5,-9.99 20.25,-10 21.18,-9.93 21.54,-9.79"],
    bell: ["Bell", "-17.53,-11.8 -17.34,-11.93 -16.73,-11.99 -5.74,-12 -5.01,-12.02 -4.58,-12.1 -4.4,-12.17 -4.11,-12.42 -3.56,-13.68 -3.33,-14.11 -2.87,-14.69 -2.52,-15.03 -1.91,-15.45 -1.23,-15.74 -0.75,-15.87 -0.02,-15.94 0.72,-15.87 1.43,-15.67 2.09,-15.34 2.49,-15.05 2.85,-14.72 3.31,-14.14 3.55,-13.71 4.1,-12.45 4.37,-12.19 4.76,-12.06 5.71,-12 16.45,-11.99 17.09,-11.95 17.33,-11.84 17.36,-11.74 17.34,-11.63 17,-11.17 12.52,-6.5 12.11,-5.9 11.91,-5.46 11.64,-4.51 11.13,-2.31 10.19,2.34 9.41,7.03 9.1,9.26 8.89,11.25 8.63,12.47 8.39,13.18 8.1,13.87 7.48,14.95 7.04,15.56 6.56,16.13 5.64,16.97 5.04,17.42 4.19,17.93 3.28,18.35 2.58,18.59 1.85,18.78 0.86,18.93 -0.13,18.97 -0.88,18.93 -1.62,18.82 -2.59,18.59 -3.52,18.25 -4.2,17.93 -4.85,17.55 -5.65,16.97 -6.39,16.3 -7.05,15.55 -7.62,14.73 -8.1,13.86 -8.48,12.93 -8.75,11.97 -8.92,10.99 -9.13,9 -9.41,7.02 -10.1,2.82 -11.08,-2.08 -11.64,-4.52 -11.92,-5.47 -12.12,-5.91 -12.54,-6.5 -17.1,-11.11 -17.48,-11.58"],
    tree: ["Tree", "2.92,-7.54 3.07,-7.43 3.43,-7.3 4.58,-7.12 5.3,-6.95 6,-6.7 6.66,-6.36 7.28,-5.95 7.85,-5.47 9.17,-4 9.7,-3.52 10.3,-3.13 11.61,-2.43 12.61,-1.7 13.45,-0.79 13.73,-0.38 14.08,0.27 14.35,0.96 14.48,1.44 14.64,2.66 14.59,3.65 14.29,5.36 14.24,6.07 14.28,6.54 14.61,8.49 14.61,9.73 14.5,10.46 14.3,11.18 14.02,11.86 13.65,12.5 13.03,13.28 12.3,13.95 11.69,14.38 10.18,15.2 9.59,15.61 9.24,15.93 7.92,17.4 6.96,18.18 6.09,18.66 5.4,18.92 4.68,19.1 3.94,19.18 2.96,19.14 1.98,18.95 1.04,18.63 -0.08,18.14 -0.77,17.92 -1.48,17.83 -2.95,17.77 -4.17,17.55 -4.88,17.31 -5.54,16.99 -5.97,16.73 -6.55,16.27 -7.24,15.56 -7.8,14.74 -8.31,13.62 -8.78,11.96 -9.04,11.29 -9.41,10.67 -10.28,9.48 -10.77,8.61 -11.19,7.45 -11.29,6.97 -11.37,6.23 -11.37,5.73 -11.29,5 -11.18,4.51 -10.95,3.81 -10.39,2.7 -9.39,1.29 -9.02,0.68 -8.77,0.01 -8.3,-1.66 -8.01,-2.34 -7.65,-2.99 -7.21,-3.59 -6.88,-3.96 -6.13,-4.61 -5.29,-5.12 -3.74,-5.78 -3.37,-6 -3.08,-6.3 -2.8,-6.89 -2.6,-7.84 -2.51,-9.08 -2.48,-18.56 -2.38,-19.21 -2.22,-19.55 -2.1,-19.68 -1.78,-19.86 -1.14,-19.97 0.34,-20 1.3,-19.96 1.72,-19.88 2.06,-19.72 2.19,-19.59 2.36,-19.27 2.45,-18.86 2.5,-17.91 2.52,-8.91 2.63,-8.01 2.7,-7.83"],
    fir: ["Fir", "-2.02,-19.52 -1.73,-19.73 -1.37,-19.87 -0.24,-19.98 1.16,-19.91 1.56,-19.81 1.89,-19.64 2.14,-19.39 2.37,-18.87 2.47,-18.22 2.57,-16.57 2.71,-15.95 3,-15.48 3.46,-15.19 4.08,-15.06 4.78,-15.01 10.26,-15 11.44,-14.95 12.02,-14.82 12.3,-14.66 12.47,-14.43 12.54,-14.12 12.49,-13.54 12.32,-12.87 9.5,-3.83 7.18,4.08 5.46,10.35 3.47,18.04 3.2,18.8 3.05,19.02 2.89,19.11 2.71,19.05 2.52,18.84 1.76,17.51 -1.29,11.22 -4.48,4.44 -7.16,-1.47 -9.67,-7.19 -12.01,-12.7 -12.25,-13.36 -12.4,-13.96 -12.41,-14.3 -12.31,-14.57 -12.09,-14.76 -11.58,-14.92 -10.45,-14.99 -4.49,-15.02 -3.8,-15.09 -3.23,-15.27 -2.83,-15.61 -2.61,-16.14 -2.52,-16.79 -2.41,-18.66 -2.23,-19.23"],
    bolt: ["Bolt", "0.26,21.57 -0.08,21.32 -0.37,20.99 -0.76,20.4 -1.23,19.54 -10.73,0.54 -11.22,-0.54 -11.38,-1.1 -11.38,-1.41 -11.26,-1.64 -11.02,-1.81 -10.68,-1.91 -9.57,-1.99 -4.84,-2 -3.64,-2.05 -3.03,-2.17 -2.71,-2.33 -2.48,-2.56 -2.35,-2.87 -2.29,-3.47 -2.4,-4.64 -4.71,-20.15 -4.76,-20.88 -4.72,-21.08 -4.63,-21.13 -4.48,-21.04 -4.28,-20.82 -3.52,-19.74 10.02,0.97 11.04,2.6 11.21,2.97 11.3,3.29 11.29,3.55 11.14,3.74 10.87,3.87 10.51,3.94 9.37,4 5.39,4.01 4.29,4.1 3.96,4.21 3.73,4.37 3.66,4.49 3.61,4.76 3.72,5.3 4.18,6.35 10.98,19.98 11.36,20.99 11.39,21.32 11.31,21.57 11.12,21.76 10.62,21.92 9.73,21.99 8.5,22 2.01,21.98 1.07,21.88 0.65,21.76"],
    bubble: ["Speech bubble", "-19.37,-7.37 -18.92,-7.67 -18.14,-7.89 -17.22,-7.97 -14.55,-8.04 -13.69,-8.14 -13.33,-8.24 -13.03,-8.4 -12.74,-8.74 -12.64,-9.04 -12.61,-9.39 -12.72,-10.21 -13.02,-11.36 -14.14,-15.16 -14.39,-16.2 -14.43,-16.78 -14.37,-16.95 -14.24,-17.02 -14.05,-16.98 -13.79,-16.86 -12.81,-16.16 -4.75,-9.5 -3.54,-8.71 -2.89,-8.42 -2.44,-8.28 -1.27,-8.07 0.21,-8.01 16.95,-7.98 18.32,-7.86 18.72,-7.75 19.06,-7.6 19.47,-7.25 19.73,-6.77 19.92,-5.95 19.98,-5.02 19.99,10.71 19.89,12.12 19.68,12.9 19.38,13.35 19.1,13.57 18.76,13.74 17.95,13.92 16.76,13.99 -16.48,13.99 -17.91,13.92 -18.55,13.81 -18.91,13.68 -19.36,13.37 -19.58,13.09 -19.74,12.75 -19.92,11.93 -19.99,10.75 -19.98,-4.98 -19.92,-5.92 -19.8,-6.55 -19.59,-7.08"],
  };
  UNB.MORPH_SHAPES = Object.fromEntries(Object.entries(MS).map(([k, [name]]) => [k, name]));
  UNB.morphShape = function (key) {
    const S = MS[key];
    if (!S) return null;
    const P = S[1].split(" ").map((p) => p.split(",").map(Number)),
      xs = P.map((p) => p[0]),
      ys = P.map((p) => p[1]),
      k = 40 / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    return { x: xs.map((v) => v * k), y: ys.map((v) => v * k) };
  };

  // ---------- patterns, for the bottom or the top ----------
  // A short list that morphs (27 November 2026, 125 mm tall: docs/DIMENSIONS-PLAN.md §7): the Moore curve at three
  // levels of detail (into each other, from a circle or a shape, into a 4-letter word) and the spiral, plain and
  // twisted (into each other). Other patterns are open lines or cross themselves, and the labyrinth didn't morph.
  // UNB.morphPattern(key) → { x, y } (40 mm across, like a shape), minW (the narrowest the morph can be, mm across:
  // its channels at least 2.5 line spacings at d = 1.34), or null.
  const MP = {
    moore2: ["Moore, coarse", "moore", { detail: 2 }],
    moore3: ["Moore", "moore", { detail: 3 }],
    moore4: ["Moore, fine", "moore", { detail: 4 }],
    spiral: ["Spiral", "spiral", { detail: 3, sides: 4, twist: 0 }],
    spiral2: ["Spiral, twisted", "spiral", { detail: 3, sides: 4, twist: 60 }],
  };
  UNB.MORPH_PATTERNS = Object.fromEntries(Object.entries(MP).map(([k, [name]]) => [k, name]));
  const mpCache = {};
  UNB.morphPattern = function (key) {
    const M = MP[key];
    if (!M || !UNB.pattern) return null;
    if (mpCache[key]) return mpCache[key];
    const r = UNB.pattern(M[1], M[2]),
      p = r && r.paths[0];
    if (!p) return null;
    const k = 40 / Math.max(r.box[0], r.box[1]),
      x = [],
      y = [],
      m = p.length / 2;
    let cx = 0,
      cy = 0;
    for (let i = 0; i < m; i++) {
      cx += p[2 * i] / m;
      cy += p[2 * i + 1] / m;
    }
    // (evenly every 0.25 of 40, so the corners stay corners)
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % m,
        ax = (p[2 * i] - cx) * k,
        ay = -(p[2 * i + 1] - cy) * k,
        bx = (p[2 * j] - cx) * k,
        by = -(p[2 * j + 1] - cy) * k,
        n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.25));
      for (let t = 0; t < n; t++) {
        x.push(ax + ((bx - ax) * t) / n);
        y.push(ay + ((by - ay) * t) / n);
      }
    }
    // (the pattern's own gap between its lines, at 40 mm: the morph's channels)
    const gap = (r.gap || 1) * k;
    return (mpCache[key] = { x, y, minW: Math.max(40, Math.ceil((40 * 2.5 * 1.34) / gap)) });
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
