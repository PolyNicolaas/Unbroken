const { UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js"), fs = require("fs"), path = require("path");
// the app's sample, the Printables skull cup (web-app/js/sample-skull.js), 30 mm tall with its bottom 2% cut, as the app prints it
function skull() {
  const src = fs.readFileSync(path.join(__dirname, "../../../web-app/js/sample-skull.js"), "utf8"),
    b64 = src.match(/stl: "([^"]+)"/)[1], M = UNB.parseSTL(new Uint8Array(Buffer.from(b64, "base64"))), om = UNB.orientMesh(M.tri, { x: 0, y: 0, z: 0 });
  return { tri: om.tri, sc: 30 / 0.98 / om.size[2], H: 30 / 0.98 };
}
const stack = (S, support) => { const it = UNB.modelStack(S.tri, { scale: S.sc, z0: 0.3, h: 0.3, base: 0, w: 0.84, d: 1.34, walls: 1, tol: 0.05, cutBottom: 0.02 * S.H, cutTop: 0, support, overhang: 0.28 }); let r; while (!(r = it.next()).done); return r.value; };
module.exports = {
  id: "E50", title: "A hollow single-wall print: a layer stepping in over the empty inside is caught, and Support: Slope turns the ledge into a slope",
  guards: "a layer that steps in past its own wall (nothing under it on a hollow print) reported as fine, so no support is offered; a Slope that changes the whole model, or leaves the ledge",
  why: "Nicolaas (30 October 2026): the skull cup's nose printed a strand over nothing. The overhang check only measured layers stepping out; on a hollow single-wall print, stepping in hangs over the empty inside too. v127 measures both, and Support: Slope makes each ledge a short slope.",
  how: "Slices the sample skull cup (30 mm, 0.3 mm layers, 18G needle, one wall, hollow) with Support off and with Slope, and reads the overhang check before and after.",
  pass: "Off: no layer steps out past 0.28 mm, but one steps in over 1 mm (the nose, 10–13 mm up); Slope: after it no layer steps in or out more than 0.4 mm (0.28 plus grid rounding), and the layers below 9 mm (the jaw) are as sliced.",
  run() {
    const S = skull(), off = stack(S, null), on = stack(S, "slope"), zAt = (k) => 0.3 + k * 0.3;
    return { checks: [
      check("off: out, worst (mm)", off.overhang.worst, "<=", 0.3),
      check("off: in, worst (mm)", off.overhang.inWorst, ">", 1),
      check("off: in, where (mm up)", +(zAt(off.overhang.inAt)).toFixed(1), ">=", 10),
      check("off: … and below 13 mm", +(zAt(off.overhang.inAt)).toFixed(1), "<=", 13),
      check("slope: out, after (mm)", on.support.after, "<=", 0.4),
      check("slope: in, after (mm)", on.support.afterIn, "<=", 0.4),
      check("slope: lowest layer changed (mm up)", +zAt(on.support.from).toFixed(1), ">=", 9),
    ], notes: `in ${off.overhang.inWorst.toFixed(2)} mm at ${zAt(off.overhang.inAt).toFixed(1)} mm; slope: ${on.support.layers} layers from ${zAt(on.support.from).toFixed(1)} mm, after ${on.support.after.toFixed(2)} / ${on.support.afterIn.toFixed(2)} mm` };
  },
};
