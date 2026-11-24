// Unbroken · web app · ties.js
// The Ties card (Layers, a printer): more connectors for a large print. The trace holds a drawing's separate parts
// (letters, rows, an arch over them) together with as few connectors as it can; ties add short struts of two strands
// across the open gaps between them, the full height of the walls, spliced into the walls' line (the engine's
// UNB.ties, in the layers engine). The trace itself, the Line step's drawing and a base are left as they are.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// ties apply to a printer's walls, for the design as a whole (not a 3D model's slices, a vase, or a text's pieces,
// each traced on its own)
const tiesWanted = () => $("ties").checked && !artForPlot() && !isModel();
const tieSettings = () => ({ maxMM: +$("tieMax").value, everyMM: +$("tieEvery").value, withinParts: $("tieInside").checked });

// the picture's ink in the trace's own frame (the working image the line was traced from): a text's strokes, or a
// picture's dark (its smoothed grey under the middle)
function tieInk(W) {
  const n = W.w * W.h,
    ink = new Uint8Array(n);
  if (st.text) {
    const L = lineSpec(W, 0).lines;
    for (let i = 0; i < n; i++) ink[i] = L[i] ? 1 : 0;
  } else for (let i = 0; i < n; i++) ink[i] = W.blurred[i] < 128 ? 1 : 0;
  return ink;
}
// the walls' line with ties, or null (off, or a piece)
async function tieLine(r, D) {
  if (!tiesWanted() || D !== st || !r || !r.final) return null;
  const W = await working(),
    k = st.outW / st.bw,
    T = tieSettings();
  const res = await LAY.call("ties", [
    r.final.re,
    r.final.im,
    {
      ink: tieInk(W),
      w: W.w,
      h: W.h,
      mmPerPx: k,
      closed: !st.open,
      maxMM: T.maxMM,
      everyMM: T.everyMM,
      withinParts: T.withinParts,
      spacingMM: st.spacing > 0 ? st.spacing : 1.6 * lineWidthMM(),
      lineMM: lineWidthMM(),
    },
  ]);
  return { final: { re: res.re, im: res.im }, ties: res.ties, count: res.count, addedMM: res.addedMM };
}
on("wallLine", tieLine);
on("layersKey", () => (tiesWanted() ? ["ties", tieSettings()] : null));

// the card's readouts
function tiesUI() {
  const on_ = $("ties").checked;
  $("tieMaxVal").textContent = `${fmt(+$("tieMax").value, 1)} mm`;
  $("tieEveryVal").textContent = `${fmt(+$("tieEvery").value, 0)} mm`;
  $("tieMaxRow").hidden = $("tieEveryRow").hidden = $("tieInsideRow").hidden = !on_;
  if (!on_) $("tiesVal").textContent = "off";
}
function tiesReadout() {
  if (!$("ties").checked) return tiesUI();
  const t = st.layers && st.layers.wallChange;
  $("tiesVal").textContent = !tiesWanted()
    ? "not for this print"
    : !t
      ? "on"
      : t.count
        ? `${t.count} tie${t.count === 1 ? "" : "s"} · +${fmt(t.addedMM / 1000, 2)} m a layer`
        : "none: no gap short enough";
}
on("layersReady", tiesReadout);
for (const id of ["ties", "tieInside", "tieMax", "tieEvery"])
  $(id).addEventListener(id === "ties" || id === "tieInside" ? "change" : "input", () => {
    tiesUI();
    if ($("ties").checked) tiesWanted() ? ($("tiesVal").textContent = "working…") : tiesReadout();
    layersSoon(id === "ties" || id === "tieInside" ? 0 : 250);
  });
addSaved("ties", "tieInside", "tieMax", "tieEvery"); // (saved with a design; a change is recorded for Undo: history.js)
on("designUI", tiesUI); // a design restored
tiesUI();

// the map: a Ties chip under the Print step (quiet while off), its icon two parts held by two struts (map.js loads
// after the features: the icon is added when the map is first drawn)
addMapNode("ties", {
  cap: "Ties",
  step: "choc",
  cards: ["h-ties"],
  quiet: () => !$("ties").checked,
});
MAP_SHAPERS.push((S) => {
  MAP_ICONS.ties ||= "M3 5h6v14H3z M15 5h6v14h-6z M9 9h6 M9 15h6";
  if (!artForPlot() && !isModel()) S.down.print = [...(S.down.print || []), "ties"];
});
