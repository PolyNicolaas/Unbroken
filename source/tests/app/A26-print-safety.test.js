const A = require("../lib/app.js"), { check } = require("../lib/check.js"), fs = require("fs"), path = require("path"), { execSync } = require("child_process");
module.exports = {
  id: "A26", title: "Print safety: a model's height doesn't follow you back, bad Fine-tuning boxes never reach the G-code, a typo in settings.js can't break the menus",
  guards: "a drawing printed as a tall tower after visiting a 3D model, a needle sent into the plate by an emptied First-layer Z, and a chocolate menu that stops working because of one quoted number in settings.js",
  why: "Found in the October 2026 review (REVIEW.md): the Height box kept a model's 40 mm and the height-leads logic read it (133 layers); Z, lift and speed went from the boxes straight into the G-code; and a chocolate's costPer100g written as a string threw during start-up, so the chocolate menu stopped switching.",
  how: "Opens the app, loads the sample model, goes to the 3D tab, back to Image, changes the chocolate and reads the layer count. Empties First-layer Z and sets Lift to −3, reads the ready list, exports G-code and reads its first printing move and its travel height. Then opens the app with costPer100g: \"2.50\" in settings.js and switches chocolate.",
  pass: "After the model the drawing is still 1 layer; with Z empty the ready list warns and the G-code's first layer is at the layer height (0.3), never Z 0, with travel at least 0.5 mm above it; the quoted price is named in the 3D tab, switching chocolate still changes the speed, and there are no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx), checks = [];
    const idle = () => A.idle(page, 300);
    await page.click("label[for=srcModel]"); await idle();
    await page.click("label[for=viewChoc]"); await idle();
    const modelH = +(await page.inputValue("#printHeightMM"));
    await page.click("label[for=viewDesign]"); await page.click("label[for=srcImage]"); await idle();
    await page.click("label[for=viewChoc]"); await idle();
    await page.selectOption("#chocolate", { index: 1 }); await idle();
    checks.push(check(`after a ${modelH} mm model: the drawing's layers`, await page.evaluate(() => st.layers.S.N + st.layers.S.M), "==", 1),
      check("… and the Height box shows the drawing's height (mm)", +(await page.inputValue("#printHeightMM")), "<", 1));
    await page.click("#card-h-machine .card-toggle");
    await page.fill("#gZ", ""); await page.dispatchEvent("#gZ", "input"); await A.setValue(page, "#gLift", -3); await idle();
    await page.evaluate(() => readyUI());
    checks.push(check("empty Z and negative lift: the ready list warns", +/out of range/.test(await page.textContent("#readyList")), "==", 1));
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#gcodeBtn")]);
    const gc = execSync(`unzip -p "${await dl.path()}"`, { maxBuffer: 1 << 28 }).toString(), body = gc.slice(gc.indexOf("M82 ; absolute E"));
    const down = [...body.matchAll(/^G1 Z([\d.]+) F600$/gm)].map((m) => +m[1]), up = [...body.matchAll(/^G0 Z([\d.]+) F3600$/gm)].map((m) => +m[1]);
    checks.push(check("G-code: first layer at the layer height, not 0 (mm)", down[0], "==", 0.3), check("G-code: travel at least 0.5 mm above it (mm)", up[0] - down[0], ">=", 0.5));
    checks.push(check("page errors", errors.length, "==", 0));
    await close();
    // a quoted number in settings.js: named, ignored, and the chocolate menu still switches
    const body2 = fs.readFileSync(path.resolve(__dirname, "../../../web-app/settings.js"), "utf8").replace("costPer100g: 2.50,", 'costPer100g: "2.50",');
    const c2 = await ctx.browser.newContext({ viewport: { width: 1300, height: 1000 } }), p2 = await c2.newPage(), e2 = [];
    p2.on("pageerror", (e) => e2.push(e.message));
    try {
      await p2.route("**/settings.js", (r) => r.fulfill({ contentType: "text/javascript", body: body2 }));
      await p2.goto(ctx.url); await A.idle(p2, 2500);
      await p2.click("label[for=viewChoc]");
      const i0 = await p2.textContent("#chocInfo"); await p2.selectOption("#chocolate", { index: 1 }); await A.idle(p2, 300);
      const info = await p2.textContent("#chocInfo");
      checks.push(check("quoted price: named in the 3D tab", +/costPer100g should be a number/.test(await p2.textContent("#settingsNote")), "==", 1),
        check("… chocolate menu still switches (its info changes)", +(info.length > 0 && info !== i0), "==", 1),
        check("… no page errors", e2.length, "==", 0));
    } finally { await c2.close(); }
    return { checks };
  },
};
