const A = require("../lib/app.js"), { check } = require("../lib/check.js");
const S = "/tmp/claude-0/-home-claude/e9e4f4f9-2ae9-5bd7-8ead-5f32a6a72642/scratchpad";
module.exports = { id: "A98", title: "dbg", slow: true, needs: ["browser"], async run(ctx) {
  const { page, errors, close } = await A.open(ctx); const out = [];
  const box = await (await page.$("#view")).boundingBox(), at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
  const drag = async (a, b) => { await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, { steps: 6 }); await page.mouse.move(...b, { steps: 6 }); await page.mouse.up(); };
  await page.click("#eraseBtn"); await page.click("label[for=erBrush]");
  const box2 = await (await page.$("#view")).boundingBox(); out.push(JSON.stringify(box) + " → " + JSON.stringify(box2));
  await drag(at(0.3, 0.5), at(0.7, 0.5)); await A.idle(page, 800);
  out.push(await page.evaluate(() => JSON.stringify({ tool: st.tool, erase: (st.erase || []).length, node: mapOpenId, view: document.body.dataset.view })));
  await page.screenshot({ path: S + "/dbg.png" });
  await close(); return { checks: [check("x", 1, "==", 1)], notes: out.join("  \n") + errors.join(" ") };
} };
