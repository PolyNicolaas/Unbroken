const A = require("../lib/app.js"), M = require("../lib/meshes.js"), { check } = require("../lib/check.js"), fs = require("fs");
module.exports = {
  slow: true,
  id: "A17", title: "3D models: load an STL, turn it, slice it on the 3D tab, set its height, export",
  guards: "a model that doesn't load, image controls left showing for a model, turns that don't change how it stands, a height that doesn't scale it, G-code that doesn't reach the top, and a model that can't be left again",
  why: "A 3D model is a source like an image: picked in Design, turned to the side it should print on, then sliced and fitted on the 3D tab, where its height is set and the G-code comes from. Undo has to cover turning it, and going back to an image has to trace the image again.",
  how: "Opens the app and picks 3D model (the sample skull cup loads). Loads an STL of two 5 mm posts 20 mm apart (30 × 10 × 10 mm) through the file box and slices it on the 3D tab; tips it sideways and goes back to the 3D tab; tries the infill at 100%, then hollow with 2 walls, then back; types a height of 15 mm; exports G-code and reads its Z range. Checks the 2D tab's note, undoes back past the turn, and goes back to Image.",
  pass: "The sample skull cup shows (21.2 × 31.7 × 25 mm: the Printables skull cup, scaled to 25 mm) and the tracing controls are hidden; the posts load as 768 triangles, 30 × 10 × 10 mm; the 3D tab slices them (layers in the readout) with one line reaching both posts; tipped sideways they stand 30 mm tall and the Height field shows 30; the infill shows its density and pattern and at 100% makes more line than hollow; hollow with 2 walls more than 1; 15 mm makes 50 layers and the G-code tops out at 0.3 + 49 × 0.3 = 15 mm; the 2D tab points to Draw this view; undoing back past the turn stands the posts 10 mm tall again; Image traces the leaf again; no page errors. Cutting 1 mm off the bottom and 2 mm off the top leaves a 7 mm print (the Height box and the layers agree); the solid layers view shows a brightness spread over 20 of 255.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx), checks = [];
    const waitLayers = async () => { await A.idle(page, 300); if (!/layers ·/.test(await page.textContent("#layerInfo"))) throw new Error("the layers never finished: " + (await page.textContent("#layerInfo"))); };
    await A.source(page, "model"); await page.waitForTimeout(1200);
    checks.push(check("sample skull cup: size in the readout", +/sample skull cup · 21\.2 × 31\.7 × 25(\.0)? mm/.test(await page.textContent("#chip")), "==", 1));
    checks.push(check("tracing controls hidden, model controls shown", +!(await page.isVisible("#sens")) + +/3D model/.test(await page.textContent("#fromArt")), "==", 2));
    await page.setInputFiles("#anyFile", { name: "posts.stl", mimeType: "model/stl", buffer: Buffer.from(M.stl([...M.cylinder(5, 10, -10, 0), ...M.cylinder(5, 10, 10, 0)])) });
    await page.waitForTimeout(1200);
    checks.push(check("posts: 768 triangles, 30 × 10 × 10 mm", +/^768 triangles · 30(\.0)? × 10(\.0)? × 10(\.0)? mm/.test(await page.textContent("#modelInfo")), "==", 1));
    await A.print(page); await waitLayers();
    checks.push(check("3D tab: sliced (layers in the readout)", +/^\d+ layers ·/.test(await page.textContent("#layerInfo")), "==", 1));
    checks.push(check("one layer's line reaches both posts (spans over 25 mm)", await page.evaluate(() => { const L = st.layers.wall, sp = (a) => Math.max(...a) - Math.min(...a); return +(Math.max(sp(L.x), sp(L.y)) > 25); }), "==", 1));
    await page.click("label[for=viewArt]"); await page.click("#turnY"); await page.waitForTimeout(800);
    checks.push(check("tipped sideways: 30 mm tall", +/× 30(\.0)? mm$/.test(await page.textContent("#modelInfo")), "==", 1));
    await A.print(page); await page.waitForTimeout(300); await waitLayers();
    checks.push(check("Height field shows the model's 30 mm", +(await page.inputValue("#printHeightMM")), "==", 30));
    const metres = async () => +((await page.textContent("#layerInfo")).match(/([\d.]+) m ·/) || [0, 0])[1];
    const hollowM = await metres();
    const changed = async (from) => { for (let i = 0; i < 240; i++) { await page.waitForTimeout(500); const t = await page.textContent("#layerInfo"); if (/layers ·/.test(t) && (await metres()) !== from) return; } };
    await A.setValue(page, "#fillDensity", 100); await changed(hollowM);   // the posts lie 10 mm wide: solid, so the fill has room
    checks.push(check("Infill: density and pattern shown", +(await page.isVisible("#fillDensity")) + +(await page.isVisible("#fillPattern")), "==", 2));
    const solidM = await metres();
    checks.push(check("Infill 100%: more line than hollow (×)", solidM / hollowM, ">", 1.2));
    await A.setValue(page, "#fillDensity", 0); await changed(solidM); await A.setValue(page, "#wallCount", 2); await changed(hollowM);
    checks.push(check("hollow with 2 walls: more line than 1 wall (×)", (await metres()) / hollowM, ">", 1.2));
    await A.setValue(page, "#wallCount", 1); await A.setValue(page, "#fillDensity", 0); await page.waitForTimeout(500); await waitLayers();
    await page.fill("#printHeightMM", "15"); await page.press("#printHeightMM", "Tab"); await page.waitForTimeout(500); await waitLayers();
    const info15 = await page.textContent("#layerInfo"); checks.push(check(`height 15 mm: 50 layers of 0.3 mm (readout: ${info15.split(" ·").slice(0, 2).join(",")})`, +/^50 layers · 15(\.0)? mm/.test(info15), "==", 1));
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#gcodeBtn")]);
    const txt = fs.readFileSync(await dl.path()).toString("latin1"), lift = [...txt.matchAll(/^G1 Z[\d.]+ F600$/gm)].pop().index,
      zs = [...txt.slice(txt.indexOf("M82 ; absolute E"), lift).matchAll(/^G1 [^\n]*Z([\d.]+)/gm)].map((m) => +m[1]);   // printing Z only: not the purge line, the final lift or the end lines
    checks.push(check("G-code: top printing Z off 15 mm (the 50th layer at 0.3 + 49 × 0.3)", Math.abs(Math.max(...zs) - 15), "<", 0.02));
    await A.plot(page); await page.waitForTimeout(500);
    checks.push(check("2D tab: points to Draw this view", +/Draw this view/.test(await page.textContent("#pageHint")), "==", 1));
    checks.push(check("2D page: the last picture's drawing isn't shown for a model (dark pixels on the page)", await page.$eval("#pageView", (c) => { const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 60 && d[i + 3]) n++; return n; }), "==", 0));
    await page.click("label[for=viewDesign]"); await page.mouse.click(5, 5);
    for (let i = 0; i < 8 && !/× 10(\.0)? mm$/.test(await page.textContent("#modelInfo")); i++) { await page.keyboard.press("Control+z"); await page.waitForTimeout(700); }
    checks.push(check("undo back past the turn: posts 10 mm tall again", +/× 10(\.0)? mm$/.test(await page.textContent("#modelInfo")), "==", 1));
    await A.source(page, "picture"); await A.idle(page, 1500);
    checks.push(check("back to Image: the leaf is traced (terms)", await A.terms(page), ">", 10));
    // cutting the model: the 10 mm posts cut 2 mm from the top and 1 mm from the bottom print the 7 mm between
    await page.click("label[for=viewDesign]"); await A.source(page, "model"); await A.idle(page); await A.print(page); await waitLayers();
    await page.fill("#cutTop", "2"); await page.press("#cutTop", "Tab"); await page.fill("#cutBottom", "1"); await page.press("#cutBottom", "Tab"); await A.idle(page);
    const cutInfo = await page.textContent("#cutInfo"); await A.print(page); await waitLayers();
    checks.push(check(`cut 1 + 2 mm off the 10 mm posts: Height shows what's left (${cutInfo})`, +(await page.inputValue("#printHeightMM")), "==", 7),
      check("… and the layers stop there (readout mm)", +((await page.textContent("#layerInfo")).match(/· ([\d.]+) mm/) || [0, 0])[1], "<=", 7.01));
    // the layers view lights its beads (shape and layer texture readable): a wide spread of brightness, not one flat brown
    await page.click("label[for=stLayers]"); await A.idle(page);   // still the model, on the 3D tab
    const spread = await page.$eval("#stackView", (cv) => { const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data, L = [];
      for (let i = 0; i < d.length; i += 16) if (d[i + 3] > 200) L.push(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
      L.sort((a, b) => a - b); return L[Math.floor(L.length * 0.9)] - L[Math.floor(L.length * 0.1)]; });
    checks.push(check("layers view, solid: brightness spread over the beads (10–90%, of 255)", spread, ">", 20));
    checks.push(check("page errors", errors.length, "==", 0));
    await close(); return { checks };
  },
};
