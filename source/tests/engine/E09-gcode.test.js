const S = require("../lib/scenes.js"), { trace, UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "E09", title: "G-code stays on the plate and is well formed",
  guards: "the printer head driven outside the plate; broken or partial G-code",
  why: "G-code goes to a real machine. Every move must stay inside the 340 × 232 mm plate, use the set height and feed, and extrude a steadily increasing amount — a bad number here crashes the needle or ruins a print.",
  how: "Builds G-code with the engine's export, close to the app's but without the printer's start lines or retraction (plate layout, 0.05 mm simplification, each copy closed, Z 0.3 mm, lift 3 mm, feed 1500, E 0.05 per mm) for 1 and 12 copies of the leaf at 60 mm, then reads every line back.",
  pass: "Every X and Y within the plate; no NaN or Infinity anywhere; printing moves at the set Z; E never decreases; the file starts with the units and absolute-mode commands and ends with a lift.",
  async run() {
    const r = trace(S.sample("leaf")), f = r.fin.final, n = f.re.length; let x0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < n; i++) { x0 = Math.min(x0, f.re[i]); x1 = Math.max(x1, f.re[i]); y1 = Math.max(y1, f.im[i]); }
    const k = 60 / (x1 - x0), x = Float64Array.from(f.re, (v) => (v - x0) * k), y = Float64Array.from(f.im, (v) => (y1 - v) * k), checks = [];
    const g = { ox: 0, oy: 0, z: 0.3, lift: 3, feed: 1500, e: 0.05 };
    for (const copies of [1, 12]) {
      const lay = UNB.plateLayout(x, y, { bedW: 340, bedH: 232, copies, gap: 5, pad: 0.42 }), paths = [];
      for (const pos of lay.placed) {
        const sp = UNB.simplify(Float64Array.from(lay.local.x, (v) => v + pos.x), Float64Array.from(lay.local.y, (v) => v + pos.y), 0.05, true);
        const px = Array.from(sp.x), py = Array.from(sp.y); px.push(px[0]); py.push(py[0]); paths.push({ x: Float64Array.from(px), y: Float64Array.from(py) });
      }
      const text = UNB.exportGcode(paths, g), L = text.trim().split("\n");
      let off = 0, bad = 0, eBack = 0, lastE = 0, zWrong = 0, z = null, moves = 0;
      for (const line of L) {
        if (/NaN|Infinity/.test(line)) bad++;
        const c = line.split(";")[0], X = c.match(/X(-?[\d.]+)/), Y = c.match(/Y(-?[\d.]+)/), Z = c.match(/Z(-?[\d.]+)/), E = c.match(/E(-?[\d.]+)/);
        if (Z) z = +Z[1];
        if (X && (+X[1] < 0 || +X[1] > 340)) off++; if (Y && (+Y[1] < 0 || +Y[1] > 232)) off++;
        if (E && !/^G92/.test(c)) { if (+E[1] < lastE - 1e-9) eBack++; lastE = +E[1]; if (Math.abs(z - g.z) > 1e-9) zWrong++; moves++; }
      }
      checks.push(check(`${copies} cop${copies > 1 ? "ies" : "y"}: coordinates off the plate`, off, "==", 0), check(`${copies}: NaN/Infinity lines`, bad, "==", 0),
        check(`${copies}: extruding moves not at Z ${g.z}`, zWrong, "==", 0), check(`${copies}: times E went backwards`, eBack, "==", 0), check(`${copies}: extruding moves`, moves, ">", 100),
        check(`${copies}: header has G21 and G90`, +(L.includes("G21 ; mm") && L.includes("G90 ; absolute XYZ")), "==", 1), check(`${copies}: ends lifted`, +/G1 Z3\.3/.test(L[L.length - 2]), "==", 1));
    }
    return { checks };
  },
};
