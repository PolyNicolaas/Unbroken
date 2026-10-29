const A = require("../lib/app.js"), { check } = require("../lib/check.js");
const shownCards = (page) => page.evaluate(() => [...document.querySelectorAll(".panel section.card")].filter((c) => c.offsetParent).map((c) => c.id));
module.exports = {
  id: "A38", title: "The layout: picture prep on the Art step, a Next bar, fewer small cards",
  guards: "Image prep or Grey levels back on the Line step (or missing from Art), a Next card coming back, the Next bar out of reach or going to the wrong step, the photo's settings outside the Picture card, the examples taking several rows once started, and the suggestion box showing before it's asked for",
  why: "v113 tidied the cards: what changes the picture (Image prep, Grey levels) is on the Art step with the Picture card, so the Line step is only how it's traced; one Next bar pinned at the foot of the settings replaces each step's Next card (always reachable on an iPad); the Photo settings are part of the Picture card; the examples become one sideways row once something is in; the suggestion box is in the File menu. v115: a slim top to the settings (Wheel, Collapse and Expand in the View menu), the trace's tools on the Line step only, Export in the last step's bar, notices that can be put away, and on a laptop a bigger preview that stays inside the window.",
  how: "Opens the app on the leaf (a printer) at a laptop and an iPad size; lists the cards on Art and Line; checks the Next bar is in view on each step and what it shows; follows it forward and back; checks the Photo box is inside the Picture card; checks the example chips sit in one row; checks the suggestion box is put away.",
  pass: "Art: Input, Picture, Image prep, Grey levels; Line: no Image prep or Grey levels; no Next cards anywhere; the Next bar's bottom within the window on Art, Line and Print, with Next: the line → on Art, ← Art and Next: print it → on Line, ← Line and Export G-code on Print, and each goes to its step; the Photo box is inside the Picture card; the examples in one row; the suggestion box not shown; the tools shown on Line and not on Art; on a 1512 × 900 laptop the preview at least 1000 px wide and inside the window, the Print step's Export G-code downloads the G-code, a closed notice stays closed after a reload; no page errors.",
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
        check(`${W}: … its buttons per step and where they go`, +(a1[1] === "Next: the line →" && a2[1] === "← Art | Next: print it →" && a2[2] && a3[1] === "← Line | Export G-code" && a3[2] && back1 && back2), "==", 1));
      // the trace's tools: on the Line step, not on Art
      const toolsArt = await page.isVisible("#selectBtn");
      await page.click("#goTrace"); await A.idle(page, 400);
      const toolsLine = await page.isVisible("#selectBtn");
      await page.click("#toArt"); await A.idle(page, 400);
      checks.push(check(`${W}: the tools on Line, not on Art`, +(!toolsArt && toolsLine), "==", 1));
      checks.push(check(`${W}: the Photo box inside the Picture card`, +(await page.evaluate(() => !!$("photoBox").closest("#card-h-pic"))), "==", 1));
      const rows = await page.evaluate(() => new Set([...document.querySelectorAll("#examplesRow .chip-btn")].map((b) => Math.round(b.getBoundingClientRect().top))).size);
      checks.push(check(`${W}: examples in one row once started (rows)`, rows, "==", 1));
      checks.push(check(`${W}: the suggestion box put away`, +!(await page.evaluate(() => !!$("card-h-notes").offsetParent)), "==", 1));
      checks.push(check(`${W}: page errors`, errors.length, "==", 0));
      await close();
    }
    // a laptop: the preview takes the room; the Print step's bar exports; a notice put away stays away
    const L = await A.open(ctx, { art: true, folded: true, viewport: { width: 1512, height: 900 } });
    const pw = await L.page.evaluate(() => document.querySelector(".stage").getBoundingClientRect().width);
    const ph = await L.page.evaluate(() => document.getElementById("box").getBoundingClientRect().bottom);
    checks.push(check("laptop 1512 px: the preview's width (px)", pw, ">=", 1000), check("… inside the window's height (its bottom, px)", ph, "<=", 900));
    await L.page.click("#goTrace"); await A.idle(L.page, 600); await L.page.click("#goOut"); await A.idle(L.page, 1500);
    const [dl] = await Promise.all([L.page.waitForEvent("download", { timeout: 20000 }), L.page.click("#nbGcode")]);
    checks.push(check("Print step: Export G-code in the Next bar downloads the G-code", +/gcode/i.test(dl.suggestedFilename()), "==", 1));
    await L.page.click("[data-notice] .notice-x"); await L.page.reload(); await A.idle(L.page, 1500);
    checks.push(check("a notice closed stays closed after a reload", +(await L.page.evaluate(() => document.querySelector("[data-notice]").hidden)), "==", 1));
    // v119: More print settings folded away (and remembered), the speed in the View menu, the printer's Line step
    const vis = (sel) => L.page.isVisible(sel);
    await A.print(L.page); await A.idle(L.page, 1500);
    const folded = !(await vis("#baseLayers")) && !(await vis("#card-h-test"));
    await L.page.click("#morePrintBtn"); await L.page.waitForTimeout(200);
    const opened = (await vis("#card-h-base")) && (await vis("#card-h-test")) && (await vis("#card-h-profile"));
    await L.page.reload(); await A.idle(L.page, 1500);
    const kept = await L.page.evaluate(() => document.body.dataset.moreprint === "1");
    await L.page.evaluate(() => { try { localStorage.clear(); } catch {} });
    checks.push(check("Print: Base, Infill, Fine-tuning, Test print, Printer profile folded under More print settings; opened; remembered", +(folded && opened && kept), "==", 1));
    checks.push(check("the play speed in the View menu, not the toolbar", +(!(await vis("#speed")) && (await L.page.evaluate(() => !!$("speed").closest("#viewMenu")))), "==", 1));
    await L.page.click("label[for=viewDesign]"); await A.idle(L.page, 400);
    checks.push(check("a printer's Line step: no Line card (one continuous line, nothing to choose)", +!(await vis("#card-h-src")), "==", 1));
    checks.push(check("laptop: page errors", L.errors.length, "==", 0));
    await L.close();
    // the empty start: the preview has the examples, the Input card only what to start from
    const E = await A.open(ctx, { clean: true, art: true, folded: true, viewport: { width: 1300, height: 900 } });
    checks.push(check("empty: the Input card without examples or the drop zone (the preview has them)", +(!(await E.page.isVisible("#examplesRow")) && !(await E.page.isVisible("#dropZone")) && (await E.page.isVisible("#emptyState [data-example=leaf]"))), "==", 1));
    await E.close();
    return { checks };
  },
};
