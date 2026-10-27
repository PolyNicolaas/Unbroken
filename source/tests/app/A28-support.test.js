const A = require("../lib/app.js"), M = require("../lib/meshes.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A28", title: "Support on the 3D tab: overhangs flagged, a skirt or a wall chosen, the step set in Fine-tuning",
  guards: "a model that reaches out over nothing exporting without a word, a Support choice that doesn't change the print, and an Overhang per layer box that's ignored",
  why: "October 2026: supports are the print's own wall widened from the plate up (one continuous line can't print a separate one). The ready list has to say when a model needs one.",
  how: "Loads a mushroom (a 4 mm stem under a 14 mm cap) and opens the 3D tab with Support off: reads the ready list and the Overhang box's auto value. Picks Flared skirt, then Thin wall: reads the ready list and the line's length. Then Support off with Overhang per layer 2 mm.",
  pass: "Off: the ready list warns of an overhang over 1 mm at the cap and the box shows auto 0.28 (a third of the 0.84 mm line); each support: the ready list names it and the warning is gone, both lines are longer than with none; 2 mm a layer: no overhang warning; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx), checks = [];
    await A.source(page, "model"); await A.idle(page);
    await page.setInputFiles("#anyFile", { name: "mushroom.stl", mimeType: "model/stl", buffer: Buffer.from(M.stl(M.mushroom())) }); await A.idle(page, 1000);
    await page.click("label[for=viewChoc]"); await page.fill("#printHeightMM", "22"); await page.press("#printHeightMM", "Tab"); await A.idle(page);
    const ready = () => page.$$eval("#readyList li", (l) => l.map((x) => x.textContent).join(" · ")), len = () => page.evaluate(() => st.layers.stack.laps.reduce((a, q) => a + q.length, 0));
    const off = await ready(), m = /Overhang: a layer steps out ([\d.]+) mm/.exec(off), L0 = await len();
    checks.push(check("Support off: the ready list warns of the cap's overhang (mm a layer)", m ? +m[1] : 0, ">", 1),
      check("… Overhang per layer shows auto 0.28", +/auto: 0\.28/.test(await page.textContent("#fromOver")), "==", 1));
    const got = {};
    for (const [mode, name] of [["skirt", "flared skirt"], ["thin", "thin wall"]]) {
      await page.selectOption("#support", mode); await A.idle(page); const r = await ready(); got[mode] = await len();
      checks.push(check(`${name}: named in the ready list, no overhang warning`, +(r.includes(`Support (${name})`) && !/Overhang: a layer/.test(r)), "==", 1));
    }
    checks.push(check("line length: skirt − none (mm)", got.skirt - L0, ">", 0), check("… thin wall − none (mm)", got.thin - L0, ">", 0));
    await page.selectOption("#support", "off"); await page.click("#card-h-machine .card-toggle"); await page.fill("#gOver", "2"); await page.press("#gOver", "Tab"); await A.idle(page);
    checks.push(check("Overhang per layer 2 mm: no overhang warning", +/No overhang past 2\.00 mm/.test(await ready()), "==", 1));
    checks.push(check("page errors", errors.length, "==", 0));
    await close(); return { checks };
  },
};
