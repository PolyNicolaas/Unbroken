// Unbroken · web app · ties.js
// The Ties card (Layers, a printer): more connectors for a large print. The trace holds a drawing's separate parts
// (letters, rows, an arch over them) together with as few connectors as it can; ties add short struts of two strands
// across the open gaps between them, the full height of the walls, spliced into the walls' line (the engine's
// UNB.ties, in the layers engine). The trace itself, the Line step's drawing and a base are left as they are.
// The card draws the ties on the line: tap one to take it away, a faded one to bring it back, a gap to add one.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// ties apply to a printer's walls, for the design as a whole (not a 3D model's slices, a vase, or a text's pieces,
// each traced on its own)
const tiesWanted = () => $("ties").checked && !artForPlot() && !isModel();

// the taps, kept with the design (#tieEdits): places taken away and added (px, the trace's frame), and the line they
// were made on (a change to the line itself leaves them behind)
function lineSig(f) {
  if (!f || !f.re) return "";
  let a = 0,
    b = 0;
  for (let i = 0; i < f.re.length; i++) (a += f.re[i]), (b += f.im[i]);
  return `${f.re.length}:${Math.round(a)}:${Math.round(b)}`;
}
function tieEdits() {
  try {
    const e = JSON.parse($("tieEdits").value || "null");
    if (e && Array.isArray(e.out) && Array.isArray(e.add)) return e;
  } catch (err) {}
  return { sig: "", out: [], add: [] };
}
// the taps that belong to the line now
function tieEditsNow() {
  const e = tieEdits();
  return e.sig && e.sig === lineSig(st.final) ? e : { sig: lineSig(st.final), out: [], add: [] };
}
function setTieEdits(e) {
  $("tieEdits").value = e.out.length || e.add.length ? JSON.stringify(e) : "";
  $("tieEdits").dispatchEvent(new Event("change", { bubbles: true })); // (recorded for Undo: history.js)
  tieEditUI();
  $("tiesVal").textContent = "working…";
  layersSoon(0);
}

const tieSettings = () => {
  const e = tieEditsNow();
  return {
    maxMM: +$("tieMax").value,
    everyMM: +$("tieEvery").value,
    withinParts: $("tieInside").checked,
    stand: $("tieStand").checked,
    leaveOut: e.out,
    addAt: e.add,
  };
};

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
      stand: T.stand,
      leaveOut: T.leaveOut,
      addAt: T.addAt,
      spacingMM: st.spacing > 0 ? st.spacing : 1.6 * lineWidthMM(),
      lineMM: lineWidthMM(),
    },
  ]);
  return {
    final: { re: res.re, im: res.im },
    ties: res.ties,
    tapped: res.tapped,
    skipped: res.skipped,
    missed: res.missed,
    count: res.count,
    addedMM: res.addedMM,
  };
}
on("wallLine", tieLine);
on("layersKey", () => (tiesWanted() ? ["ties", tieSettings()] : null));

