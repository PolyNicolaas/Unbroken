const A = require("../lib/app.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A65", title: "Draw your own from the empty start: the pad takes the strokes, and Trace drawing traces them",
  guards: "the empty start's message (Start with a picture …) staying over the drawing pad, hiding it and catching every stroke, so nothing could be drawn",
  why: "Draw your own is a way to start, so it's used from the empty app, on an iPad with a finger or a pencil. Earlier tests drew on the pad with a picture already loaded, where no message covers it.",
  how: "Opens the empty app at iPad size, taps Draw your own on the Picture panel, drags a stroke across the middle of the preview with real pointer input, then taps Trace drawing.",
  pass: "The empty-start message is hidden while drawing, the element under the preview's middle is the preview's canvas, the stroke is kept, and after Trace drawing the picture is the drawing and it traces. No page errors.",
  async run(ctx) {
    const checks = [], errors = [];
    const context = await ctx.browser.newContext({ viewport: { width: 1194, height: 834 }, hasTouch: true }), page = await context.newPage(); A.mapNav(page);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(ctx.url); await A.idle(page, 2000);
    checks.push(check("the app opens empty", await page.evaluate(() => document.body.dataset.empty), "==", "1"));
    await page.evaluate(() => $("picDraw").scrollIntoView()); await page.click("#picDraw"); await page.waitForTimeout(300);
    const bb = await page.locator("#view").boundingBox(), cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
    const s = await page.evaluate(([x, y]) => ({ tool: st.tool, cover: getComputedStyle($("emptyState")).display, hit: document.elementFromPoint(x, y)?.id || "" }), [cx, cy]);
    checks.push(check("the draw tool is on", s.tool, "==", "draw"), check("the empty-start message is hidden while drawing", s.cover, "==", "none"),
      check("the preview's canvas is under the middle", s.hit, "==", "view"));
    await page.mouse.move(cx - 120, cy); await page.mouse.down();
    for (let i = 0; i <= 24; i++) await page.mouse.move(cx - 120 + i * 10, cy + Math.sin(i / 3) * 60);
    await page.mouse.up(); await page.waitForTimeout(200);
    checks.push(check("the stroke is kept", await page.evaluate(() => st.strokes.length), "==", 1));
    await page.click("#drawDone"); await A.idle(page, 1500);
    const r = await page.evaluate(() => ({ empty: document.body.dataset.empty, label: st.srcLabel, traced: !!st.final }));
    checks.push(check("no longer empty", r.empty, "==", ""), check("the picture is the drawing", r.label, "==", "your drawing"),
      check("it traces", +r.traced, "==", 1), check("page errors", errors.length, "==", 0));
    await context.close();
    return { checks };
  },
};
