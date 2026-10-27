// Unbroken · web app · optimize.js
// Starting-point presets and Optimize tracing.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// ---------- starting points: tracing settings per kind of design (settings.js presets) ----------
// Not on the page (the sliders are): used for settings.js's startFrom and by Draw this view (model.js). Each only
// changes tracing settings; size, needle/spacing, painted areas and the loaded image stay as they are.
const PRESETS = Object.fromEntries(
  Object.entries(CFG.presets).map(([k, p]) => [
    k,
    {
      label: p.label,
      mode: MAP.traceStyle[p.traceStyle],
      blur: Math.round(p.smoothing * 10),
      minLen: p.ignoreSpecks,
      far: p.dropFarParts,
      loose: MAP.looseEnds[p.looseEnds],
      prep: {
        bright: p.imagePrep.brightness,
        contrast: p.imagePrep.contrast,
        bgTol: p.imagePrep.backgroundTolerance,
        flatten: !!p.imagePrep.evenOutLighting,
      },
    },
  ])
);
// quiet: only set the controls (the caller starts the trace)
function applyPreset(key, quiet) {
  if (key === "lettering") {
    const t = (CFG.raw && CFG.raw.defaults) || {}; // lettering starts from the text defaults in settings.js
    $("font").value = UNB_FONTS[t.font] ? t.font : "sans";
    $("txtSpacing").value = MAP.letterSpacing[t.letterSpacing] || "auto";
    $({ left: "alLeft", right: "alRight" }[t.align] || "alCenter").checked = true;
    if (!textMode())
      artUse("text"); // art.js: the text in use
    else textChanged();
    return;
  }
  const p = PRESETS[key];
  (p.mode === "edges" ? $("modeOutline") : $("modeCenter")).checked = true;
  $("blur").value = p.blur;
  $("minLen").value = p.minLen;
  $("far").value = p.far;
  $("loose").value = p.loose;
  $("bright").value = p.prep.bright;
  $("contrast").value = p.prep.contrast;
  $("bgTol").value = p.prep.bgTol;
  $("flatten").checked = p.prep.flatten;
  $("uncross").value = "90";
  labels();
  if (quiet) return;
  st.autoPending = true;
  schedule(extract);
}

// ---------- Optimize tracing: printable first, then truest to the image ----------
// Only tracing settings change (threshold, smoothing, speck filter, loose ends, terms).
// Every candidate runs the same pipeline as the app and is scored against ONE fixed reading of the source
// (neutral threshold and smoothing), so candidates are compared by the same yardstick.
const OPT_LABELS = { sens: "Threshold", blur: "Smoothing", minLen: "Ignore specks", loose: "Loose ends" };
let optTok = 0,
  optBefore = null;
