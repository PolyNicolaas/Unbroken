// Unbroken · web app · pathpad.js
// The path pad (Pattern card, a path setting such as the Spirograph's Centre path): a path drawn by hand that the
// pattern's centre follows, from its start to its end. The pad shows the figure at rest (faint) and the frame (dashed,
// when the pattern is cropped); a drag draws a new path, which can start outside the frame. Points are kept in the
// pattern's own units (y down, from the figure's centre at rest); the engine smooths them (Smooth the path).
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

const pad = { key: null, pts: [], view: null, ref: null, frame: null, down: false };

function pathPadOpen(key) {
  pad.key = key;
  const p = patternNow(), // patterns.js
    v = p[key];
  pad.pts = Array.isArray(v) ? v.slice() : [];
  // the figure at rest, centred on its centre: drawn cropped to a frame four rings wide, which puts it at a known
  // place (the frame's centre)
  const r = UNB.pattern(p.style, { ...p, [key]: null, frame: "crop", frameW: 400, frameH: 400 });
  pad.ref = r ? r.paths.map((q) => q.map((x, i) => x - (i % 2 ? r.box[1] : r.box[0]) / 2)) : [];
  const ringW = r && r.ringW ? r.ringW : 30;
  pad.frame = p.frame === "crop" ? [((p.frameW || 100) / 100) * ringW, ((p.frameH || 100) / 100) * ringW] : null;
  pad.ringW = ringW;
  $("pathEd").hidden = false;
  document.body.dataset.moled = "1"; // (the same full-screen overlay as the structure editor, on a phone)
  if (innerWidth < 900 && document.body.dataset.pv !== "big") $("pvSize").click();
  requestAnimationFrame(() => {
    pathPadFit();
    pathPadDraw();
  });
  pathPadSay();
}
function pathPadClose() {
  $("pathEd").hidden = true;
  document.body.dataset.moled = "";
  pad.down = false;
}
function pathPadSay(t) {
  $("peMsg").textContent =
    t ||
    (pad.pts.length >= 4 ? `${pad.pts.length / 2} points · Use it, or drag again to draw a new path` : "No path yet");
}
// the world (pattern units) on the canvas: everything within the frame (or three rings) and the path, with room round
function pathPadFit() {
  const c = $("peView"),
    W = c.clientWidth,
    H = c.clientHeight;
  let e = 1.5 * pad.ringW;
  if (pad.frame) e = Math.max(e, 0.6 * Math.max(pad.frame[0], pad.frame[1]));
  for (let i = 0; i < pad.pts.length; i++) e = Math.max(e, 1.1 * Math.abs(pad.pts[i]));
  const k = Math.min(W, H) / (2 * e);
  pad.view = { k, ox: W / 2, oy: H / 2 };
}
const padToScreen = (x, y) => [pad.view.ox + x * pad.view.k, pad.view.oy + y * pad.view.k];
const padToWorld = (x, y) => [(x - pad.view.ox) / pad.view.k, (y - pad.view.oy) / pad.view.k];
function pathPadDraw() {
  const c = $("peView"),
    dpr = devicePixelRatio || 1,
    W = c.clientWidth,
    H = c.clientHeight;
  if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
  }
  const g = c.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const line = (P, color, width, dash) => {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.setLineDash(dash || []);
    g.beginPath();
    for (let i = 0; i < P.length; i += 2) {
      const [x, y] = padToScreen(P[i], P[i + 1]);
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
    g.setLineDash([]);
  };
  g.lineJoin = g.lineCap = "round";
  g.globalAlpha = 0.3;
  for (const P of pad.ref) line(P, css("--ink"), 1);
  g.globalAlpha = 1;
  if (pad.frame) {
    const [fw, fh] = pad.frame;
    line(
      [-fw / 2, -fh / 2, fw / 2, -fh / 2, fw / 2, fh / 2, -fw / 2, fh / 2, -fw / 2, -fh / 2],
      css("--accent"),
      1.5,
      [6, 4]
    );
  }
  if (pad.pts.length >= 4) {
    line(pad.pts, css("--accent"), 2.5);
    const [sx, sy] = padToScreen(pad.pts[0], pad.pts[1]);
    g.fillStyle = css("--accent");
    g.beginPath();
    g.arc(sx, sy, 5, 0, 2 * Math.PI);
    g.fill(); // the start
  }
}
const padXY = (e) => {
  const r = $("peView").getBoundingClientRect();
  return padToWorld(e.clientX - r.left, e.clientY - r.top);
};
$("peView").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  $("peView").setPointerCapture(e.pointerId);
  pad.down = true;
  pad.pts = padXY(e);
  pathPadDraw();
});
$("peView").addEventListener("pointermove", (e) => {
  if (!pad.down) return;
  const [x, y] = padXY(e),
    n = pad.pts.length;
  // a point every few screen pixels
  if (Math.hypot(x - pad.pts[n - 2], y - pad.pts[n - 1]) * pad.view.k < 3) return;
  pad.pts.push(x, y);
  pathPadDraw();
});
const padUp = () => {
  if (!pad.down) return;
  pad.down = false;
  if (pad.pts.length < 4) pad.pts = [];
  pathPadSay();
  pathPadDraw();
};
$("peView").addEventListener("pointerup", padUp);
$("peView").addEventListener("pointercancel", padUp);
for (const ev of ["touchstart", "touchmove"])
  $("peView").addEventListener(ev, (e) => e.preventDefault(), { passive: false });
$("peClear").addEventListener("click", () => {
  pad.pts = [];
  pathPadSay();
  pathPadDraw();
});
$("peCancel").addEventListener("click", pathPadClose);
$("peDone").addEventListener("click", () => {
  const el = $(`artP-${pad.key}`);
  if (el) el.value = JSON.stringify(pad.pts.length >= 4 ? pad.pts.map((v) => Math.round(v * 1000) / 1000) : null);
  pathPadClose();
  patternUI(); // patterns.js
  patternEdited(patternNow());
});
addEventListener("keydown", (e) => {
  if (!$("pathEd").hidden && e.key === "Escape") pathPadClose();
});
addEventListener("resize", () => {
  if ($("pathEd").hidden) return;
  pathPadFit();
  pathPadDraw();
});
