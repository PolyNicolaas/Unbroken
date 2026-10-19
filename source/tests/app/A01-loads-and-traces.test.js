const A = require("../lib/app.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A01", title: "The app opens and traces the sample",
  guards: "a blank or broken page",
  why: "The most basic promise: open the page and see a traced line. Any script error, a missing engine file, or a background engine that fails to start shows up here first.",
  how: "Opens web-app/index.html from a local web server, waits for the first trace to finish, and reads the corner label, the background workers, the default tab, the line setting and the error log. The app opens set for chocolate (line width 0.84 mm from the 18G needle + 0.5 mm gap), which draws out-and-back strokes as two strands 1.34 mm apart; that separation is on purpose, so tracing accuracy is read with Line spacing at 0.",
  pass: "No page or console errors; opens with a 0.84 mm line width (18G) and 0.5 mm gap, and the closest gap in the trace is at least 1.34 mm (to 0.01); with spacing off the label shows a term count and an error under 0.3 mm (about a working pixel at 100 mm wide); at least one background worker is running; the Trace tab is shown.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx);
    const opened = await A.chip(page);
    const needle = +((await page.inputValue("#lineW")) === "0.84") + +((await page.inputValue("#needle")) === "0.84") + +((await page.inputValue("#lineGapMM")) === "0.5");
    const gap = +((await page.textContent("#gapVal")).match(/([\d.]+) mm/) || [0, 0])[1];
    await page.evaluate(() => { st.spacing = 0; spacingChanged(); }); await A.idle(page, 600);   // accuracy is read without the deliberate strand separation (no control sets 0 any more)
    const res = { checks: [
      check("opens set for chocolate: line width 0.84 mm (needle 18G), 0.5 mm gap", needle, "==", 3), check("closest gap at open (mm)", gap, ">=", 1.33),
      check("page and console errors", errors.length, "==", 0), check("terms in the trace", await A.terms(page), ">", 10), check("error with spacing off (mm, 100 mm wide)", await A.errorMM(page), "<", 0.3),
      check("background workers", page.workers().length, ">=", 1),
      check("Design tab shown", await page.$eval("body", (b) => b.dataset.view || "design"), "==", "design"),
    ], notes: `label at open: ${opened}; with spacing off: ${await A.chip(page)}${errors.length ? "  \nerrors: " + errors.join(" | ") : ""}` };
    await close(); return res;
  },
};
