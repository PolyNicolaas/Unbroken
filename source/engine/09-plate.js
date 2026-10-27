/* Unbroken · engine · 09-plate.js
   8. Size, plate and layers — smallest size that keeps the spacing, the box round a design, copies packed on the plate,
   layers stacked into one 3D path.
   One part of the engine (no DOM), loaded after 08-shape.js; core.js lists every part and what's in it. */
(function (root) {
  "use strict";
  const UNB = root.UNB,
    { cumLength, cellGrid } = UNB._u; // shared helpers (00-util.js)

  // Smallest print: the smallest output width at which the drawing prints with its spacing kept and its shape intact.
  // Each width tried is the real print at that size: the walk offset into strands one spacing apart with a loop at
  // every stroke end (stageSignal), the series fitted with the automatic term count, and the same untangling and
  // spacing the app applies (stageFinal's first step). A width fits when
  //   · the closest gap anywhere, junctions included, is at least 90% of the spacing, and
  //   · that last step didn't have to move the line: 98% of the final line lies within maxShift × drawing width of the
  //     fitted series and 98% of the series within that of the final line (maxShift is the detail level: ~0.022 low,
  //     0.013 medium, 0.007 high), and
  //   · with Allow overlaps, the crossings aren't crowded: their zones (UNB.overlapAllow) add up to no more than the
  //     drawing's box. Below the smallest fitting size, strands crowd and get pushed out of shape; the
  //     preview shows where (UNB.drift, run by stageFinal).
  // walk, w, h: as for stageSignal. opt: spacing (mm), bboxW (drawing width, working px), lineRatio (line width ÷
  // spacing),
  // loop (loop radius ÷ spacing), roundMM (corner radius, mm), termTol, minW, maxW, current (start width, mm),
  // maxShift,
  // maxAngle, minGap, allow, overlaps (Allow overlaps: see UNB.overlapAllow). Slow: every try is a full fit (a few
  // seconds on a big drawing).
  // Brackets on a log scale around the current width, then bisects; yields after every try so a page can stay live.
  UNB.smallestPrintSteps = function* (walk, w, h, opt) {
    const spacing = opt.spacing,
      bw = opt.bboxW,
      minW = opt.minW || 5,
      maxW = opt.maxW || 2000,
      evals = [];
    const nearest98 = (ax, ay, bx, by, cell) => {
      // 98th-percentile distance from the a-points to the nearest b-point
      const G = cellGrid(cell);
      for (let i = 0; i < bx.length; i++) G.add(bx[i], by[i], i);
      const all = new Float64Array(ax.length);
      for (let i = 0; i < ax.length; i++) {
        let best = cell * 2;
        G.near(ax[i], ay[i], (j) => {
          const dd = Math.hypot(bx[j] - ax[i], by[j] - ay[i]);
          if (dd < best) best = dd;
        });
        all[i] = best;
      }
      all.sort();
      return all[Math.floor(0.98 * (all.length - 1))] || 0;
    };
    const maxShift = (opt.maxShift || 0.013) * bw;
    const test = (W) => {
      const d = spacing / (W / bw);
      const sg = UNB.stageSignal(walk, d, w, h, {
          w: d * (opt.lineRatio || 0.6),
          loop: opt.loop,
          round: (opt.roundMM || 0) / (W / bw),
        }),
        open = sg.open,
        n0 = open ? sg.S / 2 + 1 : sg.S,
        sp = sg.sp;
      const { N, curve: c } = UNB.autoTerms(sp.ax, sp.order, sg.Nmax, sg.jumpS, open, opt.termTol);
      const re = c.re.slice(0, n0),
        im = c.im.slice(0, n0),
        closed = !open;
      const u = UNB.shapeLine(re, im, closed, {
        d,
        unx: opt.maxAngle == null ? 90 : opt.maxAngle,
        minGap: opt.minGap,
        allow: opt.allow,
        overlaps: opt.overlaps,
      });
      const gap = UNB.closestGap(u.re, u.im, d * 1.5, closed, u.allow),
        cell = Math.max(2, 2 * d, 2 * maxShift);
      const moved = nearest98(u.re, u.im, re, im, cell),
        lost = nearest98(re, im, u.re, u.im, cell);
      // (with Allow overlaps, the crossings' zones may not add up to more than the drawing: smaller, it is all overlap)
      const crowd = (u.allow && u.allow.crowd) || 0,
        fits = gap >= 0.9 * d && moved <= maxShift && lost <= maxShift && crowd <= 1;
      evals.push({ width: W, fits, gap: gap / d, moved, lost, limit: maxShift, terms: N, crowd });
      return fits;
    };
    if (!(spacing > 0)) return { width: null, fits: false, evals };
    let lo = null,
      hi = null,
      W = Math.min(maxW, Math.max(minW, opt.current || 100)),
      ok = test(W);
    yield { tries: evals.length, width: W };
    if (ok) {
      hi = W;
      while (W > minW) {
        W = Math.max(minW, W / 1.6);
        ok = test(W);
        yield { tries: evals.length, width: W };
        if (ok) hi = W;
        else {
          lo = W;
          break;
        }
      }
    } else {
      lo = W;
      while (W < maxW) {
        W = Math.min(maxW, W * 1.6);
        ok = test(W);
        yield { tries: evals.length, width: W };
        if (ok) {
          hi = W;
          break;
        }
        lo = W;
      }
    }
    if (hi === null) return { width: maxW, fits: false, evals };
    if (lo === null) return { width: hi, fits: true, evals };
    for (let i = 0; i < 6 && hi / lo > 1.02; i++) {
      const mid = Math.sqrt(lo * hi);
      ok = test(mid);
      yield { tries: evals.length, width: mid };
      if (ok) hi = mid;
      else lo = mid;
    }
    return { width: hi, fits: true, evals };
  };

  // Smallest box around a drawing, at any angle
  // Convex hull (monotone chain), then rotating calipers: the minimum-area rectangle always has one side along a
  // hull edge. `pad` grows the box on every side (half the line width, so it measures the chocolate's outer edge).
  // Returns corners (in order), w along `angle` (degrees, -45..45, the side closest to horizontal), h, area.
  // The hull uses every point; the caliper step checks every hull edge against every hull point (hulls are small).
  UNB.minBox = function (re, im, pad) {
    pad = pad || 0;
    const n = re.length,
      pts = [];
    for (let i = 0; i < n; i++) pts.push([re[i], im[i]]);
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [],
      upper = [];
    for (const p of pts) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    // (2 points when the line is straight: the box runs along it)
    const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
    const dot = () => {
      const p = hull[0] || pts[0] || [0, 0];
      return {
        corners: [p, p, p, p].map(([x, y], i) => [x + (i === 1 || i === 2 ? pad : -pad), y + (i >= 2 ? pad : -pad)]),
        w: 2 * pad,
        h: 2 * pad,
        angle: 0,
        area: 4 * pad * pad,
      };
    };
    if (hull.length < 2) return dot();
    let best = null;
    for (let i = 0; i < hull.length; i++) {
      const a = hull[i],
        b = hull[(i + 1) % hull.length],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (!L) continue;
      const ux = (b[0] - a[0]) / L,
        uy = (b[1] - a[1]) / L;
      let u0 = Infinity,
        u1 = -Infinity,
        v0 = Infinity,
        v1 = -Infinity;
      for (const p of hull) {
        const u = p[0] * ux + p[1] * uy,
          v = -p[0] * uy + p[1] * ux;
        u0 = Math.min(u0, u);
        u1 = Math.max(u1, u);
        v0 = Math.min(v0, v);
        v1 = Math.max(v1, v);
      }
      const area = (u1 - u0 + 2 * pad) * (v1 - v0 + 2 * pad);
      if (!best || area < best.area - 1e-9)
        best = { area, ux, uy, u0: u0 - pad, u1: u1 + pad, v0: v0 - pad, v1: v1 + pad };
    }
    if (!best) return dot(); // every point in one place
    // express along the side closest to horizontal, angle in -45..45
    let { ux, uy, u0, u1, v0, v1 } = best,
      ang = (Math.atan2(uy, ux) * 180) / Math.PI;
    while (ang > 45) {
      [ux, uy] = [uy, -ux];
      [u0, u1, v0, v1] = [-v1, -v0, u0, u1];
      ang -= 90;
    }
    while (ang <= -45) {
      [ux, uy] = [-uy, ux];
      [u0, u1, v0, v1] = [v0, v1, -u1, -u0];
      ang += 90;
    }
    const P = (u, v) => [u * ux - v * uy, u * uy + v * ux];
    return {
      corners: [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)],
      w: u1 - u0,
      h: v1 - v0,
      angle: ang,
      area: best.area,
    };
  };

  // Plate layout: rotate to fit and pack copies
  // x, y: the design's line in mm, y up (any origin). opt: bedW, bedH, copies (≥1), gap (mm between footprints),
  // pad (mm added around the line: half the line width), straight (true = never rotate), extraAngles (degrees to try
  // as well, e.g. the smallest box's angle).
  // Picks the rotation that fits the most copies (straight preferred when it fits them all; ties → smaller
  // footprint), packs them in rows and centres the block. Returns the angle (degrees, counter-clockwise),
  // footprint w × h, how many fit, the placed copies' front-left corners, and the rotated line in footprint
  // coordinates (front-left corner of the footprint at 0, 0).
  UNB.plateLayout = function (x, y, opt) {
    const W = opt.bedW,
      H = opt.bedH,
      n = Math.max(1, opt.copies | 0),
      g = Math.max(0, opt.gap || 0),
      pad = opt.pad || 0;
    const m = x.length; // every point is measured: a thinned line can underestimate the footprint
    let cx = 0,
      cy = 0;
    for (let i = 0; i < m; i++) {
      cx += x[i];
      cy += y[i];
    }
    cx /= m;
    cy /= m;
    const extent = (deg) => {
      const a = (deg * Math.PI) / 180,
        c = Math.cos(a),
        s = Math.sin(a);
      let x0 = Infinity,
        x1 = -Infinity,
        y0 = Infinity,
        y1 = -Infinity;
      for (let i = 0; i < m; i++) {
        const dx = x[i] - cx,
          dy = y[i] - cy,
          u = dx * c - dy * s,
          v = dx * s + dy * c;
        if (u < x0) x0 = u;
        if (u > x1) x1 = u;
        if (v < y0) y0 = v;
        if (v > y1) y1 = v;
      }
      return { w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
    };
    const cap = (w, h) => (w > W || h > H ? 0 : Math.floor((W + g) / (w + g)) * Math.floor((H + g) / (h + g)));
    const cands = opt.straight ? [0] : [0, 90];
    if (!opt.straight) {
      for (let d = 2; d < 180; d += 2) if (d !== 90) cands.push(d);
      // e.g. the smallest box's exact angle
      for (const e of opt.extraAngles || []) for (const d of [e, e + 90]) cands.push(((d % 180) + 180) % 180);
    }
    // straight if that fits every copy; otherwise the angle that fits the most, then the smallest footprint
    const all = cands.map((d) => {
      const e = extent(d);
      return { d, k: cap(e.w, e.h), area: e.w * e.h, ...e };
    });
    let best = all[0];
    if (Math.min(best.k, n) < n)
      for (const c2 of all) {
        const f = Math.min(c2.k, n),
          fb = Math.min(best.k, n);
        if (f > fb || (f === fb && c2.area < best.area - 1e-9)) best = c2;
      }
    // rotated line in footprint coordinates
    const a = (best.d * Math.PI) / 180,
      c = Math.cos(a),
      s = Math.sin(a),
      lx = new Float64Array(m),
      ly = new Float64Array(m);
    let x0 = Infinity,
      y0 = Infinity;
    for (let i = 0; i < m; i++) {
      const dx = x[i] - cx,
        dy = y[i] - cy;
      lx[i] = dx * c - dy * s;
      ly[i] = dx * s + dy * c;
      if (lx[i] < x0) x0 = lx[i];
      if (ly[i] < y0) y0 = ly[i];
    }
    for (let i = 0; i < m; i++) {
      lx[i] += pad - x0;
      ly[i] += pad - y0;
    }
    // pack: as many per row as fit, block centred on the plate
    const fits = Math.min(n, best.k),
      cols = Math.max(1, Math.min(fits || 1, Math.floor((W + g) / (best.w + g)) || 1)),
      rows = Math.ceil(Math.max(1, fits) / cols);
    const bw = cols * best.w + (cols - 1) * g,
      bh = rows * best.h + (rows - 1) * g,
      ox = (W - bw) / 2,
      oy = (H - bh) / 2,
      placed = [];
    for (let i = 0; i < Math.max(1, fits); i++) {
      const r = Math.floor(i / cols),
        q = i % cols;
      placed.push({ x: ox + q * (best.w + g), y: oy + (rows - 1 - r) * (best.h + g) });
    }
    return {
      angle: best.d,
      w: best.w,
      h: best.h,
      capacity: best.k,
      fits,
      copies: n,
      placed,
      local: { x: lx, y: ly },
      xf: { cx, cy, angle: best.d, sx: pad - x0, sy: pad - y0 },
    };
  };
  // Plate layout for different pieces (each line of a text printed as its own piece): every piece is turned the same
  // way (straight, or a quarter turn when that fits more) about its own middle, then the pieces are laid in reading
  // order, one set after another (copies = sets), left to right in rows from the back of the plate, each row as tall
  // as its tallest piece; the block is centred. Pieces that don't fit go on in more rows past the front edge, so they
  // show as off the plate rather than being left out.
  // pieces: [{ x, y }] in mm, y up (any origin). opt: bedW, bedH, copies (sets, ≥1), gap, pad, straight.
  // Returns { angle, pieces: [{ w, h, local, xf }], placed: [{ x, y, piece }], copies (pieces placed in all), fits
  // (how many of them are on the plate), sets, w, h (the block) }.
  UNB.plateLayoutPieces = function (pieces, opt) {
    const W = opt.bedW,
      H = opt.bedH,
      sets = Math.max(1, opt.copies | 0),
      g = Math.max(0, opt.gap || 0),
      pad = opt.pad || 0,
      k = pieces.length;
    const turn = (q, deg) => {
      // one piece turned about its centre, moved so its footprint starts at 0, 0
      const m = q.x.length,
        a = (deg * Math.PI) / 180,
        c = Math.cos(a),
        s = Math.sin(a);
      let cx = 0,
        cy = 0;
      for (let i = 0; i < m; i++) {
        cx += q.x[i];
        cy += q.y[i];
      }
      cx /= m || 1;
      cy /= m || 1;
      const lx = new Float64Array(m),
        ly = new Float64Array(m);
      let x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity;
      for (let i = 0; i < m; i++) {
        const dx = q.x[i] - cx,
          dy = q.y[i] - cy;
        lx[i] = dx * c - dy * s;
        ly[i] = dx * s + dy * c;
        x0 = Math.min(x0, lx[i]);
        x1 = Math.max(x1, lx[i]);
        y0 = Math.min(y0, ly[i]);
        y1 = Math.max(y1, ly[i]);
      }
      for (let i = 0; i < m; i++) {
        lx[i] += pad - x0;
        ly[i] += pad - y0;
      }
      return {
        w: x1 - x0 + 2 * pad,
        h: y1 - y0 + 2 * pad,
        local: { x: lx, y: ly },
        xf: { cx, cy, angle: deg, sx: pad - x0, sy: pad - y0 },
      };
    };
    const pack = (deg) => {
      const P = pieces.map((q) => turn(q, deg)),
        rows = [];
      let row = null;
      for (let s = 0; s < sets; s++)
        for (let i = 0; i < k; i++) {
          const p = P[i];
          if (!row || (row.items.length && row.w + g + p.w > W)) rows.push((row = { items: [], w: 0, h: 0 }));
          row.items.push({ piece: i, dx: row.items.length ? row.w + g : 0 });
          row.w = (row.items.length > 1 ? row.w + g : 0) + p.w;
          row.h = Math.max(row.h, p.h);
        }
      // rows that fit from the back of the plate; the block is centred on them
      let used = 0,
        onPlate = 0,
        fits = 0;
      for (const r of rows) {
        const need = used + (onPlate ? g : 0) + r.h;
        if (need > H || r.w > W) break;
        used = need;
        onPlate++;
        fits += r.items.length;
      }
      const bw = Math.max(0, ...rows.map((r) => r.w)),
        ox = (W - Math.min(bw, W)) / 2,
        top = H - (H - used) / 2,
        placed = [];
      let y = top;
      for (const r of rows) {
        y -= r.h;
        for (const it of r.items) placed.push({ x: ox + it.dx, y: y + (r.h - P[it.piece].h) / 2, piece: it.piece });
        y -= g;
      }
      return { angle: deg, pieces: P, placed, fits, copies: sets * k, sets, w: bw, h: 0 };
    };
    let best = pack(0);
    if (!opt.straight && best.fits < best.copies) {
      const q = pack(90);
      if (q.fits > best.fits) best = q;
    }
    const ys = best.placed.map((p) => p.y);
    best.h = Math.max(...best.placed.map((p) => p.y + best.pieces[p.piece].h)) - Math.min(...ys);
    return best;
  };

  // another line (mm, same frame as the one laid out) moved into a layout's footprint coordinates, the same way
  UNB.plateLocal = function (x, y, xf) {
    const a = (xf.angle * Math.PI) / 180,
      c = Math.cos(a),
      s = Math.sin(a),
      n = x.length,
      lx = new Float64Array(n),
      ly = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const dx = x[i] - xf.cx,
        dy = y[i] - xf.cy;
      lx[i] = dx * c - dy * s + xf.sx;
      ly[i] = dx * s + dy * c + xf.sy;
    }
    return { x: lx, y: ly };
  };

  // Layers: the printed lines stacked into one continuous 3D path (mm, z from the first layer's nozzle height).
  // The flow can't stop, so every layer runs straight into the next.
  //   · Base layers (a filled line; with "lines" infill the variants alternate, turned 90°) are flat, one layer height
  //     apart: different paths can't spiral onto each other. Between two base layers the line steps up one layer
  //     height on the short link from one layer's end to the next one's start (both at the drawing's start point).
  //   · The first wall layer is flat too when there is no base (it is the first layer).
  //   · Then the walls spiral: the same line, Z rising steadily round each lap, one layer height per lap, so every
  //     point sits one layer height above the same point of the lap below. The first spiral lap starts on the flat
  //     layer below and climbs to one layer height above it, so its flow ramps up from 0 to full (E ×0→1); a last
  //     flat lap at the top height evens the rim, its flow ramping back down (E ×1→0).
  // opt: base (array of lines, used in turn; [] for none), baseLayers, wall (a line) or walls (a line per wall layer,
  // e.g. a sliced model; the last one repeats), wallLayers, h (layer height),
  // open (lines are open paths: every other lap runs backwards, each layer flat, stepping straight up at the ends).
  // A line is { x, y } in mm.
  // Returns { x, y, z, e, laps: [{ kind, from, to, z0, z1, length }], height } — e is the flow multiplier per point
  // (0–1),
  // height the top of the last layer above the first.
  UNB.layerStack = function (opt) {
    const h = opt.h,
      open = !!opt.open,
      N = opt.base && opt.base.length ? Math.max(0, opt.baseLayers | 0) : 0,
      M = Math.max(0, opt.wallLayers | 0);
    const X = [],
      Y = [],
      Z = [],
      E = [],
      laps = [];
    const lapPts = (line, rev) => {
      // a lap's points in order (closed lines come back to their start)
      const n = line.x.length,
        out = [];
      for (let i = 0; i < n; i++) {
        const k = rev ? n - 1 - i : i;
        out.push([line.x[k], line.y[k]]);
      }
      if (!open && n > 1) out.push(out[0].slice());
      return out;
    };
    const addLap = (kind, P, zf, ef) => {
      // zf(s), ef(s): height and flow along the lap, s = 0…1
      const c = cumLength(
          P.map((p) => p[0]),
          P.map((p) => p[1]),
          false
        ),
        len = c[P.length],
        L = len || 1,
        from = X.length;
      P.forEach(([x, y], i) => {
        const s = c[i] / L;
        X.push(x);
        Y.push(y);
        Z.push(zf(s));
        E.push(ef(s));
      });
      laps.push({ kind, from, to: X.length - 1, z0: zf(0), z1: zf(1), length: len });
    };
    let lap = 0;
    // a line per wall layer (a sliced model), or the same one
    const wallAt = (i) => (opt.walls && opt.walls.length ? opt.walls[Math.min(i, opt.walls.length - 1)] : opt.wall);
    for (let i = 0; i < N; i++, lap++) {
      const z = i * h,
        P = lapPts(opt.base[i % opt.base.length], open && lap % 2 === 1);
      addLap(
        "base",
        P,
        () => z,
        () => 1
      );
    }
    if (M > 0 && open) {
      // an open line can't spiral: each layer is flat, and at its end the needle steps straight up one layer and
      // traces the line back the other way (no lift, no stop). Same height as the spiral, full flow throughout.
      for (let j = 0; j < M; j++, lap++) {
        const z = (N + j) * h,
          P = lapPts(wallAt(j), lap % 2 === 1);
        addLap(
          "wall",
          P,
          () => z,
          () => 1
        );
      }
    } else if (M > 0) {
      let zf = (N - 1) * h,
        spiral = M; // the flat layer the spiral starts on
      if (N === 0) {
        addLap(
          "wall",
          lapPts(wallAt(0), false),
          () => 0,
          () => 1
        );
        lap++;
        zf = 0;
        spiral = M - 1;
      }
      for (let j = 0; j < spiral; j++, lap++) {
        const P = lapPts(wallAt(N === 0 ? j + 1 : j), open && lap % 2 === 1),
          z0 = zf + j * h;
        addLap(j === 0 ? "wall-start" : "wall", P, (s) => z0 + h * s, j === 0 ? (s) => s : () => 1);
      }
      if (spiral > 0) {
        const zt = zf + spiral * h,
          P = lapPts(wallAt(M - 1), open && lap % 2 === 1);
        addLap(
          "wall-finish",
          P,
          () => zt,
          (s) => 1 - s
        );
      }
    }
    return {
      x: Float64Array.from(X),
      y: Float64Array.from(Y),
      z: Float64Array.from(Z),
      e: Float64Array.from(E),
      laps,
      height: Z.reduce((a, b) => Math.max(a, b), 0),
    }; // (not Math.max(...Z): too many arguments for a long stack)
  };

  // Time per layer: chocolate needs time to set before the next layer lands on it. Each lap (one layer) is slowed so
  // it takes at least minTime seconds, as choc OS does ("time per layer"), but never below minFeed (mm/min); laps
  // that would need to go slower than that are counted in `short`, by layer: the rim lap ("wall-finish") evens the top
  // of the last layer, so it isn't counted on its own. Returns { f (mm/min per point: the feed of the move ending
  // there),
  // short, seconds (the whole stack) }.
  UNB.lapFeeds = function (stack, feed, minTime, minFeed) {
    const f = new Float64Array(stack.x.length).fill(feed);
    let short = 0,
      seconds = 0;
    for (const l of stack.laps) {
      let v = minTime > 0 && l.length > 0 ? Math.min(feed, (l.length / minTime) * 60) : feed;
      if (v < minFeed) {
        v = Math.min(feed, minFeed);
        if (l.kind !== "wall-finish") short++;
      }
      for (let i = l.from; i <= l.to; i++) f[i] = v;
      seconds += (l.length / v) * 60;
    }
    return { f, short, seconds };
  };

  // A test print: numbered strips side by side, each the same small serpentine a few layers tall, with one setting
  // stepped from strip to strip, so one print compares them. o: vary ("layerH" | "speed" | "gap" | "flow"), values
  // (one per strip: mm, mm/s, mm, %), w (line width mm), gap (mm), h (layer height mm), feed (mm/min), layers, rows,
  // length (mm), stripGap (mm). Strip k has k+1 teeth in a comb printed in front of it (its number), first layer only.
  // Layers go round all the strips before stepping up, so each has time to set; every strip-layer is its own flat path
  // (the needle lifts and retracts between them). Paths are for UNB.exportGcode: x, y (mm, from 0,0), z (above the
  // first
  // layer), e (flow × the export's E per mm), f (mm/min). Returns { paths, strips: [{ x, y, w, h, value }], w, h,
  // roundSeconds (one layer of every strip) }.
  UNB.testStrips = function (o) {
    const vals = o.values,
      n = vals.length,
      rows = Math.max(2, o.rows | 0 || 6),
      L = o.length || 25,
      layers = Math.max(1, o.layers | 0 || 5);
    const strips = [],
      paths = [],
      tooth = 3,
      comb = 2.5; // comb: teeth 3 mm tall, 2.5 mm apart
    let x = 0,
      roundT = 0,
      H = 0;
    const one = vals.map((v) => {
      const s = o.w + (o.vary === "gap" ? v : o.gap),
        h = o.vary === "layerH" ? v : o.h,
        f = o.vary === "speed" ? v * 60 : o.feed;
      const e = (o.vary === "flow" ? v / 100 : 1) * (o.vary === "layerH" ? v / o.h : 1);
      return { s, h, f, e, w: (rows - 1) * s };
    });
    one.forEach((q, k) => {
      strips.push({ x, y: tooth + comb, w: Math.max(q.w, (k + 1) * comb), h: L, value: vals[k] });
      x += strips[k].w + (o.stripGap || 8);
    });
    const flat = (xs, ys, z, q) => ({
      x: Float64Array.from(xs),
      y: Float64Array.from(ys),
      z: new Float64Array(xs.length).fill(z),
      e: new Float64Array(xs.length).fill(q.e),
      f: new Float64Array(xs.length).fill(Math.round(q.f)),
    });
    for (let j = 0; j < layers; j++)
      one.forEach((q, k) => {
        const S = strips[k],
          z = (j + 1) * q.h - o.h; // the export adds the first layer's Z (o.h)
        if (j === 0) {
          // the number: k + 1 teeth along the front
          const cx = [],
            cy = [];
          for (let t = 0; t <= k; t++) {
            const tx = S.x + t * comb;
            cx.push(tx, tx, tx + comb / 2, tx + comb / 2);
            cy.push(0, tooth, tooth, 0);
          }
          paths.push(flat(cx, cy, z, q));
        }
        const xs = [],
          ys = [];
        for (let r = 0; r < rows; r++) {
          const rx = S.x + r * q.s,
            up = r % 2 === 0;
          xs.push(rx, rx);
          ys.push(S.y + (up ? 0 : L), S.y + (up ? L : 0));
        }
        if (j % 2) {
          xs.reverse();
          ys.reverse();
        } // every other layer runs back the way it came
        const p = flat(xs, ys, z, q);
        p.laps = [{ from: 0, to: xs.length - 1, kind: "wall", length: rows * L + (rows - 1) * q.s }];
        paths.push(p);
        if (z + o.h > H) H = z + o.h;
        if (j === 0) roundT += ((rows * L + (rows - 1) * q.s) / q.f) * 60;
      });
    return { paths, strips, w: x - (o.stripGap || 8), h: tooth + comb + L, height: H, roundSeconds: roundT };
  };
})(typeof window !== "undefined" ? window : globalThis);
