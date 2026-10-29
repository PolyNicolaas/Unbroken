const { UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js"), FONTS = require("../../engine/fonts.js");
module.exports = {
  id: "E31", title: "Text pieces: a line map per line of text, different pieces packed on one plate, and pieces kept together",
  guards: "a line's letters missing from its own line map or leaking into another's, the whole text's line map changing, pieces placed over each other or off the plate when they'd fit, and pieces left out when they don't",
  why: "A text of several lines can print as a piece per line (A29): each line is traced from its own line map (UNB.rasterText's lines), and the pieces, all different sizes, are laid out together on the plate (UNB.plateLayoutPieces), several sets of them for copies.",
  how: "Lays out three lines (and one line, and a text with an empty line) in the sans font and rasterizes them; compares the line maps with the whole one. Packs three boxes of different widths on a 200 × 150 mm plate, one and two sets; packs two pieces too long for a narrow plate; packs more pieces than fit.",
  pass: "One line map per line with letters (none for one line; the empty line gets none); together they hold every pixel of the whole map and no pixel is in two; the whole map is the same as without the line maps; packed pieces are in reading order, set after set, inside the plate, never overlapping, at least the gap apart in a row; pieces too long are turned 90°; pieces that don't fit are still placed (off the plate) and counted out of fits. Together (a molecule): 3 sets of 3 pieces all placed, each piece where it was relative to the others, the pieces of a set at one place.",
  async run() {
    const checks = [], font = FONTS[Object.keys(FONTS)[0]], opt = { cap: 10, gap: 2.5, word: 6, lineGap: 1.7 };
    const L3 = UNB.textLayout("Anna\nBen\nChloe", font, opt), R3 = UNB.rasterText(L3, 6, 3);
    const sum = new Uint8Array(R3.mask.length); let twice = 0, missing = 0, extra = 0;
    for (const m of R3.lines) for (let i = 0; i < m.length; i++) if (m[i]) { if (sum[i]) twice++; sum[i] = 1; }
    for (let i = 0; i < sum.length; i++) { if (R3.mask[i] && !sum[i]) missing++; if (!R3.mask[i] && sum[i]) extra++; }
    checks.push(check("three lines: a line map each", R3.lines.length, "==", 3), check("line maps: pixels in two of them", twice, "==", 0),
      check("line maps: whole-map pixels in none (px)", missing, "<=", 2), check("line maps: pixels not in the whole map (px)", extra, "<=", 2));
    const L1 = UNB.textLayout("Anna", font, opt), R1 = UNB.rasterText(L1, 6, 3);
    checks.push(check("one line: no line maps", R1.lines.length, "==", 0));
    const Le = UNB.textLayout("Anna\n\nBen", font, opt), Re = UNB.rasterText(Le, 6, 3);
    checks.push(check("a text with an empty line: a line map for each line with letters", Re.lines.length, "==", 2));
    // packing
    const box = (w, h) => ({ x: [0, w, w, 0], y: [0, 0, h, h] }), gap = 5, pad = 0.4;
    const ok = (lay, W, H) => {
      const pl = lay.placed, P = (p) => lay.pieces[p.piece]; let over = 0, off = 0, close = 0;
      for (let i = 0; i < pl.length; i++) {
        const a = pl[i], fa = P(a); if (a.x < -1e-6 || a.y < -1e-6 || a.x + fa.w > W + 1e-6 || a.y + fa.h > H + 1e-6) off++;
        for (let j = i + 1; j < pl.length; j++) { const b = pl[j], fb = P(b);
          if (a.x < b.x + fb.w && b.x < a.x + fa.w && a.y < b.y + fb.h && b.y < a.y + fa.h) over++;
          else if (Math.abs(a.y - b.y) < 1e-6 && Math.min(Math.abs(b.x - (a.x + fa.w)), Math.abs(a.x - (b.x + fb.w))) < gap - 1e-6) close++; }
      }
      return { over, off, close };
    };
    const three = [box(60, 15), box(90, 15), box(40, 15)];
    for (const sets of [1, 2]) {
      const lay = UNB.plateLayoutPieces(three, { bedW: 200, bedH: 150, copies: sets, gap, pad }), r = ok(lay, 200, 150);
      checks.push(check(`${sets} set(s): pieces in reading order, set after set`, lay.placed.map((p) => p.piece).join(","), "==", Array.from({ length: sets }, () => "0,1,2").join(",")),
        check(`${sets} set(s): all fit`, lay.fits, "==", 3 * sets), check(`${sets} set(s): off the plate`, r.off, "==", 0),
        check(`${sets} set(s): overlapping`, r.over, "==", 0), check(`${sets} set(s): neighbours in a row closer than the gap`, r.close, "==", 0),
        check(`${sets} set(s): each piece as wide as its line (mm)`, Math.max(...lay.pieces.map((q, i) => Math.abs(q.w - ([60, 90, 40][i] + 2 * pad)))), "<=", 1e-6));
    }
    const long = UNB.plateLayoutPieces([box(150, 15), box(150, 15)], { bedW: 100, bedH: 200, copies: 1, gap, pad: 0 });
    checks.push(check("pieces longer than the plate is wide: turned 90° and all fit", +(long.angle === 90 && long.fits === 2 && ok(long, 100, 200).off === 0), "==", 1));
    const straight = UNB.plateLayoutPieces([box(150, 15), box(150, 15)], { bedW: 100, bedH: 200, copies: 1, gap, pad: 0, straight: true });
    checks.push(check("Straight only: not turned, so they don't fit (but are still placed)", +(straight.angle === 0 && straight.fits === 0 && straight.placed.length === 2), "==", 1));
    const many = UNB.plateLayoutPieces(three, { bedW: 200, bedH: 60, copies: 4, gap, pad: 0 });
    checks.push(check("more than fit: every piece placed, fits counts the ones on the plate", +(many.placed.length === 12 && many.fits < 12 && many.fits >= 6 && ok(many, 200, 60).off === 12 - many.fits), "==", 1));
    // together (a molecule's bonds and labels): every piece keeps its place, one block per set
    const sq = (x0, y0, w) => ({ x: Float64Array.from([x0, x0 + w, x0 + w, x0]), y: Float64Array.from([y0, y0, y0 + w, y0 + w]) });
    const T = UNB.plateLayoutPieces([sq(0, 0, 20), sq(25, 5, 4), sq(-6, 8, 4)], { bedW: 340, bedH: 232, copies: 3, gap: 5, pad: 0, straight: true, together: true });
    const rel = (q, i) => [T.placed[q].x + T.pieces[T.placed[q].piece].local.x[0], T.placed[q].y + T.pieces[T.placed[q].piece].local.y[0]];
    const a = rel(0), b = rel(1);
    checks.push(check("together: 3 sets of 3 pieces placed, all fitting", +(T.placed.length === 9 && T.fits === 9), "==", 1), check("… a label 25 mm right of the bonds' corner stays there (mm off)", Math.abs(b[0] - a[0] - 25) + Math.abs(b[1] - a[1] - 5), "<", 1e-9), check("… the pieces of a set share one place", +(T.placed[0].x === T.placed[2].x && T.placed[3].x !== T.placed[0].x), "==", 1));
    return { checks };
  },
};
