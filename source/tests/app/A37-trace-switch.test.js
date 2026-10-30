const A = require("../lib/app.js"), { check } = require("../lib/check.js"), fs = require("fs");
module.exports = {
  id: "A37", title: "The Trace switch: tracing on and off from under the preview, on every step",
  guards: "the switch missing from a step, a picture still traced with Trace off (or not shown), the Print step offering a print of an untraced picture, a turned-off trace not coming back, a pattern on the plotter traced before it's asked, a 3D model left without its slices, and older designs saved As drawn opening traced",
  why: "Turning tracing on and off is one switch under the preview (v112), on every step. On, the art becomes the line the Line step picks (one continuous line, or separate strokes on a plotter). Off, the art is left as it is: a pattern or text plots as its exact lines (what was the Line card's As drawn), a picture shows as the picture, and nothing re-traces while the art is adjusted. Printing, or plotting a picture, needs the line, so those steps say to turn Trace on.",
  how: "Opens the app on the leaf (a printer); turns Trace off; checks the line view shows the picture and nothing is traced; goes to Print; turns Trace on with the Print step's button. Saves a design with Trace off and opens it again, then opens an older design saved As drawn. Then a pen plotter: picks the labyrinth, checks it starts with Trace off (as drawn), turns Trace on. Last, the vase (a 3D model).",
  pass: "The switch is under the preview on Art, Line and Print; Trace off: the line mode is the picture as it is, the chip says Trace off, the trace isn't run (the traced line from before is kept, not redone), the Line card says Trace is off; Print says to turn Trace on, and its button does (the line traced again, the notice gone); a design saved with Trace off opens with it off, and an older one saved As drawn too; on the plotter the labyrinth starts with Trace off (as drawn, the page), and Trace on traces it into strokes; the 3D model's switch is on and can't be turned off; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx), checks = [];
    const sw = async () => page.isVisible(".trace-switch");
    let on = [];
    for (const v of ["viewArt", "viewDesign", "viewChoc"]) { await page.click(`label[for=${v}]`); await A.idle(page, 600); on.push(await sw()); }
    checks.push(check("the switch under the preview on Art, Line and Print (of 3)", on.filter(Boolean).length, "==", 3));
    await page.click("label[for=viewArt]"); await A.idle(page, 400);
    const runs0 = await page.evaluate(() => st.finalVer);
    await page.click(".trace-switch"); await A.idle(page, 1500);
    const off = await page.evaluate(() => ({ mode: lineModeNow(), chip: $("chip").textContent, ver: st.finalVer, note: !$("traceOffNote").hidden }));
    checks.push(check("Trace off: the picture as it is, not traced", +(off.mode === "none" && /Trace off/.test(off.chip) && off.ver === runs0 && off.note), "==", 1));
    await page.click("label[for=viewChoc]"); await A.idle(page, 800);
    checks.push(check("… Print says to turn Trace on", +((await page.isVisible("#traceNeeded")) && /turn Trace on to print/.test(await page.textContent("#traceNeededMsg"))), "==", 1));
    // a design saved with Trace off
    const [df] = await Promise.all([page.waitForEvent("download"), page.click("#fileMenu summary").then(() => page.click("#saveDesign"))]);
    const file = await df.path();
    await page.click("#traceNeededOn"); await A.idle(page, 3000);
    const back = await page.evaluate(() => ({ on: $("traceOn").checked, mode: lineModeNow(), need: !$("traceNeeded").hidden, chip: $("chip").textContent }));
    checks.push(check("… its Turn Trace on: traced again, the notice gone", +(back.on && back.mode === "one" && !back.need && /terms/.test(back.chip)), "==", 1));
    await page.setInputFiles("#designFile", file); await A.idle(page, 2500);
    checks.push(check("a design saved with Trace off opens with it off", +!(await page.isChecked("#traceOn")), "==", 1));
    // an older design, saved As drawn (v111 and before)
    const old = JSON.parse(fs.readFileSync(file, "utf8")); delete old.design.v.traceOn; old.design.v.lineDrawn = false; old.design.v.lineOne = true;
    await page.click("#traceNeededOn").catch(() => {}); await page.evaluate(() => { $("traceOn").checked = true; }); 
    const oldOn = file + ".old-on.json"; fs.writeFileSync(oldOn, JSON.stringify(old));
    await page.setInputFiles("#designFile", oldOn); await A.idle(page, 2500);
    const traceKept = await page.isChecked("#traceOn");
    old.design.v.lineDrawn = true; old.design.v.lineOne = false; const oldDrawn = file + ".old-drawn.json"; fs.writeFileSync(oldDrawn, JSON.stringify(old));
    await page.setInputFiles("#designFile", oldDrawn); await A.idle(page, 2500);
    checks.push(check("older designs: traced stays on, As drawn opens with Trace off", +(traceKept && !(await page.isChecked("#traceOn"))), "==", 1));
    // a pen plotter: the labyrinth starts as drawn
    const P = await A.open(ctx, { art: true });
    await P.page.click("label[for=artForPlot]"); await A.idle(P.page, 1000);
    await P.page.click("[data-examples] [data-example=labyrinth]:visible"); await A.idle(P.page, 2000);
    const lab = await P.page.evaluate(() => ({ on: $("traceOn").checked, mode: lineModeNow(), stage: document.body.dataset.stage }));
    await P.page.click(".trace-switch"); await A.idle(P.page, 3000);
    const lab2 = await P.page.evaluate(() => ({ mode: lineModeNow(), n: st.sepStrokes && st.sepStrokes.strokes.length }));
    checks.push(check("plotter, labyrinth: starts with Trace off (as drawn, the page)", +(!lab.on && lab.mode === "drawn" && lab.stage === "page"), "==", 1), check("… Trace on: traced into strokes", lab2.mode === "strokes" ? lab2.n : 0, ">=", 1));
    // a 3D model: always sliced
    await P.page.click("[data-examples] [data-example=skull]:visible"); await A.idle(P.page, 3000);
    checks.push(check("3D model: Trace on and fixed", +((await P.page.isChecked("#traceOn")) || (await P.page.evaluate(() => lineModeNow())) === "one") * +(await P.page.isDisabled("#traceOn")), "==", 1));
    checks.push(check("page errors", errors.length + P.errors.length, "==", 0));
    await P.close(); await close();
    return { checks, notes: [...errors, ...P.errors].join("  \n") };
  },
};
