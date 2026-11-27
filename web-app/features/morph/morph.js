// Unbroken · web app · morph.js
// A morph: a shape at the bottom that changes into a letter (or another shape) at the top as the wall rises: a heart
// into an A, a traced drawing into a G. It's its own design (the rail says Morph): a vase with a top shape, whose tools
// are only the ones a morph uses: Bottom (the shape on the plate: a vase's shape from above, or a traced line: Make a
// morph from this line, on the Line tool), Top (a letter: one capital, ! or ?, from the Chocolate lettering made into
// one closed outline, UNB.morphLetter, from the Chocolate font or one of the morph fonts; a ready-made shape,
// UNB.MORPH_SHAPES; or a traced line: Use as the top shape; the Bottom has the shapes too), Change (where the change
// starts and ends, how the shapes pair, the top's turn, and the check), the vase's Profile and Rim. A vase stays a
// vase: with this feature on, its tools have no shape at the top (that's a morph's). Every morph pairs corner to
// corner and each lap is kept apart (planTop.match "corners", keepApart: the engine's 20-morph.js); Auto finds the
// smallest turn that prints (UNB.morphCheck, in its own background engine), and the panel and the ready list say when
// it's too short to print, or prints only the other way up (Turn it over). Off, a vase is as before.
// Found on 26–27 November 2026 (docs/MORPH-PLAN.md): one character prints out of every shape tried on a 20 mm morph
// with 20 mm letters, the letter at the rim; words don't yet.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

VASE_RADIO.top.drawing = "vrDrawing"; // (vase.js: the rim's radio buttons; a letter is a drawing too, shown below)
const MORPH_TURNS_HINT = "no turn, then 20°, 45°, 90° and 180°";
// its own background engine: the shared ones' jobs are cancelled when the trace or the step changes
const MORPH_ENG = makeEngine("morph");
let morphRes = null, // the last check: { key, r (UNB.morphCheck's answer) }
  morphRun = 0,
  morphTimer = 0;
const morphD = () => Math.max(lineWidthMM(), spacingMM() || 0);
let morphLastTop = null; // the traced line last at the top ({ loop, exact, from }): Drawing brings it back

// ---------- a morph is its own design ----------
// in use: the 3D model input, a vase with a shape at the top
const morphOn = () => !!(st.art.kind === "model" && st.model && st.model.vase && st.model.vase.planTop);
on("artKind", () => (morphOn() ? { kind: "morph", cap: "Morph" } : null));
// its name (the print's name until one is typed, the file's, the preview's label): "morph A", or "morph"
on("vaseName", (V) =>
  V.planTop ? (V.planTop.letter ? `morph ${V.planTop.letter}` : V.planTop.shape ? `morph ${morphShapeName(V.planTop.shape).toLowerCase()}` : "morph") : null
);
// the vase's top-shape rows are the morph's Top (a vase's Shape tool then has only the shape from above)
{
  const lab = $("vaseTopVal").closest(".lab"),
    end = document.querySelector("#vaseBox .vr-round");
  for (let el = lab; el; el = el.nextElementSibling) {
    el.dataset.part = "mtop";
    if (el === end) break;
  }
  lab.querySelector(".name").textContent = "Top shape";
  // a letter first: it's what a morph is for
  const first = $(VASE_RADIO.top.same).parentElement.querySelector("input:not([hidden])") || $(VASE_RADIO.top.circle);
  first.before($("vrLetter"), $("vrLetter").nextElementSibling);
  for (const el of [$(VASE_RADIO.top.same), $(VASE_RADIO.top.same).nextElementSibling]) el.hidden = true; // (no top shape: a vase)
}
addMapNode("mbottom", {
  icon: "shape",
  cap: "Bottom",
  step: "art",
  cards: ["h-model"],
  part: "vshape",
  val: () => vasePlanWords(vaseFill(vaseCur).plan),
});
addMapNode("mtop", {
  icon: "text",
  cap: "Top",
  step: "art",
  cards: ["h-model"],
  part: "mtop",
  val: () => {
    const Q = vaseCur.planTop;
    return !Q
      ? ""
      : Q.letter
        ? `the letter ${Q.letter}, ${Q.cap} mm${Q.font && Q.font !== "chocolate" ? `, ${morphFontLabel(Q.font)}` : ""}`
        : Q.shape
          ? morphShapeName(Q.shape).toLowerCase()
          : Q.kind === "drawing"
            ? "a traced line"
            : Q.kind;
  },
});
addMapNode("mchange", {
  icon: "change",
  cap: "Change",
  step: "art",
  cards: ["h-model"],
  part: "mchange",
  val: () => {
    const v = morphVerdict();
    return v ? (v.cls === "ok" ? "prints" : "too short") : "";
  },
});
MAP_SHAPERS.push((S) => {
  // (map.js loads after the features: the icon is added when the map is first drawn; a wall rising into a shape)
  MAP_ICONS.morph ||= "M5 20h14M7 20c0-4 2-6 2-9M17 20c0-4-2-6-2-9M8 3h8l-2 8h-4z";
  MAP_ICONS.change ||= "M4 20h16M12 17V5M8 9l4-4 4 4"; // (Change: up the wall)
  if (morphOn()) S.down.art = ["mbottom", "mtop", "mchange", "vprofile", "vrim"];
});

