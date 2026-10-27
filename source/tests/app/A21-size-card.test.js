const A = require("../lib/app.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A21", title: "Size card: the gap leaves the size alone, fit inside a box, the plate limit, and text's size and letter height linked",
  guards: "the size jumping when the gap between lines changes, a print that can't be made bigger than the plate for 2D, a plate limit that doesn't hold, a box fit that overflows, and text whose size and letter height disagree",
  why: "Size is its own card on the Trace tab. A drawing for the pen plotter can be bigger than the chocolate printer's plate, so the slider goes to 1 m unless Keep the size within the build plate is ticked on the 3D tab (per printer). Fit inside a box scales to the biggest size that fits a given width and height. For text the print size leads: changing the width or height changes the letter height, and the other way round.",
  how: "Opens the app (the leaf). Reads the slider's top; sets the gap to 0.2, 2 and back to 0.5 mm, reading the size each time; fits the leaf inside 50 × 50 mm; ticks Keep within the plate and types a 400 mm width; unticks it. Then switches to Text, doubles the width and reads the letter height, and fits the text inside a box 300 mm wide. (Text can't shrink below the smallest readable letter height, so the box is a big one.)",
  pass: "A smaller gap leaves the size as it is; a 2 mm gap grows it to the new smallest and says so, and going back to 0.5 mm keeps that size; the slider reaches 1000 mm without the limit and the plate's width with it; the box fit is at most 50 × 50 mm with one side at 50 (to 0.2 mm); with the limit a typed 400 mm stops at the plate's widest; text: doubling the width doubles the letter height (to 3%), and the 300 mm box gives a print at most 300 mm wide (to 2%), at least 285 mm; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx), checks = [];
    const size = () => page.evaluate(() => ({ w: st.outW, h: st.outW * st.bh / st.bw, top: sizeAnchors().pop()[0], plate: plateW() }));
    let s = await size();
    checks.push(check("no limit: slider top (mm)", s.top, ">=", 999));
    // the gap between lines moves the marks, not the size; the size grows only when the lines no longer fit (and says so)
    const w0g = s.w; await A.setValue(page, "#lineGapMM", "0.2"); await A.idle(page, 1500); await A.idle(page, 800);
    checks.push(check("smaller gap: size unchanged (mm off)", Math.abs((await size()).w - w0g), "<=", 0.05));
    await A.setValue(page, "#lineGapMM", "2"); await A.idle(page, 1500); await A.idle(page, 800);
    const grown = await page.evaluate(() => ({ w: st.outW, s: st.marks.smallest, toast: $("toast").textContent }));
    checks.push(check("gap 2 mm: grows to the new smallest (mm off)", Math.abs(grown.w - grown.s), "<=", 0.1), check("… and says why", +/Made bigger/.test(grown.toast), "==", 1));
    await A.setValue(page, "#lineGapMM", "0.5"); await A.idle(page, 1500); await A.idle(page, 800);
    checks.push(check("gap back to 0.5 mm: the size stays (mm off)", Math.abs((await size()).w - grown.w), "<=", 0.05));
    await page.fill("#fitW", "50"); await page.fill("#fitH", "50"); await page.click("#fitBtn"); await A.idle(page, 800);
    s = await size();
    checks.push(check("fit inside 50 × 50: larger side off 50 mm by", Math.abs(Math.max(s.w, s.h) - 50), "<=", 0.2), check("fit inside 50 × 50: neither side over (mm over)", Math.max(s.w, s.h) - 50, "<=", 0.2));
    await page.click("label[for=viewChoc]"); await page.check("#limitPlate"); await page.click("label[for=viewDesign]");
    s = await size();
    checks.push(check("limit on: slider top is the plate's widest (mm off)", Math.abs(s.top - s.plate), "<=", 0.5));
    await page.fill("#outW", "400"); await page.press("#outW", "Enter"); await A.idle(page, 800);
    s = await size();
    checks.push(check("limit on: a typed 400 mm stops at the plate (mm over)", s.w - s.plate, "<=", 0.5));
    await page.click("label[for=viewChoc]"); await page.uncheck("#limitPlate"); await page.click("label[for=viewDesign]");
    await A.source(page, "text"); await page.click("label[for=viewDesign]"); await A.idle(page, 1200);
    const cap = () => page.evaluate(() => st.text.cap), cap0 = await cap(), w0 = (await size()).w;
    await page.fill("#outW", String(+(2 * w0).toFixed(1))); await page.press("#outW", "Enter"); await A.idle(page, 1500);
    const cap1 = await cap(), w1 = (await size()).w;
    checks.push(check("text: doubling the width doubles the letter height (ratio)", cap1 / cap0, ">=", 1.94), check("text: … at most (ratio)", cap1 / cap0, "<=", 2.06), check("text: width follows (ratio)", w1 / w0, ">=", 1.9));
    await page.fill("#fitW", "300"); await page.fill("#fitH", ""); await page.click("#fitBtn"); await A.idle(page, 1500);
    checks.push(check("text: fit 300 mm wide (mm)", (await size()).w, "<=", 306), check("text: … and close to it (mm)", (await size()).w, ">=", 285));
    checks.push(check("page errors", errors.length, "==", 0));
    await close(); return { checks, notes: `text letter height ${cap0} → ${cap1} mm for ${w0.toFixed(1)} → ${w1.toFixed(1)} mm` };
  },
};
