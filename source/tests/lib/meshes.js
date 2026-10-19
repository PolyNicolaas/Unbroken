// Small meshes for the model tests: solids of revolution (cylinder, tube, cone) as triangles, and binary STL bytes.
function revolve(profile, segs, cx = 0, cy = 0) {   // profile: [[r, z], …] from bottom centre round to top centre (closed solid)
  const T = [];
  for (let i = 0; i < segs; i++) {
    const a0 = 2 * Math.PI * i / segs, a1 = 2 * Math.PI * (i + 1) / segs;
    for (let k = 0; k + 1 < profile.length; k++) {
      const [r0, z0] = profile[k], [r1, z1] = profile[k + 1];
      const P = (r, z, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a), z];
      const A = P(r0, z0, a0), B = P(r0, z0, a1), C = P(r1, z1, a1), D = P(r1, z1, a0);
      T.push([A, B, C], [A, C, D]);
    }
  }
  return T;
}
function stl(tris) {
  const buf = Buffer.alloc(84 + 50 * tris.length); buf.writeUInt32LE(tris.length, 80);
  tris.forEach((t, i) => { const o = 84 + 50 * i + 12; t.flat().forEach((v, k) => buf.writeFloatLE(v, o + 4 * k)); });
  return new Uint8Array(buf);
}
const cylinder = (r, h, cx, cy, segs = 64) => revolve([[0, 0], [r, 0], [r, h], [0, h]], segs, cx, cy);
const tube = (ro, ri, h, segs = 64) => revolve([[ri, 0], [ro, 0], [ro, h], [ri, h], [ri, 0]], segs);
const cone = (r0, r1, h, segs = 64) => revolve([[0, 0], [r0, 0], [r1, h], [0, h]], segs);
module.exports = { revolve, stl, cylinder, tube, cone };
// a mushroom: a stem (radius 4, 12 mm) under a domed cap (radius 14, 13–22 mm): its cap reaches out ~1.3 mm a layer
function mushroom() {
  const p = [[0, 0], [4, 0], [4, 12], [6, 12.5]];
  for (let i = 0; i <= 16; i++) { const th = 0.15 + (Math.PI / 2 - 0.15) * i / 16; p.push([14 * Math.cos(th), 13 + 9 * Math.sin(th)]); }
  p.push([0, 22]); return revolve(p, 96);
}
// an axis-aligned box as triangles
function box(x0, y0, z0, x1, y1, z1) { const p = (i) => [i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0], F = [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]];
  return F.flatMap(([a, b, c, d]) => [[p(a), p(b), p(c)], [p(a), p(c), p(d)]]); }
// a T: an 8 mm post 16 mm tall with a 30 mm arm on top (4 mm thick): a flat overhang 11 mm out to each side
const tee = () => box(-4, -4, 0, 4, 4, 16.01).concat(box(-15, -4, 16, 15, 4, 20));
Object.assign(module.exports, { mushroom, box, tee });
// a lowercase r standing up: a 3 mm stem 16 mm tall, 5 mm deep, and an arm 7 mm out to one side at the top, 3 mm thick
const letterR = () => box(0, 0, 0, 3, 5, 16).concat(box(2.99, 0, 13, 10, 5, 16));
Object.assign(module.exports, { letterR });