// ---------- every rim shape pairs corner to corner, each lap kept apart ----------
on("vaseSending", (V) => {
  const Q = V.planTop;
  if (!Q) return;
  // a shape at the top isn't a letter or a drawing any more: what made it one goes (or a letter picked after a
  // shape would come back as the shape, and a shape after a letter as the letter)
  if (Q.kind !== "drawing") for (const k of ["letter", "cap", "font", "shape", "loop", "exact", "from"]) delete Q[k];
  else if (!Q.letter && !Q.shape) morphLastTop = { loop: Q.loop, exact: Q.exact, from: Q.from };
  if (Q.match !== "even") Q.match = "corners";
  Q.keepApart = true;
  morphCheckSoon();
});

// ---------- the rim's size: the profile scaled up the wall so the rim's reach is R, the bottom kept ----------
function morphRimReach(R) {
  const P = vaseCur.profile,
    top = P[P.length - 1][1];
  if (!(top > 0) || !(R > 0)) return;
  vaseCur.profile = P.map(([t, r]) => [t, +(r * (1 + t * (R / top - 1))).toFixed(2)]);
}

// a wall with no texture and no movement (the first letter or drawing at the rim)
function morphPlainWall() {
  vaseCur.move = Object.assign(vaseCur.move, { kind: "none" });
  vaseCur.texture = Object.assign(vaseCur.texture, { kind: "none" });
}

// ---------- a letter at the rim ----------
// ch: one of UNB.MORPH_CHARS; cap: its height (mm). Making a morph (no top shape yet) makes it 20 mm tall (what was
// tried), with no texture or movement, the bottom at its own size if it's a traced line or else a little narrower
// than the letter; within a morph a new letter, size or kind of top keeps the rest and moves the top.
// the lettering a letter is made from: the Chocolate font, or one of the morph fonts (morph-fonts.js: display fonts
// made bold enough to print, each letter one closed outline)
const MORPH_FONTS = Object.assign({ chocolate: UNB_FONTS.chocolate }, window.UNB_MORPH_FONTS || {});
const morphFontLabel = (k) => (k === "chocolate" ? "Chocolate" : (MORPH_FONTS[k] && MORPH_FONTS[k].label) || k);
let morphFont = "chocolate"; // (the one picked: a new letter is made from it)
function morphLetterPlan(ch, cap, font = morphFont) {
  const L = UNB.morphLetter(ch, MORPH_FONTS[font] || UNB_FONTS.chocolate, { cap, d: morphD() });
  if (!L || L.loops !== 1) return null;
  const O = UNB.vaseLineLoop(L.x, L.y);
  return O ? { loop: O.loop, reach: O.reach } : null;
}
function morphUseLetter(ch0) {
  const ch = String(ch0 || "")
      .trim()
      .toUpperCase()
      .slice(0, 1),
    msg = $("moMsg");
  if (!ch || !UNB.MORPH_CHARS.includes(ch)) {
    msg.textContent = `One capital letter, ! or ? (${ch ? `“${ch}” can't morph yet` : "type one"}).`;
    msg.className = "hint warn";
    return false;
  }
  const cap = +$("moCap").value || 20,
    L = morphLetterPlan(ch, cap);
  if (!L) {
    msg.textContent = `“${ch}” didn't come out as one outline at ${cap} mm: try it bigger.`;
    msg.className = "hint warn";
    return false;
  }
  // (entering a morph: no top shape yet. Changing the top within one keeps the height, profile and bottom)
  const was = vaseCur.planTop,
    first = !was;
  vaseCur.planTop = {
    kind: "drawing",
    loop: L.loop,
    exact: true,
    round: 0,
    letter: ch,
    cap,
    font: MORPH_FONTS[morphFont] ? morphFont : "chocolate",
    match: was && was.match === "even" ? "even" : "corners",
    keepApart: true,
    turn: was && was.letter === ch && (was.font || "chocolate") === morphFont ? +was.turn || 0 : 0,
    auto: !(was && was.auto === false),
    sides: 6,
    depth: 0.3,
  };
  if (first) {
    // a letter's corners and slits leave no room for a texture or a movement on the wall (a wave on a G turned
    // tighter than a bead): both off, as Make a vase from this line does
    morphPlainWall();
    vaseCur.height = 20;
    // the bottom at its own size if it's a traced line, else a little narrower than the letter
    const r0 = +(vaseCur.plan && vaseCur.plan.kind === "drawing" ? vaseCur.profile[0][1] : 0.9 * L.reach).toFixed(2);
    vaseCur.profile = [
      [0, r0],
      [0.5, +((r0 + L.reach) / 2).toFixed(2)],
      [1, +L.reach.toFixed(2)],
    ];
  } else morphRimReach(L.reach);
  vaseSend(true);
  vaseUI();
  return true;
}
$("vrLetter").addEventListener("change", () => morphUseLetter($("moLetter").value || "A"));
$("moLetter").addEventListener("input", () => {
  const v = $("moLetter").value.toUpperCase();
  $("moLetter").value = v;
  if (v) morphUseLetter(v);
});
$("moCap").addEventListener("change", () => {
  if (vaseCur.planTop && vaseCur.planTop.letter) morphUseLetter(vaseCur.planTop.letter);
});
$("moCap").addEventListener("input", () => ($("moCapVal").textContent = `${$("moCap").value} mm tall`));

