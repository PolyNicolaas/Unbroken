const A = require("../lib/app.js"), { check } = require("../lib/check.js");
const shownCards = (page) => page.evaluate(() => [...document.querySelectorAll(".panel section.card")].filter((c) => c.offsetParent).map((c) => c.id));
module.exports = {
  id: "A38", title: "The layout: picture prep on the Art step, the tools on Line, the preview inside the window",
  guards: "Image prep or Grey levels back on the Line step (or missing from Art), the photo's settings outside the Picture card, the trace's tools showing on Art, a preview taller than the window on a laptop, a closed notice coming back, a Line card for a printer",
  why: "What changes the picture (Image prep, Grey levels) is on the Art step with the Picture card (v113), so the Line step is only how it's traced; the trace's tools belong to the Line step; on a laptop the preview takes the room and stays inside the window; notices can be put away (v115). Since the map of the steps (v140) each of these is a step on the map.",
  how: "Opens the leaf (a printer) at a laptop and an iPad size: reads the cards on Art, on Picture prep and on Line; checks the tools show on Line and not on Art, and the Photo box is inside the Picture card. On a 1512 × 900 laptop: the preview's width and bottom; closes a notice and reloads; the play speed's place; the printer's Line step. Opens empty: what the preview and the Input card offer.",
  pass: "Art: Input and Picture; Picture prep: Image prep and Grey levels; Line: neither; the tools on Line, not on Art; the Photo box inside the Picture card; on a 1512 × 900 laptop the preview at least 1000 px wide and inside the window; a closed notice stays closed after a reload; the play speed in the View menu; a printer's Line step has no Line card; empty: choose a file in the preview, Examples on the map, no drop zone in the Input card; no page errors.",
  async run(ctx) {
    const checks = [];
    for (const vp of [{ width: 1300, height: 900 }, { width: 1024, height: 768 }]) {
      const { page, errors, close } = await A.open(ctx, { art: true, viewport: vp }), W = vp.width;
      const art = await shownCards(page);
      await page.click('[data-node="prep"]'); await A.idle(page, 400);
      const prep = await shownCards(page);
      checks.push(check(`${W}: Art has Input and Picture`, +["card-h-input", "card-h-pic"].every((c) => art.includes(c)), "==", 1), check(`${W}: Picture prep has Image prep and Grey levels`, prep.join(","), "==", "card-h-prep,card-h-levels"));
      const toolsArt = await page.isVisible("#selectBtn");
      await page.click("label[for=viewDesign]"); await A.idle(page, 800);
      const line = await shownCards(page), toolsLine = await page.isVisible("#selectBtn");
      checks.push(check(`${W}: Line has no Image prep or Grey levels`, +!line.some((c) => c === "card-h-prep" || c === "card-h-levels"), "==", 1));
      checks.push(check(`${W}: the tools on Line, not on Art`, +(!toolsArt && toolsLine), "==", 1));
      checks.push(check(`${W}: the Photo box inside the Picture card`, +(await page.evaluate(() => !!$("photoBox").closest("#card-h-pic"))), "==", 1));
      checks.push(check(`${W}: page errors`, errors.length, "==", 0));
      await close();
    }
    // a laptop: the preview takes the room; a notice put away stays away
    const L = await A.open(ctx, { art: true, viewport: { width: 1512, height: 900 } });
    const pw = await L.page.evaluate(() => document.querySelector(".stage").getBoundingClientRect().width);
    const ph = await L.page.evaluate(() => document.getElementById("box").getBoundingClientRect().bottom);
    checks.push(check("laptop 1512 px: the preview's width (px)", pw, ">=", 1000), check("… inside the window's height (its bottom, px)", ph, "<=", 900));
    await A.out(L.page); await A.idle(L.page, 800); await L.page.click("[data-notice] .notice-x"); await L.page.reload(); await A.idle(L.page, 1500);
    checks.push(check("a notice closed stays closed after a reload", +(await L.page.evaluate(() => document.querySelector("[data-notice]").hidden)), "==", 1));
    await L.page.evaluate(() => { try { localStorage.clear(); } catch {} });
    const vis = (sel) => L.page.isVisible(sel);
    checks.push(check("the play speed in the View menu, not the toolbar", +(!(await vis("#speed")) && (await L.page.evaluate(() => !!$("speed").closest("#viewMenu")))), "==", 1));
    await L.page.click("label[for=viewDesign]"); await A.idle(L.page, 400);
    checks.push(check("a printer's Line step: no Line card (one continuous line, nothing to choose)", +!(await vis("#card-h-src")), "==", 1));
    checks.push(check("laptop: page errors", L.errors.length, "==", 0));
    await L.close();
    // the empty start: the preview says how to start, the examples are on the map
    const E = await A.open(ctx, { clean: true, art: true, viewport: { width: 1300, height: 900 } });
    checks.push(check("empty: choose a file in the preview, Examples on the map, no drop zone in the Input card", +(await E.page.isVisible("#esChoose")) + +(await E.page.isVisible('[data-node="examples"]')) + +!(await E.page.isVisible("#dropZone")), "==", 3));
    await E.close();
    return { checks };
  },
};
