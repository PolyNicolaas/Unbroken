const A = require("../lib/app.js"),
  { check } = require("../lib/check.js"),
  path = require("path");
module.exports = {
  id: "A82",
  title: "Big morphs (M1) in the app: a word at the top, two touching lines with Solid letters, letters at the bottom, the patterns",
  guards:
    "features/morph/morph.js: the Letters field (up to 4, a / for a second line, 5 in all), the height and the bottom made for a word, Solid letters, the bottom's Letters, the pattern buttons (and their width), the names; the check on a word",
  why: "Nicolaas (27 November 2026): M1 is the target, a limited set that works; words over two lines, the lines touching.",
  how: "Wavy vase → Make a morph. Bottom: the heart; Top: LOVE. Then the pebble, Solid letters and HAP/PY. Then MOM at the bottom. Then Moore at the bottom and Moore, fine at the top. Reads the vase, the panel and the check each time.",
  pass: "LOVE: at least 60 mm tall, the bottom grown to about the word, it prints. HAP/PY solid from the pebble prints, named morph HAP/PY, the panel saying the letters. MOM at the bottom is the bottom's letters, solid. The Moore at the bottom is made at least its width; Moore → Moore, fine is named. No page errors.",
  slow: true,
  async run(ctx) {
    const out = path.join(__dirname, "..", "results");
    const { page, errors, close } = await A.open(ctx, { example: "wavyvase", art: true, viewport: { width: 1280, height: 900 } });
    const checks = [],
      o = {};
    const waitCheck = async () => {
      for (let i = 0; i < 300; i++) {
        await A.idle(page, 1000);
        const m = await page.evaluate(() => $("moMsg").textContent);
        if (m && !/Checking/.test(m)) return m;
      }
      return "";
    };
    const V = () => page.evaluate(() => structuredClone(st.model.vase));
    await A.idle(page, 1500);
    await page.evaluate(() => $("mfMorph").click());
    await waitCheck();
    await page.click('[data-node="mbottom"]');
    await A.idle(page, 400);
    await page.click('#moBotShapes button[data-shape="heart"]');
    await waitCheck();
    await page.click('[data-node="mtop"]');
    await A.idle(page, 400);
    await page.fill("#moLetter", "LOVE");
    await A.idle(page, 1500);
    o.love = await waitCheck();
    o.vLove = await V();
    checks.push(
      check(
        "LOVE at the top: at least 60 mm tall, the bottom grown to about the word's size",
        +(o.vLove.planTop.letter === "LOVE" && o.vLove.height >= 60 && o.vLove.profile[0][1] >= 0.7 * o.vLove.profile[o.vLove.profile.length - 1][1]),
        "==",
        1
      ),
      check("… and it prints", +/^Prints/.test(o.love), "==", 1)
    );
    // two touching lines, solid, out of the pebble
    await page.click('[data-node="mbottom"]');
    await A.idle(page, 400);
    await page.click('#moBotShapes button[data-shape="pebble"]');
    await A.idle(page, 800);
    await page.click('[data-node="mtop"]');
    await A.idle(page, 400);
    await page.check("#moSolid");
    await page.fill("#moLetter", "HAP/PYX"); // (a 6th letter is left out)
    await A.idle(page, 2500);
    o.happy = await waitCheck();
    o.vHappy = await V();
    o.words = await page.evaluate(() => ({ field: $("moLetter").value, name: answer("vaseName", st.model.vase), head: mapVal(MAP_NODES.mtop) }));
    await page.screenshot({ path: path.join(out, "morph-big-happy.png") });
    checks.push(
      check("HAP/PY: two lines, solid, the 6th letter left out", +(o.vHappy.planTop.letter === "HAP/PY" && o.vHappy.planTop.solid && o.words.field === "HAP/PY"), "==", 1),
      check("… named morph HAP/PY, the panel says the letters", +(o.words.name === "morph HAP/PY" && /the letters HAP\/PY/.test(o.words.head)), "==", 1),
      check("… and it prints", +/^Prints/.test(o.happy), "==", 1)
    );
    // letters at the bottom (word to word)
    await page.click('[data-node="mbottom"]');
    await A.idle(page, 400);
    await page.fill("#moBotLetters", "MOM");
    await A.idle(page, 3000);
    o.vMom = await V();
    checks.push(check("MOM at the bottom: the bottom's letters, solid", +(o.vMom.plan.kind === "drawing" && o.vMom.plan.letter === "MOM" && o.vMom.plan.solid), "==", 1));
    // the patterns
    await page.click('#moBotShapes button[data-shape="p:moore3"]');
    await A.idle(page, 800);
    await page.click('[data-node="mtop"]');
    await A.idle(page, 400);
    await page.click('#moTopShapes button[data-shape="p:moore4"]');
    await A.idle(page, 1000);
    o.vMoore = await V();
    o.moore = await page.evaluate(() => ({ name: answer("vaseName", st.model.vase), minW: UNB.morphPattern("moore4").minW }));
    const across = (P) => {
      const xs = [];
      for (let i = 0; i < P.loop.length; i += 2) xs.push(P.loop[i]);
      return Math.max(...xs) - Math.min(...xs);
    };
    o.topW = across(o.vMoore.planTop) * o.vMoore.profile[o.vMoore.profile.length - 1][1];
    checks.push(
      check("Moore → Moore, fine: patterns at both ends, named", +(o.vMoore.plan.shape === "p:moore3" && o.vMoore.planTop.shape === "p:moore4" && o.moore.name === "morph moore, fine"), "==", 1),
      check("… the fine Moore at least its width across (mm)", +o.topW.toFixed(1), ">=", o.moore.minW - 1)
    );
    const pageErrors = errors.filter((e) => !/favicon\.ico/.test(e));
    checks.push(check("no page errors", pageErrors.length, "==", 0));
    await close();
    return { checks, notes: [`LOVE: ${o.love}`, `HAP/PY: ${o.happy}`, `top width ${o.topW.toFixed(1)} mm`, pageErrors.join(" / ").slice(0, 300)] };
  },
};
