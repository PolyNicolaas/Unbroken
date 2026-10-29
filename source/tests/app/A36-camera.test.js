const A = require("../lib/app.js"), { check } = require("../lib/check.js"), { pagePhoto } = require("../lib/photos.js");
// the synthetic page photo as a camera: a canvas streamed as video (getUserMedia replaced), or a camera that refuses
async function fakeCamera(page, P, refuse) {
  await page.evaluate(({ b64, w, h, refuse }) => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d"), img = new ImageData(Uint8ClampedArray.from(atob(b64), (ch) => ch.charCodeAt(0)), w, h);
    g.putImageData(img, 0, 0);
    setInterval(() => g.putImageData(img, 0, 0), 60); // (a stream only sends frames when the canvas is drawn)
    window.__photoPNG = c.toDataURL("image/png");
    navigator.mediaDevices.getUserMedia = refuse
      ? async () => { throw new DOMException("no", "NotAllowedError"); }
      : async () => (window.__stream = c.captureStream(20));
  }, { b64: Buffer.from(P.rgba.buffer).toString("base64"), w: P.w, h: P.h, refuse });
}
module.exports = {
  id: "A36", title: "Take a picture: the live camera finds the page, its corners can be dragged, and the photo becomes a clean picture",
  guards: "the camera not opening, the page not outlined, corners that can't be dragged, a photo that isn't straightened or cleaned, the camera left running, the Photo card's settings not cleaning it again, Page corners or Clean up as a photo not working, and a refused camera leaving no way in",
  why: "On an iPad or phone the quickest way in is a photo of a drawing (v110): a live camera in the preview (full screen on a phone) outlines the page it finds, the photo taken has its four corners to drag, and Use it straightens and cleans it into the picture to trace. The Photo card cleans it again as a drawing, printed art, an object or as taken; Clean up as a photo does the same to an image chosen. Without a live camera the device's own camera or photos open instead.",
  how: "Opens the app empty with a fake camera: a 800 × 600 photo of a page at an angle on a table, with a shadow. Taps Take a picture on the empty preview, waits for the outline, takes it, drags a corner and back, and uses it. Then on the Photo card picks Printed and As taken, opens Page corners and cancels. Then the leaf example, Clean up as a photo: checks each corner can be grabbed and drags one from beside it; Use it. Last, a camera that refuses: Take a picture opens the file chooser, and the photo given goes to the corners.",
  pass: "The live view says the page is found and outlines it; taken, the corners are within 6 px of the page's (on the 800 × 600 photo); a dragged corner moves by the distance dragged (within 3 px) and back; Use it closes the camera and stops its stream, and the picture is the page's shape (within 6%) with a photo label and a trace; Printed cleans it again (a new picture, Printed's settings) and As taken turns the cleaning sliders off; Page corners opens the corners and Cancel leaves the picture as it was; the leaf cleaned as a photo finds no page (it fills the frame), so the whole picture is used, and its four corners (on the photo's edges) are all grabbable, clear of the message and buttons, and a press near a corner (not on it) drags it without it jumping; the refused camera opens the file chooser, and its photo's page is found; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx, { clean: true, viewport: { width: 1180, height: 820 } }), checks = [];
    const corners = [[190, 95], [620, 125], [690, 520], [120, 500]], P = pagePhoto({ w: 800, h: 600, corners });
    await fakeCamera(page, P);
    await page.click("#esCamera");
    await page.waitForFunction(() => /Page found/.test($("camMsg").textContent), null, { timeout: 8000 }).catch(() => {});
    checks.push(check("live: the page found and outlined", +(/Page found/.test(await page.textContent("#camMsg")) && (await page.getAttribute("#camPoly", "data-on")) === "1"), "==", 1));
    await page.click("#camTake"); await page.waitForTimeout(300);
    const got = await page.evaluate(() => cam.corners.map((p) => p.slice()));
    checks.push(check("taken: corners off by (px, worst)", Math.max(...got.map((c, i) => Math.hypot(c[0] - corners[i][0], c[1] - corners[i][1]))), "<=", 6));
    // drag the bottom-right corner 40 px right and 30 down on the screen, then back
    const h = page.locator("#camHandles .cam-handle").nth(2), b = await h.boundingBox(), k = await page.evaluate(() => stillFit().k);
    const drag = async (x0, y0, x1, y1) => { await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2); await page.mouse.move(x1, y1); await page.mouse.up(); };
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    await drag(cx, cy, cx + 40, cy + 30);
    const moved = await page.evaluate(() => cam.corners[2].slice());
    checks.push(check("dragged corner: off from the drag (photo px)", Math.hypot(moved[0] - got[2][0] - 40 / k, moved[1] - got[2][1] - 30 / k), "<=", 3 / k + 1));
    await drag(cx + 40, cy + 30, cx, cy);
    await page.click("#camUse"); await A.idle(page, 4000);
    const pic = await page.evaluate(() => ({ cam: $("camera").hidden, live: !!(window.__stream && window.__stream.getTracks().some((t) => t.readyState === "live")), label: st.art.picture.label, w: st.art.picture.canvas.width, h: st.art.picture.canvas.height, photo: !!st.art.picture.photo, id: st.art.picture.canvas.__art, chip: $("chip").textContent, empty: document.body.dataset.empty }));
    const d = (a, c) => Math.hypot(a[0] - c[0], a[1] - c[1]), aspect = (d(corners[0], corners[1]) + d(corners[3], corners[2])) / (d(corners[0], corners[3]) + d(corners[1], corners[2]));
    checks.push(check("Use it: camera closed and its stream stopped", +(pic.cam && !pic.live), "==", 1),
      check("… the picture is the page's shape (off by)", Math.abs(pic.w / pic.h / aspect - 1), "<=", 0.06),
      check("… a photo, labelled so, traced", +(pic.photo && /^photo /.test(pic.label) && /terms/.test(pic.chip) && !pic.empty), "==", 1));
    // the Photo card
    await page.evaluate(() => $("card-h-pic").classList.remove("collapsed"));
    await page.click("label[for=phKprint]"); await A.idle(page, 3000);
    const pr = await page.evaluate(() => ({ kind: st.art.picture.photo.kind, light: st.art.picture.photo.light, id: st.art.picture.canvas.__art, val: $("photoVal").textContent }));
    checks.push(check("Printed: cleaned again with its settings", +(pr.kind === "print" && pr.light === 70 && pr.id !== pic.id && /printed art, straightened/.test(pr.val)), "==", 1));
    await page.click("label[for=phKnone]"); await A.idle(page, 3000);
    checks.push(check("As taken: the cleaning sliders off", +(await page.evaluate(() => $("phLight").disabled && $("phInk").disabled && st.art.picture.photo.kind === "none")), "==", 1));
    const before = await page.evaluate(() => st.art.picture.canvas.__art);
    await page.click("#phCorners"); await page.waitForTimeout(300);
    const ed = await page.evaluate(() => ({ open: !$("camera").hidden, mode: $("camera").dataset.mode, from: cam.from }));
    await page.click("#camRetake"); await A.idle(page, 500);
    checks.push(check("Page corners: the corners open; Cancel leaves the picture", +(ed.open && ed.mode === "edit" && ed.from === "picture" && (await page.evaluate(() => $("camera").hidden)) && (await page.evaluate(() => st.art.picture.canvas.__art)) === before), "==", 1));
    // an image chosen, cleaned up as a photo
    await page.click("[data-examples] [data-example=leaf]:visible"); await A.idle(page, 1500);
    await page.click("#picPhoto"); await page.waitForTimeout(300);
    const msg = await page.textContent("#camMsg");
    // the corners are the photo's own corners: each must be grabbable (not under the message or the buttons)
    const grab = await page.evaluate(() => { const F = stillFit(), r = $("camQuad").getBoundingClientRect(); return cam.corners.filter(([x, y]) => { const el = document.elementFromPoint(r.left + F.x + x * F.k, r.top + F.y + y * F.k); return el && el.classList.contains("cam-hit"); }).length; });
    checks.push(check("corners on the photo's edges: grabbable (of 4)", grab, "==", 4));
    // a touch near a corner (not on its ring) grabs it, and it keeps its distance from the finger
    const near = await page.evaluate(() => { const F = stillFit(), r = $("camQuad").getBoundingClientRect(), [x, y] = cam.corners[2]; return [r.left + F.x + x * F.k - 20, r.top + F.y + y * F.k - 15]; });
    const c0 = await page.evaluate(() => cam.corners[2].slice());
    await page.mouse.move(near[0], near[1]); await page.mouse.down(); await page.mouse.move(near[0] - 20, near[1] - 20); await page.mouse.move(near[0] - 40, near[1] - 40); await page.mouse.up();
    const c1 = await page.evaluate(() => cam.corners[2].slice()), kk = await page.evaluate(() => stillFit().k);
    checks.push(check("a press near a corner grabs it: moved by the drag (px off, screen)", Math.hypot((c1[0] - c0[0]) * kk + 40, (c1[1] - c0[1]) * kk + 40), "<=", 2));
    await page.evaluate((c) => { cam.corners[2] = c; }, c0);
    await page.click("#camUse"); await A.idle(page, 3000);
    checks.push(check("Clean up as a photo (the leaf): no page, the whole picture used", +(/No page found/.test(msg) && (await page.evaluate(() => !!st.art.picture.photo && !st.art.picture.photo.corners))), "==", 1));
    // a camera that refuses: the file chooser, and the photo it gives
    await fakeCamera(page, P, true);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser", { timeout: 5000 }), page.click("#picCamera")]);
    const png = Buffer.from((await page.evaluate(() => window.__photoPNG)).split(",")[1], "base64");
    await chooser.setFiles({ name: "IMG_0001.png", mimeType: "image/png", buffer: png }); await page.waitForTimeout(800);
    checks.push(check("refused camera: the file chooser, its photo's page found", +(/Page found/.test(await page.textContent("#camMsg")) && (await page.evaluate(() => $("camera").dataset.mode)) === "edit"), "==", 1));
    await page.keyboard.press("Escape");
    checks.push(check("page errors", errors.filter((e) => !/toast|NotAllowed/.test(e)).length, "==", 0));
    await close();
    return { checks, notes: errors.join("  \n") };
  },
};
