const A = require("../lib/app.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A04", title: "Text source: fonts, readable height, five-line limit",
  guards: "unreadable or unprintable lettering",
  why: "Typed text has its own rules: letters too small for the line width become blobs, so the height is raised to a readable minimum (8 line widths, 10 for the thin script fonts) with a warning; more than five lines is refused; every font must trace.",
  how: "Switches to Text, types six lines, asks for 3 mm letters at a 1 mm line, then traces \"Choco love\" in every font.",
  pass: "Only five lines are kept; 3 mm is raised to the font's minimum with a warning; every font traces with zero crossings and no page errors.",
  slow: true,
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx), checks = [];
    await page.click("label[for=srcText]"); await A.idle(page, 800);
    await page.fill("#textIn", "one\ntwo\nthree\nfour\nfive\nsix"); await page.dispatchEvent("#textIn", "input"); await A.idle(page, 800);
    checks.push(check("lines kept", (await page.inputValue("#textIn")).split("\n").length, "<=", 5));
    await page.fill("#textIn", "Choco\nlove"); await page.dispatchEvent("#textIn", "input");
    await A.setValue(page, "#capH", "3"); await A.idle(page, 800);
    const hint = await page.textContent("#capHint"), cls = await page.getAttribute("#capHint", "class");
    checks.push(check("3 mm letters raised with a warning", +(/At the smallest/.test(hint) && /warn/.test(cls)), "==", 1));
    await A.setValue(page, "#capH", "15"); await A.idle(page, 800);
    const fonts = await page.$$eval("#font option", (o) => o.map((x) => x.value));
    for (const f of fonts) {
      await page.selectOption("#font", f); await A.idle(page, 800);
      checks.push(check(`${f}: crossings`, +((await page.textContent("#uncrossVal")).split("→").pop()), "==", 0));
    }
    checks.push(check("fonts available", fonts.length, ">=", 9), check("page errors", errors.length, "==", 0));
    await close(); return { checks };
  },
};
