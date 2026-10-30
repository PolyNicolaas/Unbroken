const A = require("../lib/app.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A49", title: "Test matrix: the skull cup as nine copies, each with its own speed, flow and layer height (L9), scored for the best levels",
  guards: "copies printed with the wrong settings, a layer height that doesn't change the slicing, a comb that doesn't count its copy, a flow that doesn't reach the plunger, scores that don't pick the best levels, and levels or scores lost from the design",
  why: "Settings are where prints fail (v124): a Taguchi L9 tests three settings at three levels in nine prints. The sample is a low-poly skull cup (Printables, CC BY-NC 4.0) at 25 mm, a harder shape than a plain vase.",
  how: "Opens ?example=vase (the skull now), goes to Print, sets levels 15/20/25 mm/s, 90/100/110%, 0.25/0.3/0.35 mm, and builds the matrix plan. Reads each copy's comb, first layer, layers, feed and flow. Exports the G-code and reads its head. Scores the nine copies so that 25 mm/s, 110% and 0.25 mm come out best, and uses the best levels.",
  pass: "The sample is the skull cup, 25 mm tall; nine combs with 1 to 9 teeth; each copy's first layer at its own layer height and its layers that far apart (25 mm ÷ the height, ±2 layers); its feed its speed; its flow (e against the export's) its layer height × flow ÷ the Print step's; nine copies inside the plate; the G-code names the nine copies; the best levels shown and put into Fine-tuning (25 mm/s, 110%, 0.25 mm); the levels and scores saved with the design; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx, { example: "vase" }), checks = [];
    const m = await page.evaluate(() => ({ name: st.model && st.model.name, h: printedMM() }));
    checks.push(check("the sample: the skull cup, 25 mm tall", +(m.name === "sample skull cup" && Math.abs(m.h - 25) < 0.1), "==", 1));
    checks.push(check("its credit on the 3D model card (title, link, licence)", +(await page.evaluate(() => !$("modelCredit").hidden && /CC BY-NC 4\.0/.test($("modelCredit").textContent) && /printables\.com\/model\/555563/.test($("modelCredit").querySelector("a").href))), "==", 1));
    await A.print(page); await A.idle(page, 4000);
    const put = (id, v) => page.evaluate(([id, v]) => { $(id).value = v; $(id).dispatchEvent(new Event("input", { bubbles: true })); }, [id, v]);
    await put("gFeed", 20); await put("gFlow", 100); await put("layerH", 0.3); await A.idle(page, 3000);
    for (const [k, v] of [["S", [15, 20, 25]], ["F", [90, 100, 110]], ["H", [0.25, 0.3, 0.35]]]) for (let j = 0; j < 3; j++) await put(`mx${k}${j + 1}`, v[j]);
    const P = await page.evaluate(async () => {
      const p = await mxPlan(), g = p.g, out = [];
      for (let i = 0; i < 9; i++) {
        const c = p.paths[2 * i], s = p.paths[2 * i + 1], zs = { size: s.laps.filter((l) => l.kind !== "wall-finish").length };
        out.push({ teeth: c.x.length / 4, z0: +(s.z[0] + g.z).toFixed(3), layers: zs.size, f: s.f[5], e: s.e[5], run: p.runs[i], inX: Math.min(...c.x, ...s.x) >= 0 && Math.max(...c.x, ...s.x) <= BED.w, inY: Math.min(...c.y, ...s.y) >= 0 && Math.max(...c.y, ...s.y) <= BED.h });
      }
      return { out, w: p.w, h: p.h, min: p.seconds / 60, ml: p.ml };
    });
    const O = P.out;
    checks.push(check("combs: 1 to 9 teeth", O.map((o) => o.teeth).join(","), "==", "1,2,3,4,5,6,7,8,9"));
    checks.push(check("each copy's first layer at its own layer height", +O.every((o) => Math.abs(o.z0 - o.run.h) < 1e-6), "==", 1));
    checks.push(check("each copy's layers: 25 mm ÷ its height (±2)", +O.every((o) => Math.abs(o.layers - 25 / o.run.h) <= 2), "==", 1));
    checks.push(check("each copy's feed is its speed", +O.every((o) => Math.abs(o.f - o.run.speed * 60) < 1e-6), "==", 1));
    checks.push(check("each copy's flow: its layer height × flow against the Print step's", +O.every((o) => Math.abs(o.e - (o.run.h / 0.3) * (o.run.flow / 100)) < 1e-6), "==", 1));
    checks.push(check("all nine on the plate", +O.every((o) => o.inX && o.inY), "==", 1));
    // the file
    await page.evaluate(() => { document.querySelectorAll("[data-moreprint], .print-more").forEach((e) => e.hidden = false); });
    const [dl] = await Promise.all([page.waitForEvent("download"), page.evaluate(() => $("mxBtn").click())]);
    const zip = require("fs").readFileSync(await dl.path()), text = zip.toString("latin1");
    checks.push(check("the G-code names the nine copies", (text.match(/; copy \d: /g) || []).length, "==", 9), check("the file name", +/^matrix-l9_.*-gcode\.zip$/.test(dl.suggestedFilename()), "==", 1));
    // scores: 25 mm/s, 110% and 0.25 mm best
    const best = await page.evaluate(() => {
      const sc = mxRunList().map((r) => 1 + (r.speed === 25 ? 2 : 0) + (r.flow === 110 ? 1 : 0) + (r.h === 0.25 ? 1 : 0));
      sc.forEach((v, i) => { const inp = document.querySelector(`[data-mx="${i}"]`); inp.value = v; inp.dispatchEvent(new Event("input", { bubbles: true })); });
      $("mxUse").click();
      return { feed: +$("gFeed").value, flow: +$("gFlow").value, h: +$("layerH").value, text: $("mxBest").textContent, saved: (record(), designState().v) };
    });
    checks.push(check("the best levels put into Fine-tuning", `${best.feed}/${best.flow}/${best.h}`, "==", "25/110/0.25"));
    checks.push(check("levels and scores saved with the design", +(best.saved.mxS3 === "25" && JSON.parse(best.saved.mxScores).filter((v) => v).length === 9), "==", 1));
    checks.push(check("page errors", errors.length, "==", 0));
    await close();
    return { checks, notes: `matrix ${Math.round(P.w)} × ${Math.round(P.h)} mm, ~${Math.round(P.min)} min, ${P.ml.toFixed(1)} ml; layers per copy ${O.map((o) => o.layers).join(", ")}; ${best.text}` + (errors.length ? "  \n" + errors.join("  \n") : "") };
  },
};
