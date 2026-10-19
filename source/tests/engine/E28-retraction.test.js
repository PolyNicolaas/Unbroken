const fs = require("fs"), path = require("path"), vm = require("vm"), { UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
const SAMPLE = path.resolve(__dirname, "../../printer/choc-mate-2/sample/choc-os-welcome.gcode");
function settings() { const sb = { window: {} }; vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../../../web-app/settings.js"), "utf8"), sb); return sb.window.UNB_SETTINGS; }
const nums = (c) => Object.fromEntries([...c.matchAll(/([XYZEF])(-?[\d.]+)/g)].map((m) => [m[1], +m[2]]));
module.exports = {
  id: "E28", title: "G-code starts, stops and moves between copies the way choc OS does",
  guards: "a blob or a string of chocolate at the end of each copy, an empty needle at the start of the next, no purge line, and a plunger speed that ignores the needle",
  why: "choc OS (the choc mate 2's own slicer) writes files the printer is known to print well. Its sample file (source/printer/choc-mate-2/sample) shows the recipe: the needle size for the printer, a purge line, a slow pull-back before travelling, a push forward and the printer's pause before printing, and a wipe that pulls back while finishing the line. The tracer's files should follow the same recipe, with the plunger speed set by the needle.",
  how: "Measures choc OS's own files: E per mm and the length of the wipe move in its Welcome, and E per mm in the same Welcome made with three needles (two copies each). Then writes G-code for two copies of a 40 mm square (4 layers, as layerStack would close them) with the choc mate 2's settings.js values, and reads it back.",
  pass: "E per mm from the formula (needle × layer height ÷ cartridge area) is within 1% of choc OS's, for its 0.84, 1.19 and 1.60 mm needle files too; the start lines carry the needle size and the purge line; the first copy is preceded by a retract and the first-unretract offset; each copy starts with an unretract and the pause; each copy ends with a wipe along its own line, as long as print speed × wipe time (choc OS's own wipe is the same length), pulling back exactly the retraction; E only grows while printing; travel moves extrude nothing. Time per layer: a lap too quick for 20 s is slowed until it takes 20 s (F480 for a 160 mm lap), or counted when it would have to go below the floor, and the G-code carries that feed. Read back for the preview, the file gives walls, fill, travel, the purge line along the back edge and a wipe per copy.",
  async run() {
    const checks = [], S = settings(), P = S.printers[0];
    // 1. choc OS's own file: E per mm over layer 1, and the wipe move's length
    const L = fs.readFileSync(SAMPLE, "utf8").split(/\r?\n/);
    let len = 0, eEnd = 0, px = null, py = null, inLayer = false, wipe = 0;
    for (let i = 0; i < L.length; i++) {
      const l = L[i];
      if (l === "; starting layer 1") { inLayer = true; px = 124.17; py = 112.03; continue; }
      if (l === "; starting layer 2") inLayer = false;
      if (l.startsWith("; starting retraction")) { const a = nums(L[i - 2].split(";")[0]), b = nums(L[i + 1]); wipe = Math.hypot(b.X - a.X, b.Y - a.Y); }
      if (!inLayer || !/^G1 X/.test(l)) continue;
      const n = nums(l); len += Math.hypot(n.X - px, n.Y - py); px = n.X; py = n.Y; eEnd = n.E;
    }
    const ePerMM = eEnd / len, needle = 0.84, h = 0.3, formula = needle * h / (Math.PI * P.cartridgeDiameter ** 2 / 4);
    checks.push(check("choc OS sample: E per mm vs the formula (relative error)", Math.abs(formula / ePerMM - 1), "<=", 0.01));
    // the same Welcome, two copies, with three needles: E per mm grows with the needle exactly as the formula says
    const layer2 = (file) => {                                // E per mm over layer 2 (a whole lap, from the end of layer 1)
      const G = fs.readFileSync(path.join(path.dirname(SAMPLE), file), "utf8").split(/\r?\n/);
      let px = null, py = null, on = false, len = 0, e = 0, nozzle = 0;
      for (const l of G) {
        const m = l.match(/JobNozzleDiameter ([\d.]+)/); if (m) nozzle = +m[1];
        if (l === "; starting layer 2") on = true; else if (l === "; starting layer 3") break;
        if (!/^G1 X/.test(l)) continue;
        const n = nums(l); if (on && px !== null) { len += Math.hypot(n.X - px, n.Y - py); e = n.E; } px = n.X; py = n.Y;
      }
      return { nozzle, perMM: e / len };
    };
    const runs = ["welcome-2x-0.84mm.gcode", "welcome-2x-1.19mm.gcode", "welcome-2x-1.60mm.gcode"].map(layer2);
    let worst = 0; for (const r of runs) worst = Math.max(worst, Math.abs(r.nozzle * h / (Math.PI * P.cartridgeDiameter ** 2 / 4) / r.perMM - 1));
    checks.push(check("choc OS, 0.84 / 1.19 / 1.60 mm needles: E per mm vs the formula (worst relative error)", worst, "<=", 0.01));
    const feed = 1200, wipeLen = feed / 60 * P.wipeTime;
    checks.push(check("choc OS sample: wipe move length vs print speed × wipe time (mm off)", Math.abs(wipe - wipeLen), "<=", 0.05));
    // 2. the tracer's file for two copies of a 40 mm square, 4 laps rising 0.3 mm each
    const lap = [[0, 0], [40, 0], [40, 40], [0, 40]], x = [], y = [], z = [];
    for (let k = 0; k < 4; k++) for (let j = 0; j < 4; j++) for (let s = 0; s < 10; s++) {
      const a = lap[j], b = lap[(j + 1) % 4], t = s / 10; x.push(a[0] + (b[0] - a[0]) * t); y.push(a[1] + (b[1] - a[1]) * t); z.push(h * (k + (j * 10 + s) / 40)); }
    x.push(0); y.push(0); z.push(h * 4);
    const copy = (dx) => ({ x: Float64Array.from(x, (v) => v + dx), y: Float64Array.from(y, (v) => v + 20), z: Float64Array.from(z) });
    const g = { ox: 0, oy: 0, z: 0.3, lift: 5, feed, e: formula, needle, start: P.startGcode, end: P.endGcode, retract: P.retraction, retractSpeed: P.retractSpeed,
      wipeTime: P.wipeTime, firstUnretractExtra: P.firstUnretractExtra, unretractPause: P.unretractPause, travelSpeed: P.travelSpeed };
    const txt = UNB.exportGcode([copy(20), copy(100)], g), G = txt.trim().split("\n"), rF = `F${Math.round(P.retractSpeed * 60)}`;
    checks.push(check("start: the needle size for the printer's MatchNozzleSize", +G.includes("@set global.JobNozzleDiameter 0.84"), "==", 1),
      check("start: the purge line (X80 → X30 along the back edge)", +(G.some((l) => /^G1 X80\.0 Y232/.test(l)) && G.some((l) => /^G1 X30\.0 E/.test(l))), "==", 1));
    const firstCopy = G.findIndex((l) => l.startsWith("; copy 1")), pre = G.slice(0, firstCopy);
    checks.push(check("before the first copy: retract at the retraction speed, then the first-unretract offset", +(pre.some((l) => l.startsWith(`G1 ${rF} E-${P.retraction}`)) && pre.some((l) => l.startsWith(`G92 E-${P.retraction + P.firstUnretractExtra}`))), "==", 1));
    let unretracts = 0, pauses = 0, badWipes = 0, eBack = 0, travelE = 0, wipes = 0;
    for (let i = 0; i < G.length; i++) {
      if (G[i].startsWith(`G1 E0 ${rF}`)) { unretracts++; if (G[i + 1] === P.unretractPause) pauses++; }
      if (/^G0 /.test(G[i]) && / E/.test(G[i])) travelE++;
      if (G[i].startsWith("; wipe")) {
        wipes++; let d = 0, prev = nums(G[i - 2]), lastE = 0, j = i + 1, mono = true;
        for (; j < G.length && /^G1 X/.test(G[j]); j++) { const n = nums(G[j]); d += Math.hypot(n.X - prev.X, n.Y - prev.Y); if (n.E > lastE + 1e-9) mono = false; lastE = n.E; prev = n; }
        if (Math.abs(d - wipeLen) > 0.01 || Math.abs(lastE + P.retraction) > 1e-6 || !mono) badWipes++;
      }
    }
    // E only grows while printing (between each G92 E0 and the wipe)
    let e = 0, printing = false;
    for (const l of G) { if (l === "G92 E0") { e = 0; printing = true; } if (l.startsWith("; wipe")) printing = false; const n = nums(l.split(";")[0]);
      if (printing && /^G1 X/.test(l) && n.E !== undefined) { if (n.E < e - 1e-9) eBack++; e = n.E; } }
    checks.push(check("copies started with an unretract", unretracts, "==", 2), check("each followed by the printer's pause", pauses, "==", 2),
      check("copies ended with a wipe", wipes, "==", 2), check("wipes not 4 mm along the line, pulling back the retraction steadily", badWipes, "==", 0),
      check("times E went backwards while printing", eBack, "==", 0), check("travel moves that extrude", travelE, "==", 0),
      check("ends with the printer's end lines", +G.includes("G1 X335 Y232 ; park"), "==", 1));
    // 3. time per layer: a 160 mm lap at 20 mm/s takes 8 s, so it's slowed to 8 mm/s (F480) to take 20 s
    const st = UNB.layerStack({ base: [], baseLayers: 0, wall: { x: Float64Array.from([0, 40, 40, 0]), y: Float64Array.from([0, 0, 40, 40]) }, wallLayers: 4, h }), lf = UNB.lapFeeds(st, 1200, 20, 120);
    checks.push(check("time per layer: every lap slowed to take 20 s (s off, worst lap)", Math.max(...st.laps.map((l) => Math.abs(l.length / lf.f[l.to] * 60 - 20))), "<=", 0.01),
      check("time per layer: whole stack (s)", Math.abs(lf.seconds - 20 * st.laps.length), "<=", 0.05), check("time per layer: laps that can't slow enough", lf.short, "==", 0),
      check("a floor of 10 mm/s: every layer counted as too quick (the rim lap is the top layer's)", UNB.lapFeeds(st, 1200, 20, 600).short, "==", st.laps.filter((l) => l.kind !== "wall-finish").length));
    const slow = UNB.exportGcode([{ x: st.x, y: st.y, z: st.z, e: st.e, f: lf.f }], { ox: 50, oy: 50, z: 0.3, lift: 5, feed: 1200, e: formula });
    checks.push(check("G-code carries the slowed feed (F480)", +/ F480$/m.test(slow), "==", 1), check("and not the full feed", +/ F1200$/m.test(slow), "==", 0));
    // 4. reading the file back for the preview: purge, fill, walls, travel and wipes each found, in order
    const sq = { x: Float64Array.from([0, 40, 40, 0]), y: Float64Array.from([0, 0, 40, 40]) }, ls = UNB.layerStack({ base: [sq], baseLayers: 2, wall: sq, wallLayers: 3, h });
    const lc = (dx) => ({ x: Float64Array.from(ls.x, (v) => v + dx), y: Float64Array.from(ls.y, (v) => v + 50), z: ls.z, e: ls.e, laps: ls.laps });
    const txt2 = UNB.exportGcode([lc(20), lc(100)], g), rd = UNB.readGcode(txt2), cnt = [0, 0, 0, 0, 0]; rd.kind.forEach((k) => cnt[k]++);
    checks.push(check("the file marks every layer (2 copies × 6 layers)", (txt2.match(/^; layer \d+ of 6 \((fill|wall)\)$/gm) || []).length, "==", 12),
      check("read back: walls, fill, travel, purge and wipe all found", +cnt.every((n) => n > 0), "==", 1), check("read back: one wipe per copy", cnt[4] >= 2 && cnt[4] <= 6 ? 1 : 0, "==", 1),
      check("read back: the purge line runs along the back edge (Y 232)", +[...rd.kind].every((k, i) => k !== 3 || (rd.seg[6 * i + 1] === 232 && rd.seg[6 * i + 4] === 232)), "==", 1));
    return { checks, notes: `choc OS needles ${runs.map((r) => `${r.nozzle} mm: ${r.perMM.toFixed(6)}`).join(", ")} E/mm; ${ePerMM.toFixed(6)} E/mm over ${len.toFixed(1)} mm, wipe ${wipe.toFixed(2)} mm; formula ${formula.toFixed(6)} E/mm with a ${P.cartridgeDiameter} mm cartridge` };
  },
};
