const A = require("../lib/app.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A73", title: "All settings (View menu): the settings for another kind of art stay in the panel, greyed, saying when they apply",
  guards: "a setting still hidden with All settings on, a greyed setting that can still be changed or says nothing, the note left behind when it's off or the setting applies again, the switch not remembered, and the hiding leaking outside the settings panel",
  why: "Nicolaas (25 November 2026): Support and Overhang couldn't be found for a relief; he doesn't like settings that aren't always there.",
  how: "Opens mark-and-word.svg at 80 mm wide and makes a relief (a vase). Opens Layers: Support with All settings off, then on (the View menu's box). Opens Material (Overhang per layer). Switches to Text and opens Layers again. Turns All settings off. Reloads with it on.",
  pass: "Off: Support hidden. On: Support shown, greyed (inert), its note says it's only for STL models; the Walls and support group shows. Overhang per layer shows either way, not greyed. Text, on: Support says it's only for 3D models. Off again: Support hidden, no notes left. Reloaded: the box still ticked and Support shown. The preview's edit tools stay hidden for a relief with it on. No page errors.",
  async run(ctx) {
    const src = ctx.server.url + "/source/tests/lib/fixtures/mark-and-word.svg";
    const { page, errors, close } = await A.open(ctx, { clean: true, art: true });
    const probe = () => page.evaluate(() => {
      const f = $("support").closest("label"), g = f.closest(".map-group");
      return {
        shown: f.getClientRects().length > 0,
        inert: !!f.inert,
        why: (f.querySelector(".na-why") || {}).textContent || "",
        group: !!(g && !g.hidden),
        notes: document.querySelectorAll(".na-why").length,
        tools: document.querySelector(".toolbar.tools").getClientRects().length > 0,
      };
    });
    await page.evaluate(async (src) => {
      const U = window.unbroken, wait = (ms) => new Promise((r) => setTimeout(r, ms));
      await U.open(src);
      await U.set({ widthMM: 80 });
      $("reliefFromPic").click();
      await wait(800); await U.whenReady();
      mapOpen("layers"); await wait(300);
    }, src);
    const off = await probe();
    const tick = (on) => page.evaluate(async (on) => { const c = $("showAll"); c.checked = on; c.dispatchEvent(new Event("change")); await new Promise((r) => setTimeout(r, 300)); }, on);
    await tick(true);
    const on = await probe();
    const over = await page.evaluate(async () => { mapOpen("material"); await new Promise((r) => setTimeout(r, 300)); const f = $("gOver").closest("label"); return { shown: f.getClientRects().length > 0, inert: !!f.inert }; });
    await page.evaluate(async () => { $("srcText").click(); $("srcText").dispatchEvent(new Event("change", { bubbles: true })); await new Promise((r) => setTimeout(r, 600)); await window.unbroken.whenReady(); mapOpen("layers"); await new Promise((r) => setTimeout(r, 300)); });
    const text = await probe();
    await tick(false);
    const back = await probe();
    await tick(true);
    await page.reload(); await A.idle(page, 2500);
    const kept = await page.evaluate(async () => { mapOpen("layers"); await new Promise((r) => setTimeout(r, 300)); return { box: $("showAll").checked, shown: $("support").closest("label").getClientRects().length > 0 }; });
    await page.evaluate(() => { const c = $("showAll"); c.checked = false; c.dispatchEvent(new Event("change")); });
    const checks = [
      check("off: Support hidden for a relief", +off.shown, "==", 0),
      check("on: Support shown", +on.shown, "==", 1),
      check("on: greyed and can't be changed (inert)", +on.inert, "==", 1),
      check("on: says it's only for STL models", +/only for STL models/i.test(on.why), "==", 1),
      check("on: the Walls and support group shows", +on.group, "==", 1),
      check("on: the preview's edit tools still hidden for a relief", +on.tools, "==", 0),
      check("Overhang per layer shown, not greyed", +(over.shown && !over.inert), "==", 1),
      check("Text, on: Support says it's only for 3D models", +/only for 3D models/i.test(text.why), "==", 1),
      check("off again: Support hidden", +back.shown, "==", 0),
      check("off again: no notes left", back.notes, "==", 0),
      check("reloaded: the box still ticked", +kept.box, "==", 1),
      check("reloaded: Support shown", +kept.shown, "==", 1),
      check("page errors", errors.length, "==", 0),
    ];
    await close();
    return { checks };
  },
};
