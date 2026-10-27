/* Unbroken · engine · 13-patterns.js
   12. Patterns — geometric abstract art made as lines, for the Geometric art card: labyrinths, space-filling curves,
   spirals, a whirl, waves, harmonic curves and tiles. The app draws a pattern as a picture and traces it like any
   other, so every rule of the line (one line, no crossings, the spacing) applies to it the same way.
   Several are one unbroken line already (Labyrinth, Moore loop and Double spiral are closed loops; Hilbert, Gosper,
   Whirl and Waves run from one end to the other), with even gaps between neighbouring lines: those trace without
   doubled strokes, which suits chocolate best. Spirograph (looped) and Lissajous cross themselves and Truchet tiles are
   many small loops; they suit the pen plotter.
   One part of the engine (no DOM), loaded after 12-models.js; core.js lists every part and what's in it. */
(function (root) {
  "use strict";
  const UNB = root.UNB;
  const TAU = 2 * Math.PI;

  // A small seeded random number generator (mulberry32), so the same seed gives the same pattern again
  function seeded(seed) {
    let a = seed >>> 0 || 1;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Outline shapes for Labyrinth and Truchet tiles: inside(u, v) on the square −1 … 1 (v down)
  function polyInside(P, u, v) {
    let c = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [xi, yi] = P[i],
        [xj, yj] = P[j];
      if (yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  const STAR = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? 0.45 : 1,
      a = -Math.PI / 2 + (i * Math.PI) / 5;
    return [r * Math.cos(a), 0.06 + r * Math.sin(a)];
  });
  const SHAPES = {
    square: () => true,
    circle: (u, v) => u * u + v * v <= 1,
    hexagon: (u, v) => Math.abs(v) <= 0.866 && Math.abs(u) <= 1 - Math.abs(v) / 1.732,
    diamond: (u, v) => Math.abs(u) + Math.abs(v) <= 1,
    heart: (u, v) => {
      const x = 1.15 * u,
        y = 0.125 - 1.125 * v,
        q = x * x + y * y - 1;
      return q * q * q - x * x * y * y * y <= 0;
    },
    star: (u, v) => polyInside(STAR, u, v),
  };

  // The largest group of cells joined side to side, among those marked in `on` (n × n)
  function largestGroup(on, n) {
    const lab = new Int32Array(n * n).fill(-1);
    let best = [];
    for (let s = 0; s < n * n; s++) {
      if (!on[s] || lab[s] >= 0) continue;
      const cells = [s];
      lab[s] = s;
      for (let k = 0; k < cells.length; k++) {
        const c = cells[k],
          i = c % n,
          j = (c / n) | 0;
        for (const [di, dj] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const a = i + di,
            b = j + dj,
            q = b * n + a;
          if (a >= 0 && b >= 0 && a < n && b < n && on[q] && lab[q] < 0) {
            lab[q] = s;
            cells.push(q);
          }
        }
      }
      if (cells.length > best.length) best = cells;
    }
    const keep = new Uint8Array(n * n);
    for (const c of best) keep[c] = 1;
    return keep;
  }

  // Corners of a closed polyline (a list of [x, y]) rounded with quadratic curves of reach rho, as a flat [x, y, …]
  function roundLoop(V, rho, steps) {
    const out = [],
      m = V.length;
    for (let i = 0; i < m; i++) {
      const P = V[(i + m - 1) % m],
        C = V[i],
        N = V[(i + 1) % m];
      const la = Math.hypot(C[0] - P[0], C[1] - P[1]),
        lb = Math.hypot(N[0] - C[0], N[1] - C[1]),
        r = Math.min(rho, 0.5 * la, 0.5 * lb);
      const A = [C[0] + ((P[0] - C[0]) * r) / la, C[1] + ((P[1] - C[1]) * r) / la],
        B = [C[0] + ((N[0] - C[0]) * r) / lb, C[1] + ((N[1] - C[1]) * r) / lb];
      for (let k = 0; k <= steps; k++) {
        const t = k / steps,
          a = (1 - t) * (1 - t),
          b = 2 * t * (1 - t),
          c = t * t;
        out.push(a * A[0] + b * C[0] + c * B[0], a * A[1] + b * C[1] + c * B[1]);
      }
    }
    return out;
  }

  // Labyrinth: a random spanning tree of the cells inside the shape (a growing tree: Branching 0 follows the newest
  // cell, long corridors; 100 picks any cell, short branches), and the one line that runs round it. The tree is drawn
  // on a grid twice as fine (cells and the passages between them), so every wall and every corridor is one grid step
  // wide and the line keeps an even gap. A tree has no loops, so the line round it is a single closed loop.
  function labyrinth(o, rnd) {
    const n = o.detail,
      inside = SHAPES[o.shape] || SHAPES.square,
      on = new Uint8Array(n * n);
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) on[j * n + i] = inside(((i + 0.5) / n) * 2 - 1, ((j + 0.5) / n) * 2 - 1) ? 1 : 0;
    const keep = largestGroup(on, n),
      cells = [];
    for (let c = 0; c < n * n; c++) if (keep[c]) cells.push(c);
    if (!cells.length) return null;
    const F = 2 * n + 1,
      occ = new Uint8Array(F * F),
      seen = new Uint8Array(n * n),
      mark = (c) => (occ[(2 * ((c / n) | 0) + 1) * F + 2 * (c % n) + 1] = 1);
    const branch = (o.twist || 0) / 100,
      start = cells[Math.floor(rnd() * cells.length)],
      active = [start];
    seen[start] = 1;
    mark(start);
    while (active.length) {
      const k = rnd() < branch ? Math.floor(rnd() * active.length) : active.length - 1,
        c = active[k],
        i = c % n,
        j = (c / n) | 0,
        free = [];
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const a = i + di,
          b = j + dj,
          q = b * n + a;
        if (a >= 0 && b >= 0 && a < n && b < n && keep[q] && !seen[q]) free.push([q, di, dj]);
      }
      if (!free.length) {
        active.splice(k, 1);
        continue;
      }
      const [q, di, dj] = free[Math.floor(rnd() * free.length)];
      seen[q] = 1;
      mark(q);
      occ[(2 * j + 1 + dj) * F + 2 * i + 1 + di] = 1; // the passage between the two cells
      active.push(q);
    }
    // the outline of the occupied squares, clockwise on screen: one edge leaves each corner on the outline
    const nextOf = new Map(),
      key = (x, y) => y * (F + 1) + x,
      at = (x, y) => x >= 0 && y >= 0 && x < F && y < F && occ[y * F + x];
    let first = -1;
    for (let y = 0; y < F; y++)
      for (let x = 0; x < F; x++) {
        if (!occ[y * F + x]) continue;
        if (!at(x, y - 1)) nextOf.set(key(x, y), key(x + 1, y));
        if (!at(x + 1, y)) nextOf.set(key(x + 1, y), key(x + 1, y + 1));
        if (!at(x, y + 1)) nextOf.set(key(x + 1, y + 1), key(x, y + 1));
        if (!at(x - 1, y)) nextOf.set(key(x, y + 1), key(x, y));
        if (first < 0) first = key(x, y);
      }
    const loop = [];
    for (let v = first, k = 0; k <= nextOf.size; k++) {
      loop.push([v % (F + 1), Math.floor(v / (F + 1))]);
      v = nextOf.get(v);
      if (v === first) break;
    }
    // keep the corners only, then round them (radius just under half a step: corridor and wall ends turn in a half
    // circle)
    const V = loop.filter((p, i) => {
      const a = loop[(i + loop.length - 1) % loop.length],
        b = loop[(i + 1) % loop.length];
      return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0;
    });
    return { paths: [roundLoop(V, 0.45, 6)], closed: [true], box: [F, F], gap: 1 };
  }

  // Turtle drawing of an L-system: F (and any letter in `draw`) steps forward one unit, + and − turn by `angle`
  function lsystem(axiom, rules, order, angle, draw) {
    let s = axiom;
    for (let k = 0; k < order; k++) s = s.replace(/[A-Z]/g, (c) => rules[c] || c);
    const pts = [0, 0];
    let x = 0,
      y = 0,
      a = 0;
    for (const c of s)
      if (c === "F" || (draw && draw.includes(c))) {
        x += Math.cos(a);
        y += Math.sin(a);
        pts.push(Math.round(x * 1e9) / 1e9, Math.round(y * 1e9) / 1e9);
      } else if (c === "+") a += angle;
      else if (c === "-") a -= angle;
    return pts;
  }
  // a flat [x, y, …] moved to start at 0, 0 with its box
  function boxed(pts) {
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      x0 = Math.min(x0, pts[i]);
      x1 = Math.max(x1, pts[i]);
      y0 = Math.min(y0, pts[i + 1]);
      y1 = Math.max(y1, pts[i + 1]);
    }
    for (let i = 0; i < pts.length; i += 2) {
      pts[i] -= x0;
      pts[i + 1] -= y0;
    }
    return [x1 - x0, y1 - y0];
  }

  // Moore loop: the closed version of the Hilbert curve, 2^order cells across, every gap one step
  function moore(o) {
    // it ends one step from where it started: the loop closes there
    const pts = lsystem("LFL+F+LFL", { L: "-RF+LFL+FR-", R: "+LF-RFR-FL+" }, o.detail - 1, Math.PI / 2);
    return { paths: [pts], closed: [true], box: boxed(pts), gap: 1 };
  }
  function hilbert(o) {
    const pts = lsystem("A", { A: "+BF-AFA-FB+", B: "-AF+BFB+FA-" }, o.detail, Math.PI / 2);
    return { paths: [pts], closed: [false], box: boxed(pts), gap: 1 };
  }
  // Gosper curve (flowsnake) on the hexagonal grid: its closest neighbouring steps are √3 / 2 apart
  function gosper(o) {
    const pts = lsystem("A", { A: "A-B--B+A++AA+B-", B: "+A-BB--B-A++A+B" }, o.detail, Math.PI / 3, "AB");
    return { paths: [pts], closed: [false], box: boxed(pts), gap: Math.sqrt(3) / 2 };
  }

  // a regular polygon's radius at angle a, for a circumradius of 1, standing on a flat side (sides 0: a circle)
  const polyR = (a, n) => {
    if (!n) return 1;
    const s = TAU / n,
      b = a - Math.PI / 2 + s / 2,
      f = (((b % s) + s) % s) - s / 2;
    return Math.cos(Math.PI / n) / Math.cos(f);
  };

  // Double spiral: two spiral arms wound into each other, joined smoothly at the centre and by a short step at the
  // outside, so the whole thing is one closed loop with the same gap between every pair of turns. Sides make the
  // turns polygons; Twist turns each one a little more than the one inside it.
  function doubleSpiral(o) {
    const n = o.sides || 0,
      T = TAU * o.detail,
      c = 1 / (T + Math.PI),
      tw = n ? ((o.twist || 0) / 100) * 0.5 : 0; // radians over the whole radius; more and the turns would cross
    const P = (a, r) => {
      const f = r * polyR(a + tw * r, n);
      return [f * Math.cos(a), f * Math.sin(a)];
    };
    const pts = [],
      steps = Math.ceil(o.detail * (n ? 48 * n : 160));
    for (let k = steps; k >= 0; k--) pts.push(...P((T * k) / steps + Math.PI, (c * T * k) / steps)); // arm 2, inwards
    const out = steps + Math.ceil(steps / (2 * o.detail));
    for (let k = 1; k <= out; k++) {
      const th = ((T + Math.PI) * k) / out;
      pts.push(...P(th, c * th)); // arm 1, outwards, half a turn further
    }
    // back in to the start
    for (let k = 1; k < 8; k++) pts.push(...P(T + Math.PI, c * (T + Math.PI - (Math.PI * k) / 8)));
    return {
      paths: [pts],
      closed: [true],
      box: boxed(pts),
      gap: c * Math.PI * (n ? Math.cos(Math.PI / n) : 1) * (tw ? 0.7 : 1),
    };
  }

  // Whirl: polygons turning as they shrink, as one line spiralling in from the outside to the middle (the twisted
  // squares of op art, or pursuit polygons with their gaps evened out). Each corner turns a little past the corner of
  // the round outside it (Turn per round) and sits the same gap inside that round's side, all the way in, so the line
  // never touches itself.
  function whirl(o) {
    const n = o.sides >= 3 ? o.sides : 12,
      al = ((o.twist || 0) / 100) * (Math.PI / n),
      rounds = o.detail,
      step = (TAU + al) / n, // corner to corner: a full turn plus the turn per round, over the sides
      h = step / 2,
      c = Math.cos(h),
      rho = Math.cos(h - al) / c; // a corner turned by al reaches this much further out than the side it sits by
    // the gap g that brings the line to the middle in about `rounds` rounds (each round's side distance is the last
    // one's, less g, over rho)
    // (twisted, the rounds shrink faster as they go in: the gap never goes below a 70th of the width, so a tight
    // twist stops sooner)
    const g = Math.max(
      2 / 70,
      rho > 1 + 1e-9 ? (c * rho ** -rounds * (rho - 1)) / (rho - rho ** -rounds) : c / (rounds + 1)
    );
    const pts = [];
    for (let j = 0; ; j++) {
      const th = -Math.PI / 2 + Math.PI / n + j * step,
        ux = Math.cos(th),
        uy = Math.sin(th);
      let r;
      if (j < n)
        r = 1 - (j * g) / (n * c); // the first round: straight in from the outside
      else {
        // exactly g inside the side of the round outside it (from corner j − n to the next), along this corner's ray
        const ax = pts[2 * (j - n)],
          ay = pts[2 * (j - n) + 1],
          bx = pts[2 * (j - n) + 2],
          by = pts[2 * (j - n) + 3],
          L = Math.hypot(bx - ax, by - ay);
        if (!L) break;
        const nx = (by - ay) / L,
          ny = -(bx - ax) / L,
          sgn = nx * ax + ny * ay < 0 ? -1 : 1, // the side's normal, pointing out
          dLine = sgn * (nx * ax + ny * ay),
          un = sgn * (nx * ux + ny * uy);
        if (!(un > 0)) break;
        r = (dLine - g) / un;
      }
      if (!(r > g)) break;
      pts.push(r * ux, r * uy);
    }
    // the closest a corner comes to the round outside it
    let gap = Infinity;
    const seg = (px, py, i) => {
      const ax = pts[2 * i],
        ay = pts[2 * i + 1],
        dx = pts[2 * i + 2] - ax,
        dy = pts[2 * i + 3] - ay,
        L = dx * dx + dy * dy,
        t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
      return Math.hypot(px - ax - t * dx, py - ay - t * dy);
    };
    for (let j = n + 1; j < pts.length / 2; j++)
      gap = Math.min(gap, seg(pts[2 * j], pts[2 * j + 1], j - n), seg(pts[2 * j], pts[2 * j + 1], j - n - 1));
    return {
      paths: [pts],
      closed: [false],
      box: boxed(pts),
      gap: Number.isFinite(gap) ? gap : g,
      rounds: Math.floor(pts.length / 2 / n),
    };
  }

  // Waves: rows of the same gentle wave, each a little shifted from the one before, joined end to end by half
  // circles (left to right, then back), one open line. Amplitude is how far a wave swings, as a share of the gap
  // between rows; it is held back so neighbouring rows always keep at least 40% of that gap between them.
  function waves(o, rnd) {
    const rows = o.detail,
      sp = 1 / rows,
      W = 1.6,
      M = 240,
      K = [0, 1, 2].map((k) => ({
        f: (1 + rnd() * 2.5) * (k + 1) * 0.7,
        p: rnd() * TAU,
        d: (0.15 + rnd() * 0.35) * (rnd() < 0.5 ? -1 : 1),
        a: 1 / (k + 1),
      }));
    const env = (x) => 0.2 + 0.8 * Math.exp(-(((x / W - 0.5) / 0.3) ** 2));
    const g = (x, r) => env(x) * K.reduce((s, k) => s + k.a * Math.sin((TAU * k.f * x) / W + k.p + r * k.d), 0);
    const X = Array.from({ length: M + 1 }, (_, i) => (W * i) / M);
    // the closest two neighbouring rows come at amplitude amp (measured across, not just straight down)
    const closest = (amp) => {
      let best = Infinity;
      const win = Math.ceil((2 * sp * M) / W);
      for (let r = 0; r + 1 < rows; r++) {
        const a = X.map((x) => r * sp + amp * g(x, r)),
          b = X.map((x) => (r + 1) * sp + amp * g(x, r + 1));
        for (let i = 0; i <= M; i++)
          for (let j = Math.max(0, i - win); j <= Math.min(M, i + win); j++)
            best = Math.min(best, Math.hypot(X[i] - X[j], b[i] - a[j]));
      }
      return best;
    };
    let amp = ((o.twist || 0) / 100) * 1.2 * sp,
      gap = closest(amp);
    for (let k = 0; k < 30 && gap < 0.4 * sp; k++) gap = closest((amp *= 0.85));
    const y = (x, r) => r * sp + amp * g(x, r),
      pts = [];
    for (let r = 0; r < rows; r++) {
      const ltr = r % 2 === 0;
      for (let i = 0; i <= M; i++) {
        const x = X[ltr ? i : M - i];
        pts.push(x, y(x, r));
      }
      if (r + 1 < rows) {
        // a half circle out past the end, down to the next row
        const xe = ltr ? W : 0,
          y0 = y(xe, r),
          y1 = y(xe, r + 1),
          cy = (y0 + y1) / 2,
          rad = (y1 - y0) / 2;
        for (let k = 1; k < 12; k++) {
          const a = -Math.PI / 2 + (Math.PI * k) / 12;
          pts.push(xe + (ltr ? 1 : -1) * rad * Math.cos(a), cy + rad * Math.sin(a));
        }
      }
    }
    return { paths: [pts], closed: [false], box: boxed(pts), gap: rows > 1 ? gap : sp };
  }

  // Spirograph: a hypotrochoid, the pen d from the centre of a wheel rolling inside a ring Petals times its size.
  // Pen offset under the wheel's own radius gives rounded petals and no crossings; past it the petals loop.
  function spirograph(o) {
    const P = o.detail,
      d = 0.2 + ((o.twist || 0) / 100) * 2,
      k = P - 1,
      M = Math.max(600, 90 * P),
      pts = [];
    for (let i = 0; i < M; i++) {
      const t = (TAU * i) / M;
      pts.push(k * Math.cos(t) + d * Math.cos(k * t), k * Math.sin(t) - d * Math.sin(k * t));
    }
    const box = boxed(pts);
    return { paths: [pts], closed: [true], box, gap: Math.max(box[0], box[1]) / 120, crosses: d > 1 };
  }

  // Lissajous: x = sin(a t + phase), y = sin((a + 1) t), one closed curve that crosses itself
  function lissajous(o) {
    const a = o.detail,
      b = a + 1,
      ph = ((o.twist || 0) / 100) * (Math.PI / 2),
      M = 400 * b,
      pts = [];
    for (let i = 0; i < M; i++) {
      const t = (TAU * i) / M;
      pts.push(Math.sin(a * t + ph), Math.sin(b * t));
    }
    return { paths: [pts], closed: [true], box: boxed(pts), gap: 1 / 60, crosses: true };
  }

  // Truchet tiles: every tile inside the shape holds two quarter circles joining the middles of its sides, one way or
  // the other (Mix: how many go the first way); the arcs join up into loops and curves across the tiles. Many separate
  // pieces: the tracer joins them with connectors, so they suit the pen plotter more than chocolate.
  function truchet(o, rnd) {
    const n = o.detail,
      inside = SHAPES[o.shape] || SHAPES.square,
      mix = (o.twist == null ? 50 : o.twist) / 100,
      arcs = [];
    const arc = (cx, cy, a0) => {
      const p = [];
      for (let k = 0; k <= 8; k++) {
        const a = a0 + ((Math.PI / 2) * k) / 8;
        p.push([cx + 0.5 * Math.cos(a), cy + 0.5 * Math.sin(a)]);
      }
      return p;
    };
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        if (!inside(((i + 0.5) / n) * 2 - 1, ((j + 0.5) / n) * 2 - 1)) continue;
        if (rnd() < mix) arcs.push(arc(i, j, 0), arc(i + 1, j + 1, Math.PI));
        else arcs.push(arc(i + 1, j, Math.PI / 2), arc(i, j + 1, -Math.PI / 2));
      }
    if (!arcs.length) return null;
    // join arcs that meet at the middle of a side into longer curves (and loops)
    const k2 = ([x, y]) => `${Math.round(2 * x)},${Math.round(2 * y)}`,
      ends = new Map();
    arcs.forEach((a, i) => {
      for (const e of [0, 1]) {
        const k = k2(e ? a[a.length - 1] : a[0]);
        if (!ends.has(k)) ends.set(k, []);
        ends.get(k).push([i, e]);
      }
    });
    const used = new Uint8Array(arcs.length),
      paths = [],
      closed = [];
    const other = (k, i) => (ends.get(k) || []).find(([q]) => q !== i && !used[q]);
    const follow = (i, fromEnd, chain) => {
      // walk on from arc i, entered at its end `fromEnd`
      for (;;) {
        used[i] = 1;
        const a = fromEnd ? [...arcs[i]].reverse() : arcs[i];
        chain.push(...a.slice(1));
        const nx = other(k2(a[a.length - 1]), i);
        if (!nx) return;
        [i, fromEnd] = nx;
      }
    };
    for (let s = 0; s < arcs.length; s++) {
      if (used[s]) continue;
      // start from a loose end when this curve has one, so it comes out whole
      let i = s,
        e = 0;
      const back = new Set([s]);
      for (;;) {
        const k = k2(e ? arcs[i][arcs[i].length - 1] : arcs[i][0]),
          nx = (ends.get(k) || []).find(([q]) => q !== i && !used[q]);
        if (!nx || back.has(nx[0])) break;
        [i, e] = [nx[0], 1 - nx[1]];
        back.add(i);
      }
      const chain = [e ? arcs[i][arcs[i].length - 1] : arcs[i][0]];
      follow(i, e, chain);
      const a = chain[0],
        b = chain[chain.length - 1],
        loop = chain.length > 3 && Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6;
      if (loop) chain.pop();
      paths.push(chain.flat());
      closed.push(loop);
    }
    return { paths, closed, box: [n, n], gap: Math.SQRT2 - 1 };
  }

  // ---------- patterns from a picture: its light and dark drawn as one line ----------
  // tone: { w, h, d } (d: darkness per pixel, 0 white … 1 black, row by row). The picture is fitted inside the
  // pattern's
  // box (letterboxed: outside it counts as white).
  // Contrast (0–100) bends the darkness: d^γ, γ = 2^((50 − c) / 50), so 0 keeps only the darkest, 50 is as is, 100
  // brings out the light greys.
  const gammaOf = (c) => Math.pow(2, (50 - (c == null ? 50 : c)) / 50);
  // how hard waves and the spiral wiggle for a darkness t: eased out (1 − (1 − t)²), so mid greys already wiggle well
  const easeOut = (t) => 1 - (1 - t) * (1 - t);
  // darkness at (u, v) in 0…1 of a box of aspect A (width ÷ height), the picture fitted inside it
  function toneIn(T, A) {
    const a = T.w / T.h,
      sw = a >= A ? 1 : a / A, // the picture's share of the box's width and height
      sh = a >= A ? A / a : 1;
    return (u, v) => {
      const pu = (u - (1 - sw) / 2) / sw,
        pv = (v - (1 - sh) / 2) / sh;
      if (pu < 0 || pv < 0 || pu > 1 || pv > 1) return 0;
      const x = Math.min(T.w - 1.001, Math.max(0, pu * T.w - 0.5)),
        y = Math.min(T.h - 1.001, Math.max(0, pv * T.h - 0.5)),
        x0 = Math.floor(x),
        y0 = Math.floor(y),
        fx = x - x0,
        fy = y - y0,
        i = y0 * T.w + x0;
      const r0 = T.d[i] * (1 - fx) + T.d[i + 1] * fx,
        r1 = T.d[i + T.w] * (1 - fx) + T.d[i + T.w + 1] * fx;
      return r0 * (1 - fy) + r1 * fy;
    };
  }
  // the darkness of an N × N grid of cells over the square box (each the mean of 3 × 3 samples), bent by γ, and its
  // summed-area table, for the mean over any block of cells
  function toneGrid(T, N, gamma) {
    const f = toneIn(T, 1),
      S = new Float64Array((N + 1) * (N + 1));
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        let t = 0;
        for (let a = 0; a < 3; a++)
          for (let b = 0; b < 3; b++) t += f((i + (a + 0.5) / 3) / N, (j + (b + 0.5) / 3) / N);
        const g = Math.pow(t / 9, gamma);
        S[(j + 1) * (N + 1) + i + 1] = g + S[j * (N + 1) + i + 1] + S[(j + 1) * (N + 1) + i] - S[j * (N + 1) + i];
      }
    return (x, y, s) =>
      (S[(y + s) * (N + 1) + x + s] - S[y * (N + 1) + x + s] - S[(y + s) * (N + 1) + x] + S[y * (N + 1) + x]) / (s * s);
  }
  // Space-filling curve by tone: a Hilbert curve whose cells are finer where the picture is darker (from order lo in
  // white to the finest order in black), the centres of the cells joined in Hilbert order. Consecutive cells share an
  // edge at every mix of sizes, so the curve stays one open line that never crosses itself.
  function hilbertTone(o, rnd, T) {
    const hi = o.detail,
      lo = Math.max(1, hi - (o.range || 3)),
      N = 1 << hi,
      mean = toneGrid(T, N, gammaOf(o.twist)),
      pts = [];
    const rec = (x0, y0, xi, xj, yi, yj, n) => {
      const d = hi - n,
        s = 1 << n,
        bx = Math.min(x0, x0 + xi + yi),
        by = Math.min(y0, y0 + xj + yj);
      if (n > 0 && (d < lo || (d < hi && mean(bx, by, s) > (d - lo + 1) / (hi - lo + 1)))) {
        rec(x0, y0, yi / 2, yj / 2, xi / 2, xj / 2, n - 1);
        rec(x0 + xi / 2, y0 + xj / 2, xi / 2, xj / 2, yi / 2, yj / 2, n - 1);
        rec(x0 + xi / 2 + yi / 2, y0 + xj / 2 + yj / 2, xi / 2, xj / 2, yi / 2, yj / 2, n - 1);
        rec(x0 + xi / 2 + yi, y0 + xj / 2 + yj, -yi / 2, -yj / 2, -xi / 2, -xj / 2, n - 1);
      } else pts.push(x0 + (xi + yi) / 2, y0 + (xj + yj) / 2);
    };
    rec(0, 0, N, 0, 0, N, hi);
    return { paths: [pts], closed: [false], box: [N, N], gap: 0.8 };
  }

  // Wave rows by tone: rows across the picture, each wiggling harder and tighter where it is darker, joined end to end
  // by half circles into one open line. The wiggle is held to (row spacing − gap) / 2 and its wavelength to at least 4
  // gaps, so neighbouring rows, and the folds of one row, stay at least a gap (35% of the row spacing) apart.
  function wavesTone(o, rnd, T) {
    const A = T.w / T.h,
      rows = o.detail,
      sp = 1 / rows,
      gap = 0.35 * sp,
      amax = (sp - gap) / 2,
      lmin = 4 * gap,
      lmax = 4 * sp,
      g = gammaOf(o.twist),
      f = toneIn(T, A),
      pts = [],
      dx = gap / 3;
    for (let r = 0; r < rows; r++) {
      const ltr = r % 2 === 0,
        yc = (r + 0.5) * sp;
      let ph = 0;
      const row = [];
      for (let x = 0; x <= A + 1e-9; x += dx) {
        const t = easeOut(Math.pow(f(x / A, yc), g)),
          lam = lmax - (lmax - lmin) * t;
        row.push([x, yc + amax * t * Math.sin(ph)]);
        ph += (2 * Math.PI * dx) / lam;
      }
      if (!ltr) row.reverse(); // right to left
      for (const [x, y] of row) pts.push(x, y);
      if (r + 1 < rows) {
        // a half circle out past the end, down to the next row's centre (each row starts and ends on its centre line
        // only roughly: the next row is reached from where this one ends)
        const xe = ltr ? A : 0,
          y0 = row[row.length - 1][1],
          y1 = (r + 1.5) * sp,
          cy = (y0 + y1) / 2,
          rad = (y1 - y0) / 2;
        for (let k = 1; k < 12; k++) {
          const a = -Math.PI / 2 + (Math.PI * k) / 12;
          pts.push(xe + (ltr ? 1 : -1) * rad * Math.cos(a), cy + rad * Math.sin(a));
        }
      }
    }
    return { paths: [pts], closed: [false], box: boxed(pts), gap };
  }

  // Vibrating spiral: one spiral from the centre out (Turns), wobbling across its path harder and faster where the
  // picture is darker, as one open line. The picture fills the spiral's circle (its middle square shows; the corners
  // are cut). Held like the waves: wobble ≤ (pitch − gap) / 2, wavelength ≥ 4 gaps, gap 35% of the pitch.
  function spiralTone(o, rnd, T) {
    const turns = o.detail,
      R = 1,
      p = R / (turns + 0.5),
      gap = 0.35 * p,
      amax = (p - gap) / 2,
      lmin = 4 * gap,
      lmax = 4 * p,
      g = gammaOf(o.twist),
      f = toneIn(T, 1),
      a = T.w / T.h,
      // fill the circle: the picture's short side is the circle's diameter
      fill = (x, y) => {
        const u = 0.5 + (x / (2 * R) / (a >= 1 ? 1 / a : 1)) * (a >= 1 ? 1 / a : 1),
          v = 0.5 + y / (2 * R);
        return f(Math.min(1, Math.max(0, u)), Math.min(1, Math.max(0, v)));
      },
      pts = [],
      ds = gap / 3;
    let th = Math.PI, // start half a turn out, so the middle isn't a knot
      ph = 0;
    for (;;) {
      const r = (p * th) / (2 * Math.PI);
      if (r > R - p / 2) break;
      const x = r * Math.cos(th),
        y = r * Math.sin(th),
        t = easeOut(Math.pow(fill(x, y), g)),
        lam = lmax - (lmax - lmin) * t,
        w = amax * t * Math.sin(ph);
      pts.push(x + w * Math.cos(th), y + w * Math.sin(th));
      th += ds / Math.max(r, p);
      ph += (2 * Math.PI * ds) / lam;
    }
    return { paths: [pts], closed: [false], box: boxed(pts), gap };
  }

  // Labyrinth by tone: a maze on cells that are finer where the picture is darker (a quadtree, from order lo in white
  // to the finest order in black, neighbours at most one level apart), and the one line round it. Every cell is a room
  // half its size in its middle; the maze's passages join rooms with a corridor as wide as the smaller room. Drawn on a
  // grid of 4 per finest cell: walls and corridors are at least 2 of it wide, gaps narrower are closed, holes filled,
  // so the outline is one closed loop, its lines 2 apart in the darkest parts (1.3 across a diagonal corner).
  function labyrinthTone(o, rnd, T) {
    const hi = o.detail,
      lo = Math.max(1, hi - (o.range || 3)),
      N = 1 << hi,
      mean = toneGrid(T, N, gammaOf(o.twist));
    // the quadtree: leaves [x, y, s] in finest cells, owner of every finest cell
    const own = new Int32Array(N * N).fill(-1),
      leaves = [];
    const split = (x, y, s, d) => {
      if (s > 1 && (d < lo || (d < hi && mean(x, y, s) > (d - lo + 1) / (hi - lo + 1)))) {
        const h = s / 2;
        split(x, y, h, d + 1);
        split(x + h, y, h, d + 1);
        split(x, y + h, h, d + 1);
        split(x + h, y + h, h, d + 1);
      } else leaves.push([x, y, s]);
    };
    split(0, 0, N, 0);
    // balance: a leaf more than twice the size of a neighbour splits, until none is
    for (let changed = true; changed; ) {
      changed = false;
      own.fill(-1);
      leaves.forEach(([x, y, s], k) => {
        for (let j = y; j < y + s; j++) own.fill(k, j * N + x, j * N + x + s);
      });
      const next = [];
      for (const L of leaves) {
        const [x, y, s] = L;
        let tooBig = false;
        if (s > 2)
          for (let i = 0; i < s && !tooBig; i++)
            for (const [cx, cy] of [
              [x - 1, y + i],
              [x + s, y + i],
              [x + i, y - 1],
              [x + i, y + s],
            ])
              if (cx >= 0 && cy >= 0 && cx < N && cy < N && leaves[own[cy * N + cx]][2] * 2 < s) tooBig = true;
        if (tooBig) {
          const h = s / 2;
          next.push([x, y, h], [x + h, y, h], [x, y + h, h], [x + h, y + h, h]);
          changed = true;
        } else next.push(L);
      }
      leaves.length = 0;
      leaves.push(...next);
    }
    own.fill(-1);
    leaves.forEach(([x, y, s], k) => {
      for (let j = y; j < y + s; j++) own.fill(k, j * N + x, j * N + x + s);
    });
    // neighbours (each pair once, with the side: 0 right, 1 down)
    const nb = leaves.map(() => new Set());
    leaves.forEach(([x, y, s], k) => {
      for (let i = 0; i < s; i++) {
        if (x + s < N) nb[k].add(own[(y + i) * N + x + s]);
        if (y + s < N) nb[k].add(own[(y + s) * N + x + i]);
        if (x > 0) nb[k].add(own[(y + i) * N + x - 1]);
        if (y > 0) nb[k].add(own[(y - 1) * N + x + i]);
      }
    });
    // a random spanning tree (growing tree: mostly the newest cell, sometimes any)
    const seen = new Uint8Array(leaves.length),
      edges = [],
      active = [Math.floor(rnd() * leaves.length)];
    seen[active[0]] = 1;
    while (active.length) {
      const k = rnd() < 0.3 ? Math.floor(rnd() * active.length) : active.length - 1,
        c = active[k],
        free = [...nb[c]].filter((q) => !seen[q]);
      if (!free.length) {
        active.splice(k, 1);
        continue;
      }
      const q = free[Math.floor(rnd() * free.length)];
      seen[q] = 1;
      edges.push([c, q]);
      active.push(q);
    }
    // rooms and corridors on the fine grid (4 per finest cell)
    const F = 4 * N,
      occ = new Uint8Array(F * F),
      fillRect = (x0, y0, x1, y1) => {
        for (let y = Math.max(0, y0); y < Math.min(F, y1); y++)
          occ.fill(1, y * F + Math.max(0, x0), y * F + Math.min(F, x1));
      },
      room = ([x, y, s]) => [4 * x + s, 4 * y + s, 4 * x + 3 * s, 4 * y + 3 * s];
    for (const L of leaves) fillRect(...room(L));
    for (const [a, b] of edges) {
      const A = room(leaves[a]),
        B = room(leaves[b]),
        small = leaves[a][2] <= leaves[b][2] ? A : B;
      const ox = Math.min(A[2], B[2]) <= Math.max(A[0], B[0]); // side by side (left–right), else one above the other
      if (ox) fillRect(Math.min(A[2], B[2]), small[1], Math.max(A[0], B[0]), small[3]);
      else fillRect(small[0], Math.min(A[3], B[3]), small[2], Math.max(A[1], B[1]));
    }
    closeGaps(occ, F);
    return { ...outlineLoop(occ, F, 0.9), gap: 1.3 }; // (2 between straight lines; 1.3 across diagonal corners)
  }
  // Close gaps of one fine cell between occupied parts (an empty cell with occupied cells on both sides, across or
  // down, and two occupied cells touching only at a corner), then fill every hole, so the occupied set is one piece
  // with
  // one outline and its walls are at least 2 wide
  function closeGaps(occ, F) {
    const at = (x, y) => x >= 0 && y >= 0 && x < F && y < F && occ[y * F + x];
    for (let pass = 0; pass < 2; pass++)
      for (let y = 0; y < F; y++)
        for (let x = 0; x < F; x++) {
          if (occ[y * F + x]) continue;
          if ((at(x - 1, y) && at(x + 1, y)) || (at(x, y - 1) && at(x, y + 1))) occ[y * F + x] = 1;
        }
    // two occupied cells touching only at a corner: join them
    for (let y = 0; y + 1 < F; y++)
      for (let x = 0; x + 1 < F; x++) {
        const a = occ[y * F + x],
          b = occ[y * F + x + 1],
          c = occ[(y + 1) * F + x],
          d = occ[(y + 1) * F + x + 1];
        if (a && d && !b && !c) occ[y * F + x + 1] = 1;
        else if (b && c && !a && !d) occ[y * F + x] = 1;
      }
    // holes: empty cells not reached from the border
    const out = new Uint8Array(occ.length),
      q = [];
    for (let i = 0; i < F; i++)
      for (const c of [i, (F - 1) * F + i, i * F, i * F + F - 1]) if (!occ[c] && !out[c]) (out[c] = 1), q.push(c);
    while (q.length) {
      const c = q.pop(),
        x = c % F,
        y = (c / F) | 0;
      for (const [X, Y] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ]) {
        const e = Y * F + X;
        if (X >= 0 && Y >= 0 && X < F && Y < F && !occ[e] && !out[e]) (out[e] = 1), q.push(e);
      }
    }
    for (let i = 0; i < occ.length; i++) if (!out[i]) occ[i] = 1;
  }
  // the outline of an occupied grid (one piece, no holes) as one closed loop, its corners rounded to rho
  function outlineLoop(occ, F, rho) {
    const nextOf = new Map(),
      key = (x, y) => y * (F + 1) + x,
      at = (x, y) => x >= 0 && y >= 0 && x < F && y < F && occ[y * F + x];
    let first = -1;
    for (let y = 0; y < F; y++)
      for (let x = 0; x < F; x++) {
        if (!occ[y * F + x]) continue;
        if (!at(x, y - 1)) nextOf.set(key(x, y), key(x + 1, y));
        if (!at(x + 1, y)) nextOf.set(key(x + 1, y), key(x + 1, y + 1));
        if (!at(x, y + 1)) nextOf.set(key(x + 1, y + 1), key(x, y + 1));
        if (!at(x - 1, y)) nextOf.set(key(x, y + 1), key(x, y));
        if (first < 0) first = key(x, y);
      }
    const loop = [];
    for (let v = first, k = 0; k <= nextOf.size; k++) {
      loop.push([v % (F + 1), Math.floor(v / (F + 1))]);
      v = nextOf.get(v);
      if (v === first) break;
    }
    const V = loop.filter((p, i) => {
      const a = loop[(i + loop.length - 1) % loop.length],
        b = loop[(i + 1) % loop.length];
      return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0;
    });
    return { paths: [roundLoop(V, rho, 6)], closed: [true], box: [F, F] };
  }

  // What each style is and which controls it uses, for the app's Geometric art card. detail and twist: the two
  // sliders (name, range, starting value, and how to say a value); sides: the Sides menu; shape: the Shape menu;
  // seed: a Shuffle button; line: which Line setting traces it as drawn (closed: a loop; open: from end to end);
  // oneLine: already one unbroken line; evenGap: its gap is the spacing between neighbouring lines all over (the app
  // starts it at the width where that gap is the line spacing); crosses: it crosses itself.
  const ord = (v) => `order ${v} · ${2 ** v} × ${2 ** v}`;
  UNB.PATTERNS = {
    labyrinth: {
      label: "Labyrinth",
      tip: "One closed line around a random maze, an even gap everywhere",
      detail: { name: "Cells across", min: 4, max: 36, value: 12, say: (v) => `${v} cells` },
      twist: {
        name: "Branching",
        min: 0,
        max: 100,
        value: 30,
        say: (v) => (v < 15 ? "long corridors" : v > 70 ? "short branches" : `${v}%`),
      },
      shape: true,
      seed: true,
      line: "closed",
      oneLine: true,
      evenGap: true,
    },
    moore: {
      label: "Moore loop",
      tip: "A closed space-filling curve: every gap one step",
      detail: { name: "Order", min: 2, max: 6, value: 4, say: ord },
      line: "closed",
      oneLine: true,
      evenGap: true,
    },
    hilbert: {
      label: "Hilbert curve",
      tip: "A space-filling curve from one corner to the next",
      detail: { name: "Order", min: 1, max: 6, value: 4, say: ord },
      line: "open",
      oneLine: true,
      evenGap: true,
    },
    gosper: {
      label: "Gosper curve",
      tip: "The flowsnake: a space-filling curve on a hexagonal grid",
      detail: { name: "Order", min: 1, max: 3, value: 3, say: (v) => `order ${v} · ${7 ** v} steps` },
      line: "open",
      oneLine: true,
      evenGap: true,
    },
    spiral: {
      label: "Double spiral",
      tip: "Two spiral arms wound into each other: one closed loop, even gaps",
      detail: { name: "Turns", min: 2, max: 16, value: 7, say: (v) => `${v} turns` },
      twist: { name: "Twist", min: 0, max: 100, value: 0, say: (v) => (v ? `${v}%` : "none") },
      sides: true,
      line: "closed",
      oneLine: true,
      evenGap: true,
    },
    whirl: {
      label: "Whirl",
      tip: "Polygons turning as they shrink, one line spiralling in with an even gap",
      detail: { name: "Rounds", min: 3, max: 40, value: 16, say: (v) => `up to ${v} rounds` },
      twist: { name: "Turn per round", min: 0, max: 90, value: 15, say: (v) => (v ? `${v}%` : "none") },
      sides: true,
      line: "open",
      oneLine: true,
      evenGap: true,
    },
    waves: {
      label: "Waves",
      tip: "Rows of a shifting wave joined end to end: one line, never touching",
      detail: { name: "Rows", min: 3, max: 30, value: 14, say: (v) => `${v} rows` },
      twist: { name: "Amplitude", min: 0, max: 100, value: 60, say: (v) => (v ? `${v}%` : "flat") },
      seed: true,
      line: "open",
      oneLine: true,
      evenGap: true,
    },
    spirograph: {
      label: "Spirograph",
      tip: "A wheel rolling inside a ring: rounded petals, looping (and crossing) past a 40% pen offset",
      detail: { name: "Petals", min: 3, max: 24, value: 7, say: (v) => `${v} petals` },
      twist: {
        name: "Pen offset",
        min: 0,
        max: 100,
        value: 30,
        say: (v) => (0.2 + v / 50 > 1 ? `${v}% · loops` : `${v}%`),
      },
      line: "closed",
      crosses: true,
    },
    lissajous: {
      label: "Lissajous",
      tip: "Two swinging pendulums at a ratio of a : a + 1; crosses itself",
      detail: { name: "Lobes", min: 1, max: 8, value: 3, say: (v) => `${v} : ${v + 1}` },
      twist: { name: "Phase", min: 0, max: 100, value: 50, say: (v) => `${Math.round(v * 0.9)}°` },
      line: "closed",
      crosses: true,
    },
    truchet: {
      label: "Truchet tiles",
      tip: "Quarter circles on a grid of tiles, joined into loops (many pieces)",
      detail: { name: "Tiles across", min: 3, max: 30, value: 10, say: (v) => `${v} tiles` },
      twist: { name: "Mix", min: 0, max: 100, value: 50, say: (v) => `${v}% one way` },
      shape: true,
      seed: true,
      line: "closed",
      evenGap: true,
    },
  };
  // patterns drawn from a picture (o.tone: { w, h, d }); detail and twist as above. evenGap: their gap is the finest
  // one (in the darkest parts), so the app starts them where that is the line spacing
  Object.assign(UNB.PATTERNS, {
    hilbertTone: {
      label: "Space-filling curve (picture)",
      tip: "A Hilbert curve that fills in finer where the picture is darker",
      detail: { name: "Finest order", min: 3, max: 8, value: 5, say: (v) => `order ${v} · ${2 ** v} cells across` },
      twist: { name: "Contrast", min: 0, max: 100, value: 50, say: (v) => `${v}%` },
      tone: true,
      line: "open",
      oneLine: true,
      evenGap: true,
    },
    wavesTone: {
      label: "Wave rows (picture)",
      tip: "Rows across the picture, wiggling harder and tighter where it is darker",
      detail: { name: "Rows", min: 4, max: 120, value: 20, say: (v) => `${v} rows` },
      twist: { name: "Contrast", min: 0, max: 100, value: 50, say: (v) => `${v}%` },
      tone: true,
      line: "open",
      oneLine: true,
      evenGap: true,
    },
    spiralTone: {
      label: "Vibrating spiral (picture)",
      tip: "One spiral from the middle out, wobbling harder where the picture is darker",
      detail: { name: "Turns", min: 4, max: 120, value: 10, say: (v) => `${v} turns` },
      twist: { name: "Contrast", min: 0, max: 100, value: 50, say: (v) => `${v}%` },
      tone: true,
      line: "open",
      oneLine: true,
      evenGap: true,
    },
    labyrinthTone: {
      label: "Labyrinth (picture)",
      tip: "A maze with smaller cells where the picture is darker, one closed line",
      detail: { name: "Finest order", min: 3, max: 7, value: 4, say: (v) => `order ${v} · ${2 ** v} cells across` },
      twist: { name: "Contrast", min: 0, max: 100, value: 50, say: (v) => `${v}%` },
      seed: true,
      tone: true,
      line: "closed",
      oneLine: true,
      evenGap: true,
    },
  });
  UNB.PATTERN_SHAPES = ["square", "circle", "hexagon", "diamond", "heart", "star"];

  // How a pattern is drawn as a picture to trace, long px on its long side: a margin of 6% all round, and strokes a
  // third of the closest gap between neighbouring lines (a 200th of the size for patterns that cross themselves), never
  // wider than 0.9% of the picture: the centreline trace outlines strokes wider than 1.6% as filled shapes. Returns
  // { w, h, s (px per pattern unit), m (margin, units), lineWidth (px) }; a point (x, y) goes to ((x + m) s, (y + m)
  // s).
  UNB.patternLayout = function (r, long) {
    const [bw, bh] = r.box,
      big = Math.max(bw, bh, 1e-9),
      m = 0.06 * big,
      s = long / (big + 2 * m);
    return {
      w: Math.max(8, Math.round((bw + 2 * m) * s)),
      h: Math.max(8, Math.round((bh + 2 * m) * s)),
      s,
      m,
      lineWidth: Math.min(0.009 * long, r.crosses ? (big * s) / 200 : Math.max(2, 0.3 * r.gap * s)),
    };
  };
  const MAKE = {
    labyrinth,
    moore,
    hilbert,
    gosper,
    spiral: doubleSpiral,
    whirl,
    waves,
    spirograph,
    lissajous,
    truchet,
    hilbertTone,
    wavesTone,
    spiralTone,
    labyrinthTone,
  };

  // One pattern. style: a key of UNB.PATTERNS; o: { detail, twist, sides (0: circle, 3–8), shape, seed, tone (the
  // picture, for the styles drawn from one: { w, h, d }) }.
  // Returns { paths: [[x, y, …]], closed: [bool], box: [w, h], gap, crosses } in the pattern's own units (y down): gap
  // is the closest any two neighbouring lines come (the app draws the strokes a third of that wide). null when the
  // style is unknown or nothing is left inside the shape.
  UNB.pattern = function (style, o) {
    const S = UNB.PATTERNS[style],
      make = MAKE[style];
    if (!S || !make) return null;
    const p = Object.assign({}, o || {}),
      clampTo = (v, spec) => Math.round(Math.min(spec.max, Math.max(spec.min, v == null ? spec.value : +v)));
    p.detail = clampTo(p.detail, S.detail);
    if (S.twist) p.twist = clampTo(p.twist, S.twist);
    if (S.tone && !(p.tone && p.tone.w > 1 && p.tone.h > 1)) return null; // drawn from a picture: needs one
    const r = make(p, seeded(p.seed || 1), p.tone);
    if (!r) return null;
    r.crosses = !!r.crosses;
    return r;
  };
})(typeof window !== "undefined" ? window : globalThis);
