// drawing variants of a shape to approve
const { createCanvas } = require("../../../tests/node_modules/@napi-rs/canvas");
const fs = require("fs");
const loopOf = (f, n = 720) => Array.from({ length: n }, (_, i) => f((2 * Math.PI * i) / n));
// even along its length, then a Gaussian along it (sigma in the shape's own units)
function smooth(P, sigma, step = 0.25) {
  const n0 = P.length, c = [0];
  for (let i = 1; i <= n0; i++) c.push(c[i - 1] + Math.hypot(P[i % n0][0] - P[i - 1][0], P[i % n0][1] - P[i - 1][1]));
  const L = c[n0], n = Math.max(64, Math.round(L / step)), E = [];
  for (let i = 0, j = 0; i < n; i++) { const s = (i / n) * L; while (j < n0 - 1 && c[j + 1] < s) j++; const a = P[j], b = P[(j + 1) % n0], f = (s - c[j]) / Math.max(1e-9, c[j + 1] - c[j]); E.push([a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])]); }
  if (!(sigma > 0)) return E;
  const sg = sigma / (L / n), R = Math.ceil(3 * sg), w = []; let ws = 0;
  for (let k = -R; k <= R; k++) ws += w[k + R] = Math.exp(-(k * k) / (2 * sg * sg));
  return E.map((_, i) => { let x = 0, y = 0; for (let k = -R; k <= R; k++) { const p = E[(i + k + n) % n]; x += w[k + R] * p[0]; y += w[k + R] * p[1]; } return [x / ws, y / ws]; });
}
function sheet(file, items) {
  const W = 300, H = 330, cv = createCanvas(W * items.length, H), g = cv.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
  items.forEach(([label, P], i) => {
    const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]), k = 220 / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2, ox = i * W + W / 2, oy = H / 2 + 15;
    g.fillStyle = "#f6efe9"; g.strokeStyle = "#5a3a22"; g.lineWidth = 3; g.beginPath();
    P.forEach(([x, y], j) => { const X = ox + (x - cx) * k, Y = oy - (y - cy) * k; j ? g.lineTo(X, Y) : g.moveTo(X, Y); });
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#222"; g.font = "bold 20px sans-serif"; g.fillText(label, i * W + 14, 30);
  });
  fs.writeFileSync(file, cv.toBuffer("image/png"));
}
module.exports = { loopOf, smooth, sheet };
const qb = (a, c, b, n = 80) => Array.from({ length: n }, (_, i) => { const t = i / n, u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; });
const ln = (a, b, n = 80) => qb(a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b, n);
const polyline = (pts) => pts.flatMap((p, i) => ln(p, pts[(i + 1) % pts.length]));
const rot = (P, a) => P.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
Object.assign(module.exports, { qb, ln, polyline, rot });
