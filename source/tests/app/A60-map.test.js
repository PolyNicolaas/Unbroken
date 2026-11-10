const A = require("../lib/app.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A60", title: "The map of the steps: a band through the steps the design takes, settings as rows, examples in their own tray",
  guards: "a map whose line doesn't follow the design (a model sent through the Line step, a plotter ending in Print), a node that opens the wrong settings, a row moved out of its card and not put back (the step tabs would lose it), a warning from the ready list that doesn't reach its node, and the examples tray opening by itself",
  why: "Nicolaas (9 November 2026) chose the steps as a map: a band on top, the preview biggest, settings in a narrow column as one row each (like a slicer), Material first, quiet steps faded, and examples as a module of the map that opens only when asked. The map moves the real controls into its rows while a node is open, so this checks they come back.",
  how: "Opens the empty start with the map on and reads Line, Size and Print. Opens the leaf with the map on: reads the spine and the chips, checks the tray is closed and no example chips show in the settings. Opens Material, sets Flow to 110 and reads its row, presses ↺. Opens Line (the math in its panel, no drop area, line width only in Material). Opens Size, scrolls and drags over the preview, then opens Layers. Opens Examples and picks the Wavy vase: reads the spine, opens Movement. Makes it for a pen plotter. Opens another step and finds every moved control back in its card.",
  pass: "The 3D preview no taller than its pane after the window shrinks; no step or chip of the band on another (leaf, vase, plotter); Empty: Line and Print say nothing yet, Size blank; Leaf: the spine is Material, Art, Line, Size, Print, with Examples, Grey levels, Tracing, Plate, Machine, Layers and Tests as chips, Tracing and Tests faded; the tray closed and no example chips in the settings; Material: its settings as rows (printer, chocolate, needle, line width, gap, layer height, speed, flow), Flow 110 marked changed with ↺, which puts back 100; Size: only the Size card, and scrolling over the preview zooms it and dragging pans it without moving the page; Layers: Print height and Seconds per layer as rows, the Walls and support group hidden for a drawing; the tray lists every example and the Wavy vase from it gives Material, Art, Print with Profile, Texture and Movement chips and a dot on Layers; Movement opens the 3D model card; a pen plotter: Art, Line, Size, Plot, no Material; another step opened: every control and the math back in its place; no page errors.",
  slow: true,
  async run(ctx) {
    const checks = [];
    // the empty start: nothing to report yet, so no "ready" and no line
    { const { page, errors, close } = await A.open(ctx, { art: true, clean: true });
      await A.idle(page, 800);
      const v = await page.evaluate(() => ["line", "size", "print"].map((n) => document.querySelector(`[data-node="${n}"] .map-val`)?.textContent.trim() ?? "").join("|"));
      checks.push(check("empty: Line, Size and Print report nothing yet", v, "==", "nothing yet||nothing to print yet"), check("empty: page errors", errors.length, "==", 0));
      await close(); }
    const { page, errors, close } = await A.open(ctx, { art: true });
    await A.idle(page, 1500);
    const nodes = () => page.$$eval("#mapNodes .map-node", (els) => els.map((e) => e.dataset.node).sort().join(","));
    const spine = () => page.$$eval("#mapNodes .map-node.big", (els) => els.sort((a, b) => a.offsetLeft - b.offsetLeft).map((e) => e.dataset.node).join(","));
    const cards = () => page.$$eval(".panel section.card", (els) => els.filter((c) => c.getClientRects().length).map((c) => c.querySelector("h2").id).join(","));
    const inRows = (ids) => page.evaluate((ids) => ids.filter((i) => document.getElementById(i).closest("#mapRows")).length, ids);
    // no step or chip of the band sits on another (a vase's Layers chip was under Movement, 9 November 2026)
    const overlaps = () => page.$$eval("#mapNodes .map-node", (els) => { const r = els.map((e) => e.getBoundingClientRect()); let n = 0; for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) if (r[i].left < r[j].right - 1 && r[j].left < r[i].right - 1 && r[i].top < r[j].bottom - 1 && r[j].top < r[i].bottom - 1) n++; return n; });
    checks.push(check("leaf: no step on another", await overlaps(), "==", 0));
    checks.push(check("leaf: the spine", await spine(), "==", "material,art,line,size,print"));
    checks.push(check("leaf: every node", await nodes(), "==", "art,examples,layers,levels,line,machine,material,plate,print,size,tests,tracing"));
    checks.push(check("leaf: Tracing and Tests faded", +(await page.$eval('[data-node="tracing"]', (e) => e.classList.contains("quiet"))) + +(await page.$eval('[data-node="tests"]', (e) => e.classList.contains("quiet"))), "==", 2));
    checks.push(check("the examples tray closed, no example chips in the settings", +!(await page.$("#mapTray:not([hidden])")) + +!(await page.$("[data-examples]")), "==", 2));
    await page.click('[data-node="material"]'); await A.idle(page, 1200);
    const mat = ["printer", "chocolate", "needle", "layerH", "gFeed", "gFlow"];
    checks.push(check("Material: its settings as rows", await inRows(mat), "==", mat.length), check("… no cards beside them", await cards(), "==", ""));
    await page.fill("#gFlow", "110"); await page.dispatchEvent("#gFlow", "input"); await A.idle(page, 600);
    checks.push(check("Flow 110: marked changed, with ↺", +(await page.$eval("#gFlow", (e) => { const l = e.closest("label"); return l.classList.contains("changed") && !!l.querySelector(".map-reset").getClientRects().length; })), "==", 1));
    await page.click("#gFlow >> xpath=ancestor::label//button[contains(@class,'map-reset')]"); await A.idle(page, 600);
    checks.push(check("↺ puts back the recipe's flow", await page.inputValue("#gFlow"), "==", "100"));
    await page.click('[data-node="line"]'); await A.idle(page, 800);
    checks.push(check("Line: the math in its panel, line width and gap on its card (Material only shows them, 10 November 2026)", +!!(await page.$("#mapExtra #math")) + +!!(await page.$eval("#lineW", (e) => e.getClientRects().length && !!e.closest("#card-h-line"))) + +!!(await page.$eval("#lineGapMM", (e) => e.getClientRects().length)), "==", 3));
    await page.click('[data-node="material"]'); await A.idle(page, 600);
    await page.click("#mapToLine"); await A.idle(page, 600);
    checks.push(check("Material's link to the line's width and gap opens Line", await page.evaluate(() => +!!$("lineW").getClientRects().length), "==", 1));
    checks.push(check("a picture: no drop area beside the preview", await page.$eval("#dropZone", (e) => e.getClientRects().length), "==", 0));
    await page.click('[data-node="size"]'); await A.idle(page, 800);
    checks.push(check("Size: only the Size card", await cards(), "==", "h-size"), check("… on the Line step", await page.evaluate(() => document.body.dataset.view), "==", "design"));
    // scrolling over the preview zooms it and never moves the page; dragging pans
    { const b = await page.$eval("#box", (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      await page.evaluate(() => scrollTo(0, 0)); await page.mouse.move(b[0], b[1]);
      for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -100); await page.waitForTimeout(40); }
      const z = await page.evaluate(() => ({ y: scrollY, z: zoomOf(stageNow()).z, px: zoomOf(stageNow()).px }));
      await page.mouse.down(); await page.mouse.move(b[0] + 60, b[1], { steps: 4 }); await page.mouse.up();
      const after = await page.evaluate(() => ({ y: scrollY, px: zoomOf(stageNow()).px }));
      checks.push(check("scroll over the preview: zoomed in, the page still", +(z.z > 1.2 && z.y === 0), "==", 1), check("… a drag pans it, the page still", +(after.px !== z.px && after.y === 0), "==", 1)); }
    await page.click('[data-node="layers"]'); await A.idle(page, 3000);
    checks.push(check("Layers: height and time as rows", await inRows(["printHeightMM", "layerTime"]), "==", 2), check("… Walls and support hidden for a drawing", +(await page.$$eval("#mapRows .map-group", (gs) => gs.filter((g) => !g.hidden).map((g) => g.querySelector("h3").textContent)).then((t) => !t.includes("Walls and support"))), "==", 1));
    await page.click('[data-node="examples"]'); await A.idle(page, 400);
    checks.push(check("Examples: the tray lists every example", await page.$$eval("#mapTray .map-ex", (els) => els.length), "==", await page.evaluate(() => EXAMPLES.length)));
    await page.click('#mapTray .map-ex[data-example="wavyvase"]'); await A.idle(page, 1500);
    await page.click('[data-node="print"]'); await A.idle(page, 4000); await page.waitForTimeout(700);
    checks.push(check("vase: the spine", await spine(), "==", "material,art,print"), check("vase: its parts as chips", +/vmove/.test(await nodes()) + +/vprofile/.test(await nodes()) + +/vtexture/.test(await nodes()) + +!/line|size/.test(await nodes()), "==", 4));
    // the 3D preview stays inside its pane when the window gets smaller (it kept its old height and crept taller, 9 November 2026)
    { await page.setViewportSize({ width: 1000, height: 600 }); await page.waitForTimeout(1200);
      const over = await page.evaluate(() => Math.round($("stackView").getBoundingClientRect().height - $("paneLayers").getBoundingClientRect().height));
      checks.push(check("a smaller window: the 3D preview inside its pane (px over)", over, "<=", 0));
      await page.setViewportSize({ width: 1300, height: 1000 }); await A.idle(page, 800); }
    checks.push(check("vase: no step on another", await overlaps(), "==", 0));
    checks.push(check("vase: the ready list's warning on Layers", await page.$eval('[data-node="layers"] .map-dot', (e) => e.className), "==", "map-dot warn"));
    await page.click('[data-node="vmove"]'); await A.idle(page, 600);
    checks.push(check("Movement: the 3D model card", +/h-model/.test(await cards()), "==", 1));
    await page.click('.map-for[data-for="plot"]'); await A.idle(page, 1500); await page.waitForTimeout(700);
    checks.push(check("pen plotter: no step on another", await overlaps(), "==", 0));
    checks.push(check("pen plotter: the line ends in Plot, no Material", +/plot$/.test(await spine()) + +!/material|machine/.test(await nodes()), "==", 2));
    await page.click('.map-for[data-for="print"]'); await A.idle(page, 800);
    await page.click('[data-node="material"]'); await A.idle(page, 800);
    // a control moved into a node's rows goes back to its card when another node opens
    await page.click('[data-node="print"]'); await A.idle(page, 400);
    const home = await page.evaluate(() => ({ flow: !!$("gFlow").closest("#card-h-machine"), printer: !!$("printer").closest("#card-h-choc"), gap: !!$("lineGapMM").closest("#card-h-line"), height: !!$("printHeightMM").closest("#card-h-layers"), math: !$("math").closest("#mapExtra") }));
    checks.push(check("another step opened: every control and the math back in its place", +home.flow + +home.printer + +home.gap + +home.height + +home.math, "==", 5));
    checks.push(check("page errors", errors.length, "==", 0));
    await close();
    return { checks, notes: errors.join("  \n") };
  },
};
