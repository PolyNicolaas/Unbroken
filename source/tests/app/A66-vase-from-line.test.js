const A = require("../lib/app.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A66", title: "Make a vase from this line: the traced line itself, pushed from the Line tool, becomes the vase",
  guards: "a vase made from a trace that doesn't say which line it used, a pattern's line turned into a coarse, notched outline, and a vase from a line that takes the example vase's bulb and waves",
  why: "Nicolaas (12 November 2026): making a vase from a pattern, it wasn't clear the trace was used (it was pulled from the vase's Shape tool), and a nice labyrinth became messy (its outside edge on a coarse grid, rounded, on a bulb with waves). The Line tool now pushes the traced line into a vase: the line exactly, at its own size, straight up, no texture or movement.",
  how: "Opens the labyrinth example (a printer), opens the Line tool, taps Make a vase from this line; reads the vase in use, the Shape tool's words and the model's size; goes to the Print step.",
  pass: "Rounded to 84% leaves the panel its width; the vase's shape is the drawing, exact (the line itself, over 2000 points), at the drawing's size (within 1 mm of the trace's width), a straight profile, no movement or texture; the Shape tool is open and says it's made from the traced line; the Print step has walls; no page errors.",
  slow: true,
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx, { example: "labyrinth" }), checks = [];
    await A.idle(page, 8000);
    const w0 = await page.evaluate(() => { const F = st.final, k = scale(); return (Math.max(...F.re) - Math.min(...F.re)) * k; });
    await A.card(page, "h-line"); await A.idle(page, 500);
    await page.click("#vaseFromLine"); await A.idle(page, 10000);
    const v = await page.evaluate(() => { const V = st.model && st.model.vase; return V && { kind: V.plan.kind, exact: !!V.plan.exact, n: V.plan.loop.length / 2, flat: new Set(V.profile.map((p) => p[1])).size, move: V.move.kind, tex: V.texture.kind, w: st.model.om.size[0], msg: $("vpDrawMsg").textContent, words: $("vaseShapeVal") ? $("vaseShapeVal").textContent : "", open: mapOpenId }; });
    checks.push(
      check("the vase's shape: the traced line, exactly (points)", v && v.kind === "drawing" && v.exact ? v.n : 0, ">", 2000),
      check("… at the drawing's size (width difference, mm)", v ? Math.abs(v.w - w0) : 99, "<=", 1),
      check("… straight up, no movement or texture", +(v && v.flat === 1 && v.move === "none" && v.tex === "none"), "==", 1),
      check("the Shape tool open, saying it's made from the traced line", +(v && v.open === "vshape" && /traced line/.test(v.msg)), "==", 1),
    );
    // Rounded: the header's longer value is cut off, not widening the panel (it shifted on every change; 12 Nov 2026)
    const wide = () => page.evaluate(() => { const p = $("vaseBox").closest(".panel"); return p.scrollWidth - p.clientWidth; });
    const w1 = await wide();
    await A.setValue(page, "#vpRound", 84, "input"); await page.dispatchEvent("#vpRound", "change"); await A.idle(page, 3000);
    checks.push(check("Rounded 84%: the panel overflows sideways (px, before + after)", Math.max(0, w1) + Math.max(0, await wide()), "==", 0));
    await A.print(page); await A.idle(page, 15000);
    const walls = await page.evaluate(() => st.layers && st.layers.stack ? st.layers.stack.x.length : 0);
    checks.push(check("the Print step has its path (points)", walls, ">", 1000), check("page errors", errors.length, "==", 0));
    await close();
    return { checks, notes: errors.join("  \n") };
  },
};
