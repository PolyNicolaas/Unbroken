// fancy morph fonts made from the app's own centreline fonts: each stroke swept with a broad nib (thick/thin by
// direction), optional serifs and ball ends, then traced back to closed outlines in font units (cap 700, y up).
const { createCanvas } = require("../../../tests/node_modules/@napi-rs/canvas");
const F = require("../../../engine/fonts.js");
const CH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ!?";
const parse = (s) => s.split("|").map((st) => st.trim().split(/\s+/).map((p) => p.split(",").map(Number))).filter((P) => P.length);
// opt: base font, nib (width, units), thin (min width), angle (deg), slant (deg), serif (length), ball (radius)
function make(o) {
  const f = F[o.base], out = {}, sl = Math.tan(((o.slant || 0) * Math.PI) / 180), K = 1.2; // px per unit
  for (const ch of CH) {
    const gl = f.glyphs[ch]; if (!gl) continue;
    let S = parse(gl[1]).map((P) => P.map(([x, y]) => [x + sl * y, y]));
    if (o.edit && o.edit[ch]) S = o.edit[ch](S);
    const xs = S.flat().map((p) => p[0]), pad = 120, x0 = Math.min(...xs) - pad, W = Math.ceil((Math.max(...xs) - x0 + pad) * K), H = Math.ceil((700 + 2 * 260) * K);
    const cv = createCanvas(W, H), g = cv.getContext("2d"), X = (x) => (x - x0) * K, Y = (y) => (700 + 260 - y) * K;
    g.fillStyle = "#000"; g.strokeStyle = "#000"; g.lineCap = "round"; g.lineJoin = "round";
    const a = ((o.angle || 30) * Math.PI) / 180, nx = (Math.cos(a) * o.nib) / 2, ny = (Math.sin(a) * o.nib) / 2;
    for (const P of S) {
      if (P.length === 1 || (P.length === 2 && P[0][0] === P[1][0] && P[0][1] === P[1][1])) { // a dot
        g.beginPath(); g.arc(X(P[0][0]), Y(P[0][1]), (o.dot || o.nib * 0.55) * K, 0, 7); g.fill(); continue; }
      for (let i = 1; i < P.length; i++) {
        const [px, py] = P[i - 1], [qx, qy] = P[i];
        g.beginPath(); g.moveTo(X(px + nx), Y(py + ny)); g.lineTo(X(qx + nx), Y(qy + ny)); g.lineTo(X(qx - nx), Y(qy - ny)); g.lineTo(X(px - nx), Y(py - ny)); g.closePath(); g.fill();
      }
      g.lineWidth = o.thin * K; g.beginPath(); P.forEach(([x, y], k) => (k ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.stroke();
      // nib footprint at the ends so they're cut square to the pen
      for (const [x, y] of [P[0], P[P.length - 1]]) {
        if (o.serif && (Math.abs(y) < 25 || Math.abs(y - 700) < 25)) { // a serif on ends at baseline / cap height
          const s = o.serif, t = o.serifT || o.thin * 1.2, yy = y < 350 ? y + t / 2 - 8 : y - t / 2 + 8;
          g.beginPath(); g.roundRect(X(x + sl * (yy - y) - s / 2), Y(yy + t / 2), s * K, t * K, t * K * 0.3); g.fill();
        } else if (o.ball && !(Math.abs(y) < 25 || Math.abs(y - 700) < 25)) {
          g.beginPath(); g.arc(X(x), Y(y), o.ball * K, 0, 7); g.fill();
        }
      }
    }
    openCounters(g, W, H);
    out[ch] = [Math.round(Math.max(...xs) - Math.min(...xs) + o.nib + 60), trace(g.getImageData(0, 0, W, H), W, H).map((L) => L.map(([px, py]) => `${Math.round(px / K + x0)},${Math.round(700 + 260 - py / K)}`).join(" ")).join("|")];
  }
  return { name: o.name, glyphs: out, cap: 700 };
}
// a closed counter gets a hairline cut to the outside (the shortest way, going down preferred), the way choc OS's own
// letters come: the morph straightens it into its slit
function openCounters(g, W, H) {
  for (let guard = 0; guard < 8; guard++) {
    const img = g.getImageData(0, 0, W, H), ink = (i) => img.data[i * 4 + 3] > 127, N = W * H, lab = new Int32Array(N).fill(-1);
    let n = 0;
    for (let s = 0; s < N; s++) { if (ink(s) || lab[s] >= 0) continue; const q = [s]; lab[s] = n;
      while (q.length) { const i = q.pop(), x = i % W, y = (i / W) | 0; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && !ink(j) && lab[j] < 0) { lab[j] = n; q.push(j); } }
      n++; }
    if (n <= 1) return;
    const outside = lab[0], hole = [...new Set(lab)].find((l) => l >= 0 && l !== outside);
    // Dijkstra through ink from the hole to the outside; going up costs more
    const dist = new Float64Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), heap = [];
    const push = (i, d) => { heap.push([d, i]); let k = heap.length - 1; while (k) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const a = 2 * k + 1, b = a + 1; let m = k; if (a < heap.length && heap[a][0] < heap[m][0]) m = a; if (b < heap.length && heap[b][0] < heap[m][0]) m = b; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    for (let i = 0; i < N; i++) if (lab[i] === hole) { dist[i] = 0; push(i, 0); }
    let end = -1;
    while (heap.length) { const [d, i] = pop(); if (d > dist[i]) continue; if (lab[i] === outside) { end = i; break; }
      const x = i % W, y = (i / W) | 0;
      for (const [j, c] of [[x > 0 ? i - 1 : -1, 1], [x < W - 1 ? i + 1 : -1, 1], [y > 0 ? i - W : -1, 1.6], [y < H - 1 ? i + W : -1, 1]]) {
        if (j < 0 || (lab[j] >= 0 && lab[j] !== outside)) continue; const nd = d + c; if (nd < dist[j]) { dist[j] = nd; from[j] = i; push(j, nd); } } }
    if (end < 0) return;
    g.save(); g.globalCompositeOperation = "destination-out"; g.fillStyle = "#000";
    for (let i = from[end]; i >= 0 && lab[i] !== hole; i = from[i]) g.fillRect((i % W) - 3, ((i / W) | 0) - 3, 6, 6);
    g.restore();
  }
}
// pixel-edge boundary loops of the ink (alpha > 127), simplified
function trace(img, W, H) {
  const on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && img.data[(y * W + x) * 4 + 3] > 127;
  // pixel edges, ink on the right of travel; a vertex where two pixels touch corner to corner has two ways out:
  // take the one that turns the same way each time, so a pinch never short-cuts a loop
  const out = new Map(), key = (x, y) => y * (W + 2) + x;
  const add = (ax, ay, bx, by) => { const k = key(ax, ay); if (!out.has(k)) out.set(k, []); out.get(k).push([ax, ay, bx, by]); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!on(x, y)) continue;
    if (!on(x, y - 1)) add(x, y, x + 1, y);
    if (!on(x + 1, y)) add(x + 1, y, x + 1, y + 1);
    if (!on(x, y + 1)) add(x + 1, y + 1, x, y + 1);
    if (!on(x - 1, y)) add(x, y + 1, x, y);
  }
  const loops = [];
  for (const [k0, list0] of out) {
    while (list0.length) {
      let e = list0.pop(); const L = [];
      for (;;) {
        L.push([e[0], e[1]]);
        const nx = out.get(key(e[2], e[3]));
        if (!nx || !nx.length) break;
        const dx = e[2] - e[0], dy = e[3] - e[1];
        let pick = 0;
        if (nx.length > 1) pick = nx.findIndex((f) => (f[2] - f[0]) * dy - (f[3] - f[1]) * dx > 0); // turn one way
        if (pick < 0) pick = 0;
        e = nx.splice(pick, 1)[0];
      }
      if (L.length > 8) loops.push(rdp(chaikin(L), 1.0));
    }
  }
  return loops;
}
const chaikin = (L) => { let P = L; for (let r = 0; r < 2; r++) P = P.flatMap((p, i) => { const q = P[(i + 1) % P.length]; return [[0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]], [0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]]]; }); return P; };
function rdp(P, eps) {
  const keep = new Uint8Array(P.length); keep[0] = keep[P.length - 1] = 1;
  const st = [[0, P.length - 1]];
  while (st.length) { const [i, j] = st.pop(); let m = -1, dm = eps; const [ax, ay] = P[i], [bx, by] = P[j], L = Math.hypot(bx - ax, by - ay) || 1;
    for (let k = i + 1; k < j; k++) { const d = Math.abs((bx - ax) * (ay - P[k][1]) - (ax - P[k][0]) * (by - ay)) / L; if (d > dm) { dm = d; m = k; } }
    if (m > 0) { keep[m] = 1; st.push([i, m], [m, j]); } }
  const R = P.filter((_, i) => keep[i]); R.push(R[0]); return R;
}
module.exports = { make, CH, openCounters, trace };
