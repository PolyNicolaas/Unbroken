// Unbroken · web app · main.js
// Start-up: redraw on resize and theme change, apply the starting defaults from settings.js, then load the first
// design.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// theme + resize (the chocolate's preview colour is re-checked against the new background)
new ResizeObserver(() => {
  render();
  drawChart();
}).observe($("box"));
const rethemed = () => {
  st.bgCache = null;
  for (const k in st.zm) if (st.zm[k]) st.zm[k].tint = null;
  applyChocolateLook();
  render();
  drawChart();
  drawPlate();
  drawMini();
  drawStack();
  drawPage(); // the 3D layers and the 2D page (each draws only when showing)
};
try {
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", rethemed);
} catch {}
new MutationObserver(rethemed).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

// problems found in settings.js: listed in the 3D tab, and a short note on screen
if (CFG.problems.length) {
  $("settingsNote").hidden = false;
  $("settingsNote").textContent = "settings.js: " + CFG.problems.join("; ") + ".";
  console.warn("settings.js:", CFG.problems);
  setTimeout(
    () =>
      toast(
        CFG.problems.length === 1 && /couldn't be read/.test(CFG.problems[0])
          ? "settings.js couldn't be read, so built-in settings are in use"
          : `settings.js: ${CFG.problems.length} problem${CFG.problems.length === 1 ? "" : "s"}, see the 3D tab`,
        true
      ),
    300
  );
}

applyPrinter(false);
labels();
syncSpacingUI();
infillUI();
lineUI(); // the spacing from line width + gap, and the needle shown
// the Art tab starts on the sample picture, or the text (art.js)
const start = CFG.defaults.startFrom;
if (start === "lettering")
  applyPreset("lettering"); // starts on the text
else if (CFG.defaults.source === "text") artUse("text");
else {
  if (start) applyPreset(start, true);
  artUsePicture(makeSample(CFG.defaults.sample), "sample", CFG.defaults.sample);
}
viewChanged(); // the tab that opens (Art) brings its view
showE();
tuneUI();
showHeight(); // E per mm, the Fine-tuning markers and the layer count, from the starting settings
zoomUI(); // zoom.js: the buttons for the view that opens
