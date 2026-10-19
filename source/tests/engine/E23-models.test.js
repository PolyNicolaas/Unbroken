const UNB = require("../../engine/core.js"), M = require("../lib/meshes.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "E23", title: "Models: STL slices become one fitted line per layer, stacked into a spiral",
  guards: "STL files read wrongly, slices that miss or break a loop, walls on the wrong side of the surface, separate parts or holes left out, layers that don't add up to the model's height, and seams between layers",
  why: "A sliced model has to print the model: the chocolate's outside edge on its surface, every part and hole of a layer joined into the one line the needle can't stop, as many layers as the height holds, and each layer starting where the last one ended so the walls spiral up without a jump.",
  how: "Builds a 20 mm cylinder (64 sides), a 10 / 8 mm tube, two 5 mm posts 20 mm apart and a cone, as binary STL (and the cylinder as ASCII too). Reads them, stands them on the plate, slices them at 0.3 mm with an 18G needle (0.84 mm line, 1.34 mm spacing) and fits each layer with a series (0.05 mm). Measures radii, loops, connectors, layer counts, the start of each layer and the filled base. Then a 40 mm disc with 3 walls, and filled at 100, 50 and 25%, and a solid 24 mm cylinder at 25% on a 2-layer base.",
  pass: "Binary and ASCII read the same 384 triangles; a slice of the cylinder is one closed loop; its fitted line sits half a line width inside the surface (9.58 mm ± 0.05, the 64-sided polygon's middle) in under 20 terms; the tube's layer is its outside only (1 loop, no connector, nothing on its inner wall at 8.42 mm; was both walls until October 2026), its line at 9.58 mm; the posts' layer joins both posts; layers = ⌊(20 − 0.8) / 0.3⌋ + 1 = 65; each layer starts within 0.3 mm of the one below; a 2-layer filled base is longer than the wall; the cone's walls shrink from about 14.6 to 5 mm. A 40 mm disc with 3 walls has 3 loops joined by 2 connectors, the innermost 16.9 mm out; its fill at 50% is 35–65% as long as at 100%, at 25% under 40%; a solid model at 25% fills its wall layers (over 1.5× a hollow layer) while its base stays solid (over 1.5× a 25% layer).",
  async run() {
    const opt = { scale: 1, z0: 0.8, h: 0.3, base: 0, w: 0.84, d: 1.34, tol: 0.05 };
    const stack = (tris, o) => { const om = UNB.orientMesh(UNB.parseSTL(M.stl(tris)).tri, {}); const it = UNB.modelStack(om.tri, Object.assign({}, opt, o)); let r = it.next(); while (!r.done) r = it.next(); return r.value; };
    const radii = (L) => Array.from(L.x, (v, i) => Math.hypot(v, L.y[i]));
    // binary and ASCII
    const cyl = M.cylinder(10, 20), bin = UNB.parseSTL(M.stl(cyl));
    const ascii = "solid c\n" + cyl.map((t) => ` facet normal 0 0 0\n  outer loop\n${t.map((p) => `   vertex ${p.join(" ")}\n`).join("")}  endloop\n endfacet\n`).join("") + "endsolid c\n";
    const asc = UNB.parseSTL(new TextEncoder().encode(ascii));
    const om = UNB.orientMesh(bin.tri, {}), sl = UNB.sliceMesh(om.tri, 5);
    const layer = UNB.modelLayer(sl.map((f) => f.slice()), { w: 0.84, d: 1.34, tol: 0.05 }), rc = radii(layer), mean = rc.reduce((a, b) => a + b, 0) / rc.length;
    const tube = UNB.modelLayer(UNB.sliceMesh(UNB.orientMesh(UNB.parseSTL(M.stl(M.tube(10, 8, 20))).tri, {}).tri, 5), { w: 0.84, d: 1.34, tol: 0.05 }), rt = radii(tube);
    const near = (r0) => rt.filter((r) => Math.abs(r - r0) < 0.15).length / rt.length;
    const posts = stack([...M.cylinder(5, 10, -10, 0), ...M.cylinder(5, 10, 10, 0)]), pw = posts.walls[5];
    const C = stack(cyl), starts = C.walls.slice(1).map((L, i) => Math.hypot(L.x[0] - C.walls[i].x[0], L.y[0] - C.walls[i].y[0]));
    const F = stack(M.cylinder(10, 5), { base: 2, baseDensity: 1 }), len = (L) => { let s = 0; for (let i = 0; i < L.x.length; i++) { const j = (i + 1) % L.x.length; s += Math.hypot(L.x[j] - L.x[i], L.y[j] - L.y[i]); } return s; };
    const cone = stack(M.cone(15, 5, 15)), r0 = Math.max(...radii(cone.walls[0])), r1 = Math.max(...radii(cone.walls[cone.walls.length - 1]));
    // walls and solid fill: a 40 mm disc
    const disc = UNB.sliceMesh(UNB.orientMesh(UNB.parseSTL(M.stl(M.cylinder(20, 4))).tri, {}).tri, 2);
    const W3 = UNB.modelLayer(disc.map((f) => f.slice()), { w: 0.84, d: 1.34, walls: 3, tol: 0.05 }), r3 = radii(W3).sort((a, b) => a - b);
    const flen = (dens) => len(UNB.modelLayer(disc.map((f) => f.slice()), { w: 0.84, d: 1.34, walls: 1, tol: 0.05, fill: "lines", fillSpacing: 1.34 / dens }));
    const l100 = flen(1), l50 = flen(0.5), l25 = flen(0.25), wall1 = len(UNB.modelLayer(disc.map((f) => f.slice()), { w: 0.84, d: 1.34, tol: 0.05 }));
    const SD = stack(M.cylinder(12, 4), { infillDensity: 0.25, base: 2, baseDensity: 1 }), HO = stack(M.cylinder(12, 4), { infillDensity: 0, base: 2, baseDensity: 1 });
    return { checks: [
      check("3 walls: loops, connectors (3, 2)", +(W3.loops === 3 && W3.connectors === 2), "==", 1),
      check("3 walls: innermost wall off 20 − 0.42 − 2 × 1.34 (mm)", Math.abs(r3[Math.floor(0.05 * r3.length)] - 16.9), "<", 0.15),
      check("fill length at 50% ÷ at 100% (wall taken off)", (l50 - wall1) / (l100 - wall1), "<", 0.65), check("fill length at 50% ÷ at 100% (wall taken off) ", (l50 - wall1) / (l100 - wall1), ">", 0.35),
      check("fill length at 25% ÷ at 100% (wall taken off)", (l25 - wall1) / (l100 - wall1), "<", 0.4),
      check("solid 25%: wall layers filled (longer than a hollow one, ×)", len(SD.walls[2]) / len(HO.walls[2]), ">", 1.5),
      check("solid 25%: the base stays solid (longer than a 25% layer, ×)", len(SD.base[0]) / len(SD.walls[2]), ">", 1.5),
      check("binary and ASCII: same triangles (384)", +(bin.n === 384 && asc.n === 384), "==", 1),
      check("cylinder slice: closed loops", sl.length, "==", 1),
      check("cylinder layer: mean radius off 10 − 0.42 (mm)", Math.abs(mean - 9.58), "<", 0.05),
      check("cylinder layer: terms", layer.N, "<", 20),
      check("tube layer: outside only, 1 loop and no connector", +(tube.loops === 1 && tube.connectors === 0), "==", 1),
      check("tube layer: share of the line on the outer wall (9.58 mm)", near(9.58), ">", 0.95),
      check("tube layer: share of the line on the inner wall (8.42 mm), none: the inside is left to the fill", near(8.42), "==", 0),
      check("posts: one line reaches both (points left and right of centre)", +(pw.x.some((v) => v < -8) && pw.x.some((v) => v > 8)), "==", 1),
      check("cylinder: layers (⌊19.2 / 0.3⌋ + 1)", C.T, "==", 65),
      check("cylinder: furthest jump between layer starts (mm)", Math.max(...starts), "<", 0.3),
      check("filled base: 2 filled layers, each longer than a wall (×)", F.N === 2 ? len(F.base[0]) / len(F.walls[0]) : 0, ">", 3),
      check("cone: bottom wall radius (mm)", r0, ">", 14), check("cone: top wall radius (mm)", r1, "<", 6),
    ], notes: `cylinder layer: ${layer.N} terms, mean radius ${mean.toFixed(3)} mm; tube: ${tube.N} terms; cone ${cone.T} layers` };
  },
};
