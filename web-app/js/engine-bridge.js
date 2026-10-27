// Unbroken · web app · engine-bridge.js
// Background engines: runs core.js functions in Web Workers (worker.js) with cancellation, or on the page when workers
// aren't allowed.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// ---------- background engines ----------
// The heavy maths runs in Web Workers (worker.js loads the same core.js), so sliders and buttons stay responsive.
// Each engine hands its worker one call at a time and keeps the rest waiting here, so cancel() can drop calls that are
// no longer wanted: waiting ones are simply dropped, and the running one is stopped by restarting the worker (the calls
// still wanted then go to the fresh worker). cancel(pred) drops only the calls pred(call) picks, e.g. the layers of an
// older setting but not the 2D page's pen line on the same engine. Where workers aren't allowed (opened straight from
// disk, or a page that blocks them) the same calls run on the page in small slices instead.
const WORKER_URL = "../source/engine/worker.js";
const CANCELLED = Object.freeze({ cancelled: true });
let workersOK = null; // null: not known yet · true · false: run on the page
function makeEngine(name) {
  let w = null,
    seq = 0,
    running = 0; // the call the worker is working on (0: none)
  const calls = new Map(), // id → { fn, args, res, rej, prog }
    queue = []; // ids waiting for the worker, oldest first
  // the next waiting call to the worker, when it's free
  function pump() {
    if (workersOK === false || running) return;
    while (queue.length && !calls.has(queue[0])) queue.shift(); // dropped while waiting
    if (!queue.length) return;
    if (!w) spawn();
    if (!w || workersOK === false) return; // the worker couldn't start: the calls run on the page (fallBack)
    running = queue.shift();
    const c = calls.get(running);
    w.postMessage({ id: running, fn: c.fn, args: c.args });
  }
  function fallBack() {
    workersOK = false;
    if (w) {
      w.terminate();
      w = null;
    }
    running = 0;
    queue.length = 0;
    for (const [id, c] of calls) runHere(id, c);
  }
  function spawn() {
    let me;
    try {
      me = w = new Worker(WORKER_URL);
    } catch (e) {
      fallBack();
      return;
    }
    const timer = workersOK
      ? null
      : setTimeout(() => {
          if (!workersOK && me === w) fallBack();
        }, 4000);
    // the handlers belong to this worker: a cancelled one (stopped while still loading) may report late, and must not
    // touch the calls of the worker that replaced it
    me.onmessage = (e) => {
      if (me !== w) return;
      const m = e.data;
      if (m.ready) {
        clearTimeout(timer);
        workersOK = true;
        return;
      }
      const c = calls.get(m.id);
      if (c && "progress" in m) {
        if (c.prog) c.prog(m.progress);
        return;
      }
      if ("progress" in m) return;
      if (m.id === running) running = 0;
      if (c) {
        calls.delete(m.id);
        if ("error" in m) c.rej(new Error(m.error));
        else c.res(m.result);
      }
      pump();
    };
    me.onerror = (e) => {
      if (e.preventDefault) e.preventDefault();
      if (me !== w) return;
      clearTimeout(timer);
      if (workersOK !== true) fallBack();
      else {
        const err = new Error(e.message || "worker error");
        for (const [, c] of calls) c.rej(err);
        calls.clear();
        queue.length = 0;
        running = 0;
        w.terminate();
        w = null;
      }
    };
  }
  async function runHere(id, c) {
    // page fallback: generators are stepped in ~25 ms slices
    await new Promise((r) => setTimeout(r, 0));
    if (!calls.has(id)) return;
    try {
      let r = UNB[c.fn](...UNB.decodeArgs(c.args));
      if (r && typeof r.next === "function") {
        let s = r.next(),
          t0 = performance.now();
        while (!s.done) {
          if (c.prog) c.prog(s.value);
          if (performance.now() - t0 > 25) {
            await new Promise((res) => setTimeout(res, 0));
            if (!calls.has(id)) return;
            t0 = performance.now();
          }
          s = r.next();
        }
        r = s.value;
      }
      if (calls.delete(id)) c.res(r);
    } catch (err) {
      if (calls.delete(id)) c.rej(err);
    }
  }
  return {
    name,
    call(fn, args, prog) {
      return new Promise((res, rej) => {
        const id = ++seq,
          c = { fn, args, res, rej, prog };
        calls.set(id, c);
        if (workersOK === false) {
          runHere(id, c);
          return;
        }
        queue.push(id);
        pump();
      });
    },
    // cancel() drops every call; cancel(pred) only those pred({ fn, args }) picks. Dropped calls reject with
    // CANCELLED.
    cancel(pred) {
      let stop = false;
      for (const [id, c] of calls) {
        if (pred && !pred(c)) continue;
        calls.delete(id);
        c.rej(CANCELLED);
        if (id === running) stop = true;
      }
      if (stop && w) {
        // the running call is one of them: a fresh worker takes the calls still wanted
        w.terminate();
        w = null;
        running = 0;
        pump();
      }
    },
    get busy() {
      return calls.size > 0;
    },
  };
}
// trace: the main pipeline · chart: the term-count sweep · optimize: Optimize tracing · layers: the Print step's layer
// lines and model slicing (so they never wait behind a trace)
const PIPE = makeEngine("trace"),
  AUX = makeEngine("chart"),
  OPT = makeEngine("optimize"),
  LAY = makeEngine("layers");