// the lettering: the picked font's buttons (made here, one per font), the letter made again from it
{
  const box = $("moFonts");
  for (const k of Object.keys(MORPH_FONTS)) {
    const id = `moFont-${k}`,
      inp = document.createElement("input"),
      lab = document.createElement("label");
    Object.assign(inp, { type: "radio", name: "moFont", id, value: k, checked: k === "chocolate" });
    lab.htmlFor = id;
    lab.className = "mo-font";
    lab.innerHTML = `<svg viewBox="0 0 10 10" aria-hidden="true"><path/></svg><span>${morphFontLabel(k)}</span>`;
    if (MORPH_FONTS[k].from) lab.title = `${morphFontLabel(k)}: ${MORPH_FONTS[k].from}`;
    box.append(inp, lab);
    inp.addEventListener("change", () => {
      if (!inp.checked) return;
      morphFont = k;
      if (vaseCur.planTop && vaseCur.planTop.letter) morphUseLetter(vaseCur.planTop.letter);
      else morphLabels();
    });
  }
}

// each lettering's button shows the letter in it (the font's own outlines, as drawn: not yet made one line)
function morphFontPics(ch) {
  ch = (ch || "A").toUpperCase();
  for (const k of Object.keys(MORPH_FONTS)) {
    const lab = document.querySelector(`label[for="moFont-${k}"]`),
      g = MORPH_FONTS[k].glyphs[ch] || MORPH_FONTS[k].glyphs.A;
    if (!lab || !g) continue;
    const L = g[1].split("|").map((st) => st.trim().split(/\s+/).map((q) => q.split(",").map(Number)));
    const xs = L.flat().map((q) => q[0]),
      ys = L.flat().map((q) => q[1]),
      x0 = Math.min(...xs),
      y1 = Math.max(...ys),
      w = Math.max(...xs) - x0,
      h = y1 - Math.min(...ys),
      sc = 9 / Math.max(w, h, 1),
      ox = (10 - w * sc) / 2,
      oy = (10 - h * sc) / 2;
    const d = L.map((P) => P.map(([x, y], i) => `${i ? "L" : "M"}${(ox + (x - x0) * sc).toFixed(2)} ${(oy + (y1 - y) * sc).toFixed(2)}`).join("") + (k === "chocolate" ? "" : "Z")).join("");
    const path = lab.querySelector("path");
    path.setAttribute("d", d);
    path.classList.toggle("hair", k === "chocolate");
  }
}
morphFontPics("A");

