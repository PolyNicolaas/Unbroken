const { UNB } = require("../lib/trace.js"),
  { check } = require("../lib/check.js");
// a 100 × 40 picture: black on the left fading to white on the right, with a 2 × 1 px speck of black near the right
function gradient() {
  const w = 100,
    h = 40,
    data = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.push(Math.round((255 * x) / (w - 1)));
  data[5 * w + 95] = data[5 * w + 96] = 0;
  return { w, h, data, id: "E67-gradient", kind: "picture" };
}
// two black squares on white (a logo of two parts), 60 × 40
function squares() {
  const w = 60,
    h = 40,
    data = new Array(w * h).fill(255);
  for (let y = 10; y < 30; y++) for (let x = 6; x < 26; x++) data[y * w + x] = data[y * w + x + 28] = 0;
  return { w, h, data, id: "E67-squares", kind: "picture" };
}
// a text's stroke: one pixel wide, across, and one up
function strokes() {
  const w = 100,
    h = 60,
    data = new Array(w * h).fill(255);
  for (let x = 10; x < 90; x++) data[20 * w + x] = 0;
  for (let y = 40; y < 58; y++) data[y * w + 50] = 0;
  return { w, h, data, id: "E67-strokes", kind: "text", strokes: true };
}
const at = (R, x, y) => R.a[y * R.w + x];
const levelsOn = (R, y) => new Set(Array.from({ length: R.w }, (_, x) => +at(R, x, y).toFixed(3))).size;
function plaque(tex) {
  const V = UNB.vaseDefaults();
  V.height = 40;
  V.move = { kind: "none", size: 0, count: 1, shift: 0, flip: 0 };
  V.profile = [
    [0, 30],
    [1, 30],
  ];
  V.plan = { kind: "plaque", thick: 0.15 };
  V.texture = Object.assign({ kind: "relief", depth: 2, source: squares(), sides: "front" }, tex);
  return V;
}
// the wall's offset at the middle of each square, halfway up, through the engine's grid
function squareDepths(V) {
  const face = UNB.reliefFace(V, 30),
    G = UNB.reliefGrid(V, face),
    M = G.map;
  const mid = (px) => UNB.reliefAt(G, M.y0 + M.ih / 2, (M.x0 + px * M.sc) / face);
  return [mid(16), mid(44)];
}
module.exports = {
  id: "E67",
  title:
    "A relief's height from its source: Smooth, Steps or Shapes, a text's strokes, specks, taps, and what can't be printed",
  guards:
    "a style that doesn't do what it says (a slope that isn't one, steps that aren't flat or the wrong number of them, shapes that keep their greys or lose their rounded edge), a text's stroke not thickened to its line width, a speck smaller than the bead left in, a tap that presses in or flattens the wrong part, and a thin band across the wall not flagged as short",
  why: "Nicolaas (26 November 2026): image manipulation for reliefs, simple: one style with one slider, and the parts tapped on an inset like the Ties card's (docs/RELIEF-PLAN.md).",
  how: "UNB.reliefHeight on a left-to-right gradient (with a 2 px speck), at 0.5 mm a pixel, in each style; on a one-pixel stroke drawing as a text at 0.2 mm a pixel and a 3 mm line width. Then a plaque with two squares through UNB.reliefGrid: no taps, the right square tapped in, then flat. Then a thin band across the wall (1 mm tall) and a tall one (10 mm) through UNB.reliefShort.",
  pass: "Smooth falls steadily from 1 at black to 0 at white, Contrast 100 lifting the greys; Steps 4 has exactly 4 heights (1, ⅔, ⅓, 0) and the speck gone; Shapes is 1 on the dark half and 0 on the light (the speck merged away and reported), rising in a curve over its Rounded edge (2 mm: under 1 a pixel from the edge, 1 four pixels in); the stroke stands 3 mm wide (13–17 rows at 0.2 mm), both strokes one part each; the right square stands out 2 mm untapped, −2 mm tapped in and 0 tapped flat while the left stays at 2; the thin band is short and the tall one isn't.",
  run() {
    const P = gradient(),
      sm = UNB.reliefHeight(P, { height: { style: "smooth" } }, 0.5),
      smHi = UNB.reliefHeight(P, { height: { style: "smooth", contrast: 100 } }, 0.5),
      st4 = UNB.reliefHeight(P, { height: { style: "steps", levels: 4 } }, 0.5),
      sh = UNB.reliefHeight(P, { height: { style: "shapes", bevel: 2 } }, 0.5),
      falls = [0, 20, 40, 60, 80, 99].map((x) => at(sm, x, 20)).every((v, i, a) => !i || v < a[i - 1]);
    // the edge of the dark half on row 20: the first light pixel
    let edge = 0;
    while (edge < P.w && at(sh, edge, 20) > 0) edge++;
    const S = strokes(),
      sk = UNB.reliefHeight(S, { height: { lineW: 3 } }, 0.2);
    let rows = 0;
    for (let y = 0; y < S.h; y++) if (at(sk, 30, y) > 0.5) rows++;
    const strokeParts = sk.parts.filter((p) => p.level > 0 && p.n > 0).length;
    // taps on the right square (u, v: shares of the picture)
    const tap = (to) => plaque({ height: { style: "shapes", bevel: 0 }, taps: [{ u: 44 / 60, v: 0.5, to }] });
    const [l0, r0] = squareDepths(plaque({ height: { style: "shapes", bevel: 0 } })),
      [l1, r1] = squareDepths(tap("in")),
      [l2, r2] = squareDepths(tap("flat"));
    // bands across the wall: 1.5 mm tall and 10 mm tall (a 60 × 40 px picture at 1 mm a pixel on a 60 mm face)
    const band = (rowsTall) => {
      const w = 60,
        h = 40,
        data = new Array(w * h).fill(255);
      for (let y = 20 - Math.floor(rowsTall / 2); y < 20 + Math.ceil(rowsTall / 2); y++)
        for (let x = 5; x < 55; x++) data[y * w + x] = 0;
      const V = plaque({
        height: { style: "shapes", bevel: 0 },
        source: { w, h, data, id: "E67-band" + rowsTall, kind: "picture" },
        slope: 0.84,
        soft: 1.3,
        margin: 0,
      });
      V.height = 40;
      const G = UNB.reliefGrid(V, 60);
      return UNB.reliefShort(G).short.length;
    };
    return {
      checks: [
        check("Smooth: falls steadily from black to white", +falls, "==", 1),
        check("Smooth: 1 at black", at(sm, 0, 20), ">=", 0.99),
        check("Smooth: 0 at white", at(sm, 99, 20), "<=", 0.01),
        check("Smooth, Contrast 100: the mid-greys lifted (at 60%)", at(smHi, 60, 20) - at(sm, 60, 20), ">", 0.2),
        check("Steps 4: heights on a row", levelsOn(st4, 20), "==", 4),
        check("Steps 4: the darkest step at 1", at(st4, 2, 20), "==", 1),
        check("Steps 4: a middle step at ⅔", Math.abs(at(st4, 25, 20) - 2 / 3), "<", 1e-6),
        check("Shapes: the speck merged away (reported)", sh.specks.length, "==", 1),
        check("Steps: the speck's place is the wall", at(st4, 95, 5), "==", 0),
        check("Shapes: the light half on the wall", at(sh, 80, 20), "==", 0),
        check("Shapes: 2 mm rounded edge, a pixel in: below full", at(sh, edge - 1, 20), "<", 0.9),
        check("Shapes: 4 px (2 mm) in: full", at(sh, edge - 5, 20), ">=", 0.999),
        check("a text's stroke at 3 mm: rows across it (0.2 mm each)", rows, ">=", 13),
        check("a text's stroke at 3 mm: no wider than 17 rows", rows, "<=", 17),
        check("the two strokes: one part each", strokeParts, "==", 2),
        check("untapped: the right square out (mm)", r0, ">=", 1.9),
        check("tapped in: the right square pressed in (mm)", r1, "<=", -1.9),
        check("tapped in: the left square still out (mm)", l1, ">=", 1.9),
        check("tapped flat: the right square on the wall (mm)", Math.abs(r2), "<=", 0.05),
        check("tapped flat: the left square still out (mm)", l2, ">=", 1.9),
        check("a band 1 mm tall across the wall: short", band(1), "==", 1),
        check("a band 10 mm tall: reaches its depth", band(10), "==", 0),
      ],
      notes: `smooth ${[0, 50, 99].map((x) => at(sm, x, 20).toFixed(2)).join(" ")}; contrast 100 ${at(smHi, 60, 20).toFixed(2)}; stroke ${rows} rows; squares ${[l0, r0, l1, r1, l2, r2].map((v) => v.toFixed(2)).join(" ")}`,
    };
  },
};
