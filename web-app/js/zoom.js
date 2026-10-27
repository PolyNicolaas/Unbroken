// Unbroken · web app · zoom.js
// Zoom and pan in the big view, and the One copy / Whole plate switch.
// Each view (line, page, plate, layers) keeps its own zoom: z (1 = everything fitted, down to 0.25 and up to 30) and a
// pan in canvas pixels. A renderer draws as usual and calls zoomOn(g, view, cv) first, which sets the canvas transform; pointer code
// turns a click back into the fitted picture with unzoom(). The line view folds the zoom into view() instead
// (preview.js), so the image tools follow it.
// Pinch, or Ctrl / ⌘ + scroll, zooms about the pointer; scrolling pans once zoomed in; Space + drag or the middle
// button pans; the − / + / Fit buttons work on the view that's showing.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

const ZOOM_MAX = 30,
  ZOOM_MIN = 0.25,
  zooms = {};
const zoomOf = (v) => zooms[v] || (zooms[v] = { z: 1, px: 0, py: 0 });
// the canvas transform for a view: x' = cx + (x − cx) · z + px (about the canvas centre)
function zoomT(v, cv) {
  const Z = zoomOf(v),
    cx = cv.width / 2,
    cy = cv.height / 2;
  return { z: Z.z, tx: cx - cx * Z.z + Z.px, ty: cy - cy * Z.z + Z.py };
}
function zoomOn(g, v, cv) {
  const t = zoomT(v, cv);
  g.setTransform(t.z, 0, 0, t.z, t.tx, t.ty);
  return t;
}
// a point on the canvas (canvas pixels) → the same point in the fitted picture
function unzoom(v, cv, x, y) {
  const t = zoomT(v, cv);
  return [(x - t.tx) / t.z, (y - t.ty) / t.z];
}
// keep the zoomed picture covering the canvas (no panning off the edge); zoomed out, it stays centred
function clampPan(v, cv) {
  const Z = zoomOf(v);
  if (Z.z <= 1) {
    Z.px = Z.py = 0;
    return;
  }
  const mx = (cv.width / 2) * (Z.z - 1),
    my = (cv.height / 2) * (Z.z - 1);
  Z.px = Math.max(-mx, Math.min(mx, Z.px));
  Z.py = Math.max(-my, Math.min(my, Z.py));
}
const STAGE_CANVAS = { art: "artView", line: "view", page: "pageView", plate: "plate", layers: "stackView" };
const stageCanvas = () => $(STAGE_CANVAS[stageNow()]);
// zoom the view that's showing by f, keeping the canvas point (x, y) where it is (default: the centre)
function zoomBy(f, x, y) {
  const v = stageNow(),
    cv = stageCanvas(),
    Z = zoomOf(v);
  if (!cv.width) return;
  if (x === undefined) {
    x = cv.width / 2;
    y = cv.height / 2;
  }
  const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Z.z * f)),
    [fx, fy] = unzoom(v, cv, x, y),
    cx = cv.width / 2,
    cy = cv.height / 2;
  Z.z = z;
  Z.px = x - cx - (fx - cx) * z;
  Z.py = y - cy - (fy - cy) * z; // the fitted point (fx, fy) stays under (x, y)
  clampPan(v, cv);
  zoomUI();
  redrawStage();
}
function zoomFit() {
  const Z = zoomOf(stageNow());
  Z.z = 1;
  Z.px = Z.py = 0;
  zoomUI();
  redrawStage();
}
function zoomUI() {
  const Z = zoomOf(stageNow());
  $("zoomVal").textContent = `${Math.round(Z.z * 100)}%`;
  $("zoomOut").disabled = Z.z <= ZOOM_MIN + 1e-6;
  $("zoomFit").disabled = Math.abs(Z.z - 1) < 0.001 && !Z.px && !Z.py;
  $("zoomIn").disabled = Z.z >= ZOOM_MAX - 1e-6;
  $(copiesShown() ? "copiesAll" : "copiesOne").checked = true;
}
$("zoomIn").addEventListener("click", () => zoomBy(1.5));
$("zoomOut").addEventListener("click", () => zoomBy(1 / 1.5));
$("zoomFit").addEventListener("click", zoomFit);
(() => {
  const box = $("box"),
    at = (e) => {
      const cv = stageCanvas(),
        r = cv.getBoundingClientRect(),
        d = cv.width / r.width;
      return [(e.clientX - r.left) * d, (e.clientY - r.top) * d];
    };
  box.addEventListener(
    "wheel",
    (e) => {
      if (isModel() && stageNow() === "line") return; // the model's own view
      const Z = zoomOf(stageNow());
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const [x, y] = at(e);
        zoomBy(Math.exp(-e.deltaY * 0.01), x, y);
        return;
      } // pinch or Ctrl / ⌘ + scroll
      if (Z.z <= 1) return; // fitted: the page scrolls as usual
      e.preventDefault();
      const cv = stageCanvas(),
        d = cv.width / cv.getBoundingClientRect().width;
      Z.px -= e.deltaX * d;
      Z.py -= e.deltaY * d;
      clampPan(stageNow(), cv);
      redrawStage();
    },
    { passive: false }
  );
  // Space + drag, or the middle button, pans; caught before the view's own handlers (tools, fills, turning)
  let space = false,
    pan = null;
  addEventListener("keydown", (e) => {
    if (e.code === "Space" && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)) {
      space = true;
      box.classList.add("panning");
      if (box.matches(":hover")) e.preventDefault();
    }
  });
  addEventListener("keyup", (e) => {
    if (e.code === "Space") {
      space = false;
      box.classList.remove("panning");
    }
  });
  box.addEventListener(
    "pointerdown",
    (e) => {
      if (!(space || e.button === 1) || zoomOf(stageNow()).z <= 1) return;
      e.preventDefault();
      e.stopPropagation();
      const Z = zoomOf(stageNow());
      pan = { x: e.clientX, y: e.clientY, px: Z.px, py: Z.py };
      box.setPointerCapture(e.pointerId);
    },
    true
  );
  box.addEventListener(
    "pointermove",
    (e) => {
      if (!pan) return;
      e.stopPropagation();
      const cv = stageCanvas(),
        d = cv.width / cv.getBoundingClientRect().width,
        Z = zoomOf(stageNow());
      Z.px = pan.px + (e.clientX - pan.x) * d;
      Z.py = pan.py + (e.clientY - pan.y) * d;
      clampPan(stageNow(), cv);
      redrawStage();
    },
    true
  );
  for (const ev of ["pointerup", "pointercancel"])
    box.addEventListener(
      ev,
      (e) => {
        if (pan) {
          e.stopPropagation();
          pan = null;
        }
      },
      true
    );
})();

// ---------- One copy / Whole plate (the Plate and 3D layers views), and what they show ----------
// One copy: just the design, filling the view, so you can work on it without the copies around it. Whole plate: every
// copy where it prints on the printer's plate, to see how they fit.
let wholePlate = false;
const copiesShown = () => wholePlate;
document.querySelectorAll('input[name="copiesView"]').forEach((r) =>
  r.addEventListener("change", () => {
    wholePlate = $("copiesAll").checked;
    document.body.dataset.copies = wholePlate ? "all" : "one";
    zoomFit(); // a new framing: start from fitted
  })
);
for (const id of ["pvWall", "pvFill", "pvTravel", "pvPurge", "pvSolid"]) $(id).addEventListener("change", redrawStage);
