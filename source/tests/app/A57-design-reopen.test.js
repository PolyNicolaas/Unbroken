const A = require("../lib/app.js"), { check } = require("../lib/check.js"), fs = require("fs"), path = require("path"), os = require("os");
module.exports = {
  id: "A57", title: "Opening a design: settings it was saved without come back as they were then, and the Text card follows it",
  guards: "an older design opening changed (new options switched on, the last print's name kept), and a Text card left showing the design before",
  why: "A design file holds the settings the app had when it was saved. A setting added later (the lettering switches in v131, the print's name in v136) used to stay as it was on screen, so an older lettering design opened with its letters joined and dots dropped, and under the last print's name. Found in the bug hunt of 4 November 2026, with the font list and the printer-only switches not following a design opened, and Custom… staying in the needle menu.",
  how: "Saves a text design, removes the newer settings from the file as an older version would have saved it, types a name and turns the switches on, then opens the file; opens a pen-plotter design and a Cyrillic one; picks Custom… and opens a design.",
  pass: "The older design opens with the lettering switches off and no name; a pen-plotter design hides the printer switches; a Cyrillic design in Sans warns and sets the Latin-only fonts apart; after Custom…, an opened design's needle shows; no page errors.",
  slow: true,
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx), checks = [];
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "a57-"));
    const save = async (name) => { await page.click("#fileMenu summary, details:has(#saveDesign) > summary").catch(() => {}); const [d] = await Promise.all([page.waitForEvent("download"), page.evaluate(() => document.getElementById("saveDesign").click())]); const p = path.join(tmp, name); await d.saveAs(p); return p; };
    const open = async (p) => { await page.setInputFiles("#designFile", p); await A.idle(page); await A.idle(page); };
    await A.source(page, "text"); await page.fill("#textIn", "Choco love"); await page.dispatchEvent("#textIn", "input"); await A.idle(page);
    const f = await save("now.unbroken.json"), J = JSON.parse(fs.readFileSync(f, "utf8"));
    for (const k of ["designName", "txtJoin", "txtSnap", "txtNoDots", "txtMeasured"]) delete J.design.v[k];
    const old = path.join(tmp, "old.unbroken.json"); fs.writeFileSync(old, JSON.stringify(J));
    await page.fill("#designName", "Mom card"); await page.dispatchEvent("#designName", "input");
    await open(old);
    const sw = await page.evaluate(() => ["txtJoin", "txtSnap", "txtNoDots", "txtMeasured"].map((id) => document.getElementById(id).checked));
    checks.push(check("older design: lettering switches off", +sw.every((x) => !x), "==", 1), check("older design: no name", await page.inputValue("#designName"), "==", ""));
    // a pen plotter design hides the printer switches
    await page.click("label[for=artForPlot]"); await A.idle(page);
    const plot = await save("plot.unbroken.json");
    await page.click("label[for=artForPrint]"); await A.idle(page);
    await open(plot);
    checks.push(check("pen-plotter design: printer switches hidden", +(await page.isVisible("#txtPrintOpts")), "==", 0));
    // a Cyrillic design in Sans: the font list follows it
    await page.click("label[for=artForPrint]"); await A.idle(page);
    await page.fill("#textIn", "Привет"); await page.dispatchEvent("#textIn", "input"); await page.selectOption("#font", "sans"); await A.idle(page);
    const cyr = await save("cyr.unbroken.json");
    await page.fill("#textIn", "Hello"); await page.dispatchEvent("#textIn", "input"); await A.idle(page);
    await open(cyr);
    checks.push(check("Cyrillic design: the font hint warns", +/warn/.test(await page.getAttribute("#fontHint", "class")), "==", 1),
      check("Cyrillic design: Readability set apart", await page.$eval("#font option[value=readability]", (o) => +o.disabled), "==", 1));
    // Custom… then a design: its needle shows
    await A.print(page); await A.idle(page);
    await page.selectOption("#needle", "custom"); await A.idle(page);
    await open(cyr);
    checks.push(check("after Custom…, the design's needle shows", await page.inputValue("#needle"), "!=", "custom"), check("page errors", errors.length, "==", 0));
    await close(); return { checks, notes: errors.join(" | ") };
  },
};