// ---------- the drawing on the card: the line, its ties, and taps ----------
let tieView = null; // { s, ox, oy }: trace px → the canvas's CSS px
function tieDraw() {
  const cv = $("tieEdit"),
    f = st.final,
    t = st.layers && st.layers.wallChange;
  if ($("tieEditBox").hidden || !cv.clientWidth || !f || !f.re || !f.re.length) return;
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (let i = 0; i < f.re.length; i++) {
    x0 = Math.min(x0, f.re[i]);
    x1 = Math.max(x1, f.re[i]);
    y0 = Math.min(y0, f.im[i]);
    y1 = Math.max(y1, f.im[i]);
  }
  const v = insetCanvas(cv, x1 - x0, y1 - y0, 560); // ui.js
  if (!v) return;
  const { g, s } = v,
    ox = v.ox - x0 * s,
    oy = v.oy - y0 * s;
  tieView = { s, ox, oy };
  const P = (x, y) => [ox + x * s, oy + y * s];
  // the line as traced (the trace's own connectors in it)
  g.strokeStyle = css("--muted");
  g.lineWidth = 1;
  g.beginPath();
  for (let i = 0; i < f.re.length; i++) g[i ? "lineTo" : "moveTo"](...P(f.re[i], f.im[i]));
  if (!st.open) g.closePath();
  g.stroke();
  if (!t || !t.ties) return;
  const tie = (q, color, width, dash) => {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.setLineDash(dash);
    g.beginPath();
    g.moveTo(...P(q[0], q[1]));
    g.lineTo(...P(q[2], q[3]));
    g.stroke();
    g.setLineDash([]);
  };
  g.lineCap = "round";
  for (const k of t.skipped || []) tie(k.t, k.why === "taken away" ? css("--warn") : css("--muted"), 2.5, [3, 3]);
  t.ties.forEach((q, i) => tie(q, t.tapped && t.tapped[i] ? css("--good") : css("--accent"), 4, []));
}
// a tap: the nearest tie or left-out tie within reach, or the gap there
function tieTap(e) {
  const t = st.layers && st.layers.wallChange;
  if (!tieView || !t || !t.ties) return;
  const r = $("tieEdit").getBoundingClientRect(),
    { s, ox, oy } = tieView,
    x = (e.clientX - r.left - ox) / s,
    y = (e.clientY - r.top - oy) / s,
    reach = 14 / s; // 14 screen px, in trace px
  const dist = (q) => {
    const dx = q[2] - q[0],
      dy = q[3] - q[1],
      L2 = dx * dx + dy * dy || 1,
      u = Math.max(0, Math.min(1, ((x - q[0]) * dx + (y - q[1]) * dy) / L2));
    return Math.hypot(q[0] + u * dx - x, q[1] + u * dy - y);
  };
  const mid = (q) => [(q[0] + q[2]) / 2, (q[1] + q[3]) / 2];
  let best = null;
  t.ties.forEach((q, i) => {
    const d = dist(q);
    if (d < reach && (!best || d < best.d)) best = { d, kind: "tie", q, tapped: t.tapped && t.tapped[i] };
  });
  for (const k of t.skipped || []) {
    const d = dist(k.t);
    if (d < reach && (!best || d < best.d)) best = { d, kind: k.why, q: k.t };
  }
  const E = tieEditsNow(),
    mm4 = 4 / (st.outW / st.bw); // 4 mm in trace px
  // the tap in a list nearest a place, within reach
  const nearest = (list, m, r_) => {
    let j = -1,
      dj = r_;
    list.forEach((p, i) => {
      const d = Math.hypot(p[0] - m[0], p[1] - m[1]);
      if (d < dj) (dj = d), (j = i);
    });
    return j;
  };
  if (!best) E.add.push([x, y]); // a gap: add a tie there
  else if (best.kind === "tie") {
    // a tie a tap added: forget that tap; one the rules put there: take it away
    const a = best.tapped ? nearest(E.add, mid(best.q), mm4 + reach) : -1;
    if (a >= 0) E.add.splice(a, 1);
    else E.out.push(mid(best.q));
  } else if (best.kind === "taken away") {
    const j = nearest(E.out, mid(best.q), Infinity); // bring it back: forget the tap that took it away
    if (j >= 0) E.out.splice(j, 1);
  } else E.add.push(mid(best.q)); // one left out inside a letter: add it
  setTieEdits(E);
}
$("tieEdit").addEventListener("click", tieTap);
$("tieReset").addEventListener("click", () => setTieEdits({ sig: lineSig(st.final), out: [], add: [] }));

// ---------- the card's readouts ----------
function tieEditUI() {
  const e = tieEdits(),
    mine = e.sig && e.sig === lineSig(st.final),
    n = mine ? e.out.length + e.add.length : 0,
    t = st.layers && st.layers.wallChange;
  $("tieReset").disabled = !n;
  let txt = "Tap a tie to take it away, a faded one to bring it back, or a gap to add one.";
  if (n)
    txt =
      [e.out.length && `${e.out.length} taken away`, e.add.length && `${e.add.length} added or brought back`]
        .filter(Boolean)
        .join(", ") + ". Tap again to change, or Reset ties.";
  if (n && t && t.missed) txt += ` No tie fits at ${t.missed} of your taps: it would cross the line or another tie.`;
  if (!mine && (e.out.length || e.add.length))
    txt = "Your changes to the ties were made on the line before this one, so they're set aside. Tap to change these.";
  $("tieEditInfo").textContent = txt;
}
function tiesUI() {
  const on_ = $("ties").checked;
  $("tieMaxVal").textContent = `${fmt(+$("tieMax").value, 1)} mm`;
  $("tieEveryVal").textContent = `${fmt(+$("tieEvery").value, 0)} mm`;
  $("tieMaxRow").hidden = $("tieEveryRow").hidden = $("tieInsideRow").hidden = $("tieStandRow").hidden = !on_;
  $("tieEditBox").hidden = !on_ || !tiesWanted();
  if (!on_) $("tiesVal").textContent = "off";
  tieEditUI();
  tieDraw();
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
  tieEditUI();
  tieDraw();
}
on("layersReady", tiesReadout);
for (const id of ["ties", "tieInside", "tieStand", "tieMax", "tieEvery"]) {
  const box = $(id).type === "checkbox";
  $(id).addEventListener(box ? "change" : "input", () => {
    tiesUI();
    if ($("ties").checked) tiesWanted() ? ($("tiesVal").textContent = "working…") : tiesReadout();
    layersSoon(box ? 0 : 250);
  });
}
// (saved with a design; a change is recorded for Undo: history.js)
addSaved("ties", "tieInside", "tieStand", "tieMax", "tieEvery", "tieEdits");
on("designUI", tiesUI); // a design restored
// the drawing sizes itself to the card: drawn again when the Ties panel opens or the window changes
if (window.ResizeObserver) new ResizeObserver(() => tieDraw()).observe($("tieEdit"));
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
