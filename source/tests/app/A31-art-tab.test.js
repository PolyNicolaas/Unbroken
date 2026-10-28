const A = require("../lib/app.js"), { check } = require("../lib/check.js"), fs = require("fs");
const parts = async (page) => +((await page.textContent("#fitinfo")).match(/(\d+) part/) || [0, 0])[1];
const connectors = async (page) => +((await A.chip(page)).match(/(\d+) connectors?/) || [0, 0])[1];
const kind = (page) => page.evaluate(() => st.art.kind);
const srcId = (page) => page.evaluate(() => st.source.__id);
module.exports = {
  id: "A31", title: "The Art tab: one input at a time, traced, or plotted as drawn",
  guards: "an input that doesn't reach the trace, an input that forgets its settings when another is picked, a pattern that loses its one-line promise, art that can't be plotted without a trace, and the input lost by undo or a design file",
  why: "Everything comes in through the Art tab's Input switch, one thing at a time: a picture, the text, a geometric pattern or a 3D model. Each keeps its settings while another is in use. The Trace tab traces the one in use; the 2D tab can plot a pattern or the text exactly as drawn, without tracing.",
  how: "Opens the app (the Art tab, the sample leaf as the picture); picks Pattern (a Labyrinth), changes it to Waves and shuffles it; types a width of 40 mm, changes the rows, fits the needle; picks the Vibrating spiral (drawn from a picture) and the face sample in the Pattern card; picks Picture and Pattern again; picks the Spirograph with Allow overlaps on, turns its second wheel on and off, sets a 60-tooth wheel, then turns Allow overlaps off, then back to Waves; picks Text and 3D model; makes it for a pen plotter, as drawn, and exports the SVG; checks As drawn is off for a picture; back to a printer; undoes a switch; saves the design and opens it again.",
  pass: "The app opens on the Art tab with the picture in use; the Labyrinth traces as 1 part, a closed loop with no connectors, no smaller than the smallest mark; Waves as 1 part, an open line; Shuffle re-traces; a typed width is the print's and stays through a change of rows, with a warning when the lines come closer than the spacing, and Fit the needle puts the closest lines at the spacing (up to 5% over); the Vibrating spiral traces as 1 part from the face sample (not the leaf, a line drawing), and a picture chosen there keeps the pattern in use; back on Picture that picture returns, and back on Pattern the Waves; the Spirograph shows its second wheel's settings only with one, is followed exactly as 1 part, keeps its crossings with Allow overlaps and none without, and Waves come back with their rows as left; Text and 3D model take over the trace; the Plot step shows the pattern as drawn, its SVG one Inkscape layer; As drawn is off for a picture, which gets separate strokes; undo returns to the previous input; a saved design reopens on the pattern with the leaf still kept; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx, { art: true }), checks = [];
    checks.push(check("opens on the Art tab, the picture in use, the Line view showing", +((await page.isChecked("#viewArt")) && (await page.isChecked("#srcImage")) && (await page.isChecked("#stLine")) && (await page.textContent("#inputVal")) === "sample"), "==", 1));
    await page.click("label[for=srcPattern]"); await A.idle(page, 1200);
    const lab = await page.evaluate(() => ({ w: st.outW, m: st.marks && st.marks.smallest, closed: $("loopClosed").checked }));
    checks.push(check("Pattern (Labyrinth): 1 part, no connectors, a closed loop", (await parts(page)) * 10 + (await connectors(page)) + +lab.closed * 100, "==", 110));
    checks.push(check("… at a width no smaller than the smallest mark (÷)", lab.m ? lab.w / lab.m : NaN, ">=", 0.999));
    await page.selectOption("#artStyle", "waves"); await A.idle(page, 1500);
    checks.push(check("changed to Waves: 1 part, an open line, named on the card", (await parts(page)) * 10 + +(await page.isChecked("#loopOpen")) + +((await page.textContent("#inputVal")) === "Waves") * 100, "==", 111));
    let id = await srcId(page);
    await page.click("#artShuffle"); await A.idle(page, 1200);
    checks.push(check("Shuffle makes a new picture to trace", +((await srcId(page)) !== id), "==", 1));
    // Width (mm): set by hand, kept through a change of detail; Fit the needle goes back to the line spacing
    // 40 mm, or just over the smallest size that fits if that's more (the size never goes under it): once the size
    // marks are found, so it doesn't depend on when they arrive
    await page.waitForFunction(() => st.marks && st.marks.fits, null, { timeout: 60000 }).catch(() => {});
    const want = await page.evaluate(() => Math.max(40, Math.ceil((st.marks && st.marks.smallest) || 0) + 1));
    await page.fill("#artWidth", String(want)); await page.press("#artWidth", "Enter"); await A.idle(page, 1500);
    checks.push(check(`Width ${want} mm: the print is that wide, and the card warns the lines are closer than the spacing`, +((await page.evaluate(() => Math.round(st.outW))) === want && /Closer than the needle's line spacing/.test(await page.textContent("#artGapHint"))), "==", 1));
    await A.setValue(page, "#artP-detail", 10); await A.idle(page, 1500);
    checks.push(check("… kept when the rows change (mm)", await page.evaluate(() => Math.round(st.outW)), ">=", want));
    await page.click("#artFit"); await A.idle(page, 1500);
    const gap = await page.evaluate(() => { const r = UNB.pattern(st.art.pattern.style, st.art.pattern); return (st.outW * r.gap) / r.box[0] / st.spacing; });
    checks.push(check("Fit the needle: closest lines ÷ the line spacing", gap, ">=", 1), check("… (not much over)", gap, "<=", 1.05));
    // drawn from a picture: with the leaf (a line drawing) as the picture, the face sample is used instead
    await page.selectOption("#artStyle", "spiralTone"); await A.idle(page, 2000);
    checks.push(check("Vibrating spiral: 1 part, the Picture row on the face sample", +((await parts(page)) === 1 && (await page.isVisible("#artPicRow")) && (await page.textContent("#artPicName")) === "face sample"), "==", 1));
    id = await srcId(page);
    await page.click("#artPicFace"); await A.idle(page, 1500);
    checks.push(check("a picture chosen in the Pattern card keeps the pattern in use", +((await kind(page)) === "pattern" && (await srcId(page)) !== id), "==", 1));
    await page.selectOption("#artStyle", "waves"); await A.idle(page, 1500);
    await page.click("label[for=srcImage]"); await A.idle(page, 1200);
    checks.push(check("back on Picture: the face sample chosen last", await page.textContent("#srcinfo"), "==", "face sample"));
    await page.click("label[for=srcPattern]"); await A.idle(page, 1200);
    checks.push(check("back on Pattern: Waves", +((await page.evaluate(() => st.art.pattern.style)) === "waves" && (await page.textContent("#srcinfo")) === "Waves"), "==", 1));
    // the Spirograph: its own settings (a second wheel's appear when it's on), its exact line, and Allow overlaps
    // (a 60-tooth wheel in the 96-tooth ring: 5 petals' worth of crossings, quick to size either way)
    await page.evaluate(() => { $("overlaps").checked = true; $("overlaps").dispatchEvent(new Event("change")); });
    await page.selectOption("#artStyle", "spirograph");
    const hid = await page.isHidden("#artP-wheel2Teeth");
    await page.check("#artP-wheel2");
    const shown = await page.isVisible("#artP-wheel2Teeth");
    await page.uncheck("#artP-wheel2"); await A.setValue(page, "#artP-wheelTeeth", 60); await A.idle(page, 2500);
    checks.push(check("Spirograph: the second wheel's settings show only with a second wheel", +(hid && shown && (await page.isHidden("#artP-wheel2Teeth"))), "==", 1));
    const sp = await page.evaluate(() => ({ vec: !!(st.walk && st.walk.vector), cross: UNB.findCrossings(st.final.re, st.final.im, !st.open).length, val: $("uncrossVal").textContent }));
    checks.push(check("… followed exactly as 1 part, and with Allow overlaps its crossings kept (crossings)", +((await parts(page)) === 1 && sp.vec && /kept \(overlaps\)/.test(sp.val)) * sp.cross, ">", 0));
    await page.evaluate(() => { $("overlaps").checked = false; $("overlaps").dispatchEvent(new Event("change")); }); await A.idle(page, 2500);
    checks.push(check("… without it, every crossing undone", await page.evaluate(() => UNB.findCrossings(st.final.re, st.final.im, !st.open).length), "==", 0));
    await page.selectOption("#artStyle", "waves"); await A.idle(page, 1500);
    checks.push(check("back to Waves: its settings as left (rows)", await page.evaluate(() => st.art.pattern.detail), "==", 10));
    await page.click("label[for=srcText]"); await A.idle(page, 1200);
    checks.push(check("Text: traced from its strokes", +((await page.evaluate(() => document.body.dataset.src)) === "text" && (await page.isVisible("#textIn"))), "==", 1));
    await page.click("label[for=srcModel]"); await A.idle(page, 1200);
    checks.push(check("3D model: the sample vase, its card showing", +((await page.evaluate(() => document.body.dataset.src)) === "model" && (await page.isVisible("#turnX"))), "==", 1));
    // undo the switch to the model
    await page.mouse.click(5, 5); await page.keyboard.press("Control+z"); await A.idle(page, 1200);
    checks.push(check("undo: back on Text", await kind(page), "==", "text"));
    // plot as drawn: a pattern yes, a picture no
    await page.click("label[for=srcPattern]"); await A.idle(page, 1200);
    await A.plot(page, "drawn"); await A.idle(page, 800);
    checks.push(check("2D: the pattern as drawn", +/The Waves exactly as drawn, not traced/.test(await page.textContent("#pageHint")), "==", 1));
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#exportBtn")]);
    const svg = fs.readFileSync(await dl.path(), "utf8");
    checks.push(check("SVG: one Inkscape layer of the pattern's lines, named as art", +((svg.match(/inkscape:groupmode="layer"/g) || []).length === 1 && /-art\.svg$/.test(dl.suggestedFilename())), "==", 1));
    await page.click("label[for=viewArt]"); await page.click("label[for=srcImage]"); await A.idle(page, 1200);
    checks.push(check("As drawn is off for a picture (it gets separate strokes)", +((await page.isDisabled("#lineDrawn")) && (await page.evaluate(() => lineModeNow())) === "strokes"), "==", 1));
    await page.click("label[for=artForPrint]"); await A.idle(page, 1200);
    // a design file: the pattern in use, the leaf kept
    await page.click("label[for=srcPattern]"); await A.idle(page, 1200);
    const saved = await page.evaluate(() => JSON.stringify([st.art.kind, st.art.pattern]));
    const [df] = await Promise.all([page.waitForEvent("download"), page.click("#fileMenu summary").then(() => page.click("#saveDesign"))]);
    const file = await df.path();
    await page.click("label[for=srcText]"); await A.idle(page, 1000);
    await page.setInputFiles("#designFile", file); await A.idle(page, 1500);
    const back = await page.evaluate(() => ({ art: JSON.stringify([st.art.kind, st.art.pattern]), pic: st.art.picture && st.art.picture.canvas.width, src: $("srcinfo").textContent }));
    checks.push(check("design reopened: the pattern and its settings", +(back.art === saved && back.src === "Waves"), "==", 1), check("… and the face sample kept as the picture (px wide)", back.pic, "==", 480));
    checks.push(check("page errors", errors.length, "==", 0));
    await close();
    return { checks, notes: errors.join("  \n") };
  },
};
