const A = require("../lib/app.js"), { check } = require("../lib/check.js"), fs = require("fs"), os = require("os"), path = require("path"), { readGcode } = require("../lib/gcode.js");
module.exports = {
  id: "A59", title: "Make a vase: the profile editor, texture and movement, the Print step's checks, the G-code, undo and design files",
  guards: "a profile point that can't be dragged or added, a change that doesn't reach the print, the STL's controls (turns, cuts, walls, support) showing for a vase, a shift past what a bead holds not flagged, G-code that isn't the vase's height, and a vase lost on undo or from a saved design",
  why: "Nicolaas (9 November 2026): a vase made from a profile curve he edits, with a surface texture and a movement pattern on the extrusion path, printed on the same Print step as a model. E57 checks the path; this checks the card, the checks on the Print step and the file.",
  how: "Last, on Layers picks the Spiral base with 3 layers, then opens the leaf. Before that: opens the Wavy vase example on the Art step. Drags the middle-right profile point outwards, taps beside the curve to add a point, undoes. Picks Zigzag, then Loops. On the Print step reads the ready list and exports the G-code; then shifts the movement half a wave a layer and reads the ready list again. Sets the Print step's Height to 30 mm. Saves the design, picks An STL file (the sample skull), opens the design again.",
  pass: "Spiral base: offered for a vase, 3 layers become 4, each an open line; not offered for a picture. The example is a vase (the Vase controls showing, the STL's turns and the Print step's cuts, walls and support hidden); dragging widens the vase and adds an undo step that takes it back; a tap adds a fifth point and Remove point takes it away; Loops says how far apart they are; the Print step's ready list says every lap sits on the one below, and with half a wave's shift that the wall steps out; the G-code's last printing move is within a layer of the vase's height above the first layer, every layer a wall after the base; Height 30 mm makes the vase 30 mm tall (same width); the design opens as the same vase after the skull; no page errors.",
  slow: true,
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx, { example: "wavyvase", art: true }), checks = [];
    await A.idle(page, 1500);
    const shown = (sel) => page.$eval(sel, (e) => e.getBoundingClientRect().height > 0);
    checks.push(check("the example is a vase", +(await page.evaluate(() => !!(st.model && st.model.vase && $("mfVase").checked))), "==", 1));
    checks.push(check("Vase controls showing, the STL's turns hidden", +(await shown("#vaseProfile")) + +!(await shown("#turnX")), "==", 2));
    // drag the widest point (the bulb's, the third) outwards
    await page.evaluate(() => document.getElementById("vaseProfile").scrollIntoView({ block: "center" }));
    const P = await page.evaluate(() => {
      const cv = $("vaseProfile"), b = cv.getBoundingClientRect(), W = vaseView(cv), k = b.width / cv.width;
      return st.model.vase.profile.map(([t, r]) => [b.left + (W.x0 + r * W.s) * k, b.top + (W.y0 - t * W.H * W.s) * k, b.left + W.x0 * k]);
    });
    const width0 = await page.evaluate(() => st.model.om.size[0]);
    await page.mouse.move(P[1][0], P[1][1]); await page.mouse.down();
    for (let i = 1; i <= 8; i++) { await page.mouse.move(P[1][0] + i * 4, P[1][1]); await page.waitForTimeout(20); }
    await page.mouse.up(); await A.idle(page, 500);
    const width1 = await page.evaluate(() => st.model.om.size[0]);
    checks.push(check("dragging the bulb's point outwards widens the vase (mm)", +(width1 - width0).toFixed(2), ">", 2));
    await page.click("#undoBtn"); await A.idle(page, 600);
    checks.push(check("undo takes the drag back (width, mm)", +Math.abs((await page.evaluate(() => st.model.om.size[0])) - width0).toFixed(2), "<=", 0.05));
    // tap beside the curve, between the bottom and the bulb's point: a new point
    await page.mouse.click(P[0][2] + (P[0][0] - P[0][2]) * 0.6, (P[0][1] + P[1][1]) / 2); await A.idle(page, 500);
    checks.push(check("a tap adds a point", await page.evaluate(() => st.model.vase.profile.length), "==", 5));
    await page.click("#vasePtDel"); await A.idle(page, 500);
    checks.push(check("Remove point takes the picked one away", await page.evaluate(() => st.model.vase.profile.length), "==", 4));
    // movement
    await page.click("label[for=vmZigzag]"); await A.idle(page, 300);
    checks.push(check("Zigzag: the hint says how far apart", +/zigzags [\d.]+–[\d.]+ mm apart/.test(await page.textContent("#vaseHint")), "==", 1));
    await page.click("label[for=vmLoops]"); await A.idle(page, 300);
    const lh = await page.textContent("#vaseHint");
    checks.push(check("Loops: the hint says how far apart, and whether they loop", +(/loops [\d.]+–[\d.]+ mm apart/.test(lh) && /loop/.test(lh.split("apart")[1])), "==", 1), check("… the model's movement is loops", await page.evaluate(() => st.model.vase.move.kind), "==", "loops"));
    // the Print step
    await A.print(page); await A.idle(page, 4000);
    checks.push(check("Print: cuts, walls and support hidden for a vase", +!(await shown("#cutBottom")) + +!(await shown("#wallCount")) + +!(await shown("#support")), "==", 3));
    const ready = () => page.evaluate(() => [...document.querySelectorAll("#readyList li, .ready li")].map((e) => e.textContent).join(" | "));
    const r1 = await ready();
    checks.push(check("ready list: every lap sits on the one below", +/Every lap sits on the one below/.test(r1), "==", 1));
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#gcodeBtn")]);
    const zip = fs.readFileSync(await dl.path()).toString("latin1"), text = zip.slice(zip.indexOf("; Unbroken"), zip.lastIndexOf("; end") + 5);
    const G = readGcode(text), C = G.copies[0], printing = G.moves.slice(C.from, C.to).filter((m) => m.de > 0 && !m.wiping);
    const S = await page.evaluate(() => ({ H: st.model.vase.height, z0: +$("gZ").value || layerHmm(), h: layerHmm(), N: st.layers.S.N }));
    const top = Math.max(...printing.map((m) => m.z)), first = Math.min(...printing.map((m) => m.z));
    checks.push(check("G-code: top printing move above the first layer (mm), the vase's height within a layer", +Math.abs(top - first - (S.H - S.z0)).toFixed(2), "<=", S.h + 0.01));
    checks.push(check("G-code: layers after the base are walls", +C.layers.slice(S.N).every((l) => l.kind === "wall"), "==", 1));
    // shifted half a wave a layer: the check says the wall steps out
    await page.click("label[for=viewArt]"); await A.idle(page, 300);
    await page.click("label[for=vmWave]"); await A.setValue(page, "#vmShift", "50", "input"); await A.setValue(page, "#vmShift", "50", "change"); await A.idle(page, 400);
    checks.push(check("half a wave's shift: the hint warns", +(await page.$eval("#vaseHint", (e) => e.classList.contains("warn"))), "==", 1));
    await A.print(page); await A.idle(page, 4000);
    checks.push(check("… and the ready list says the wall steps out", +/The wall steps out [\d.]+ mm/.test(await ready()), "==", 1));
    // Height on the Print step: taller, same width
    const w2 = await page.evaluate(() => st.model.om.size[0]);
    await A.setValue(page, "#printHeightMM", "30", "change"); await A.idle(page, 1500);
    const after = await page.evaluate(() => ({ H: st.model.vase.height, h: st.model.om.size[2], w: st.model.om.size[0], box: $("vaseH").value }));
    checks.push(check("Height 30 mm: the vase is 30 mm tall", +(after.H === 30 && Math.abs(after.h - 30) < 0.01 && after.box === "30"), "==", 1), check("… as wide as before (mm)", +Math.abs(after.w - w2).toFixed(2), "<=", 0.3));
    // a design file brings the vase back after an STL
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "a59-")), V = await page.evaluate(() => JSON.stringify(st.model.vase));
    await page.click("#fileMenu summary").catch(() => {});
    const [d] = await Promise.all([page.waitForEvent("download"), page.evaluate(() => document.getElementById("saveDesign").click())]);
    const file = path.join(tmp, "vase.unbroken.json"); await d.saveAs(file); await page.keyboard.press("Escape");
    await page.click("label[for=viewArt]"); await A.idle(page, 300);
    await page.click("label[for=mfStl]"); await A.idle(page, 800);
    checks.push(check("An STL file: the sample skull back, the vase controls hidden", +(await page.evaluate(() => st.model.name === "sample skull cup")) + +!(await shown("#vaseProfile")), "==", 2));
    await page.setInputFiles("#designFile", file); await A.idle(page); await A.idle(page);
    checks.push(check("the design opens as the same vase", +(await page.evaluate((v) => !!st.model.vase && JSON.stringify(st.model.vase) === v, V)), "==", 1));
    checks.push(check("page errors", errors.length, "==", 0));
    // a spiral base (10 November 2026): the Base settings' Spiral is there for a vase, takes an even number of layers,
    // and its layers are open lines (rim to middle, and back)
    await page.evaluate(() => mapOpen("layers")); await A.idle(page, 3000);
    const offered = await page.$eval('#basePattern option[value="spiral"]', (o) => +(!o.hidden && !o.disabled));
    await page.selectOption("#basePattern", "spiral"); await A.setValue(page, "#baseLayers", 3, "change"); await page.dispatchEvent("#baseLayers", "input");
    await page.waitForTimeout(1500); await A.idle(page, 20000); await page.waitForTimeout(1500);
    const sp = await page.evaluate(() => ({ n: +$("baseLayers").value, N: st.layers && st.layers.S.N, open: st.layers ? st.layers.base.filter((b) => b.open).length : -1 }));
    checks.push(check("spiral base: offered for a vase", offered, "==", 1), check("… 3 layers asked becomes 4", sp.n, "==", 4), check("… 4 base layers made, each an open line", +(sp.N === 4) + +(sp.open === 4), "==", 2));
    await A.example(page, "skull"); await A.idle(page, 12000);
    await page.evaluate(() => mapOpen("layers")); await A.idle(page, 20000); await page.waitForTimeout(1500);
    const sk = await page.evaluate(() => ({ off: +!$("basePattern").querySelector('[value="spiral"]').disabled, pat: $("basePattern").value, n: +$("baseLayers").value, N: st.layers && st.layers.S.N, open: st.layers ? st.layers.base.filter((b) => b.open).length : -1 }));
    checks.push(check("… offered for a sliced model too (the skull cup): still Spiral", +sk.off + +(sk.pat === "spiral"), "==", 2), check("… its base layers spiral (open lines of an even number)", +(sk.N > 0 && sk.N % 2 === 0 && sk.open === sk.N), "==", 1));
    await A.example(page, "leaf"); await A.idle(page, 6000);
    checks.push(check("… not offered for a picture, and the pattern back to rings", await page.evaluate(() => { const o = $("basePattern").querySelector('[value="spiral"]'); return +(o.hidden && o.disabled) + +($("basePattern").value !== "spiral"); }), "==", 2));
    await close();
    return { checks, notes: `ready: ${r1}  \nwidened ${(width1 - width0).toFixed(1)} mm; G-code ${printing.length} printing moves, top ${top.toFixed(2)} mm` + (errors.length ? "  \n" + errors.join("  \n") : "") };
  },
};
