// Unbroken · web app · controls.js
// Control wiring: the run scheduler (launch / schedule / cancel), sliders, image loading, size and units, line spacing
// and needles.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// ---------- controls ----------
let pending = null,
  pendingFn = null,
  gen = 0,
  busyTimer = null;
const ORDER = [extract, signal, fit, finalize];
function guard(g) {
  if (g !== gen) throw CANCELLED;
} // a newer change has started: drop this run
function setBusy(on) {
  clearTimeout(busyTimer);
  if (on)
    busyTimer = setTimeout(() => {
      busyFor("trace", true);
      $("box").classList.add("working");
    }, 120); // no flicker on quick runs
  else {
    busyFor("trace", false);
    $("box").classList.remove("working");
  }
}
// Start a run now: cancels whatever is still being worked out, keeps the last result on screen until the new one is
// ready.
let autoRun = false;
function launch(fn) {
  clearTimeout(pending);
  pendingFn = null;
  const g = ++gen;
  PIPE.cancel();
  stopPlay();
  setBusy(true);
  if (autoRun) autoRun = false;
  else recordSoon(); // automatic follow-ups (the size settling on its mark) aren't undo steps of their own
  Promise.resolve()
    .then(() => fn(g))
    .catch((e) => {
      if (e === CANCELLED) return;
      console.error(e);
      setChip("Something went wrong: " + (e && e.message ? e.message.split("\n")[0] : e));
    })
    .finally(() => {
      if (g === gen && !(st.autoPending && AUX.busy)) setBusy(false);
    }); // a term-count pick is still coming
}
// Changes are gathered for a short pause (e.g. while a slider is dragged), then run once from the earliest stage they
// need.
function schedule(fn) {
  if (!pendingFn || ORDER.indexOf(fn) < ORDER.indexOf(pendingFn)) pendingFn = fn;
  clearTimeout(pending);
  setBusy(true);
  pending = setTimeout(() => launch(pendingFn), 90);
}

const nFromSlider = (v) => Math.max(2, Math.round(2 * Math.pow(st.Nmax / 2, v / 1000)));
function setSliderFromN() {
  $("terms").value = Math.round((1000 * Math.log(st.N / 2)) / Math.log(st.Nmax / 2));
  $("termsVal").textContent = `${st.N} of ${st.Nmax}`;
}
$("terms").addEventListener("input", () => {
  st.N = nFromSlider(+$("terms").value);
  $("termsVal").textContent = `${st.N} of ${st.Nmax}`;
  drawChart();
  schedule(fit);
});
$("auto").addEventListener("click", applyAuto);

// a length on the working image, as mm at the drawing's current size ("–" until something is traced)
const mmAtSize = (px) => (st.bw ? `${fmt(px * scale(), px * scale() < 1 ? 2 : 1)} mm` : "–");
function labels() {
  const s = settings();
  $("sensLabel").textContent = s.mode === "edges" ? "Edge sensitivity" : "Ink threshold";
  $("sensVal").textContent = (s.sens > 0 ? "+" : "") + s.sens;
  $("blurVal").textContent = mmAtSize(s.blur); // these work on the image; shown as mm at the current size
  $("minLenVal").textContent = s.minLen ? mmAtSize(s.minLen) : "off";
  const cr = +$("corner").value / 10;
  $("cornerVal").textContent = cr ? `${fmt(cr, 1)} mm radius` : "off";
  $("farVal").textContent = s.far ? s.far + "% of image" : "keep all";
  const p = s.prep,
    sh = s.shade;
  $("brightVal").textContent = (p.brightness > 0 ? "+" : "") + p.brightness;
  $("contrastVal").textContent = (p.contrast > 0 ? "+" : "") + p.contrast;
  $("bgTolVal").textContent = p.bgTol ? p.bgTol + "% tolerance" : "off";
  const on = [
    p.brightness && "brightness",
    p.contrast && "contrast",
    p.bgTol && "background",
    p.flatten && "lighting",
  ].filter(Boolean);
  $("prepVal").textContent = on.length ? on.join(", ") : "off";
  $("shadeSpVal").textContent = mmAtSize(sh.spacing);
  $("shadeLvVal").textContent = `${sh.level} of 255`;
  $("shadeVal").textContent =
    sh.style === "off" ? "off" : $("shadeStyle").selectedOptions[0].textContent.split(" (")[0].toLowerCase();
}
for (const id of ["sens", "blur", "minLen", "far", "bright", "contrast", "bgTol", "shadeSp", "shadeLv"])
  $(id).addEventListener("input", () => {
    labels();
    schedule(extract);
  });
for (const id of ["flatten", "shadeStyle", "loose"])
  $(id).addEventListener("change", () => {
    labels();
    st.autoPending = true;
    schedule(extract);
  });
$("prepReset").addEventListener("click", () => {
  $("bright").value = 0;
  $("contrast").value = 0;
  $("bgTol").value = 0;
  $("flatten").checked = false;
  labels();
  schedule(extract);
});
$("corner").addEventListener("input", () => {
  labels();
  schedule(signal);
});
$("showProb").addEventListener("change", () => {
  const n = +$("viewBadge").textContent || 0;
  $("viewBadge").hidden = !$("showProb").checked || !n;
  render();
}); // the marks and the count on the view switch
$("showDrift").addEventListener("change", () => {
  render();
  finalizeReadout();
});
$("lineView").addEventListener("change", render);
$("dims").addEventListener("change", render);
$("uncross").addEventListener("change", () => schedule(fit)); // fit: lays out the line again and checks the size marks
$("invert").addEventListener("change", () => schedule(extract));
document.querySelectorAll('input[name="mode"], input[name="loop"]').forEach((r) =>
  r.addEventListener("change", () => {
    labels();
    st.autoPending = true;
    schedule(extract);
  })
);
$("bg").addEventListener("change", render);
$("showConn").addEventListener("change", render);

