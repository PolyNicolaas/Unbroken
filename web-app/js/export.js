// Unbroken · web app · export.js
// Export: the 2D files (SVG for Saxi, flat DXF) and the 3D file (G-code), and saving them.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// ---------- export ----------

// Plunger (E) per mm of line: the volume of one line (line width = needle inside diameter × layer height) over the
// cartridge's
// cross-section, so the plunger speed follows the needle. Shown read-only in Fine-tuning.
function ePerMM() {
  const d = CFG.printer.cartridgeDiameter || 26.5,
    h = layerHmm();
  return (lineWidthMM() * h) / ((Math.PI * d * d) / 4);
}
function showE() {
  $("gE").value = ePerMM().toPrecision(3);
}
onPrintSettings(showE);

// ---------- Fine-tuning: layer height, speed, first-layer Z and lift ----------
// Each starts from the profiles in settings.js (layer height and speed from the chocolate, lift from the printer; Z
// follows the layer height) and can be changed for this print; a changed one says what the profile has.
function tuneProfile() {
  const c = chocolateById($("chocolate").value),
    P = CFG.printer,
    h = num(c.layerHeight, 0.05, 3) ? c.layerHeight : P.layerHeight;
  return {
    layerH: { v: h, from: c.layerHeight ? c.name : P.name },
    gFeed: { v: c.printSpeed || 20, from: c.printSpeed ? c.name : "default" },
    gZ: { v: +$("layerH").value || h, from: "layer height" },
    gLift: { v: P.lift, from: P.name },
  };
}
const TUNE_FROM = { layerH: "fromLayerH", gFeed: "fromFeed", gZ: "fromZ", gLift: "fromLift" };
let tuneH = null; // the layer height last seen: Z follows it while they're equal
function tuneUI() {
  const pr = tuneProfile();
  let n = 0;
  for (const [id, p] of Object.entries(pr)) {
    const off = Math.abs((+$(id).value || 0) - p.v) > 1e-6;
    n += off;
    $(id).closest("label").classList.toggle("changed", off);
    $(TUNE_FROM[id]).textContent = off ? `${p.from}: ${+p.v.toFixed(3)}` : "";
  }
  $("tuneVal").textContent = n ? `${n} changed` : "as the profiles";
  $("tuneReset").disabled = !n;
  tuneH = +$("layerH").value;
}
$("layerH").addEventListener("input", () => {
  if (tuneH != null && Math.abs(+$("gZ").value - tuneH) < 1e-6) $("gZ").value = $("layerH").value;
  printSettingsChanged();
}); // the layer height's own box: Z follows, then everything that depends on it
for (const id of ["gFeed", "gZ", "gLift"]) $(id).addEventListener("input", tuneUI);
onPrintSettings(tuneUI);
$("tuneReset").addEventListener("click", () => {
  $("layerH").value = tuneProfile().layerH.v;
  $("layerH").dispatchEvent(new Event("input", { bubbles: true }));
  for (const id of ["gFeed", "gZ", "gLift"]) {
    $(id).value = tuneProfile()[id].v;
    $(id).dispatchEvent(new Event("input", { bubbles: true }));
  }
  tuneUI();
});

