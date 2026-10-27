const A = require("../lib/app.js"), { check } = require("../lib/check.js");
// a fingerprint of the traced walk (st.walk), to tell whether an edit reached it
const walkPrint = (page) => page.evaluate(() => { let s = 0; for (let i = 0; i < st.walk.px.length; i++) s += st.walk.px[i] * 0.37 + st.walk.py[i]; return `${st.walk.px.length}:${s.toFixed(3)}`; });
// a point of the walk (a share of the way along it) in page coordinates
const walkAt = (page, f) => page.evaluate((f) => { const v = view(), i = Math.floor(f * st.walk.px.length), d = v.dpr; return [v.rect.left + (v.ox + st.walk.px[i] * v.k) / d, v.rect.top + (v.oy + st.walk.py[i] * v.k) / d]; }, f);
async function drag(page, a, b) { await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, { steps: 5 }); await page.mouse.move(...b, { steps: 5 }); await page.mouse.up(); await A.idle(page, 800); }
module.exports = {
  id: "A30", title: "Edit line: hand edits to the traced line in the app",
  guards: "a hand edit that doesn't reach the trace, can't be undone or is lost on a re-trace",
  why: "Edit line (Tools, under the preview) pushes, smooths and straightens the traced line by hand; the edits are kept against the source image like erasing and applied every time it is traced.",
  how: "On the leaf: Edit line, pushes a vein, then straightens and smooths a stretch; uses the bar's Undo and Restore all; changes the Smoothing slider with an edit in place.",
  pass: "Each edit changes the walk and counts on the button; the bar's Undo and Restore all bring the walk back exactly; an edit stays applied after a re-trace; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx), checks = [];
    const w0 = await walkPrint(page);
    await page.click("#editBtn");
    checks.push(check("Edit line opens its bar", +(await page.isVisible("#editbar")), "==", 1));
    const p = await walkAt(page, 0.3);
    await drag(page, p, [p[0] + 35, p[1] + 25]);
    const w1 = await walkPrint(page);
    checks.push(check("push changes the walk", +(w1 !== w0), "==", 1));
    checks.push(check("button counts the edit", await page.textContent("#editBtn"), "==", "Edit line (1)"));
    await page.click("label[for=edStraight]"); await drag(page, await walkAt(page, 0.55), await walkAt(page, 0.6));
    await page.click("label[for=edSmooth]"); await drag(page, await walkAt(page, 0.75), await walkAt(page, 0.8));
    checks.push(check("straighten and smooth count too", await page.textContent("#editBtn"), "==", "Edit line (3)"));
    await page.click("#editUndo"); await page.click("#editUndo"); await A.idle(page, 800);
    checks.push(check("the bar's Undo brings the walk back exactly", +((await walkPrint(page)) === w1), "==", 1));
    await page.click("#editDone");
    await A.setValue(page, "#blur", 14); await A.idle(page, 800);
    const editedAt14 = await walkPrint(page);
    await page.click("#editBtn"); await page.click("#editClear"); await A.idle(page, 800);
    checks.push(check("an edit stays applied after a re-trace (Smoothing moved)", +(editedAt14 !== (await walkPrint(page))), "==", 1));
    await page.click("#editDone"); await A.setValue(page, "#blur", 12); await A.idle(page, 800);
    checks.push(check("Restore all and the same settings bring back the leaf's walk", +((await walkPrint(page)) === w0), "==", 1));
    checks.push(check("page errors", errors.length, "==", 0));
    await close();
    return { checks, notes: errors.length ? errors.join("  \n") : "" };
  },
};
