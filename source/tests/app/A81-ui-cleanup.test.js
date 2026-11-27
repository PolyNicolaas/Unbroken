const A = require("../lib/app.js"),
  { check } = require("../lib/check.js"),
  path = require("path");
module.exports = {
  id: "A81",
  title: "UI cleanup (v182): one shape picker, lettering drawn, the verdict and From above on the preview, Layers for a vase, the tray and the folds",
  guards:
    "features/morph/morph.js, js/layers.js, js/map.js, js/controls.js, model.js: the vase's own shapes not in the morph's grid (or their radios left showing), the lettering buttons not drawing the letter, the verdict chip or the From above view missing or stale, a vase's Layers showing infill or a second height, the too-short warning without its fix, Trace shown for a 3D design, the Examples tray left over an open panel, Image prep not folded while it's off",
  why: "Nicolaas (27 November 2026), after trying v181: all twelve suggestions — Layers without what a vase doesn't use, a one-line warning with a fix, one height, no Trace for 3D, the verdict on the preview, lettering as pictures, one shape picker, a from-above view, the tray putting the panel away, the morph's design first, Image prep folded, the model filling an upright iPad's view.",
  how: "Opens the Wavy vase, makes a morph; on Bottom taps the grid's Star, reads the radios, the chip and From above; reads Top's lettering pictures; opens Layers; opens the Morph node; opens Examples over a panel and closes it; opens the leaf and reads Image prep.",
  pass: "The Star button lit and the vase's star in use, its radio put away; the chip says Prints and From above shows; each lettering button draws an A; Layers has no infill or height and a one-line warning with its Allow … s button, which sets the time; Trace isn't shown; the Morph node shows the 3D model card above Input, no drop zone; the tray puts the panel away and closing it brings it back; Image prep folded, its heading opening it. No page errors.",
  slow: true,
  async run(ctx) {
    const out = path.join(__dirname, "..", "results");
    const { page, errors, close } = await A.open(ctx, { example: "wavyvase", art: true, viewport: { width: 1280, height: 900 } });
    const checks = [],
      o = {};
    const waitCheck = async () => {
      for (let i = 0; i < 60; i++) {
        await A.idle(page, 700);
        const m = await page.evaluate(() => $("moMsg").textContent);
        if (m && !/Checking/.test(m)) return m;
      }
      return "";
    };
    const vis = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden"; }, sel);
    await A.idle(page, 1500);
    await page.evaluate(() => $("mfMorph").click());
    await waitCheck();
    // one shape picker
    await page.click('[data-node="mbottom"]');
    await A.idle(page, 400);
    await page.click('#moBotShapes button[data-builtin="star"]');
    await waitCheck();
    o.star = await page.evaluate(() => ({
      kind: st.model.vase.plan.kind,
      lit: !!document.querySelector('#moBotShapes button.on[data-builtin="star"]'),
      radio: $("vpStar").hidden && document.querySelector('label[for="vpStar"]').hidden,
    }));
    checks.push(check("the grid's Star: the vase's star at the bottom, its button lit, its radio put away", +(o.star.kind === "star" && o.star.lit && o.star.radio), "==", 1));
    o.chip = await page.evaluate(() => ({ t: $("moChip").textContent, shown: !$("moChip").hidden }));
    checks.push(check("the verdict on the preview: ✓ Prints", +(o.chip.shown && /Prints/.test(o.chip.t)), "==", 1));
    checks.push(check("From above shown", +(await vis("#moAbove")), "==", 1));
    checks.push(check("no Trace switch for a 3D design", +(await vis(".toolbar .trace-switch")), "==", 0));
    await page.screenshot({ path: path.join(out, "ui-cleanup-bottom.png") });
    // lettering drawn
    await page.click('[data-node="mtop"]');
    await A.idle(page, 400);
    o.pics = await page.evaluate(() => [...document.querySelectorAll("#moFonts label.mo-font path")].map((p) => (p.getAttribute("d") || "").length));
    checks.push(check("each lettering button draws the letter", +(o.pics.length === 3 && o.pics.every((n) => n > 40)), "==", 1));
    // Layers for a vase
    await page.click('[data-node="layers"]');
    await A.idle(page, 1500);
    o.layers = { infill: await vis("#fillDensity"), height: await vis("#printHeightMM"), warn: await page.textContent("#layerHint"), fix: await vis("#layerFixTime") };
    checks.push(
      check("a vase's Layers: no infill, no second height", +(!o.layers.infill && !o.layers.height), "==", 1),
      check("… the too-short warning is one line, with Allow … s per layer", +(/too short to take/.test(o.layers.warn) && o.layers.warn.length < 120 && o.layers.fix), "==", 1)
    );
    if (o.layers.fix) {
      o.sec = await page.evaluate(() => $("layerFixTime").dataset.sec);
      await page.click("#layerFixTime");
      await A.idle(page, 1500);
      o.after = { time: await page.inputValue("#layerTime"), fix: await vis("#layerFixTime") };
      checks.push(check("… which sets the seconds per layer, and the warning goes", +(o.after.time === o.sec && !o.after.fix), "==", 1));
      await page.evaluate(() => { $("layerTime").value = 20; $("layerTime").dispatchEvent(new Event("input", { bubbles: true })); $("layerTime").dispatchEvent(new Event("change", { bubbles: true })); });
    }
    // the Morph node: its design first, no drop zone
    await page.click('[data-node="art"]');
    await A.idle(page, 600);
    o.node = await page.evaluate(() => {
      const m = document.querySelector('.panel section[aria-labelledby="h-model"]').getBoundingClientRect().top,
        i = document.querySelector('.panel section[aria-labelledby="h-input"]').getBoundingClientRect().top;
      return { modelFirst: m < i, drop: $("dropZone").getClientRects().length };
    });
    checks.push(check("the Morph node: the 3D model card above Input, no drop zone", +(o.node.modelFirst && !o.node.drop), "==", 1));
    // the tray over a panel
    await page.click('[data-node="examples"]');
    await A.idle(page, 500);
    o.tray = { panel: await vis(".panel"), tray: await vis("#mapTray") };
    await page.click("#mapTray .map-tray-x");
    await A.idle(page, 400);
    o.tray.back = await vis(".panel");
    checks.push(check("Examples puts the open panel away; closing it brings it back", +(o.tray.tray && !o.tray.panel && o.tray.back), "==", 1));
    // Image prep folded on a picture
    await page.evaluate(() => useExample("leaf"));
    await A.idle(page, 3000);
    await page.evaluate(() => mapOpen("art"));
    await A.idle(page, 600);
    o.prep = { folded: !(await vis("#bright")), head: await vis("#h-prep") };
    await page.click("#h-prep");
    await A.idle(page, 300);
    o.prep.opened = await vis("#bright");
    checks.push(check("Image prep folded while it's off; its heading opens it", +(o.prep.folded && o.prep.head && o.prep.opened), "==", 1));
    const pageErrors = errors.filter((e) => !/favicon\.ico/.test(e));
    checks.push(check("no page errors", pageErrors.length, "==", 0));
    await close();
    return { checks, notes: [JSON.stringify(o).slice(0, 600), pageErrors.join(" / ").slice(0, 300)] };
  },
};
