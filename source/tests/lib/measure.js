// Measurements against a known true line.
const UNB = require("../../engine/core.js");
const key = (x, y) => (Math.floor(x) + 4096) * 65536 + Math.floor(y) + 4096;
function grid(points) { const G = new Map(); for (const p of points) { const k = key(p[0], p[1]); let L = G.get(k); if (!L) G.set(k, (L = [])); L.push(p); } return G; }
function nearest(G, x, y, r) { let b = Infinity; const xi = Math.floor(x), yi = Math.floor(y); for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) { const L = G.get(key(xi + dx, yi + dy)); if (L) for (const p of L) { const d = Math.hypot(p[0] - x, p[1] - y); if (d < b) b = d; } } return b; }

// How far the drawn line sits from the truth: drawn line resampled every 0.5 px, connector stretches skipped,
// only points within 3 px of the truth (parts the scene doesn't describe are ignored). mean and p95 in px.
function distanceToTruth(re, im, closed, skip, truth) {
  const G = grid(truth), rs = UNB.resampleCurve(re, im, closed, 0.5, skip ? [skip] : []), d = [];
  for (let i = 0; i < rs.re.length; i++) { if (skip && rs.carry[0][i]) continue; const e = nearest(G, rs.re[i], rs.im[i], 3); if (e < 3) d.push(e); }
  d.sort((a, b) => a - b);
  return { mean: d.reduce((a, b) => a + b, 0) / Math.max(1, d.length), p95: d.length ? d[Math.floor(0.95 * (d.length - 1))] : Infinity, n: d.length };
}
// Share of the truth that has the drawn line (or traced path) within `tol` px.
function coverage(truth, xs, ys, closed, tol) {
  tol = tol || 1;
  const pts = [], n = xs.length, last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) { const j = (i + 1) % n, m = Math.max(1, Math.ceil(Math.hypot(xs[j] - xs[i], ys[j] - ys[i]) / 0.3)); for (let k = 0; k < m; k++) pts.push([xs[i] + (xs[j] - xs[i]) * k / m, ys[i] + (ys[j] - ys[i]) * k / m]); }
  const G = grid(pts); let ok = 0, cnt = 0;
  for (let i = 0; i < truth.length; i += 3) { cnt++; if (nearest(G, truth[i][0], truth[i][1], 2) < tol) ok++; }
  return ok / Math.max(1, cnt);
}
// connector samples of the final line, widened by `pad` samples, for skipping
function jumpMask(jumps, pad) { const n = jumps.length, m = new Uint8Array(n); for (let i = 0; i < n; i++) if (jumps[i]) for (let d = -pad; d <= pad; d++) m[(i + d + n) % n] = 1; return m; }

module.exports = { distanceToTruth, coverage, jumpMask };
