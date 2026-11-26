const A = require("../lib/app.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A74", title: "Fixes from making a relief, a vase, a pattern and text on an iPad-sized screen",
  guards: "a relief's note saying dark parts stand out whatever the Direction, Make a relief only on the Line step, a relief called a vase (the 3D model switch, the Input card), a font style tab that leaves the font as it was, and the size jumping with no word when a font or a pattern style needs it",
  why: "Nicolaas (25 November 2026), after a walkthrough of the app in its own browser.",
  how: "Opens mark-and-word.svg; taps Make a relief on the Input card; reads the Direction's words, the 3D model switch and the Input card's name; picks In, then Both. Then Text: types Chocolate at 12 mm, taps the Script tab. Then Pattern: Labyrinth, then Spirograph.",
  pass: "Make a relief makes one; the Direction says standing out, then pressed in, then mid-grey on the wall; the switch says A relief and the Input card says relief. The Script tab picks a script font; the letters raised to their smallest size bring a note saying so. Spirograph's new width brings a note with both widths. No page errors.",
  async run(ctx) {
    const src = ctx.server.url + "/source/tests/lib/fixtures/mark-and-word.svg";
    const { page, errors, close } = await A.open(ctx, { clean: true, art: true });
    // every toast shown, in order
    await page.evaluate(() => { window.__toasts = []; const t0 = window.toast; window.toast = (t, b, ms) => { window.__toasts.push(t); return t0(t, b, ms); }; });
    const r = await page.evaluate(async (src) => {
      const U = window.unbroken, o = {}, wait = (ms) => new Promise((r) => setTimeout(r, ms));
      await U.open(src);
      $("reliefMake").click();
      await wait(800); await U.whenReady();
      o.name = st.model && st.model.name;
      o.noteOut = $("vtDirVal").textContent;
      o.sw = $("mfVase").nextElementSibling.textContent;
      o.input = $("inputVal").textContent;
      $("vtDirIn").click(); await wait(300); await U.whenReady();
      o.noteIn = $("vtDirVal").textContent;
      $("vtDirBoth").click(); await wait(300); await U.whenReady();
      o.noteBoth = $("vtDirVal").textContent;
      // Text, small letters, then the Script tab
      $("srcText").click(); $("srcText").dispatchEvent(new Event("change", { bubbles: true })); await wait(600); await U.whenReady();
      $("font").value = "sans"; $("font").dispatchEvent(new Event("change", { bubbles: true }));
      $("textIn").value = "Chocolate"; $("textIn").dispatchEvent(new Event("input", { bubbles: true }));
      $("capH").value = "12"; $("capH").dispatchEvent(new Event("input", { bubbles: true }));
      await wait(800); await U.whenReady();
      window.__toasts.length = 0;
      $("fsHand").click(); await wait(800); await U.whenReady();
      o.font = $("font").value; o.style = UNB_FONTS[o.font].style;
      o.textToasts = window.__toasts.slice();
      // Pattern: Labyrinth, then Spirograph
      $("srcPattern").click(); $("srcPattern").dispatchEvent(new Event("change", { bubbles: true })); await wait(800); await U.whenReady();
      $("artStyle").value = "labyrinth"; $("artStyle").dispatchEvent(new Event("change", { bubbles: true })); await wait(1200); await U.whenReady();
      window.__toasts.length = 0;
      $("artStyle").value = "spirograph"; $("artStyle").dispatchEvent(new Event("change", { bubbles: true })); await wait(1500); await U.whenReady(); await wait(1500);
      o.patToasts = window.__toasts.slice();
      return o;
    }, src);
    const checks = [
      check("Make a relief (the Input card) makes a relief", +(r.name === "relief"), "==", 1),
      check("Out: the note says standing out", +/^standing out/.test(r.noteOut), "==", 1),
      check("the 3D model switch says A relief", +(r.sw === "A relief"), "==", 1),
      check("the Input card names the relief", +(r.input === "relief"), "==", 1),
      check("In: the note says pressed in", +/^pressed in/.test(r.noteIn), "==", 1),
      check("Both: the note says mid-grey on the wall", +/mid-grey on the wall/.test(r.noteBoth), "==", 1),
      check("the Script tab picks a script font", +(r.style === "hand"), "==", 1),
      check("letters raised: a note says so", +r.textToasts.some((t) => /Letters made bigger/.test(t)), "==", 1),
      check("Spirograph's new width: a note with both widths", +r.patToasts.some((t) => /mm wide \(was \d+\)/.test(t)), "==", 1),
      check("page errors", errors.length, "==", 0),
    ];
    await close();
    return { checks, notes: [`font ${r.font}; text: ${r.textToasts.join(" | ")}; pattern: ${r.patToasts.join(" | ")}`] };
  },
};
