const A = require("../lib/app.js"), { check } = require("../lib/check.js"), fs = require("fs");
module.exports = {
  slow: true,
  id: "A14", title: "Layers: a base and an infill on the 3D tab, walls as Design draws them; the G-code climbs",
  guards: "infill leaking back into the Design trace, a base or infill whose fill doesn't show or reach the G-code, a density that doesn't change the fill, a layer readout that doesn't follow the settings, and G-code that stays flat",
  why: "Fill helps a print stand up, so it lives with the layers on the 3D tab: a Base (filled layers at the bottom, 0 by default) and an Infill (inside the layers above, 0% by default: hollow). Each has a density (100% puts the rows a line width apart, touching), a pattern, and for Lines an angle and how many layers keep it before turning 90°. Design is the drawing alone, so its trace must not change, while the 3D tab and the G-code show the layers.",
  how: "Opens the app, sets the leaf to 60 mm, notes Design's term count, goes to the 3D tab: 0 base layers and one layer 0.3 mm tall. Sets 2 base layers and 6 above; reads the readouts and the preview; puts the layer slider on layer 2 and makes the print taller; exports G-code and reads its Z range; types a height of 10 mm, then undoes. Sets the base density to 50% and 0%, then Rings at 100%; sets the infill to 30% and reads the line of the layers above and the turning angles.",
  pass: "Design shows no base or infill controls and its term count doesn't change; 0 base layers and one 0.3 mm layer to start; 2 base layers are filled at 100%; 8 layers, 2.4 mm; the preview shows the filled base; the slider shows every layer again after the print changes; printing Z from 0.3 to 2.4 mm; 10 mm gives 31 layers above (9.9 mm) and undo goes back; 50% makes the base line under 0.85 × as long, 0% leaves it open; Rings fills at 100% and hides the angle; 30% infill puts over 1.3 × as much line in the layers above, and the infill turns 45, 45, 135, 135, 45°; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx), checks = [];
    const idle = () => A.idle(page, 300);   // until the app has settled (lib/app.js)
    await page.fill("#outW", "60"); await page.press("#outW", "Enter"); await idle();
    const N0 = await A.terms(page);
    checks.push(check("Design: no base or infill control showing", +(await page.isVisible("#baseLayers")) + +(await page.isVisible("#fillDensity")), "==", 0));
    await A.print(page); await idle();
    checks.push(check("3D: Base and Infill cards shown", +(await page.isVisible("#basePattern")) + +(await page.isVisible("#fillDensity")), "==", 2));
    await page.waitForFunction(() => st.layers, null, { timeout: 30000 }); await A.idle(page, 300);
    checks.push(check("no base to start with: 0 base layers", await page.inputValue("#baseLayers"), "==", "0"),
      check("one layer: the height is one layer (mm)", +(await page.inputValue("#printHeightMM")), "==", 0.3), check("… and the readout says so", +/^1 layer · 0\.3 mm/.test(await page.textContent("#layerInfo")), "==", 1));
    await page.fill("#printHeightMM", "2.4"); await page.press("#printHeightMM", "Tab"); await idle();
    checks.push(check("height 2.4 mm with no base: 8 layers", +/^8 layers: no base/.test(await page.textContent("#layerCount")), "==", 1));
    await A.setValue(page, "#baseLayers", 2); await idle(); await idle();
    checks.push(check("2 base layers: the height stays, the layers above follow", +/^8 layers: 2 base \+ 6 above/.test(await page.textContent("#layerCount")), "==", 1));
    checks.push(check("base readout: 2 layers, filled at 100%", +/^2 layers · \d+ areas? at 100%/.test(await page.textContent("#infillVal")), "==", 1));
    checks.push(check("Design's term count unchanged by the filled base", await page.evaluate(() => st.N), "==", N0));
    const info = await page.textContent("#layerInfo");
    checks.push(check("readout: 8 layers, 2.4 mm", +/^8 layers · 2\.4 mm/.test(info), "==", 1));
    // the layer slider (3D layers view): left on layer 2, a change that makes a new print shows every layer again
    await A.setValue(page, "#layerUpTo", 2); await idle();
    const partial = await page.textContent("#layerUpToVal");
    await page.fill("#printHeightMM", "3"); await page.press("#printHeightMM", "Tab"); await idle(); await idle();
    const sl = await page.evaluate(() => { const e = document.getElementById("layerUpTo"); return { v: +e.value, max: +e.max, txt: document.getElementById("layerUpToVal").textContent }; });
    checks.push(check("layer slider on 2 of 8, then a taller print: back to every layer", +(partial === "2 of 8" && sl.max > 8 && sl.v === sl.max && /^all 10$/.test(sl.txt)), "==", 1));
    await page.fill("#printHeightMM", "2.4"); await page.press("#printHeightMM", "Tab"); await idle(); await idle();
    checks.push(check("stack preview drawn (px painted)", await page.$eval("#stackView", (c) => { const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; }), ">", 500));
    const lens = await page.evaluate(() => ({ base: st.layers.baseFinal.re.length, line: st.final.re.length }));
    checks.push(check("3D preview line: filled base longer than Design's line (×)", lens.base / lens.line, ">", 1.5));
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#gcodeBtn")]);
    const txt = fs.readFileSync(await dl.path()).toString("latin1"), lift = [...txt.matchAll(/^G1 Z[\d.]+ F600$/gm)].pop().index, body = txt.slice(txt.indexOf("M82 ; absolute E"), lift),
      zs = [...body.matchAll(/^G1 [^\n]*Z([\d.]+)/gm)].map((m) => +m[1]);   // every printing Z: after the start lines (purge line), before the final lift and the end lines
    checks.push(check("G-code: lowest printing Z (mm)", Math.min(...zs), "<=", 0.31), check("G-code: highest printing Z (mm)", Math.max(...zs), ">=", 2.39), check("G-code: highest printing Z (mm)", Math.max(...zs), "<=", 2.41));   // first layer at Z 0.3, the eighth at 0.3 + 7 × 0.3
    checks.push(check("Height field shows the readout's height (mm)", +(await page.inputValue("#printHeightMM")), "==", 2.4));
    await page.fill("#printHeightMM", "10"); await page.press("#printHeightMM", "Tab"); await idle(); await idle();
    checks.push(check("Height 10 mm → layers above (2 filled + 31 = 33 × 0.3 = 9.9)", +(await page.inputValue("#wallLayers")), "==", 31));
    checks.push(check("Height snaps to whole layers (mm)", +(await page.inputValue("#printHeightMM")), "==", 9.9));
    checks.push(check("readout follows: 33 layers, 9.9 mm", +/^33 layers · 9\.9 mm/.test(await page.textContent("#layerInfo")), "==", 1));
    await page.mouse.click(5, 5); await page.keyboard.press("Control+z"); await idle();
    checks.push(check("undo: back to 6 layers above, 2.4 mm", +((await page.inputValue("#wallLayers")) === "6" && +(await page.inputValue("#printHeightMM")) === 2.4), "==", 1));
    // Fine-tuning: a thicker layer keeps the height, fewer layers; Z follows; the card says what changed; Back to the profile
    await page.click("#card-h-machine .card-toggle"); await A.setValue(page, "#layerH", 0.4); await idle(); await idle();
    checks.push(check("layer height 0.4: the height stays 2.4 mm, 6 layers (2 base + 4)", await page.textContent("#layerCount"), "==", "6 layers: 2 base + 4 above · 0.40 mm each"),
      check("… first layer Z follows (mm)", +(await page.inputValue("#gZ")), "==", 0.4), check("… Fine-tuning says one changed", await page.textContent("#tuneVal"), "==", "1 changed"));
    await page.click("#tuneReset"); await idle(); await idle();
    checks.push(check("Back to the profile values: 0.3 mm, 8 layers, nothing changed", +(/^8 layers/.test(await page.textContent("#layerCount")) && (await page.textContent("#tuneVal")) === "as the profiles" && +(await page.inputValue("#gZ")) === 0.3), "==", 1));
    // density: the base's line gets shorter as the rows spread; 0% leaves the base open (no fill)
    const baseLen = () => page.evaluate(() => { const S = st.layers.stack, l = S.laps[0]; return l.length; });
    const full = await baseLen(); await A.setValue(page, "#baseDensity", 50); await idle(); await idle();
    const half = await baseLen();
    checks.push(check("base density 50%: the first layer's line shorter than at 100% (×)", half / full, "<", 0.85));
    await A.setValue(page, "#baseDensity", 0); await idle(); await idle();
    checks.push(check("base density 0%: open, no fill", +/open \(0%\)/.test(await page.textContent("#infillVal")), "==", 1));
    await A.setValue(page, "#baseDensity", 100); await page.selectOption("#basePattern", "rings"); await idle(); await idle();
    checks.push(check("Rings: filled at 100%", +/\d+ areas? at 100%/.test(await page.textContent("#infillVal")), "==", 1), check("Rings: no angle or turn", +!(await page.isVisible("#baseAngle")), "==", 1));
    // infill in the layers above: 3 differently turned lines at most (none needed when hollow)
    const wallsLen = () => page.evaluate(() => { const S = st.layers.stack; return S.laps.filter((l) => l.kind !== "base").reduce((a, l) => a + l.length, 0); });
    const hollow = await wallsLen(); await A.setValue(page, "#fillDensity", 30); await idle(); await idle(); await idle();
    checks.push(check("infill 30%: the layers above hold more line than hollow (×)", (await wallsLen()) / hollow, ">", 1.3), check("infill readout", +/^30% lines/.test(await page.textContent("#fillVal")), "==", 1));
    const turns = await page.evaluate(() => { const o = Object.assign(fillSettings(), { w: 1 }); return [0, 1, 2, 3, 4].map((j) => UNB.fillPlan(o, false, j).angle); });
    checks.push(check("infill: 2 layers at 45°, then 2 across them (angles)", turns.join(","), "==", "45,45,135,135,45"));
    checks.push(check("page errors", errors.length, "==", 0));
    await close(); return { checks, notes: info };
  },
};
