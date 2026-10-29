const A = require("../lib/app.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A35", title: "A clean start: the app opens empty, and every example is one tap away",
  guards: "a start that isn't empty, an empty preview that doesn't say how to start, later steps showing an old input while empty, an example chip that loads the wrong kind of input or nothing, and a picture example that leaves a picture pattern in use",
  why: "The app opens on a clean workspace: nothing traced, the preview saying how to start (drop, paste or choose a file) with the examples — pictures, patterns, lettering and a 3D model — as chips there and in the Input card. settings.js can still name a sample to start on (defaults.sample), and the page's address can (?example=leaf).",
  how: "Opens the app with no example; checks the empty preview, its chips and the readout; visits the Line and Print steps; taps each example in the Input card and checks the input it makes; taps the Wave portrait then the Leaf.",
  pass: "Empty at the start: the empty preview showing with all eleven examples, the readout saying nothing yet, nothing traced on Line and Print; each example becomes its input (five pictures, three patterns, the text, the theobromine molecule, the vase) and the preview is no longer empty; after the Wave portrait the Leaf is the Picture in use; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx, { clean: true, art: true }), checks = [];
    const empty = await page.evaluate(() => ({ e: document.body.dataset.empty, shown: !$("emptyState").hidden && $("emptyState").offsetParent !== null, chips: document.querySelectorAll("#emptyState [data-example]").length, chip: $("chip").textContent, pic: st.art.picture }));
    checks.push(check("opens empty, the empty preview showing, its examples (chips)", +(empty.e === "1" && empty.shown && !empty.pic) * empty.chips, "==", 11), check("… the readout says nothing yet", +/Nothing yet/.test(empty.chip), "==", 1));
    await page.click("label[for=viewDesign]"); await A.idle(page, 800);
    const line = await page.evaluate(() => ({ final: !!st.final, walk: !!st.walk, chip: $("chip").textContent }));
    await A.print(page); await A.idle(page, 800);
    checks.push(check("Line and Print while empty: nothing traced, the readout says so", +(!line.final && !line.walk && /Nothing yet/.test(line.chip)), "==", 1));
    await page.click("label[for=viewArt]"); await A.idle(page, 300);
    const want = { leaf: "picture", still: "picture", face: "picture", shapes: "picture", smiley: "picture", labyrinth: "pattern", spirograph: "pattern", portrait: "pattern", lettering: "text", theobromine: "molecule", vase: "model" };
    let right = 0; const wrong = [];
    for (const [k, kind] of Object.entries(want)) {
      await page.click(`[data-examples] [data-example=${k}]:visible`); await A.idle(page, 1500);
      const got = await page.evaluate(() => ({ kind: st.art.kind, empty: document.body.dataset.empty, sample: st.art.picture && st.art.picture.sample, style: st.art.pattern.style }));
      const ok = got.kind === kind && got.empty === "" && (kind !== "picture" || got.sample === k) && (k !== "portrait" || got.style === "wavesTone");
      if (ok) right++; else wrong.push(`${k}: ${JSON.stringify(got)}`);
    }
    checks.push(check("examples that become their input", right, "==", 11));
    await page.click("[data-examples] [data-example=portrait]:visible"); await A.idle(page, 1500);
    await page.click("[data-examples] [data-example=leaf]:visible"); await A.idle(page, 1500);
    checks.push(check("the Leaf after the Wave portrait: the Picture in use", await page.evaluate(() => st.art.kind), "==", "picture"));
    checks.push(check("page errors", errors.length, "==", 0));
    await close();
    return { checks, notes: [...wrong, ...errors].join("  \n") };
  },
};
