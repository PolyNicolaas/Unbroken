// Unbroken · web app · readouts.js
// Readouts: the corner label, error and gap numbers, and the formula panel.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// ---------- readouts + math ----------
function readouts() {
  const e = st.err;
  const mm = scale(); // the engine measures in working pixels; everything shown is mm
  $("rScore").textContent = fmt(e.score * mm);
  $("rStray").textContent = fmt(e.stray * mm);
  $("rMiss").textContent = fmt(e.missing * mm);
  const j = st.connRuns || 0; // jumps between separate parts: always drawn, the flow can't stop
  setChip(`${st.N} terms · error ${fmt(e.score * mm)} mm` + (j ? ` · ${j} connector${j === 1 ? "" : "s"}` : ""));
  $("chip").title = j
    ? `${j} connector${j === 1 ? "" : "s"} between separate parts. Always drawn: the printer can't stop the flow.`
    : "";
  const sc = scale(),
    d = st.spacing;
  const gapU = st.gap * sc;
  let gtxt;
  if (!Number.isFinite(st.gap)) gtxt = `closest gap > ${fmt(st.gapProbe * sc, 2)} mm`;
  else gtxt = `closest gap ${fmt(gapU, 2)} mm`;
  $("gapVal").textContent = gtxt;
  const hint = $("spacingHint");
  if (d > 0 && Number.isFinite(st.gap) && gapU < d * 0.8) {
    hint.className = "hint warn";
    hint.textContent =
      st.gap < 0.05
        ? "The line still crosses itself in places. Add terms, or use Centerline: outlines of thin strokes sit closer than this spacing."
        : "Some lines sit closer than the target. Add terms, or use Centerline for thin strokes.";
  } else {
    hint.className = "hint";
    hint.textContent = spacingText();
  }
  drawChart();
}

function mrow(v, d = 2) {
  return `<mn>${Math.abs(v).toFixed(d)}</mn>`;
}
function renderMath() {
  const E = st.epi,
    sc = scale(),
    u = "mm",
    ax = st.fit.ax,
    b = st.fb;
  const off = (a) => {
    const t = st.codes.map((c) => UNB.termOf(c, ax)).find((m) => m.axis === a && m.k === 0);
    return ((t ? t.amp * Math.cos(t.phase) : 0) - (a === "x" ? b.x0 : b.y0)) * sc;
  }; // mm from the drawing's top-left
  const line = (v, list, a, ph) => {
    let m = `<mrow><mi>${v}</mi><mo stretchy="false">(</mo><mi>t</mi><mo stretchy="false">)</mo><mo>=</mo>${mrow(off(v), 2)}`;
    for (const e of list.slice(0, 3))
      m += `<mo>+</mo>${mrow(e.amp * sc, 2)}<mo>cos</mo><mo stretchy="false">(</mo><mn>2</mn><mi>π</mi><mo>·</mo><mn>${e.k}</mn><mi>t</mi><mo>${e.phase < 0 ? "−" : "+"}</mo>${mrow(e.phase, 2)}<mo stretchy="false">)</mo>`;
    return m + (list.length > 3 ? `<mo>+</mo><mi>⋯</mi>` : "") + `</mrow>`;
  };
  const m = `<math display="block"><mtable columnalign="left"><mtr><mtd>${line("x", E.xs)}</mtd></mtr><mtr><mtd>${line("y", E.ys)}</mtd></mtr><mtr><mtd><mrow><mi>z</mi><mo stretchy="false">(</mo><mi>t</mi><mo stretchy="false">)</mo><mo>=</mo><mn>0</mn></mrow></mtd></mtr></mtable></math>`;
  $("series").innerHTML =
    `${m}<div>${st.N} terms in total: ${E.xs.length} for x, ${E.ys.length} for y, plus the two offsets. In mm at your output size, from the drawing's top-left corner (y down).</div>`;
  const both = E.xs
    .map((e) => ["x", e])
    .concat(E.ys.map((e) => ["y", e]))
    .sort((a, b) => b[1].amp - a[1].amp);
  let rows = `<thead><tr><th>#</th><th>axis</th><th>k (turns)</th><th>radius mm</th><th>phase rad</th></tr></thead><tbody>`;
  both.slice(0, 12).forEach(([a, e], i) => {
    rows += `<tr><td>${i + 1}</td><td>${a}</td><td>${e.k}</td><td>${fmt(e.amp * sc, 3)}</td><td>${fmt(e.phase, 3)}</td></tr>`;
  });
  $("terms-table").innerHTML = rows + "</tbody>";
  const e = st.err;
  $("mathSummary").textContent = `${st.N} terms · error ${fmt(e.score * sc, 2)} mm`;
  $("errline").innerHTML =
    `error = ½ (stray + missing) = ½ (${fmt(e.stray * sc, 3)} + ${fmt(e.missing * sc, 3)}) = <b>${fmt(e.score * sc, 3)} mm</b>`;
  $("errnote").textContent =
    (st.open
      ? "Open path: the series walks the path out and back so it stays periodic, and the drawing uses only the outbound half (0 ≤ t ≤ ½). "
      : "") +
    "Stray is the average distance from the drawn line to the traced line. Missing is the average distance from the traced line to the drawn line. The traced line runs along the middle of the ink (or the edge), below a pixel." +
    (st.spacing > 0
      ? " The spacing adjustment moves the line after the series, so the exported path differs slightly from the formula above."
      : "") +
    (+$("uncross").value > 0
      ? " Untangling reverses short stretches after the series to remove crossings; the shape is unchanged but the drawing order differs from the formula (the animation shows the pure series)."
      : "");
}

function setChip(t, model) {
  if (!model && isModel()) return;
  if (document.body.dataset.empty === "1") t = "Nothing yet: start on the Art step"; // (examples.js)
  $("chip").textContent = t;
} // a model's readout is model.js's