// ---------- a ready-made shape at the bottom or the top (UNB.MORPH_SHAPES) ----------
const morphShapeName = (k) => (UNB.MORPH_SHAPES && UNB.MORPH_SHAPES[k]) || k;
function morphShapeLoop(key) {
  const S = UNB.morphShape(key);
  return S ? UNB.vaseLineLoop(S.x, S.y) : null;
}
// where: "bottom" (the vase's shape from above, at the size the profile gives it) or "top" (the rim's shape, at the
// rim's size; entering a morph with it makes it 20 mm tall, a plain wall)
function morphUseShape(where, key) {
  const O = morphShapeLoop(key);
  if (!O) return;
  if (where === "bottom") {
    vaseCur.plan = { kind: "drawing", loop: O.loop, exact: true, round: 0, shape: key, sides: 6, depth: 0.3 };
    $("vpDrawMsg").textContent = "";
  } else {
    const was = vaseCur.planTop;
    if (!was) {
      morphPlainWall();
      vaseCur.height = 20;
    }
    vaseCur.planTop = {
      kind: "drawing",
      loop: O.loop,
      exact: true,
      round: 0,
      shape: key,
      match: was && was.match === "even" ? "even" : "corners",
      keepApart: true,
      turn: 0,
      auto: !(was && was.auto === false),
      sides: 6,
      depth: 0.3,
    };
  }
  vaseSend(true);
  vaseUI();
}
// one picker: in a morph the vase's own shapes (Circle, Polygon, Star, Flower; Flat at the bottom) are buttons at the
// start of the grid, drawn like the rest; each taps the vase's own choice (its radio, put away in a morph)
const MORPH_BUILTIN = {
  bottom: [
    ["circle", "Circle", "vpCircle"],
    ["polygon", "Polygon", "vpPolygon"],
    ["star", "Star", "vpStar"],
    ["flower", "Flower", "vpFlower"],
    ["plaque", "Flat", "vpPlaque"],
  ],
  top: [
    ["circle", "Circle", "vrCircle"],
    ["polygon", "Polygon", "vrPolygon"],
    ["star", "Star", "vrStar"],
    ["flower", "Flower", "vrFlower"],
  ],
};
const builtinPath = (k) => {
  const P = [];
  for (let i = 0; i < 120; i++) {
    const a = Math.PI / 2 + (2 * Math.PI * i) / 120,
      r =
        k === "polygon"
          ? Math.cos(Math.PI / 6) / Math.cos((((a - Math.PI / 2) % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3) - Math.PI / 6)
          : k === "star"
            ? 0.72 + 0.28 * Math.cos(5 * (a - Math.PI / 2))
            : k === "flower"
              ? 0.78 + 0.22 * Math.cos(6 * a)
              : 1;
    P.push(k === "plaque" ? [Math.cos(a), 0.32 * Math.sign(Math.sin(a)) * Math.min(1, Math.abs(Math.sin(a)) * 4)] : [r * Math.cos(a), r * Math.sin(a)]);
  }
  return P.map(([x, y], i) => `${i ? "L" : "M"}${(22 + 19 * x).toFixed(1)} ${(22 - 19 * y).toFixed(1)}`).join("") + "Z";
};
for (const [where, box] of [
  ["bottom", $("moBotShapes")],
  ["top", $("moTopShapes")],
])
  for (const [k, name, radio] of MORPH_BUILTIN[where]) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn mini";
    b.dataset.builtin = k;
    b.title = name;
    b.setAttribute("aria-label", name);
    b.innerHTML = `<svg viewBox="0 0 44 44" aria-hidden="true"><path d="${builtinPath(k)}"/></svg>`;
    b.addEventListener("click", () => {
      $(radio).checked = true;
      $(radio).dispatchEvent(new Event("change", { bubbles: true }));
    });
    box.append(b);
  }
// the ready-made shapes after them: each drawn small, its name on hover
for (const [where, box] of [
  ["bottom", $("moBotShapes")],
  ["top", $("moTopShapes")],
]) {
  for (const k of Object.keys(UNB.MORPH_SHAPES || {})) {
    const S = UNB.morphShape(k),
      b = document.createElement("button");
    b.type = "button";
    b.className = "btn mini";
    b.dataset.shape = k;
    b.title = morphShapeName(k);
    b.setAttribute("aria-label", morphShapeName(k));
    const x0 = Math.min(...S.x),
      y1 = Math.max(...S.y),
      d = S.x.map((x, i) => `${i ? "L" : "M"}${(x - x0 + 2).toFixed(1)} ${(y1 - S.y[i] + 2).toFixed(1)}`).join("") + "Z";
    b.innerHTML = `<svg viewBox="0 0 44 44" aria-hidden="true"><path d="${d}"/></svg>`;
    b.addEventListener("click", () => morphUseShape(where, k));
    box.append(b);
  }
}

