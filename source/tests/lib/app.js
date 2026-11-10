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
  window.__settled = () => live.size === 0 && !["PIPE", "LAY", "AUX", "OPT", "PHO", "CUT"].some(busy);
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
  mapNav(page);
  // the app opens on the Art step; most tests work on the Line step, so they start there (opts.art: stay on Art)
  if (!opts.art) {
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
// The settings show one step of the map at a time (map.js): a test names a control and, like someone using the app,
// first opens the place it's in. Before an action on a selector, mapNav opens the node of the step now showing that
// holds the control's card (never another step: a control on another step isn't reachable until the test goes there).
// The steps themselves and what it's made for keep the names the tests have always used: "label[for=viewDesign]" is
// the Line step (its node on the map), "label[for=artForPlot]" the pen plotter's chip.
async function reveal(page, sel, method) {
  if (typeof sel !== "string") return null;
  return page.evaluate(
    ([sel, method]) => {
      if (typeof mapOpen !== "function") return null;
      const S = mapShape(),
        shown = S.spine.concat(...Object.values(S.up), ...Object.values(S.down));
      const step = sel.match(/^(?:label\[for="?|#)(viewArt|viewDesign|viewChoc|view2D)"?\]?$/);
      if (step) {
        if (method !== "click" && method !== "check") return null;
        const v = document.getElementById(step[1]).value,
          id = S.spine.find((k) => MAP_NODES[k].step === v);
        if (id) mapOpen(id);
        return { done: true, opened: id || null };
      }
      const out = sel.match(/^(?:label\[for="?|#)artFor(Plot|Print)"?\]?$/);
      if (out && method === "click") return { sel: `.map-for[data-for="${out[1].toLowerCase()}"]` };
      let el = null;
      try {
        el = document.querySelector(sel);
      } catch (e) {}
      if (!el || el.getClientRects().length) return null;
      const card = el.closest("section.card"),
        h = card && card.querySelector("h2"),
        v = document.body.dataset.view;
      if (!h) return null;
      // (a setting shown as a row belongs to the node that lists it, whichever card it came from)
      const inRows = (k) => (MAP_NODES[k].rows || []).some(([, ids]) => ids.some((r) => { const f = mapFieldOf(r); return f && (f === el || f.contains(el)); }));
      const id =
        shown.find((k) => MAP_NODES[k].step === v && inRows(k)) ||
        shown.find((k) => MAP_NODES[k].step === v && (MAP_NODES[k].holds || MAP_NODES[k].cards || []).includes(h.id));
      if (id && id !== mapOpenId) mapOpen(id);
      return id ? { opened: id } : null;
    },
    [sel, method]
  );
}
function mapNav(page) {
  for (const m of ["click", "dblclick", "tap", "fill", "check", "uncheck", "selectOption", "press", "type", "hover", "focus", "setInputFiles", "isVisible", "isHidden"]) {
    const f = page[m].bind(page);
    page[m] = async (sel, ...a) => {
      const r = await reveal(page, sel, m);
      if (r && r.done) return;
      if (r && r.opened) await page.waitForTimeout(30);
      return f((r && r.sel) || sel, ...a);
    };
  }
}
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
// line): Making it for a pen plotter, the Line step's line ("drawn": Trace off) (default "one": the traced line, as the tests before v107
// plotted), then the Plot step. print(page): Making it for a printer, then the Print step.
async function plot(page, line = "one") {
  await page.evaluate((m) => {
    const set = (id, on = true) => { if ($(id).checked !== on) { $(id).checked = on; $(id).dispatchEvent(new Event("change", { bubbles: true })); } };
    set("artForPlot");
    // (since v112 "drawn" is the Trace switch off; the others are traced)
    set("traceOn", m !== "drawn");
    if (m !== "drawn") set({ one: "lineOne", strokes: "lineStrokes" }[m]);
  }, line);
  await idle(page, 300);
  await page.click("label[for=view2D]");
}
async function print(page) {
  if (!(await page.isChecked("#artForPrint"))) { await page.click("label[for=artForPrint]"); await idle(page, 300); }
  await page.click("label[for=viewChoc]");
}
// start from an example: the Examples chip on the map opens the tray, a tile there starts from it
async function example(page, key) {
  if (!(await page.$("#mapTray:not([hidden])"))) await page.click('[data-node="examples"]');
  await page.click(`#mapTray .map-ex[data-example="${key}"]`);
}
// the last step: Print (made for a printer) or Plot (for a pen plotter)
async function out(page) {
  await page.click((await page.isChecked("#artForPlot")) ? "label[for=view2D]" : "label[for=viewChoc]");
}
// the steps on the map's line, left to right ("material,art,line,size,print")
const spine = (page) => page.$$eval("#mapNodes .map-node.big", (els) => els.sort((a, b) => a.offsetLeft - b.offsetLeft).map((e) => e.dataset.node).join(","));
// open the step of the map that holds a card ("h-machine": Fine-tuning's settings)
const card = (page, heading) => page.evaluate((h) => { const id = mapNodeOf(h); if (id && id !== mapOpenId) mapOpen(id); }, heading);
module.exports = { card, spine, example, out, mapNav, SETTLE, withExample, open, idle, source, chip, terms, errorMM, setValue, longestFreeze, plot, print };
