const A = require("../lib/app.js"), { check } = require("../lib/check.js");
const spacing = (page) => page.evaluate(() => st.spacing);
const gap = async (page) => +((await page.textContent("#gapVal")).match(/([\d.]+) mm/) || [0, 0])[1];
const crossings = async (page) => +((await page.textContent("#uncrossVal")).split("→").pop());
module.exports = {
  id: "A03", title: "Line width, gap and needle settings hold in the trace",
  guards: "needle sizes and gaps not reaching the trace; the 3D tab's needle and the Trace tab's line width disagreeing",
  why: "The printer's needle (inside diameter) is the line width, and line width plus the gap between lines sets how far apart printed lines must be. The needle is picked on the 3D tab, the width and gap are on the Trace tab's Line card; they have to agree, turn into the right spacing, and the trace has to honour it, with no crossings.",
  how: "Steps through the 18G needle + 0.5 mm, 16G + 0.5 mm (picked on the 3D tab), 16G + 0.2 mm, and a typed 1.0 mm width + 0.2 mm, reading the line width box, the needle menu, the spacing, the closest gap in the trace and the crossings.",
  pass: "Picking a needle sets the line width to its diameter; typing a width no needle has shows Custom; spacing equals width + gap in every step (to 0.01 mm); the closest gap is at least 90% of it; zero crossings; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx), checks = [];
    const steps = [["18G + 0.5", null, null, null, 0.84 + 0.5], ["16G + 0.5", "1.19", null, null, 1.19 + 0.5], ["16G + 0.2", null, null, "0.2", 1.19 + 0.2], ["typed 1.0 + 0.2", null, "1.0", null, 1.2]];
    for (const [label, needle, width, gapMM, expect] of steps) {
      if (needle) {
        await A.print(page); await page.selectOption("#needle", needle); await page.click("label[for=viewDesign]");
        checks.push(check(`${label}: the needle sets the line width (mm)`, +(await page.inputValue("#lineW")), "==", +needle));
      }
      if (width) { await A.setValue(page, "#lineW", width); checks.push(check(`${label}: a width no needle has shows Custom`, +((await page.inputValue("#needle")) === "custom"), "==", 1)); }
      if (gapMM) await A.setValue(page, "#lineGapMM", gapMM);
      await A.idle(page, 500);
      checks.push(check(`${label}: spacing (mm)`, Math.abs((await spacing(page)) - expect), "<=", 0.01, 2), check(`${label}: closest gap ≥ 90% of spacing (mm)`, await gap(page), ">=", 0.9 * expect, 2), check(`${label}: crossings`, await crossings(page), "==", 0));
    }
    checks.push(check("page errors", errors.length, "==", 0));
    await close(); return { checks };
  },
};
