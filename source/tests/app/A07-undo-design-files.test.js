const A = require("../lib/app.js"), { check } = require("../lib/check.js"), fs = require("fs"), os = require("os"), path = require("path");
module.exports = {
  id: "A07", title: "Undo, redo, and saving and opening designs",
  guards: "lost work; a saved design that doesn't come back the same",
  why: "Undo is the safety net while experimenting, and a saved design file is how work is kept and shared. Both must restore exactly the same trace, image designs and text designs alike, and opening a file must itself be undoable.",
  how: "Changes the threshold, then loose ends; undoes twice and redoes once, comparing each state with the original; saves the design, changes everything with the Photo preset, opens the file; does the same with a text design; undoes the open; opens a design saved with the speed in mm/min; tries to open a file that isn't a design.",
  pass: "Each undo/redo returns exactly the earlier trace and settings; reopened image and text designs match what was saved; undoing an open returns the previous design; a design saved with the speed in mm/min opens in mm/s; a wrong file gives a clear message; no page errors.",
  slow: true,
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx), checks = [];
    const state = async () => [await A.chip(page), await page.inputValue("#sens"), await page.inputValue("#loose"), await page.inputValue("#outW"), await page.textContent("#uncrossVal")].join(" | ");
    const s0 = await state();
    await A.setValue(page, "#sens", 25); await A.idle(page, 800); const s1 = await state();
    await A.setValue(page, "#loose", "0", "change"); await A.idle(page, 800); const s2 = await state();
    await page.mouse.click(5, 5); await page.keyboard.press("Control+z"); await A.idle(page, 800); checks.push(check("undo → previous state", +((await state()) === s1), "==", 1));
    await page.keyboard.press("Control+z"); await A.idle(page, 800); checks.push(check("undo again → original", +((await state()) === s0), "==", 1));
    await page.click("#redoBtn"); await A.idle(page, 800); checks.push(check("redo → state after first change", +((await state()) === s1), "==", 1));
    const save = async () => { const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#fileMenu summary").then(() => page.click("#saveDesign"))]); const f = path.join(os.tmpdir(), `unbroken-${Date.now()}-${dl.suggestedFilename()}`); await dl.saveAs(f); return f; };
    const fImg = await save(), before = await state();
    await page.evaluate(() => applyPreset("photo")); await A.idle(page, 800);
    await page.setInputFiles("#designFile", fImg); await A.idle(page, 1200); checks.push(check("image design reopened identically", +((await state()) === before), "==", 1));
    await page.click("label[for=srcText]"); await page.fill("#textIn", "Choco\nlove"); await page.dispatchEvent("#textIn", "input"); await A.idle(page, 1200);
    const tState = await state(), fTxt = await save();
    await page.click("label[for=srcImage]"); await A.idle(page, 1000); const imgState = await state();
    await page.setInputFiles("#anyFile", fTxt); await A.idle(page, 1200);
    checks.push(check("text design reopened identically", +((await state()) === tState && (await page.inputValue("#textIn")) === "Choco\nlove"), "==", 1));
    await page.mouse.click(5, 5); await page.keyboard.press("Control+z"); await A.idle(page, 1200);
    checks.push(check("undoing the open returns the previous design", +((await state()).split(" | ").slice(1, 3).join() === imgState.split(" | ").slice(1, 3).join()), "==", 1));
    // the Speed box was mm/min until v92: an older design converts, a newer one stays as saved
    const feeds = await page.evaluate(() => {
      const old = structuredClone(designState()); old.v.gFeed = "1200"; delete old.s.feedUnit; applyDesign(old);
      const a = +$("gFeed").value, now = structuredClone(designState()); now.v.gFeed = "12.5"; applyDesign(now);
      return [a, +$("gFeed").value, designState().s.feedUnit];
    }); await A.idle(page, 300);
    checks.push(check("a design saved in mm/min opens in mm/s (1200 → 20)", feeds[0], "==", 20), check("a design saved in mm/s opens as saved", feeds[1], "==", 12.5), check("designs say their speed unit", +(feeds[2] === "mm/s"), "==", 1));
    const bad = path.join(os.tmpdir(), "unbroken-not-a-design.json"); fs.writeFileSync(bad, "{\"hello\":1}");
    await page.setInputFiles("#designFile", bad); await A.idle(page, 300);
    checks.push(check("wrong file: clear message", +/isn't an Unbroken design file/.test(await page.textContent("#toast")), "==", 1), check("page errors", errors.length, "==", 0));
    await close(); return { checks };
  },
};
