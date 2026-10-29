// Unbroken · web app · views.js
// Layout and views: the printer menu, plate and copies, the mini-map, the View menu, the Trace / 2D / Print steps, and
// collapsible sections.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// Every section is one card that folds (no groups inside groups); see "collapsible control sections" below.

// ---------- Print step: plate preview ----------
// plate size of the printer in use (settings.js), set by applyPrinter
const BED = { w: CFG.printer.bedWidth, h: CFG.printer.bedDepth };
// the printer in use: plate, first-layer Z, lift, layer height (unless the chocolate has its own), profile, labels
function applyPrinter(resetFields = true) {
  // resetFields false: a design being restored keeps its own Z, lift and layer height
  const P = (CFG.printer = CFG.printers.find((q) => q.id === $("printer").value) || CFG.printers[0]);
  BED.w = P.bedWidth;
  BED.h = P.bedDepth;
  plateCache = null;
  if (resetFields) {
    $("gLift").value = P.lift;
    $("layerTime").value = P.minLayerTime;
    const c = chocolateById($("chocolate").value);
    $("layerH").value = num(c.layerHeight, 0.05, 3) ? c.layerHeight : P.layerHeight;
    $("gZ").value = $("layerH").value;
  }
  for (const id of ["plate", "miniPlate"]) $(id).style.aspectRatio = `${P.bedWidth} / ${P.bedDepth}`;
  $("plate").style.setProperty("--ar", P.bedWidth / P.bedDepth);
  const plate = `${P.bedWidth} × ${P.bedDepth} mm`;
  $("minimap").title = `The drawing on the ${P.name} plate (${plate}). Click for the Print step`;
  $("plate").setAttribute("aria-label", `The drawing placed on the ${plate} plate of the ${P.name}`);
  const rows = [
    ["Printer", P.name],
    ["Print area", `${plate}${P.buildHeight ? ` × ${P.buildHeight} mm` : ""}`],
    ["Layer height", `${P.layerHeight} mm (unless the chocolate has its own; first layer Z follows it)`],
    ["Print speed", P.maxPrintSpeed ? `${P.maxPrintSpeed} mm/s (F${P.maxPrintSpeed * 60})` : "–"],
    ["Min. layer time", P.minLayerTime ? `${P.minLayerTime} s` : "–"],
    ["Retraction", P.retraction ? `${P.retraction} mm at ${P.retractSpeed} mm/s, wipe ${P.wipeTime} s` : "none"],
    [
      "Cartridge",
      `${P.cartridge ? P.cartridge + ", " : ""}${P.cartridgeDiameter} mm inside (with the needle, sets E per mm)`,
    ],
    ["Slowest print speed", `${P.minPrintSpeed} mm/s`],
    ["Travel speed", `${P.travelSpeed} mm/s`],
    ["Start / end G-code", `${(P.startGcode || []).length} / ${(P.endGcode || []).length} lines`],
    ["Coordinates", "absolute, mm"],
  ];
  // the values that shape every print, in one line under the menu (edited only in settings.js)
  $("printerSummary").textContent =
    `${P.cartridge || "Cartridge"} · Ø ${P.cartridgeDiameter} mm inside · plate ${plate}` +
    ` · retract ${P.retraction ? `${P.retraction} mm` : "off"} · at least ${P.minLayerTime} s per layer. These come from settings.js (Printer profile below).`;
  const t = $("profileTable");
  t.textContent = "";
  for (const [k, v] of rows) {
    const tr = t.insertRow();
    tr.insertCell().textContent = k;
    tr.insertCell().textContent = v;
  }
}
$("printer").addEventListener("change", () => {
  const H = goalNow();
  applyPrinter();
  if (!isModel()) layersFromHeight(H);
  posManual = false;
  showHeight();
  syncSizeUI();
  drawPlate();
  drawMini();
  // the size marks search up to the plate's width: find them again
  if (st.walk && !isModel() && !st.text) schedule(fit);
  printSettingsChanged();
}); // the size slider's plate mark moves with the plate
function designMM() {
  // printed extent in mm and the line as plate coordinates
  if (!st.final || !st.fb) return null;
  const k = scale(),
    b = st.fb;
  return { k, b, W: (b.x1 - b.x0) * k, H: (b.y1 - b.y0) * k };
}
// Plate layout: the design (mm, y up) rotated to fit and copied, from UNB.plateLayout. One copy can be moved with
// Position X/Y (its footprint's front-left corner); several copies are packed in rows and centred.
let plateCache = null;
function plateNow() {
  const n = Math.max(1, Math.min(200, Math.round(+$("copies").value || 1))),
    gap = Math.max(0, +$("copyGap").value || 0),
    straight = $("plateRot").value === "straight";
  if (isModel()) return st.model ? modelPlate(n, gap, straight) : null; // model.js: the footprint
  if (piecesOn()) return piecePlate(n, gap, straight); // pieces.js: a piece for each line of a text
  const d = designMM();
  if (!d) return null;
  const key = [st.finalVer, d.k, n, gap, straight, lineWidthMM(), BED.w, BED.h].join("|");
  if (plateCache && plateCache.key === key) return plateCache.lay;
  const m = st.final.re.length,
    x = new Float64Array(m),
    y = new Float64Array(m);
  for (let i = 0; i < m; i++) {
    x[i] = (st.final.re[i] - d.b.x0) * d.k;
    y[i] = (d.b.y1 - st.final.im[i]) * d.k;
  }
  const ang = st.mbox ? st.mbox.angle : 0;
  const lay = UNB.plateLayout(x, y, {
    bedW: BED.w,
    bedH: BED.h,
    copies: n,
    gap,
    pad: 0.5 * lineWidthMM(),
    straight,
    extraAngles: [ang, -ang],
  });
  plateCache = { key, lay };
  return lay;
}
let posManual = false; // one copy is centred until you type a position
function placements(lay) {
  // one copy follows Position X/Y; several are auto-packed, and so are a text's pieces
  if (lay.pieces) return lay.placed;
  if (lay.copies === 1) {
    if (!posManual) {
      $("gOx").value = +lay.placed[0].x.toFixed(1);
      $("gOy").value = +lay.placed[0].y.toFixed(1);
    }
    return [{ x: +$("gOx").value || 0, y: +$("gOy").value || 0 }];
  }
  return lay.placed;
}
function plateFits(lay, pl) {
  return (
    pl.every((p) => {
      const f = footOf(lay, p);
      return p.x >= -1e-6 && p.y >= -1e-6 && p.x + f.w <= BED.w + 1e-6 && p.y + f.h <= BED.h + 1e-6;
    }) && lay.fits >= lay.copies
  );
}
function paintPlate(cv, detail) {
  // shared by the Plate view and the mini-map; works out the layout even when the canvas is hidden
  const fit = fitCanvas(cv),
    dpr = fit ? fit.dpr : 1;
  const g = fit ? cv.getContext("2d") : null,
    s = cv.width / BED.w,
    P = (x, y) => [x * s, (BED.h - y) * s];
  const lay = plateNow(),
    pl = lay ? placements(lay) : [],
    ok = lay ? plateFits(lay, pl) : false;
  if (g) {
    let k = 1,
      shown = pl;
    if (cv.id === "plate") {
      // the Plate view: zoom (zoom.js), and One copy frames the first copy
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = css("--surface");
      g.fillRect(0, 0, cv.width, cv.height);
      k = zoomOn(g, "plate", cv).z;
      if (lay && !copiesShown() && pl.length) {
        // (a text's pieces: the piece chosen in the Plate card)
        const one = (lay.pieces && pl.find((p) => p.piece === pieceShown())) || pl[0],
          ft = footOf(lay, one);
        shown = [one];
        const [rx, ry] = P(one.x, one.y + ft.h),
          w = ft.w * s,
          h = ft.h * s,
          f = 0.85 * Math.min(cv.width / w, cv.height / h);
        g.transform(f, 0, 0, f, cv.width / 2 - (rx + w / 2) * f, cv.height / 2 - (ry + h / 2) * f);
        k *= f;
      }
    }
    paintBed(g, cv, s, dpr / k, detail); // hairlines stay hairlines when zoomed in
    const plate = cv.id === "plate",
      show = plate ? pathShown() : null;
    if (lay)
      paintCopies(
        g,
        lay,
        shown,
        s,
        P,
        dpr / k,
        detail,
        plate ? () => paintFills(g, shown, s, P, dpr / k, show) : null,
        !plate || show.wall
      );
    if (lay && plate && copiesShown()) paintMoves(g, s, P, dpr / k, show);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
  return lay ? { lay, pl, ok } : null;
}
function paintBed(g, cv, s, dpr, detail) {
  g.fillStyle = css("--paper");
  g.fillRect(0, 0, BED.w * s, BED.h * s);
  g.lineWidth = dpr;
  if (detail) {
    const step = dpr < 0.3 ? 1 : 10; // zoomed right in: a line every mm
    for (let x = 0; x <= BED.w; x += step) {
      g.strokeStyle = x % 50 ? css("--grid") : css("--rule");
      g.beginPath();
      g.moveTo(x * s, 0);
      g.lineTo(x * s, BED.h * s);
      g.stroke();
    }
    for (let y = 0; y <= BED.h; y += step) {
      g.strokeStyle = y % 50 ? css("--grid") : css("--rule");
      g.beginPath();
      g.moveTo(0, (BED.h - y) * s);
      g.lineTo(BED.w * s, (BED.h - y) * s);
      g.stroke();
    }
  }
  g.strokeStyle = css("--muted");
  g.strokeRect(0.5 * dpr, 0.5 * dpr, BED.w * s - dpr, BED.h * s - dpr);
}
// each copy's footprint (green on the plate, red off it), then fills (beforeLine), then its line
function paintCopies(g, lay, pl, s, P, dpr, detail, beforeLine, lines = true) {
  for (const p of pl) {
    const f = footOf(lay, p), // (a text's pieces each have their own footprint)
      inside = p.x >= -1e-6 && p.y >= -1e-6 && p.x + f.w <= BED.w + 1e-6 && p.y + f.h <= BED.h + 1e-6;
    const [rx, ry] = P(p.x, p.y + f.h);
    g.fillStyle = css(inside ? "--plate-fit" : "--plate-off");
    g.fillRect(rx, ry, f.w * s, f.h * s);
    if (detail) {
      g.save();
      g.setLineDash([3 * dpr, 3 * dpr]);
      g.strokeStyle = css("--accent");
      g.globalAlpha = 0.6;
      g.strokeRect(rx, ry, f.w * s, f.h * s);
      g.restore();
    }
  }
  if (beforeLine) beforeLine();
  if (lines)
    for (const p of pl) {
      const f = footOf(lay, p),
        L = f.local,
        m = L.x.length,
        open = f.open ?? st.open,
        stp = detail ? 1 : Math.max(1, Math.floor(m / 600));
      g.strokeStyle = css("--choc");
      g.lineWidth = Math.max(detail ? dpr : 0.8 * dpr, lineWidthMM() * s);
      g.lineJoin = g.lineCap = "round";
      g.beginPath();
      for (let i = 0; i <= (open ? m - 1 : m); i += stp) {
        const j = Math.min(i, m) % m,
          [X, Y] = P(p.x + L.x[j], p.y + L.y[j]);
        i ? g.lineTo(X, Y) : g.moveTo(X, Y);
      }
      if (!open) g.closePath();
      g.stroke();
    }
}
// the filled base's lines seen from above (layers.js builds them), for each copy shown
function paintFills(g, pl, s, P, lw, show) {
  const L = st.layers;
  if (!L || !show.fill) return;
  g.strokeStyle = css("--accent");
  g.globalAlpha = 0.75;
  g.lineWidth = Math.max(lw, 0.5 * lineWidthMM() * s);
  g.lineJoin = g.lineCap = "round";
  for (const p of pl) {
    const S = (L.pieces && p.piece != null ? L.pieces[p.piece] || L : L).stack; // a text's piece: its own layers
    for (const lap of S.laps) {
      if (lap.kind !== "base") continue;
      g.beginPath();
      for (let i = lap.from; i <= lap.to; i++) {
        const [X, Y] = P(p.x + S.x[i], p.y + S.y[i]);
        i === lap.from ? g.moveTo(X, Y) : g.lineTo(X, Y);
      }
      g.stroke();
    }
  }
  g.globalAlpha = 1;
}
// Whole plate: the moves between copies (dashed), the purge line and the wipes, from the print's G-code (layers.js)
function paintMoves(g, s, P, lw, show) {
  const path = (show.travel || show.purge) && printPath();
  if (!path) return;
  const sg = path.seg,
    kd = path.kind;
  for (const [name, col, dash] of [
    ["travel", "--muted", [4 * lw, 4 * lw]],
    ["purge", "--warn", []],
  ]) {
    if (!show[name]) continue;
    g.strokeStyle = css(col);
    g.lineWidth = name === "purge" ? 2.5 * lw : 1.2 * lw;
    g.setLineDash(dash);
    g.beginPath();
    for (let i = 0; i < kd.length; i++) {
      if (PATH_KINDS[kd[i]] !== name) continue;
      const q = 6 * i;
      if (sg[q] === sg[q + 3] && sg[q + 1] === sg[q + 4]) continue; // straight up or down: nothing to see from above
      const [X0, Y0] = P(sg[q], sg[q + 1]),
        [X1, Y1] = P(sg[q + 3], sg[q + 4]);
      g.moveTo(X0, Y0);
      g.lineTo(X1, Y1);
    }
    g.stroke();
  }
  g.setLineDash([]);
}
function drawPlate() {
  if (plotWanted()) plotSoon(); // plot.js: the 2D page follows the design
  pieceMenuUI(); // pieces.js: the Plate card's Lines of text follows the text
  if (!layersWanted()) return;
  const res = paintPlate($("plate"), true);
  if (!res) {
    $("plateHint").textContent = piecesOn()
      ? st.text
        ? "Tracing each line of the text as a piece of its own…"
        : "Tracing the bonds and each label as pieces of their own…"
      : "Trace something in the Line step first.";
    return;
  }
  const { lay, pl, ok } = res;
  if (lay.pieces) return piecePlateText(lay, pl, ok);
  const single = lay.copies === 1;
  $("gOx").disabled = $("gOy").disabled = !single;
  $("plateCenter").disabled = !single;
  $("plateInfo").textContent =
    `${fmt(lay.w, 1)} × ${fmt(lay.h, 1)} mm${lay.angle ? ` · rotated ${fmt(lay.angle, 0)}°` : ""}`;
  $("plateHint").className = ok ? "hint" : "hint warn";
  const rot = lay.angle ? ` Rotated ${fmt(lay.angle, 0)}° to fit${single ? "" : " the most copies"}.` : "";
  if (single)
    $("plateHint").textContent = ok
      ? `Fits on the ${BED.w} × ${BED.h} mm plate.${rot} ${posManual ? "Position is the footprint's front-left corner." : "Centred; set a position under Fine-tuning to move it."}`
      : lay.fits
        ? `Off the plate at this position.${rot} Use Center on plate.`
        : `Too big for the plate even rotated: the footprint is ${fmt(lay.w, 1)} × ${fmt(lay.h, 1)} mm. Make the design smaller.`;
  else
    $("plateHint").textContent =
      lay.fits >= lay.copies
        ? `${lay.copies} copies fit, ${fmt(+$("copyGap").value || 0, 1)} mm apart (room for ${lay.capacity}).${rot}`
        : `Only ${lay.fits} of ${lay.copies} copies fit at ${fmt(+$("copyGap").value || 0, 1)} mm spacing.${rot} Lower the copies or spacing, or make the design smaller.`;
  layersSoon(); // layers.js: the stack follows the design and the plate
}
// the Plate card's size and hint for a text's pieces
function piecePlateText(lay, pl, ok) {
  const k = lay.pieces.length,
    gap = fmt(+$("copyGap").value || 0, 1),
    lines = st.text ? "lines" : "pieces: the bonds and the labels",
    what = `${lay.copies} piece${lay.copies === 1 ? "" : "s"} (${lay.sets > 1 ? `${lay.sets} × ` : ""}${k} ${lines})`,
    rot = lay.angle ? ` Turned ${fmt(lay.angle, 0)}° to fit more.` : "";
  $("gOx").disabled = $("gOy").disabled = $("plateCenter").disabled = true;
  $("plateInfo").textContent =
    `${k} pieces · ${fmt(lay.w, 1)} × ${fmt(lay.h, 1)} mm${lay.angle ? ` · rotated ${fmt(lay.angle, 0)}°` : ""}`;
  $("plateHint").className = ok ? "hint" : "hint warn";
  $("plateHint").textContent = ok
    ? `${what} fit, ${gap} mm apart. ${st.text ? "Each line prints as its own piece, one after another." : "The bonds print as one line, then each label as its own piece, in their places."}${rot}`
    : `Only ${lay.fits} of ${what} fit at ${gap} mm spacing.${rot} Lower the copies or spacing, or make the letters smaller.`;
  layersSoon();
}
function drawMini() {
  if (stageNow() !== "line") return; // the mini-map sits on the line view
  const mm = $("minimap");
  if (!$("showMini").checked) {
    mm.hidden = true;
    return;
  }
  mm.hidden = false;
  const res = paintPlate($("miniPlate"), false);
  if (!res) {
    mm.hidden = true;
    return;
  }
  mm.classList.toggle("bad", !res.ok);
  const { lay } = res;
  $("miniInfo").textContent =
    (lay.pieces || lay.copies > 1
      ? `${Math.min(lay.fits, lay.copies)}/${lay.copies} fit`
      : res.ok
        ? "fits plate"
        : lay.fits
          ? "off plate"
          : "too big") + (lay.angle && lay.fits ? ` · rotated ${fmt(lay.angle, 0)}°` : "");
}
$("showMini").addEventListener("change", drawMini);
// Toolbar menus (File, View): the panel floats above or below its button, stays on screen, and closes on a click
// outside, on Esc, or (File) once an item is chosen. Opening one closes the other.
const MENUS = [...document.querySelectorAll("details.viewmenu")];
function placeMenu(m) {
  if (!m.open) return;
  const r = m.querySelector("summary").getBoundingClientRect(),
    pn = m.querySelector(".viewpanel"),
    h = pn.offsetHeight,
    w = pn.offsetWidth;
  pn.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + "px";
  pn.style.top = (r.top - h - 6 >= 8 ? r.top - h - 6 : Math.min(r.bottom + 6, innerHeight - h - 8)) + "px";
}
const placeMenus = () => MENUS.forEach(placeMenu);
for (const m of MENUS) {
  m.addEventListener("toggle", () => {
    if (m.open)
      MENUS.forEach((o) => {
        if (o !== m) o.open = false;
      });
    placeMenu(m);
  });
  m.querySelectorAll(".mitem").forEach((b) =>
    b.addEventListener("click", () => {
      m.open = false;
    })
  );
}
addEventListener("resize", placeMenus);
addEventListener("scroll", placeMenus, true);
document.addEventListener("click", (e) =>
  MENUS.forEach((m) => {
    if (m.open && !m.contains(e.target)) m.open = false;
  })
);
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const m = MENUS.find((x) => x.open);
  if (m) {
    m.open = false;
    m.querySelector("summary").focus();
  }
});
$("minimap").addEventListener("click", () => {
  $("viewChoc").checked = true;
  viewChanged();
});
// Keep within the build plate: the size can't go past the widest that fits this printer (only matters for 3D prints)
$("limitPlate").addEventListener("change", () => {
  if (limitToPlate() && !st.text && !isModel() && st.outW > plateW()) setSize(plateW(), true);
  else syncSizeUI();
  recordSoon();
  drawPlate();
  drawMini();
});
$("plateCenter").addEventListener("click", () => {
  posManual = false;
  drawPlate();
  drawMini();
});
for (const id of ["gOx", "gOy"])
  $(id).addEventListener("input", () => {
    posManual = true;
    drawPlate();
    drawMini();
  });
