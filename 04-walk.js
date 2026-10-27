/* Unbroken · engine · 04-walk.js
   4. The walk — line map → one continuous path over every line pixel, moved onto the middle of each stroke; corners
   rounded; out-and-back strokes spread into strands with stroke-end loops.
   One part of the engine (no DOM), loaded after 03-text.js; core.js lists every part and what's in it. */
(function (root) {
  "use strict";
  const UNB = root.UNB,
    { labelComponents, bilinear, makeUF, makeHeap, cellGrid } = UNB._u; // shared helpers (00-util.js)

  // Exact Euclidean distance transform (Felzenszwalb): for every cell, dist = the distance (cells) to the nearest set
  // cell of mask, and near = that cell's index.
  UNB.edt = function (mask, w, h) {
    const INF = 1e20,
      N = w * h,
      n = Math.max(w, h);
    const cd = new Float64Array(N),
      cy = new Int32Array(N);
    const f = new Float64Array(n),
      d = new Float64Array(n),
      v = new Int32Array(n),
      z = new Float64Array(n + 1),
      arg = new Int32Array(n);
    function dt1(len) {
      let k = 0;
      v[0] = 0;
      z[0] = -INF;
      z[1] = INF;
      for (let q = 1; q < len; q++) {
        let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        while (s <= z[k]) {
          k--;
          s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        }
        k++;
        v[k] = q;
        z[k] = s;
        z[k + 1] = INF;
      }
      k = 0;
      for (let q = 0; q < len; q++) {
        while (z[k + 1] < q) k++;
        d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
        arg[q] = v[k];
      }
    }
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) f[y] = mask[y * w + x] ? 0 : INF;
      dt1(h);
      for (let y = 0; y < h; y++) {
        cd[y * w + x] = d[y];
        cy[y * w + x] = arg[y];
      }
    }
    const dist = new Float32Array(N),
      near = new Int32Array(N);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) f[x] = cd[y * w + x];
      dt1(w);
      for (let x = 0; x < w; x++) {
        dist[y * w + x] = Math.sqrt(d[x]);
        near[y * w + x] = cy[y * w + arg[x]] * w + arg[x];
      }
    }
    return { dist, near };
  };

  // ---------- the walk, step by step (UNB.buildWalk runs them in order) ----------
  // 1. Connector routing over the pixel grid (only with painted lanes): a grid Dijkstra and its route back.
  function walkRouter(w, h, opt) {
    const N = w * h;
    // Connector paths: with a painted lane mask, connectors become least-cost routes over the pixel grid, where a
    // step inside a lane costs laneCost (cheap) and a step anywhere else costs 1. Without lanes they stay straight.
    const lanes = opt.lanes || null,
      laneCost = opt.laneCost || 0.1;
    let anyLane = false;
    if (lanes)
      for (let i = 0; i < N; i++)
        if (lanes[i]) {
          anyLane = true;
          break;
        }
    const cellCost = (i) => (anyLane && lanes[i] ? laneCost : 1);
    const gd = anyLane ? new Float64Array(N).fill(Infinity) : null,
      gpred = anyLane ? new Int32Array(N).fill(-1) : null,
      glab = anyLane ? new Int32Array(N).fill(-1) : null;
    // cells the last run reached: only these are reset (a run per loose end was refilling the whole image)
    const touched = [];
    const GH = makeHeap();
    const D8 = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    // grid Dijkstra from the given source pixels (labels carried along); stops past `limit` cost, after `maxNodes`
    // pops, or as soon as onPop returns true (it has found what it was looking for)
    const gridRun = (sources, labels, limit, maxNodes, onPop) => {
      for (const q of touched) {
        gd[q] = Infinity;
        gpred[q] = -1;
        glab[q] = -1;
      }
      touched.length = 0;
      GH.clear();
      sources.forEach((p, i) => {
        if (gd[p] === Infinity) touched.push(p);
        gd[p] = 0;
        glab[p] = labels ? labels[i] : 0;
        GH.push(p, 0);
      });
      let pops = 0;
      while (GH.size()) {
        const d0 = GH.topKey(),
          p = GH.pop();
        if (d0 > gd[p]) continue;
        if (d0 > limit || ++pops > maxNodes) break;
        if (onPop && onPop(p, d0)) break;
        const x = p % w,
          y = (p / w) | 0,
          cp = cellCost(p);
        for (const [dx, dy] of D8) {
          const xx = x + dx,
            yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const q = yy * w + xx,
            nd = d0 + 0.5 * (cp + cellCost(q)) * (dx && dy ? Math.SQRT2 : 1);
          if (nd < gd[q]) {
            if (gd[q] === Infinity) touched.push(q);
            gd[q] = nd;
            gpred[q] = p;
            glab[q] = glab[p];
            GH.push(q, nd);
          }
        }
      }
    };
    const backtrack = (p) => {
      const out = [];
      while (p >= 0) {
        out.push(p);
        p = gpred[p];
      }
      return out;
    }; // p → source
    return { anyLane, cellCost, gridRun, backtrack, gd, gpred, glab };
  }
  // 2. The parts: pieces of line, the small ones dropped, the rest grouped by distance (far small groups dropped too)
  // and joined into one by the shortest connectors. null when nothing is left.
  function walkParts(lines, w, h, opt, R) {
    const { anyLane, cellCost, gridRun, gd, gpred, glab } = R,
      N = w * h,
      minPix = opt.minPix || 0,
      maxJump = opt.maxJump || 0;
    // components on the raw pixel graph (same adjacency as the edge rule below)
    const { lab, n: nComp } = labelComponents(lines, w, h);
    const size = new Int32Array(nComp);
    for (let i = 0; i < N; i++) if (lab[i] >= 0) size[lab[i]]++;
    const kept = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (lab[i] >= 0 && size[lab[i]] >= minPix) kept[i] = 1;
    let anyKept = false;
    for (let i = 0; i < N; i++)
      if (kept[i]) {
        anyKept = true;
        break;
      }
    if (!anyKept) return null;
    // candidate jumps between Voronoi-adjacent components of a pixel set
    const makeCand = (keep) => {
      const { near } = UNB.edt(keep, w, h);
      // candidate jumps between Voronoi-adjacent components
      const cand = new Map();
      if (anyLane) {
        // geodesic version: cheapest routes between parts through the lanes
        const src = [],
          labs = [];
        for (let i = 0; i < N; i++)
          if (keep[i]) {
            src.push(i);
            labs.push(lab[i]);
          }
        gridRun(src, labs, Infinity, Infinity);
        const pathLab = Int32Array.from(glab),
          pathD = Float64Array.from(gd),
          pathPred = Int32Array.from(gpred);
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            const p = y * w + x;
            for (const q of [x + 1 < w ? p + 1 : -1, y + 1 < h ? p + w : -1]) {
              if (q < 0) continue;
              const ca = pathLab[p],
                cb = pathLab[q];
              if (ca < 0 || cb < 0 || ca === cb) continue;
              const dd = pathD[p] + pathD[q] + 0.5 * (cellCost(p) + cellCost(q)),
                key = ca < cb ? ca * nComp + cb : cb * nComp + ca;
              const cur = cand.get(key);
              if (!cur || dd < cur.d) cand.set(key, { d: dd, p, q, ca, cb });
            }
          }
        const back = (p) => {
          const out = [];
          while (p >= 0) {
            out.push(p);
            p = pathPred[p];
          }
          return out;
        };
        for (const e of cand.values()) {
          const A = back(e.p).reverse(),
            B = back(e.q);
          e.path = A.concat(B);
          e.a = e.path[0];
          e.b = e.path[e.path.length - 1];
        }
      } else {
        const consider = (p, q) => {
          const a = near[p],
            b = near[q],
            ca = lab[a],
            cb = lab[b];
          if (ca === cb) return;
          const dx = (a % w) - (b % w),
            dy = ((a / w) | 0) - ((b / w) | 0),
            dd = Math.hypot(dx, dy);
          const key = ca < cb ? ca * nComp + cb : cb * nComp + ca;
          const cur = cand.get(key);
          if (!cur || dd < cur.d) cand.set(key, { d: dd, a, b, ca, cb });
        };
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            const p = y * w + x;
            if (x + 1 < w) consider(p, p + 1);
            if (y + 1 < h) consider(p, p + w);
          }
      }
      return cand;
    };
    // Kruskal: join parts nearer than maxJump into groups
    const { parent: par, find } = makeUF(nComp);
    let jumps = [];
    const kruskal = (cand, limit) => {
      for (const e of [...cand.values()].sort((u, v) => u.d - v.d)) {
        if (limit > 0 && e.d > limit) break;
        const ra = find(e.ca),
          rb = find(e.cb);
        if (ra === rb) continue;
        par[ra] = rb;
        jumps.push(e);
      }
    };
    kruskal(makeCand(kept), maxJump);
    // Far-away groups are dropped only when they are small (specks, stray marks): under a fifth of the biggest group's
    // line length. A sizeable second element of the drawing is kept and joined with the shortest connectors.
    const groupSize = new Map();
    for (let c = 0; c < nComp; c++)
      if (size[c] >= minPix) {
        const r = find(c);
        groupSize.set(r, (groupSize.get(r) || 0) + size[c]);
      }
    // a far group is kept when its line is at least this × the biggest group's
    const farShare = opt.farShare == null ? 0.2 : opt.farShare;
    // (no spread: many groups overflow the call stack)
    const biggest = [...groupSize.values()].reduce((a, b) => Math.max(a, b), 0),
      bigGroups = [...groupSize].filter(([, v]) => v >= farShare * biggest).map(([r]) => r);
    const keepRoot = new Set(bigGroups);
    let rootComp = -1,
      best = -1; // the biggest single part: the walk starts on it
    for (let c = 0; c < nComp; c++)
      if (size[c] >= minPix && size[c] > best) {
        best = size[c];
        rootComp = c;
      }
    let dropped = 0;
    const keepComp = new Uint8Array(nComp);
    for (let c = 0; c < nComp; c++)
      if (size[c] >= minPix) {
        if (keepRoot.has(find(c))) keepComp[c] = 1;
        else dropped++;
      }
    if (bigGroups.length > 1) {
      // connect the kept groups: neighbours among kept parts only, no distance limit
      const keep2 = new Uint8Array(N);
      for (let i = 0; i < N; i++) if (kept[i] && keepComp[lab[i]]) keep2[i] = 1;
      kruskal(makeCand(keep2), 0);
    }
    return { lab, nComp, kept, keepComp, jumps, dropped, rootComp };
  }
  // 3. The graph: a vertex per kept line pixel, edges between neighbours, and the connectors (straight, or along a
  // route).
  function walkGraph(lines, w, h, P) {
    const N = w * h,
      L = (x, y) => x >= 0 && y >= 0 && x < w && y < h && lines[y * w + x],
      { kept, keepComp, lab, jumps } = P;
    // vertices
    const vid = new Int32Array(N).fill(-1),
      vx = [],
      vy = [];
    for (let i = 0; i < N; i++)
      if (kept[i] && keepComp[lab[i]]) {
        vid[i] = vx.length;
        vx.push(i % w);
        vy.push((i / w) | 0);
      }
    let V = vx.length;
    const V0 = V; // line vertices; connector routes add more after these
    // edges
    const eu = [],
      ev = [],
      ej = [];
    const addE = (a, b, jump) => {
      eu.push(a);
      ev.push(b);
      ej.push(jump ? 1 : 0);
    };
    for (let k = 0; k < V; k++) {
      const x = vx[k],
        y = vy[k],
        p = y * w + x;
      if (x + 1 < w && vid[p + 1] >= 0) addE(k, vid[p + 1]);
      if (y + 1 < h && vid[p + w] >= 0) addE(k, vid[p + w]);
      if (x + 1 < w && y + 1 < h && vid[p + w + 1] >= 0 && !L(x + 1, y) && !L(x, y + 1)) addE(k, vid[p + w + 1]);
      if (x > 0 && y + 1 < h && vid[p + w - 1] >= 0 && !L(x - 1, y) && !L(x, y + 1)) addE(k, vid[p + w - 1]);
    }
    const G = { vid, vx, vy, V, V0, eu, ev, ej, addE, jumpLen: 0 };
    G.addRoute = (path) => {
      // a connector along a pixel route: new vertices joined by jump edges
      let prev = vid[path[0]],
        len = 0;
      for (let i = 1; i < path.length; i++) {
        const p = path[i],
          last = i === path.length - 1;
        let cur;
        if (last) cur = vid[p];
        else {
          cur = vx.length;
          vx.push(p % w);
          vy.push((p / w) | 0);
        }
        addE(prev, cur, true);
        len += Math.hypot((p % w) - (path[i - 1] % w), ((p / w) | 0) - ((path[i - 1] / w) | 0));
        prev = cur;
      }
      G.V = vx.length;
      return len;
    };
    for (const e of jumps)
      if (keepComp[e.ca] && keepComp[e.cb]) {
        if (e.path) G.jumpLen += G.addRoute(e.path);
        else {
          addE(vid[e.a], vid[e.b], true);
          G.jumpLen += e.d;
        }
      }
    return G;
  }
  // 4. Loose ends paired up: returns the line edges to retrace (each matched pair's shortest stretch); connector
  // matches are added to the graph.
  function walkPairEnds(G, w, h, opt, R) {
    const { vx, vy, eu, ev, addE, addRoute, V0 } = G,
      V = G.V,
      { anyLane, gridRun, backtrack } = R;
    // Pair up loose ends. Every odd-degree vertex forces some stretch of line to be drawn twice; which stretch
    // is chosen here. Each odd vertex is matched to a nearby one, cheapest first, either by retracing the shortest
    // stretch of line between them, or (when jumpCost > 0) by a straight connector that costs jumpCost × its length.
    // Anything left unmatched falls back to the spanning-tree T-join below.
    const jumpCost = opt.jumpCost === undefined ? 2 : opt.jumpCost;
    const diag = Math.hypot(w, h),
      toggled = [];
    {
      const E0 = eu.length,
        adj0 = Array.from({ length: V }, () => []);
      for (let e = 0; e < E0; e++) {
        adj0[eu[e]].push(e);
        adj0[ev[e]].push(e);
      }
      const odd = [];
      for (let v = 0; v < V; v++) if (adj0[v].length & 1) odd.push(v);
      const reach = opt.pairReach || 0.08 * diag,
        lineReach = opt.lineReach || 0.2 * diag;
      const grid = cellGrid(Math.max(4, reach)),
        rank = new Int32Array(V).fill(-1);
      odd.forEach((v, i) => {
        rank[v] = i;
        grid.add(vx[v], vy[v], v);
      });
      const dist = new Float64Array(V).fill(Infinity),
        pred = new Int32Array(V).fill(-1),
        seen = [];
      const H = makeHeap();
      const dijkstra = (a, limit, onOdd) => {
        // shortest distances along the line from a, up to limit
        dist[a] = 0;
        pred[a] = -1;
        seen.push(a);
        H.push(a, 0);
        while (H.size()) {
          const d0 = H.topKey(),
            v = H.pop();
          if (d0 > dist[v]) continue;
          if (d0 > limit) break;
          if (onOdd && v !== a && rank[v] >= 0) onOdd(v, d0);
          for (const e of adj0[v]) {
            const u = eu[e] === v ? ev[e] : eu[e],
              nd = d0 + Math.hypot(vx[u] - vx[v], vy[u] - vy[v]);
            if (nd < dist[u]) {
              if (dist[u] === Infinity) seen.push(u);
              dist[u] = nd;
              pred[u] = e;
              H.push(u, nd);
            }
          }
        }
        H.clear();
      };
      const reset = () => {
        for (const v of seen) {
          dist[v] = Infinity;
          pred[v] = -1;
        }
        seen.length = 0;
      };
      const cands = []; // [cost, a, b, isJump]
      const pixOf = (v) => vy[v] * w + vx[v];
      const oddAt = new Map();
      if (anyLane) for (const v of odd) if (v < V0) oddAt.set(pixOf(v), v);
      for (const a of odd) {
        const near = [];
        if (jumpCost > 0 && anyLane && a < V0) {
          // lane-aware: route cost through the grid
          // the nearest few loose ends by route cost are enough candidates (the matching takes the cheapest), and
          // stopping there keeps a drawing with many loose ends fast
          gridRun([pixOf(a)], null, reach, 60000, (p, d) => {
            const b = oddAt.get(p);
            if (b !== undefined && rank[b] > rank[a]) near.push([b, d]);
            return near.length >= 8;
          });
        } else if (jumpCost > 0)
          grid.near(vx[a], vy[a], (b) => {
            if (rank[b] > rank[a]) {
              const e = Math.hypot(vx[b] - vx[a], vy[b] - vy[a]);
              if (e <= reach) near.push([b, e]);
            }
          });
        dijkstra(a, lineReach, (b, d) => {
          if (rank[b] > rank[a]) cands.push([d, a, b, 0]);
        });
        for (const [b, e] of near) if (jumpCost * e < dist[b]) cands.push([jumpCost * e, a, b, 1]);
        reset();
      }
      cands.sort((p, q) => p[0] - q[0]);
      const used = new Uint8Array(V),
        viaLine = new Map();
      for (const [c, a, b, isJump] of cands) {
        if (used[a] || used[b]) continue;
        used[a] = used[b] = 1;
        if (isJump && anyLane && a < V0 && b < V0) {
          const tb = pixOf(b);
          gridRun([pixOf(a)], null, Infinity, 60000, (p) => p === tb); // stop once the far end is reached
          const path = backtrack(pixOf(b)).reverse();
          if (path[0] === pixOf(a)) {
            G.jumpLen += addRoute(path);
            continue;
          }
          addE(a, b, true);
          G.jumpLen += Math.hypot(vx[a] - vx[b], vy[a] - vy[b]);
        } else if (isJump) {
          addE(a, b, true);
          G.jumpLen += c / jumpCost;
        } else {
          let l = viaLine.get(a);
          if (!l) viaLine.set(a, (l = []));
          l.push(b);
        }
      }
      const flip = new Uint8Array(E0);
      for (const [a, bs] of viaLine) {
        // retrace the shortest stretch between each matched pair
        dijkstra(a, lineReach);
        for (const b of bs)
          for (let v = b; v !== a; ) {
            const e = pred[v];
            flip[e] ^= 1;
            v = eu[e] === v ? ev[e] : eu[e];
          }
        reset();
      }
      for (let e = 0; e < E0; e++) if (flip[e]) toggled.push(e);
    }
    return toggled;
  }
  // 5. Which edges are drawn twice (every vertex even), where the walk starts, and for an open path its two ends.
  // null for a single dot.
  function walkDouble(G, P, w, opt, toggled) {
    const { vx, vy, eu, ev } = G,
      V = G.V,
      V0 = G.V0,
      { lab, rootComp } = P,
      startAt = opt.startAt || null,
      open = !!opt.open;
    const E = eu.length;
    if (!E) return null; // a single dot: no line to walk
    const adj = Array.from({ length: V }, () => []);
    for (let e = 0; e < E; e++) {
      adj[eu[e]].push(e);
      adj[ev[e]].push(e);
    }
    // spanning tree (BFS) from the top-left-most pixel of the root component
    let start = 0;
    for (let k = 0; k < V0; k++)
      if (lab[vy[k] * w + vx[k]] === rootComp) {
        start = k;
        break;
      }
    const pe = new Int32Array(V).fill(-2),
      order = [start];
    pe[start] = -1;
    for (let qi = 0; qi < order.length; qi++) {
      const v = order[qi];
      for (const e of adj[v]) {
        const u = eu[e] === v ? ev[e] : eu[e];
        if (pe[u] === -2) {
          pe[u] = e;
          order.push(u);
        }
      }
    }
    // T-join: double tree edges so every vertex has even degree
    const cnt = new Uint8Array(E).fill(1),
      sub = new Uint8Array(V);
    for (let v = 0; v < V; v++) sub[v] = adj[v].length & 1;
    for (const e of toggled) {
      cnt[e] = 2;
      sub[eu[e]] ^= 1;
      sub[ev[e]] ^= 1;
    } // matched pairs are already even
    for (let i = order.length - 1; i > 0; i--) {
      const v = order[i];
      if (sub[v]) {
        const e = pe[v];
        cnt[e] = cnt[e] > 1 ? 1 : 2;
        const p = eu[e] === v ? ev[e] : eu[e];
        sub[p] ^= 1;
      }
    }
    // nearest vertex to a requested start point
    let pinned = -1;
    if (startAt) {
      let bd = Infinity;
      for (let v = 0; v < V0; v++) {
        const d = (vx[v] - startAt[0]) ** 2 + (vy[v] - startAt[1]) ** 2;
        if (d < bd) {
          bd = d;
          pinned = v;
        }
      }
    }
    // Open path: pick two loose ends whose tree path saves the most retracing, then un-double / double along it.
    let walkStart = pinned >= 0 ? pinned : start,
      ends = null;
    if (open) {
      const oddList = [];
      for (let v = 0; v < V; v++) if (adj[v].length & 1) oddList.push(v);
      if (oddList.length >= 2 || pinned >= 0) {
        const tAdj = Array.from({ length: V }, () => []);
        for (let v = 0; v < V; v++)
          if (pe[v] >= 0) {
            const e = pe[v],
              p = eu[e] === v ? ev[e] : eu[e];
            tAdj[v].push(e);
            tAdj[p].push(e);
          }
        const isOdd = new Uint8Array(V);
        for (const v of oddList) isOdd[v] = 1;
        const step = pinned >= 0 ? 1 : Math.max(1, Math.floor(oddList.length / 40));
        const cands = pinned >= 0 ? [pinned] : oddList;
        let best = { gain: -Infinity };
        const gain = new Float64Array(V),
          from = new Int32Array(V);
        for (let ci = 0; ci < cands.length; ci += step) {
          const a0 = cands[ci];
          gain.fill(NaN);
          gain[a0] = 0;
          from[a0] = -1;
          const q = [a0];
          for (let qi = 0; qi < q.length; qi++) {
            const v = q[qi];
            for (const e of tAdj[v]) {
              const u = eu[e] === v ? ev[e] : eu[e];
              if (!Number.isNaN(gain[u])) continue;
              const len = Math.hypot(vx[u] - vx[v], vy[u] - vy[v]);
              gain[u] = gain[v] + (cnt[e] > 1 ? len : -len);
              from[u] = e;
              q.push(u);
              if ((isOdd[u] || (pinned >= 0 && oddList.length === 0)) && gain[u] > best.gain)
                best = { gain: gain[u], a: a0, b: u };
            }
          }
          // keep the parent chain for the best b found from this a
          if (best.a === a0) best.from = Int32Array.from(from);
        }
        if (best.a !== undefined && best.gain > -Infinity) {
          let v = best.b;
          while (v !== best.a) {
            const e = best.from[v];
            cnt[e] = cnt[e] > 1 ? 1 : 2;
            v = eu[e] === v ? ev[e] : eu[e];
          }
          walkStart = best.b;
          ends = [best.a, best.b]; // Hierholzer's pop order runs backwards, so start from b to begin at a
        }
      }
    }
    return { E, adj, cnt, walkStart, ends };
  }
  // 6. The order the line runs.
  function walkTour(G, D, open) {
    const { vx, vy, eu, ev, ej } = G,
      V = G.V,
      { E, adj, cnt, walkStart, ends } = D;
    // The order the line runs: a non-crossing tour. At every point the strokes leaving it are sorted by angle and only
    // neighbouring strands are joined (each pair turns from one stroke into the next one round), so the line can never
    // cross itself at a junction. Of the two ways to pair neighbours at a point, the one that runs straightest is used
    // (never turning back on the same stroke except at its end). That can leave several separate loops; two loops
    // meeting
    // at a point are joined by swapping one pair of neighbouring strands there, which also never makes a crossing.
    // Falls back to Hierholzer (straightest continuation) if the loops can't all be joined.
    const tour = (() => {
      const qE = []; // edge copies: each doubled edge is two copies
      for (let e = 0; e < E; e++) for (let c = 0; c < cnt[e]; c++) qE.push(e);
      // open path: a virtual edge from b back to a closes the tour, then is cut
      const virt = open && ends ? qE.length : -1;
      if (virt >= 0) qE.push(-1);
      const nQ = qE.length,
        endV = (x) => {
          const q = x >> 1,
            e = qE[q];
          if (e < 0) return x & 1 ? ends[0] : ends[1];
          return x & 1 ? ev[e] : eu[e];
        };
      const ang = new Float64Array(2 * nQ),
        at = Array.from({ length: V }, () => []);
      for (let x = 0; x < 2 * nQ; x++) {
        const v = endV(x),
          u = endV(x ^ 1);
        ang[x] = Math.atan2(vy[u] - vy[v], vx[u] - vx[v]);
        at[v].push(x);
      }
      const partner = new Int32Array(2 * nQ).fill(-1);
      for (let v = 0; v < V; v++) {
        const L = at[v];
        if (!L.length) continue;
        // Copies of one edge leave at the same angle. Seen from the edge's other end the turn order runs the other way,
        // so
        // the copies are ordered one way at its first end and reversed at its second: each copy then keeps to one side.
        L.sort(
          (p, q) =>
            ang[p] - ang[q] ||
            (qE[p >> 1] === qE[q >> 1] && qE[p >> 1] >= 0 ? (p & 1 ? (q >> 1) - (p >> 1) : (p >> 1) - (q >> 1)) : p - q)
        );
        if (L.length & 1) return null;
        let bestO = 0,
          bestC = Infinity;
        for (let o = 0; o < 2 && L.length > 2; o++) {
          let c = 0;
          for (let i = o; i < L.length + o; i += 2) {
            const p = L[i % L.length],
              q = L[(i + 1) % L.length];
            c += qE[p >> 1] >= 0 && qE[p >> 1] === qE[q >> 1] ? 3 : 1 + Math.cos(ang[p] - ang[q]);
          }
          if (c < bestC) {
            bestC = c;
            bestO = o;
          }
        }
        for (let i = bestO; i < L.length + bestO; i += 2) {
          const p = L[i % L.length],
            q = L[(i + 1) % L.length];
          partner[p] = q;
          partner[q] = p;
        }
      }
      // label the loops the pairing makes
      const loopOf = new Int32Array(2 * nQ),
        label = () => {
          loopOf.fill(-1);
          let n = 0;
          for (let x0 = 0; x0 < 2 * nQ; x0++) {
            if (loopOf[x0] >= 0) continue;
            for (let x = x0; loopOf[x] < 0; ) {
              loopOf[x] = n;
              const y = x ^ 1;
              loopOf[y] = n;
              x = partner[y];
            }
            n++;
          }
          return n;
        };
      let loops = label();
      for (let pass = 0; loops > 1 && pass < 200; pass++) {
        const { parent: uf, find } = makeUF(loops);
        let merged = 0;
        for (const strict of [true, false]) {
          // first only swaps that keep every pair on two different strokes; a same-stroke pair turns back mid-stroke
          for (let v = 0; v < V; v++) {
            const L = at[v];
            if (L.length < 4) continue;
            for (let i = 0; i < L.length; i++) {
              const p = L[i],
                q = L[(i + 1) % L.length];
              if (partner[p] === q) continue;
              if (strict && qE[p >> 1] === qE[q >> 1]) continue;
              const a = find(loopOf[p]),
                b = find(loopOf[q]);
              if (a === b) continue;
              const pp = partner[p],
                qq = partner[q];
              // nor leave the old partners turning back on one stroke
              if (strict && qE[pp >> 1] === qE[qq >> 1]) continue;
              partner[p] = q;
              partner[q] = p;
              partner[pp] = qq;
              partner[qq] = pp;
              uf[a] = b;
              merged++;
              break; // one swap per point per pass, then re-label
            }
          }
          if (merged) break;
        }
        if (!merged) return null;
        loops = label();
      }
      if (loops > 1) return null;
      // walk it: from the start point (open: the end after the virtual edge), leaving by one of its strands
      // the virtual edge runs b → a (end 2·virt at b, 2·virt + 1 at a): the path leaves a by the strand paired with it
      const x0 = virt >= 0 ? partner[2 * virt + 1] : at[walkStart].length ? at[walkStart][0] : 0;
      // Which side of its stroke each strand sits on: at every point the line turns from one stroke (arriving end y)
      // into
      // the neighbouring one (leaving end x), round the empty corner between them, so the strand belongs in that
      // corner.
      // Ends are sorted clockwise on screen, so if x is next after y the corner is on the left of travel, otherwise the
      // right. A turn back on the same stroke (a stroke's end) says nothing; the loop there takes care of it.
      const pos = new Int32Array(2 * nQ);
      for (let v = 0; v < V; v++) at[v].forEach((x, i) => (pos[x] = i));
      const turn = (y, x) => {
        if (y < 0 || qE[y >> 1] === qE[x >> 1]) return 0;
        const L = at[endV(x)];
        return L[(pos[y] + 1) % L.length] === x ? 1 : -1;
      };
      const out = [],
        flags = [];
      for (let x = x0, prevY = virt >= 0 ? 2 * virt + 1 : -1, guard = 0; guard <= nQ; guard++) {
        const q = x >> 1,
          e = qE[q],
          v = endV(x),
          y = x ^ 1;
        if (e < 0) break; // open path: stop at the virtual edge
        out.push([v, e]);
        flags.push(virt >= 0 && prevY === 2 * virt + 1 && out.length === 1 ? 0 : turn(prevY, x));
        prevY = y;
        x = partner[y];
        if (x === x0) {
          flags[0] = turn(y, x0);
          out.push([endV(y), -1]);
          break;
        } // closing the loop: the start point's own corner
        if (qE[x >> 1] < 0) {
          out.push([endV(y), -1]);
          break;
        }
      }
      flags.push(0);
      return out.length === nQ - (virt >= 0 ? 1 : 0) + 1 ? { circ: out, flags } : null;
    })();
    let circ = tour && tour.circ;
    if (!circ) {
      const rem = Uint8Array.from(cnt),
        stack = [[walkStart, -1]];
      circ = [];
      while (stack.length) {
        const top = stack[stack.length - 1],
          v = top[0];
        let bestE = -1,
          bestS = -Infinity;
        let ax = 0,
          ay = 0;
        if (stack.length > 1) {
          const pv = stack[stack.length - 2][0];
          ax = vx[v] - vx[pv];
          ay = vy[v] - vy[pv];
          const l = Math.hypot(ax, ay) || 1;
          ax /= l;
          ay /= l;
        }
        for (const e of adj[v]) {
          if (!rem[e]) continue;
          const u = eu[e] === v ? ev[e] : eu[e];
          let dx = vx[u] - vx[v],
            dy = vy[u] - vy[v];
          const l = Math.hypot(dx, dy) || 1;
          const s = (ax * dx) / l + (ay * dy) / l - (ej[e] ? 0.01 : 0);
          if (s > bestS) {
            bestS = s;
            bestE = e;
          }
        }
        if (bestE < 0) {
          circ.push(top);
          stack.pop();
          continue;
        }
        rem[bestE]--;
        stack.push([eu[bestE] === v ? ev[bestE] : eu[bestE], bestE]);
      }
    }
    return { tour, circ };
  }
  // One continuous closed walk over every line pixel
  // Pixel graph → components → MST of jumps between components → T-join doubling → Euler circuit.
  // opt: minPix (drop pieces under this many px), maxJump (px: pieces further apart are separate groups; 0 = join
  // all), farShare (a far group is kept when its line is ≥ this × the biggest group's), open (an open path: start and
  // end at stroke ends), startAt ([x, y] px), jumpCost (× length: price of a straight connector vs retracing line),
  // pairReach / lineReach (px: how far odd vertices look for a partner, straight / along the line), lanes (mask:
  // connectors route through it), laneCost. Returns px, py and per-point tags (dbl doubled, jmp connector, side, grp,
  // jid / jd nearest junction, tip stroke end), plus mask, edt, nParts, dropped, jumpLen, doubledFrac, bbox, linePix.
  // Slow on big line maps: the connector searches are shortest-route (Dijkstra) runs over the pixel graph.
  UNB.buildWalk = function (lines, w, h, opt) {
    const open = !!opt.open,
      N = w * h;
    const R = walkRouter(w, h, opt);
    const P = walkParts(lines, w, h, opt, R);
    if (!P) return null;
    const G = walkGraph(lines, w, h, P),
      toggled = walkPairEnds(G, w, h, opt, R);
    const D = walkDouble(G, P, w, opt, toggled);
    if (!D) return null;
    const { tour, circ } = walkTour(G, D, open);
    // 7. The walk's points, and what each one is (doubled, connector, side, stroke end, nearest junction)
    const { vx, vy, eu, ev, ej, V0 } = G,
      V = G.V,
      { E, adj, cnt, ends } = D,
      { keepComp, dropped } = P,
      jumpLen = G.jumpLen;
    const m = circ.length;
    const px = new Float64Array(m),
      py = new Float64Array(m),
      dbl = new Uint8Array(m),
      jmp = new Uint8Array(m);
    const side = new Int8Array(m),
      first = new Int8Array(E); // which side each retraced pass sits on
    for (let i = 0; i < m; i++) {
      px[i] = vx[circ[i][0]];
      py[i] = vy[circ[i][0]];
      const e = circ[i][1]; // edge from point i to point i+1
      if (e < 0) continue;
      dbl[i] = cnt[e] > 1 ? 1 : 0;
      jmp[i] = ej[e];
      if (tour) {
        side[i] = tour.flags[i] || tour.flags[i + 1] || 1;
        continue;
      } // the corner the strand turns round (single strokes too: used at junctions)
      if (!dbl[i]) continue;
      const fwd = circ[i][0] === eu[e] ? 1 : -1; // travel direction along the edge
      if (!first[e]) {
        first[e] = fwd;
        side[i] = 1;
      } else side[i] = first[e] === fwd ? -1 : 1;
    }
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (let k = 0; k < V0; k++) {
      minX = Math.min(minX, vx[k]);
      maxX = Math.max(maxX, vx[k]);
      minY = Math.min(minY, vy[k]);
      maxY = Math.max(maxY, vy[k]);
    }
    const keptMask = new Uint8Array(N);
    for (let k = 0; k < V0; k++) keptMask[vy[k] * w + vx[k]] = 1;
    const lineEdt = UNB.edt(keptMask, w, h);
    let doubled = 0;
    for (let i = 0; i < m; i++) doubled += dbl[i];
    // Turn-backs: where the walk arrives at a point and leaves straight back the way it came (the end of a stroke it
    // has to go out and back along). The needle can't retrace, so each of these gets a loop (see offsetDoubled).
    const tip = new Uint8Array(m),
      wrap = !(open && ends) && m > 2 && circ[0][0] === circ[m - 1][0];
    for (let i = 0; i < m - (wrap ? 1 : 0); i++) {
      const a = i > 0 ? i - 1 : wrap ? m - 2 : -1,
        b = i + 1;
      if (a >= 0 && b < m && circ[a][0] === circ[b][0] && circ[a][0] !== circ[i][0]) tip[i] = 1;
    }
    const { find: gfind, union: gunion } = makeUF(V);
    for (let e = 0; e < E; e++) if (cnt[e] > 1) gunion(eu[e], ev[e]);
    const grp = new Int32Array(m).fill(-1);
    for (let i = 0; i < m; i++) {
      const e = circ[i][1];
      if (e >= 0 && cnt[e] > 1) grp[i] = gfind(eu[e]);
    }
    // Junctions: where three or more strokes meet (including where a connector joins). Strokes near the same
    // junction are meant to touch there, so spacing must not push them apart. Label every vertex within JR px
    // (along the line) with its nearest junction and the distance to it. JR must cover twice the largest strand
    // spacing used later (offsetDoubled eases single strokes over 2d; the infill keeps 2d clear): small prints on a
    // fine working image reach d ≈ 60 px, so 160 px leaves room. (It was 40: past d = 20 px the ease was cut off
    // short and the line kinked beside the junction.) The walk records it as walk.jr.
    const JR = 160,
      jidV = new Int32Array(V).fill(-1),
      jdV = new Float32Array(V).fill(Infinity),
      jq = [];
    for (let v = 0; v < V; v++)
      if (adj[v].length >= 3) {
        jidV[v] = v;
        jdV[v] = 0;
        jq.push(v);
      }
    for (let qi = 0; qi < jq.length; qi++) {
      // Bellman-style relaxation on a small radius
      const v = jq[qi];
      for (const e of adj[v]) {
        const u = eu[e] === v ? ev[e] : eu[e],
          nd = jdV[v] + Math.hypot(vx[u] - vx[v], vy[u] - vy[v]);
        if (nd < jdV[u] && nd <= JR) {
          jdV[u] = nd;
          jidV[u] = jidV[v];
          jq.push(u);
        }
      }
    }
    const jid = new Int32Array(m),
      jd = new Float32Array(m);
    for (let i = 0; i < m; i++) {
      const v = circ[i][0];
      jid[i] = jidV[v];
      jd[i] = jdV[v];
    }
    return {
      px,
      py,
      dbl,
      jmp,
      side,
      grp,
      jid,
      jd,
      jr: JR,
      tip,
      open: open && !!ends,
      mask: keptMask,
      edt: lineEdt,
      nParts: [...keepComp].reduce((a, b) => a + b, 0),
      dropped,
      jumpLen,
      doubledFrac: doubled / Math.max(1, m - 1),
      bbox: { minX, minY, maxX, maxY },
      linePix: V0,
    };
  };

  // Round the drawing's own corners to a radius of at least R working px, so the needle never turns sharper than that.
  // Only drawn corners: the walk is split at junctions (jd = 0), stroke ends (tip) and connectors (jmp), and those
  // points stay put, so loops, junction spacing and jumps keep their shape. Along each run between them, a corner is
  // where the line turns more than ~30° over a chord of R (a local maximum); its two sides are joined by a cubic curve
  // close to a circular arc of radius R (tangent length R·tan(θ/2), shortened when the run is too short or the next
  // corner is near). Points keep their count and order, so every per-point tag still applies; the out and back passes
  // of a doubled stroke are rounded the same way, so their strands stay parallel.
  UNB.roundCorners = function (walk, R) {
    const m = walk.px.length;
    if (!(R > 0) || m < 5) return walk;
    const wrap = !walk.open && m > 2 && walk.px[0] === walk.px[m - 1] && walk.py[0] === walk.py[m - 1],
      n = wrap ? m - 1 : m;
    const tip = walk.tip,
      jd = walk.jd,
      jmp = walk.jmp;
    const fixed = (i) =>
      (tip && tip[i]) || (jd && jd[i] === 0) || (jmp && (jmp[i] || (i > 0 ? jmp[i - 1] : wrap && jmp[n - 1])));
    // runs of indices between fixed points (circular on a closed walk)
    const anchors = [];
    for (let i = 0; i < n; i++) if (fixed(i)) anchors.push(i);
    const runs = [];
    if (!anchors.length) {
      if (wrap) runs.push({ idx: [...Array(n).keys(), 0], loop: true });
      else runs.push({ idx: [...Array(n).keys()] });
    } else if (wrap)
      for (let a = 0; a < anchors.length; a++) {
        const i0 = anchors[a],
          i1 = anchors[(a + 1) % anchors.length],
          idx = [];
        for (let k = i0; ; k = (k + 1) % n) {
          idx.push(k);
          if (k === i1 && idx.length > 1) break;
        }
        runs.push({ idx });
      }
    else {
      const cut = [0, ...anchors.filter((i) => i > 0 && i < n - 1), n - 1];
      for (let a = 0; a + 1 < cut.length; a++) {
        const idx = [];
        for (let k = cut[a]; k <= cut[a + 1]; k++) idx.push(k);
        runs.push({ idx });
      }
    }
    const c = Math.max(2, R),
      TH = 0.5;
    const unit = (a, b) => {
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        l = Math.hypot(dx, dy);
      return l > 1e-9 ? [dx / l, dy / l] : null;
    };
    const angle = (u, v) => Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1])));
    const ox = walk.px,
      oy = walk.py; // where the drawing was: no point ends up more than R from it
    const pass = (px, py) => {
      // one rounding pass over every run; reads px/py, returns new arrays
      const x = Float64Array.from(px),
        y = Float64Array.from(py);
      for (const run of runs) {
        const idx = run.idx,
          L = idx.length;
        if (L < 5) continue;
        const S = new Float64Array(L);
        for (let j = 1; j < L; j++)
          S[j] = S[j - 1] + Math.hypot(px[idx[j]] - px[idx[j - 1]], py[idx[j]] - py[idx[j - 1]]);
        const total = S[L - 1];
        if (total < 2 * c) continue;
        const clampS = (s) => (run.loop ? ((s % total) + total) % total : Math.min(Math.max(s, 0), total));
        const at = (s) => {
          // point at arc length s along the run
          s = clampS(s);
          let lo = 0,
            hi = L - 1;
          while (hi - lo > 1) {
            const mid = (lo + hi) >> 1;
            if (S[mid] <= s) lo = mid;
            else hi = mid;
          }
          const t = S[hi] > S[lo] ? (s - S[lo]) / (S[hi] - S[lo]) : 0;
          return [px[idx[lo]] + t * (px[idx[hi]] - px[idx[lo]]), py[idx[lo]] + t * (py[idx[hi]] - py[idx[lo]])];
        };
        // The turn over chords of R/3, R, 2R and 3R. At a corner the turn is concentrated: about the same over the
        // short
        // chord as over R (a sharp corner), or the same over R, 2R and 3R (a corner already slightly rounded). Along a
        // smooth curve the turn grows with the chord, and smooth curves (a small circle, say) are left as drawn.
        const turn = new Float64Array(L),
          cs = Math.max(1.5, c / 3);
        const turnOver = (s, p, h) => {
          const u = unit(at(s - h), p),
            v = unit(p, at(s + h));
          return u && v ? angle(u, v) : 0;
        };
        for (let j = 0; j < L; j++) {
          const s = S[j];
          if (!run.loop && (s < c * 0.5 || s > total - c * 0.5)) continue;
          const p = [px[idx[j]], py[idx[j]]],
            t = turnOver(s, p, c);
          if (t < TH) continue;
          const tS = turnOver(s, p, cs),
            t2 = turnOver(s, p, 2 * c),
            t3 = turnOver(s, p, 3 * c);
          if (tS >= 0.6 * t || (t >= 0.75 * t3 && t2 <= 1.3 * t && t3 <= 1.3 * t)) turn[j] = t;
        }
        const peaks = [];
        for (let j = 0; j < L; j++) {
          if (turn[j] < TH) continue;
          let best = true;
          for (let k = j - 1; k >= 0 && S[j] - S[k] < c && best; k--) if (turn[k] > turn[j]) best = false;
          for (let k = j + 1; k < L && S[k] - S[j] < c && best; k++) if (turn[k] >= turn[j]) best = false;
          if (best) peaks.push(j);
        }
        peaks.sort((p, q) => turn[q] - turn[p] || S[p] - S[q]);
        const used = []; // [s0, s1] spans already rounded
        for (const j of peaks) {
          // centre the curve on the middle of the turn (a corner drawn with a small bevel turns over a few points)
          let sw = 0,
            sx = 0;
          for (let k = 0; k < L; k++) {
            let ds = S[k] - S[j];
            if (run.loop) {
              if (ds > total / 2) ds -= total;
              else if (ds < -total / 2) ds += total;
            }
            if (Math.abs(ds) < c && turn[k] >= 0.7 * turn[j]) {
              sw += turn[k];
              sx += turn[k] * ds;
            }
          }
          const s = run.loop ? clampS(S[j] + sx / sw) : S[j] + sx / sw;
          let cap = run.loop ? 0.45 * total : Math.min(0.45 * s, 0.45 * (total - s));
          for (const [u0, u1] of used) {
            if (u1 <= s) cap = Math.min(cap, 0.95 * (s - u1));
            else if (u0 >= s) cap = Math.min(cap, 0.95 * (u0 - s));
            else cap = 0;
          }
          // tangent length T for radius R; the sides are read just outside the curve, so T and the turn agree. The
          // curve
          // may move no point of the line more than R: very sharp corners and narrow hairpins get a tighter radius
          // rather
          // than being cut back, and a corner never cuts across a nearby part of the drawing (a 90° corner moves 0.41
          // R).
          const bez = (A, P1, P2, B, t) => {
            const u = 1 - t;
            return [
              u * u * u * A[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * B[0],
              u * u * u * A[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * B[1],
            ];
          };
          let th = turn[j],
            T = Math.min(R * Math.tan(Math.min(th, 2.8) / 2), cap),
            dA = null,
            dB = null,
            A,
            B,
            P1,
            P2,
            ok = false;
          for (let it = 0; it < 40 && T >= 0.75; it++) {
            const g = Math.max(1.5, Math.min(c, T));
            dA = unit(at(s - T - g), at(s - T));
            dB = unit(at(s + T), at(s + T + g));
            if (!dA || !dB) {
              T = 0;
              break;
            }
            th = angle(dA, dB);
            const want = Math.min(R * Math.tan(Math.min(th, 2.8) / 2), cap);
            if (it < 2 && Math.abs(want - T) > 0.05 * T) {
              T = want;
              continue;
            } // settle T against the turn first
            A = at(s - T);
            B = at(s + T);
            const chord = Math.hypot(B[0] - A[0], B[1] - A[1]),
              r = chord / (2 * Math.sin(Math.max(th, 0.15) / 2)),
              Lh = (4 / 3) * Math.tan(th / 4) * r; // the arc through A and B along dA and dB
            P1 = [A[0] + dA[0] * Lh, A[1] + dA[1] * Lh];
            P2 = [B[0] - dB[0] * Lh, B[1] - dB[1] * Lh];
            let far = 0; // furthest any point of this stretch would end up from the drawing
            for (let k = 0; k < L && far <= R; k++) {
              let ds = S[k] - s;
              if (run.loop) {
                if (ds > total / 2) ds -= total;
                else if (ds < -total / 2) ds += total;
              }
              if (ds <= -T || ds >= T) continue;
              const q = bez(A, P1, P2, B, (ds + T) / (2 * T));
              far = Math.max(far, Math.hypot(q[0] - ox[idx[k]], q[1] - oy[idx[k]]));
            }
            if (far <= R) {
              ok = true;
              break;
            }
            T *= 0.93;
          }
          if (!ok || th < 0.15) continue;
          for (let k = 0; k < L; k++) {
            let ds = S[k] - s;
            if (run.loop) {
              if (ds > total / 2) ds -= total;
              else if (ds < -total / 2) ds += total;
            }
            if (ds <= -T || ds >= T) continue;
            const q = bez(A, P1, P2, B, (ds + T) / (2 * T)),
              i = idx[k];
            x[i] = q[0];
            y[i] = q[1];
          }
          used.push([s - T, s + T]);
        }
      }
      if (wrap) {
        x[m - 1] = x[0];
        y[m - 1] = y[0];
      }
      return [x, y];
    };
    let [x, y] = pass(walk.px, walk.py);
    [x, y] = pass(x, y); // a second pass catches what the first left tight (corners that were capped by a neighbour)
    return Object.assign({}, walk, { px: x, py: y });
  };

  // Out-and-back strokes, printable without retracing. The needle can't go back over its own line, so a stroke the
  // walk has to travel twice becomes two strands one spacing d apart (each d/2 off the traced centre), and every
  // turn-back at a stroke's end becomes a keyhole loop:
  //   · loop: a circle of radius r = loop × d (default 1 × d) around C;
  //   · C sits r + w/2 back from the stroke's end E, so the chocolate's outer edge lands on E (w = line width);
  //   · the strands (offset d/2) meet the circle where r·sin α = d/2, α = asin(d / 2r), and the line runs round the far
  //     side through 360° − 2α (300° at r = d); the loop is 2r + w wide;
  //   · it needs r + w/2 + r·cos α of stroke; on shorter stubs r shrinks, down to d/2 (a plain half-circle turn).
  // r ≥ d/2 keeps the inner chocolate edges at least the gap apart round the turn (inner radius r − w/2 ≥ (d − w)/2).
  // opt: { w: line width px (default 0.6 d), loop: r ÷ d (default 1) }. Returns x, y and idx (the walk point each came
  // from).
  UNB.offsetDoubled = function (walk, d, opt) {
    const { px, py, dbl, side } = walk,
      m = px.length,
      o = opt || {};
    const ox = Float64Array.from(px),
      oy = Float64Array.from(py);
    const same = () => ({ x: ox, y: oy, idx: Int32Array.from({ length: m }, (_, i) => i) });
    if (d <= 0) return same();
    const K = 3;
    // a closed walk's last point is its first: both see the edges either side of the seam
    const closedW = !walk.open && m > 2;
    for (let i = 0; i < m; i++) {
      const next = i < m - 1 ? i : closedW ? 0 : -1,
        prev = i > 0 ? i - 1 : closedW ? m - 2 : -1;
      const sg = (next >= 0 && dbl[next] ? side[next] : 0) + (prev >= 0 && dbl[prev] ? side[prev] : 0);
      if (!sg) continue;
      const sgn = Math.sign(sg);
      const P = m - 1,
        // round the seam on a closed walk
        wrapAt = (j) => (closedW ? ((j % P) + P) % P : Math.max(0, Math.min(m - 1, j)));
      const a = wrapAt(i - K),
        b = wrapAt(i + K);
      let dx = px[b] - px[a],
        dy = py[b] - py[a];
      const l = Math.hypot(dx, dy);
      if (!l) continue;
      dx /= l;
      dy /= l;
      ox[i] = px[i] + (sgn * dy * d) / 2;
      oy[i] = py[i] - (sgn * dx * d) / 2; // left normal (y-down), flipped for same-direction repeats
    }
    // Single strokes at a junction: a stroke drawn once runs down its own centre, so two of them meeting at a junction
    // would touch there. Within `ease` of a junction (along the line) each one moves into the corner it turns round, by
    // up to d/2 at the junction itself, easing back to its centre further out. The corner is the one recorded at the
    // junction point, on the same side of travel all the way in and out.
    if (o.loops && walk.jd) {
      // ease over 2d, but never past the reach the junction distances were recorded to (walk.jr)
      const ease = Math.min(2 * d, walk.jr || 40),
        jd = walk.jd,
        single = (i) => !dbl[i] && !(i > 0 && dbl[i - 1]);
      for (let i = 0; i < m; i++) {
        if (!single(i) || !(jd[i] < ease)) continue;
        let kj = -1; // the junction point this one is nearest to, along the walk
        for (let r = 0; r <= ease + 2 && kj < 0; r++)
          for (const k of [i - r, i + r])
            if (k >= 0 && k < m && jd[k] === 0) {
              kj = k;
              break;
            }
        if (kj < 0) continue;
        const sgn = Math.sign(side[kj] || 1),
          t = 1 - jd[i] / ease,
          wgt = t * t * (3 - 2 * t); // smooth ease
        const a = Math.max(0, i - K),
          b = Math.min(m - 1, i + K);
        let dx = px[b] - px[a],
          dy = py[b] - py[a];
        const l = Math.hypot(dx, dy);
        if (!l) continue;
        dx /= l;
        dy /= l;
        ox[i] = px[i] + ((sgn * dy * d) / 2) * wgt;
        oy[i] = py[i] - ((sgn * dx * d) / 2) * wgt;
      }
    }
    const tip = walk.tip;
    // loops: true from stageSignal; plain offsets otherwise
    if (!tip || !o.loops) return o.loops ? UNB.cutSwallowtails(same(), 10 * d, !walk.open) : same();
    const wrap = !walk.open && m > 2 && px[0] === px[m - 1] && py[0] === py[m - 1],
      n = wrap ? m - 1 : m;
    const at = (k) => (wrap ? ((k % n) + n) % n : k),
      ok = (k) => wrap || (k >= 0 && k < n);
    const w = o.w > 0 ? o.w : 0.6 * d,
      r0 = (o.loop > 0 ? o.loop : 1) * d;
    const drop = new Uint8Array(m),
      arcAt = new Map();
    for (let i = 0; i < n; i++) {
      if (!tip[i]) continue;
      // how far the out pass (before i) and the return pass (after i) run along this stroke, up to what the loop needs
      const need = r0 + w / 2 + r0 + 4,
        outS = [],
        retS = [];
      // (never past the nearest junction: a loop on a short stub must not reach back over the strokes it hangs from)
      const jn = (k) => walk.jd && walk.jd[k] === 0;
      for (let s = 0, k = i; ok(k - 1) && dbl[at(k - 1)] && !tip[at(k - 1)] && !jn(at(k - 1)) && s < need; k--) {
        s += Math.hypot(px[at(k)] - px[at(k - 1)], py[at(k)] - py[at(k - 1)]);
        outS.push([at(k - 1), s]);
      }
      for (let s = 0, k = i; ok(k + 1) && dbl[at(k)] && !tip[at(k + 1)] && !jn(at(k + 1)) && s < need; k++) {
        s += Math.hypot(px[at(k + 1)] - px[at(k)], py[at(k + 1)] - py[at(k)]);
        retS.push([at(k + 1), s]);
      }
      const L = Math.min(outS.length ? outS[outS.length - 1][1] : 0, retS.length ? retS[retS.length - 1][1] : 0);
      if (L < 1.5) continue;
      const span = (r) => r + w / 2 + Math.sqrt(Math.max(0, r * r - (d * d) / 4)); // stroke a loop of radius r uses
      let r = r0;
      if (span(r) > 0.85 * L) {
        let lo = d / 2,
          hi = r0;
        for (let it = 0; it < 30; it++) {
          const mid = (lo + hi) / 2;
          if (span(mid) > 0.85 * L) hi = mid;
          else lo = mid;
        }
        r = lo;
      }
      const ca = Math.sqrt(Math.max(0, r * r - (d * d) / 4)) / r,
        sa = Math.min(1, d / (2 * r)),
        al = Math.asin(sa);
      const cut = Math.max(0, Math.min(r + w / 2, 0.85 * L - r * ca)),
        neck = cut + r * ca;
      // stroke direction t (towards the end) from the centerline a little way back, and which side the out strand is on
      const back = outS.find(([, s]) => s >= Math.min(L, cut + r)) || outS[outS.length - 1];
      let tx = px[i] - px[back[0]],
        ty = py[i] - py[back[0]];
      const tl = Math.hypot(tx, ty);
      if (!tl) continue;
      tx /= tl;
      ty /= tl;
      const nx = ty,
        ny = -tx; // left normal of t (y-down)
      const ref = outS.find(([, s]) => s >= neck) || outS[outS.length - 1];
      const sigma = (ox[ref[0]] - px[ref[0]]) * nx + (oy[ref[0]] - py[ref[0]]) * ny < 0 ? -1 : 1;
      const cx = px[i] - cut * tx,
        cy = py[i] - cut * ty;
      for (const [k, s] of outS) if (s < neck) drop[k] = 1;
      for (const [k, s] of retS) if (s < neck) drop[k] = 1;
      const sweep = 2 * Math.PI - 2 * al,
        steps = Math.max(10, Math.ceil((r * sweep) / 0.5));
      const arc = [];
      for (let q = 0; q <= steps; q++) {
        // from the out strand's side, round the far end, to the return side
        const th = Math.PI - al - (sweep * q) / steps;
        arc.push([
          cx + r * (Math.cos(th) * tx + sigma * Math.sin(th) * nx),
          cy + r * (Math.cos(th) * ty + sigma * Math.sin(th) * ny),
        ]);
      }
      arcAt.set(i, arc);
      drop[i] = 1;
    }
    const X = [],
      Y = [],
      I = [];
    for (let k = 0; k < n; k++) {
      if (arcAt.has(k))
        for (const [x, y] of arcAt.get(k)) {
          X.push(x);
          Y.push(y);
          I.push(k);
        }
      else if (!drop[k]) {
        X.push(ox[k]);
        Y.push(oy[k]);
        I.push(k);
      }
    }
    if (wrap) {
      X.push(X[0]);
      Y.push(Y[0]);
      I.push(I[0]);
    }
    return UNB.cutSwallowtails(
      { x: Float64Array.from(X), y: Float64Array.from(Y), idx: Int32Array.from(I) },
      10 * d,
      !walk.open
    );
  };
  // On the inside of a sharp bend an offset strand folds over itself in a small loop (a "swallowtail"). Where the line
  // crosses itself within `reach` of its own length, cut the loop out at the crossing point. The walk itself never
  // crosses
  // (see the tour in buildWalk), so a short self-crossing in the offset path is always such a fold (10 spacings covers
  // the
  // long ones in narrow corners; a stroke-end loop never crosses itself).
  UNB.cutSwallowtails = function (p, reach, closed) {
    for (let round = 0; round < 4; round++) {
      const xs = UNB.findCrossings(p.x, p.y, closed),
        n = p.x.length,
        cut = new Uint8Array(n),
        at = new Map();
      let cuts = 0;
      xs.sort((a, b) => a[0] - b[0]);
      for (const [a, b, , cx, cy] of xs) {
        if (b - a > 4 * reach + 8) continue;
        let len = 0;
        for (let k = a; k < b && len <= reach; k++) len += Math.hypot(p.x[k + 1] - p.x[k], p.y[k + 1] - p.y[k]);
        if (len > reach) continue;
        let busy = false;
        for (let k = a + 1; k <= b; k++)
          if (cut[k]) {
            busy = true;
            break;
          }
        if (busy) continue;
        for (let k = a + 1; k <= b; k++) cut[k] = 1;
        at.set(a, [cx, cy, p.idx[a]]);
        cuts++;
      }
      if (!cuts) return p;
      const X = [],
        Y = [],
        I = [];
      for (let k = 0; k < n; k++) {
        if (!cut[k]) {
          X.push(p.x[k]);
          Y.push(p.y[k]);
          I.push(p.idx[k]);
        }
        if (at.has(k)) {
          const [cx, cy, ik] = at.get(k);
          X.push(cx);
          Y.push(cy);
          I.push(ik);
        }
      }
      p = { x: Float64Array.from(X), y: Float64Array.from(Y), idx: Int32Array.from(I) };
    }
    return p;
  };

  // An open path walked there-and-back: periodic and continuous, so its Fourier series has no seam.
  UNB.mirror = function (x, y) {
    const m = x.length;
    if (m < 2) return { x: Float64Array.from(x), y: Float64Array.from(y) }; // nothing to walk back along
    const n = 2 * m - 2,
      ox = new Float64Array(n),
      oy = new Float64Array(n);
    for (let i = 0; i < m; i++) {
      ox[i] = x[i];
      oy[i] = y[i];
    }
    for (let i = 1; i < m - 1; i++) {
      ox[m - 1 + i] = x[m - 1 - i];
      oy[m - 1 + i] = y[m - 1 - i];
    }
    return { x: ox, y: oy };
  };

  // Gaussian smoothing (sigma sig, in points) of arr[a … b] in place; the two end points stay put.
  function smoothRun(arr, a, b, sig) {
    if (sig <= 0 || b - a < 2) return;
    const r = Math.ceil(3 * sig),
      k = [];
    for (let j = -r; j <= r; j++) k.push(Math.exp((-j * j) / (2 * sig * sig)));
    const src = arr.slice(a, b + 1),
      n = src.length;
    for (let i = 1; i < n - 1; i++) {
      let s = 0,
        ws = 0;
      const rr = Math.min(r, i, n - 1 - i);
      for (let j = -rr; j <= rr; j++) {
        s += src[i + j] * k[j + r];
        ws += k[j + r];
      }
      arr[a + i] = s / ws;
    }
  }

  // Subpixel line: move each traced point onto the middle of its ink stroke (or the peak of its edge)
  // The pixel walk follows whole pixels and the thinning step wanders up to ±1.5 px around the true middle of a stroke;
  // the Fourier series copies that as visible wobble. For each point we look across the line, find the run of ink
  // (or edge strength) it sits in, and move it to that run's centre. Only the run containing the point counts, so a
  // neighbouring stroke never pulls it over. Repeated a few times with the cross direction taken from the improving
  // line.
  UNB.snapWalk = function (walk, field, w, h, opt) {
    const o = Object.assign(
      { iters: 3, tsig: 2, tw: 4, R: 6, ssig: 1, clamp: 2, frac: 0.5, minContrast: 8 },
      opt || {}
    );
    const m = walk.px.length,
      x = Float64Array.from(walk.px),
      y = Float64Array.from(walk.py),
      x0 = Float64Array.from(walk.px),
      y0 = Float64Array.from(walk.py);
    const runs = [];
    let st = 0;
    for (let i = 0; i < m - 1; i++)
      if (walk.jmp[i]) {
        runs.push([st, i]);
        st = i + 1;
      }
    runs.push([st, m - 1]); // connectors stay straight
    const STEP = 0.25,
      K = Math.round(o.R / STEP),
      v = new Float64Array(2 * K + 1),
      sx = new Float64Array(m),
      sy = new Float64Array(m); // sx, sy: the smoothed run (only a … b is used)
    for (const [a, b] of runs) {
      if (b - a < 6) continue;
      const n = b - a + 1,
        sh = new Float64Array(n),
        ok = new Uint8Array(n),
        nx = new Float64Array(n),
        ny = new Float64Array(n);
      for (let it = 0; it < o.iters; it++) {
        sx.set(x.subarray(a, b + 1), a);
        sy.set(y.subarray(a, b + 1), a);
        smoothRun(sx, a, b, o.tsig);
        smoothRun(sy, a, b, o.tsig); // copy only this run
        sh.fill(0);
        ok.fill(0);
        for (let i = a; i <= b; i++) {
          const p = Math.max(a, i - o.tw),
            q = Math.min(b, i + o.tw);
          const tx = sx[q] - sx[p],
            ty = sy[q] - sy[p],
            l = Math.hypot(tx, ty) || 1;
          const ux = -ty / l,
            uy = tx / l;
          nx[i - a] = ux;
          ny[i - a] = uy;
          for (let j = -K; j <= K; j++) v[j + K] = bilinear(field, w, h, sx[i] + ux * j * STEP, sy[i] + uy * j * STEP);
          let pk = K;
          for (let j = K - 4; j <= K + 4; j++) if (v[j] > v[pk]) pk = j;
          let lo = Infinity;
          for (let j = 0; j <= 2 * K; j++) if (v[j] < lo) lo = v[j];
          if (v[pk] - lo < o.minContrast) continue; // no clear ink or edge here
          const thr = lo + o.frac * (v[pk] - lo);
          let s = pk,
            e = pk;
          while (s > 0 && v[s - 1] >= thr && v[s - 1] <= v[s] + 2) s--;
          while (e < 2 * K && v[e + 1] >= thr && v[e + 1] <= v[e] + 2) e++;
          if (s === 0 || e === 2 * K) continue; // wider than the window: leave the point
          let ws = 0,
            sm = 0;
          for (let j = s; j <= e; j++) {
            const wt = v[j] - thr;
            ws += wt;
            sm += wt * (j - K) * STEP;
          }
          if (ws > 1e-6) {
            sh[i - a] = sm / ws;
            ok[i - a] = 1;
          }
        }
        smoothRun(sh, 0, n - 1, o.ssig);
        for (let i = a + 1; i < b; i++) {
          if (!ok[i - a]) continue;
          let px = sx[i] + nx[i - a] * sh[i - a],
            py = sy[i] + ny[i - a] * sh[i - a];
          const dx = px - x0[i],
            dy = py - y0[i],
            dl = Math.hypot(dx, dy);
          if (dl > o.clamp) {
            px = x0[i] + (dx / dl) * o.clamp;
            py = y0[i] + (dy / dl) * o.clamp;
          }
          x[i] = px;
          y[i] = py;
        }
      }
    }
    return Object.assign({}, walk, { px: x, py: y });
  };

  // Hand edits to the traced line (the Edit line tool), applied to the walk once it is traced, so everything built
  // from it (the fitted line, the 2D pen line, the layers, G-code) follows them. ops, in working px, in the order made:
  //  · push { r, pts: [from], to }: points within r of `from` move by to − from, all the way at the centre, easing to
  //    nothing at r ((1 + cos πt) / 2). Both passes of an out-and-back stroke share their points, so they move together.
  //  · smooth { r, pts }: points within r of the brush's path move toward the average of their neighbours along the
  //    line (a Gaussian over about r / 2 of line each side), fully near the brush's middle, easing out at its edge.
  //  · straighten { r, pts }: each stretch of line under the brush becomes the straight line between the points just
  //    outside it.
  // Stroke ends (tip) and junctions (jd = 0) stay put under smooth and straighten and split the stretches, so loops and
  // junction spacing keep their shape; push moves them too (that's how a stroke end is dragged). Points keep their
  // count and order, so every per-point tag still applies. Returns a new walk with its bbox brought up to date.
  UNB.editWalk = function (walk, ops) {
    const m = walk.px.length;
    if (!ops || !ops.length || m < 2) return walk;
    const x = Float64Array.from(walk.px),
      y = Float64Array.from(walk.py),
      wrap = !walk.open && m > 2 && x[0] === x[m - 1] && y[0] === y[m - 1],
      n = wrap ? m - 1 : m; // a closed walk repeats its first point at the end: edit n points, then copy the seam
    const tip = walk.tip,
      jd = walk.jd,
      fixed = (i) => !!((tip && tip[i]) || (jd && jd[i] === 0));
    const next = (i) => (i + 1 < n ? i + 1 : wrap ? 0 : -1),
      prev = (i) => (i > 0 ? i - 1 : wrap ? n - 1 : -1);
    // distance from (px, py) to a brush path (a polyline, or one point)
    const toPath = (px, py, P) => {
      if (P.length === 1) return Math.hypot(px - P[0][0], py - P[0][1]);
      let best = Infinity;
      for (let k = 0; k + 1 < P.length; k++) {
        const [ax, ay] = P[k],
          [bx, by] = P[k + 1],
          dx = bx - ax,
          dy = by - ay,
          L = dx * dx + dy * dy,
          t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
        best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy));
      }
      return best;
    };
    // how strongly each point is under the brush: 1 at its middle, easing to 0 at r (0 outside)
    const reach = (op) => {
      const P = op.pts,
        r = op.r,
        a = new Float64Array(n);
      let x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity;
      for (const [px, py] of P) {
        x0 = Math.min(x0, px - r);
        y0 = Math.min(y0, py - r);
        x1 = Math.max(x1, px + r);
        y1 = Math.max(y1, py + r);
      }
      for (let i = 0; i < n; i++) {
        if (x[i] < x0 || x[i] > x1 || y[i] < y0 || y[i] > y1) continue;
        const t = toPath(x[i], y[i], P) / r;
        if (t < 1) a[i] = 0.5 + 0.5 * Math.cos(Math.PI * t);
      }
      return a;
    };
    for (const op of ops) {
      if (!op || !(op.r > 0) || !op.pts || !op.pts.length) continue;
      if (op.type === "push" && op.to) {
        const [fx, fy] = op.pts[0],
          dx = op.to[0] - fx,
          dy = op.to[1] - fy,
          a = reach({ pts: [[fx, fy]], r: op.r });
        for (let i = 0; i < n; i++)
          if (a[i]) {
            x[i] += a[i] * dx;
            y[i] += a[i] * dy;
          }
      } else if (op.type === "smooth") {
        const a = reach(op),
          sig = Math.max(1, op.r / 2),
          span = 3 * sig;
        for (let pass = 0; pass < 2; pass++) {
          const sx = Float64Array.from(x),
            sy = Float64Array.from(y);
          for (let i = 0; i < n; i++) {
            if (!a[i] || fixed(i)) continue;
            // a Gaussian average along the line, the same length of line each side: out to 3 sigma, or as far as the
            // nearer stroke end, junction or end of the walk (so a point never slides along the line towards one)
            // The line is treated as continuous (each piece of it weighted by its length), since the points along it
            // aren't evenly spaced: a long step next to a junction would otherwise count as little as a short one.
            const side = [next, prev].map((step) => {
              const seg = []; // [from, to, s at from, length]
              let j = i,
                s = 0;
              for (let k = 0; k < n && s < span; k++) {
                const q = step(j);
                if (q < 0 || q === i) break;
                const l = Math.hypot(sx[q] - sx[j], sy[q] - sy[j]);
                seg.push([j, q, s, l]);
                s += l;
                j = q;
                if (fixed(q)) break;
              }
              return { seg, end: Math.min(s, span) };
            });
            const L = Math.min(side[0].end, side[1].end);
            if (!(L > 0)) continue;
            let wx = 0,
              wy = 0,
              ws = 0;
            for (const { seg } of side)
              for (const [j, q, s0, l] of seg) {
                if (s0 >= L) break;
                const s1 = Math.min(s0 + l, L),
                  sm = (s0 + s1) / 2,
                  t = l > 0 ? (sm - s0) / l : 0,
                  wt = Math.exp((-0.5 * sm * sm) / (sig * sig)) * (s1 - s0);
                wx += wt * (sx[j] + t * (sx[q] - sx[j]));
                wy += wt * (sy[j] + t * (sy[q] - sy[j]));
                ws += wt;
              }
            if (!(ws > 0)) continue;
            x[i] = sx[i] + a[i] * (wx / ws - sx[i]);
            y[i] = sy[i] + a[i] * (wy / ws - sy[i]);
          }
        }
      } else if (op.type === "straighten") {
        const a = reach(op),
          on = (i) => a[i] > 0.05 && !fixed(i);
        // each run of points under the brush, between the points just outside it (or the walk's own ends)
        const seen = new Uint8Array(n);
        let start = 0;
        if (wrap) {
          start = -1;
          for (let i = 0; i < n; i++)
            if (!on(i)) {
              start = i;
              break;
            }
          if (start < 0) continue; // the whole loop under the brush: nothing to anchor a straight line to
        }
        for (let c = 0; c < n; c++) {
          const i = (start + c) % n;
          if (seen[i] || !on(i)) continue;
          const run = [];
          for (let j = i; j >= 0 && on(j) && !seen[j]; j = next(j)) {
            seen[j] = 1;
            run.push(j);
          }
          const pa = prev(run[0]),
            pb = next(run[run.length - 1]),
            A = pa >= 0 ? pa : run[0],
            B = pb >= 0 ? pb : run[run.length - 1];
          if (A === B) continue;
          const chain = [A, ...run.filter((j) => j !== A && j !== B), B],
            S = [0];
          for (let k = 1; k < chain.length; k++)
            S.push(S[k - 1] + Math.hypot(x[chain[k]] - x[chain[k - 1]], y[chain[k]] - y[chain[k - 1]]));
          const T = S[S.length - 1] || 1,
            ax = x[A],
            ay = y[A],
            bx = x[B],
            by = y[B];
          for (let k = 1; k + 1 < chain.length; k++) {
            const j = chain[k],
              t = S[k] / T;
            x[j] = ax + t * (bx - ax);
            y[j] = ay + t * (by - ay);
          }
        }
      }
    }
    if (wrap) {
      x[m - 1] = x[0];
      y[m - 1] = y[0];
    }
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (let i = 0; i < m; i++) {
      minX = Math.min(minX, x[i]);
      maxX = Math.max(maxX, x[i]);
      minY = Math.min(minY, y[i]);
      maxY = Math.max(maxY, y[i]);
    }
    return Object.assign({}, walk, { px: x, py: y, bbox: { minX, minY, maxX, maxY }, edited: ops.length });
  };
})(typeof window !== "undefined" ? window : globalThis);
