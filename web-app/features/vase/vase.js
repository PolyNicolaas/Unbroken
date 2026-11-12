// Unbroken · web app · vase.js
// Make a vase (the 3D model card's second choice): the profile editor (drag the points of the radius-against-height
// curve, tap beside it to add one), the height, the shape from above (a circle, polygon, star, flower or a traced
// drawing's outline; another at the rim; turned and leaning as it rises), the surface texture (ribs, rings, a grid, a
// weave, diamonds), the movement along the path (wave, zigzag, loops, shifted from layer to layer, or flipped into a
// lattice), the strength of each up the wall (small curve editors), and the rim (flared or rolled). Every change goes to model.js (useVase), which makes the vase the
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
// the settings a vase from before a part was added doesn't have: as made then (a circle, no lean, …)
function vaseFill(V) {
  const D = UNB.vaseDefaults();
  for (const k of ["plan", "lean", "rim"]) V[k] = Object.assign({}, D[k], V[k] || {});
  if (V.planTop === undefined) V.planTop = null;
  if (V.strength === undefined) V.strength = null;
  if (!(+V.twist === V.twist)) V.twist = 0;
  V.move = Object.assign({ flip: 0 }, V.move);
  return V;
}
// the controls from the vase in use (a design opened, undo, the Print step's Height), or the one being edited
function vaseUI() {
  if (st.model && st.model.vase) vaseCur = structuredClone(st.model.vase);
  const V = vaseFill(vaseCur),
    T = V.texture,
    M = V.move,
    P = V.plan,
    Q = V.planTop;
  if (document.activeElement !== $("vaseH")) $("vaseH").value = +V.height.toFixed(1);
  $(VASE_RADIO.tex[T.kind] || "vtNone").checked = true;
  $(VASE_RADIO.move[M.kind] || "vmNone").checked = true;
  $(VASE_RADIO.plan[P.kind] || "vpCircle").checked = true;
  // Drawing: only for a vase made from a traced line (Make a vase from this line, the Line tool), to go back to it
  $("vpDrawing").hidden = $("vpDrawingLab").hidden = !(P.loop && P.loop.length >= 16);
  $(VASE_RADIO.top[Q ? Q.kind : "same"] || "vrSame").checked = true;
  $(VASE_RADIO.lean[V.lean.curve] || "vlStraight").checked = true;
  $(VASE_RADIO.rim[V.rim.kind] || "vrimNone").checked = true;
  $("vtCount").value = T.count;
  $("vtTwist").value = T.twist;
  $("vtSpacing").value = T.spacing;
  $("vtDepth").value = T.depth;
  $("vmSize").value = M.size;
  $("vmCount").value = M.count;
  $("vmShift").value = Math.round(M.shift * 100);
  $("vmFlip").value = M.flip || 0;
  $("vpSides").value = P.sides;
  $("vpDepth").value = Math.round(P.depth * 100);
  $("vpRound").value = Math.round(P.round * 100);
  const Qs = Q || { sides: 6, depth: 0.3, round: 0.2 };
  $("vrSides").value = Qs.sides;
  $("vrDepth").value = Math.round(Qs.depth * 100);
  $("vrRound").value = Math.round(Qs.round * 100);
  $("vaseTwist").value = V.twist;
  $("vlSize").value = V.lean.size;
  $("vlDir").value = V.lean.dir;
  $("vrimSize").value = V.rim.size;
  $("vrimHeight").value = V.rim.height;
  $("vrimCount").value = V.rim.count || 8;
  vasePick = Math.min(vasePick, V.profile.length - 1);
  vaseLabels();
  vaseHint();
  vaseDraw();
}
const VASE_RADIO = {
  tex: { none: "vtNone", ribs: "vtRibs", rings: "vtRings", grid: "vtGrid", weave: "vtWeave", diamond: "vtDiamond" },
  move: { none: "vmNone", wave: "vmWave", zigzag: "vmZigzag", loops: "vmLoops" },
  plan: { circle: "vpCircle", polygon: "vpPolygon", star: "vpStar", flower: "vpFlower", drawing: "vpDrawing" },
  top: { same: "vrSame", circle: "vrCircle", polygon: "vrPolygon", star: "vrStar", flower: "vrFlower" },
  lean: { straight: "vlStraight", curve: "vlCurve", bow: "vlBow" },
  rim: { none: "vrimNone", flare: "vrimFlare", rolled: "vrimRolled", scallop: "vrimScallop" },
};
// a shape's words: "6-sided, rounded 20%", "5 points, 30% deep"
function vasePlanWords(P) {
  if (!P || P.kind === "circle") return "circle";
  if (P.kind === "drawing")
    return P.loop
      ? `${P.exact ? `the traced line${P.from ? ` (${P.from})` : ""}, as traced` : "a drawing's outline"}${P.round ? `, rounded ${Math.round(P.round * 100)}%` : ""}`
      : "a drawing (none yet)";
  const n = P.sides;
  if (P.kind === "polygon") return `${n}-sided${P.round ? `, rounded ${Math.round(P.round * 100)}%` : ""}`;
  return `${n} ${P.kind === "star" ? "points" : "petals"}, ${Math.round(P.depth * 100)}% deep`;
}
function vaseLabels() {
  const V = vaseFill(vaseCur),
    T = V.texture,
    M = V.move,
    P = V.plan,
    Q = V.planTop,
    box = $("vaseBox"),
    side = (k) => (k === "polygon" ? "Corners" : k === "star" ? "Points" : "Petals");
  box.dataset.tex = T.kind;
  box.dataset.move = M.kind;
  box.dataset.plan = P.kind;
  box.dataset.top = Q ? Q.kind : "same";
  box.dataset.lean = V.lean.size > 0 ? "on" : "off";
  box.dataset.rim = V.rim.kind;
  $("vtCountVal").textContent = `${T.count}`;
  $("vtTwistLab").textContent = T.kind === "weave" ? "Twist each way" : "Twist, bottom to rim";
  $("vtTwistVal").textContent = `${T.twist}°`;
  $("vtSpacingLab").textContent = T.kind === "weave" ? "Twists back every" : "Rings apart";
  $("vtSpacingVal").textContent = `${fmt(T.spacing, 1)} mm`;
  $("vtDepthVal").textContent = `${fmt(T.depth, 1)} mm`;
  $("vmSizeVal").textContent = `${fmt(M.size, 1)} mm`;
  $("vmCountVal").textContent = `${M.count}`;
  $("vmShiftVal").textContent = M.shift ? `${Math.round(M.shift * 100)}% of one a layer` : "none: straight columns";
  $("vmFlipVal").textContent = M.flip ? `${M.flip} layer${M.flip === 1 ? "" : "s"}` : "off";
  $("vpSidesLab").textContent = side(P.kind);
  $("vpSidesVal").textContent = `${P.sides}`;
  $("vpDepthVal").textContent = `${Math.round(P.depth * 100)}%`;
  $("vpRoundVal").textContent = `${Math.round(P.round * 100)}%`;
  const Qs = Q || {};
  $("vrSidesLab").textContent = side(Qs.kind);
  $("vrSidesVal").textContent = `${Qs.sides || ""}`;
  $("vrDepthVal").textContent = Q ? `${Math.round(Qs.depth * 100)}%` : "";
  $("vrRoundVal").textContent = Q ? `${Math.round(Qs.round * 100)}%` : "";
  $("vaseTwistVal").textContent = V.twist ? `${V.twist}°` : "none";
  $("vlSizeVal").textContent = `${fmt(V.lean.size, 1)} mm`;
  $("vlDirVal").textContent = `${V.lean.dir}°`;
  $("vrimSizeLab").textContent = V.rim.kind === "scallop" ? "Crests rise" : "Flares out";
  $("vrimSizeVal").textContent = `${fmt(V.rim.size, 1)} mm`;
  $("vrimCountVal").textContent = `${V.rim.count || 8}`;
  $("vrimHeightVal").textContent = `the top ${fmt(V.rim.height, 1)} mm`;
  $("vasePlanVal").textContent = vasePlanWords(P) + (V.twist ? `, turning ${V.twist}°` : "");
  $("vaseTopVal").textContent = Q ? `blends to ${vasePlanWords(Q)}` : "the same shape";
  $("vaseLeanVal").textContent = V.lean.size ? `${fmt(V.lean.size, 1)} mm, ${V.lean.curve}` : "upright";
  $("vaseRimVal").textContent =
    V.rim.kind === "flare"
      ? `flares ${fmt(V.rim.size, 1)} mm over the top ${fmt(V.rim.height, 1)} mm`
      : V.rim.kind === "rolled"
        ? `doubled over the top ${fmt(V.rim.height, 1)} mm`
        : V.rim.kind === "scallop"
          ? `${V.rim.count || 8} scallops rising ${fmt(V.rim.size, 1)} mm`
          : "plain";
  $("vaseTexVal").textContent =
    {
      ribs: `${T.count} ribs${T.twist ? `, ${T.twist}° twist` : ""}`,
      rings: `rings ${fmt(T.spacing, 1)} mm apart`,
      grid: `a grid: ${T.count} ribs, rings ${fmt(T.spacing, 1)} mm apart`,
      weave: `${T.count} ribs weaving ${T.twist}° every ${fmt(T.spacing, 1)} mm`,
      diamond: `diamonds: ${T.count} round, ${T.twist}° twist`,
    }[T.kind] || "smooth";
  $("vaseMoveVal").textContent =
    M.kind === "none"
      ? "straight along the wall"
      : `${M.count} ${M.kind === "loops" ? "loops" : M.kind === "zigzag" ? "zigzags" : "waves"} round${M.flip ? `, a lattice` : ""}`;
  for (const [id, key] of [
    ["vtCurve", "texture"],
    ["vmCurve", "move"],
  ])
    $(id + "Val").textContent = vaseCurveWords(V.strength && V.strength[key]);
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
  if (M.kind !== "none" && M.flip > 0) {
    const span = (2 * Math.PI * rmax) / M.count / 2;
    parts.push(
      `a lattice: every ${M.flip} layer${M.flip === 1 ? "" : "s"} the movement flips, and that layer bridges up to ${fmt(span, 1)} mm between crossings (more round makes the gaps shorter)`
    );
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
  vaseCurveDraw("vtCurve");
  vaseCurveDraw("vmCurve");
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
for (const id of Object.values(VASE_RADIO.tex))
  $(id).addEventListener("change", () => {
    vaseCur.texture.kind = $(id).value;
    // a weave or diamonds need a twist to be one
    if ((vaseCur.texture.kind === "weave" || vaseCur.texture.kind === "diamond") && !vaseCur.texture.twist) {
      vaseCur.texture.twist = 45;
      $("vtTwist").value = 45;
    }
    vaseLabels();
    vaseSend(true);
  });
// the shape from above, and at the rim
for (const id of Object.values(VASE_RADIO.plan))
  $(id).addEventListener("change", () => {
    vaseCur.plan.kind = $(id).value;
    if (vaseCur.plan.kind === "flower" && vaseCur.plan.sides > 12) vaseCur.plan.sides = 8;
    vaseLabels();
    vaseSend(true);
  });
for (const id of Object.values(VASE_RADIO.top))
  $(id).addEventListener("change", () => {
    const k = $(id).value,
      Q = vaseCur.planTop;
    vaseCur.planTop = k === "same" ? null : Object.assign({ sides: 6, depth: 0.3, round: 0.2 }, Q, { kind: k });
    vaseSend(true);
    vaseUI(); // (its sliders from the rim's shape)
  });
for (const id of Object.values(VASE_RADIO.lean))
  $(id).addEventListener("change", () => {
    vaseCur.lean.curve = $(id).value;
    vaseLabels();
    vaseSend(true);
  });
for (const id of Object.values(VASE_RADIO.rim))
  $(id).addEventListener("change", () => {
    vaseCur.rim.kind = $(id).value;
    vaseLabels();
    vaseSend(true);
  });
// Make a vase from this line (the Line card): the traced line itself, exactly, as the shape from above, at its own size
// (a straight wall as wide as the drawing, no texture or movement), so the pattern is what the vase shows. Pushed from
// the trace, so it's plain which line the vase is made of. An open line, or one with no inside, uses its outline.
function vaseFromLine() {
  const F = st.final,
    msg = $("vaseFromMsg");
  if (!F || !F.re || F.re.length < 8) {
    msg.textContent = "Nothing traced yet: trace a picture, text or pattern first.";
    msg.className = "hint warn";
    return;
  }
  const k = scale(), // mm per working px (pipeline.js)
    xs = Array.from(F.re, (v) => v * k),
    ys = Array.from(F.im, (v) => -v * k);
  let O = st.open ? null : UNB.vaseLineLoop(xs, ys);
  if (!O) {
    const E = UNB.vaseOutline(xs, ys);
    if (!E) {
      msg.textContent = "The traced line has no inside to make a vase from.";
      msg.className = "hint warn";
      return;
    }
    O = { loop: E.loop, reach: 0, exact: false };
  }
  const from = $("designName").value.trim() || (typeof autoName === "function" ? autoName() : ""),
    R = O.reach > 0 ? +O.reach.toFixed(2) : 15;
  vaseCur = UNB.vaseDefaults();
  vaseCur.profile = [
    [0, R],
    [0.5, R],
    [1, R],
  ];
  vaseCur.height = 20;
  vaseCur.move = Object.assign(vaseCur.move, { kind: "none" });
  vaseCur.texture = Object.assign(vaseCur.texture, { kind: "none" });
  vaseCur.plan = { kind: "drawing", loop: O.loop, round: 0, exact: O.exact, from, sides: 6, depth: 0.3 };
  vasePick = -1;
  artUse("model"); // art.js: the 3D model input
  $("mfVase").checked = true;
  useVase(vaseCur, true);
  vaseUI();
  msg.textContent = "";
  const dm = $("vpDrawMsg"),
    sz = st.model && st.model.om ? st.model.om.size : [2 * R, 2 * R];
  dm.textContent = O.exact
    ? `Made from your traced line${from ? ` (${from})` : ""}, exactly as traced, ${fmt(sz[0], 0)} × ${fmt(sz[1], 0)} mm. Widening or narrowing the profile moves its walls closer together or further apart.`
    : "Made from the outline of your traced line (it's open, so it has no shape of its own to follow).";
  dm.className = "hint";
  // on to the vase's own Shape tool, where it says which line it's made of
  if (!$("viewArt").checked) $("viewArt").click();
  if (typeof mapOpen === "function") mapOpen("vshape");
}
$("vaseFromLine").addEventListener("click", vaseFromLine);
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
  ["vmFlip", "move", "flip", 1],
  ["vpSides", "plan", "sides", 1],
  ["vpDepth", "plan", "depth", 0.01],
  ["vpRound", "plan", "round", 0.01],
  ["vrSides", "planTop", "sides", 1],
  ["vrDepth", "planTop", "depth", 0.01],
  ["vrRound", "planTop", "round", 0.01],
  ["vaseTwist", "", "twist", 1],
  ["vlSize", "lean", "size", 1],
  ["vlDir", "lean", "dir", 1],
  ["vrimSize", "rim", "size", 1],
  ["vrimHeight", "rim", "height", 1],
  ["vrimCount", "rim", "count", 1],
  ["vtCount", "texture", "count", 1],
  ["vtTwist", "texture", "twist", 1],
  ["vtSpacing", "texture", "spacing", 1],
  ["vtDepth", "texture", "depth", 1],
  ["vmSize", "move", "size", 1],
  ["vmCount", "move", "count", 1],
  ["vmShift", "move", "shift", 0.01],
]) {
  $(id).addEventListener("input", () => {
    const into = part ? vaseCur[part] : vaseCur;
    if (!into) return; // (the rim's shape while it's the same as the bottom's)
    into[key] = +$(id).value * k;
    vaseLabels();
    vaseSend(false);
  });
  $(id).addEventListener("change", () => vaseSend(true));
}
// ---------- the strength curves ----------
// How much of the texture (or the movement) there is at each height: k 0–1 across (left: none, right: all of it), the
// height up, as the profile. null: all of it all the way up (drawn flat at the right).
const VASE_CURVES = {
  even: null,
  in: [
    [0, 0],
    [1, 1],
  ],
  out: [
    [0, 1],
    [1, 0],
  ],
  middle: [
    [0, 0],
    [0.5, 1],
    [1, 0],
  ],
  ends: [
    [0, 1],
    [0.5, 0],
    [1, 1],
  ],
};
function vaseCurveWords(C) {
  if (!C) return "all the way up";
  const lo = Math.min(...C.map((p) => p[1])),
    hi = Math.max(...C.map((p) => p[1]));
  for (const [k, P] of Object.entries(VASE_CURVES))
    if (P && P.length === C.length && P.every((p, i) => p[0] === C[i][0] && p[1] === C[i][1]))
      return { in: "fading in", out: "fading out", middle: "strongest in the middle", ends: "at the ends" }[k];
  return `${Math.round(lo * 100)}–${Math.round(hi * 100)}%, ${C.length} points`;
}
const vaseCurveKey = (id) => (id === "vtCurve" ? "texture" : "move");
let vaseCurveDrag = null; // { id, i, moved }
function vaseCurveGet(id) {
  const S = vaseCur.strength;
  return (S && S[vaseCurveKey(id)]) || null;
}
function vaseCurveSet(id, C) {
  vaseCur.strength = Object.assign({ texture: null, move: null }, vaseCur.strength, {
    [vaseCurveKey(id)]: C ? UNB.vaseProfile(C, 0, 1) : null,
  });
  if (!vaseCur.strength.texture && !vaseCur.strength.move) vaseCur.strength = null;
}
function vaseCurveView(cv) {
  const pad = 10 * (window.devicePixelRatio || 1);
  return { pad, w: cv.width - 2 * pad, h: cv.height - 2 * pad };
}
function vaseCurveDraw(id) {
  const cv = $(id);
  if (!cv || !cv.isConnected || cv.getBoundingClientRect().width === 0) return;
  const fit = fitCanvas(cv, true);
  if (!fit) return;
  const g = cv.getContext("2d"),
    W = vaseCurveView(cv),
    C = vaseCurveGet(id) || [
      [0, 1],
      [1, 1],
    ],
    dpr = fit.dpr,
    X = (k) => W.pad + k * W.w,
    Y = (t) => W.pad + (1 - t) * W.h,
    c = cssRGBA("--choc");
  g.clearRect(0, 0, cv.width, cv.height);
  g.strokeStyle = css("--rule");
  g.lineWidth = 1 * dpr;
  g.strokeRect(X(0), Y(1), W.w, W.h);
  g.fillStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, 0.14)`;
  g.beginPath();
  g.moveTo(X(0), Y(0));
  for (let i = 0; i <= 60; i++) g.lineTo(X(UNB.vaseStrength(C, i / 60)), Y(i / 60));
  g.lineTo(X(0), Y(1));
  g.closePath();
  g.fill();
  g.strokeStyle = `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  g.lineWidth = 2 * dpr;
  g.beginPath();
  for (let i = 0; i <= 60; i++) {
    const x = X(UNB.vaseStrength(C, i / 60)),
      y = Y(i / 60);
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.stroke();
  if (vaseCurveGet(id))
    C.forEach(([t, k]) => {
      g.beginPath();
      g.arc(X(k), Y(t), 4.5 * dpr, 0, 2 * Math.PI);
      g.fillStyle = css("--surface");
      g.fill();
      g.stroke();
    });
  g.fillStyle = css("--muted");
  g.font = `${10 * dpr}px ${css("--font-mono") || "monospace"}`;
  g.fillText("rim", X(0) + 4 * dpr, Y(1) + 11 * dpr);
  g.fillText("base", X(0) + 4 * dpr, Y(0) - 4 * dpr);
}
for (const id of ["vtCurve", "vmCurve"]) {
  const cv = $(id),
    at = (e) => {
      const b = cv.getBoundingClientRect(),
        q = cv.width / Math.max(1, b.width),
        W = vaseCurveView(cv);
      return {
        px: (e.clientX - b.left) * q,
        py: (e.clientY - b.top) * q,
        k: Math.min(1, Math.max(0, ((e.clientX - b.left) * q - W.pad) / W.w)),
        t: Math.min(1, Math.max(0, 1 - ((e.clientY - b.top) * q - W.pad) / W.h)),
        W,
      };
    };
  cv.addEventListener("pointerdown", (e) => {
    const p = at(e),
      C = (
        vaseCurveGet(id) || [
          [0, 1],
          [1, 1],
        ]
      ).map((q) => q.slice()),
      dpr = window.devicePixelRatio || 1;
    let best = -1,
      bd = (14 * dpr) ** 2;
    C.forEach(([t, k], i) => {
      const d = (p.W.pad + k * p.W.w - p.px) ** 2 + (p.W.pad + (1 - t) * p.W.h - p.py) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    if (best < 0) {
      if (!(p.t > 0.01 && p.t < 0.99)) {
        // the bottom or the top: move its point
        best = p.t <= 0.01 ? 0 : C.length - 1;
        C[best][1] = p.k;
      } else {
        const i = C.findIndex((q) => q[0] > p.t);
        C.splice(i, 0, [p.t, p.k]);
        best = i;
      }
    }
    vaseCurveSet(id, C);
    vaseCurveDrag = { id, i: best, moved: false, fresh: bd === (14 * dpr) ** 2 };
    cv.setPointerCapture(e.pointerId);
    vaseLabels();
    vaseCurveDraw(id);
    vaseSend(false);
  });
  cv.addEventListener("pointermove", (e) => {
    if (!vaseCurveDrag || vaseCurveDrag.id !== id) return;
    const p = at(e),
      C = vaseCurveGet(id).map((q) => q.slice()),
      i = vaseCurveDrag.i,
      last = C.length - 1;
    C[i][1] = Math.round(p.k * 100) / 100;
    if (i > 0 && i < last) C[i][0] = Math.min(C[i + 1][0] - 0.02, Math.max(C[i - 1][0] + 0.02, p.t));
    vaseCurveSet(id, C);
    vaseCurveDrag.moved = true;
    vaseLabels();
    vaseCurveDraw(id);
    vaseSend(false);
  });
  for (const ev of ["pointerup", "pointercancel"])
    cv.addEventListener(ev, () => {
      if (!vaseCurveDrag || vaseCurveDrag.id !== id) return;
      const D = vaseCurveDrag;
      vaseCurveDrag = null;
      // a tap on a point (not dragged, not just added) between the ends removes it
      const C = vaseCurveGet(id);
      if (!D.moved && !D.fresh && C && D.i > 0 && D.i < C.length - 1) {
        C.splice(D.i, 1);
        vaseCurveSet(id, C);
      }
      vaseLabels();
      vaseCurveDraw(id);
      vaseSend(true);
    });
  new ResizeObserver(() => vaseCurveDraw(id)).observe(cv);
}
document.querySelectorAll("#vaseBox [data-curve] button").forEach((b) =>
  b.addEventListener("click", () => {
    const id = b.parentElement.dataset.curve,
      C = VASE_CURVES[b.dataset.k];
    vaseCurveSet(id, C && C.map((p) => p.slice()));
    vaseLabels();
    vaseCurveDraw(id);
    vaseSend(true);
  })
);

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
addMapNode("vprofile", {
  icon: "profile",
  cap: "Profile",
  step: "art",
  cards: ["h-model"],
  part: "vprofile",
  val: () => `${vaseCur.profile.length} points · ${fmt(vaseCur.height, 0)} mm tall`,
});
addMapNode("vshape", {
  icon: "shape",
  cap: "Shape",
  step: "art",
  cards: ["h-model"],
  part: "vshape",
  val: () => vasePlanWords(vaseFill(vaseCur).plan),
});
addMapNode("vtexture", {
  icon: "texture",
  cap: "Texture",
  step: "art",
  cards: ["h-model"],
  part: "vtexture",
  val: () => $("vaseTexVal").textContent,
});
addMapNode("vmove", {
  icon: "move",
  cap: "Movement",
  step: "art",
  cards: ["h-model"],
  part: "vmove",
  val: () => $("vaseMoveVal").textContent,
});
addMapNode("vrim", {
  icon: "rim",
  cap: "Rim",
  step: "art",
  cards: ["h-model"],
  part: "vrim",
  val: () => $("vaseRimVal").textContent,
});
MAP_SHAPERS.push((S) => {
  if (st.art.kind === "model" && st.model && st.model.vase)
    S.down.art = ["vprofile", "vshape", "vtexture", "vmove", "vrim"];
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
  if (L.lattice && L.lattice.bridges)
    add(
      L.lattice.span > 6 * lineWidthMM() ? "warn" : "ok",
      `Lattice: ${L.lattice.bridges} layer${L.lattice.bridges === 1 ? "" : "s"} bridge gaps up to ${fmt(L.lattice.span, 1)} mm between crossings${L.lattice.span > 6 * lineWidthMM() ? ": long for chocolate (more movements round shorten them)" : ""}`,
      "h-model"
    );
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
