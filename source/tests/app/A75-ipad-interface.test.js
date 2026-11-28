const A = require("../lib/app.js"), { check } = require("../lib/check.js");
const fs = require("fs"), path = require("path");
module.exports = {
  id: "A75", title: "The interface on an iPad: one size as printed, the rail always at the left, controls big enough to tap",
  guards: "sizes that disagree (the Width box, the Size readout, the Plate card), the rail jumping to the right on Print, the preview resizing as the Tools bar comes and goes, controls too small for a fingertip, the Math panel empty, Make it 3D with nothing to make it from, a one-layer print's layer slider, and the old start message",
  why: "Nicolaas (25 November 2026): a walkthrough on an iPad-sized screen; he picked one size (the outside as printed) and the rail always at the left.",
  how: "An iPad-sized window (1180 × 820) with a touch pointer. Empty: the chip and Make it 3D. The leaf: Size (the boxes, the readout, typing a width as printed), the Plate card, the Tools bar's place on Line and Grey levels, Math, the rail's side on Print and its controls' heights. Screenshots go to results/ipad-*.png.",
  pass: "Empty: the chip says what to pick; no Make it 3D. The Width and Height boxes equal the Plate card's footprint (within 0.15 mm) and the Size header; 60 typed as the width prints 60 (within 1.5 mm). The Tools bar keeps its height on Grey levels (greyed). Math shows its working. Print: the rail at the left, the layer bar hidden for one layer. Tap targets: every visible button, select, number box and segment at least 36 px tall. No page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx, { clean: true, viewport: { width: 1180, height: 820 }, touch: true });
    const out = path.join(__dirname, "..", "results");
    const shot = (n) => page.screenshot({ path: path.join(out, `ipad-${n}.png`) });
    const wait = (ms) => page.waitForTimeout(ms);
    const o = {};
    o.coarse = await page.evaluate(() => matchMedia("(pointer: coarse)").matches);
    o.emptyChip = await page.textContent("#chip");
    o.emptyRelief = await page.evaluate(() => $("reliefRow").getClientRects().length > 0);
    await shot("1-empty");
    // the leaf
    await page.goto(page.url().split("?")[0] + "?example=leaf");
    await A.idle(page, 2500);
    // (with 2D · 2.5D · 3D, Make it 3D is the 3D chip's menu: there for a picture, no menu item for nothing)
    o.relief = await page.evaluate(() => { mapOpen("art"); return $("reliefRow").getClientRects().length > 0 || (document.body.dataset.dims === "1" && !$("reliefRow").hidden); });
    await page.evaluate(async () => { mapOpen("size"); await new Promise((r) => setTimeout(r, 300)); });
    o.size = await page.evaluate(() => ({ w: +$("outW").value, h: +$("outH").value, head: sizeText(), info: $("sizeInfo").textContent, lay: plateNow() }));
    o.toolsLine = await page.evaluate(() => $("box").closest(".stage").querySelector(".toolbar.tools").getBoundingClientRect().height);
    await shot("2-size");
    // typed: 60 mm wide as printed
    await page.evaluate(async () => { const b = $("outW"); b.value = "60"; b.dispatchEvent(new Event("change")); await new Promise((r) => setTimeout(r, 400)); await window.unbroken.whenReady(); });
    await wait(400);
    o.typed = await page.evaluate(() => ({ box: +$("outW").value, lay: plateNow() && plateNow().w }));
    // Grey levels: the Tools bar keeps its place, greyed
    o.toolsLevels = await page.evaluate(async () => { mapOpen("levels"); await new Promise((r) => setTimeout(r, 300)); const t = document.querySelector(".toolbar.tools"); return { h: t.getBoundingClientRect().height, op: getComputedStyle(t).opacity }; });
    await shot("3-levels");
    // Math
    o.math = await page.evaluate(async () => { mapOpen("math"); await new Promise((r) => setTimeout(r, 300)); const m = $("math"); return { open: m.open, h: m.querySelector(".math-body").getBoundingClientRect().height }; });
    await shot("4-math");
    // Print: the rail stays at the left; one layer: no layer bar
    o.print = await page.evaluate(async () => {
      mapOpen("print"); await new Promise((r) => setTimeout(r, 800)); await window.unbroken.whenReady();
      const rail = document.querySelector(".map").getBoundingClientRect(), panel = document.querySelector(".panel").getBoundingClientRect();
      return { railLeft: rail.left, panelLeft: panel.left, layerBar: $("layerUpTo").closest(".layerbar").getClientRects().length > 0 };
    });
    await shot("5-print");
    // tap targets on the Print and Size panels
    const small = async () => page.evaluate(() => [...document.querySelectorAll(".panel button, .panel select, .panel input[type=number], .panel .seg label")]
      .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden")
      .map((e) => ({ t: (e.textContent || e.id || e.getAttribute("aria-label") || "").trim().slice(0, 24), h: Math.round(e.getBoundingClientRect().height) }))
      .filter((x) => x.h < 36));
    o.smallPrint = await small();
    await page.evaluate(async () => { mapOpen("size"); await new Promise((r) => setTimeout(r, 300)); });
    o.smallSize = await small();
    fs.writeFileSync(path.join(out, "ipad-notes.json"), JSON.stringify(o, null, 1));
    const checks = [
      check("a touch pointer (pointer: coarse)", +o.coarse, "==", 1),
      check("empty: the chip says what to pick", +/pick a picture/.test(o.emptyChip), "==", 1),
      check("empty: no Make it 3D", +o.emptyRelief, "==", 0),
      check("a picture: Make it 3D on the Input card", +o.relief, "==", 1),
      check("Width box = the Plate card's footprint (mm off)", Math.abs(o.size.w - o.size.lay.w), "<=", 0.15),
      check("Height box = the Plate card's footprint (mm off)", Math.abs(o.size.h - o.size.lay.h), "<=", 0.15),
      check("the Size header says the boxes' size", +(o.size.head === `${o.size.w.toFixed(1)} × ${o.size.h.toFixed(1)} mm`), "==", 1),
      check("the readout names the line centre as the other size", +/line centre/.test(o.size.info), "==", 1),
      check("60 typed as the width: printed that wide (mm off)", Math.abs(o.typed.lay - 60), "<=", 1.5),
      check("Grey levels: the Tools bar keeps its height (px off)", Math.abs(o.toolsLevels.h - o.toolsLine), "<=", 1),
      check("Grey levels: the Tools bar greyed", +(+o.toolsLevels.op < 0.5), "==", 1),
      check("Math: open, its working shown (px tall)", o.math.open ? o.math.h : 0, ">", 100),
      check("Print: the rail at the left (px from the edge)", o.print.railLeft, "<", 40),
      check("Print: its panel next to the rail (px from the edge)", o.print.panelLeft, "<", 140),
      check("Print, one layer: no layer bar", +o.print.layerBar, "==", 0),
      check("Print panel: controls under 36 px tall", o.smallPrint.length, "==", 0),
      check("Size panel: controls under 36 px tall", o.smallSize.length, "==", 0),
      check("page errors", errors.length, "==", 0),
    ];
    await close();
    return { checks, notes: [`small on Print: ${JSON.stringify(o.smallPrint)}; on Size: ${JSON.stringify(o.smallSize)}`] };
  },
};
