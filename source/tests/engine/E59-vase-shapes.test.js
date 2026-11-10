const { UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
// as E57: 0.3 mm layers, the 18G needle (0.84 mm wide, 1.34 mm apart), a bead holds 0.28 mm
const OPT = { z0: 0.3, h: 0.3, base: 0, w: 0.84, d: 1.34, tol: 0.05, overhang: 0.28 };
const run = (V, o) => { const it = UNB.vaseStack(V, Object.assign({}, OPT, o)); let r; while (!(r = it.next()).done); return r.value; };
const vase = (more) => Object.assign(UNB.vaseDefaults(), { height: 12, profile: [[0, 15], [1, 15]], texture: { kind: "none", count: 8, depth: 2, twist: 0, spacing: 4 }, move: { kind: "none", size: 1, count: 12, shift: 0, flip: 0 } }, more);
const radii = (L) => Array.from(L.x, (x, i) => Math.hypot(x, L.y[i]));
const far = (L) => { let b = 0, at = 0; for (let i = 0; i < L.x.length; i++) { const r = Math.hypot(L.x[i], L.y[i]); if (r > b) { b = r; at = i; } } return (Math.atan2(L.y[at], L.x[at]) * 180) / Math.PI; };
const mid = (L) => [L.x.reduce((a, v) => a + v, 0) / L.x.length, L.y.reduce((a, v) => a + v, 0) / L.y.length];
// within tol of a value: how far off it is, ≤ tol
const near = (name, v, want, tol) => check(`${name}: off by (want ${+want.toFixed(2)})`, +Math.abs(v - want).toFixed(3), "<=", tol);
const last = (R) => R.walls[R.walls.length - 1];

module.exports = {
  id: "E59",
  title: "Vase shapes: polygons, stars, flowers and a drawing's outline seen from above, twisting, blending to the rim, leaning; strength curves, grid, weave and diamond textures, a lattice, flared and rolled rims",
  guards: "UNB.vaseStack and UNB.vaseOutline (17-vase.js): the vase's plan, twist, planTop, lean, strength, texture kinds, move.flip and rim",
  why: "Added 10 November 2026 so vases can be more than round: each option has to make the shape it says, and the checks (each lap on the one below) have to stay honest about it: a lattice's flip layers bridge on purpose, a rolled rim's second bead steps in a bead's hold at a time.",
  how: "Builds 12 mm vases of radius 15 with each option and measures the laps: the reach round a hexagon and a 5-point star, which way a triangle's corner points at the bottom and the rim with a 60° twist, a circle blending to a star, the middle of the rim with a 10 mm lean, the wave's size with a fade-in strength, the grid, weave and diamond depths, a lattice flipping every 2 layers, a 5 mm flare and a rolled rim. Then a heart drawn as a line becomes a plan, two circles joined by the line give the larger, and the heart vase's spiral base fills it.",
  pass: "Hexagon: reach 15 at the corners, 13.0 (15 cos 30°) between (±0.15); star: 15 and 9 (±0.3); triangle's corner at 0° at the bottom and 60° at the rim (±3°); circle to star: round at the bottom (spread < 0.3 mm, its first lap 2–5% up), star at the rim (spread over 3 mm); lean: the rim's middle 10 mm over (±0.3), the bottom's within 0.4; fade-in: hardly a wave at the bottom (< 0.15 mm), all of it at the rim (over 1.8 mm across); grid, weave, diamond: within their depth; lattice: bridges every 2 layers, each lap otherwise on the one below, spans from 2πR ÷ 24 to 1.4 times that (the wave is longer than the wall); flare: the rim 5 mm out (±0.2); rolled: laps doubled, the second ring 1.34 mm in at the top, never stepping in more than a bead holds; the heart: one piece, two circles: two (the larger used), the heart vase's spiral base reaches every part of it.",
  async run() {
    const checks = [];
    const hex = radii(run(vase({ plan: { kind: "polygon", sides: 6, round: 0 } })).walls[0]);
    checks.push(near("hexagon: furthest (mm)", +Math.max(...hex).toFixed(2), 15, 0.15), near("hexagon: nearest, mid-side (mm)", +Math.min(...hex).toFixed(2), 12.99, 0.15));
    const star = radii(run(vase({ plan: { kind: "star", sides: 5, depth: 0.4, round: 0 } })).walls[0]);
    checks.push(near("star: points (mm)", +Math.max(...star).toFixed(2), 15, 0.3), near("star: between them (mm)", +Math.min(...star).toFixed(2), 9, 0.3));
    const tw = run(vase({ plan: { kind: "polygon", sides: 3, round: 0 }, twist: 60 }));
    checks.push(near("twist: a corner at the bottom (°)", +far(tw.walls[0]).toFixed(1), 0, 3), near("twist: and at the rim (°)", +far(last(tw)).toFixed(1), 60, 3));
    const mo = run(vase({ planTop: { kind: "star", sides: 6, depth: 0.3, round: 0.2 } })), sp = (L) => { const r = radii(L); return Math.max(...r) - Math.min(...r); };
    checks.push(check("circle to star: round at the bottom (mm spread; the first lap is 2–5% of the way up)", +sp(mo.walls[0]).toFixed(3), "<", 0.3), check("… a star at the rim (mm spread)", +sp(last(mo)).toFixed(2), ">", 3));
    const le = run(vase({ lean: { size: 10, dir: 90, curve: "straight" } })), m0 = mid(le.walls[0]), m1 = mid(last(le));
    checks.push(check("lean: the bottom's middle (mm off)", +Math.hypot(m0[0], m0[1]).toFixed(2), "<", 0.4), near("lean: the rim's middle, sideways (mm)", +m1[1].toFixed(2), 10, 0.3));
    const fi = run(vase({ move: { kind: "wave", size: 1, count: 12, shift: 0, flip: 0 }, strength: { texture: null, move: [[0, 0], [1, 1]] } }));
    checks.push(check("fade-in: the wave at the bottom (mm across; 2–5% of the way up)", +sp(fi.walls[0]).toFixed(3), "<", 0.15), check("… at the rim (mm across)", +sp(last(fi)).toFixed(2), ">", 1.8));
    for (const kind of ["grid", "weave", "diamond"]) {
      const R = run(vase({ texture: { kind, count: 10, depth: 2, twist: 45, spacing: 4 } }));
      checks.push(check(`${kind}: no deeper than its depth (mm across)`, +Math.max(...R.walls.map(sp)).toFixed(2), "<=", 2.05));
    }
    const la = run(vase({ move: { kind: "wave", size: 1.5, count: 12, shift: 0, flip: 2 } }));
    checks.push(check("lattice: flips (layers that bridge)", la.lattice.bridges, "==", la.walls.filter((L, k) => k > 0 && Math.floor(k / 2) % 2 !== Math.floor((k - 1) / 2) % 2).length), check("lattice: otherwise each lap on the one below (mm)", +la.overhang.worst.toFixed(2), "<=", 0.28),
      check("lattice: the span, crossing to crossing, at least the wall's (mm)", +la.lattice.span.toFixed(2), ">=", (2 * Math.PI * 15) / 24), check("… and no more than the wave's own length (mm)", +la.lattice.span.toFixed(2), "<=", (1.4 * 2 * Math.PI * 15) / 24));
    const fl = run(vase({ rim: { kind: "flare", size: 5, height: 6 }, height: 12 }));
    checks.push(near("flare: the rim (mm)", +Math.max(...radii(last(fl))).toFixed(2), 20, 0.2));
    const ro = run(vase({ rim: { kind: "rolled", height: 4 } })), top = last(ro), inner = radii(top.parts[1]);
    checks.push(check("rolled: the top laps doubled", ro.walls.filter((L) => L.parts).length, ">=", 12), near("rolled: the inner ring at the top (mm in)", +(15 - Math.max(...inner)).toFixed(2), 1.34, 0.05), check("rolled: no step in past a bead's hold (mm)", +ro.overhang.inWorst.toFixed(2), "<=", 0.02));
    // a drawing's outline: a heart drawn as a line; two circles the line joins
    const hx = [], hy = []; for (let i = 0; i < 400; i++) { const t = (2 * Math.PI * i) / 400; hx.push(16 * Math.sin(t) ** 3); hy.push(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)); }
    const H = UNB.vaseOutline(hx, hy);
    const cx = [], cy = []; for (let i = 0; i < 300; i++) { const t = (2 * Math.PI * i) / 300; cx.push(10 * Math.cos(t)); cy.push(10 * Math.sin(t)); } for (let i = 0; i < 300; i++) { const t = (2 * Math.PI * i) / 300; cx.push(30 + 5 * Math.cos(t)); cy.push(5 * Math.sin(t)); }
    const two = UNB.vaseOutline(cx, cy), twoR = [];
    for (let i = 0; i < two.loop.length; i += 2) twoR.push(Math.hypot(two.loop[i], two.loop[i + 1]));
    const hv = run(vase({ plan: { kind: "drawing", loop: H.loop, round: 0 } }), { base: 2, baseDensity: 1, basePattern: "spiral" });
    checks.push(check("heart: one piece, its furthest point 1", +(H.pieces === 1) + +(Math.abs(Math.max(...radii({ x: H.loop.filter((_, i) => i % 2 === 0), y: H.loop.filter((_, i) => i % 2) })) - 1) < 0.01), "==", 2),
      check("two circles: two pieces, the larger used (round: spread of reach)", +(two.pieces === 2) + +(Math.max(...twoR) - Math.min(...twoR) < 0.05), "==", 2),
      check("heart vase: a spiral base", +(hv.spiralBase === true) + +(hv.N === 2), "==", 2));
    return { checks };
  },
};
