const A = require("../lib/app.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A22", title: "The big view: the 2D page and the 3D layers, played, and the layers turned",
  guards: "fills and layers squeezed into the side panel, a big view that doesn't follow the tab, an animation that only works on the line, and a 3D view that can't be turned",
  why: "The 2D page (where fills are clicked) and the 3D layers are part of the big view, with tabs (Line, 2D page, Plate, 3D layers); each settings tab brings its view. Play drawing plays whichever view is showing: the circles drawing the line, the pen drawing the page and then the fills, or the needle stacking the layers. The layers can be turned by dragging.",
  how: "Opens the app (the leaf). Goes to the 2D tab and counts the inked pixels on the page; plays it at Fast and counts again partway and at the end. Goes to the 3D tab, waits for the layers and counts the drawn pixels; plays it partway and at the end. Drags across the layers and compares the picture; double-clicks and compares with the first.",
  pass: "Each tab brings its view (2D: 2D page, 3D: 3D layers, Trace: Line); partway through playing, the page and the layers show less than at the end (under 90%), and at the end as much as before (within 2%); dragging changes the layers' picture and a double-click brings the first one back; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx), checks = [];
    const stage = () => page.evaluate(() => document.body.dataset.stage);
    const ink = (sel) => page.$eval(sel, (c) => { const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0 && d[i] + d[i + 1] + d[i + 2] < 600) n++; return n; });
    const pic = (sel) => page.$eval(sel, (c) => c.toDataURL().length + ":" + c.toDataURL().slice(-200));
    const playPartway = async (sel) => {
      await page.selectOption("#speed", "4"); await page.click("#play"); await page.waitForTimeout(1300);
      const mid = await ink(sel); await page.waitForFunction(() => !st.playing, null, { timeout: 15000 }); await page.waitForTimeout(200);
      return [mid, await ink(sel)];
    };
    await A.plot(page); await A.idle(page, 300);
    await page.waitForFunction(() => st.plot, null, { timeout: 30000 }); await page.waitForTimeout(500);
    checks.push(check("2D tab brings the 2D page", +((await stage()) === "page"), "==", 1));
    const p0 = await ink("#pageView"), [pm, p1] = await playPartway("#pageView");
    checks.push(check("2D page: partway through playing, share of the ink", pm / p0, "<", 0.9), check("2D page: at the end, ink vs before (ratio)", Math.abs(p1 / p0 - 1), "<=", 0.02));
    await A.print(page);
    await page.waitForFunction(() => st.layers, null, { timeout: 60000 }); await page.waitForTimeout(800);
    checks.push(check("3D tab brings the 3D layers", +((await stage()) === "layers"), "==", 1));
    const s0 = await ink("#stackView"), [sm, s1] = await playPartway("#stackView");
    checks.push(check("3D layers: partway through playing, share of the drawing", sm / s0, "<", 0.9), check("3D layers: at the end, drawing vs before (ratio)", Math.abs(s1 / s0 - 1), "<=", 0.02));
    const before = await pic("#stackView"), box = await page.$eval("#stackView", (c) => { const r = c.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    await page.mouse.move(box[0], box[1]); await page.mouse.down(); await page.mouse.move(box[0] + 120, box[1] + 30, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(200);
    checks.push(check("dragging turns the layers (picture changed)", +((await pic("#stackView")) !== before), "==", 1));
    await page.dblclick("#stackView"); await page.waitForTimeout(200);
    checks.push(check("double-click turns them back (same picture)", +((await pic("#stackView")) === before), "==", 1));
    await page.click("label[for=viewDesign]"); await page.waitForTimeout(200);
    checks.push(check("Trace tab brings the line", +((await stage()) === "line"), "==", 1));
    checks.push(check("page errors", errors.length, "==", 0));
    await close(); return { checks, notes: `page ink ${p0} (partway ${pm}), layers ${s0} (partway ${sm})` };
  },
};
