const T = require("/home/claude/Unbroken/source/tests/lib/trace.js"), UNB = T.UNB;
const { createCanvas } = require("/home/claude/Unbroken/source/tests/node_modules/@napi-rs/canvas");
function textLoop(str, widthMM) {
  const c = createCanvas(600, 300), g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, 600, 300); g.fillStyle = "#000";
  g.font = "bold 220px sans-serif"; g.textAlign = "center"; g.fillText(str, 300, 230);
  const r = T.trace(c, { spacingMM: 1.34, outW: widthMM });
  const F = r.fin.final; if (!F) throw new Error("no trace");
  const xs = Array.from(F.re, v => v * r.scale), ys = Array.from(F.im, v => -v * r.scale);
  return { xs, ys, open: r.open, keys: Object.keys(F) };
}
module.exports = { textLoop, UNB };
if (require.main === module) { const t = textLoop("N", 40); console.log(t.xs.length, t.open, t.keys); const O = UNB.vaseLineLoop(t.xs, t.ys); console.log(O && O.loop.length, O && O.reach, O && O.exact); }
