// Unbroken · web app · pieces.js
// A text of several lines printed as a piece per line (3D tab, Plate card: Lines of text). The Trace and 2D tabs keep
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
  return !isModel() && !!st.text && textLines() > 1 && $("textPieces").value === "each";
}
// everything a piece's line depends on: the text and its hand edits, the line settings, the size (letters per mm)
function piecesKeyNow() {
  const s = settings();
  return JSON.stringify([
    st.source && st.source.__id,
    st.sel,
    st.erase,
    st.edits,
    st.zones,
    s.open,
    s.loose,
    spacingMM(),
    lineWidthMM(),
    cornerMM(),
    +$("uncross").value,
    CFG.engine.loopRadius,
    CFG.engine.termTolerance,
    st.text && st.text.ppm,
  ]);
}
// the pieces for the text on screen, if they're traced
const piecesNow = () => (st.pieces && st.pieces.key === piecesKeyNow() ? st.pieces : null);

// Trace every line on its own: the line's letters (UNB.rasterText's lines) through the same stages as the Trace tab
// (stageTrace, then stagePrint: strands, loops, series with the automatic term count, untangled and spaced).
async function tracePieces() {
  const key = piecesKeyNow();
  if (piecesJob && piecesJob.key === key) return piecesJob.promise;
  const promise = (async () => {
    const W = await working(),
      s = settings(),
      T = st.text,
      ppm = T.ppm,
      d = spacingMM() * ppm, // px: a text is traced at its own resolution, so every piece has the same scale
      list = [];
    for (let i = 0; i < T.lines.length; i++) {
      const walk = await LAY.call("stageTrace", traceArgs(W, s, T.lines[i]));
      if (!walk) continue; // every letter of the line erased
      const r = await LAY.call("stagePrint", [
        walk,
        d,
        W.w,
        W.h,
        {
          w: d * lineRatio(),
          loop: CFG.engine.loopRadius,
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
        name: (T.lineNames && T.lineNames[i]) || `line ${i + 1}`,
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
  const key = [P.key, n, gap, straight, lineWidthMM(), BED.w, BED.h].join("|");
  if (piecePlateCache && piecePlateCache.key === key && piecePlateCache.P === P) return piecePlateCache.lay;
  const lines = P.list.map((D) => {
    const k = D.outW / D.bw,
      m = D.final.re.length,
      x = new Float64Array(m),
      y = new Float64Array(m);
    for (let i = 0; i < m; i++) {
      x[i] = (D.final.re[i] - D.fb.x0) * k;
      y[i] = (D.fb.y1 - D.final.im[i]) * k;
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
  });
  lay.pieces.forEach((q, i) => (q.open = P.list[i].open));
  piecePlateCache = { key, P, lay };
  return lay;
}
// a placement's footprint: its piece's (w, h, local line), or the one design's
const footOf = (lay, p) => (lay.pieces && p.piece != null ? lay.pieces[p.piece] : lay);

// The layers of every piece (layers.js designLayers, each turned and moved into its own footprint). Returns the
// layers of the piece One copy shows, with every piece's in .pieces, so the readouts, the slider and the One copy
// views work as for one design while the plate, the G-code and the Whole plate views take every piece.
async function buildPieceLayers() {
  const lay = plateNow();
  if (!lay || !lay.pieces) return null;
  const P = piecesNow(),
    list = [];
  for (let i = 0; i < P.list.length; i++) list.push(await designLayers(P.list[i], lay.pieces[i].xf));
  if (st.pieces !== P) return piecesOn() ? buildPieceLayers() : null; // new pieces landed meanwhile
  const k = Math.min(pieceShown(), list.length - 1);
  return Object.assign({}, list[k], { key: list.map((q) => q.key).join("|") + `#${k}`, pieces: list, piece: k });
}
// which piece One copy shows (Plate card), from 0
const pieceShown = () => Math.max(0, +$("pieceShown").value || 0);

// ---------- the Plate card: Lines of text, and which piece One copy shows ----------
function pieceMenuUI() {
  const many = !isModel() && !!st.text && textLines() > 1,
    on = piecesOn();
  $("piecesRow").hidden = !many;
  $("pieceShownField").hidden = !on;
  $("copiesLab").textContent = on ? "Copies of each line" : "Copies";
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
