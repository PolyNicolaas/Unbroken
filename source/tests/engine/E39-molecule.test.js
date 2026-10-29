const { UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js"), FONTS = require("../../engine/fonts.js");
// a hexagon of carbons with alternating double bonds (benzene), and phenol (an OH on it); coordinates as RDKit gives
// them (bond 1.5, y up)
function ring(extra) {
  const atoms = [], bonds = [];
  for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i; atoms.push({ el: "C", x: 1.5 * Math.cos(a), y: 1.5 * Math.sin(a), h: 1, q: 0 }); bonds.push({ a: i, b: (i + 1) % 6, order: i % 2 ? 1 : 2 }); }
  if (extra) { atoms[0].h = 0; atoms.push({ el: "O", x: 3, y: 0, h: 1, q: 0 }); bonds.push({ a: 0, b: 6, order: 1 }); }
  return { atoms, bonds };
}
module.exports = {
  id: "E39", title: "Molecules: atoms and bonds drawn as a skeletal formula",
  guards: "a double bond's second stroke outside its ring, carbons labelled, a hetero atom unlabelled, a bond running into its label's letters, the hydrogens on the side of the bonds, and RDKit's JSON read wrong",
  why: "The Molecule input (v116) draws a structure as chemists do: bonds as strokes (double and triple ones as parallel strokes, a ring's double bonds inside the ring), carbons implied, other atoms as letters in the single-stroke font with their hydrogens (UNB.molecule). The layout comes from RDKit as JSON (UNB.molFromRDKit).",
  how: "Draws benzene (a hexagon, alternating bonds) and phenol (an OH on it), and reads a small RDKit JSON (ethanol, with its defaults and coordinates).",
  pass: "Benzene: 9 strokes (6 bonds and 3 inner ones), no letters, every inner stroke nearer the ring's centre than its bond; phenol: the O labelled with its H on the far side from the ring, the C–O bond stopping short of the O's letters; ethanol from JSON: 3 atoms, O third, 2 hydrogens… on the right atoms, and its drawing one label.",
  async run() {
    const checks = [], font = FONTS.sans;
    const b = UNB.molecule(ring(false), { font });
    checks.push(check("benzene: strokes (6 bonds, 3 inner)", b.paths.length, "==", 9), check("… labels", b.labels, "==", 0));
    // the ring's centre in the drawing: the mean of the 6 bond strokes' ends
    const outer = b.paths.filter((p) => Math.hypot(p[2] - p[0], p[3] - p[1]) > 0.95), inner = b.paths.filter((p) => Math.hypot(p[2] - p[0], p[3] - p[1]) <= 0.95);
    let cx = 0, cy = 0; for (const p of outer) { cx += p[0] + p[2]; cy += p[1] + p[3]; } cx /= outer.length * 2; cy /= outer.length * 2;
    const mid = (p) => Math.hypot((p[0] + p[2]) / 2 - cx, (p[1] + p[3]) / 2 - cy);
    checks.push(check("… inner strokes nearer the centre than the bonds (of 3)", inner.filter((p) => mid(p) < Math.min(...outer.map(mid)) - 0.05).length, "==", 3));
    const ph = UNB.molecule(ring(true), { font });
    checks.push(check("phenol: one label (the O)", ph.labels, "==", 1));
    // the O's label: the C–O bond (the stroke ending nearest the O) stops before its letters; the H's strokes beyond the O
    const O = ph.boxes.find((x) => x.el === "O"), oAt = ph.at[6], cAt = ph.at[0];
    // (the C–O bond: the stroke from the ring's carbon toward the O)
    const co = ph.paths.find((p) => p.length === 4 && [0, 2].some((k) => Math.hypot(p[k] - cAt[0], p[k + 1] - cAt[1]) < 0.01) && Math.max(p[0], p[2]) > cAt[0] + 0.3), coEnd = co ? Math.max(co[0], co[2]) : Infinity;
    checks.push(check("… the C–O bond stops short of the O's letters (gap, bond lengths)", O.rect[0] - coEnd, ">=", 0), check("… and reaches most of the way (its length, bond lengths)", co ? Math.abs(co[2] - co[0]) : 0, ">", 0.5));
    const far = Math.max(...ph.paths.map((p) => { let z = -Infinity; for (let i = 0; i < p.length; i += 2) z = Math.max(z, p[i]); return z; }));
    checks.push(check("… the H on the far side: strokes past the O's letters (bond lengths)", far - O.rect[2], ">", 0.2));
    const J = { rdkitjson: { version: 11 }, defaults: { atom: { z: 6, impHs: 0, chg: 0 }, bond: { bo: 1 } }, molecules: [{ atoms: [{ impHs: 3 }, { impHs: 2 }, { z: 8, impHs: 1 }], bonds: [{ atoms: [0, 1] }, { atoms: [1, 2] }], conformers: [{ dim: 2, coords: [[0, 0], [1.3, 0.75], [2.6, 0]] }] }] };
    const m = UNB.molFromRDKit(J), e = UNB.molecule(m, { font });
    checks.push(check("RDKit JSON: ethanol read (C, C, O; hydrogens 3, 2, 1)", +(m.atoms.map((a) => a.el + a.h).join() === "C3,C2,O1" && m.bonds.length === 2), "==", 1), check("… drawn with one label", e.labels, "==", 1));
    return { checks, notes: `benzene ${b.paths.length} strokes, phenol ${ph.paths.length}, ethanol ${e.paths.length}` };
  },
};
