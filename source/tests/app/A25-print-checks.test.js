const A = require("../lib/app.js"), { check } = require("../lib/check.js"), fs = require("fs");
module.exports = {
  id: "A25", title: "Print checks: help behind ⓘ, the cartridge warning, the ready list, the layer slider and the test print",
  guards: "explanations crowding the panel again, a plate that runs the cartridge dry without a warning, an export with a problem that says nothing, a layer slider that doesn't follow the layers, and a test print whose strips don't step",
  why: "October 2026 simplification: explanations sit behind an ⓘ (readouts and warnings stay on the page); a cartridge can't be changed mid-print, so the 3D tab says when a plate needs more chocolate than one holds; a checklist above Export G-code says whether the print is ready; a slider shows the print up to a layer; and a test print steps one setting across numbered strips.",
  how: "Opens the app: counts ⓘ buttons and visible help paragraphs, opens one. 3D tab: reads the ready list; sets a 15 mm height and 20 copies and reads the cartridge line and the list; clicks Export G-code, which still exports (only a red line holds it back). Sets 2 base layers, opens the layers view and moves the slider to 2. Opens Test print, exports it and reads the strips' layer heights from the G-code; Use it on strip 4.",
  pass: "At least 10 ⓘ and no help paragraph showing until one is opened; ready list starts all ✓; 20 copies × 15 mm: the cartridge line warns and names the copy to refill after, the list shows ⚠; the slider reads 2 of N and names the base; the test G-code has strips at 0.2–0.4 mm (first-layer Z 0.2, 0.25, 0.3, 0.35, 0.4); strip 4 sets the layer height to 0.35; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx), checks = [];
    const idle = () => A.idle(page, 300);
    checks.push(check("ⓘ buttons on the page", await page.$$eval("button.info", (b) => b.length), ">=", 10),
      check("help paragraphs showing at the start", await page.$$eval("p.hint.help", (p) => p.filter((e) => !e.hidden).length), "==", 0));
    await page.click("#cornerRow button.info");
    checks.push(check("ⓘ opens its explanation", +(await page.isVisible("#cornerHint")), "==", 1));
    const gapInfo = page.locator('button.info[aria-label="About Gap between lines (mm)"]');
    checks.push(check("Gap between lines has its own ⓘ", await gapInfo.count(), "==", 1));
    await gapInfo.click();
    checks.push(check("… which explains centre to centre = line width + gap, and 0 = just touching", +/centre to centre[\s\S]*gap of 0 puts beads side by side, just touching/.test(await page.evaluate(() => [...document.querySelectorAll("p.hint.help")].filter((p) => !p.hidden).map((p) => p.textContent).join(" "))), "==", 1));
    await A.print(page); await page.waitForFunction(() => st.layers, null, { timeout: 30000 }); await idle();
    const marks = () => page.$$eval("#readyList li", (l) => l.map((x) => x.className).join(","));
    checks.push(check("ready list: every line ✓ to start", +/^(ok,)*ok$/.test(await marks()), "==", 1), check("… heading says ready", await page.textContent("#readyVal"), "==", "ready"));
    await page.fill("#printHeightMM", "15"); await page.press("#printHeightMM", "Tab"); await A.setValue(page, "#copies", 20); await idle(); await idle();
    const cart = await page.textContent("#cartHint");
    checks.push(check("20 copies, 15 mm: the cartridge warns and says when to refill", +/more than one 50 ml cartridge.*refill after copy \d+/.test(cart), "==", 1),
      check("… and the ready list shows ⚠", +/warn/.test(await marks()), "==", 1));
    await page.click("#gcodeBtn"); await A.idle(page, 300);
    checks.push(check("⚠ only: Export G-code still exports", +/^Exported/.test(await page.textContent("#gcodeMsg")), "==", 1));
    await A.setValue(page, "#copies", 1); await page.fill("#printHeightMM", "1.8"); await page.press("#printHeightMM", "Tab"); await A.setValue(page, "#baseLayers", 2); await idle(); await idle();
    await page.click("label[for=stLayers]"); await page.waitForTimeout(300); await A.setValue(page, "#layerUpTo", 2); await page.waitForTimeout(300);
    checks.push(check("layer slider: 2 of 6", await page.textContent("#layerUpToVal"), "==", "2 of 6"), check("… names the layer", +/^base · lines at 90°/.test(await page.textContent("#layerWhat")), "==", 1));
    await page.click("#card-h-test .card-toggle");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#testBtn")]);
    const { execSync } = require("child_process"), zip = await dl.path(), gc = execSync(`unzip -p "${zip}"`).toString();
    const firstZ = [...gc.matchAll(/^G1 Z([\d.]+) F600$/gm)].map((m) => +m[1]);   // each path's first move down: layer 1 of each strip first
    checks.push(check("test print: first-layer Z of the 5 strips", firstZ.slice(0, 10).filter((_, i) => i % 2 === 1).join(","), "==", "0.2,0.25,0.3,0.35,0.4"));
    await page.fill("#testPick", "4"); await page.click("#testUse"); await idle();
    checks.push(check("Use it on strip 4: layer height 0.35", +(await page.inputValue("#layerH")), "==", 0.35));
    checks.push(check("page errors", errors.length, "==", 0));
    await close(); return { checks };
  },
};
