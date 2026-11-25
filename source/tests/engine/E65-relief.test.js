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
  how: "A picture with a dark square on its left half, as a plaque (60 mm wide, 4.5 mm front to back, 40 mm tall, 2 mm deep) on the front, on both faces, and inverted; and on a round wall 40 mm across (half the way round, front). Each through UNB.vaseStack (0.3 mm layers, 0.84 mm bead); measures how far the line stands out on each face, left and right as seen from that face.",
  pass: "Front only: the front stands out about 2 mm on its left and not on its right, the back stays flat; both: the back stands out on its left too, as seen from behind (it reads the right way round); inverted: the right of the front stands out, the left doesn't; round: the front's left stands out, the back doesn't; every lap within 0.28 mm of the one below (outwards and in) and no turn tighter than half the bead (0.42 mm).",
  run() {
    const base = () => { const V = UNB.vaseDefaults(); V.height = 40; V.move = { kind: "none", size: 0, count: 1, shift: 0, flip: 0 }; return V; };
    const plaque = (tex) => { const V = base(); V.profile = [[0, 30], [1, 30]]; V.plan = { kind: "plaque", thick: 0.15 }; V.texture = Object.assign({ kind: "picture", depth: 2, picture: picture(), sides: "front" }, tex); return V; };
    const half = 30 * 0.15 / 2, mid = [14, 26];
    const F = stack(plaque({})), B = stack(plaque({ sides: "both" })), I = stack(plaque({ invert: true }));
    const R = base(); R.profile = [[0, 20], [1, 20]]; R.plan = { kind: "circle" }; R.texture = { kind: "picture", depth: 2, picture: picture(), sides: "front", span: 0.5 };
    const C = stack(R);
    // round: out from the radius, on the front's left (x < 0, y < 0) and anywhere on the back
    const roundOut = (S, f) => { let b = 0; S.walls.forEach((L, k) => { const z = 0.3 * (k + 1); if (z < mid[0] || z > mid[1]) return; for (let i = 0; i < L.x.length; i++) if (f(L.x[i], L.y[i])) b = Math.max(b, Math.hypot(L.x[i], L.y[i]) - 20); }); return b; };
    const worst = (S) => Math.max(S.stacking.out, S.stacking.in);
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
      check("plaque, both sides: each lap off the one below (mm)", worst(B), "<=", 0.28),
      check("round: each lap off the one below (mm)", worst(C), "<=", 0.28),
      check("plaque, both sides: the tightest turn (mm radius)", B.tightest.r, ">=", 0.42),
      check("round: the tightest turn (mm radius)", C.tightest.r, ">=", 0.42),
    ], notes: [`front ${outAt(F, half, "front", "left", ...mid).toFixed(2)} mm; laps off the one below ${worst(B).toFixed(3)} / ${worst(C).toFixed(3)} mm; tightest ${B.tightest.r.toFixed(2)} / ${C.tightest.r.toFixed(2)} mm`] };
  },
};
