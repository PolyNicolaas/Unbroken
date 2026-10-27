const A = require("../lib/app.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A20", title: "Races found in the October 2026 bug hunt stay fixed",
  guards: "a cancelled background worker breaking the next run, an old term-count sweep overwriting a new trace, typed text coming back after switching to an image, the 2D page keeping a drawing that's gone, and two open tabs overwriting each other's notes",
  why: "Each of these was a real bug found by an independent review. They only show when things overlap in time (switching quickly, cancelling, two tabs), which ordinary tests don't do, and they leave the page showing or exporting something other than what you set.",
  how: "In one page: starts and cancels a background call 40 times (0–19 ms apart) and checks the next call each time; starts a term-count sweep and loads a new 300 × 900 image straight after; types text and switches to Image at once; on the 2D tab, loads a blank image. Then opens a second tab and adds a note in each.",
  pass: "No second call rejected; the committed trace is the new image's (its working size is 3 times taller than wide); the source stays the image, not the text; the 2D page has no drawing after the blank image; both tabs' notes are kept after a reload; no page errors.",
  slow: true,
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx), checks = [];
    const rejected = await page.evaluate(async () => {
      let bad = 0;
      for (let i = 0; i < 40; i++) {
        const E = makeEngine("probe" + i);
        E.call("simplify", [[0, 1, 2], [0, 1, 0], 0.1, false]).catch(() => {});
        await new Promise((r) => setTimeout(r, i % 20)); E.cancel();
        await E.call("simplify", [[0, 1, 2], [0, 1, 0], 0.1, false]).catch(() => bad++);
      }
      return bad;
    });
    checks.push(check("cancel while loading: next calls rejected (of 40)", rejected, "==", 0));
    await page.evaluate(() => {
      const c = document.createElement("canvas"); c.width = 300; c.height = 900; const g = c.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, 300, 900); g.lineWidth = 8; g.beginPath(); g.arc(150, 300, 100, 0, 7); g.stroke(); g.strokeRect(60, 550, 180, 260);
      st.autoPending = true; chartSweep(); setSource(c, "tall");
    });
    await A.idle(page, 2500);
    checks.push(check("sweep then new image: committed trace is the new one (height ÷ width)", await page.evaluate(() => st.h / st.w), ">", 2.5));
    await A.source(page, "text"); await A.idle(page, 800);
    await page.evaluate(() => { const t = $("textIn"); t.value = "Hello there"; t.dispatchEvent(new Event("input", { bubbles: true })); artShowOnly("picture"); });
    await A.idle(page, 1500);
    checks.push(check("text then Image at once: the source stays the image", +(await page.evaluate(() => document.body.dataset.src === "image" && !st.text)), "==", 1));
    await A.plot(page); await A.idle(page, 2500);
    await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 400; c.height = 300; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 400, 300); setSource(c, "blank"); });
    await A.idle(page, 2500);
    checks.push(check("blank image on the 2D tab: no drawing left on the page", +(await page.evaluate(() => !st.plot && !st.final)), "==", 1));
    const p2 = await page.context().newPage(); await p2.goto(page.url()); await A.idle(p2, 1500);
    const add = async (pg, t) => { await pg.fill("#noteIn", t); await pg.press("#noteIn", "Enter"); await pg.waitForTimeout(200); };
    await add(page, "idea: from tab one"); await add(p2, "idea: from tab two");
    await page.reload(); await A.idle(page, 1500);
    const texts = await page.$$eval("#noteList li .txt", (L) => L.map((x) => x.textContent));
    checks.push(check("two tabs: both notes kept", +(texts.includes("from tab one") && texts.includes("from tab two")), "==", 1));
    checks.push(check("page errors", errors.length, "==", 0));
    await close(); return { checks, notes: errors.join(" | ") };
  },
};
