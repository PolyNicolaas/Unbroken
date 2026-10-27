const A = require("../lib/app.js"), { check } = require("../lib/check.js"), fs = require("fs");
module.exports = {
  slow: true,
  id: "A16", title: "2D tab: shapes to click and fill, one pen per layer",
  guards: "a click that fills the wrong thing or nothing, an area holding two pens at once, a removed pen leaving its fills behind, fills missing from the files or from undo and design files",
  why: "Fills on the 2D tab are picked by clicking areas on the page: the chosen pen fills the area, the same pen clears it, another pen takes it over. Each pen must end up in its own layer of the SVG so the pen can be changed between layers in Saxi, and every change must undo and save with the design like any other.",
  how: "Opens the app, makes it for a pen plotter, sets the leaf to 60 mm on the Line step, goes to the Plot step and clicks the blade with Pen 2. Adds Pen 3 and clicks the blade again, then again, then once more. Undoes and redoes the last click. Exports the SVG and reads its layers. Removes Pen 3 and reads what's left. Checks a click outside the leaf does nothing. Then sets Close gaps to 4.9 mm, counts the shapes, turns on Draw bridges and exports the SVG again, drags across the blade and undoes back. Finally loads a picture of an outlined light-red circle, light-blue square and white triangle, adds a blue pen and presses Colour from image.",
  pass: "Pen 2's click fills the blade (hatch strokes on the page); Pen 3 takes the area over (still one filled area); clicking it with Pen 3 again clears it, and once more fills it; a click outside the drawing changes nothing; undo goes back a step and redo forward; the SVG has 2 layers (drawing, Pen 3) with Pen 3's colour on the fill; the design state holds the fills; removing Pen 3 removes its fill; Close gaps splits the blade into at least 3 more shapes, the shapes are tinted, drawn bridges are a second path in pen 1's layer, undo opens the gaps again; dragging across the split blade fills 3 or more shapes and one undo takes it back; Colour from image gives a light-red circle the red pen and a light-blue square the blue pen and leaves a white triangle empty; the Design tab's readouts are untouched; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx), checks = [];
    const idle = () => A.idle(page, 300);
    const at = (fx, fy) => page.evaluate(([fx, fy]) => { const L = st.plot, { P, ox, oy } = placeOnPage(L), r = $("pageView").getBoundingClientRect(); return [r.left + (ox + L.W * fx) / P.w * r.width, r.top + (oy + L.H * fy) / P.h * r.height]; }, [fx, fy]);
    const click = async (fx, fy) => { await page.evaluate(() => $("pageView").scrollIntoView({ block: "center" })); const [X, Y] = await at(fx, fy); await page.mouse.click(X, Y); await A.idle(page, 300); };
    const state = () => page.evaluate(() => ({ areas: st.penFill.areas.map((a) => a.pen), strokes: st.pfill ? st.pfill.res.fills.map((f) => f.length) : [] }));
    // made for a pen plotter (it would fill the page), then 60 mm set by hand on the Line step
    await A.plot(page); await idle();
    await page.click("label[for=viewDesign]"); await page.fill("#outW", "60"); await page.press("#outW", "Enter"); await idle();
    await page.click("label[for=view2D]"); await idle();
    checks.push(check("Fills card is open", +!(await page.$eval("#card-h-fills", (e) => e.classList.contains("collapsed"))), "==", 1));
    await page.waitForTimeout(150);
    await click(0.65, 0.55);
    let s = await state();
    checks.push(check("Pen 2 click: one area filled with Pen 2", +(s.areas.length === 1 && s.areas[0] === 0), "==", 1), check("Pen 2 click: hatch strokes", s.strokes[0] || 0, ">", 50));
    await click(0.02, 0.05);                                // outside the leaf
    checks.push(check("click outside the drawing: still one area", (await state()).areas.length, "==", 1));
    await page.click("#addPen"); await page.waitForTimeout(200);
    await click(0.65, 0.55); s = await state();
    checks.push(check("Pen 3 click on the same area: taken over (one area, Pen 3)", +(s.areas.length === 1 && s.areas[0] === 1 && !s.strokes[0] && s.strokes[1] > 50), "==", 1));
    await click(0.6, 0.5);
    checks.push(check("Pen 3 click again: cleared", (await state()).areas.length, "==", 0));
    await click(0.6, 0.5);
    checks.push(check("and once more: filled", (await state()).areas.length, "==", 1));
    await A.idle(page, 300); await page.mouse.click(5, 5); await page.keyboard.press("Control+z"); await A.idle(page, 300);
    checks.push(check("undo: back to cleared", (await state()).areas.length, "==", 0));
    await page.keyboard.press("Control+Shift+z"); await A.idle(page, 300);
    checks.push(check("redo: filled again", (await state()).areas.length, "==", 1));
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#exportBtn")]);
    const svg = fs.readFileSync(await dl.path(), "utf8"), col = await page.inputValue("#penList .pen-row:nth-child(2) [data-f=color]");
    checks.push(check("SVG: layers (drawing, Pen 3)", (svg.match(/inkscape:groupmode="layer"/g) || []).length, "==", 2));
    checks.push(check("SVG: Pen 3's layer and colour on its strokes", +(/inkscape:label="3 fill"/.test(svg) && new RegExp(`<path d="M[^"]+" fill="none" stroke="${col}"`).test(svg)), "==", 1));
    checks.push(check("design state holds the fills (saved with a design file)", await page.evaluate(() => designState().s.penFill.areas.length), "==", 1));
    await page.click("#penList .pen-row:nth-child(2) .pen-del"); await A.idle(page, 300);
    s = await state();
    checks.push(check("removing Pen 3 removes its fill (pens left, areas left)", +(await page.$$eval("#penList .pen-row", (r) => r.length) === 1 && s.areas.length === 0), "==", 1));
    // shapes: Close gaps splits the blade where the midrib and veins stop short; Draw bridges adds them to pen 1
    const shapesN = async () => +((await page.textContent("#penFillInfo")).match(/^(\d+) shape/) || [0, 0])[1];
    const before = await shapesN();
    await A.setValue(page, "#gapClose", 70); await A.idle(page, 300);
    const after = await shapesN();
    checks.push(check("Close gaps 4.9 mm: the blade splits (shapes before → after)", after - before, ">=", 3));
    checks.push(check("Trace tab's spacing readout untouched by the 2D tab", +!/^(off|up to)/.test(await page.textContent("#gapVal")), "==", 1));
    checks.push(check("Show shapes: tint drawn", await page.evaluate(() => +!!(st.pfill && st.pfill.tint)), "==", 1));
    await page.check("#drawBridges"); await page.waitForTimeout(300);
    const [dl3] = await Promise.all([page.waitForEvent("download"), page.click("#exportBtn")]);
    const svg3 = fs.readFileSync(await dl3.path(), "utf8"), layer1 = svg3.split("</g>")[0];
    checks.push(check("Draw bridges: pen 1's layer has the bridges as a second path", (layer1.match(/<path /g) || []).length, "==", 2));
    // drag across the split blade: every shape passed over is filled, one undo step for the whole drag
    const filledBefore = (await state()).areas.length;
    await page.evaluate(() => $("pageView").scrollIntoView({ block: "center" }));
    const pts = []; for (let t = 0; t <= 1.0001; t += 0.05) pts.push(await at(0.3 + 0.45 * t, 0.8 - 0.6 * t));
    await page.mouse.move(...pts[0]); await page.mouse.down(); for (const q of pts) await page.mouse.move(q[0], q[1], { steps: 3 }); await page.mouse.up(); await A.idle(page, 300);
    const dragged = (await state()).areas.length - filledBefore;
    checks.push(check("drag across the blade: shapes filled in one go", dragged, ">=", 3));
    await A.idle(page, 300); await page.mouse.click(5, 5); await page.keyboard.press("Control+z"); await A.idle(page, 300);
    checks.push(check("one undo takes the whole drag back", (await state()).areas.length, "==", filledBefore));
    await page.keyboard.press("Control+z"); await A.idle(page, 300);
    await page.keyboard.press("Control+z"); await page.keyboard.press("Control+z"); await A.idle(page, 300);
    checks.push(check("undo: gaps open again (shapes)", await shapesN(), "==", before));
    // Colour from image: outlined light-red circle, light-blue square and white triangle
    await page.click("label[for=viewDesign]");
    await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 600; c.height = 300; const g = c.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, 600, 300); g.lineWidth = 6; g.strokeStyle = "#000";
      g.fillStyle = "#f2a3a3"; g.beginPath(); g.arc(110, 150, 80, 0, 7); g.fill(); g.stroke();
      g.fillStyle = "#a9c4f2"; g.fillRect(220, 70, 160, 160); g.strokeRect(220, 70, 160, 160);
      g.beginPath(); g.moveTo(490, 70); g.lineTo(570, 230); g.lineTo(410, 230); g.closePath(); g.stroke(); setSource(c, "test shapes"); });
    await idle(); await page.fill("#outW", "120"); await page.press("#outW", "Enter"); await idle();
    await A.plot(page); await idle();
    await page.click("#addPen"); await page.waitForTimeout(300);
    const cols = await page.evaluate(() => st.penFill.pens.map((p) => p.color));
    await page.click("#autoColour"); await A.idle(page, 300);
    const got = await page.evaluate(() => st.penFill.areas.map((a) => [a.pen, a.u]).sort((p, q) => p[1] - q[1]).map((a) => a[0]));
    checks.push(check(`Colour from image: circle → red pen, square → blue pen, white triangle empty (pens ${cols.join(", ")})`, got.join(","), "==", "0,1"));
    checks.push(check("page errors", errors.length, "==", 0));
    await close(); return { checks };
  },
};
