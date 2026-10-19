const A = require("../lib/app.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A13", title: "One size slider: never below the smallest that fits, marks for detail, bigger prints traced finer",
  guards: "a print sized below what the needle can keep apart, marks out of order or in the wrong place, typed sizes slipping under the minimum, and big prints traced no finer than small ones",
  why: "The print size and the detail it can hold are tied together: the needle and gap set how close lines may run, so a small print loses fine detail and a bigger one keeps more. One slider makes that a single move. Its low end is the smallest size where the finished line (strands, stroke-end loops) keeps the spacing; marks show where medium and high detail start; the far end is the widest that fits on the plate. A bigger print is also traced from the image at a finer resolution, so it really gains detail.",
  how: "Opens the app (leaf sample, 18G needle + 0.5 mm gap) and waits for the size marks. Reads the marks and the opening size; drags the slider far up and checks the width, the working resolution and the spacing; types 5 mm and checks it lands on the smallest; clicks the high-detail mark; checks the hint and that there are no page errors. Repeats the first checks at phone width, where the mark labels must not run into each other (the marks take turns below and above the track).",
  pass: "Marks in order smallest < medium < high < plate, left to right; opens on the medium mark; the slider far up gives a print over 80 mm, traced finer than the base resolution, with no crossings or tight spots; typing 5 mm gives the smallest; clicking high gives the high width; marks alternate below and above the track, labels in a row don't overlap and none sits on the slider, at both widths; no page errors.",
  async run(ctx) {
    const checks = [];
    const marks = (page) => page.$$eval("#sizeMarks span", (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { label: e.textContent.split("\n")[0], w: +e.dataset.w, x0: r.left, x1: r.right, mid: (r.left + r.right) / 2, up: e.classList.contains("up"), y0: r.top, y1: r.bottom }; }));
    const width = async (page) => +(await page.inputValue("#outW"));
    const idle = async (page) => { for (let i = 0; i < 6; i++) { await A.idle(page, 300); if (!/finding/.test(await page.textContent("#sizeInfo"))) break; } };
    for (const vp of [{ width: 1300, height: 1000 }, { width: 390, height: 844 }]) {
      const { page, errors, close } = await A.open(ctx, { viewport: vp }), tag = `${vp.width} px`;
      await idle(page);
      const m = await marks(page), lab = m.map((x) => x.label).join(",");
      checks.push(check(`${tag}: marks are smallest, medium, high, plate`, +(lab === "smallest,medium,high,plate"), "==", 1));
      checks.push(check(`${tag}: marks grow left to right (in width and position)`, +m.every((x, i) => !i || (x.w > m[i - 1].w && x.mid > m[i - 1].mid)), "==", 1));
      // the marks take turns below and above the track; labels in the same row must not overlap, and none may sit on
      // the slider itself
      const row = (up) => m.filter((x) => x.up === up), sl = await page.$eval("#sizeSlider", (e) => { const r = e.getBoundingClientRect(); return { y0: r.top, y1: r.bottom }; });
      const overlap = (r) => Math.max(0, ...r.slice(1).map((x, i) => r[i].x1 - x.x0));
      checks.push(check(`${tag}: marks alternate below and above the track`, +m.every((x, i) => x.up === (i % 2 === 1)), "==", 1));
      checks.push(check(`${tag}: mark labels in the same row don't overlap (px)`, Math.max(overlap(row(false)), overlap(row(true))), "<=", 0));
      checks.push(check(`${tag}: no mark label on the slider (px)`, Math.max(0, ...m.map((x) => (x.up ? x.y1 - sl.y0 : sl.y1 - x.y0))), "<=", 1));
      const med = m.find((x) => x.label === "medium");
      checks.push(check(`${tag}: opens on the medium mark (mm difference)`, med ? Math.abs((await width(page)) - med.w) : 99, "<=", 0.1));
      if (vp.width > 1000) {
        const smallest = m[0].w, high = m.find((x) => x.label === "high").w;
        await A.setValue(page, "#sizeSlider", 760); await idle(page);
        const big = await width(page), res = await page.evaluate(() => st.resUsed), base = await page.evaluate(() => CFG.baseResolution);
        checks.push(check("slider far up: width (mm)", big, ">=", 80));
        checks.push(check("slider far up: traced finer than the base resolution (px)", res, ">", base));
        checks.push(check("slider far up: crossings and tight spots", await page.textContent("#probInfo"), "==", "none"));
        checks.push(check("slider far up: readout says how many times the smallest", +/×[\d.]+ smallest/.test(await page.textContent("#sizeInfo")), "==", 1));
        await page.fill("#outW", "5"); await page.press("#outW", "Enter"); await idle(page);
        checks.push(check("typed 5 mm: lands on the smallest (mm difference)", Math.abs((await width(page)) - smallest), "<=", 0.1));
        checks.push(check("at the smallest: crossings and tight spots", await page.textContent("#probInfo"), "==", "none"));
        await page.click("#sizeMarks span:nth-child(3)"); await idle(page);
        checks.push(check("clicked the high mark: width is the high width (mm difference)", Math.abs((await width(page)) - high), "<=", 0.1));
        checks.push(check("hint names the smallest size", +(await page.textContent("#sizeHint")).includes(`${smallest.toFixed(1)} mm`), "==", 1));
      }
      checks.push(check(`${tag}: page errors`, errors.length, "==", 0));
      await close();
    }
    return { checks };
  },
};
