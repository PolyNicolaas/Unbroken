// morph fonts from display fonts: each capital drawn from the font file at cap 700 units, made bolder by `bold`
// units all round (so hairlines reach a printable width), counters given a hairline opening, traced to outlines
const { createCanvas, GlobalFonts } = require("../../../tests/node_modules/@napi-rs/canvas");
const gen = require("./gen.js");
const CH = gen.CH;
function fromFile(o) {
  GlobalFonts.registerFromPath(o.file, o.family);
  const K = 1.2, probe = createCanvas(10, 10).getContext("2d");
  probe.font = `100px "${o.family}"`;
  const capPx = probe.measureText("H").actualBoundingBoxAscent, size = (700 * K * 100) / capPx, out = {};
  for (const ch of CH) {
    probe.font = `${size}px "${o.family}"`;
    const m = probe.measureText(ch), pad = 300, inkW = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    const W = Math.ceil(inkW + 2 * pad * K), H = Math.ceil((700 + 2 * pad) * K), cv = createCanvas(W, H), g = cv.getContext("2d");
    g.font = `${size}px "${o.family}"`; g.fillStyle = "#000"; g.strokeStyle = "#000"; g.lineJoin = "round";
    const x = pad * K + m.actualBoundingBoxLeft, y = (700 + pad) * K;
    g.fillText(ch, x, y);
    if (o.bold) { g.lineWidth = 2 * o.bold * K; g.strokeText(ch, x, y); }
    gen.openCounters(g, W, H);
    const loops = gen.trace(g.getImageData(0, 0, W, H), W, H);
    const s = loops.map((L) => L.map(([px, py]) => `${Math.round(px / K - pad)},${Math.round(700 + pad - py / K)}`).join(" ")).join("|");
    out[ch] = [Math.round((m.actualBoundingBoxLeft + m.actualBoundingBoxRight) / K + 2 * (o.bold || 0)), s];
  }
  return { name: o.name, glyphs: out, cap: 700 };
}
module.exports = { fromFile };
