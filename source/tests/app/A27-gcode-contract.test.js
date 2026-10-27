const A = require("../lib/app.js"), { check } = require("../lib/check.js"), { readGcode } = require("../lib/gcode.js"), { execSync } = require("child_process");
module.exports = {
  id: "A27", title: "The G-code the app downloads: start lines, flow, feeds, layers, one copy at a time, travel above finished copies",
  guards: "a print file that pushes the wrong amount of chocolate, prints too fast for a layer to set, travels through a finished copy, starts the next copy before the last is done, skips the purge line, or leaves a copy without its unretract and wipe",
  why: "The engine's G-code writer is tested on its own (E09, E28), but this is the file the printer actually gets: the 3D tab's settings, the layers, the copies and the printer profile together. Found missing in the October 2026 review (REVIEW.md).",
  how: "Opens the app, goes to the 3D tab, sets 2 copies, 2 base layers and a height of 1.5 mm, exports G-code through the button and reads the whole file back move by move (lib/gcode.js). Compares it with the app's own numbers: E per mm (#gE), speed (#gFeed), first-layer Z (#gZ), lift (#gLift), the seconds per layer, the plate and the layer count.",
  pass: "The file is named design_needle_copies (e.g. leaf_084_2x-gcode.zip). Printer start lines with the purge line come first, then mm / absolute XYZ / absolute E; two copies, each with its layers 1 … N in order (N = the app's laps), one unretract before its first layer and one wipe or retract at its end, no travel inside a copy; every full layer pushes E per mm within 1% of #gE (the first and last wall laps ease in and out, 40–60%); every printing feed between the printer's slowest and #gFeed, and each layer at least the seconds per layer unless already at the slowest; first layer at #gZ, top at the height; every travel at least #gLift above everything printed so far; all printing on the plate; the end lines after a final lift; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx), checks = [];
    await A.print(page); await A.idle(page);
    await A.setValue(page, "#copies", 2); await A.setValue(page, "#baseLayers", 2);
    await page.fill("#printHeightMM", "1.5"); await page.press("#printHeightMM", "Tab"); await A.idle(page);
    const app = await page.evaluate(() => ({ e: +$("gE").value, feed: +$("gFeed").value * 60, z: +$("gZ").value, lift: +$("gLift").value, need: +$("layerTime").value,
      slow: (CFG.printer.minPrintSpeed || 5) * 60, laps: st.layers.stack.laps.length, bed: [CFG.printer.bedWidth, CFG.printer.bedDepth], height: +$("printHeightMM").value }));
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#gcodeBtn")]);
    const text = execSync(`unzip -p "${await dl.path()}"`, { maxBuffer: 1 << 28 }).toString(), G = readGcode(text), M = G.moves;
    const lines = text.split(/\r?\n/), at = (re) => lines.findIndex((l) => re.test(l));
    // the file name: design, needle (3 digits) and copies, e.g. leaf_084_2x-gcode.zip, the same inside the zip
    const want = await page.evaluate(() => `${designSlug()}_${needleTag()}_2x`), inner = execSync(`unzip -Z1 "${await dl.path()}"`).toString().trim();
    checks.push(check(`file named design_needle_copies (${dl.suggestedFilename()})`, +(dl.suggestedFilename() === `${want}-gcode.zip` && inner === `${want}.gcode` && /^[a-z0-9-]+_\d{3}_2x$/.test(want)), "==", 1));
    // start: the printer's lines with the purge line, then mm / absolute XYZ / absolute E, all before the first copy
    const purge = M.filter((m) => m.section === "start" && m.de > 0 && m.xy > 0).length, firstCopy = at(/^; copy 1 of/);
    checks.push(check("printer start lines first, with a purge line (extruding moves)", +(at(/^; printer start/) >= 0 && at(/^; printer start/) < firstCopy) * purge, ">=", 1),
      check("mm, absolute XYZ and E set before the first copy", +[/^G21\b/, /^G90\b/, /^M82\b/].every((re) => { const i = lines.slice(at(/^; printer start/) + 1).findIndex((l) => re.test(l)); return i >= 0 && i + at(/^; printer start/) + 1 < firstCopy; }), "==", 1));
    // copies: in order, each whole, with its own unretract and wipe, no travel inside
    checks.push(check("copies in the file", G.copies.length, "==", 2));
    G.copies.forEach((c, k) => {
      const mv = M.slice(c.from, c.to), seq = c.layers.map((l) => l.n).join(","), want = Array.from({ length: app.laps }, (_, i) => i + 1).join(",");
      const startLines = lines.slice(at(new RegExp(`^; copy ${k + 1} of`)), lines.findIndex((l, i) => i > at(new RegExp(`^; copy ${k + 1} of`)) && /^; layer 1 of/.test(l)));
      const wipes = lines.slice(at(new RegExp(`^; copy ${k + 1} of`)), k + 1 < G.copies.length ? at(new RegExp(`^; copy ${k + 2} of`)) : at(/^; printer end/)).filter((l) => /^; wipe|; retract$/.test(l)).length;
      checks.push(check(`copy ${k + 1}: layers 1 … ${app.laps} in order`, +(seq === want), "==", 1),
        check(`copy ${k + 1}: one unretract before its first layer`, startLines.filter((l) => /; unretract$/.test(l)).length, "==", 1),
        check(`copy ${k + 1}: one wipe or retract at its end`, wipes, "==", 1),
        check(`copy ${k + 1}: no travel inside it (one continuous line)`, mv.filter((m, i) => i > 2 && m.g === "G0").length, "==", 0));
    });
    // flow: E per mm over each layer (whole layers, so 5-decimal rounding doesn't matter)
    const layerRuns = []; for (const c of G.copies) c.layers.forEach((l, k) => { const to = k + 1 < c.layers.length ? c.layers[k + 1].from : c.to, ms = M.slice(l.from, to).filter((m) => m.g === "G1" && !m.wiping && m.de > 0);
      layerRuns.push({ l, k, n: c.layers.length, eased: l.kind === "wall" && (k === c.layers.filter((q) => q.kind === "fill").length || k === c.layers.length - 1), de: ms.reduce((a, m) => a + m.de, 0), d: ms.reduce((a, m) => a + m.dist, 0), t: ms.reduce((a, m) => a + m.dist / m.f * 60, 0), f: Math.min(...ms.map((m) => m.f)) }); });
    const full = layerRuns.filter((r) => !r.eased), eased = layerRuns.filter((r) => r.eased);   // a closed line's first wall lap eases the flow in, its last level lap eases it out
    const worst = Math.max(...full.map((r) => Math.abs(r.de / r.d / app.e - 1)));
    checks.push(check("full layers: E per mm off #gE by at most (fraction)", worst, "<=", 0.01),
      check("first and last wall laps ease in and out (flow 40–60%)", +(eased.length > 0 && eased.every((r) => r.de / r.d / app.e > 0.4 && r.de / r.d / app.e < 0.6)), "==", 1));
    // feeds and layer times
    const pf = M.filter((m) => m.section === "copy" && m.g === "G1" && m.de > 0 && m.xy > 0 && !m.wiping).map((m) => m.f);
    checks.push(check("printing feeds: none above #gFeed (its mm/s × 60)", Math.max(...pf), "<=", app.feed), check("… none below the printer's slowest (mm/min)", Math.min(...pf), ">=", app.slow - 1e-6),
      check("layers faster than the seconds per layer (unless at the slowest)", layerRuns.filter((r) => r.t < app.need - 0.5 && r.f > app.slow + 1).length, "==", 0));
    // heights: first layer, top, travel above everything printed, final lift
    const printing = M.filter((m) => m.section === "copy" && m.de > 0 && m.xy > 0 && !m.wiping), zs = printing.map((m) => m.z);
    checks.push(check("first layer at #gZ (mm)", Math.min(...zs), "==", app.z), check("top at the height (mm)", Math.max(...zs), "==", app.height));
    let top = 0, low = Infinity;
    for (const m of M) { if (m.section === "copy" && m.g === "G0" && m.xy > 0) low = Math.min(low, m.z - top); if (m.section === "copy" && m.de > 0) top = Math.max(top, m.z); }
    checks.push(check("every travel at least #gLift above what's printed (mm over)", low - app.lift, ">=", -1e-6));
    const lastBeforeEnd = M.filter((m) => m.section !== "end").pop();
    checks.push(check("a final lift before the end lines (mm above the top)", lastBeforeEnd.z - top, ">=", app.lift - 1e-6), check("end lines after the last copy", +(at(/^; printer end/) > at(/^; copy 2 of/)), "==", 1));
    checks.push(check("all printing on the plate", printing.filter((m) => m.x < 0 || m.y < 0 || m.x > app.bed[0] || m.y > app.bed[1]).length, "==", 0));
    checks.push(check("page errors", errors.length, "==", 0));
    await close(); return { checks, notes: `${M.length} moves; E per mm ${app.e}; feeds ${[...new Set(pf)].join(", ")} mm/min` };
  },
};
