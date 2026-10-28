const A = require("../lib/app.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A06", title: "View menu works on desktop and phone widths",
  guards: "display options unreachable, or the menu cut off on a phone",
  why: "All display options live in one View menu. It must open fully on screen at desktop and phone widths, its toggles must work, and it must close the way people expect (click outside, Esc).",
  how: "At 1300 px and 390 px wide: opens View, checks the panel is fully on screen, switches line view and background, turns the plate mini-map off and on, closes with an outside click and with Esc.",
  pass: "At both widths: panel fully visible; mini-map hides and comes back; outside click and Esc both close the menu; no page errors.",
  async run(ctx) {
    const checks = [];
    for (const vp of [{ width: 1300, height: 1000 }, { width: 390, height: 844 }]) {
      const { page, errors, close } = await A.open(ctx, { viewport: vp }), w = vp.width;
      await page.click("#viewMenu summary"); await page.waitForTimeout(150);
      const b = await (await page.$("#viewMenu .viewpanel")).boundingBox();
      checks.push(check(`${w} px: panel fully on screen`, +(b.x >= 0 && b.y >= 0 && b.x + b.width <= vp.width && b.y + b.height <= vp.height), "==", 1));
      await page.selectOption("#lineView", "print"); await page.selectOption("#bg", "none"); await page.uncheck("#showMini"); await page.waitForTimeout(150);
      checks.push(check(`${w} px: mini-map hidden`, +(await page.$eval("#minimap", (e) => e.hidden)), "==", 1));
      await page.check("#showMini"); await page.waitForTimeout(150);
      checks.push(check(`${w} px: mini-map back`, +!(await page.$eval("#minimap", (e) => e.hidden)), "==", 1));
      await page.mouse.click(5, vp.height - 5); await page.waitForTimeout(150);
      checks.push(check(`${w} px: outside click closes`, +!(await page.$eval("#viewMenu", (e) => e.open)), "==", 1));
      await page.click("#viewMenu summary"); await page.keyboard.press("Escape"); await page.waitForTimeout(150);
      checks.push(check(`${w} px: Esc closes`, +!(await page.$eval("#viewMenu", (e) => e.open)), "==", 1), check(`${w} px: page errors`, errors.length, "==", 0));
      await close();
    }
    return { checks };
  },
};
