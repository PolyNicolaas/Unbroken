const A = require("../lib/app.js"), { check } = require("../lib/check.js"), path = require("path");
module.exports = {
  id: "A76", title: "The rail keeps its shared tools in place; Design comes back where you were; small things from a third walkthrough",
  guards: "Size, Material or Print moving on the rail with the kind of art, Design opening Line instead of the tool you left, the files' name stuck on the art before, text checked tilted on the Print screen, and the empty start's faint corner label and live buttons",
  why: "Nicolaas (25 November 2026), after a walkthrough of v171 on an iPad-sized screen; he picked the shared tools pinned to the rail's foot.",
  how: "An iPad-sized window (screenshots of the three rails in results/rail-*.png). Empty: the corner label, Trace and Play drawing. The leaf, then Text, then a vase: where Size, Material and Print… sit on the rail. Text: Size open, Print…, Design. The skull cup: the name box's hint. Text on the Print screen: From above.",
  pass: "Empty: no corner label, Trace and Play drawing greyed. Size at the same height for the leaf and text; Material and Print… at the same height for all three (within 2 px), and Print… at the rail's foot. Design comes back to Size. The skull cup's hint names it. Text starts From above on the Print screen. No page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx, { clean: true, viewport: { width: 1180, height: 820 } });
    const wait = (ms) => page.waitForTimeout(ms);
    const o = {};
    o.empty = await page.evaluate(() => ({ chip: $("chip").getClientRects().length > 0, play: getComputedStyle($("play")).pointerEvents, trace: getComputedStyle(document.querySelector(".trace-switch")).pointerEvents }));
    const at = () => page.evaluate(() => {
      const y = (sel) => { const e = document.querySelector(sel); return e && e.getClientRects().length ? Math.round(e.getBoundingClientRect().top) : null; };
      const rail = document.querySelector(".map-nodes").getBoundingClientRect();
      return { size: y('.map-node[data-node="size"][data-rail="design"]'), material: y('.map-node[data-node="material"][data-rail="design"]'), go: y("#mapGo"), goBottom: Math.round($("mapGo").getBoundingClientRect().bottom), railBottom: Math.round(rail.bottom) };
    });
    await page.goto(page.url().split("?")[0] + "?example=leaf");
    await A.idle(page, 2500);
    o.leaf = await at();
    const shot = (n) => page.screenshot({ path: path.join(__dirname, "..", "results", `rail-${n}.png`) });
    await shot("1-picture");
    await page.evaluate(async () => { $("srcText").click(); $("srcText").dispatchEvent(new Event("change", { bubbles: true })); await new Promise((r) => setTimeout(r, 800)); await window.unbroken.whenReady(); });
    await wait(400);
    o.text = await at();
    await shot("2-text");
    // Text: Size open, then Print…, then Design
    o.back = await page.evaluate(async () => {
      const w = (ms) => new Promise((r) => setTimeout(r, ms));
      mapOpen("size"); await w(200);
      $("mapGo").click(); await w(800); await window.unbroken.whenReady();
      const above = $("pvAbove").checked;
      $("mapBack").click(); await w(300);
      return { open: mapOpenId, above };
    });
    // the skull cup, then a vase
    await page.evaluate(async () => { $("srcModel").click(); $("srcModel").dispatchEvent(new Event("change", { bubbles: true })); await new Promise((r) => setTimeout(r, 1200)); });
    o.modelName = await page.getAttribute("#designName", "placeholder");
    await page.evaluate(async () => { $("mfVase").click(); $("mfVase").dispatchEvent(new Event("change", { bubbles: true })); await new Promise((r) => setTimeout(r, 1500)); });
    o.vase = await at();
    await shot("3-vase");
    const checks = [
      check("empty: no corner label", +o.empty.chip, "==", 0),
      check("empty: Play drawing greyed", +(o.empty.play === "none"), "==", 1),
      check("empty: Trace greyed", +(o.empty.trace === "none"), "==", 1),
      check("Size at the same height, the leaf and text (px)", o.leaf.size != null && o.text.size != null ? Math.abs(o.leaf.size - o.text.size) : 99, "<=", 2),
      check("Material at the same height, the leaf, text and a vase (px)", Math.max(Math.abs(o.leaf.material - o.text.material), Math.abs(o.leaf.material - o.vase.material)), "<=", 2),
      check("Print… at the same height, the leaf, text and a vase (px)", Math.max(Math.abs(o.leaf.go - o.text.go), Math.abs(o.leaf.go - o.vase.go)), "<=", 2),
      check("Print… at the rail's foot (px from its bottom)", o.leaf.railBottom - o.leaf.goBottom, "<=", 12),
      check("Design comes back to Size", +(o.back.open === "size"), "==", 1),
      check("text on the Print screen: From above", +o.back.above, "==", 1),
      check("the skull cup: the name box's hint names it", +/skull/.test(o.modelName || ""), "==", 1),
      check("page errors", errors.length, "==", 0),
    ];
    await close();
    return { checks, notes: [JSON.stringify({ leaf: o.leaf, text: o.text, vase: o.vase, name: o.modelName })] };
  },
};
