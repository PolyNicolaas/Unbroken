const A = require("../lib/app.js"),
  { check } = require("../lib/check.js"),
  fs = require("fs"),
  path = require("path"),
  { readGcode } = require("../lib/gcode.js");
module.exports = {
  id: "A79",
  title:
    "A morph in the app: its own design (Bottom, Top, Change), a letter on top, changes that don't reset, too short to print, a traced line at the bottom or top, and the feature switched off",
  guards:
    "features/morph/morph.js: Make a morph not making one, the rail not saying Morph or showing a vase's Texture and Movement, a vase keeping a top shape, changing the top's kind or the bottom resetting the height or bringing back the wrong top, a letter outside A–Z ! ? taken, the check not run or not shown in the panel and the ready list, a short morph not flagged, Make a morph from this line and Use as the top shape, and the app with the morph off",
  why: "Nicolaas (26–27 November 2026): a shape at the bottom (drawn, imported or a vase's own) changing into a letter at the top, as its own design with all the morph's settings in one place, the vase left as vases; one character from the Chocolate lettering, 20 mm tall to start, flagged when it's too short to print (docs/MORPH-PLAN.md).",
  how: "Opens the Wavy vase example and reads the rail; taps Make a morph. Types G, then 7 (refused). Sets the height to 24 mm, a star at the top, then Letter again; a star at the bottom. Changes the letter's size and undoes it; Make a vase and opens the saved design again; Evenly and a star at the top; Turn it over and undo. On the Print step reads the ready list and downloads the G-code. At 8 mm on a star, reads the panel and the ready list. Opens the leaf: Make a morph from this line, then Use as the top shape. Opens the app with ?off=morph.",
  pass: "A vase has no top shape and the rail says Vase; Make a morph puts an A on top, 20 mm tall with no texture or movement, and the rail says Morph with Bottom, Top, Change, Profile and Rim only. G replaces the A; 7 is refused. A star at the top replaces the letter and Letter brings the G back at 24 mm; a star at the bottom keeps the G. Size, undo, the saved design, Evenly and Turn it over do what they say. The ready list says it prints and the G-code reaches the height. At 8 mm it's too short, with a height over 8 mm. The leaf goes to the bottom under the G, then to the top. With the morph off: no Letter, no Make a morph from this line, no errors. No page errors.",
  slow: true,
  async run(ctx) {
    const out = path.join(__dirname, "..", "results");
    const { page, errors, close } = await A.open(ctx, {
      example: "wavyvase",
      art: true,
      viewport: { width: 1280, height: 1000 },
    });
    const checks = [],
      o = {},
      bad = [];
    page.on("response", (r) => {
      if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
    });
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
    const rail = () =>
      page.evaluate(() => ({
        cap: mapCap("art"),
        nodes: [...document.querySelectorAll("[data-node]")].map((e) => e.dataset.node),
      }));
    o.railVase = await rail();
    // Make a morph (the 3D model card): a letter on top of the vase in use; the rail says Morph, with the morph's tools
    await page.evaluate(() => $("mfMorph").click());
    o.msgA = await waitCheck();
    o.vA = await V();
    o.railMorph = await rail();
    await page.click('[data-node="mtop"]');
    await A.idle(page, 500);
    await shot("letter-A");
    checks.push(
      check(
        "a vase: no shape at the top, the rail says Vase with Texture and Movement",
        +(!o.railVase.nodes.includes("mtop") && o.railVase.cap === "Vase" && o.railVase.nodes.includes("vtexture")),
        "==",
        1
      ),
      check(
        "Make a morph: an A on top as one closed outline (points)",
        +(o.vA.planTop && o.vA.planTop.letter === "A" && o.vA.planTop.loop.length > 400),
        "==",
        1
      ),
      check(
        "… 20 mm tall, no texture or movement, paired corner to corner and kept apart",
        +(
          o.vA.height === 20 &&
          o.vA.texture.kind === "none" &&
          o.vA.move.kind === "none" &&
          o.vA.planTop.match === "corners" &&
          o.vA.planTop.keepApart === true
        ),
        "==",
        1
      ),
      check(
        "… the rail says Morph: Bottom, Top, Change, Profile, Rim; no Texture or Movement",
        +(
          o.railMorph.cap === "Morph" &&
          ["mbottom", "mtop", "mchange", "vprofile", "vrim"].every((k) => o.railMorph.nodes.includes(k)) &&
          !o.railMorph.nodes.includes("vtexture") &&
          !o.railMorph.nodes.includes("vmove")
        ),
        "==",
        1
      ),
      check("… the panel says what the check found", +/Prints|Too short/.test(o.msgA), "==", 1)
    );
    await page.fill("#moLetter", "G");
    o.msgG = await waitCheck();
    o.vG = await V();
    await shot("letter-G");
    checks.push(
      check("typing G: the rim is a G", +(o.vG.planTop.letter === "G"), "==", 1),
      check("… and it prints (the panel)", +/^Prints/.test(o.msgG), "==", 1)
    );
    await page.fill("#moLetter", "7");
    await A.idle(page, 800);
    o.msg7 = await page.evaluate(() => $("moMsg").textContent);
    o.v7 = await V();
    checks.push(
      check("7: refused, the G kept", +(/can't morph yet/.test(o.msg7) && o.v7.planTop.letter === "G"), "==", 1)
    );
    await page.fill("#moLetter", "G");
    await waitCheck();
    // the top's kind changed and back: the height and the bottom stay (no reset), the letter comes back
    await page.evaluate(() => {
      $("vaseH").value = 24;
      $("vaseH").dispatchEvent(new Event("change", { bubbles: true }));
    });
    await A.idle(page, 600);
    await page.click('#moTopShapes button[data-builtin="star"]');
    await A.idle(page, 800);
    o.vTopStar = await V();
    o.radioStar = await page.evaluate(() => $("vrStar").checked && !$("vrLetter").checked);
    await page.click('label[for="vrLetter"]');
    await waitCheck();
    o.vBack = await V();
    checks.push(
      check(
        "a star at the top after the G: a star, the letter gone, its radio picked",
        +(o.vTopStar.planTop.kind === "star" && !o.vTopStar.planTop.letter && o.radioStar),
        "==",
        1
      ),
      check(
        "… Letter again: the G back, still 24 mm tall (no reset)",
        +(o.vBack.planTop.letter === "G" && o.vBack.height === 24),
        "==",
        1
      )
    );
    await page.click('[data-node="mbottom"]');
    await A.idle(page, 500);
    await page.click('#moBotShapes button[data-builtin="star"]');
    await A.idle(page, 800);
    o.vBottom = await V();
    checks.push(
      check(
        "a star at the bottom: the G stays on top, the height too",
        +(o.vBottom.plan.kind === "star" && o.vBottom.planTop.letter === "G" && o.vBottom.height === 24),
        "==",
        1
      )
    );
    await page.click('#moBotShapes button[data-builtin="circle"]');
    await page.evaluate(() => {
      $("vaseH").value = 20;
      $("vaseH").dispatchEvent(new Event("change", { bubbles: true }));
    });
    await waitCheck();
    await page.click('[data-node="mtop"]');
    await A.idle(page, 400);
    // the letter's size: the rim follows; undo takes it back
    const reachTop = (v) => v.profile[v.profile.length - 1][1];
    o.r20 = reachTop(await V());
    await A.setValue(page, "#moCap", "30", "input");
    await page.dispatchEvent("#moCap", "change");
    await waitCheck();
    o.v30 = await V();
    checks.push(
      check(
        "Letter size 30 mm: the letter and the rim grow (rim reach ÷ before)",
        +(o.v30.planTop.cap === 30 ? reachTop(o.v30) / o.r20 : 0).toFixed(2),
        ">=",
        1.3
      )
    );
    await page.evaluate(() => undo());
    await waitCheck();
    o.vUndo = await V();
    checks.push(check("… undo: back to 20 mm", o.vUndo.planTop.cap, "==", 20));
    // a design file keeps the letter
    o.reopened = await page.evaluate(async () => {
      const d = structuredClone(designState());
      $("mfVase").click();
      await new Promise((r) => setTimeout(r, 1200));
      const same = !st.model.vase.planTop && mapCap("art") === "Vase";
      applyDesign(d);
      await new Promise((r) => setTimeout(r, 1500));
      const Q = st.model.vase.planTop;
      return {
        same,
        letter: Q && Q.letter,
        radio: $("vrLetter").checked,
        shown: !$("moLetter").closest(".row").hidden,
      };
    });
    checks.push(
      check("Make a vase: no top shape, the rail says Vase", +o.reopened.same, "==", 1),
      check(
        "… a design saved with the G opens with it: Letter picked, its rows showing",
        +(o.reopened.letter === "G" && o.reopened.radio && o.reopened.shown),
        "==",
        1
      )
    );
    await waitCheck();
    // Evenly, and a built-in shape at the top: paired as asked, still checked
    await page.click('[data-node="mchange"]');
    await A.idle(page, 400);
    await page.click('label[for="moEven"]');
    await waitCheck();
    o.even = (await V()).planTop.match;
    await page.click('[data-node="mtop"]');
    await A.idle(page, 400);
    await page.click('#moTopShapes button[data-builtin="star"]');
    o.msgStar = await waitCheck();
    o.vStar = await V();
    checks.push(
      check(
        "Evenly, then a star at the top: paired evenly, kept apart, checked",
        +(
          o.vStar.planTop.kind === "star" &&
          o.vStar.planTop.match === "even" &&
          o.vStar.planTop.keepApart &&
          /Prints|Too short/.test(o.msgStar)
        ),
        "==",
        1
      )
    );
    await page.click('[data-node="mchange"]');
    await A.idle(page, 400);
    await page.click('label[for="moCorners"]');
    await page.click('[data-node="mtop"]');
    await A.idle(page, 400);
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
    checks.push(
      check(
        "Turn it over: the G at the bottom, the circle at the rim",
        +(o.flipped.bottom === "G" && o.flipped.top === "circle"),
        "==",
        1
      )
    );
    await page.evaluate(() => undo());
    await waitCheck();
    // the Print step
    await A.print(page);
    await A.idle(page, 5000);
    const ready = () =>
      page.evaluate(() => [...document.querySelectorAll("#readyList li")].map((e) => e.textContent).join(" | "));
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
    await page.click('[data-node="mbottom"]');
    await A.idle(page, 400);
    await page.click('#moBotShapes button[data-builtin="star"]');
    await A.idle(page, 600);
    await page.evaluate(() => {
      $("vaseH").value = 8;
      $("vaseH").dispatchEvent(new Event("change", { bubbles: true }));
    });
    o.msgShort = await waitCheck();
    o.vShort = await V();
    await shot("short");
    const need = +(o.msgShort.match(/about (\d+) mm tall would/) || [])[1];
    checks.push(
      check(
        "8 mm tall: the panel says too short, and a height over 8 mm (mm)",
        /Too short/.test(o.msgShort) ? need : 0,
        ">",
        8
      )
    );
    await A.print(page);
    await A.idle(page, 5000);
    o.readyShort = await ready();
    checks.push(check("… the ready list says so too", +/Morph: Too short/.test(o.readyShort), "==", 1));
    // a traced line at the bottom, a letter on top; then the line at the top
    await A.example(page, "leaf");
    await A.idle(page, 8000);
    await A.card(page, "h-line");
    await A.idle(page, 500);
    await page.click("#moFromLine");
    o.msgLine = await waitCheck();
    o.vLine = await V();
    o.railLine = await rail();
    await shot("leaf-bottom");
    checks.push(
      check(
        "Make a morph from this line: the leaf's exact line at the bottom, the G on top (points)",
        +(
          o.vLine &&
          o.vLine.plan.kind === "drawing" &&
          o.vLine.plan.exact &&
          o.vLine.planTop &&
          o.vLine.planTop.letter === "G"
        ),
        "==",
        1
      ),
      check(
        "… the rail says Morph, and the check ran",
        +(o.railLine.cap === "Morph") + +/Prints|Too short/.test(o.msgLine),
        "==",
        2
      )
    );
    await A.example(page, "leaf");
    await A.idle(page, 8000);
    await A.card(page, "h-line");
    await A.idle(page, 500);
    o.topBtn = await page.evaluate(() => !$("moTopFromLine").hidden);
    await page.evaluate(() => $("moTopFromLine").click());
    await waitCheck();
    o.vTop = await V();
    checks.push(
      check(
        "Use as the top shape (shown while there's a morph): the leaf at the top, no letter",
        +(o.topBtn && o.vTop.planTop.kind === "drawing" && o.vTop.planTop.exact && !o.vTop.planTop.letter),
        "==",
        1
      )
    );
    const pageErrors = errors.filter((e) => !/favicon\.ico/.test(e)); // (the test server has no favicon)
    await close();
    // switched off
    const off = await A.open(ctx, { url: ctx.url + (ctx.url.includes("?") ? "&" : "?") + "off=morph", art: true });
    await A.idle(off.page, 2000);
    o.off = await off.page.evaluate(() => ({
      letter: !!document.getElementById("vrLetter"),
      use: !!document.getElementById("moFromLine"),
    }));
    checks.push(
      check("?off=morph: no Letter at the top, no Make a morph from this line", +!o.off.letter + +!o.off.use, "==", 2),
      check("… and no page errors", off.errors.length, "==", 0)
    );
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
