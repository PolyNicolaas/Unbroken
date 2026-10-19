const S = require("../lib/scenes.js"), { trace, UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "E11", title: "Every export format is a complete, readable file",
  guards: "truncated or malformed exports",
  why: "Exports go into other programs (Illustrator, CAD, plotters, slicers). A file missing its header or end marker is rejected or, worse, half-imported.",
  how: "Exports the traced leaf (100 mm, simplified at 0.05 mm, untangled again) to every file the app offers: the pen-plotter page (SVG for Saxi) on landscape A4 with the drawing centred, plain and smooth; flat DXF; and the zip wrapper. (G-code has its own tests, E09 and E21.)",
  pass: "The plotter SVG is 297 × 210 mm with a matching viewBox, one path, every point inside the page and the pen width as the stroke, and the smooth one uses curve (C) commands; the flat DXF has its ENTITIES section, one closed polyline and ends with EOF; zips start with the PK signature.",
  async run() {
    const r = trace(S.sample("leaf")), f = r.fin.final, closed = !r.open; let mx = Infinity, my = Infinity, Mx = -Infinity, My = -Infinity;
    for (let i = 0; i < f.re.length; i++) { mx = Math.min(mx, f.re[i]); Mx = Math.max(Mx, f.re[i]); my = Math.min(my, f.im[i]); My = Math.max(My, f.im[i]); }
    const sc = r.scale, x = Float64Array.from(f.re, (v) => (v - mx) * sc), y = Float64Array.from(f.im, (v) => (v - my) * sc), sp = UNB.simplify(x, y, 0.05, closed), u = UNB.uncross(sp.x, sp.y, closed, { maxAngle: 90 });
    const p = [{ x: u.re, y: u.im }], W = (Mx - mx) * sc, H = (My - my) * sc, txt = (d) => (typeof d === "string" ? d : Buffer.from(d).toString("latin1"));
    const dxf = txt(UNB.exportDXF(p, H, closed)), zip = Buffer.from(UNB.zip("t.dxf", dxf));
    const P = { w: 297, h: 210 }, ox = (P.w - W) / 2, oy = (P.h - H) / 2, plot = UNB.exportPlotSVG({ x: u.re, y: u.im }, { paperW: P.w, paperH: P.h, ox, oy, pen: 0.4, closed });
    const plotS = UNB.exportPlotSVG({ x: u.re, y: u.im }, { paperW: P.w, paperH: P.h, ox, oy, pen: 0.4, closed, smooth: true });
    const nums = (plot.match(/<path d="([^"]+)"/)[1].match(/-?[\d.]+/g) || []).map(Number), xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
    return { checks: [
      check("plotter SVG: page 297 × 210 mm, viewBox in mm", +(/width="297mm" height="210mm" viewBox="0 0 297 210"/.test(plot)), "==", 1),
      check("plotter SVG: one path, pen width as stroke", +((plot.match(/<path /g) || []).length === 1 && /stroke-width="0.4"/.test(plot)), "==", 1),
      check("plotter SVG: points outside the page", xs.filter((v) => v < 0 || v > P.w).length + ys.filter((v) => v < 0 || v > P.h).length, "==", 0),
      check("plotter SVG: drawing centred (mm off)", Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - P.w / 2) + Math.abs((Math.min(...ys) + Math.max(...ys)) / 2 - P.h / 2), "<", 0.5),
      check("plotter SVG: closing tag", +/<\/svg>\s*$/.test(plot), "==", 1),
      check("smooth plotter SVG: curve commands", (plotS.match(/ C/g) || []).length, ">", 10),
      check("DXF: ENTITIES section, one closed polyline, EOF", +(/ENTITIES/.test(dxf) && (dxf.match(/\nPOLYLINE\n/g) || []).length === 1 && /\n70\n1\n/.test(dxf) && /EOF\s*$/.test(dxf)), "==", 1),
      check("zip: PK signature", +(zip[0] === 0x50 && zip[1] === 0x4b), "==", 1),
    ] };
  },
};
