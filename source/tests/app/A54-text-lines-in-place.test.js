const A = require("../lib/app.js"), { check } = require("../lib/check.js"), { readGcode } = require("../lib/gcode.js"), { execSync } = require("child_process");
module.exports = {
  id: "A54", title: "A text's lines printed in place: a piece for each line, keeping the layout as typed",
  guards: "a card or message whose lines get shuffled round the plate to save room, so it no longer reads top to bottom",
  why: "Printing each line of a text as its own piece keeps strands of chocolate from running between the lines (A29); packing the pieces to save room suits a set of name labels but scrambles a message (\"Ты и красавица, / и Зверева, / …\" came out with line 2 beside line 1). In place, the lines keep their layout as typed: one under the other, centred as the Text card says, with the needle lifted between them. Raised 2 November 2026.",
  how: "Types a four-line message, reads the Line step's corner label, goes to the 3D tab with the default Lines of text, reads the placements and the plate hint, exports the G-code and checks each piece prints inside its footprint, then sets 2 copies.",
  pass: "On the Line step the connectors from one line to the next are marked as lifts (\"lines print apart\"), not counted; one piece counts them again. In place is the default; four pieces, one per line, each placed below the one before it with the lines' centres within 1 mm of each other (centred text), none overlapping and all on the plate; the hint says in its place; the G-code has four pieces, each one continuous line inside its footprint; 2 copies make two whole messages (8 pieces in two sets) and Copies isn't per line; no page errors.",
  slow: true,
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx), checks = [];
    await A.source(page, "text"); await A.idle(page);
    await page.fill("#textIn", "Happy\nbirthday\ndear\nAnna"); await page.dispatchEvent("#textIn", "input"); await A.idle(page); await A.idle(page);
    // the Line step: the connectors between lines aren't printed, so they aren't counted or drawn as chocolate
    await page.click("label[for=viewDesign]"); await A.idle(page); await A.idle(page);
    const chipIn = await page.textContent("#chip"), lifts = await page.evaluate(() => (lineLifts() || { n: 0 }).n);
    checks.push(check("Line step: lines print apart (corner label)", +/lines print apart/.test(chipIn), "==", 1), check("Line step: connectors between lines found", lifts, ">=", 3));
    await A.print(page); await A.idle(page);
    await page.waitForFunction(() => st.pieces && st.layers && st.layers.pieces, null, { timeout: 60000 }); await A.idle(page);
    checks.push(check("Lines of text: in place to start with", await page.inputValue("#textPieces"), "==", "place"));
    const lay = await page.evaluate(() => { const L = plateNow(); return { fits: L.fits, pl: placements(L).map((p) => ({ x: p.x, y: p.y, piece: p.piece, w: footOf(L, p).w, h: footOf(L, p).h })), bed: [BED.w, BED.h] }; });
    const pl = [...lay.pl].sort((a, b) => a.piece - b.piece);
    // each piece's own ink box on the plate: its footprint is the whole message's frame, so compare the lines' boxes
    const boxes = await page.evaluate(() => { const L = plateNow(); return placements(L).map((p) => { const q = L.pieces[p.piece]; let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity; const ln = q.local; for (let i = 0; i < ln.x.length; i++) { const X = p.x + ln.x[i], Y = p.y + ln.y[i]; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); } return { piece: p.piece, x0, x1, y0, y1 }; }).sort((a, b) => a.piece - b.piece); });
    const below = boxes.slice(1).every((b, i) => b.y1 <= boxes[i].y0 + 0.5 || b.y0 >= boxes[i].y1 - 0.5);   // stacked, one row each (y may run either way)
    const order = boxes.map((b) => (b.y0 + b.y1) / 2), mono = order.every((v, i) => !i || v > order[i - 1]) || order.every((v, i) => !i || v < order[i - 1]);
    const centres = boxes.map((b) => (b.x0 + b.x1) / 2), spread = Math.max(...centres) - Math.min(...centres);
    checks.push(check("four pieces, one per line", pl.length, "==", 4), check("lines stacked one under another, in order", +(below && mono), "==", 1),
      check("lines centred on each other (mm)", spread, "<", 1, 2), check("all on the plate", lay.fits, "==", 4),
      check("plate hint: in its place", +/in its place/.test(await page.textContent("#plateHint")), "==", 1));
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#gcodeBtn")]);
    const G = readGcode(execSync(`unzip -p "${await dl.path()}"`, { maxBuffer: 1 << 28 }).toString()), M = G.moves;
    checks.push(check("G-code: four pieces", G.copies.length, "==", 4));
    G.copies.forEach((c, k) => {
      const mv = M.slice(c.from, c.to), b = boxes[k];
      const pr = mv.filter((m) => m.g === "G1" && m.de > 0 && !m.wiping);
      const out = pr.filter((m) => m.y < Math.min(b.y0, b.y1) - 2 || m.y > Math.max(b.y0, b.y1) + 2).length;
      checks.push(check(`G-code line ${k + 1}: no travel inside it`, mv.filter((m, i) => i > 2 && m.g === "G0").length, "==", 0), check(`G-code line ${k + 1}: printed on its own row (moves off it)`, out, "==", 0));
    });
    await A.setValue(page, "#copies", 2); await A.idle(page); await A.idle(page);
    const two = await page.evaluate(() => { const L = plateNow(); return { copies: L.copies, sets: L.sets, n: placements(L).length }; });
    await page.selectOption("#textPieces", "one"); await A.idle(page); await A.idle(page);
    checks.push(check("One piece: no lifts, every connector counted", +(!(await page.evaluate(() => lineLifts())) && !/print apart/.test(await page.textContent("#chip"))), "==", 1));
    await page.selectOption("#textPieces", "place"); await A.idle(page); await A.idle(page);
    checks.push(check("2 copies: two whole messages", `${two.n}:${two.sets}`, "==", "8:2"), check("Copies isn't per line", await page.textContent("#copiesLab"), "==", "Copies"), check("page errors", errors.length, "==", 0));
    await close(); return { checks, notes: errors.join(" | ") };
  },
};
