// Unbroken · web app · main.js
// Start-up: redraw on resize and theme change, apply the starting defaults from settings.js, then load the first
// design.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// theme + resize (the chocolate's preview colour is re-checked against the new background)
new ResizeObserver(() => {
  render();
  drawChart();
}).observe($("box"));
const rethemed = () => {
  st.bgCache = null;
  for (const k in st.zm) if (st.zm[k]) st.zm[k].tint = null;
  applyChocolateLook();
  render();
  drawChart();
  drawPlate();
  drawMini();
  drawStack();
  ask("redraw"); // a feature's own view (the pen plotter's page; each draws only when showing)
};
try {
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", rethemed);
} catch {}
new MutationObserver(rethemed).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

// problems found in settings.js: listed in the Print step, and a short note on screen
if (CFG.problems.length) {
  $("settingsNote").hidden = false;
  $("settingsNote").textContent = "settings.js: " + CFG.problems.join("; ") + ".";
  console.warn("settings.js:", CFG.problems);
  setTimeout(
    () =>
      toast(
        CFG.problems.length === 1 && /couldn't be read/.test(CFG.problems[0])
          ? "settings.js couldn't be read, so built-in settings are in use"
          : `settings.js: ${CFG.problems.length} problem${CFG.problems.length === 1 ? "" : "s"}, see the Print step`,
        true
      ),
    300
  );
}

applyPrinter(false);
labels();
syncSpacingUI();
infillUI();
lineUI(); // the spacing from line width + gap, and the needle shown
// the Art step starts on the sample picture, or the text (art.js)
const start = CFG.defaults.startFrom;
if (start === "lettering")
  ask("preset", "lettering"); // (optimize.js: the starting points) starts on the text
else if (CFG.defaults.source === "text") artUse("text");
else {
  if (start) ask("preset", start, true);
  startInput(); // art.js: empty, or the sample settings.js or the address names
}
viewChanged(); // the tab that opens (Art) brings its view
showE();
tuneUI();
showHeight(); // E per mm, the Fine-tuning markers and the layer count, from the starting settings
zoomUI(); // zoom.js: the buttons for the view that opens

// ---------- the app's state, for anyone watching from outside: a screen reader, an agent, a test ----------
// <body data-state>: "loading" (start-up), "empty" (nothing to trace yet), "working" (a trace, a size search, layers,
// Optimize tracing …) or "ready" (everything finished and on screen). Ready only after the app has been quiet for half
// a
// second, so the short pauses between one job and the next don't read as done. The corner label is a live region, so
// its readout is announced when it changes.
const APP_ENGINES = () => [PIPE, AUX, OPT, LAY, ...ask("engines")]; // (a feature's own engine: the photo's, the cut-out's)
const appWorking = () => busyReasons.size > 0 || !!pendingFn || !!coverJob || APP_ENGINES().some((e) => e.busy);
let appCalm = 0;
function appStateTick() {
  if (st.final && !appWorking()) coverageNow(); // export.js: how much of the picture the new line reaches
  appCalm = appWorking() ? 0 : appCalm + 1;
  const now = isEmpty() ? "empty" : appCalm >= 4 ? "ready" : "working";
  if (document.body.dataset.state !== now) document.body.dataset.state = now;
}
setInterval(appStateTick, 125);
// window.unbroken.status(): what's on screen, as plain data (an agent reads this instead of screenshots). AGENT.md in
// the repo lists it with the controls an agent uses.
window.unbroken = {
  status() {
    const e = st.err,
      sc = st.final ? scale() : 0,
      lifted = answer("lineLifts"),
      ready = st.final || isModel() ? readyItems() : [];
    return {
      state: document.body.dataset.state,
      version: $("appVersion").textContent,
      madeFor: artForPlot() ? "pen plotter" : "printer",
      input: st.art ? st.art.kind : null,
      source: st.srcLabel || null,
      name: $("designName").value.trim() || null,
      trace: st.final
        ? {
            style: $("modeOutline").checked ? "outline" : "centerline",
            terms: st.N,
            errorMM: e ? +(e.score * sc).toFixed(3) : null,
            connectors: Math.max(0, (st.connRuns || 0) - (lifted ? lifted.n : 0)),
            threshold: +$("sens").value,
            smoothing: $("blurVal").textContent,
          }
        : null,
      size: st.final
        ? { widthMM: +(+$("outW").value).toFixed(1), heightMM: +(+$("outH").value).toFixed(1), pickedByApp: sizePicked }
        : null,
      line: { widthMM: lineWidthMM(), spacingMM: st.spacing },
      ready: ready.map((r) => ({ level: r.lvl, text: r.text })),
      lastExport: ($("gcodeMsg").textContent || "").trim() || null,
    };
  },
  // resolves once the app is ready (or empty); rejects after `ms`
  whenReady(ms = 120000) {
    const t0 = Date.now();
    return new Promise((res, rej) => {
      const go = () =>
        ["ready", "empty"].includes(document.body.dataset.state)
          ? res(window.unbroken.status())
          : Date.now() - t0 > ms
            ? rej(new Error("still working after " + ms + " ms"))
            : setTimeout(go, 150);
      setTimeout(go, 300);
    });
  },
  openLink: (url) => loadURL(url),
};