// ---------- a traced line at the top of a morph (the Line tool: Use as the top shape) ----------
function morphTopFromLine() {
  const F = st.final,
    msg = $("vaseFromMsg");
  if (!F || !F.re || F.re.length < 8) {
    msg.textContent = "Nothing traced yet: trace a picture, text or pattern first.";
    msg.className = "hint warn";
    return;
  }
  const k = scale(),
    xs = Array.from(F.re, (v) => v * k),
    ys = Array.from(F.im, (v) => -v * k);
  let O = st.open ? null : UNB.vaseLineLoop(xs, ys);
  if (!O) {
    const E = UNB.vaseOutline(xs, ys);
    if (!E) {
      msg.textContent = "The traced line has no inside to make a rim from.";
      msg.className = "hint warn";
      return;
    }
    O = { loop: E.loop, reach: 0, exact: false };
  }
  const R = O.reach > 0 ? +O.reach.toFixed(2) : 15,
    from = $("designName").value.trim() || (typeof autoName === "function" ? autoName() : "");
  // no vase in use yet: a round one, a little narrower than the drawing, 20 mm tall
  const inUse = st.art.kind === "model" && st.model && st.model.vase;
  if (!inUse) {
    vaseCur = UNB.vaseDefaults();
    vaseCur.height = 20;
    vaseCur.move = Object.assign(vaseCur.move, { kind: "none" });
    vaseCur.profile = [
      [0, +(0.9 * R).toFixed(2)],
      [0.5, +(0.95 * R).toFixed(2)],
      [1, R],
    ];
  } else vaseCur = structuredClone(st.model.vase);
  if (!(vaseCur.planTop && vaseCur.planTop.kind === "drawing")) morphPlainWall();
  artUse("model"); // art.js: the 3D model input, the vase in it
  $("mfMorph").checked = true;
  vaseCur.planTop = {
    kind: "drawing",
    loop: O.loop,
    exact: O.exact,
    round: 0,
    from,
    match: "corners",
    keepApart: true,
    turn: 0,
    auto: true,
    sides: 6,
    depth: 0.3,
  };
  morphRimReach(R);
  msg.textContent = "";
  useVase(vaseCur, true);
  vaseUI();
  if (!$("viewArt").checked) $("viewArt").click();
  if (typeof mapOpen === "function") mapOpen("vshape");
}
$("moTopFromLine").addEventListener("click", morphTopFromLine);
// ---------- a traced line at the bottom, a letter at the top (the Line tool: Make a morph from this line) ----------
// the vase's own Make a vase from this line, at the line's own size, then the letter on top
function morphBottomFromLine() {
  vaseFromLine(); // vase.js
  const V = st.model && st.model.vase;
  if (!(st.art.kind === "model" && V && V.plan.kind === "drawing")) return; // (it said why)
  vaseCur = structuredClone(V);
  if (
    morphUseLetter((vaseCur.planTop && vaseCur.planTop.letter) || $("moLetter").value || "A") &&
    typeof mapOpen === "function"
  )
    mapOpen("mtop");
}
$("moFromLine").addEventListener("click", morphBottomFromLine);
// Drawing at the top: the traced line last there, or how to put one there
$("vrDrawing").addEventListener("change", () => {
  if (morphLastTop) {
    vaseCur.planTop = Object.assign({}, vaseCur.planTop, morphLastTop, { kind: "drawing", round: 0, turn: 0 });
    for (const k of ["letter", "cap", "font", "shape"]) delete vaseCur.planTop[k];
    vaseSend(true);
    vaseUI();
    return;
  }
  $("moMsg").textContent = "Trace a line, then Use as the top shape on the Line tool, to put it at the top.";
  $("moMsg").className = "hint";
  vaseUI();
});

// ---------- where the change happens, how the shapes pair, the turn ----------
// the change from Change starts to Change ends (shares of the height) as the vase's blend curve; all the way: none
function morphBlend() {
  const a = +$("moFrom").value / 100,
    b = Math.max(a + 0.1, +$("moTo").value / 100);
  vaseCur.blend =
    a <= 0 && b >= 1
      ? null
      : [[0, 0], ...(a > 0 ? [[a, 0]] : []), [(a + b) / 2, 0.5], ...(b < 1 ? [[b, 1]] : []), [1, 1]];
}
for (const id of ["moFrom", "moTo"]) {
  $(id).addEventListener("input", () => {
    morphBlend();
    morphLabels();
    vaseSend(false);
  });
  $(id).addEventListener("change", () => vaseSend(true));
}
for (const id of ["moCorners", "moEven"])
  $(id).addEventListener("change", () => {
    if (!vaseCur.planTop) return;
    vaseCur.planTop.match = $(id).value;
    vaseSend(true);
    vaseUI();
  });
$("moTurn").addEventListener("input", () => {
  if (!vaseCur.planTop) return;
  vaseCur.planTop.turn = +$("moTurn").value;
  vaseCur.planTop.auto = false; // (turned by hand: Auto steps aside)
  $("moAuto").checked = false;
  morphLabels();
  vaseSend(false);
});
$("moTurn").addEventListener("change", () => vaseSend(true));
$("moAuto").addEventListener("change", () => {
  if (!vaseCur.planTop) return;
  vaseCur.planTop.auto = $("moAuto").checked;
  vaseSend(true);
});
// Turn it over: the rim's shape at the bottom and the bottom's at the rim (the check found it prints that way)
$("moFlip").addEventListener("click", () => {
  const V = vaseCur,
    Q = V.planTop;
  if (!Q) return;
  const bottom = Object.assign({}, V.plan);
  V.plan = Object.assign({}, Q, { match: undefined, keepApart: undefined, turn: undefined, auto: undefined });
  V.planTop = Object.assign({}, bottom, { match: Q.match, keepApart: true, turn: 0, auto: true });
  V.profile = V.profile.map(([t, r]) => [+(1 - t).toFixed(4), r]).reverse();
  if (V.blend) V.blend = V.blend.map(([t, k]) => [1 - t, 1 - k]).reverse();
  vaseSend(true);
  vaseUI();
});

