const { UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
const W = 240, H = 240, im = new Uint8ClampedArray(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = 4 * (y * W + x), o = x >= 60 && x < 180 && y >= 60 && y < 180; im[i] = o ? 180 : 245; im[i + 1] = o ? 60 : 245; im[i + 2] = o ? 40 : 245; im[i + 3] = 255; }
const at = (r, x, y) => r.mask[Math.floor(y * r.k) * r.mw + Math.floor(x * r.k)];
const plain = (v) => { const a = new Uint8ClampedArray(50 * 50 * 4).fill(v); for (let i = 3; i < a.length; i += 4) a[i] = 255; return a; };
module.exports = {
  id: "E43", title: "Cut-out strokes keep their own brush size; a plain light photo of an object stays light",
  guards: "every Keep and Remove stroke drawn with the newest stroke's brush (a thin Remove stroke growing fat after a big Keep dab elsewhere), strokes as plain point lists no longer working, and Object cleaning turning a nearly plain white photo black",
  why: "The cut-out (v119) sent one brush for all strokes, so changing the brush size changed every stroke already painted. Object cleaning stretched each colour from its darkest to at least 16 levels above: a plain white wall had no spread, so white became black.",
  how: "A red square on white, a box round it, a thin (2 px) Remove stroke across its middle and a big (30 px) Keep dab near its top: as { pts, r } strokes, and as point lists with one brush of 30; the same with the big brush given per stroke. photoClean (Object) on a plain 250 grey.",
  pass: "With its own radius the Remove stroke takes the line (mask 0 on it) but not 12 px below it (mask 1); the old way (one brush of 30) takes both; point lists with a brush equal { pts, r } strokes with that radius; the plain light photo comes out white (255).",
  async run() {
    const checks = [], box = [40, 40, 200, 200], thin = [70, 120, 170, 120], dab = [120, 75, 121, 75];
    const own = UNB.cutout(im, W, H, { box, drop: [{ pts: thin, r: 2 }], keep: [{ pts: dab, r: 30 }] });
    const old = UNB.cutout(im, W, H, { box, drop: [thin], keep: [dab], brush: 30 });
    const big = UNB.cutout(im, W, H, { box, drop: [{ pts: thin, r: 30 }], keep: [{ pts: dab, r: 30 }] });
    checks.push(check("thin Remove stroke: on its line removed (0)", at(own, 120, 120), "==", 0), check("… 12 px below it kept (1)", at(own, 120, 132), "==", 1));
    checks.push(check("one brush of 30 for both: 12 px below removed (0)", at(old, 120, 132), "==", 0), check("point lists + brush = { pts, r } strokes", +(old.mask.join() === big.mask.join()), "==", 1));
    const out = [...new Set(UNB.photoClean(plain(250), 50, 50, { kind: "object" }))];
    checks.push(check("Object cleaning, a plain 250 grey photo: its darkest value", Math.min(...out), "==", 255));
    return { checks, notes: `own radius share ${own.share.toFixed(3)}, one brush ${old.share.toFixed(3)}` };
  },
};
