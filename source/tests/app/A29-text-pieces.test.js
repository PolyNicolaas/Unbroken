const A = require("../lib/app.js"), { check } = require("../lib/check.js"), { readGcode } = require("../lib/gcode.js"), { execSync } = require("child_process");
module.exports = {
  id: "A29", title: "A text of several lines prints a piece for each line, all on one plate, in one G-code file",
  guards: "lines of a text joined by a connector strand when they should print apart, a line left off the plate or out of the file, pieces laid over each other, a piece that isn't one continuous line, and the Trace tab's drawing changing because of how the 3D tab prints it",
  why: "A list of names (or any text of several lines) should come off the printer as separate pieces: one continuous line each, with no strand of chocolate from one line to the next. From the Suggestion box (18 October 2026). The Trace and 2D tabs keep the text as one drawing; the 3D tab's Plate card decides how it prints (Lines of text: a piece for each line, or one piece with the lines joined).",
  how: "Opens the app, picks Text and types three names on three lines, notes the Trace tab's line, goes to the 3D tab and waits for the pieces. Reads the Plate card, the placements and the ready list; exports G-code and reads it back move by move (lib/gcode.js). Sets 2 copies of each line and reads the plate again; picks the second piece for One copy; then switches Lines of text to One piece.",
  pass: "The Plate card offers Lines of text with A piece for each line chosen; three pieces named after the lines, each traced on its own (no connector between lines), different widths; all three on the plate, none overlapping; the G-code has three copies, each one continuous line (no travel inside) printed inside its own footprint; the Trace tab's line is unchanged; 2 copies of each line gives six pieces; One copy shows the piece picked; One piece goes back to one copy of the joined text; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx), checks = [];
    await page.click("label[for=srcText]"); await A.idle(page);
    await page.fill("#textIn", "Anna\nBen\nChloe"); await A.idle(page); await A.idle(page);
    const trace0 = await page.evaluate(() => ({ n: st.final.re.length, N: st.N, ver: st.finalVer }));
    await page.click("label[for=viewChoc]"); await A.idle(page);
    await page.waitForFunction(() => st.pieces && st.layers && st.layers.pieces, null, { timeout: 60000 }); await A.idle(page);
    checks.push(check("Plate card: Lines of text shown, A piece for each line chosen", +((await page.isVisible("#textPieces")) && (await page.inputValue("#textPieces")) === "each"), "==", 1));
    const P = await page.evaluate(() => st.pieces.list.map((d) => ({ name: d.name, w: d.fb.x1 - d.fb.x0, N: d.N })));
    checks.push(check("three pieces, named after the lines", P.map((p) => p.name).join(","), "==", "Anna,Ben,Chloe"),
      check("the pieces differ in width (each its own line)", +(new Set(P.map((p) => Math.round(p.w))).size === 3), "==", 1));
    const lay = await page.evaluate(() => { const L = plateNow(); return { pieces: !!L.pieces, fits: L.fits, copies: L.copies, pl: placements(L).map((p) => ({ x: p.x, y: p.y, piece: p.piece, w: footOf(L, p).w, h: footOf(L, p).h })), bed: [BED.w, BED.h] }; });
    const on = lay.pl.every((p) => p.x >= 0 && p.y >= 0 && p.x + p.w <= lay.bed[0] + 1e-6 && p.y + p.h <= lay.bed[1] + 1e-6);
    let overlap = 0; for (let i = 0; i < lay.pl.length; i++) for (let j = i + 1; j < lay.pl.length; j++) { const a = lay.pl[i], b = lay.pl[j]; if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlap++; }
    checks.push(check("plate: three placements, one per piece", lay.pl.map((p) => p.piece).join(","), "==", "0,1,2"),
      check("plate: all on the plate", +(on && lay.fits === 3), "==", 1), check("plate: footprints overlapping", overlap, "==", 0),
      check("Plate card says three pieces", +/^3 pieces \(3 lines\) fit/.test(await page.textContent("#plateHint")), "==", 1),
      check("ready list: the pieces on the plate", +(await page.$$eval("#readyList li", (L) => L.some((l) => /3 pieces on the plate, one for each line/.test(l.textContent)))), "==", 1));
    // the G-code: three copies, each one line inside its own footprint
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#gcodeBtn")]);
    const G = readGcode(execSync(`unzip -p "${await dl.path()}"`, { maxBuffer: 1 << 28 }).toString()), M = G.moves;
    checks.push(check("G-code: three copies (one per piece)", G.copies.length, "==", 3));
    G.copies.forEach((c, k) => {
      const mv = M.slice(c.from, c.to), pr = mv.filter((m) => m.g === "G1" && m.de > 0 && !m.wiping), p = lay.pl[k];
      const out = pr.filter((m) => m.x < p.x - 0.05 || m.y < p.y - 0.05 || m.x > p.x + p.w + 0.05 || m.y > p.y + p.h + 0.05).length;
      checks.push(check(`G-code piece ${k + 1}: no travel inside it (one continuous line)`, mv.filter((m, i) => i > 2 && m.g === "G0").length, "==", 0),
        check(`G-code piece ${k + 1}: printed inside its footprint (moves outside)`, out, "==", 0));
    });
    checks.push(check("the Trace tab's line is the same as before", +(await page.evaluate((t) => st.finalVer === t.ver && st.final.re.length === t.n && st.N === t.N, trace0)), "==", 1));
    // copies of each line; One copy picks a piece
    await A.setValue(page, "#copies", 2); await A.idle(page); await A.idle(page);
    const two = await page.evaluate(() => { const L = plateNow(); return { copies: L.copies, order: placements(L).map((p) => p.piece).join(",") }; });
    checks.push(check("2 copies of each line: six pieces, in sets", `${two.copies}:${two.order}`, "==", "6:0,1,2,0,1,2"),
      check("Copies says it's per line", await page.textContent("#copiesLab"), "==", "Copies of each line"));
    await page.selectOption("#pieceShown", "1"); await A.idle(page); await A.idle(page);
    checks.push(check("One copy shows the second piece", await page.evaluate(() => st.layers.piece), "==", 1));
    // one piece: the lines joined again, as the Trace tab draws them
    await page.selectOption("#textPieces", "one"); await A.idle(page); await A.idle(page);
    const one = await page.evaluate(() => { const L = plateNow(); return { pieces: !!L.pieces, n: placements(L).length, layers: !!st.layers.pieces }; });
    checks.push(check("One piece: two copies of the joined text, no pieces", +(!one.pieces && !one.layers && one.n === 2), "==", 1),
      check("page errors", errors.length, "==", 0));
    await close();
    return { checks, notes: errors.join(" | ") };
  },
};