// ---------- Make a morph / Make a vase (the 3D model card) ----------
// a morph from the vase in use (or a new one): the letter on top; a vase from a morph: the top shape goes
$("mfMorph").addEventListener("change", () => {
  if (!$("mfMorph").checked) return;
  if (st.model && st.model.vase) vaseCur = structuredClone(st.model.vase);
  if (vaseCur.planTop) {
    useVase(vaseCur, true);
    vaseUI();
    return;
  }
  if (morphUseLetter($("moLetter").value || "A") && typeof mapOpen === "function") mapOpen("mtop");
});
$("mfVase").addEventListener("change", () => {
  if (!($("mfVase").checked && st.model && st.model.vase && st.model.vase.planTop)) return;
  vaseCur = structuredClone(st.model.vase);
  vaseCur.planTop = null;
  vaseCur.blend = null;
  vaseSend(true);
  vaseUI();
});

// ---------- the check (in the background): a turn that prints, which way up, how tall ----------
function morphKey(V) {
  return JSON.stringify([
    V.plan,
    V.planTop,
    V.profile,
    V.height,
    V.blend || null,
    V.twist,
    layerHmm(),
    lineWidthMM(),
    morphD(),
    overhangMM(),
  ]);
}
function morphCheckSoon() {
  clearTimeout(morphTimer);
  morphTimer = setTimeout(morphCheckNow, 600);
}
async function morphCheckNow() {
  const V = st.model && st.model.vase;
  if (!(V && V.planTop)) {
    morphRes = null;
    morphLabels();
    return;
  }
  const key = morphKey(V);
  if (morphRes && morphRes.key === key) {
    // already known (an undo back to it): a check still running for another vase isn't wanted
    MORPH_ENG.cancel();
    morphRun++;
    morphLabels();
    return;
  }
  MORPH_ENG.cancel(); // (a check of an older vase isn't wanted any more)
  const run = ++morphRun,
    Q = V.planTop,
    auto = Q.auto !== false,
    opt = {
      h: layerHmm(),
      z0: firstZ(),
      w: lineWidthMM(),
      d: morphD(),
      overhang: overhangMM(),
      turns: auto ? UNB.MORPH_TURNS : [+Q.turn || 0],
    };
  $("moMsg").textContent = "Checking the morph…";
  $("moMsg").className = "hint";
  morphChip("busy", "Checking…");
  let r;
  try {
    r = await MORPH_ENG.call("morphCheck", [V, opt], (p) => {
      if (run === morphRun) $("moMsg").textContent = `Checking the morph… ${p.done} of up to ${p.of}`;
    });
  } catch (e) {
    if (run !== morphRun) return;
    if (e === CANCELLED) {
      morphCheckSoon(); // (stopped from outside: asked again)
      return;
    }
    $("moMsg").textContent = `The check failed: ${String(e).slice(0, 120)}`;
    $("moMsg").className = "hint warn";
    morphChip("warn", "Check failed");
    return;
  }
  if (run !== morphRun) return;
  morphRes = { key, r };
  // (the vase changed while it ran: check that one)
  if (!(st.model && st.model.vase) || morphKey(st.model.vase) !== key) {
    morphCheckSoon();
    return;
  }
  // Auto: the smallest turn that prints, put on the vase (its check then passes at once)
  if (auto && r.ok && r.turn !== (+Q.turn || 0) && st.model && st.model.vase === V) {
    vaseCur = structuredClone(V);
    vaseCur.planTop.turn = r.turn;
    morphRes = null;
    vaseSend(true);
    vaseUI();
    return;
  }
  morphLabels();
  if (typeof readyUI === "function") readyUI(); // (the ready list)
}
for (const id of ["gOver", "layerH"]) $(id).addEventListener("change", morphCheckSoon);

// what the check found, in words: { cls: "ok" | "warn", text, flip }
function morphVerdict() {
  const V = st.model && st.model.vase;
  if (!(V && V.planTop && morphRes && morphRes.key === morphKey(V))) return null;
  const r = morphRes.r,
    turn = +V.planTop.turn || 0;
  if (r.ok)
    return {
      cls: "ok",
      text: `Prints: every lap sits on the one below${turn ? `, with the top shape turned ${turn}°${V.planTop.auto !== false ? " (Auto)" : ""}` : ""}.`,
    };
  const flip = r.flip && r.flip.ok;
  return {
    cls: "warn",
    text: r.cut
      ? `Doesn't print as it is at the turns tried in time (a detailed shape is slow to check): about ${r.needH} mm tall would, or a simpler shape.`
      : `Too short to print as it is${V.planTop.auto !== false ? ` at any turn (${MORPH_TURNS_HINT})` : " at this turn"}: about ${r.needH} mm tall would${flip ? ". The other way up prints at this height" : ""}.`,
    flip,
  };
}

