const { UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
// a 60 × 40 picture: white, with a black square on its left half (so which way round it reads can be told)
function picture() {
  const w = 60, h = 40, data = new Array(w * h).fill(255);
  for (let y = 10; y < 30; y++) for (let x = 8; x < 26; x++) data[y * w + x] = 0;
  return { w, h, data, id: "E65-square" };
}
function stack(V) {
  const g = UNB.vaseStack(V, { h: 0.3, w: 0.84, base: 0 });
  let r = g.next();
  while (!r.done) r = g.next();
  return r.value;
}
// how far out from the plain wall each layer's line goes, where: front (y < 0) or back, left or right as seen from that side
function outAt(S, half, side, which, zFrom, zTo) {
  let best = 0;
  S.walls.forEach((L, k) => {
    const z = 0.3 * (k + 1);
    if (z < zFrom || z > zTo) return;
    for (let i = 0; i < L.x.length; i++) {
      const x = L.x[i], y = L.y[i];
      if (side === "front" ? y >= 0 : y <= 0) continue;
      const seenX = side === "front" ? x : -x; // left (−) to right (+) as seen from that side
      if (Array.isArray(which) ? seenX < which[0] || seenX > which[1] : which === "left" ? seenX > -3 : seenX < 3) continue;
      best = Math.max(best, Math.abs(y) - half);
    }
  });
  return best;
}
module.exports = {
  id: "E65", title: "A picture in relief on a wall: flat (a closed loop) or round, on the front, back or both",
  guards: "the picture on the wrong face, mirrored, raised where it's light, leaning further a layer than a bead holds, or turning tighter than the bead",
  why: "Nicolaas (24 November 2026): a picture turned into a relief wall, the image on the vertical surface; flat or round, a closed loop so it stands, and the logo on each wall if wanted.",
  how: "A picture with a dark square on its left half, as a plaque (60 mm wide, 4.5 mm front to back, 40 mm tall, 2 mm deep) on the front, on both faces, and inverted; and on a round wall 40 mm across (half the way round, front; and turned 90°); and a triangle (corners at 0°, 120°, 240°) with the picture on face 1, face 2 and every face. Each through UNB.vaseStack (0.3 mm layers, 0.84 mm bead); measures how far the line stands out on each face, left and right as seen from that face.",
  pass: "Front only: the front stands out about 2 mm on its left and not on its right, the back stays flat; both: the back stands out on its left too, as seen from behind (it reads the right way round); inverted: the right of the front stands out, the left doesn't; round: the front's left stands out, the back doesn't; the triangle's face 1 stands out toward the front, face 2 anticlockwise from it, every face on all three, the corners plain; turned 90°, the round wall's picture moves round off the front; every lap within 0.28 mm of the one below (outwards and in) and no turn tighter than half the bead (0.42 mm).",
  run() {
    const base = () => { const V = UNB.vaseDefaults(); V.height = 40; V.move = { kind: "none", size: 0, count: 1, shift: 0, flip: 0 }; return V; };
    const plaque = (tex) => { const V = base(); V.profile = [[0, 30], [1, 30]]; V.plan = { kind: "plaque", thick: 0.15 }; V.texture = Object.assign({ kind: "relief", depth: 2, source: picture(), sides: "front" }, tex); return V; };
    const half = 30 * 0.15 / 2, mid = [14, 26];
    const F = stack(plaque({})), B = stack(plaque({ sides: "both" })), I = stack(plaque({ invert: true }));
    const R = base(); R.profile = [[0, 20], [1, 20]]; R.plan = { kind: "circle" }; R.texture = { kind: "relief", depth: 2, source: picture(), sides: "front", span: 0.5 };
    const C = stack(R);
    // round: out from the radius, on the front's left (x < 0, y < 0) and anywhere on the back
    const roundOut = (S, f) => { let b = 0; S.walls.forEach((L, k) => { const z = 0.3 * (k + 1); if (z < mid[0] || z > mid[1]) return; for (let i = 0; i < L.x.length; i++) if (f(L.x[i], L.y[i])) b = Math.max(b, Math.hypot(L.x[i], L.y[i]) - 20); }); return b; };
    const worst = (S) => Math.max(S.stacking.out, S.stacking.in);
    // a triangle (corners at 0°, 120°, 240°): face 1 is the one toward the front (centred at −60°), face 2 the next
    // anticlockwise (60°); every face; and a round wall with the picture turned 90° (centred on +x instead of −y)
    const tri = (tex) => { const V = base(); V.profile = [[0, 30], [1, 30]]; V.plan = { kind: "polygon", sides: 3, round: 0.2 }; V.texture = Object.assign({ kind: "relief", depth: 2, source: picture(), faces: "one", face: 1 }, tex); return stack(V); };
    const T1 = tri({}), T2 = tri({ face: 2 }), TE = tri({ faces: "every" });
    const plainTri = (() => { const V = base(); V.profile = [[0, 30], [1, 30]]; V.plan = { kind: "polygon", sides: 3, round: 0.2 }; V.texture = { kind: "none" }; return stack(V); })();
    const rAt = (L, deg) => { const a = (deg * Math.PI) / 180; let best = 0, bd = 9; for (let i = 0; i < L.x.length; i++) { const d = Math.abs(((Math.atan2(L.y[i], L.x[i]) - a + 3 * Math.PI) % (2 * Math.PI)) - Math.PI); if (d < bd) { bd = d; best = Math.hypot(L.x[i], L.y[i]); } } return best; };
    const k = Math.round(20 / 0.3), outDeg = (S, deg) => rAt(S.walls[k], deg) - rAt(plainTri.walls[k], deg);
    // (the square is on the picture's left: on face 1, left as seen from outside is toward −120°: about −80°)
    const Rt = base(); Rt.profile = [[0, 20], [1, 20]]; Rt.plan = { kind: "circle" }; Rt.texture = { kind: "relief", depth: 2, source: picture(), sides: "front", span: 0.5, turn: 90 };
    const CT = stack(Rt);
    return { checks: [
      check("front: its left stands out, off 2 mm by", Math.abs(outAt(F, half, "front", "left", ...mid) - 2), "<=", 0.25),
      check("front: its right (mm)", outAt(F, half, "front", "right", ...mid), "<=", 0.05),
      check("front only: the back (mm)", Math.max(outAt(F, half, "back", "left", ...mid), outAt(F, half, "back", "right", ...mid)), "<=", 0.05),
      check("both: the back's left, seen from behind, off 2 mm by", Math.abs(outAt(B, half, "back", "left", ...mid) - 2), "<=", 0.25),
      check("both: the back's right, seen from behind (mm)", outAt(B, half, "back", "right", ...mid), "<=", 0.05),
      check("inverted: the front's right (light) stands out, off 2 mm by", Math.abs(outAt(I, half, "front", "right", ...mid) - 2), "<=", 0.25),
      check("inverted: the dark square on the front (mm)", outAt(I, half, "front", [-14, -8], ...mid), "<=", 0.05),
      check("round: the front's left stands out, off 2 mm by", Math.abs(roundOut(C, (x, y) => y < -5 && x < -3) - 2), "<=", 0.25),
      check("round: the back (mm)", roundOut(C, (x, y) => y > 5), "<=", 0.05),
      check("triangle, face 1: stands out toward the front (−80°), off 2 mm by", Math.abs(outDeg(T1, -80) - 2), "<=", 0.3),
      check("triangle, face 1: face 2 (40°) plain (mm)", Math.abs(outDeg(T1, 40)), "<=", 0.05),
      check("triangle, face 1: its corners (−120°, 0°) plain (mm)", Math.max(Math.abs(outDeg(T1, -120)), Math.abs(outDeg(T1, 0))), "<=", 0.05),
      check("triangle, face 2: stands out at 40°, off 2 mm by", Math.abs(outDeg(T2, 40) - 2), "<=", 0.3),
      check("triangle, face 2: face 1 (−80°) plain (mm)", Math.abs(outDeg(T2, -80)), "<=", 0.05),
      check("triangle, every face: all three stand out (the least, mm)", Math.min(outDeg(TE, -80), outDeg(TE, 40), outDeg(TE, 160)), ">=", 1.7),
      check("triangle, every face: each lap off the one below (mm)", worst(TE), "<=", 0.28),
      check("round, turned 90°: the front's left now toward +x's left (about −10°), off 2 mm by", Math.abs(roundOut(CT, (x, y) => Math.atan2(y, x) < -0.05 && Math.atan2(y, x) > -0.6) - 2), "<=", 0.3),
      check("round, turned 90°: the side away from it (x < 0) plain (mm)", roundOut(CT, (x, y) => x < -5), "<=", 0.05),
      check("plaque, both sides: each lap off the one below (mm)", worst(B), "<=", 0.28),
      check("round: each lap off the one below (mm)", worst(C), "<=", 0.28),
      check("plaque, both sides: the tightest turn (mm radius)", B.tightest.r, ">=", 0.42),
      check("round: the tightest turn (mm radius)", C.tightest.r, ">=", 0.42),
    ], notes: [`front ${outAt(F, half, "front", "left", ...mid).toFixed(2)} mm; laps off the one below ${worst(B).toFixed(3)} / ${worst(C).toFixed(3)} mm; tightest ${B.tightest.r.toFixed(2)} / ${C.tightest.r.toFixed(2)} mm`] };
  },
};
