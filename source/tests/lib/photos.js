// Synthetic camera photos for the photo tests: a page (with a drawing on it) seen in perspective on a darker table,
// lit unevenly, with camera grain. Pure JS (no canvas), so engine tests can use it.
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
// the drawing on the page, in page units (0–1): true where there's ink
function inkAt(u, v) {
  const r = Math.hypot(u - 0.5, v - 0.45);
  if (Math.abs(r - 0.25) < 0.012) return 1;                       // a circle
  if (Math.abs(v - 0.82) < 0.01 && u > 0.2 && u < 0.8) return 1;   // a line under it
  if (Math.abs(u - v * 0.6 - 0.25) < 0.01 && v > 0.3 && v < 0.6) return 0.55; // a faint pencil stroke
  return 0;
}
// corners of the page in the photo (TL, TR, BR, BL), px
function pagePhoto({ w = 640, h = 480, corners = [[150, 70], [500, 95], [560, 420], [95, 400]], seed = 7, shadow = 0.45, table = [70, 55, 40] } = {}) {
  const rgba = new Uint8ClampedArray(w * h * 4), R = rng(seed);
  // the inverse map photo → page via the square-to-quad homography, by search: build forward map and invert numerically
  const [p0, p1, p2, p3] = corners;
  // the square-to-quad homography (Heckbert), and its inverse: photo px → page (u, v)
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = corners;
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3, den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den, hh = (dx1 * sy - sx * dy1) / den;
  const M = [x1 - x0 + g * x1, x3 - x0 + hh * x3, x0, y1 - y0 + g * y1, y3 - y0 + hh * y3, y0, g, hh, 1];
  const [a, b, c, d, e, f, gg, h2, i9] = M;
  const I = [e * i9 - f * h2, c * h2 - b * i9, b * f - c * e, f * gg - d * i9, a * i9 - c * gg, c * d - a * f, d * h2 - e * gg, b * gg - a * h2, a * e - b * d];
  const inside = (x, y) => { const z = I[6] * x + I[7] * y + I[8]; return [(I[0] * x + I[1] * y + I[2]) / z, (I[3] * x + I[4] * y + I[5]) / z]; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [u, v] = inside(x + 0.5, y + 0.5), i = 4 * (y * w + x);
    const lamp = 1 - shadow * Math.max(0, Math.min(1, (x / w - 0.35) * 1.6)); // light falls off to the right
    let c;
    if (u >= 0 && u <= 1 && v >= 0 && v <= 1) { const k = inkAt(u, v); c = [240, 236, 226].map((p) => p * (1 - k * 0.85)); }
    else c = table;
    for (let ch = 0; ch < 3; ch++) rgba[i + ch] = c[ch] * lamp + (R() - 0.5) * 14;
    rgba[i + 3] = 255;
  }
  return { rgba, w, h, corners };
}
module.exports = { pagePhoto, inkAt };
