const S = require("../lib/scenes.js"), { trace } = require("../lib/trace.js"), { check } = require("../lib/check.js");
// a hexagon (a ring) with a stub sticking out of one corner: the ring can be walked once round, the stub only out and back
function ring() {
  const c = S.createCanvas(400, 400), g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, 400, 400); g.strokeStyle = "#000"; g.lineWidth = 4;
  g.beginPath(); for (let k = 0; k <= 6; k++) { const a = (k * Math.PI) / 3, x = 200 + 100 * Math.cos(a), y = 200 + 100 * Math.sin(a); k ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  g.beginPath(); g.moveTo(300, 200); g.lineTo(380, 200); g.stroke();
  return c;
}
const frac = (w) => { let d = 0; for (const v of w.dbl) d += v ? 1 : 0; return d / w.dbl.length; };
module.exports = {
  id: "E49", title: "Every edge doubled (a molecule): rings out and back like chains, the spacing kept, the line closed",
  guards: "a molecule printed with some bonds single (a ring walked once round) and others as pairs (chains, out and back), a doubled ring whose two passes run the same way (one on top of the other), and an open line that leaves its way from start to end single",
  why: "Nicolaas (30 October 2026): traced as one line, a molecule's ring bonds printed single and its chains double, which looks inconsistent. v126 walks every bond of a molecule out and back (doubleAll).",
  how: "Traces a hexagon with a stub (100 mm wide, 18G needle, 0.5 mm gap) as usual and with doubleAll, closed and asked to be open; reads the share of the walk drawn twice, the line's length, the closest gap and crossings.",
  pass: "As usual some of it is single (under 50% doubled); with doubleAll all of it is doubled (99%: a loop's closing point has no edge), the line over 1.6× as long, the closest gap ≥ 90% of the spacing and no crossings; asked to be open, doubleAll still closes the line and doubles all of it.",
  run() {
    const c = ring(), o = { spacingMM: 1.34, lineMM: 0.84, outW: 100 };
    const len = (r) => { const re = r.fin.final.re, im = r.fin.final.im; let L = 0; for (let i = 1; i < re.length; i++) L += Math.hypot(re[i] - re[i - 1], im[i] - im[i - 1]); return L; };
    const a = trace(c, o), b = trace(c, { ...o, doubleAll: true }), op = trace(c, { ...o, doubleAll: true, open: true });
    return { checks: [
      check("as usual: doubled share", frac(a.walk), "<", 0.5),
      check("doubleAll: doubled share", frac(b.walk), ">=", 0.99),
      check("doubleAll: line length ÷ usual", len(b) / len(a), ">", 1.6),
      check("doubleAll: closest gap (spacings)", b.fin.gap / b.dpx, ">=", 0.9),
      check("doubleAll: crossings", b.fin.after, "==", 0),
      check("asked open: closed, all doubled", +(!op.walk.open && frac(op.walk) >= 0.99), "==", 1),
    ] };
  },
};
