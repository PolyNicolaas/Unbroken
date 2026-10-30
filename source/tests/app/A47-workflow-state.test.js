const A = require("../lib/app.js"), { check } = require("../lib/check.js"), fs = require("fs"), os = require("os"), path = require("path");
const traceOff = (page) => page.evaluate(() => { const t = $("traceOn"); t.checked = false; t.dispatchEvent(new Event("change", { bubbles: true })); });
const saveAs = async (page) => { const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 20000 }), page.click("#fileMenu summary").then(() => page.click("#saveDesign"))]); const f = path.join(os.tmpdir(), `unbroken-a47-${Date.now()}-${dl.suggestedFilename()}`); await dl.saveAs(f); return { f, name: dl.suggestedFilename() }; };
const ov = (a, b) => !!(a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom);
module.exports = {
  id: "A47", title: "Workflow and state: Trace off on a printer, the output switched by undo, the Next bar's messages, a model start, opened designs, the phone bar",
  guards: "a printer exporting the last trace's G-code with Trace off, an undo that switches printer/plotter leaving the other step's cards, a Next bar export that seems to do nothing, a page error when a model goes to the plotter, a model start that can't be saved or undone, a design opened as drawn saying Nothing yet, a pattern saved as nothing-yet, a broken design file half-applied, and the phone's preview bar and 3D layers controls running off or over each other",
  why: "Area D of the v123 bug hunt (scratchpad/hunt/d/REPORT.md, items 1–5 and 8–10).",
  how: "Lettering, printer, Trace off, text changed, Print: the ready list and the Next bar's Export G-code. Leaf for the plotter, Plot step, Undo. Vase, then A pen plotter. ?example=vase: history and Save design. Lettering as drawn saved and reopened in a fresh page. Labyrinth as drawn from the empty app: saved file name. Leaf for the plotter, Trace off, Export SVG. A design with an unknown art kind and one with outW null. A phone (390 × 844): the preview bar, the 3D layers view, the suggestion box.",
  pass: "No G-code with Trace off (a red Trace is off line, a toast says so); after Undo the Print step shows (view choc); no page errors; a model start has a history entry and saves; the reopened design's readout isn't Nothing yet; the pattern's file is labyrinth….json; the SVG message says to turn Trace on; a bad file leaves the art and size as they were; the phone's View button inside the screen, One copy / Whole plate clear of the Layer slider, Bigger clear of the What's shown row, the suggestion box's count clear of Close.",
  async run(ctx) {
    const checks = [], notes = [], allErrors = [];
    // 1 + 3: a printer with Trace off exports nothing, and the Next bar says why
    { const { page, errors, close } = await A.open(ctx, { example: "lettering", art: true, viewport: { width: 820, height: 1180 } });
      await traceOff(page); await A.idle(page, 1200);
      await page.fill("#textIn", "Hi"); await page.dispatchEvent("#textIn", "input"); await A.idle(page, 2000);
      await page.click("#goTrace"); await A.idle(page, 400); await page.click("#goOut"); await A.idle(page, 2000);
      const ready = await page.evaluate(() => [...document.querySelectorAll("#readyList li.bad")].map((l) => l.textContent).join(" | "));
      checks.push(check("printer, Trace off: a red Trace is off line in the ready list", +/Trace is off/.test(ready), "==", 1));
      let dl = false; page.once("download", () => (dl = true));
      await page.click("#nbGcode"); await page.waitForTimeout(400); await page.click("#nbGcode"); await page.waitForTimeout(800);
      const t = await page.evaluate(() => ({ toast: !$("toast").hidden && $("toast").textContent, msg: $("gcodeMsg").textContent }));
      checks.push(check("printer, Trace off: no G-code even on a second tap", +dl, "==", 0), check("the Next bar's tap shows the reason as a toast", +/Trace is off/.test(t.toast || ""), "==", 1));
      // 10: the output names the art (a pattern as drawn from the empty start, below), and a bad design file changes nothing
      const good = await saveAs(page), g = JSON.parse(fs.readFileSync(good.f, "utf8"));
      const bad = (k, fn) => { const x = structuredClone(g); fn(x); const p = path.join(os.tmpdir(), `unbroken-a47-${k}.unbroken.json`); fs.writeFileSync(p, JSON.stringify(x)); return p; };
      for (const [k, fn] of [["kind", (x) => (x.design.s.art.kind = "drawing")], ["outW", (x) => (x.design.s.outW = null)]]) {
        const before = await page.evaluate(() => JSON.stringify([st.art.kind, st.outW, $("srcText").checked]));
        await page.setInputFiles("#designFile", bad(k, fn)); await A.idle(page, 800);
        const after = await page.evaluate(() => ({ s: JSON.stringify([st.art.kind, st.outW, $("srcText").checked]), toast: $("toast").textContent }));
        checks.push(check(`a design file with a bad ${k}: refused, nothing changed`, +(after.s === before && /Couldn't open/.test(after.toast)), "==", 1));
      }
      allErrors.push(...errors); await close(); }
    // 2: an undo that switches the plotter back to the printer brings the Print step
    { const { page, errors, close } = await A.open(ctx, { example: "leaf", art: true });
      await page.click("label[for=artForPlot]"); await A.idle(page, 1500);
      await page.click("#goTrace"); await A.idle(page, 400); await page.click("#goOut"); await A.idle(page, 1500);
      await page.click("#undoBtn"); await A.idle(page, 2000);
      const s = await page.evaluate(() => ({ view: document.body.dataset.view, out: document.body.dataset.out, radio: document.querySelector("input[name=view]:checked").id }));
      checks.push(check("Undo back to a printer: the Print step shows (view)", s.out === "print" ? s.view : "out " + s.out, "==", "choc"));
      // 10: a picture with Trace off for the plotter: the SVG message says to turn Trace on
      await page.click("#redoBtn"); await A.idle(page, 1500); await traceOff(page); await A.idle(page, 1200);
      await page.click("#exportBtn"); await A.idle(page, 800);
      checks.push(check("plotter, a picture with Trace off: Export SVG says turn Trace on", +/turn Trace on/.test(await page.textContent("#exportMsg")), "==", 1));
      allErrors.push(...errors); await close(); }
    // 4 + 5: a model to the plotter; a model start can be saved and undone
    { const { page, errors, close } = await A.open(ctx, { example: "vase", art: true });
      const m = await page.evaluate(() => ({ src: !!st.source, kind: st.art.kind, hist: hist.length }));
      checks.push(check("?example=vase: a source and a first undo step", +(m.src && m.kind === "model" && m.hist >= 1), "==", 1));
      let ok = true; try { await saveAs(page); } catch { ok = false; }
      checks.push(check("?example=vase: Save design works", +ok, "==", 1));
      await page.click("label[for=artForPlot]"); await A.idle(page, 1500);
      checks.push(check("a model, then A pen plotter: page errors", errors.length, "==", 0));
      allErrors.push(...errors); await close(); }
    // 9: a design saved as drawn and reopened from the empty app
    { const { page, errors, close } = await A.open(ctx, { example: "lettering", art: true });
      await page.click("label[for=artForPlot]"); await A.idle(page, 1200);
      const { f } = await saveAs(page);
      await page.goto(ctx.url); await A.idle(page, 800);
      await page.setInputFiles("#designFile", f); await A.idle(page, 2500);
      const chip = await page.textContent("#chip");
      checks.push(check("reopened as drawn: the readout isn't Nothing yet", +!/Nothing yet/.test(chip), "==", 1));
      allErrors.push(...errors); await close(); }
    // 10: a pattern started as drawn from the empty app is saved under its name
    { const { page, errors, close } = await A.open(ctx, { clean: true, art: true });
      await page.click("label[for=artForPlot]"); await A.idle(page, 600);
      await page.click("[data-examples] [data-example=labyrinth]:visible"); await A.idle(page, 2000);
      const { name } = await saveAs(page); notes.push(name);
      checks.push(check("a pattern as drawn from the empty start: saved under its name", +/^labyrinth/.test(name), "==", 1));
      allErrors.push(...errors); await close(); }
    // 8: the phone
    { const { page, errors, close } = await A.open(ctx, { example: "lettering", viewport: { width: 390, height: 844 }, folded: true });
      const right = await page.evaluate(() => Math.round(document.querySelector("#viewMenu summary").getBoundingClientRect().right));
      checks.push(check("phone: the View button inside the screen (right edge, px)", right, "<=", 390));
      await page.click("label[for=viewChoc]"); await A.idle(page, 2000); await page.click("label[for=stLayers]"); await A.idle(page, 1500);
      const L = await page.evaluate(() => { const R = (q) => { const e = document.querySelector(q); return e && e.getClientRects().length ? e.getBoundingClientRect() : null; }; return { c: R(".copies-seg"), l: R(".layerbar"), b: R("#pvSize"), p: R(".pathbar") }; });
      checks.push(check("phone, 3D layers: One copy / Whole plate clear of the Layer slider", +ov(L.c, L.l), "==", 0), check("phone, 3D layers: Bigger clear of the What's shown row", +ov(L.b, L.p), "==", 0), check("phone: One copy / Whole plate on one line (px)", Math.round(L.c.height), "<", 40));
      await page.click("#fileMenu summary"); await page.click("#notesOpen"); await A.idle(page, 400);
      const n = await page.evaluate(() => [$("notesCount").getBoundingClientRect(), $("notesClose").getBoundingClientRect()].map((r) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom })));
      checks.push(check("phone: the suggestion box's count clear of Close", +ov(n[0], n[1]), "==", 0));
      allErrors.push(...errors); await close(); }
    // the review after the fixes: a v101 design (art as layers, no kind) still opens; a pen plotter's Both draws no line
    // along the picture's edge (only a printer's Fill does); a Vase start shows the model's readout
    { const { page, errors, close } = await A.open(ctx, { example: "leaf" }), fs = require("fs"), os = require("os"), path = require("path");
      const [df] = await Promise.all([page.waitForEvent("download"), page.click("#fileMenu summary").then(() => page.click("#saveDesign"))]);
      const f = JSON.parse(fs.readFileSync(await df.path(), "utf8"));
      f.design.s.art = { sel: 1, layers: [{ id: 1, kind: "picture", on: true, name: "leaf", picture: { sample: "user" } }] };
      delete f.artImage; f.artImages = { 1: "source" };
      const p = path.join(os.tmpdir(), "a47-v101.unbroken.json"); fs.writeFileSync(p, JSON.stringify(f));
      await page.evaluate(() => artUse("pattern")); await A.idle(page, 1500);
      await page.setInputFiles("#designFile", p); await A.idle(page, 1500);
      checks.push(check("a v101 design (art as layers) opens, as a picture", +(/Opened/.test(await page.textContent("#toast")) && (await page.evaluate(() => st.art.kind)) === "picture"), "==", 1));
      const flags = await page.evaluate(() => { $("levels").value = 2; $("levelModes").value = "bs"; const r = {}; r.print = levelBorderFlags().join(); $("artForPlot").checked = true; r.plot = levelBorderFlags().join(); $("artForPrint").checked = true; $("levels").value = 0; return r; });
      checks.push(check("edge lines for Both: a printer's only", +(flags.plot === "false,false" && flags.print.startsWith("true")), "==", 1));
      allErrors.push(...errors); await close(); }
    { const { page, errors, close } = await A.open(ctx, { example: "vase" });
      checks.push(check("a Vase start: the model's readout, not Nothing yet", +!/Nothing yet/.test(await page.textContent("#chip")), "==", 1));
      allErrors.push(...errors); await close(); }
    checks.push(check("page errors", allErrors.length, "==", 0));
    return { checks, notes: notes.join("; ") + (allErrors.length ? "  \n" + allErrors.join("  \n") : "") };
  },
};
