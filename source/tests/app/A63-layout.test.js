const A = require("../lib/app.js"), { check } = require("../lib/check.js"), { LAYOUT_AUDIT } = require("../lib/layout.js");
// (a phone isn't how the app is used: the tool palette, v148, is made for an iPad or a computer)
const SIZES = [[820, 1180, "iPad portrait"], [1180, 820, "iPad landscape"], [1440, 900, "a laptop"]];
const EXAMPLES = ["leaf", "wavyvase", "theobromine", "spirograph", "lettering"];
module.exports = {
  id: "A63",
  title: "Layout: no overlapping or cut-off words at iPad and laptop sizes, on every tool of the palette",
  guards: "map.js's layout (the band, the chips, a phone's row of the open step's chips), the cards' rows and readouts (app.css), any card that grows wider than the panel",
  why: "Added 10 November 2026 after a sweep found the map unreadable on a phone (five steps in 390 px, captions cut off, chips overlapping), the vase's five chips crowding each other, the vase card widening the page on an iPad, and rows of a few cards (Photo, the molecule, a pattern's own settings) off the card's edge.",
  how: "Opens the leaf, the Wavy vase, Theobromine, the Spirograph and the lettering at 820 × 1180, 1180 × 820 and 1440 × 900, then the leaf made for a pen plotter at 1180 × 820; opens every step and chip on the map in turn and checks the page each time (lib/layout.js): text over text, text over a control it isn't part of, text cut off by its box, the page scrolling sideways, text off the screen.",
  pass: "No findings anywhere, and no page errors.",
  slow: true,
  async run(ctx) {
    const found = [], errs = [];
    let looked = 0;
    const sweep = async (ex, w, h, plotter) => {
      const { page, errors, close } = await A.open(ctx, { example: ex, viewport: { width: w, height: h } });
      await A.idle(page, 10000);
      if (plotter) {
        await page.click('.map-for[data-for="plot"]').catch(() => page.evaluate(() => { $("artForPlot").checked = true; $("artForPlot").dispatchEvent(new Event("change", { bubbles: true })); }));
        await A.idle(page, 8000);
      }
      const nodes = await page.evaluate(() => [...new Set(Object.keys(MAP_NODES))].filter((id) => !MAP_NODES[id].tray));
      for (const n of ["", ...nodes]) {
        if (n) {
          const here = await page.evaluate((id) => !!mapNodeOf && (document.querySelector(`[data-node="${id}"]`) || mapShape().spine.includes(id)), n);
          if (!here) continue;
          await page.evaluate((id) => mapOpen(id), n);
          await A.idle(page, 6000);
        }
        looked++;
        for (const f of await page.evaluate(LAYOUT_AUDIT)) found.push(`${w}×${h} ${ex}${plotter ? " (plotter)" : ""} ${n || "start"}: ${f}`);
      }
      errs.push(...errors);
      await close();
    };
    for (const [w, h] of SIZES) for (const ex of EXAMPLES) await sweep(ex, w, h, false);
    await sweep("leaf", 1180, 820, true);
    return { checks: [check("views checked", looked, ">=", 100), check("layout findings", found.length, "==", 0), check("page errors", errs.length, "==", 0)], notes: [...found.slice(0, 40), ...errs.slice(0, 3)].join(" | ") };
  },
};
