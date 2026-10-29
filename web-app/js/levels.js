// Unbroken · web app · levels.js
// The Grey levels card (Line step) and the Image prep card's background tap. Grey levels turn the picture into 2–6 flat
// greys (the engine's
// UNB.levels, run in the prep: pipeline.js working()); each grey's edges are traced or skipped (UNB.levelEdges, via
// lineSpec). Tap the background (a tool, like Set start) removes the background from the point tapped.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// what each grey does, one letter per grey, darkest first: t trace (its edges are lines), f fill (its blocks filled
// with its own pen), b both, s skip. Fill and Both are for a pen plotter (a printer traces or skips).
const LEVEL_MODES = [
  ["t", "Trace", "Its edges are lines"],
  ["f", "Fill", "Its blocks are filled with its own pen (pen plotter)"],
  ["b", "Both", "Its edges are lines and its blocks are filled (pen plotter)"],
  ["s", "Skip", "Its edges are left out (unless the grey next to it is traced)"],
];
// a grey's fill: style, spacing between strokes (mm), angle (degrees), pen colour. Darker greys start denser, and
// neighbouring greys at different angles.
const FILL_STYLES = [
  ["hatch", "Hatch"],
  ["cross", "Cross-hatch"],
  ["rings", "Rings"],
  ["pattern", "The pattern"],
];
function defaultFill(j, n) {
  const pen = Math.max(0.05, +$("penW").value || 0.5);
  return {
    style: j === 0 ? "cross" : "hatch",
    spacing: +(pen * (1.6 + (3 * j) / Math.max(1, n - 1))).toFixed(2),
    angle: [45, -45, 0, 90, 30, -30][j % 6],
    color: "#111111",
  };
}
function levelFillSpecs() {
  const n = levelCount();
  let saved = [];
  try {
    saved = JSON.parse($("levelFills").value || "[]");
  } catch {}
  // (colour levels: a block's pen starts with its own colour, until a pen is picked)
  return Array.from({ length: n }, (_, j) => {
    const f = { ...defaultFill(j, n), ...(saved[j] || {}) };
    if (!(saved[j] && saved[j].color) && levelColour() && levelHex(j)) f.color = levelHex(j);
    return f;
  });
}
function setLevelFill(j, patch) {
  const all = levelFillSpecs();
  all[j] = { ...all[j], ...patch };
  $("levelFills").value = JSON.stringify(all);
  recordSoon();
  schedule(extract);
}
const levelCount = () => (+$("levels").value >= 2 ? +$("levels").value : 0);
// every grey traced but the lightest (the paper)
const defaultModes = (n) => (n ? "t".repeat(n - 1) + "s" : "");
function levelModes() {
  const n = levelCount(),
    m = $("levelModes").value;
  const ok = m.length === n && /^[tfbs]*$/.test(m) ? m : defaultModes(n);
  // a printer fills inside an outline: its Fill is Both (the edges traced, the inside printed solid)
  return artForPlot() ? ok : ok.replace(/f/g, "b");
}
// the settings the prep and the trace need (settings() in source.js), or null when off
const levelColour = () => $("levelColours").checked;
function levelSettings() {
  const n = levelCount();
  return n ? { count: n, smooth: +$("levelSmooth").value, modes: levelModes(), colour: levelColour() } : null;
}
// a level's colour as #rrggbb, from the last prep (colour levels), or null
const levelHex = (j) => {
  const L = st.wk && st.wk.levels;
  const c = L && L.colours && L.colours[j];
  return c ? "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("") : null;
};
// which greys' edges are lines (lineSpec in pipeline.js)
const levelEdgeFlags = () => [...levelModes()].map((c) => c === "t" || c === "b");
// a printer: the blocks of the levels set to Fill, as a mask of the working image (pipeline.js working), for the
// layers' solid fill (layers.js layerLine); null when there are none or the prep isn't the current one
let levelMaskCache = null;
function levelFillMask() {
  if (artForPlot() || !levelCount() || !st.wk || !st.wk.levels) return null;
  const modes = levelModes();
  if (!modes.includes("b")) return null;
  const W = st.wk,
    key = W.key + "|" + modes;
  if (levelMaskCache && levelMaskCache.key === key) return levelMaskCache;
  const on = [...modes].map((c) => c === "b"),
    mask = new Uint8Array(W.w * W.h);
  for (let i = 0; i < mask.length; i++) mask[i] = on[W.levels.lab[i]] ? 1 : 0;
  return (levelMaskCache = { key, mask, w: W.w, h: W.h });
}
// the greys filled (Fill or Both), with their fills: [{ level, style, spacing, angle, color }]
const levelFillList = () => {
  const specs = levelFillSpecs();
  return [...levelModes()].flatMap((c, j) => (c === "f" || c === "b" ? [{ level: j, ...specs[j] }] : []));
};

