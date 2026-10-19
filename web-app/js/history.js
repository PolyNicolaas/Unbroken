// Unbroken · web app · history.js
// Undo / redo and design files (save and open).
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// ---------- undo / redo and design files ----------
// A design = the source (image, or typed text), every setting that shapes the line or the plate, and the
// hand edits (selection, erasing, start point, painted areas). View options (line view, box, …) are not part of it.
const DESIGN_IDS = [
  "srcImage",
  "srcText",
  "srcModel",
  "textIn",
  "font",
  "capH",
  "txtSpacing",
  "letterGap",
  "wordGap",
  "lineGap",
  "alLeft",
  "alCenter",
  "alRight",
  "modeCenter",
  "modeOutline",
  "loopClosed",
  "loopOpen",
  "sens",
  "blur",
  "minLen",
  "far",
  "loose",
  "invert",
  "bright",
  "contrast",
  "bgTol",
  "flatten",
  "shadeStyle",
  "shadeSp",
  "shadeLv",
  "lineW",
  "needle",
  "lineGapMM",
  "corner",
  "infillMin",
  "fillMin",
  "basePattern",
  "baseDensity",
  "baseAngle",
  "baseTurn",
  "fillDensity",
  "fillPattern",
  "fillAngle",
  "fillTurn",
  "uncross",
  "smooth",
  "chocolate",
  "copies",
  "copyGap",
  "plateRot",
  "textPieces",
  "gOx",
  "gOy",
  "gZ",
  "gLift",
  "gOver",
  "support",
  "gFeed",
  "layerTime",
  "limitPlate",
  "baseLayers",
  "wallLayers",
  "layerH",
  "printer",
  "paper",
  "paperOrient",
  "paperMargin",
  "paperW",
  "paperH",
  "penW",
  "penColor",
  "wallCount",
  "crease",
  "gapClose",
  "minShape",
  "drawBridges",
];
const DESIGN_SET = new Set(DESIGN_IDS);
// A model is recognised by what it is, not by its id: the id is a counter that starts again every session, so a saved
// design could put its turns and height on a different model loaded later. The fingerprint is the model's name, its
// triangle count and its size as loaded (to 0.001), worked out once per mesh.
const modelPrints = new WeakMap();
function modelPrint(M) {
  let p = modelPrints.get(M.tri);
  if (!p) {
    const t = M.tri,
      lo = [Infinity, Infinity, Infinity],
      hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < t.length; i++) {
      const a = i % 3;
      if (t[i] < lo[a]) lo[a] = t[i];
      if (t[i] > hi[a]) hi[a] = t[i];
    }
    p = [M.name, M.n, ...hi.map((v, a) => (v - lo[a]).toFixed(3))].join("|");
    modelPrints.set(M.tri, p);
  }
  return p;
}
function designState() {
  const v = {};
  for (const id of DESIGN_IDS) {
    const el = $(id);
    if (el) v[id] = el.type === "checkbox" || el.type === "radio" ? el.checked : el.value;
  }
  return {
    v,
    s: {
      outW: st.outW,
      sizeUser: !!st.sizeUser,
      spacing: st.spacing,
      simplify: st.simplify,
      N: st.N,
      sel: st.sel || null,
      erase: st.erase || [],
      start: st.start || null,
      zones: st.zones,
      penFill: structuredClone(st.penFill),
      model: st.model
        ? {
            id: st.model.id,
            print: modelPrint(st.model),
            turns: { ...st.model.turns },
            heightMM: st.model.heightMM,
            cut: { ...modelCut() },
          }
        : null,
      srcLabel: st.srcLabel,
      feedUnit: "mm/s",
      sample: $("sample").value,
      posManual,
    },
  };
}
const stateKey = (d, src) => JSON.stringify(d) + "|" + (d.v.srcText ? "text" : src && src.__id);
function snapshot() {
  const d = structuredClone(designState());
  return {
    d,
    src: st.text ? null : st.source,
    imageSource: st.text ? st.imageSource : null,
    key: stateKey(d, st.text ? null : st.source),
  };
}
let hist = [],
  hi = -1,
  recTimer = null,
  restoring = false;
