// Unbroken · web app · cutout.js
// Cut out the object (Image prep): drag a box round the thing to keep on the preview; what's in the box that looks
// like what's outside it (the floor it stands on, the wall behind) is removed (UNB.cutout, engine 15-cutout.js, in its
// own worker). Keep and Remove strokes fix what it gets wrong. Everything but the object is white paper before Image
// prep, Grey levels and the trace (pipeline.js working).
// st.cutout: { src (the picture it belongs to), box [u0, v0, u1, v1], strokes ([{ keep, pts: [u, v, u, v, …], r }],
// in the order painted) — all as shares of the picture's width and height — and mask (a canvas: white where removed,
// clear where kept), share, ver }.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

const CUT = makeEngine("cutout"); // engine-bridge.js
BARS.cut = "cutbar"; // tools.js
BTNS.cut = "cutBtn";
st.cutout = null;
const cutoutMode = () => (document.querySelector('input[name="cutMode"]:checked') || {}).value || "box";
const cutoutOn = () => !!(st.cutout && st.cutout.src === (st.source && st.source.__id));

// ---------- the mask, worked out in the background ----------
let cutoutSeq = 0;
// what the cut-out was made on, beyond its canvas: a photo cleaned again (another Light, the same page corners and
// turn) is the same picture, so the cut-out stays with it
function cutoutPicNow() {
  const P = st.art && st.art.kind === "picture" ? st.art.picture : null,
    s = st.source;
  return {
    raw: P && P.photo ? P.photo.raw : null,
    look: P && P.photo ? JSON.stringify([P.photo.corners, P.turn || 0, P.angle || 0]) : "",
    w: s ? s.width : 0,
    h: s ? s.height : 0,
  };
}
// A new source (source.js setSource, canvas already tagged): true when the cut-out belongs to it (the same canvas, or
// the same photo cleaned again), and then it's pointed at the new canvas.
function cutoutKeepFor(canvas) {
  const C = st.cutout;
  if (!C || !canvas) return false;
  if (C.src === canvas.__id) return true;
  const P = cutoutPicNow();
  if (!C.raw || P.raw !== C.raw || P.look !== C.look || canvas.width !== C.w || canvas.height !== C.h) return false;
  C.src = canvas.__id;
  C.ver = (C.ver || 0) + 1;
  return true;
}
// a run no longer wanted (the cut-out cleared or started again): dropped, and the busy chip off
function cutoutStop() {
  cutoutSeq++;
  CUT.cancel();
  busyFor("cutout", false); // ui.js
}
async function cutoutRun() {
  const C = st.cutout,
    src = st.source;
  if (!C || !src || !C.box) return;
  // a run started by undo, redo or opening a design (history.js) isn't a new step
  const quiet = typeof restoring !== "undefined" && restoring;
  if (C.src === src.__id) Object.assign(C, cutoutPicNow());
  CUT.cancel(); // (an older run's mask is no longer wanted)
  const my = ++cutoutSeq,
    k = Math.min(1, 640 / Math.max(src.width, src.height)),
    w = Math.max(8, Math.round(src.width * k)),
    h = Math.max(8, Math.round(src.height * k)),
    c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.fillStyle = "#fff";
  g.fillRect(0, 0, w, h);
  g.drawImage(src, 0, 0, w, h);
  const px = (s) => s.map((v, i) => v * (i % 2 ? h : w));
  $("cutVal").textContent = "working…";
  busyFor("cutout", true); // ui.js
  let r;
  try {
    r = await CUT.call("cutout", [
      g.getImageData(0, 0, w, h).data,
      w,
      h,
      {
        box: px(C.box),
        // each stroke with its own brush size
        keep: C.strokes.filter((s) => s.keep).map((s) => ({ pts: px(s.pts), r: (s.r || 0.02) * w })),
        drop: C.strokes.filter((s) => !s.keep).map((s) => ({ pts: px(s.pts), r: (s.r || 0.02) * w })),
        brush: 0.02 * w,
      },
    ]);
  } catch (e) {
    if (e !== CANCELLED) toast("The object couldn't be cut out: " + ((e && e.message) || e), true);
    return;
  } finally {
    if (my === cutoutSeq) busyFor("cutout", false); // (a newer run keeps it on)
  }
  if (my !== cutoutSeq || st.cutout !== C) return; // a newer box or stroke is on its way
  // the mask as a canvas: white (opaque) where removed, clear where kept; drawn scaled up, its edge comes out soft
  const m = document.createElement("canvas");
  m.width = r.mw;
  m.height = r.mh;
  const mg = m.getContext("2d"),
    im = mg.createImageData(r.mw, r.mh);
  for (let i = 0; i < r.mw * r.mh; i++) {
    im.data[4 * i] = im.data[4 * i + 1] = im.data[4 * i + 2] = 255;
    im.data[4 * i + 3] = r.mask[i] ? 0 : 255;
  }
  mg.putImageData(im, 0, 0);
  Object.assign(C, { mask: m, share: r.share, ver: (C.ver || 0) + 1 });
  cutoutUI();
  if (st.tool === "cut") render();
  // (a mask worked out again for undo, redo or a design file: its trace belongs to that step, not a new one)
  if (quiet) autoRun = true; // controls.js
  schedule(extract); // controls.js: traced (or shown) from the cut-out picture
  if (!quiet) recordSoon();
}
// the working image (pipeline.js working): the parts of the picture that aren't the object painted white
function cutoutApply(g, sx, sy, sw, sh, w, h) {
  if (!cutoutOn() || !st.cutout.mask) return;
  const m = st.cutout.mask,
    kx = m.width / st.source.width,
    ky = m.height / st.source.height;
  g.save();
  g.imageSmoothingEnabled = true;
  g.drawImage(m, sx * kx, sy * ky, sw * kx, sh * ky, 0, 0, w, h);
  g.restore();
}
const cutoutKey = () => (cutoutOn() && st.cutout.mask ? st.cutout.ver : 0);

