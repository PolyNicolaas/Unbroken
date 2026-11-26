/* Unbroken · engine · 19-relief.js
   18. Reliefs — a picture, a text or a pattern standing out from (or pressed into) a vase's wall, printed upright layer
   by layer. The source is a grey image (dark = ink); its style turns the greys into height (smooth, in steps, or flat
   shapes with a rounded edge), taps on its parts press one in or leave it flat, and the result is fitted to the wall's
   face and limited to what a bead can print: softened along each layer, and no layer leaning further over the one
   below than the overhang a bead holds. 17-vase.js asks this part how far out the wall is at each point.
   One part of the engine (no DOM), loaded after 18-ties.js; core.js lists every part and what's in it. */
(function (root) {
  "use strict";
  const UNB = root.UNB;

  // ---------- the settings ----------
  // V.texture for a relief: { kind: "relief", depth (mm: how far the most raised part stands out), source: { w, h,
  // data: [grey 0–255, … row by row, top first], id (what it is, for the cache), kind: "picture" | "text" |
  // "pattern", strokes (true: a drawing of strokes, a text's or a pattern's, thickened to height.lineW), from (the
  // design's name) }, height: { style: "smooth" | "steps" | "shapes", contrast (smooth: 0–100, 50 as it is), levels
  // (steps: 2–6 heights, the wall counted), bevel (shapes: mm, the rounded edge; 0 sharp), lineW (strokes: mm wide on
  // the wall) }, taps: [{ u, v, to: "in" | "flat" }] (u, v: shares of the source's width and height; the part there
  // is pressed in or left flat), sides: "front" | "back" | "both", span (round walls: the share of the way round one
  // copy covers, 0.1–1; on a plaque each face is one copy), turn (round walls: degrees the picture moves round,
  // anticlockwise from above), faces: "one" | "every" and face (a polygon: the picture on one flat face, 1 the one
  // facing the front, or a copy on every face; place "around" wraps it round by angle instead, corners and all),
  // invert (swap: the light parts out instead), dir: "out" (the default: the source stands out, `depth` at its
  // darkest) | "in" (pressed into the wall) | "both" (mid-grey on the wall, black depth/2 out and white depth/2 in),
  // slope (mm out per mm up: how far a layer may lean over the one below, both ways; 0.8 by default), soft (mm: along
  // each layer the height is softened this much, so the line turns no tighter than the bead; 1.3 by default), margin
  // (share of the face left plain round the picture) }.
  // The front faces −y (seen from there, x runs left to right); the back faces +y, seen from behind, so it reads the
  // right way round too. The source fits inside the face (its shape kept), the rest of the face plain. Up the wall each
  // row may stand out or step back no more than `slope` over the row below (worked out from the bottom up), so a
  // raised part's top and bottom edges are ramps a few layers high; its sides, along each layer, are sharp.
  UNB.RELIEF_STYLES = ["smooth", "steps", "shapes"];
  UNB.reliefDefaults = (kind) => ({
    style: kind === "text" || kind === "pattern" ? "shapes" : "smooth",
    contrast: 50,
    levels: 3,
    bevel: kind === "text" ? 0.6 : 1,
    lineW: 2.4,
  });
  UNB.reliefOn = (V) => !!(V.texture && V.texture.kind === "relief" && V.texture.source && V.texture.source.data);

  // ---------- the source as height ----------
  // The source's height at each of its pixels: a (0–1, how far towards the most raised), the level each pixel is on
  // and its part (lab: −1 on the wall), the parts ({ level, n (px), x, y (its middle, shares), to }), and the specks
  // too small for the bead, merged into what's round them ({ x, y } shares), and in Shapes the share of the ink
  // left out for being lighter than mid-grey (faint). sc: mm per source pixel on the wall;
  // minArea: mm², a part smaller than this is a speck (steps and shapes only: smooth has no edges to lose).
  const heightCache = new Map();
  UNB.reliefHeight = function (P, T, sc, minArea = 1.7) {
    const Hs = Object.assign(UNB.reliefDefaults(P.kind), T.height || {}),
      key = [
        P.id || P.w + "x" + P.h,
        JSON.stringify(Hs),
        T.invert ? 1 : 0,
        JSON.stringify(T.taps || []),
        sc.toFixed(4),
        minArea,
      ].join("|");
    let R = heightCache.get(key);
    if (R) return R;
    const w = P.w,
      h = P.h,
      N = w * h,
      D = P.data,
      a = new Float32Array(N);
    for (let i = 0; i < N; i++) a[i] = 1 - D[i] / 255;
    // a drawing of strokes: thickened to lineW on the wall (the drawn stroke is about 0.6 mm: the bead's line)
    if (P.strokes) {
      const ink = new Uint8Array(N);
      for (let i = 0; i < N; i++) ink[i] = a[i] > 0.5 ? 1 : 0;
      const dist = UNB.edt(ink, w, h).dist,
        r = Math.max(0, Hs.lineW / 2 - 0.3) / sc;
      for (let i = 0; i < N; i++) a[i] = Math.min(1, Math.max(0, r + 0.5 - dist[i]));
    }
    if (T.invert) for (let i = 0; i < N; i++) a[i] = 1 - a[i];
    // the style
    const style = UNB.RELIEF_STYLES.includes(Hs.style) ? Hs.style : "smooth",
      nl = style === "steps" ? Math.max(2, Math.min(6, Math.round(Hs.levels))) : style === "shapes" ? 2 : 3,
      lev = new Uint8Array(N);
    if (style === "smooth") {
      // 0: only the darkest, 100: the greys
      const g = Math.pow(2, (50 - Math.max(0, Math.min(100, +Hs.contrast))) / 25);
      for (let i = 0; i < N; i++) a[i] = Math.pow(a[i], g);
    }
    for (let i = 0; i < N; i++) lev[i] = Math.round(a[i] * (nl - 1));
    // steps: each pixel takes the level most of its 3 × 3 neighbours are on, so an edge's grey (between two levels)
    // doesn't become a thin sliver of a level of its own
    if (style === "steps") {
      const was = Uint8Array.from(lev),
        count = new Uint8Array(8);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          count.fill(0);
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++)
              count[was[Math.min(h - 1, Math.max(0, y + dy)) * w + Math.min(w - 1, Math.max(0, x + dx))]]++;
          let best = was[y * w + x];
          for (let L = 0; L < nl; L++) if (count[L] > count[best]) best = L;
          lev[y * w + x] = best;
        }
    }
    // what Shapes leaves out: ink lighter than mid-grey (a faint or thin line, averaged down), as a share of the ink
    let faint = 0,
      inked = 0;
    if (style === "shapes" && !P.strokes)
      for (let i = 0; i < N; i++) {
        if (a[i] > 0.15) inked++;
        if (a[i] > 0.15 && a[i] < 0.5) faint++;
      }
    // parts: connected pixels of one level (4-neighbours), the wall (level 0) included, so specks can be found on it
    const lab = new Int32Array(N).fill(-1),
      parts = [],
      stack = [];
    for (let s = 0; s < N; s++) {
      if (lab[s] >= 0) continue;
      const id = parts.length,
        L = lev[s];
      let n = 0,
        sx = 0,
        sy = 0;
      lab[s] = id;
      stack.push(s);
      while (stack.length) {
        const p = stack.pop(),
          x = p % w,
          y = (p / w) | 0;
        n++;
        sx += x;
        sy += y;
        for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1])
          if (q >= 0 && lab[q] < 0 && lev[q] === L) {
            lab[q] = id;
            stack.push(q);
          }
      }
      parts.push({ level: L, n, x: (sx / n + 0.5) / w, y: (sy / n + 0.5) / h, to: "out" });
    }
    // specks: in steps and shapes, a part smaller than the bead takes the level round it (the most common neighbour)
    const specks = [];
    if (style !== "smooth") {
      const tiny = minArea / (sc * sc),
        // each part's pixels, together (a counting sort by part), so a speck only looks at its own
        start = new Int32Array(parts.length + 1),
        order = new Int32Array(N);
      for (let p = 0; p < N; p++) start[lab[p] + 1]++;
      for (let id = 0; id < parts.length; id++) start[id + 1] += start[id];
      const fill = start.slice(0, parts.length);
      for (let p = 0; p < N; p++) order[fill[lab[p]]++] = p;
      // (a speck merged into a part that's then merged too: alias follows the chain)
      const alias = Int32Array.from(parts, (_, i) => i),
        root = (x) => {
          while (alias[x] !== x) x = alias[x] = alias[alias[x]];
          return x;
        };
      for (let id = 0; id < parts.length; id++) {
        if (parts[id].n >= tiny) continue;
        const votes = new Map();
        for (let j = start[id]; j < start[id + 1]; j++) {
          const p = order[j],
            x = p % w,
            y = (p / w) | 0;
          for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
            const r = q >= 0 ? root(lab[q]) : id;
            if (r !== id) votes.set(r, (votes.get(r) || 0) + 1);
          }
        }
        let to = -1,
          best = 0;
        for (const [k, c] of votes) if (c > best) ((best = c), (to = k));
        if (to < 0) continue;
        if (parts[id].level > 0) specks.push({ x: parts[id].x, y: parts[id].y });
        alias[id] = to;
        parts[to].n += parts[id].n;
        parts[id].n = 0;
      }
      for (let p = 0; p < N; p++) {
        const r = root(lab[p]);
        lab[p] = r;
        lev[p] = parts[r].level;
      }
    }
    // the height: steps and shapes flat at their level; shapes get a rounded edge (bevel mm, a quarter round)
    if (style === "steps") for (let i = 0; i < N; i++) a[i] = lev[i] / (nl - 1);
    if (style === "shapes") {
      const b = Math.max(0, +Hs.bevel || 0) / sc,
        off = new Uint8Array(N);
      for (let i = 0; i < N; i++) off[i] = lev[i] ? 0 : 1;
      const dist = b > 0 ? UNB.edt(off, w, h).dist : null;
      for (let i = 0; i < N; i++) {
        if (!lev[i]) a[i] = 0;
        else if (!dist) a[i] = 1;
        else {
          const t = Math.min(1, dist[i] / b);
          a[i] = Math.sqrt(1 - (1 - t) * (1 - t));
        }
      }
    }
    // taps: the part under each, pressed in or left flat (the wall can't be tapped)
    for (const tp of T.taps || []) {
      const x = Math.floor(tp.u * w),
        y = Math.floor(tp.v * h);
      if (!(x >= 0 && y >= 0 && x < w && y < h)) continue;
      const id = lab[y * w + x];
      if (id >= 0 && parts[id].level > 0 && (tp.to === "in" || tp.to === "flat")) parts[id].to = tp.to;
    }
    for (let id = 0; id < parts.length; id++) if (parts[id].n === 0) parts[id].to = "gone";
    for (let i = 0; i < N; i++) if (!lev[i]) lab[i] = -1;
    R = { a, lev, lab, parts, specks, faint: inked ? faint / inked : 0, w, h, levels: nl, style };
    if (heightCache.size > 6) heightCache.clear();
    heightCache.set(key, R);
    return R;
  };
  // the part of the source at (u, v) (shares of its width and height): its index, or −1 (the wall)
  UNB.reliefPartAt = function (R, u, v) {
    const x = Math.floor(u * R.w),
      y = Math.floor(v * R.h);
    return x >= 0 && y >= 0 && x < R.w && y < R.h ? R.lab[y * R.w + x] : -1;
  };

  // ---------- fitted to the wall ----------
  // Where the source sits on a face `face` mm wide and the vase's height: mm per source pixel (sc), its box (x0, y0
  // from the face's left and the plate, iw × ih mm), and the margin.
  UNB.reliefMap = function (V, face) {
    const T = V.texture,
      P = T.source,
      H = Math.max(0.5, V.height),
      margin = Math.min(0.4, Math.max(0, T.margin === undefined ? 0.04 : +T.margin)),
      fw = face * (1 - 2 * margin),
      fh = H * (1 - 2 * margin),
      sc = Math.min(fw / P.w, fh / P.h);
    return { face, H, margin, sc, iw: P.w * sc, ih: P.h * sc, x0: (face - P.w * sc) / 2, y0: (H - P.h * sc) / 2 };
  };
  // The wall's offset over the face, on a grid every 0.1 mm: d (mm out, after the softening and the slope limit) and
  // want (before them: what the source asks for), rows up from the plate, cols across left to right as seen.
  const reliefCache = new Map();
  UNB.reliefGrid = function (V, face) {
    const T = V.texture,
      P = T.source,
      M = UNB.reliefMap(V, face),
      slope = Math.max(0.05, +T.slope || 0.8),
      soft = Math.max(0, T.soft === undefined ? 1.3 : +T.soft),
      key = [
        P.id || P.w + "x" + P.h,
        T.depth,
        slope,
        soft,
        M.margin,
        JSON.stringify(T.height || {}),
        JSON.stringify(T.taps || []),
        T.invert ? 1 : 0,
        T.dir || "out",
        M.H,
        face.toFixed(2),
      ].join("|");
    let G = reliefCache.get(key);
    if (G) return G;
    const R = UNB.reliefHeight(P, T, M.sc, soft * soft),
      w = P.w,
      h = P.h,
      // each source pixel's offset (share of the depth): the direction, and its part's tap
      v = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      let x = R.a[i];
      if (T.dir === "in") x = -x;
      else if (T.dir === "both") x = x - 0.5;
      const id = R.lab[i],
        to = id >= 0 ? R.parts[id].to : "out";
      v[i] = to === "flat" ? 0 : to === "in" ? -Math.abs(x) : x;
    }
    const at = (gx, gy) => {
      const X = Math.min(w - 1, Math.max(0, gx)),
        Y = Math.min(h - 1, Math.max(0, gy)),
        xa = Math.floor(X),
        ya = Math.floor(Y),
        xb = Math.min(w - 1, xa + 1),
        yb = Math.min(h - 1, ya + 1),
        fx = X - xa,
        fy = Y - ya;
      return (
        (v[ya * w + xa] * (1 - fx) + v[ya * w + xb] * fx) * (1 - fy) +
        (v[yb * w + xa] * (1 - fx) + v[yb * w + xb] * fx) * fy
      );
    };
    const dz = 0.1,
      rows = Math.max(2, Math.ceil(M.H / dz) + 1),
      cols = Math.max(16, Math.min(2000, Math.ceil(face / 0.1))),
      d = new Float32Array(rows * cols),
      depth = T.depth || 0;
    for (let r = 0; r < rows; r++) {
      const py = (M.y0 + M.ih - r * dz) / M.sc; // source row (top first)
      for (let c = 0; c < cols; c++) {
        const px = (((c + 0.5) / cols) * face - M.x0) / M.sc;
        d[r * cols + c] = px >= 0 && px <= w && py >= 0 && py <= h ? at(px - 0.5, py - 0.5) * depth : 0;
      }
    }
    const want = Float32Array.from(d);
    // along each row, softened over about a bead's width, so the line turns in and out of a raised part in curves the
    // needle can follow rather than right angles (sigma `soft` mm)
    const sig = soft / (face / cols);
    if (sig > 0.3) {
      const K = Math.ceil(3 * sig),
        wts = [];
      let ws = 0;
      for (let q = -K; q <= K; q++) ws += wts[q + K] = Math.exp((-q * q) / (2 * sig * sig));
      const row = new Float32Array(cols);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          let s = 0;
          for (let q = -K; q <= K; q++) s += wts[q + K] * d[r * cols + Math.min(cols - 1, Math.max(0, c + q))];
          row[c] = s / ws;
        }
        d.set(row, r * cols);
      }
    }
    // each row no more than slope × dz out from (or back from) the row below
    const step = slope * dz;
    for (let r = 1; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const lo = d[(r - 1) * cols + c] - step,
          hi = d[(r - 1) * cols + c] + step,
          i = r * cols + c;
        d[i] = Math.min(hi, Math.max(lo, d[i]));
      }
    G = { d, want, rows, cols, dz, face, depth, map: M, height: R };
    if (reliefCache.size > 12) reliefCache.clear();
    reliefCache.set(key, G);
    return G;
  };
  // how far out (mm) the source puts the wall at height z, u across the face (0 left … 1 right, as seen)
  UNB.reliefAt = function (G, z, u) {
    if (!(u >= 0 && u <= 1)) return 0;
    const r = Math.min(G.rows - 1.001, Math.max(0, z / G.dz)),
      c = Math.min(G.cols - 1.001, Math.max(0, u * G.cols - 0.5)),
      ra = Math.floor(r),
      ca = Math.floor(c),
      fr = r - ra,
      fc = c - ca,
      D = G.d,
      W = G.cols;
    return (
      (D[ra * W + ca] * (1 - fc) + D[ra * W + ca + 1] * fc) * (1 - fr) +
      (D[(ra + 1) * W + ca] * (1 - fc) + D[(ra + 1) * W + ca + 1] * fc) * fr
    );
  };
  // What the printer can't make, for the inset: the parts that never get near their depth (at their highest, less
  // than 70% as far out as the source asks: a thin band across the wall, cut short by the lean or the softening).
  // Returns { short: [part index, …], reach: { index: share of its depth reached } }.
  UNB.reliefShort = function (G) {
    const M = G.map,
      R = G.height,
      got = new Map(),
      asked = new Map();
    for (let r = 0; r < G.rows; r += 2) {
      const py = Math.floor((M.y0 + M.ih - r * G.dz) / M.sc);
      if (py < 0 || py >= R.h) continue;
      for (let c = 0; c < G.cols; c += 2) {
        const px = Math.floor((((c + 0.5) / G.cols) * G.face - M.x0) / M.sc);
        if (px < 0 || px >= R.w) continue;
        const id = R.lab[py * R.w + px];
        if (id < 0) continue;
        const i = r * G.cols + c;
        got.set(id, Math.max(got.get(id) || 0, Math.abs(G.d[i])));
        asked.set(id, Math.max(asked.get(id) || 0, Math.abs(G.want[i])));
      }
    }
    const short = [],
      reach = {};
    for (const [id, want] of asked) {
      if (want < 0.2 * G.depth) continue;
      reach[id] = got.get(id) / want;
      if (reach[id] < 0.7) short.push(id);
    }
    return { short, reach };
  };

  // ---------- where a point of the wall falls on the source ----------
  // where a point of the plan (unit size, before turning) falls on the source's faces: u (0 … 1 across) for the copy
  // it's on (front, back), or null. A plaque: its flat front and back; any other shape: round the middle, a copy
  // centred on the front (−y) and one on the back (+y), each over `span` of the way round.
  // A polygon: its flat faces, each a copy's place (T.faces "one": face T.face, 1 the one facing the front (−y) and on
  // anticlockwise; "every": a copy on each), the picture on a face never round a corner. Faces are centred halfway
  // between the corners (a polygon's corners are at 0°, 360°/sides, …).
  const onFaces = (V) => V.plan && V.plan.kind === "polygon" && V.texture.place !== "around";
  function faceOf(V, ux, uy) {
    const n = Math.max(3, Math.min(24, Math.round(+V.plan.sides || 6))),
      da = (2 * Math.PI) / n,
      th = Math.atan2(uy, ux),
      // the face this point is on (from +x)
      k = Math.floor((((th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / da),
      c = (k + 0.5) * da, // its centre
      // the face facing the front: the one whose centre is nearest −y
      front = ((Math.round((1.5 * Math.PI) / da - 0.5) % n) + n) % n,
      half = Math.sin(da / 2) * (1 - 0.4 * Math.min(1, Math.max(0, +V.plan.round || 0))); // its flat half-length
    // across the face, left to right as seen from outside (anticlockwise)
    const along = -ux * Math.sin(c) + uy * Math.cos(c);
    return { k, number: ((k - front + n) % n) + 1, u: along / (2 * half) + 0.5, half, n };
  }
  UNB.reliefUV = function (V, ux, uy) {
    const T = V.texture,
      sides = T.sides || "front",
      front = sides !== "back",
      back = sides !== "front";
    if (onFaces(V)) {
      const F = faceOf(V, ux, uy);
      if (T.faces !== "every" && F.number !== Math.max(1, Math.round(+T.face || 1))) return null;
      return F.u >= 0 && F.u <= 1 ? F.u : null;
    }
    if (V.plan && V.plan.kind === "plaque") {
      const th = Math.min(0.9, Math.max(0.01, +V.plan.thick || 0.06)),
        a = 1 - th / 2; // half the flat faces' length (share of the reach)
      if (Math.abs(ux) > a) return null;
      if (uy < 0) return front ? (ux + a) / (2 * a) : null;
      return back ? (a - ux) / (2 * a) : null;
    }
    const span = Math.min(1, Math.max(0.1, +T.span || 0.5)),
      // (turn: degrees the picture moves round, anticlockwise seen from above: where it starts)
      th = Math.atan2(uy, ux) - ((+T.turn || 0) * Math.PI) / 180,
      wrap = (x) => ((((x + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
    if (front) {
      const u = wrap(th + Math.PI / 2) / (2 * Math.PI * span) + 0.5;
      if (u >= 0 && u <= 1) return u;
    }
    if (back) {
      const u = wrap(th - Math.PI / 2) / (2 * Math.PI * span) + 0.5;
      if (u >= 0 && u <= 1) return u;
    }
    return null;
  };
  // the face's width (mm) the source is fitted to, at reach R
  UNB.reliefFace = function (V, R) {
    if (V.plan && V.plan.kind === "plaque")
      return 2 * R * (1 - Math.min(0.9, Math.max(0.01, +V.plan.thick || 0.06)) / 2);
    if (onFaces(V)) return 2 * R * faceOf(V, 0, -1).half;
    return 2 * Math.PI * R * Math.min(1, Math.max(0.1, +V.texture.span || 0.5));
  };
  // how far (mm) the source may press into the wall at reach R: on a plaque the front and back stay at least
  // RELIEF_GAP apart (each side gets half when it's on both); round a cup, no more than half the reach
  const RELIEF_GAP = 1.5;
  UNB.reliefInMax = function (V, R) {
    const T = V.texture;
    const pressed = T && (T.dir === "in" || T.dir === "both" || (T.taps || []).some((t) => t.to === "in"));
    if (!pressed) return Infinity;
    if (V.plan && V.plan.kind === "plaque") {
      const room = Math.max(0, (+V.plan.thick || 0.06) * R - RELIEF_GAP);
      return T.sides === "both" ? room / 2 : room;
    }
    return Math.max(0, R / 2);
  };
})(typeof window !== "undefined" ? window : globalThis);
