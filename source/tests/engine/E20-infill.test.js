const S = require("../lib/scenes.js"), { trace, UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
const W = 0.84;                                             // 18G needle

// How far each point enclosed by the printed line is from the nearest line, in spacings (0.5 = evenly covered)
function emptiest(f, d) {
  const g = d / 6; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < f.re.length; i++) { x0 = Math.min(x0, f.re[i]); x1 = Math.max(x1, f.re[i]); y0 = Math.min(y0, f.im[i]); y1 = Math.max(y1, f.im[i]); }
  const ox = x0 - d, oy = y0 - d, w = Math.ceil((x1 - x0 + 2 * d) / g) + 2, h = Math.ceil((y1 - y0 + 2 * d) / g) + 2, line = new Uint8Array(w * h), n = f.re.length;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n, L = Math.hypot(f.re[j] - f.re[i], f.im[j] - f.im[i]), k = Math.max(1, Math.ceil(L / (g / 2)));
    for (let s = 0; s <= k; s++) line[Math.round((f.im[i] + (f.im[j] - f.im[i]) * s / k - oy) / g) * w + Math.round((f.re[i] + (f.re[j] - f.re[i]) * s / k - ox) / g)] = 1; }
  const out = new Uint8Array(w * h), st = [0]; out[0] = 1;
  while (st.length) { const p = st.pop(), px = p % w; for (const q of [px > 0 ? p - 1 : -1, px < w - 1 ? p + 1 : -1, p - w, p + w]) if (q >= 0 && q < w * h && !line[q] && !out[q]) { out[q] = 1; st.push(q); } }
  const { dist } = UNB.edt(line, w, h), v = []; for (let s = 0; s < w * h; s++) if (!out[s] && !line[s]) v.push(dist[s] * g / d);
  v.sort((a, b) => a - b); return { p99: v[Math.floor(0.99 * (v.length - 1))], max: v[v.length - 1] };
}

module.exports = {
  id: "E20", title: "Infill: enclosed areas filled with the same line, one spacing apart",
  guards: "fills that cross the line, crowd it, leave big holes or break it into pieces; small areas filled when they were meant to be left open; the infill counted as error",
  why: "Infill fills every area the line encloses with more of the same continuous line, one spacing apart, so a design can print as solid chocolate (gap 0) or as an open hatch (a gap). Each area's fill is a set of closed loops merged into one by short bridges, and that loop is bridged into the printed line on a straight stretch, so nothing crosses and nothing is drawn twice. Rings follow the area's edge; Lines are straight rows paired into narrow loops inside one ring.",
  how: "Traces the leaf at 80 mm with an 18G needle, gap 0.5 mm and gap 0, and the smiley at 60 mm with gap 0, with no infill, Rings and Lines. Measures crossings, the closest gap, and how far every point enclosed by the printed line is from the nearest line (99th percentile and worst, in spacings). Then fills the shapes sample with a 'leave small areas open' size and counts what is left open, and compares the error with and without infill.",
  pass: "Density 100% (rows a line width apart) with a 0.5 mm gap: no crossings, lines at least 0.85 line widths apart and every enclosed point within 0.9 line widths of a line for 99% of the area with Lines, 1.1 with Rings (solid); 50%: within 1.6. With infill: no crossings, closest gap ≥ 90% of the spacing, every enclosed point within 1 spacing of a line for 99% of the area (about 4–8 spacings without infill) and within 1.6 at worst; at least one area filled. Leaving areas under 80 mm² open on the shapes sample leaves some open and fills fewer; the error with infill is within 0.1 mm of the error without.",
  slow: true,
  async run() {
    const checks = [], notes = [];
    for (const [name, Wmm, gap, fills] of [["leaf", 80, 0.5, ["rings", "lines"]], ["leaf", 80, 0, ["rings", "lines"]], ["smiley", 60, 0, ["lines"]]]) {
      const base = trace(S.sample(name), { spacingMM: W + gap, lineMM: W, outW: Wmm }), e0 = emptiest(base.fin.final, base.dpx);
      for (const fill of fills) {
        const r = trace(S.sample(name), { spacingMM: W + gap, lineMM: W, outW: Wmm, fill }), e = emptiest(r.fin.final, r.dpx), tag = `${name} ${Wmm} mm, gap ${gap}, ${fill}`;
        checks.push(check(`${tag}: areas filled`, r.sg.filled, ">=", 1), check(`${tag}: crossings`, r.fin.after, "==", 0),
          check(`${tag}: closest gap (spacings)`, r.fin.gap / r.dpx, ">=", 0.9),
          check(`${tag}: emptiest 1% of the enclosed area (spacings to a line)`, e.p99, "<=", 1.0), check(`${tag}: emptiest point (spacings)`, e.max, "<=", 1.6));
        if (name === "leaf" && gap === 0.5) checks.push(check(`${tag}: error with infill − without (mm)`, (r.fin.err.score - base.fin.err.score) * r.scale, "<=", 0.1));
        notes.push(`${tag}: emptiest 1% ${e.p99.toFixed(2)} (without ${e0.p99.toFixed(2)}), worst ${e.max.toFixed(2)} spacings`);
      }
    }
    // density: 100% puts the rows a line width apart (touching: solid chocolate even with a gap between the drawing's
    // lines), 50% two line widths apart
    for (const [fill, dens] of [["lines", 1], ["rings", 1], ["lines", 0.5]]) {
      const r = trace(S.sample("leaf"), { spacingMM: W + 0.5, lineMM: W, outW: 80, fill, fillDensity: dens }), wpx = W / r.scale, e = emptiest(r.fin.final, wpx), tag = `leaf 80 mm, gap 0.5, ${fill} at ${dens * 100}%`;
      checks.push(check(`${tag}: crossings`, r.fin.after, "==", 0), check(`${tag}: closest gap (line widths)`, r.fin.gap / wpx, ">=", 0.85),
        check(`${tag}: emptiest 1% of the enclosed area (line widths to a line)`, e.p99, "<=", dens === 1 ? (fill === "rings" ? 1.1 : 0.9) : 1.6));   // rings leave a small hole where they close up
      notes.push(`${tag}: emptiest 1% ${e.p99.toFixed(2)} line widths, closest gap ${(r.fin.gap / wpx).toFixed(2)}`);
    }
    const all = trace(S.sample("shapes"), { spacingMM: 1.34, lineMM: W, outW: 80, fill: "rings" });
    const some = trace(S.sample("shapes"), { spacingMM: 1.34, lineMM: W, outW: 80, fill: "rings", fillMinArea: 80 / all.scale ** 2 });
    checks.push(check("shapes 80 mm, small areas (under 80 mm²) left open: areas left open", some.sg.skipped, ">=", 1), check("…and fewer areas filled than with fill all", some.sg.filled, "<", all.sg.filled));
    notes.push(`shapes: ${all.sg.filled} areas filled; leaving under 80 mm² open: ${some.sg.filled} filled, ${some.sg.skipped} open`);
    return { checks, notes: notes.join(" · ") };
  },
};