const optSnapshot = () => ({
  sens: $("sens").value,
  blur: $("blur").value,
  minLen: $("minLen").value,
  loose: $("loose").value,
  N: st.N,
});
function optApply(c, autoN) {
  for (const k of ["sens", "blur", "minLen", "loose"]) $(k).value = c[k];
  labels();
  st.N = c.N || st.N;
  st.autoPending = !!autoN;
  schedule(extract);
}
function optReference(W) {
  const w = W.w,
    h = W.h;
  let mask;
  if (st.text) mask = detect(W, 0);
  else {
    const base = { ...W, blurred: UNB.blur(W.gray, w, h, 1.2) };
    mask = detect(base, 0);
  }
  return { mask, edt: UNB.edt(mask, w, h) };
}
function optEvaluate(c, W, ref) {
  // line map here (it may need the selection canvas), the rest in the background
  const s = settings(),
    w = W.w,
    h = W.h;
  let lines;
  const Wc = st.text || +c.blur === +$("blur").value ? W : { ...W, blurred: UNB.blur(W.gray, w, h, c.blur / 10) };
  lines = st.text ? lineSpec(W, 0) : lineSpec(Wc, +c.sens); // detected in the background
  return OPT.call("scoreLines", [
    lines,
    w,
    h,
    {
      minPix: st.text ? 0 : +c.minLen,
      maxJump: st.text || !s.far ? 0 : (s.far / 100) * Math.hypot(w, h),
      farShare: CFG.engine.farGroupShare,
      open: s.open,
      startAt: st.start ? toWork(st.start, W.crop) : null,
      jumpCost: +c.loose,
      lanes: zoneMask("lane", w, h, W.crop),
    },
    {
      outW: st.outW,
      spacing: st.spacing,
      lineRatio: lineRatio(),
      loop: CFG.engine.loopRadius,
      roundMM: cornerMM(),
      unx: +$("uncross").value,
      minGap: MIN_GAP_PX,
      termTol: CFG.engine.termTolerance,
      ref,
      ...allowSpec(w, h, W.crop),
      snap: { blurred: Wc.blurred, edges: !st.text && s.mode === "edges" },
    },
  ]);
}
async function optRun() {
  if (!st.source || !st.walk) return;
  const my = ++optTok;
  let W;
  try {
    W = await working(undefined, OPT);
  } catch (e) {
    if (e !== CANCELLED) toast(`Optimize couldn't start: ${(e && e.message) || e}`, true);
    return;
  }
  if (my !== optTok) return;
  const ref = optReference(W);
  optBefore = optSnapshot();
  const OPTS = st.text
    ? { loose: ["0", "2", "1.2"] }
    : {
        sens: ["-30", "-15", "0", "15", "30"],
        blur: ["6", "10", "14", "20", "28"],
        minLen: ["5", "15", "30", "60"],
        loose: ["0", "2", "1.2"],
      };
  const keys = Object.keys(OPTS),
    total = 1 + keys.reduce((a, k) => a + OPTS[k].length - 1, 0);
  let best = { ...optBefore },
    bestR = null,
    start = null,
    tries = 0,
    ki = 0,
    vi = 0;
  $("optbar").hidden = false;
  $("optUndo").hidden = true;
  $("optAccept").hidden = true;
  $("optCancel").hidden = false;
  $("optBtn").disabled = true;
  busyFor("optimize", true);
  const show = (t) => {
    $("optMsg").textContent = t;
  };
  const finish = () => {
    $("optBtn").disabled = false;
    busyFor("optimize", false);
    $("optCancel").hidden = true;
    const changed = keys.filter((k) => String(best[k]) !== String(optBefore[k]));
    if (!bestR || !changed.length || bestR.score >= start.score - 1e-6) {
      show(
        `Your current settings were already the best of ${tries} tries${start ? ` (${fmt(start.fid * scale(), 2)} mm from the image)` : ""}.`
      );
      setTimeout(() => {
        if (my === optTok) $("optbar").hidden = true;
      }, 6000);
      return;
    }
    const nice = (k, v) =>
      k === "loose"
        ? $("loose").querySelector(`option[value="${v}"]`).textContent
        : k === "blur"
          ? mmAtSize(v / 10)
          : v;
    optApply(best);
    show(
      `Closer to the image: ${fmt(start.fid * scale(), 2)} → ${fmt(bestR.fid * scale(), 2)} mm${bestR.cross ? "" : ", no crossings"}${bestR.gapR < 1.95 && st.spacing > 0 ? `, closest gap ${fmt(bestR.gapR * 100, 0)}% of spacing` : ""}. Changed: ` +
        changed.map((k) => `${OPT_LABELS[k]} ${nice(k, optBefore[k])} → ${nice(k, best[k])}`).join(" · ") +
        `. (${tries} tries)`
    );
    $("optUndo").hidden = false;
    $("optAccept").hidden = false;
  };
  const step = () => {
    if (my !== optTok) return;
    let cand;
    if (!start) cand = { ...best };
    else {
      while (ki < keys.length && vi >= OPTS[keys[ki]].length) {
        ki++;
        vi = 0;
      }
      if (ki >= keys.length) return finish();
      const k = keys[ki],
        v = OPTS[k][vi++];
      if (String(v) === String(best[k])) return setTimeout(step, 0);
      cand = { ...best, [k]: v };
    }
    show(`Optimizing… try ${tries + 1} of about ${total}`);
    setTimeout(() => {
      if (my !== optTok) return;
      optEvaluate(cand, W, ref)
        .then((r) => {
          if (my !== optTok) return;
          tries++;
          if (r) {
            if (!start) {
              start = r;
              bestR = r;
              best.N = r.N;
            } else if (r.score < bestR.score - 1e-6) {
              bestR = r;
              best = { ...cand, N: r.N };
            }
          }
          setTimeout(step, 0);
        })
        .catch((e) => {
          if (e === CANCELLED || my !== optTok) return;
          console.error(e);
          show("Optimizing stopped: " + e.message.split("\n")[0]);
          $("optBtn").disabled = false;
          busyFor("optimize", false);
          $("optCancel").hidden = true;
        });
    }, 0);
  };
  step();
}
$("optBtn").addEventListener("click", optRun);
// stop a running Optimize (Cancel, a new source, an undo, or a tracing setting changed by hand): its results would be
// for the old picture or settings
function stopOptimize() {
  if ($("optCancel").hidden) return; // not running
  optTok++;
  OPT.cancel();
  $("optBtn").disabled = false;
  busyFor("optimize", false);
  $("optbar").hidden = true;
  $("optCancel").hidden = true;
}
$("optCancel").addEventListener("click", stopOptimize);
for (const id of ["sens", "blur", "minLen", "loose"]) $(id).addEventListener("input", stopOptimize);
$("optAccept").addEventListener("click", () => {
  $("optbar").hidden = true;
  optBefore = null;
});
$("optUndo").addEventListener("click", () => {
  if (optBefore) optApply(optBefore);
  $("optbar").hidden = true;
  optBefore = null;
});
