const A = require("../lib/app.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A62",
  title: "Vase shapes in the app: the shape from above (a traced drawing's too), the rim's shape, twist, strength, lattice and rim, undo, and a vase from before them",
  guards: "features/vase/vase.js: the Shape, Texture, Movement and Rim controls and their map chips, the strength curve editors, Make a vase from this line; model.js passing the lattice to the ready list",
  why: "Added 10 November 2026 with the vase shapes (E59 checks the engine): the controls have to reach the vase in use, show only what applies, undo, and open a vase saved before they existed.",
  how: "Opens the leaf (traced) and taps the Line tool's Make a vase from this line, then Star with 5 points, a circle at the rim and a 45° turn. Picks Diamond, the Middle strength, a lattice of 2 layers and a rolled rim; reads the Print step's ready list; undoes the rim; picks a scalloped rim. Last, puts in a vase with only the old settings (no shape, lean, strength or rim) and reads the controls.",
  pass: "The map shows Profile, Shape, Texture, Movement and Rim; the vase follows the leaf's line exactly (over 512 points), says so, and offers Drawing; the star's Points row shows and the drawing's message doesn't; the vase in use has each setting; the ready list has a Lattice line; undo takes the rim back to plain; scallops show their own rows and lift the preview's top; the old vase opens as a circle with no lean and a plain rim; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx, { example: "leaf", viewport: { width: 1280, height: 1000 } });
    const checks = [];
    await A.idle(page, 8000);
    const traced = await page.evaluate(() => !!(st.final && st.final.re && st.final.re.length > 8));
    // a drawing's shape comes from the Line tool (Make a vase from this line), not pulled in from the vase
    await A.card(page, "h-line"); await A.idle(page, 500);
    await page.click("#vaseFromLine"); await A.idle(page, 8000);
    const chips = await page.evaluate(() => ["vprofile", "vshape", "vtexture", "vmove", "vrim"].filter((n) => document.querySelector(`[data-node="${n}"]`)).length);
    checks.push(check("the leaf traced, then the vase's five chips on the map", +traced + chips, "==", 6));
    const dr = await page.evaluate(() => ({ kind: st.model.vase.plan.kind, exact: !!st.model.vase.plan.exact, n: (st.model.vase.plan.loop || []).length, msg: $("vpDrawMsg").textContent, drawShown: !!$("vpDrawingLab").getClientRects().length }));
    checks.push(check("Drawing: the leaf's line in use, exactly (numbers)", +(dr.kind === "drawing") + +dr.exact + +(dr.n > 1024), "==", 3), check("… it says where it came from, and Drawing shows", +/traced line/.test(dr.msg) + +dr.drawShown, "==", 2));
    const slide = async (id, v) => { await A.setValue(page, "#" + id, v, "input"); await page.dispatchEvent("#" + id, "change"); await A.idle(page, 3000); };
    await page.click('label[for="vpStar"]');
    await A.idle(page, 3000);
    await slide("vpSides", 5);
    await page.click('label[for="vrCircle"]');
    await A.idle(page, 3000);
    await slide("vaseTwist", 45);
    const rows = await page.evaluate(() => ({ sides: !!$("vpSides").getClientRects().length, use: !!$("vpDrawMsg").getClientRects().length }));
    checks.push(check("a star: its Points row shows, the drawing's message doesn't", +rows.sides + +!rows.use, "==", 2));
    await page.click('[data-node="vtexture"]');
    await A.idle(page, 1500);
    await page.click('label[for="vtDiamond"]');
    await A.idle(page, 3000);
    await page.click('[data-curve="vtCurve"] [data-k="middle"]');
    await A.idle(page, 3000);
    // (a vase from a line starts with no movement: a lattice flips the waves)
    await page.click('label[for="vmWave"]'); await A.idle(page, 3000);
    await slide("vmFlip", 2);
    await page.click('[data-node="vrim"]');
    await A.idle(page, 1500);
    await page.click('label[for="vrimRolled"]');
    await A.idle(page, 4000);
    const V = await page.evaluate(() => st.model.vase);
    checks.push(check("the vase in use: a 5-point star, a circle at the rim, turning 45°", +(V.plan.kind === "star" && V.plan.sides === 5) + +(V.planTop && V.planTop.kind === "circle") + +(V.twist === 45), "==", 3),
      check("… diamonds (with a twist of their own), strongest in the middle", +(V.texture.kind === "diamond" && V.texture.twist === 45) + +(JSON.stringify(V.strength.texture) === "[[0,0],[0.5,1],[1,0]]"), "==", 2),
      check("… a lattice every 2 layers, a rolled rim", +(V.move.flip === 2) + +(V.rim.kind === "rolled"), "==", 2));
    await page.evaluate(() => mapOpen("print"));
    await A.idle(page, 25000);
    const ready = await page.evaluate(() => document.body.innerText);
    checks.push(check("the ready list: a Lattice line", +/Lattice: \d+ layers? bridge/.test(ready), "==", 1));
    await page.click("#undoBtn");
    await A.idle(page, 4000);
    checks.push(check("undo: the rim back to plain", await page.evaluate(() => st.model.vase.rim.kind), "==", "none"));
    // scallops: their own rows, and the crests in the vase in use
    await page.click('[data-node="vrim"]');
    await A.idle(page, 1500);
    await page.click('label[for="vrimScallop"]');
    await A.idle(page, 4000);
    const sc = await page.evaluate(() => ({ kind: st.model.vase.rim.kind, count: !!$("vrimCount").getClientRects().length, lab: $("vrimSizeLab").textContent, lifted: st.model.rows.some((r) => r.dz && Math.max(...r.dz) > 0.5) }));
    checks.push(check("scalloped rim: in use, its Scallops round row, Crests rise, the preview's top lifted", +(sc.kind === "scallop") + +sc.count + +(sc.lab === "Crests rise") + +sc.lifted, "==", 4));
    // a vase saved before the shapes: only its old settings
    await page.evaluate(() => {
      useVase({ height: 30, profile: [[0, 12], [1, 14]], texture: { kind: "ribs", count: 10, depth: 1, twist: 0, spacing: 4 }, move: { kind: "wave", size: 0.5, count: 16, shift: 0 } }, true);
      vaseUI();
    });
    await A.idle(page, 4000);
    const old = await page.evaluate(() => ({ plan: document.querySelector('input[name="vasePlan"]:checked').id, rim: document.querySelector('input[name="vaseRim"]:checked').id, lean: $("vaseLeanVal").textContent }));
    checks.push(check("an old vase: a circle, upright, a plain rim", +(old.plan === "vpCircle") + +(old.rim === "vrimNone") + +(old.lean === "upright"), "==", 3), check("no page errors", errors.length, "==", 0));
    await close();
    return { checks, notes: errors.join(" | ").slice(0, 300) };
  },
};
