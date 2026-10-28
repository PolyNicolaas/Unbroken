const { UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
// a 200 × 140 label map: level 0 a disc, level 1 a band below it, level 2 the paper
function labels() {
  const w = 200, h = 140, lab = new Uint8Array(w * h).fill(2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (Math.hypot(x - 60, y - 55) < 35) lab[y * w + x] = 0;
    else if (y >= 105 && y < 130 && x >= 20 && x < 180) lab[y * w + x] = 1;
  }
  return { lab, w, h };
}
module.exports = {
  id: "E36", title: "Fills per grey: each grey level's blocks filled with its own style, inside its edges",
  guards: "a fill that strays outside its grey or onto the grey's edge, hatch rows at the wrong spacing or angle, cross-hatch without its second direction, rings that don't step in, a pattern that isn't cut to the grey, and a grey with no pixels that still draws",
  why: "Making it for a pen plotter, a grey level set to Fill or Both has its blocks filled with its own pen (UNB.levelFills): hatch, cross-hatch, rings stepping in from the edge, or the Pattern card's pattern cut to the blocks. The blocks are exactly the grey's pixels, so a grey that isn't traced still stops its fill at its edges.",
  how: "Makes a label map with a disc, a band and the paper; fills the disc with hatch (5 px, 0°), cross-hatch, rings (4 px) and a Labyrinth pattern, and the band with hatch at 90°; fills a level that has no pixels; checks every stroke point against the label map and the inset, the hatch rows' spacing and direction, the cross-hatch's two directions, the rings' count against the disc's radius.",
  pass: "Every point of every fill lies on its own grey, at least the inset (1 px) inside its edge; the hatch's rows run at 0° (or 90°), 5 px apart (±0.6 px); cross-hatch has rows both ways; the rings step in about radius ÷ spacing times (±2); the pattern's strokes all lie on the disc and there are more than 5 (one closed maze cut by the disc); an empty grey draws nothing.",
  async run() {
    const checks = [], { lab, w, h } = labels(), pat = UNB.pattern("labyrinth", { detail: 12 });
    const [hatch, cross, rings, patt, band, none] = UNB.levelFills(lab, w, h, [
      { level: 0, style: "hatch", spacing: 5, angle: 0, inset: 1 },
      { level: 0, style: "cross", spacing: 5, angle: 0, inset: 1 },
      { level: 0, style: "rings", spacing: 4, inset: 1 },
      { level: 0, style: "pattern", pattern: pat, inset: 1 },
      { level: 1, style: "hatch", spacing: 5, angle: 90, inset: 1 },
      { level: 7, style: "hatch", spacing: 5, angle: 0, inset: 1 },
    ]);
    // every point on its grey and inside the inset (a pixel's own distance to the nearest other grey)
    const outOf = (lv) => { const m = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) m[i] = lab[i] === lv ? 0 : 1; return UNB.edt(m, w, h).dist; };
    const d0 = outOf(0), d1 = outOf(1);
    let off = 0;
    const test = (strokes, lv, d) => { for (const s of strokes) for (let i = 0; i < s.length; i += 2) { const k = Math.round(s[i + 1]) * w + Math.round(s[i]); if (lab[k] !== lv || d[k] < 0.99) off++; } };
    for (const s of [hatch, cross, rings, patt]) test(s, 0, d0);
    test(band, 1, d1);
    checks.push(check("fill points off their grey or inside the inset", off, "==", 0));
    // hatch rows: horizontal, 5 px apart
    const ys = [...new Set(hatch.map((s) => Math.round(s[1] * 10) / 10))].sort((a, b) => a - b), gaps = ys.slice(1).map((y, i) => y - ys[i]);
    const flat = hatch.every((s) => Math.abs(s[s.length - 1] - s[1]) < 0.01);
    checks.push(check("hatch at 0°: rows level", +flat, "==", 1), check("… rows 5 px apart (furthest off, px)", Math.max(...gaps.map((g) => Math.abs(g - 5))), "<=", 0.6));
    const upright = band.every((s) => Math.abs(s[s.length - 2] - s[0]) < 0.01);
    checks.push(check("hatch at 90° in the band: rows upright", +upright, "==", 1));
    const level = cross.filter((s) => Math.abs(s[s.length - 1] - s[1]) < 0.01).length, up = cross.filter((s) => Math.abs(s[s.length - 2] - s[0]) < 0.01).length;
    checks.push(check("cross-hatch: rows both ways (the fewer)", Math.min(level, up), ">", 5));
    checks.push(check("rings stepping in (rings ÷ (radius − inset) / spacing)", rings.length / ((35 - 1) / 4), ">=", 0.75), check("… (not many more)", rings.length / ((35 - 1) / 4), "<=", 1.3));
    checks.push(check("pattern cut to the disc: pieces", patt.length, ">", 5), check("a grey with no pixels: strokes", none.length, "==", 0));
    return { checks, notes: `hatch ${hatch.length}, cross ${cross.length}, rings ${rings.length}, pattern ${patt.length}, band ${band.length} strokes` };
  },
};
