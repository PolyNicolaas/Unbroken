const A = require("../lib/app.js"), { check } = require("../lib/check.js"), fs = require("fs");
const parts = async (page) => +((await page.textContent("#fitinfo")).match(/(\d+) part/) || [0, 0])[1];
module.exports = {
  id: "A32", title: "Image prep and plotting: grey levels, the background tapped, a picture turned, and art made for plotting",
  guards: "grey levels that don't change the trace, a grey set to Skip that is still traced, a tap that doesn't remove the background, a turned picture that doesn't turn, the printing limits holding back art made for plotting, a plotting pattern traced before it's asked for, and any of it lost by a design file",
  why: "The Image prep card can reduce a picture to a few flat greys and trace the edges of the ones you pick, and remove the background from a point you tap; the Picture card turns and straightens the picture. The Art tab's Made for switch sets whether art is for printing (one line at the needle's spacing) or plotting (much finer patterns, plotted as drawn, traced only when asked).",
  how: "Opens the app; picks the still-life sample; on the Trace tab sets 5 grey levels, then sets the second grey to Skip; taps the background with the tool; turns the picture right on the Art tab; picks Pattern and makes it for a pen plotter, picks Wave rows (from a picture) and sets 200 rows; goes on to the Plot step (as drawn); exports the SVG; picks One continuous line; picks the Spirograph for printing; saves the design and opens it again.",
  pass: "Grey levels make the trace follow the greys' edges (the line changes) and the Grey levels card lists 5 greys; Skip changes the line again; the tap sets the background point and some tolerance; the turned picture is as tall as it was wide; for a pen plotter Wave rows go to 200 rows (printing stops at 120) and start as drawn, nothing traced; the 2D page shows the rows; its SVG is named after it; One continuous line traces them, filling the page with lines pen 1 + the gap apart; a Spirograph for printing turns Allow overlaps on and says so; the reopened design keeps 5 greys, the skipped grey and made for a pen plotter; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx, { art: true }), checks = [];
    await page.click("#examplesRow [data-example=still]"); await A.idle(page, 2000); // (Grey levels and Image prep are on the Art step since v113)
    const plain = await page.evaluate(() => st.walk.px.length);
    await A.setValue(page, "#levels", 5); await A.idle(page, 3000);
    const lv = await page.evaluate(() => ({ n: st.walk.px.length, rows: document.querySelectorAll("#levelList .level-row").length, val: $("levelsCardVal").textContent, tones: st.wk.levels && st.wk.levels.tones.length }));
    checks.push(check("5 grey levels: a row per grey, the card says so, the line changed", +(lv.rows === 5 && lv.tones === 5 && /5 greys/.test(lv.val) && lv.n !== plain), "==", 1));
    await page.click("label[for=level1s]"); await A.idle(page, 3000);
    const sk = await page.evaluate(() => ({ n: st.walk.px.length, m: $("levelModes").value }));
    checks.push(check("the second grey set to Skip: the line changed again", +(sk.m === "tstts" && sk.n !== lv.n), "==", 1));
    await page.click('[aria-labelledby="h-prep"] .card-toggle'); // (Image prep starts folded)
    await page.click("#bgPick"); await A.idle(page, 200);
    await page.evaluate(() => window.scrollTo(0, 0)); // (the card's controls are further down the page)
    const box = await page.locator("#view").boundingBox();
    await page.mouse.click(box.x + box.width * 0.85, box.y + box.height * 0.4); // (the wall, clear of any message at the top) await A.idle(page, 3000);
    const bg = await page.evaluate(() => ({ at: st.bgAt, tol: +$("bgTol").value }));
    checks.push(check("Tap the background: the point tapped, with some tolerance", +(!!bg.at && bg.tol > 0), "==", 1));
    await page.click("#bgDone");
    // the picture turned
    await page.click("label[for=viewArt]"); await A.idle(page, 300);
    const before = await page.evaluate(() => [st.art.picture.canvas.width, st.art.picture.canvas.height]);
    await page.click("#picRight"); await A.idle(page, 2500);
    const after = await page.evaluate(() => [st.art.picture.canvas.width, st.art.picture.canvas.height, st.source.width]);
    checks.push(check("Turn right: the picture as tall as it was wide", +(after[0] === before[1] && after[1] === before[0] && after[2] === before[1]), "==", 1));
    // made for plotting
    await page.click("label[for=srcPattern]"); await page.click("label[for=artForPlot]"); await A.idle(page, 1000);
    await page.selectOption("#artStyle", "wavesTone"); await A.idle(page, 1500);
    const src = await page.evaluate(() => st.source.__id);
    await A.setValue(page, "#artP-detail", 200); await A.idle(page, 2500);
    const pl = await page.evaluate(() => ({ max: +$("artP-detail").max, rows: st.art.pattern.detail, untraced: st.art.untraced, drawn: lineModeNow() === "drawn" }));
    checks.push(check("Plotting: Wave rows go to 200 rows (printing stops at 120)", +(pl.max === 250 && pl.rows === 200), "==", 1),
      check("… as drawn: nothing traced", +(pl.untraced && pl.drawn && (await page.evaluate(() => st.source.__id)) === src), "==", 1));
    await page.click("#goTrace"); await page.click("#goOut"); await A.idle(page, 2000);
    checks.push(check("2D: the rows as drawn", +/Wave rows \(picture\) exactly as drawn/.test(await page.textContent("#pageHint")), "==", 1));
    const [sv] = await Promise.all([page.waitForEvent("download"), page.click("#exportBtn")]);
    checks.push(check("… its SVG named after the pattern", sv.suggestedFilename(), "==", "wave-rows-picture-art.svg"));
    await page.click("label[for=viewDesign]"); await page.click(".trace-switch"); await page.click("label[for=lineOne]"); await A.idle(page, 4000);
    checks.push(check("One continuous line: traced now (parts)", +(!(await page.evaluate(() => st.art.untraced)) && (await page.evaluate(() => st.source.__id)) !== src) * (await parts(page)), ">=", 1));
    // made for plotting, a traced drawing fills the page, its lines pen 1 + the gap apart
    const fit = await page.evaluate(() => ({ w: st.outW, page: pageFitW(), sp: st.spacing, pen: +$("penW").value + +$("lineGapMM").value }));
    checks.push(check("… made for plotting it fills the page (width ÷ the page's room)", fit.w / fit.page, ">=", 0.99), check("… and its spacing is pen 1 + the gap (mm off)", Math.abs(fit.sp - fit.pen), "<", 0.001));
    // a pattern that crosses itself, for printing: Allow overlaps turned on, and said so
    await page.click("label[for=viewArt]"); await page.click("label[for=artForPrint]"); await page.selectOption("#artStyle", "spirograph"); await A.idle(page, 3000);
    checks.push(check("Spirograph for printing: Allow overlaps turned on, and the card says so", +((await page.isChecked("#overlaps")) && /Allow overlaps is on now/.test(await page.textContent("#artMsg"))), "==", 1));
    await page.click("label[for=artForPlot]"); await A.idle(page, 1500);
    // a design file
    const [df] = await Promise.all([page.waitForEvent("download"), page.click("#fileMenu summary").then(() => page.click("#saveDesign"))]);
    const file = await df.path();
    await page.click("label[for=viewArt]"); await page.click("label[for=artForPrint]"); await A.setValue(page, "#levels", 1); await A.idle(page, 1500);
    await page.setInputFiles("#designFile", file); await A.idle(page, 3000);
    const back = await page.evaluate(() => ({ lv: +$("levels").value, m: $("levelModes").value, plot: $("artForPlot").checked }));
    checks.push(check("design reopened: 5 greys, the skipped grey, Made for Plotting", +(back.lv === 5 && back.m === "tstts" && back.plot), "==", 1));
    checks.push(check("page errors", errors.length, "==", 0));
    await close();
    return { checks, notes: errors.join("  \n") };
  },
};
