const { UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
// a 60 × 40 picture: white, a black square on its left half and a mid-grey square on its right half
function picture() {
  const w = 60, h = 40, data = new Array(w * h).fill(255);
  for (let y = 10; y < 30; y++) {
    for (let x = 8; x < 26; x++) data[y * w + x] = 0;
    for (let x = 34; x < 52; x++) data[y * w + x] = 128;
  }
  return { w, h, data, id: "E66-squares" };
}
function stack(V) {
  const g = UNB.vaseStack(V, { h: 0.3, w: 0.84, base: 0 });
  let r = g.next();
  while (!r.done) r = g.next();
  return r.value;
}
// how far the line goes out (+) and in (−) from the plain face, on the front (y < 0) or back, across x as seen from
// that side, between heights zFrom and zTo
function range(S, half, side, [x0, x1], zFrom, zTo) {
  let out = -Infinity, inn = Infinity;
  S.walls.forEach((L, k) => {
    const z = 0.3 * (k + 1);
    if (z < zFrom || z > zTo) return;
    for (let i = 0; i < L.x.length; i++) {
      const x = L.x[i], y = L.y[i];
      if (side === "front" ? y >= 0 : y <= 0) continue;
      const seenX = side === "front" ? x : -x;
      if (seenX < x0 || seenX > x1) continue;
      const d = Math.abs(y) - half;
      out = Math.max(out, d);
      inn = Math.min(inn, d);
    }
  });
  return { out, in: inn };
}
module.exports = {
  id: "E66", title: "A relief's direction: standing out, pressed in, or both (mid-grey on the wall)",
  guards: "a picture pressed the wrong way, Both not centred on mid-grey, or a plaque's front and back pressed into each other",
  why: "Nicolaas (25 November 2026): reliefs going in and out of the chocolate's surface, not only out.",
  how: "A picture with a black square on its left and a mid-grey square on its right, as a plaque (60 mm wide, 4.5 mm front to back, 40 mm tall, 2 mm deep): Out, In, Both; In on both faces (room 4.5 − 1.5 = 3 mm, 1.5 a face); and In round a wall 40 mm across. Through UNB.vaseStack (0.3 mm layers, 0.84 mm bead), measuring how far the line goes out and in on each part of the face.",
  pass: "Out: black 2 mm out, white flat. In: black 2 mm in, nothing out. Both: black 1 mm out, white 1 mm in (2 mm black to white), mid-grey within 0.15 mm of the face. In on both faces: each face in no more than 1.5 mm, the front and back at least 1.5 mm apart. Round, In: pressed in 2 mm, nothing out. Every lap within 0.28 mm of the one below, no turn tighter than 0.42 mm.",
  run() {
    const base = () => { const V = UNB.vaseDefaults(); V.height = 40; V.move = { kind: "none", size: 0, count: 1, shift: 0, flip: 0 }; return V; };
    const plaque = (tex) => { const V = base(); V.profile = [[0, 30], [1, 30]]; V.plan = { kind: "plaque", thick: 0.15 }; V.texture = Object.assign({ kind: "relief", depth: 2, source: picture(), sides: "front" }, tex); return stack(V); };
    const half = (30 * 0.15) / 2, mid = [14, 26], black = [-12, -10], grey = [10, 12], white = [-24, -22];
    const O = plaque({ dir: "out" }), I = plaque({ dir: "in" }), B = plaque({ dir: "both" }), I2 = plaque({ dir: "in", sides: "both" });
    const R = base(); R.profile = [[0, 20], [1, 20]]; R.plan = { kind: "circle" }; R.texture = { kind: "relief", depth: 2, source: picture(), sides: "front", span: 0.5, dir: "in" };
    const C = stack(R);
    let rIn = Infinity, rOut = -Infinity;
    C.walls.forEach((L, k) => { const z = 0.3 * (k + 1); if (z < mid[0] || z > mid[1]) return; for (let i = 0; i < L.x.length; i++) { const d = Math.hypot(L.x[i], L.y[i]) - 20; rIn = Math.min(rIn, d); rOut = Math.max(rOut, d); } });
    const at = (S, side, part) => range(S, half, side, part, ...mid);
    // the front and back of I2 at their closest: the narrowest gap between the lines at any height mid-wall
    let gap = Infinity;
    I2.walls.forEach((L, k) => { const z = 0.3 * (k + 1); if (z < mid[0] || z > mid[1]) return; let f = -Infinity, b = Infinity; for (let i = 0; i < L.x.length; i++) if (Math.abs(L.x[i]) < 12) { if (L.y[i] < 0) f = Math.max(f, L.y[i]); else b = Math.min(b, L.y[i]); } gap = Math.min(gap, b - f); });
    const worst = (S) => Math.max(S.stacking.out, S.stacking.in);
    return { checks: [
      check("Out: the black stands out, off 2 mm by", Math.abs(at(O, "front", black).out - 2), "<=", 0.25),
      check("Out: the white stays on the face (mm)", Math.abs(at(O, "front", white).out), "<=", 0.05),
      check("In: the black pressed in, off 2 mm by", Math.abs(at(I, "front", black).in + 2), "<=", 0.25),
      check("In: nothing stands out (mm)", Math.max(at(I, "front", black).out, at(I, "front", white).out, at(I, "front", grey).out), "<=", 0.05),
      check("Both: the black stands out, off 1 mm by", Math.abs(at(B, "front", black).out - 1), "<=", 0.25),
      check("Both: the white pressed in, off 1 mm by", Math.abs(at(B, "front", white).in + 1), "<=", 0.25),
      check("Both: the mid-grey on the face (mm)", Math.max(Math.abs(at(B, "front", grey).out), Math.abs(at(B, "front", grey).in)), "<=", 0.15),
      check("In on both faces: the front pressed in no more than 1.5 mm (mm)", -at(I2, "front", black).in, "<=", 1.55),
      check("In on both faces: the back pressed in no more than 1.5 mm (mm)", -at(I2, "back", black).in, "<=", 1.55),
      check("In on both faces: front and back at least 1.5 mm apart (mm)", gap, ">=", 1.45),
      check("round, In: pressed in, off 2 mm by", Math.abs(rIn + 2), "<=", 0.3),
      check("round, In: nothing stands out (mm)", rOut, "<=", 0.05),
      check("each lap off the one below, worst of In, Both, both faces, round (mm)", Math.max(worst(I), worst(B), worst(I2), worst(C)), "<=", 0.28),
      check("the tightest turn, worst of In, Both, round (mm radius)", Math.min(I.tightest.r, B.tightest.r, C.tightest.r), ">=", 0.42),
    ], notes: [`In ${at(I, "front", black).in.toFixed(2)} mm; Both ${at(B, "front", black).out.toFixed(2)} / ${at(B, "front", white).in.toFixed(2)} / grey ${at(B, "front", grey).out.toFixed(2)} mm; both faces gap ${gap.toFixed(2)} mm; round ${rIn.toFixed(2)} mm`] };
  },
};
