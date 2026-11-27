// Prototype v2: a word as one closed outline, from the Chocolate font's own letter outlines
const UNB = require("/home/claude/Unbroken/source/engine/core.js");
const FONTS = require("/home/claude/Unbroken/source/engine/fonts.js");
const { plotLine, label4 } = UNB._u;

// opt: cap (mm), d (spacing, mm), font, gap (between letters, × d; 1.6), neck (join width, × d; 1.5), slit (× d; 1.2),
// round (corner radius, × d; 0.5), smooth (× d; 0.3)
function wordShape(text, opt) {
  const d = opt.d || 1.34, cap = opt.cap || 20, font0 = FONTS[opt.font || "chocolate"];
  // punctuation the Chocolate font lacks or draws wrong ("." is empty, "-" a full-height block): drawn here at its
  // stroke width (126 units at a cap of 700)
  const ring = (cx, cy, r, k = 24) => Array.from({ length: k + 1 }, (_, i) => `${Math.round(cx + r * Math.cos((2 * Math.PI * i) / k))},${Math.round(cy + r * Math.sin((2 * Math.PI * i) / k))}`).join(" ");
  const stadium = (x0, x1, y, r, k = 12) => { const P = []; for (let i = 0; i <= k; i++) { const a = -Math.PI / 2 + (Math.PI * i) / k; P.push([x1 + r * Math.cos(a), y + r * Math.sin(a)]); } for (let i = 0; i <= k; i++) { const a = Math.PI / 2 + (Math.PI * i) / k; P.push([x0 + r * Math.cos(a), y + r * Math.sin(a)]); } P.push(P[0]); return P.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join(" "); };
  const font = font0.label && font0.family === "Chocolate" ? Object.assign({}, font0, { glyphs: Object.assign({}, font0.glyphs, { ".": [150, ring(70, 68, 68)], "-": [330, stadium(63, 267, 300, 63)] }) }) : font0;
  const ws = (opt.slit || 1.2) * d, neck = (opt.neck || 1.5) * d, rc = (opt.round || 0.5) * d;
  const lay = UNB.textLayout(text, font, { cap, join: false, dots: "keep", spacing: "even", gap: (opt.gap || 1.6) * d, word: 0.6 * cap });
  const g = opt.g || 0.06, pad = 3 * d, w = Math.ceil((lay.width + 2 * pad) / g), h = Math.ceil((lay.height + 2 * pad) / g);
  const P = (v) => (v + pad) / g, N = w * h;
  const stats = { joins: 0, dots: 0, slits: 0, filled: 0, loops: 0 };
  // 1. the letters as drawn: hairlines on a fine grid, flooded from outside; everything the flood can't reach is
  // letter. choc OS's own thin slits into the counters let the flood in, so those counters stay open (as narrow
  // channels, widened below)
  const line = new Uint8Array(N);
  for (const st of lay.strokes) { for (let i = 2; i < st.length; i += 2) plotLine(line, w, h, P(st[i - 2]), P(st[i - 1]), P(st[i]), P(st[i + 1])); if (st.length === 2) plotLine(line, w, h, P(st[0]), P(st[1]), P(st[0]), P(st[1])); }
  const B0 = label4(w, h, (q) => line[q] === 0), out0 = B0.lab[0];
  let ink = new Uint8Array(N);
  for (let i = 0; i < N; i++) ink[i] = B0.lab[i] === out0 ? 0 : 1;
  const outsideFine = Uint8Array.from(ink, (v) => 1 - v);
  const fat = (m, r) => { const D = UNB.edt(m, w, h).dist, o = new Uint8Array(N), rr = r / g; for (let i = 0; i < N; i++) o[i] = D[i] <= rr ? 1 : 0; return o; };
  const thin = (m, r) => { const inv = new Uint8Array(N); for (let i = 0; i < N; i++) inv[i] = 1 - m[i]; const D = UNB.edt(inv, w, h).dist, o = new Uint8Array(N), rr = r / g; for (let i = 0; i < N; i++) o[i] = D[i] > rr ? 1 : 0; return o; };
  const bar = (i, j, width) => { const L = new Uint8Array(N); plotLine(L, w, h, i % w, Math.floor(i / w), j % w, Math.floor(j / w)); const o = fat(L, width / 2); for (let k = 0; k < N; k++) ink[k] |= o[k]; };
  // the baseline (y down: the text's baseline in grid rows) and the band near it where joins go
  const base = P(lay.baselines[0].y), bandTop = base - 0.35 * cap / g;
  const joinAll = () => {
  // 2. pieces: letters left to right joined near the baseline; dots (small pieces above another) joined straight down
  for (let guard = 0; guard < 80; guard++) {
    const L = label4(w, h, (q) => ink[q] === 1);
    if (L.count <= 1) break;
    const info = Array.from({ length: L.count }, () => ({ n: 0, x0: w, x1: 0, y0: h, y1: 0 }));
    for (let i = 0; i < N; i++) { const l = L.lab[i]; if (l < 0) continue; const I = info[l], x = i % w, y = Math.floor(i / w); I.n++; I.x0 = Math.min(I.x0, x); I.x1 = Math.max(I.x1, x); I.y0 = Math.min(I.y0, y); I.y1 = Math.max(I.y1, y); }
    const sizes = info.map((I) => I.n).sort((a, b) => a - b), med = sizes[Math.floor(sizes.length / 2)];
    // a dot: small, and its bottom above the baseline band
    let a = info.findIndex((I) => I.n < 0.25 * med && I.y1 < bandTop);
    let pairWith, band = false;
    if (a >= 0) {
      stats.dots++;
      // the piece right under it
      const cx = (info[a].x0 + info[a].x1) / 2;
      pairWith = info.map((I, k) => [k, k !== a && I.x0 <= cx + 4 && I.x1 >= cx - 4 && I.y0 > info[a].y0 ? I.y0 - info[a].y1 : Infinity]).sort((p, q) => p[1] - q[1])[0][0];
    } else {
      // the leftmost piece and its right-hand neighbour
      const order = info.map((I, k) => [k, (I.x0 + I.x1) / 2]).sort((p, q) => p[1] - q[1]);
      a = order[0][0]; pairWith = order[1][0]; band = true; stats.joins++;
    }
    const mA = new Uint8Array(N); for (let i = 0; i < N; i++) mA[i] = L.lab[i] === a && (!band || Math.floor(i / w) >= bandTop) ? 1 : 0;
    const E = UNB.edt(mA, w, h); let best = Infinity, bi = -1;
    // (a join: as low as it can go, near the baseline: each grid row up costs as much as 1.5 rows of length)
    for (let i = 0; i < N; i++) if (L.lab[i] === pairWith && (!band || Math.floor(i / w) >= bandTop)) { const sc = E.dist[i] + (band ? 1.5 * Math.max(0, base - Math.floor(i / w)) : 0); if (sc < best) { best = sc; bi = i; } }
    if (bi < 0) for (let i = 0; i < N; i++) if (L.lab[i] === pairWith && E.dist[i] < best) { best = E.dist[i]; bi = i; }
    bar(bi, E.near[bi], neck);
  }
  };
  joinAll();
  // 3. counters: opened by a slit to the outside (the shortest way, the bottom preferred), or filled if too small
  const holes = () => {
    for (let guard = 0; guard < 80; guard++) {
      const B = label4(w, h, (q) => ink[q] === 0), outside = B.lab[0];
      let hole = -1; for (let i = 0; i < N; i++) if (B.lab[i] >= 0 && B.lab[i] !== outside) { hole = B.lab[i]; break; }
      if (hole < 0) return;
      const notHole = new Uint8Array(N); for (let i = 0; i < N; i++) notHole[i] = B.lab[i] === hole ? 0 : 1;
      const Din = UNB.edt(notHole, w, h).dist; let deep = 0, y0 = h, y1 = 0;
      for (let i = 0; i < N; i++) if (B.lab[i] === hole) { deep = Math.max(deep, Din[i]); const y = Math.floor(i / w); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      if (deep * g < (opt.minHole || 0.6) * d) { for (let i = 0; i < N; i++) if (B.lab[i] === hole) ink[i] = 1; stats.filled++; continue; }
      // choc OS's own slit, where it had one: the fine outside that the closing filled, touching this hole
      if (!opt.ownSlits) {
        const ch = new Uint8Array(N); for (let i = 0; i < N; i++) ch[i] = outsideFine[i] && ink[i] ? 1 : 0;
        const holeM = new Uint8Array(N); for (let i = 0; i < N; i++) holeM[i] = B.lab[i] === hole ? 1 : 0;
        const nearHole = fat(holeM, 2 * g);
        const C = label4(w, h, (q) => ch[q] === 1);
        const touch = new Set(); for (let i = 0; i < N; i++) if (ch[i] && nearHole[i]) touch.add(C.lab[i]);
        if (touch.size) {
          // a straight slit from where choc OS's channel meets the outside to the nearest point of the counter
          const mouth = []; for (let i = 0; i < N; i++) if (ch[i] && touch.has(C.lab[i]) && (B.lab[i - 1] === outside || B.lab[i + 1] === outside || B.lab[i - w] === outside || B.lab[i + w] === outside)) mouth.push(i);
          const cutM = new Uint8Array(N);
          if (mouth.length) {
            let mx = 0, my = 0; for (const i of mouth) { mx += i % w; my += Math.floor(i / w); } mx /= mouth.length; my /= mouth.length;
            let bh = -1, bd = Infinity; for (let i = 0; i < N; i++) if (B.lab[i] === hole) { const dd = Math.hypot(i % w - mx, Math.floor(i / w) - my); if (dd < bd) { bd = dd; bh = i; } }
            const hx = bh % w, hy = Math.floor(bh / w), Lz = Math.hypot(hx - mx, hy - my) || 1, ux = (hx - mx) / Lz, uy = (hy - my) / Lz, ext = ws / g;
            plotLine(cutM, w, h, mx - ux * ext, my - uy * ext, hx + ux * ext, hy + uy * ext);
          } else for (let i = 0; i < N; i++) if (ch[i] && touch.has(C.lab[i])) cutM[i] = 1;
          const cut = fat(cutM, ws / 2), trial = Uint8Array.from(ink);
          for (let i = 0; i < N; i++) if (cut[i]) trial[i] = 0;
          // (only if it opens the hole: a channel that stops short of the outside leaves it closed)
          const T = label4(w, h, (q) => trial[q] === 0), seed = holeM.indexOf(1);
          if (T.lab[seed] === T.lab[0]) {
            ink = trial;
            stats.slits++; stats.own = (stats.own || 0) + 1;
            continue;
          }
        }
      }
      const om = new Uint8Array(N); for (let i = 0; i < N; i++) om[i] = B.lab[i] === outside ? 1 : 0;
      const E = UNB.edt(om, w, h);
      let best = Infinity, bi = -1;
      for (let i = 0; i < N; i++) {
        if (B.lab[i] !== hole || !(ink[i - 1] || ink[i + 1] || ink[i - w] || ink[i + w])) continue;
        const below = (Math.floor(i / w) - y0) / Math.max(1, y1 - y0), sc = E.dist[i] * (1 + 0.5 * (1 - below));
        if (sc < best) { best = sc; bi = i; }
      }
      const bj = E.near[bi], ax = bi % w, ay = Math.floor(bi / w), bx = bj % w, by = Math.floor(bj / w), Lz = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / Lz, uy = (by - ay) / Lz, ext = ws / g;
      const cutL = new Uint8Array(N); plotLine(cutL, w, h, ax - ux * ext, ay - uy * ext, bx + ux * ext, by + uy * ext);
      const cut = fat(cutL, ws / 2); for (let i = 0; i < N; i++) if (cut[i]) ink[i] = 0;
      stats.slits++;
    }
  };
  // 4. corners rounded: opened (outside corners), then closed (inside corners, gaps narrower than a bead between parts)
  const roundIt = () => { ink = fat(thin(ink, rc), rc); const cr = Math.min(0.48 * d, 0.45 * ws); ink = thin(fat(ink, cr), cr); };
  // (gaps between parts narrower than a spacing are closed first, so they don't count as counters)
  { const cr = 0.48 * d; ink = thin(fat(ink, cr), cr); }
  holes(); roundIt(); joinAll(); holes(); roundIt(); joinAll(); holes();
  // 5. the outline: marching squares on a smoothed copy of the ink, then smoothed along its length
  const s = new Float32Array(N), K = 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0, c = 0; for (let dy = -K; dy <= K; dy++) for (let dx = -K; dx <= K; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h) { v += ink[Y * w + X]; c++; } } s[y * w + x] = v / c; }
  const lab = new Int32Array(N), box = { x0: [1], y0: [1], x1: [w - 2], y1: [h - 2] };
  const loops = UNB._u.isoContours(s, lab, 0, 0.5, w, h, box, -pad, -pad, g);
  stats.loops = loops.length;
  loops.sort((p, q) => q.length - p.length);
  let L = UNB._u.resampleLoop(loops[0], 0.15);
  const sig = (opt.smooth || 0.3) * d / 0.15;
  if (sig > 0.5) { const R = Math.ceil(2.5 * sig), wt = []; let ws2 = 0; for (let k = -R; k <= R; k++) ws2 += wt[k + R] = Math.exp(-(k * k) / (2 * sig * sig)); const n = L.length; L = L.map((_, i) => { let x = 0, y = 0; for (let k = -R; k <= R; k++) { const p = L[(i + k + n) % n]; x += wt[k + R] * p[0]; y += wt[k + R] * p[1]; } return [x / ws2, y / ws2]; }); }
  return { loop: L.map(([x, y]) => [x, -y]), drawLoops: [L].concat(loops.slice(1)), ink, w, h, g, pad, lay, stats, d };
}
module.exports = { wordShape, FONTS, UNB };
