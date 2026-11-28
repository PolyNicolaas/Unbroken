const A = require("../lib/app.js"),
  { check } = require("../lib/check.js"),
  path = require("path");
module.exports = {
  id: "A80",
  title: "A morph's ready-made shapes (Bottom and Top) and its lettering (Chocolate, Swirl, Grand)",
  guards:
    "features/morph/morph.js and engine/morph-fonts.js: a shape button not putting its shape at the bottom or the top, the shape not named on the panel, the rail or the print's name, a shape at the top not giving way to a letter, the lettering buttons missing or not making the letter from the font picked, the font not kept when the design is opened again, the check not passing for a letter from Swirl or Grand",
  why: "Nicolaas (27 November 2026): lots of basic shapes to use as top or bottom, drawn and approved one by one, and other fonts than the Chocolate one, fancy ones, so there are options.",
  how: "Opens the Wavy vase example and taps Make a morph. On Bottom taps the heart; on Top the star, then Letter, then Swirl and Grand. Reads the vase, the panel, the name and the check each time; opens the saved design again.",
  pass: "The heart is the bottom (a drawing named heart) and the star the top (named on Top's button and in the name: morph star); Letter brings back a letter; Swirl and Grand each make a different outline of it, saying so, and each check says it prints; the saved design keeps Grand. No page errors.",
  slow: true,
  async run(ctx) {
    const out = path.join(__dirname, "..", "results");
    const { page, errors, close } = await A.open(ctx, {
      example: "wavyvase",
      art: true,
      viewport: { width: 1280, height: 1000 },
    });
    const checks = [],
      o = {};
    const shot = (n) => page.screenshot({ path: path.join(out, `morph-shapes-${n}.png`) });
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
    await page.evaluate(() => $("mfMorph").click());
    await waitCheck();
    // the shapes: as many buttons as UNB.MORPH_SHAPES, at the bottom and the top
    o.count = await page.evaluate(() => ({
      shapes: Object.keys(UNB.MORPH_SHAPES).length + Object.keys(UNB.MORPH_PATTERNS || {}).length,
      bottom: $("moBotShapes").querySelectorAll("button[data-shape]").length,
      top: $("moTopShapes").querySelectorAll("button[data-shape]").length,
    }));
    checks.push(
      check("a button for every shape, at the bottom and the top", +(o.count.shapes >= 18 && o.count.bottom === o.count.shapes && o.count.top === o.count.shapes), "==", 1)
    );
    await page.click('[data-node="mbottom"]');
    await A.idle(page, 400);
    await page.click('#moBotShapes button[data-shape="heart"]');
    o.msgHeart = await waitCheck();
    o.vHeart = await V();
    o.heartWords = await page.evaluate(() => $("vasePlanVal").textContent);
    await shot("heart-bottom");
    checks.push(
      check(
        "Bottom: the heart is the shape from above (a drawing named heart), the A still on top",
        +(o.vHeart.plan.kind === "drawing" && o.vHeart.plan.shape === "heart" && /heart/.test(o.heartWords) && o.vHeart.planTop.letter === "A"),
        "==",
        1
      )
    );
    // a Circle after it: the heart's button no longer lit (Shape brings it back)
    await page.click('#moBotShapes button[data-builtin="circle"]');
    await waitCheck();
    o.circleLit = await page.evaluate(() => document.querySelectorAll("#moBotShapes button[data-shape].on").length + (document.querySelector('#moBotShapes button.on[data-builtin="circle"]') ? 0 : 1));
    await page.click('label[for="vpDrawing"]');
    await waitCheck();
    o.backHeart = await page.evaluate(() => st.model.vase.plan.kind === "drawing" && st.model.vase.plan.shape === "heart" && !!document.querySelector('#moBotShapes button.on[data-shape="heart"]'));
    checks.push(check("Circle after the heart: Circle lit, no shape button; Shape brings the heart back, lit", +(o.circleLit === 0 && o.backHeart), "==", 1));
    await page.click('[data-node="mtop"]');
    await A.idle(page, 400);
    await page.click('#moTopShapes button[data-shape="star"]');
    o.msgStar = await waitCheck();
    o.vStar = await V();
    o.star = await page.evaluate(() => ({
      lab: $("vrDrawingLab").textContent,
      on: !$("vrDrawingLab").hidden && $("vrDrawing").checked,
      name: answer("vaseName", st.model.vase),
      btn: !!document.querySelector('#moTopShapes button.on[data-shape="star"]'),
    }));
    await shot("star-top");
    checks.push(
      check(
        "Top: the star at the top (no letter), its button lit and named, the name morph star",
        +(o.vStar.planTop.shape === "star" && !o.vStar.planTop.letter && o.star.lab === "Shape" && o.star.on && o.star.btn && o.star.name === "morph star"),
        "==",
        1
      ),
      check("… the heart stays at the bottom", +(o.vStar.plan.shape === "heart"), "==", 1),
      check("… and the check ran", +/Prints|Too short/.test(o.msgStar), "==", 1)
    );
    // a letter again, then the fonts
    await page.click('label[for="vrLetter"]');
    o.msgA = await waitCheck();
    o.vA = await V();
    o.fonts = await page.evaluate(() => [...document.querySelectorAll("#moFonts input")].map((e) => e.value));
    checks.push(
      check("Letter brings a letter back, from the Chocolate font", +(o.vA.planTop.letter === "A" && !o.vA.planTop.shape && o.vA.planTop.font === "chocolate"), "==", 1),
      check("the lettering: Chocolate, Swirl and Grand", +(o.fonts.join() === "chocolate,swirl,grand"), "==", 1)
    );
    const loopKey = (Vv) => Vv.planTop.loop.slice(0, 40).join();
    for (const f of ["swirl", "grand"]) {
      await page.click(`label[for="moFont-${f}"]`);
      o[f] = await waitCheck();
      o["v" + f] = await V();
      o[f + "Words"] = await page.evaluate(() => [$("moFontVal").textContent]);
      await shot(`A-${f}`);
      checks.push(
        check(
          `${f}: the A made from it (a different outline), said so, and it prints`,
          +(o["v" + f].planTop.font === f && o["v" + f].planTop.letter === "A" && loopKey(o["v" + f]) !== loopKey(o.vA)) +
            +new RegExp(f, "i").test(o[f + "Words"][0]) +
            +/Prints/.test(o[f]),
          "==",
          3
        )
      );
    }
    // a new letter keeps the lettering; the saved design opens with it
    await page.fill("#moLetter", "R");
    o.msgR = await waitCheck();
    o.vR = await V();
    checks.push(check("R in Grand: the lettering kept for a new letter", +(o.vR.planTop.letter === "R" && o.vR.planTop.font === "grand"), "==", 1));
    o.reopened = await page.evaluate(async () => {
      const V = structuredClone(st.model.vase);
      useVase(V, true);
      vaseUI();
      return { font: st.model.vase.planTop.font, lit: $("moFont-grand").checked };
    });
    checks.push(check("… opened again: still Grand, its button lit", +(o.reopened.font === "grand" && o.reopened.lit), "==", 1));
    const pageErrors = errors.filter((e) => !/favicon\.ico/.test(e));
    checks.push(check("no page errors", pageErrors.length, "==", 0));
    await close();
    return {
      checks,
      notes: [
        `heart → A: ${o.msgHeart}`,
        `heart → star: ${o.msgStar}`,
        `Swirl A: ${o.swirl}`,
        `Grand A: ${o.grand}`,
        `Grand R: ${o.msgR}`,
        pageErrors.length ? `errors: ${pageErrors.join(" / ").slice(0, 400)}` : "",
      ],
    };
  },
};
