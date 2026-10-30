const { UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js"), FONTS = require("../../engine/fonts.js");
const F = (FONTS.UNB_FONTS || FONTS).sans;
const mol = (atoms, bonds) => ({ atoms: atoms.map(([el, x, y, h]) => ({ el, x, y, h, q: 0 })), bonds: bonds.map(([a, b, order]) => ({ a, b, order })) });
module.exports = {
  id: "E47", title: "An aldehyde's H is drawn on a bond of its own; a ketone's carbon stays bare",
  guards: "an aldehyde (CHO) drawn without its H, so it reads as incomplete; an H put on a ketone or an acid; the H on top of another bond",
  why: "Nicolaas (30 October 2026): an aldehyde should be a bond to an H, as chemists draw it (vanillin's CHO). v124 adds the formyl H as an atom of its own.",
  how: "Draws acetaldehyde (CH3–CH=O), formaldehyde (H2C=O), acetone and acetic acid with UNB.molecule and counts the labels; measures the angle between the aldehyde H's bond and the carbon's other two bonds.",
  pass: "Acetaldehyde: 2 labels (O and H), the H's bond 120° (±1°) from the other two; formaldehyde: 3 (O and two H); acetone: 1 (O); acetic acid: 2 (O and OH, no extra H); formylH: false leaves acetaldehyde with 1.",
  run() {
    const checks = [], lab = (m, o = {}) => UNB.molecule(m, { font: F, ...o }).labels;
    const ald = mol([["C", 0, 0, 3], ["C", 1.5, 0, 1], ["O", 2.25, 1.3, 0]], [[0, 1, 1], [1, 2, 2]]),
      form = mol([["C", 0, 0, 2], ["O", 1.5, 0, 0]], [[0, 1, 2]]),
      ket = mol([["C", 0, 0, 3], ["C", 1.5, 0, 0], ["O", 2.25, 1.3, 0], ["C", 2.25, -1.3, 3]], [[0, 1, 1], [1, 2, 2], [1, 3, 1]]),
      acid = mol([["C", 0, 0, 3], ["C", 1.5, 0, 0], ["O", 2.25, 1.3, 0], ["O", 2.25, -1.3, 1]], [[0, 1, 1], [1, 2, 2], [1, 3, 1]]);
    checks.push(check("acetaldehyde: O and H", lab(ald), "==", 2), check("formaldehyde: O and two H", lab(form), "==", 3), check("acetone: O only", lab(ket), "==", 1), check("acetic acid: O and OH only", lab(acid), "==", 2), check("formylH: false: the H left implicit", lab(ald, { formylH: false }), "==", 1));
    // the H's direction: 120° from the carbon's other bonds (it sits in the free side, clear of them)
    const r = UNB.molecule(ald, { font: F }), at = r.at, ang = (p, q) => Math.atan2(q[1] - p[1], q[0] - p[0]);
    const d = (a, b) => { let x = Math.abs(a - b) % (2 * Math.PI); return (Math.min(x, 2 * Math.PI - x) * 180) / Math.PI; };
    const h = ang(at[1], at[3]);
    checks.push(check("the H off 120° from the C–C bond (°)", Math.abs(d(h, ang(at[1], at[0])) - 120), "<=", 1), check("the H off 120° from the C=O bond (°)", Math.abs(d(h, ang(at[1], at[2])) - 120), "<=", 1));
    return { checks };
  },
};
