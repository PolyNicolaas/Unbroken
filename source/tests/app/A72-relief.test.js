const A = require("../lib/app.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A72", title: "A relief: a picture standing out from a wall, flat (a closed loop) or round, printed upright",
  guards: "Make a relief not making one from the picture, the sides or the shape not reaching the wall, the picture changing width between flat and round, the button offered for text, and a relief that doesn't export",
  why: "Nicolaas (24 November 2026): a picture turned into a relief wall, flat or round, a closed loop, the logo on each wall if wanted (E65 has the engine's side).",
  how: "Opens mark-and-word.svg with unbroken.open() at 80 mm wide, taps Make a relief from this picture on the Line tool; reads the vase; picks Both; switches the shape to Circle and back (Undo); goes to Print, exports G-code; sets Fine-tuning's Overhang to 0.15 mm. Then Text as the input, to see the button go.",
  pass: "A relief is made (the model named relief, a plaque with the picture texture, on the front, its face about 80 mm wide, 10 mm front to back); Both reaches the texture; Circle keeps the picture's width (within 1 mm) and Undo goes back to the plaque; the Print step's ready list says every lap sits on the one below and the G-code exports; the lean is 90% of the overhang a bead holds per layer (0.84 mm/mm at 0.28 mm and 0.3 mm layers), and follows Overhang 0.15 mm (0.45) with every lap still on the one below; with Text the button is hidden; no page errors.",
  async run(ctx) {
    const src = ctx.server.url + "/source/tests/lib/fixtures/mark-and-word.svg";
    const { page, errors, close } = await A.open(ctx, { clean: true, art: true });
    const r = await page.evaluate(async (src) => {
      const U = window.unbroken, o = {}, wait = (ms) => new Promise((r) => setTimeout(r, ms));
      await U.open(src);
      await U.set({ widthMM: 80 });
      $("reliefFromPic").click();
      await wait(800); await U.whenReady();
      const V = () => st.model && st.model.vase;
      const face = () => { const v = V(), R = UNB.vaseRadius(v.profile, 0.5); return v.plan.kind === "plaque" ? 2 * R * (1 - v.plan.thick / 2) : 2 * Math.PI * R * (v.texture.span || 0.5); };
      o.name = st.model && st.model.name; o.plan = V() && V().plan.kind; o.tex = V() && V().texture.kind; o.sides = V() && V().texture.sides; o.width = V() && 2 * UNB.vaseRadius(V().profile, 0.5); o.thickMM = V() && V().plan.thick * UNB.vaseRadius(V().profile, 0.5);
      o.face0 = face();
      $("vtSideBoth").click(); await wait(300); await U.whenReady();
      o.both = V().texture.sides;
      $("vpCircle").click(); await wait(300); await U.whenReady();
      o.round = V().plan.kind; o.face1 = face();
      undo(); await wait(500); await U.whenReady();
      o.undone = V().plan.kind;
      await U.view("layers");
      const s = await U.whenReady();
      o.ready = s.ready.map((x) => x.level + ": " + x.text);
      const ex = await U.export("gcode", { download: false });
      o.gcode = (ex.text || "").length; o.file = ex.name;
      // the overhang a bead holds (Fine-tuning) sets how far each layer may lean
      o.slope0 = V().texture.slope;
      $("gOver").value = "0.15"; $("gOver").dispatchEvent(new Event("input", { bubbles: true })); $("gOver").dispatchEvent(new Event("change", { bubbles: true }));
      await wait(500); const s2 = await U.whenReady();
      o.slope1 = V().texture.slope;
      o.ready1 = s2.ready.map((x) => x.level + ": " + x.text);
      return o;
    }, src);
    await page.click('[data-node="art"]').catch(() => {});
    await page.evaluate(async () => { $("srcText").click(); await window.unbroken.whenReady(); });
    const hidden = await page.evaluate(() => $("reliefFromPic").hidden);
    const res = {
      checks: [
        check("a relief: the model's name", r.name, "==", "relief"),
        check("a plaque", r.plan, "==", "plaque"),
        check("the picture as its texture", r.tex, "==", "picture"),
        check("on the front", r.sides, "==", "front"),
        check("its face about 80 mm wide, off by (mm)", Math.abs(r.face0 - 80), "<=", 1),
        check("10 mm front to back, off by (mm)", Math.abs(r.thickMM - 10), "<=", 0.1),
        check("Both: front and back", r.both, "==", "both"),
        check("Circle: round", r.round, "==", "circle"),
        check("Circle: the picture's width kept, off by (mm)", Math.abs(r.face1 - r.face0), "<=", 1),
        check("Undo: the plaque again", r.undone, "==", "plaque"),
        check("ready: every lap on the one below", +r.ready.some((x) => /^ok: Every lap sits on the one below/.test(x)), "==", 1),
        check("G-code exported (characters)", r.gcode, ">", 10000),
        check("the file named for a relief", +/^relief/.test(r.file || ""), "==", 1),
        check("the lean from the overhang a bead holds: 0.9 × 0.28 ÷ 0.3, off by", Math.abs(r.slope0 - 0.84), "<=", 0.01),
        check("Overhang 0.15 mm: the lean follows (0.9 × 0.15 ÷ 0.3), off by", Math.abs(r.slope1 - 0.45), "<=", 0.01),
        check("Overhang 0.15 mm: every lap still on the one below", +r.ready1.some((x) => /^ok: Every lap sits on the one below \(within 0\.15/.test(x)), "==", 1),
        check("Text: the button hidden", +hidden, "==", 1),
        check("page errors", errors.length, "==", 0),
      ],
      notes: `face ${r.face0 && r.face0.toFixed(1)} → ${r.face1 && r.face1.toFixed(1)} mm; ${r.ready.join(" | ")}${errors.length ? "  \nerrors: " + errors.join(" | ") : ""}`,
    };
    await close();
    return res;
  },
};