for (const id of ["copies", "copyGap"])
  $(id).addEventListener("input", () => {
    drawPlate();
    drawMini();
  });
$("plateRot").addEventListener("change", () => {
  drawPlate();
  drawMini();
});
function viewChanged() {
  document.body.dataset.view = $("viewArt").checked
    ? "art"
    : $("view2D").checked
      ? "plot"
      : $("viewChoc").checked
        ? "choc"
        : "design";
  // each tab brings its own big view (the Art step: the Line view, where the input shows traced, or a model turns); the
  // view tabs can change it
  setStage(stageFor(document.body.dataset.view)); // workflow.js: the preview follows the step
  traceNeededUI(); // workflow.js: Print (or Plot a picture) with Trace off says to turn it on
  nextBarUI(); // workflow.js: the Next bar's note
  drawPlate();
  drawMini();
  render(); // the Print step shows the filled base layer (or a model's layers)
}
document.querySelectorAll('input[name="view"]').forEach((r) => r.addEventListener("change", viewChanged));

// ---------- the big view: Line, 2D page, Plate, 3D layers ----------
// The settings tabs (Art, Trace, 2D, 3D) are on the side; the big view above shows the line, the pen plotter's page
// (click
// shapes to fill), the plate with every copy, or the layers in 3D (drag to turn). Picking a settings tab brings its
// view;
// Play drawing plays whichever view is showing.
const stageNow = () => document.body.dataset.stage;
const STAGE_IDS = { line: "stLine", page: "stPage", plate: "stPlate", layers: "stLayers" };
// the pen line and fills are needed
const plotWanted = () => document.body.dataset.view === "plot" || stageNow() === "page";
const layersWanted = () => document.body.dataset.view === "choc" || stageNow() === "plate" || stageNow() === "layers";
function setStage(v) {
  $(STAGE_IDS[v]).checked = true;
  stageChanged();
}
function stageChanged() {
  const v = document.querySelector('input[name="stage"]:checked').value;
  if (v === stageNow()) return;
  if (st.tool && v !== "line") exitTool(); // the tools work on the line view
  if (st.playing) stopPlay(0);
  document.body.dataset.stage = v;
  zoomUI(); // zoom.js: this view's own zoom
  if (v === "page") {
    plotSoon(0);
    drawPage();
  } else if (v === "plate") drawPlate();
  else if (v === "layers") {
    drawPlate();
    layersSoon(0);
    drawStack();
  } else {
    render();
    drawMini();
  }
}
document.querySelectorAll('input[name="stage"]').forEach((r) => r.addEventListener("change", stageChanged));
// what the animation redraws: the view that's showing (preview.js runs the clock)
function redrawStage() {
  const v = stageNow();
  if (v === "page") drawPage();
  else if (v === "layers") drawStack();
  else if (v === "plate") drawPlate();
  else render();
}
new ResizeObserver(drawPlate).observe($("plate"));
new ResizeObserver(drawMini).observe($("box"));

