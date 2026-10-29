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
  how: "Opens the app empty with RDKit served from the test kit and PubChem answered here. Taps the Theobromine example; types a SMILES (paracetamol); types the name caffeine; types a name PubChem doesn't know. Makes it for a pen plotter and exports the SVG. Saves the design, picks the leaf, opens the design again.",
  pass: "Theobromine: the Molecule input in use, 13 atoms, traced into one line (the readout counts terms); the SMILES: 11 atoms and 11 bonds; caffeine by name: 14 atoms, its SMILES shown; the unknown name: said PubChem doesn't know it, the molecule in use unchanged; for a pen plotter: Trace off (as drawn) and the SVG has a stroke for every stroke of the drawing; the design file brings the molecule back; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx, { clean: true, art: true }), checks = [];
    await offline(page);
    await page.click("#examplesRow [data-example=theobromine]"); await A.idle(page, 4000);
    const t = await page.evaluate(() => ({ kind: st.art.kind, n: st.art.molecule.mol.atoms.length, chip: $("chip").textContent }));
    checks.push(check("Theobromine: the Molecule in use, 13 atoms, traced", +(t.kind === "molecule" && t.n === 13 && /terms/.test(t.chip)), "==", 1));
    await page.fill("#molIn", "CC(=O)Nc1ccc(O)cc1"); await page.click("#molGo"); await said(page, /atoms|Couldn/); await A.idle(page, 3000);
    checks.push(check("a SMILES (paracetamol): 11 atoms, 11 bonds", +/11 atoms, 11 bonds/.test(await page.textContent("#molMsg")), "==", 1));
    await page.fill("#molIn", "caffeine"); await page.click("#molGo"); await said(page, /atoms|Couldn/); await A.idle(page, 3000);
    const c = await page.evaluate(() => ({ n: st.art.molecule.mol.atoms.length, name: st.art.molecule.name, msg: $("molMsg").textContent }));
    checks.push(check("a name (caffeine): looked up, 14 atoms, its SMILES shown", +(c.n === 14 && c.name === "caffeine" && /CN1C=NC2/.test(c.msg)), "==", 1));
    await page.fill("#molIn", "notamolecule"); await page.click("#molGo"); await said(page, /Couldn/);
    checks.push(check("an unknown name: said so, caffeine still in use", +(/doesn't know it/.test(await page.textContent("#molMsg")) && (await page.evaluate(() => st.art.molecule.name)) === "caffeine"), "==", 1));
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
    await page.click("label[for=viewArt]"); await page.click("#examplesRow [data-example=leaf]"); await A.idle(page, 1500);
    await page.setInputFiles("#designFile", file); await A.idle(page, 3000);
    checks.push(check("design file: the molecule back", +(await page.evaluate(() => st.art.kind === "molecule" && st.art.molecule.name === "caffeine" && st.art.molecule.mol.atoms.length === 14)), "==", 1));
    checks.push(check("page errors", errors.filter((e) => !/404/.test(e)).length, "==", 0));
    await close();
    return { checks, notes: errors.join("  \n") };
  },
};