// ---------- the tool ----------
function cutoutUI() {
  const on = cutoutOn() && st.cutout.mask;
  $("cutVal").textContent = on ? `${Math.round(st.cutout.share * 100)}% of the box kept` : "off";
  $("cutClear").hidden = !cutoutOn();
  $("cutBtn").textContent = st.tool === "cut" ? "Done" : on ? "Edit the cut-out" : "Select the object";
  $("cutHint").textContent =
    cutoutMode() === "box"
      ? "Drag a box round the object to keep."
      : cutoutMode() === "keep"
        ? "Paint over parts of the object that went missing."
        : "Paint over what isn't the object (a shadow, a bit of floor).";
  for (const id of ["cutMkeep", "cutMdrop", "cutUndo", "cutStart"]) $(id).disabled = !cutoutOn();
}
// the picture (not cut) with what's removed whitened, the box dashed, the stroke being painted
function renderCutout() {
  if (!st.w || !st.source) return;
  const v = view(),
    { g, k, ox, oy, dpr } = v,
    c = st.crop,
    src = st.source;
  g.clearRect(0, 0, v.cv.width, v.cv.height);
  g.imageSmoothingEnabled = true;
  // the whole picture's place in the view (the working image may be cropped by Select area)
  const X = ox - c.sx * c.kx * k,
    Y = oy - c.sy * c.ky * k,
    W = src.width * c.kx * k,
    H = src.height * c.ky * k;
  g.drawImage(src, X, Y, W, H);
  if (cutoutOn() && st.cutout.mask) {
    g.globalAlpha = 0.78;
    g.drawImage(st.cutout.mask, X, Y, W, H);
    g.globalAlpha = 1;
  }
  const box = st.draft && st.draft.cut === "box" ? st.draft.box : cutoutOn() ? st.cutout.box : null;
  if (box) {
    g.save();
    g.strokeStyle = css("--accent");
    g.lineWidth = 2 * dpr;
    g.setLineDash([6 * dpr, 4 * dpr]);
    g.strokeRect(X + box[0] * W, Y + box[1] * H, (box[2] - box[0]) * W, (box[3] - box[1]) * H);
    g.restore();
  }
  // the strokes: keep in the accent, remove in the warning colour
  const paint = (s, keep, r) => {
    g.save();
    g.strokeStyle = keep ? css("--accent") : css("--warn");
    g.globalAlpha = 0.55;
    g.lineWidth = 2 * r * W;
    g.lineCap = g.lineJoin = "round";
    g.beginPath();
    for (let i = 0; i < s.length; i += 2) (i ? g.lineTo : g.moveTo).call(g, X + s[i] * W, Y + s[i + 1] * H);
    if (s.length === 2) g.lineTo(X + s[0] * W + 0.1, Y + s[1] * H);
    g.stroke();
    g.restore();
  };
  if (cutoutOn()) for (const s of st.cutout.strokes) paint(s.pts, s.keep, s.r);
  if (st.draft && st.draft.cut === "paint") paint(st.draft.pts, st.draft.keep, st.draft.r);
}
// a point on the preview → a share of the picture's width and height
const cutoutUV = (e) => {
  const [x, y] = workXY(e); // tools.js
  const [u, v] = fromWork(x, y); // source.js
  return [Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, v))];
};
// (px on screen)
const cutoutBrush = () => (+$("cutBrushSize").value * view().dpr) / view().k / st.crop.kx / st.source.width;
// pointer handling, from tools.js
function cutoutDown(e) {
  const p = cutoutUV(e);
  if (cutoutMode() === "box" || !cutoutOn()) st.draft = { cut: "box", a: p, box: [p[0], p[1], p[0], p[1]] };
  else st.draft = { cut: "paint", keep: cutoutMode() === "keep", r: cutoutBrush(), pts: [...p] };
  renderCutout();
}
function cutoutMove(e) {
  const d = st.draft,
    p = cutoutUV(e);
  if (d.cut === "box")
    d.box = [Math.min(d.a[0], p[0]), Math.min(d.a[1], p[1]), Math.max(d.a[0], p[0]), Math.max(d.a[1], p[1])];
  else d.pts.push(...p);
  renderCutout();
}
function cutoutUp(d) {
  if (d.cut === "box") {
    const b = d.box;
    if ((b[2] - b[0]) * (b[3] - b[1]) < 0.002) return renderCutout(); // a stray tap
    const C = cutoutOn() ? st.cutout : null;
    st.cutout = {
      src: st.source.__id,
      box: b,
      strokes: C ? C.strokes : [],
      mask: C ? C.mask : null,
      ver: C ? C.ver : 0,
    };
    // a box drawn: go on to fixing it
    $("cutMkeep").checked = true;
  } else {
    if (!cutoutOn()) return renderCutout(); // (the cut-out went while the stroke was painted)
    st.cutout.strokes.push({ keep: d.keep, pts: d.pts, r: d.r });
  }
  cutoutUI();
  renderCutout();
  cutoutRun();
}
function cutoutEnter() {
  if (!cutoutOn()) $("cutMbox").checked = true;
  // a phone's pinned preview is small to draw on: the big one (scroll.js, Bigger)
  if (innerWidth < 900 && document.body.dataset.pv !== "big") $("pvSize").click();
  enterTool("cut"); // tools.js
  cutoutUI();
}
$("cutBtn").addEventListener("click", () => {
  if (st.tool === "cut") exitTool();
  else cutoutEnter();
  cutoutUI();
});
$("cutDone").addEventListener("click", () => {
  exitTool();
  cutoutUI();
  render();
});
$("cutUndo").addEventListener("click", () => {
  const C = st.cutout;
  if (!cutoutOn()) return;
  // the last stroke, or the box when there are none
  if (C.strokes.length) {
    C.strokes.pop();
    cutoutRun();
  } else {
    st.cutout = null;
    cutoutStop();
    $("cutMbox").checked = true;
    schedule(extract);
  }
  cutoutUI();
  renderCutout();
});
function cutoutClear() {
  if (!st.cutout) return;
  st.cutout = null;
  cutoutStop();
  if (st.tool === "cut") exitTool();
  cutoutUI();
  schedule(extract);
  recordSoon();
}
$("cutClear").addEventListener("click", cutoutClear);
$("cutStart").addEventListener("click", () => {
  st.cutout = null;
  cutoutStop();
  $("cutMbox").checked = true;
  cutoutUI();
  renderCutout();
  schedule(extract);
});
document.querySelectorAll('input[name="cutMode"]').forEach((r) => r.addEventListener("change", cutoutUI));
cutoutUI();