// ---------- collapsible control sections ----------
// cardSetOpen(card, open, store): open or fold a card (store: remember it for the next visit); cardRestore(): every
// card back as you left it (scroll.js, when the wheel is turned off)
let cardSetOpen = null,
  cardRestore = null;
(() => {
  const KEY = storeKey("collapsed");
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {}
  // every card has a heading; the toggle goes in it
  const cards = [...document.querySelectorAll("section.card")].filter((c) => c.querySelector("h2"));
  const setOpen = (card, open, store = true) => {
    card.classList.toggle("collapsed", !open);
    card.querySelector(".card-toggle").setAttribute("aria-expanded", String(open));
    if (open && card.querySelector("canvas")) drawChart();
    if (store) {
      saved[card.id] = !open;
      try {
        localStorage.setItem(KEY, JSON.stringify(saved));
      } catch {}
    }
  };
  for (const card of cards) {
    const h2 = card.querySelector("h2"),
      body = document.createElement("div");
    card.id = card.id || "card-" + h2.id;
    body.className = "card-body";
    body.id = card.id + "-body";
    while (h2.nextSibling) body.appendChild(h2.nextSibling);
    card.appendChild(body);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card-toggle";
    btn.setAttribute("aria-controls", body.id);
    const t = document.createElement("span");
    t.className = "t";
    t.textContent = h2.firstChild.textContent.trim();
    h2.firstChild.remove();
    btn.appendChild(t);
    // keep the info readout (e.g. "7 parts") visible when collapsed
    while (h2.firstChild) btn.appendChild(h2.firstChild);
    h2.appendChild(btn);
    btn.addEventListener("click", () => setOpen(card, card.classList.contains("collapsed")));
    // data-fold="closed": starts folded until opened
    setOpen(card, saved[card.id] === undefined ? card.dataset.fold !== "closed" : !saved[card.id], false);
  }
  cardSetOpen = setOpen;
  cardRestore = () => {
    for (const card of cards)
      setOpen(card, saved[card.id] === undefined ? card.dataset.fold !== "closed" : !saved[card.id], false);
  };
  $("collapseAll").addEventListener("click", () => cards.forEach((c) => setOpen(c, false)));
  $("expandAll").addEventListener("click", () => cards.forEach((c) => setOpen(c, true)));
})();

