const A = require("../lib/app.js"), { check } = require("../lib/check.js"), fs = require("fs");
module.exports = {
  id: "A34", title: "Touch and scrolling: number steppers, the preview in view; fills per grey",
  guards: "a number box without − and +, a stepper that skips its step or limits or doesn't reach the app, the preview scrolling away with the settings, a phone's pinned preview taking the screen or not growing, and filled greys missing from the page or the SVG",
  why: "On touch screens a number is easier to nudge than to type, so every number box has − and + (finger-sized on touch screens). The preview stays in view while the settings scroll: a sticky column on wide screens, a compact pinned preview on phones (Bigger shows it in full). Making it for a pen plotter, grey levels can be filled (Fill, or Both with their edges traced), each with its own pen.",
  how: "Opens the app on a laptop-sized window; opens every step on Print and checks every number box has its buttons; presses + on Copies (Print step) and holds − on the margin; scrolls the settings and checks the preview stays put; Then a phone-sized window: the pinned preview's height, Bigger and Smaller. Then fills per grey: a pen plotter, the still-life sample, 5 greys, the darkest two Both and Fill; the page and the SVG.",
  pass: "Every number box on the Print step has − and +; + makes Copies 2 and the plate shows two copies; holding − on the margin steps it down more than once and never below its minimum; after scrolling 600 px the preview's top hasn't moved; on a phone the pinned preview is under 40% of the screen and Bigger makes it taller; the two filled greys plot as their own layers (3 in the SVG: strokes and two fills); no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx, { viewport: { width: 1400, height: 900 } }), checks = [];
    await page.click("label[for=viewChoc]"); await A.idle(page, 1200);
    // steppers
    let bare = [];
    for (const id of ["material", "print", "plate", "machine", "layers", "tests"]) {
      await page.click(`[data-node="${id}"]`); await A.idle(page, 400);
      bare = bare.concat(await page.evaluate(() => [...document.querySelectorAll('input[type="number"]')].filter((i) => i.offsetParent && !i.readOnly && i.dataset.stepper !== "off" && !(i.parentElement.classList.contains("num") && i.parentElement.querySelectorAll(".num-btn").length === 2)).map((i) => i.id)));
    }
    checks.push(check("Print step: number boxes without − and +", bare.length, "==", 0)); // (the Test matrix's grid of boxes is too tight for them: data-stepper="off", v124)
    await page.click("#copies ~ .num-btn"); await A.idle(page, 1500);
    checks.push(check("+ on Copies: 2, and the plate has two copies", +((await page.inputValue("#copies")) === "2" && /2 copies on the plate/.test(await page.textContent("#readyList"))), "==", 1));
    // hold − on the margin (Plot step: a pen plotter)
    await A.plot(page); await A.idle(page, 800);
    const minus = page.locator("#paperMargin").locator("xpath=preceding-sibling::button");
    const box = await minus.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.waitForTimeout(900); await page.mouse.up(); await A.idle(page, 800);
    const mg = +(await page.inputValue("#paperMargin"));
    checks.push(check("holding − on the margin: stepped down more than once (mm from 20)", 20 - mg, ">=", 2), check("… never below its minimum (mm)", mg, ">=", 0));
    await page.fill("#paperMargin", "20"); await page.press("#paperMargin", "Tab"); await A.idle(page, 500);
    await page.evaluate(() => { $("artForPrint").click(); }); await A.idle(page, 1500);
    await page.click("label[for=viewChoc]"); await A.idle(page, 800);
    // the preview stays in view
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(200);
    const top0 = await page.evaluate(() => document.querySelector(".stage").getBoundingClientRect().top);
    await page.evaluate(() => scrollTo(0, 600)); await page.waitForTimeout(300);
    const top1 = await page.evaluate(() => document.querySelector(".stage").getBoundingClientRect().top);
    checks.push(check("scrolled 600 px: the preview's top moved (px)", Math.abs(top1 - Math.min(top0, top1)) + Math.max(0, top0 - top1 - 60), "<=", 1));
    await close();
    // a phone: the pinned preview
    const ph = await A.open(ctx, { viewport: { width: 390, height: 844 } });
    const pinned = await ph.page.evaluate(() => document.querySelector(".left").getBoundingClientRect().height);
    await ph.page.click("#pvSize"); await ph.page.waitForTimeout(400);
    const big = await ph.page.evaluate(() => document.querySelector(".left").getBoundingClientRect().height);
    checks.push(check("phone: the pinned preview's share of the screen", pinned / 844, "<", 0.4), check("… Bigger makes it taller (px)", big - pinned, ">", 60));
    await ph.page.click("#pvSize"); await ph.close();
    // fills per grey
    const F = await A.open(ctx, { art: true });
    await F.page.click("label[for=artForPlot]"); await A.idle(F.page, 800);
    await A.example(F.page, "still"); await A.idle(F.page, 2000);
    await A.setValue(F.page, "#levels", 5); await A.idle(F.page, 3000); // (Grey levels: the Art step since v113)
    await F.page.click("label[for=level0b]"); await A.idle(F.page, 1500); await F.page.click("label[for=level1f]"); await A.idle(F.page, 2500);
    const fl = await F.page.evaluate(() => (st.sepStrokes.fills || []).map((f) => f.strokes.length));
    checks.push(check("two greys filled (strokes in the smaller fill)", fl.length === 2 ? Math.min(...fl) : 0, ">", 10));
    await F.page.click("label[for=viewDesign]"); await A.idle(F.page, 800); await A.out(F.page); await A.idle(F.page, 1500);
    const [dl] = await Promise.all([F.page.waitForEvent("download"), F.page.click("#exportBtn")]);
    const svg = fs.readFileSync(await dl.path(), "utf8");
    checks.push(check("the SVG: the strokes and each filled grey on its own layer", (svg.match(/inkscape:groupmode="layer"/g) || []).length, "==", 3), check("… the page says so", +/2 filled greys/.test(await F.page.textContent("#pageHint")), "==", 1));
    checks.push(check("page errors", errors.length + F.errors.length + ph.errors.length, "==", 0));
    await F.close();
    return { checks, notes: [...errors, ...F.errors, ...ph.errors].join("  \n") };
  },
};
