const A = require("../lib/app.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A02", title: "The page stays responsive while tracing",
  guards: "the page freezing while a trace is worked out",
  why: "Tracing a photo takes seconds. That work runs in background workers so sliders, buttons and scrolling keep working; if something heavy slips back onto the page, the app stutters and feels broken.",
  how: "Measures the longest gap between 10 ms timer ticks on the page while applying the Photo, Line drawing and Lettering presets and while dragging the threshold slider through 17 positions, each until the trace is finished.",
  pass: "Longest freeze ≤ 200 ms in every case, and the app is not stuck in \"working\" afterwards. (Measured 2026-10-15: 46–110 ms alone, up to about 160 ms when the machine is busy; the limit leaves room for that. Before background workers: 260–580 ms.)",
  slow: true,
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx, { freezeProbe: true }), checks = [];
    for (const p of ["photo", "drawing", "lettering"]) checks.push(check(`${p === "lettering" ? "Text switch" : p + " preset"}: longest freeze (ms)`, await A.longestFreeze(page, async () => { if (p === "lettering") await A.source(page, "text"); else await page.evaluate((k) => applyPreset(k), p); await A.idle(page, 500); }), "<=", 200));
    await A.source(page, "picture"); await page.evaluate(() => applyPreset("drawing")); await A.idle(page, 500);
    checks.push(check("threshold slider drag: longest freeze (ms)", await A.longestFreeze(page, async () => { for (let v = -40; v <= 40; v += 5) { await A.setValue(page, "#sens", v); await page.waitForTimeout(40); } await A.idle(page, 500); }), "<=", 200));
    checks.push(check("still working afterwards", +(await page.$eval("#chip", (e) => e.classList.contains("busy"))), "==", 0), check("page errors", errors.length, "==", 0));
    await close(); return { checks };
  },
};
