const A = require("../lib/app.js"), { check } = require("../lib/check.js"), fs = require("fs"), path = require("path");
const RD = path.join(__dirname, "../node_modules/@rdkit/rdkit/dist/");
// RDKit from the test kit's own copy (the app loads it from a CDN), and PubChem answered here: caffeine known, anything else not
async function offline(page) {
  await page.route("https://unpkg.com/@rdkit/**", (r) => { const f = r.request().url().split("/").pop(); r.fulfill({ body: fs.readFileSync(RD + f), contentType: f.endsWith(".wasm") ? "application/wasm" : "text/javascript" }); });
  await page.route("https://pubchem.ncbi.nlm.nih.gov/**", (r) => /\/name\/caffeine\//.test(r.request().url())
    ? r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ PropertyTable: { Properties: [{ CID: 2519, SMILES: "CN1C=NC2=C1C(=O)N(C(=O)N2C)C" }] } }) })
    : r.fulfill({ status: 404, headers: { "access-control-allow-origin": "*" }, body: "{}" }));
}
const said = (page, re) => page.waitForFunction((s) => new RegExp(s).test($("molMsg").textContent), re.source, { timeout: 60000 }).catch(() => {});
module.exports = {
  id: "A40", title: "The Molecule input: a name or SMILES drawn as a skeletal formula, traced or plotted as drawn",
  guards: "the examples not drawing, a SMILES or a name not laid out, a wrong name not said so, a molecule made for a pen plotter traced instead of plotted as drawn, its SVG missing strokes, and a design file losing it",
  why: "A chemist's input (v116): a structure as a skeletal formula, exact lines like text and patterns (engine UNB.molecule). Its examples come laid out; a typed SMILES is laid out by RDKit (loaded when first needed), a name is looked up on PubChem first.",
  how: "Opens the app empty with RDKit served from the test kit and PubChem answered here. Taps the Theobromine example and goes to the Print step (its pieces, the G-code, One piece); types a SMILES (paracetamol); types the name caffeine; types a name PubChem doesn't know. Makes it for a pen plotter and exports the SVG. Saves the design, picks the leaf, opens the design again.",
  pass: "Theobromine: the Molecule input in use, 13 atoms, traced into one line (the readout counts terms); on the Print step it prints in 7 pieces, the bonds and then each label, all placed together, its G-code exports, and Molecule: One piece turns the pieces off; the SMILES: 11 atoms and 11 bonds; caffeine by name: 14 atoms, its SMILES shown; the unknown name: said PubChem doesn't know it, the molecule in use unchanged; for a pen plotter: Trace off (as drawn) and the SVG has a stroke for every stroke of the drawing; the design file brings the molecule back; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx, { clean: true, art: true }), checks = [];
    await offline(page);
    await page.click("[data-examples] [data-example=theobromine]:visible"); await A.idle(page, 4000);
    const t = await page.evaluate(() => ({ kind: st.art.kind, n: st.art.molecule.mol.atoms.length, chip: $("chip").textContent }));
    checks.push(check("Theobromine: the Molecule in use, 13 atoms, traced", +(t.kind === "molecule" && t.n === 13 && /terms/.test(t.chip)), "==", 1));
    // printed in pieces: the bonds, then each label, in their places (pieces.js, Plate card: Molecule)
    await page.click("#goTrace"); await A.idle(page, 600); await page.click("#goOut"); await A.idle(page, 2000);
    await page.evaluate(() => { const s = $("molPieces"); s.value = "apart"; s.dispatchEvent(new Event("change", { bubbles: true })); }); await A.idle(page, 1000); // (One piece is the start since v126)
    await page.click("label[for=stPlate]"); await page.waitForFunction(() => st.pieces && st.pieces.list.length, null, { timeout: 60000 }).catch(() => {}); await A.idle(page, 2000);
    const pc = await page.evaluate(() => { const lay = plateNow(); return { n: st.pieces ? st.pieces.list.length : 0, first: st.pieces && st.pieces.list[0].name, hint: $("plateHint").textContent, same: lay && lay.placed.length >= 2 && lay.placed.every((p) => p.x === lay.placed[0].x && p.y === lay.placed[0].y) }; });
    checks.push(check("printer: Theobromine in 7 pieces (the bonds, then 6 labels), all in one place on the plate", +(pc.n === 7 && pc.first === "bonds" && pc.same && /bonds print as one line/.test(pc.hint)), "==", 1));
    const [gz] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), page.click("#nbGcode")]);
    checks.push(check("… its G-code exports", +/gcode/.test(gz.suggestedFilename()), "==", 1));
    await page.selectOption("#molPieces", "one"); await A.idle(page, 1500);
    checks.push(check("… Molecule: One piece turns the pieces off", +!(await page.evaluate(() => piecesOn())), "==", 1));
    await page.selectOption("#molPieces", "apart"); await page.click("label[for=viewArt]"); await A.idle(page, 500);
    await page.fill("#molIn", "CC(=O)Nc1ccc(O)cc1"); await page.click("#molGo"); await said(page, /atoms|Couldn/); await A.idle(page, 3000);
    checks.push(check("a SMILES (paracetamol): 11 atoms, 11 bonds", +/11 atoms, 11 bonds/.test(await page.textContent("#molMsg")), "==", 1));
    await page.fill("#molIn", "caffeine"); await page.click("#molGo"); await said(page, /atoms|Couldn/); await A.idle(page, 3000);
    const c = await page.evaluate(() => ({ n: st.art.molecule.mol.atoms.length, name: st.art.molecule.name, msg: $("molMsg").textContent }));
    checks.push(check("a name (caffeine): looked up, 14 atoms, its SMILES shown", +(c.n === 14 && c.name === "caffeine" && /CN1C=NC2/.test(c.msg)), "==", 1));
    await page.fill("#molIn", "notamolecule"); await page.click("#molGo"); await said(page, /Couldn/);
    checks.push(check("an unknown name: said so, caffeine still in use", +(/doesn't know it/.test(await page.textContent("#molMsg")) && (await page.evaluate(() => st.art.molecule.name)) === "caffeine"), "==", 1));
    // the tip (v122): a SMILES from Wikipedia; its link searches for a typed name, not for a SMILES
    const wiki = await page.evaluate(() => { const l = $("molWiki"); return { name: l.href, tip: !$("molTip").hidden && /SMILES/.test($("molTip").textContent) && /SMILES/.test($("molMsg").textContent) }; });
    await page.fill("#molIn", "CCO");
    const wiki2 = await page.evaluate(() => $("molWiki").href);
    checks.push(check("the tip: a SMILES from Wikipedia, also on a name it doesn't know", +wiki.tip, "==", 1), check("its link searches Wikipedia for the name typed", +/search=notamolecule$/.test(wiki.name), "==", 1), check("a SMILES typed: the plain search page", +!/search=/.test(wiki2), "==", 1));
    // a pen plotter: as drawn, every stroke in the SVG
    await page.click("label[for=artForPlot]"); await A.idle(page, 2500);
    const mode = await page.evaluate(() => lineModeNow()), strokes = await page.evaluate(() => moleculeDrawn().r.paths.length);
    await page.click("#goTrace"); await A.idle(page, 400); await page.click("#goOut"); await A.idle(page, 1500);
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#nbSvg")]);
    const svg = fs.readFileSync(await dl.path(), "utf8"), moves = (svg.match(/[" ]M-?[\d.]/g) || []).length;
    checks.push(check("pen plotter: Trace off, as drawn", +(mode === "drawn"), "==", 1), check("… the SVG's strokes ÷ the drawing's", moves / strokes, "==", 1));
    // a design file
    const [df] = await Promise.all([page.waitForEvent("download"), page.click("#fileMenu summary").then(() => page.click("#saveDesign"))]);
    const file = await df.path();
    await page.click("label[for=viewArt]"); await page.click("[data-examples] [data-example=leaf]:visible"); await A.idle(page, 1500);
    await page.setInputFiles("#designFile", file); await A.idle(page, 3000);
    checks.push(check("design file: the molecule back", +(await page.evaluate(() => st.art.kind === "molecule" && st.art.molecule.name === "caffeine" && st.art.molecule.mol.atoms.length === 14)), "==", 1));
    checks.push(check("page errors", errors.filter((e) => !/404/.test(e)).length, "==", 0));
    await close();
    return { checks, notes: errors.join("  \n") };
  },
};
