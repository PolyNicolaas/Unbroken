const A = require("../lib/app.js"), { check } = require("../lib/check.js"), fs = require("fs");
const parts = async (page) => +((await page.textContent("#fitinfo")).match(/(\d+) part/) || [0, 0])[1];
const connectors = async (page) => +((await A.chip(page)).match(/(\d+) connectors?/) || [0, 0])[1];
const layers = (page) => page.evaluate(() => st.art.layers.map((l) => `${l.kind}${l.on ? "" : "-"}`).join(","));
const srcId = (page) => page.evaluate(() => st.source.__id);
// the layer list's row for the nth layer from the top
const row = (n) => `#layerList li:nth-child(${n})`;
module.exports = {
  id: "A31", title: "The Art tab: layers in, traced as one, or plotted as drawn",
  guards: "a layer that doesn't reach the trace (or reaches it when hidden), a pen colour that re-traces, a pattern that loses its one-line promise inside the art, a 3D model mixed into a traced picture, art that can't be plotted without a trace, and layers lost by undo or a design file",
  why: "Everything comes in through the Art tab as layers (a picture, the text, patterns, a 3D model), each with a pen and a place in the art. The shown layers go to the Trace tab as one picture (or the text alone, or a 3D model alone), and the 2D tab can plot the art's lines as drawn, a pen per layer, without tracing. Plan: docs/ART-PLAN.md.",
  how: "Opens on the Art tab (the sample leaf as one picture layer); adds a pattern; hides the leaf; changes the pattern to Waves and shuffles it; changes a pen colour; moves, sizes and removes layers; adds the text and a 3D model and hides them again; plots the art as drawn on the 2D tab and exports its SVG; undoes; saves the design and opens it again.",
  pass: "The app opens on the Art tab with one picture layer; two shown layers are traced as one picture; a pattern alone traces as 1 part with no connectors, closed (Labyrinth) or open (Waves), no smaller than the smallest mark; Shuffle, a size and a move re-trace, a pen colour doesn't and shows in the Art view; the text alone is traced from its strokes; a shown 3D model makes the art a model and the other layers wait; the 2D tab plots the art as drawn with a layer per pen in the SVG and says pictures need tracing; undo brings back the layers before; a saved design reopens with the same layers, pattern and pictures; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx, { art: true }), checks = [];
    checks.push(check("opens on the Art tab, the Art view showing, one picture layer", +((await page.isChecked("#viewArt")) && (await page.isChecked("#stArt")) && (await layers(page)) === "picture"), "==", 1));
    await page.click("#addPattern"); await A.idle(page, 1000);
    checks.push(check("a pattern added on top: two shown layers traced as one picture", +((await layers(page)) === "picture,pattern" && /2 layers drawn as one picture/.test(await page.textContent("#fromArt"))), "==", 1));
    await page.click(`${row(2)} .lay-eye`); await A.idle(page, 1200);   // hide the leaf
    const lab = await page.evaluate(() => ({ w: st.outW, m: st.marks && st.marks.smallest, closed: $("loopClosed").checked }));
    checks.push(check("the Labyrinth alone: 1 part, no connectors, a closed loop", (await parts(page)) * 10 + (await connectors(page)) + +lab.closed * 100, "==", 110));
    checks.push(check("… at a width no smaller than the smallest mark (÷)", lab.m ? lab.w / lab.m : NaN, ">=", 0.999));
    await page.selectOption("#artStyle", "waves"); await A.idle(page, 1500);
    checks.push(check("changed to Waves: 1 part, an open line, the layer renamed", (await parts(page)) * 10 + +(await page.isChecked("#loopOpen")) + +((await page.textContent(`${row(1)} .lay-name`)).startsWith("Waves")) * 100, "==", 111));
    let id = await srcId(page);
    await page.click("#artShuffle"); await A.idle(page, 1200);
    checks.push(check("Shuffle makes a new picture to trace", +((await srcId(page)) !== id), "==", 1));
    // a pen colour is for drawing, not tracing
    const ver = await page.evaluate(() => st.finalVer);
    await page.$eval(`${row(1)} .lay-pen`, (e) => { e.value = "#00a000"; e.dispatchEvent(new Event("input", { bubbles: true })); }); await A.idle(page, 600);
    const green = await page.$eval("#artView", (c) => { const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 1] > 120 && d[i] < 80 && d[i + 2] < 80) n++; return n; });
    checks.push(check("a pen colour: no new trace", await page.evaluate(() => st.finalVer), "==", ver), check("… and the Art view draws in it (green px)", green, ">", 100));
    // placement and order
    await page.click("#card-h-place .card-toggle"); id = await srcId(page);
    await A.setValue(page, "#placeSize", 50); await A.idle(page, 1200);
    checks.push(check("Size 50%: a new picture, the card says so", +((await srcId(page)) !== id && (await page.textContent("#placeVal")) === "50%"), "==", 1));
    await page.click(`${row(2)} .lay-eye`); await page.click(`${row(1)} .lay-down`); await A.idle(page, 1200);
    checks.push(check("the leaf shown again and moved on top", await layers(page), "==", "pattern,picture"));
    // the text: alone it's traced from its strokes; with others it's drawn into the picture
    await page.click("#addText"); await A.idle(page, 1200);
    checks.push(check("text added: three layers drawn as one picture", +((await layers(page)) === "pattern,picture,text" && !(await page.isChecked("#srcText"))), "==", 1));
    for (const n of [2, 3]) await page.click(`${row(n)} .lay-eye`);
    await A.idle(page, 1200);
    checks.push(check("the text alone: traced from its strokes (Text source)", +(await page.isChecked("#srcText")), "==", 1));
    // a 3D model prints on its own
    await page.click("#addModel"); await A.idle(page, 1000);
    checks.push(check("a model shown: the art is a 3D model, the other layers wait", +((await page.isChecked("#srcModel")) && /wait until it's hidden/.test(await page.textContent("#layerMsg"))), "==", 1));
    await page.click(`${row(1)} .lay-del`); for (const n of [1, 2, 3]) await page.click(`${row(n)} .lay-eye`);   // text hidden, leaf and pattern shown
    await A.idle(page, 1500);
    checks.push(check("model removed, the text hidden, pattern and leaf shown: a picture again", +((await page.isChecked("#srcImage")) && (await layers(page)) === "pattern,picture,text-"), "==", 1));
    // the 2D tab: the art as drawn, no trace
    await page.click("#goPlot"); await A.idle(page, 800);
    const hint = await page.textContent("#pageHint");
    checks.push(check("2D: the art as drawn, 1 layer of lines, the picture needing a trace", +(/1 layer of lines/.test(hint) && /1 picture layer has no lines until traced/.test(hint) && /For a printer, trace it/.test(hint)), "==", 1));
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#exportBtn")]);
    const svg = fs.readFileSync(await dl.path(), "utf8");
    checks.push(check("SVG: one Inkscape layer, in the layer's pen colour", +((svg.match(/inkscape:groupmode="layer"/g) || []).length === 1 && /stroke="#00a000"/.test(svg)), "==", 1));
    checks.push(check("SVG: file named as art", +/-art\.svg$/.test(dl.suggestedFilename()), "==", 1));
    // undo, and a design file
    await page.click("label[for=viewArt]"); await page.click(`${row(2)} .lay-del`); await A.idle(page, 1200);
    checks.push(check("leaf removed", await layers(page), "==", "pattern,text-"));
    await page.mouse.click(5, 5); await page.keyboard.press("Control+z"); await A.idle(page, 1200);
    checks.push(check("undo: the leaf is back", await layers(page), "==", "pattern,picture,text-"));
    const saved = await page.evaluate(() => JSON.stringify(st.art.layers.map((l) => [l.kind, l.name, l.on, l.pen, l.pattern || null, l.place])));
    const [df] = await Promise.all([page.waitForEvent("download"), page.click("#fileMenu summary").then(() => page.click("#saveDesign"))]);
    const file = await df.path();
    await page.click("#addPattern"); await A.idle(page, 1000);
    await page.setInputFiles("#designFile", file); await A.idle(page, 1500);
    const back = await page.evaluate(() => ({ art: JSON.stringify(st.art.layers.map((l) => [l.kind, l.name, l.on, l.pen, l.pattern || null, l.place])), pic: st.art.layers.find((l) => l.kind === "picture").picture.canvas.width }));
    checks.push(check("design reopened: the same layers, pens, pattern and places", +(back.art === saved), "==", 1), check("… and the leaf's picture (px wide)", back.pic, "==", 640));
    checks.push(check("page errors", errors.length, "==", 0));
    await close();
    return { checks, notes: errors.join("  \n") };
  },
};
