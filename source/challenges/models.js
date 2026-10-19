const M = require("../tests/lib/meshes.js"), path = require("path"), OUT = (n) => path.join(__dirname, "art", n), fs = require("fs");
fs.mkdirSync(path.join(__dirname, "art"), { recursive: true });   // art/ isn't kept in a fresh copy
// a closed prism: cross-section f(theta, z) -> radius, twisted and scaled with height; fan-capped top and bottom
function loft(R, H, rings = 60, segs = 180) {
  const T = [], P = (k, i) => { const z = H * k / rings, a = 2 * Math.PI * i / segs, r = R(a, z); return [r * Math.cos(a), r * Math.sin(a), z]; };
  for (let k = 0; k < rings; k++) for (let i = 0; i < segs; i++) { const A = P(k, i), B = P(k, i + 1), C = P(k + 1, i + 1), D = P(k + 1, i); T.push([A, B, C], [A, C, D]); }
  for (let i = 0; i < segs; i++) { T.push([[0, 0, 0], P(0, i + 1), P(0, i)]); T.push([[0, 0, H], P(rings, i), P(rings, i + 1)]); }
  return T;
}
// 1. twisted star vase: 6 soft points, a quarter turn over 45 mm, swelling in the middle
const star = (a, z) => { const t = z / 45, tw = a - 0.9 * t; return (14 + 3.5 * Math.cos(6 * tw)) * (1 + 0.18 * Math.sin(Math.PI * t)); };
fs.writeFileSync(OUT("star-vase.stl"), M.stl(loft(star, 45)));
// 2. heart, 12 mm tall: the classic heart curve as a polar radius from its centre (sampled, then interpolated)
const hp = []; for (let i = 0; i < 2000; i++) { const t = 2 * Math.PI * i / 2000, x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); hp.push([Math.atan2(y - 2, x), Math.hypot(x, y - 2) * 1.6]); }
hp.sort((p, q) => p[0] - q[0]);
const heartR = (a) => { a = Math.atan2(Math.sin(a), Math.cos(a)); let best = hp[0], bd = 9; for (const p of hp) { const d = Math.abs(p[0] - a); if (d < bd) { bd = d; best = p; } } return best[1]; };
const cache = new Map(), hr = (a) => { const k = Math.round(a * 1000); if (!cache.has(k)) cache.set(k, heartR(a)); return cache.get(k); };
fs.writeFileSync(OUT("heart.stl"), M.stl(loft((a, z) => hr(a) * (1 - 0.15 * (z / 12) ** 2), 12, 12, 360)));
// 3. chess pawn: a solid of revolution with a round head (its top is a dome: a job for Cut off)
const prof = [[0, 0], [13, 0], [13, 3], [11, 5], [8, 7], [6, 14], [5, 20], [8, 22], [8, 23.5], [5, 24.5]];
for (let i = 0; i <= 24; i++) { const th = -Math.PI / 2 + 0.25 + (Math.PI - 0.25) * i / 24; prof.push([7.5 * Math.cos(th), 32 + 7.5 * Math.sin(th)]); }
prof.push([0, 39.5]);
fs.writeFileSync(OUT("pawn.stl"), M.stl(M.revolve(prof, 96)));
for (const f of ["star-vase.stl", "heart.stl", "pawn.stl"]) console.log(f, fs.statSync(OUT(f)).size);
// 4. mushroom (v85, support): a thin stem and a wide domed cap, a 45 mm overhang all round
const cap = [[0, 0], [4, 0], [4, 12], [6, 12.5]];
for (let i = 0; i <= 16; i++) { const th = 0.15 + (Math.PI / 2 - 0.15) * i / 16; cap.push([14 * Math.cos(th), 13 + 9 * Math.sin(th)]); }
cap.push([0, 22]);
fs.writeFileSync(OUT("mushroom.stl"), M.stl(M.revolve(cap, 96)));
// 5. T (v85, support): a post with a flat arm out to both sides, square underneath (a bridge, the hardest overhang)
const box = (x0, y0, z0, x1, y1, z1) => { const p = (i) => [i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0], F = [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]];
  return F.flatMap(([a, b, c, d]) => [[p(a), p(b), p(c)], [p(a), p(c), p(d)]]); };
fs.writeFileSync(OUT("tee.stl"), M.stl(box(-4, -4, 0, 4, 4, 16.01).concat(box(-15, -4, 16, 15, 4, 20))));
// 6. a lowercase r standing up (v86, support on one side only): a 3 mm stem 16 mm tall, 5 mm deep, and an arm 7 mm
//    out to the right at the top, 3 mm thick, flat underneath
fs.writeFileSync(OUT("letter-r.stl"), M.stl(box(0, 0, 0, 3, 5, 16).concat(box(2.99, 0, 13, 10, 5, 16))));
// 7. the same r lying flat (v86): the letter's outline 5 mm tall, no overhang at all
fs.writeFileSync(OUT("letter-r-flat.stl"), M.stl(box(0, 0, 0, 3, 16, 5).concat(box(2.99, 13, 0, 10, 16, 5))));
// --- v88 set: varied practical pieces ---
// 8. a tree: three stacked cone tiers (each a wide overhang over the one below) on a trunk
const treeProf = [[0, 0], [3, 0], [3, 6], [14, 6], [7, 16], [11, 16], [5, 25], [8, 25], [0.5, 35], [0, 35]];
fs.writeFileSync(OUT("tree.stl"), M.stl(M.revolve(treeProf, 96)));
// 9. a mug with a handle: a cup 30 mm across, 30 tall, wall 2.5, and a D-shaped handle (a loop that leaves the body and comes back)
const handle = []; for (let i = 0; i < 24; i++) { const t0 = Math.PI * i / 24 - Math.PI / 2, t1 = Math.PI * (i + 1) / 24 - Math.PI / 2;
  const c = (t) => [14 + 9 * Math.cos(t), 15 + 9 * Math.sin(t)];   // the handle's centre line in x–z, from the body round and back
  const [x0, z0] = c(t0), [x1, z1] = c(t1); handle.push(...box(Math.min(x0, x1) - 1.6, -2.5, Math.min(z0, z1) - 1.6, Math.max(x0, x1) + 1.6, 2.5, Math.max(z0, z1) + 1.6)); }
fs.writeFileSync(OUT("mug.stl"), M.stl(M.revolve([[0, 0], [15, 0], [15, 30], [0, 30]], 96).concat(handle)));
// 10. a standing Y: a 3 mm trunk 9 mm tall splitting into two arms leaning out to 9 mm each side at 18 mm, 4 mm deep
const yArm = (dir) => { const T = []; for (let i = 0; i < 12; i++) { const z = 9 + 9 * i / 12, x = dir * (1.5 + 7.5 * i / 12); T.push(...box(x - 1.6, -2, z, x + 1.6, 2, z + 0.8)); } return T; };
fs.writeFileSync(OUT("letter-y.stl"), M.stl(box(-1.5, -2, 0, 1.5, 2, 9.4).concat(yArm(1), yArm(-1))));
// 11. a footbridge: two piers 6 mm wide, 30 mm apart, with a deck 4 mm thick on top at 12 mm (a span held from both ends)
fs.writeFileSync(OUT("bridge.stl"), M.stl(box(-21, -4, 0, -15, 4, 12.01).concat(box(15, -4, 0, 21, 4, 12.01), box(-21, -4, 12, 21, 4, 16))));
