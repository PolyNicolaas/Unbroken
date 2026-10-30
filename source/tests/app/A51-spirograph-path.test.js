const A = require("../lib/app.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A51", title: "Spirograph: more wheels from the Pattern card, a centre path drawn on its pad, and the frame",
  guards: "the Wheels setting not reaching the drawing, the path pad not taking a drag, a path that isn't saved or undone, Clear not clearing, and the frame settings not showing",
  why: "v127: the Spirograph's centre can follow a path drawn by hand (Draw the path… opens a pad over the preview), with up to six wheels and an optional crop.",
  how: "Opens the Spirograph example (plotted as drawn), sets Wheels to 3, opens the pad, drags a wave across it, and uses it; reads the pattern; turns on Crop; undoes; then Clear.",
  pass: "The settings show in groups, Ring, Wheel 1 to 3, Figure and Frame, at 3 wheels; 3 wheels in the pattern; the pad opens over the preview and shows the drag's points; Use it puts the path in the pattern (over 20 points) and the line opens; the design keeps it; Frame Crop shows its width and height; Undo takes the crop back but keeps the path; Clear removes the path and closes the line again; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx, { example: "spirograph", art: true }), checks = [];
    const set = (id, v, ev = "input") => page.evaluate(([id, v, ev]) => { const e = $(id); e.value = v; e.dispatchEvent(new Event(ev, { bubbles: true })); }, [id, v, ev]);
    await page.evaluate(() => { const e = $("traceOn"); if (e.checked) { e.checked = false; e.dispatchEvent(new Event("change", { bubbles: true })); } }); await A.idle(page, 800); // (as drawn: the pad is what's tested, not a trace)
    await set("artP-wheels", 3); await A.idle(page, 1500);
    checks.push(check("Wheels: 3 in the pattern", await page.evaluate(() => st.art.pattern.wheels), "==", 3));
    checks.push(check("the settings in groups, a divider each (Wheel 4 to 6 hidden at 3 wheels)", await page.evaluate(() => [...document.querySelectorAll("#artParams .pgroup")].filter((g) => !g.hidden).map((g) => g.dataset.group).join(", ")), "==", "Ring, Wheel 1, Wheel 2, Wheel 3, Figure, Frame"));
    await page.evaluate(() => document.querySelector('[data-key="path"] [data-path="draw"]').click()); await page.waitForTimeout(400);
    const bx = await page.locator("#peView").boundingBox();
    await page.mouse.move(bx.x + 20, bx.y + bx.height * 0.6); await page.mouse.down();
    for (let i = 1; i <= 30; i++) await page.mouse.move(bx.x + 20 + (bx.width - 40) * i / 30, bx.y + bx.height * (0.6 - 0.15 * Math.sin(i / 5)));
    await page.mouse.up();
    checks.push(check("the pad open, the drag's points", +(!(await page.evaluate(() => $("pathEd").hidden)) && (await page.evaluate(() => pad.pts.length / 2)) >= 20), "==", 1));
    await page.click("#peDone"); await A.idle(page, 2000);
    const p = await page.evaluate(() => ({ n: (st.art.pattern.path || []).length / 2, closed: patternDrawn().r.closed[0], saved: (record(), (designState().s.art.pattern.path || []).length / 2) }));
    checks.push(check("Use it: the path in the pattern (points)", p.n, ">", 20), check("… the line opens", +!p.closed, "==", 1), check("… saved with the design", p.saved, "==", p.n));
    await set("artP-frame", "crop", "change"); await A.idle(page, 1500);
    checks.push(check("Crop: its width and height shown", +(await page.evaluate(() => !document.querySelector('[data-key="frameW"]').hidden && !document.querySelector('[data-key="frameH"]').hidden)), "==", 1));
    await page.evaluate(() => record()); await page.click("#undoBtn"); await A.idle(page, 1500);
    const u = await page.evaluate(() => ({ frame: st.art.pattern.frame, n: (st.art.pattern.path || []).length }));
    checks.push(check("Undo: the crop back, the path kept", +(u.frame === "fit" && u.n > 0), "==", 1));
    await page.evaluate(() => document.querySelector('[data-key="path"] [data-path="clear"]').click()); await A.idle(page, 1500);
    checks.push(check("Clear: no path, the line closed again", +(!st_path(await page.evaluate(() => st.art.pattern.path)) && (await page.evaluate(() => patternDrawn().r.closed[0]))), "==", 1));
    checks.push(check("page errors", errors.length, "==", 0));
    await close();
    return { checks, notes: errors.join("  \n") };
  },
};
function st_path(p) { return Array.isArray(p) && p.length >= 4; }
