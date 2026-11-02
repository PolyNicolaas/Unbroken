const A = require("../lib/app.js"), { check } = require("../lib/check.js");
const connectors = async (page) => +(((await page.textContent("#chip")).match(/(\d+) connectors?/) || [0, NaN])[1]);
const setToggles = (page, o) => page.evaluate((o) => {
  for (const [id, v] of Object.entries(o)) document.getElementById(id).checked = v;
  document.getElementById("txtJoin").dispatchEvent(new Event("change"));
}, o);
module.exports = {
  id: "A53", title: "Text card: lettering toggles for a printer (join letters, close near-misses, i and j dots, measured smallest height)",
  guards: "lettering toggles that don't reach the print, or change a pen plotter's letters",
  why: "Joined letters, closed near-misses and dotless i and j make chocolate lettering cleaner, and the measured smallest height keeps holes from filling in; but on a pen plotter the pen lifts between strokes, so its letters must stay as the font draws them. Each toggle has to change the traced line, and say what it did.",
  how: "Types \"Choco jelly\" in Sans for a printer: traces with every toggle off, then joining on, then leaving out i and j dots, reading the connectors and the hint; asks for 3 mm letters with the measured height on and off; switches to A pen plotter and checks the toggles are hidden and the text traces as with them off.",
  pass: "The toggles show for a printer; joining cuts the connectors by at least half and the hint counts the joins; leaving out dots drops connectors further with the j and says so; the measured smallest height names the letter that sets it and differs from the fixed rule; for a pen plotter the toggles are hidden and the connectors match all-off; no page errors.",
  slow: true,
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx), checks = [];
    await A.source(page, "text"); await A.idle(page, 800);
    await page.selectOption("#font", "sans");
    await page.fill("#textIn", "Choco jelly"); await page.dispatchEvent("#textIn", "input");
    await setToggles(page, { txtJoin: false, txtSnap: false, txtNoDots: false, txtMeasured: false });
    await A.setValue(page, "#capH", "20"); await A.idle(page, 2000);
    const off = await connectors(page);
    checks.push(check("toggles shown for a printer", +(await page.isVisible("#txtPrintOpts")), "==", 1));
    await setToggles(page, { txtJoin: true }); await A.idle(page, 2000);
    const joined = await connectors(page), hint = await page.textContent("#letteringHint");
    checks.push(check("joined: connectors (≤ half of all-off)", joined, "<=", off / 2), check("hint counts the joins", +/letter joins? along the baseline/.test(hint), "==", 1));
    await setToggles(page, { txtNoDots: true }); await A.idle(page, 2000);
    const noDots = await connectors(page);
    checks.push(check("no i and j dots: fewer connectors still", noDots, "<", joined), check("hint: dot left out", +/dot left out/.test(await page.textContent("#letteringHint")), "==", 1));
    // smallest height: measured, then the fixed rule
    await setToggles(page, { txtMeasured: true }); await A.setValue(page, "#capH", "3"); await A.idle(page, 1500);
    const measured = +(await page.inputValue("#capH")), mh = await page.textContent("#capHint");
    await setToggles(page, { txtMeasured: false }); await A.setValue(page, "#capH", "3"); await A.idle(page, 1500);
    const fixed = +(await page.inputValue("#capH"));
    checks.push(check("measured hint names the letter", +/below it the \S+ loses its shape/.test(mh), "==", 1), check("measured differs from the fixed rule (mm)", Math.abs(measured - fixed), ">", 0.05, 2));
    // a pen plotter: hidden, and the letters as the font draws them
    await setToggles(page, { txtJoin: true, txtSnap: true, txtNoDots: true, txtMeasured: true });
    await A.setValue(page, "#capH", "20");
    await page.click("label[for=artForPlot]"); await A.idle(page, 2500);
    checks.push(check("toggles hidden for a pen plotter", +(await page.isVisible("#txtPrintOpts")), "==", 0),
      check("pen plotter: no joins, no dots left out (hint empty)", (await page.textContent("#letteringHint")).length, "==", 0));
    await page.click("label[for=artForPrint]"); await A.idle(page, 2000);
    checks.push(check("back to a printer: shown again", +(await page.isVisible("#txtPrintOpts")), "==", 1), check("page errors", errors.length, "==", 0));
    await close(); return { checks };
  },
};
