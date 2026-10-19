/* Unbroken · engine · 05-fill.js
   4b. Fills — the chocolate infill (areas the printed line encloses, filled with more of the same line) and the 2D
   tab's pen fills (areas the pen line closes off, hatched or contoured).
   One part of the engine (no DOM), loaded after 04-walk.js; core.js lists every part and what's in it. */
(function (root) {
  "use strict";
  const UNB = root.UNB,
    { bilinear, label4, labelBoxes, rasterPolyline, isoContours, bbox, cumLength, resampleLoop, makeUF, cellGrid } =
      UNB._u; // shared helpers (00-util.js)

  // Infill: every closed area the printed line encloses, filled with more of the same line, one spacing d apart.
  // The fill stays part of the one continuous line: each area's fill is built as closed loops one spacing apart,
  // merged into a single loop by bridges (cut two loops where they run side by side and join them with two short
  // parallel links d apart), and that loop is bridged into the printed line the same way, on a straight stretch away
  // from junctions, stroke ends and connectors. Nothing crosses and nothing is drawn twice.
  //   pattern "rings": rings following the area's edge at d, 2d, 3d … (where an area narrows, a ring splits in two)
  //   pattern "lines": one ring at d, then straight rows d apart inside it, paired into narrow loops
  // The edges count from the centre of the printed line, so with a gap of 0 (spacing = line width) the fill is solid;
  // with a gap the fill keeps it, like the rest of the print.
  // path: { x, y, idx } (offsetDoubled), closed. d: spacing (px), which sets what counts as an area (the channels
  // between
  // a stroke's two strands don't). opt: rows (spacing of the fill's rows and rings, centre to centre, default d: a line
  // width makes the fill solid, more than d sparse; the first ring sits at least 0.7 d from the printed line), pattern,
  // angle (lines, degrees), bridge (width of the joins, default d: a sparse fill keeps them one line spacing), minArea
  // (px²: smaller
  // areas are left open), fixed(i) → true
  // for path points a fill may not join at. Returns { x, y, idx } with the fills spliced in (fill points have idx -1)
  // and areas / skipped: how many areas were filled, and how many were left open as too small.
  UNB.infill = function (path, d, opt) {
    const o = opt || {},
      pattern = o.pattern === "lines" ? "lines" : "rings";
    const n = path.x.length;
    if (!(d > 0) || n < 4) return Object.assign({ areas: 0 }, path);
    // the joins (bridges, splice) are this wide: one line spacing, even when sparse rows are further apart
    const bw = Math.min(d, o.bridge || d);
    // row / ring spacing, and the first ring's distance from the line. Rings step in a row spacing at a time. Lines keep
    // their one ring a line spacing in, as at 100%, whatever the density: the ring is the fill's edge, and a sparse
    // fill starting a whole row spacing in (and its rows another row spacing inside that) left a small part with a
    // ring and no rows.
    const rs = o.rows > 0 ? o.rows : d,
      first = pattern === "lines" ? Math.max(Math.min(rs, d), 0.7 * d) : Math.max(rs, 0.7 * d);
    const step = Math.min(Math.max(0.5, Math.min(d, rs) / 4), bw / 2); // spacing of points along fill loops
    // grid for the distance field (fine enough for the joins and the rows)
    const g = Math.max(0.2, Math.min(bw, rs) / 5);
    const { x0, y0, x1, y1 } = bbox(path.x, path.y);
    const pad = 2 * d,
      ox = x0 - pad,
      oy = y0 - pad,
      w = Math.ceil((x1 - x0 + 2 * pad) / g) + 2,
      h = Math.ceil((y1 - y0 + 2 * pad) / g) + 2;
    // ~3500 × 3500 cells: too fine to fill here
    if (w * h > 12e6) return Object.assign({ areas: 0, tooBig: true }, path);
    const line = new Uint8Array(w * h);
    rasterPolyline(line, w, path.x, path.y, true, ox, oy, g, 0.5);
    const dist = UNB.edt(line, w, h).dist; // grid units
    // Areas: 4-connected cells more than 0.6 spacings from the printed line, so the narrow channels between a stroke's
    // two strands and the openings where strokes meet (all about one spacing wide) close an area off. Being inside the
    // one continuous line in the mathematical sense isn't enough: whether a leaf's blade is "inside" or "outside" the
    // loop depends on which way the line happens to go round its stem. The area touching the border is outside.
    const wall = (0.6 * d) / g,
      { lab, count: nl } = label4(w, h, (q) => dist[q] > wall);
    const box = labelBoxes(lab, nl, w, h),
      { x0: bx0, y0: by0, x1: bx1, y1: by1 } = box; // each area's box, so contours only scan there
    const outside = lab[0] >= 0 ? lab[0] : -2,
      size = new Float64Array(nl),
      deep = new Float32Array(nl);
    for (let s = 0; s < w * h; s++) {
      const a = lab[s];
      if (a < 0) continue;
      size[a] += g * g;
      if (dist[s] > deep[a]) deep[a] = dist[s];
    } // each area: px², and how far in it goes
    let skipped = 0;
    const toXY = (gx, gy) => [ox + gx * g, oy + gy * g];
    const loopLen = (p) => {
      let L = 0;
      for (let i = 0; i < p.length; i++) {
        const j = (i + 1) % p.length;
        L += Math.hypot(p[j][0] - p[i][0], p[j][1] - p[i][1]);
      }
      return L;
    };
    // closed contours of the distance field at level L (grid units) inside area id, evenly resampled; tiny loops
    // dropped
    const contours = (id, L) =>
      isoContours(dist, lab, id, L, w, h, box, ox, oy, g)
        .map((p) => resampleLoop(p, step))
        .filter((p) => loopLen(p) > 2.5 * Math.min(d, rs));
    // straight rows rs apart (at the given angle) through the part of area id clear of the ring, paired into narrow
    // closed loops (a row out, the next row back, a half-circle at each end). In a sparse fill (rs > d) a row stops a
    // line spacing plus half a row spacing inside the ring, so the half-circle at its end (rs / 2 out) still keeps a
    // line spacing from the ring; a solid fill (rs ≤ d) stops a row spacing inside it, as before.
    const rowLoops = (id) => {
      const a = ((o.angle || 0) * Math.PI) / 180,
        ca = Math.cos(a),
        sa = Math.sin(a),
        Lmin = (first + (rs > d ? d + rs / 2 : rs)) / g;
      // rotate grid cells into row coordinates: u along the row, v across
      const cells = [];
      for (let y = by0[id]; y <= by1[id]; y++)
        for (let x = bx0[id]; x <= bx1[id]; x++) {
          const i = y * w + x;
          if (lab[i] !== id || dist[i] < Lmin) continue;
          const [X, Y] = toXY(x, y),
            u = X * ca + Y * sa,
            v = -X * sa + Y * ca;
          cells.push([u, v]);
        }
      if (!cells.length) return [];
      const rows = new Map(); // row index → list of u (cells within 0.75 g of the row line)
      for (const [u, v] of cells) {
        const r = Math.round(v / rs);
        if (Math.abs(v - r * rs) > g * 0.75) continue;
        let A = rows.get(r);
        if (!A) rows.set(r, (A = []));
        A.push(u);
      }
      const runs = new Map(); // row → [[u0, u1], …]
      for (const [r, us] of rows) {
        us.sort((p, q) => p - q);
        const out = [];
        let s = us[0],
          e = us[0];
        for (let i = 1; i < us.length; i++) {
          if (us[i] - e > 1.5 * g) {
            out.push([s, e]);
            s = us[i];
          }
          e = us[i];
        }
        out.push([s, e]);
        runs.set(
          r,
          out.filter(([p, q]) => q - p > rs)
        );
      }
      const back = (u, v) => [u * ca - v * sa, u * sa + v * ca],
        loops = [];
      // Each run pairs with a run of the next row it overlaps by more than a row spacing. Where a row splits round a
      // dip (a heart's two lobes) and the next row runs across both, that row's run serves both sides, as long as the
      // two loops stay far enough apart that their ends keep a line spacing (used: the parts of a run already taken).
      const keys = [...runs.keys()].sort((p, q) => p - q),
        taken = new Set(),
        used = new Map();
      for (const r of keys) {
        for (const [p0, p1] of runs.get(r)) {
          if (taken.has(`${r}:${p0}`)) continue;
          let u0 = 0,
            u1 = 0,
            nk = null;
          for (const [q0, q1] of runs.get(r + 1) || []) {
            const k = `${r + 1}:${q0}`;
            let a = Math.max(p0, q0),
              b = Math.min(p1, q1);
            // shortened to keep clear of the loops already on this run (their ends and ours are rs / 2 round)
            for (const [c, e] of used.get(k) || [])
              if (c < a) a = Math.max(a, e + rs + d);
              else b = Math.min(b, c - rs - d);
            if (b - a <= rs) continue;
            u0 = a;
            u1 = b;
            nk = k;
            break;
          }
          if (!nk) continue;
          taken.add(`${r}:${p0}`);
          taken.add(nk);
          if (!used.has(nk)) used.set(nk, []);
          used.get(nk).push([u0, u1]);
          const va = r * rs,
            vb = (r + 1) * rs,
            rad = rs / 2,
            pts = [];
          for (let u = u0; u < u1; u += step) pts.push(back(u, va));
          for (let t = 0; t <= 8; t++) {
            const th = -Math.PI / 2 + (Math.PI * t) / 8;
            pts.push(back(u1 + rad * Math.cos(th), va + rad + rad * Math.sin(th)));
          }
          for (let u = u1; u > u0; u -= step) pts.push(back(u, vb));
          for (let t = 0; t <= 8; t++) {
            const th = Math.PI / 2 + (Math.PI * t) / 8;
            pts.push(back(u0 + rad * Math.cos(th), va + rad + rad * Math.sin(th)));
          }
          loops.push(resampleLoop(pts, step));
        }
      }
      return loops;
    };
    // spatial lookup of loop points
    const gridOf = (P, cell) => {
      const G = cellGrid(cell);
      P.forEach(([X, Y], i) => G.add(X, Y, i));
      return G;
    };
    const nearestIn = (G, P, cell, X, Y, ok) => {
      let best = Infinity,
        bi = -1;
      G.near(X, Y, (i) => {
        const dd = Math.hypot(P[i][0] - X, P[i][1] - Y);
        if (dd < best && (!ok || ok(i))) {
          best = dd;
          bi = i;
        }
      });
      return [bi, best];
    };
    const tangent = (P, i) => {
      const a = P[(i - 1 + P.length) % P.length],
        b = P[(i + 1) % P.length],
        l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
    };
    // join loop C into loop P at their closest side-by-side points (both closed); returns the joined loop or null
    const bridge = (P, usedP, C, usedC) => {
      const cell = 1.7 * Math.max(d, rs),
        G = gridOf(P, cell),
        far = (used) => (pt) => used.every(([a, b]) => Math.hypot(pt[0] - a, pt[1] - b) > 3 * d);
      let best = Infinity,
        bi = -1,
        bj = -1;
      for (let j = 0; j < C.length; j += 2) {
        if (!far(usedC)(C[j])) continue;
        const [i, dd] = nearestIn(G, P, cell, C[j][0], C[j][1], (i) => far(usedP)(P[i]));
        if (i >= 0 && dd < best) {
          best = dd;
          bi = i;
          bj = j;
        }
      }
      if (bi < 0 || best > 1.6 * Math.max(d, rs)) return null; // loops sit one row apart
      const tp = tangent(P, bi),
        tc = tangent(C, bj),
        ko = Math.max(1, Math.round(bw / step));
      if (Math.abs(tp[0] * tc[0] + tp[1] * tc[1]) < 0.7) return null; // not side by side
      const same = tp[0] * tc[0] + tp[1] * tc[1] > 0,
        out = [];
      for (let s = 0; s <= P.length - ko; s++) out.push(P[(bi + ko + s) % P.length]); // P: bi+ko … bi
      if (same)
        for (let s = 0; s <= C.length - ko; s++) out.push(C[(bj - s + C.length) % C.length]); // C backwards: bj … bj+ko
      else for (let s = 0; s <= C.length - ko; s++) out.push(C[(bj + s) % C.length]); // C forwards: bj … bj-ko
      return { loop: out, at: P[bi], atC: C[bj] };
    };
    // join loop C into loop P where no stretch runs side by side (sparse rows inside their ring are a row spacing in
    // from it, often across it): two straight connector strands half a bridge width apart, from P's point nearest C,
    // C taken whichever way round keeps the strands from crossing. Returns the joined loop or null (too far apart).
    const cross = (a, b, c, e) => {
      const s = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
      return s(a, b, c) * s(a, b, e) < 0 && s(c, e, a) * s(c, e, b) < 0;
    };
    const link = (P, usedP, C, usedC) => {
      const reach = 2.5 * Math.max(d, rs),
        cell = reach,
        G = gridOf(P, cell),
        far = (used) => (pt) => used.every(([a, b]) => Math.hypot(pt[0] - a, pt[1] - b) > 3 * d);
      let best = Infinity,
        bi = -1,
        bj = -1;
      for (let j = 0; j < C.length; j += 2) {
        if (!far(usedC)(C[j])) continue;
        const [i, dd] = nearestIn(G, P, cell, C[j][0], C[j][1], (i) => far(usedP)(P[i]));
        if (i >= 0 && dd < best) {
          best = dd;
          bi = i;
          bj = j;
        }
      }
      if (bi < 0 || best > reach) return null;
      const ko = Math.max(1, Math.round(bw / 2 / step)),
        m = P.length,
        n = C.length;
      if (m <= 2 * ko + 2 || n <= 2 * ko + 2) return null;
      for (const rev of [false, true]) {
        const Q = rev ? C.slice().reverse() : C,
          j = rev ? n - 1 - bj : bj,
          out = [];
        // P from just after the joint round to just before it
        for (let s = 0; s <= m - 2 * ko; s++) out.push(P[(bi + ko + s) % m]);
        for (let s = 0; s <= n - 2 * ko; s++) out.push(Q[(j + ko + s) % n]); // across, round C, and back
        if (!cross(P[(bi - ko + m) % m], Q[(j + ko) % n], Q[(j - ko + n) % n], P[(bi + ko) % m]))
          return { loop: out, at: P[bi], atC: C[bj] };
      }
      return null;
    };
    // a loop that comes close enough to the printed line to be spliced into it (see below)
    const reachesLine = (p) => {
      const lim = Math.max(1.6 * d, 1.25 * first) / g;
      for (const [X, Y] of p) {
        const gx = Math.round((X - ox) / g),
          gy = Math.round((Y - oy) / g);
        if (gx >= 0 && gy >= 0 && gx < w && gy < h && dist[gy * w + gx] <= lim) return true;
      }
      return false;
    };
    // merge a set of loops into as few as possible: grow from the root, bridging the nearest unmerged loop each time
    // (side by side); when none can be bridged, link one that couldn't reach the line by itself with connector strands
    // (otherwise it would be left out) and go on
    const merge = (loops) => {
      if (!loops.length) return [];
      const L = loops.map((p) => ({ p, used: [] })),
        done = new Uint8Array(L.length),
        out = [];
      for (;;) {
        let root = -1;
        for (let i = 0; i < L.length; i++) if (!done[i] && (root < 0 || L[i].p.length > L[root].p.length)) root = i;
        if (root < 0) break;
        done[root] = 1;
        const R = L[root];
        for (;;) {
          for (let grew = true; grew; ) {
            grew = false;
            for (let i = 0; i < L.length; i++) {
              if (done[i]) continue;
              const r = bridge(R.p, R.used, L[i].p, L[i].used);
              if (!r) continue;
              R.p = r.loop;
              R.used.push(r.at, r.atC, ...L[i].used);
              done[i] = 1;
              grew = true;
            }
          }
          let linked = false;
          for (let i = 0; i < L.length && !linked; i++) {
            if (done[i] || reachesLine(L[i].p)) continue; // near the line: spliced into it on its own below
            const r = link(R.p, R.used, L[i].p, L[i].used);
            if (!r) continue;
            R.p = r.loop;
            R.used.push(r.at, r.atC, ...L[i].used);
            done[i] = 1;
            linked = true;
          }
          if (!linked) break;
        }
        out.push(R.p);
      }
      return out;
    };
    // fill each area
    const fills = [];
    for (let id = 0; id < nl; id++) {
      if (id === outside) continue;
      if (deep[id] * g < first) continue; // too narrow for even one ring
      if (o.minArea > 0 && size[id] < o.minArea) {
        skipped++;
        continue;
      }
      let loops = [];
      if (pattern === "rings") {
        for (let k = 0; k < 5000; k++) {
          const lv = contours(id, (first + k * rs) / g);
          if (!lv.length) break;
          loops.push(...lv);
        }
      } else {
        loops = contours(id, first / g).concat(rowLoops(id));
      }
      if (!loops.length) continue;
      for (const F of merge(loops)) fills.push(F);
    }
    // splice each fill into the printed line where it runs closest, on a straight stretch
    let px = Array.from(path.x),
      py = Array.from(path.y),
      idx = Array.from(path.idx || path.x.map((_, i) => i)),
      areas = 0;
    const usedPath = [];
    for (const F of fills) {
      const m = px.length,
        cell = 1.7 * Math.max(d, first),
        G = gridOf(F, cell);
      const straight = (i) => {
        let a = i,
          b = i,
          s1 = 0,
          s2 = 0;
        while (a > 0 && s1 < 1.5 * bw) {
          s1 += Math.hypot(px[a] - px[a - 1], py[a] - py[a - 1]);
          a--;
        }
        while (b < m - 1 && s2 < 2.5 * bw) {
          s2 += Math.hypot(px[b + 1] - px[b], py[b + 1] - py[b]);
          b++;
        }
        const ux = px[i] - px[a],
          uy = py[i] - py[a],
          vx = px[b] - px[i],
          vy = py[b] - py[i],
          lu = Math.hypot(ux, uy),
          lv = Math.hypot(vx, vy);
        return lu > 0.9 * s1 && lv > 0.9 * s2 && (ux * vx + uy * vy) / (lu * lv) > 0.94;
      };
      let best = Infinity,
        bi = -1,
        bj = -1;
      for (let i = 0; i < m; i++) {
        if (idx[i] < 0 || (o.fixed && o.fixed(idx[i]))) continue;
        const [j, dd] = nearestIn(G, F, cell, px[i], py[i]);
        if (j < 0 || dd >= best) continue;
        if (usedPath.some(([a, b]) => Math.hypot(px[i] - a, py[i] - b) < 3 * d) || !straight(i)) continue;
        best = dd;
        bi = i;
        bj = j;
      }
      if (bi < 0 || best > Math.max(1.6 * d, 1.25 * first)) continue; // the outer ring sits `first` from the line
      let k = bi,
        s = 0;
      while (k < m - 1 && s < bw) {
        s += Math.hypot(px[k + 1] - px[k], py[k + 1] - py[k]);
        k++;
      }
      const tp = [px[k] - px[bi], py[k] - py[bi]],
        tf = tangent(F, bj),
        same = tp[0] * tf[0] + tp[1] * tf[1] > 0,
        ko = Math.max(1, Math.round(bw / step)),
        ins = [];
      if (same) for (let t = 0; t <= F.length - ko; t++) ins.push(F[(bj - t + F.length) % F.length]);
      else for (let t = 0; t <= F.length - ko; t++) ins.push(F[(bj + t) % F.length]);
      px = px.slice(0, bi + 1).concat(
        ins.map((q) => q[0]),
        px.slice(k)
      );
      py = py.slice(0, bi + 1).concat(
        ins.map((q) => q[1]),
        py.slice(k)
      );
      idx = idx.slice(0, bi + 1).concat(
        ins.map(() => -1),
        idx.slice(k)
      );
      usedPath.push([px[bi], py[bi]]);
      areas++;
    }
    return { x: Float64Array.from(px), y: Float64Array.from(py), idx: Int32Array.from(idx), areas, skipped };
  };

  // Pen fills (2D tab): the areas the pen line closes off, and hatching for the ones picked
  // A pen can lift, so a fill is plain hatching: straight strokes, the pen lifting between them. The areas are the
  // regions the drawn line separates (a leaf's blade between two veins is one area). Lines closer than the outline
  // pen's width count as touching, so a gap the ink would close anyway doesn't join two areas.
  // line: { x, y } in mm (y down), closed. opt: pen (outline pen width, mm), cell (grid, mm; default from the size),
  // gap (mm: close gaps this wide between a stroke end and the line ahead of it), minShape (mm²: smaller areas join a
  // neighbour),
  // fills: [{ seeds: [[x, y], …] (mm, points inside the areas to fill), width (this pen's width), spacing (between
  // strokes, centre to centre; = width for solid), style ("hatch" or "contours": rings stepping in from the edge),
  // angle (degrees), cross (bool: a second pass at 90°), tone (bool: spacing follows opt.tone, the image's darkness)
  // }].
  // A stroke ends where its ink would touch the outline's ink: (pen + width) / 2 from the line's centre.
  // Returns { g, ox, oy, w, h, lab (Int32Array, area per grid cell; -1 on the line), outside (the area round the
  // drawing), count (label range), shapes (how many fillable areas), bridges ([x0, y0, x1, y1] mm), seedAreas: per
  // fill, the area each seed landed in (-1: none), fills: per fill, a list of strokes
  // (polylines [x0, y0, x1, y1, …]; a hatch stroke is one segment) in plotting order }.
  UNB.penFills = function (line, closed, opt) {
    const o = opt || {},
      n = line.x.length,
      pen = Math.max(0.01, o.pen || 0.5);
    const { x0, y0, x1, y1 } = bbox(line.x, line.y);
    const span = Math.max(x1 - x0, y1 - y0, 1e-3),
      g = o.cell || Math.min(pen / 2, Math.max(0.03, span / 800));
    const pad = 3 * g + pen,
      ox = x0 - pad,
      oy = y0 - pad,
      w = Math.ceil((x1 - x0 + 2 * pad) / g) + 1,
      h = Math.ceil((y1 - y0 + 2 * pad) / g) + 1;
    const mask = new Uint8Array(w * h),
      m = closed ? n : n - 1;
    // dense enough that a 4-connected area can't slip through
    rasterPolyline(mask, w, line.x, line.y, closed, ox, oy, g, 1 / 3);
    // Close gaps: a stroke end (where the line turns back on itself, or an open line's end) that stops within `gap` mm
    // of another part of the line, ahead of it, is joined to it by a bridge. The bridges only bound areas; whether
    // they're drawn is up to the caller.
    const bridges = [],
      gap = Math.max(0, o.gap || 0);
    if (gap > 0 && n > 2) {
      const S = cumLength(line.x, line.y, closed),
        total = S[n];
      // arc length from i to i + k (wrapping round a closed line)
      const ahead = (i, k) => (i + k < n ? S[i + k] : S[i + k - n] + total) - S[i];
      const behind = (i, k) => S[i] - (i - k >= 0 ? S[i - k] : S[i - k + n] - total); // … and from i − k to i
      const at = (u) => {
        // point at arc length u (wrapping on a closed line, clamped on an open one)
        if (closed) u = ((u % total) + total) % total;
        else u = Math.max(0, Math.min(total, u));
        let lo = 0,
          hi = closed ? n : n - 1;
        while (hi - lo > 1) {
          const md = (lo + hi) >> 1;
          if (S[md] <= u) lo = md;
          else hi = md;
        }
        const j = (lo + 1) % n,
          t = (u - S[lo]) / (S[lo + 1] - S[lo] || 1);
        return [line.x[lo] + t * (line.x[j] - line.x[lo]), line.y[lo] + t * (line.y[j] - line.y[lo])];
      };
      const Lr = Math.max(1, 2 * pen),
        tips = []; // look this far along the line each way to recognise a turn-back
      const tipness = (i) => {
        const a = at(S[i] - Lr),
          b = at(S[i] + Lr),
          mx = (a[0] + b[0]) / 2,
          my = (a[1] + b[1]) / 2;
        return [
          (Math.hypot(line.x[i] - mx, line.y[i] - my) - Math.hypot(a[0] - b[0], a[1] - b[1]) / 2) / Lr,
          line.x[i] - mx,
          line.y[i] - my,
        ];
      };
      const T = [];
      for (let i = 0; i < n; i++) T.push(tipness(i)[0]);
      for (let i = 0; i < n; i++) {
        if (!closed && (i === 0 || i === n - 1)) {
          const q = i ? n - 2 : 1,
            dx = line.x[i] - line.x[q],
            dy = line.y[i] - line.y[q],
            l = Math.hypot(dx, dy) || 1;
          tips.push([i, dx / l, dy / l]);
          continue;
        }
        if (T[i] < 0.6) continue;
        let peak = true;
        for (let k = 1; k < n && (closed || i + k < n) && ahead(i, k) < Lr; k++)
          if (T[(i + k) % n] > T[i]) {
            peak = false;
            break;
          }
        for (let k = 1; peak && k < n && (closed || i - k >= 0) && behind(i, k) < Lr; k++)
          if (T[(i - k + n) % n] >= T[i]) peak = false;
        if (!peak) continue;
        const [, dx, dy] = tipness(i),
          l = Math.hypot(dx, dy) || 1;
        tips.push([i, dx / l, dy / l]);
      }
      const cosMax = Math.cos((65 * Math.PI) / 180);
      for (const [i, ux, uy] of tips) {
        const px = line.x[i],
          py = line.y[i];
        let best = gap,
          bq = null;
        for (let a = 0; a < m; a++) {
          const b = (a + 1) % n,
            sa = S[a],
            sb = sa + (S[a + 1] - S[a]);
          const near = (v) => {
            let d = Math.abs(v - S[i]);
            if (closed) d = Math.min(d, total - d);
            return d < Lr;
          };
          if (near(sa) && near(sb)) continue; // the stroke end's own neighbourhood
          const ax = line.x[a],
            ay = line.y[a],
            dx = line.x[b] - ax,
            dy = line.y[b] - ay,
            L2 = dx * dx + dy * dy || 1e-12,
            t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2));
          const qx = ax + t * dx,
            qy = ay + t * dy,
            vx = qx - px,
            vy = qy - py,
            d = Math.hypot(vx, vy);
          if (d >= best || d < 1e-9 || vx * ux + vy * uy < d * cosMax) continue; // only ahead of the stroke end
          best = d;
          bq = [qx, qy];
        }
        if (bq) {
          bridges.push([px, py, bq[0], bq[1]]);
          rasterPolyline(mask, w, [px, bq[0]], [py, bq[1]], false, ox, oy, g, 1 / 3);
        }
      }
    }
    const dist = UNB.edt(mask, w, h).dist,
      wall = Math.max(0.75, pen / 2 / g); // grid units
    const { lab, count } = label4(w, h, (q) => dist[q] > wall);
    const outside = lab[0];
    // Smallest shape: an area under minShape mm² joins the neighbouring area it shares the most edge with (the outside
    // only when it touches no other area, in which case it can't be filled). Neighbours are found by growing every area
    // a few cells across the line.
    const minCells = Math.max(0, o.minShape || 0) / (g * g);
    if (minCells > 0 && count > 1) {
      const size = new Float64Array(count);
      for (let s = 0; s < w * h; s++) if (lab[s] >= 0) size[lab[s]]++;
      const grown = Int32Array.from(lab);
      let q = [];
      for (let s = 0; s < w * h; s++) if (lab[s] >= 0) q.push(s);
      const reach = Math.ceil(wall + 3);
      for (let r = 0; r < reach && q.length; r++) {
        const nx = [];
        for (const p of q) {
          const px = p % w,
            py = (p / w) | 0,
            l = grown[p];
          for (const c of [px > 0 ? p - 1 : -1, px < w - 1 ? p + 1 : -1, py > 0 ? p - w : -1, py < h - 1 ? p + w : -1])
            if (c >= 0 && grown[c] < 0) {
              grown[c] = l;
              nx.push(c);
            }
        }
        q = nx; // (not q.push(...nx): too many arguments on a big grid)
      }
      const contact = new Map(),
        key = (a, b) => a * count + b;
      for (let s = 0; s < w * h; s++) {
        const a = grown[s];
        if (a < 0) continue;
        const px = s % w;
        for (const c of [px < w - 1 ? s + 1 : -1, s + w < w * h ? s + w : -1]) {
          if (c < 0) continue;
          const b = grown[c];
          if (b < 0 || b === a) continue;
          contact.set(key(a, b), (contact.get(key(a, b)) || 0) + 1);
          contact.set(key(b, a), (contact.get(key(b, a)) || 0) + 1);
        }
      }
      const nbrs = Array.from({ length: count }, () => []); // per area: [neighbour, shared edge length]
      for (const [k2, v] of contact) nbrs[Math.floor(k2 / count)].push([k2 % count, v]);
      const members = Array.from({ length: count }, (_, i) => [i]); // per merged area (its root): the areas in it
      const { parent, find } = makeUF(count);
      const order = [...Array(count).keys()].filter((i) => i !== outside).sort((a, b) => size[a] - size[b]);
      for (const a of order) {
        const A = find(a);
        if (A === find(outside) || size[A] >= minCells) continue;
        const tally = new Map(); // edge shared with each neighbouring (merged) area, over A's own areas
        for (const x of members[A])
          for (const [y, v] of nbrs[x]) {
            const B = find(y);
            if (B !== A) tally.set(B, (tally.get(B) || 0) + v);
          }
        let bestB = -1,
          bv = 0;
        const out = find(outside); // a neighbouring shape first; the outside only if there's none
        for (const [B, v] of tally)
          if (B !== out && v > bv) {
            bv = v;
            bestB = B;
          }
        if (bestB < 0 && tally.has(out)) bestB = out;
        if (bestB < 0) continue;
        parent[A] = bestB;
        size[bestB] += size[A];
        for (const x of members[A]) members[bestB].push(x);
        members[A] = [];
      }
      for (let s = 0; s < w * h; s++) if (lab[s] >= 0) lab[s] = find(lab[s]);
    }
    const shapes = new Set();
    for (let s = 0; s < w * h; s++) if (lab[s] >= 0 && lab[s] !== lab[0]) shapes.add(lab[s]);
    const box = labelBoxes(lab, count, w, h),
      { x0: bx0, y0: by0, x1: bx1, y1: by1 } = box;
    // the area at a point (mm): the cell's own area, else the nearest area cell within a pen width (a click on the line
    // itself)
    const areaAt = (X, Y) => {
      const cx = Math.round((X - ox) / g),
        cy = Math.round((Y - oy) / g),
        r = Math.ceil(pen / g) + 1;
      let best = Infinity,
        id = -1;
      for (let b = -r; b <= r; b++)
        for (let a = -r; a <= r; a++) {
          const x = cx + a,
            y = cy + b;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const l = lab[y * w + x];
          if (l < 0) continue;
          const d2 = a * a + b * b;
          if (d2 < best) {
            best = d2;
            id = l;
          }
        }
      return id === outside ? -1 : id;
    };
    // hatch one area: rows `sp` apart at angle `ang`, each split into runs where the cell is in the area and the ink
    // clears the outline's; returns strokes [x0, y0, x1, y1] in mm, boustrophedon
    const hatch = (id, inset, sp, ang) => {
      const a = (ang * Math.PI) / 180,
        ca = Math.cos(a),
        sa = Math.sin(a),
        I = inset / g;
      const inside = (X, Y) => {
        const gx = (X - ox) / g,
          gy = (Y - oy) / g,
          cx = Math.round(gx),
          cy = Math.round(gy);
        if (cx < 0 || cy < 0 || cx >= w || cy >= h) return false;
        return lab[cy * w + cx] === id && bilinear(dist, w, h, gx, gy) >= I;
      };
      const corners = [
        [bx0[id], by0[id]],
        [bx1[id] + 1, by0[id]],
        [bx0[id], by1[id] + 1],
        [bx1[id] + 1, by1[id] + 1],
      ].map(([x, y]) => [ox + x * g, oy + y * g]);
      let u0 = Infinity,
        u1 = -Infinity,
        v0 = Infinity,
        v1 = -Infinity;
      for (const [X, Y] of corners) {
        const u = X * ca + Y * sa,
          v = -X * sa + Y * ca;
        u0 = Math.min(u0, u);
        u1 = Math.max(u1, u);
        v0 = Math.min(v0, v);
        v1 = Math.max(v1, v);
      }
      const P = (u, v) => [u * ca - v * sa, u * sa + v * ca],
        du = g / 2,
        rows = [];
      const edge = (uIn, uOut, v) => {
        for (let k = 0; k < 12; k++) {
          const um = (uIn + uOut) / 2;
          if (inside(...P(um, v))) uIn = um;
          else uOut = um;
        }
        return uIn;
      };
      // rows centred across the area, so the two edges are left the same (a solid fill reaches both)
      let lo = Infinity,
        hi = -Infinity;
      for (let y = by0[id]; y <= by1[id]; y++)
        for (let x = bx0[id]; x <= bx1[id]; x++) {
          const i = y * w + x;
          if (lab[i] !== id || dist[i] < I) continue;
          const v = -(ox + x * g) * sa + (oy + y * g) * ca;
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      if (!(hi >= lo)) return [];
      const nr = Math.floor((hi - lo) / sp + 1e-9),
        first = lo + (hi - lo - nr * sp) / 2;
      for (let k = 0; k <= nr; k++) {
        const v = first + k * sp,
          runs = [];
        let start = null,
          prev = u0 - du;
        for (let u = u0; u <= u1 + du; u += du) {
          const inn = inside(...P(u, v));
          if (inn && start === null) start = edge(u, prev, v);
          else if (!inn && start !== null) {
            const end = edge(prev, u, v);
            if (end - start > Math.min(sp, inset) * 0.5) runs.push([start, end]);
            start = null;
          }
          prev = u;
        }
        if (runs.length) rows.push(runs.map(([s, e]) => [...P(s, v), ...P(e, v)]));
      }
      return rows;
    };
    // closed contours of the distance from the line at level Lg (grid units) inside area id, in mm, simplified to
    // within g/4, as flat polylines [x0, y0, x1, y1, …] that end where they start
    const contours = (id, Lg) =>
      isoContours(dist, lab, id, Lg, w, h, box, ox, oy, g).map((P) => {
        P.push(P[0]);
        const sm = UNB.simplify(
            Float64Array.from(P, (q) => q[0]),
            Float64Array.from(P, (q) => q[1]),
            g / 4,
            false
          ),
          flat = [];
        for (let k = 0; k < sm.x.length; k++) flat.push(sm.x[k], sm.y[k]);
        return flat;
      });
    // Tone: opt.tone = { w, h, d (darkness 0–1 per pixel), a, bx, by } with pixel = (x·a + bx, y·a + by). A pen with
    // tone on
    // draws every stroke where the image is darkest, every other one at half darkness, every fourth at a quarter …:
    // stroke k is kept where the darkness is above its threshold, the van der Corput sequence 0, ½, ¼, ¾, ⅛ …
    const T = o.tone && o.tone.d ? o.tone : null;
    const darkAt = (X, Y) => (T ? bilinear(T.d, T.w, T.h, X * T.a + T.bx, Y * T.a + T.by) : 1);
    const vdc = (k) => {
      let v = 0,
        b = 0.5;
      k = Math.abs(k);
      while (k) {
        if (k & 1) v += b;
        k >>= 1;
        b /= 2;
      }
      return 0.04 + 0.95 * v;
    }; // under 4% dark: paper, no strokes
    // keep the parts of a polyline (flat [x, y, …]) where the darkness is above th; returns polylines
    const toneSplit = (flat, th, straight) => {
      const out = [];
      let cur = null;
      const push = (X, Y, on) => {
        if (on) {
          if (!cur) {
            cur = [];
            out.push(cur);
          }
          cur.push(X, Y);
        } else cur = null;
      };
      for (let i = 0; i + 3 < flat.length; i += 2) {
        const ax = flat[i],
          ay = flat[i + 1],
          bx = flat[i + 2],
          by = flat[i + 3],
          L = Math.hypot(bx - ax, by - ay),
          k = Math.max(1, Math.ceil(L / g));
        for (let s2 = i ? 1 : 0; s2 <= k; s2++) {
          const X = ax + ((bx - ax) * s2) / k,
            Y = ay + ((by - ay) * s2) / k;
          push(X, Y, darkAt(X, Y) > th);
        }
      }
      return out
        .filter((q) => q.length >= 4)
        .map((q) => (straight ? [q[0], q[1], q[q.length - 2], q[q.length - 1]] : q));
    };
    // order strokes (flat polylines) to keep pen-up travel short: nearest next stroke end, either direction
    const order = (strokes) => {
      const left = strokes.slice(),
        out = [];
      let cx = left.length ? left[0][0] : 0,
        cy = left.length ? left[0][1] : 0;
      while (left.length) {
        let bi = 0,
          bd = Infinity,
          flip = false;
        for (let i = 0; i < left.length; i++) {
          const s2 = left[i],
            e = s2.length - 2,
            da = (s2[0] - cx) ** 2 + (s2[1] - cy) ** 2,
            db = (s2[e] - cx) ** 2 + (s2[e + 1] - cy) ** 2;
          if (da < bd) {
            bd = da;
            bi = i;
            flip = false;
          }
          if (db < bd) {
            bd = db;
            bi = i;
            flip = true;
          }
        }
        let t = left.splice(bi, 1)[0];
        if (flip) {
          const r = [];
          for (let k2 = t.length - 2; k2 >= 0; k2 -= 2) r.push(t[k2], t[k2 + 1]);
          t = r;
        }
        out.push(t);
        cx = t[t.length - 2];
        cy = t[t.length - 1];
      }
      return out;
    };
    const seedAreas = [],
      fills = [];
    for (const f of o.fills || []) {
      const ids = (f.seeds || []).map(([X, Y]) => areaAt(X, Y));
      seedAreas.push(ids);
      const fw = Math.max(0.01, f.width || pen),
        sp = Math.max(0.05, f.spacing || fw),
        inset = (pen + fw) / 2,
        strokes = [],
        tone = !!(f.tone && T);
      for (const id of new Set(ids.filter((i) => i >= 0))) {
        if (f.style === "contours") {
          for (let k = 0; k < 100000; k++) {
            const loops = contours(id, (inset + k * sp) / g);
            if (!loops.length) break;
            for (const L of loops) {
              if (tone) strokes.push(...toneSplit(L, vdc(k), false));
              else strokes.push(L);
            }
          }
          continue;
        }
        (f.cross ? [f.angle || 0, (f.angle || 0) + 90] : [f.angle || 0]).forEach((ang, pass) => {
          const rows = hatch(id, inset, sp, ang);
          rows.forEach((runs, k) => {
            for (const r of runs) {
              if (tone) strokes.push(...toneSplit(r, vdc(k + pass), true));
              else strokes.push(r);
            }
          });
        });
      }
      fills.push(order(strokes));
    }
    return { g, ox, oy, w, h, lab, outside: lab[0], count, shapes: shapes.size, bridges, seedAreas, fills };
  };
})(typeof window !== "undefined" ? window : globalThis);
