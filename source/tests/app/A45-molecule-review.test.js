const A = require("../lib/app.js"), { check } = require("../lib/check.js"), fs = require("fs"), path = require("path");
const RD = path.join(__dirname, "../node_modules/@rdkit/rdkit/dist/");
const at = (page, i) => page.evaluate((i) => { const a = me.mol.atoms[i], [x, y] = meToScreen(a.x, a.y), r = $("meView").getBoundingClientRect(); return [r.left + x, r.top + y]; }, i);
const onScreen = (page) => page.evaluate(() => { const c = $("meView"), W = c.clientWidth, H = c.clientHeight; return me.mol.atoms.filter((a) => { const [x, y] = meToScreen(a.x, a.y); return x >= 0 && x <= W && y >= 0 && y <= H; }).length; });
module.exports = {
  id: "A45", title: "Molecules (October 2026 review): the Plate card's Molecule saved and undoable, the editor's Undo, redo and turning, the card after an undo, the plate hint",
  guards: "Molecule (Bonds and labels apart / One piece) lost from design files and undo, Use it after the editor's Undo saving the SMILES of the tidied structure, Ctrl/⌘ Shift Z in the editor undoing, a turned phone leaving the structure off-screen, the Molecule card's box and message left from before an undo, the plate hint saying the bonds print for a molecule without bonds, and Clean up on a carbon with five bonds not saying which atom",
  why: "Found in the October 2026 review (scratchpad hunt, area B).",
  how: "Theobromine: Molecule set to One piece, undone and redone; Caffeine picked and undone. The editor on Theobromine: an O made S, Clean up, Undo twice, Use it; then Erase, Undo and Ctrl+Shift+Z; turned from landscape to portrait on a phone; a carbon with five bonds and Clean up. The plate hint worked out for one label piece and for two label pieces without bonds.",
  pass: "molPieces is a design setting, Undo brings back Bonds and labels apart and Redo One piece; after Caffeine is undone the card shows theobromine; after the editor's Undo past Clean up no SMILES is kept, and Use it doesn't save the tidied one; Ctrl+Shift+Z redoes the erase; every atom on screen after turning; Clean up names the C with 5 bonds; the hints: 1 piece (1 piece: the label) fits … The label prints as one line, and … the labels … Each label prints as its own piece; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx, { clean: true, art: true, viewport: { width: 1180, height: 820 } }), checks = [];
    await page.route("https://unpkg.com/@rdkit/**", (r) => { const f = r.request().url().split("/").pop(); r.fulfill({ body: fs.readFileSync(RD + f), contentType: f.endsWith(".wasm") ? "application/wasm" : "text/javascript" }); });
    await page.click("[data-examples] [data-example=theobromine]:visible"); await A.idle(page, 3000);
    // the Plate card's Molecule: a design setting, undone and redone
    await page.evaluate(() => { const s = $("molPieces"); s.value = "one"; s.dispatchEvent(new Event("change", { bubbles: true })); }); await A.idle(page, 1200);
    await page.evaluate(() => undo()); await A.idle(page, 1500);
    const u1 = await page.evaluate(() => $("molPieces").value);
    await page.evaluate(() => redo()); await A.idle(page, 1500);
    const r1 = await page.evaluate(() => $("molPieces").value);
    checks.push(check("Molecule (Plate card) saved in the design", +(await page.evaluate(() => DESIGN_IDS.includes("molPieces"))), "==", 1), check("… Undo: apart, Redo: one", u1 + "," + r1, "==", "apart,one"));
    // the Molecule card after a design undo
    await page.click("#molChips [data-mol=caffeine]"); await A.idle(page, 2500);
    await page.evaluate(() => undo()); await A.idle(page, 2000);
    const card = await page.evaluate(() => ({ name: st.art.molecule && st.art.molecule.name, box: $("molIn").value, msg: $("molMsg").textContent }));
    checks.push(check("Caffeine undone: the card shows theobromine (box and message)", +(card.name === "Theobromine" && card.box === "theobromine" && /^Theobromine/.test(card.msg)), "==", 1));
    // the editor: Undo past Clean up keeps no SMILES of the tidied structure
    await page.click("#molEdit"); await page.waitForTimeout(300);
    await page.click("label[for=meES]"); await page.mouse.click(...(await at(page, 7)));
    await page.click("#meClean"); await page.waitForFunction(() => /Tidied|Couldn/.test($("meMsg").textContent), null, { timeout: 60000 });
    const tidied = await page.evaluate(() => me.smiles);
    await page.click("#meUndo"); await page.click("#meUndo");
    const back = await page.evaluate(() => ({ smiles: me.smiles, els: me.mol.atoms.map((a) => a.el).join("") }));
    await page.click("#meDone"); await A.idle(page, 2000);
    const usedS = await page.evaluate(() => st.art.molecule.smiles);
    checks.push(check("editor: Undo past Clean up and the edit, no SMILES kept", +(!!tidied && back.smiles !== tidied && back.els === "CNCNCCCONCONC"), "==", 1), check("… Use it doesn't save the tidied SMILES", +(usedS !== tidied), "==", 1));
    // Ctrl+Shift+Z in the editor redoes
    await page.click("#molEdit"); await page.waitForTimeout(300);
    await page.click("label[for=meTerase]"); await page.mouse.click(...(await at(page, 0)));
    await page.keyboard.press("Control+z"); const nU = await page.evaluate(() => me.mol.atoms.length);
    await page.keyboard.press("Control+Shift+z"); const nR = await page.evaluate(() => me.mol.atoms.length);
    checks.push(check("editor: Ctrl+Z undoes the erase, Ctrl+Shift+Z redoes it (atoms)", nU + "," + nR, "==", "13,12"));
    // too many bonds on a carbon: Clean up says so
    await page.evaluate(() => { let m = UNB.molGrow({ atoms: [], bonds: [] }, null, [0, 0]).mol; for (let k = 0; k < 5; k++) m = UNB.molGrow(m, 0, null).mol; meApply(m); });
    await page.click("#meClean"); await page.waitForTimeout(300);
    checks.push(check("Clean up on a carbon with 5 bonds names it", +/a C has 5 bonds/.test(await page.textContent("#meMsg")), "==", 1));
    await page.click("#meCancel");
    // the plate hint for a molecule without bonds (water; a salt's two ions)
    const hint = (names) => page.evaluate((names) => { const keep = st.pieces; st.pieces = { key: "", list: names.map((name) => ({ name })) }; piecePlateText({ pieces: names.map(() => ({})), copies: names.length, sets: 1, w: 5, h: 5, fits: names.length }, null, true); st.pieces = keep; return $("plateHint").textContent; }, names);
    const h1 = await hint(["OH2"]), h2 = await hint(["NH4", "Cl"]), h3 = await hint(["bonds", "O"]);
    checks.push(check("plate hint, water: one label piece", +(/^1 piece \(1 piece: the label\) fits/.test(h1) && /label prints as one line/.test(h1) && !/bonds/.test(h1)), "==", 1), check("… two ions: the labels, no bonds", +(/2 pieces: the labels\)/.test(h2) && !/bonds/.test(h2)), "==", 1), check("… with bonds: the bonds print as one line", +/bonds print as one line/.test(h3), "==", 1));
    checks.push(check("page errors", errors.length, "==", 0));
    await close();
    // a phone turned with the editor open: the structure fitted again
    const P = await A.open(ctx, { clean: true, art: true, viewport: { width: 844, height: 390 } });
    await P.page.click("[data-examples] [data-example=theobromine]:visible"); await A.idle(P.page, 3000);
    await P.page.click("#molEdit"); await P.page.waitForTimeout(500);
    await P.page.setViewportSize({ width: 390, height: 844 }); await P.page.waitForTimeout(600);
    checks.push(check("phone turned to portrait: atoms on screen (of 13)", await onScreen(P.page), "==", 13), check("page errors (phone)", P.errors.length, "==", 0));
    await P.close();
    return { checks, notes: `tidied ${tidied}; ${h1}` + (errors.length ? "  \n" + errors.join("  \n") : "") };
  },
};
