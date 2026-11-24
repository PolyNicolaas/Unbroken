const { trace, UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js"), { createCanvas } = require("@napi-rs/canvas");
// blocks with a narrow gap (1.3 mm) and a wide one (4 mm), a dark hairline 1 mm wide, and a V notch that narrows to a
// point (a W's), 120 mm wide: traced as outlines for the 0.84 mm needle, without and with the narrow gaps filled
function drawing() {
  const c = createCanvas(1200, 500), g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, 1200, 500); g.fillStyle = "#000";
  g.fillRect(60, 60, 240, 380); g.fillRect(312, 60, 228, 380); g.fillRect(576, 60, 224, 380);
  g.fillRect(840, 60, 9, 380); g.fillRect(880, 60, 260, 380);
  g.fillStyle = "#fff"; g.beginPath(); g.moveTo(980, 59); g.lineTo(1040, 59); g.lineTo(1010, 300); g.closePath(); g.fill();
  return c;
}
module.exports = {
  id: "E64", title: "Gaps too narrow for the needle are filled before an outline is traced",
  guards: "an outline squeezing two walls into paper narrower than the needle can draw (where they're pushed apart and wobble), and the fill eating gaps wide enough to draw or thin dark strokes",
  why: "Nicolaas (24 November 2026), on the Gateway City Big Band logo at 150 × 210 mm: why are the W's lines wavy? The W's notch tips, the slivers between serifs and between the A's thin and thick strokes are narrower than two walls a spacing apart; the outline was squeezed in and pushed out again. Filled first (a grey opening a disc the gap's half width), the outline sweeps round them.",
  how: "Draws the blocks, gaps, hairline and notch, traces the outlines at 120 mm (0.84 mm line, 1.34 mm spacing) as the app does, without the fill and with it (UNB.fillGaps on the grey, a disc of half 1.34 + 0.84 mm), and counts the line's points inside the narrow gap, the wide gap, beside the hairline and in the notch where it's narrower than 1.6 mm. Also UNB.fillGaps against a direct grey opening on random data.",
  pass: "Without the fill the line goes into the narrow gap and deep into the notch; with it, no point in the narrow gap or where the notch is under 1.6 mm wide; the wide gap and the hairline are still traced (points in the gap, and along the hairline); the fast filter matches the direct one everywhere.",
  run() {
    const c = drawing(), k = 500 / 1200, mmPx = 120 / (1080 * k); // mm per working px (the ink spans 1080 px)
    const o = { mode: "edges", spacingMM: 1.34, lineMM: 0.84, outW: 120, minLen: 0, far: 0 };
    const A = trace(c, o), B = trace(c, { ...o, fillGapPx: (1.34 + 0.84) / 2 / mmPx });
    const pts = (t) => Array.from(t.fin.final.re, (x, i) => [x / k, t.fin.final.im[i] / k]);
    const count = (t, f) => pts(t).filter(([x, y]) => f(x, y)).length;
    const narrow = (x, y) => x > 292 && x < 320 && y > 90 && y < 410,
      wide = (x, y) => x > 532 && x < 584 && y > 90 && y < 410,
      hair = (x, y) => x > 830 && x < 860 && y > 90 && y < 410,
      tip = (x, y) => y > 250 && y < 300 && Math.abs(x - 1010) < (30 * (300 - y)) / 241; // the notch under 1.6 mm wide
    // the fast disc filter against a direct one
    const w = 41, h = 29, r = 3.7, g = Float32Array.from({ length: w * h }, () => Math.random() * 255), F = UNB.fillGaps(g, w, h, r);
    const direct = (src, mn) => { const out = new Float32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = mn ? Infinity : -Infinity; for (let dy = -3; dy <= 3; dy++) { const hw = Math.floor(Math.sqrt(r * r - dy * dy)); for (let dx = -hw; dx <= hw; dx++) { const q = src[Math.min(h - 1, Math.max(0, y + dy)) * w + Math.min(w - 1, Math.max(0, x + dx))]; v = mn ? Math.min(v, q) : Math.max(v, q); } } out[y * w + x] = v; } return out; };
    const D = direct(direct(g, true), false); let off = 0; for (let i = 0; i < w * h; i++) if (Math.abs(D[i] - F[i]) > 1e-3) off++;
    return { checks: [
      check("not filled: points in the narrow gap", count(A, narrow), ">", 0),
      check("not filled: points where the notch is under 1.6 mm", count(A, tip), ">", 0),
      check("filled: points in the narrow gap", count(B, narrow), "==", 0),
      check("filled: points where the notch is under 1.6 mm", count(B, tip), "==", 0),
      check("filled: points in the wide gap (still traced)", count(B, wide), ">", 20),
      check("filled: points along the hairline (still traced)", count(B, hair), ">", 20),
      check("the fast filter against a direct one: pixels off", off, "==", 0),
    ], notes: [`narrow gap ${count(A, narrow)} → ${count(B, narrow)} points; notch tip ${count(A, tip)} → ${count(B, tip)}; wide gap ${count(B, wide)}; hairline ${count(B, hair)}`] };
  },
};
