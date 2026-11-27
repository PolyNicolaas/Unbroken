const A = require("../lib/app.js"), { check } = require("../lib/check.js"), fs = require("fs"), path = require("path"), { readGcode } = require("../lib/gcode.js");
module.exports = {
  id: "A79",
  title: "A morph in the app: a letter at the rim, Auto's turn, too short to print, a traced line at the rim, and the feature switched off",
  guards: "features/morph/morph.js: Letter at the rim not reaching the vase, a letter outside A–Z ! ? taken, the check (UNB.morphCheck in the background) not run or not shown in the panel and the ready list, Auto not putting its turn on the vase, a short morph not flagged, Use as the rim shape not making a vase, and the app with the morph off",
  why: "Nicolaas (26–27 November 2026): a vase whose shape from above changes into a letter, one character from the Chocolate lettering, 20 mm tall to start, flagged when it's too short to print; every built-in shape at the bottom (docs/MORPH-PLAN.md).",
  how: "Opens the Wavy vase example and picks Letter at the rim: an A, then a G (typed), then a 7 (refused). Waits for the check; reads the panel and, on the Print step, the ready list; downloads the G-code. Sets a star at the bottom and the height to 8 mm. Opens the leaf, traces it and taps Use as the rim shape. Opens the app with ?off=morph.",
  pass: "Letter makes a 20 mm morph to an A at the rim, paired corner to corner and kept apart; G replaces it; 7 is refused with a message and the G stays. The panel says it prints, the ready list too, and the G-code reaches the vase's height. At 8 mm the panel and ready list say it's too short and give a height over 8 mm. Use as the rim shape puts the leaf's exact line at the rim (Drawing showing). With the morph off the app opens with no errors, no Letter at the rim and no Use as the rim shape. No page errors.",
  slow: true,
  async run(ctx) {
    const out = path.join(__dirname, "..", "results");
    const { page, errors, close } = await A.open(ctx, { example: "wavyvase", art: true, viewport: { width: 1280, height: 1000 } });
    const checks = [], o = {}, bad = [];
    page.on("response", (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
    const shot = (n) => page.screenshot({ path: path.join(out, `morph-${n}.png`) });
    const V = () => page.evaluate(() => st.model && st.model.vase && structuredClone(st.model.vase));
    const waitCheck = async () => {
      for (let i = 0; i < 60; i++) {
        await A.idle(page, 700);
        const m = await page.evaluate(() => $("moMsg").textContent);
        if (m && !/Checking/.test(m)) return m;
      }
      return page.evaluate(() => $("moMsg").textContent);
    };
    await A.idle(page, 1500);
    await page.click('[data-node="vshape"]').catch(() => {});
    await A.idle(page, 500);
    // a letter at the rim
    await page.click('label[for="vrLetter"]');
    o.msgA = await waitCheck();
    o.vA = await V();
    await shot("letter-A");
    checks.push(
      check("Letter: an A at the rim, as one closed outline (points)", +(o.vA.planTop && o.vA.planTop.letter === "A" && o.vA.planTop.loop.length > 400), "==", 1),
      check("… 20 mm tall, paired corner to corner and kept apart", +(o.vA.height === 20 && o.vA.planTop.match === "corners" && o.vA.planTop.keepApart === true), "==", 1),
      check("… the panel says what the check found", +/Prints|Too short/.test(o.msgA), "==", 1)
    );
    await page.fill("#moLetter", "G");
    o.msgG = await waitCheck();
    o.vG = await V();
    await shot("letter-G");
    checks.push(check("typing G: the rim is a G", +(o.vG.planTop.letter === "G"), "==", 1), check("… and it prints (the panel)", +/^Prints/.test(o.msgG), "==", 1));
    await page.fill("#moLetter", "7");
    await A.idle(page, 800);
    o.msg7 = await page.evaluate(() => $("moMsg").textContent);
    o.v7 = await V();
    checks.push(check("7: refused, the G kept", +(/can't morph yet/.test(o.msg7) && o.v7.planTop.letter === "G"), "==", 1));
    await page.fill("#moLetter", "G");
    await waitCheck();
    // the letter's size: the rim follows; undo takes it back
    const reachTop = (v) => v.profile[v.profile.length - 1][1];
    o.r20 = reachTop(await V());
    await A.setValue(page, "#moCap", "30", "input");
    await page.dispatchEvent("#moCap", "change");
    await waitCheck();
    o.v30 = await V();
    checks.push(check("Letter size 30 mm: the letter and the rim grow (rim reach ÷ before)", +(o.v30.planTop.cap === 30 ? reachTop(o.v30) / o.r20 : 0).toFixed(2), ">=", 1.3));
    await page.evaluate(() => undo());
    await waitCheck();
    o.vUndo = await V();
    checks.push(check("… undo: back to 20 mm", o.vUndo.planTop.cap, "==", 20));
    // a design file keeps the letter
    o.reopened = await page.evaluate(async () => {
      const d = structuredClone(designState());
      $("vrSame").click();
      await new Promise((r) => setTimeout(r, 1200));
      const same = !st.model.vase.planTop && $("moLetter").closest(".row").hidden;
      applyDesign(d);
      await new Promise((r) => setTimeout(r, 1500));
      const Q = st.model.vase.planTop;
      return { same, letter: Q && Q.letter, radio: $("vrLetter").checked, shown: !$("moLetter").closest(".row").hidden };
    });
    checks.push(
      check("Same at the rim: no rim shape, the letter's rows hidden", +o.reopened.same, "==", 1),
      check("… a design saved with the G opens with it: Letter picked, its rows showing", +(o.reopened.letter === "G" && o.reopened.radio && o.reopened.shown), "==", 1)
    );
    await waitCheck();
    // Evenly, and a built-in shape at the rim: paired as asked, still checked
    await page.click('label[for="moEven"]');
    await waitCheck();
    o.even = (await V()).planTop.match;
    await page.click('label[for="vrStar"]');
    o.msgStar = await waitCheck();
    o.vStar = await V();
    checks.push(check("Evenly, then a star at the rim: paired evenly, kept apart, checked", +(o.vStar.planTop.kind === "star" && o.vStar.planTop.match === "even" && o.vStar.planTop.keepApart && /Prints|Too short/.test(o.msgStar)), "==", 1));
    await page.click('label[for="moCorners"]');
    await page.click('label[for="vrLetter"]');
    await page.fill("#moLetter", "G");
    await waitCheck();
    // Turn it over: the rim's shape goes to the bottom
    o.flipped = await page.evaluate(async () => {
      $("moFlip").hidden = false;
      $("moFlip").click();
      await new Promise((r) => setTimeout(r, 1500));
      const V = st.model.vase;
      return { bottom: V.plan.letter, top: V.planTop && V.planTop.kind };
    });
    checks.push(check("Turn it over: the G at the bottom, the circle at the rim", +(o.flipped.bottom === "G" && o.flipped.top === "circle"), "==", 1));
    await page.evaluate(() => undo());
    await waitCheck();
    // the Print step
    await A.print(page);
    await A.idle(page, 5000);
    const ready = () => page.evaluate(() => [...document.querySelectorAll("#readyList li")].map((e) => e.textContent).join(" | "));
    o.ready = await ready();
    await shot("print-G");
    checks.push(check("ready list: the morph prints", +/Morph: Prints/.test(o.ready), "==", 1));
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#gcodeBtn")]);
    const zip = fs.readFileSync(await dl.path()).toString("latin1"),
      text = zip.slice(zip.indexOf("; Unbroken"), zip.lastIndexOf("; end") + 5),
      G = readGcode(text),
      C = G.copies[0],
      pr = G.moves.slice(C.from, C.to).filter((m) => m.de > 0 && !m.wiping),
      top = Math.max(...pr.map((m) => m.z));
    o.top = top;
    checks.push(check("G-code: printing reaches the vase's height (mm)", +Math.abs(top - 20).toFixed(2), "<=", 0.6));
    // a star at the bottom, 8 mm tall: too short
    await page.click("label[for=viewArt]");
    await A.idle(page, 400);
    await page.click('[data-node="vshape"]').catch(() => {});
    await page.click('label[for="vpStar"]');
    await A.idle(page, 600);
    await page.evaluate(() => {
      $("vaseH").value = 8;
      $("vaseH").dispatchEvent(new Event("change", { bubbles: true }));
    });
    o.msgShort = await waitCheck();
    o.vShort = await V();
    await shot("short");
    const need = +(o.msgShort.match(/about (\d+) mm tall would/) || [])[1];
    checks.push(check("8 mm tall: the panel says too short, and a height over 8 mm (mm)", /Too short/.test(o.msgShort) ? need : 0, ">", 8));
    await A.print(page);
    await A.idle(page, 5000);
    o.readyShort = await ready();
    checks.push(check("… the ready list says so too", +/Morph: Too short/.test(o.readyShort), "==", 1));
    // a traced line at the rim
    await A.example(page, "leaf");
    await A.idle(page, 8000);
    await A.card(page, "h-line");
    await A.idle(page, 500);
    await page.click("#moFromLine");
    o.msgLine = await waitCheck();
    o.vLine = await V();
    o.drawShown = await page.evaluate(() => !!$("vrDrawingLab").getClientRects().length);
    await shot("leaf-rim");
    checks.push(
      check("Use as the rim shape: the leaf's exact line at the rim, a vase made (points)", +(o.vLine && o.vLine.planTop && o.vLine.planTop.kind === "drawing" && o.vLine.planTop.exact && !o.vLine.planTop.letter), "==", 1),
      check("… Drawing shows at the rim, and the check ran", +o.drawShown + +/Prints|Too short/.test(o.msgLine), "==", 2)
    );
    const pageErrors = errors.filter((e) => !/favicon\.ico/.test(e)); // (the test server has no favicon)
    await close();
    // switched off
    const off = await A.open(ctx, { url: ctx.url + (ctx.url.includes("?") ? "&" : "?") + "off=morph", art: true });
    await A.idle(off.page, 2000);
    o.off = await off.page.evaluate(() => ({ letter: !!document.getElementById("vrLetter"), use: !!document.getElementById("moFromLine") }));
    checks.push(check("?off=morph: no Letter at the rim, no Use as the rim shape", +!o.off.letter + +!o.off.use, "==", 2), check("… and no page errors", off.errors.length, "==", 0));
    await off.close();
    checks.push(check("no page errors", pageErrors.length, "==", 0));
    return {
      checks,
      notes: [
        `A: ${o.msgA}`,
        `G: ${o.msgG} (turn ${o.vG.planTop.turn}°)`,
        `7: ${o.msg7}`,
        `ready: ${o.ready}`,
        `8 mm: ${o.msgShort}`,
        `leaf: ${o.msgLine}`,
        pageErrors.length ? `errors: ${pageErrors.join(" / ").slice(0, 400)}` : "",
        bad.length ? `failed loads: ${bad.join(" / ")}` : "",
      ],
    };
  },
};
