const A = require("../lib/app.js"), { check } = require("../lib/check.js"), fs = require("fs"), path = require("path");
module.exports = {
  id: "A64", title: "Each printer brings its own nozzles and G-code: adding one is an entry in settings.js",
  guards: "a second printer showing the first one's needles, a needle size kept that the new printer doesn't have, the menu's label stuck on Needle, a printer's own G-code lines not reaching the file, and the example printer in settings.js going stale",
  why: "Everything about a printer lives in its settings.js entry (plate, speeds, nozzles, G-code), so another printer is added by copying the example entry, with no code to change. Switching printer must switch the nozzle menu, and the line width with it.",
  how: "Serves settings.js with its commented \"my-printer\" example switched on, unchanged. Opens the app on the leaf, goes to the 3D tab, picks My printer, then the choc mate 2 again, and builds the G-code file each time.",
  pass: "No settings notes and no page errors. With My printer: the menu has its 2 nozzles (+ Custom) and is labelled Nozzle; its default 0.6 mm nozzle is picked (it has no 18G) and the line width follows; the file has its start line and a Layer line per layer. Back on the choc mate 2: its own needles again, labelled Needle, its default 18G picked (0.84 mm), and no Layer lines in its file.",
  async run(ctx) {
    const checks = [], errors = [];
    let body = fs.readFileSync(path.resolve(__dirname, "../../../web-app/settings.js"), "utf8");
    const a = body.indexOf('    // {\n    //   id: "my-printer"'), b = body.indexOf("    // },", a) + "    // },".length;
    if (a < 0 || b < a) throw new Error("test setup: the my-printer example isn't in settings.js");
    body = body.slice(0, a) + body.slice(a, b).replace(/^    \/\/ ?/gm, "    ") + body.slice(b);
    const context = await ctx.browser.newContext({ viewport: { width: 1300, height: 1000 } }), page = await context.newPage(); A.mapNav(page);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/settings.js", (r) => r.fulfill({ contentType: "text/javascript", body }));
    await page.goto(A.withExample(ctx.url, "leaf")); await A.idle(page, 2500);
    checks.push(check("settings notes (the example entry is complete and valid)", (await page.textContent("#settingsNote")).trim(), "==", ""));
    await A.print(page); await A.idle(page);
    const look = () => page.evaluate(async () => ({ n: $("needle").options.length, ids: [...$("needle").options].map((o) => o.dataset.id || "custom").join(","),
      label: $("needle").closest("label").querySelector(":scope > span:first-child").textContent, w: +$("lineW").value, text: (await buildFile("gcode")).text }));
    checks.push(check("choc mate 2 first: 18G picked (0.84 mm)", (await look()).w, "==", 0.84));
    await page.selectOption("#printer", "my-printer"); await A.idle(page);
    const m = await look();
    checks.push(check(`My printer: its nozzles (+ Custom): ${m.ids}`, m.ids, "==", "n0.4,n0.6,custom"), check("My printer: the menu is labelled Nozzle", m.label, "==", "Nozzle (inside diameter)"),
      check("My printer: its default nozzle's width, 0.6 mm", m.w, "==", 0.6), check("My printer: its start line in the file", +/^G28 ; home$/m.test(m.text), "==", 1),
      check("My printer: a Layer line after each layer comment", +((m.text.match(/^M117 Layer \d+ of \d+$/gm) || []).length === (m.text.match(/^; layer \d+ of/gm) || []).length && /^M117 Layer 1 of/m.test(m.text)), "==", 1));
    await page.selectOption("#printer", "chocmate2"); await A.idle(page);
    const c = await look();
    checks.push(check("choc mate 2 again: its needles (+ Custom)", c.n, "==", 11), check("choc mate 2 again: labelled Needle", c.label, "==", "Needle (inside diameter)"),
      check("choc mate 2 again: its default 18G (0.84 mm)", c.w, "==", 0.84), check("choc mate 2 again: no Layer lines", +/^M117/m.test(c.text), "==", 0),
      check("page errors", errors.length, "==", 0));
    await context.close();
    return { checks };
  },
};
