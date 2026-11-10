/* Unbroken · engine · 17-vase.js
   16. Vases — a vase made in the app instead of loaded as an STL: a profile curve (the radius at each height, edited
   by hand) turned round the middle, a surface texture on the wall (ribs, rings), and a movement pattern the needle
   makes along its path (a wave, a zigzag, loops), shifted from layer to layer. The path is written directly, one lap
   per layer, so it is exactly the line that prints (no slicing, no inset): the profile is the middle of the bead.
   One part of the engine (no DOM), loaded after 16-molecule.js; core.js lists every part and what's in it. */
(function (root) {
  "use strict";
  const UNB = root.UNB,
    { segDist2, startNearest, rasterPolyline, resampleLoop, isoContours } = UNB._u; // shared helpers (00-util.js)

  // ---------- the vase's settings ----------
  // V = { height (mm), profile: [[t, r], …] (t: share of the height, 0 at the plate to 1 at the rim, rising; r: mm
  // from the middle to the middle of the bead), texture: { kind: "none" | "ribs" | "rings", count (ribs round),
  // depth (mm, crest to trough), twist (degrees the ribs turn from bottom to top), spacing (mm between rings) },
  // move: { kind: "none" | "wave" | "zigzag" | "loops", size (mm: how far the needle moves off the wall, or a loop's
  // radius), count (how many round each lap), shift (share of one movement each layer moves on: 0 stacks them in
  // columns, 0.5 alternates them), flip (a lattice: layers each way before the movement flips to the other side, 0:
  // none) }, and these, each optional (left out: as before them):
  //   plan: the shape seen from above, { kind: "circle" | "polygon" | "star" | "flower" | "drawing", sides (corners,
  //     points or petals), depth (star, flower: how far in between them, share of the reach, 0–0.9), round (polygon,
  //     star: corners rounded off, 0–1), loop (drawing: the outline, [x0, y0, x1, y1, …], from UNB.vaseOutline) }. The
  //     profile is the reach of its furthest point (a polygon's corners, a star's points).
  //   planTop: the shape at the rim (as plan): the wall blends from plan at the bottom to this at the rim; null: plan
  //   twist: degrees the whole shape turns from the bottom to the rim (the texture's twist turns the ribs on it as well)
  //   lean: { size (mm the rim moves sideways), dir (degrees: which way), curve: "straight" | "curve" (bending more
  //     towards the rim) | "bow" (out and back: the rim over the base again) }
  //   strength: { texture, move }: each [[t, k], …] (as the profile: t share of the height; k 0–1, how much of the
  //     texture's depth or the movement's size there); null: all of it all the way up
  //   rim: { kind: "none" | "flare" | "rolled", size (flare: mm out at the rim), height (mm: how far down the rim
  //     goes) }: a flare bends the top out; a rolled rim doubles the wall there (a second bead inside the first) }
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
      move: { kind: "wave", size: 0.5, count: 16, shift: 0, flip: 0 },
      plan: { kind: "circle", sides: 6, depth: 0.3, round: 0.2 },
      planTop: null,
      twist: 0,
      lean: { size: 0, dir: 0, curve: "straight" },
      strength: null,
      rim: { kind: "none", size: 3, height: 5 },
    };
  };
  UNB.VASE_PLANS = {
    circle: { name: "Circle" },
    polygon: { name: "Polygon", sides: [3, 24] },
    star: { name: "Star", sides: [3, 24] },
    flower: { name: "Flower", sides: [2, 24] },
    drawing: { name: "A drawing" },
  };
  // the texture's kinds: ribs run up the wall, rings round it, a grid is both, a weave is ribs twisting one way and
  // back every `spacing` mm, a diamond is two sets of ribs twisting opposite ways
  UNB.VASE_TEXTURES = ["none", "ribs", "rings", "grid", "weave", "diamond"];
  // the smallest radius anything is made at (mm): a vase narrower than this has no inside to print round
  const VASE_MIN_R = 1;

  // ---------- the profile: the radius at each height ----------
  // A smooth curve through the profile's points (a cubic between each pair, its slope at a point the mean of the
  // straight slopes either side, so it passes through every point and bends gently), t clamped to 0–1.
  UNB.vaseRadius = function (profile, t) {
    return profile && profile.length ? Math.max(VASE_MIN_R, vaseCurve(profile, t)) : 10;
  };
  // how much of the texture or the movement there is at share t of the height (strength: a curve as the profile, k
  // 0–1; none: all of it)
  UNB.vaseStrength = function (curve, t) {
    return curve && curve.length ? Math.min(1, Math.max(0, vaseCurve(curve, t))) : 1;
  };
  function vaseCurve(P, t) {
    const n = P.length;
    if (n === 1 || t <= P[0][0]) return P[0][1];
    if (t >= P[n - 1][0]) return P[n - 1][1];
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
    return r;
  }
  // a profile kept in order: t rising from exactly 0 to exactly 1, radii in 1–500 mm, at least two points (lo, hi:
  // the range of the values, for a strength curve 0–1)
  UNB.vaseProfile = function (profile, lo = VASE_MIN_R, hi = 500) {
    const P = (profile || [])
      .filter((p) => p && isFinite(p[0]) && isFinite(p[1]))
      .map((p) => [Math.min(1, Math.max(0, +p[0])), Math.min(hi, Math.max(lo, +p[1]))])
      .sort((a, b) => a[0] - b[0]);
    if (P.length < 2)
      return lo === VASE_MIN_R
        ? UNB.VASE_SHAPES.cylinder.profile.map((p) => p.slice())
        : [
            [0, hi],
            [1, hi],
          ];
    P[0][0] = 0;
    P[P.length - 1][0] = 1;
    for (let i = 1; i < P.length - 1; i++) P[i][0] = Math.min(Math.max(P[i][0], P[i - 1][0] + 0.01), 0.99);
    return P;
  };

  // ---------- the shape seen from above ----------
  // A plan as PLAN_M points evenly along its outline, anticlockwise, starting where it crosses +x, its furthest point 1
  // from the middle. Kept by its settings (a drawing's by its outline), so each lap only reads it.
  const PLAN_M = 1440,
    planCache = new Map();
  function planTable(P) {
    const kind = P && P.kind && UNB.VASE_PLANS[P.kind] ? P.kind : "circle";
    if (kind === "circle" || (kind === "drawing" && !(P.loop && P.loop.length >= 16))) return null;
    const sides = Math.max(kind === "flower" ? 2 : 3, Math.min(24, Math.round(+P.sides || 6))),
      depth = Math.min(0.9, Math.max(0, +P.depth || 0)),
      round = Math.min(1, Math.max(0, +P.round || 0));
    let key = `${kind}|${sides}|${depth}|${round}`;
    if (kind === "drawing") {
      let h = 0;
      for (let i = 0; i < P.loop.length; i++) h = (h * 31 + Math.round(P.loop[i] * 1e4)) % 2147483647;
      key = `drawing|${P.loop.length}|${h}|${round}`;
    }
    let T = planCache.get(key);
    if (T) return T;
    let pts;
    if (kind === "drawing") {
      pts = [];
      for (let i = 0; i + 1 < P.loop.length; i += 2) pts.push([P.loop[i], P.loop[i + 1]]);
      // rounded: smoothed along the outline (its dips and corners eased), its furthest point put back at 1
      for (let pass = 0, N = Math.round(round * 60); pass < N; pass++)
        pts = pts.map((p, i) => {
          const a = pts[(i - 1 + pts.length) % pts.length],
            b = pts[(i + 1) % pts.length];
          return [(a[0] + 2 * p[0] + b[0]) / 4, (a[1] + 2 * p[1] + b[1]) / 4];
        });
      const mx = Math.max(...pts.map((p) => Math.hypot(p[0], p[1])));
      pts = pts.map((p) => [p[0] / mx, p[1] / mx]);
    } else {
      // the reach at each angle (A of them), corners rounded by smoothing it round, the furthest put back at 1
      const A = 4096,
        r = new Float64Array(A),
        da = (2 * Math.PI) / sides;
      for (let j = 0; j < A; j++) {
        const a = (2 * Math.PI * j) / A;
        if (kind === "polygon") {
          const f = (((a % da) + da) % da) - da / 2;
          r[j] = Math.cos(da / 2) / Math.cos(f);
        } else if (kind === "star") {
          // straight from a point (reach 1) to the dip between two (1 − depth)
          const half = da / 2,
            f = ((a % da) + da) % da,
            u = f < half ? f : da - f,
            r0 = 1,
            r1 = 1 - depth;
          r[j] = (r0 * r1 * Math.sin(half)) / (r0 * Math.sin(u) + r1 * Math.sin(half - u));
        } else r[j] = 1 - depth * (1 - Math.abs(Math.cos((sides * a) / 2))); // flower: round petals, sharp dips
      }
      const sig = round * (A / sides) * 0.18;
      let R = r;
      if (sig > 0.5) {
        const K = Math.ceil(3 * sig),
          wts = [];
        let ws = 0;
        for (let d = -K; d <= K; d++) ws += wts[d + K] = Math.exp((-d * d) / (2 * sig * sig));
        R = new Float64Array(A);
        for (let j = 0; j < A; j++) {
          let v = 0;
          for (let d = -K; d <= K; d++) v += wts[d + K] * r[(j + d + A) % A];
          R[j] = v / ws;
        }
      }
      let mx = 0;
      for (let j = 0; j < A; j++) mx = Math.max(mx, R[j]);
      pts = [];
      for (let j = 0; j < A; j++) {
        const a = (2 * Math.PI * j) / A;
        pts.push([(R[j] / mx) * Math.cos(a), (R[j] / mx) * Math.sin(a)]);
      }
    }
    // evenly along the outline, from where it crosses +x (the point nearest the +x axis, outside the middle)
    const E = resampleLoop(pts, 1e-3);
    let i0 = 0,
      best = Infinity;
    for (let i = 0; i < E.length; i++) {
      const a = Math.abs(Math.atan2(E[i][1], E[i][0]));
      if (E[i][0] > 0 && a < best) {
        best = a;
        i0 = i;
      }
    }
    const R = E.slice(i0).concat(E.slice(0, i0));
    R.push(R[0]);
    const c = [0];
    for (let i = 1; i < R.length; i++) c.push(c[i - 1] + Math.hypot(R[i][0] - R[i - 1][0], R[i][1] - R[i - 1][1]));
    const L = c[c.length - 1],
      x = new Float64Array(PLAN_M),
      y = new Float64Array(PLAN_M);
    let j = 0;
    for (let i = 0; i < PLAN_M; i++) {
      const s = (i / PLAN_M) * L;
      while (j < R.length - 2 && c[j + 1] < s) j++;
      const f = (s - c[j]) / Math.max(1e-12, c[j + 1] - c[j]);
      x[i] = R[j][0] + f * (R[j + 1][0] - R[j][0]);
      y[i] = R[j][1] + f * (R[j + 1][1] - R[j][1]);
    }
    T = { x, y, perimeter: L };
    if (planCache.size > 40) planCache.clear();
    planCache.set(key, T);
    return T;
  }
  // the plan's point at share s round it (unit size; a circle: exactly), blended towards the rim's plan by t
  function planPoint(A, B, s, t) {
    const at = (T) => {
      if (!T) return [Math.cos(2 * Math.PI * s), Math.sin(2 * Math.PI * s)];
      const u = (((s % 1) + 1) % 1) * PLAN_M,
        i = Math.floor(u) % PLAN_M,
        j = (i + 1) % PLAN_M,
        f = u - Math.floor(u);
      return [T.x[i] + f * (T.x[j] - T.x[i]), T.y[i] + f * (T.y[j] - T.y[i])];
    };
    const p = at(A);
    if (B === undefined) return p;
    const q = at(B);
    return [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];
  }
  // how far round the plan is, against a circle of the same reach (for the points a lap needs)
  const planLength = (P) => {
    const T = planTable(P);
    return T ? T.perimeter / (2 * Math.PI) : 1;
  };
  // A drawing's outline, for a plan: the outside edge of the line (x, y: any units, y up; closed or not) as one loop,
  // holes and gaps inside filled, the largest piece if it's in several. Returns { loop ([x0, y0, …], its furthest
  // point 1 from the middle of its area, anticlockwise, 512 points), pieces (how many there were) } or null.
  UNB.vaseOutline = function (x, y) {
    const n = x.length;
    if (n < 3) return null;
    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity;
    for (let i = 0; i < n; i++) {
      x0 = Math.min(x0, x[i]);
      x1 = Math.max(x1, x[i]);
      y0 = Math.min(y0, y[i]);
      y1 = Math.max(y1, y[i]);
    }
    const size = Math.max(x1 - x0, y1 - y0);
    if (!(size > 0)) return null;
    const g = size / 240,
      pad = 4,
      ox = x0 - pad * g,
      oy = y0 - pad * g,
      w = Math.ceil((x1 - ox) / g) + pad + 1,
      h = Math.ceil((y1 - oy) / g) + pad + 1,
      line = new Uint8Array(w * h);
    rasterPolyline(line, w, x, y, true, ox, oy, g, 0.5);
    // a little thicker, so a line drawn close to itself closes the gap
    const thick = new Uint8Array(w * h);
    for (let r = 1; r < h - 1; r++)
      for (let c = 1; c < w - 1; c++)
        if (line[r * w + c]) for (let d = -1; d <= 1; d++) for (let e = -1; e <= 1; e++) thick[(r + d) * w + c + e] = 1;
    // the outside: everything reached from the border without crossing the line
    const out = new Uint8Array(w * h),
      stack = [];
    for (let c = 0; c < w; c++) stack.push(c, (h - 1) * w + c);
    for (let r = 0; r < h; r++) stack.push(r * w, r * w + w - 1);
    while (stack.length) {
      const p = stack.pop();
      if (out[p] || thick[p]) continue;
      out[p] = 1;
      const c = p % w,
        r = (p / w) | 0;
      if (c > 0) stack.push(p - 1);
      if (c < w - 1) stack.push(p + 1);
      if (r > 0) stack.push(p - w);
      if (r < h - 1) stack.push(p + w);
    }
    // opened (thinned to nothing within 4 cells, then grown back): a strand of the line on its own, outside or between
    // shapes, isn't a shape
    const deep = UNB.edt(out, w, h).dist,
      core = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) core[i] = !out[i] && deep[i] >= 4 ? 1 : 0;
    const near = UNB.edt(core, w, h).dist,
      open = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) open[i] = near[i] <= 4 ? 0 : 1;
    const dist = UNB.edt(open, w, h).dist,
      lab = new Int32Array(w * h);
    for (let i = 0; i < w * h; i++) lab[i] = open[i] ? -1 : 0;
    const box = { x0: [0], y0: [0], x1: [w - 1], y1: [h - 1] },
      C = isoContours(dist, lab, 0, 1, w, h, box, ox, oy, g).filter((R) => R.length > 8);
    if (!C.length) return null;
    const area = (R) => {
      let a = 0;
      for (let i = 0; i < R.length; i++) {
        const p = R[i],
          q = R[(i + 1) % R.length];
        a += p[0] * q[1] - q[0] * p[1];
      }
      return a / 2;
    };
    C.sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)));
    const pieces = C.filter((R) => Math.abs(area(R)) > Math.abs(area(C[0])) * 0.02).length;
    let R = resampleLoop(C[0], size / 400);
    if (area(R) < 0) R = R.reverse();
    // smoothed a little (the grid's steps), the middle of its area at 0, its furthest point at 1
    for (let pass = 0; pass < 3; pass++)
      R = R.map((p, i) => {
        const a = R[(i - 1 + R.length) % R.length],
          b = R[(i + 1) % R.length];
        return [(a[0] + 2 * p[0] + b[0]) / 4, (a[1] + 2 * p[1] + b[1]) / 4];
      });
    let A = 0,
      cx = 0,
      cy = 0;
    for (let i = 0; i < R.length; i++) {
      const p = R[i],
        q = R[(i + 1) % R.length],
        k = p[0] * q[1] - q[0] * p[1];
      A += k;
      cx += (p[0] + q[0]) * k;
      cy += (p[1] + q[1]) * k;
    }
    cx /= 3 * A;
    cy /= 3 * A;
    let mx = 0;
    for (const p of R) mx = Math.max(mx, Math.hypot(p[0] - cx, p[1] - cy));
    const E = resampleLoop(
      R.map((p) => [(p[0] - cx) / mx, (p[1] - cy) / mx]),
      1e-3
    );
    const loop = [];
    for (let i = 0; i < 512; i++) {
      const p = E[Math.floor((i / 512) * E.length)];
      loop.push(+p[0].toFixed(4), +p[1].toFixed(4));
    }
    return { loop, pieces };
  };

  // ---------- one lap ----------
  // the movement's shape over one of its repeats, c in cycles: a wave (sine) or a zigzag (straight runs, sharp
  // turns), −1…1
  const vaseWiggle = (kind, c) => {
    const f = c - Math.floor(c);
    if (kind === "zigzag") return 1 - 4 * Math.abs(f - 0.5);
    return Math.sin(2 * Math.PI * f);
  };
  // the rim's flare: how far out at height z (mm)
  const flareAt = (V, z, H) => {
    const R = V.rim;
    if (!R || R.kind !== "flare" || !(R.size > 0) || !(R.height > 0)) return 0;
    const u = (z - (H - R.height)) / R.height;
    return u > 0 ? R.size * Math.min(1, u) * Math.min(1, u) : 0;
  };
  // how far the middle moves sideways at share t of the height (the lean)
  const leanAt = (V, t) => {
    const L = V.lean;
    if (!L || !(Math.abs(L.size) > 0)) return [0, 0];
    const g = L.curve === "curve" ? t * t : L.curve === "bow" ? Math.sin(Math.PI * t) : t,
      a = ((+L.dir || 0) * Math.PI) / 180;
    return [L.size * g * Math.cos(a), L.size * g * Math.sin(a)];
  };
  // The wall at height z (mm): the plan (blended towards the rim's) at the profile's reach, turned by the twist, the
  // surface texture out along the wall's normal, moved by the lean; n points evenly round the plan, anticlockwise
  // from +x. Returns { x, y } (mm).
  function vaseRing(V, z, n) {
    const H = Math.max(0.5, V.height),
      t = Math.min(1, Math.max(0, z / H)),
      T = V.texture || {},
      reach = Math.max(VASE_MIN_R, UNB.vaseRadius(V.profile, t) + flareAt(V, z, H)),
      A = planTable(V.plan),
      B = V.planTop ? planTable(V.planTop) : undefined,
      rot = (((+V.twist || 0) * Math.PI) / 180) * t,
      cr = Math.cos(rot),
      sr = Math.sin(rot),
      [lx, ly] = leanAt(V, t),
      k = UNB.vaseStrength(V.strength && V.strength.texture, t),
      D = (T.depth || 0) * k,
      x = new Float64Array(n),
      y = new Float64Array(n);
    const kind = T.kind,
      c = Math.round(T.count || 0),
      tw = (+T.twist || 0) / 360,
      tri = (u) => 1 - Math.abs((((u % 2) + 2) % 2) - 1),
      ringR = (D / 2) * Math.cos((2 * Math.PI * z) / Math.max(0.1, T.spacing || 4));
    // the texture at share s round: out from the wall (mm)
    const tex =
      !(D > 0) || kind === "none" || !kind
        ? null
        : kind === "rings"
          ? () => ringR
          : kind === "ribs"
            ? (s) => (D / 2) * Math.cos(2 * Math.PI * c * (s - tw * t))
            : kind === "grid"
              ? (s) => (D / 4) * Math.cos(2 * Math.PI * c * (s - tw * t)) + ringR / 2
              : kind === "weave"
                ? (s) => (D / 2) * Math.cos(2 * Math.PI * c * (s - tw * tri(z / Math.max(0.1, T.spacing || 4))))
                : kind === "diamond"
                  ? (s) =>
                      (D / 4) * (Math.cos(2 * Math.PI * c * (s - tw * t)) + Math.cos(2 * Math.PI * c * (s + tw * t)))
                  : null;
    const px = new Float64Array(n),
      py = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const [ux, uy] = planPoint(A, B, i / n, t);
      px[i] = reach * (ux * cr - uy * sr);
      py[i] = reach * (ux * sr + uy * cr);
    }
    for (let i = 0; i < n; i++) {
      let X = px[i],
        Y = py[i];
      if (tex) {
        // out: right of the direction of travel (anticlockwise round)
        const a = (i - 1 + n) % n,
          b = (i + 1) % n,
          tx = px[b] - px[a],
          ty = py[b] - py[a],
          l = Math.hypot(tx, ty) || 1,
          d = tex(i / n);
        X += (ty / l) * d;
        Y -= (tx / l) * d;
      }
      // (never closer to the middle than the smallest radius)
      const r = Math.hypot(X, Y);
      if (r < VASE_MIN_R) {
        X = r > 1e-9 ? (X / r) * VASE_MIN_R : VASE_MIN_R;
        Y = r > 1e-9 ? (Y / r) * VASE_MIN_R : 0;
      }
      x[i] = X + lx;
      y[i] = Y + ly;
    }
    return { x, y };
  }
  // One wall lap at layer k (z: its nozzle height, h: the layer height): the wall from z to z + h (each point at the
  // height it prints at, as the spiral climbs), resampled evenly along its length, and the movement added across it
  // (wave, zigzag: in and out, along the outward normal; loops: a circle swept along it). n points, the movement's
  // phase continuing from lap to lap (cycles = count × share of the lap + shift × layer), so lap k ends where lap
  // k + 1 starts. Its size follows the movement's strength up the wall. A lattice (move.flip) moves it half a repeat
  // over every `flip` layers, eased in over the lap's first repeat so the line stays joined. Returns { x, y } (mm).
  const flipAt = (M, k) => (M.flip > 0 && Math.floor(k / M.flip) % 2 ? 0.5 : 0);
  function vaseLap(V, k, z, h, n) {
    const M = V.move || {},
      m = M.kind && M.kind !== "none" && M.size > 0 ? Math.max(1, Math.round(M.count || 1)) : 0,
      H = Math.max(0.5, V.height),
      kMove = V.strength && V.strength.move,
      fNow = flipAt(M, k),
      fWas = k > 0 ? flipAt(M, k - 1) : fNow;
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
        cyc = m * (i / n) + (+M.shift || 0) * k + fWas + (fNow - fWas) * Math.min(1, (i / n) * m),
        size = M.size * UNB.vaseStrength(kMove, (z + (h * i) / n) / H);
      if (M.kind === "loops") {
        // a circle of radius `size` swept along the wall, centred on it: on the outside of each turn the circle runs
        // backwards faster than the wall goes forwards, so the line loops (crossing itself) once the size is more than
        // the spacing between loops ÷ 2π; smaller, it's a wave that leans
        const ph = 2 * Math.PI * (cyc - Math.floor(cyc)),
          along = -size * Math.sin(ph),
          out = size * Math.cos(ph);
        x[i] = px + along * tx + out * nx;
        y[i] = py + along * ty + out * ny;
      } else {
        const d = size * vaseWiggle(M.kind, cyc);
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
    if (V.rim && V.rim.kind === "flare") rmax += Math.max(0, +V.rim.size || 0);
    const L =
        2 *
        Math.PI *
        rmax *
        Math.max(planLength(V.plan), V.planTop ? planLength(V.planTop) : 0) *
        (T.kind && T.kind !== "none" && T.kind !== "rings" ? 1.3 : 1),
      m = M.kind && M.kind !== "none" ? Math.max(1, Math.round(M.count || 1)) : 0;
    return Math.min(6000, Math.max(256, Math.ceil(L / 0.25), m * (M.kind === "loops" ? 32 : 24)));
  }

  // ---------- the checks ----------
  // How far each lap's bead sits off the one below (mm): every point's distance to the nearest piece of the lap below
  // (searched round the same share of the lap, a repeat of the movement either way), outwards or inwards (past the
  // lap below's outward normal). A bead holds over the one below when its middle is within a step (a third of its
  // width by default). Returns { out, outAt, in, inAt } (mm, layer numbers).
  // A doubled lap (a rolled rim) is checked ring by ring (lap.parts), each against the nearest ring below; a lap
  // that bridges (lap.bridge: a lattice's flip) isn't: it's measured as a span instead (vaseStack).
  function vaseStacking(laps, first) {
    const r = { out: 0, outAt: -1, in: 0, inAt: -1 };
    for (let k = 1; k < laps.length; k++) {
      if (laps[k].bridge) continue;
      const from = laps[k].settled || 0; // (the lap after a flip: where it settles onto the flip's new side)
      const As = laps[k - 1].parts || [laps[k - 1]],
        Bs = laps[k].parts || [laps[k]];
      for (const B of Bs) {
        const nb = B.x.length;
        for (let i = Math.ceil(from * nb); i < nb; i++) {
          let best = Infinity,
            side = 0;
          for (const A of As) {
            const na = A.x.length,
              c = Math.round((i / nb) * na),
              win = Math.min(80, Math.ceil(na / Math.max(1, laps.cycles || 1)) + 6);
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
    }
    return r;
  }
  // the tightest turn on any lap (mm: the radius of the circle through three points about half a millimetre apart)
  function vaseTightest(laps, first) {
    let best = Infinity,
      at = -1;
    const rings = [];
    laps.forEach((L, k) => (L.parts || [L]).forEach((P) => rings.push([P, k])));
    for (const [P, k] of rings) {
      const { x, y } = P,
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
  // the settings in order: the profile, and the strength curves (0–1)
  function vaseClean(V0) {
    const S = V0.strength;
    return Object.assign({}, V0, {
      profile: UNB.vaseProfile(V0.profile),
      strength: S
        ? {
            texture: S.texture ? UNB.vaseProfile(S.texture, 0, 1) : null,
            move: S.move ? UNB.vaseProfile(S.move, 0, 1) : null,
          }
        : null,
    });
  }
  // Every layer (generator: yields { done, of } after each). Layer k's nozzle height is z0 + k·h. The first `base`
  // layers are filled (UNB.modelLayer on the bottom's outline, the base settings of UNB.fillPlan); the rest are the
  // wall, one lap each. opt: z0, h, base, w, d, tol, overhang (the step a bead holds, mm), cx, cy (subtracted from
  // every
  // point: the middle of the footprint, as the preview's mesh is centred), and UNB.fillPlan's base settings. Returns
  // { base: [lines] (a spiral base's are open: { x, y, open: true }), walls: [lines], T, N, spiralBase, terms, joins, empty: 0, height, overhang: { worst, at, inWorst, inAt }
  // (as UNB.modelStack: inWorst is how far a step inwards goes past what a bead holds), support: null,
  // stacking: { out, outAt, in, inAt }, tightest: { r, at }, points (per lap) }; lines are mm, y up.
  UNB.vaseStack = function* (V0, opt) {
    const V = vaseClean(V0),
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
    // the wall, a lap a layer. A rolled rim doubles the laps at the top: round once on the wall, step in, round again
    // inside it (the second bead stepping in a bead's hold a layer at first, so it has the one below under it), each
    // ring half a layer up. A lattice's flip layers bridge from crossing to crossing.
    const walls = [],
      Mv = V.move || {},
      rolled = V.rim && V.rim.kind === "rolled" && V.rim.height > 0 ? H - V.rim.height : Infinity,
      hold = o.overhang || w / 3,
      dIn = o.d || w;
    let nRolled = 0;
    for (let k = NB; k < T; k++) {
      const z = z0 + k * h;
      let L;
      if (z >= rolled) {
        const A = shiftTo(vaseLap(V, k, z, h / 2, n)),
          B0 = vaseLap(V, k, z + h / 2, h / 2, n),
          inset = Math.min(dIn, hold * ++nRolled),
          B = { x: new Float64Array(n), y: new Float64Array(n) };
        for (let i = 0; i < n; i++) {
          const a = (i - 1 + n) % n,
            b = (i + 1) % n,
            tx = B0.x[b] - B0.x[a],
            ty = B0.y[b] - B0.y[a],
            l = Math.hypot(tx, ty) || 1;
          // in: left of the direction of travel
          B.x[i] = B0.x[i] - (ty / l) * inset - cx;
          B.y[i] = B0.y[i] + (tx / l) * inset - cy;
        }
        L = { x: Float64Array.from([...A.x, ...B.x]), y: Float64Array.from([...A.y, ...B.y]), parts: [A, B] };
      } else L = shiftTo(vaseLap(V, k, z, h, n));
      if (Mv.flip > 0 && k > NB && flipAt(Mv, k) !== flipAt(Mv, k - 1)) L.bridge = true;
      // (the lap after one sits on its easing over the first repeat: checked from there on)
      if (walls.length && walls[walls.length - 1].bridge) L.settled = 1.5 / Math.max(1, Math.round(Mv.count || 1));
      walls.push(L);
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
    // a lattice: the longest span a flip layer bridges, crossing to crossing (half a repeat of the movement along the
    // lap below)
    let lattice = null;
    if (Mv.flip > 0 && Mv.kind && Mv.kind !== "none" && Mv.size > 0) {
      const m = Math.max(1, Math.round(Mv.count || 1));
      let span = 0,
        bridges = 0;
      for (let k = 1; k < walls.length; k++)
        if (walls[k].bridge) {
          bridges++;
          const P = walls[k - 1];
          let len = 0;
          for (let i = 1; i < P.x.length; i++) len += Math.hypot(P.x[i] - P.x[i - 1], P.y[i] - P.y[i - 1]);
          span = Math.max(span, len / (2 * m));
        }
      lattice = { bridges, span };
    }
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
      lattice,
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
    const V = vaseClean(V0),
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
