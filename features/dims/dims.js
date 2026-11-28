// Unbroken · web app · dims.js
// The app by dimension (docs/DIMENSIONS-PLAN.md; Nicolaas, 27 November 2026): 2D, 2.5D and 3D in the header, in
// place of "For". A design's dimension is read from what it is, so nothing new is saved and an old design opens where
// it belongs:
//   2D    a line, for a pen plotter (the plot output);
//   2.5D  a line built up in layers, for a printer (a picture, text, pattern or molecule; one layer to start);
//   3D    a full shape, for a printer (a vase, a morph, a relief or an STL: the 3D model input).
// Going to 3D asks how: a vase or a morph from the line, a relief from the picture, text or pattern, a new vase or
// morph, or an STL. Coming back from 3D goes to the last line's source (the picture, text, pattern or molecule, kept
// as it was). The rail follows: Layers is on the design rail in 2.5D as in 3D; "Make it 3D" leaves the Picture and
// Line panels (it's the 3D button's menu now); Input lists only the line's sources. ?off=dims gives the For chips back.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

const DIMS = [
  { key: "2d", cap: "2D", sub: "a line · pen plotter" },
  { key: "2.5d", cap: "2.5D", sub: "a line in layers · printer" },
  { key: "3d", cap: "3D", sub: "a full shape · printer" },
];
let dimsLast2D = "picture"; // the line's source to come back to from 3D
const dimsNow = () => (OUTPUTS.plot && outputNow() === "plot" ? "2d" : st.art.kind === "model" ? "3d" : "2.5d");
const dimsSay = (k) => (DIMS.find((D) => D.key === k) || DIMS[1]).cap;

// ---------- the header ----------
document.body.dataset.dims = "1";
const dimsBar = document.createElement("div");
dimsBar.className = "dims-bar";
dimsBar.setAttribute("role", "group");
dimsBar.setAttribute("aria-label", "What it is: 2D, 2.5D or 3D");
for (const D of DIMS) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "chip-btn dims-chip";
  b.dataset.dim = D.key;
  b.innerHTML = "<b></b><small></small>";
  b.querySelector("b").textContent = D.cap;
  b.querySelector("small").textContent = D.sub;
  b.title = `${D.cap}: ${D.sub}`;
  b.addEventListener("click", (e) => dimsGo(D.key, e.currentTarget));
  dimsBar.append(b);
}
document.querySelector(".map-top").append(dimsBar);
document.querySelector(".map-top .name").textContent = "Make"; // (it said For: what it's for is now what it is)
// (2D is the pen plotter's: without the plotter feature there's no 2D)
if (!OUTPUTS.plot) dimsBar.querySelector('[data-dim="2d"]').disabled = true;

let dimsKind = null;
function dimsUI() {
  // a full shape is printed, never plotted: an example or a file that brings one in leaves the plotter
  // (only as it comes in: plotting a model afterwards is Draw this view's way to 2D)
  if (st.art.kind === "model" && dimsKind !== "model" && $("artForPlot") && $("artForPlot").checked) {
    dimsKind = "model";
    return setTimeout(() => dimsOutput("print"));
  }
  dimsKind = st.art.kind;
  const now = dimsNow();
  document.body.dataset.dim = now;
  if (st.art.kind !== "model") dimsLast2D = st.art.kind;
  dimsBar.querySelectorAll(".dims-chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.dim === now)));
}
on("artUI", dimsUI);
document.querySelectorAll('input[name="artFor"]').forEach((r) => r.addEventListener("change", dimsUI));
dimsUI();

// ---------- moving between them ----------
// each keeps its own size: a plot fills its page, a print is as big as it was made (the Size card) — the plotter's
// page fitting used to carry over when you went back to the printer
let dimsPrintW = 0;
function dimsOutput(key, from3d) {
  const r = $(key === "plot" ? "artForPlot" : "artForPrint");
  if (!r || r.checked) return;
  // (from 3D the width is the shape's, not the print's: keep the one from before 3D)
  if (key === "plot" && st.art.kind !== "model" && !from3d) dimsPrintW = +$("outW").value || 0;
  mapPick(r);
  if (key === "print") dimsSizeBack();
}
// (the print's own size, as it was before the plotter or a 3D shape made from it changed the width)
// The width as printed depends on the line traced (printedW): back from the plotter its strokes are still the line,
// so it's set again once the printer's own trace is in.
async function dimsSizeBack() {
  const want = dimsPrintW,
    set = () => {
      if (want > 0 && st.art.kind !== "model" && Math.abs(+$("outW").value - want) > 0.05) {
        $("outW").value = want;
        $("outW").dispatchEvent(new Event("change", { bubbles: true }));
      }
    };
  set();
  const was = st.final;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (dimsPrintW !== want || st.art.kind === "model" || (OUTPUTS.plot && outputNow() === "plot")) return; // (moved on)
    if (st.final !== was && !$("chip").classList.contains("busy")) return set();
  }
}
function dimsGo(key, chip) {
  const now = dimsNow();
  const wasOpen = !!dimsMenuEl;
  dimsMenu(false);
  // 3D opens the menu, in 3D too (it's how to start another full shape); a second tap closes it
  if (key === "3d") {
    if (wasOpen) return;
    if (now !== "3d") dimsPrintW = (OUTPUTS.plot && outputNow() === "plot") ? dimsPrintW : +$("outW").value || dimsPrintW;
    return dimsMenu(true, chip);
  }
  if (key === now) return;
  if (now === "3d") {
    artUse(dimsLast2D || "picture"); // (back to the line's source, as it was)
    if (key === "2.5d") setTimeout(dimsSizeBack, 0);
  }
  dimsOutput(key === "2d" ? "plot" : "print", now === "3d");
  dimsUI();
  setTimeout(() => {
    mapFollowStep();
    mapOpen("art");
  }, 0);
}

