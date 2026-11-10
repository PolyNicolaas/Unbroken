// Unbroken · web app · scroll.js
// The settings and the preview while you scroll. The preview stays in view (app.css: a sticky column on wide screens,
// a compact pinned preview on phones, with Bigger / Smaller here). The Wheel: the settings scroll like a drum — when
// the scrolling stops, the card at the top of the settings opens and the others fold to their headers (their readouts
// still show), and cards away from it tip back a little. The Wheel switch turns it off (and puts every card back as you
// left it); it's remembered in this browser.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// ---------- the phone's pinned preview: compact, or bigger with its tools ----------
const PV_KEY = storeKey("preview");
function pvSet(big) {
  document.body.dataset.pv = big ? "big" : "pinned";
  $("pvSize").textContent = big ? "Smaller" : "Bigger";
  $("pvSize").setAttribute("aria-pressed", String(big));
  try {
    localStorage.setItem(PV_KEY, big ? "big" : "pinned");
  } catch {}
}
$("pvSize").addEventListener("click", () => pvSet(document.body.dataset.pv !== "big"));
try {
  pvSet(localStorage.getItem(PV_KEY) === "big");
} catch {
  pvSet(false);
}
