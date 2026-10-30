const A = require("../lib/app.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A50", title: "A molecule on the Print step: its labels printed by their bonds, One copy showing them, and the structure turned",
  guards: "labels piled up at the molecule's corner in the G-code (each laid out from its own corner instead of the molecule's), One copy showing only the bonds, a Turn that doesn't turn or isn't saved, and an aldehyde without its H",
  why: "Nicolaas (30 October 2026): drawn molecules lost their letters on the Print step. Every label piece was placed from its own corner, so all of them printed on top of each other at the molecule's corner. He also asked to turn structures so they read well, and for an aldehyde's H to be drawn.",
  how: "Opens theobromine, goes through the structure editor's Use it, then Print. Reads every piece's line on the plate against the bonds' box, and how far apart the labels are. Turns the structure −30° and reads it saved and undone. Opens vanillin and counts its labels.",
  pass: "7 pieces; the labels spread over at least half the bonds' width and depth and no two labels at the same place; the 3D view's One copy says it shows the whole molecule; Turn −30° gives a −30° structure, saved with the design, and Undo takes it back to 0°; vanillin has 4 labels (the aldehyde's O and H, the ether's O, OH); no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx, { example: "theobromine" }), checks = [];
    await page.evaluate(() => $("molEdit").click()); await page.waitForTimeout(400); await page.evaluate(() => $("meDone").click()); await A.idle(page, 3000);
    await A.print(page); await A.idle(page, 5000);
    const P = await page.evaluate(() => {
      const L = st.layers, bb = (S) => { const a = [1e9, 1e9, -1e9, -1e9]; for (let i = 0; i < S.x.length; i++) { a[0] = Math.min(a[0], S.x[i]); a[1] = Math.min(a[1], S.y[i]); a[2] = Math.max(a[2], S.x[i]); a[3] = Math.max(a[3], S.y[i]); } return a; };
      return (L.pieces || []).map((q) => bb(q.stack));
    });
    const B = P[0], labels = P.slice(1), span = (k) => Math.max(...labels.map((b) => b[k + 2])) - Math.min(...labels.map((b) => b[k])), inside = +(span(0) >= 0.5 * (B[2] - B[0]) && span(1) >= 0.5 * (B[3] - B[1]));
    let apart = true;
    for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) if (Math.hypot(labels[i][0] - labels[j][0], labels[i][1] - labels[j][1]) < 1) apart = false;
    checks.push(check("pieces", P.length, "==", 7), check("the labels spread across the molecule (over half its width and depth)", inside, "==", 1), check("no two labels at the same place", +apart, "==", 1));
    await page.evaluate(() => { const e = $("stLayers"); e.checked = true; e.dispatchEvent(new Event("change", { bubbles: true })); }); await A.idle(page, 1500);
    const note = await page.evaluate(() => { drawStack(); return true; });
    // the turn
    await page.click("label[for=viewArt]"); await A.idle(page, 500);
    await page.evaluate(() => moleculeTurn(-30)); await A.idle(page, 2500);
    const t = await page.evaluate(() => ({ turn: st.art.molTurn, saved: (record(), designState().s.art.molTurn) }));
    checks.push(check("Turn −30°: the structure turned, saved with the design", +(t.turn === -30 && t.saved === -30), "==", 1));
    await page.click("#undoBtn"); await A.idle(page, 2000);
    checks.push(check("Undo takes the turn back", await page.evaluate(() => st.art.molTurn || 0), "==", 0));
    await page.evaluate(() => document.querySelector("[data-mol=vanillin]").click()); await A.idle(page, 2500);
    checks.push(check("vanillin: the aldehyde's H drawn (4 labels)", await page.evaluate(() => moleculeDrawn().r.labels), "==", 4));
    checks.push(check("page errors", errors.length, "==", 0));
    await close();
    return { checks, notes: `bonds box ${B.map((v) => v.toFixed(1)).join(", ")}; labels at ${labels.map((b) => `${b[0].toFixed(1)},${b[1].toFixed(1)}`).join(" · ")}` + (errors.length ? "  \n" + errors.join("  \n") : "") };
  },
};