// ---------- going to 3D: how ----------
let dimsMenuEl = null;
const dimsLine = () => !!(st.final && st.final.re && st.final.re.length >= 8 && st.art.kind !== "model");
// a line's source in use (a vase or morph can come from it; for a pen plotter it's traced as one line first)
const dimsSource = () => st.art.kind !== "model" && !isEmpty();
// the line traced for the printer (as one line), then go: from 2D the plotter's strokes are traced again first
async function dimsWithLine(go) {
  if (!(OUTPUTS.plot && outputNow() === "plot") && dimsLine()) return go();
  // (the plotter's line is at the page's size: wait for the printer's own trace, a new line at the design's size)
  const was = st.final;
  dimsOutput("print");
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (dimsLine() && st.final !== was && !$("chip").classList.contains("busy")) return go();
  }
  go(); // (the button says why when there's still no line)
}
function dimsMenu(open, chip) {
  if (dimsMenuEl) {
    dimsMenuEl.remove();
    dimsMenuEl = null;
  }
  if (!open) return;
  const m = document.createElement("div");
  m.className = "dims-menu";
  m.setAttribute("role", "menu");
  const src = dimsSource() ? { picture: "picture", text: "text", pattern: "pattern", molecule: "molecule" }[st.art.kind] || "drawing" : "";
  const items = [];
  // from what's here: the line (vase, morph) and the source (relief)
  if (src && $("vaseFromLine"))
    items.push(["A vase from this line", "Its shape from above is the line", () => dimsWithLine(() => $("vaseFromLine").click())]);
  if (src && $("moFromLine"))
    items.push(["A morph from this line", "The line at the bottom, a letter on top", () => dimsWithLine(() => $("moFromLine").click())]);
  if ($("reliefMake") && typeof reliefFromNow === "function" && reliefFromNow())
    items.push([`A relief from this ${src || "picture"}`, "Its greys stand out from an upright wall", () => $("reliefMake").click()]);
  if (items.length) items.push(null);
  // new
  if ($("mfVase")) items.push(["A new vase", "A profile, a shape, a texture", () => dimsModel("mfVase")]);
  if ($("mfMorph")) items.push(["A new morph", "A shape that changes into letters as it rises", () => dimsModel("mfMorph")]);
  items.push(["An STL file…", "A 3D model, sliced and traced layer by layer", () => (dimsModel("mfStl"), $("anyFile").click())]);
  items.push(["The sample skull cup", "An STL to try", () => useExample("skull")]);
  for (const it of items) {
    if (!it) {
      m.append(Object.assign(document.createElement("hr"), { className: "dims-sep" }));
      continue;
    }
    const [cap, what, go] = it,
      b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "menuitem");
    b.innerHTML = "<b></b><span></span>";
    b.querySelector("b").textContent = cap;
    b.querySelector("span").textContent = what;
    b.addEventListener("click", async () => {
      dimsMenu(false);
      await go();
      dimsOutput("print");
      dimsUI();
      recordSoon();
      setTimeout(() => {
        mapFollowStep();
        mapOpen("art");
      }, 0);
    });
    m.append(b);
  }
  const r = chip.getBoundingClientRect();
  m.style.left = `${Math.max(8, r.left)}px`;
  m.style.top = `${r.bottom + 6}px`;
  document.body.append(m);
  dimsMenuEl = m;
  m.querySelector("button").focus();
}
// a new model of a kind: the 3D model input, its kind picked
function dimsModel(id) {
  artUse("model");
  const r = $(id);
  if (r) mapPick(r);
}
document.addEventListener("pointerdown", (e) => {
  if (dimsMenuEl && !dimsMenuEl.contains(e.target) && !e.target.closest(".dims-chip")) dimsMenu(false);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && dimsMenuEl) {
    dimsMenu(false);
    e.preventDefault();
  }
});

// what it is, for other parts (the examples tray)
on("dimNow", () => dimsNow());