// 2D (plot.js): SVG for Saxi and flat DXF, from the pen version of the line.
// 3D (layers.js): G-code, from the layers stacked for every copy on the plate.
// the G-code settings: the Print step's fields and the printer's profile (also used by the print preview, layers.js)
// The Fine-tuning numbers as the printer gets them: an empty, negative or absurd box never reaches the G-code (an
// empty First-layer Z would print into the plate). machineIssues() names any box that was replaced, for the ready list.
const layerHmm = () => {
  const h = +$("layerH").value;
  return h >= 0.05 && h <= 3 ? h : CFG.printer.layerHeight || 0.3;
};
const firstZ = () => {
  const z = +$("gZ").value;
  return $("gZ").value !== "" && z >= 0.05 && z <= 50 ? z : layerHmm();
};
// How far a layer may step out past the one below (mm): the Fine-tuning box, or a third of the line width
const overhangMM = () => {
  const v = +$("gOver").value;
  return $("gOver").value !== "" && v >= 0.05 && v <= 2 ? v : Math.round((lineWidthMM() / 3) * 100) / 100;
};
const liftMM = () => {
  const l = +$("gLift").value;
  return $("gLift").value !== "" && l >= 0.5 && l <= 100 ? l : Math.max(0.5, CFG.printer.lift || 5);
};
// the Speed box is mm/s (as settings.js and the choc OS manual give it); G-code feeds are mm/min
const feedMMs = () => {
  const f = +$("gFeed").value;
  return $("gFeed").value !== "" && f >= 0.5 && f <= 1000 ? f : 20;
};
const feedMMmin = () => feedMMs() * 60;
function machineIssues() {
  const out = [];
  if (firstZ() !== +$("gZ").value || $("gZ").value === "")
    out.push(`First layer Z "${$("gZ").value}" → ${fmt(firstZ(), 2)} mm`);
  if (liftMM() !== +$("gLift").value || $("gLift").value === "")
    out.push(`Lift "${$("gLift").value}" → ${fmt(liftMM(), 1)} mm`);
  if (feedMMs() !== +$("gFeed").value || $("gFeed").value === "")
    out.push(`Speed "${$("gFeed").value}" → ${fmt(feedMMs(), 1)} mm/s`);
  if (layerHmm() !== +$("layerH").value) out.push(`Layer height "${$("layerH").value}" → ${fmt(layerHmm(), 2)} mm`);
  return out;
}
function gcodeSettings() {
  const P = CFG.printer;
  return {
    ox: 0,
    oy: 0,
    z: firstZ(),
    lift: liftMM(),
    feed: feedMMmin(),
    e: ePerMM(),
    needle: lineWidthMM(),
    start: P.startGcode || [],
    end: P.endGcode || [],
    retract: P.retraction,
    retractSpeed: P.retractSpeed,
    wipeTime: P.wipeTime,
    firstUnretractExtra: P.firstUnretractExtra,
    unretractPause: P.unretractPause,
    travelSpeed: P.travelSpeed,
    zTravelSpeed: P.zTravelSpeed,
    zApproachSpeed: P.zApproachSpeed,
  };
}
// File names say what's in them: the design's name, and for G-code the needle and the copies, e.g.
// welcome_084_2x-gcode.zip (0.84 mm needle, 2 copies). Letters, numbers and dashes only, for printer screens and USB
// sticks. A project number joins them once designs are kept in a database (ROADMAP.md, Later).
// name: what to name it after instead of the traced source (the art plotted as drawn)
function designSlug(max = 20, name) {
  const raw = name || (st.text ? $("textIn").value.split("\n")[0] || "text" : st.srcLabel || "design");
  return (
    raw
      .replace(/\.[a-z0-9]+$/i, "")
      .normalize("NFKD")
      .replace(/[^\w\- ]+/g, "")
      .replace(/_/g, "-")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase()
      .slice(0, max)
      .replace(/-+$/, "") || "design"
  );
}
// the needle as three digits (0.84 mm → 084, 1.6 → 160); a custom line width names the width
function needleTag() {
  const v = $("needle").value,
    w = v !== "custom" && +v > 0 ? +v : lineWidthMM();
  return String(Math.round(w * 100)).padStart(3, "0");
}
async function buildFile(fmtName) {
  if (fmtName === "svg") return plotFile();
  if (fmtName === "chocdxf") return chocDXF();
  if (fmtName === "viewsvg") return modelViewSVG(); // model.js: the line drawing of a model's view, as vectors
  const g = gcodeSettings();
  // every copy prints all its layers (base and walls stacked into one 3D path), then the needle lifts above
  // everything printed and travels to the next copy
  const lay = plateNow();
  if (!lay) throw new Error("nothing is on the plate yet");
  const pl = placements(lay),
    cpaths = await layerPaths(pl);
  if (!cpaths || !st.layers) throw new Error("the layers aren't ready yet");
  const S = st.layers.S,
    ok = plateFits(lay, pl),
    n = S.N + S.M;
  const tall = S.h + st.layers.stack.height,
    tooTall = CFG.printer.buildHeight && tall > CFG.printer.buildHeight;
  const what = lay.pieces
    ? `${pl.length} pieces (${lay.sets > 1 ? `${lay.sets} × ` : ""}${lay.pieces.length} lines, each its own piece)`
    : `${pl.length} cop${pl.length === 1 ? "y" : "ies"} of ${fmt(lay.w, 1)} × ${fmt(lay.h, 1)} mm`;
  const info = `${what}${lay.angle ? `, rotated ${fmt(lay.angle, 0)}°` : ""}, ${n} layer${n === 1 ? "" : "s"}${S.N ? ` (${S.N} filled)` : ""}, ${fmt(tall, 1)} mm tall, for the ${CFG.printer.name}${ok ? "" : ", NOT all on the plate"}${tooTall ? ", TALLER than the printer" : ""}`;
  const base = `${designSlug()}_${needleTag()}_${pl.length}x`;
  return { name: base + "-gcode.zip", inner: base + ".gcode", text: UNB.exportGcode(cpaths, g), info };
}
// The printed line as one flat curve (mm), for choc OS's "Upload 2D curve": a fallback while the tracer's own G-code
// is being proven on the printer.
function chocDXF() {
  const d = designMM();
  if (!d) throw new Error("nothing traced yet");
  const f = st.final,
    n = f.re.length,
    x = new Float64Array(n),
    y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = (f.re[i] - d.b.x0) * d.k;
    y[i] = (f.im[i] - d.b.y0) * d.k;
  }
  const s = UNB.simplify(x, y, st.simplify, !st.open);
  return {
    name: designSlug() + "-dxf.zip",
    inner: designSlug() + ".dxf",
    text: UNB.exportDXF([{ x: s.x, y: s.y, closed: !st.open }], d.H),
    info: `${fmt(d.W, 1)} × ${fmt(d.H, 1)} mm, ${st.open ? "open" : "one closed curve"}, ${s.x.length} points, for choc OS`,
  };
}
$("exportBtn").addEventListener("click", () => exportAs("svg", $("exportMsg")));
$("dxfBtn").addEventListener("click", () => exportAs("chocdxf", $("gcodeMsg")));
$("gcodeBtn").addEventListener("click", () => {
  const bad = readyUI().filter((r) => r.lvl === "bad");
  if (bad.length && !readyOverride) {
    // a red line: say so first; a second click exports anyway
    readyOverride = true;
    setStatus(
      $("gcodeMsg"),
      "bad",
      `Not ready: ${bad.map((r) => r.text).join("; ")}. Click Export G-code again to export anyway.`
    );
    return;
  }
  readyOverride = false;
  exportAs("gcode", $("gcodeMsg"));
});

