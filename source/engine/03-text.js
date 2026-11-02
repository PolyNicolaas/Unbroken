/* Unbroken · engine · 03-text.js
   3. Text — typed text → strokes in a single-stroke font → a line map, so text joins the same pipeline.
   One part of the engine (no DOM), loaded after 02-lines.js; core.js lists every part and what's in it. */
(function (root) {
  "use strict";
  const UNB = root.UNB,
    { plotLine } = UNB._u; // shared helpers (00-util.js)

  // Text: lay out typed text in a single-stroke font
  // font: one entry of UNB_FONTS (fonts.js). opt (all mm unless noted):
  //   cap        letter (capital) height
  //   spacing    "even": every pair of neighbouring letters is placed exactly `gap` apart at its closest point
  //              (measured ink to ink, height band by height band); "font": the font's own advances + `track`
  //   gap, track, word (gap for a space), lineGap (baseline-to-baseline, × cap), align ("left" | "center" | "right")
  //   Lettering for a printer (each off unless set):
  //   dots       "keep" (as the font draws them) or "none" (i and j lose their dots: no connector up to them and
  //              back; other letters' dots, ü's or ё's, make the letter and stay)
  //   snap       mm: a stroke end this close to another part of its letter joins it (it would run into it in the
  //              print anyway), one turn less; at most 7% of the letter height, so a letter's openings stay open
  //   join       true: the letters of a word are linked along the baseline, from the lowest right-hand point of one
  //              to the lowest left-hand point of the next, instead of wherever the tracer finds a short hop
  // Returns strokes as flat [x0, y0, x1, y1, ...] arrays in mm (y down, origin top-left of the text block), the line
  // each stroke belongs to (lineOf, from 0), the baseline of each line, and the block size; also how many joins,
  // snapped ends and dots left out (joins, snaps, dots), and which strokes are the joins (joinIdx).
  UNB.textLayout = function (text, font, opt) {
    const cap = opt.cap,
      s = cap / font.cap,
      mode = opt.spacing || (font.joined ? "font" : "even");
    const gap = opt.gap === undefined ? 0.25 * cap : opt.gap,
      word = opt.word === undefined ? 0.6 * cap : opt.word,
      track = opt.track || 0;
    const lineGap = (opt.lineGap || 1.7) * cap,
      BANDS = 24,
      bandH = (font.cap * 1.6) / BANDS,
      bandY0 = -font.cap * 0.4;
    const cache = {},
      stats = { joins: 0, snaps: 0, dots: 0 },
      joinIdx = [], // which strokes are joins
      dotMode = opt.dots || "keep",
      snap = Math.min(opt.snap || 0, 0.07 * cap), // never more than a near-miss: gaps over 7% of the letter height are
      // the font's own openings (э's, a serif's tail), not strokes meant to touch
      join = !!opt.join;
    const glyph = (ch) => {
      // parsed strokes + per-band left/right ink profile (font units)
      if (cache[ch]) return cache[ch];
      const g = font.glyphs[ch] || font.glyphs["?"];
      if (!g) return null;
      const strokes = g[1] ? g[1].split("|").map((st) => st.split(" ").map((p) => p.split(",").map(Number))) : [];
      const L = new Float64Array(BANDS).fill(Infinity),
        R = new Float64Array(BANDS).fill(-Infinity);
      let x0 = Infinity,
        x1 = -Infinity;
      const mark = (x, y) => {
        const b = Math.floor((y - bandY0) / bandH);
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        for (const bb of [b - 1, b, b + 1])
          if (bb >= 0 && bb < BANDS) {
            L[bb] = Math.min(L[bb], x);
            R[bb] = Math.max(R[bb], x);
          }
      };
      for (const st of strokes)
        for (let i = 0; i < st.length; i++) {
          mark(st[i][0], st[i][1]);
          if (i) {
            const [ax, ay] = st[i - 1],
              [bx, by] = st[i],
              n = Math.ceil(Math.hypot(bx - ax, by - ay) / (bandH / 2));
            for (let k = 1; k < n; k++) mark(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n);
          }
        }
      // a letter's dots (i, ё, ü): a small stroke clear of the rest of the letter (punctuation keeps its dots)
      const dot = strokes.map(() => false);
      if (/\p{L}/u.test(ch) && strokes.length > 1)
        strokes.forEach((st, k) => {
          const xs = st.map((q) => q[0]),
            ys = st.map((q) => q[1]);
          if (Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) > 0.22 * font.cap) return;
          const clear = strokes.every((o, j) => j === k || st.every((q) => distToPath(q, o) > 0.03 * font.cap));
          dot[k] = clear;
        });
      if (dot.every(Boolean)) dot.fill(false);
      return (cache[ch] = { adv: g[0], strokes, dot, L, R, x0, x1, ink: strokes.length > 0 });
    };
    const lines = [];
    for (const raw of String(text).replace(/\r/g, "").split("\n")) {
      const placed = [];
      let pen = 0,
        prev = null,
        pendingSpace = 0,
        wordNo = 0;
      for (const ch of raw) {
        const g = glyph(ch);
        if (!g) continue;
        if (!g.ink) {
          pendingSpace += mode === "even" ? word : g.adv * s + track;
          continue;
        }
        let ox; // x offset (mm) of this glyph's origin
        if (mode === "font" || !prev) ox = prev ? pen + pendingSpace : mode === "even" ? -g.x0 * s : 0;
        else {
          // closest approach between prev's right profile and this glyph's left profile, over shared height bands
          let need = -Infinity;
          for (let b = 0; b < BANDS; b++)
            if (prev.g.R[b] > -Infinity && g.L[b] < Infinity)
              need = Math.max(need, prev.ox + prev.g.R[b] * s - g.L[b] * s);
          if (need === -Infinity) need = prev.ox + prev.g.x1 * s - g.x0 * s; // no shared height: use the boxes
          ox = need + gap + pendingSpace;
        }
        if (pendingSpace > 0) wordNo++;
        placed.push({ g, ox, word: wordNo, ch });
        prev = { g, ox };
        pen = ox + g.adv * s + track;
        pendingSpace = 0;
      }
      let xa = Infinity,
        xb = -Infinity;
      for (const p of placed) {
        xa = Math.min(xa, p.ox + p.g.x0 * s);
        xb = Math.max(xb, p.ox + p.g.x1 * s);
      }
      lines.push({ placed, xa: placed.length ? xa : 0, xb: placed.length ? xb : 0 });
    }
    const widest = Math.max(0, ...lines.map((l) => l.xb - l.xa)),
      strokes = [],
      lineOf = [],
      baselines = [];
    let top = Infinity,
      bottom = -Infinity;
    lines.forEach((l, i) => {
      const base = i * lineGap,
        lw = l.xb - l.xa,
        shift = -l.xa + (opt.align === "center" ? (widest - lw) / 2 : opt.align === "right" ? widest - lw : 0);
      baselines.push({ y: base, x0: shift + l.xa, x1: shift + l.xb });
      const push = (pts) => {
        const flat = [];
        for (const [X, Y] of pts) {
          flat.push(X, Y);
          top = Math.min(top, Y);
          bottom = Math.max(bottom, Y);
        }
        strokes.push(flat);
        lineOf.push(i);
      };
      let last = null; // the previous letter: its word and its lowest right-hand point
      for (const p of l.placed) {
        const mm = ([x, y]) => [shift + p.ox + x * s, base - y * s];
        let own = [],
          dots = [];
        // "none" only drops the dots of i and j (Latin and Cyrillic): ü's or ё's dots make the letter what it is
        const drop = dotMode === "none" && IJ.includes(p.ch);
        p.g.strokes.forEach((st, k) => (p.g.dot[k] && drop ? dots : own).push(st.map(mm)));
        stats.dots += dots.length; // left out
        dots = [];
        if (snap > 0) own = snapEnds(own, snap, stats);
        // the link from the last letter of the same word, along the baseline
        if (join && last && last.word === p.word && own.length) {
          const a = last.at,
            b = lowEnd(own, base, cap, -1);
          if (a && b && b[0] > a[0] - 0.05 * cap) {
            push([a, b]);
            stats.joins++;
            joinIdx.push(strokes.length - 1);
          }
        }
        if (own.length) last = { word: p.word, at: lowEnd(own, base, cap, 1) };
        for (const st of own.concat(dots)) push(st);
      }
    });
    if (!strokes.length) return { strokes: [], lineOf: [], baselines: [], width: 0, height: 0 };
    for (const st of strokes) for (let i = 1; i < st.length; i += 2) st[i] -= top;
    for (const b of baselines) b.y -= top;
    return { strokes, lineOf, baselines, width: widest, height: bottom - top, cap, ...stats, joinIdx };
  };

  const IJ = "ijіј"; // Latin i j, Cyrillic і ј
  // distance from a point to a polyline ([[x, y], ...])
  function distToPath(q, path) {
    let best = Infinity;
    for (let i = 0; i < path.length; i++) {
      const a = path[i],
        b = path[i + 1] || a,
        vx = b[0] - a[0],
        vy = b[1] - a[1],
        L = vx * vx + vy * vy,
        t = L ? Math.max(0, Math.min(1, ((q[0] - a[0]) * vx + (q[1] - a[1]) * vy) / L)) : 0;
      best = Math.min(best, Math.hypot(q[0] - a[0] - t * vx, q[1] - a[1] - t * vy));
    }
    return best;
  }
  // the closest point of a polyline to q: [point, segment index]
  function nearestOn(q, path, from = 0, to = path.length - 1) {
    let best = [null, -1, Infinity];
    for (let i = from; i < Math.min(to, path.length - 1); i++) {
      const a = path[i],
        b = path[i + 1],
        vx = b[0] - a[0],
        vy = b[1] - a[1],
        L = vx * vx + vy * vy,
        t = L ? Math.max(0, Math.min(1, ((q[0] - a[0]) * vx + (q[1] - a[1]) * vy) / L)) : 0,
        P = [a[0] + t * vx, a[1] + t * vy],
        d = Math.hypot(q[0] - P[0], q[1] - P[1]);
      if (d < best[2]) best = [P, i, d];
    }
    return best;
  }
  // the lowest point near the baseline on one side of a letter (side 1: right, -1: left), mm, y down: the letter's
  // points within its lowest third (above the baseline down to a little below it), the furthest out on that side
  function lowEnd(strokes, base, cap, side) {
    let best = null;
    for (const st of strokes)
      for (const q of st)
        if (q[1] <= base + 0.12 * cap && q[1] >= base - 0.3 * cap && (!best || (q[0] - best[0]) * side > 0)) best = q;
    return best;
  }
  // Close near-misses: a free end of a stroke (one touching nothing) that comes within `snap` mm of another stroke of
  // its letter, or of its own stroke further along, is drawn on to meet it
  function snapEnds(strokes, snap, stats) {
    const touch = 0.05 * snap;
    const out = strokes.map((st) => st.slice());
    out.forEach((st, k) => {
      if (st.length < 2) return;
      const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len(st[0], st[st.length - 1]) < touch) return; // a closed stroke has no ends
      for (const end of [0, 1]) {
        const e = end ? st[st.length - 1] : st[0];
        if (out.some((o, j) => j !== k && distToPath(e, o) < touch)) continue; // already joined
        let best = [null, -1, snap];
        out.forEach((o, j) => {
          if (j === k) return;
          const n = nearestOn(e, o);
          if (n[2] < best[2] && n[2] > touch) best = n;
        });
        // its own stroke, past the part next to the end (along the stroke, at least 3 × snap away)
        let run = 0,
          i = end ? st.length - 1 : 0;
        const step = end ? -1 : 1;
        while (i + step >= 0 && i + step < st.length && run < 3 * snap) {
          run += len(st[i], st[i + step]);
          i += step;
        }
        if (run >= 3 * snap) {
          const n = end ? nearestOn(e, st, 0, i + 1) : nearestOn(e, st, i, st.length - 1);
          if (n[2] < best[2] && n[2] > touch) best = n;
        }
        if (!best[0]) continue;
        if (end) st.push(best[0]);
        else st.unshift(best[0]);
        stats.snaps++;
      }
    });
    return out;
  }

  // The smallest letter height at which typed text keeps its shape in print. The layout's strokes (made at any letter
  // height) are drawn as wide as the printed stroke plus the clearance it needs (`thick`, mm), at smaller and smaller
  // sizes, and compared with a large print: no fewer separate pieces of ink (a dot running into its stem) and no fewer
  // holes (the eye of an e, the inside of an o filling in), each still at least a stroke's width across. A V's crotch
  // filling a little changes neither, so it doesn't count; nor do holes under 1.5% of the letter's square (a sliver
  // where a font draws over its own stroke, a script's small loop): they can fill without the letter reading wrong.
  // Openings closing (a script's loop, or э becoming ө) aren't checked: thickening strokes can't tell them apart. Returns the letter height in mm (searched between 3
  // and 30 × thick; 30 × thick if even that loses its shape).
  UNB.textShapeMin = function (layout, thick) {
    if (!layout.strokes.length) return 0;
    const cap0 = layout.cap,
      PX = 4; // px per thick
    const topo = (r) => {
      // r: letter height ÷ thick; draw at that size with each stroke PX px wide
      const f = (r * PX) / cap0,
        pad = PX + 2,
        w = Math.ceil(layout.width * f) + 2 * pad,
        h = Math.ceil(layout.height * f) + 2 * pad,
        ink = new Uint8Array(w * h),
        R = PX / 2,
        R2 = R * R;
      const stamp = (cx, cy) => {
        for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++)
          for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++)
            if ((x - cx) ** 2 + (y - cy) ** 2 <= R2 && x >= 0 && y >= 0 && x < w && y < h) ink[y * w + x] = 1;
      };
      for (const st of layout.strokes)
        for (let i = 0; i < st.length; i += 2) {
          const x1 = st[i] * f + pad,
            y1 = st[i + 1] * f + pad,
            x0 = i ? st[i - 2] * f + pad : x1,
            y0 = i ? st[i - 1] * f + pad : y1,
            n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.7));
          for (let k = 0; k <= n; k++) stamp(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n);
        }
      // count 8-connected ink pieces and 4-connected holes (paper not reaching the edge)
      const seen = new Uint8Array(w * h),
        stack = [];
      let pieces = 0,
        holes = 0,
        open = 0, // holes at least a stroke's width across (smaller ones are as good as filled in)
        big = 0, // holes that make the letter: a sliver, or a script's small loop, can fill without it reading wrong
        letter = Math.max(4 * PX * PX, 0.015 * (r * PX) ** 2);
      for (let i0 = 0; i0 < w * h; i0++) {
        if (seen[i0]) continue;
        const v = ink[i0];
        let edge = false,
          area = 0;
        seen[i0] = 1;
        stack.push(i0);
        while (stack.length) {
          const i = stack.pop(),
            x = i % w,
            y = (i / w) | 0;
          area++;
          if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              if (!v && dx && dy) continue; // paper: 4-connected
              const X = x + dx,
                Y = y + dy;
              if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
              const j = Y * w + X;
              if (!seen[j] && ink[j] === v) {
                seen[j] = 1;
                stack.push(j);
              }
            }
        }
        if (v) pieces++;
        else if (!edge) {
          holes++;
          if (area >= PX * PX) open++;
          if (area >= letter) big++;
        }
      }
      return [pieces, holes, big, open];
    };
    // the large print's holes that count: a sliver where a font draws over its own stroke isn't an opening to keep
    const ref = topo(30),
      ok = (r) => {
        const [p, , , o] = topo(r);
        return p >= ref[0] && o >= ref[2];
      };
    let lo = UNB.SHAPE_FLOOR || 3,
      hi = 30;
    if (ok(lo)) return lo * thick;
    while (hi - lo > 0.25) {
      const mid = (lo + hi) / 2;
      if (ok(mid)) hi = mid;
      else lo = mid;
    }
    // shapes aren't always monotonic in size: step up until the next size keeps the shape too
    while (hi < 30 && !ok(hi + 0.5)) hi += 0.5;
    return hi * thick;
  };
  // The same for one letter, as a multiple of `thick` (the shape at a size depends only on that ratio, so it's worked
  // out once per letter and dot style, and cached on the font). The letter height for a text is the largest of its
  // letters' (UNB.textShapeMin on the whole text would also count letters touching their neighbours: that's the
  // letter gap's job).
  UNB.glyphShapeMin = function (font, ch, dots) {
    const memo = font.__shape || Object.defineProperty(font, "__shape", { value: {} }).__shape,
      key = ch + "|" + (dots || "keep");
    if (!(key in memo)) memo[key] = UNB.textShapeMin(UNB.textLayout(ch, font, { cap: 30, dots, snap: 30 }), 1);
    return memo[key];
  };

  // Rasterize the layout's strokes (mm) into a thinned 1-px line map at `ppm` pixels per mm, with `margin` mm round
  // the block. Returns { mask, w, h, ppm, margin, lines }: with two or more lines that have letters, `lines` holds a
  // line map per line (the same size and place as mask, holding only that line's letters), so each line can be
  // traced as a piece of its own; otherwise it is empty.
  UNB.rasterText = function (layout, ppm, margin) {
    const m = margin * ppm,
      w = Math.max(8, Math.ceil(layout.width * ppm + 2 * m)),
      h = Math.max(8, Math.ceil(layout.height * ppm + 2 * m));
    const P = (v) => v * ppm + m;
    const draw = (keep) => {
      const mask = new Uint8Array(w * h);
      layout.strokes.forEach((st, k) => {
        if (!keep(k)) return;
        for (let i = 2; i < st.length; i += 2) plotLine(mask, w, h, P(st[i - 2]), P(st[i - 1]), P(st[i]), P(st[i + 1]));
        if (st.length === 2) plotLine(mask, w, h, P(st[0]), P(st[1]), P(st[0]), P(st[1])); // a dot
      });
      return UNB.thin(mask, w, h);
    };
    const of = layout.lineOf || [],
      inked = [...new Set(of)].sort((a, b) => a - b);
    const lines = inked.length > 1 ? inked.map((li) => draw((k) => of[k] === li)) : [];
    return { mask: draw(() => true), w, h, ppm, margin, lines };
  };
})(typeof window !== "undefined" ? window : globalThis);
