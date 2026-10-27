const A = require("../lib/app.js"), { check } = require("../lib/check.js"), fs = require("fs");
module.exports = {
  id: "A05", title: "Plate, copies and G-code export, end to end",
  guards: "the plate view, copies or the exported G-code disagreeing with the design",
  why: "The 3D tab is where a design becomes a print: it must say truthfully whether the design fits, pack copies, and export G-code whose every move is on the plate. E08 and E09 test the maths; this tests what the user actually clicks and downloads.",
  how: "Sets Lettering at 40 mm (wider than the plate straight), reads the mini-map, opens the 3D tab, asks for 12 copies of the leaf, exports the G-code preview and reads the downloaded file.",
  pass: "The 356 mm lettering is reported as fitting rotated; the mini-map agrees; 12 copies are reported as fitting; the downloaded G-code has 12 lift-and-lower sequences and every X/Y on the 340 × 232 mm plate; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx), checks = [];
    await A.source(page, "text"); await A.idle(page, 800); await A.setValue(page, "#capH", "40"); await A.idle(page, 1200);
    const mini = await page.textContent("#miniInfo");
    checks.push(check("40 mm lettering: mini-map says it fits rotated", +/fits plate · rotated/.test(mini), "==", 1));
    await page.click("label[for=viewChoc]"); await A.idle(page, 300);
    checks.push(check("plate tab: fits rotated", +/Rotated .* to fit/.test(await page.textContent("#plateHint")), "==", 1));
    await page.click("label[for=viewDesign]"); await A.source(page, "picture"); await page.evaluate(() => applyPreset("drawing")); await A.idle(page, 800);
    await page.click("label[for=viewChoc]"); await A.setValue(page, "#outW", "60", "change"); await A.setValue(page, "#copies", "12"); await A.idle(page, 300);
    checks.push(check("12 copies reported as fitting", +/12 copies fit/.test(await page.textContent("#plateHint")), "==", 1));
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#gcodeBtn")]);
    const zip = fs.readFileSync(await dl.path()).toString("latin1"), text = zip.slice(zip.indexOf("; Unbroken"), zip.indexOf("; end") + 5);
    let off = 0; for (const m of text.matchAll(/X(-?[\d.]+) Y(-?[\d.]+)/g)) if (+m[1] < 0 || +m[1] > 340 || +m[2] < 0 || +m[2] > 232) off++;
    const z = +(await page.inputValue("#gZ")), lowers = text.split("\n").filter((l) => l.startsWith("G1 Z") && +l.slice(4).split(" ")[0] === z && / F600/.test(l)).length;
    checks.push(check(`G-code: copies (lower to Z ${z} and print)`, lowers, "==", 12), check("G-code: coordinates off the plate", off, "==", 0), check("page errors", errors.length, "==", 0));
    await close(); return { checks };
  },
};