let levelListKey = null;
function levelsUI() {
  const n = levelCount();
  const what = levelColour() ? "colours" : "greys";
  $("levelsVal").textContent = $("levelsCardVal").textContent = n ? `${n} ${what}` : "off";
  $("levelsBox").hidden = !n;
  // the line follows the greys' edges: the trace style and ink threshold don't apply
  $("levelsOnHint").hidden = !n;
  $("modeRow").hidden = $("sensRow").hidden = !!n;
  const sm = +$("levelSmooth").value;
  $("levelSmoothVal").textContent = sm ? mmAtSize(sm) : "off";
  $("bgPickInfo").textContent = st.bgAt ? "from the point you tapped" : "";
  if (!n) return (levelListKey = null);
  const modes = levelModes(),
    plot = artForPlot(),
    specs = levelFillSpecs();
  if (plot) $("levelModes").value = modes; // (a printer's view of the modes doesn't overwrite the plotter's)
  const fillsNow = /[fb]/.test(modes);
  $("levelFillNote").hidden = !fillsNow || (plot && lineModeNow() === "strokes");
  $("levelFillNote").textContent = plot
    ? "Fills are drawn with Separate strokes (the switch at the top of the Line step); with one continuous line only the traced edges are plotted."
    : "A filled block prints solid inside its traced outline, as part of the one line: on the Print step's 3D layers (the Line step shows the outline). A block too narrow for a row stays open.";
  // each grey's tone and share, from the last prep (st.wk.levels); until then, evenly spread greys
  const L =
      st.wk && st.wk.levels && st.wk.levels.tones.length === n && !!st.wk.levels.colours === levelColour()
        ? st.wk.levels
        : null,
    total = L ? L.count.reduce((a, b) => a + b, 0) : 0;
  const key = JSON.stringify([n, modes, plot, specs, L && L.tones, L && L.count, L && L.colours]);
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
    sw.style.background = L && L.colours ? `rgb(${L.colours[j].join(",")})` : `rgb(${tone},${tone},${tone})`;
    const name = document.createElement("span");
    name.className = "level-name";
    name.textContent =
      `${levelColour() ? "Colour" : "Grey"} ${j + 1}` +
      (L ? ` · ${Math.round((100 * L.count[j]) / Math.max(1, total))}%` : "");
    const seg = document.createElement("div");
    seg.className = "seg mini";
    seg.setAttribute("role", "radiogroup");
    seg.setAttribute("aria-label", `Grey ${j + 1}`);
    // (a printer: Trace, Fill (its outline traced, its inside solid), Skip)
    for (const [v, label0, tip0] of LEVEL_MODES.filter(([v]) => plot || v !== "f")) {
      const label = !plot && v === "b" ? "Fill" : label0,
        tip = !plot && v === "b" ? "Its outline traced and its inside printed solid, one continuous line" : tip0;
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
    if (plot && (modes[j] === "f" || modes[j] === "b")) box.appendChild(fillRow(j, specs[j])); // (a printer's is solid)
  }
}
// a filled grey's own settings, under its row: style, spacing (mm), angle, pen colour
function fillRow(j, f) {
  const row = document.createElement("div");
  row.className = "level-fill";
  const field = (label, el) => {
    const l = document.createElement("label");
    l.className = "field";
    const t = document.createElement("span");
    t.textContent = label;
    l.append(t, el);
    return l;
  };
  const style = document.createElement("select");
  style.setAttribute("aria-label", `Grey ${j + 1} fill style`);
  for (const [v, name] of FILL_STYLES) style.add(new Option(name, v, false, v === f.style));
  style.addEventListener("change", () => setLevelFill(j, { style: style.value }));
  const num = (key, label, min, max, step) => {
    const i = document.createElement("input");
    Object.assign(i, { type: "number", min, max, step, value: f[key] });
    i.setAttribute("aria-label", `Grey ${j + 1} ${label}`);
    i.addEventListener("change", () => {
      const v = +i.value;
      if (Number.isFinite(v)) setLevelFill(j, { [key]: Math.min(max, Math.max(min, v)) });
    });
    return field(label, i);
  };
  const color = document.createElement("input");
  Object.assign(color, { type: "color", value: f.color });
  color.setAttribute("aria-label", `Grey ${j + 1} pen colour`);
  color.addEventListener("change", () => setLevelFill(j, { color: color.value }));
  const sp = num("spacing", "Spacing mm", 0.1, 20, 0.1),
    an = num("angle", "Angle °", -90, 90, 5);
  an.hidden = f.style === "rings" || f.style === "pattern";
  row.append(field("Fill", style), field("Pen", color), sp, an);
  return row;
}
$("levels").addEventListener("input", () => {
  $("levelModes").value = defaultModes(levelCount()); // a new number of greys starts from the default again
  labels();
  levelsUI();
  schedule(extract);
});
document.querySelectorAll('input[name="levelKind"]').forEach((r) =>
  r.addEventListener("change", () => {
    labels();
    levelsUI();
    recordSoon();
    schedule(extract);
  })
);
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
