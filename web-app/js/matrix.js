// Unbroken · web app · matrix.js
// Test matrix (Print step): nine copies of the design on one plate, each printed with its own speed, flow and layer
// height, as a Taguchi L9 (UNB.L9: three levels of each setting in nine prints). A comb of 1–9 teeth in front of each
// copy is its number. The copies are scored after printing, and the mean score at each level (UNB.mainEffects) picks
// the best level of each setting, which Use the best levels puts into Fine-tuning.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

const MX_COMB = { tooth: 3, pitch: 2.5, room: 5 }; // the number comb: teeth 3 mm tall, 2.5 mm apart, in a 5 mm band
const mxIds = (k) => [1, 2, 3].map((j) => `mx${k}${j}`);

// ---------- the levels ----------
function mxLevels() {
  const read = (k, lo, hi) =>
    mxIds(k)
      .map((id) => +$(id).value)
      .map((v) => (v >= lo && v <= hi ? v : NaN));
  return { speed: read("S", 0.5, 200), flow: read("F", 50, 200), h: read("H", 0.05, 3) };
}
const mxLevelsOK = (L) => [...L.speed, ...L.flow, ...L.h].every(Number.isFinite);
// low, mid and high round the Fine-tuning settings
function mxAround() {
  const s = feedMMs(),
    f = flowPct(),
    h = layerHmm(); // export.js
  const set = (k, vals) => mxIds(k).forEach((id, j) => ($(id).value = vals[j]));
  set("S", [+(s * 0.75).toFixed(1), +s.toFixed(1), +(s * 1.25).toFixed(1)]);
  set("F", [Math.max(50, Math.round(f - 10)), Math.round(f), Math.min(200, Math.round(f + 10))]);
  set("H", [+Math.max(0.1, h - 0.05).toFixed(2), +h.toFixed(2), +(h + 0.05).toFixed(2)]);
}
// the nine runs: their levels and settings
function mxRunList() {
  const L = mxLevels();
  return UNB.L9.map((r, i) => ({ n: i + 1, lv: r, speed: L.speed[r[0]], flow: L.flow[r[1]], h: L.h[r[2]] }));
}
// a copy's first layer: one of its own layer heights up, unless First layer Z is set apart from the layer height
const mxFollowsZ = () => Math.abs(+$("gZ").value - layerHmm()) < 1e-6;
const mxZ0 = (h) => (mxFollowsZ() ? h : firstZ());

// ---------- the scores ----------
function mxScores() {
  let s = [];
  try {
    s = JSON.parse($("mxScores").value || "[]");
  } catch {}
  return Array.from({ length: 9 }, (_, i) => (s[i] >= 1 && s[i] <= 5 ? +s[i] : null));
}
function mxTable() {
  const runs = mxRunList(),
    sc = mxScores(),
    fx = UNB.mainEffects(UNB.L9, sc),
    best = (r) => fx.scored >= 3 && fx.settings.every((q, k) => q.best === r.lv[k]);
  const head =
    "<thead><tr><th>Copy</th><th>Speed</th><th>Flow</th><th>Layer</th><th>Score (1–5)</th></tr></thead><tbody>";
  $("mxRuns").innerHTML =
    head +
    runs
      .map(
        (r, i) =>
          `<tr${best(r) ? ' class="mx-best"' : ""}><td>${r.n}</td><td>${fmt(r.speed, 1)} mm/s</td><td>${fmt(r.flow, 0)}%</td>` +
          `<td>${fmt(r.h, 2)} mm</td><td><input type="number" min="1" max="5" step="1" data-stepper="off" data-mx="${i}" value="${sc[i] ?? ""}" aria-label="Copy ${r.n}'s score, 1 to 5"></td></tr>`
      )
      .join("") +
    "</tbody>";
  mxBestUI(fx);
}
function mxBestUI(fx = UNB.mainEffects(UNB.L9, mxScores())) {
  const L = mxLevels(),
    names = [
      ["Speed", L.speed, (v) => `${fmt(v, 1)} mm/s`],
      ["Flow", L.flow, (v) => `${fmt(v, 0)}%`],
      ["Layer height", L.h, (v) => `${fmt(v, 2)} mm`],
    ];
  if (!fx.scored) {
    $("mxBest").textContent = "After printing, score each copy: the best level of each setting shows here.";
    $("mxUse").disabled = true;
    return;
  }
  $("mxBest").textContent =
    names
      .map(([name, vals, f], k) => {
        const q = fx.settings[k],
          means = q.mean.map((m, j) => `${f(vals[j])} ${m == null ? "–" : fmt(m, 1)}`).join(" · ");
        return `${name}: ${means}${q.best >= 0 ? ` → ${f(vals[q.best])}` : ""}`;
      })
      .join(". ") +
    `. (${fx.scored} of 9 scored: the mean score at each level${fx.scored < 9 ? "; score all nine for a fair comparison" : ""}.)`;
  $("mxUse").disabled = fx.scored < 3 || fx.settings.some((q) => q.best < 0);
}
$("mxRuns").addEventListener("input", (e) => {
  const i = e.target.dataset && e.target.dataset.mx;
  if (i == null) return;
  const sc = mxScores(),
    v = Math.round(+e.target.value);
  sc[+i] = e.target.value !== "" && v >= 1 && v <= 5 ? v : null;
  $("mxScores").value = JSON.stringify(sc);
  mxBestUI();
  recordSoon();
});
$("mxRuns").addEventListener("change", mxTable); // (the best row marked once a score is in)
$("mxUse").addEventListener("click", () => {
  const fx = UNB.mainEffects(UNB.L9, mxScores()),
    L = mxLevels();
  if (fx.settings.some((q) => q.best < 0)) return;
  const [s, f, h] = [L.speed[fx.settings[0].best], L.flow[fx.settings[1].best], L.h[fx.settings[2].best]];
  const put = (id, v) => {
    $(id).value = v;
    $(id).dispatchEvent(new Event("input", { bubbles: true }));
  };
  put("layerH", h); // (First layer Z follows it, when it was following)
  put("gFeed", s);
  put("gFlow", f);
  recordSoon();
  setStatus(
    $("mxMsg"),
    "ok",
    `Fine-tuning is now ${fmt(s, 1)} mm/s, ${fmt(f, 0)}% flow, ${fmt(h, 2)} mm layers: the best level of each.`
  );
});

