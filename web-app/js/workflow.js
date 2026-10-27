// Unbroken · web app · workflow.js
// The steps: what it's made for (a printer or a pen plotter, the switch at the top), then Art → Line → Print or Plot,
// and the Line step's one switch for how the art becomes lines (docs/WORKFLOW-PLAN.md):
//   one      One continuous line: the Fourier trace (pipeline.js); the only line a printer can make.
//   strokes  Separate strokes: the art traced into strokes, the pen lifting between them (UNB.stageStrokes, here;
//            st.sepStrokes).
//   drawn    As drawn: a pattern's or the text's own lines, nothing traced (art.js artVectors).
// The preview follows the step: the art or the line on Art and Line, the page on Plot, the plate or layers on Print.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// the line in use: a printer always takes one line; As drawn needs a pattern or text (a picture has no lines until
// traced: it gets separate strokes); a model is sliced, one line per layer
function lineModeNow() {
  if (!artForPlot() || st.art.kind === "model") return "one";
  const m = document.querySelector('input[name="lineMode"]:checked').value;
  return m === "drawn" && !asDrawnOK() ? "strokes" : m;
}
// the big view for a step
function stageFor(view) {
  if (view === "plot") return "page";
  if (view === "choc") return stageNow() === "plate" ? "plate" : "layers";
  return lineModeNow() === "drawn" ? "page" : "line";
}
const LINE_SUB = { one: "traced into one line", strokes: "traced into strokes", drawn: "as drawn, no trace" };
function workflowUI() {
  const plot = artForPlot(),
    mode = lineModeNow(),
    B = document.body.dataset;
  B.out = plot ? "plot" : "print";
  B.line = mode;
  // the last step is Plot or Print, not both
  if (plot && $("viewChoc").checked) $("view2D").checked = true;
  if (!plot && $("view2D").checked) $("viewChoc").checked = true;
  $("lineStrokes").disabled = $("lineDrawn").disabled = !plot;
  $("lineDrawn").disabled = !plot || !asDrawnOK();
  $("stepLineSub").textContent = LINE_SUB[mode];
  $("goOut").textContent = plot ? "Next: plot it →" : "Next: print it →";
  const kind = { picture: "picture", text: "text", pattern: "pattern", model: "model" }[st.art.kind];
  $("lineModeHint").textContent = !plot
    ? "A printer makes one continuous line. (Making it for a pen plotter, at the top, also offers separate strokes and as drawn.)"
    : st.art.kind === "model"
      ? "A 3D model is sliced on the Print step. For the plotter, draw a view of it on the Art step: that becomes a picture to trace."
      : mode === "drawn"
        ? `The ${kind}'s own lines go to the page, nothing traced.`
        : mode === "strokes"
          ? `The ${kind} traced into strokes; the pen lifts between them.` +
            ($("lineDrawn").checked && !asDrawnOK() ? " (As drawn needs a pattern or text.)" : "")
          : `The ${kind} traced into one continuous line: the pen never lifts.`;
  // what the page plots follows the line (the 2D card's own switch is hidden)
  const art = mode !== "one";
  if ($("plotArt").checked !== art) {
    $(art ? "plotArt" : "plotTraced").checked = true;
    plotFromUI(); // plot.js
  }
  if (mode === "drawn") {
    setChip(`${st.art.kind === "text" ? "The text" : patternName(st.art.pattern)} as drawn: exact lines, no trace`);
    $("fitinfo").textContent = "as drawn";
  }
  // on Art and Line the preview shows what the line will be: the page for as drawn, else the line
  const v = document.body.dataset.view;
  if ((v === "art" || v === "design") && stageFor(v) !== stageNow()) setStage(stageFor(v));
}
// the step's view, after a change of output or line
function followStep() {
  viewChanged(); // views.js: sets the stage from stageFor
}

// The line suits the output and the input until you pick one (st.lineChosen): on a plotter a pattern or text starts
// as drawn and a picture as separate strokes; a printer takes one line. Called before the art is applied (art.js).
st.lineChosen = false;
function lineDefault() {
  if (!artForPlot()) $("lineOne").checked = true;
  else if (!st.lineChosen) $(asDrawnOK() ? "lineDrawn" : "lineStrokes").checked = true;
}
document.querySelectorAll('input[name="artFor"]').forEach((r) =>
  r.addEventListener("change", () => {
    st.lineChosen = false; // a new output: its own starting line
    lineDefault();
    lineModeChanged();
  })
);
document.querySelectorAll('input[name="lineMode"]').forEach((r) =>
  r.addEventListener("change", () => {
    st.lineChosen = true;
    lineModeChanged();
  })
);
function lineModeChanged() {
  workflowUI();
  artApply(); // art.js: a pattern as drawn isn't traced; otherwise it (or the picture) is
  schedule(extract);
  followStep();
  recordSoon();
}
$("goOut").addEventListener("click", () => {
  $(artForPlot() ? "view2D" : "viewChoc").checked = true;
  viewChanged();
});
// a new step starts at the top of the page (its first card and the preview)
for (const id of ["goTrace", "goOut", "toArt"]) $(id).addEventListener("click", () => window.scrollTo({ top: 0 }));

// ---------- Separate strokes: traced into strokes (pipeline.js extract hands over to this) ----------
// traced at the page's size: the base resolution per 100 mm of the page's long side (inside the margins)
function strokesRes() {
  const P = paperSize(),
    mg = Math.max(0, +$("paperMargin").value || 0),
    long = Math.max(P.w, P.h) - 2 * mg,
    src = st.source,
    r = Math.min(CFG.engine.maxWorkingResolution, Math.round((long * baseRes()) / 100));
  return src ? Math.min(r, Math.max(baseRes(), src.width, src.height)) : r;
}
st.sepStrokes = null; // { strokes, closed, travel, length, w, h }
async function traceStrokes(g) {
  const s = settings(),
    W = await working(strokesRes());
  guard(g);
  const r = await PIPE.call("stageStrokes", [lineSpec(W, s.sens), W.w, W.h, { minLen: s.minLen }]);
  guard(g);
  Object.assign(st, {
    w: W.w,
    h: W.h,
    crop: W.crop,
    small: W.small,
    gray: W.gray,
    walk: null,
    final: null,
    plot: null,
    pfill: null,
    sepStrokes: { ...r, w: W.w, h: W.h },
    finalVer: (st.finalVer || 0) + 1,
  });
  let b = null;
  for (const s2 of r.strokes)
    for (let i = 0; i < s2.length; i += 2) {
      b = b || [Infinity, Infinity, -Infinity, -Infinity];
      b[0] = Math.min(b[0], s2[i]);
      b[1] = Math.min(b[1], s2[i + 1]);
      b[2] = Math.max(b[2], s2[i]);
      b[3] = Math.max(b[3], s2[i + 1]);
    }
  Object.assign(st, { bw: b ? Math.max(1, b[2] - b[0]) : 1, bh: b ? Math.max(1, b[3] - b[1]) : 1 });
  const n = r.strokes.length;
  setChip(
    n
      ? `${n} stroke${n === 1 ? "" : "s"} · ${n - 1} pen lift${n === 2 ? "" : "s"}`
      : "No lines found — lower the threshold or the speck filter"
  );
  $("fitinfo").textContent = n ? `${n} stroke${n === 1 ? "" : "s"}` : "";
  render();
  drawMini();
  drawPage();
  labels();
}
workflowUI();
