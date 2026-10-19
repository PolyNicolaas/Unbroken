const A = require("../lib/app.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A23", title: "Zoom in every view, and One copy / Whole plate",
  guards: "a zoom that moves what's under the pointer, clicks and tools that land in the wrong place once zoomed, a zoom shared between views, and the copies crowding the view while you work on the design",
  why: "Every view of the big view zooms (the − / + / Fit buttons, pinch or Ctrl / ⌘ + scroll about the pointer) and keeps its own zoom. Clicks (the image tools, filling shapes on the 2D page) must still land where you point. The Plate and 3D layers views show either one copy, to work on the design, or the whole plate with every copy, to see how they fit.",
  how: "Opens the app (the leaf). Line view: + twice and reads the scale and where the image tools map the centre; Ctrl + scroll about a corner point; Fit; − until it stops, then Fit. 2D page: zooms in and checks a click at the centre maps to the same paper point as before. Sets 6 copies; 3D tab: compares the layers with One copy and Whole plate, adds a base layer and looks for its fill moves; reads the whole print's moves by kind and hides travel and purge; then the Plate view the same way.",
  pass: "+ twice is 225% and the line view's scale grows 2.25×; the point under the centre and under the pointer stay put (to 1 px); Fit is back to 100%; each view keeps its own zoom; a click at the page's centre maps to the same mm point zoomed or not (to 0.05 mm, under a screen pixel); Whole plate shows the 6 copies and a different picture from One copy, in the layers and on the Plate; adding a base layer adds fill moves to the whole print and changes the picture; the whole print has walls, travel, the purge line and a wipe per copy, and hiding travel and purge changes the picture; with One copy only the walls and fill switches show; − zooms out to 25% and stops there, and Fit brings it back to 100%; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx), checks = [];
    const lineAt = (x, y) => page.evaluate(([x, y]) => { const v = view(); return [(x - v.ox) / v.k, (y - v.oy) / v.k, v.k]; }, [x, y]);   // canvas px → working px
    const cvSize = (id) => page.$eval(id, (c) => [c.width, c.height]);
    const [w, h] = await cvSize("#view"), c0 = await lineAt(w / 2, h / 2);
    await page.click("#zoomIn"); await page.click("#zoomIn");
    const c1 = await lineAt(w / 2, h / 2);
    checks.push(check("+ twice: zoom shown", await page.textContent("#zoomVal"), "==", "225%"), check("line view scale × (+ twice)", Math.abs(c1[2] / c0[2] - 2.25), "<=", 0.001),
      check("the centre stays put (working px off)", Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) * c1[2], "<=", 1));
    const box = await page.$eval("#view", (c) => { const r = c.getBoundingClientRect(); return [r.x, r.y, r.width, c.width / r.width]; });
    const sx = box[0] + box[2] * 0.3, sy = box[1] + 60, before = await lineAt((sx - box[0]) * box[3], (sy - box[1]) * box[3]);
    await page.mouse.move(sx, sy); await page.keyboard.down("Control"); await page.mouse.wheel(0, -100); await page.keyboard.up("Control"); await page.waitForTimeout(200);
    const after = await lineAt((sx - box[0]) * box[3], (sy - box[1]) * box[3]);
    checks.push(check("Ctrl + scroll zooms in", +(after[2] > before[2] * 1.5), "==", 1), check("the point under the pointer stays put (px off)", Math.hypot(after[0] - before[0], after[1] - before[1]) * after[2], "<=", 1));
    await page.click("label[for=view2D]"); await A.idle(page, 300); await page.waitForFunction(() => st.plot, null, { timeout: 30000 });
    checks.push(check("the 2D page keeps its own zoom (starts fitted)", await page.textContent("#zoomVal"), "==", "100%"));
    const mmAtCentre = () => page.evaluate(() => { const c = $("pageView"), r = c.getBoundingClientRect(); return eventMM({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }); });
    const m0 = await mmAtCentre(); await page.click("#zoomIn"); await page.click("#zoomIn"); const m1 = await mmAtCentre();
    checks.push(check("2D page zoomed: a click at the centre maps to the same paper point (mm off)", Math.hypot(m1[0] - m0[0], m1[1] - m0[1]), "<=", 0.05));
    await page.click("label[for=viewDesign]"); await page.waitForTimeout(200);
    checks.push(check("back on the line: its zoom kept", +((await page.textContent("#zoomVal")) !== "100%"), "==", 1));
    await page.click("#zoomFit"); checks.push(check("Fit: back to 100%", await page.textContent("#zoomVal"), "==", "100%"));
    for (let i = 0; i < 6 && !(await page.$eval("#zoomOut", (b) => b.disabled)); i++) await page.click("#zoomOut");
    checks.push(check("− zooms out past fitted, down to 25%", await page.textContent("#zoomVal"), "==", "25%"), check("… and stops there (− greyed out)", +(await page.$eval("#zoomOut", (b) => b.disabled)), "==", 1));
    await page.click("#zoomFit"); checks.push(check("Fit from zoomed out: back to 100%", await page.textContent("#zoomVal"), "==", "100%"));
    await page.click("label[for=viewChoc]"); await page.fill("#copies", "6"); await page.dispatchEvent("#copies", "input");
    await page.waitForFunction(() => st.layers, null, { timeout: 60000 }); await A.idle(page, 300);
    const ink = (id) => page.$eval(id, (c) => { const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; });
    const pic = () => page.$eval("#stackView", (c) => c.toDataURL());
    const one = await ink("#stackView"), onePic = await pic(); await page.click("label[for=copiesAll]"); await A.idle(page, 300);
    const all = await ink("#stackView");
    checks.push(check("3D layers: Whole plate is a different picture (the plate and its copies)", +((await pic()) !== onePic), "==", 1));
    checks.push(check("3D layers: Whole plate shows the 6 copies", await page.evaluate(() => { drawStack(); return document.body.dataset.stage === "layers" && copiesShown() && placements(plateNow()).length; }), "==", 6));
    const kinds = await page.evaluate(() => { const p = printPath(), c = [0, 0, 0, 0, 0]; p.kind.forEach((k) => c[k]++); return c; });
    checks.push(check("Whole plate: the print as the G-code makes it has walls, travel, the purge line and wipes", +(kinds[0] > 0 && kinds[2] > 0 && kinds[3] > 0 && kinds[4] >= 6), "==", 1));
    const noFill = await pic(); await page.fill("#baseLayers", "1"); await page.press("#baseLayers", "Enter");
    await page.waitForFunction(() => st.layers && st.layers.S.N > 0, null, { timeout: 90000 }); await A.idle(page, 300);
    const fills = await page.evaluate(() => { let n = 0; printPath().kind.forEach((k) => { if (k === 1) n++; }); return n; });
    checks.push(check("adding a base layer: its fill moves appear in the whole print", fills, ">", 0), check("… and in the picture", +((await pic()) !== noFill), "==", 1));
    const withAll = await pic(); await page.uncheck("#pvTravel"); await page.uncheck("#pvPurge"); await page.waitForTimeout(300);
    checks.push(check("hiding travel and purge changes the picture", +((await pic()) !== withAll), "==", 1));
    await page.check("#pvTravel"); await page.check("#pvPurge");
    const solidPic = await pic(); await page.uncheck("#pvSolid"); await page.waitForTimeout(300);
    checks.push(check("Solid (as printed) off: lines instead of beads (picture changed)", +((await pic()) !== solidPic), "==", 1)); await page.check("#pvSolid");
    await page.click("label[for=copiesOne]"); await page.waitForTimeout(300);
    checks.push(check("One copy: travel and purge switches hidden, walls and fill shown", +(!(await page.isVisible("#pvTravel")) && (await page.isVisible("#pvWall")) && (await page.isVisible("#pvFill"))), "==", 1));
    await page.click("label[for=copiesAll]");
    await page.click("label[for=stPlate]"); await A.idle(page, 300);
    const plateAll = await page.$eval("#plate", (c) => c.toDataURL()); await page.click("label[for=copiesOne]"); await A.idle(page, 300);
    checks.push(check("Plate: One copy frames the design, not the whole plate", +((await page.$eval("#plate", (c) => c.toDataURL())) !== plateAll), "==", 1));
    checks.push(check("page errors", errors.length, "==", 0));
    await close(); return { checks, notes: `layers ink: one copy ${one}, whole plate ${all}` };
  },
};
