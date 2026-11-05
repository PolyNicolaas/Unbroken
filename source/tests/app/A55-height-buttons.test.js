const A = require("../lib/app.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A55", title: "Layers card: Height's − and + move a whole layer",
  guards: "a Height button that does nothing",
  why: "The height snaps to whole layers (layers × layer height), but its buttons stepped 0.05 mm: + went 0.3 → 0.35, which snapped straight back to 0.3, so pressing + did nothing (found 3 November 2026). The buttons now step one layer, and − stops at the base (or one layer).",
  how: "Opens the Print step with the sample, presses Height's + three times and − once, reading the height and the layer count; then sets 2 base layers and reads the box's lowest value.",
  pass: "+ goes 0.3 → 0.6 → 0.9 → 1.2 mm (1 → 4 layers), − back to 0.9; with 0.125 mm layers every press moves exactly a layer (the box once showed 0.38 for 0.375, and the next step landed on the same layer); with 2 base layers the lowest height is 0.6 mm; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx), checks = [];
    await A.print(page); await A.idle(page); await A.idle(page);
    const v = async () => +(await page.inputValue("#printHeightMM")), plus = "#printHeightMM + .num-btn", minus = ".num:has(#printHeightMM) .num-btn:first-child";
    const seen = [await v()];
    for (let i = 0; i < 3; i++) { await page.click(plus); await A.idle(page); seen.push(await v()); }
    await page.click(minus); await A.idle(page); seen.push(await v());
    checks.push(check("heights after + + + −", seen.join(" "), "==", "0.3 0.6 0.9 1.2 0.9"), check("layers at 0.9 mm", +/^3 layers/.test(await page.textContent("#layerCount")), "==", 1));
    // a layer height whose multiples need 3 decimals (0.375): the box shows them in full, so every press moves
    await A.setValue(page, "#layerH", "0.125"); await A.idle(page);
    const fine = [await v()];
    for (let i = 0; i < 3; i++) { await page.click(plus); await A.idle(page); fine.push(await v()); }
    for (let i = 0; i < 2; i++) { await page.click(minus); await A.idle(page); fine.push(await v()); }
    checks.push(check("0.125 mm layers: every press moves a layer", +fine.every((x, i) => !i || Math.abs(Math.abs(x - fine[i - 1]) - 0.125) < 1e-6), "==", 1));
    await A.setValue(page, "#layerH", "0.3"); await A.idle(page);
    await A.setValue(page, "#baseLayers", "2"); await A.idle(page);
    checks.push(check("with 2 base layers, the lowest height (mm)", +(await page.getAttribute("#printHeightMM", "min")), "==", 0.6), check("page errors", errors.length, "==", 0));
    await close(); return { checks };
  },
};
