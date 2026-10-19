/* Unbroken · engine · 12-models.js
   11. Models — STL meshes → slices → one fitted line per layer, stacked; or a hidden-line drawing of a view (3D → 2D).
   One part of the engine (no DOM), loaded after 11-stages.js; core.js lists every part and what's in it. */
(function (root) {
  "use strict";
  const UNB = root.UNB,
    { f3, svgPolylines, cumLength, resampleLoop, isoContours, labelComponents } = UNB._u; // shared helpers (00-util.js)

  // a mesh corner as a text key, matched to 0.0001 units so float noise between neighbouring triangles doesn't split it
  const cornerKey = (tri, i) =>
    `${Math.round(tri[i] * 1e4)},${Math.round(tri[i + 1] * 1e4)},${Math.round(tri[i + 2] * 1e4)}`;

  // STL, binary or ASCII → { tri: Float32Array (9 numbers per triangle: x, y, z of each corner), n }
  UNB.parseSTL = function (bytes) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
      dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const binN = u8.length >= 84 ? dv.getUint32(80, true) : -1;
    const solid = String.fromCharCode(...u8.subarray(0, 5)).toLowerCase() === "solid";
    const extra = u8.length - (84 + 50 * binN); // some exporters pad a binary file at the end
    if (binN >= 0 && (extra === 0 || (binN > 0 && extra > 0 && extra < 1024 && !solid))) {
      // binary: the size fits the triangle count
      const tri = new Float32Array(9 * binN);
      for (let t = 0; t < binN; t++) {
        const o = 84 + 50 * t + 12;
        for (let k = 0; k < 9; k++) tri[9 * t + k] = dv.getFloat32(o + 4 * k, true);
      }
      return { tri, n: binN };
    }
    const txt = new TextDecoder().decode(u8),
      v = [];
    const re = /vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g;
    let m;
    while ((m = re.exec(txt))) v.push(+m[1], +m[2], +m[3]);
    if (!v.length || v.length % 9) throw new Error("not an STL file (no triangles found)");
    return { tri: Float32Array.from(v), n: v.length / 9 };
  };

  // Turn a mesh by quarter turns about x, then y, then z, and move it so it stands on z = 0, centred on x = y = 0.
  // Returns { tri, size: [w, d, h] } (model units).
  UNB.orientMesh = function (tri, turns) {
    const t = turns || {},
      out = Float32Array.from(tri),
      n = out.length / 3;
    const rot = (a, b, q) => {
      q = ((q % 4) + 4) % 4;
      for (let i = 0; i < n; i++)
        for (let r = 0; r < q; r++) {
          const A = out[3 * i + a],
            B = out[3 * i + b];
          out[3 * i + a] = -B;
          out[3 * i + b] = A;
        }
    };
    rot(1, 2, t.x || 0);
    rot(2, 0, t.y || 0);
    rot(0, 1, t.z || 0);
    const lo = [Infinity, Infinity, Infinity],
      hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < n; i++)
      for (let c = 0; c < 3; c++) {
        const v = out[3 * i + c];
        if (v < lo[c]) lo[c] = v;
        if (v > hi[c]) hi[c] = v;
      }
    const cx = (lo[0] + hi[0]) / 2,
      cy = (lo[1] + hi[1]) / 2;
    for (let i = 0; i < n; i++) {
      out[3 * i] -= cx;
      out[3 * i + 1] -= cy;
      out[3 * i + 2] -= lo[2];
    }
    return { tri: out, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]] };
  };

  // The mesh cut at height z: closed outlines as flat [x, y, x, y, …] arrays (model units). Each triangle that
  // crosses the plane gives one segment; segments are chained end to end through their shared mesh edges.
  UNB.sliceMesh = function (tri, z) {
    const n = tri.length / 9,
      segs = [],
      keyOf = (a, b) => (a < b ? a + "|" + b : b + "|" + a),
      vk = (i) => cornerKey(tri, i);
    for (let t = 0; t < n; t++) {
      const o = 9 * t,
        // nudge vertices sitting on the plane
        Z = [tri[o + 2], tri[o + 5], tri[o + 8]].map((v) => (v === z ? v + 1e-7 : v));
      const pts = [];
      for (let e = 0; e < 3; e++) {
        const a = e,
          b = (e + 1) % 3,
          za = Z[a],
          zb = Z[b];
        if (za > z === zb > z) continue;
        const u = (z - za) / (zb - za),
          ia = o + 3 * a,
          ib = o + 3 * b;
        pts.push({
          x: tri[ia] + u * (tri[ib] - tri[ia]),
          y: tri[ia + 1] + u * (tri[ib + 1] - tri[ia + 1]),
          key: keyOf(vk(ia), vk(ib)),
        });
      }
      if (pts.length === 2) segs.push(pts);
    }
    const byKey = new Map(); // edge key → segments touching it
    segs.forEach((sg, i) => {
      for (const p of sg) {
        let A = byKey.get(p.key);
        if (!A) byKey.set(p.key, (A = []));
        A.push(i);
      }
    });
    const used = new Uint8Array(segs.length),
      loops = [];
    for (let i0 = 0; i0 < segs.length; i0++) {
      if (used[i0]) continue;
      used[i0] = 1;
      const flat = [segs[i0][0].x, segs[i0][0].y];
      let key = segs[i0][1].key,
        cur = segs[i0][1],
        startKey = segs[i0][0].key;
      let closedLoop = false;
      for (let guard = 0; guard < segs.length; guard++) {
        flat.push(cur.x, cur.y);
        if (key === startKey) {
          closedLoop = true;
          break;
        }
        const nx = (byKey.get(key) || []).find((j) => !used[j]);
        if (nx === undefined) break;
        used[nx] = 1;
        const sg = segs[nx],
          other = sg[0].key === key ? sg[1] : sg[0];
        key = other.key;
        cur = other;
      }
      if (closedLoop)
        flat.length -= 2; // the last point repeats the first
      else {
        // a chain that doesn't close (a mesh with a hole): also follow it back from the start
        const head = [];
        key = startKey;
        for (let guard = 0; guard < segs.length; guard++) {
          const nx = (byKey.get(key) || []).find((j) => !used[j]);
          if (nx === undefined) break;
          used[nx] = 1;
          const sg = segs[nx],
            other = sg[0].key === key ? sg[1] : sg[0];
          key = other.key;
          head.push(other.y, other.x);
        }
        if (head.length) flat.unshift(...head.reverse()); // (a chain is short: one slice of one hole)
      }
      if (flat.length >= 6) loops.push(flat); // an open chain is kept open
    }
    return loops;
  };

  // flat [x, y, …] → [[x, y], …]
  const pairs = (flat) => {
    const P = [];
    for (let i = 0; i + 1 < flat.length; i += 2) P.push([flat[i], flat[i + 1]]);
    return P;
  };
  const loopArea = (P) => {
    let a = 0;
    for (let i = 0; i < P.length; i++) {
      const j = (i + 1) % P.length;
      a += P[i][0] * P[j][1] - P[j][0] * P[i][1];
    }
    return a / 2;
  };
  const inLoop = (P, x, y) => {
    let c = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const a = P[i],
        b = P[j];
      if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  };

  // One layer of a model: its outlines (mm, y up) → one closed line. Only the outside contours are printed (a hollow
  // model's inner surface and any hole are left to the fill); they are turned anticlockwise, moved in by half a line
  // width so the chocolate's outside edge is the model's surface, and joined into one loop: each further outline is
  // reached by two straight connector strands
  // one spacing apart, from the nearest point of the loop so far (the strands go out and come back without crossing);
  // where many points are about as near, through the middle of the layer.
  // With fill, the enclosed areas are filled (UNB.infill). Then the loop is fitted with a Fourier series like a
  // traced drawing (fewest strongest terms within tol mm for 95% of it).
  // Extra walls (opt.walls > 1) are the same outlines moved in a further spacing each, run the other way round, so the
  // connector strands that join them to the wall outside don't cross. A fill only reaches inside the innermost wall
  // (the gap between walls is narrower than an area UNB.infill fills).
  // opt: w (line width), d (spacing), walls (1–5), tol, fill ("rings" | "lines" | null), fillSpacing (mm, default d:
  // solid), fillAngle, fillMinArea (mm²)
  UNB.modelLayer = function (outlines, opt) {
    const o = opt || {},
      w = o.w || 0.8,
      d = Math.max(w, o.d || w),
      step = Math.min(0.2, d / 4);
    let loops = outlines.map((f) => resampleLoop(pairs(f), step)).filter((P) => Math.abs(loopArea(P)) > w * w);
    if (!loops.length) return null;
    // which loops are holes: inside an odd number of others
    const depthOf = loops.map((P) => loops.filter((Q) => Q !== P && inLoop(Q, P[0][0], P[0][1])).length);
    loops = loops.map((P, i) => {
      const A = loopArea(P),
        want = depthOf[i] % 2 ? -1 : 1;
      return Math.sign(A) === want ? P : P.slice().reverse();
    });
    // Outside only: a layer prints its outside contours (every loop not inside another) and nothing that traces an
    // inside surface (a hollow model's inner wall, a hole), however thick the wall; how much of the inside gets
    // chocolate is the Base and Infill settings' choice, filling within the outside contour.
    loops = loops.filter((_, i) => depthOf[i] === 0);
    // in by half a line width, towards the solid (on the left of the direction of travel)
    const inset = (P, by) => {
      const m = P.length;
      return P.map((p, i) => {
        const a = P[(i - 2 + m) % m],
          b = P[(i + 2) % m],
          tx = b[0] - a[0],
          ty = b[1] - a[1],
          l = Math.hypot(tx, ty) || 1;
        return [p[0] - (ty / l) * by, p[1] + (tx / l) * by];
      });
    };
    const nW = Math.max(1, Math.min(5, o.walls | 0 || 1)),
      all = [];
    for (const P0 of loops)
      for (let k = 0; k < nW; k++) {
        // moved in step by step from the surface, so sharp inner corners don't fold over
        const P = inset(P0, w / 2 + k * d);
        if (Math.sign(loopArea(P)) !== Math.sign(loopArea(P0)) || Math.abs(loopArea(P)) <= w * w) break;
        const R = resampleLoop(P, step);
        all.push(k % 2 ? R.reverse() : R);
      }
    loops = all;
    if (!loops.length) return null;
    // join: biggest first, then each nearest remaining loop by a pair of connector strands d apart (every point pair
    // is compared, so many outlines in one layer are slow)
    loops.sort((p, q) => Math.abs(loopArea(q)) - Math.abs(loopArea(p)));
    let main = loops[0];
    const rest = loops.slice(1),
      kk = Math.max(1, Math.round(d / 2 / step));
    let connectors = 0,
      tiny = 0,
      cx0 = Infinity,
      cx1 = -Infinity,
      cy0 = Infinity,
      cy1 = -Infinity;
    for (const P of loops)
      for (const [x, y] of P) {
        if (x < cx0) cx0 = x;
        if (x > cx1) cx1 = x;
        if (y < cy0) cy0 = y;
        if (y > cy1) cy1 = y;
      }
    const cx = (cx0 + cx1) / 2,
      cy = (cy0 + cy1) / 2; // the middle of the layer (its outlines' box)
    while (rest.length) {
      let best = Infinity,
        bi = 0,
        bj = 0,
        br = 0;
      rest.forEach((B, r) => {
        for (let i = 0; i < main.length; i += 2)
          for (let j = 0; j < B.length; j += 2) {
            const dd = (main[i][0] - B[j][0]) ** 2 + (main[i][1] - B[j][1]) ** 2;
            if (dd < best) {
              best = dd;
              bi = i;
              bj = j;
              br = r;
            }
          }
      });
      // of the joins about as short as the shortest (half a spacing longer at most), the one through the middle of the
      // layer: parallel faces (a letter's arms, a handle) are equally close all along, and a join at an edge stacks
      // into a ledge on the model's face; through the middle the stacked strands sit back inside it, a relief
      const lim = (Math.sqrt(best) + d / 2) ** 2;
      let mid = Infinity;
      rest.forEach((B, r) => {
        for (let i = 0; i < main.length; i += 2)
          for (let j = 0; j < B.length; j += 2) {
            const dd = (main[i][0] - B[j][0]) ** 2 + (main[i][1] - B[j][1]) ** 2;
            if (dd > lim) continue;
            // both ends near the middle: straight across, not corner to corner
            const md = (main[i][0] - cx) ** 2 + (main[i][1] - cy) ** 2 + (B[j][0] - cx) ** 2 + (B[j][1] - cy) ** 2;
            if (md < mid) {
              mid = md;
              bi = i;
              bj = j;
              br = r;
            }
          }
      });
      const B = rest.splice(br, 1)[0],
        m = main.length,
        nb = B.length;
      if (m <= 2 * kk + 2 || nb <= 2 * kk + 2) {
        tiny++;
        continue;
      } // too small to join: left out
      const out = [];
      // main from just after the joint round to just before it
      for (let s = 0; s <= m - 2 * kk; s++) out.push(main[(bi + kk + s) % m]);
      for (let s = 0; s <= nb - 2 * kk; s++) out.push(B[(bj + kk + s) % nb]); // across, round B, and back
      main = out;
      connectors++;
    }
    // fill
    let x = main.map((p) => p[0]),
      y = main.map((p) => p[1]),
      filled = 0,
      skipped = 0;
    if (o.fill) {
      const f = UNB.infill(
        { x: Float64Array.from(x), y: Float64Array.from(y), idx: Int32Array.from(x, (_, i) => i) },
        d * 1.05,
        {
          rows: (o.fillSpacing || d) * 1.05,
          pattern: o.fill,
          angle: o.fillAngle || 0,
          minArea: o.fillMinArea || 0,
          bridge: d,
        }
      );
      x = Array.from(f.x);
      y = Array.from(f.y);
      filled = f.areas || 0;
      skipped = f.skipped || 0;
    }
    // Fourier fit
    const L = cumLength(x, y, true)[x.length];
    const S = Math.min(65536, Math.max(256, 2 ** Math.ceil(Math.log2(L / (step / 2))))),
      z = UNB.resample(Float64Array.from(x), Float64Array.from(y), S),
      sp = UNB.spectrum(z.re, z.im);
    const { N, curve: c } = UNB.autoTerms(
        sp.ax,
        sp.order,
        Math.min(sp.order.length, o.fill ? 30000 : 16384),
        null,
        false,
        o.tol || 0.05
      ),
      sm = UNB.simplify(c.re, c.im, Math.min(0.02, (o.tol || 0.05) / 2), true);
    return {
      x: sm.x,
      y: sm.y,
      N,
      S,
      loops: loops.length - tiny,
      connectors,
      dropped: tiny,
      filled,
      skipped,
      length: L,
    };
  };

  // One layer's fill: the base's or the infill's pattern, row spacing and angle. density 0–1: 1 puts the rows a line
  // width w apart (touching, solid), lower spreads them to w ÷ density, 0 is no fill. Lines turn 90° every `turn`
  // layers
  // (1: every layer; k layers the same, then the next k across them, for strength). j: the layer's number within its
  // part (base or infill). opt: w, base* / infill* (Density, Pattern, Angle, Turn). Returns { pattern (null: none),
  // spacing, angle }.
  UNB.fillPlan = function (opt, base, j) {
    const p = base ? "base" : "infill",
      dens = Math.min(1, Math.max(0, +opt[p + "Density"] || 0));
    if (!(dens > 0.001)) return { pattern: null, spacing: 0, angle: 0, minArea: 0 };
    const pattern = opt[p + "Pattern"] === "rings" ? "rings" : "lines",
      turn = Math.max(1, opt[p + "Turn"] | 0 || 1);
    // each its own smallest area filled (fillMinArea: both)
    const minArea = opt[p + "MinArea"] != null ? +opt[p + "MinArea"] || 0 : +opt.fillMinArea || 0;
    return {
      pattern,
      spacing: opt.w / dens,
      angle: (+opt[p + "Angle"] || 0) + (pattern === "lines" && Math.floor(j / turn) % 2 ? 90 : 0),
      minArea,
    };
  };

  // ---------- a grid for regions ----------
  // The model's outlines worked as filled regions on a grid: fill loops (each on its own, OR-ed: overlapping loops
  // make their union; a loop inside another adds nothing), invert, and trace a region back to outlines (marching
  // squares on a signed distance, so the edge is smooth to a fraction of a cell). Box x0…x1, y0…y1 (mm), cells g mm,
  // pad cells of room round the edge. Shared by UNB.unionOverlaps and UNB.modelSupport.
  const regionGrid = (x0, y0, x1, y1, g, pad) => {
    const ox = x0 - pad * g,
      oy = y0 - pad * g,
      w = Math.ceil((x1 - x0) / g) + 2 * pad + 1,
      h = Math.ceil((y1 - y0) / g) + 2 * pad + 1,
      N = w * h;
    const fill = (loops) => {
      // scanline at cell centres, each loop even-odd on its own
      const m = new Uint8Array(N);
      for (const P of loops)
        for (let r = 0; r < h; r++) {
          const Y = oy + r * g,
            xs = [];
          for (let i = 0; i < P.length; i++) {
            const p = P[i],
              q = P[(i + 1) % P.length];
            if (p[1] > Y !== q[1] > Y) xs.push(p[0] + ((Y - p[1]) / (q[1] - p[1])) * (q[0] - p[0]));
          }
          xs.sort((u, v) => u - v);
          for (let i = 0; i + 1 < xs.length; i += 2) {
            const c0 = Math.max(0, Math.ceil((xs[i] - ox) / g)),
              c1 = Math.min(w - 1, Math.floor((xs[i + 1] - ox) / g));
            for (let c = c0; c <= c1; c++) m[r * w + c] = 1;
          }
        }
      return m;
    };
    const not = (m) => {
      const o = new Uint8Array(N);
      for (let i = 0; i < N; i++) o[i] = m[i] ? 0 : 1;
      return o;
    };
    const cellLab = new Int32Array(N),
      whole = { x0: [0], y0: [0], x1: [w - 1], y1: [h - 1] };
    const trace = (m) => {
      // outline of a region: level 0 of a signed distance (cells, + inside)
      const din = UNB.edt(not(m), w, h).dist,
        dout = UNB.edt(m, w, h).dist,
        sd = new Float64Array(N);
      for (let i = 0; i < N; i++) sd[i] = m[i] ? din[i] - 0.5 : 0.5 - dout[i];
      return isoContours(sd, cellLab, 0, 0, w, h, whole, ox, oy, g)
        .filter((P) => Math.abs(loopArea(P)) > 4 * g * g)
        .map((P) => P.flat());
    };
    return { w, h, N, g, ox, oy, fill, not, trace };
  };
  const boxOf = (loopSets) => {
    // the box round every point of every loop
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const L of loopSets)
      for (const P of L)
        for (const [x, y] of P) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    return { x0, y0, x1, y1 };
  };

  // ---------- overlapping shells ----------
  // A model made of separate shells that overlap (a mug's body and its handle, letters run together) slices into loops
  // that cross each other. Which loop is a hole is decided by containment, so a partly overlapping loop would be taken
  // for a hole or print across another. When any two loops of a layer overlap partly, the layer's outline is their
  // union instead: each loop filled on a grid (cells ~w/8 mm), OR-ed, and traced back (marching squares on a signed
  // distance). Holes fill in, which doesn't matter: only outsides print. outl: flat loops (mm); returns flat loops.
  const shareIn = (P, Q) => {
    const n = P.length,
      st = Math.max(1, Math.floor(n / 48));
    let a = 0,
      c = 0;
    for (let i = 0; i < n; i += st) {
      c++;
      if (inLoop(Q, P[i][0], P[i][1])) a++;
    }
    return a / c;
  };
  UNB.unionOverlaps = function (outl, lineW) {
    const L = outl.map(pairs).filter((P) => P.length > 2 && Math.abs(loopArea(P)) > 1e-3);
    let partial = false;
    for (let i = 0; i < L.length && !partial; i++)
      for (let j = 0; j < L.length && !partial; j++) {
        if (i === j) continue;
        const f = shareIn(L[i], L[j]);
        if (f > 0.02 && f < 0.98) partial = true;
      }
    if (!partial) return outl;
    const B = boxOf([L]),
      G = regionGrid(B.x0, B.y0, B.x1, B.y1, Math.max((lineW || 0.8) / 8, Math.max(B.x1 - B.x0, B.y1 - B.y0) / 900), 4);
    return G.trace(G.fill(L));
  };

  // ---------- overhangs and support ----------
  // A layer's outside contours (loops of [x, y], mm, not inside another; holes and inside surfaces dropped, as
  // printed).
  const outsideLoops = (outl) => {
    const L = outl.map(pairs).filter((P) => P.length > 2 && Math.abs(loopArea(P)) > 1e-3);
    return L.filter((P) => !L.some((Q) => Q !== P && inLoop(Q, P[0][0], P[0][1])));
  };
  // How far each layer reaches past the one below it (mm): a bead that steps out further than a fraction of its width
  // has nothing under it. outs: per layer, outside loops. Points every ~0.5 mm along each layer, outside every loop
  // of the layer below, measured to its nearest edge. Returns { worst, at (layer index; -1: none), over (per layer) }.
  UNB.modelOverhang = function (outs) {
    const over = new Float64Array(outs.length);
    let worst = 0,
      at = -1;
    const thin = (P, s) => {
      const out = [P[0]];
      let acc = 0;
      for (let i = 1; i < P.length; i++) {
        acc += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
        if (acc >= s) {
          out.push(P[i]);
          acc = 0;
        }
      }
      return out;
    };
    for (let k = 1; k < outs.length; k++) {
      const below = outs[k - 1].map((P) => thin(P, 0.25));
      if (!below.length) continue;
      let m = 0;
      for (const P of outs[k])
        for (const [x, y] of thin(P, 0.5)) {
          if (below.some((Q) => inLoop(Q, x, y))) continue;
          let d2 = Infinity;
          for (const Q of below)
            for (let i = 0; i < Q.length; i++) {
              const a = Q[i],
                b = Q[(i + 1) % Q.length],
                ux = b[0] - a[0],
                uy = b[1] - a[1],
                L2 = ux * ux + uy * uy || 1e-12;
              const t = Math.max(0, Math.min(1, ((x - a[0]) * ux + (y - a[1]) * uy) / L2)),
                dx = a[0] + t * ux - x,
                dy = a[1] + t * uy - y;
              if (dx * dx + dy * dy < d2) d2 = dx * dx + dy * dy;
            }
          m = Math.max(m, Math.sqrt(d2));
        }
      over[k] = m;
      if (m > worst) {
        worst = m;
        at = k;
      }
    }
    return { worst, at, over };
  };
  // Support, as part of the print (one continuous line can't print a separate support): worked from the top layer
  // down, each layer is widened so the layer above never reaches more than `step` mm past it.
  //   "skirt": the support pulls back towards the model one step a layer from its far edge only (not from sides that
  //            overhang nothing), so it braces back into the model at the overhang slope: a cone under a cap, a
  //            gusset under an arm (least chocolate).
  //   "thin":  everything under the model's overhangs dropped to the plate, thinned down its middle to the thinnest
  //            wall one narrow loop prints (w + d) and running into the model, then flared out at the overhang slope
  //            near the top to hold the whole overhang (the skirt pulling back towards the model and the thin wall).
  //            On a round model the middle is inside the model, so it comes out as the skirt. (It replaced a straight
  //            wall, v88: the same chocolate, since only outsides print, but the letter or arm keeps its shape.)
  // Whatever a pulled-back layer still can't hold is kept a bead wide (opt.w) and carried down, so no layer ends in
  // the air. Notches narrower than a bead, where a support meets the model, are closed, and holes filled (only
  // outsides print).
  // Worked on a grid (cells g mm): each layer's outside contours filled, grown or shrunk with distance transforms,
  // and widened layers traced back to outlines (marching squares on a signed distance, so the edge is smooth).
  // outs: per layer, outside loops (mm). opt: mode, step (mm), w (line width), d (spacing), g (mm, default: ~700 cells
  // across).
  // Returns { outlines (per layer: flat outline arrays [x0, y0, x1, y1, …] for UNB.modelLayer, or null when the
  // layer is unchanged), layers (how many widened), from (the lowest widened layer, -1: none), area (mm² added in all)
  // }.
  UNB.modelSupport = function (outs, opt) {
    const T = outs.length,
      mode = opt.mode === "thin" || opt.mode === "wall" ? "thin" : "skirt",
      step = Math.max(0.01, opt.step || 0.3); // ("wall": the straight wall thin replaced, v88)
    const { x0, y0, x1, y1 } = boxOf(outs);
    const none = { outlines: new Array(T).fill(null), layers: 0, from: -1, area: 0 };
    if (!(x1 > x0)) return none;
    const g0 = opt.g || Math.max((opt.w || 0.8) / 8, Math.max(x1 - x0, y1 - y0) / 700);
    // room round the edge for the closing (half a bead)
    const G = regionGrid(x0, y0, x1, y1, g0, Math.ceil((opt.w || 0.8) / g0) + 4);
    const { w, h, N, g, fill, not, trace } = G,
      a = step / g;
    const bead = (opt.w || 0.8) / g;
    const fillHoles = (m) => {
      // every empty cell not reached from the border becomes part of the region
      const seen = new Uint8Array(N),
        q = new Int32Array(N);
      let qh = 0,
        qt = 0;
      const push = (i) => {
        if (!m[i] && !seen[i]) {
          seen[i] = 1;
          q[qt++] = i;
        }
      };
      for (let c = 0; c < w; c++) {
        push(c);
        push((h - 1) * w + c);
      }
      for (let r = 0; r < h; r++) {
        push(r * w);
        push(r * w + w - 1);
      }
      while (qh < qt) {
        const i = q[qh++],
          c = i % w;
        if (c > 0) push(i - 1);
        if (c < w - 1) push(i + 1);
        if (i >= w) push(i - w);
        if (i < N - w) push(i + w);
      }
      for (let i = 0; i < N; i++) if (!m[i] && !seen[i]) m[i] = 1;
    };
    const close = (m) => {
      // closing by half a bead: a notch or slit narrower than a bead (where a support
      const r = bead / 2,
        dout = UNB.edt(m, w, h).dist,
        grown = new Uint8Array(N); // meets the model) can't print, so it's filled
      for (let i = 0; i < N; i++) grown[i] = dout[i] <= r ? 1 : 0;
      const din = UNB.edt(not(grown), w, h).dist;
      for (let i = 0; i < N; i++) if (din[i] > r) m[i] = 1;
    };
    // Pulling back towards what holds the support (the anchors: the model's own layer): a support cell stays when the
    // cell `a` further out, away from its nearest anchor, is still support and still nearest the same anchor. So a
    // skirt only retreats from its far edge (an arm keeps its full depth and braces back into the model at the
    // overhang slope), and between two parts of the model it splits where they meet.
    const dirOf = (i, n) => {
      const px = i % w,
        py = (i / w) | 0,
        dx = px - (n % w),
        dy = py - ((n / w) | 0),
        l = Math.hypot(dx, dy) || 1;
      return [px, py, dx / l, dy / l];
    };
    const at = (x, y) => {
      const X = Math.round(x),
        Y = Math.round(y);
      return X < 0 || Y < 0 || X >= w || Y >= h ? -1 : Y * w + X;
    };
    // "thin": the footprint of the model and everything dropped under its overhangs, reduced to its
    // middle line (where the nearest edge jumps from one side to the other), thickened back to the thinnest wall one
    // narrow loop prints (w + d), and kept inside the footprint. It runs into the model, so a layer stays one loop.
    const ribHalf = ((opt.w || 0.8) + (opt.d || opt.w || 0.8)) / 2 / g;
    const ribOf = (W) => {
      const e = UNB.edt(not(W), w, h),
        S = new Uint8Array(N);
      let any = false;
      for (let i = 0; i < N; i++) {
        if (!W[i] || e.dist[i] < ribHalf + 1) continue; // (not the short branches the middle line grows into corners)
        const n = e.near[i],
          nx = n % w,
          ny = (n / w) | 0;
        for (const j of [i + 1, i - 1, i + w, i - w]) {
          if (!W[j]) continue;
          const m = e.near[j],
            mx = m % w,
            my = (m / w) | 0;
          if (Math.hypot(nx - mx, ny - my) > Math.max(3, e.dist[i])) {
            S[i] = 1;
            any = true;
            break;
          } // the nearest edge jumps across: the middle (only the centre of a round part)
        }
      }
      if (!any) return W.slice();
      const dS = UNB.edt(S, w, h).dist,
        rib = new Uint8Array(N);
      for (let i = 0; i < N; i++) if (W[i] && dS[i] <= ribHalf) rib[i] = 1;
      return rib;
    };
    const res = new Array(T).fill(null);
    let R = null,
      C = mode === "skirt" ? null : new Uint8Array(N),
      layers = 0,
      from = -1,
      area = 0;
    for (let k = T - 1; k >= 0; k--) {
      const M = fill(outs[k]);
      if (!R) {
        R = M;
        continue;
      }
      const dM = UNB.edt(M, w, h).dist;
      let Rk;
      // the overhangs' footprint, dropped to the plate
      if (C) for (let i = 0; i < N; i++) if (R[i] && dM[i] > a) C[i] = 1;
      {
        let A = M;
        if (mode === "thin") {
          // the thin wall under the overhangs, and the model, hold the flare
          const W = M.slice();
          for (let i = 0; i < N; i++) if (C[i]) W[i] = 1;
          close(W);
          fillHoles(W);
          const rib = ribOf(W);
          A = M.slice();
          for (let i = 0; i < N; i++) if (rib[i]) A[i] = 1;
        }
        const e = UNB.edt(A, w, h);
        const part = labelComponents(A, w, h).lab;
        Rk = A.slice();
        for (let i = 0; i < N; i++)
          if (R[i] && !A[i]) {
            const [px, py, ux, uy] = dirOf(i, e.near[i]),
              q = at(px + a * ux, py + a * uy);
            if (q >= 0 && R[q] && part[e.near[q]] === part[e.near[i]]) Rk[i] = 1;
          }
        // whatever the pulled-back layer still can't hold (a concave corner, grid rounding) is kept a bead wide and
        // carried on down, so no layer of a support ends in the air
        const dB = UNB.edt(Rk, w, h).dist,
          Uo = new Uint8Array(N);
        let any = false;
        for (let i = 0; i < N; i++)
          if (R[i] && dB[i] > a + 1.5) {
            Uo[i] = 1;
            any = true;
          } // (1.5 cells: grid rounding)
        if (any) {
          const dU = UNB.edt(Uo, w, h).dist;
          for (let i = 0; i < N; i++) if (R[i] && dU[i] <= bead) Rk[i] = 1;
        }
      }
      close(Rk);
      // only outsides print: a gap left between the support and the model would print the model as a second loop inside
      fillHoles(Rk);
      let add = 0;
      for (let i = 0; i < N; i++) if (Rk[i] && dM[i] > 1.5) add++; // more than grid noise and corner fill-ins
      if (add > 3) {
        res[k] = trace(Rk);
        layers++;
        from = k;
        area += add * g * g;
      }
      R = Rk;
    }
    return { outlines: res, layers, from, area };
  };

  // A whole model as layers (generator: yields { done, of } after each layer). Layer k's nozzle height is
  // z0 + k·h (z0: the first layer); it is cut through the middle of its band (the first at z0 / 2). The first
  // `base` layers are filled at baseDensity (1: rows a line width apart, touching); the layers above are walls with an
  // infill at infillDensity (0: none, hollow and open at the top). Lines rows turn 90° every baseTurn / infillTurn
  // layers. Every layer starts at its point nearest the previous layer's start, so the walls spiral up without a jump.
  // opt: scale (mm per model unit), z0, h, base, w, d, walls, tol, cutBottom, cutTop (mm), support ("skirt" | "wall" |
  // none: see
  // UNB.modelSupport), overhang (mm a layer may step out; default a third of w), fillMinArea, baseDensity, basePattern,
  // baseAngle,
  // baseTurn, infillDensity, infillPattern, infillAngle, infillTurn (densities 0–1). Returns { base: [lines],
  // walls: [lines], T (layers), N (filled), terms: [per layer], empty (layers with nothing to cut), joins (per layer:
  // connector pairs joining separate outlines), overhang ({ worst mm, at layer }:
  // the model's own), support ({ layers, from, area mm², after: the worst overhang left } or null) }; lines are mm, y
  // up.
  UNB.modelStack = function* (tri, opt) {
    const o = opt || {},
      sc = o.scale || 1,
      h = o.h || 0.3,
      z0 = o.z0 || h;
    let top = 0;
    for (let i = 2; i < tri.length; i += 3) if (tri[i] > top) top = tri[i];
    // cutBottom / cutTop (mm): slice only between them, so a model whose top isn't flat (or whose bottom is round)
    // prints flat-topped / flat-based; the part below cutBottom is dropped and the print starts there
    const cb = Math.max(0, o.cutBottom || 0),
      ct = Math.max(0, o.cutTop || 0),
      Hfull = top * sc,
      Hmm = Math.max(h, Hfull - cb - ct);
    const T = Math.max(1, Math.floor((Hmm - z0) / h + 1e-9) + 1),
      NB = Math.min(T, Math.max(0, o.base | 0));
    // slice every layer first (support is worked out from the top down), then fit them from the bottom up
    const outl = [];
    for (let k = 0; k < T; k++) {
      const zc = (cb + (k === 0 ? z0 / 2 : z0 + (k - 0.5) * h)) / sc;
      outl.push(
        UNB.unionOverlaps(
          UNB.sliceMesh(tri, Math.min(zc, top - 1e-6)).map((f) => f.map((v) => v * sc)),
          o.w
        )
      );
    } // overlapping shells merged
    const outs = outl.map(outsideLoops),
      overhang = UNB.modelOverhang(outs);
    let support = null;
    if (o.support === "skirt" || o.support === "thin" || o.support === "wall") {
      support = UNB.modelSupport(outs, { mode: o.support, step: o.overhang || (o.w || 0.8) / 3, w: o.w, d: o.d });
      support.outlines.forEach((L, k) => {
        if (L) outl[k] = L;
      });
      // what's left: within the step (grid rounding aside)
      support.after = UNB.modelOverhang(outl.map(outsideLoops)).worst;
      delete support.outlines;
    }
    const base = [],
      walls = [],
      terms = [],
      joins = [];
    let prev = null,
      empty = 0,
      last = null;
    for (let k = 0; k < T; k++) {
      const baseL = k < NB,
        j = baseL ? k : k - NB,
        F = UNB.fillPlan(o, baseL, j);
      let L = outl[k].length
        ? UNB.modelLayer(outl[k], {
            w: o.w,
            d: o.d,
            walls: o.walls,
            tol: o.tol,
            fill: F.pattern,
            fillSpacing: F.spacing,
            fillAngle: F.angle,
            fillMinArea: F.minArea,
          })
        : null;
      if (!L) {
        empty++;
        L = last;
      } else last = L;
      if (!L) {
        yield { done: k + 1, of: T };
        continue;
      }
      // start nearest the previous layer's start
      let x = L.x,
        y = L.y;
      if (prev) {
        let bi = 0,
          bd = Infinity;
        for (let i = 0; i < x.length; i++) {
          const dd = (x[i] - prev[0]) ** 2 + (y[i] - prev[1]) ** 2;
          if (dd < bd) {
            bd = dd;
            bi = i;
          }
        }
        if (bi) {
          const n = x.length,
            rx = new Float64Array(n),
            ry = new Float64Array(n);
          for (let i = 0; i < n; i++) {
            rx[i] = x[(i + bi) % n];
            ry[i] = y[(i + bi) % n];
          }
          x = rx;
          y = ry;
        }
      }
      prev = [x[0], y[0]];
      (baseL ? base : walls).push({ x, y });
      terms.push(L.N);
      joins.push(L.connectors); // a layer missing at the bottom doesn't turn a wall into a base layer
      yield { done: k + 1, of: T };
    }
    return {
      base,
      walls,
      T: base.length + walls.length,
      N: base.length,
      terms,
      joins,
      empty,
      height: Hmm,
      overhang: { worst: overhang.worst, at: overhang.at },
      support,
    };
  };

  // A model drawn as lines, the way a pen plotter would (after plotter.vision): seen from (yaw, pitch) like the
  // preview,
  // orthographic. Drawn edges: outlines (an edge between a face turned towards you and one turned away), open edges
  // (only one face) and folds sharper than `crease` degrees (crease near 0: every edge except between faces lying
  // flat together, a wireframe). Hidden parts are removed with a depth buffer: every face is filled in, then each edge
  // is walked in half-pixel steps and kept where nothing lies in front of it.
  // opt: yaw, pitch (radians), size (px, the longer side), crease (degrees), pad (px). Returns { w, h, segs: [x0, y0,
  // x1, y1, …] (px, visible pieces), edges (how many drawn edges were considered) }.
  UNB.hiddenLines = function (tri, opt) {
    const o = opt || {},
      n = tri.length / 9,
      cy = Math.cos(o.yaw || 0),
      sy = Math.sin(o.yaw || 0),
      cp = Math.cos(o.pitch || 0),
      sp = Math.sin(o.pitch || 0);
    let zlo = Infinity,
      zhi = -Infinity;
    for (let i = 2; i < tri.length; i += 3) {
      zlo = Math.min(zlo, tri[i]);
      zhi = Math.max(zhi, tri[i]);
    }
    const zm = (zlo + zhi) / 2,
      V = new Float64Array(tri.length); // view coordinates: x right, y down, depth towards you
    for (let i = 0; i < tri.length; i += 3) {
      const x = tri[i],
        y = tri[i + 1],
        Zc = tri[i + 2] - zm,
        X = x * cy - y * sy,
        Y = x * sy + y * cy;
      V[i] = X;
      V[i + 1] = -(Zc * cp + Y * sp);
      V[i + 2] = Zc * sp - Y * cp;
    }
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity,
      d0 = Infinity,
      d1 = -Infinity;
    for (let i = 0; i < V.length; i += 3) {
      x0 = Math.min(x0, V[i]);
      x1 = Math.max(x1, V[i]);
      y0 = Math.min(y0, V[i + 1]);
      y1 = Math.max(y1, V[i + 1]);
      d0 = Math.min(d0, V[i + 2]);
      d1 = Math.max(d1, V[i + 2]);
    }
    const size = o.size || 1200,
      pad = o.pad == null ? 0.04 * size : o.pad,
      k = (size - 2 * pad) / Math.max(x1 - x0, y1 - y0, 1e-9);
    const w = Math.ceil((x1 - x0) * k + 2 * pad),
      h = Math.ceil((y1 - y0) * k + 2 * pad);
    for (let i = 0; i < V.length; i += 3) {
      V[i] = (V[i] - x0) * k + pad;
      V[i + 1] = (V[i + 1] - y0) * k + pad;
      V[i + 2] *= k;
    }
    // depth buffer: the nearest surface at each pixel
    const Z = new Float32Array(w * h).fill(-Infinity);
    for (let t = 0; t < n; t++) {
      const a = 9 * t,
        ax = V[a],
        ay = V[a + 1],
        az = V[a + 2],
        bx = V[a + 3],
        by = V[a + 4],
        bz = V[a + 5],
        cx = V[a + 6],
        cy2 = V[a + 7],
        cz = V[a + 8];
      const den = (by - cy2) * (ax - cx) + (cx - bx) * (ay - cy2);
      if (Math.abs(den) < 1e-12) continue;
      const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx))),
        maxX = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx))),
        minY = Math.max(0, Math.floor(Math.min(ay, by, cy2))),
        maxY = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy2)));
      for (let py = minY; py <= maxY; py++)
        for (let px = minX; px <= maxX; px++) {
          const l1 = ((by - cy2) * (px - cx) + (cx - bx) * (py - cy2)) / den,
            l2 = ((cy2 - ay) * (px - cx) + (ax - cx) * (py - cy2)) / den,
            l3 = 1 - l1 - l2;
          if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
          const z = l1 * az + l2 * bz + l3 * cz,
            q = py * w + px;
          if (z > Z[q]) Z[q] = z;
        }
    }
    // edges and the faces either side (corners matched to 0.0001 units)
    const qk = (i) => cornerKey(tri, i),
      edges = new Map(),
      N = new Float64Array(3 * n);
    const vdir = [-cp * sy, -cp * cy, sp]; // towards you, in model coordinates
    for (let t = 0; t < n; t++) {
      const a = 9 * t,
        ux = tri[a + 3] - tri[a],
        uy = tri[a + 4] - tri[a + 1],
        uz = tri[a + 5] - tri[a + 2],
        vx = tri[a + 6] - tri[a],
        vy = tri[a + 7] - tri[a + 1],
        vz = tri[a + 8] - tri[a + 2];
      let nx = uy * vz - uz * vy,
        ny = uz * vx - ux * vz,
        nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz);
      if (!(l > 1e-12)) continue; // a flat sliver (zero area) has no side to draw
      N[3 * t] = nx / l;
      N[3 * t + 1] = ny / l;
      N[3 * t + 2] = nz / l;
      for (let e = 0; e < 3; e++) {
        const i = a + 3 * e,
          j = a + 3 * ((e + 1) % 3),
          ki = qk(i),
          kj = qk(j),
          key = ki < kj ? ki + "|" + kj : kj + "|" + ki;
        let E = edges.get(key);
        if (!E) edges.set(key, (E = { i, j, f: [] }));
        E.f.push(t);
      }
    }
    const cosC = Math.cos((Math.max(0.01, o.crease == null ? 30 : o.crease) * Math.PI) / 180),
      front = (t) => N[3 * t] * vdir[0] + N[3 * t + 1] * vdir[1] + N[3 * t + 2] * vdir[2] > 0;
    const eps = Math.max(1, 0.004 * (d1 - d0) * k),
      segs = [];
    let considered = 0;
    for (const E of edges.values()) {
      let draw = false;
      if (E.f.length !== 2)
        draw = true; // open edge (or more than two faces)
      else {
        const [p, q] = E.f,
          fp = front(p),
          fq = front(q);
        if (fp !== fq) draw = true;
        else if (fp) draw = N[3 * p] * N[3 * q] + N[3 * p + 1] * N[3 * q + 1] + N[3 * p + 2] * N[3 * q + 2] < cosC;
      }
      if (!draw) continue;
      considered++;
      const ax = V[E.i],
        ay = V[E.i + 1],
        az = V[E.i + 2],
        bx = V[E.j],
        by = V[E.j + 1],
        bz = V[E.j + 2],
        L = Math.hypot(bx - ax, by - ay),
        m = Math.max(1, Math.ceil(L * 2));
      let run = null;
      for (let s = 0; s <= m; s++) {
        const u = s / m,
          X = ax + u * (bx - ax),
          Y = ay + u * (by - ay),
          D = az + u * (bz - az),
          px = Math.round(X),
          py = Math.round(Y);
        let vis = false;
        if (px >= 0 && py >= 0 && px < w && py < h) {
          // nothing nearer here: compared with the farthest of the pixel and its neighbours, as an outline's own
          // surface turns away steeply within a pixel
          let zb = Infinity;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const qx = px + dx,
                qy = py + dy;
              zb = Math.min(zb, qx >= 0 && qy >= 0 && qx < w && qy < h ? Z[qy * w + qx] : -Infinity);
            }
          vis = D >= zb - eps;
        }
        if (vis) {
          if (!run) run = [X, Y];
          run[2] = X;
          run[3] = Y;
        } else if (run) {
          if (run.length === 4) segs.push(...run);
          run = null;
        }
      }
      if (run && run.length === 4) segs.push(...run);
    }
    return { w, h, segs, edges: considered, k }; // k: px per model unit
  };

  // Line pieces [x0, y0, x1, y1, …] joined end to end where they meet (within tol), so a plotter lifts the pen less.
  // Returns polylines as flat [x, y, x, y, …] arrays.
  UNB.chainSegments = function (segs, tol) {
    const t = tol || 0.5,
      n = segs.length / 4,
      cellOf = (v) => Math.floor(v / t),
      ends = new Map(),
      used = new Uint8Array(n),
      out = [];
    for (let i = 0; i < n; i++)
      for (const e of [0, 1]) {
        const k = cellOf(segs[4 * i + 2 * e]) + "," + cellOf(segs[4 * i + 2 * e + 1]);
        let A = ends.get(k);
        if (!A) ends.set(k, (A = []));
        A.push(i * 2 + e);
      }
    const take = (x, y) => {
      // the nearest unused end within tol (this cell and its 8 neighbours)
      const cx = cellOf(x),
        cy = cellOf(y);
      let best = -1,
        bd = t * t;
      for (let a = -1; a <= 1; a++)
        for (let b = -1; b <= 1; b++)
          for (const c of ends.get(cx + a + "," + (cy + b)) || []) {
            if (used[c >> 1]) continue;
            const d2 = (segs[2 * c] - x) ** 2 + (segs[2 * c + 1] - y) ** 2;
            if (d2 <= bd) {
              bd = d2;
              best = c;
            }
          }
      return best;
    };
    for (let i0 = 0; i0 < n; i0++) {
      if (used[i0]) continue;
      used[i0] = 1;
      const line = [segs[4 * i0], segs[4 * i0 + 1], segs[4 * i0 + 2], segs[4 * i0 + 3]],
        head = []; // head: points before the start, nearest first
      for (const fwd of [true, false]) {
        // grow from the end, then from the start
        for (;;) {
          const x = fwd ? line[line.length - 2] : head.length ? head[head.length - 2] : line[0],
            y = fwd ? line[line.length - 1] : head.length ? head[head.length - 1] : line[1],
            c = take(x, y);
          if (c < 0) break;
          const i = c >> 1,
            e = c & 1;
          used[i] = 1;
          const ox = segs[4 * i + 2 * (1 - e)],
            oy = segs[4 * i + 2 * (1 - e) + 1];
          (fwd ? line : head).push(ox, oy);
        }
      }
      const pre = [];
      for (let k = head.length - 2; k >= 0; k -= 2) pre.push(head[k], head[k + 1]);
      out.push(pre.concat(line));
    }
    return out;
  };

  // Polylines (mm, y down) as an SVG drawing at its own size, with a margin: for the line drawing of a model's view.
  // opt: W, H (mm), margin, pen (stroke width, mm), title
  UNB.exportLinesSVG = function (lines, opt) {
    const o = opt || {},
      mg = o.margin == null ? 5 : o.margin,
      W = o.W + 2 * mg,
      H = o.H + 2 * mg,
      at = (v) => f3(v + mg);
    const body = svgPolylines(lines, at, at, 300);
    return (
      `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Unbroken: ${String(o.title || "line drawing").replace(/--/g, "-")}, ${lines.length} strokes, hidden lines removed -->\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" width="${f3(W)}mm" height="${f3(H)}mm" viewBox="0 0 ${f3(W)} ${f3(H)}">\n` +
      `<g fill="none" stroke="#000000" stroke-width="${f3(o.pen || 0.3)}" stroke-linecap="round" stroke-linejoin="round">\n${body}</g>\n</svg>\n`
    );
  };
})(typeof window !== "undefined" ? window : globalThis);
