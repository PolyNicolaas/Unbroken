const A = require("../lib/app.js"), { check } = require("../lib/check.js"), { vaseScene } = require("../lib/photos.js");
// a point on the picture (shares of its width and height) → the page's px, through the preview's frame
const pt = (page, u, v) => page.evaluate(([u, v]) => { const c = st.crop, src = st.source, vw = view(), r = vw.rect; return [r.left + (vw.ox + (u * src.width - c.sx) * c.kx * vw.k) / vw.dpr, r.top + (vw.oy + (v * src.height - c.sy) * c.ky * vw.k) / vw.dpr]; }, [u, v]);
const drag = async (page, a, b, n = 6) => { await page.mouse.move(...a); await page.mouse.down(); for (let i = 1; i <= n; i++) await page.mouse.move(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n); await page.mouse.up(); };
const done = (page) => page.waitForFunction(() => !CUT.busy && st.cutout && st.cutout.mask, null, { timeout: 15000 }).then(() => A.idle(page, 3000));
module.exports = {
  id: "A39", title: "Cut out the object: a box dragged round it on the preview, Keep and Remove strokes, and only the object traced",
  guards: "the box not cutting anything out, the floor or wall left in the picture that's traced, a Remove stroke or Undo that does nothing, the cut-out lost by a design file or kept for the next picture",
  why: "The floor an object stands on is hard to remove by colour (v114): Select the object (Image prep) lets you drag a box round it, and what's in the box that looks like what's around it is removed (UNB.cutout); Keep and Remove strokes fix the rest. Everything but the object is white before Grey levels and the trace.",
  how: "Opens the app empty and puts in a 960 × 720 photo of a vase on a wooden floor in front of a wall. Taps Select the object, drags a box round the vase, then paints a Remove stroke and undoes it; Done. Checks the picture that's traced. Saves the design, removes the cut-out, opens the design again. Last, picks the leaf example.",
  pass: "The box: the readout says how much of the box is kept (20–60%), Image prep says cut out, the traced picture is white on the floor and the wall beside the vase and not on the vase; a Remove stroke adds a stroke and works the mask out again, Undo takes it away; Done leaves the tool with the line traced; the design file brings the cut-out back (its box, and a mask worked out again); a new picture has no cut-out; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx, { clean: true, art: true }), checks = [];
    const V = vaseScene({ w: 960, h: 720 });
    await page.evaluate(({ b64, w, h }) => { const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").putImageData(new ImageData(Uint8ClampedArray.from(atob(b64), (ch) => ch.charCodeAt(0)), w, h), 0, 0); artUsePicture(c, "vase"); }, { b64: Buffer.from(V.rgba.buffer).toString("base64"), w: V.w, h: V.h });
    await A.idle(page, 3000);
    await page.evaluate(() => $("card-h-prep").classList.remove("collapsed"));
    await page.click("#cutBtn"); await page.waitForTimeout(200);
    await drag(page, await pt(page, 0.28, 0.16), await pt(page, 0.72, 0.88)); await done(page);
    // the working (traced) picture: white on the floor and the wall beside the vase, not on the vase
    const px = await page.evaluate(() => { const W = st.wk, g = W.small.getContext("2d"), at = (u, v) => { const [x, y] = toWork([u, v], W.crop); return g.getImageData(Math.round(x), Math.round(y), 1, 1).data[1]; }; return { floor: at(0.32, 0.85), wall: at(0.33, 0.3), vase: at(0.5, 0.55) }; });
    const s = await page.evaluate(() => ({ share: st.cutout.share, val: $("cutVal").textContent, prep: $("prepVal").textContent }));
    checks.push(check("box: the share of it kept", s.share, ">=", 0.2), check("… (at most)", s.share, "<=", 0.6), check("… readout and Image prep say so", +(/% of the box kept/.test(s.val) && /cut out/.test(s.prep)), "==", 1));
    checks.push(check("traced picture: floor and wall beside the vase white (lowest green, 0–255)", Math.min(px.floor, px.wall), ">=", 245), check("… the vase not white", px.vase, "<", 200));
    const ver = await page.evaluate(() => st.cutout.ver);
    await page.click("label[for=cutMdrop]");
    await drag(page, await pt(page, 0.6, 0.83), await pt(page, 0.7, 0.83)); await page.waitForFunction((v) => st.cutout.ver > v && !CUT.busy, ver, { timeout: 15000 });
    const after = await page.evaluate(() => st.cutout.strokes.length);
    await page.click("#cutUndo"); await page.waitForFunction((v) => st.cutout.ver > v + 1 && !CUT.busy, ver, { timeout: 15000 }).catch(() => {});
    const undone = await page.evaluate(() => st.cutout.strokes.length);
    checks.push(check("Remove stroke: a stroke, the mask worked out again; Undo takes it away", +(after === 1 && undone === 0), "==", 1));
    await page.click("#cutDone"); await A.idle(page, 4000);
    checks.push(check("Done: the tool closed, the line traced", +((await page.evaluate(() => st.tool)) === null && /terms/.test(await page.textContent("#chip"))), "==", 1));
    // a design file
    const [df] = await Promise.all([page.waitForEvent("download"), page.click("#fileMenu summary").then(() => page.click("#saveDesign"))]);
    const file = await df.path(), box0 = await page.evaluate(() => st.cutout.box);
    await page.click("#cutClear"); await A.idle(page, 2000);
    const cleared = await page.evaluate(() => !st.cutout);
    await page.setInputFiles("#designFile", file); await page.waitForFunction(() => st.cutout && st.cutout.mask && !CUT.busy, null, { timeout: 20000 }).catch(() => {});
    const back = await page.evaluate(() => st.cutout && { box: st.cutout.box, mask: !!st.cutout.mask, share: st.cutout.share });
    checks.push(check("Remove the cut-out, then the design file: the cut-out back with its mask", +(cleared && back && back.mask && JSON.stringify(back.box) === JSON.stringify(box0) && Math.abs(back.share - s.share) < 0.05), "==", 1));
    await page.click("#examplesRow [data-example=leaf]"); await A.idle(page, 2000);
    checks.push(check("a new picture: no cut-out", +(await page.evaluate(() => !cutoutOn() && $("cutVal").textContent === "off")), "==", 1));
    checks.push(check("page errors", errors.length, "==", 0));
    await close();
    return { checks, notes: `kept ${(s.share * 100).toFixed(0)}% of the box; traced picture green: floor ${px.floor}, wall ${px.wall}, vase ${px.vase}` + (errors.length ? "  \n" + errors.join("  \n") : "") };
  },
};
