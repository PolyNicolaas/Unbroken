const A = require("../lib/app.js"), { check } = require("../lib/check.js");
const put = (page, rgba, w, h, name) => page.evaluate(({ b64, w, h, name }) => { const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").putImageData(new ImageData(Uint8ClampedArray.from(atob(b64), (ch) => ch.charCodeAt(0)), w, h), 0, 0); artUsePicture(c, name); }, { b64: Buffer.from(rgba.buffer).toString("base64"), w, h, name });
// a dark disc, a dark band along the bottom edge (touching the picture's border) and a mid-grey square on white
function scene() { const w = 400, h = 300, rgba = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let c = 245; if (Math.hypot(x - 120, y - 110) < 60) c = 40; else if (y > 240) c = 40; else if (x > 250 && x < 350 && y > 60 && y < 160) c = 140; rgba.set([c, c, c, 255], 4 * (y * w + x)); } return { rgba, w, h }; }
module.exports = {
  id: "A46", title: "Level fixes: levels only for a picture, an edge block filled, pens and modes kept apart, the advice and names",
  guards: "levels left on from a picture spoiling a molecule's trace, a printer's Fill skipping a block on the picture's edge, fill pens frozen from one picture into the next or into Colours, one printer tap turning the plotter's Fills into Both, the threshold advice with every level on Skip, and Colours' controls named Grey",
  why: "Levels are a picture's (the card is hidden for the rest), but the prep applied them to molecules and patterns too; a filled block on the edge had an open outline; a fill edit saved every level's whole spec, colours worked out from the picture included; a printer tap saved its own view of the modes (Fill as Both).",
  how: "Still life with 4 levels, then the theobromine example; a picture with a dark band along the bottom edge on a printer, 3 levels, the darkest on Fill, 100 mm wide; every level on Skip; a pen plotter: grey 2 on Fill, a printer tap on grey 3's Skip, back; grey 1 on Fill and its spacing edited, then Colours.",
  pass: "The molecule's prep has no levels and its trace is under 0.2 mm error; the printer fills at least 2 areas (the disc and the band); every level on Skip says so; the plotter's grey 2 is still Fill and grey 1 still Trace after the printer tap; after the spacing edit only the spacing is saved, and in Colours the pen is the level's colour and the controls are named Colour 1; no page errors.",
  async run(ctx) {
    const checks = [];
    let { page, errors, close } = await A.open(ctx, { example: "still", art: true });
    await page.evaluate(() => $("card-h-levels").classList.remove("collapsed"));
    await A.setValue(page, "#levels", 4); await A.idle(page, 3000);
    await page.evaluate(() => moleculeExample("theobromine")); await A.idle(page, 8000);
    const mol = await page.evaluate(() => ({ lv: !!(st.wk && st.wk.levels), set: !!levelSettings() }));
    checks.push(check("molecule after a picture with levels: no levels in its prep", +(!mol.lv && !mol.set), "==", 1), check("… its trace error (mm)", await A.errorMM(page), "<", 0.2));
    checks.push(check("page errors", errors.length, "==", 0));
    await close();
    ({ page, errors, close } = await A.open(ctx, { clean: true, art: true }));
    const S = scene(); await put(page, S.rgba, S.w, S.h, "band"); await A.idle(page, 3000);
    await page.evaluate(() => $("card-h-levels").classList.remove("collapsed"));
    await A.setValue(page, "#levels", 3); await A.idle(page, 3000);
    await page.click("label[for=level0b]"); await A.idle(page, 4000); await page.evaluate(() => setSize(100, true)); await A.idle(page, 6000);
    const f = await page.evaluate(async () => (await layerLine(null)).filled);
    checks.push(check("printer: areas filled with the band on the edge (disc and band)", f, ">=", 2));
    for (const j of [0, 1, 2]) await page.click(`label[for=level${j}s]`);
    await A.idle(page, 3000);
    checks.push(check("every level on Skip: the chip says so", +/Every level is set to Skip/.test(await page.textContent("#chip")), "==", 1));
    await page.click("label[for=artForPlot]"); await A.idle(page, 1500); await page.click("label[for=viewArt]"); await A.idle(page, 300);
    await page.click("label[for=level0t]"); await page.click("label[for=level1f]"); await A.idle(page, 1000);
    await page.click("label[for=artForPrint]"); await A.idle(page, 1500); await page.click("label[for=viewArt]"); await A.idle(page, 300);
    await page.click("label[for=level2s]"); await A.idle(page, 1000);
    await page.click("label[for=artForPlot]"); await A.idle(page, 1500); await page.click("label[for=viewArt]"); await A.idle(page, 300);
    checks.push(check("a printer tap keeps the plotter's modes", await page.evaluate(() => levelModes()), "==", "tfs"));
    await page.click("label[for=level0f]"); await A.idle(page, 2000);
    await page.evaluate(() => { const i = document.querySelector('[aria-label="Grey 1 Spacing mm"]'); i.value = 1.2; i.dispatchEvent(new Event("change")); }); await A.idle(page, 2000);
    const saved = await page.evaluate(() => JSON.parse($("levelFills").value)[0]);
    await page.click("label[for=levelColours]"); await A.idle(page, 4000);
    const c = await page.evaluate(() => ({ pen: levelFillSpecs()[0].color, hex: levelHex(0), spacing: levelFillSpecs()[0].spacing, named: !!document.querySelector('[aria-label="Colour 1 Spacing mm"]') }));
    checks.push(check("a spacing edit saves only the spacing", JSON.stringify(saved), "==", '{"spacing":1.2}'), check("Colours: the pen is the level's colour, the spacing kept", +(c.hex && c.pen === c.hex && c.spacing === 1.2), "==", 1), check("… the controls named Colour 1", +c.named, "==", 1));
    checks.push(check("page errors", errors.length, "==", 0));
    await close();
    return { checks, notes: JSON.stringify({ mol, filled: f, c }) };
  },
};
