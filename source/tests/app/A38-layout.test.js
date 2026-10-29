const A = require("../lib/app.js"), { check } = require("../lib/check.js");
const shownCards = (page) => page.evaluate(() => [...document.querySelectorAll(".panel section.card")].filter((c) => c.offsetParent).map((c) => c.id));
module.exports = {
  id: "A38", title: "The layout: picture prep on the Art step, a Next bar, fewer small cards",
  guards: "Image prep or Grey levels back on the Line step (or missing from Art), a Next card coming back, the Next bar out of reach or going to the wrong step, the photo's settings outside the Picture card, the examples taking several rows once started, and the suggestion box showing before it's asked for",
  why: "v113 tidied the cards: what changes the picture (Image prep, Grey levels) is on the Art step with the Picture card, so the Line step is only how it's traced; one Next bar pinned at the foot of the settings replaces each step's Next card (always reachable on an iPad); the Photo settings are part of the Picture card; the examples become one sideways row once something is in; the suggestion box is in the File menu.",
  how: "Opens the app on the leaf (a printer) at a laptop and an iPad size; lists the cards on Art and Line; checks the Next bar is in view on each step and what it shows; follows it forward and back; checks the Photo box is inside the Picture card; checks the example chips sit in one row; checks the suggestion box is put away.",
  pass: "Art: Input, Picture, Image prep, Grey levels; Line: no Image prep or Grey levels; no Next cards anywhere; the Next bar's bottom within the window on Art, Line and Print, with Next: the line → on Art, ← Art and Next: print it → on Line, ← Line on Print, and each goes to its step; the Photo box is inside the Picture card; the examples in one row; the suggestion box not shown; no page errors.",
  async run(ctx) {
    const checks = [];
    for (const vp of [{ width: 1300, height: 900 }, { width: 1024, height: 768 }]) {
      const { page, errors, close } = await A.open(ctx, { art: true, folded: true, viewport: vp }), W = vp.width;
      const art = await shownCards(page);
      checks.push(check(`${W}: Art has Input, Picture, Image prep, Grey levels`, +["card-h-input", "card-h-pic", "card-h-prep", "card-h-levels"].every((c) => art.includes(c)), "==", 1));
      const inView = () => page.evaluate(() => { const r = document.querySelector(".nextbar").getBoundingClientRect(); return r.height > 0 && r.bottom <= innerHeight + 1 && r.top >= 0; });
      const btns = () => page.evaluate(() => [...document.querySelectorAll(".nextbar button")].filter((b) => b.offsetParent).map((b) => b.textContent.trim()).join(" | "));
      const a1 = [await inView(), await btns()];
      await page.click("#goTrace"); await A.idle(page, 800);
      const line = await shownCards(page), a2 = [await inView(), await btns(), await page.isChecked("#viewDesign")];
      await page.click("#goOut"); await A.idle(page, 1200);
      const a3 = [await inView(), await btns(), await page.isChecked("#viewChoc")];
      await page.click("#backLine"); await A.idle(page, 600);
      const back1 = await page.isChecked("#viewDesign");
      await page.click("#toArt"); await A.idle(page, 600);
      const back2 = await page.isChecked("#viewArt");
      checks.push(check(`${W}: Line has no Image prep or Grey levels`, +!line.some((c) => c === "card-h-prep" || c === "card-h-levels"), "==", 1),
        check(`${W}: no Next cards`, (await page.$$("#card-h-next, #card-h-next2")).length, "==", 0),
        check(`${W}: the Next bar in view on Art, Line, Print`, +(a1[0] && a2[0] && a3[0]), "==", 1),
        check(`${W}: … its buttons per step and where they go`, +(a1[1] === "Next: the line →" && a2[1] === "← Art | Next: print it →" && a2[2] && a3[1] === "← Line" && a3[2] && back1 && back2), "==", 1));
      checks.push(check(`${W}: the Photo box inside the Picture card`, +(await page.evaluate(() => !!$("photoBox").closest("#card-h-pic"))), "==", 1));
      const rows = await page.evaluate(() => new Set([...document.querySelectorAll("#examplesRow .chip-btn")].map((b) => Math.round(b.getBoundingClientRect().top))).size);
      checks.push(check(`${W}: examples in one row once started (rows)`, rows, "==", 1));
      checks.push(check(`${W}: the suggestion box put away`, +!(await page.evaluate(() => !!$("card-h-notes").offsetParent)), "==", 1));
      checks.push(check(`${W}: page errors`, errors.length, "==", 0));
      await close();
    }
    return { checks };
  },
};
