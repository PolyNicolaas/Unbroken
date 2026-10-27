const A = require("../lib/app.js"), { check } = require("../lib/check.js");
async function optimize(page) {
  await page.click("#optBtn");
  for (let i = 0; i < 600; i++) { const m = await page.textContent("#optMsg"); if (m && !m.startsWith("Optimizing")) break; await page.waitForTimeout(250); }
  await A.idle(page, 800); return page.textContent("#optMsg");
}
module.exports = {
  id: "A08", title: "Optimize tracing improves or keeps the trace, and undoes cleanly",
  guards: "the optimizer making things worse, or leaving settings changed after Undo",
  why: "Optimize tracing tries tracing settings for you and shows a before/after. It must never hand back something worse, must say what it changed, and Undo must put every setting back.",
  how: "With the 18G needle on the leaf, runs Optimize tracing, reads its result, applies Undo and compares the settings with the starting ones; then runs it on the Lettering preset.",
  pass: "Each run finishes with either an improvement (\"Closer to the image … → …\" with a lower number) or \"already the best\"; the result has no crossings; Undo restores threshold, smoothing, specks and loose ends; no page errors.",
  slow: true,
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx), checks = [];
    await A.idle(page, 800);                                           // the app opens with the 18G needle's line width
    const settings = async () => Promise.all(["#sens", "#blur", "#minLen", "#loose"].map((s) => page.inputValue(s))).then((v) => v.join(","));
    const s0 = await settings();
    for (const [label, prep] of [["leaf, 18G needle", null], ["lettering", "lettering"]]) {
      if (prep) { await A.source(page, "text"); await A.idle(page, 1000); }
      const msg = await optimize(page), m = msg.match(/Closer to the image: ([\d.]+) → ([\d.]+) mm/);
      checks.push(check(`${label}: finished with a result`, +(!!m || /already the best/.test(msg)), "==", 1));
      if (m) checks.push(check(`${label}: got closer (px)`, +m[2], "<=", +m[1], 2));
      checks.push(check(`${label}: crossings after`, +((await page.textContent("#uncrossVal")).split("→").pop()), "==", 0));
      if (!prep && await page.isVisible("#optUndo")) { await page.click("#optUndo"); await A.idle(page, 1000); checks.push(check("Undo restores every setting", +((await settings()) === s0), "==", 1)); }
    }
    checks.push(check("page errors", errors.length, "==", 0));
    await close(); return { checks };
  },
};
