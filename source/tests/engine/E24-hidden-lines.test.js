const UNB = require("../../engine/core.js"), M = require("../lib/meshes.js"), { check } = require("../lib/check.js");
const box = (x0, y0, z0, x1, y1, z1) => { const P = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], F = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]]; return F.map((f) => f.map((i) => P[i])); };
module.exports = {
  id: "E24", title: "3D → 2D: a model drawn as lines, hidden lines removed",
  guards: "hidden edges drawn through the model, outlines lost on curved surfaces, the flat-face diagonals of a mesh drawn as lines, and a fold angle that doesn't thin the drawing",
  why: "Draw this view turns a model into a line drawing to trace (after plotter.vision). Only what you'd see should be drawn: the outline, open edges and folds, with everything behind the model removed, and no lines where the mesh splits a flat face into triangles.",
  how: "Draws a 30 × 20 × 10 mm box, a cone and a torus seen from the preview's starting angle (yaw −0.6, pitch 0.55) at 600 px, with folds over 1° and over 30°, and counts the visible pieces of edge.",
  pass: "The box shows 9 of its 12 edges (the 3 at the back corner are hidden) and none of its 6 face diagonals; the cone at 30° is its outline and rims only (under 120 pieces, far fewer than at 1°), and at 1° shows the side's facets; the torus at 30° has a line in every direction round its centre (its outline has no gaps).",
  async run() {
    const draw = (T, crease) => UNB.hiddenLines(UNB.orientMesh(UNB.parseSTL(M.stl(T)).tri, {}).tri, { yaw: -0.6, pitch: 0.55, size: 600, crease });
    const B = draw(box(0, 0, 0, 30, 20, 10), 30), C30 = draw(M.cone(15, 5, 20), 30), C1 = draw(M.cone(15, 5, 20), 1);
    // torus
    const torus = (R, r, a = 48, b = 24) => { const T = [], P = (i, j) => { const u = 2 * Math.PI * i / a, v = 2 * Math.PI * j / b; return [(R + r * Math.cos(v)) * Math.cos(u), (R + r * Math.cos(v)) * Math.sin(u), r * Math.sin(v)]; }; for (let i = 0; i < a; i++) for (let j = 0; j < b; j++) { const A = P(i, j), Bq = P(i + 1, j), Cq = P(i + 1, j + 1), D = P(i, j + 1); T.push([A, Bq, Cq], [A, Cq, D]); } return T; };
    const T30 = draw(torus(15, 5), 30);
    // the torus's outer outline: for each direction from the centre, the furthest drawn point; gaps show as missing directions
    const cx = T30.w / 2, cy = T30.h / 2, hit = new Uint8Array(360);
    for (let i = 0; i < T30.segs.length; i += 4) for (let u = 0; u <= 1; u += 0.1) { const x = T30.segs[i] + u * (T30.segs[i + 2] - T30.segs[i]), y = T30.segs[i + 1] + u * (T30.segs[i + 3] - T30.segs[i + 1]); hit[Math.floor((Math.atan2(y - cy, x - cx) * 180 / Math.PI + 360) % 360)] = 1; }
    const missing = hit.reduce((n, v) => n + (v ? 0 : 1), 0);
    return { checks: [
      check("box: visible edges (9 of 12)", B.segs.length / 4, "==", 9),
      check("cone at 30°: pieces (outline and rims)", C30.segs.length / 4, "<", 120),
      check("cone at 1°: more pieces than at 30° (×)", C1.segs.length / Math.max(1, C30.segs.length), ">", 1.3),
      check("torus at 30°: directions round the centre with no line", missing, "==", 0),
      check("torus at 30°: drawn edges", T30.edges, ">", 50),
    ], notes: `box ${B.segs.length / 4} pieces; cone ${C30.segs.length / 4} at 30°, ${C1.segs.length / 4} at 1°; torus ${T30.segs.length / 4} at 30°` };
  },
};
