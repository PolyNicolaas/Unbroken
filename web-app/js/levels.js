// Unbroken · web app · levels.js
// The Grey levels card (Trace tab) and the Image prep card's background tap. Grey levels turn the picture into 2–6 flat
// greys (the engine's
// UNB.levels, run in the prep: pipeline.js working()); each grey's edges are traced or skipped (UNB.levelEdges, via
// lineSpec). Tap the background (a tool, like Set start) removes the background from the point tapped.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// what each grey does, one letter per grey, darkest first: t trace (its edges are lines), s skip
const LEVEL_MODES = [
  ["t", "Trace", "Its edges are lines"],
  ["s", "Skip", "Its edges are left out (unless the grey next to it is traced)"],
];
const levelCount = () => (+$("levels").value >= 2 ? +$("levels").value : 0);
// every grey traced but the lightest (the paper)
const defaultModes = (n) => (n ? "t".repeat(n - 1) + "s" : "");
function levelModes() {
  const n = levelCount(),
    m = $("levelModes").value;
  return m.length === n && /^[ts]*$/.test(m) ? m : defaultModes(n);
}
// the settings the prep and the trace need (settings() in source.js), or null when off
function levelSettings() {
  const n = levelCount();
  return n ? { count: n, smooth: +$("levelSmooth").value, modes: levelModes() } : null;
}
// which greys' edges are lines (lineSpec in pipeline.js)
const levelEdgeFlags = () => [...levelModes()].map((c) => c === "t");

let levelListKey = null;
function levelsUI() {
  const n = levelCount();
  $("levelsVal").textContent = $("levelsCardVal").textContent = n ? `${n} greys` : "off";
  $("levelsBox").hidden = !n;
  // the line follows the greys' edges: the trace style and ink threshold don't apply
  $("levelsOnHint").hidden = !n;
  $("modeRow").hidden = $("sensRow").hidden = !!n;
  const sm = +$("levelSmooth").value;
  $("levelSmoothVal").textContent = sm ? mmAtSize(sm) : "off";
  $("bgPickInfo").textContent = st.bgAt ? "from the point you tapped" : "";
  if (!n) return (levelListKey = null);
  const modes = levelModes();
  $("levelModes").value = modes;
  // each grey's tone and share, from the last prep (st.wk.levels); until then, evenly spread greys
  const L = st.wk && st.wk.levels && st.wk.levels.tones.length === n ? st.wk.levels : null,
    total = L ? L.count.reduce((a, b) => a + b, 0) : 0;
  const key = JSON.stringify([n, modes, L && L.tones, L && L.count]);
  if (key === levelListKey) return;
  levelListKey = key;
  const box = $("levelList");
  box.textContent = "";
  for (let j = 0; j < n; j++) {
    const tone = L ? L.tones[j] : Math.round(30 + (210 * j) / Math.max(1, n - 1)),
      row = document.createElement("div");
    row.className = "level-row";
    const sw = document.createElement("span");
    sw.className = "level-swatch";
    sw.style.background = `rgb(${tone},${tone},${tone})`;
    const name = document.createElement("span");
    name.className = "level-name";
    name.textContent = `Grey ${j + 1}` + (L ? ` · ${Math.round((100 * L.count[j]) / Math.max(1, total))}%` : "");
    const seg = document.createElement("div");
    seg.className = "seg mini";
    seg.setAttribute("role", "radiogroup");
    seg.setAttribute("aria-label", `Grey ${j + 1}`);
    for (const [v, label, tip] of LEVEL_MODES) {
      const id = `level${j}${v}`,
        r = document.createElement("input");
      Object.assign(r, { type: "radio", name: `level${j}`, id, value: v, checked: modes[j] === v });
      r.addEventListener("change", () => {
        const m = [...levelModes()];
        m[j] = v;
        $("levelModes").value = m.join("");
        levelsUI();
        recordSoon();
        schedule(extract);
      });
      const lab = document.createElement("label");
      lab.htmlFor = id;
      lab.textContent = label;
      lab.title = tip;
      seg.append(r, lab);
    }
    row.append(sw, name, seg);
    box.appendChild(row);
  }
}
$("levels").addEventListener("input", () => {
  $("levelModes").value = defaultModes(levelCount()); // a new number of greys starts from the default again
  labels();
  levelsUI();
  schedule(extract);
});
$("levelSmooth").addEventListener("input", () => {
  levelsUI();
  schedule(extract);
});

// ---------- Tap the background (a tool: tools.js handles the tap) ----------
function bgTapped(p) {
  st.bgAt = p; // source-normalised (u, v), like the start point
  if (!+$("bgTol").value) $("bgTol").value = 20; // a tap means "remove it": start with some tolerance
  labels();
  levelsUI();
  recordSoon();
  schedule(extract);
}
$("bgBorder").addEventListener("click", () => {
  st.bgAt = null;
  labels();
  levelsUI();
  recordSoon();
  schedule(extract);
});
$("bgDone").addEventListener("click", () => exitTool());
levelsUI();
