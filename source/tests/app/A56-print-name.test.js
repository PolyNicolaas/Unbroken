const A = require("../lib/app.js"), { check } = require("../lib/check.js"), { execSync } = require("child_process"), fs = require("fs");
module.exports = {
  id: "A56", title: "The print's name: typed at the top, it names every file saved or exported, and is saved with the design",
  guards: "files named after the wrong thing, or all called \"design\" (a Cyrillic text's name used to come out empty)",
  why: "A print needs a name of its own, and the files it makes should carry it (asked 4 November 2026). The box at the top of the page is on every step. Left empty, files are named after the design's text, pattern or picture, as before, and the box shows that name in grey. File names keep to letters, numbers and dashes for printer screens and USB sticks, so Cyrillic and Greek are spelled in Latin letters (ты → ty) instead of being dropped.",
  how: "Types a Cyrillic text, reads the name box's grey name and exports G-code; types \"Card for Anna\" and exports G-code and saves the design, reading both names and the G-code's first lines; then opens the saved design again in a fresh page.",
  pass: "Empty: the grey name and the G-code are named ty-i-krasavitsa (…_084_1x-gcode.zip); named: card-for-anna_084_1x-gcode.zip, the G-code says \"; name: Card for Anna\", the design saves as card-for-anna.unbroken.json; opened again, the box says Card for Anna; no page errors.",
  slow: true,
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx), checks = [];
    await A.source(page, "text"); await A.idle(page);
    await page.fill("#textIn", "Ты и красавица"); await page.dispatchEvent("#textIn", "input"); await A.idle(page); await A.idle(page);
    checks.push(check("empty: the grey name", await page.getAttribute("#designName", "placeholder"), "==", "Name this print (now: ty-i-krasavitsa)"));
    await A.print(page); await A.idle(page); await A.idle(page);
    const dl = async (sel) => { const [d] = await Promise.all([page.waitForEvent("download"), page.click(sel)]); return d; };
    checks.push(check("empty: G-code file", (await dl("#gcodeBtn")).suggestedFilename(), "==", "ty-i-krasavitsa_084_1x-gcode.zip"));
    await page.fill("#designName", "Card for Anna"); await page.dispatchEvent("#designName", "input"); await A.idle(page);
    const g = await dl("#gcodeBtn");
    checks.push(check("named: G-code file", g.suggestedFilename(), "==", "card-for-anna_084_1x-gcode.zip"),
      check("named: the G-code says the name", +/^; name: Card for Anna$/m.test(execSync(`unzip -p "${await g.path()}" | head -5`).toString()), "==", 1));
    await page.click("#fileMenu summary, details:has(#saveDesign) > summary").catch(() => {});
    const s = await dl("#saveDesign"), file = await s.path();
    checks.push(check("named: saved design file", s.suggestedFilename(), "==", "card-for-anna.unbroken.json"));
    const second = await A.open(ctx);
    await second.page.setInputFiles("#designFile", file); await A.idle(second.page); await A.idle(second.page);
    checks.push(check("opened again: the name is back", await second.page.inputValue("#designName"), "==", "Card for Anna"), check("page errors", errors.length + second.errors.length, "==", 0));
    await second.close(); await close(); return { checks };
  },
};
