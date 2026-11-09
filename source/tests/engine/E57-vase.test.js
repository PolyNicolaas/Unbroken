const { UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
// a vase as the app makes it: 0.3 mm layers from 0.3 mm, the 18G needle (0.84 mm, 1.34 mm spacing), a bead holds 0.28 mm
const OPT = { z0: 0.3, h: 0.3, base: 0, w: 0.84, d: 1.34, tol: 0.05, overhang: 0.28 };
const run = (V, o) => { const it = UNB.vaseStack(V, Object.assign({}, OPT, o)); let r; while (!(r = it.next()).done); return r.value; };
const vase = (texture, move, profile) => Object.assign(UNB.vaseDefaults(), { height: 12, profile: profile || [[0, 15], [1, 15]], texture: Object.assign({ kind: "none", count: 8, depth: 2, twist: 0, spacing: 4 }, texture), move: Object.assign({ kind: "none", size: 0.5, count: 16, shift: 0 }, move) });
const radii = (L) => Array.from(L.x, (x, i) => Math.hypot(x, L.y[i]));
module.exports = {
  id: "E57", title: "Vases: a profile turned round, ribs and rings on the wall, a wave, zigzag or loops along the path, and the stacking check",
  guards: "a profile that misses its own points, a vase whose path doesn't follow its settings (radius, how many waves, twist), a jump between laps, loops that don't loop, and a shift that moves a lap off the one below without the check saying so",
  why: "Nicolaas (9 November 2026), after looking at clay printing apps: a vase from a profile curve you edit, with a surface texture and a movement pattern on the extrusion path. The path is written straight from the settings (no slicing), so the settings are the print: this test checks that the path is what was asked for, and that the check catches a lap that wouldn't sit on the one below.",
  how: "Makes 12 mm vases with 0.3 mm layers: a 15 mm cylinder (plain, with a 0.5 mm wave of 16, with 8 ribs 2 mm deep twisted 20°, with loops of 1 mm, 30 round); the wave shifted half a wave a layer; a 3-layer filled base; and a bulb's profile. Measures each lap's radius round it, counts the waves and the loops (runs where the needle goes backwards), finds the top rib's crest, and stacks the laps into the printed 3D path.",
  pass: "The profile passes through every point (to 0.001 mm); the plain cylinder is 15 mm all round on every lap (0.01) with 40 layers and nothing off the lap below; the wave spans 15 ± 0.5 mm with 16 waves a lap, and stacked straight is within 0.01 mm; shifted half a wave the check finds about 1 mm (2 × size) both ways; the ribs span 14–16 mm and the top rib's crest is at 20° (±2); loops: 30 backward runs a lap and a tight turn under half the bead; no step along the stacked path longer than 0.5 mm; the base: 3 filled layers inside the wall; the mesh is centred on its footprint.",
  run() {
    const checks = [];
    // the profile: a smooth curve through its points
    const bulb = UNB.VASE_SHAPES.bulb.profile, miss = Math.max(...bulb.map(([t, r]) => Math.abs(UNB.vaseRadius(bulb, t) - r)));
    checks.push(check("profile through its points (mm)", miss, "<=", 0.001));
    // a plain cylinder
    const plain = run(vase());
    const pr = plain.walls.flatMap(radii);
    checks.push(check("plain: layers (12 mm at 0.3 from 0.3)", plain.T, "==", 40), check("plain: radius off 15 mm (worst)", Math.max(...pr.map((r) => Math.abs(r - 15))), "<=", 0.01), check("plain: off the lap below (mm)", Math.max(plain.stacking.out, plain.stacking.in), "<=", 0.01));
    // a wave: 16 round, ±0.5 mm
    const wave = run(vase({}, { kind: "wave" })), wr = radii(wave.walls[5]);
    let peaks = 0;
    for (let i = 0; i < wr.length; i++) { const a = wr[(i - 1 + wr.length) % wr.length], c = wr[(i + 1) % wr.length]; if (wr[i] > a && wr[i] >= c && wr[i] > 15.25) peaks++; }
    checks.push(check("wave: widest (mm)", +Math.max(...wr).toFixed(3), "<=", 15.51), check("wave: … at least", +Math.max(...wr).toFixed(3), ">=", 15.49), check("wave: waves a lap", peaks, "==", 16), check("wave, no shift: off the lap below (mm)", Math.max(wave.stacking.out, wave.stacking.in), "<=", 0.01));
    // shifted half a wave each layer: every lap moves 2 × size off the one below, and the check says so
    const alt = run(vase({}, { kind: "wave", shift: 0.5 }));
    checks.push(check("wave, shifted ½: out (mm)", alt.overhang.worst, ">=", 0.9), check("… in (mm)", alt.stacking.in, ">=", 0.9), check("… no more than 2 × size (mm)", Math.max(alt.stacking.out, alt.stacking.in), "<=", 1.02), check("… past what a bead holds, inwards (mm)", alt.overhang.inWorst, ">", 0.5));
    // ribs: 8, 2 mm deep, twisted 20° bottom to rim; the top lap's widest point at 20° (mod 45°)
    const ribs = run(vase({ kind: "ribs", twist: 20 })), top = ribs.walls[ribs.walls.length - 1], rr = radii(top);
    let bi = 0;
    rr.forEach((r, i) => { if (r > rr[bi]) bi = i; });
    const ang = ((Math.atan2(top.y[bi], top.x[bi]) * 180) / Math.PI + 360) % 45, twistAt = (20 * (OPT.z0 + (ribs.T - 1) * OPT.h + OPT.h)) / 12; // (the top lap's crest: the twist at its height, as it climbs)
    checks.push(check("ribs: narrowest (mm)", +Math.min(...rr).toFixed(2), ">=", 13.99), check("ribs: widest (mm)", +Math.max(...rr).toFixed(2), "<=", 16.01), check("ribs: top crest off the twist (degrees)", Math.abs(ang - Math.min(20, twistAt)), "<=", 2));
    // loops: 30 round, 1 mm (2π × 1 > 2π × 15 / 30, so they loop)
    const loops = run(vase({}, { kind: "loops", size: 1, count: 30 })), L = loops.walls[3], n = L.x.length;
    const backAt = (i) => { const j = (i + 1) % n, a = Math.atan2(L.y[i], L.x[i]), b = Math.atan2(L.y[j], L.x[j]); return ((b - a + 3 * Math.PI) % (2 * Math.PI)) - Math.PI < 0; };
    let back = 0, was = backAt(n - 1);   // (a run going round the lap's start counts once)
    for (let i = 0; i < n; i++) {
      const now = backAt(i);
      if (now && !was) back++;
      was = now;
    }
    checks.push(check("loops: backward runs a lap", back, "==", 30), check("loops: tightest turn (mm radius) under half the bead", +(loops.tightest.r < 0.42), "==", 1));
    // the printed path: no jump between laps (or anywhere)
    let jump = 0;
    for (const R of [wave, alt, loops]) {
      const S = UNB.layerStack({ base: [], baseLayers: 0, walls: R.walls, wallLayers: R.walls.length, h: OPT.h, open: false });
      for (let i = 1; i < S.x.length; i++) jump = Math.max(jump, Math.hypot(S.x[i] - S.x[i - 1], S.y[i] - S.y[i - 1]));
    }
    checks.push(check("stacked path: longest step (mm)", +jump.toFixed(3), "<=", 0.5));
    // a filled base under the wall
    const based = run(vase({}, { kind: "wave" }), { base: 3, baseDensity: 1, basePattern: "lines" });
    const inside = based.base.every((B) => radii(B).every((r) => r <= 15.6));
    checks.push(check("base: filled layers", based.N, "==", 3), check("base: inside the wall (15 + bead's half)", +inside, "==", 1), check("base: filled, not just a ring (shortest point to the middle, mm)", +Math.min(...based.base.map((B) => Math.min(...radii(B)))).toFixed(1), "<=", 2));
    // the mesh: centred on its footprint
    const M = UNB.vaseMesh(vase({ kind: "ribs", count: 3 }, { kind: "none" }), { h: 0.3 });
    const xs = M.rows.flatMap((r) => Array.from(r.x)), ys = M.rows.flatMap((r) => Array.from(r.y));
    checks.push(check("mesh rows centred (mm)", +Math.max(Math.abs(Math.max(...xs) + Math.min(...xs)), Math.abs(Math.max(...ys) + Math.min(...ys))).toFixed(3), "<=", 0.01));
    return { checks, notes: `wave peaks ${peaks}; shifted ½: out ${alt.stacking.out.toFixed(2)}, in ${alt.stacking.in.toFixed(2)} mm; top rib at ${ang.toFixed(1)}° (twist ${twistAt.toFixed(1)}°); loops ${back} a lap, tightest ${loops.tightest.r.toFixed(2)} mm; longest step ${jump.toFixed(3)} mm; ${plain.points} points a lap` };
  },
};