// ---------- ready to print: a checklist above Export G-code ----------
// Each line: ok (✓), warn (⚠, prints but check it) or bad (✗, likely to fail); a click opens the card to fix it.
let readyOverride = false;
function readyItems() {
  const out = [],
    add = (lvl, text, card) => out.push({ lvl, text, card });
  if (isModel() ? !st.model : !st.final) {
    add("bad", "Nothing traced yet", "h-src");
    return out;
  }
  if (!isModel()) {
    const sc = scale(),
      d = st.spacing,
      gap = st.gap * sc;
    add("ok", `Traced: ${st.N} terms, error ${fmt(st.err ? st.err.score * sc : 0)} mm`, "h-fit");
    if (d > 0 && Number.isFinite(st.gap) && gap < d * 0.8)
      add(
        st.gap < 0.05 ? "bad" : "warn",
        st.gap < 0.05
          ? "The line crosses itself"
          : `Lines as close as ${fmt(gap, 2)} mm (the needle wants ${fmt(d, 2)})`,
        "h-line"
      );
    else add("ok", `Lines kept apart for the ${fmt(lineWidthMM(), 2)} mm needle`, "h-line");
  }
  const lay = plateNow();
  if (lay) {
    const pl = placements(lay),
      ok = plateFits(lay, pl);
    if (lay.pieces)
      // a text printed as a piece per line
      add(
        ok ? "ok" : "bad",
        ok ? `${pl.length} pieces on the plate, one for each line` : `Only ${lay.fits} of ${lay.copies} pieces fit`,
        "h-plate"
      );
    else
      add(
        ok ? "ok" : "bad",
        ok
          ? `${pl.length} cop${pl.length === 1 ? "y" : "ies"} on the plate`
          : lay.fits
            ? lay.copies > 1
              ? `Only ${lay.fits} of ${lay.copies} copies fit`
              : "Off the plate"
            : "Too big for the plate",
        "h-plate"
      );
  }
  const mi = machineIssues();
  if (mi.length)
    add("warn", `Fine-tuning box${mi.length > 1 ? "es" : ""} out of range, using: ${mi.join(", ")}`, "h-machine");
  const L = st.layers;
  if (!L) {
    add("warn", "Layers still being worked out", "h-layers");
    return out;
  }
  const tall = L.S.h + L.stack.height,
    P = CFG.printer;
  if (P.buildHeight && tall > P.buildHeight)
    add("bad", `${fmt(tall, 1)} mm tall: more than the printer's ${P.buildHeight} mm`, "h-layers");
  // (a text's pieces: the piece with the most layers too short to set)
  const lf = (L.pieces || [L])
      .map((Q) => stackFeeds(Q.stack))
      .reduce((a, f) => ((f.short || 0) > (a.short || 0) ? f : a)),
    need = layerTimeS();
  if (lf.short)
    add(
      "warn",
      `${lf.short} layer${lf.short === 1 ? "" : "s"} can't take ${need} s even at the slowest speed`,
      "h-layers"
    );
  else add("ok", `Every layer takes at least ${need} s to set`, "h-layers");
  if (L.model && L.overhang) {
    // a model: does any part reach out past what a bead can hold?
    const step = overhangMM(),
      S = L.support,
      zAt = (k) => fmt(firstZ() + k * L.S.h, 1);
    if (S && S.layers)
      add(
        "ok",
        `Support (${$("support").value === "thin" ? "thin wall" : "flared skirt"}): ${S.layers} layer${S.layers === 1 ? "" : "s"} widened, from ${zAt(S.from)} mm`,
        "h-layers"
      );
    else if (L.overhang.worst > step + 0.02)
      add(
        "warn",
        `Overhang: a layer steps out ${fmt(L.overhang.worst, 2)} mm at ${zAt(L.overhang.at)} mm (a bead holds ${fmt(step, 2)}): turn on Support`,
        "h-layers"
      );
    else add("ok", `No overhang past ${fmt(step, 2)} mm a layer`, "h-layers");
  }
  const c = cartridgeUse();
  if (c)
    add(
      c.ok ? "ok" : c.fit ? "warn" : "bad",
      c.ok
        ? `One cartridge (${fmt(c.total, c.total < 10 ? 1 : 0)} of ${fmt(c.V, 0)} ml)`
        : c.fit
          ? `Needs more than one cartridge: ${c.fit} of ${c.n} ${c.pieces ? "pieces" : "copies"} fit`
          : c.pieces
            ? "The first piece needs more than a cartridge"
            : "One copy needs more than a cartridge",
      c.fit && !c.ok ? "h-plate" : "h-layers"
    );
  return out;
}
// Bring a card into view and open it. A card on another tab (the Line step's cards, from the Print step's ready list)
// is
// hidden, so its tab is shown first; if no tab shows it, the tab you were on stays.
function showCard(card) {
  const seen = () => card.getClientRects().length > 0,
    pick = (r) => {
      const lab = document.querySelector(`label[for="${r.id}"]`);
      if (lab) lab.click();
    };
  if (!seen()) {
    const was = document.querySelector('input[name="view"]:checked');
    for (const r of document.querySelectorAll('input[name="view"]')) {
      pick(r);
      if (seen()) break;
    }
    if (!seen()) {
      if (was) pick(was);
      return;
    }
  }
  if (card.classList.contains("collapsed")) card.querySelector(".card-toggle").click();
  card.scrollIntoView({ behavior: "smooth", block: "start" });
}
function readyUI() {
  const items = readyItems(),
    ul = $("readyList");
  ul.textContent = "";
  for (const r of items) {
    const li = document.createElement("li");
    li.className = r.lvl;
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = r.text;
    b.title = "Go to the setting";
    b.addEventListener("click", () => {
      const card = $(r.card) && $(r.card).closest("section.card");
      if (card) showCard(card);
    });
    li.appendChild(b);
    ul.appendChild(li);
  }
  const bad = items.filter((r) => r.lvl === "bad").length,
    warn = items.filter((r) => r.lvl === "warn").length;
  $("readyVal").textContent = bad ? `${bad} to fix` : warn ? `ready · ${warn} to check` : "ready";
  $("readyVal").className = "hval " + (bad ? "bad" : warn ? "warn" : "ok");
  return items;
}
async function exportAs(fmtName, msg) {
  if (fmtName === "viewsvg" && !st.model) {
    setStatus(msg, "bad", "Load a model first.");
    return;
  }
  const asDrawn = fmtName === "svg" && plotFromArt(); // plot.js: the art's lines as drawn, no trace needed
  if (isModel() && fmtName === "svg" && !asDrawn) {
    setStatus(
      msg,
      "bad",
      "For 2D files of a model, use Draw this view on the Art step first (it adds a line drawing of the view to the art). The Print step exports the layers."
    );
    return;
  }
  if (isModel() && fmtName === "chocdxf") {
    setStatus(msg, "bad", "A DXF for choc OS is one flat curve; a model prints from its G-code.");
    return;
  }
  if (!st.final && !isModel() && fmtName !== "viewsvg" && !asDrawn) {
    setStatus(msg, "bad", "Nothing to export yet. Load an image with visible lines first.");
    return;
  }
  let f;
  setStatus(msg, "busy", "Making the file… (many copies, a filled base or a solid model can take a while)");
  try {
    f = await buildFile(fmtName);
  } catch (e) {
    if (e === CANCELLED) {
      setStatus(msg, "", "");
      return;
    }
    setStatus(msg, "bad", `Export failed: ${(e && e.message) || "unknown error"}`);
    return;
  }
  const data = f.text ? UNB.zip(f.inner, f.text) : f.data;
  try {
    await saveFile(f.name, data);
    setStatus(msg, "ok", `Exported ${f.name} · ${f.info}`);
  } catch (e) {
    setStatus(msg, "bad", saveError(e, "Export") + ".");
  }
}
