// Unbroken · web app · examples.js
// A clean start, and the examples one tap away. The app opens empty (the Art step's preview says how to start) unless
// settings.js names a sample (defaults.sample) or the page's address does (?example=leaf: the tests start that way).
// The
// examples — pictures, patterns, lettering and a 3D model — are chips in the Input card and on the empty preview; each
// becomes the input in use just as choosing it by hand would.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// key, name, what it is, and how it becomes the input
const EXAMPLES = [
  ["leaf", "Leaf", "a line drawing", () => artExamplePicture("leaf")],
  ["still", "Still life", "flat greys: try Grey levels", () => artExamplePicture("still")],
  ["face", "Face", "soft greys: try a picture pattern", () => artExamplePicture("face")],
  ["shapes", "Shapes & text", "outlines and letters", () => artExamplePicture("shapes")],
  ["smiley", "Smiley", "a simple drawing", () => artExamplePicture("smiley")],
  ["labyrinth", "Labyrinth", "a pattern, one closed line", () => artExamplePattern("labyrinth")],
  ["spirograph", "Spirograph", "a pattern that crosses itself", () => artExamplePattern("spirograph")],
  ["portrait", "Wave portrait", "the face in wave rows", () => artExamplePattern("wavesTone")],
  ["lettering", "Lettering", "text in a single-stroke font", () => artUse("text")],
  ["theobromine", "Theobromine", "a molecule: chocolate's own", () => moleculeExample("theobromine")],
  ["vase", "Vase", "a 3D model", () => artUse("model")],
];
function useExample(key) {
  const e = EXAMPLES.find(([k]) => k === key);
  if (!e) return false;
  e[3]();
  return true;
}
// the chips (the Input card and the empty preview get the same row)
document.querySelectorAll("[data-examples]").forEach((box) => {
  for (const [key, name, what] of EXAMPLES) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip-btn";
    b.dataset.example = key;
    b.textContent = name;
    b.title = what;
    b.addEventListener("click", () => {
      useExample(key);
      recordSoon();
    });
    box.appendChild(b);
  }
});
$("esChoose").addEventListener("click", () => $("anyFile").click());

// Empty: the Art step's Picture with no picture yet. The preview says how to start; the trace has nothing to do.
const isEmpty = () => st.art.kind === "picture" && !st.art.picture;
function emptyUI() {
  const e = isEmpty(),
    was = document.body.dataset.empty === "1";
  document.body.dataset.empty = e ? "1" : "";
  $("emptyState").hidden = !e;
  // the readout and the Trace note were set while it was empty (an opened design, the art as drawn): again, now
  if (was && !e && typeof workflowUI === "function") workflowUI(); // workflow.js
}
// a blank page to trace while empty (so the steps after Art show nothing, not the last input)
function blankPicture() {
  const c = document.createElement("canvas");
  c.width = 400;
  c.height = 300;
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 400, 300);
  return c;
}
// the start: a sample named in settings.js, or one in the page's address, or empty
function startInput() {
  const named = CFG.defaults.sample && CFG.defaults.sample !== "none" ? CFG.defaults.sample : null,
    asked = new URLSearchParams(location.search).get("example");
  const key = named || asked || "";
  // a model starts as from empty then its chip: the blank picture first (the design's saved image, and undo, need a
  // source)
  if (key === "vase") artUse("picture");
  if (useExample(key)) return;
  artUse("picture"); // empty: no picture yet
}
