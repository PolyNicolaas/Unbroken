const A = require("../lib/app.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A67", title: "Start over in the File menu: two taps clear the design and every setting",
  guards: "a full reset that's hard to find (it was only on the Examples tray), one that clears on a single slip of the finger, or one that keeps the design or a setting",
  why: "Nicolaas (12 November 2026) asked for a full reset or start-over button. The File menu has Start over: the first tap asks (and the menu stays open), the second opens the app as it first opens.",
  how: "Opens the labyrinth example, sets the base layers to 3, opens File, taps Start over once and reads the menu and the button, taps it again and reads the page after it reloads.",
  pass: "One tap: the menu stays open, the button says Tap again, nothing is cleared; two taps: the app is empty (no design in use), the base layers back to 0, no example in the address; no page errors.",
  slow: true,
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx, { example: "labyrinth" }), checks = [];
    await A.idle(page, 6000);
    await page.evaluate(() => { $("baseLayers").value = 3; $("baseLayers").dispatchEvent(new Event("input", { bubbles: true })); $("baseLayers").dispatchEvent(new Event("change", { bubbles: true })); });
    await A.idle(page, 2000);
    await page.click("#fileMenu summary"); await A.idle(page, 300);
    await page.click("#fileStartOver"); await A.idle(page, 300);
    const one = await page.evaluate(() => ({ open: $("fileMenu").open, txt: $("fileStartOver").textContent, empty: document.body.dataset.empty }));
    checks.push(check("one tap: the menu open, asking, nothing cleared", +one.open + +/Tap again/.test(one.txt) + +(one.empty !== "1"), "==", 3));
    await Promise.all([page.waitForNavigation(), page.click("#fileStartOver")]);
    await A.idle(page, 4000);
    const two = await page.evaluate(() => ({ empty: document.body.dataset.empty, base: +$("baseLayers").value, ex: new URLSearchParams(location.search).has("example") }));
    checks.push(check("two taps: empty, base layers 0, no example in the address", +(two.empty === "1") + +(two.base === 0) + +!two.ex, "==", 3), check("page errors", errors.length, "==", 0));
    await close();
    return { checks, notes: errors.join("  \n") };
  },
};
