// Unbroken · web app · vase.js
// Make a vase (the 3D model card's second choice): the profile editor (drag the points of the radius-against-height
// curve, tap beside it to add one), the height, the surface texture (ribs, rings) and the movement along the path
// (wave, zigzag, loops, shifted from layer to layer). Every change goes to model.js (useVase), which makes the vase the
// model in use; the Print step writes its path (UNB.vaseStack) and checks it.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// the vase being edited (its settings, as UNB.vaseStack takes them); kept while an STL is in use, to come back to
let vaseCur = UNB.vaseDefaults(),
  vasePick = -1, // the picked point in the profile (-1: none)
  vaseDrag = null, // { i, view } while a point is dragged (view: the editor's scale, fixed while dragging)
  vaseRaf = 0;

// ---------- sending a change ----------
// (record: an undo step; while dragging, one at the end)
function vaseSend(record) {
  vaseCur.profile = UNB.vaseProfile(vaseCur.profile);
  vaseHint();
  vaseDraw();
  if (record) {
    cancelAnimationFrame(vaseRaf);
    vaseRaf = 0;
    useVase(vaseCur, true); // model.js
    return;
  }
  if (!vaseRaf)
    vaseRaf = requestAnimationFrame(() => {
      vaseRaf = 0;
      useVase(vaseCur, false);
    });
}
// the controls from the vase in use (a design opened, undo, the Print step's Height), or the one being edited
function vaseUI() {
  if (st.model && st.model.vase) vaseCur = structuredClone(st.model.vase);
  const V = vaseCur,
    T = V.texture,
    M = V.move;
  if (document.activeElement !== $("vaseH")) $("vaseH").value = +V.height.toFixed(1);
  $({ none: "vtNone", ribs: "vtRibs", rings: "vtRings" }[T.kind] || "vtNone").checked = true;
  $({ none: "vmNone", wave: "vmWave", zigzag: "vmZigzag", loops: "vmLoops" }[M.kind] || "vmNone").checked = true;
  $("vtCount").value = T.count;
  $("vtTwist").value = T.twist;
  $("vtSpacing").value = T.spacing;
  $("vtDepth").value = T.depth;
  $("vmSize").value = M.size;
  $("vmCount").value = M.count;
  $("vmShift").value = Math.round(M.shift * 100);
  vasePick = Math.min(vasePick, V.profile.length - 1);
  vaseLabels();
  vaseHint();
  vaseDraw();
}
function vaseLabels() {
  const V = vaseCur,
    T = V.texture,
    M = V.move,
    box = $("vaseBox");
  box.dataset.tex = T.kind;
  box.dataset.move = M.kind;
  $("vtCountVal").textContent = `${T.count}`;
  $("vtTwistVal").textContent = `${T.twist}°`;
  $("vtSpacingVal").textContent = `${fmt(T.spacing, 1)} mm`;
  $("vtDepthVal").textContent = `${fmt(T.depth, 1)} mm`;
  $("vmSizeVal").textContent = `${fmt(M.size, 1)} mm`;
  $("vmCountVal").textContent = `${M.count}`;
  $("vmShiftVal").textContent = M.shift ? `${Math.round(M.shift * 100)}% of one a layer` : "none: straight columns";
  $("vaseTexVal").textContent =
    T.kind === "ribs"
      ? `${T.count} ribs${T.twist ? `, ${T.twist}° twist` : ""}`
      : T.kind === "rings"
        ? `rings ${fmt(T.spacing, 1)} mm apart`
        : "smooth";
  $("vaseMoveVal").textContent =
    M.kind === "none"
      ? "straight along the wall"
      : `${M.count} ${M.kind === "loops" ? "loops" : M.kind === "zigzag" ? "zigzags" : "waves"} round`;
  $("vasePtDel").disabled = !(vasePick > 0 && vasePick < V.profile.length - 1);
}
// What the settings will do, worked out on the spot (the Print step's ready list checks the path itself): the widths,
// how far apart the movements are where the vase is narrowest and widest, whether loops close, and how far each lap
// moves off the one below with the shift.
function vaseHint() {
  const V = vaseCur,
    M = V.move,
    el = $("vaseHint");
  let rmin = Infinity,
    rmax = 0;
  for (let i = 0; i <= 100; i++) {
    const r = UNB.vaseRadius(V.profile, i / 100);
    rmin = Math.min(rmin, r);
    rmax = Math.max(rmax, r);
  }
  const step = overhangMM(), // export.js: what a bead holds
    bead = lineWidthMM(),
    parts = [`${fmt(2 * rmin, 1)}–${fmt(2 * rmax, 1)} mm across`];
  let warn = false;
  $("vaseProfileVal").textContent = `${V.profile.length} points`;
  if (M.kind !== "none") {
    const lo = (2 * Math.PI * rmin) / M.count,
      hi = (2 * Math.PI * rmax) / M.count,
      what = M.kind === "loops" ? "loops" : M.kind === "zigzag" ? "zigzags" : "waves";
    parts.push(`${what} ${fmt(lo, 1)}–${fmt(hi, 1)} mm apart`);
    if (M.kind === "loops") {
      const close = 2 * Math.PI * M.size; // a loop closes where the spacing is less than 2π × its size
      parts.push(
        close > hi
          ? "looped all the way up"
          : close > lo
            ? `looped where narrower than ${fmt((close * M.count) / Math.PI, 0)} mm, a leaning wave above`
            : `no loops yet (a leaning wave): a size over ${fmt(lo / (2 * Math.PI), 1)} mm loops`
      );
    } else if (M.kind === "wave") {
      const r = (lo * lo) / (4 * Math.PI * Math.PI * M.size); // the tightest bend of a sine wave
      if (r < bead / 2) {
        parts.push(
          `its bends (${fmt(r, 2)} mm) are tighter than the bead (${fmt(bead, 2)} mm wide), so they round off`
        );
        warn = true;
      }
    } else parts.push("the bead rounds the corners");
    // each lap's movement moves off the one below by the shift: a wave by 2·size·sin(π·shift), a zigzag 4·size·shift
    const s = Math.abs(M.shift),
      off = M.kind === "zigzag" ? 4 * M.size * Math.min(s, 0.5) : 2 * M.size * Math.sin(Math.PI * Math.min(s, 0.5));
    if (s > 0) {
      parts.push(
        `the shift moves each layer up to ${fmt(off, 2)} mm off the one below (a bead holds ${fmt(step, 2)}; the Print step checks the whole wall)`
      );
      if (off > step) warn = true;
    }
  }
  el.textContent = parts.join(" · ") + ".";
  el.className = warn ? "hint warn" : "hint";
}

