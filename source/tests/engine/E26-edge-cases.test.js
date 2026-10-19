const { UNB } = require("../lib/trace.js"), M = require("../lib/meshes.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "E26", title: "Edge cases found in the October 2026 bug hunt stay fixed",
  guards: "NaN lines from a one-pixel drawing, straight lines measured as a dot, closed walks offset differently at their seam, open slices split in two, line ends that don't join across a grid boundary, padded STL files rejected, and small mm drawings or many small shapes that take seconds",
  why: "Each of these was a real bug found by an independent review: a crash or a near-hang on a full stop in a small font, a wrong plate footprint, a strand kinked at the seam of a closed line, a broken wall on a model with a hole, a plotter drawing with gaps, a valid STL that wouldn't open, and a page that froze on Smooth curves or Smallest shape.",
  how: "Builds the smallest input for each case and checks the result: a one-pixel line map through buildWalk; minBox of three points in a row; mirror of 0 and 1 points; offsetDoubled of a closed square with only the edges before the seam doubled; sliceMesh of an open folded wall listed out of order; chainSegments with ends either side of a cell boundary; a binary STL with 16 padding bytes; toBezier of an 8000-point spiral 40 mm wide; penFills with Smallest shape on a grid of 6400 cells.",
  pass: "No walk (null) for one pixel; the straight line's box is 12 × 2; mirror returns the points as given; the seam point is offset the same at both ends; one open chain of 9 points; the two segments join into one line; the padded STL reads 4 triangles; the spiral smooths in under 1 s; the grid's shapes merge in under 2 s.",
  async run() {
    const checks = [];
    const one = new Uint8Array(20 * 20); one[10 * 20 + 10] = 1;
    checks.push(check("one-pixel line map: no walk", +(UNB.buildWalk(one, 20, 20, {}) === null), "==", 1));
    const box = UNB.minBox([0, 5, 10], [0, 0, 0], 1);
    checks.push(check("straight line: box 12 × 2 mm", +(Math.abs(box.w - 12) < 1e-9 && Math.abs(box.h - 2) < 1e-9), "==", 1));
    checks.push(check("mirror of 0 and 1 points", +(UNB.mirror([], []).x.length === 0 && UNB.mirror([3], [4]).x[0] === 3), "==", 1));
    const pts = [[0, 0], [5, 0], [10, 0], [10, 5], [10, 10], [5, 10], [0, 10], [0, 5], [0, 0]], m = pts.length;
    const walk = { px: Float64Array.from(pts, (p) => p[0]), py: Float64Array.from(pts, (p) => p[1]), dbl: new Uint8Array(m), side: new Int8Array(m).fill(1), tip: new Uint8Array(m), jd: new Float32Array(m).fill(1e9), open: false };
    walk.dbl[m - 2] = walk.dbl[m - 3] = 1;
    const o = UNB.offsetDoubled(walk, 2, {});
    checks.push(check("closed walk: seam point offset the same at both ends (mm apart)", Math.hypot(o.x[0] - o.x[m - 1], o.y[0] - o.y[m - 1]), "<", 1e-9));
    const P = [[0, 0], [1, 1], [2, 0], [3, 1], [4, 0]], quads = [];
    for (let i = 0; i < 4; i++) { const [ax, ay] = P[i], [bx, by] = P[i + 1]; quads.push([ax, ay, 0, bx, by, 0, bx, by, 1, ax, ay, 0, bx, by, 1, ax, ay, 1]); }
    const loops = UNB.sliceMesh(Float32Array.from([2, 0, 1, 3].flatMap((q) => quads[q])), 0.5);
    checks.push(check("open wall sliced: one chain of 9 points", +(loops.length === 1 && loops[0].length === 18), "==", 1));
    const chains = UNB.chainSegments([0, 0, 0.24, 0, 0.26, 0, 1, 0], 0.5);
    checks.push(check("segment ends 0.02 apart across a cell boundary: joined", chains.length, "==", 1));
    const quad = [[[0, 0, 0], [1, 0, 0], [1, 1, 0]], [[0, 0, 0], [1, 1, 0], [0, 1, 0]], [[0, 0, 1], [1, 0, 1], [1, 1, 1]], [[0, 0, 1], [1, 1, 1], [0, 1, 1]]];
    const bin = M.stl(quad), padded = new Uint8Array(bin.length + 16); padded.set(bin);
    let readN = -1; try { readN = UNB.parseSTL(padded).n; } catch (e) { readN = -1; }
    checks.push(check("binary STL with 16 padding bytes: triangles read", readN, "==", 4));
    const n = 8000, sx = new Float64Array(n), sy = new Float64Array(n);
    for (let i = 0; i < n; i++) { const t = i / n * 2 * Math.PI * 40, r = 20 * (0.1 + 0.9 * i / n); sx[i] = 20 + r * Math.cos(t); sy[i] = 20 + r * Math.sin(t); }
    let t0 = Date.now(); UNB.toBezier(sx, sy, true);
    checks.push(check("8000-point spiral, 40 mm: smooth curves (ms)", Date.now() - t0, "<", 1000));
    const k = 80, gx = [], gy = [];
    for (let r = 0; r <= k; r++) { const a = r % 2 ? [k, 0] : [0, k]; gx.push(a[0] * 2, a[1] * 2); gy.push(r * 2, r * 2); }
    for (let c = 0; c <= k; c++) { const a = c % 2 ? [k, 0] : [0, k]; gx.push(c * 2, c * 2); gy.push(a[0] * 2, a[1] * 2); }
    t0 = Date.now(); UNB.penFills({ x: Float64Array.from(gx), y: Float64Array.from(gy) }, false, { pen: 0.3, cell: 0.25, minShape: 5 });
    checks.push(check("6400-cell grid with Smallest shape (ms)", Date.now() - t0, "<", 2000));
    return { checks };
  },
};
