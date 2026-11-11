const A = require("../lib/app.js"), { check } = require("../lib/check.js");
const MAIN = ["#sens", "#autoSens", "#blur", "#modeCenter", "#lineW", "#lineGapMM", "#loopOpen", "#loose", "#corner", "#fitBtn", "#sizeSlider", "#outW", "#outH", "#optBtn", "#terms", "#crossBtn", "#laneBtn", "#minLen", "#far", "#invert", "#simplify", "#uncross"];
const PLOT = ["#paper", "#paperOrient", "#paperMargin", "#penW", "#pageView", "#exportBtn", "#smooth"];
const CHOC = ["#printer", "#printerSummary", "#chocolate", "#needle", "#limitPlate", "#layerTime", "#printHeightMM", "#layerCount", "#dxfBtn", "#stackView", "#copies", "#copyGap", "#plateRot", "#plateCenter", "#baseLayers", "#baseDensity", "#basePattern", "#fillDensity", "#fillPattern", "#gcodeBtn"], CHOC_MORE = ["#layerH", "#gFeed", "#gZ", "#gLift", "#gOx", "#gOy", "#gE", "#mapRecipeReset"];
const PREP = ["#bright", "#contrast", "#bgTol", "#flatten"];
const FILLS = ["#showShapes", "#gapClose", "#minShape", "#addPen", "#autoColour"];
const nested = (page) => page.$$eval(".panel section.card details", (d) => d.length);
module.exports = {
  id: "A12", title: "One interface: every control on a step of the map, one level only",
  guards: "a control no step of the map shows (the map shows one step's settings at a time, so a card no node holds can't be reached), a panel wider than its column on a phone, and a Simple / Advanced switch coming back",
  why: "There is one interface (Simple / Advanced was removed in October 2026; the step tabs in November 2026): the map of the steps shows one step's settings at a time, so every control has to be on some step, for a printer and for a pen plotter.",
  how: "Opens the leaf at desktop and phone widths: no level switch. Opens every step of the map in turn and notes which of the listed controls show: made for a printer (tracing, line, size, fit, the printer's, the plate's, the layers', fine-tuning, image prep) and for a pen plotter (paper, pens, fills, export, and the line's width and gap, which have no Material step there). Checks the File and View menus, the readout's connectors for a text, a warning showing, the Print step's two big views; on a phone, that no step's settings are wider than the panel.",
  pass: "No level switch; every listed control shows on some step, for a printer and for a pen plotter; Save and Open in the File menu, which closes when View opens and on Esc; a text's connectors counted in the readout, none for the leaf; warnings visible; the Print step offers Plate and 3D layers; no menus inside cards; on a phone nothing wider than the panel; no page errors.",
  async run(ctx) {
    const checks = [];
    const visible = (page, sel) => page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (!e.checkVisibility || e.checkVisibility({ visibilityProperty: true })); });   // checkVisibility: also false inside a closed menu or group
    const count = async (page, sels) => { let n = 0; for (const s of sels) n += +(await visible(page, s)); return n; };
    // every step of the map opened in turn: which of the controls never showed, and the widest overflow of the panel
    const tour = async (page, sels) => {
      const seen = new Set(); let over = 0;
      // (every node of the map now: a phone shows only the open step's chips, so one not on the band is opened directly)
      const ids = await page.evaluate(() => { const S = mapShape(); return [...S.spine, ...Object.values(S.up).flat(), ...Object.values(S.down).flat()].filter((id) => id !== "examples"); });
      for (const id of ids) {
        if (await page.$(`#mapNodes [data-node="${id}"]`)) await page.click(`#mapNodes [data-node="${id}"]`);
        else await page.evaluate((n) => mapOpen(n), id);
        await A.idle(page, 600);
        for (const s of sels) if (await visible(page, s)) seen.add(s);
        over = Math.max(over, await page.evaluate(() => { const p = document.querySelector(".panel"); return [...p.querySelectorAll("section.card, .map-rows")].filter((c) => c.getClientRects().length).reduce((m, c) => Math.max(m, c.scrollWidth - c.clientWidth), 0); }));
      }
      return { missing: sels.filter((s) => !seen.has(s)).join(" "), over };
    };
    for (const vp of [{ width: 1300, height: 1000 }, { width: 1024, height: 768 }]) {
      const { page, errors, close } = await A.open(ctx, { viewport: vp }), w = vp.width;
      checks.push(check(`${w} px: no Simple / Advanced switch`, (await page.$$("#lvlAdv, #lvlSimple, [name=level]")).length, "==", 0));
      if (w < 900) {   // a phone's pinned preview tucks its edit tools away; Bigger shows them (v108)
        checks.push(check(`${w} px: the pinned preview tucks the edit tools away`, +!(await visible(page, "#crossBtn")), "==", 1));
        await page.click("#pvSize"); await page.waitForTimeout(200);
      }
      const P = await tour(page, [...MAIN, ...CHOC, ...CHOC_MORE, ...PREP]);
      checks.push(check(`${w} px, a printer: controls no step shows`, P.missing, "==", ""));
      checks.push(check(`${w} px, a printer: px wider than the panel, any step`, P.over, "==", 0));
      if (w > 1000) {
        await page.click("label[for=viewDesign]"); await A.idle(page, 300);
        checks.push(check("Line: no px anywhere on the panel (readouts in mm)", +!/\d\s?px\b/.test(await page.evaluate(() => document.querySelector(".panel").innerText + document.getElementById("chip").innerText)), "==", 1));
        checks.push(check("explanations behind ⓘ on the Line step", await page.$$eval(".card.design-only button.info", (els) => els.filter((e) => e.getBoundingClientRect().height > 0).length), ">", 3));
        checks.push(check("Save / Open folded into the File menu", +!(await visible(page, "#saveDesign")) + +(await visible(page, "#fileMenu summary")), "==", 2));
        await page.click("#fileMenu summary"); await page.waitForTimeout(100);
        checks.push(check("File menu opens to Save and Open", await count(page, ["#saveDesign", "#openDesign"]), "==", 2));
        await page.click("#viewMenu summary"); await page.waitForTimeout(100);
        checks.push(check("opening View closes File", +!(await page.$eval("#fileMenu", (e) => e.open)), "==", 1));
        await page.keyboard.press("Escape"); await page.click("#fileMenu summary"); await page.keyboard.press("Escape"); await page.waitForTimeout(100);
        checks.push(check("Esc closes File", +!(await page.$eval("#fileMenu", (e) => e.open)), "==", 1));
        await A.source(page, "text"); await page.click("label[for=viewDesign]"); await A.idle(page, 800);
        checks.push(check("text: no Tracing step (style, threshold)", +!(await page.$('[data-node="tracing"]')), "==", 1));
        await page.click('[data-node="size"]'); await A.idle(page, 300);
        checks.push(check("text: letter height and editable size on the Size step", +(await visible(page, "#capH")) + +!(await page.$eval("#outW", (e) => e.readOnly)), "==", 2));
        checks.push(check("text: readout counts the connectors", +/\d+ terms · error [\d.]+ mm · \d+ connectors?/.test(await page.textContent("#chip")), "==", 1));
        checks.push(check("text: readout tip says connectors are always drawn", +/always drawn/i.test(await page.$eval("#chip", (e) => e.title)), "==", 1));
        await A.source(page, "picture"); await A.idle(page, 800);
        checks.push(check("leaf: no connectors, none mentioned", +!/connector/.test(await page.textContent("#chip")), "==", 1));
        await page.click("label[for=viewDesign]"); await A.idle(page, 300);
        await page.$eval("#spacingHint", (e) => { e.className = "hint warn"; e.textContent = "test warning"; });
        checks.push(check("warnings visible", +(await visible(page, "#spacingHint")), "==", 1));
        await A.plot(page); await A.idle(page, 600);
        const Q = await tour(page, [...PLOT, ...FILLS, "#lineW", "#lineGapMM", "#sens", "#sizeSlider", "#terms"]);
        checks.push(check("a pen plotter: controls no step shows", Q.missing, "==", ""));
        checks.push(check("a pen plotter: SVG only (no format menu, no DXF)", (await page.$$("#format")).length, "==", 0));
        checks.push(check("a pen plotter: no Material or Print step", +!(await page.$('[data-node="material"], [data-node="print"]')), "==", 1));
        await A.print(page); await A.idle(page, 600);
        await page.click("label[for=stPlate]"); await page.waitForTimeout(200);
        checks.push(check("big view: Plate shows the plate, not the layers", +(await visible(page, "#plate")) + +!(await visible(page, "#stackView")), "==", 2));
        checks.push(check("big view on Print: only Plate and 3D layers to pick", +(await visible(page, "label[for=stPlate]")) + +(await visible(page, "label[for=stLayers]")) + +!(await visible(page, "label[for=stLine]")) + +!(await visible(page, "label[for=stPage]")), "==", 4));
        await page.click("label[for=viewDesign]"); await page.waitForTimeout(200);
        checks.push(check("big view follows the step: Line shows the line, with its tools and mini-map, no view tabs", +(await visible(page, "#view")) + +(await visible(page, "#selectBtn")) + +!(await visible(page, "#plate")) + +!(await visible(page, ".stage-tabs")), "==", 4));
        checks.push(check("one level: no menus inside cards", await nested(page), "==", 0));
      }
      if (w < 500) checks.push(check("phone: plate mini-map width (px)", await page.$eval("#minimap", (e) => Math.round(e.getBoundingClientRect().width)), "<=", 100));
      checks.push(check(`${w} px: page errors`, errors.length, "==", 0));
      await close();
    }
    return { checks };
  },
};