// ---------- the print ----------
// The nine copies on the plate, 3 × 3 from the front left, each with its comb in front, as paths for UNB.exportGcode:
// each copy's own feed (mm/min), flow (its e, against the export's E per mm) and layer height (sliced at it). Returns
// { paths, runs, w, h, seconds, ml } or throws with what's in the way.
async function mxPlan() {
  if (piecesOn()) throw new Error("this text prints a piece per line: set Lines of text to One piece first");
  const L = mxLevels();
  if (!mxLevelsOK(L)) throw new Error("every level needs a value (speed 0.5–200 mm/s, flow 50–200%, layers 0.05–3 mm)");
  const lay = plateNow();
  if (!lay || (!isModel() && !st.final)) throw new Error("nothing is on the plate yet");
  const gap = Math.max(4, +$("copyGap").value || 0),
    combW = 9 * MX_COMB.pitch,
    cw = Math.max(lay.w, combW) + gap,
    ch = lay.h + MX_COMB.room + gap,
    W = 3 * cw - gap,
    H = 3 * ch - gap;
  if (W > BED.w || H > BED.h)
    throw new Error(
      `nine copies need ${fmt(W, 0)} × ${fmt(H, 0)} mm, more than the ${BED.w} × ${BED.h} mm plate: make the design smaller`
    );
  const ox = (BED.w - W) / 2,
    oy = (BED.h - H) / 2,
    g = gcodeSettings(),
    hNow = layerHmm(),
    fNow = flowPct(),
    minFeed = (CFG.printer.minPrintSpeed || 5) * 60,
    slow = $("mxSlow").checked ? layerTimeS() : 0;
  // each layer height sliced once
  const stacks = new Map();
  for (const h of new Set(L.h)) {
    // model.js, layers.js
    const Ld = isModel() ? await buildModelLayers({ h, z0: mxZ0(h) }) : await designLayers(st, lay.xf, h);
    if (!Ld) throw new Error("the layers aren't ready yet");
    stacks.set(h, Ld.stack);
  }
  const runs = mxRunList(),
    paths = [];
  let seconds = 0,
    mm3 = 0;
  runs.forEach((r, i) => {
    const S = stacks.get(r.h),
      x0 = ox + (i % 3) * cw,
      y0 = oy + Math.floor(i / 3) * ch,
      pos = { x: x0, y: y0 + MX_COMB.room },
      dz = mxZ0(r.h) - g.z, // (the export adds the Print step's first-layer Z to every path)
      eK = (r.h / hNow) * (r.flow / fNow), // the export's E per mm is for the Print step's layer height and flow
      feed = r.speed * 60;
    const c = UNB.testComb(x0, y0, r.n, MX_COMB.tooth, MX_COMB.pitch),
      F = UNB.lapFeeds(S, feed, slow, Math.min(feed, minFeed));
    paths.push({
      x: Float64Array.from(c.x),
      y: Float64Array.from(c.y),
      z: new Float64Array(c.x.length).fill(dz),
      e: new Float64Array(c.x.length).fill(eK),
      f: new Float64Array(c.x.length).fill(feed),
    });
    paths.push({
      x: Float64Array.from(S.x, (v) => v + pos.x),
      y: Float64Array.from(S.y, (v) => v + pos.y),
      z: Float64Array.from(S.z, (v) => v + dz),
      e: Float64Array.from(S.e, (v) => v * eK),
      f: F.f,
      laps: S.laps,
    });
    seconds += F.seconds;
    let len = 0;
    for (let k = 1; k < S.x.length; k++) len += Math.hypot(S.x[k] - S.x[k - 1], S.y[k] - S.y[k - 1]);
    mm3 += len * lineWidthMM() * r.h * (r.flow / 100);
  });
  return { paths, runs, w: W, h: H, seconds, ml: mm3 / 1000, g };
}
let mxTok = 0;
async function mxInfoUI() {
  const my = ++mxTok,
    L = mxLevels();
  $("mxVal").textContent = mxLevelsOK(L) ? "9 copies" : "";
  // (only while the card is open on the Print step: slicing three layer heights isn't free)
  const card = $("h-matrix").closest("section");
  if (!layersWanted() || card.classList.contains("collapsed") || !card.offsetParent) return;
  try {
    const p = await mxPlan();
    if (my !== mxTok) return;
    const cart = CFG.printer.cartridgeVolume || 50;
    $("mxInfo").className = "hint";
    $("mxInfo").textContent =
      `${fmt(p.w, 0)} × ${fmt(p.h, 0)} mm on the plate · about ${Math.round(p.seconds / 60)} min of printing · ` +
      `${fmt(p.ml, 1)} ml of chocolate` +
      (p.ml > cart ? `: more than one ${cart} ml cartridge, so make the design smaller` : "") +
      ". Copies print 1 to 9, the front row first.";
    $("mxBtn").disabled = p.ml > cart;
  } catch (e) {
    if (my !== mxTok || e === CANCELLED) return;
    $("mxInfo").className = "hint warn";
    $("mxInfo").textContent = `Can't make the matrix: ${(e && e.message) || e}.`;
    $("mxBtn").disabled = true;
  }
}
let mxTimer = null;
const mxSoon = () => {
  clearTimeout(mxTimer);
  mxTimer = setTimeout(mxInfoUI, 400);
};
$("mxBtn").addEventListener("click", async () => {
  const msg = $("mxMsg");
  setStatus(msg, "", "Making the file…");
  try {
    const p = await mxPlan(),
      head =
        `; Unbroken test matrix (Taguchi L9): nine copies, numbered by the comb in front of each\n` +
        p.runs
          .map((r) => `; copy ${r.n}: ${fmt(r.speed, 1)} mm/s, flow ${fmt(r.flow, 0)}%, layers ${fmt(r.h, 2)} mm\n`)
          .join("");
    const name = `matrix-l9_${designSlug(30)}_${needleTag()}`; // export.js
    await saveFile(`${name}-gcode.zip`, UNB.zip(`${name}.gcode`, head + UNB.exportGcode(p.paths, p.g)));
    setStatus(
      msg,
      "ok",
      `Exported ${name}-gcode.zip · 9 copies, ${fmt(p.w, 0)} × ${fmt(p.h, 0)} mm, about ${Math.round(p.seconds / 60)} min, for the ${CFG.printer.name}`
    );
  } catch (e) {
    setStatus(msg, "bad", e && e.message ? `Couldn't make the matrix: ${e.message}.` : saveError(e, "Export") + ".");
  }
});
$("mxAround").addEventListener("click", () => {
  mxAround();
  mxTable();
  mxSoon();
  recordSoon();
});
for (const k of ["S", "F", "H"])
  for (const id of mxIds(k))
    $(id).addEventListener("input", () => {
      mxTable();
      mxSoon();
    });
$("mxSlow").addEventListener("change", mxSoon);
$("h-matrix")
  .closest("section")
  .addEventListener("click", (e) => {
    if (e.target.closest(".card-toggle")) mxSoon(); // (opened: its size, time and chocolate)
  });
onPrintSettings(mxSoon); // the printer, chocolate, needle, layer height
for (const id of ["gFeed", "gFlow", "gZ", "copyGap"]) $(id).addEventListener("input", mxSoon);
// (a design opened or undone: its levels and scores, or round the settings when it has none)
function mxUI() {
  if (!mxLevelsOK(mxLevels())) mxAround();
  mxTable();
  mxSoon();
}
mxUI();
