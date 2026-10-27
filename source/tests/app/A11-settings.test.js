const A = require("../lib/app.js"), { check } = require("../lib/check.js"), fs = require("fs"), path = require("path"), vm = require("vm");
function settings() { const sb = { window: {} }; vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../../../web-app/settings.js"), "utf8"), sb); return sb.window.UNB_SETTINGS; }
module.exports = {
  id: "A11", title: "The app follows settings.js, and survives a broken one",
  guards: "edited settings not reaching the app; a typo in settings.js breaking the app",
  why: "settings.js is where chocolates, needles, the printer and the starting defaults are edited. The app must show what the file says, apply a chocolate's print speed and needle when it's picked, and E per mm from the needle, and keep working (on built-in values, with a clear message) if the file has a mistake.",
  how: "Opens the app and compares the needle and chocolate menus, the default chocolate and its G-code feed with settings.js; checks E per mm against choc OS's for the 0.84 mm needle and that it scales with the needle; picks each chocolate in turn and checks the feed, line colour and details line; then serves a settings.js with a syntax error, one with a bad chocolate entry, and one with fourteen starting defaults and a rule changed.",
  pass: "Menus match the file; each chocolate sets feed = print speed × 60, changes the preview colour and shows its price per 100 g; with a broken file the app still traces, uses the built-in needles and says settings.js couldn't be read; a bad entry is skipped and named in the 3D tab; every changed default shows up on its control and the changed rule is followed; no other page errors.",
  async run(ctx) {
    const S = settings(), checks = [];
    const { page, errors, close } = await A.open(ctx);
    checks.push(check("needle menu entries (+ Custom)", (await page.$$("#needle option")).length, "==", S.needles.length + 1),
      check("chocolate menu entries", (await page.$$("#chocolate option")).length, "==", S.chocolates.length),
      check("default chocolate selected", await page.inputValue("#chocolate"), "==", S.defaults.chocolate));
    for (const c of S.chocolates) {
      const before = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--choc"));
      await A.print(page); await page.selectOption("#chocolate", c.id); await page.waitForTimeout(200);
      if (c.printSpeed) checks.push(check(`${c.id}: speed (mm/s)`, +(await page.inputValue("#gFeed")), "==", c.printSpeed));
      if (c.costPer100g != null) checks.push(check(`${c.id}: price shown`, +/per 100 g/.test(await page.textContent("#chocInfo")), "==", 1));
      const after = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--choc"));
      if (c.id !== S.defaults.chocolate) checks.push(check(`${c.id}: preview colour changed`, +(after !== before), "==", 1));
    }
    // E per mm follows the needle: needle × layer height ÷ cartridge area (choc OS: 0.84 mm, 0.3 mm → 0.000457)
    const eFor = async (id) => { await page.evaluate((i) => { selectNeedle(i); $("needle").dispatchEvent(new Event("change")); $("layerH").value = "0.3"; $("layerH").dispatchEvent(new Event("input")); }, id); await page.waitForTimeout(100); return +(await page.inputValue("#gE")); };
    const e18 = await eFor("18G"), e14 = await eFor("14G");
    checks.push(check("E per mm, 0.84 mm needle at 0.3 mm layers: off choc OS's 0.000457 by", Math.abs(e18 - 0.000457), "<=", 0.000003), check("a 1.54 mm needle: E ratio off 1.54 ÷ 0.84 by", Math.abs(e14 / e18 - 1.54 / 0.84), "<=", 0.02));
    checks.push(check("page errors", errors.length, "==", 0)); await close();
    // a settings.js with a syntax error
    const ctxB = await ctx.browser.newContext({ viewport: { width: 1300, height: 1000 } }), pb = await ctxB.newPage(), errsB = [];
    pb.on("pageerror", (e) => errsB.push(e.message));
    await pb.route("**/settings.js", (r) => r.fulfill({ contentType: "text/javascript", body: "window.UNB_SETTINGS = { chocolates: [ { id: 'x' name: 'oops' } ] };" }));
    await pb.goto(ctx.url); await A.idle(pb, 2500);
    checks.push(check("broken file: app still traces (terms)", await A.terms(pb), ">", 10), check("broken file: built-in needles", (await pb.$$("#needle option")).length, "==", 11),
      check("broken file: says settings.js couldn't be read", +/couldn't be read/.test(await pb.textContent("#settingsNote")), "==", 1),
      check("broken file: only the settings.js syntax error", errsB.filter((m) => !/Unexpected|SyntaxError|missing/.test(m)).length, "==", 0));
    await ctxB.close();
    // a settings.js with one bad chocolate entry
    const ctxC = await ctx.browser.newContext({ viewport: { width: 1300, height: 1000 } }), pc = await ctxC.newPage(), errsC = [];
    pc.on("pageerror", (e) => errsC.push(e.message));
    const body = fs.readFileSync(path.resolve(__dirname, "../../../web-app/settings.js"), "utf8").replace('color: "#7b4a2d"', 'color: "brown"');
    await pc.route("**/settings.js", (r) => r.fulfill({ contentType: "text/javascript", body }));
    await pc.goto(ctx.url); await A.idle(pc, 2500);
    checks.push(check("bad entry: skipped from the menu", (await pc.$$("#chocolate option")).length, "==", S.chocolates.length - 1),
      check("bad entry: named in the 3D tab", +/chocolate 2 skipped/.test(await pc.textContent("#settingsNote")), "==", 1), check("bad entry: page errors", errsC.length, "==", 0));
    await ctxC.close();
    // a settings.js with many starting defaults changed: each must reach its control
    const ctxD = await ctx.browser.newContext({ viewport: { width: 1300, height: 1000 } }), pd = await ctxD.newPage(), errsD = [];
    pd.on("pageerror", (e) => errsD.push(e.message));
    let bodyD = fs.readFileSync(path.resolve(__dirname, "../../../web-app/settings.js"), "utf8");
    const swap = (re, to) => { const before = bodyD; bodyD = bodyD.replace(re, to); if (before === bodyD) throw new Error("test setup: couldn't change " + re); };
    swap(/lineView: "width",/, 'lineView: "printed",'); swap(/threshold: 0,/, "threshold: 10,");
    swap(/smoothing: 1.2,( +)\/\/ blur/, "smoothing: 2.0,$1// blur"); swap(/crossings: "remove-all",/, 'crossings: "keep",'); swap(/copies: 1,/, "copies: 4,");
    swap(/animationSpeed: "normal",/, 'animationSpeed: "fast",'); swap(/sample: "leaf",/, 'sample: "smiley",'); swap(/problems: false,/, "problems: true,");
    swap(/workingResolution: 500,/, "workingResolution: 720,"); swap(/simplify: 0.05,/, "simplify: 0.1,"); swap(/maxTextLines: 5,/, "maxTextLines: 3,");
    swap(/selectShape: "rect",/, 'selectShape: "lasso",'); swap(/font: "sans",/, 'font: "script",');
    await pd.route("**/settings.js", (r) => r.fulfill({ contentType: "text/javascript", body: bodyD }));
    await pd.goto(ctx.url); await A.idle(pd, 2500);
    const v = (id) => pd.inputValue("#" + id), c = (id) => pd.isChecked("#" + id);
    checks.push(check("changed defaults: line view", await v("lineView"), "==", "print"), check("changed defaults: threshold", await v("sens"), "==", "10"),
      check("changed defaults: smoothing slider (2.0)", await v("blur"), "==", "20"), check("changed defaults: crossings kept", await v("uncross"), "==", "0"),
      check("changed defaults: copies", await v("copies"), "==", "4"), check("changed defaults: animation speed", await v("speed"), "==", "4"),
      check("changed defaults: sample", await v("sample"), "==", "smiley"), check("changed defaults: problems shown", +(await c("showProb")), "==", 1),
      check("changed defaults: working resolution", await pd.evaluate(() => CFG.baseResolution), "==", 720), check("changed defaults: simplify slider (0.1 mm)", await v("simplify"), "==", "20"),
      check("changed defaults: lasso selection", +(await c("selLasso")), "==", 1), check("changed defaults: font", await v("font"), "==", "script"),
      check("changed defaults: app traces", await A.terms(pd), ">", 10), check("changed defaults: nothing reported wrong", +(await pd.isHidden("#settingsNote")), "==", 1), check("changed defaults: page errors", errsD.length, "==", 0));
    await A.source(pd, "text"); await pd.fill("#textIn", "a\nb\nc\nd\ne"); await pd.dispatchEvent("#textIn", "input"); await A.idle(pd, 800);
    checks.push(check("changed rules: text limited to 3 lines", (await pd.inputValue("#textIn")).split("\n").length, "<=", 3));
    await ctxD.close();
    return { checks };
  },
};
