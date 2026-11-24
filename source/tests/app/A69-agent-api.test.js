const A = require("../lib/app.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A69", title: "The agent API: open, parts, select, set, snapshot, optimize and export through window.unbroken",
  guards: "an agent having to reach into the app's own functions (applySel, artUse, firing input events by hand) to do what a person does with clicks, or a call that answers before the app has finished",
  why: "The two logo trials (24 November 2026, docs/AGENT-PLAYBOOK.md) drove the app by calling its internals: picking a part with applySel and measured boxes, firing input events on sliders, screenshotting the Plate view for option sheets at different zooms. window.unbroken (agent.js) gives those as calls that work through the same controls a person uses and answer with plain data.",
  how: "Opens the app empty and calls unbroken.open() with the test logo (a mark over a word). Reads unbroken.parts() at 90 mm; selects the first part with unbroken.select(), sets its width with unbroken.set(), takes unbroken.snapshot() at 8 px per mm; runs unbroken.optimize({ keep: false }); exports G-code with unbroken.export('gcode', { download: false }); goes back to the whole picture with unbroken.select(null); and tries an unknown setting.",
  pass: "open() answers ready with a trace; parts() finds 2 parts (the mark, and the word with its dot), the word 90 mm wide with strokes 1.5–4 mm; select() traces the mark alone (fewer connectors than the whole); set() makes it the width asked; the snapshot is as wide as the printed line (the line plus the needle) at 8 px per mm; optimize() says what it would change and puts the settings back; export() gives G-code text with a G1 move and the file name; select(null) traces the whole picture again; an unknown setting is refused by name; no page errors.",
  async run(ctx) {
    const src = ctx.server.url + "/source/tests/lib/fixtures/mark-and-word.svg";
    const { page, errors, close } = await A.open(ctx, { clean: true, art: true });
    const r = await page.evaluate(async (src) => {
      const U = window.unbroken, o = {};
      const s0 = await U.open(src);
      o.openTrace = !!s0.trace;
      o.wholeConn = s0.trace.connectors;
      o.parts = U.parts({ widthMM: 90 }).parts;
      const mark = o.parts[0];
      const s1 = await U.select(mark.box);
      o.markConn = s1.trace.connectors;
      o.selection = s1.selection;
      o.want = mark.widthMM;
      o.width = (await U.set({ widthMM: mark.widthMM })).size.widthMM;
      const snap = U.snapshot({ pxPerMM: 8 });
      o.snap = { w: snap.widthMM, ppm: snap.pxPerMM, png: snap.png.slice(0, 22), line: designMM().W + lineWidthMM() };
      const sensBefore = $("sens").value, blurBefore = $("blur").value;
      const opt = await U.optimize({ keep: false });
      o.opt = { ok: opt.ok, kept: opt.kept, changedKeys: Object.keys(opt.changed || {}), back: $("sens").value === sensBefore && $("blur").value === blurBefore };
      const ex = await U.export("gcode", { download: false });
      o.ex = { ok: ex.ok, name: ex.name, g1: /\nG1 X/.test(ex.text || "") };
      o.whole = (await U.select(null)).selection;
      try {
        await U.set({ notASetting: 1 });
        o.unknown = "accepted";
      } catch (e) {
        o.unknown = e.message;
      }
      return o;
    }, src);
    const word = r.parts[1] || {};
    const res = {
      checks: [
        check("open(): traced", +r.openTrace, "==", 1),
        check("parts(): mark and word", r.parts.length, "==", 2),
        check("parts(): the word's width at 90 mm (mm)", word.widthMM || 0, "==", 90),
        check("parts(): the word's strokes (mm), at least", word.strokeMM || 0, ">=", 1.5),
        check("parts(): the word's strokes (mm), at most", word.strokeMM || 99, "<=", 4),
        check("select(): a selection", +r.selection, "==", 1),
        check("select(): the mark alone has fewer connectors than the whole", r.markConn, "<", r.wholeConn),
        check("set(): the width asked (mm)", Math.abs(r.width - r.want), "<", 0.2),
        check("snapshot(): as wide as the printed line (mm off)", Math.abs(r.snap.w - r.snap.line), "<", 0.3),
        check("snapshot(): a PNG", +(r.snap.png === "data:image/png;base64,"), "==", 1),
        check("optimize(): answered", +r.opt.ok, "==", 1),
        check("optimize({ keep: false }): settings put back", +(r.opt.back && !r.opt.kept), "==", 1),
        check("export(): G-code text with moves", +(r.ex.ok && r.ex.g1), "==", 1),
        check("export(): named after the picture", +/^mark-and-word_\d+_1x\.gcode$/.test(r.ex.name), "==", 1),
        check("select(null): the whole picture again", +!r.whole, "==", 1),
        check("set(): an unknown setting refused by name", +/notASetting/.test(r.unknown), "==", 1),
        check("page errors", errors.length, "==", 0),
      ],
      notes: `parts: ${JSON.stringify(r.parts.map((p) => [p.widthMM, p.heightMM, p.strokeMM]))} · connectors whole ${r.wholeConn}, mark ${r.markConn} · optimize would change ${r.opt.changedKeys.join(", ") || "nothing"}${errors.length ? "  \nerrors: " + errors.join(" | ") : ""}`,
    };
    await close();
    return res;
  },
};
