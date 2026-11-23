const A = require("../lib/app.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A68", title: "Ready for an agent: a picture from a link, a done signal, status() as data, readouts that say what they are",
  guards: "an agent (or a person) unable to load a picture from a link, guessing when the app has finished, misreading a choice from a screenshot, or acting on an export message for a design that has since changed",
  why: "The first agent trial (23 November 2026, docs/AGENT-TRIAL.md) took the Polimeks logo from a link to G-code by pointing and clicking. It had to load the picture with a script (no link import; an SVG with only a viewBox came in at the wrong size), caught the page half-built, couldn't tell Centerline from Outline in a screenshot, wondered why the print shrank to 58 mm, and saw the last export's message after the design had changed.",
  how: "Opens the app with ?src= pointing at a test logo (an SVG with only a viewBox: a bold P with a thin grey ring over a bold word), waits on window.unbroken.whenReady(), and reads body data-state, the picture's shape, status() and the ready list. Exports G-code, changes the width and reads the message again. Opens a second page and loads the same logo through the Picture card's link box. Checks the corner label is a live region, Optimize tracing is at the top of the Fit card, the preview box says what it measures, and From above turns the 3D view straight down.",
  pass: "data-state goes to ready; the picture keeps the SVG's 340 : 146 shape and is 1600 px wide; status() gives the trace (terms, error, style centerline), the size the app picked and the ready list as data; the ready list says the size was picked for you until a width is typed; the export message clears when the width changes; the link box loads the same picture; the corner label has role status and aria-live; #optBtn sits at the top of the Fit card; From above sets the 3D view to look straight down; no page errors.",
  async run(ctx) {
    const src = ctx.server.url + "/source/tests/lib/fixtures/mark-and-word.svg";
    const { page, errors, close } = await A.open(ctx, { url: ctx.url + "?src=" + encodeURIComponent(src), clean: true });
    const s = await page.evaluate(() => window.unbroken.whenReady());
    const shape = await page.evaluate(() => [st.source.width, st.source.height]);
    const picked = s.ready.some((r) => /Size picked for you: medium detail/.test(r.text));
    const live = await page.$eval("#chip", (c) => c.getAttribute("role") + " " + c.getAttribute("aria-live"));
    const optInTracing = await page.$eval("#optBtn", (b) => !!b.closest("section.card") && b.closest("section.card").querySelector("h2").id === "h-fit" && !(b.closest(".inline").previousElementSibling || { matches: () => false }).matches(".row, .readouts, canvas"));
    await page.click("label[for=viewChoc]");
    await page.evaluate(() => window.unbroken.whenReady());
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#gcodeBtn")]);
    await A.idle(page, 300);
    const msg1 = await page.textContent("#gcodeMsg");
    await A.setValue(page, "#outW", "80", "change");
    const s2 = await page.evaluate(() => window.unbroken.whenReady());
    const msg2 = (await page.textContent("#gcodeMsg")).trim();
    await page.evaluate(() => { $("pvAbove").checked = true; $("pvAbove").dispatchEvent(new Event("change")); });
    const above = await page.evaluate(() => [stackTurn.az, +stackTurn.el.toFixed(4)]);
    // the link box, on a fresh page
    const two = await A.open(ctx, { clean: true, art: true });
    await two.page.fill("#picUrl", src);
    await two.page.click("#picUrlGo");
    const s3 = await two.page.evaluate(() => window.unbroken.whenReady());
    const res = {
      checks: [
        check("body data-state after the trace", s.state, "==", "ready"),
        check("picture width from the SVG (px)", shape[0], "==", 1600),
        check("picture shape kept (width ÷ height × 1000)", Math.round((1000 * shape[0]) / shape[1]), "==", Math.round((1000 * 340) / 146)),
        check("status(): terms", s.trace ? s.trace.terms : 0, ">", 10),
        check("status(): trace style is centerline", +(s.trace && s.trace.style === "centerline"), "==", 1),
        check("status(): the size the app picked", s.size && s.size.pickedByApp ? s.size.pickedByApp.widthMM : 0, ">", 0),
        check("ready list: says the size was picked for you", +picked, "==", 1),
        check("after typing a width: no longer picked by the app", +(s2.size.pickedByApp === null && !s2.ready.some((r) => /picked for you/.test(r.text))), "==", 1),
        check("export message names the file", +/Exported .*gcode\.zip/.test(msg1), "==", 1),
        check("export message cleared once the width changed", msg2.length, "==", 0),
        check("corner label is a live region", live, "==", "status polite"),
        check("Optimize tracing at the top of the Fit card", +optInTracing, "==", 1),
        check("From above: looking straight down (tilt, rad)", above[1], "==", +(Math.PI / 2).toFixed(4)),
        check("link box: the same picture loaded", s3.source, "==", "mark-and-word.svg"),
        check("page errors", errors.length + two.errors.length, "==", 0),
      ],
      notes: `status: ${JSON.stringify(s.trace)} · ${JSON.stringify(s.size)}${errors.length ? "  \nerrors: " + errors.join(" | ") : ""}`,
    };
    await two.close();
    await close();
    return res;
  },
};
