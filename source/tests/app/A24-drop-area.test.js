const A = require("../lib/app.js"), M = require("../lib/meshes.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A24", title: "One drop area for every input file",
  guards: "an STL or a design file dropped on the page being refused as 'not an image', a drop area that doesn't open the file chooser, and a wrong file changing anything",
  why: "The Input card starts with one drop area: click it to choose a file, or drop one there or anywhere on the page. An image is traced, an STL model is sliced and a saved design is opened, whichever source was showing.",
  how: "Opens the app. Clicks the drop area and waits for the file chooser. Drops an STL (two posts) on the page, then a PNG drawn in the page, then a text file, reading the source each time.",
  pass: "Clicking opens the file chooser; the STL switches to the 3D model source; the PNG switches back to an image; the text file shows a message and leaves the image as it was; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx), checks = [];
    const [chooser] = await Promise.all([page.waitForEvent("filechooser", { timeout: 5000 }).catch(() => null), page.click("#dropZone")]);
    checks.push(check("clicking the drop area opens the file chooser", +!!chooser, "==", 1));
    const drop = (name, type, bytes) => page.evaluate(([name, type, bytes]) => {
      const dt = new DataTransfer(); dt.items.add(new File([new Uint8Array(bytes)], name, { type }));
      document.body.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
    }, [name, type, bytes]);
    await drop("posts.stl", "", [...M.stl([...M.cylinder(5, 10, 0, 0), ...M.cylinder(5, 10, 20, 0)])]);
    await page.waitForTimeout(1500);
    checks.push(check("an STL dropped on the page: the 3D model source", await page.evaluate(() => document.body.dataset.src), "==", "model"));
    const png = await page.evaluate(async () => { const c = document.createElement("canvas"); c.width = 200; c.height = 120; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 200, 120); g.lineWidth = 6; g.beginPath(); g.arc(100, 60, 40, 0, 6.3); g.stroke(); const b = await new Promise((r) => c.toBlob(r, "image/png")); return [...new Uint8Array(await b.arrayBuffer())]; });
    await drop("circle.png", "image/png", png); await A.idle(page, 1500);
    checks.push(check("a PNG dropped: back to the image source", await page.evaluate(() => document.body.dataset.src), "==", "image"));
    const label = await page.evaluate(() => st.srcLabel);
    await drop("notes.txt", "text/plain", [104, 105]); await page.waitForTimeout(300);
    checks.push(check("a text file: a message, and the image stays", +(/isn't a file the tracer opens/.test(await page.textContent("#toast")) && (await page.evaluate(() => st.srcLabel)) === label), "==", 1));
    checks.push(check("page errors", errors.length, "==", 0));
    await close(); return { checks };
  },
};