// ---------- help behind ⓘ ----------
// Explanations (p.hint.help) stay out of the way: an ⓘ next to the control they explain (the row's label) or, for a
// card-wide one, next to the card's title shows the text on hover and opens it under the control on a click or tap.
// Live readouts and warnings stay on the page. Text written later (e.g. the needle's) is read when the ⓘ is used.
(() => {
  let n = 0;
  for (const p of document.querySelectorAll("p.hint.help")) {
    // data-anchor="id": next to that control's own label; else the row's label; else the card's title
    const own = p.dataset.anchor && $(p.dataset.anchor),
      row = p.closest(".row");
    const lab = own
      ? own.closest("label").querySelector("span")
      : row && row.querySelector(":scope > .lab label, :scope > .lab .name");
    const card = p.closest("section.card"),
      at = lab || (card && card.querySelector("h2"));
    if (!at) continue;
    p.id = p.id || `help${++n}`;
    p.hidden = true;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "info";
    b.textContent = "ⓘ";
    const name = (lab ? lab.textContent : card.querySelector(".card-toggle .t").textContent).trim();
    b.setAttribute("aria-label", `About ${name}`);
    b.setAttribute("aria-expanded", "false");
    b.setAttribute("aria-controls", p.id);
    b.addEventListener("pointerenter", () => {
      b.title = p.textContent.trim();
    });
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      p.hidden = !p.hidden;
      b.setAttribute("aria-expanded", String(!p.hidden));
    });
    const only = p.closest(".text-only, .img-only, .model-only, .lines-only"); // the ⓘ shows when its text can
    if (only && !at.closest(".text-only, .img-only, .model-only, .lines-only"))
      for (const c of ["text-only", "img-only", "model-only", "lines-only"])
        if (only.classList.contains(c)) b.classList.add(c);
    at.appendChild(b);
  }
})();

