// Unbroken · web app · showall.js
// All settings (View menu): the settings for another kind of art (a picture's, text's, a 3D model's, a vase's) stay in
// the settings panel instead of hiding, greyed, unchangeable, each saying when it applies. The switch is remembered in
// the browser. The hiding itself is CSS (app.css, the .img-only, .text-only, .model-only, .vase-only and .stl-only
// rules); this file marks what doesn't apply now and writes why.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

const SHOW_ALL_KEY = storeKey("show-all");
// [what the setting is marked with, why it doesn't apply to this design (empty: it does)]; b is document.body.dataset
const NA_RULES = [
  [".img-only", (b) => (b.src === "text" ? "For pictures, not text" : b.src === "model" ? "For pictures, not 3D models" : "")],
  [".text-only", (b) => (b.src !== "text" ? "Only for text" : "")],
  [".model-only", (b) => (b.src !== "model" ? "Only for 3D models" : "")],
  [".vase-only", (b) => (b.vase !== "1" ? "Only for vases and reliefs" : "")],
  [".stl-only", (b) => (b.vase === "1" ? "Only for STL models: a vase or relief is built from its profile, not sliced" : "")],
  [
    '#pathRow, #looseRow, #cornerRow, .card[aria-labelledby="h-size"], .card[aria-labelledby="h-fit"]',
    (b) => (b.src === "model" ? "Not for 3D models" : ""),
  ],
];
const NA_PARTS = NA_RULES.map(([sel]) => sel).join(", ");

// mark every setting in the panel that doesn't apply now, with a note saying when it does
function showAllMark() {
  const on = document.body.classList.contains("show-all"),
    b = document.body.dataset;
  document.querySelectorAll(".panel :is(" + NA_PARTS + ")").forEach((el) => {
    const why = on ? NA_RULES.filter(([sel]) => el.matches(sel)).map(([, f]) => f(b)).find(Boolean) || "" : "";
    el.classList.toggle("na", !!why);
    el.inert = !!why; // greyed: no tapping or tabbing into it
    let note = [...el.children].find((c) => c.classList.contains("na-why"));
    if (!why) {
      if (note) note.remove();
      el.removeAttribute("aria-disabled");
      return;
    }
    if (!note) {
      note = document.createElement("small");
      note.className = "na-why";
      el.appendChild(note);
    }
    note.textContent = why;
    el.setAttribute("aria-disabled", "true");
  });
}
function showAllSet(on) {
  document.body.classList.toggle("show-all", on);
  $("showAll").checked = on;
  try {
    localStorage.setItem(SHOW_ALL_KEY, on ? "1" : "");
  } catch {}
  showAllMark();
  // the open panel lays its groups out again (a group with nothing that applies hides only while this is off)
  if (typeof mapOpenId !== "undefined" && mapOpenId && MAP_NODES[mapOpenId]) mapOpen(mapOpenId);
}
$("showAll").addEventListener("change", () => showAllSet($("showAll").checked));
// what applies follows what's being made: a picture, text, a 3D model, a vase
new MutationObserver(showAllMark).observe(document.body, { attributes: true, attributeFilter: ["data-src", "data-vase"] });
{
  let on = false;
  try {
    on = localStorage.getItem(SHOW_ALL_KEY) === "1";
  } catch {}
  showAllSet(on);
}
