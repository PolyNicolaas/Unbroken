/* Unbroken · engine · 17-vase.js
   16. Vases — a vase made in the app instead of loaded as an STL: a profile curve (the radius at each height, edited
   by hand) turned round the middle, a surface texture on the wall (ribs, rings), and a movement pattern the needle
   makes along its path (a wave, a zigzag, loops), shifted from layer to layer. The path is written directly, one lap
   per layer, so it is exactly the line that prints (no slicing, no inset): the profile is the middle of the bead.
   One part of the engine (no DOM), loaded after 16-molecule.js; core.js lists every part and what's in it. */
(function (root) {
  "use strict";
  const UNB = root.UNB,
    { segDist2, startNearest } = UNB._u; // shared helpers (00-util.js)

  // ---------- the vase's settings ----------
  // V = { height (mm), profile: [[t, r], …] (t: share of the height, 0 at the plate to 1 at the rim, rising; r: mm
  // from the middle to the middle of the bead), texture: { kind: "none" | "ribs" | "rings", count (ribs round),
  // depth (mm, crest to trough), twist (degrees the ribs turn from bottom to top), spacing (mm between rings) },
  // move: { kind: "none" | "wave" | "zigzag" | "loops", size (mm: how far the needle moves off the wall, or a loop's
  // radius), count (how many round each lap), shift (share of one movement each layer moves on: 0 stacks them in
  // columns, 0.5 alternates them) } }
  UNB.VASE_SHAPES = {
    cylinder: {
      name: "Cylinder",
      profile: [
        [0, 15],
        [0.5, 15],
        [1, 15],
      ],
    },
    bulb: {
      name: "Bulb",
      profile: [
        [0, 12],
        [0.35, 19],
        [0.8, 10],
        [1, 11],
      ],
    },
    tulip: {
      name: "Tulip",
      profile: [
        [0, 9],
        [0.4, 14],
        [0.75, 15],
        [1, 18],
      ],
    },
    bowl: {
      name: "Bowl",
      profile: [
        [0, 10],
        [0.5, 19],
        [1, 24],
      ],
    },
  };
  UNB.vaseDefaults = function () {
    return {
      height: 40,
      profile: UNB.VASE_SHAPES.bulb.profile.map((p) => p.slice()),
      texture: { kind: "none", count: 12, depth: 1.5, twist: 0, spacing: 4 },
      move: { kind: "wave", size: 0.5, count: 16, shift: 0 },
    };
  };
  // the smallest radius anything is made at (mm): a vase narrower than this has no inside to print round
  const VASE_MIN_R = 1;

  // ---------- the profile: the radius at each height ----------
  // A smooth curve through the profile's points (a cubic between each pair, its slope at a point the mean of the
  // straight slopes either side, so it passes through every point and bends gently), t clamped to 0–1.
  UNB.vaseRadius = function (profile, t) {
    const P = profile,
      n = P.length;
    if (!n) return 10;
    if (n === 1 || t <= P[0][0]) return Math.max(VASE_MIN_R, P[0][1]);
    if (t >= P[n - 1][0]) return Math.max(VASE_MIN_R, P[n - 1][1]);
    let i = 0;
    while (i < n - 2 && t > P[i + 1][0]) i++;
    const slope = (a, b) => (P[b][1] - P[a][1]) / Math.max(1e-9, P[b][0] - P[a][0]),
      m = (k) => (k === 0 ? slope(0, 1) : k === n - 1 ? slope(n - 2, n - 1) : (slope(k - 1, k) + slope(k, k + 1)) / 2);
    const t0 = P[i][0],
      t1 = P[i + 1][0],
      dt = Math.max(1e-9, t1 - t0),
      s = (t - t0) / dt,
      s2 = s * s,
      s3 = s2 * s;
    const r =
      (2 * s3 - 3 * s2 + 1) * P[i][1] +
      (s3 - 2 * s2 + s) * dt * m(i) +
      (-2 * s3 + 3 * s2) * P[i + 1][1] +
      (s3 - s2) * dt * m(i + 1);
    return Math.max(VASE_MIN_R, r);
  };
  // a profile kept in order: t rising from exactly 0 to exactly 1, radii in 1–500 mm, at least two points
  UNB.vaseProfile = function (profile) {
    const P = (profile || [])
      .filter((p) => p && isFinite(p[0]) && isFinite(p[1]))
      .map((p) => [Math.min(1, Math.max(0, +p[0])), Math.min(500, Math.max(VASE_MIN_R, +p[1]))])
      .sort((a, b) => a[0] - b[0]);
    if (P.length < 2) return UNB.VASE_SHAPES.cylinder.profile.map((p) => p.slice());
    P[0][0] = 0;
    P[P.length - 1][0] = 1;
    for (let i = 1; i < P.length - 1; i++) P[i][0] = Math.min(Math.max(P[i][0], P[i - 1][0] + 0.01), 0.99);
    return P;
  };

  // ---------- one lap ----------
  // the movement's shape over one of its repeats, c in cycles: a wave (sine) or a zigzag (straight runs, sharp
  // turns), −1…1
  const vaseWiggle = (kind, c) => {
    const f = c - Math.floor(c);
    if (kind === "zigzag") return 1 - 4 * Math.abs(f - 0.5);
    return Math.sin(2 * Math.PI * f);
  };
  // The wall at lap coordinate u (layer number; a fraction between layers) and height z (mm): the profile's radius
  // with the surface texture, n points evenly round (anticlockwise from +x). Returns { x, y } (mm).
  function vaseRing(V, z, n) {
    const H = Math.max(0.5, V.height),
      t = Math.min(1, Math.max(0, z / H)),
      T = V.texture || {},
      base = UNB.vaseRadius(V.profile, t),
      x = new Float64Array(n),
      y = new Float64Array(n);
    const ribs = T.kind === "ribs" && T.count > 0 && T.depth > 0,
      rings = T.kind === "rings" && T.spacing > 0 && T.depth > 0,
      tw = (((+T.twist || 0) * Math.PI) / 180) * t,
      ringR = rings ? (T.depth / 2) * Math.cos((2 * Math.PI * z) / T.spacing) : 0;
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n;
      let r = base + ringR;
      if (ribs) r += (T.depth / 2) * Math.cos(Math.round(T.count) * (a - tw));
      r = Math.max(VASE_MIN_R, r);
      x[i] = r * Math.cos(a);
      y[i] = r * Math.sin(a);
    }
    return { x, y };
  }
  // One wall lap at layer k (z: its nozzle height, h: the layer height): the wall from z to z + h (each point at the
  // height it prints at, as the spiral climbs), resampled evenly along its length, and the movement added across it
  // (wave, zigzag: in and out, along the outward normal; loops: a circle swept along it). n points, the movement's
  // phase continuing from lap to lap (cycles = count × share of the lap + shift × layer), so lap k ends where lap
  // k + 1 starts. Returns { x, y } (mm).
  function vaseLap(V, k, z, h, n) {
    const M = V.move || {},
      m = M.kind && M.kind !== "none" && M.size > 0 ? Math.max(1, Math.round(M.count || 1)) : 0;
    // the wall round this lap, finely, its height rising one layer as it goes round
    const F = Math.max(n, 720),
      R0 = vaseRing(V, z, F),
      R1 = vaseRing(V, z + h, F),
      wx = new Float64Array(F + 1),
      wy = new Float64Array(F + 1),
      cl = new Float64Array(F + 1);
    for (let i = 0; i <= F; i++) {
      const j = i % F,
        s = i / F;
      wx[i] = (1 - s) * R0.x[j] + s * R1.x[j];
      wy[i] = (1 - s) * R0.y[j] + s * R1.y[j];
      if (i) cl[i] = cl[i - 1] + Math.hypot(wx[i] - wx[i - 1], wy[i] - wy[i - 1]);
    }
    const L = cl[F] || 1,
      x = new Float64Array(n),
      y = new Float64Array(n);
    let j = 0;
    for (let i = 0; i < n; i++) {
      const s = (i / n) * L;
      while (j < F - 1 && cl[j + 1] < s) j++;
      const a = (s - cl[j]) / Math.max(1e-12, cl[j + 1] - cl[j]),
        px = wx[j] + a * (wx[j + 1] - wx[j]),
        py = wy[j] + a * (wy[j + 1] - wy[j]);
      if (!m) {
        x[i] = px;
        y[i] = py;
        continue;
      }
      // direction of travel (anticlockwise round) and outward normal (on its right)
      let tx = wx[j + 1] - wx[j],
        ty = wy[j + 1] - wy[j];
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const nx = ty,
        ny = -tx,
        cyc = m * (i / n) + (+M.shift || 0) * k;
      if (M.kind === "loops") {
        // a circle of radius `size` swept along the wall, centred on it: on the outside of each turn the circle runs
        // backwards faster than the wall goes forwards, so the line loops (crossing itself) once the size is more than
        // the spacing between loops ÷ 2π; smaller, it's a wave that leans
        const ph = 2 * Math.PI * (cyc - Math.floor(cyc)),
          along = -M.size * Math.sin(ph),
          out = M.size * Math.cos(ph);
        x[i] = px + along * tx + out * nx;
        y[i] = py + along * ty + out * ny;
      } else {
        const d = M.size * vaseWiggle(M.kind, cyc);
        x[i] = px + d * nx;
        y[i] = py + d * ny;
      }
    }
    return { x, y };
  }
  // does a closed lap cross itself? (checked on at most 360 of its points)
  function vaseCrosses(L) {
    const n = L.x.length,
      st = Math.max(1, Math.ceil(n / 360)),
      P = [];
    for (let i = 0; i < n; i += st) P.push([L.x[i], L.y[i]]);
    const m = P.length,
      side = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    for (let i = 0; i < m; i++) {
      const a = P[i],
        b = P[(i + 1) % m];
      for (let j = i + 2; j < m; j++) {
        if (i === 0 && j === m - 1) continue;
        const c = P[j],
          d = P[(j + 1) % m];
        if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) return true;
      }
    }
    return false;
  }
  // points per lap: about every 0.25 mm along the widest lap, and at least 24 for each repeat of the movement (32 for
  // loops), 256–6000
  function vaseLapPoints(V) {
    let rmax = 0;
    for (let i = 0; i <= 64; i++) rmax = Math.max(rmax, UNB.vaseRadius(V.profile, i / 64));
    const T = V.texture || {},
      M = V.move || {};
    if (T.kind !== "none") rmax += (T.depth || 0) / 2;
    const L = 2 * Math.PI * rmax * (T.kind === "ribs" ? 1.3 : 1),
      m = M.kind && M.kind !== "none" ? Math.max(1, Math.round(M.count || 1)) : 0;
    return Math.min(6000, Math.max(256, Math.ceil(L / 0.25), m * (M.kind === "loops" ? 32 : 24)));
  }

  // ---------- the checks ----------
  // How far each lap's bead sits off the one below (mm): every point's distance to the nearest piece of the lap below
  // (searched round the same share of the lap, a repeat of the movement either way), outwards or inwards (past the
  // lap below's outward normal). A bead holds over the one below when its middle is within a step (a third of its
  // width by default). Returns { out, outAt, in, inAt } (mm, layer numbers).
  function vaseStacking(laps, first) {
    const r = { out: 0, outAt: -1, in: 0, inAt: -1 };
    for (let k = 1; k < laps.length; k++) {
      const A = laps[k - 1],
        B = laps[k],
        na = A.x.length,
        nb = B.x.length,
        win = Math.min(80, Math.ceil(na / Math.max(1, laps.cycles || 1)) + 6);
      for (let i = 0; i < nb; i++) {
        const c = Math.round((i / nb) * na);
        let best = Infinity,
          side = 0;
        for (let d = -win; d <= win; d++) {
          const a = (((c + d) % na) + na) % na,
            b = (a + 1) % na,
            dd = segDist2(B.x[i], B.y[i], A.x[a], A.y[a], A.x[b], A.y[b]);
          if (dd < best) {
            best = dd;
            // the point right of that piece of the lap below (outside) or left of it (inside)
            const ex = A.x[b] - A.x[a],
              ey = A.y[b] - A.y[a];
            side = ex * (B.y[i] - A.y[a]) - ey * (B.x[i] - A.x[a]) < 0 ? 1 : -1;
          }
        }
        const dist = Math.sqrt(best);
        if (side > 0 && dist > r.out) {
          r.out = dist;
          r.outAt = first + k;
        }
        if (side < 0 && dist > r.in) {
          r.in = dist;
          r.inAt = first + k;
        }
      }
    }
    return r;
  }
  // the tightest turn on any lap (mm: the radius of the circle through three points about half a millimetre apart)
  function vaseTightest(laps, first) {
    let best = Infinity,
      at = -1;
    for (let k = 0; k < laps.length; k++) {
      const { x, y } = laps[k],
        n = x.length;
      let len = 0;
      for (let i = 0; i < n; i++) len += Math.hypot(x[(i + 1) % n] - x[i], y[(i + 1) % n] - y[i]);
      // (within the lap: across the seam the lap below's end meets this lap's start a layer's step apart, a kink a
      // fraction of a bead wide, not a turn)
      const g = Math.max(1, Math.round((0.3 * n) / Math.max(len, 1e-9)));
      for (let i = g; i < n - g; i++) {
        const a = i - g,
          c = i + g,
          ax = x[a] - x[i],
          ay = y[a] - y[i],
          cx = x[c] - x[i],
          cy = y[c] - y[i],
          cr = Math.abs(ax * cy - ay * cx);
        if (cr < 1e-12) continue;
        const R = (Math.hypot(ax, ay) * Math.hypot(cx, cy) * Math.hypot(cx - ax, cy - ay)) / (2 * cr);
        if (R < best) {
          best = R;
          at = first + k;
        }
      }
    }
    return { r: best, at };
  }

  // ---------- the whole vase ----------
  // Every layer (generator: yields { done, of } after each). Layer k's nozzle height is z0 + k·h. The first `base`
  // layers are filled (UNB.modelLayer on the bottom's outline, the base settings of UNB.fillPlan); the rest are the
  // wall, one lap each. opt: z0, h, base, w, d, tol, overhang (the step a bead holds, mm), cx, cy (subtracted from
  // every
  // point: the middle of the footprint, as the preview's mesh is centred), and UNB.fillPlan's base settings. Returns
  // { base: [lines] (a spiral base's are open: { x, y, open: true }), walls: [lines], T, N, spiralBase, terms, joins, empty: 0, height, overhang: { worst, at, inWorst, inAt }
  // (as UNB.modelStack: inWorst is how far a step inwards goes past what a bead holds), support: null,
  // stacking: { out, outAt, in, inAt }, tightest: { r, at }, points (per lap) }; lines are mm, y up.
  UNB.vaseStack = function* (V0, opt) {
    const V = Object.assign({}, V0, { profile: UNB.vaseProfile(V0.profile) }),
      o = opt || {},
      h = o.h || 0.3,
      z0 = o.z0 || h,
      w = o.w || 0.8,
      H = Math.max(h, V.height),
      T = Math.max(1, Math.floor((H - z0) / h + 1e-9) + 1),
      // (a spiral base goes in on one layer and out on the next: an even number of layers, one more if need be)
      spiral = UNB.fillPlan(o, true, 0).pattern === "spiral",
      NB0 = Math.min(T - 1, Math.max(0, o.base | 0)),
      NB = spiral && NB0 % 2 ? (NB0 + 1 <= T - 1 ? NB0 + 1 : NB0 - 1) : NB0,
      n = vaseLapPoints(V),
      cx = o.cx || 0,
      cy = o.cy || 0;
    const shiftTo = (L) => {
      for (let i = 0; i < L.x.length; i++) {
        L.x[i] -= cx;
        L.y[i] -= cy;
      }
      return L;
    };
    const walls = [];
    for (let k = NB; k < T; k++) {
      walls.push(shiftTo(vaseLap(V, k, z0 + k * h, h, n)));
      yield { done: k - NB + 1, of: T };
    }
    // the base: the first wall lap laid flat (its texture and its movement: the base is the shape the wall stands
    // on), moved out half a line width (UNB.modelLayer moves it back in), filled, each layer starting nearest where
    // the one before it started, the last nearest the wall's first point. A lap that crosses itself (loops, or a
    // wave deeper than the wall is wide) has no inside to fill: the base is then the wall without its movement.
    const base = [],
      terms = [],
      joins = [];
    let spiralBase = null; // (asked for a spiral base: true it is one, false it had to be rings)
    if (NB > 0) {
      const nb = Math.min(n, 1440),
        flat = vaseLap(V, NB, z0, 0, nb),
        ring = vaseCrosses(flat) ? vaseRing(V, z0, nb) : flat,
        out = [];
      for (let i = 0; i < nb; i++) {
        // outwards: on the right of the direction of travel (anticlockwise round)
        const a = (i - 1 + nb) % nb,
          b = (i + 1) % nb,
          tx = ring.x[b] - ring.x[a],
          ty = ring.y[b] - ring.y[a],
          l = Math.hypot(tx, ty) || 1;
        out.push(ring.x[i] + (ty / l) * (w / 2) - cx, ring.y[i] - (tx / l) * (w / 2) - cy);
      }
      const goal = [walls[0].x[0], walls[0].y[0]];
      // a spiral base: in from the rim to the middle on one layer, up, and out again on the next, ending on the rim
      // where the wall starts (the rim is the wall's own line). A shape with no single way in gets rings instead.
      const F0 = UNB.fillPlan(o, true, 0),
        rim = [];
      for (let i = 0; i < nb; i++) rim.push([ring.x[i] - cx, ring.y[i] - cy]);
      const S = F0.pattern === "spiral" ? UNB.spiralFill(rim, F0.spacing, goal[0], goal[1]) : null;
      if (F0.pattern === "spiral") spiralBase = !!S;
      if (S) {
        const back = { x: S.x.slice().reverse(), y: S.y.slice().reverse(), open: true };
        for (let k = 0; k < NB; k++) {
          base.push(k % 2 ? back : { x: S.x, y: S.y, open: true });
          terms.push(0);
          joins.push(0);
          yield { done: T - NB + k + 1, of: T };
        }
      }
      for (let k = S ? -1 : NB - 1; k >= 0; k--) {
        const F = Object.assign({}, UNB.fillPlan(o, true, k)),
          L = UNB.modelLayer([out], {
            w,
            d: o.d,
            walls: 1,
            tol: o.tol || 0.05,
            fill: F.pattern === "spiral" ? "rings" : F.pattern,
            fillSpacing: F.spacing,
            fillAngle: F.angle,
            fillMinArea: F.minArea,
          });
        if (!L) continue;
        const { x, y } = startNearest(L, goal[0], goal[1]);
        base.unshift({ x, y });
        terms.unshift(L.N);
        joins.unshift(L.connectors);
        yield { done: T - NB + (NB - k), of: T };
      }
    }
    const M = V.move || {};
    walls.cycles = M.kind && M.kind !== "none" ? Math.max(1, Math.round(M.count || 1)) : 0;
    const stk = vaseStacking(walls, base.length),
      step = o.overhang || w / 3,
      tight = vaseTightest(walls, base.length);
    delete walls.cycles;
    for (let i = 0; i < walls.length; i++) terms.push(0);
    return {
      base,
      walls,
      T: base.length + walls.length,
      N: base.length,
      spiralBase,
      terms,
      joins,
      empty: 0,
      height: H,
      overhang: {
        worst: stk.out,
        at: stk.outAt,
        inWorst: Math.max(0, stk.in - step),
        inAt: stk.in > step ? stk.inAt : -1,
      },
      support: null,
      stacking: stk,
      tightest: tight,
      points: n,
    };
  };

  // The vase for the preview and the plate (the middle of the bead; a closed bottom, an open top). Rows: laps as they
  // print, every layer (every few layers past `maxRows`), each resampled to `cols` points, so the movement's shift
  // from layer to layer shows; the mesh joins every few rows into triangles (at most `meshRows` bands), for the
  // footprint on the plate and Draw this view. opt: h (layer height), maxRows (240), meshRows (60), cols (360).
  // Returns { tri (flat x, y, z per corner, 9 per triangle), n (triangles), cx, cy (the middle of its footprint:
  // UNB.vaseStack's opt.cx, cy), rows: [{ x, y, z }] (mm, centred on cx, cy) }.
  UNB.vaseMesh = function (V0, opt) {
    const V = Object.assign({}, V0, { profile: UNB.vaseProfile(V0.profile) }),
      o = opt || {},
      H = Math.max(0.5, V.height),
      h = o.h || 0.3,
      layers = Math.max(1, Math.round(H / h)),
      every = Math.max(1, Math.ceil((layers + 1) / (o.maxRows || 240))),
      n = vaseLapPoints(V),
      cols = Math.max(24, Math.min(o.cols || 360, n));
    const rows = [];
    for (let k = 0; ; k += every) {
      const z = Math.min(H, k * h),
        L = vaseLap(V, k, z, 0, n),
        x = new Float64Array(cols),
        y = new Float64Array(cols);
      for (let c = 0; c < cols; c++) {
        const i = Math.floor((c / cols) * n);
        x[c] = L.x[i];
        y[c] = L.y[i];
      }
      rows.push({ x, y, z });
      if (z >= H) break;
    }
    const band = Math.max(1, Math.ceil((rows.length - 1) / (o.meshRows || 60))),
      R = rows.filter((_, i) => i % band === 0 || i === rows.length - 1),
      tri = new Float32Array(((R.length - 1) * cols * 2 + cols) * 9);
    let q = 0;
    const put = (x, y, z) => {
      tri[q++] = x;
      tri[q++] = y;
      tri[q++] = z;
    };
    for (let r = 0; r + 1 < R.length; r++)
      for (let c = 0; c < cols; c++) {
        const A = R[r],
          B = R[r + 1],
          d = (c + 1) % cols;
        put(A.x[c], A.y[c], A.z);
        put(A.x[d], A.y[d], A.z);
        put(B.x[d], B.y[d], B.z);
        put(A.x[c], A.y[c], A.z);
        put(B.x[d], B.y[d], B.z);
        put(B.x[c], B.y[c], B.z);
      }
    // the bottom: a fan from the middle, facing down
    for (let c = 0; c < cols; c++) {
      const A = R[0],
        d = (c + 1) % cols;
      put(0, 0, 0);
      put(A.x[d], A.y[d], 0);
      put(A.x[c], A.y[c], 0);
    }
    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity;
    for (let i = 0; i < tri.length; i += 3) {
      x0 = Math.min(x0, tri[i]);
      x1 = Math.max(x1, tri[i]);
      y0 = Math.min(y0, tri[i + 1]);
      y1 = Math.max(y1, tri[i + 1]);
    }
    const cx = (x0 + x1) / 2,
      cy = (y0 + y1) / 2;
    for (const r of rows)
      for (let c = 0; c < cols; c++) {
        r.x[c] -= cx;
        r.y[c] -= cy;
      }
    return { tri, n: tri.length / 9, cx, cy, rows };
  };
})(typeof window !== "undefined" ? window : globalThis);