// From above: the bottom (grey) and the top (the accent) drawn over each other as they print, in a corner of the
// preview: how the change has to go, and what Turn and Pair do
function morphFromAbove(V) {
  const box = $("moAbove");
  box.hidden = !(V && V.planTop && morphOn());
  if (box.hidden) return;
  const cv = $("moAboveCv"),
    dpr = window.devicePixelRatio || 1,
    S = 120;
  cv.width = cv.height = S * dpr;
  const g = cv.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, S, S);
  let E;
  try {
    E = UNB.vaseEnds(V, 720);
  } catch (e) {
    box.hidden = true;
    return;
  }
  const all = [...E.bottom.x, ...E.top.x].map(Math.abs).concat([...E.bottom.y, ...E.top.y].map(Math.abs)),
    k = (S / 2 - 8) / Math.max(1, ...all);
  const css = getComputedStyle(document.body);
  for (const [R, col, w] of [
    [E.bottom, css.getPropertyValue("--muted") || "#888", 1.2],
    [E.top, css.getPropertyValue("--accent") || "#b0703a", 1.6],
  ]) {
    g.beginPath();
    for (let i = 0; i < R.x.length; i++) g[i ? "lineTo" : "moveTo"](S / 2 + R.x[i] * k, S / 2 - R.y[i] * k);
    g.closePath();
    g.strokeStyle = col.trim();
    g.lineWidth = w;
    g.stroke();
  }
}

// the verdict on the preview too, beside the size (a tap opens Change): "✓ Prints", "Too short: …", "Checking…"
function morphChip(cls, text) {
  const c = $("moChip");
  c.hidden = !cls || !morphOn();
  if (!cls) return;
  c.textContent = text;
  c.className = `mo-chip ${cls}`;
}
$("moChip").addEventListener("click", () => mapOpen("mchange"));

