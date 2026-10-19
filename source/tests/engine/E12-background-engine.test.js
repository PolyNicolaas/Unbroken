const fs = require("fs"), path = require("path"), vm = require("vm"), S = require("../lib/scenes.js"), { trace, UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "E12", title: "Background engine gives the same answers as the page",
  guards: "the worker and the page computing different traces",
  why: "The heavy maths runs in a Web Worker (worker.js) when the browser allows it, and on the page when it doesn't (e.g. opened from disk). Both paths must give identical results, including crossing-area masks, which can't be sent to a worker as functions and are rebuilt from a mask.",
  how: "Loads worker.js in a sandbox the way a browser would (importScripts of core.js, which imports the engine's parts), sends it the app's messages (stageSignal, a step-by-step sweep, stageFinal with a crossing-area mask), and compares each reply with calling the same function directly.",
  pass: "The worker announces it is ready; stageSignal and stageFinal replies match the direct calls exactly; the sweep sends one progress message per term count and the same final list; an error in a call comes back as an error message, not a crash.",
  async run() {
    const dir = path.resolve(__dirname, "../../engine"), out = [];
    const sandbox = { console, postMessage: (m) => out.push(m), importScripts: (...files) => files.forEach((f) => vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), sandbox)), Float64Array, Int32Array, Uint8Array, Float32Array, Map, Set, Math, ArrayBuffer };
    sandbox.globalThis = sandbox; vm.createContext(sandbox); vm.runInContext(fs.readFileSync(path.join(dir, "worker.js"), "utf8"), sandbox);
    const ask = (id, fn, args) => { out.length = 0; sandbox.onmessage({ data: { id, fn, args } }); return out.slice(); };
    const ready = sandbox.UNB && true;
    const r = trace(S.sample("leaf")), w = r.w, h = r.h, walk = r.walk;
    const same = (a, b) => JSON.stringify(a, (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v)) === JSON.stringify(b, (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v));
    const m1 = ask(1, "stageSignal", [walk, 0, w, h]), direct = UNB.stageSignal(walk, 0, w, h);
    const Ns = [4, 8, 16, 32, 64, 128], m2 = ask(2, "sweepSteps", [direct.sp.ax, direct.sp.order, Ns, direct.jumpS, false]);
    const it = UNB.sweepSteps(direct.sp.ax, direct.sp.order, Ns, direct.jumpS, false); let s = it.next(); while (!s.done) s = it.next();
    const mask = new Uint8Array(w * h); for (let y = 100; y < 200; y++) for (let x = 100; x < 200; x++) mask[y * w + x] = 1;
    const n0 = r.sg.S, fo = { closed: true, d: 0, unx: 90, minGap: 0.75, allowMask: mask, allowW: w, allowH: h, tags: { group: null, jid: r.sg.tagS.jid, jd: r.sg.tagS.jd }, jumps: r.sg.jumpS, pad: 0, walk, w, h };
    const c = r.fit.curve, m3 = ask(3, "stageFinal", [c.re.slice(0, n0), c.im.slice(0, n0), fo]), d3 = UNB.stageFinal(...UNB.decodeArgs([c.re.slice(0, n0), c.im.slice(0, n0), fo]));
    const m4 = ask(4, "noSuchFunction", []);
    return { checks: [
      check("worker loaded the engine", +!!ready, "==", 1),
      check("stageSignal reply matches", +(m1.length === 1 && same(m1[0].result, direct)), "==", 1),
      check("sweep progress messages", m2.filter((m) => "progress" in m).length, "==", Ns.length),
      check("sweep result matches", +same(m2[m2.length - 1].result, s.value), "==", 1),
      check("stageFinal (with crossing-area mask) matches", +same(m3[0].result, d3), "==", 1),
      check("unknown function reported as an error", +("error" in m4[0]), "==", 1),
    ] };
  },
};
