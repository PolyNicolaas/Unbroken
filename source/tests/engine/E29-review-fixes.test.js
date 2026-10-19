const { UNB, trace } = require("../lib/trace.js"), S = require("../lib/scenes.js"), M = require("../lib/meshes.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "E29", title: "Engine fixes from the October 2026 code review stay fixed, and models can be cut",
  guards: "a kink in the line beside a junction on small prints, an error readout that reports the strands' deliberate offset as fitting error, connector lanes that slow to seconds on a drawing with many loose ends, a model cut that slices the wrong part, a hollow model whose inside surface is traced too, a sparse fill that leaves out an inner ring, and a model of overlapping shells whose body is taken for a hole",
  why: "Found by the review in REVIEW.md. Junction distances were only recorded 40 px out, but single strokes ease over twice the spacing, so past a 20 px spacing the ease stopped short and the line jumped up to 4 px. The error compared the drawn line with the drawing's centre line, which doubled strokes sit half a spacing off on purpose (the leaf read 0.47 mm). Each loose end ran a route search over the whole image with lanes painted.",
  how: "A circle with one spoke, offset at 10 and 30 px spacing: the largest change in offset between neighbouring single-stroke points. The leaf traced at 37 mm with a 1.34 mm spacing: its error. A comb of 64 teeth (128 loose ends) on a 400 px grid, walked with and without a painted lane: the time and the points. A 20 mm cone (point on top) sliced whole and cut 2 mm from the bottom and 8 mm from the top. A tube with a 1.5 mm wall. A 32 mm heart outline filled with rings at 25% (found printing a heart in October 2026: a ring that neither ran beside the others nor came near the line was left out). A 10 mm cylinder with a block overlapping its side where its outline starts (found with a mug and its handle: the body's first point fell inside the handle, so the body counted as a hole and only the handle printed).",
  pass: "Offset changes at most 1 px between neighbours at both spacings; the walk records junction distances at least 120 px out; the leaf's error is under 0.15 mm (a third of the old reading); the comb with a lane walks in under 1.5 s and covers at least as many points as without; the cut cone is 10 mm tall in 33 layers, its top layer at least 3.3 mm in radius and its first at least 8.3 mm; the tube prints one loop at radius 9.58 ± 0.1 mm (its outside only); the heart's line is at least 210 mm (203 with the ring left out); every layer of the cylinder + block prints at least the cylinder's outline (60 mm, not just the block's 16).",
  async run() {
    const checks = [], { plotLine } = UNB._u;
    // 1. junction ease: circle + spoke
    const w = 900, h = 900, L = new Uint8Array(w * h);
    let px = null, py = null;
    for (let a = 0; a <= 360; a += 0.5) { const x = 450 + 350 * Math.cos(a * Math.PI / 180), y = 450 + 350 * Math.sin(a * Math.PI / 180); if (px !== null) plotLine(L, w, h, px, py, x, y); px = x; py = y; }
    plotLine(L, w, h, 450, 450, 800, 450);
    const walk = UNB.buildWalk(UNB.thin(L, w, h), w, h, {});
    let reach = 0; for (const v of walk.jd) if (Number.isFinite(v)) reach = Math.max(reach, v);
    checks.push(check("junction distances recorded out to (px)", reach, ">=", 120));
    for (const d of [10, 30]) {
      const o = UNB.offsetDoubled(walk, d, { loops: true }); let step = 0;
      for (let i = 1; i < o.x.length; i++) {
        const a = o.idx[i - 1], b = o.idx[i]; if (b !== a + 1 || walk.dbl[a] || walk.dbl[b]) continue;
        const off = (k, X, Y) => Math.hypot(X - walk.px[k], Y - walk.py[k]);
        step = Math.max(step, Math.abs(off(b, o.x[i], o.y[i]) - off(a, o.x[i - 1], o.y[i - 1])));
      }
      checks.push(check(`spacing ${d} px: largest change in offset between neighbours (px)`, step, "<=", 1));
    }
    // 2. the error readout measures the fit, not the strands' offset
    const r = trace(S.sample("leaf"), { spacingMM: 1.34, lineMM: 0.84, outW: 37 });
    checks.push(check("leaf at 37 mm, 1.34 mm spacing: error (mm)", r.fin.err.score * r.scale, "<", 0.15));
    // 3. connector lanes on a drawing with many loose ends
    const W = 400, C = new Uint8Array(W * W);
    for (let x = 10; x < W - 10; x++) C[(W / 2) * W + x] = 1;
    for (let x = 12; x < W - 12; x += 6) for (let y = W / 2 - 30; y < W / 2 + 30; y++) C[y * W + x] = 1;
    const lanes = new Uint8Array(W * W); for (let i = 0; i < W; i++) lanes[10 * W + i] = 1;
    const plain = UNB.buildWalk(C, W, W, {}), t0 = performance.now(), laned = UNB.buildWalk(C, W, W, { lanes }), ms = performance.now() - t0;
    checks.push(check("comb, 128 loose ends, with a lane: walk time (ms)", ms, "<", 1500), check("… points covered, lane − none", laned.px.length - plain.px.length, ">=", 0));
    // 4. cutting a model: a cone (point at the top) cut 8 mm below its point and 2 mm above its base prints only the
    //    part between: fewer layers, its top layer still wide, its first layer the cone's width 2 mm up
    const om = UNB.orientMesh(UNB.parseSTL(M.stl(M.cone(10, 0, 20))).tri, {}), run = (o) => { const it = UNB.modelStack(om.tri, Object.assign({ scale: 1, z0: 0.3, h: 0.3, base: 0, w: 0.84, d: 1.34, tol: 0.05 }, o)); let x = it.next(); while (!x.done) x = it.next(); return x.value; };
    const whole = run({}), cut = run({ cutTop: 8, cutBottom: 2 }), rmax = (L) => Math.max(...Array.from(L.x, (v, i) => Math.hypot(v, L.y[i])));
    checks.push(check("cone 20 mm, cut 2 + 8 mm: height (mm)", cut.height, "==", 10), check("… layers (whole: " + whole.T + ")", cut.T, "==", Math.floor((10 - 0.3) / 0.3 + 1e-9) + 1),
      check("… top layer radius (mm; the cone is 4 mm wide 12 mm up)", rmax(cut.walls[cut.walls.length - 1]), ">=", 3.3),
      check("… first layer radius (mm; 9 mm at 2 mm up)", rmax(cut.walls[0]), ">=", 8.3));
    // 5. a hollow model prints its outside contour only: a tube with a 1.5 mm wall gives one loop half a line width
    //    inside its outer surface (radius 9.58), nothing along the inner surface
    const tube = UNB.orientMesh(UNB.parseSTL(M.stl(M.tube(10, 8.5, 10))).tri, {}), it = UNB.modelStack(tube.tri, { scale: 1, z0: 0.3, h: 0.3, base: 0, w: 0.84, d: 1.34, tol: 0.05 });
    let tr = it.next(); while (!tr.done) tr = it.next();
    const rr = Array.from(tr.value.walls[5].x, (v, i) => Math.hypot(v, tr.value.walls[5].y[i]));
    checks.push(check("tube with a 1.5 mm wall: one loop, outside only (radius spread, mm)", Math.max(...rr) - Math.min(...rr), "<", 0.1),
      check("… half a line width inside the outer surface (mm from 9.58)", Math.abs((Math.max(...rr) + Math.min(...rr)) / 2 - 9.58), "<", 0.1));
    // 6. a sparse ring fill keeps every ring: one that can't be bridged side by side, and is too far from the line to be
    //    spliced into it, is linked in with connector strands
    const HP = []; for (let i = 0; i < 720; i++) { const t = 2 * Math.PI * i / 720; HP.push(16 * Math.sin(t) ** 3, 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)); }
    const heart = UNB.modelLayer([HP], { w: 0.84, d: 1.34, tol: 0.05, fill: "rings", fillSpacing: 0.84 / 0.25 });
    checks.push(check("heart, rings at 25%: line length (mm; 203 with an inner ring left out)", heart.length, ">=", 210));
    // 7. overlapping shells: a block overlapping the cylinder's side where its outline starts (angle 0, x = r)
    const cb = UNB.orientMesh(UNB.parseSTL(M.stl([...M.cylinder(10, 10), ...M.box(8, -2, 0, 14, 2, 10)])).tri, {}), it2 = UNB.modelStack(cb.tri, { scale: 1, z0: 0.3, h: 0.3, base: 0, w: 0.84, d: 1.34, tol: 0.05 });
    let r2 = it2.next(); while (!r2.done) r2 = it2.next();
    const lens = r2.value.walls.map((L) => { let l = 0; for (let i = 1; i < L.x.length; i++) l += Math.hypot(L.x[i] - L.x[i - 1], L.y[i] - L.y[i - 1]); return l; });
    checks.push(check("cylinder + overlapping block: shortest layer's line (mm; the cylinder alone is ~60, the block 16)", Math.min(...lens), ">=", 60));
    return { checks, notes: `leaf error ${(r.fin.err.score * r.scale).toFixed(3)} mm; lane walk ${ms.toFixed(0)} ms` };
  },
};
