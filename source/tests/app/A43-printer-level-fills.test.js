const A = require("../lib/app.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A43", title: "Filled levels on a printer: a block set to Fill prints solid inside its traced outline",
  guards: "a printer's Fill doing nothing, filling every enclosed area, offering the plotter's pen settings, or not reaching the layers and the G-code",
  why: "On a printer a level set to Fill (v121) has its outline traced and its inside printed solid, as part of the one continuous line: the layers' infill is given a mask of the level's blocks (UNB.infill areaMask), so only those areas fill.",
  how: "Opens the still life (a printer), sets 4 levels and the darkest to Fill; looks at its row, the note, the layer line, the Print step's layers and the G-code. Then makes it for a pen plotter and back.",
  pass: "Printer rows offer Trace, Fill and Skip (no Both) and no pen settings; Fill sets the mode to Both (outline and inside), the note says it prints solid on the Print step; the wall layer's line fills at least one area and is longer than the traced line, and fewer areas than with every area filled; the G-code exports; for a pen plotter the row has the pen settings; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx, { example: "still", art: true }), checks = [];
    await page.evaluate(() => $("card-h-levels").classList.remove("collapsed"));
    await A.setValue(page, "#levels", 4); await A.idle(page, 3000);
    const labels = await page.evaluate(() => [...document.querySelectorAll("#levelList .level-row")][0].querySelectorAll("label").length);
    await page.click("label[for=level0b]"); await A.idle(page, 3000);
    const st1 = await page.evaluate(() => ({ modes: levelModes(), note: $("levelFillNote").hidden ? "" : $("levelFillNote").textContent, pens: document.querySelectorAll("#levelList .level-fill").length }));
    checks.push(check("printer: Trace, Fill, Skip per level, no pen settings", +(labels === 3 && st1.pens === 0), "==", 1), check("… Fill: outline and inside (mode b), the note says solid", +(st1.modes[0] === "b" && /prints solid/.test(st1.note)), "==", 1));
    const r = await page.evaluate(async () => { const a = await layerLine(null), all = await layerLine({ pattern: "lines", angle: 45, spacing: pxSpacing(st), minArea: 0 }); return { filled: a.filled, n: a.final.re.length, base: st.final.re.length, all: all.filled }; });
    checks.push(check("the wall layer: areas filled", r.filled, ">=", 1), check("… only the level's (fewer than every area)", +(r.filled < r.all || r.all === 1), "==", 1), check("… its line longer than the traced line (÷)", r.n / r.base, ">", 1.05));
    await page.click("#goTrace"); await A.idle(page, 600); await page.click("#goOut"); await A.idle(page, 4000);
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 40000 }), page.click("#nbGcode")]);
    checks.push(check("the G-code exports", +/gcode/.test(dl.suggestedFilename()), "==", 1));
    await page.click("label[for=artForPlot]"); await A.idle(page, 1500); await page.click("label[for=viewArt]"); await A.idle(page, 500);
    checks.push(check("pen plotter: the filled level has its pen settings", await page.evaluate(() => document.querySelectorAll("#levelList .level-fill").length), ">=", 1));
    checks.push(check("page errors", errors.length, "==", 0));
    await close();
    return { checks, notes: JSON.stringify(r) };
  },
};
