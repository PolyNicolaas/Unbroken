const A = require("../lib/app.js"), { check } = require("../lib/check.js");
const pt = (page, u, v) => page.evaluate(([u, v]) => { const c = st.crop, src = st.source, vw = view(), r = vw.rect; return [r.left + (vw.ox + (u * src.width - c.sx) * c.kx * vw.k) / vw.dpr, r.top + (vw.oy + (v * src.height - c.sy) * c.ky * vw.k) / vw.dpr]; }, [u, v]);
const drag = async (page, a, b, n = 6) => { await page.mouse.move(...a); await page.mouse.down(); for (let i = 1; i <= n; i++) await page.mouse.move(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n); await page.mouse.up(); };
const pic = (page) => page.evaluate(() => { const P = st.art.picture; return { turn: P.turn || 0, orig: !!P.orig, photo: !!P.photo, kind: P.photo && P.photo.kind, w: st.source.width, h: st.source.height, val: $("picAngleVal").textContent, on: cutoutOn(), rows: !$("photoRows").hidden, hi, n: hist.length, redo: !$("redoBtn").disabled }; });
module.exports = {
  id: "A44", title: "The picture's turn and photo through undo, Clean up as a photo, corners, the cut-out kept, the camera opened twice",
  guards: "undo losing the picture's turn (the card saying 0° on a turned picture, Unturn doing nothing) or its photo (the Photo card gone, Redo not bringing it back); Clean up as a photo starting from the unturned picture; corners dragged into a bow-tie or a point; the cut-out dropped by a Photo card change or by Text and back; undo into a cut-out wiping Redo; the busy chip going off while a cut-out still works; a camera left running after Switch camera and Cancel",
  why: "Undo kept only the picture's canvas, not its turn, the picture as loaded or its photo. Every picture handed to the trace was a new source, so the cut-out was forgotten, and a restored cut-out's mask, worked out again, made a new undo step that cut off Redo. The camera's start and Switch camera could overlap.",
  how: "The leaf example: turn right, change Sensitivity, Undo, then Unturn. Turn right again, Clean up as a photo: corners nearly together, then a bow-tie, Use it. Printed, Undo, Redo. Object, a box round the leaf, Light 30. Text and back to Picture, Undo twice. Two quick Remove strokes while watching the busy chip. Last, a fake slow camera: Take a picture, Switch camera at once, Cancel.",
  pass: "After Undo the picture is still 90° turned (the card says so) with its original, and Unturn turns it back; Clean up as a photo starts from the turned picture; corners nearly together are refused (the camera stays open, a message); a bow-tie is untangled; Undo after Printed keeps the Photo card (Drawing), Redo brings Printed; the cut-out stays through the Light change and Text and back; undoing back to it leaves Redo on and the steps as they were; the busy chip is on all the while the cut-out works; after Cancel no camera is live; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx, { example: "leaf", art: true, viewport: { width: 1180, height: 820 } }), checks = [];
    await A.idle(page, 1500);
    await page.click("#picRight"); await A.idle(page, 1500);
    await A.setValue(page, "#sens", 30); await page.waitForTimeout(600); await A.idle(page, 1500);
    await page.click("#undoBtn"); await A.idle(page, 1500);
    const u = await pic(page);
    checks.push(check("Undo after a turn: still turned, its original kept, the card says so", +(u.turn === 1 && u.orig && /90° turned/.test(u.val)), "==", 1));
    await page.click("#picUnturn"); await A.idle(page, 1500);
    const un = await pic(page);
    checks.push(check("… Unturn turns it back (wider than tall)", +(un.w > un.h && un.turn === 0), "==", 1));
    // Clean up as a photo: what's shown (turned)
    await page.click("#picRight"); await A.idle(page, 1500);
    await page.click("#picPhoto"); await page.waitForTimeout(300);
    const still = await page.evaluate(() => [cam.still.width, cam.still.height, st.source.width, st.source.height]);
    checks.push(check("Clean up as a photo: the turned picture (taller than wide)", +(still[1] > still[0] && still[0] / still[1] - still[2] / still[3] < 0.02), "==", 1));
    const [W, H] = still;
    await page.evaluate(() => { cam.corners = [[50, 50], [52, 50], [52, 52], [50, 52]]; });
    await page.click("#camUse"); await page.waitForTimeout(200);
    const tiny = await page.evaluate(() => ({ open: !$("camera").hidden, msg: $("camMsg").textContent }));
    checks.push(check("corners nearly together: refused, the camera still open with a message", +(tiny.open && /too close/.test(tiny.msg)), "==", 1));
    await page.evaluate(([W, H]) => { cam.corners = [[10, 10], [W - 10, H - 10], [W - 10, 10], [10, H - 10]]; }, [W, H]);
    await page.click("#camUse"); await A.idle(page, 3000);
    const bow = await page.evaluate(() => st.art.picture.photo && st.art.picture.photo.corners);
    checks.push(check("a bow-tie of corners: untangled (top-left, top-right, bottom-right, bottom-left)", JSON.stringify(bow), "==", JSON.stringify([[10, 10], [W - 10, 10], [W - 10, H - 10], [10, H - 10]])));
    // the photo through undo and redo
    await page.click("label[for=phKprint]"); await A.idle(page, 3000);
    await page.click("#undoBtn"); await A.idle(page, 2000);
    const pu = await pic(page);
    await page.click("#redoBtn"); await A.idle(page, 2000);
    const pr = await pic(page);
    checks.push(check("Undo after Printed: the Photo card stays (Drawing); Redo: Printed", +(pu.photo && pu.kind === "drawing" && pu.rows && pr.photo && pr.kind === "print"), "==", 1));
    // an object photo cut out, then its Light changed
    await page.click("label[for=phKobject]"); await A.idle(page, 3000);
    await page.evaluate(() => $("card-h-prep").classList.remove("collapsed"));
    await page.click("#cutBtn"); await page.waitForTimeout(200);
    await drag(page, await pt(page, 0.1, 0.1), await pt(page, 0.9, 0.9));
    await page.waitForFunction(() => !CUT.busy && st.cutout && st.cutout.mask, null, { timeout: 15000 }); await A.idle(page, 2000);
    await page.click("#cutDone"); await A.idle(page, 1500);
    await A.setValue(page, "#phLight", 30); await A.idle(page, 3000);
    const lit = await pic(page);
    checks.push(check("Photo card Light changed: the cut-out stays", +(lit.on && (await page.evaluate(() => st.art.picture.photo.light)) === 30), "==", 1));
    await page.evaluate(() => artUse("text")); await A.idle(page, 2000);
    await page.evaluate(() => artUse("picture")); await A.idle(page, 2000);
    const back = await pic(page);
    checks.push(check("Text and back to Picture: the cut-out stays", +back.on, "==", 1));
    await page.click("#undoBtn"); await A.idle(page, 2500);
    await page.click("#undoBtn"); await A.idle(page, 3000);
    const ud = await pic(page);
    checks.push(check("undone back to the cut-out: Redo still on, no step added", +(ud.on && ud.redo && ud.n === back.n && ud.hi === back.hi - 2), "==", 1));
    // two quick strokes: the busy chip stays on while the cut-out works
    const offs = await page.evaluate(async () => {
      st.cutout.strokes.push({ keep: false, pts: [0.6, 0.83, 0.7, 0.83], r: 0.01 }); cutoutRun();
      st.cutout.strokes.push({ keep: false, pts: [0.3, 0.83, 0.4, 0.83], r: 0.01 }); cutoutRun();
      let off = 0; const t0 = performance.now();
      while (CUT.busy && performance.now() - t0 < 15000) { if (!$("chip").classList.contains("busy")) off++; await new Promise((r) => setTimeout(r, 50)); }
      return off;
    });
    checks.push(check("busy chip off while the cut-out works (times seen)", offs, "==", 0));
    await A.idle(page, 2000);
    // the camera opened twice while starting
    await page.evaluate(() => {
      window.__streams = [];
      navigator.mediaDevices.getUserMedia = () => new Promise((res) => setTimeout(() => { const c = document.createElement("canvas"); c.width = 320; c.height = 240; const g = c.getContext("2d"); g.fillStyle = "#888"; g.fillRect(0, 0, 320, 240); const s = c.captureStream(10); window.__streams.push(s); res(s); }, 500));
    });
    await page.click("#picCamera"); await page.waitForTimeout(100);
    await page.click("#camFlip"); await page.waitForTimeout(1300);
    const two = await page.evaluate(() => ({ made: __streams.length, live: __streams.filter((s) => s.getTracks().some((t) => t.readyState === "live")).length }));
    await page.click("#camCancel"); await page.waitForTimeout(300);
    const left = await page.evaluate(() => __streams.filter((s) => s.getTracks().some((t) => t.readyState === "live")).length + (cam.timer ? 1 : 0));
    checks.push(check("camera started twice: live at once (of 2 made)", two.live, "==", 1), check("… after Cancel: cameras live and looks running", left, "==", 0));
    checks.push(check("page errors", errors.length, "==", 0));
    await close();
    return { checks, notes: `turned ${u.w}×${u.h}; steps ${back.n}` + (errors.length ? "  \n" + errors.join("  \n") : "") };
  },
};
