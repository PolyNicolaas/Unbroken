const A = require("../lib/app.js"), { check } = require("../lib/check.js"), fs = require("fs"), path = require("path"), os = require("os");
module.exports = {
  id: "A58", title: "Lettering for a printer reads: every letter stroke a pair of strands, connectors along the baseline",
  guards: "two letters printed as one (ll as a single l), connectors across the tops and middles of letters, and a design in a removed font opening blank",
  why: "Traced text often didn't read (6 November 2026). The tracer drew some strokes only once, up one l, across the top and down the next, and two single strands a pair's width apart read as one letter: “Hello” printed as “Helo”. Connectors ran between the nearest points of two words, often at a letter's top or middle, closing an r into an a or putting a bar across a y. Seven fonts that printed hard to read were removed in v138 (Elfin, Nixish, Tech, Allure, Readability, Readability Italic, Osmotron).",
  how: "Types Hello world in Sans for a printer and reads the traced line: counts its strands across a level above the small letters (H, l, l: four strokes), and checks every connector point against the baseline. Opens a design saved in Elfin.",
  pass: "Eight strands across the H and the two l's (each stroke a pair); every connector point within the baseline band (plus a spacing); a pen plotter's Hello world traces too; the Elfin design opens in Sans with a note saying so; no page errors.",
  slow: true,
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx), checks = [];
    await page.evaluate(() => {
      window.__toasts = [];
      new MutationObserver(() => window.__toasts.push(document.getElementById("toast").textContent)).observe(document.getElementById("toast"), { childList: true, characterData: true, subtree: true });
    });
    await A.source(page, "text"); await A.idle(page);
    if (!(await page.isChecked("#artForPrint"))) { await page.click("label[for=artForPrint]"); await A.idle(page); }
    await page.selectOption("#font", "sans"); await A.idle(page);
    await page.fill("#textIn", "Hello world"); await page.dispatchEvent("#textIn", "input"); await A.idle(page); await A.idle(page);
    const r = await page.evaluate(() => {
      const T = st.text, c = st.crop, b = T.layout.baselines[0], f = st.final, F = st.jumpF, S = f.re.length;
      const base = ((b.y + T.margin) * T.ppm - c.sy) * c.ky, capPx = T.cap * T.ppm * c.ky;
      // strands crossing a level above the small letters, left of the word gap (Hello)
      const lvl = base - 0.85 * capPx, gapX = st.final.re.reduce((a, x) => Math.max(a, x), 0) * 0.5;
      let cross = 0;
      for (let s = 0; s < S; s++) {
        const y0 = f.im[s], y1 = f.im[(s + 1) % S], x = f.re[s];
        if ((y0 - lvl) * (y1 - lvl) < 0 && x < gapX) cross++;
      }
      const tol = CFG.rules.textLaneShare * capPx + spacingMM() / scale() + 2;
      let off = 0, n = 0;
      for (let s = 0; s < S; s++) if (F[s] && F[(s + 1) % S]) { n++; if (Math.abs(f.im[s] - base) > tol) off++; }
      return { cross, off, n };
    });
    checks.push(check("Hello: strands across H, l, l (two per stroke)", r.cross, "==", 8),
      check("connectors: points along the line", +(r.n > 0), "==", 1),
      check("connectors: points away from the baseline", r.off, "==", 0));
    // a pen plotter: the letters as the font draws them, still traced
    await page.click("label[for=artForPlot]"); await A.idle(page); await A.idle(page);
    checks.push(check("pen plotter: Hello world traced", await page.evaluate(() => +!!(st.final && st.final.re.length > 100)), "==", 1));
    await page.click("label[for=artForPrint]"); await A.idle(page);
    // a design saved in a font this version doesn't have
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "a58-"));
    await page.click("#fileMenu summary, details:has(#saveDesign) > summary").catch(() => {});
    const [d] = await Promise.all([page.waitForEvent("download"), page.evaluate(() => document.getElementById("saveDesign").click())]);
    const f = path.join(tmp, "elfin.unbroken.json"); await d.saveAs(f);
    const J = JSON.parse(fs.readFileSync(f, "utf8")); J.design.v.font = "elfin"; fs.writeFileSync(f, JSON.stringify(J));
    await page.selectOption("#font", "pebble"); await A.idle(page);
    await page.setInputFiles("#designFile", f); await A.idle(page); await A.idle(page);
    const toasts = await page.evaluate(() => window.__toasts.join(" | "));
    checks.push(check("Elfin design: opens in Sans", await page.inputValue("#font"), "==", "sans"),
      check("Elfin design: the note says so", +/elfin\) isn't in this version: set in Sans/.test(toasts), "==", 1),
      check("page errors", errors.length, "==", 0));
    await close();
    return { checks, notes: errors.join(" | ") };
  },
};