// ---------- the profile editor ----------
// The vase's outline seen from the side, both halves (the profile mirrored), the plate at the bottom, the middle
// dashed. Points sit on the right half; the scale stays put while a point is dragged.
function vaseView(cv) {
  const V = vaseCur,
    pad = 16 * (window.devicePixelRatio || 1);
  let rmax = 0;
  for (let i = 0; i <= 60; i++) rmax = Math.max(rmax, UNB.vaseRadius(V.profile, i / 60));
  for (const p of V.profile) rmax = Math.max(rmax, p[1]);
  const R = Math.max(10, rmax * 1.25),
    s = Math.min((cv.width - 2 * pad) / (2 * R), (cv.height - 2 * pad) / Math.max(1, V.height));
  return { s, x0: cv.width / 2, y0: cv.height - pad, H: V.height };
}
function vaseDraw() {
  const cv = $("vaseProfile");
  if (!cv || !cv.isConnected || cv.getBoundingClientRect().width === 0) return;
  const fit = fitCanvas(cv, true);
  if (!fit) return;
  const g = cv.getContext("2d"),
    V = vaseCur,
    W = (vaseDrag && vaseDrag.view) || vaseView(cv),
    dpr = fit.dpr,
    X = (r) => W.x0 + r * W.s,
    Y = (t) => W.y0 - t * W.H * W.s;
  g.clearRect(0, 0, cv.width, cv.height);
  // the plate and the middle
  g.strokeStyle = css("--rule");
  g.lineWidth = 1 * dpr;
  g.beginPath();
  g.moveTo(0, W.y0);
  g.lineTo(cv.width, W.y0);
  g.stroke();
  g.setLineDash([4 * dpr, 4 * dpr]);
  g.beginPath();
  g.moveTo(W.x0, W.y0);
  g.lineTo(W.x0, Y(1) - 8 * dpr);
  g.stroke();
  g.setLineDash([]);
  // the outline, both halves, filled faintly
  const N = 120,
    pts = [];
  for (let i = 0; i <= N; i++) pts.push([UNB.vaseRadius(V.profile, i / N), i / N]);
  const c = cssRGBA("--choc");
  g.fillStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, 0.14)`;
  g.beginPath();
  pts.forEach(([r, t], i) => (i ? g.lineTo(X(r), Y(t)) : g.moveTo(X(r), Y(t))));
  for (let i = N; i >= 0; i--) g.lineTo(X(-pts[i][0]), Y(pts[i][1]));
  g.closePath();
  g.fill();
  g.strokeStyle = `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  for (const side of [1, -1]) {
    g.lineWidth = (side > 0 ? 2.2 : 1.2) * dpr;
    g.globalAlpha = side > 0 ? 1 : 0.45;
    g.beginPath();
    pts.forEach(([r, t], i) => (i ? g.lineTo(X(side * r), Y(t)) : g.moveTo(X(side * r), Y(t))));
    g.stroke();
  }
  g.globalAlpha = 1;
  // the points
  V.profile.forEach(([t, r], i) => {
    g.beginPath();
    g.arc(X(r), Y(t), (i === vasePick ? 7 : 5) * dpr, 0, 2 * Math.PI);
    g.fillStyle = i === vasePick ? css("--accent") : css("--surface");
    g.fill();
    g.lineWidth = 2 * dpr;
    g.strokeStyle = i === vasePick ? css("--accent") : `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
    g.stroke();
  });
  // the picked point's numbers
  if (vasePick >= 0) {
    const [t, r] = V.profile[vasePick];
    g.fillStyle = css("--muted");
    g.font = `${12 * dpr}px ${css("--font-mono") || "monospace"}`;
    g.fillText(`r ${fmt(r, 1)} mm · ${fmt(t * V.height, 1)} mm up`, 8 * dpr, 16 * dpr);
  }
}
// pointer → the profile's coordinates (t share of the height, r mm)
function vaseAt(e, W) {
  const cv = $("vaseProfile"),
    b = cv.getBoundingClientRect(),
    k = cv.width / Math.max(1, b.width),
    px = (e.clientX - b.left) * k,
    py = (e.clientY - b.top) * k;
  return { px, py, t: (W.y0 - py) / (W.H * W.s), r: Math.abs(px - W.x0) / W.s };
}
// move point i to (t, r): the bottom and the rim keep their height, the others stay between their neighbours
function vaseMovePoint(i, t, r) {
  const P = vaseCur.profile,
    last = P.length - 1;
  P[i][1] = Math.min(500, Math.max(1, Math.round(r * 10) / 10));
  if (i > 0 && i < last) P[i][0] = Math.min(P[i + 1][0] - 0.02, Math.max(P[i - 1][0] + 0.02, t));
}
$("vaseProfile").addEventListener("pointerdown", (e) => {
  const cv = $("vaseProfile"),
    W = vaseView(cv),
    p = vaseAt(e, W),
    P = vaseCur.profile,
    dpr = window.devicePixelRatio || 1;
  // the nearest point, on either half
  let best = -1,
    bd = (16 * dpr) ** 2;
  P.forEach(([t, r], i) => {
    for (const side of [1, -1]) {
      const d = (W.x0 + side * r * W.s - p.px) ** 2 + (W.y0 - t * W.H * W.s - p.py) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
  });
  if (best < 0) {
    // a new point, where tapped (between the bottom and the rim)
    if (!(p.t > 0.01 && p.t < 0.99)) return;
    const i = P.findIndex((q) => q[0] > p.t);
    P.splice(i, 0, [p.t, Math.max(1, p.r)]);
    best = i;
  }
  vasePick = best;
  vaseDrag = { i: best, view: W, moved: false };
  cv.setPointerCapture(e.pointerId);
  vaseLabels();
  vaseSend(false);
});
$("vaseProfile").addEventListener("pointermove", (e) => {
  if (!vaseDrag) return;
  const p = vaseAt(e, vaseDrag.view);
  vaseMovePoint(vaseDrag.i, p.t, p.r);
  vaseDrag.moved = true;
  vaseSend(false);
});
for (const ev of ["pointerup", "pointercancel"])
  $("vaseProfile").addEventListener(ev, () => {
    if (!vaseDrag) return;
    vaseDrag = null;
    vaseSend(true);
  });
// the keyboard: arrows move the picked point (left / right: the radius, 0.5 mm; up / down: its height, 1% of the
// vase), Delete removes it, Tab-like [ and ] pick the next or previous point
$("vaseProfile").addEventListener("keydown", (e) => {
  const P = vaseCur.profile;
  if (e.key === "]" || e.key === "[") {
    vasePick = (Math.max(0, vasePick) + (e.key === "]" ? 1 : P.length - 1)) % P.length;
    vaseLabels();
    vaseDraw();
    e.preventDefault();
    return;
  }
  if (vasePick < 0) return;
  const [t, r] = P[vasePick],
    d = { ArrowLeft: [0, -0.5], ArrowRight: [0, 0.5], ArrowUp: [0.01, 0], ArrowDown: [-0.01, 0] }[e.key];
  if (d) {
    vaseMovePoint(vasePick, t + d[0], r + d[1]);
    vaseSend(true);
    e.preventDefault();
  } else if (e.key === "Delete" || e.key === "Backspace") {
    vaseRemovePoint();
    e.preventDefault();
  }
});
function vaseRemovePoint() {
  const P = vaseCur.profile;
  if (!(vasePick > 0 && vasePick < P.length - 1)) return;
  P.splice(vasePick, 1);
  vasePick = -1;
  vaseLabels();
  vaseSend(true);
}
$("vasePtDel").addEventListener("click", vaseRemovePoint);
// starting shapes
for (const [key, S] of Object.entries(UNB.VASE_SHAPES)) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "chip-btn";
  b.dataset.shape = key;
  b.textContent = S.name;
  b.title = `Start the profile from a ${S.name.toLowerCase()} (the texture and movement stay)`;
  b.addEventListener("click", () => {
    vaseCur.profile = S.profile.map((p) => p.slice());
    vasePick = -1;
    vaseLabels();
    vaseSend(true);
  });
  $("vaseShapes").appendChild(b);
}

// ---------- the other controls ----------
$("vaseH").addEventListener("change", () => {
  const H = +$("vaseH").value;
  if (H >= 2 && H <= 500) vaseCur.height = H;
  $("vaseH").value = vaseCur.height;
  vaseSend(true);
});
for (const id of ["vtNone", "vtRibs", "vtRings"])
  $(id).addEventListener("change", () => {
    vaseCur.texture.kind = $(id).value;
    vaseLabels();
    vaseSend(true);
  });
for (const id of ["vmNone", "vmWave", "vmZigzag", "vmLoops"])
  $(id).addEventListener("change", () => {
    vaseCur.move.kind = $(id).value;
    // loops want room to close: a size that loops at this count, if the size is still a wave's
    if (vaseCur.move.kind === "loops" && vaseCur.move.size < 0.8) vaseCur.move.size = 1;
    $("vmSize").value = vaseCur.move.size;
    vaseLabels();
    vaseSend(true);
  });
for (const [id, part, key, k] of [
  ["vtCount", "texture", "count", 1],
  ["vtTwist", "texture", "twist", 1],
  ["vtSpacing", "texture", "spacing", 1],
  ["vtDepth", "texture", "depth", 1],
  ["vmSize", "move", "size", 1],
  ["vmCount", "move", "count", 1],
  ["vmShift", "move", "shift", 0.01],
]) {
  $(id).addEventListener("input", () => {
    vaseCur[part][key] = +$(id).value * k;
    vaseLabels();
    vaseSend(false);
  });
  $(id).addEventListener("change", () => vaseSend(true));
}
// the Wavy vase example: a bulb with waves round it, from scratch
function vaseExample() {
  artUse("model"); // art.js: the 3D model input (the sample, until the vase takes over)
  vaseCur = UNB.vaseDefaults();
  vasePick = -1;
  useVase(vaseCur, false);
  vaseUI();
}
// where the model comes from: an STL (the last one, or the sample), or the vase made here
$("mfVase").addEventListener("change", () => {
  if ($("mfVase").checked && !(st.model && st.model.vase)) {
    useVase(vaseCur, true);
    vaseUI();
  }
});
$("mfStl").addEventListener("change", () => {
  if ($("mfStl").checked && st.model && st.model.vase) {
    vaseCur = structuredClone(st.model.vase);
    leaveVase(); // model.js
  }
});
// the editor's canvas sizes with the card: redraw when it shows or the window changes
new ResizeObserver(() => vaseDraw()).observe($("vaseProfile"));
onPrintSettings(() => vaseHint()); // state.js: the needle changes what a bead holds

addExample(120, "wavyvase", "Wavy vase", "a vase made here: profile, texture, movement", () => vaseExample(), true);

// on the map: a vase's parts are chips under Art; each opens the 3D model card at its part
addMapNode("vprofile", { cap: "Profile", step: "art", cards: ["h-model"], at: "vaseProfile", val: () => "" });
addMapNode("vtexture", { cap: "Texture", step: "art", cards: ["h-model"], at: "vtNone", val: () => "" });
addMapNode("vmove", { cap: "Movement", step: "art", cards: ["h-model"], at: "vmNone", val: () => "" });
MAP_SHAPERS.push((S) => {
  if (st.art.kind === "model" && st.model && st.model.vase) S.down.art = ["vprofile", "vtexture", "vmove"];
});

// the ready list (export.js): does each lap sit on the one below, and can the bead follow its turns?
on("ready", (L, add) => {
  if (!(L.vase && L.overhang)) return;
  const step = overhangMM(),
    zAt = (k) => fmt(firstZ() + k * L.S.h, 1),
    fix = "a gentler profile there, a smaller movement or less shift";
  if (L.overhang.worst > step + 0.02)
    add(
      "warn",
      `The wall steps out ${fmt(L.overhang.worst, 2)} mm in a layer at ${zAt(L.overhang.at)} mm (a bead holds ${fmt(step, 2)}): ${fix}`,
      "h-model"
    );
  if (L.overhang.inWorst > 0.02)
    add(
      "warn",
      `The wall steps in ${fmt(L.overhang.inWorst + step, 2)} mm in a layer at ${zAt(L.overhang.inAt)} mm, over the empty inside (a bead holds ${fmt(step, 2)}): ${fix}`,
      "h-model"
    );
  if (!(L.overhang.worst > step + 0.02) && !(L.overhang.inWorst > 0.02))
    add("ok", `Every lap sits on the one below (within ${fmt(step, 2)} mm)`, "h-layers");
  const T = L.tightest,
    half = lineWidthMM() / 2;
  if (T && T.r < half)
    add(
      "warn",
      `Turns as tight as a ${fmt(T.r, 2)} mm radius at ${zAt(T.at)} mm, for a bead ${fmt(2 * half, 2)} mm wide: the chocolate rounds them off (fewer or smaller movements keep their shape)`,
      "h-model"
    );
});

// with a design (model.js keeps the model's part): a vase made here is kept as its settings and made again from them
on("modelSave", () => ({ vase: st.model.vase ? structuredClone(st.model.vase) : undefined }));
on("modelRestoring", (m) => {
  if (m && m.vase) {
    useVase(m.vase, false);
    vaseUI();
  } else if (st.model && st.model.vase) leaveVase(); // a design made with an STL: the vase steps aside
});
on("modelSized", vaseUI); // its Height box follows the model's height
