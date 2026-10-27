const A = require("../lib/app.js"), { check } = require("../lib/check.js"), fs = require("fs");
const parts = async (page) => +((await page.textContent("#fitinfo")).match(/(\d+) part/) || [0, 0])[1];
const connectors = async (page) => +((await A.chip(page)).match(/(\d+) connectors?/) || [0, 0])[1];
const kind = (page) => page.evaluate(() => st.art.kind);
const srcId = (page) => page.evaluate(() => st.source.__id);
module.exports = {
  id: "A31", title: "The Art tab: one input at a time, traced, or plotted as drawn",
  guards: "an input that doesn't reach the trace, an input that forgets its settings when another is picked, a pattern that loses its one-line promise, art that can't be plotted without a trace, and the input lost by undo or a design file",
  why: "Everything comes in through the Art tab's Input switch, one thing at a time: a picture, the text, a geometric pattern or a 3D model. Each keeps its settings while another is in use. The Trace tab traces the one in use; the 2D tab can plot a pattern or the text exactly as drawn, without tracing.",
  how: "Opens the app (the Art tab, the sample leaf as the picture); picks Pattern (a Labyrinth), changes it to Waves and shuffles it; picks Picture and Pattern again; picks Text and 3D model; plots the pattern as drawn on the 2D tab and exports its SVG; checks Plot as drawn is off for a picture; undoes a switch; saves the design and opens it again.",
  pass: "The app opens on the Art tab with the picture in use; the Labyrinth traces as 1 part, a closed loop with no connectors, no smaller than the smallest mark; Waves as 1 part, an open line; Shuffle re-traces; back on Picture the leaf returns, and back on Pattern the same Waves; Text and 3D model take over the trace; the 2D tab plots the pattern as drawn in one Inkscape layer; Plot as drawn is off for a picture; undo returns to the previous input; a saved design reopens on the pattern with the leaf still kept; no page errors.",
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
    const seed = await page.evaluate(() => st.art.pattern.seed);
    checks.push(check("Shuffle makes a new picture to trace", +((await srcId(page)) !== id), "==", 1));
    await page.click("label[for=srcImage]"); await A.idle(page, 1200);
    checks.push(check("back on Picture: the leaf", await page.textContent("#srcinfo"), "==", "sample"));
    await page.click("label[for=srcPattern]"); await A.idle(page, 1200);
    checks.push(check("back on Pattern: the same Waves", +((await page.evaluate(() => st.art.pattern.style + ":" + st.art.pattern.seed)) === `waves:${seed}` && (await page.textContent("#srcinfo")) === "Waves"), "==", 1));
    await page.click("label[for=srcText]"); await A.idle(page, 1200);
    checks.push(check("Text: traced from its strokes", +((await page.evaluate(() => document.body.dataset.src)) === "text" && (await page.isVisible("#textIn"))), "==", 1));
    await page.click("label[for=srcModel]"); await A.idle(page, 1200);
    checks.push(check("3D model: the sample vase, its card showing", +((await page.evaluate(() => document.body.dataset.src)) === "model" && (await page.isVisible("#turnX"))), "==", 1));
    // undo the switch to the model
    await page.mouse.click(5, 5); await page.keyboard.press("Control+z"); await A.idle(page, 1200);
    checks.push(check("undo: back on Text", await kind(page), "==", "text"));
    // plot as drawn: a pattern yes, a picture no
    await page.click("label[for=srcPattern]"); await A.idle(page, 1200);
    await page.click("#goPlot"); await A.idle(page, 800);
    checks.push(check("2D: the pattern as drawn", +/The Waves exactly as drawn, not traced/.test(await page.textContent("#pageHint")), "==", 1));
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#exportBtn")]);
    const svg = fs.readFileSync(await dl.path(), "utf8");
    checks.push(check("SVG: one Inkscape layer of the pattern's lines, named as art", +((svg.match(/inkscape:groupmode="layer"/g) || []).length === 1 && /-art\.svg$/.test(dl.suggestedFilename())), "==", 1));
    await page.click("label[for=viewArt]"); await page.click("label[for=srcImage]"); await A.idle(page, 1200);
    checks.push(check("Plot as drawn is off for a picture", +(await page.isDisabled("#goPlot")), "==", 1));
    // a design file: the pattern in use, the leaf kept
    await page.click("label[for=srcPattern]"); await A.idle(page, 1200);
    const saved = await page.evaluate(() => JSON.stringify([st.art.kind, st.art.pattern]));
    const [df] = await Promise.all([page.waitForEvent("download"), page.click("#fileMenu summary").then(() => page.click("#saveDesign"))]);
    const file = await df.path();
    await page.click("label[for=srcText]"); await A.idle(page, 1000);
    await page.setInputFiles("#designFile", file); await A.idle(page, 1500);
    const back = await page.evaluate(() => ({ art: JSON.stringify([st.art.kind, st.art.pattern]), pic: st.art.picture && st.art.picture.canvas.width, src: $("srcinfo").textContent }));
    checks.push(check("design reopened: the pattern and its settings", +(back.art === saved && back.src === "Waves"), "==", 1), check("… and the leaf kept as the picture (px wide)", back.pic, "==", 640));
    checks.push(check("page errors", errors.length, "==", 0));
    await close();
    return { checks, notes: errors.join("  \n") };
  },
};
