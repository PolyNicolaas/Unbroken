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
  };

  // One pattern. style: a key of UNB.PATTERNS; o: { detail, twist, sides (0: circle, 3–8), shape, seed }.
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
    const r = make(p, seeded(p.seed || 1));
    if (!r) return null;
    r.crosses = !!r.crosses;
    return r;
  };
})(typeof window !== "undefined" ? window : globalThis);
