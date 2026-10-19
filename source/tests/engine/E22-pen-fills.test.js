const { UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "E22", title: "Pen fills: the areas the pen line closes off, hatched one pen per layer",
  guards: "gaps that don't close (or close too far), slivers that don't merge, fills that spill over a line into the next area, stop short or overlap the outline's ink, miss spots, or end up in the wrong layer",
  why: "On the 2D tab an area picked for a fill pen is hatched with straight strokes (the pen lifts between them). The strokes have to fill the area right up to the outline without their ink running over it, keep to the area that was clicked even where a line divides two areas, and land in their own layer of the SVG and DXF so the pen can be changed between layers.",
  how: "Draws a 40 × 20 mm box divided down the middle, as the pen line does it (one continuous line, the divider drawn out and back). Finds its areas; fills the left half with a 0.5 mm pen at 0.5 mm spacing (solid), then at 45° with cross-hatch and 2 mm spacing; checks every stroke against the box and the divider. Writes the page SVG and the DXF with two fill pens. Then stops the divider 1.5 mm short of the edge and adds a 3 × 3 mm cell in a corner, and tries Close gaps at 1 and 2 mm and Smallest shape at 10 mm². Fills the left half with contours 1 mm apart, and a 40 × 20 box with vertical hatching that follows a black-to-white gradient (white beyond 30 mm).",
  pass: "Two areas besides the outside; a point in each half finds its own area and a point on the divider finds one of them; every solid-fill stroke stays in the left half with its ink clear of the outline's (centre at least 0.5 mm from the line, within the 0.05 mm grid) and reaches to within 0.1 mm of that limit; rows are exactly 0.5 mm apart and run from one fill limit to the other (within 0.1 mm); the cross-hatch has strokes both ways, all in the left half; the SVG has 3 layers with the pens' colours, the DXF a PEN2 and a PEN3 layer. Close gaps leaves the 1.5 mm gap open at 1 mm and closes it at 2 mm with one bridge from the divider's end, 1.5 mm long; Smallest shape at 10 mm² joins the corner cell to the half next to it, so a click in it fills that half. Contours: 9 or more rings in the half, all inside it and clear of the outline's ink. Tone: under a black-to-white gradient, the darkest strip gets over 2.5 times the ink of a light strip, and no stroke reaches where the image is white.",
  async run() {
    // the box and its divider as one continuous line: down the divider and back up it, then round the box
    const P = [[0, 0], [20, 0], [20, 20], [20, 0], [40, 0], [40, 20], [0, 20]];
    const x = new Float64Array(P.map((p) => p[0])), y = new Float64Array(P.map((p) => p[1]));
    const base = UNB.penFills({ x, y }, true, { pen: 0.5, fills: [] });
    const inner = new Set([...base.lab].filter((l) => l >= 0 && l !== base.outside));
    const r = UNB.penFills({ x, y }, true, { pen: 0.5, fills: [
      { seeds: [[10, 10], [30, 10], [20.1, 10]], width: 0.5, spacing: 0.5, angle: 0 },
      { seeds: [[10, 10]], width: 0.5, spacing: 2, angle: 45, cross: true }] });
    const [aL, aR, aLine] = r.seedAreas[0];
    // solid fill of the left half only (the first two seeds point at different areas; check left on its own)
    const left = UNB.penFills({ x, y }, true, { pen: 0.5, fills: [{ seeds: [[10, 10]], width: 0.5, spacing: 0.5, angle: 0 }] }).fills[0];
    const lineDist = (px, py) => Math.min(px, 20 - px, py, 20 - py);              // distance to the left half's walls
    let worst = Infinity, worstEnd = 0, outside = 0;
    for (const s of left) {
      for (const [px, py] of [[s[0], s[1]], [s[2], s[3]], [(s[0] + s[2]) / 2, (s[1] + s[3]) / 2]]) { if (px < 0 || px > 20 || py < 0 || py > 20) outside++; worst = Math.min(worst, lineDist(px, py)); }
      worstEnd = Math.max(worstEnd, lineDist(s[0], s[1]), lineDist(s[2], s[3]));
    }
    const rows = [...new Set(left.map((s) => s[1].toFixed(3)))].map(Number).sort((a, b) => a - b), gaps = rows.slice(1).map((v, i) => v - rows[i]);
    const cross = r.fills[1], dirs = new Set(cross.map((s) => Math.sign((s[2] - s[0]) * (s[3] - s[1]))));
    const crossOut = cross.filter((s) => Math.max(s[0], s[2]) > 19.5 + 0.06 || Math.min(s[0], s[2]) < 0.5 - 0.06).length;
    const svg = UNB.exportPlotSVG({ x, y }, { paperW: 100, paperH: 60, ox: 30, oy: 20, pen: 0.5, color: "#111111", closed: true,
      fills: [{ n: 2, label: "2 fill", color: "#d1342f", width: 0.5, strokes: left }, { n: 3, label: "3 fill", color: "#2f6fd1", width: 0.5, strokes: cross }] });
    const dxf = UNB.exportDXF([{ x, y, layer: "PEN1", closed: true }, ...left.map((s) => ({ x: [s[0], s[2]], y: [s[1], s[3]], layer: "PEN2", closed: false })), ...cross.map((s) => ({ x: [s[0], s[2]], y: [s[1], s[3]], layer: "PEN3", closed: false }))], 20);
    // Close gaps and Smallest shape: the divider now stops 1.5 mm short of the bottom edge, and a 3 × 3 mm cell sits in
    // the top-left corner
    const Q = [[0, 0], [3, 0], [3, 3], [0, 3], [0, 0], [20, 0], [20, 18.5], [20, 0], [40, 0], [40, 20], [0, 20]];
    const qx = new Float64Array(Q.map((p) => p[0])), qy = new Float64Array(Q.map((p) => p[1]));
    const G0 = UNB.penFills({ x: qx, y: qy }, true, { pen: 0.5 }), G1 = UNB.penFills({ x: qx, y: qy }, true, { pen: 0.5, gap: 1 }), G2 = UNB.penFills({ x: qx, y: qy }, true, { pen: 0.5, gap: 2 });
    const M = UNB.penFills({ x: qx, y: qy }, true, { pen: 0.5, gap: 2, minShape: 10, fills: [{ seeds: [[1.5, 1.5], [10, 10]], width: 0.5 }] });
    const br = G2.bridges[0] || [0, 0, 0, 0], brLen = Math.hypot(br[2] - br[0], br[3] - br[1]);
    // Contours in the left half; tone: a gradient from black at x = 0 to white at x = 30 mm (white beyond), across the whole box
    const C = UNB.penFills({ x, y }, true, { pen: 0.5, fills: [{ seeds: [[10, 10]], width: 0.5, spacing: 1, style: "contours" }] }).fills[0];
    let cWorst = Infinity, cOut = 0;
    for (const q of C) for (let k = 0; k + 1 < q.length; k += 2) { const px = q[k], py = q[k + 1]; if (px < 0 || px > 20 || py < 0 || py > 20) cOut++; cWorst = Math.min(cWorst, lineDist(px, py)); }
    const tw = 80, th = 40, td = new Float32Array(tw * th); for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) td[j * tw + i] = Math.max(0, 1 - (i / 2) / 30);
    const tone = { w: tw, h: th, d: td, a: 2, bx: 0, by: 0 };
    const Tn = UNB.penFills({ x: new Float64Array([0, 40, 40, 0]), y: new Float64Array([0, 0, 20, 20]) }, true, { pen: 0.5, tone, fills: [{ seeds: [[20, 10]], width: 0.5, spacing: 0.5, angle: 90, tone: true }] }).fills[0];
    const inkIn = (a, b) => Tn.reduce((n, q) => { let L = 0; for (let k = 0; k + 3 < q.length; k += 2) { const mx = (q[k] + q[k + 2]) / 2; if (mx >= a && mx < b) L += Math.hypot(q[k + 2] - q[k], q[k + 3] - q[k + 1]); } return n + L; }, 0);
    const dark = inkIn(0.5, 8), light = inkIn(18, 25.5), white = Tn.filter((q) => q.some((v, k) => k % 2 === 0 && v > 30.5)).length;
    return { checks: [
      check("contours: rings in the left half (9.5 mm deep / 1 mm)", C.length, ">=", 9),
      check("contours: points outside the left half", cOut, "==", 0),
      check("contours: closest to the line (mm from centre)", cWorst, ">=", 0.45),
      check("tone: ink in the darkest 7.5 mm ÷ ink in a light 7.5 mm (×)", dark / Math.max(light, 1e-9), ">", 2.5),
      check("tone: strokes where the image is white", white, "==", 0),
      check("gaps open: shapes (box, corner cell)", G0.shapes, "==", 2),
      check("Close gaps 1 mm: 1.5 mm gap stays open (shapes)", G1.shapes, "==", 2),
      check("Close gaps 2 mm: the halves split (shapes)", G2.shapes, "==", 3),
      check("Close gaps 2 mm: one bridge, from the divider's end", +(G2.bridges.length === 1 && Math.abs(br[0] - 20) < 0.05 && Math.abs(br[1] - 18.5) < 0.05), "==", 1),
      check("bridge length off the 1.5 mm gap (mm)", Math.abs(brLen - 1.5), "<", 0.05),
      check("Smallest shape 10 mm²: corner cell joins the left half (shapes)", M.shapes, "==", 2),
      check("Smallest shape: a click in the corner cell finds the left half", +(M.seedAreas[0][0] >= 0 && M.seedAreas[0][0] === M.seedAreas[0][1]), "==", 1),
      check("areas besides the outside", inner.size, "==", 2),
      check("a point in each half finds a different area", +(aL >= 0 && aR >= 0 && aL !== aR), "==", 1),
      check("a point on the divider finds an area", +(aLine === aL || aLine === aR), "==", 1),
      check("solid fill: stroke points outside the left half", outside, "==", 0),
      check("solid fill: closest stroke ink to the line (mm from centre, ≥ 0.5 − grid)", worst, ">=", 0.45),
      check("solid fill: furthest stroke end from the line (mm, ≤ 0.5 + 0.1)", worstEnd, "<=", 0.6),
      check("solid fill: rows (19 mm / 0.5 mm)", rows.length, ">=", 39),
      check("solid fill: rows' spacing off 0.5 mm", Math.max(...gaps.map((g) => Math.abs(g - 0.5))), "<", 1e-6),
      check("solid fill: first row off the fill limit (mm)", rows[0] - 0.5, "<=", 0.1), check("solid fill: last row off the fill limit (mm)", 19.5 - rows[rows.length - 1], "<=", 0.1),
      check("cross-hatch: strokes both ways", dirs.size, "==", 2),
      check("cross-hatch: strokes outside the left half's fill limit", crossOut, "==", 0),
      check("SVG: 3 layers", (svg.match(/inkscape:groupmode="layer"/g) || []).length, "==", 3),
      check("SVG: each pen's colour on its strokes", +(/stroke="#111111"/.test(svg) && /<path d="M[^"]+" fill="none" stroke="#d1342f"/.test(svg) && /<path d="M[^"]+" fill="none" stroke="#2f6fd1"/.test(svg)), "==", 1),
      check("DXF: PEN2 and PEN3 layers", +(/\n8\nPEN2\n/.test(dxf) && /\n8\nPEN3\n/.test(dxf)), "==", 1),
    ], notes: `left half: ${left.length} strokes in ${rows.length} rows; cross-hatch at 45°: ${cross.length} strokes` };
  },
};
