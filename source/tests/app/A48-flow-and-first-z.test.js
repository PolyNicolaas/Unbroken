const A = require("../lib/app.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A48", title: "Tuning a chocolate: the Flow in Fine-tuning, and test prints of the flow and the first layer's Z",
  guards: "a Flow that doesn't reach the G-code, test strips that don't print what they're labelled, a first-layer Z test whose strips all start at one height, Use it that doesn't set the setting, and a Flow that isn't saved with the design",
  why: "Prints fail on the settings first: a thin or broken line (too little chocolate) and a first layer that won't stick (the needle too high). v124 adds the Flow (%) to Fine-tuning and a First layer Z test print, and a Flow strip's Use it now sets the Flow (it used to say to set it on the printer).",
  how: "Opens the leaf example for a printer. Sets Flow 110% and reads E per mm. Makes a Flow test (80–120%) and a First layer Z test (0.2–0.4 mm) through the app's own plan, reads each strip's flow factor and its first layer's height, and uses strip 4 of each. Then undoes once.",
  pass: "E per mm at 110% is 1.1× the 100% value; with the Flow at 110%, the Flow strips push 80, 90, 100, 110, 120% of the worked-out amount; the First layer Z strips' first layers sit at 0.2, 0.25, 0.3, 0.35, 0.4 mm above the plate (the export's first-layer Z plus each strip's offset) and every strip's layers stay one layer height apart; Use it sets Flow 110 and First layer Z 0.35; Undo takes the First layer Z back; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx, { example: "leaf" }), checks = [];
    await A.print(page); await A.idle(page, 1500);
    const put = (id, v) => page.evaluate(([id, v]) => { $(id).value = v; $(id).dispatchEvent(new Event("input", { bubbles: true })); $(id).dispatchEvent(new Event("change", { bubbles: true })); }, [id, v]);
    await put("gFlow", 100); const e100 = await page.evaluate(() => ePerMM());
    await put("gFlow", 110); const e110 = await page.evaluate(() => ePerMM());
    checks.push(check("E per mm at 110% ÷ at 100%", +(e110 / e100).toFixed(4), "==", 1.1));
    // flow strips, absolute % of the worked-out amount, with the Flow already at 110%
    await put("testVary", "flow"); await put("testN", 5); await put("testFrom", 80); await put("testTo", 120);
    const fl = await page.evaluate(() => { const t = testPlan(); return t.paths.filter((p) => p.laps).slice(0, 5).map((p) => Math.round(p.e[0] * flowPct())); });
    checks.push(check("Flow strips push 80…120% of the worked-out amount", fl.join(","), "==", "80,90,100,110,120"));
    await put("testPick", 4); await page.evaluate(() => $("testUse").click());
    checks.push(check("Use it on Flow strip 4 sets the Flow (%)", +(await page.inputValue("#gFlow")), "==", 110));
    // first-layer Z strips: each strip's own height above the plate, its layers a layer height apart
    await put("gZ", 0.3); await put("testVary", "firstZ"); await put("testFrom", 0.2); await put("testTo", 0.4); await put("testLayers", 2);
    const z = await page.evaluate(() => { const t = testPlan(), z0 = firstZ(), h = layerHmm(), st = t.paths.filter((p) => p.laps); const first = st.slice(0, 5).map((p) => +(p.z[0] + z0).toFixed(3)), second = st.slice(5, 10).map((p, k) => +(p.z[0] - st[k].z[0]).toFixed(3)); return { first, step: second.every((d) => Math.abs(d - h) < 1e-6) }; });
    checks.push(check("First layer Z strips start at 0.2…0.4 mm", z.first.join(","), "==", "0.2,0.25,0.3,0.35,0.4"), check("each strip's layers a layer height apart", +z.step, "==", 1));
    await page.evaluate(() => $("testUse").click()); await A.idle(page, 500);
    checks.push(check("Use it on Z strip 4 sets the First layer Z (mm)", +(await page.inputValue("#gZ")), "==", 0.35));
    const saved = await page.evaluate(() => { record(); return designState().v.gFlow; });
    checks.push(check("the Flow is saved with the design", +saved, "==", 110));
    await page.click("#undoBtn"); await A.idle(page, 800);
    checks.push(check("Undo takes the First layer Z back", +(await page.inputValue("#gZ")), "==", 0.3));
    checks.push(check("page errors", errors.length, "==", 0));
    await close();
    return { checks, notes: `E per mm ${e100.toPrecision(3)} → ${e110.toPrecision(3)}; flow strips ${fl.join(", ")}%; first layers ${z.first.join(", ")} mm` + (errors.length ? "  \n" + errors.join("  \n") : "") };
  },
};
