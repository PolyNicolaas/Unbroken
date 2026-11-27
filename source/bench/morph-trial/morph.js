// Prototype: pairing two plans for a morphing loft, and checking the laps in between.
const { UNB } = require("./shapes.js");

// ---- a plan table: a closed loop, unit reach, centred on its area's middle, evenly spaced, from +x ----
function table(pts, M = 2880) {
  // centre on area centroid
  let A = 0, cx = 0, cy = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n], k = x0 * y1 - x1 * y0;
    A += k; cx += (x0 + x1) * k; cy += (y0 + y1) * k;
  }
  cx /= 3 * A; cy /= 3 * A;
  let P = pts.map(([x, y]) => [x - cx, y - cy]);
  if (A < 0) P.reverse();
  const mx = Math.max(...P.map((p) => Math.hypot(p[0], p[1])));
  P = P.map((p) => [p[0] / mx, p[1] / mx]);
  // start nearest +x
  let i0 = 0, best = Infinity;
  for (let i = 0; i < P.length; i++) { const a = Math.abs(Math.atan2(P[i][1], P[i][0])); if (P[i][0] > 0 && a < best) { best = a; i0 = i; } }
  P = P.slice(i0).concat(P.slice(0, i0)); P.push(P[0]);
  const c = [0]; for (let i = 1; i < P.length; i++) c.push(c[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const L = c[c.length - 1], x = new Float64Array(M), y = new Float64Array(M);
  let j = 0;
  for (let i = 0; i < M; i++) { const s = (i / M) * L; while (j < P.length - 2 && c[j + 1] < s) j++; const f = (s - c[j]) / Math.max(1e-12, c[j + 1] - c[j]); x[i] = P[j][0] + f * (P[j + 1][0] - P[j][0]); y[i] = P[j][1] + f * (P[j + 1][1] - P[j][1]); }
  return { x, y, m: M, perimeter: L };
}
function at(T, s) {
  const u = (((s % 1) + 1) % 1) * T.m, i = Math.floor(u) % T.m, j = (i + 1) % T.m, f = u - Math.floor(u);
  return [T.x[i] + f * (T.x[j] - T.x[i]), T.y[i] + f * (T.y[j] - T.y[i])];
}

// ---- pairing ----
// turning angle at each of N samples, over a window of ±w samples (signed, radians)
function turning(T, N, w) {
  const P = []; for (let i = 0; i < N; i++) P.push(at(T, i / N));
  const k = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const a = P[(i - w + N) % N], b = P[i], c = P[(i + w) % N];
    const a1 = Math.atan2(b[1] - a[1], b[0] - a[0]), a2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
    let d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    k[i] = d;
  }
  return { P, k };
}
// warp: Float64Array(N + 1), share on A → share on B (unwrapped; warp[N] = warp[0] + 1)
function warpCorners(A, B, opt = {}) {
  const N = opt.N || 720, lam = opt.lam != null ? opt.lam : 0.08, band = Math.round(N * (opt.band || 0.18)), pen = opt.pen || 0;
  const a = turning(A, N, Math.max(2, Math.round(N / 180))), b = turning(B, N, Math.max(2, Math.round(N / 180)));
  // 1. best offset by position
  let o0 = 0, bc = Infinity;
  for (let o = 0; o < N; o++) { let s = 0; for (let i = 0; i < N; i += 2) { const p = a.P[i], q = b.P[(i + o) % N]; s += (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2; } if (s < bc) { bc = s; o0 = o; } }
  const cost = (i, j) => { const p = a.P[i % N], q = b.P[((j % N) + N) % N]; const dk = a.k[i % N] - b.k[((j % N) + N) % N]; return (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + lam * dk * dk; };
  // 2. DTW in a band round j = i + o, for a few o near o0
  let bestW = null, bestC = Infinity;
  for (let d = -3; d <= 3; d++) {
    const o = o0 + Math.round((d * N) / 72), W2 = 2 * band + 1;
    const D = new Float64Array((N + 1) * W2).fill(Infinity), from = new Int8Array((N + 1) * W2);
    // cell (i, j) with j = i + o + (q - band)
    D[0 * W2 + band] = 0;
    for (let i = 0; i <= N; i++) for (let q = 0; q < W2; q++) {
      if (i === 0 && q === band) continue;
      const j = i + (q - band); // relative to o
      if (j < 0 || j > N) continue;
      const c = cost(i, j + o);
      let m = Infinity, f = 0;
      if (i > 0) { const v = D[(i - 1) * W2 + q]; if (v < m) { m = v; f = 1; } } // (i-1, j-1): same q
      if (i > 0 && q + 1 < W2) { const v = D[(i - 1) * W2 + q + 1] ; if (v < m) { m = v; f = 2; } } // (i-1, j)
      if (q > 0) { const v = D[i * W2 + q - 1]; if (v < m) { m = v; f = 3; } } // (i, j-1)
      if (m < Infinity) { D[i * W2 + q] = m + c * (f === 1 ? 1 : 0.5) + (f === 1 ? 0 : pen); from[i * W2 + q] = f; }
    }
    const end = D[N * W2 + band];
    if (end < bestC) {
      bestC = end;
      // backtrack → mean j per i
      const sum = new Float64Array(N + 1), cnt = new Float64Array(N + 1);
      let i = N, q = band;
      while (i > 0 || q !== band) {
        sum[i] += i + (q - band) + o; cnt[i]++;
        const f = from[i * W2 + q];
        if (f === 1) i--; else if (f === 2) { i--; q++; } else if (f === 3) q--; else break;
      }
      sum[0] += o; cnt[0]++;
      bestW = Array.from(sum, (s, k) => s / cnt[k]);
    }
  }
  // 3. smooth the offset (j - i), keep it increasing
  const off = bestW.map((j, i) => j - i), sm = new Float64Array(N + 1), K = Math.max(1, Math.round(N / (opt.smooth || 60)));
  for (let i = 0; i <= N; i++) { let s = 0, c = 0; for (let d = -K; d <= K; d++) { const ii = (((i + d) % N) + N) % N; s += off[ii]; c++; } sm[i] = s / c; }
  const W = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) W[i] = (i + sm[i]) / N;
  for (let i = 1; i <= N; i++) W[i] = Math.max(W[i], W[i - 1] + 0.05 / N);
  // close: W[N] must be W[0] + 1
  const err = W[N] - (W[0] + 1);
  for (let i = 0; i <= N; i++) W[i] -= (err * i) / N;
  return { W, N, cost: bestC, o0 };
}
function warpEven() { return null; }
function warpAt(w, s) {
  if (!w) return s;
  const u = (((s % 1) + 1) % 1) * w.N, i = Math.floor(u), f = u - i;
  return w.W[i] + f * (w.W[Math.min(w.N, i + 1)] - w.W[i]);
}

// ---- melt: blend the two shapes' signed distance fields ----
function sdfGrid(T, G) {
  // G: { n, lo, g }
  const n = G.n, inside = new Uint8Array(n * n);
  // scanline fill
  const P = []; for (let i = 0; i < T.m; i += 1) P.push([T.x[i], T.y[i]]);
  for (let r = 0; r < n; r++) {
    const y = G.lo + (r + 0.5) * G.g, xs = [];
    for (let i = 0; i < P.length; i++) { const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % P.length]; if ((y0 <= y) !== (y1 <= y)) xs.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0)); }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) { const c0 = Math.max(0, Math.ceil((xs[k] - G.lo) / G.g - 0.5)), c1 = Math.min(n - 1, Math.floor((xs[k + 1] - G.lo) / G.g - 0.5)); for (let c = c0; c <= c1; c++) inside[r * n + c] = 1; }
  }
  const out = UNB.edt(inside, n, n).dist, inv = new Uint8Array(n * n); for (let i = 0; i < n * n; i++) inv[i] = 1 - inside[i];
  const din = UNB.edt(inv, n, n).dist, f = new Float64Array(n * n);
  for (let i = 0; i < n * n; i++) f[i] = (inside[i] ? -(Math.sqrt(din[i]) - 0.5) : Math.sqrt(out[i]) - 0.5) * G.g;
  return f;
}
function marching(f, G, level) {
  // contours of f at level (inside: f < level); returns loops [[x,y],...]
  const n = G.n, segs = new Map(), key = (a) => a, pts = [];
  const val = (r, c) => f[r * n + c] - level;
  const P = (r, c) => [G.lo + (c + 0.5) * G.g, G.lo + (r + 0.5) * G.g];
  const edges = [];
  const ept = new Map(); // edge id → point index
  const eid = (r, c, dir) => (r * n + c) * 2 + dir; // dir 0: horizontal (r,c)-(r,c+1), 1: vertical (r,c)-(r+1,c)
  const pt = (r, c, dir) => {
    const id = eid(r, c, dir); if (ept.has(id)) return ept.get(id);
    const a = val(r, c), b = dir ? val(r + 1, c) : val(r, c + 1), t = a / (a - b);
    const [x0, y0] = P(r, c), [x1, y1] = dir ? P(r + 1, c) : P(r, c + 1);
    pts.push([x0 + t * (x1 - x0), y0 + t * (y1 - y0)]); ept.set(id, pts.length - 1); return pts.length - 1;
  };
  const adj = new Map(); const link = (a, b) => { (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); };
  for (let r = 0; r + 1 < n; r++) for (let c = 0; c + 1 < n; c++) {
    const v0 = val(r, c) < 0, v1 = val(r, c + 1) < 0, v2 = val(r + 1, c + 1) < 0, v3 = val(r + 1, c) < 0;
    const idx = (v0 ? 1 : 0) | (v1 ? 2 : 0) | (v2 ? 4 : 0) | (v3 ? 8 : 0);
    if (idx === 0 || idx === 15) continue;
    const eB = () => pt(r, c, 0), eR = () => pt(r, c + 1, 1), eT = () => pt(r + 1, c, 0), eL = () => pt(r, c, 1);
    const T = { 1: [[eL, eB]], 2: [[eB, eR]], 3: [[eL, eR]], 4: [[eR, eT]], 5: [[eL, eT], [eB, eR]], 6: [[eB, eT]], 7: [[eL, eT]], 8: [[eT, eL]], 9: [[eB, eT]], 10: [[eL, eB], [eR, eT]], 11: [[eR, eT]], 12: [[eR, eL]], 13: [[eB, eR]], 14: [[eL, eB]] }[idx];
    for (const [a, b] of T) link(a(), b());
  }
  const used = new Set(), loops = [];
  for (const s of adj.keys()) {
    if (used.has(s)) continue;
    const L = [s]; used.add(s); let prev = -1, cur = s;
    for (;;) { const nb = adj.get(cur).find((v) => v !== prev && !used.has(v)); if (nb === undefined) break; used.add(nb); L.push(nb); prev = cur; cur = nb; }
    if (L.length > 8) loops.push(L.map((i) => pts[i]));
  }
  return loops;
}
const area = (L) => { let a = 0; for (let i = 0; i < L.length; i++) { const p = L[i], q = L[(i + 1) % L.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };

function makeMelt(A, B, n = 600) {
  const G = { n, lo: -1.15, g: 2.3 / n };
  return { G, fa: sdfGrid(A, G), fb: sdfGrid(B, G) };
}
function meltLoop(M, k) {
  const { G, fa, fb } = M, f = new Float64Array(fa.length);
  for (let i = 0; i < f.length; i++) f[i] = (1 - k) * fa[i] + k * fb[i];
  const loops = marching(f, G, 0).map((L) => ({ L, a: area(L) })).sort((p, q) => Math.abs(q.a) - Math.abs(p.a));
  return { loop: loops.length ? loops[0].L : null, count: loops.length, extra: loops.slice(1).map((l) => l.a) };
}

module.exports = { table, at, warpCorners, warpAt, makeMelt, meltLoop, area };
