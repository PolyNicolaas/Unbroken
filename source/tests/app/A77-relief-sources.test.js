const A = require("../lib/app.js"), { check } = require("../lib/check.js");
const path = require("path");
module.exports = {
  id: "A77", title: "A relief from a logo, text, a pattern or a photo: one button, the height style, the inset's taps, made again keeping its shape",
  guards: "Make a relief offered for one kind of source only, a logo starting as a slope instead of flat shapes, a tap on the inset that misses its part or doesn't go through Undo, making the relief again from something else resetting its shape, a text's baseline joins standing out, a pattern's lines run together into one block, and the relief not kept in a design file",
  why: "Nicolaas (26 November 2026): image manipulation for reliefs, kept simple: text, logos, patterns and pictures all make one, one style with one slider, and the parts tapped on an inset like the Ties card's (docs/RELIEF-PLAN.md).",
  how: "Opens mark-and-word.svg at 80 mm; taps Make a relief on the Input card; reads the style, the inset and its readout; taps the middle of the largest part on the inset twice (in, then flat), then Undo and Redo; picks Circle. Then Text (Nicolaas), Make a relief; then Pattern, Make a relief; then the Face example, Make a relief. Saves the design's state and opens it again. Screenshots in results/relief-*.png.",
  pass: "The button shows for the logo, the text, the pattern and the face; the logo starts on Shapes, the face on Smooth, the text and pattern on Shapes with a line width (the pattern's under its gaps: at most 2.4 mm); the inset is drawn and its readout counts parts; a tap presses the part in, the next leaves it flat, Undo brings it back in and Redo flat again; made again from the text, the relief stays round (Circle) and as wide, its source the text with no taps, and the text's joins along the baseline aren't in its source; the design file brings the relief back with its source and taps; no page errors.",
  slow: true,
  async run(ctx) {
    const src = ctx.server.url + "/source/tests/lib/fixtures/mark-and-word.svg";
    const { page, errors, close } = await A.open(ctx, { clean: true, art: true, viewport: { width: 1180, height: 820 } });
    const out = path.join(__dirname, "..", "results");
    const shot = (n) => page.screenshot({ path: path.join(out, `relief-${n}.png`) });
    const V = () => page.evaluate(() => st.model && st.model.vase && structuredClone(st.model.vase));
    const make = async () => {
      const shown = await page.evaluate(() => !$("reliefRow").hidden);
      await page.evaluate(() => $("reliefMake").click());
      await A.idle(page, 1500);
      return shown;
    };
    const o = {};
    // the logo
    await page.evaluate(async (src) => { await window.unbroken.open(src); await window.unbroken.set({ widthMM: 80 }); }, src);
    await A.idle(page, 1000);
    o.logoShown = await make();
    o.logo = await V();
    o.inset = await page.evaluate(() => ({ h: $("rlInset").height, info: $("rlInfo").textContent }));
    await shot("logo");
    // the middle of the largest part, on the inset
    const pt = await page.evaluate(() => {
      $("rlInset").scrollIntoView({ block: "center" });
      const G = rlView.G, M = G.map, R = G.height;
      const p = R.parts.map((q, i) => ({ ...q, i })).filter((q) => q.level > 0 && q.n > 0).sort((a, b) => b.n - a.n)[0];
      let k = -1;
      for (let i = 0; i < R.lab.length && k < 0; i++) {
        if (R.lab[i] !== p.i) continue;
        const x = i % R.w, y = Math.floor(i / R.w);
        let ok = true;
        for (let dy = -3; dy <= 3 && ok; dy++) for (let dx = -3; dx <= 3 && ok; dx++) ok = R.lab[(y + dy) * R.w + x + dx] === p.i;
        if (ok) k = i;
      }
      const u = ((k % R.w) + 0.5) / R.w, v = (Math.floor(k / R.w) + 0.5) / R.h, r = $("rlInset").getBoundingClientRect(), { s, ox, oy } = rlView;
      return { x: r.left + ox + (M.x0 + u * M.iw) * s, y: r.top + oy + (M.H - (M.y0 + M.ih - v * M.ih)) * s };
    });
    const taps = async () => (await V()).texture.taps.map((t) => t.to).join(",");
    await page.mouse.click(pt.x, pt.y); await A.idle(page, 800); o.tap1 = await taps();
    await page.mouse.click(pt.x, pt.y); await A.idle(page, 800); o.tap2 = await taps();
    o.flatInfo = await page.evaluate(() => $("rlInfo").textContent);
    await shot("tapped");
    await page.evaluate(() => undo()); await A.idle(page, 800); o.undone = await taps();
    await page.evaluate(() => redo()); await A.idle(page, 800); o.redone = await taps();
    const faceOf = (v) => { const R = v.profile[1][1]; return v.plan.kind === "plaque" ? 2 * R * (1 - v.plan.thick / 2) : 2 * Math.PI * R * (v.texture.span || 0.5); };
    o.face0 = faceOf(await V());
    await page.evaluate(() => $("vpCircle").click()); await A.idle(page, 800);
    o.faceRound = faceOf(await V());
    // the text
    await page.evaluate(async () => {
      $("srcText").click(); $("srcText").dispatchEvent(new Event("change", { bubbles: true }));
      $("textIn").value = "Nicolaas"; $("textIn").dispatchEvent(new Event("input", { bubbles: true }));
      await window.unbroken.whenReady();
    });
    await A.idle(page, 1000);
    o.joins = await page.evaluate(() => (st.text && st.text.layout && (st.text.layout.joinIdx || []).length) || 0);
    o.textShown = await make();
    o.text = await V();
    o.faceText = faceOf(o.text);
    o.textParts = await page.evaluate(() => rlView.G.height.parts.filter((p) => p.level > 0 && p.n > 0).length);
    await shot("text");
    // the pattern
    await page.evaluate(async () => { $("srcPattern").click(); $("srcPattern").dispatchEvent(new Event("change", { bubbles: true })); await window.unbroken.whenReady(); });
    await A.idle(page, 1500);
    o.patternShown = await make();
    o.pattern = await V();
    await shot("pattern");
    // the face
    await page.evaluate(async () => { artExamplePicture("face"); await window.unbroken.whenReady(); });
    await A.idle(page, 1500);
    o.faceShown = await make();
    o.face = await V();
    await shot("face");
    // a design file: saved and opened again
    o.reopened = await page.evaluate(async () => {
      const d = structuredClone(designState());
      $("srcText").click(); $("srcText").dispatchEvent(new Event("change", { bubbles: true }));
      await window.unbroken.whenReady();
      applyDesign(d);
      await window.unbroken.whenReady();
      const v = st.model && st.model.vase;
      return v ? { kind: v.texture.kind, src: v.texture.source.kind, style: (v.texture.height || {}).style } : null;
    });
    await A.idle(page, 800);
    const T = o.text.texture, S = T.source;
    const checks = [
      check("the logo: Make a relief offered", +o.logoShown, "==", 1),
      check("the logo: a relief, on a plaque", +(o.logo.texture.kind === "relief" && o.logo.plan.kind === "plaque"), "==", 1),
      check("the logo: starts on Shapes (flat art)", o.logo.texture.height.style, "==", "shapes"),
      check("the inset drawn (px tall)", o.inset.h, ">", 40),
      check("the inset's readout counts the parts", +/\d+ parts? out/.test(o.inset.info), "==", 1),
      check("a tap: the part pressed in", o.tap1, "==", "in"),
      check("a second tap: the part left flat", o.tap2, "==", "flat"),
      check("the readout counts it", +/1 left flat/.test(o.flatInfo), "==", 1),
      check("Undo: pressed in again", o.undone, "==", "in"),
      check("Redo: flat again", o.redone, "==", "flat"),
      check("Circle: the face as wide, off by (mm)", Math.abs(o.faceRound - o.face0), "<=", 1),
      check("the text: Make a relief offered", +o.textShown, "==", 1),
      check("the text: made again, still round", o.text.plan.kind, "==", "circle"),
      check("the text: as wide, off by (mm)", Math.abs(o.faceText - o.faceRound), "<=", 1),
      check("the text: its source is the text", S.kind, "==", "text"),
      check("the text: strokes, on Shapes", +(S.strokes && T.height.style === "shapes"), "==", 1),
      check("the text: the logo's taps gone", T.taps.length, "==", 0),
      check("the text was traced with joins along its baseline (so leaving them out is tested)", o.joins, ">", 0),
      check("the text's letters stand apart, the joins left out (parts, Nicolaas)", o.textParts, ">=", 7),
      check("the pattern: Make a relief offered", +o.patternShown, "==", 1),
      check("the pattern: its source is the pattern", o.pattern.texture.source.kind, "==", "pattern"),
      check("the pattern: a line width under its gaps (mm)", o.pattern.texture.height.lineW, "<=", 2.4),
      check("the face: Make a relief offered", +o.faceShown, "==", 1),
      check("the face: starts on Smooth (a photo's greys)", o.face.texture.height.style, "==", "smooth"),
      check("the design file: the relief back, from the face, on Smooth", JSON.stringify(o.reopened), "==", JSON.stringify({ kind: "relief", src: "picture", style: "smooth" })),
      check("page errors", errors.length, "==", 0),
    ];
    await close();
    return { checks, notes: [`logo: ${o.inset.info}`, `text ${S.w}×${S.h}, line ${T.height.lineW} mm; pattern line ${o.pattern.texture.height.lineW} mm`, ...errors] };
  },
};
