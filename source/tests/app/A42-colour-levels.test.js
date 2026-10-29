const A = require("../lib/app.js"), { check } = require("../lib/check.js"), fs = require("fs"), { vaseScene } = require("../lib/photos.js");
module.exports = {
  id: "A42", title: "Colour levels: a picture as flat colours, each block traced or filled with a pen of its own colour",
  guards: "the Colours switch not changing the blocks, blocks that aren't the picture's colours, a filled block's pen not starting with its colour, the SVG without it, and the switch lost by a design file",
  why: "Levels (Art step) can find flat colours instead of greys (v120, UNB.colourLevels): colours that are equally bright stay apart, and a filled block's pen starts with its own colour, so a plotter draws it in colour.",
  how: "Opens the app with a photo of a teal vase on a wooden floor in front of a wall, makes it for a pen plotter, sets 4 levels and picks Colours. Sets the vase's level to Fill, then exports the SVG. Saves the design, picks Greys, opens the design again.",
  pass: "Colours: the card says 4 colours, the swatches are colours (not greys), one of the blocks is the vase's teal (blue and green well over red); the vase's level filled: its pen is that teal, the SVG has a layer drawn in it; the design file brings Colours back; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx, { clean: true, art: true, viewport: { width: 1300, height: 900 } }), checks = [];
    const V = vaseScene({ w: 640, h: 480 });
    await page.evaluate(({ b64, w, h }) => { const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").putImageData(new ImageData(Uint8ClampedArray.from(atob(b64), (ch) => ch.charCodeAt(0)), w, h), 0, 0); artUsePicture(c, "vase"); }, { b64: Buffer.from(V.rgba.buffer).toString("base64"), w: V.w, h: V.h });
    await A.idle(page, 2500);
    await page.click("label[for=artForPlot]"); await A.idle(page, 1500);
    await A.setValue(page, "#levels", 4); await A.idle(page, 3000);
    await page.click("label[for=levelColours]"); await A.idle(page, 3000);
    const L = await page.evaluate(() => ({ val: $("levelsCardVal").textContent, colours: st.wk.levels.colours, sw: [...document.querySelectorAll(".level-swatch")].map((s) => s.style.background) }));
    const teal = L.colours ? L.colours.findIndex(([r, g, b]) => g > r + 30 && b > r + 30) : -1;
    checks.push(check("Colours: 4 colours, coloured swatches, one block the vase's teal", +(/4 colours/.test(L.val) && L.sw.some((c) => { const [r, g, b] = c.match(/\d+/g).map(Number); return !(r === g && g === b); }) && teal >= 0), "==", 1));
    await page.click(`label[for=level${teal}f]`); await A.idle(page, 3000);
    const pen = await page.evaluate((j) => levelFillSpecs()[j].color, teal), hex = "#" + L.colours[teal].map((v) => v.toString(16).padStart(2, "0")).join("");
    checks.push(check("the vase's block filled: its pen starts with its colour", pen, "==", hex));
    await page.click("#goTrace"); await A.idle(page, 1500); await page.click("#goOut"); await A.idle(page, 2000);
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#nbSvg")]);
    const svg = fs.readFileSync(await dl.path(), "utf8");
    checks.push(check("… the SVG draws a layer in it", +svg.toLowerCase().includes(`stroke="${hex}"`), "==", 1));
    const [df] = await Promise.all([page.waitForEvent("download"), page.click("#fileMenu summary").then(() => page.click("#saveDesign"))]);
    const file = await df.path();
    await page.click("label[for=viewArt]"); await page.click("label[for=levelGreys]"); await A.idle(page, 1500);
    await page.setInputFiles("#designFile", file); await A.idle(page, 3000);
    checks.push(check("design file: Colours back", +(await page.isChecked("#levelColours")), "==", 1));
    checks.push(check("page errors", errors.length, "==", 0));
    await close();
    return { checks, notes: JSON.stringify(L.colours) };
  },
};
