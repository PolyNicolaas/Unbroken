// Browser helpers for the app tests.
// SETTLE (installed in every browser context by run.js): counts the app's short timers (debounces, up to 1.5 s) and
// asks its background engines whether a job is running, so a test can wait until the app has finished its work
// instead of sleeping for a guessed time. window.__settled() is true when nothing is pending.
const SETTLE = () => {
  const live = new Set(),
    st0 = window.setTimeout,
    ct0 = window.clearTimeout;
  window.setTimeout = function (fn, ms, ...a) {
    const id = st0.call(
      window,
      function () {
        live.delete(id);
        return typeof fn === "function" ? fn.apply(this, arguments) : undefined;
      },
      ms,
      ...a
    );
    if (!(ms > 1500)) live.add(id);
    return id;
  };
  window.clearTimeout = function (id) {
    live.delete(id);
    return ct0.call(window, id);
  };
  const busy = (n) => {
    try {
      return !!(0, eval)(n).busy;
    } catch {
      return false;
    }
  };
  window.__settled = () => live.size === 0 && !["PIPE", "LAY", "AUX", "OPT"].some(busy);
};
const withExample = (url, ex) => (ex && !/[?&]example=/.test(url) ? url + (url.includes("?") ? "&" : "?") + "example=" + ex : url);
async function open(ctx, opts = {}) {
  const context = await ctx.browser.newContext({
    viewport: opts.viewport || { width: 1300, height: 1000 },
    acceptDownloads: true,
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message + (process.env.STACK ? " " + e.stack : "")));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text());
  });
  if (opts.freezeProbe)
    await page.addInitScript(() => {
      window.__gaps = [];
      let last = performance.now();
      setInterval(() => {
        const n = performance.now();
        window.__gaps.push(n - last);
        last = n;
      }, 10);
    });
  // since v109 the app opens empty: the tests start on the leaf example, as the app used to (opts.clean: empty)
  await page.goto(withExample(opts.url || ctx.url, opts.clean ? null : opts.example || "leaf"));
  await idle(page, 300);
  // the Wheel (v108) folds every card but the one scrolled to: the tests written before it expect cards to stay as they
  // set them, so it's off unless opts.wheel
  if (!opts.wheel) await page.evaluate(() => { const w = document.getElementById("wheel"); if (w && w.checked) { w.checked = false; w.dispatchEvent(new Event("change")); } });
  // cards folded for a first visit since v105.1 (Fit, Base, Infill, the suggestion box) open, as the tests written
  // before expect; opts.folded keeps them folded
  if (!opts.folded)
    await page.evaluate(() =>
      ["h-fit", "h-base", "h-infill", "h-notes"].forEach((h) => {
        const b = document.querySelector(`#card-${h}.collapsed .card-toggle`);
        if (b) b.click();
      })
    );
  // the app opens on the Art tab; most tests work on the Trace tab, so they start there (opts.art: stay on Art)
  if (!opts.art && (await page.$("label[for=viewDesign]"))) {
    await page.click("label[for=viewDesign]");
    await idle(page, 100);
  }
  return { page, errors, close: () => context.close() };
}
// Wait until the app has finished: no debounce pending and no background job, three checks in a row 50 ms apart
// (so a job that starts from an image load or a worker reply is caught). Waits at most `first` ms (up to 300) for
// work to begin. Fails the test after 120 s instead of carrying on with half-finished work.
async function idle(page, first = 300) {
  await page.waitForTimeout(Math.min(first, 300));
  if (await page.evaluate(() => typeof window.__settled === "function")) {
    const t0 = Date.now();
    for (let calm = 0; calm < 3; ) {
      if (Date.now() - t0 > 120000) throw new Error("the app never settled (120 s): a job or timer kept running");
      calm = (await page.evaluate(() => window.__settled())) ? calm + 1 : 0;
      await page.waitForTimeout(50);
    }
    return;
  }
  let calm = 0; // a page without SETTLE: the old "busy class stays off" check
  for (let i = 0; i < 400 && calm < 4; i++) {
    const busy = await page.evaluate(
      () =>
        document.getElementById("chip").classList.contains("busy") ||
        document.getElementById("box").classList.contains("working")
    );
    calm = busy ? 0 : calm + 1;
    await page.waitForTimeout(150);
  }
}
const chip = (page) => page.textContent("#chip");
const terms = async (page) => +((await chip(page)).match(/(\d+) terms/) || [0, 0])[1];
const errorMM = async (page) => +((await chip(page)).match(/error ([\d.]+) mm/) || [0, NaN])[1];
async function setValue(page, sel, value, ev = "input") {
  await page.$eval(
    sel,
    (e, [v, t]) => {
      e.value = v;
      e.dispatchEvent(new Event(t, { bubbles: true }));
    },
    [String(value), ev]
  );
}
async function longestFreeze(page, fn) {
  await page.evaluate(() => {
    window.__gaps = [];
  });
  await fn();
  return page.evaluate(() => Math.round(Math.max(0, ...window.__gaps)));
}
// what was the Trace tab's Image / Text / 3D model switch: show only the picture, text or model layers (art.js); text
// and models open the Art tab, where their controls are
async function source(page, kind) {
  await page.evaluate((k) => artShowOnly(k), kind);
  if (kind !== "picture") {
    await page.click("label[for=viewArt]");
    await page.waitForTimeout(100);
  }
}
// The last step since v107 is Plot (made for a pen plotter) or Print (for a printer), chosen at the top. plot(page,
// line): Making it for a pen plotter, the Line step's line (default "one": the traced line, as the tests before v107
// plotted), then the Plot step. print(page): Making it for a printer, then the Print step.
async function plot(page, line = "one") {
  await page.evaluate((m) => {
    const set = (id) => { if (!$(id).checked) { $(id).checked = true; $(id).dispatchEvent(new Event("change", { bubbles: true })); } };
    set("artForPlot");
    set({ one: "lineOne", strokes: "lineStrokes", drawn: "lineDrawn" }[m]);
  }, line);
  await idle(page, 300);
  await page.click("label[for=view2D]");
}
async function print(page) {
  if (!(await page.isChecked("#artForPrint"))) { await page.click("label[for=artForPrint]"); await idle(page, 300); }
  await page.click("label[for=viewChoc]");
}
module.exports = { SETTLE, withExample, open, idle, source, chip, terms, errorMM, setValue, longestFreeze, plot, print };
