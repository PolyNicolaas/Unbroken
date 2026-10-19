const S = require("../lib/scenes.js"), { trace, UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
const W = 0.84, D = 1.34, H = 0.3;
// a print's lines in plate millimetres (as the app hands them to UNB.layerStack)
const mm = (r) => { const f = r.fin.final, b = r.walk.bbox, n = f.re.length; return { x: Float64Array.from(f.re, (v) => (v - b.minX) * r.scale), y: Float64Array.from(f.im, (v) => (b.maxY - v) * r.scale) }; };
module.exports = {
  id: "E21", title: "Layers: flat filled base, spiralling walls, one continuous 3D path",
  guards: "layers that collide or leave gaps, a flow that doesn't ease in and out, a stack that stops or jumps, and G-code that travels through a finished print",
  why: "The choc mate 2 can't stop the flow, so the whole object is one path. A filled base prints flat (its layers are different paths, so they can't spiral onto each other), stepping up one layer height between layers. The walls are the same line every lap, so they spiral: every point one layer height above the same point of the lap below, with no seam. The first spiral lap climbs off the flat layer below, so its flow ramps up from nothing; a last level lap evens the rim, its flow ramping down. Copies print one after another, the needle lifting above everything printed before travelling.",
  how: "Traces the leaf at 50 mm with an 18G needle and 0.5 mm gap, with Lines infill (and the rows turned 90°) for the base and without for the walls, and stacks 2 base + 5 wall layers at 0.3 mm. Checks each lap's height and flow, the height difference between matching points of consecutive wall laps, that the path never breaks, and the total height. Repeats with no base and with an open path. Then writes G-code for 2 copies and reads back Z, E and the moves.",
  pass: "Base laps flat at 0, 0.3 mm; wall laps rise exactly 0.3 mm per lap with every point 0.3 mm above the lap below (within 1 µm); first spiral lap's flow goes 0 → 1, the last level lap's 1 → 0, all others 1; no step between points longer than 3 mm inside a copy; height = (layers − 1) × 0.3 mm; without a base the first wall layer is flat; open paths alternate direction, each layer flat, stepping straight up one layer where it turns, full flow; G-code: Z never above the top + lift, travel only between copies (2 G0 moves each) and E never decreases.",
  async run() {
    const checks = [];
    const leaf = S.sample("leaf"), opt = { spacingMM: D, lineMM: W, outW: 50 };
    const wall = mm(trace(leaf, opt)), baseA = mm(trace(leaf, { ...opt, fill: "lines" })), baseB = mm(trace(leaf, { ...opt, fill: "lines", fillAngle: 90 }));
    const st = UNB.layerStack({ base: [baseA, baseB], baseLayers: 2, wall, wallLayers: 5, h: H });
    const kinds = st.laps.map((l) => l.kind).join(",");
    checks.push(check("laps: base, base, first spiral lap, 4 spiral laps, level finish", +(kinds === "base,base,wall-start,wall,wall,wall,wall,wall-finish"), "==", 1));
    checks.push(check("base laps flat at 0 and 0.3 mm (mm off)", Math.max(...st.laps.slice(0, 2).map((l, i) => Math.max(Math.abs(l.z0 - i * H), Math.abs(l.z1 - i * H)))), "<=", 1e-9));
    // matching points of consecutive spiral laps (same line, same index) are exactly one layer apart
    const sp = st.laps.filter((l) => l.kind !== "base"); let worst = 0;
    for (let j = 1; j < sp.length - 1; j++) for (let i = 0; i <= sp[j].to - sp[j].from; i++) worst = Math.max(worst, Math.abs(st.z[sp[j].from + i] - st.z[sp[j - 1].from + i] - H));
    checks.push(check("wall laps: every point one layer above the lap below (mm off)", worst, "<=", 1e-6));
    const fin = sp[sp.length - 1]; let topOff = 0; for (let i = 0; i <= fin.to - fin.from; i++) topOff = Math.max(topOff, Math.abs(st.z[fin.from + i] - st.z[sp[sp.length - 2].to]));
    checks.push(check("finishing lap level at the top (mm off)", topOff, "<=", 1e-9));
    const e = (l, at) => st.e[at === 0 ? l.from : l.to];
    checks.push(check("first spiral lap: flow from 0 to 1", +(e(sp[0], 0) === 0 && Math.abs(e(sp[0], 1) - 1) < 1e-9), "==", 1), check("finishing lap: flow from 1 to 0", +(e(fin, 0) === 1 && Math.abs(e(fin, 1)) < 1e-9), "==", 1));
    checks.push(check("all other laps at full flow", Math.min(...st.laps.filter((l) => l.kind === "base" || l.kind === "wall").flatMap((l) => [...st.e.subarray(l.from, l.to + 1)])), "==", 1));
    let gap = 0; for (let i = 1; i < st.x.length; i++) gap = Math.max(gap, Math.hypot(st.x[i] - st.x[i - 1], st.y[i] - st.y[i - 1]));
    checks.push(check("never a step longer than 3 mm (the flow can't stop)", gap, "<=", 3));
    checks.push(check("height: (2 + 5 − 1) × 0.3 mm (mm off)", Math.abs(st.height - 6 * H), "<=", 1e-9));
    const nb = UNB.layerStack({ base: [], baseLayers: 0, wall, wallLayers: 4, h: H });
    checks.push(check("no base: first wall layer flat at 0, then spiral, height 0.9 mm", +(nb.laps[0].kind === "wall" && nb.laps[0].z1 === 0 && nb.laps[1].kind === "wall-start" && Math.abs(nb.height - 3 * H) < 1e-9), "==", 1));
    const op = { x: Float64Array.from([0, 10, 20]), y: Float64Array.from([0, 5, 0]) }, os = UNB.layerStack({ base: [], baseLayers: 0, wall: op, wallLayers: 3, h: H, open: true });
    checks.push(check("open path: laps alternate direction", +(os.x[os.laps[1].from] === 20 && os.x[os.laps[2].from] === 0), "==", 1));
    const flat = os.laps.every((l) => l.z0 === l.z1), steps = os.laps.slice(1).every((l, i) => { const a = os.laps[i].to, b = l.from; return os.x[a] === os.x[b] && os.y[a] === os.y[b] && Math.abs(os.z[b] - os.z[a] - H) < 1e-9; });
    checks.push(check("open path: each layer flat, stepping straight up one layer at the ends", +(flat && steps), "==", 1), check("open path: height 2 × 0.3 mm, full flow", +(Math.abs(os.height - 2 * H) < 1e-9 && os.e.every((v) => v === 1)), "==", 1));
    // G-code for two copies
    const copy = (dx) => ({ x: Float64Array.from(st.x, (v) => v + dx), y: st.y, z: st.z, e: st.e });
    const g = { ox: 0, oy: 0, z: 0.8, lift: 5, feed: 1200, e: 0.05 }, txt = UNB.exportGcode([copy(10), copy(80)], g);
    const zs = [...txt.matchAll(/ Z([\d.]+)/g)].map((m) => +m[1]), es = [...txt.matchAll(/ E([\d.]+)/g)].map((m) => +m[1]);
    checks.push(check("G-code: highest Z (mm) = first layer + height + lift", Math.max(...zs), "<=", 0.8 + st.height + 5 + 1e-3), check("G-code: G0 travel moves (2 per copy)", (txt.match(/^G0 /gm) || []).length, "==", 4));
    checks.push(check("G-code: E never decreases", +es.every((v, i) => !i || v >= es[i - 1]), "==", 1));
    return { checks, notes: `${st.laps.length} laps, ${(st.laps.reduce((a, l) => a + l.length, 0) / 1000).toFixed(2)} m of line, ${st.height.toFixed(2)} mm above the first layer` };
  },
};
