const A = require("../lib/app.js"), { check } = require("../lib/check.js"), fs = require("fs");
module.exports = {
  id: "A70", title: "A picture in pieces: its parts traced on their own at one scale, a G-code file for each",
  guards: "a picture's parts printed at different scales (they wouldn't fit together in a box), pieces sharing one G-code file when each should be its own, or the picture split when it should stay one line",
  why: "The logo trials (docs/AGENT-TRIAL.md) found a logo's mark traces far better on its own, and the plan (docs/PICTURE-PIECES.md, decided 23 November 2026) is: pieces are an option, never automatic; split where there's an empty gap (a slider); every piece at the picture's scale; each piece its own G-code. Tracing two selections by hand gave two scales.",
  how: "Opens the test logo (a mark over a word) at 90 mm wide with unbroken.open() and set(). Reads the Picture choice on the Plate card (One line), then sets Pieces; reads status().pieces and the Plate card. Exports G-code with unbroken.export('gcode', { download: false }) at 1 copy and at 3 copies, then saves it with Export G-code and reads the zip. Moves Split at gaps to 10 mm, then back to One line.",
  pass: "A picture starts as One line; with Pieces there are 2 pieces, the word about 90 mm wide and the mark as wide as parts() says at that size (within 10%: one scale); 2 G-code files named …-1_… and …-2_…, each with printing moves, one print each at 1 copy and three copy markers each at 3 copies; the saved zip holds 2 files; Split at gaps of 10 mm still gives at most 2 pieces; One line again gives one G-code text; no page errors.",
  async run(ctx) {
    const src = ctx.server.url + "/source/tests/lib/fixtures/mark-and-word.svg";
    const { page, errors, close } = await A.open(ctx, { clean: true, art: true });
    const r = await page.evaluate(async (src) => {
      const U = window.unbroken, o = {};
      await U.open(src);
      await U.set({ widthMM: 90 });
      await U.view("plate");
      o.start = $("picPieces").value;
      o.fieldShown = !$("picPiecesField").hidden;
      o.parts = U.parts({ widthMM: 90 }).parts.map((p) => p.widthMM);
      const s = await U.set({ pieces: true });
      o.pieces = (s.pieces || []).map((p) => p.widthMM);
      o.plate = $("plateHint").textContent;
      const count = (t, re) => (t.match(re) || []).length;
      const ex1 = await U.export("gcode", { download: false });
      o.files1 = (ex1.files || []).map((f) => ({ name: f.name, moves: count(f.text, /\nG1 X[^\n]* E/g), copies: count(f.text, /^; copy/gm) }));
      await U.set({ copies: 3 });
      const ex3 = await U.export("gcode", { download: false });
      o.files3 = (ex3.files || []).map((f) => ({ name: f.name, copies: count(f.text, /^; copy/gm) }));
      await U.set({ splitMM: 10 });
      o.wide = ((await U.whenReady()).pieces || []).length;
      return o;
    }, src);
    // the zip as saved
    const [dl] = await Promise.all([page.waitForEvent("download"), page.evaluate(() => window.unbroken.export("gcode"))]);
    const zip = fs.readFileSync(await dl.path()).toString("latin1"), inZip = (zip.match(/PK\x01\x02/g) || []).length;
    const one = await page.evaluate(async () => {
      await window.unbroken.set({ pieces: false, copies: 1 });
      const ex = await window.unbroken.export("gcode", { download: false });
      return { text: !!ex.text, files: !!ex.files };
    });
    const [mark, word] = r.pieces, ratio = mark && word && r.parts.length === 2 ? mark / word / (r.parts[0] / r.parts[1]) : 0;
    const res = {
      checks: [
        check("a picture starts as One line", r.start, "==", "one"),
        check("the Picture choice shows for a picture", +r.fieldShown, "==", 1),
        check("Pieces: how many", r.pieces.length, "==", 2),
        check("the word's width (mm)", Math.abs((word || 0) - 90), "<", 2.5),
        check("one scale: the mark against the word, as parts() says (ratio)", Math.abs(ratio - 1), "<", 0.1),
        check("a G-code file for each piece", r.files1.length, "==", 2),
        check("files named after the pieces", +(r.files1.length === 2 && /-1_\d+_1x\.gcode$/.test(r.files1[0].name) && /-2_\d+_1x\.gcode$/.test(r.files1[1].name)), "==", 1),
        check("each file prints (moves with chocolate), fewest", r.files1.length ? Math.min(...r.files1.map((f) => f.moves)) : 0, ">", 20),
        check("1 copy: each file one print (no copy markers)", +r.files1.every((f) => f.copies === 0), "==", 1),
        check("3 copies: three in each file", +(r.files3.length === 2 && r.files3.every((f) => f.copies === 3)), "==", 1),
        check("the saved zip holds a file for each piece", inZip, "==", 2),
        check("Split at gaps of 10 mm: no more pieces", r.wide, "<=", 2),
        check("One line again: one G-code", +(one.text && !one.files), "==", 1),
        check("page errors", errors.length, "==", 0),
      ],
      notes: `pieces ${JSON.stringify(r.pieces)} mm, parts at 90 mm ${JSON.stringify(r.parts)} · ${r.plate}${errors.length ? "  \nerrors: " + errors.join(" | ") : ""}`,
    };
    await close();
    return res;
  },
};