function record() {
  clearTimeout(recTimer);
  recTimer = null;
  if (restoring || !st.source) return;
  const snap = snapshot();
  if (hi >= 0 && hist[hi].key === snap.key) return;
  hist = hist.slice(0, hi + 1);
  hist.push(snap);
  if (hist.length > CFG.rules.undoSteps) hist.shift();
  hi = hist.length - 1;
  histButtons();
}
function amendHistory() {
  // automatic follow-ups (the term count picked after a trace) belong to the change that caused them
  if (recTimer || restoring || hi < 0) return; // a user change is about to be recorded anyway
  const snap = snapshot();
  if (hist[hi].key !== snap.key) hist[hi] = snap;
}
function recordSoon() {
  if (restoring) return;
  clearTimeout(recTimer);
  recTimer = setTimeout(record, 400);
}
function histButtons() {
  $("undoBtn").disabled = hi <= 0;
  $("redoBtn").disabled = hi >= hist.length - 1;
}
function syncDesignUI() {
  const t = textMode();
  document.body.dataset.src = $("srcModel").checked ? "model" : t ? "text" : "image";
  textSizeUI(t);
  if (!t) syncSizeUI();
  lineUI();
  $("outW").value = +st.outW.toFixed(1);
  infillUI();
  baseUI();
  applyPrinter(false);
  forgetHeightGoal();
  showHeight();
  tuneUI();
  $("paperCustomRow").hidden = $("paper").value !== "custom";
  renderPens();
  shapesUI();
  drawPage();
  fillsSoon();
  syncSpacingUI();
  labels();
  updateToolLabels();
}
// Returns a note when part of the design couldn't come back (a 3D model that isn't the one loaded), else "".
function applyDesign(d, src, imageSource) {
  let note = "";
  restoring = true;
  try {
    clearTimeout(textTimer);
    clearTimeout(recTimer);
    stopOptimize();
    if (st.tool) exitTool();
    const s = d.s || {};
    for (let [id, val] of Object.entries(d.v || {})) {
      const el = $(id);
      if (!el) continue;
      if (id === "support" && val === "wall") val = "thin"; // Straight wall became Thin wall (v88)
      // the Speed box was mm/min until v92
      if (id === "gFeed" && s.feedUnit !== "mm/s" && val !== "") val = String(Math.round((+val / 60) * 10) / 10);
      if (el.type === "checkbox" || el.type === "radio") el.checked = !!val;
      else if (el.tagName === "SELECT" && ![...el.options].some((o) => o.value === String(val)))
        continue; // e.g. a font this version doesn't have
      else el.value = val;
    }
    for (const k of ["outW", "spacing", "simplify", "N"]) if (s[k] !== undefined) st[k] = s[k];
    // older design files: keep the width they were saved at
    st.sizeUser = s.sizeUser !== undefined ? !!s.sizeUser : true;
    if (s.unit === "px") {
      st.outW *= PX_MM;
      st.spacing *= PX_MM;
      st.simplify *= PX_MM;
    } // older design files could be in pixels; everything is mm now
    st.sel = structuredClone(s.sel || null);
    st.erase = structuredClone(s.erase || []);
    st.start = structuredClone(s.start || null);
    st.zones = structuredClone(s.zones || { cross: [], lane: [] });
    st.zoneVer = (st.zoneVer || 0) + 1;
    st.zm = {};
    st.wk = null;
    posManual = !!s.posManual;
    st.penFill = s.penFill ? structuredClone(s.penFill) : defaultPenFill();
    st.pfill = null; // older design files: no fill pens
    if (s.sample && [...$("sample").options].some((o) => o.value === s.sample)) $("sample").value = s.sample;
    if ($("srcModel").checked) {
      // a 3D model: its turns and height come back when the same model is loaded; the mesh itself isn't saved.
      // Designs saved before the fingerprint also match by id, but only when the model's name is the same too.
      const m = s.model,
        same =
          st.model &&
          m &&
          (m.print ? m.print === modelPrint(st.model) : m.id === st.model.id && s.srcLabel === st.model.name);
      if (same) {
        st.model.turns = { ...m.turns };
        st.model.om = UNB.orientMesh(st.model.tri, st.model.turns);
        st.model.heightMM = m.heightMM;
        st.model.cut = m.cut ? { ...m.cut } : { bottom: 0, top: 0 };
      } else if (m && st.model)
        note = `made with ${s.srcLabel ? `“${s.srcLabel}”` : "another model"}: load that STL to get its turns and height back`;
      // the image to go back to from the model
      st.imageSource = imageSource || (src ? { canvas: src, label: s.srcLabel } : st.imageSource);
      st.text = null;
      syncDesignUI();
      document.body.dataset.src = "model";
      enterModel();
      return note;
    }
    if (textMode()) {
      st.imageSource = imageSource || st.imageSource || null;
      const c = buildText();
      if (c) {
        c.__id = ++srcCounter;
        st.source = c;
        st.srcLabel = `${UNB_FONTS[$("font").value].label.split(" (")[0]} · ${fmt(st.text.cap, 1)} mm`;
      }
    } else {
      st.text = null;
      st.imageSource = null;
      if (src) st.source = src;
      st.srcLabel = s.srcLabel || st.srcLabel;
    }
    $("srcinfo").textContent = st.srcLabel || "";
    if (![...$("chocolate").options].some((o) => o.value === $("chocolate").value))
      $("chocolate").value = CFG.defaults.chocolate;
    applyChocolateLook();
    syncDesignUI();
    st.autoPending = false; // keep the saved number of terms
    launch(extract);
    return note;
  } finally {
    restoring = false;
    printSettingsChanged();
  } // E per mm, Fine-tuning and the test print follow the restored settings
}
function undo() {
  if (recTimer) record();
  if (hi <= 0) return;
  hi--;
  const h = hist[hi];
  const note = applyDesign(h.d, h.src, h.imageSource);
  histButtons();
  toast(note ? `Undone · ${note}` : "Undone", !!note);
}
function redo() {
  if (recTimer) record();
  if (hi >= hist.length - 1) return;
  hi++;
  const h = hist[hi];
  const note = applyDesign(h.d, h.src, h.imageSource);
  histButtons();
  toast(note ? `Redone · ${note}` : "Redone", !!note);
}
$("undoBtn").addEventListener("click", undo);
$("redoBtn").addEventListener("click", redo);
document.addEventListener("keydown", (e) => {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k !== "z" && k !== "y") return;
  const a = document.activeElement; // typing in a text box keeps the browser's own undo
  if (a && (a.tagName === "TEXTAREA" || (a.tagName === "INPUT" && /^(text|number|search)$/.test(a.type)))) return;
  e.preventDefault();
  if (k === "y" || e.shiftKey) redo();
  else undo();
});
for (const ev of ["input", "change"])
  document.addEventListener(
    ev,
    (e) => {
      if (e.target && DESIGN_SET.has(e.target.id)) recordSoon();
    },
    true
  );
