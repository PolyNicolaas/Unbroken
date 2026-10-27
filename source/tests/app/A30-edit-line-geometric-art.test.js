const A = require("../lib/app.js"), { check } = require("../lib/check.js");
const parts = async (page) => +((await page.textContent("#fitinfo")).match(/(\d+) part/) || [0, 0])[1];
const connectors = async (page) => +((await A.chip(page)).match(/(\d+) connectors?/) || [0, 0])[1];
// a fingerprint of the traced walk (st.walk), to tell whether an edit reached it
const walkPrint = (page) => page.evaluate(() => { let s = 0; for (let i = 0; i < st.walk.px.length; i++) s += st.walk.px[i] * 0.37 + st.walk.py[i]; return `${st.walk.px.length}:${s.toFixed(3)}`; });
// a point of the walk (a share of the way along it) in page coordinates
const walkAt = (page, f) => page.evaluate((f) => { const v = view(), i = Math.floor(f * st.walk.px.length), d = v.dpr; return [v.rect.left + (v.ox + st.walk.px[i] * v.k) / d, v.rect.top + (v.oy + st.walk.py[i] * v.k) / d]; }, f);
async function drag(page, a, b) { await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, { steps: 5 }); await page.mouse.move(...b, { steps: 5 }); await page.mouse.up(); await A.idle(page, 800); }
module.exports = {
  id: "A30", title: "Edit line and Geometric art in the app",
  guards: "a hand edit that doesn't reach the trace, can't be undone or is lost on a re-trace; and a geometric pattern that doesn't trace as the one line it promises, doesn't follow its controls or replaces a picture without asking",
  why: "Edit line (Tools, under the preview) pushes, smooths and straightens the traced line by hand; the edits are kept against the source image like erasing and applied every time it is traced. The Geometric art card draws a pattern and traces it, then follows its sliders while the pattern is the picture.",
  how: "On the leaf: Edit line, pushes a vein, then straightens and smooths a stretch; uses the bar's Undo, the main Undo and Restore all; changes the Smoothing slider with an edit in place. Then opens Geometric art: moves a slider with the leaf still the picture, makes a Labyrinth, a Waves and a Truchet pattern, changes Cells across, shuffles, undoes, and saves and reopens a pattern design.",
  pass: "Each edit changes the walk and counts on the button; the bar's Undo and Restore all bring the walk back exactly; an edit stays applied after a re-trace; the leaf stays the picture until Make and trace; Labyrinth and Waves trace as 1 part with no connectors (closed and open lines respectively) at a width no smaller than the smallest mark, Truchet with connectors; Cells across and Shuffle make a new picture; Undo brings the last pattern back; a saved pattern design reopens with the card following it; no page errors.",
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
    // geometric art
    await page.click("#card-h-art .card-toggle"); await page.waitForTimeout(100);
    await A.setValue(page, "#artDetail", 14); await A.idle(page, 600);
    checks.push(check("a slider alone doesn't replace the leaf", await page.textContent("#srcinfo"), "==", "sample"));
    await page.selectOption("#artStyle", "labyrinth"); await page.click("#artMake"); await A.idle(page, 1000);
    const lab = await page.evaluate(() => ({ w: st.outW, m: st.marks && st.marks.smallest, closed: $("loopClosed").checked, label: $("srcinfo").textContent, sample: $("sample").value, src: st.source.__id }));
    checks.push(check("Labyrinth: 1 part, no connectors", (await parts(page)) * 10 + (await connectors(page)), "==", 10));
    checks.push(check("Labyrinth: a closed loop, labelled, the sample menu says so", +(lab.closed && lab.label === "Labyrinth" && lab.sample === "pattern"), "==", 1));
    checks.push(check("Labyrinth: width ÷ the smallest that fits", lab.m ? lab.w / lab.m : NaN, ">=", 0.999));
    await A.setValue(page, "#artDetail", 10); await A.idle(page, 1200);
    checks.push(check("Cells across makes a new picture", +((await page.evaluate(() => st.source.__id)) !== lab.src && (await page.textContent("#artDetailVal")) === "10 cells"), "==", 1));
    const before = await page.evaluate(() => st.source.__id);
    await page.click("#artShuffle"); await A.idle(page, 1000);
    checks.push(check("Shuffle makes a new picture", +((await page.evaluate(() => st.source.__id)) !== before), "==", 1));
    await page.click("#undoBtn"); await A.idle(page, 1000);
    checks.push(check("Undo brings the last pattern back", +((await page.evaluate(() => st.source.__id)) === before), "==", 1));
    await page.selectOption("#artStyle", "waves"); await A.idle(page, 1200);
    checks.push(check("Waves (changed in place): 1 part, an open line", (await parts(page)) * 10 + +(await page.evaluate(() => $("loopOpen").checked)), "==", 11));
    await page.selectOption("#artStyle", "truchet"); await A.idle(page, 1500);
    checks.push(check("Truchet: many pieces, joined by connectors", await connectors(page), ">", 0));
    // save the design and open it again: the card goes on following the pattern
    await page.selectOption("#artStyle", "spiral"); await A.idle(page, 1200);
    const [dl] = await Promise.all([page.waitForEvent("download"), page.evaluate(() => saveDesign())]);
    const file = await dl.path(), fs = require("fs"), saved = JSON.parse(fs.readFileSync(file, "utf8"));
    checks.push(check("the design file keeps what the pattern was made from", +(saved.pattern && saved.pattern.style === "spiral"), "==", 1));
    await page.click("#sample"); await page.selectOption("#sample", "leaf"); await A.idle(page, 1000);
    await page.setInputFiles("#designFile", file); await A.idle(page, 1200);
    const back = await page.evaluate(() => ({ src: $("srcinfo").textContent, style: $("artStyle").value, on: !!st.source.__pattern }));
    checks.push(check("reopened: the pattern, its style, and the card follows it", +(back.src.startsWith("Double spiral") && back.style === "spiral" && back.on), "==", 1));
    checks.push(check("page errors", errors.length, "==", 0));
    await close();
    return { checks, notes: errors.length ? errors.join("  \n") : `labyrinth at ${lab.w.toFixed(1)} mm (smallest ${lab.m && lab.m.toFixed(1)} mm)` };
  },
};
