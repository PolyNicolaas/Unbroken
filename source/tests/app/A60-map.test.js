const A = require("../lib/app.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A60", title: "The map of the steps: the line through the steps the design takes, a node's cards on tap, its shape following the design",
  guards: "a map whose line doesn't follow the design (a model sent through the Line step, a plotter ending in Print), a node that opens the wrong cards or other cards beside them, a warning from the ready list that doesn't reach its node, and the step tabs not coming back when the map is switched off",
  why: "Nicolaas (9 November 2026) wanted to try the steps as a mind map: one interface, settings opened by tapping a node. The map only chooses which of the usual cards show, so this checks the choosing.",
  how: "Opens the leaf with the map on (View ▸ Map of the steps): reads the spine and its branches; taps Size, then Layers. Picks the Wavy vase: reads the spine, taps Movement. Makes it for a pen plotter. Turns the map off.",
  pass: "Leaf: the spine is Art, Line, Size, Print with Picture prep, Fit, Plate, Layers and the printer node; Size shows only the Size card and the Line step's preview; Layers shows Layers, Base and Infill on the Print step; the vase: Art then Print, with Profile, Surface texture and Movement, the Layers node dotted for the ready list's warning, Movement opening the 3D model card; a pen plotter ends in Plot, with no printer node; off: the step tabs and the Next bar back, every card of the step showing; no page errors.",
  slow: true,
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx, { map: true, art: true }), checks = [];
    await A.idle(page, 1500);
    const nodes = () => page.$$eval("#mapNodes .map-node", (els) => els.map((e) => e.dataset.node).sort().join(","));
    const spine = () => page.$$eval("#mapNodes .map-node.big", (els) => els.sort((a, b) => a.offsetLeft - b.offsetLeft).map((e) => e.dataset.node).join(","));
    const cards = () => page.$$eval(".panel section.card", (els) => els.filter((c) => c.getClientRects().length).map((c) => c.querySelector("h2").id).join(","));
    checks.push(check("leaf: the spine", await spine(), "==", "art,line,size,print"));
    checks.push(check("leaf: every node", await nodes(), "==", "art,fit,layers,line,machine,plate,prep,print,size,tune"));
    checks.push(check("the step tabs and the Next bar hidden", +(await page.$eval(".view-tabs.steps", (e) => !e.getClientRects().length)) + +(await page.$eval(".nextbar", (e) => !e.getClientRects().length)), "==", 2));
    await page.click('[data-node="size"]'); await A.idle(page, 800);
    checks.push(check("Size: only the Size card", await cards(), "==", "h-size"), check("… on the Line step", await page.evaluate(() => document.body.dataset.view), "==", "design"));
    await page.click('[data-node="layers"]'); await A.idle(page, 3000);
    checks.push(check("Layers: its cards", await cards(), "==", "h-layers,h-base,h-infill"), check("… on the Print step", await page.evaluate(() => document.body.dataset.view), "==", "choc"));
    await page.evaluate(() => vaseExample()); await A.idle(page, 1500);
    await page.click('[data-node="print"]'); await A.idle(page, 4000); await page.waitForTimeout(700);
    checks.push(check("vase: the spine", await spine(), "==", "art,print"), check("vase: its branches", +/vmove/.test(await nodes()) + +/vprofile/.test(await nodes()) + +/vtexture/.test(await nodes()) + +!/line|size/.test(await nodes()), "==", 4));
    checks.push(check("vase: the ready list's warning on Layers (too short to set)", await page.$eval('[data-node="layers"] .map-dot', (e) => e.className), "==", "map-dot warn"));
    await page.click('[data-node="vmove"]'); await A.idle(page, 600);
    checks.push(check("Movement: the 3D model card, at the movement", +(/h-model/.test(await cards())) + +(await page.$eval("#vmWave", (e) => { const r = e.closest(".seg").getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })), "==", 2));
    await page.click('.map-for[data-for="plot"]'); await A.idle(page, 1500); await page.waitForTimeout(700);
    checks.push(check("pen plotter: the line ends in Plot, no printer node", +/plot$/.test(await spine()) + +!/machine/.test(await nodes()), "==", 2));
    await page.click('.map-for[data-for="print"]'); await A.idle(page, 800);
    await page.evaluate(() => { $("mapUI").checked = false; $("mapUI").dispatchEvent(new Event("change")); }); await A.idle(page, 500);
    checks.push(check("off: the step tabs back", +(await page.$eval(".view-tabs.steps", (e) => e.getClientRects().length > 0)), "==", 1), check("off: the map hidden", +(await page.$eval("#map", (e) => !e.getClientRects().length)), "==", 1));
    checks.push(check("page errors", errors.length, "==", 0));
    await close();
    return { checks, notes: errors.join("  \n") };
  },
};
