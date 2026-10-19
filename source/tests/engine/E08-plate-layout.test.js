const S = require("../lib/scenes.js"), { trace, UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
const BED = { w: 340, h: 232 };
// a design's printed line in mm (y up), scaled to a given width
function design(r, widthMM) {
  const f = r.fin.final, n = f.re.length; let x0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < n; i++) { x0 = Math.min(x0, f.re[i]); x1 = Math.max(x1, f.re[i]); y1 = Math.max(y1, f.im[i]); }
  const k = widthMM / (x1 - x0);
  return { x: Float64Array.from(f.re, (v) => (v - x0) * k), y: Float64Array.from(f.im, (v) => (y1 - v) * k) };
}
module.exports = {
  id: "E08", title: "Copies are packed on the plate without touching",
  guards: "copies printed off the plate or into each other",
  why: "Copies are rotated and packed onto the 340 × 232 mm plate. A copy off the plate prints into the air or the frame; copies closer than the chosen spacing flow together.",
  how: "Lays out the leaf at 60 mm (12 and 40 copies), a 380 × 30 mm banner (1 copy; only fits rotated) and the leaf at 420 mm (fits at no angle), with 5 mm spacing and a 0.84 mm line, and checks every placed copy's printed line and footprint.",
  pass: "Every point of every placed copy lies on the plate; footprints of different copies are at least the spacing apart; the reported number that fit is never more than requested; a design that fits straight is not rotated; a design longer than the plate is rotated to fit; a design too big at any angle is reported as not fitting.",
  async run() {
    const leaf = trace(S.sample("leaf")), checks = [];
    const wave = (len, amp) => { const n = 2000; return { x: Float64Array.from({ length: n }, (_, i) => len * i / (n - 1)), y: Float64Array.from({ length: n }, (_, i) => amp + amp * Math.sin(12 * Math.PI * i / (n - 1))) }; };
    const cases = [["leaf 60 mm × 12", design(leaf, 60), 12], ["leaf 60 mm × 40", design(leaf, 60), 40], ["leaf 200 mm × 1", design(leaf, 200), 1], ["banner 380 × 30 mm × 1", wave(380, 15), 1]];
    for (const [name, d, copies] of cases) {
      const lay = UNB.plateLayout(d.x, d.y, { bedW: BED.w, bedH: BED.h, copies, gap: 5, pad: 0.42 });
      let off = 0, minGap = Infinity;
      for (const p of lay.placed) for (let i = 0; i < lay.local.x.length; i++) { const X = lay.local.x[i] + p.x, Y = lay.local.y[i] + p.y; if (X < -1e-6 || Y < -1e-6 || X > BED.w + 1e-6 || Y > BED.h + 1e-6) off++; }
      for (let a = 0; a < lay.placed.length; a++) for (let b = a + 1; b < lay.placed.length; b++) {
        const A = lay.placed[a], B = lay.placed[b], dx = Math.max(0, Math.abs(A.x - B.x) - lay.w), dy = Math.max(0, Math.abs(A.y - B.y) - lay.h);
        minGap = Math.min(minGap, Math.hypot(dx, dy));
      }
      checks.push(check(`${name}: points off the plate`, off, "==", 0), check(`${name}: copies placed ≤ requested`, lay.placed.length, "<=", copies));
      if (lay.placed.length > 1) checks.push(check(`${name}: closest footprints (mm)`, minGap, ">=", 5 - 1e-6, 2));
      if (name.startsWith("leaf 200")) checks.push(check(`${name}: not rotated (fits straight)`, lay.angle, "==", 0));
      if (name.startsWith("banner")) checks.push(check(`${name}: rotated to fit (degrees)`, lay.angle, ">", 0), check(`${name}: fits`, lay.fits, "==", 1));
    }
    const big = UNB.plateLayout(design(leaf, 420).x, design(leaf, 420).y, { bedW: BED.w, bedH: BED.h, copies: 1, gap: 5, pad: 0.42 });
    checks.push(check("leaf 420 mm (too big at any angle): reported as not fitting", big.fits, "==", 0));
    return { checks };
  },
};
