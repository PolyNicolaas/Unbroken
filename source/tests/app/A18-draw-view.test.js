const A = require("../lib/app.js"), { check } = require("../lib/check.js"), fs = require("fs");
module.exports = {
  slow: true,
  id: "A18", title: "3D → 2D: Draw this view turns a model into a traced line drawing",
  guards: "a drawing preview that doesn't follow the fold angle, a drawing that doesn't become the traced picture, and losing the model or the drawing when switching sources",
  why: "A model's 2D life (the pen plotter, or a single chocolate line of it) goes through a line drawing of one view: Draw this view renders it (hidden lines removed) and hands it to the tracer like any picture. The model stays loaded so the view can be changed and drawn again.",
  how: "Picks 3D model (the sample vase), turns on the drawing preview and reads how much of the preview is drawn at folds over 60° and over 1°. Sets 20°, exports the drawing as SVG and reads it, then presses Draw this view, waits for the trace, goes to the 2D tab, then switches to 3D model and back to Image.",
  pass: "The drawing preview draws less at 60° than at 1°; Export SVG saves sample-vase-view.svg at the vase's size in mm (plus a 5 mm margin each side) with its edge pieces joined into under half as many strokes; Draw this view switches to Image with the source named 'sample vase · drawing' and traces it (terms in the readout); the 2D tab places the pen line on the page; 3D model brings the vase back, and Image brings the drawing back; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx), checks = [];
    const ink = () => page.$eval("#view", (c) => { const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; });
    await A.source(page, "model"); await page.waitForTimeout(1200);
    await page.check("#hlPreview"); await A.setValue(page, "#crease", 60); await page.waitForTimeout(400);
    const at60 = await ink();
    await A.setValue(page, "#crease", 1); await page.waitForTimeout(400);
    const at1 = await ink();
    checks.push(check("drawing preview: ink at 60° ÷ at 1°", at60 / Math.max(1, at1), "<", 0.9));
    await A.setValue(page, "#crease", 20); await page.waitForTimeout(200);   // traceable: outline and sharper folds
    // the drawing as vectors, before tracing
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#drawSvg")]);
    const svg = fs.readFileSync(await dl.path(), "utf8"), wh = (svg.match(/width="([\d.]+)mm" height="([\d.]+)mm"/) || []).slice(1).map(Number);
    const strokes = (svg.match(/M[\d.]/g) || []).length, pieces = +((await page.textContent("#drawMsg")).match(/\((\d+) visible edge pieces\)/) || [0, 0])[1];
    checks.push(check("Export SVG: file name", +(dl.suggestedFilename() === "sample-vase-view.svg"), "==", 1));
    checks.push(check("Export SVG: drawing height off the vase's view (40 mm tall, seen tipped: 30–55 mm + 10 mm margin)", +(wh[1] > 40 && wh[1] < 65), "==", 1));
    checks.push(check("Export SVG: strokes (pieces joined where they meet)", strokes, ">", 0));
    checks.push(check("Export SVG: fewer strokes than edge pieces (×)", strokes / Math.max(1, pieces), "<", 0.5));
    await page.click("#drawView"); await page.waitForTimeout(800); await A.idle(page, 1500);
    checks.push(check("Draw this view: source is the drawing", +((await page.textContent("#srcinfo")) === "sample vase · drawing" && (await page.isChecked("#srcImage"))), "==", 1));
    checks.push(check("the drawing is traced (terms)", await A.terms(page), ">", 20));
    await page.click("label[for=view2D]"); await page.waitForTimeout(500); await A.idle(page, 800);
    for (let i = 0; i < 40 && !/mm on/.test(await page.textContent("#plotInfo")); i++) await page.waitForTimeout(500);
    checks.push(check("2D tab: the pen line is on the page", +/mm on/.test(await page.textContent("#plotInfo")), "==", 1));
    await page.click("label[for=viewDesign]"); await A.source(page, "model"); await page.waitForTimeout(1000);
    checks.push(check("3D model: the vase is back", +/^sample vase · /.test(await page.textContent("#chip")), "==", 1));
    await A.source(page, "picture"); await A.idle(page, 1500);
    checks.push(check("pictures shown again: the drawing is one of them", +(await page.textContent("#srcinfo")).includes("sample vase · drawing"), "==", 1));
    checks.push(check("page errors", errors.length, "==", 0));
    await close(); return { checks, notes: `preview ink: ${at1} px at 1°, ${at60} px at 60°` };
  },
};
