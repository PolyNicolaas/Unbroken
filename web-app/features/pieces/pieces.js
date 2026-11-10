// Unbroken · web app · pieces.js
// A text of several lines printed as a piece per line (Print step, Plate card: Lines of text). The Trace and Plot steps
// keep
// the text as one drawing, one continuous line; for the printer each line is traced again on its own, so every piece
// is one continuous line of its own, with no connector strand from one line to the next. The pieces are laid out on
// the plate together (UNB.plateLayoutPieces), each gets its own layers (layers.js designLayers) and the G-code prints
// them one after another, like copies.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// st.pieces: { key, list: [piece] } for the text on screen, or null. A piece is a design like st itself (walk, w, h,
// crop, outW, bw, spacing, final, fb, open, finalVer), traced from one line's letters in the same working image, with
// the automatic term count. Set only here.
st.pieces = null;
let piecesJob = null, // { key, promise } while a set of pieces is being traced
  piecesTimer = null,
  pieceVer = 0;

// how many lines of the text have letters (an empty line is no piece)
const textLines = () => (st.text && st.text.lines ? st.text.lines.length : 0);
// the text prints as a piece per line: a text (not a model) with two or more lines, and the Plate card says so
function piecesOn() {
  return (
    !isModel() &&
    ((!!st.text && textLines() > 1 && $("textPieces").value !== "one") ||
      (typeof moleculePiecesOn === "function" && moleculePiecesOn()))
  ); // (molecule.js: loaded after this file)
}
const moleculePieces = () => !st.text && typeof moleculePiecesOn === "function" && moleculePiecesOn();
// the pieces keep their places, laid on the plate as one block: a molecule's bonds and labels, or a text's lines "in
// place" (the layout as typed, one line under the other); packed, each line goes wherever it fits
const piecesTogether = () => moleculePieces() || (!!st.text && $("textPieces").value === "place");
// The Line step draws a text as one joined line, but printed as a piece per line the connectors from one line to the
// next are never printed: the needle lifts between pieces. Which samples of the line are such a connector (lift),
// and how many runs (n); null when the text isn't printed in pieces. Each sample's line of text is the one whose
// letters' rows (st.text.lines) its height falls in, or the nearest.
let liftsCache = null;
function lineLifts() {
  if (!st.text || !st.final || !st.jumpF || !piecesOn() || !st.text.lines || st.text.lines.length < 2) return null;
  if (liftsCache && liftsCache.final === st.final && liftsCache.text === st.text) return liftsCache.r;
  const T = st.text,
    W = T.w,
    bands = T.lines.map((m) => {
      let y0 = Infinity,
        y1 = -Infinity;
      for (let i = 0; i < m.length; i++)
        if (m[i]) {
          const y = (i / W) | 0;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      return [y0, y1];
    });
  const lineAt = (s) => {
    const y = fromWork(st.final.re[s], st.final.im[s])[1] * st.source.height;
    let best = 0,
      bd = Infinity;
    bands.forEach(([a, b], i) => {
      const d = y < a ? a - y : y > b ? y - b : 0;
      if (d < bd) ((bd = d), (best = i));
    });
    return best;
  };
  const F = st.jumpF,
    S = st.final.re.length,
    lift = new Uint8Array(S);
  let n = 0;
  // the line is a loop: start just after a sample that isn't a connector, so a run across the seam (sample S−1 → 0)
  // is one run, and the samples either side of every run are on letters
  const z = F.findIndex((v) => !v);
  if (z >= 0)
    for (let i = 1; i <= S; i++) {
      const s = (z + i) % S;
      if (!F[s] || F[(s - 1 + S) % S]) continue; // the start of a connector run
      let len = 0;
      while (len + 1 < S && F[(s + len + 1) % S]) len++;
      const a = (s - 1 + S) % S,
        b = (s + len + 1) % S;
      if (lineAt(a) !== lineAt(b)) {
        for (let k = 0; k <= len; k++) lift[(s + k) % S] = 1;
        n++;
      }
      i += len;
    }
  const r = n ? { lift, n } : null;
  liftsCache = { final: st.final, text: st.text, r };
  return r;
}
// everything a piece's line depends on: the text and its hand edits, the line settings, the size (letters per mm)
function piecesKeyNow() {
  const s = settings();
  return JSON.stringify([
    st.source && st.source.__id,
    st.sel,
    st.erase,
    st.zones,
    s.open,
    s.loose,
    spacingMM(),
    lineWidthMM(),
    cornerMM(),
    +$("uncross").value,
    $("overlaps").checked,
    endLoop(),
    CFG.engine.termTolerance,
    st.text && st.text.ppm,
    // a molecule: the structure, how it prints, its size
    moleculePieces() ? [moleculeName(), st.art.molecule.mol.atoms.length, st.outW, st.bw] : null,
  ]);
}
// the pieces for the text on screen, if they're traced
const piecesNow = () => (st.pieces && st.pieces.key === piecesKeyNow() ? st.pieces : null);

// Trace every line on its own: the line's letters (UNB.rasterText's lines) through the same stages as the Line step
// (stageTrace, then stagePrint: strands, loops, series with the automatic term count, untangled and spaced).
async function tracePieces() {
  const key = piecesKeyNow();
  if (piecesJob && piecesJob.key === key) return piecesJob.promise;
  const promise = (async () => {
    const W = await working(),
      s = settings(),
      T = st.text,
      mol = !T, // a molecule's bonds and labels (molecule.js), else a text's lines
      ppm = mol ? st.bw / st.outW : T.ppm, // px per mm of the working image
      d = spacingMM() * ppm, // px: every piece has the same scale
      items = mol
        ? moleculeRegions(W)
        : T.lines.map((m, i) => ({ text: m, name: (T.lineNames && T.lineNames[i]) || `line ${i + 1}` })),
      list = [];
    if (!(ppm > 0 && Number.isFinite(ppm))) return { key, list }; // (no scale yet: nothing to trace pieces at)
    for (let i = 0; i < items.length; i++) {
      const it = items[i],
        walk = await LAY.call("stageTrace", traceArgs(W, s, it.text || null, it.mask || null));
      if (!walk) continue; // every letter of the line erased
      const r = await LAY.call("stagePrint", [
        walk,
        d,
        W.w,
        W.h,
        {
          w: d * lineRatio(),
          loop: endLoop(),
          round: cornerMM() * ppm,
          fill: null,
          termTol: CFG.engine.termTolerance,
          unx: +$("uncross").value,
          minGap: MIN_GAP_PX,
          ...allowSpec(W.w, W.h, W.crop),
        },
      ]);
      const f = r.final;
      let x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity;
      for (let j = 0; j < f.re.length; j++) {
        x0 = Math.min(x0, f.re[j]);
        x1 = Math.max(x1, f.re[j]);
        y0 = Math.min(y0, f.im[j]);
        y1 = Math.max(y1, f.im[j]);
      }
      const bw = Math.max(1, walk.bbox.maxX - walk.bbox.minX);
      list.push({
        name: it.name,
        walk,
        w: W.w,
        h: W.h,
        crop: W.crop,
        bw,
        outW: bw / ppm,
        spacing: spacingMM(),
        final: f,
        fb: { x0, y0, x1, y1 },
        open: r.open,
        N: r.N,
        gap: r.gap,
        crossings: r.after,
        finalVer: `piece-${++pieceVer}`,
      });
    }
    return { key, list };
  })();
  piecesJob = { key, promise };
  try {
    return await promise;
  } finally {
    if (piecesJob && piecesJob.promise === promise) piecesJob = null;
  }
}
// trace the pieces when they're wanted and out of date, then show them (plate, mini-map, layers)
function piecesSoon() {
  if (piecesTimer) return;
  piecesTimer = setTimeout(async () => {
    piecesTimer = null;
    if (!piecesOn() || piecesNow()) return;
    try {
      const P = await tracePieces();
      if (P.key !== piecesKeyNow()) return piecesSoon(); // the text changed meanwhile: trace the new one
      st.pieces = P;
      pieceMenuUI();
      drawPlate();
      drawMini();
      readyUI();
    } catch (e) {
      if (e !== CANCELLED) console.error(e);
    }
  }, 0);
}

// The plate: every piece turned and packed (UNB.plateLayoutPieces), copies = sets of pieces. null while the pieces are
// being traced (and starts that).
let piecePlateCache = null;
function piecePlate(n, gap, straight) {
  const P = piecesNow();
  if (!P) {
    piecesSoon();
    return null;
  }
  const key = [P.key, n, gap, straight, lineWidthMM(), BED.w, BED.h, piecesTogether()].join("|");
  if (piecePlateCache && piecePlateCache.key === key && piecePlateCache.P === P) return piecePlateCache.lay;
  // (a molecule's pieces, or a text's lines in place, keep their places: one frame for all of them)
  const together = piecesTogether(),
    U = together
      ? {
          x0: Math.min(...P.list.map((D) => D.fb.x0)),
          y1: Math.max(...P.list.map((D) => D.fb.y1)),
        }
      : null;
  const lines = P.list.map((D) => {
    const k = D.outW / D.bw,
      fb = U || D.fb,
      m = D.final.re.length,
      x = new Float64Array(m),
      y = new Float64Array(m);
    for (let i = 0; i < m; i++) {
      x[i] = (D.final.re[i] - fb.x0) * k;
      y[i] = (fb.y1 - D.final.im[i]) * k;
    }
    return { x, y };
  });
  const lay = UNB.plateLayoutPieces(lines, {
    bedW: BED.w,
    bedH: BED.h,
    copies: n,
    gap,
    pad: 0.5 * lineWidthMM(),
    straight,
    together,
  });
  lay.pieces.forEach((q, i) => (q.open = P.list[i].open));
  lay.frame = U; // (pieces kept together: their lines go on the plate from this common corner, not their own)
  piecePlateCache = { key, P, lay };
  return lay;
}
// a placement's footprint: its piece's (w, h, local line), or the one design's

// The layers of every piece (layers.js designLayers, each turned and moved into its own footprint). Returns the
// layers of the piece One copy shows, with every piece's in .pieces, so the readouts, the slider and the One copy
// views work as for one design while the plate, the G-code and the Whole plate views take every piece.
async function buildPieceLayers() {
  const lay = plateNow();
  if (!lay || !lay.pieces) return null;
  const P = piecesNow(),
    list = [];
  // (a molecule's pieces were laid out from one common corner, so each label keeps its place by its bond: the layers
  // are worked out from that corner too)
  const inFrame = (D) => (lay.frame ? { ...D, fb: { ...D.fb, x0: lay.frame.x0, y1: lay.frame.y1 } } : D);
  for (let i = 0; i < P.list.length; i++) list.push(await designLayers(inFrame(P.list[i]), lay.pieces[i].xf));
  if (st.pieces !== P) return piecesOn() ? buildPieceLayers() : null; // new pieces landed meanwhile
  const k = Math.min(pieceShown(), list.length - 1);
  return Object.assign({}, list[k], { key: list.map((q) => q.key).join("|") + `#${k}`, pieces: list, piece: k });
}
// which piece One copy shows (Plate card), from 0
const pieceShown = () => Math.max(0, +$("pieceShown").value || 0);

// ---------- the Plate card: Lines of text, and which piece One copy shows ----------
function pieceMenuUI() {
  const many = !isModel() && !!st.text && textLines() > 1,
    molLabels =
      typeof moleculeDrawn === "function" &&
      !isModel() &&
      !st.text &&
      st.art.kind === "molecule" &&
      !!moleculeDrawn().r &&
      moleculeDrawn().r.labels > 0,
    on = piecesOn();
  $("piecesRow").hidden = !many && !molLabels;
  $("textPieces").closest(".field").hidden = !many;
  if ($("molPiecesField")) $("molPiecesField").hidden = !molLabels; // (molecule.js's, when it's on)
  $("pieceShownField").hidden = !on || piecesTogether(); // (pieces kept together: One copy is every piece)
  $("copiesLab").textContent = on && many && !piecesTogether() ? "Copies of each line" : "Copies";
  const P = piecesNow(),
    el = $("pieceShown");
  if (P) {
    const names = P.list.map((D, i) => `${i + 1}: ${D.name}`),
      had = el.value;
    if ([...el.options].map((o) => o.textContent).join("\n") !== names.join("\n")) {
      el.textContent = "";
      names.forEach((t, i) => el.add(new Option(t, String(i))));
      el.value = +had < names.length ? had : "0";
    }
  }
}
$("textPieces").addEventListener("change", () => {
  pieceMenuUI();
  if (st.final && st.err) readouts(); // the corner label: connectors between lines, or lifts
  render(); // the Line step: lifts between lines drawn dashed, or as connectors
  limitLines(); // source.js: the Text card's line count says how the lines print
  drawPlate();
  drawMini();
  layersSoon(0);
  readyUI();
});
$("pieceShown").addEventListener("change", () => {
  drawPlate();
  layersSoon(0);
});

// what the core asks about pieces
on("piecesOn", piecesOn);
on("piecePlate", (n, gap, straight) => (piecesOn() ? piecePlate(n, gap, straight) : null)); // the plate's layout
on("pieceLayers", () => (piecesOn() ? buildPieceLayers() : null)); // the layers
on("lineLifts", lineLifts); // where the needle lifts between the lines of a text
on("plateUI", pieceMenuUI);
// the Plate card's size and hint for a text's pieces
function piecePlateText(lay, pl, ok) {
  const k = lay.pieces.length,
    gap = fmt(+$("copyGap").value || 0, 1),
    // a molecule: a bonds piece unless it has no bonds (water, a salt's ions), and a piece for each label
    bonds = !st.text && !!st.pieces && st.pieces.list.some((D) => D.name === "bonds"),
    lines = st.text
      ? "lines"
      : `piece${k === 1 ? "" : "s"}: ${bonds ? (k > 1 ? "the bonds and the labels" : "the bonds") : k === 1 ? "the label" : "the labels"}`,
    what = `${lay.copies} piece${lay.copies === 1 ? "" : "s"} (${lay.sets > 1 ? `${lay.sets} × ` : ""}${k} ${lines})`,
    how = st.text
      ? piecesTogether()
        ? "Each line prints as its own piece, one after another, in its place: the layout as typed."
        : "Each line prints as its own piece, one after another, packed to save room."
      : bonds
        ? "The bonds print as one line, then each label as its own piece, in their places."
        : k === 1
          ? "The label prints as one line."
          : "Each label prints as its own piece, in its place.",
    rot = lay.angle ? ` Turned ${fmt(lay.angle, 0)}° to fit more.` : "";
  $("gOx").disabled = $("gOy").disabled = $("plateCenter").disabled = true;
  $("plateInfo").textContent =
    `${k} piece${k === 1 ? "" : "s"} · ${fmt(lay.w, 1)} × ${fmt(lay.h, 1)} mm${lay.angle ? ` · rotated ${fmt(lay.angle, 0)}°` : ""}`;
  $("plateHint").className = ok ? "hint" : "hint warn";
  $("plateHint").textContent = ok
    ? `${what} ${lay.copies === 1 ? "fits" : "fit"}, ${gap} mm apart. ${how}${rot}`
    : `Only ${lay.fits} of ${what} fit at ${gap} mm spacing.${rot} Lower the copies or spacing, or make the letters smaller.`;
  layersSoon();
}
on("piecePlateText", piecePlateText);
on("pieceShown", pieceShown); // the piece One copy shows