// ---------- notices that can be put away (data-notice: their name; gone for good once closed) ----------
document.querySelectorAll("[data-notice]").forEach((el) => {
  const key = storeKey("notice-" + el.dataset.notice);
  let gone = false;
  try {
    gone = localStorage.getItem(key) === "1";
  } catch {}
  if (gone) {
    el.hidden = true;
    return;
  }
  const x = document.createElement("button");
  x.type = "button";
  x.className = "notice-x";
  x.textContent = "×";
  x.setAttribute("aria-label", "Close this notice");
  x.addEventListener("click", () => {
    el.hidden = true;
    try {
      localStorage.setItem(key, "1");
    } catch {}
  });
  el.appendChild(x);
});

// ---------- the Print step's More print settings (Base, Infill, Fine-tuning, Test print, the printer profile)
// ----------
// folded away under one button until wanted; remembered in this browser
function morePrintSet(on, store = true) {
  document.body.dataset.moreprint = on ? "1" : "";
  $("morePrintBtn").setAttribute("aria-expanded", String(on));
  $("morePrintBtn").querySelector(".more-tri").textContent = on ? "▾" : "▸";
  $("morePrintBtn").lastChild.textContent = on ? " Fewer print settings" : " More print settings";
  if (store)
    try {
      localStorage.setItem(storeKey("morePrint"), on ? "1" : "");
    } catch {}
}
$("morePrintBtn").addEventListener("click", () => morePrintSet(document.body.dataset.moreprint !== "1"));
(() => {
  let on = false;
  try {
    on = localStorage.getItem(storeKey("morePrint")) === "1";
  } catch {}
  morePrintSet(on, false);
})();
