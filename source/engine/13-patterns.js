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
      straight = (o.straight || 0) / 100, // how often a corridor carries on the way it was going
      start = cells[Math.floor(rnd() * cells.length)],
      active = [start],
      cameBy = new Int8Array(n * n).fill(-1); // the direction each cell was reached by (index into the four)
    seen[start] = 1;
    mark(start);
    while (active.length) {
      const k = rnd() < branch ? Math.floor(rnd() * active.length) : active.length - 1,
        c = active[k],
        i = c % n,
        j = (c / n) | 0,
        free = [];
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].forEach(([di, dj], dir) => {
        const a = i + di,
          b = j + dj,
          q = b * n + a;
        if (a >= 0 && b >= 0 && a < n && b < n && keep[q] && !seen[q]) free.push([q, di, dj, dir]);
      });
      if (!free.length) {
        active.splice(k, 1);
        continue;
      }
      const on = straight && rnd() < straight ? free.find((f) => f[3] === cameBy[c]) : null,
        [q, di, dj, dir] = on || free[Math.floor(rnd() * free.length)];
      seen[q] = 1;
      cameBy[q] = dir;
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

  // Corners of an open polyline rounded the same way, its ends kept
  function roundOpen(V, rho, steps) {
    const out = [...V[0]],
      m = V.length;
    for (let i = 1; i + 1 < m; i++) {
      const P = V[i - 1],
        C = V[i],
        N = V[i + 1];
      const la = Math.hypot(C[0] - P[0], C[1] - P[1]),
        lb = Math.hypot(N[0] - C[0], N[1] - C[1]),
        r = Math.min(rho, 0.5 * la, 0.5 * lb);
      if (!(r > 0)) {
        out.push(...C);
        continue;
      }
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
    out.push(...V[m - 1]);
    return out;
  }
  // a flat [x, y, …] with its corners (not its straight-through points) rounded to rho
  function roundPts(pts, closed, rho) {
    if (!(rho > 0)) return pts;
    const V = [];
    for (let i = 0; i < pts.length; i += 2) V.push([pts[i], pts[i + 1]]);
    const m = V.length,
      C = V.filter((p, i) => {
        if (!closed && (i === 0 || i === m - 1)) return true;
        const a = V[(i + m - 1) % m],
          b = V[(i + 1) % m];
        return Math.abs((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])) > 1e-9;
      });
    return closed ? roundLoop(C, rho, 8) : roundOpen(C, rho, 8);
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
    const pts = roundPts(
      lsystem("LFL+F+LFL", { L: "-RF+LFL+FR-", R: "+LF-RFR-FL+" }, o.detail - 1, Math.PI / 2),
      true,
      ((o.round || 0) / 100) * 0.5
    );
    return { paths: [pts], closed: [true], box: boxed(pts), gap: 1 };
  }
  function hilbert(o) {
    const pts = roundPts(
      lsystem("A", { A: "+BF-AFA-FB+", B: "-AF+BFB+FA-" }, o.detail, Math.PI / 2),
      false,
      ((o.round || 0) / 100) * 0.5
    );
    return { paths: [pts], closed: [false], box: boxed(pts), gap: 1 };
  }
  // Gosper curve (flowsnake) on the hexagonal grid: its closest neighbouring steps are √3 / 2 apart
  function gosper(o) {
    const pts = roundPts(
      lsystem("A", { A: "A-B--B+A++AA+B-", B: "+A-BB--B-A++A+B" }, o.detail, Math.PI / 3, "AB"),
      false,
      ((o.round || 0) / 100) * 0.5
    );
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
    const q = n ? ((o.round || 0) / 100) * 0.8 : 0; // rounded polygons: part way to a circle
    const P = (a, r) => {
      const f = r * ((1 - q) * polyR(a + tw * r, n) + q);
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
      gap: c * Math.PI * (n ? (1 - q) * Math.cos(Math.PI / n) + q : 1) * (tw ? 0.7 : 1),
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
    // Rounded corners: a radius up to 3 gaps (each corner as wide as its edges allow). Every round is rounded by the
    // same
    // radius, so neighbouring rounds stay at least the gap apart (measured: the gap only grows)
    const G = Number.isFinite(gap) ? gap : g,
      out = roundPts(pts, false, ((o.round || 0) / 100) * 3 * G);
    return {
      paths: [out],
      closed: [false],
      box: boxed(out),
      gap: G,
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
      fq = (o.freq || 100) / 100, // Waves across: how many swings a row makes
      K = [0, 1, 2].map((k) => ({
        f: (1 + rnd() * 2.5) * (k + 1) * 0.7 * fq,
        p: rnd() * TAU,
        d: (0.15 + rnd() * 0.35) * (rnd() < 0.5 ? -1 : 1),
        a: 1 / (k + 1),
      }));
    // Calm ends: the rows settle down towards the sides (off: the same swing all the way across)
    const env = o.calm === false ? () => 1 : (x) => 0.2 + 0.8 * Math.exp(-(((x / W - 0.5) / 0.3) ** 2));
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

  // ---------- gears and pendulums: one closed line that crosses itself ----------
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  // A ring's track for the Spirograph: a closed curve, counter-clockwise (y up), its length the ring's teeth, densely
  // sampled with the arc length s, the direction th of travel and the inward normal at each point.
  // shape: circle, oval (aspect: the short side ÷ the long, 0.3–1), triangle, square, pentagon, hexagon (rounded
  // corners: corner radius ÷ the shape's size, at least the wheel's radius + 2% when rolling inside), stadium.
  function ringTrack(shape, teeth, aspect, corner, minCorner) {
    const pts = [],
      N = 2400;
    if (shape === "oval") {
      const b = Math.max(0.3, Math.min(1, aspect));
      for (let i = 0; i < N; i++) pts.push([Math.cos((TAU * i) / N), b * Math.sin((TAU * i) / N)]);
    } else if (shape === "stadium") {
      // two half circles of radius 1 joined by straights 2 (1 − aspect) / aspect long
      const L = (2 * (1 - Math.max(0.3, Math.min(1, aspect)))) / Math.max(0.3, aspect) + 1e-6,
        per = 2 * L + TAU;
      for (let i = 0; i < N; i++) {
        let u = (per * i) / N;
        if (u < L) pts.push([L / 2 - u, -1]);
        else if ((u -= L) < Math.PI) pts.push([-L / 2 - Math.sin(u), -Math.cos(u)]);
        else if ((u -= Math.PI) < L) pts.push([-L / 2 + u, 1]);
        else ((u -= L), pts.push([L / 2 + Math.sin(u), Math.cos(u)]));
      }
      pts.reverse(); // counter-clockwise
    } else if (shape !== "circle") {
      // a rounded regular polygon, flat side down, inside the unit circle: corner circles of radius rc centred on the
      // corners of the polygon inset by rc, joined by the sides pushed back out by rc
      const n = { triangle: 3, square: 4, pentagon: 5, hexagon: 6 }[shape] || 4,
        c = Math.cos(Math.PI / n),
        poly = (rc) => {
          const Rin = 1 - rc / c,
            side = 2 * Rin * Math.sin(Math.PI / n);
          return { Rin, side, per: n * side + TAU * rc };
        };
      let rc = Math.max(0.02, Math.min(0.9, corner)) * c;
      // rolling inside, the corners must be at least the wheel's radius (scaled to the teeth), or it can't get round
      for (let k = 0; minCorner && k < 60 && (rc * teeth) / poly(rc).per < minCorner * 1.02; k++)
        rc = Math.min(0.98 * c, rc * 1.08 + 0.005);
      const { Rin, side, per } = poly(rc),
        ang = (k) => -Math.PI / 2 - Math.PI / n + (TAU * k) / n, // corner k of the inset polygon
        C = Array.from({ length: n }, (_, k) => [Rin * Math.cos(ang(k)), Rin * Math.sin(ang(k))]);
      for (let i = 0; i < N; i++) {
        let u = (per * i) / N;
        for (let k = 0; k < n; k++) {
          const arc = (TAU / n) * rc,
            a0 = ang(k) - Math.PI / n; // the arc round corner k, from the side before's normal to the side after's
          if (u < arc) {
            const a = a0 + u / rc;
            pts.push([C[k][0] + rc * Math.cos(a), C[k][1] + rc * Math.sin(a)]);
            break;
          }
          u -= arc;
          if (u < side) {
            const a = a0 + TAU / n,
              Q = C[(k + 1) % n];
            pts.push([
              C[k][0] + rc * Math.cos(a) + ((Q[0] - C[k][0]) * u) / side,
              C[k][1] + rc * Math.sin(a) + ((Q[1] - C[k][1]) * u) / side,
            ]);
            break;
          }
          u -= side;
        }
      }
    } else for (let i = 0; i < N; i++) pts.push([Math.cos((TAU * i) / N), Math.sin((TAU * i) / N)]);
    // scale to the teeth, then arc length, direction and inward normal at each point
    let per = 0;
    for (let i = 0; i < N; i++) per += Math.hypot(pts[(i + 1) % N][0] - pts[i][0], pts[(i + 1) % N][1] - pts[i][1]);
    const k = teeth / per,
      P = pts.map(([x, y]) => [x * k, y * k]),
      S = [0];
    for (let i = 1; i <= N; i++) S.push(S[i - 1] + Math.hypot(P[i % N][0] - P[i - 1][0], P[i % N][1] - P[i - 1][1]));
    const L = S[N];
    const at = (s) => {
      s = ((s % L) + L) % L;
      let lo = 0,
        hi = N;
      while (hi - lo > 1) {
        const m = (lo + hi) >> 1;
        if (S[m] <= s) lo = m;
        else hi = m;
      }
      const A = P[lo],
        B = P[(lo + 1) % N],
        t = (s - S[lo]) / (S[lo + 1] - S[lo] || 1),
        th = Math.atan2(B[1] - A[1], B[0] - A[0]);
      return { x: A[0] + t * (B[0] - A[0]), y: A[1] + t * (B[1] - A[1]), th };
    };
    // the direction unwrapped along the track: the angle turned since s = 0 (a full 2π each time round)
    const thS = [at(0).th];
    for (let i = 1; i <= N; i++) {
      let d = at(S[i] - 1e-9).th - thS[i - 1];
      d -= TAU * Math.round(d / TAU);
      thS.push(thS[i - 1] + d);
    }
    const thAt = (s) => {
      const lap = Math.floor(s / L),
        u = s - lap * L,
        i = Math.min(N - 1, Math.max(0, Math.floor((u / L) * N)));
      let lo = Math.max(0, i - 2);
      while (lo < N - 1 && S[lo + 1] <= u) lo++;
      while (lo > 0 && S[lo] > u) lo--;
      const t = (u - S[lo]) / (S[lo + 1] - S[lo] || 1);
      return thS[lo] + t * (thS[lo + 1] - thS[lo]) + lap * TAU;
    };
    return { L, at, thAt };
  }
  // Spirograph: a toothed wheel rolling round a ring (inside or outside), the pen in one of its holes. The ring is a
  // circle, an oval, a stadium or a rounded polygon; its teeth and the wheel's set how many times the wheel goes round
  // before the line closes (wheel teeth ÷ their greatest common divisor). Hole: the pen's distance from the wheel's
  // centre, as a share of its radius (past 100% the pen reaches outside the wheel: loops). Wheels (1–6): each further
  // wheel is carried on the one before at its hole, a share of its size, turning as the gear ratio says (against it
  // or with it), the pen in its own hole. Centre path (v127): the ring's centre moves along a path drawn by hand (in
  // the ring's units, y down, from the ring's centre at rest), from its start to its end over the whole drawing,
  // smoothed (pathSmooth): the figure trails along it as an open line. Frame: Fit (everything drawn, the box round
  // it) or Crop (a frame frameW × frameH, % of the ring's width, round the ring at rest: what falls outside is cut
  // away, so a path can start off the canvas). One line, crossing itself (cropped: pieces).
  function spiroPath(raw, smooth) {
    // the drawn path resampled evenly, then smoothed (a moving average, the ends kept) as many times as smooth says
    let P = [];
    for (let i = 0; i + 1 < raw.length; i += 2) P.push([+raw[i], +raw[i + 1]]);
    P = P.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
    if (P.length < 2) return null;
    let L = 0;
    const cum = [0];
    for (let i = 1; i < P.length; i++) cum.push((L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])));
    if (!(L > 1e-9)) return null;
    const M = 200,
      Q = [];
    for (let k = 0, j = 0; k <= M; k++) {
      const s = (L * k) / M;
      while (j < P.length - 2 && cum[j + 1] < s) j++;
      const t = (s - cum[j]) / (cum[j + 1] - cum[j] || 1);
      Q.push([P[j][0] + t * (P[j + 1][0] - P[j][0]), P[j][1] + t * (P[j + 1][1] - P[j][1])]);
    }
    const passes = Math.round((smooth / 100) * 60),
      win = 4;
    for (let it = 0; it < passes; it++) {
      const R = Q.map((q) => q.slice());
      for (let k = 1; k < M; k++) {
        let sx = 0,
          sy = 0,
          n = 0;
        for (let d = -win; d <= win; d++) {
          const q = Q[Math.max(0, Math.min(M, k + d))];
          sx += q[0];
          sy += q[1];
          n++;
        }
        R[k] = [sx / n, sy / n];
      }
      for (let k = 0; k <= M; k++) Q[k] = R[k];
    }
    // the position at a share u (0–1) of the way along
    const at = (u) => {
      const f = Math.max(0, Math.min(1, u)) * M,
        k = Math.min(M - 1, Math.floor(f)),
        t = f - k;
      return [Q[k][0] + t * (Q[k + 1][0] - Q[k][0]), Q[k][1] + t * (Q[k + 1][1] - Q[k][1])];
    };
    return { at, pts: Q };
  }
  // a polyline (flat [x, y, …]) cut to the box x0…x1, y0…y1: the pieces inside
  function spiroCrop(pts, x0, y0, x1, y1) {
    const out = [],
      inside = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    let cur = null;
    const edge = (ax, ay, bx, by) => {
      // Liang–Barsky: the part of the segment inside the box, or null
      let t0 = 0,
        t1 = 1;
      const dx = bx - ax,
        dy = by - ay;
      for (const [p, q] of [
        [-dx, ax - x0],
        [dx, x1 - ax],
        [-dy, ay - y0],
        [dy, y1 - ay],
      ]) {
        if (p === 0) {
          if (q < 0) return null;
        } else {
          const r = q / p;
          if (p < 0) t0 = Math.max(t0, r);
          else t1 = Math.min(t1, r);
          if (t0 > t1) return null;
        }
      }
      return [ax + t0 * dx, ay + t0 * dy, ax + t1 * dx, ay + t1 * dy, t0 > 0, t1 < 1];
    };
    for (let i = 2; i < pts.length; i += 2) {
      const c = edge(pts[i - 2], pts[i - 1], pts[i], pts[i + 1]);
      if (!c) {
        if (cur) out.push(cur);
        cur = null;
        continue;
      }
      if (!cur || c[4]) {
        if (cur) out.push(cur);
        cur = [c[0], c[1]];
      }
      cur.push(c[2], c[3]);
      if (c[5]) {
        out.push(cur);
        cur = null;
      }
    }
    if (cur) out.push(cur);
    return out.filter((q) => q.length >= 4 && !(q.length === 4 && q[0] === q[2] && q[1] === q[3]));
  }
  function spirograph(o) {
    const ringT = o.ringTeeth,
      wheelT = o.wheelTeeth === o.ringTeeth ? o.wheelTeeth - 1 : o.wheelTeeth,
      inside = o.side !== "outside",
      r = wheelT / TAU,
      d = (o.hole / 100) * r,
      track = ringTrack(o.ring, ringT, (o.oval || 70) / 100, (o.corner || 40) / 100, inside ? r : 0),
      L = track.L;
    let laps = wheelT / gcd(ringT, wheelT);
    // the wheels carried on the first: radius, hole and turns per turn of the wheel it rides on
    const nW = Math.max(1, Math.min(6, Math.round(o.wheels || 1))),
      chain = [];
    let rPrev = r;
    for (let k = 2; k <= nW; k++) {
      const size = k === 2 ? o.wheel2Teeth : o[`wheel${k}Size`],
        hole = o[`hole${k}`],
        dir = k === 2 ? o.wheel2Dir : o[`wheel${k}Dir`],
        rk = Math.max(0.1, ((size || 40) / 100) * rPrev),
        m = -(rPrev / rk) * (dir === "same" ? -1 : 1); // this wheel turns m times per turn of the one it rides on
      chain.push({ d: ((hole == null ? 60 : hole) / 100) * rk, m });
      // closing: every wheel turns a whole number of times
      const q = Math.max(1, Math.round(size || 40));
      laps *= q / gcd(100, q);
      rPrev = rk;
    }
    laps = Math.min(laps, 400);
    const path = Array.isArray(o.path) && o.path.length >= 4 ? spiroPath(o.path, o.pathSmooth || 0) : null;
    const rot = ((o.rotate || 0) * Math.PI) / 180,
      cr = Math.cos(rot),
      sr = Math.sin(rot),
      steps = Math.min(60000, Math.max(800, Math.round(laps * Math.max(360, (L / Math.max(r, 0.5)) * 24)))),
      pts = [];
    for (let i = 0; i < steps + (path ? 1 : 0); i++) {
      const s = (laps * L * i) / steps,
        P = track.at(s),
        th = track.thAt(s),
        nx = -Math.sin(th),
        ny = Math.cos(th), // inward normal (left of travel, counter-clockwise)
        sg = inside ? 1 : -1,
        cx = P.x + sg * r * nx,
        cy = P.y + sg * r * ny,
        phi = th - sg * (s / r); // the wheel's turn: rolling without slipping
      let x = cx + d * Math.cos(phi),
        y = cy + d * Math.sin(phi),
        ph = phi;
      for (const w of chain) {
        ph *= 1 + w.m;
        x += w.d * Math.cos(ph);
        y += w.d * Math.sin(ph);
      }
      let X = x * cr - y * sr,
        Y = -(x * sr + y * cr); // y down for the page
      if (path) {
        const [px, py] = path.at(i / steps);
        X += px;
        Y += py;
      }
      pts.push(X, Y);
    }
    // the ring's size, for the frame: its width at rest
    let rx = 0;
    for (let i = 0; i < 64; i++) rx = Math.max(rx, Math.abs(track.at((L * i) / 64).x));
    const ringW = Math.max(1e-6, 2 * rx);
    if (o.frame === "crop") {
      const fw = ((o.frameW || 100) / 100) * ringW,
        fh = ((o.frameH || 100) / 100) * ringW,
        pieces = spiroCrop(pts, -fw / 2, -fh / 2, fw / 2, fh / 2).map((q) =>
          q.map((v, k) => v + (k % 2 ? fh / 2 : fw / 2))
        );
      if (!pieces.length) return null;
      return {
        paths: pieces,
        closed: pieces.map(() => false),
        box: [fw, fh],
        gap: Math.max(fw, fh) / 150,
        crosses: true,
        laps,
        ringW,
      };
    }
    const box = boxed(pts);
    return {
      paths: [pts],
      closed: [!path],
      box,
      gap: Math.max(box[0], box[1]) / 150,
      crosses: true,
      laps,
      ringW,
    };
  }

  // Lissajous / harmonograph: two swinging pendulums, x = sin(a t + phase), y = sin(b t). Whole-number ratios close
  // in one swing; Drift detunes a, so the figure turns slowly; Damping lets the swings die away over Swings, spiralling
  // in (an open line). One line that crosses itself.
  function lissajous(o) {
    const a = o.fx + (o.drift || 0) / 1000,
      b = o.fy,
      ph = ((o.phase || 0) * Math.PI) / 180,
      damp = Math.min(0.97, (o.damping || 0) / 100),
      open = damp > 0 || (o.drift || 0) > 0,
      swings = open ? o.swings : 1,
      T = TAU * swings,
      dl = damp > 0 ? -Math.log(1 - damp) / T : 0,
      M = Math.min(60000, Math.round(160 * Math.max(a, b) * swings + 400)),
      pts = [];
    for (let i = 0; i < M + (open ? 1 : 0); i++) {
      const t = (T * i) / M,
        e = Math.exp(-dl * t);
      pts.push(e * Math.sin(a * t + ph), e * Math.sin(b * t));
    }
    return { paths: [pts], closed: [!open], box: boxed(pts), gap: 1 / 60, crosses: true };
  }

  // Rose: r = cos(k θ), k = n / d, one closed line through the middle (n petals for odd n, 2n for even, d = 1). Maurer
  // rose: the points of a rose a fixed angle apart, joined by straight lines (360 of them): a star of crossing chords.
  function rose(o) {
    const pts = [];
    if (o.maurer) {
      const st = (o.step * Math.PI) / 180;
      for (let i = 0; i < 360; i++) {
        const th = i * st,
          r = Math.sin(o.n * th);
        pts.push(r * Math.cos(th), r * Math.sin(th));
      }
    } else {
      const n = o.n,
        dd = o.d,
        g = gcd(n, dd),
        k = n / g / (dd / g),
        turns = (dd / g) * ((n / g) % 2 && (dd / g) % 2 ? 1 : 2),
        M = 720 * turns;
      for (let i = 0; i < M; i++) {
        const th = (Math.PI * turns * i) / M,
          r = Math.cos(k * th);
        pts.push(r * Math.cos(th), r * Math.sin(th));
      }
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
    const str = (o.strength == null ? 100 : o.strength) / 100, // Wiggle: how hard the darkest parts wiggle
      A = T.w / T.h,
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
        const t = easeOut(Math.pow(f(x / A, yc), g)) * str,
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
    const str = (o.strength == null ? 100 : o.strength) / 100,
      turns = o.detail,
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
        t = easeOut(Math.pow(fill(x, y), g)) * str,
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
    for (let changed = true; changed;) {
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
      for (const c of [i, (F - 1) * F + i, i * F, i * F + F - 1]) if (!occ[c] && !out[c]) ((out[c] = 1), q.push(c));
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
        if (X >= 0 && Y >= 0 && X < F && Y < F && !occ[e] && !out[e]) ((out[e] = 1), q.push(e));
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

  // ---------- the styles and their settings ----------
  // Each style's settings, in the order the Pattern card shows them: R (a slider: key, name, min, max, starting value,
  // how to say a value, step), C (a menu: key, name, [[value, label]], starting value), B (a switch). when(p): shown
  // only when it's true for the settings p. The keys are what UNB.pattern reads (o.detail …) and what a design file
  // keeps. A style also says: tip; seed (a Shuffle button); line (which Line setting traces it as drawn: closed, a
  // loop, or open); oneLine (already one unbroken line); evenGap (its gap is the spacing between neighbouring lines all
  // over: the app starts it at the width where that gap is the line spacing); crosses (it crosses itself); tone (drawn
  // from a picture).
  const rangeParam = (key, name, min, max, value, say, step) => ({
    key,
    type: "range",
    name,
    min,
    max,
    value,
    say: say || ((v) => `${v}`),
    step: step || 1,
  });
  const choiceParam = (key, name, options, value) => ({ key, type: "select", name, options, value });
  const checkParam = (key, name, value) => ({ key, type: "check", name, value: !!value });
  // (a range's plotMax: how far it goes in art made for plotting, drawn as exact lines and never traced or printed;
  // max is the limit for printing, where the needle's spacing and the trace set what can be made)
  const pct = (v) => `${v}%`,
    ord = (v) => `order ${v} · ${2 ** v} × ${2 ** v}`,
    off0 = (v) => (v ? `${v}%` : "off");
  const SHAPE = choiceParam(
      "shape",
      "Shape",
      [
        ["square", "Square"],
        ["circle", "Circle"],
        ["hexagon", "Hexagon"],
        ["diamond", "Diamond"],
        ["heart", "Heart"],
        ["star", "Star"],
      ],
      "square"
    ),
    SIDES = choiceParam(
      "sides",
      "Sides",
      [
        [0, "Circle"],
        [3, "Triangle"],
        [4, "Square"],
        [5, "Pentagon"],
        [6, "Hexagon"],
        [8, "Octagon"],
      ],
      4
    ),
    CORNERS = rangeParam("round", "Rounded corners", 0, 100, 0, off0),
    CONTRAST = rangeParam("twist", "Contrast", 0, 100, 50, pct),
    INVERT = checkParam("invert", "Invert (light parts get the line)", false);
  UNB.PATTERNS = {
    labyrinth: {
      label: "Labyrinth",
      tip: "One closed line around a random maze, an even gap everywhere",
      params: [
        { ...rangeParam("detail", "Cells across", 4, 36, 12, (v) => `${v} cells`), plotMax: 120 },
        rangeParam("twist", "Branching", 0, 100, 30, (v) =>
          v < 15 ? "long corridors" : v > 70 ? "short branches" : `${v}%`
        ),
        rangeParam("straight", "Straight runs", 0, 100, 0, off0),
        SHAPE,
      ],
      seed: true,
      line: "closed",
      oneLine: true,
      evenGap: true,
    },
    moore: {
      label: "Moore loop",
      tip: "A closed space-filling curve: every gap one step",
      params: [{ ...rangeParam("detail", "Order", 2, 6, 4, ord), plotMax: 8 }, CORNERS],
      line: "closed",
      oneLine: true,
      evenGap: true,
    },
    hilbert: {
      label: "Hilbert curve",
      tip: "A space-filling curve from one corner to the next",
      params: [{ ...rangeParam("detail", "Order", 1, 6, 4, ord), plotMax: 8 }, CORNERS],
      line: "open",
      oneLine: true,
      evenGap: true,
    },
    gosper: {
      label: "Gosper curve",
      tip: "The flowsnake: a space-filling curve on a hexagonal grid",
      params: [
        { ...rangeParam("detail", "Order", 1, 3, 3, (v) => `order ${v} · ${7 ** v} steps`), plotMax: 5 },
        CORNERS,
      ],
      line: "open",
      oneLine: true,
      evenGap: true,
    },
    spiral: {
      label: "Double spiral",
      tip: "Two spiral arms wound into each other: one closed loop, even gaps",
      params: [
        { ...rangeParam("detail", "Turns", 2, 16, 7, (v) => `${v} turns`), plotMax: 80 },
        SIDES,
        rangeParam("twist", "Twist", 0, 100, 0, (v) => (v ? `${v}%` : "none"), 1),
        { ...CORNERS, when: (p) => +p.sides > 0 },
      ],
      line: "closed",
      oneLine: true,
      evenGap: true,
    },
    whirl: {
      label: "Whirl",
      tip: "Polygons turning as they shrink, one line spiralling in with an even gap",
      params: [
        { ...rangeParam("detail", "Rounds", 3, 40, 16, (v) => `up to ${v} rounds`), plotMax: 200 },
        SIDES,
        rangeParam("twist", "Turn per round", 0, 90, 15, (v) => (v ? `${v}%` : "none")),
        CORNERS,
      ],
      line: "open",
      oneLine: true,
      evenGap: true,
    },
    waves: {
      label: "Waves",
      tip: "Rows of a shifting wave joined end to end: one line, never touching",
      params: [
        { ...rangeParam("detail", "Rows", 3, 30, 14, (v) => `${v} rows`), plotMax: 200 },
        rangeParam("twist", "Amplitude", 0, 100, 60, (v) => (v ? `${v}%` : "flat")),
        rangeParam("freq", "Waves across", 25, 300, 100, pct, 5),
        checkParam("calm", "Calm ends", true),
      ],
      seed: true,
      line: "open",
      oneLine: true,
      evenGap: true,
    },
    spirograph: {
      label: "Spirograph",
      tip: "A toothed wheel rolling round a ring, the pen in one of its holes",
      params: [
        choiceParam(
          "ring",
          "Ring",
          [
            ["circle", "Circle"],
            ["oval", "Oval"],
            ["stadium", "Stadium"],
            ["triangle", "Triangle"],
            ["square", "Square"],
            ["pentagon", "Pentagon"],
            ["hexagon", "Hexagon"],
          ],
          "circle"
        ),
        {
          ...rangeParam("oval", "Ring width", 30, 100, 70, pct),
          when: (p) => p.ring === "oval" || p.ring === "stadium",
        },
        {
          ...rangeParam("corner", "Ring corners", 5, 90, 40, pct),
          when: (p) => !["circle", "oval", "stadium"].includes(p.ring),
        },
        rangeParam("ringTeeth", "Ring teeth", 24, 160, 96, (v) => `${v} teeth`),
        rangeParam("wheelTeeth", "Wheel teeth", 6, 150, 52, (v) => `${v} teeth`),
        choiceParam(
          "side",
          "Wheel rolls",
          [
            ["inside", "Inside the ring"],
            ["outside", "Outside the ring"],
          ],
          "inside"
        ),
        rangeParam("hole", "Hole", 0, 140, 70, (v) => `${v}% of the wheel's radius${v > 100 ? " · loops" : ""}`),
        rangeParam("wheels", "Wheels", 1, 6, 1, (v) =>
          v === 1 ? "1 wheel" : `${v} wheels, each riding on the one before`
        ),
        ...[2, 3, 4, 5, 6].flatMap((k) => [
          {
            ...rangeParam(
              k === 2 ? "wheel2Teeth" : `wheel${k}Size`,
              `Wheel ${k}'s size`,
              10,
              90,
              40,
              (v) => `${v}% of wheel ${k - 1}`
            ),
            when: (p) => p.wheels >= k,
          },
          { ...rangeParam(`hole${k}`, `Wheel ${k}'s hole`, 0, 140, 60, pct), when: (p) => p.wheels >= k },
          {
            ...choiceParam(
              k === 2 ? "wheel2Dir" : `wheel${k}Dir`,
              `Wheel ${k} turns`,
              [
                ["against", `Against wheel ${k - 1}`],
                ["same", `With wheel ${k - 1}`],
              ],
              "against"
            ),
            when: (p) => p.wheels >= k,
          },
        ]),
        rangeParam("rotate", "Rotate", 0, 359, 0, (v) => `${v}°`),
        // the ring's centre moving along a path drawn by hand (the app's Draw the path pad)
        { key: "path", type: "path", name: "Centre path", value: null },
        {
          ...rangeParam("pathSmooth", "Smooth the path", 0, 100, 40, (v) => (v ? `${v}%` : "as drawn")),
          when: (p) => Array.isArray(p.path) && p.path.length >= 4,
        },
        choiceParam(
          "frame",
          "Frame",
          [
            ["fit", "Fit everything"],
            ["crop", "Crop to a frame"],
          ],
          "fit"
        ),
        {
          ...rangeParam("frameW", "Frame width", 20, 400, 120, (v) => `${v}% of the ring`),
          when: (p) => p.frame === "crop",
        },
        {
          ...rangeParam("frameH", "Frame height", 20, 400, 120, (v) => `${v}% of the ring`),
          when: (p) => p.frame === "crop",
        },
      ],
      // (a design from before v127: Second wheel ticked is two wheels)
      legacy: (o) => (o && o.wheels == null && o.wheel2 ? { ...o, wheels: 2 } : o),
      line: "closed",
      crosses: true,
    },
    lissajous: {
      label: "Lissajous / harmonograph",
      tip: "Two swinging pendulums; damped, they spiral in like a harmonograph",
      params: [
        rangeParam("fx", "Across swings", 1, 12, 3),
        rangeParam("fy", "Up-down swings", 1, 12, 4),
        rangeParam("phase", "Phase", 0, 180, 45, (v) => `${v}°`),
        rangeParam("drift", "Drift", 0, 100, 0, (v) => (v ? `${v}` : "none")),
        rangeParam("damping", "Damping", 0, 95, 0, off0),
        { ...rangeParam("swings", "Swings", 2, 120, 30), when: (p) => p.damping > 0 || p.drift > 0 },
      ],
      line: "closed",
      crosses: true,
    },
    rose: {
      label: "Rose",
      tip: "Petals round the middle, r = cos(n/d · θ); or a Maurer rose of crossing chords",
      params: [
        rangeParam("n", "Petals (n)", 1, 12, 5),
        { ...rangeParam("d", "Divider (d)", 1, 12, 1), when: (p) => !p.maurer },
        checkParam("maurer", "Maurer rose (straight chords)", false),
        { ...rangeParam("step", "Chord angle", 1, 179, 71, (v) => `${v}°`), when: (p) => p.maurer },
      ],
      line: "closed",
      crosses: true,
    },
    truchet: {
      label: "Truchet tiles",
      tip: "Quarter circles on a grid of tiles, joined into loops (many pieces)",
      params: [
        { ...rangeParam("detail", "Tiles across", 3, 30, 10, (v) => `${v} tiles`), plotMax: 120 },
        rangeParam("twist", "Mix", 0, 100, 50, (v) => `${v}% one way`),
        SHAPE,
      ],
      seed: true,
      line: "closed",
      evenGap: true,
    },
    // drawn from a picture (o.tone: { w, h, d }): their gap is the finest one, in the darkest parts
    hilbertTone: {
      label: "Space-filling curve (picture)",
      tip: "A Hilbert curve that fills in finer where the picture is darker",
      params: [
        { ...rangeParam("detail", "Finest order", 3, 8, 5, (v) => `order ${v} · ${2 ** v} cells across`), plotMax: 9 },
        rangeParam("range", "Levels", 1, 5, 3, (v) => `${v + 1} cell sizes`),
        CONTRAST,
        INVERT,
      ],
      tone: true,
      line: "open",
      oneLine: true,
      evenGap: true,
    },
    wavesTone: {
      label: "Wave rows (picture)",
      tip: "Rows across the picture, wiggling harder and tighter where it is darker",
      params: [
        { ...rangeParam("detail", "Rows", 4, 120, 20, (v) => `${v} rows`), plotMax: 250 },
        rangeParam("strength", "Wiggle", 10, 100, 100, pct),
        CONTRAST,
        INVERT,
      ],
      tone: true,
      line: "open",
      oneLine: true,
      evenGap: true,
    },
    spiralTone: {
      label: "Vibrating spiral (picture)",
      tip: "One spiral from the middle out, wobbling harder where the picture is darker",
      params: [
        { ...rangeParam("detail", "Turns", 4, 120, 10, (v) => `${v} turns`), plotMax: 200 },
        rangeParam("strength", "Wiggle", 10, 100, 100, pct),
        CONTRAST,
        INVERT,
      ],
      tone: true,
      line: "open",
      oneLine: true,
      evenGap: true,
    },
    labyrinthTone: {
      label: "Labyrinth (picture)",
      tip: "A maze with smaller cells where the picture is darker, one closed line",
      params: [
        { ...rangeParam("detail", "Finest order", 3, 7, 4, (v) => `order ${v} · ${2 ** v} cells across`), plotMax: 8 },
        rangeParam("range", "Levels", 1, 4, 3, (v) => `${v + 1} cell sizes`),
        CONTRAST,
        INVERT,
      ],
      seed: true,
      tone: true,
      line: "closed",
      oneLine: true,
      evenGap: true,
    },
  };
  UNB.PATTERN_SHAPES = SHAPE.options.map(([v]) => v);
  // a style's settings filled in: each one given (and in range) or its starting value; seed a whole number ≥ 1. o.plot:
  // made for plotting (ranges go up to their plotMax)
  UNB.patternDefaults = function (style, o) {
    const S = UNB.PATTERNS[style],
      p = { style, seed: Math.max(1, Math.round(+(o && o.seed) || 1)) };
    if (!S) return p;
    if (S.legacy) o = S.legacy(o);
    for (const q of S.params) {
      const v = o ? o[q.key] : undefined;
      if (q.type === "path") {
        // a path drawn by hand: [x, y, …], kept as it is (rounded to 0.001), or none
        p[q.key] =
          Array.isArray(v) && v.length >= 4 && v.length % 2 === 0 && v.every((x) => Number.isFinite(+x))
            ? v.map((x) => Math.round(+x * 1000) / 1000)
            : null;
        continue;
      }
      if (q.type === "range") {
        const n = v == null || v === "" || !Number.isFinite(+v) ? q.value : +v,
          max = o && o.plot && q.plotMax ? q.plotMax : q.max;
        p[q.key] = Math.min(max, Math.max(q.min, Math.round(n / q.step) * q.step));
      } else if (q.type === "select")
        p[q.key] = q.options.some(([x]) => String(x) === String(v))
          ? q.options.find(([x]) => String(x) === String(v))[0]
          : q.value;
      else p[q.key] = v == null ? q.value : !!v;
    }
    return p;
  };

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
    rose,
    hilbertTone,
    wavesTone,
    spiralTone,
    labyrinthTone,
  };

  // One pattern. style: a key of UNB.PATTERNS; o: its settings (keys as in its params; anything missing or out of
  // range gets the starting value), seed, and tone (the picture, for the styles drawn from one: { w, h, d }).
  // Returns { paths: [[x, y, …]], closed: [bool], box: [w, h], gap, crosses } in the pattern's own units (y down): gap
  // is the closest any two neighbouring lines come (the app draws the strokes a third of that wide). null when the
  // style is unknown or nothing is left inside the shape.
  UNB.pattern = function (style, o) {
    const S = UNB.PATTERNS[style],
      make = MAKE[style];
    if (!S || !make) return null;
    const p = UNB.patternDefaults(style, o);
    let tone = o && o.tone;
    if (S.tone && !(tone && tone.w > 1 && tone.h > 1)) return null; // drawn from a picture: needs one
    if (tone && p.invert) tone = { ...tone, d: Float32Array.from(tone.d, (v) => 1 - v) };
    const r = make(p, seeded(p.seed), tone);
    if (!r) return null;
    r.crosses = !!r.crosses;
    return r;
  };
})(typeof window !== "undefined" ? window : globalThis);
