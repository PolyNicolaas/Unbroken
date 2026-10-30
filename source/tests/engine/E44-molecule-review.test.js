const { UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js"), FONTS = require("../../engine/fonts.js"), fs = require("fs"), path = require("path"), vm = require("vm");
// the app's own examples (web-app/js/molecule.js MOL_EXAMPLES), laid out as RDKit gives them
function examples() {
  const s = fs.readFileSync(path.resolve(__dirname, "../../../web-app/js/molecule.js"), "utf8"), box = {};
  vm.runInNewContext(s.slice(s.indexOf("const MOL_EXAMPLES"), s.indexOf("const molOf")) + "\nbox.X = MOL_EXAMPLES;", { box });
  return box.X.map((e) => ({ key: e.key, atoms: e.atoms.map(([el, h, q, x, y]) => ({ el, h, q, x, y })), bonds: e.bonds.map(([a, b, order]) => ({ a, b, order })) }));
}
// the closest a bond's stroke comes to a label's strokes (bond lengths)
function closest(r) {
  const d = (a, b, c) => { const dx = c[0] - b[0], dy = c[1] - b[1], L = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((a[0] - b[0]) * dx + (a[1] - b[1]) * dy) / L)); return Math.hypot(b[0] + t * dx - a[0], b[1] + t * dy - a[1]); };
  const cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const seg = (p, q, u, v) => (cr(p, q, u) * cr(p, q, v) < 0 && cr(u, v, p) * cr(u, v, q) < 0 ? 0 : Math.min(d(p, u, v), d(q, u, v), d(u, p, q), d(v, p, q)));
  let m = Infinity;
  r.paths.forEach((b, i) => { if (r.owner[i] !== -1) return; r.paths.forEach((l, j) => { if (r.owner[j] < 0) return; for (let k = 0; k + 3 < l.length; k += 2) m = Math.min(m, seg([b[0], b[1]], [b[2], b[3]], [l[k], l[k + 1]], [l[k + 2], l[k + 3]])); }); });
  return m;
}
const E = () => ({ atoms: [], bonds: [] });
module.exports = {
  id: "E44", title: "Molecules (October 2026 review): an NH's H clear of the bonds, every element, charged atoms' hydrogens, too many bonds named",
  guards: "an NH label's H drawn on a bond (the bonds piece and the label piece printing the same strokes twice), uranium or radium read as ?, wrong hydrogens on a charged atom (BH₄⁻ as BH₂⁻, N²⁺ as NH₄²⁺), and a carbon with five bonds sent to RDKit without saying which atom is wrong",
  why: "Found in the October 2026 review: the H of theobromine's and capsaicin's NH was put on the side away from the bonds' sum, which in a ring or a chain is often on a bond; the element list stopped at radon; a charge shifted the valence by a rule that only fits N and O; and Clean up only said RDKit couldn't read the structure.",
  how: "Draws every example (theobromine, capsaicin, …) and measures how close a bond's stroke comes to a label's; reads RDKit JSON atoms 88, 92 and 94; works out the hydrogens of a lone B⁻, N²⁺ and C²⁻ on one bond, and of N⁺ with four; asks UNB.molOverBonded about a carbon with five bonds and about ethane.",
  pass: "No bond within 0.1 bond lengths of any label's strokes in any example; Ra, U, Pu; B⁻ alone BH₄⁻ (B4), N²⁺ on one bond N2, C²⁻ on one bond C1, N⁺ with four bonds N0; the five-bonded carbon named (C, 5, at most 4) and ethane fine.",
  async run() {
    const checks = [], font = FONTS.sans, near = [];
    for (const e of examples()) { const m = closest(UNB.molecule(e, { font })); if (m < 0.1) near.push(`${e.key} ${m.toFixed(3)}`); }
    checks.push(check(`examples with a bond within 0.1 of a label's strokes${near.length ? " (" + near.join(", ") + ")" : ""}`, near.length, "==", 0));
    const J = { molecules: [{ atoms: [{ z: 88 }, { z: 92 }, { z: 94 }], bonds: [] }] };
    checks.push(check("RDKit JSON: Ra, U, Pu read", UNB.molFromRDKit(J).atoms.map((a) => a.el).join(" "), "==", "Ra U Pu"));
    const lone = (el, q) => UNB.molSetAtom(UNB.molGrow(E(), null, [0, 0]).mol, 0, el, q).atoms[0].h;
    const one = (el, q) => UNB.molSetAtom(UNB.molGrow(UNB.molGrow(E(), null, [0, 0]).mol, 0, null).mol, 0, el, q).atoms[0].h;
    let four = UNB.molGrow(E(), null, [0, 0]).mol; for (let k = 0; k < 4; k++) four = UNB.molGrow(four, 0, null).mol;
    checks.push(check("B⁻ alone: BH₄⁻", lone("B", -1), "==", 4), check("N²⁺ on one bond: NH₂²⁺", one("N", 2), "==", 2), check("C²⁻ on one bond: CH²⁻", one("C", -2), "==", 1), check("N⁺ with four bonds: no H", UNB.molSetAtom(four, 0, "N", 1).atoms[0].h, "==", 0));
    const five = UNB.molGrow(four, 0, null).mol, over = UNB.molOverBonded(five), eth = UNB.molGrow(UNB.molGrow(E(), null, [0, 0]).mol, 0, null).mol;
    checks.push(check("a carbon with five bonds named (C, 5, at most 4)", +(over.length === 1 && over[0].atom === 0 && over[0].el === "C" && over[0].bonds === 5 && over[0].most === 4), "==", 1), check("ethane: no atom over", UNB.molOverBonded(eth).length, "==", 0));
    return { checks, notes: near.length ? near.join(", ") : "every example clear" };
  },
};
