const { UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
const E = () => ({ atoms: [], bonds: [] });
const hs = (m) => m.atoms.map((a) => a.el + a.h).join(" ");
const orders = (m) => m.bonds.map((b) => b.order).join("");
module.exports = {
  id: "E40", title: "Editing a structure: bonds, rings, elements, hydrogens and the mol block",
  guards: "a new bond at an awkward angle or on top of an atom, a ring that doesn't fuse onto the bond or atom it was put on, an aromatic ring with two double bonds on one carbon, hydrogens that don't follow the bonds and charges, and a mol block RDKit can't read",
  why: "The structure editor (v117) builds a molecule with a few gestures; the geometry and the chemistry live in the engine (UNB.molGrow, UNB.molRing, UNB.molCycleBond, UNB.molSetAtom, UNB.molErase, UNB.molHydrogens, UNB.molHit, UNB.molBlock), so they can be checked here.",
  how: "Builds ethanol (an atom, two bonds in the free direction, the last made an O), benzene (a ring on an empty spot), naphthalene (a ring on each of benzene's bonds), biphenyl (a ring on an atom), acetic acid's C=O (a bond's order cycled) and an ammonium (N⁺); erases an atom; writes a mol block.",
  pass: "Ethanol: C3 C2 O1, its bonds 1.5 long at 120° (a zigzag); benzene: 6 atoms, bonds 212121, a hydrogen on each; naphthalene, on every one of the 6 bonds: 10 atoms, 11 bonds, no carbon with two double bonds, the two shared carbons without hydrogens; biphenyl: 12 atoms, 13 bonds; a bond cycled 1 → 2 → 3 → 1; N⁺ with four bonds' worth: NH₄⁺ as N4; erasing ethanol's middle carbon leaves 2 atoms and no bonds; the mol block has the atom and bond counts and M  CHG for a charge; a tap hits the atom, a tap mid-bond the bond.",
  async run() {
    const checks = [];
    let r = UNB.molGrow(E(), null, [0, 0]); r = UNB.molGrow(r.mol, r.atom, null); r = UNB.molGrow(r.mol, r.atom, null);
    const eth = UNB.molSetAtom(r.mol, 2, "O"), A = eth.atoms;
    const ang = Math.abs(Math.atan2(A[0].y - A[1].y, A[0].x - A[1].x) - Math.atan2(A[2].y - A[1].y, A[2].x - A[1].x)) * 180 / Math.PI;
    checks.push(check("ethanol: hydrogens C3 C2 O1", +(hs(eth) === "C3 C2 O1"), "==", 1), check("… its bond length, off 1.5 by", Math.abs(UNB.molBondLength(eth) - 1.5), "<=", 0.01), check("… the angle at the middle carbon, off 120° by", Math.abs(Math.min(ang, 360 - ang) - 120), "<=", 1));
    const bz = UNB.molRing(E(), { x: 0, y: 0 }, 6, true);
    checks.push(check("benzene: 6 atoms, alternating bonds, one H each", +(bz.atoms.length === 6 && orders(bz) === "212121" && bz.atoms.every((a) => a.h === 1)), "==", 1));
    let bad = 0;
    for (let j = 0; j < 6; j++) {
      const n = UNB.molRing(bz, { bond: j }, 6, true), dbl = new Array(n.atoms.length).fill(0);
      for (const b of n.bonds) if (b.order === 2) { dbl[b.a]++; dbl[b.b]++; }
      const shared = [bz.bonds[j].a, bz.bonds[j].b];
      if (!(n.atoms.length === 10 && n.bonds.length === 11 && dbl.every((d) => d <= 1) && shared.every((i) => n.atoms[i].h === 0))) bad++;
    }
    checks.push(check("naphthalene on each of benzene's 6 bonds: wrong", bad, "==", 0));
    const bp = UNB.molRing(bz, { atom: 0 }, 6, true);
    checks.push(check("biphenyl (a ring on an atom): 12 atoms, 13 bonds", +(bp.atoms.length === 12 && bp.bonds.length === 13), "==", 1));
    let c = UNB.molCycleBond(eth, 0); const o1 = c.bonds[0].order; c = UNB.molCycleBond(c, 0); const o2 = c.bonds[0].order; c = UNB.molCycleBond(c, 0);
    checks.push(check("a bond cycled: 2, 3, then 1", +(o1 === 2 && o2 === 3 && c.bonds[0].order === 1), "==", 1));
    const nh4 = UNB.molSetAtom(UNB.molGrow(E(), null, [0, 0]).mol, 0, "N", 1);
    checks.push(check("N⁺ alone: NH₄⁺ (N4)", hs(nh4), "==", "N4"));
    const er = UNB.molErase(eth, { atom: 1 });
    checks.push(check("ethanol's middle carbon erased: 2 atoms, no bonds", +(er.atoms.length === 2 && er.bonds.length === 0), "==", 1));
    const mb = UNB.molBlock(nh4).split("\n"), mb2 = UNB.molBlock(eth).split("\n");
    checks.push(check("mol block: counts line and the charge", +(/^\s+3\s+2\s/.test(mb2[3]) && mb.some((l) => /^M  CHG  1   1   1$/.test(l)) && mb.at(-1) === "M  END"), "==", 1));
    const mid = [(A[0].x + A[1].x) / 2, (A[0].y + A[1].y) / 2], h1 = UNB.molHit(eth, A[2].x + 0.1, A[2].y, 0.5), h2 = UNB.molHit(eth, mid[0], mid[1] + 0.1, 0.5);
    checks.push(check("a tap on an atom hits it, mid-bond the bond", +(h1 && h1.atom === 2 && h2 && h2.bond === 0), "==", 1));
    return { checks, notes: `ethanol ${hs(eth)}, angle ${ang.toFixed(1)}°` };
  },
};
