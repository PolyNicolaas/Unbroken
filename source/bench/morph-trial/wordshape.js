// Prototype: a word as one closed outline (a morph font made from a single-stroke font)
const UNB = require("/home/claude/Unbroken/source/engine/core.js");
const FONTS = require("/home/claude/Unbroken/source/engine/fonts.js");
const { plotLine, label4, isoContours, labelBoxes } = UNB._u;

// opt: cap (mm), d (spacing, mm), weight (stroke width, × d; 2.2), slit (× d; 1.15), round (× d; 0.45), font
function wordShape(text, opt) {
  const d = opt.d || 1.34, cap = opt.cap || 20, W = (opt.weight || 2.2) * d, ws = (opt.slit || 1.15) * d, rc = (opt.round || 0.45) * d;
  const font = FONTS[opt.font || "chocolate"];
  const lay = UNB.textLayout(text, font, { cap, join: true, dots: opt.dots || "none", spacing: "even", gap: W + 1.3 * d, word: 0.6 * cap });
  const g = d / 6, pad = W + 2 * d, w = Math.ceil((lay.width + 2 * pad) / g), h = Math.ceil((lay.height + 2 * pad) / g);
  const P = (v) => (v + pad) / g;
  // centre lines → ink: within W/2 of a centre line
  const cl = new Uint8Array(w * h);
  lay.strokes.forEach((st) => {
    for (let i = 2; i < st.length; i += 2) plotLine(cl, w, h, P(st[i - 2]), P(st[i - 1]), P(st[i]), P(st[i + 1]));
    if (st.length === 2) plotLine(cl, w, h, P(st[0]), P(st[1]), P(st[0]), P(st[1]));
  });
  const thick = (src, r) => { const D = UNB.edt(src, w, h).dist, out = new Uint8Array(w * h), rr = r / g; for (let i = 0; i < w * h; i++) out[i] = D[i] <= rr ? 1 : 0; return out; };
  let ink = thick(cl, W / 2);
  const stats = { joined: 0, slits: 0, filled: 0, loops: 0 };
  // 1. one piece: join pieces nearest first
  for (let guard = 0; guard < 50; guard++) {
    const L = label4(w, h, (q) => ink[q] === 1);
    if (L.count <= 1) break;
    // nearest cell of another piece to piece 0
    const m0 = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) m0[i] = L.lab[i] === 0 ? 1 : 0;
    const E = UNB.edt(m0, w, h); let best = Infinity, bi = -1;
    for (let i = 0; i < w * h; i++) if (L.lab[i] > 0 && E.dist[i] < best) { best = E.dist[i]; bi = i; }
    const bj = E.near[bi], line = new Uint8Array(w * h);
    plotLine(line, w, h, bi % w, Math.floor(bi / w), bj % w, Math.floor(bj / w));
    const add = thick(line, W / 2); for (let i = 0; i < w * h; i++) ink[i] |= add[i];
    stats.joined++;
  }
  const holes = () => {
  // 2. counters: each hole either filled (too small to print round) or opened to the outside by a slit
  for (let guard = 0; guard < 60; guard++) {
    const B = label4(w, h, (q) => ink[q] === 0);
    const outside = B.lab[0];
    let hole = -1; for (let i = 0; i < w * h; i++) if (B.lab[i] >= 0 && B.lab[i] !== outside) { hole = B.lab[i]; break; }
    if (hole < 0) break;
    // how wide the hole is: its deepest point from the ink
    const inkM = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) inkM[i] = B.lab[i] === hole ? 0 : 1;
    const Din = UNB.edt(inkM, w, h).dist; let deep = 0; for (let i = 0; i < w * h; i++) if (B.lab[i] === hole) deep = Math.max(deep, Din[i]);
    if (deep * g < 0.75 * d) { for (let i = 0; i < w * h; i++) if (B.lab[i] === hole) ink[i] = 1; stats.filled++; continue; }
    // slit: from the hole's edge to the outside, the shortest way, bottom preferred
    const om = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) om[i] = B.lab[i] === outside ? 1 : 0;
    const E = UNB.edt(om, w, h);
    let y0 = h, y1 = 0; for (let i = 0; i < w * h; i++) if (B.lab[i] === hole) { const y = Math.floor(i / w); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    let best = Infinity, bi = -1;
    for (let i = 0; i < w * h; i++) {
      if (B.lab[i] !== hole) continue;
      const x = i % w, y = Math.floor(i / w);
      if (!(ink[i - 1] || ink[i + 1] || ink[i - w] || ink[i + w])) continue;
      const below = (y - y0) / Math.max(1, y1 - y0); // 0 top … 1 bottom (y down)
      const sc = E.dist[i] * (1 + (opt.slitBias != null ? opt.slitBias : 0.35) * (1 - below));
      if (sc < best) { best = sc; bi = i; }
    }
    const bj = E.near[bi];
    // carve: a little past both ends
    const ax = bi % w, ay = Math.floor(bi / w), bx = bj % w, by = Math.floor(bj / w), L0 = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / L0, uy = (by - ay) / L0, ext = ws / g;
    const line = new Uint8Array(w * h);
    plotLine(line, w, h, ax - ux * ext, ay - uy * ext, bx + ux * ext, by + uy * ext);
    const cut = thick(line, ws / 2); for (let i = 0; i < w * h; i++) if (cut[i]) ink[i] = 0;
    stats.slits++;
  }
  };
  const roundIt = (k) => {
  // 3. round the corners: open (rounds outside corners) then close (rounds the slit's mouth and inside corners)
  const erode = (m, r) => { const inv = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) inv[i] = 1 - m[i]; const D = UNB.edt(inv, w, h).dist, o = new Uint8Array(w * h), rr = r / g; for (let i = 0; i < w * h; i++) o[i] = D[i] > rr ? 1 : 0; return o; };
  ink = thick(erode(ink, rc), rc);
  const closeR = Math.min(rc, 0.4 * ws);
  ink = erode(thick(ink, closeR), closeR);
  };
  holes(); roundIt(); holes(); roundIt(); holes();
  // 4. the outline: signed distance, contour at 0 (inside ≥ 0)
  const inv = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) inv[i] = 1 - ink[i];
  const Do = UNB.edt(ink, w, h).dist, Di = UNB.edt(inv, w, h).dist, S = new Float32Array(w * h), lab = new Int32Array(w * h);
  for (let i = 0; i < w * h; i++) S[i] = ink[i] ? Di[i] - 0.5 : -(Do[i] - 0.5);
  const box = { x0: [1], y0: [1], x1: [w - 2], y1: [h - 2] };
  const loops = isoContours(S, lab, 0, 0, w, h, box, -pad, -pad, g);
  stats.loops = loops.length;
  loops.sort((a, b) => b.length - a.length);
  const out = loops[0].map(([x, y]) => [x, -y]); // mm, y up
  return { loop: out, loops, ink, w, h, g, pad, lay, stats, W, d };
}
module.exports = { wordShape, FONTS, UNB };
