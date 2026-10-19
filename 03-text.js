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
  // Returns strokes as flat [x0, y0, x1, y1, ...] arrays in mm (y down, origin top-left of the text block), the line
  // each stroke belongs to (lineOf, from 0), the baseline of each line, and the block size.
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
    const cache = {};
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
      return (cache[ch] = { adv: g[0], strokes, L, R, x0, x1, ink: strokes.length > 0 });
    };
    const lines = [];
    for (const raw of String(text).replace(/\r/g, "").split("\n")) {
      const placed = [];
      let pen = 0,
        prev = null,
        pendingSpace = 0;
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
        placed.push({ g, ox });
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
      for (const p of l.placed)
        for (const st of p.g.strokes) {
          const flat = [];
          for (const [x, y] of st) {
            const X = shift + p.ox + x * s,
              Y = base - y * s;
            flat.push(X, Y);
            top = Math.min(top, Y);
            bottom = Math.max(bottom, Y);
          }
          strokes.push(flat);
          lineOf.push(i);
        }
    });
    if (!strokes.length) return { strokes: [], lineOf: [], baselines: [], width: 0, height: 0 };
    for (const st of strokes) for (let i = 1; i < st.length; i += 2) st[i] -= top;
    for (const b of baselines) b.y -= top;
    return { strokes, lineOf, baselines, width: widest, height: bottom - top, cap };
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
