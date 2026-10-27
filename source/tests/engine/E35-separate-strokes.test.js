const { UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
// a line map: a ring, a T (three strokes meeting), a short speck and an L corner drawn with diagonal steps
function lineMap() {
  const w = 220, h = 160, m = new Uint8Array(w * h), set = (x, y) => { m[Math.round(y) * w + Math.round(x)] = 1; };
  for (let a = 0; a < 2 * Math.PI; a += 0.004) set(50 + 30 * Math.cos(a), 50 + 30 * Math.sin(a));
  for (let x = 100; x <= 180; x++) set(x, 30);
  for (let y = 30; y <= 100; y++) set(140, y);
  set(20, 140); set(21, 140); set(22, 140);
  for (let i = 0; i <= 40; i++) set(100 + i, 140 - i * 0.5);
  return { m: UNB.thin(m, w, h), w, h };
}
module.exports = {
  id: "E35", title: "Separate strokes: a line map as strokes the pen draws one by one",
  guards: "strokes broken up along a plain line, a junction that isn't split, a closed ring drawn as an open stroke, specks kept, strokes in an order that sends the pen back and forth, and points off the drawn line",
  why: "On a pen plotter the Line step can trace the art into separate strokes instead of one continuous line (UNB.lineStrokes, UNB.stageStrokes): the pen lifts between them, so nothing is joined or doubled.",
  how: "Draws a line map with a ring, a T (three strokes meeting), a 3-pixel speck and a slanting line; traces it into strokes with a minimum length of 8 px; checks the count, the ring, every point against the line map, and the pen's travel against the same strokes in reverse order.",
  pass: "5 strokes: the ring as one closed stroke, the T as three, the slanting line as one; the speck dropped; every stroke point within 1.5 px of the line map; the strokes drawn add up to the line map's pixel count within −15% … +25% (smoothing cuts the pixel steps short); the travel between them is no more than in the reverse order.",
  async run() {
    const checks = [], { m, w, h } = lineMap(), r = UNB.lineStrokes(m, w, h, { minLen: 8 });
    checks.push(check("strokes (ring, the T's three, the slant)", r.strokes.length, "==", 5), check("closed strokes (the ring)", r.closed.filter(Boolean).length, "==", 1));
    // every point near the line map
    const near = (x, y) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const X = Math.round(x) + dx, Y = Math.round(y) + dy; if (X >= 0 && Y >= 0 && X < w && Y < h && m[Y * w + X] && Math.hypot(X - x, Y - y) <= 1.5) return true; } return false; };
    let off = 0; for (const s of r.strokes) for (let i = 0; i < s.length; i += 2) if (!near(s[i], s[i + 1])) off++;
    checks.push(check("stroke points more than 1.5 px off the line map", off, "==", 0));
    let pix = 0; for (const v of m) pix += v;
    checks.push(check("length drawn ÷ line-map pixels (diagonals count √2)", r.length / pix, ">=", 0.85), check("… (not much more)", r.length / pix, "<=", 1.25));
    const rev = r.strokes.slice().reverse(); let back = 0;
    for (let i = 1; i < rev.length; i++) { const a = rev[i - 1], b = rev[i]; back += Math.hypot(b[0] - a[a.length - 2], b[1] - a[a.length - 1]); }
    checks.push(check("pen travel ÷ the same strokes in reverse order", r.travel / Math.max(1, back), "<=", 1));
    return { checks, notes: `${r.strokes.length} strokes, ${Math.round(r.length)} px drawn, ${Math.round(r.travel)} px of travel` };
  },
};