// ---------- the panel ----------
function morphLabels() {
  const V = vaseCur,
    Q = V.planTop,
    on = !!Q,
    letter = !!(Q && Q.letter);
  document.querySelectorAll("#vaseBox .mo-on").forEach((el) => (el.hidden = !on));
  document.querySelectorAll("#vaseBox .mo-letter").forEach((el) => (el.hidden = !letter));
  // (a letter is made rounded to the bead already: the rim's Rounded would only blur it)
  document.querySelectorAll("#vaseBox .vr-round").forEach((el) => (el.hidden = letter));
  if (letter) {
    $("vrLetter").checked = true;
    $("vaseTopVal").textContent = "a letter"; // (which, and its size, are on their own rows)
  }
  // a ready-made shape shows as the Drawing button, called Shape (its name on the row above and on its own button)
  const topShape = !!(Q && Q.shape),
    P = V.plan;
  $("vrDrawingLab").hidden = $("vrDrawing").hidden = !((Q && Q.kind === "drawing" && !Q.letter) || morphLastTop);
  $("vrDrawingLab").textContent = topShape ? "Shape" : "Drawing";
  $("vpDrawingLab").textContent = P && P.shape ? "Shape" : "Drawing";
  // (lit, and named, only while it's the shape in use: a Circle picked after it keeps it for the Shape button)
  const botShape = P && P.kind === "drawing" && P.shape;
  for (const [box, k] of [
    ["moBotShapes", botShape],
    ["moTopShapes", topShape && Q.shape],
  ])
    $(box).querySelectorAll("button[data-shape]").forEach((b) => b.classList.toggle("on", b.dataset.shape === k));
  // the built-ins: lit when that's the shape (a top: not a letter or a shape); their radios put away in a morph
  const mo = morphOn();
  for (const [where, box, kind] of [
    ["bottom", "moBotShapes", P && !botShape && P.kind],
    ["top", "moTopShapes", Q && !letter && !topShape && Q.kind],
  ]) {
    $(box).querySelectorAll("button[data-builtin]").forEach((b) => b.classList.toggle("on", b.dataset.builtin === kind));
    for (const [, , radio] of MORPH_BUILTIN[where]) {
      $(radio).hidden = mo;
      document.querySelector(`label[for="${radio}"]`).hidden = mo;
    }
  }
  $("moBotShapeVal").textContent = botShape ? morphShapeName(P.shape) : "";
  $("moTopShapeVal").textContent = topShape ? morphShapeName(Q.shape) : "";
  if (topShape) $("vaseTopVal").textContent = `blends to ${morphShapeName(Q.shape).toLowerCase()}`;
  $("moFontVal").textContent = morphFontLabel(letter ? Q.font || "chocolate" : morphFont);
  morphFontPics(letter ? Q.letter : $("moLetter").value);
  morphParts();
  morphFromAbove(V);
  // a shape choice with nothing left in it (a morph's built-ins are in the grid) isn't shown
  for (const id of ["vpCircle", "vrCircle"]) {
    const seg = $(id).closest(".seg");
    seg.hidden = mo && ![...seg.querySelectorAll("input")].some((i) => !i.hidden);
  }
  // the 3D model card's switch, and the Line tool's second button (only once there's a morph)
  if (morphOn()) $("mfMorph").checked = true;
  $("moTopFromLine").hidden = !morphOn();
  document.querySelectorAll("#vaseBox .mo-only").forEach((el) => (el.hidden = !morphOn()));
  $("moCapVal").textContent = `${$("moCap").value} mm tall`;
  $("moLetterVal").textContent = "A–Z, ! or ?";
  const a = +$("moFrom").value,
    b = +$("moTo").value;
  $("moFromVal").textContent = a ? `${a}% up (${fmt((V.height * a) / 100, 1)} mm)` : "at the bottom";
  $("moToVal").textContent = b < 100 ? `${b}% up (${fmt((V.height * b) / 100, 1)} mm)` : "at the top";
  $("moMatchVal").textContent = Q && Q.match === "even" ? "evenly round" : "corner to corner";
  $("moTurnVal").textContent = Q ? `${+Q.turn || 0}°` : "";
  const v = morphVerdict(),
    msg = $("moMsg");
  if (v) {
    msg.textContent = v.text;
    msg.className = v.cls === "ok" ? "hint verdict ok" : "hint verdict warn";
    morphChip(v.cls, v.cls === "ok" ? "✓ Prints" : `Too short: about ${morphRes.r.needH} mm would print`);
  } else if (!on) msg.textContent = "";
  if (!morphOn()) morphChip(null);
  $("moFlip").hidden = !(v && v.flip);
}
// what a morph's tools hold that a vase's don't: the twist and the lean are part of the change (Change, not Bottom),
// and the line drawing of the view isn't the profile's (it stays with all the settings, on the Morph node)
function morphParts() {
  const m = morphOn(),
    moves = [];
  const set = (el, part) => {
    if (el && el.dataset.part !== part) {
      el.dataset.part = part;
      moves.push(el);
    }
  };
  document.querySelectorAll("#vaseBox .mo-shift").forEach((el) => set(el, m ? "mchange" : "vshape"));
  // (reached through their controls: the rows are the model's and the vase's)
  set($("hlPreview").closest("[data-part]"), m ? "whole" : "vprofile");
  $("vaseTwist").closest(".row").querySelector(".lab label").textContent = m ? "Twist as it rises" : "Turn the shape, bottom to rim";
  // (a tool open now: shown or put away as its part says, as map.js does on opening it)
  const N = typeof mapOpenId !== "undefined" && mapOpenId && MAP_NODES[mapOpenId];
  if (N) for (const el of moves) el.classList.toggle("part-off", !!N.part && !el.dataset.part.split(" ").includes(N.part));
}
on("vaseShown", (V) => {
  const Q = V.planTop;
  if (Q && Q.letter) {
    $("moLetter").value = Q.letter;
    $("moCap").value = Q.cap || 20;
    morphFont = MORPH_FONTS[Q.font] ? Q.font : "chocolate";
    const fb = $(`moFont-${morphFont}`);
    if (fb) fb.checked = true;
  }
  // the blend curve back to its two sliders (a curve made here; anything else shows as the whole wall)
  const B = V.blend;
  let a = 0,
    b = 100;
  if (B && B.length >= 3) {
    const flat0 = B.filter(([, k]) => k <= 0).pop(),
      full = B.find(([, k]) => k >= 1);
    a = flat0 ? Math.round(flat0[0] * 100) : 0;
    b = full ? Math.round(full[0] * 100) : 100;
  }
  $("moFrom").value = a;
  $("moTo").value = b;
  $(Q && Q.match === "even" ? "moEven" : "moCorners").checked = true;
  $("moTurn").value = Q ? +Q.turn || 0 : 0;
  $("moAuto").checked = !(Q && Q.auto === false);
  morphLabels();
  morphCheckSoon();
});
on("vaseLabelled", () => morphLabels());

// ---------- the ready list (export.js) ----------
on("ready", (L, add) => {
  if (!L.vase || !(st.model && st.model.vase && st.model.vase.planTop)) return;
  const v = morphVerdict();
  if (v) add(v.cls, `Morph: ${v.text}`, "h-model");
  const M = L.morph,
    d = morphD();
  if (M && M.closest < 0.9 * d)
    add(
      "warn",
      `Morph: two parts of a lap come ${fmt(M.closest, 2)} mm apart (the spacing is ${fmt(d, 2)}): taller, or a bigger letter, gives them room`,
      "h-model"
    );
});
