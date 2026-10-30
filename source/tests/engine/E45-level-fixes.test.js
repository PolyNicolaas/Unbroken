const { UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
// white paper, a dark disc in the middle and a dark band along the bottom edge (touching the picture's border)
function band() {
  const w = 160, h = 120, lab = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) lab[y * w + x] = Math.hypot(x - 60, y - 45) < 25 || y > 95 ? 0 : 1;
  return { w, h, lab };
}
module.exports = {
  id: "E45", title: "Level fixes: a filled block on the picture's edge is closed off, Colours with light lines on dark, fine plotter fills",
  guards: "a printer's Fill never filling a block that touches the picture's edge (its outline open along the border), Colours with Light lines on dark counting black ink as paper, and a plotter fill finer than one working pixel quietly coarsened",
  why: "Level edges along the border aren't drawn (a traced picture gets no frame), so a filled block on the edge had an open outline and the infill took it for outside; UNB.levelEdges now draws the border run of the levels given in border (the filled ones, v-next). Colour levels read paper white from the prepared grey, which Invert had already flipped (UNB.stagePrep). UNB.levelFills clamped the spacing to 1 px.",
  how: "Level edges of a disc and a band along the bottom edge, the dark level traced, without and with border flags; UNB.stagePrep on white paper with a black disc and a red square, 3 colour levels, with and without invert; UNB.levelFills hatching a disc at 0.5 and 1 px spacing.",
  pass: "Without border flags no edge pixel on the row next to the bottom border (as before); with the dark level's flag the band's border run is drawn there (≥ 100 px) and the disc's outline is unchanged; Colours with invert: the disc's level is 0 (darkest) and black, as without invert; hatching at 0.5 px gives at least 1.8× the strokes of 1 px.",
  async run() {
    const checks = [], B = band(), row = (m, y) => { let n = 0; for (let x = 0; x < B.w; x++) n += m[y * B.w + x] ? 1 : 0; return n; };
    const plain = UNB.levelEdges(B.lab, B.w, B.h, [true, false]), framed = UNB.levelEdges(B.lab, B.w, B.h, [true, false], [true, false]);
    checks.push(check("no border flags: nothing along the bottom border", row(plain, B.h - 2), "==", 0), check("the band's border run drawn with its flag (px)", row(framed, B.h - 2), ">=", 100));
    let same = 1; for (let y = 2; y < 80; y++) for (let x = 2; x < B.w - 2; x++) if (plain[y * B.w + x] !== framed[y * B.w + x]) same = 0;
    checks.push(check("… the disc's outline unchanged", same, "==", 1));
    const w = 120, h = 90, rgba = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let c = [250, 250, 250]; if (Math.hypot(x - 35, y - 45) < 25) c = [0, 0, 0]; else if (x > 70 && x < 110 && y > 25 && y < 65) c = [220, 40, 40]; rgba.set([...c, 255], 4 * (y * w + x)); }
    const r = [false, true].map((invert) => UNB.stagePrep(rgba, w, h, { prep: {}, invert, levels: { count: 3, smooth: 0, colour: true } }).levels);
    const disc = r.map((L) => L.lab[45 * w + 35]);
    checks.push(check("Colours: the black disc darkest, without and with invert", +(disc[0] === 0 && disc[1] === 0), "==", 1), check("… its colour black with invert (max channel)", Math.max(...r[1].colours[disc[1]]), "<=", 20));
    const n = (sp) => UNB.levelFills(B.lab, B.w, B.h, [{ level: 0, style: "hatch", spacing: sp, angle: 0, inset: 0.5 }])[0].length;
    const n1 = n(1), nh = n(0.5);
    checks.push(check("hatching at 0.5 px vs 1 px (strokes ÷)", nh / n1, ">=", 1.8));
    return { checks, notes: `border run ${row(framed, B.h - 2)} px; strokes ${n1} → ${nh}` };
  },
};