function loadFile(f, label) {
  if (!f) return;
  if (f.type && !f.type.startsWith("image/")) {
    setChip("That file isn't an image. Try a PNG, JPG or SVG.");
    return;
  } // checked first, so a wrong file changes nothing
  if (isModel()) {
    $("srcImage").checked = true;
    document.body.dataset.src = "image";
  } // an image replaces the model as the source (setSource does the rest)
  const url = URL.createObjectURL(f),
    img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth || 800;
    c.height = img.naturalHeight || 600;
    const g = c.getContext("2d");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    $("sample").value = "user";
    const name = label || f.name || "image";
    setSource(c, name.length > 22 ? name.slice(0, 20) + "…" : name);
    $("selectBtn").textContent = "Select area";
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    setChip("That file couldn't be read as an image");
  };
  img.src = url;
}
$("sample").addEventListener("change", () => {
  const v = $("sample").value;
  if (v !== "user") setSource(makeSample(v), "sample");
});

// size + units
function syncHeight() {
  if (st.bw) $("outH").value = +((st.outW * st.bh) / st.bw).toFixed(2);
}
function syncSpacingUI() {
  $("simplify").value = Math.round((st.simplify / 0.5) * 100);
  $("simplifyVal").textContent = st.simplify ? `${fmt(st.simplify, 3)} mm tolerance` : "off";
}
// typed sizes apply when the box is left (or Enter), so typing "25" doesn't pass through 2 mm; never below the smallest
// that fits
$("outW").addEventListener("change", () => {
  const v = +$("outW").value;
  if (!(v > 0)) {
    $("outW").value = +st.outW.toFixed(1);
    return;
  }
  if (st.text) scaleText(v / st.outW);
  else setSize(v, true);
});
$("outH").addEventListener("change", () => {
  const v = +$("outH").value;
  if (!(v > 0 && st.bh)) {
    syncHeight();
    return;
  }
  const W = (v * st.bw) / st.bh;
  if (st.text) scaleText(W / st.outW);
  else setSize(W, true);
});
// Fit inside a box: the biggest size whose width and height both fit (either box may be left empty)
$("fitBtn").addEventListener("click", () => {
  const bw = +$("fitW").value,
    bh = +$("fitH").value;
  if (!st.bw || !st.bh || !(bw > 0 || bh > 0)) {
    toast("Type the box's width, height or both");
    return;
  }
  const W = Math.min(bw > 0 ? bw : Infinity, bh > 0 ? (bh * st.bw) / st.bh : Infinity);
  if (st.text) scaleText(W / st.outW);
  else setSize(W, true);
});
function afterSize() {
  if (!st.text && st.source && st.walk && workRes() !== st.resUsed) {
    st.autoPending = true;
    schedule(extract);
  } // a bigger (or smaller) print is traced at its own resolution (and gets its own term count)
  else if (st.spacing > 0) schedule(signal);
  else if (st.err) {
    if (st.final) st.mbox = UNB.minBox(st.final.re, st.final.im, (0.5 * lineWidthMM()) / scale());
    labels();
    readouts();
    renderMath();
    render();
    drawPlate();
    drawMini();
  }
}
// The line: spacing (centre to centre) = line width + gap (edge to edge). The 3D tab's needle sets the width; typing a
// width picks the needle that matches, or Custom.
// The line spacing or width changed: text is laid out again, a model's layers rebuilt, an image's line re-fitted.
function spacingChanged() {
  if (textMode()) textChanged();
  else if (isModel()) {
    plateCache = null;
    layersSoon(0);
    drawPlate();
  } else schedule(signal);
}
function lineUI() {
  // the spacing (st.spacing, owned here) and the needle's look and hint
  const w = lineWidthMM(),
    g = Math.max(0, +$("lineGapMM").value || 0);
  st.spacing = w + g;
  const o = [...$("needle").options].find((x) => x.value !== "custom" && Math.abs(+x.value - w) < 0.005);
  $("needle").value = o ? o.value : "custom";
  const opt = $("needle").selectedOptions[0];
  $("needleDot").style.background = opt.dataset.c;
  $("needleDot").title = opt.textContent;
  $("needleHint").textContent = o
    ? `Sets the line width on the Trace tab (${fmt(w, 2)} mm) and, with the ${CFG.printer.cartridge || "cartridge"}, how fast the plunger pushes (E per mm, Fine-tuning).`
    : `Custom: the Trace tab's line width (${fmt(w, 2)} mm) doesn't match a needle in settings.js.`;
  if (!$("spacingHint").classList.contains("warn")) $("spacingHint").textContent = spacingText();
}
const spacingText = () =>
  `Lines ${fmt(st.spacing, 2)} mm apart, centre to centre; stroke ends loop back ${fmt(lineWidthMM() + st.spacing, 2)} mm wide.`;
function lineChanged() {
  lineUI();
  spacingChanged();
  printSettingsChanged();
} // the needle or line width (also after a chocolate change)
$("needle").addEventListener("change", () => {
  if ($("needle").value !== "custom") $("lineW").value = $("needle").value;
  lineChanged();
});
for (const id of ["lineW", "lineGapMM"]) $(id).addEventListener("input", lineChanged);
$("simplify").addEventListener("input", () => {
  st.simplify = (+$("simplify").value / 100) * 0.5;
  syncSpacingUI();
  recordSoon();
  layersSoon();
  plotSoon();
}); // exports and the 3D / 2D tabs simplify the line too
