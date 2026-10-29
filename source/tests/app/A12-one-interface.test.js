const A = require("../lib/app.js"), { check } = require("../lib/check.js");
const MAIN = ["#sens", "#autoSens", "#blur", "#modeCenter", "#lineW", "#lineGapMM", "#loopOpen", "#loose", "#corner", "#fitBtn", "#sizeSlider", "#outW", "#outH", "#optBtn", "#terms", "#crossBtn", "#laneBtn", "#minLen", "#far", "#invert", "#simplify", "#uncross"];
const PLOT = ["#paper", "#paperOrient", "#paperMargin", "#penW", "#pageView", "#exportBtn", "#smooth"];
const CHOC = ["#printer", "#printerSummary", "#chocolate", "#needle", "#limitPlate", "#layerTime", "#printHeightMM", "#layerCount", "#dxfBtn", "#stackView", "#copies", "#copyGap", "#plateRot", "#plateCenter", "#baseLayers", "#baseDensity", "#basePattern", "#fillDensity", "#fillPattern", "#gcodeBtn"], CHOC_MORE = ["#layerH", "#gFeed", "#gZ", "#gLift", "#gOx", "#gOy", "#gE", "#tuneReset"];
const MORE = { "card-h-prep": ["#bright", "#contrast", "#bgTol", "#flatten"] };
const MORE_2D = {};
const FILLS = ["#showShapes", "#gapClose", "#minShape", "#addPen", "#autoColour"];
const folded = (page, id) => page.$eval("#" + id, (e) => e.classList.contains("collapsed"));
const nested = (page) => page.$$eval(".panel section.card details", (d) => d.length);
module.exports = {
  id: "A12", title: "One interface: every control on its tab, less-used cards start folded, one level only",
  guards: "a control that can't be reached, a 'More…' group that doesn't open, a panel wider than its card on a phone, and a Simple / Advanced switch coming back",
  why: "There is one interface (Simple / Advanced was removed in October 2026): each tab shows all its controls, with the less-used ones folded into 'More…' groups so the panel stays readable, and the explanations on the page under the controls they explain.",
  how: "Opens the app at desktop and phone widths: no level switch; the main controls of each tab visible; the Input card reads top to bottom; Save / Open in a File menu that opens and closes like View; connector jumps in the readout; explanations behind ⓘ on the Trace tab; warnings visible; Image prep, Shading and Fine-tuning start folded and open to their controls; the 3D tab's cards in order; no menus inside cards; on a phone, every card open, nothing wider than its card.",
  pass: "No level switch; every listed control visible on its tab; each folded card opens to all its controls; ⓘ explanations and warnings on the page; no details menus inside cards; on a phone nothing is wider than its card; no page errors.",
  async run(ctx) {
    const checks = [];
    const visible = (page, sel) => page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (!e.checkVisibility || e.checkVisibility({ visibilityProperty: true })); });   // checkVisibility: also false inside a closed menu or group
    const count = async (page, sels) => { let n = 0; for (const s of sels) n += +(await visible(page, s)); return n; };
    for (const vp of [{ width: 1300, height: 1000 }, { width: 390, height: 844 }]) {
      const { page, errors, close } = await A.open(ctx, { viewport: vp }), w = vp.width;
      checks.push(check(`${w} px: no Simple / Advanced switch`, (await page.$$("#lvlAdv, #lvlSimple, [name=level]")).length, "==", 0));
      if (w < 900) {   // a phone's pinned preview tucks its edit tools away; Bigger shows them (v108)
        checks.push(check(`${w} px: the pinned preview tucks the edit tools away`, +!(await visible(page, "#crossBtn")), "==", 1));
        await page.click("#pvSize"); await page.waitForTimeout(200);
      }
      checks.push(check(`${w} px Trace: main controls visible`, await count(page, MAIN), "==", MAIN.length));
      if (w > 1000) {
        checks.push(check("Trace: no px anywhere on the panel (readouts in mm)", +!/\d\s?px\b/.test(await page.evaluate(() => document.querySelector(".panel").innerText + document.getElementById("chip").innerText)), "==", 1));
        const order = ["label[for=modeCenter]", "#sens", "#blur", "#lineW", "label[for=loopOpen]", "#sizeSlider", "#terms", "#optBtn"];
        const tops = []; for (const s of order) tops.push(await page.$eval(s, (e) => e.getBoundingClientRect().top));
        checks.push(check("Line step in order: Tracing, Line, Size, Fit", +tops.every((t, i) => i === 0 || t > tops[i - 1]), "==", 1));
        checks.push(check("explanations behind ⓘ on the Trace tab", await page.$$eval(".card.design-only button.info", (els) => els.filter((e) => e.getBoundingClientRect().height > 0).length), ">", 3));
        checks.push(check("Save / Open folded into the File menu", +!(await visible(page, "#saveDesign")) + +(await visible(page, "#fileMenu summary")), "==", 2));
        await page.click("#fileMenu summary"); await page.waitForTimeout(100);
        await page.click("#viewMenu summary"); await page.waitForTimeout(100);
        checks.push(check("View menu holds the settings Wheel, Collapse all and Expand all", await count(page, ["#wheel", "#collapseAll", "#expandAll"]), "==", 3));
        await page.keyboard.press("Escape"); await page.click("#fileMenu summary"); await page.waitForTimeout(100);
        checks.push(check("File menu opens to Save and Open", await count(page, ["#saveDesign", "#openDesign"]), "==", 2));
        await page.click("#viewMenu summary"); await page.waitForTimeout(100);
        checks.push(check("opening View closes File", +!(await page.$eval("#fileMenu", (e) => e.open)), "==", 1));
        await page.keyboard.press("Escape"); await page.click("#fileMenu summary"); await page.keyboard.press("Escape"); await page.waitForTimeout(100);
        checks.push(check("Esc closes File", +!(await page.$eval("#fileMenu", (e) => e.open)), "==", 1));
        await A.source(page, "text"); await page.click("label[for=viewDesign]"); await A.idle(page, 800);
        checks.push(check("text: no Tracing card (style, threshold); letter height and editable size in the Size card", +!(await visible(page, "#modeCenter")) + +!(await visible(page, "#sens")) + +(await visible(page, "#capH")) + +!(await page.$eval("#outW", (e) => e.readOnly)), "==", 4));
        checks.push(check("text: readout counts the connectors", +/\d+ terms · error [\d.]+ mm · \d+ connectors?/.test(await page.textContent("#chip")), "==", 1));
        checks.push(check("text: readout tip says connectors are always drawn", +/always drawn/i.test(await page.$eval("#chip", (e) => e.title)), "==", 1));
        await A.source(page, "picture"); await A.idle(page, 800);
        checks.push(check("leaf: no connectors, none mentioned", +!/connector/.test(await page.textContent("#chip")), "==", 1));
        await page.$eval("#spacingHint", (e) => { e.className = "hint warn"; e.textContent = "test warning"; });
        checks.push(check("warnings visible", +(await visible(page, "#spacingHint")), "==", 1));
        await page.click("label[for=viewArt]"); await A.idle(page, 300); // (Image prep is on the Art step since v113)
        for (const [id, sels] of Object.entries(MORE)) {
          checks.push(check(`${id} starts folded`, +(await folded(page, id)), "==", 1));
          await page.click(`#${id} .card-toggle`); await page.waitForTimeout(100);
          checks.push(check(`${id} opens to its controls`, await count(page, sels), "==", sels.length));
        }
        await A.plot(page); await page.waitForTimeout(200);
        checks.push(check("2D: paper, pen, page, export and smoothing visible", await count(page, PLOT), "==", PLOT.length));
        for (const [id, sels] of Object.entries(MORE_2D)) {
          checks.push(check(`2D: ${id} starts folded`, +(await folded(page, id)), "==", 1));
          await page.click(`#${id} .card-toggle`); await page.waitForTimeout(100);
          checks.push(check(`2D: ${id} opens to its controls`, await count(page, sels), "==", sels.length));
        }
        checks.push(check("2D: Fills card open with its controls", await count(page, FILLS), "==", FILLS.length));
        checks.push(check("2D: SVG only (no format menu, no DXF)", (await page.$$("#format")).length, "==", 0));
        checks.push(check("2D: no Trace or 3D controls showing", +!(await visible(page, "#sens")) + +!(await visible(page, "#gcodeBtn")), "==", 2));
        await A.print(page); await page.waitForTimeout(200);
        checks.push(check("3D: main controls visible", await count(page, CHOC), "==", CHOC.length));
        await page.click("label[for=stPlate]"); await page.waitForTimeout(200);
        checks.push(check("big view: Plate shows the plate, not the layers", +(await visible(page, "#plate")) + +!(await visible(page, "#stackView")), "==", 2));
        checks.push(check("big view on Print: only Plate and 3D layers to pick", +(await visible(page, "label[for=stPlate]")) + +(await visible(page, "label[for=stLayers]")) + +!(await visible(page, "label[for=stLine]")) + +!(await visible(page, "label[for=stPage]")), "==", 4));
        await page.click("label[for=viewDesign]"); await page.waitForTimeout(200);
        checks.push(check("big view follows the step: Line shows the line, with its tools and mini-map, no view tabs", +(await visible(page, "#view")) + +(await visible(page, "#selectBtn")) + +!(await visible(page, "#plate")) + +!(await visible(page, ".stage-tabs")), "==", 4));
        await A.print(page); await page.click("label[for=stLayers]"); await page.waitForTimeout(200);
        checks.push(check("3D: cards that fold", await page.$$eval("section.card.choc-only .card-toggle", (b) => b.map((x) => x.querySelector(".t").textContent).join(",")), "==", "Printer,Printer profile,Plate,Layers,Base,Infill,Fine-tuning,Test print,Export"));
        checks.push(check("one level of folding: no menus inside cards", await nested(page), "==", 0));
        checks.push(check("3D: Fine-tuning starts folded", +(await folded(page, "card-h-machine")), "==", 1));
        await page.click("#card-h-machine .card-toggle"); await page.waitForTimeout(100);
        checks.push(check("3D: Fine-tuning opens to its controls", await count(page, CHOC_MORE), "==", CHOC_MORE.length));
      }
      if (w < 500) {
        checks.push(check("phone: plate mini-map width (px)", await page.$eval("#minimap", (e) => Math.round(e.getBoundingClientRect().width)), "<=", 100));
        for (const v of ["viewDesign", "view2D", "viewChoc"]) {                     // every group open, nothing wider than its card
          if (v === "view2D") await A.plot(page); else if (v === "viewChoc") await A.print(page); else await page.click(`label[for=${v}]`);
          await page.evaluate(() => document.querySelectorAll("section.card.collapsed .card-toggle").forEach((b) => b.click())); await page.waitForTimeout(200);
          const over = await page.evaluate(() => [...document.querySelectorAll("section.card")].filter((c) => c.offsetParent).reduce((m, c) => { const b = c.querySelector(".card-body"); return Math.max(m, b.scrollWidth - b.clientWidth); }, 0));
          checks.push(check(`${w} px ${{ viewChoc: "3D", view2D: "2D" }[v] || "Trace"}, all groups open: px wider than the card`, over, "==", 0));
        }
      }
      checks.push(check(`${w} px: page errors`, errors.length, "==", 0));
      await close();
    }
    return { checks };
  },
};
