const A = require("../lib/app.js"),
  { check } = require("../lib/check.js"),
  path = require("path");
module.exports = {
  id: "A83",
  title: "2D · 2.5D · 3D: the header says what it is, the rail follows, and going between them keeps the work",
  guards:
    "features/dims/dims.js and map.js: the three chips (in place of For), the dimension read from the design, each one's rail (2D: the plotter's, no Layers; 2.5D: Layers on the design rail; 3D: the model's tools), the 3D menu (from this line, a relief, new, an STL), back from 3D to the line's source, 2D and 2.5D each keeping its own size, Input without 3D model and no Make it 3D rows, and ?off=dims giving For back",
  why: "Nicolaas (27 November 2026): organise the app by 2D, 2.5D and 3D; reliefs are 3D, a one-layer print is 2.5D; build it.",
  how: "Opens the leaf (2.5D), goes to 2D, then 3D → A morph from this line, then 2.5D, then 3D → A relief, then 2D. Opens the skull (3D). Opens the leaf with ?off=dims.",
  pass: "Each step's dimension and rail are as listed; the morph from the 2D leaf is the print's size, not the page's; coming back from 3D gives the picture again; the skull opens in 3D; with dims off the For chips are back and no D chips. No page errors.",
  slow: true,
  async run(ctx) {
    const out = path.join(__dirname, "..", "results");
    const checks = [],
      o = {};
    {
      const { page, errors, close } = await A.open(ctx, { example: "leaf", viewport: { width: 1280, height: 860 } });
      const dim = () => page.evaluate(() => document.body.dataset.dim);
      const rail = () =>
        page.evaluate(() => [...document.querySelectorAll("#mapNodes [data-node]")].filter((e) => e.getClientRects().length).map((e) => e.dataset.node));
      await A.idle(page, 2500);
      o.open = { dim: await dim(), rail: await rail(), forChips: await page.evaluate(() => [...document.querySelectorAll(".map-for")].filter((e) => e.getClientRects().length).length), model: await page.evaluate(() => $("srcModel").getClientRects().length + $("reliefRow").getClientRects().length + $("vaseFromLine").getClientRects().length) };
      o.w25 = await page.evaluate(() => +$("outW").value);
      checks.push(
        check("the leaf opens in 2.5D, Layers on its design rail, no For chips", +(o.open.dim === "2.5d" && o.open.rail.includes("layers") && o.open.forChips === 0), "==", 1),
        check("… Input without 3D model, no Make it 3D buttons", o.open.model, "==", 0)
      );
      await page.click('.dims-chip[data-dim="2d"]');
      await A.idle(page, 3000);
      o.d2 = { dim: await dim(), rail: await rail(), out: await page.evaluate(() => outputNow()) };
      checks.push(check("2D: the pen plotter, no Layers", +(o.d2.dim === "2d" && o.d2.out === "plot" && !o.d2.rail.includes("layers")), "==", 1));
      await page.click('.dims-chip[data-dim="3d"]');
      await A.idle(page, 400);
      o.menu = await page.evaluate(() => [...document.querySelectorAll(".dims-menu button b")].map((b) => b.textContent));
      await page.screenshot({ path: path.join(out, "dims-menu.png") });
      checks.push(
        check(
          "3D asks how: a vase or a morph from this line, a relief, new ones, an STL",
          +["A vase from this line", "A morph from this line", "A relief from this picture", "A new vase", "A new morph", "An STL file…"].every((t) => o.menu.includes(t)),
          "==",
          1
        )
      );
      await page.click(".dims-menu button:has-text('A morph from this line')");
      for (let i = 0; i < 40 && (await dim()) !== "3d"; i++) await A.idle(page, 500);
      await A.idle(page, 2000);
      o.d3 = { dim: await dim(), rail: await rail(), w: await page.evaluate(() => Math.max(...st.model.vase.profile.map((q) => q[1])) * 2) };
      checks.push(
        check("… a morph from the leaf: 3D, the morph's tools", +(o.d3.dim === "3d" && ["mbottom", "mtop", "mchange"].every((k) => o.d3.rail.includes(k))), "==", 1),
        check("… at the print's size, not the plotter page's (mm across, at most)", +o.d3.w.toFixed(0), "<", 100)
      );
      await page.click('.dims-chip[data-dim="2.5d"]');
      await A.idle(page, 3000);
      o.back = { dim: await dim(), kind: await page.evaluate(() => st.art.kind), out: await page.evaluate(() => outputNow()), w: await page.evaluate(() => +$("outW").value) };
      checks.push(check("2.5D from 3D: the picture again, for the printer", +(o.back.dim === "2.5d" && o.back.kind === "picture" && o.back.out === "print"), "==", 1));
      await page.click('.dims-chip[data-dim="3d"]');
      await A.idle(page, 400);
      await page.click(".dims-menu button:has-text('A relief from this')");
      await A.idle(page, 4000);
      o.relief = { dim: await dim(), rail: await rail() };
      checks.push(check("a relief is 3D, with the vase's tools", +(o.relief.dim === "3d" && o.relief.rail.includes("vtexture")), "==", 1));
      await page.click('.dims-chip[data-dim="3d"]');
      await A.idle(page, 300);
      // (in 3D the menu starts another full shape: nothing "from this line", there's no line)
      o.menu3 = await page.$$eval(".dims-menu button b", (bs) => bs.map((b) => b.textContent));
      checks.push(check("3D again while in 3D: the menu, without the line's items", +(o.menu3.includes("A new vase") && !o.menu3.some((t) => /this (line|picture)/.test(t))), "==", 1));
      await page.click('.dims-chip[data-dim="3d"]');
      await A.idle(page, 200);
      checks.push(check("… a second tap closes it", await page.evaluate(() => document.querySelectorAll(".dims-menu").length), "==", 0));
      o.wBefore = o.back.w;
      await page.click('.dims-chip[data-dim="2.5d"]');
      await A.idle(page, 3000);
      o.wAfter = await page.evaluate(() => +$("outW").value);
      checks.push(check("2.5D from a relief: the print's own width again (mm off)", +Math.abs(o.wAfter - o.wBefore).toFixed(2), "<", 0.1));
      await page.click('.dims-chip[data-dim="3d"]');
      await A.idle(page, 300);
      await page.click(".dims-menu button:has-text('A new vase')");
      await A.idle(page, 3000);
      await page.click('.dims-chip[data-dim="2d"]');
      await A.idle(page, 3000);
      o.d2b = { dim: await dim(), kind: await page.evaluate(() => st.art.kind) };
      checks.push(check("2D from 3D: the picture, plotted", +(o.d2b.dim === "2d" && o.d2b.kind === "picture"), "==", 1));
      await page.evaluate(() => useExample("skull"));
      await A.idle(page, 4000);
      o.skull = await dim();
      checks.push(check("the skull cup opens in 3D", +(o.skull === "3d"), "==", 1));
      const pageErrors = errors.filter((e) => !/favicon\.ico/.test(e));
      checks.push(check("no page errors", pageErrors.length, "==", 0));
      o.errors = pageErrors.join(" / ").slice(0, 300);
      await close();
    }
    {
      const { page, close } = await A.open(ctx, { url: ctx.url + "?off=dims&example=leaf", viewport: { width: 1280, height: 860 } });
      await A.idle(page, 2000);
      o.off = await page.evaluate(() => ({ chips: document.querySelectorAll(".dims-chip").length, fors: [...document.querySelectorAll(".map-for")].filter((e) => e.getClientRects().length).length }));
      checks.push(check("?off=dims: the For chips, no D chips", +(o.off.chips === 0 && o.off.fors === 2), "==", 1));
      await close();
    }
    return { checks, notes: [JSON.stringify(o).slice(0, 900)] };
  },
};
