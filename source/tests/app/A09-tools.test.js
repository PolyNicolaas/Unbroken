const A = require("../lib/app.js"), { check } = require("../lib/check.js");
const parts = async (page) => +((await page.textContent("#fitinfo")).match(/(\d+) part/) || [0, 0])[1];
module.exports = {
  id: "A09", title: "Select area and erase tools",
  guards: "hand edits not reaching the trace",
  why: "Selecting part of an image and erasing stray lines are the main hand edits. Line detection now runs in the background, so the selection and erase marks must be passed along correctly and undone cleanly.",
  how: "Drags a rectangle over the top right of the leaf and applies it, clears it, brushes an erase stroke across the middle, then uses the erase tool's Undo.",
  pass: "Selecting changes the traced parts and clearing restores the original; the erase stroke cuts the leaf into more parts and its Undo restores the original; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx), checks = [], p0 = await parts(page), c0 = await A.chip(page);
    const box = await (await page.$("#view")).boundingBox(), at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
    const drag = async (a, b) => { await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, { steps: 6 }); await page.mouse.move(...b, { steps: 6 }); await page.mouse.up(); };
    await page.click("#selectBtn"); await drag(at(0.45, 0.05), at(0.95, 0.6)); await page.click("#selDone"); await A.idle(page, 800);
    checks.push(check("selection changes the trace (parts)", await parts(page), "!=", p0));
    await page.click("#selectBtn"); await page.click("#selClear"); if (await page.isVisible("#selDone")) await page.click("#selDone"); await A.idle(page, 800);
    checks.push(check("clearing restores the trace", +((await A.chip(page)) === c0 && (await parts(page)) === p0), "==", 1));
    await page.click("#eraseBtn"); await page.click("label[for=erBrush]"); await drag(at(0.3, 0.5), at(0.7, 0.5)); await A.idle(page, 800);
    checks.push(check("erase stroke cuts the leaf (parts)", await parts(page), ">", p0));
    await page.click("#eraseUndo"); await A.idle(page, 800);
    checks.push(check("erase undo restores the trace", +((await parts(page)) === p0), "==", 1));
    await page.click("#eraseBtn"); checks.push(check("page errors", errors.length, "==", 0));
    await close(); return { checks };
  },
};