$("plateCenter").addEventListener("click", recordSoon);

// Design file: one JSON file with the settings and the image itself (as a PNG, or JPEG for large photos)
const DESIGN_APP = "unbroken-design";
function sourceImageURL(c) {
  if (!c || !c.toDataURL) return null;
  const png = c.toDataURL("image/png");
  return png.length < 4e6 ? png : c.toDataURL("image/jpeg", 0.92);
}
async function saveDesign() {
  if (!st.source) return;
  if (recTimer) record();
  const d = designState(),
    imgCanvas = st.text ? st.imageSource && st.imageSource.canvas : st.source;
  const file = {
    app: DESIGN_APP,
    version: 1,
    saved: new Date().toISOString(),
    design: d,
    image: sourceImageURL(imgCanvas),
    imageLabel: st.text ? (st.imageSource && st.imageSource.label) || null : st.srcLabel,
  };
  const name = `${designSlug(40)}.unbroken.json`,
    data = JSON.stringify(file);
  try {
    await saveFile(name, data, "application/json");
    toast(`Saved ${name} · ${(data.length / 1048576).toFixed(data.length > 1048576 ? 1 : 2)} MB`);
  } catch (e) {
    toast(saveError(e, "Save"), true);
  }
}
function loadImageURL(url) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const g = c.getContext("2d");
      g.fillStyle = "#fff";
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0);
      res(c);
    };
    img.onerror = () => rej(new Error("the image inside couldn't be read"));
    img.src = url;
  });
}
async function openDesign(f) {
  if (!f) return;
  try {
    const file = JSON.parse(await f.text());
    if (!file || file.app !== DESIGN_APP || !file.design || !file.design.v)
      throw new Error("this isn't an Unbroken design file");
    let canvas = null;
    if (file.image) {
      canvas = await loadImageURL(file.image);
      canvas.__id = ++srcCounter;
    }
    const d = file.design,
      text = !!d.v.srcText;
    if (!text && !canvas) throw new Error("the file has no image");
    if (d.s) d.s.sample = "user";
    if (recTimer) record(); // keep the state before opening as its own undo step
    const note = applyDesign(
      d,
      text ? null : canvas,
      text && canvas ? { canvas, label: file.imageLabel || "image" } : null
    );
    record(); // opening is one undoable step
    toast(note ? `Opened ${f.name} · ${note}` : `Opened ${f.name}`, !!note);
  } catch (e) {
    toast(`Couldn't open ${f.name}: ${e.message}`, true);
  }
}
$("saveDesign").addEventListener("click", saveDesign);
$("openDesign").addEventListener("click", () => $("designFile").click());
$("designFile").addEventListener("change", () => {
  openDesign($("designFile").files[0]);
  $("designFile").value = "";
});
