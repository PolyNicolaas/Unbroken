const A = require("../lib/app.js"), { check } = require("../lib/check.js"), fs = require("fs");
const vis = (page, sel) => page.isVisible(sel);
module.exports = {
  id: "A33", title: "The workflow: made for a printer or a pen plotter, Art → Line → Print or Plot, one switch for the line",
  guards: "both last steps showing (or the wrong one), the line switch offering a printer something it can't make, a picture starting untraced on the plotter, a picture on the plotter traced into one joined line instead of strokes, a pattern traced when it's plotted as drawn, the preview not following the step, and the Next buttons going nowhere",
  why: "What the art is made for comes first (a printer or a pen plotter, at the top) and decides the last step: Art → Line → Print, or Art → Line → Plot. The Line step has the one switch for how the art becomes lines: One continuous line (the Fourier trace, the only one a printer can make), Separate strokes (traced, the pen lifting between them) ; Trace off (the switch under the preview) leaves the art as drawn (a pattern's or text's own lines, nothing traced). The preview follows the step.",
  how: "Opens the app (a printer, the leaf); checks the steps, the line switch and the preview's tabs on Art, Line and Print; makes it for a pen plotter; checks the Plot step replaces Print, the leaf becomes separate strokes, the page plots them and the SVG has a path per stroke; picks a pattern (Trace off: as drawn, nothing traced), then turns Trace on with One continuous line (traced); follows Next from Art to Line to Plot; goes back to a printer.",
  pass: "For a printer: steps Art, Line, Print (no Plot), no line choices (the Line card hidden: a printer makes one continuous line), no preview tabs on Art or Line, Plate and 3D layers on Print. For a pen plotter: Plot replaces Print; the leaf is separate strokes (more than 5, the readout counts the pen lifts) shown on the line view and plotted on the page, its SVG a path per stroke; a picture starts traced (Trace on); a pattern starts with Trace off, as drawn with the page as its preview and isn't traced; One continuous line traces it (1 part); Next goes Art → Line → Plot; back to a printer, One continuous line and the Print step; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx, { art: true }), checks = [];
    checks.push(check("printer: steps Art, Line, Print", +((await vis(page, "label[for=viewArt]")) && (await vis(page, "label[for=viewDesign]")) && (await vis(page, "label[for=viewChoc]")) && !(await vis(page, "label[for=view2D]"))), "==", 1));
    checks.push(check("… no preview tabs on Art", +!(await vis(page, ".stage-tabs")), "==", 1));
    await page.click("label[for=viewDesign]"); await A.idle(page, 500);
    checks.push(check("… Line: no line choices for a printer (the Line card hidden), no preview tabs", +(!(await vis(page, "#card-h-src")) && !(await vis(page, ".stage-tabs"))), "==", 1));
    await page.click("label[for=viewChoc]"); await A.idle(page, 800);
    checks.push(check("… Print: Plate and 3D layers to pick", +((await vis(page, "label[for=stPlate]")) && (await vis(page, "label[for=stLayers]")) && !(await vis(page, "label[for=stLine]"))), "==", 1));
    // a pen plotter
    await page.click("label[for=viewArt]"); await page.click("label[for=artForPlot]"); await A.idle(page, 2500);
    checks.push(check("plotter: Plot replaces Print", +((await vis(page, "label[for=view2D]")) && !(await vis(page, "label[for=viewChoc]"))), "==", 1));
    const leaf = await page.evaluate(() => ({ mode: lineModeNow(), n: st.sepStrokes && st.sepStrokes.strokes.length, chip: $("chip").textContent, traced: $("traceOn").checked }));
    checks.push(check("… the leaf (a picture) as separate strokes (strokes)", leaf.mode === "strokes" && /pen lifts?/.test(leaf.chip) ? leaf.n : 0, ">", 5), check("… a picture starts traced (Trace on)", +leaf.traced, "==", 1));
    await page.click("#goTrace"); await A.idle(page, 500);
    checks.push(check("Next: on the Line step, the line view showing the strokes", +((await page.isChecked("#viewDesign")) && (await page.evaluate(() => document.body.dataset.stage)) === "line" && (await vis(page, "#view"))), "==", 1));
    await page.click("#goOut"); await A.idle(page, 1500);
    checks.push(check("Next: on the Plot step, the page showing the strokes", +((await page.isChecked("#view2D")) && /separate strokes/.test(await page.textContent("#pageHint"))), "==", 1));
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#exportBtn")]);
    const svg = fs.readFileSync(await dl.path(), "utf8"), n = await page.evaluate(() => st.sepStrokes.strokes.length);
    checks.push(check("… its SVG: a pen-down move per stroke (moves ÷ strokes)", (svg.match(/[" ]M-?[\d.]/g) || []).length / n, "==", 1), check("… and says it's traced into strokes", +/separate strokes/.test(svg), "==", 1));
    // a pattern: As drawn, nothing traced
    await page.click("label[for=viewArt]"); const src = await page.evaluate(() => st.source.__id);
    await page.click("label[for=srcPattern]"); await A.idle(page, 1500);
    const pat = await page.evaluate(() => ({ mode: lineModeNow(), stage: document.body.dataset.stage, untraced: st.art.untraced, src: st.source.__id }));
    checks.push(check("pattern: Trace off (as drawn), the page as its preview, nothing traced", +(pat.mode === "drawn" && pat.stage === "page" && pat.untraced && pat.src === src && !(await page.isChecked("#traceOn"))), "==", 1));
    await page.click("label[for=viewDesign]"); await page.click(".trace-switch"); await page.click("label[for=lineOne]"); await A.idle(page, 3000);
    checks.push(check("… One continuous line: traced (parts), the line view showing", +((await page.evaluate(() => document.body.dataset.stage)) === "line") * +((await page.textContent("#fitinfo")).match(/(\d+) part/) || [0, 0])[1], "==", 1));
    // back to a printer
    await page.click("label[for=artForPrint]"); await A.idle(page, 3000);
    checks.push(check("printer again: One continuous line, the Print step back", +((await page.evaluate(() => lineModeNow())) === "one" && (await vis(page, "label[for=viewChoc]")) && !(await vis(page, "label[for=view2D]"))), "==", 1));
    checks.push(check("page errors", errors.length, "==", 0));
    await close();
    return { checks, notes: errors.join("  \n") };
  },
};
