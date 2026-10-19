const A = require("../lib/app.js"), { check } = require("../lib/check.js"), fs = require("fs");
module.exports = {
  slow: true,
  id: "A15", title: "2D tab: the pen line on the page, SVG for Saxi (and the DXF for choc OS on the 3D tab)",
  guards: "a pen file that still carries the chocolate's doubled strands and stroke-end loops, a page that doesn't match the paper chosen, a drawing off the page, and a missing too-big warning",
  why: "A pen plotter (the AxiDraw, run through Saxi) can lift and go over a line twice, so the 2D files should hold the traced drawing itself, not the version spread apart for a nozzle. Saxi plots the SVG at the size it says, so the page has to be the paper chosen, in mm, with the drawing where the preview shows it.",
  how: "Opens the app, sets the leaf to 60 mm and goes to the 2D tab. Measures how much of the pen line runs back over itself (points within 0.1 mm of a stretch of line at least 3 mm further along) against the same measure for the chocolate line. Picks US Letter portrait, exports the SVG and reads its page size and coordinates; exports the DXF for choc OS from the 3D tab. Then picks A5 with 70 mm margins and reads the warning; a 40 × 40 mm custom paper (smaller than the drawing) and reads what the view frames; then the printer plate as the paper.",
  pass: "The pen line goes back over itself where the leaf's veins are (over 5% of its points) and the chocolate line doesn't (under 1%); the SVG page is 215.9 × 279.4 mm with a matching viewBox, one path, every point inside the margins; the DXF downloads as a zip holding one closed curve; A5 with 70 mm margins warns that it's too big; on paper smaller than the drawing the view frames the whole drawing and the paper, in the canvas's shape; Printer plate gives the plate's size, named in the note; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx), checks = [];
    const idle = () => A.idle(page, 300);
    await page.fill("#outW", "60"); await page.press("#outW", "Enter"); await idle();
    await page.click("label[for=view2D]"); await idle();
    const share = await page.evaluate(() => {
      // share of points within 0.1 mm of the line at least 3 mm of arc away: a line drawn back over itself
      const over = (x, y) => {
        const n = x.length, s = new Float64Array(n); for (let i = 1; i < n; i++) s[i] = s[i - 1] + Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]);
        let hit = 0;
        for (let i = 0; i < n; i += 2) {
          for (let j = 0; j < n - 1; j++) {
            if (s[j + 1] > s[i] - 3 && s[j] < s[i] + 3) continue;                         // this stretch of line is the point's own neighbourhood
            const ax = x[j], ay = y[j], dx = x[j + 1] - ax, dy = y[j + 1] - ay, L = dx * dx + dy * dy || 1e-12, t = Math.max(0, Math.min(1, ((x[i] - ax) * dx + (y[i] - ay) * dy) / L));
            if (Math.hypot(x[i] - ax - t * dx, y[i] - ay - t * dy) < 0.1) { hit++; break; }
          }
        }
        return hit / Math.ceil(n / 2);
      };
      const k = scale(), f = st.final, cx = Float64Array.from(f.re, (v) => v * k), cy = Float64Array.from(f.im, (v) => v * k), c = UNB.simplify(cx, cy, st.simplify, !st.open);
      return { pen: over(st.plot.x, st.plot.y), choc: over(c.x, c.y) };
    });
    checks.push(check("pen line: share of points going back over the line", share.pen, ">", 0.05), check("chocolate line: share of points going back over the line", share.choc, "<", 0.01));
    await page.selectOption("#paper", "letter"); await page.selectOption("#paperOrient", "portrait"); await page.waitForTimeout(300);
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#exportBtn")]);
    const svg = fs.readFileSync(await dl.path(), "utf8"), nums = (svg.match(/<path d="([^"]+)"/)[1].match(/-?[\d.]+/g) || []).map(Number);
    const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
    checks.push(check("SVG: file name", +(dl.suggestedFilename() === `${await page.evaluate(() => designSlug())}-plot.svg`), "==", 1));
    checks.push(check("SVG: page 215.9 × 279.4 mm, matching viewBox", +/width="215\.9mm" height="279\.4mm" viewBox="0 0 215\.9 279\.4"/.test(svg), "==", 1));
    checks.push(check("SVG: one path", (svg.match(/<path /g) || []).length, "==", 1));
    checks.push(check("SVG: points outside the 20 mm margins", xs.filter((v) => v < 20 || v > 195.9).length + ys.filter((v) => v < 20 || v > 259.4).length, "==", 0));
    await page.click("label[for=viewChoc]"); await page.waitForTimeout(300);
    const [dl2] = await Promise.all([page.waitForEvent("download"), page.click("#dxfBtn")]);
    const zip = fs.readFileSync(await dl2.path()), dxf = zip.toString("latin1");
    checks.push(check("3D tab, DXF for choc OS: zip with one closed curve", +(zip[0] === 0x50 && zip[1] === 0x4b && /\.zip$/.test(dl2.suggestedFilename()) && (dxf.match(/\nPOLYLINE\n/g) || []).length === 1 && /POLYLINE\n8\nTRACE\n66\n1\n70\n1\n/.test(dxf)), "==", 1));
    await page.click("label[for=view2D]"); await page.waitForTimeout(300);
    await page.selectOption("#paper", "a5"); await page.fill("#paperMargin", "70"); await page.waitForTimeout(300);
    checks.push(check("A5 with 70 mm margins: too-big warning", +/Too big/.test(await page.textContent("#pageHint")) && +(await page.$eval("#pageHint", (e) => e.classList.contains("warn"))), "==", 1));
    // a drawing bigger than the paper (60 mm on 40 × 40): the view takes in the whole drawing, hanging over the paper
    await page.selectOption("#paper", "custom"); for (const [id, v] of [["paperW", 40], ["paperH", 40], ["paperMargin", 0]]) { await page.fill("#" + id, String(v)); await page.dispatchEvent("#" + id, "input"); } await page.waitForTimeout(300);
    const fr = await page.evaluate(() => { const L = st.plot, o = placeOnPage(L), F = o.F, c = $("pageView");
      return { big: L.W > o.P.w || L.H > o.P.h, inside: F.x0 <= o.ox + 1e-6 && F.y0 <= o.oy + 1e-6 && F.x0 + F.w >= o.ox + L.W - 1e-6 && F.y0 + F.h >= o.oy + L.H - 1e-6, ar: c.width / c.height, far: F.w / F.h, paper: F.w >= o.P.w && F.h >= o.P.h }; });
    checks.push(check("drawing bigger than the paper: the view frames all of it and the paper", +(fr.big && fr.inside && fr.paper), "==", 1), check("… and the page canvas has the frame's shape (ratio off)", Math.abs(fr.ar / fr.far - 1), "<=", 0.02));
    await page.selectOption("#paper", "plate"); await page.fill("#paperMargin", "10"); await page.dispatchEvent("#paperMargin", "input"); await page.waitForTimeout(300);
    const plate = await page.evaluate(() => { const P = paperSize(), port = $("paperOrient").value === "portrait", a = Math.min(BED.w, BED.h), b = Math.max(BED.w, BED.h); return Math.abs(P.w - (port ? a : b)) + Math.abs(P.h - (port ? b : a)); });
    checks.push(check("Printer plate as the paper: the plate's size, in the chosen orientation (mm off)", plate, "<=", 1e-6),
      check("… named in the page note", +/Printer plate/.test(await page.textContent("#pageHint")), "==", 1));
    checks.push(check("page errors", errors.length, "==", 0));
    await close(); return { checks, notes: `back over itself: pen ${(share.pen * 100).toFixed(1)}%, chocolate ${(share.choc * 100).toFixed(1)}%` };
  },
};
