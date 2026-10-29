const A = require("../lib/app.js"), { check } = require("../lib/check.js"), fs = require("fs"), path = require("path");
const RD = path.join(__dirname, "../node_modules/@rdkit/rdkit/dist/");
const at = (page, i) => page.evaluate((i) => { const a = me.mol.atoms[i], [x, y] = meToScreen(a.x, a.y), r = $("meView").getBoundingClientRect(); return [r.left + x, r.top + y]; }, i);
const state = (page) => page.evaluate(() => ({ n: me.mol.atoms.length, b: me.mol.bonds.length, els: me.mol.atoms.map((a) => a.el + a.h + (a.q ? (a.q > 0 ? "+" : "-") : "")).join(" "), orders: me.mol.bonds.map((b) => b.order).join("") }));
module.exports = {
  id: "A41", title: "The structure editor: atoms, bonds, rings, elements and charges by tap and drag, Undo, Clean up, Use it",
  guards: "a tap or drag that doesn't add what it should, a bond that won't go double or triple, an element or charge that doesn't take, Erase or Undo doing nothing, Clean up not tidying, Cancel changing the molecule, and Use it not making the structure the Molecule input",
  why: "A chemist draws structures that aren't in a database (v117): Draw or edit… on the Molecule card opens an editor on the preview, touch first. The geometry and chemistry are the engine's (E40); this checks the gestures reach them.",
  how: "Opens the Molecule input, then Draw or edit… (empty). Taps a space (a carbon), drags from it (a bond), taps the new atom (grows the chain), picks O and taps the end (ethanol); taps the first bond twice (double, triple) and once more (single); picks + and taps the O; erases and undoes; puts a benzene on a space; Clean up (RDKit from the test kit); Use it. Then opens Theobromine's structure and cancels.",
  pass: "Ethanol: C3 C2 O1 with two bonds; the bond cycles 2, 3, 1; + makes the O O2+ (its hydrogens follow the charge); Erase takes an atom and Undo brings it back; a benzene adds 6 atoms with bonds 212121; Clean up says Tidied with a SMILES; Use it: the Molecule input in use with that structure (its atoms), traced; Cancel on Theobromine leaves it as it was; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx, { clean: true, art: true, viewport: { width: 1180, height: 820 } }), checks = [];
    await page.route("https://unpkg.com/@rdkit/**", (r) => { const f = r.request().url().split("/").pop(); r.fulfill({ body: fs.readFileSync(RD + f), contentType: f.endsWith(".wasm") ? "application/wasm" : "text/javascript" }); });
    await page.click("label[for=srcMolecule]"); await A.idle(page, 400);
    await page.click("#molEdit"); await page.waitForTimeout(300);
    const box = await page.locator("#meView").boundingBox(), cx = box.x + box.width * 0.35, cy = box.y + box.height * 0.5;
    await page.mouse.click(cx, cy);
    let p = await at(page, 0);
    await page.mouse.move(...p); await page.mouse.down(); await page.mouse.move(p[0] + 30, p[1] - 20); await page.mouse.move(p[0] + 60, p[1] - 35); await page.mouse.up();
    await page.mouse.click(...(await at(page, 1)));
    await page.click("label[for=meEO]"); await page.mouse.click(...(await at(page, 2)));
    const eth = await state(page);
    checks.push(check("ethanol by tap, drag, tap and O", +(eth.n === 3 && eth.b === 2 && eth.els === "C3 C2 O1"), "==", 1));
    const mid = await page.evaluate(() => { const [a, b] = [me.mol.atoms[0], me.mol.atoms[1]], [x, y] = meToScreen((a.x + b.x) / 2, (a.y + b.y) / 2), r = $("meView").getBoundingClientRect(); return [r.left + x, r.top + y]; });
    const cyc = [];
    for (let k = 0; k < 3; k++) { await page.mouse.click(...mid); cyc.push((await state(page)).orders[0]); }
    checks.push(check("a bond tapped: double, triple, single", cyc.join(""), "==", "231"));
    await page.click("label[for=meEplus]"); await page.mouse.click(...(await at(page, 2)));
    checks.push(check("+ on the O: O2+ (its hydrogens follow)", (await state(page)).els.split(" ")[2], "==", "O2+"));
    await page.click("label[for=meTerase]"); await page.mouse.click(...(await at(page, 2)));
    const erased = (await state(page)).n;
    await page.click("#meUndo");
    checks.push(check("Erase takes the O, Undo brings it back", +(erased === 2 && (await state(page)).n === 3), "==", 1));
    await page.click("label[for=meTbenzene]"); await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.5);
    const bz = await state(page);
    checks.push(check("a benzene on a space: 6 more atoms, bonds 212121", +(bz.n === 9 && bz.orders.endsWith("212121")), "==", 1));
    // join the benzene to the chain: a bond dragged from the O to a ring atom
    await page.click("label[for=meTbond]"); await page.click("label[for=meEC]");
    const o = await at(page, 2), ringAt = await page.evaluate(() => { let best = 3, d = Infinity; const O = me.mol.atoms[2]; for (let i = 3; i < me.mol.atoms.length; i++) { const a = me.mol.atoms[i], q = Math.hypot(a.x - O.x, a.y - O.y); if (q < d) (d = q), (best = i); } return best; });
    const r1 = await at(page, ringAt);
    await page.mouse.move(...o); await page.mouse.down(); await page.mouse.move((o[0] + r1[0]) / 2, (o[1] + r1[1]) / 2); await page.mouse.move(...r1); await page.mouse.up();
    await page.click("#meClean"); await page.waitForFunction(() => /Tidied|Couldn/.test($("meMsg").textContent), null, { timeout: 60000 });
    const tidy = await page.textContent("#meMsg");
    checks.push(check("Clean up: tidied, a SMILES", +/Tidied · \S+/.test(tidy), "==", 1));
    const nAtoms = (await state(page)).n;
    await page.click("#meDone"); await A.idle(page, 4000);
    const used = await page.evaluate(() => ({ kind: st.art.kind, n: st.art.molecule.mol.atoms.length, open: !$("molEd").hidden, chip: $("chip").textContent }));
    checks.push(check("Use it: the Molecule input, that structure, traced", +(used.kind === "molecule" && used.n === nAtoms && !used.open && /terms/.test(used.chip)), "==", 1));
    // Cancel leaves the molecule as it was
    await page.click("#molChips [data-mol=theobromine]"); await A.idle(page, 2500);
    const before = await page.evaluate(() => st.art.molecule.mol);
    await page.click("#molEdit"); await page.waitForTimeout(200);
    await page.click("label[for=meTerase]"); await page.mouse.click(...(await at(page, 0)));
    await page.click("#meCancel"); await A.idle(page, 500);
    checks.push(check("Cancel: Theobromine as it was", +(await page.evaluate((b) => JSON.stringify(st.art.molecule.mol) === JSON.stringify(b) && $("molEd").hidden, before)), "==", 1));
    checks.push(check("page errors", errors.length, "==", 0));
    await close();
    return { checks, notes: `ethanol ${eth.els}; ${tidy}` + (errors.length ? "  \n" + errors.join("  \n") : "") };
  },
};
