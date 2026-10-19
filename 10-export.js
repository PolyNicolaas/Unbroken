/* Unbroken · engine · 10-export.js
   9. Export — finished line → the files the app offers: plotter-page SVG and flat DXF (2D tab), G-code (3D tab), and
   the ZIP they're wrapped in.
   One part of the engine (no DOM), loaded after 09-plate.js; core.js lists every part and what's in it. */
(function (root) {
  "use strict";
  const UNB = root.UNB,
    { f3, svgPolylines } = UNB._u; // shared helpers (00-util.js)

  // Catmull-Rom through the points as cubic Bézier segments [x0, y0, c1x, c1y, c2x, c2y, x1, y1] (no crossing check)
  function bezierRaw(x, y, closed) {
    const n = x.length,
      segs = [],
      P = (i) =>
        closed
          ? [x[(i + n) % n], y[(i + n) % n]]
          : [x[Math.min(n - 1, Math.max(0, i))], y[Math.min(n - 1, Math.max(0, i))]];
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const p0 = P(i - 1),
        p1 = P(i),
        p2 = P(i + 1),
        p3 = P(i + 2);
      segs.push([
        p1[0],
        p1[1],
        p1[0] + (p2[0] - p0[0]) / 6,
        p1[1] + (p2[1] - p0[1]) / 6,
        p2[0] - (p3[0] - p1[0]) / 6,
        p2[1] - (p3[1] - p1[1]) / 6,
        p2[0],
        p2[1],
      ]);
    }
    return segs;
  }

  // SVG path data for one path: straight segments, or smooth Bézier curves; X, Y map a coordinate to text
  function svgPathD(p, loop, smooth, X, Y) {
    let d = "M" + X(p.x[0]) + " " + Y(p.y[0]);
    if (smooth)
      for (const b of UNB.toBezier(p.x, p.y, loop))
        d += " C" + [X(b[2]), Y(b[3]), X(b[4]), Y(b[5]), X(b[6]), Y(b[7])].join(" ");
    else for (let i = 1; i < p.x.length; i++) d += " L" + X(p.x[i]) + " " + Y(p.y[i]);
    return loop ? d + " Z" : d;
  }
  // a DXF R12 file around entity lines; units 4 = mm
  const dxfDoc = (units, entities) =>
    [
      "0",
      "SECTION",
      "2",
      "HEADER",
      "9",
      "$ACADVER",
      "1",
      "AC1009",
      "9",
      "$INSUNITS",
      "70",
      String(units),
      "0",
      "ENDSEC",
      "0",
      "SECTION",
      "2",
      "ENTITIES",
      ...entities,
      "0",
      "ENDSEC",
      "0",
      "EOF",
    ].join("\n") + "\n";

  // Catmull-Rom through the (simplified) points, as cubic Bézier segments [x0,y0,c1x,c1y,c2x,c2y,x1,y1]
  UNB.toBezier = function (x, y, closed) {
    const segs = bezierRaw(x, y, closed);
    // Smoothing can bulge two close strands into each other. Straighten the segments involved until none cross.
    const K = 8;
    for (let pass = 0; pass < 4 && segs.length; pass++) {
      const end = closed ? 0 : 1,
        sx = new Float64Array(segs.length * K + end),
        sy = new Float64Array(segs.length * K + end); // an open line's last point too
      segs.forEach((b, i) => {
        for (let k = 0; k < K; k++) {
          const t = k / K,
            m = 1 - t;
          sx[i * K + k] = m * m * m * b[0] + 3 * m * m * t * b[2] + 3 * m * t * t * b[4] + t * t * t * b[6];
          sy[i * K + k] = m * m * m * b[1] + 3 * m * m * t * b[3] + 3 * m * t * t * b[5] + t * t * t * b[7];
        }
      });
      if (end) {
        const b = segs[segs.length - 1];
        sx[sx.length - 1] = b[6];
        sy[sy.length - 1] = b[7];
      }
      const cr = UNB.findCrossings(sx, sy, closed);
      if (!cr.length) break;
      for (const [a, b] of cr)
        for (const i of [Math.floor(a / K), Math.min(segs.length - 1, Math.floor(b / K))]) {
          const q = segs[i];
          q[2] = q[0] + (q[6] - q[0]) / 3;
          q[3] = q[1] + (q[7] - q[1]) / 3;
          q[4] = q[0] + (2 * (q[6] - q[0])) / 3;
          q[5] = q[1] + (2 * (q[7] - q[1])) / 3;
        }
    }
    return segs;
  };

  // Flat DXF (R12, mm): one 2D polyline per path; paths in mm with y down on an H mm tall page, written y up.
  // A path may name its own layer (one per pen) and whether it closes; otherwise a single path closes when `closed`.
  UNB.exportDXF = function (paths, H, closed) {
    const L = [];
    for (const p of paths) {
      const ly = p.layer || "TRACE",
        cl = p.closed !== undefined ? p.closed : closed !== false && paths.length === 1;
      L.push("0", "POLYLINE", "8", ly, "66", "1", "70", cl ? "1" : "0");
      for (let i = 0; i < p.x.length; i++)
        L.push("0", "VERTEX", "8", ly, "10", f3(p.x[i]), "20", f3(H - p.y[i]), "30", "0");
      L.push("0", "SEQEND", "8", ly);
    }
    return dxfDoc(4, L);
  };

  // A page for a pen plotter (the AxiDraw through Saxi): the paper at its size in mm, the drawing (mm, y down) moved by
  // (ox, oy) onto it. opt: paperW, paperH, ox, oy, pen (width), color, closed, smooth, extra (pen 1 strokes [x0, y0,
  // x1,
  // y1], e.g. drawn gap bridges), and fills: [{ label, color, width,
  // strokes: [[x0, y0, x1, y1], …] }]. Each pen is its own layer: an Inkscape layer group with its own stroke colour,
  // so
  // Saxi can split them either way (by group or by stroke colour) and the pens can be changed between layers.
  UNB.exportPlotSVG = function (p, opt) {
    const o = opt || {},
      X = (v) => f3(v + o.ox),
      Y = (v) => f3(v + o.oy),
      loop = o.closed && p.x.length > 2,
      d = svgPathD(p, loop, o.smooth, X, Y);
    const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
    const layer = (k, label, color, width, body) =>
      `<g id="pen${k}" inkscape:groupmode="layer" inkscape:label="${esc(label)}" fill="none" stroke="${color}" stroke-width="${f3(width)}" stroke-linejoin="round" stroke-linecap="round">\n${body}</g>\n`;
    const fills = (o.fills || []).filter((f) => f.strokes && f.strokes.length);
    let out =
      `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Unbroken: one continuous ${loop ? "closed" : "open"} line for a pen plotter, ${f3(o.paperW)} x ${f3(o.paperH)} mm page${fills.length ? `, ${fills.length + 1} pens (one layer each)` : ""} -->\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${f3(o.paperW)}mm" height="${f3(o.paperH)}mm" viewBox="0 0 ${f3(o.paperW)} ${f3(o.paperH)}">\n`;
    const color = o.color || "#000000";
    let extra = "";
    if (o.extra && o.extra.length)
      // short extra strokes with pen 1 (drawn gap bridges)
      extra = `<path d="${o.extra.map((q) => `M${X(q[0])} ${Y(q[1])} L${X(q[2])} ${Y(q[3])}`).join(" ")}" fill="none" stroke="${color}" stroke-width="${f3(o.pen || 0.5)}"/>\n`;
    out += layer(
      1,
      "1 drawing",
      color,
      o.pen || 0.5,
      `<path d="${d}" fill="none" stroke="${color}" stroke-width="${f3(o.pen || 0.5)}" stroke-linejoin="round" stroke-linecap="round"/>\n` +
        extra
    );
    fills.forEach((f, i) => {
      const body = svgPolylines(f.strokes, X, Y, 400, `fill="none" stroke="${f.color}" stroke-width="${f3(f.width)}"`);
      out += layer(f.n || i + 2, f.label || `${f.n || i + 2} fill`, f.color, f.width, body);
    });
    return out + "</svg>\n";
  };

  // G-code for the chocolate printer. paths: [{ x, y, z?, e? }] in bed mm, y up, one per copy, each printed start to
  // end
  // (a closed lap repeats its first point at the end, as UNB.layerStack writes it). Bed position = (g.ox + x, g.oy +
  // y).
  // A path may carry f: the feed (mm/min) per point, for the move ending there (UNB.lapFeeds slows small layers), and
  // laps (UNB.layerStack's), which mark each layer in the file ("; layer 3 of 12 (wall)") for reading it back.
  // g: ox, oy, z (first layer height), lift (travel height above the tallest point so far), feed (mm/min), e (plunger
  // mm per mm of line; 0 for none), start / end (the printer's own lines, settings.js; "{needle}" in them becomes the
  // needle's inside diameter), needle (mm), travelSpeed (mm/s for the moves between copies, with or without
  // retraction; 50 when not set), zTravelSpeed (mm/s lifting clear before travelling; 60 when not set) and
  // zApproachSpeed (mm/s lowering onto a copy, and the last lift off the print; 10 when not set).
  // Retraction, as choc OS does it (source/printer/choc-mate-2/choc-os.md), when g.retract > 0: before the first copy
  // the plunger pulls back g.retract at g.retractSpeed (mm/s); each copy starts with an unretract (the first one
  // g.firstUnretractExtra longer) and g.unretractPause (the printer's own pause line); each copy ends with a wipe: the
  // last g.wipeTime seconds of its line (at the print feed) are printed while pulling back g.retract, so no blob is
  // left.
  UNB.exportGcode = function (paths, g) {
    const X = (p, i) => g.ox + p.x[i],
      Y = (p, i) => g.oy + p.y[i],
      r = g.retract > 0 ? g.retract : 0;
    const rF = Math.round(Math.max(0.01, g.retractSpeed || 1) * 60),
      trav = Math.round(Math.max(1, g.travelSpeed || 50) * 60),
      zUp = Math.round(Math.max(0.5, g.zTravelSpeed || 60) * 60),
      zNear = Math.round(Math.max(0.5, g.zApproachSpeed || 10) * 60);
    const wipeT = r ? Math.max(0, g.wipeTime || 0) : 0,
      E5 = (v) => Math.round(v * 100000) / 100000;
    const sub = (l) => l.replace(/\{needle\}/g, f3(g.needle || 0));
    let bx0 = Infinity,
      bx1 = -Infinity,
      by0 = Infinity,
      by1 = -Infinity; // the header gives the printed size (the points' extent)
    for (const p of paths)
      for (let i = 0; i < p.x.length; i++) {
        const x = X(p, i),
          y = Y(p, i);
        if (x < bx0) bx0 = x;
        if (x > bx1) bx1 = x;
        if (y < by0) by0 = y;
        if (y > by1) by1 = y;
      }
    const lines = [
      `; Unbroken — ${paths.length === 1 ? "one continuous path" : `${paths.length} paths, travel moves between them`}`,
      `; size ${bx1 >= bx0 ? `${f3(bx1 - bx0)} x ${f3(by1 - by0)}` : "0 x 0"} mm`,
      ...((g.start || []).length ? ["; printer start", ...g.start.map(sub)] : []),
      "G21 ; mm",
      "G90 ; absolute XYZ",
      "M82 ; absolute E",
      "G92 E0",
    ];
    if (r)
      lines.push(
        `G1 F${rF} E${E5(-r)} ; retract`,
        `G92 E${E5(-r - Math.max(0, g.firstUnretractExtra || 0))} ; the first unretract is this much`
      );
    // Z: the print height plus the path's own z per point (layers); a move carries Z only when it changes.
    // E: g.e per mm of line, times the path's flow multiplier per point when it has one (layers ramp the flow in and
    // out).
    // Travel between paths goes up to the lift above the tallest point printed so far, so it clears finished copies.
    const Z = (p, i) => g.z + (p.z ? p.z[i] : 0),
      F = (p, i) => (p.e ? p.e[i] : 1);
    let top = g.z,
      e = 0;
    paths.forEach((p, k) => {
      if (paths.length > 1) lines.push(`; copy ${k + 1} of ${paths.length}`);
      lines.push(
        `G0 Z${f3(top + g.lift)} F${zUp}`,
        `G0 X${f3(X(p, 0))} Y${f3(Y(p, 0))} F${trav}`,
        `G1 Z${f3(Z(p, 0))} F${zNear}`
      );
      if (r) {
        lines.push(`G1 E0 F${rF} ; unretract`, ...(g.unretractPause ? [g.unretractPause] : []), "G92 E0");
        e = 0;
      }
      // where the wipe starts: wipeLen before the end of the line (only when the line is long enough for it)
      let total = 0;
      for (let i = 1; i < p.x.length; i++) total += Math.hypot(X(p, i) - X(p, i - 1), Y(p, i) - Y(p, i - 1));
      const FD = (i) => Math.round(p.f ? p.f[i] : g.feed),
        wipeLen = (FD(p.x.length - 1) / 60) * wipeT; // the wipe lasts wipeTime at the last layer's feed
      const wipeAt = wipeLen > 0 && total > 4 * wipeLen ? total - wipeLen : Infinity;
      let zNow = Z(p, 0),
        s = 0,
        wiping = false,
        fNow = null;
      const lapAt = new Map(
        (p.laps || []).map((l, li) => [
          l.from,
          `; layer ${li + 1} of ${p.laps.length} (${l.kind === "base" ? "fill" : "wall"})`,
        ])
      );
      if (lapAt.has(0)) lines.push(lapAt.get(0));
      const move = (x, y, z, E, fd) => {
        const zs = Math.abs(z - zNow) > 1e-6 ? ` Z${f3(z)}` : "";
        zNow = z;
        lines.push(`G1 X${f3(x)} Y${f3(y)}${zs}` + (E !== null ? ` E${E5(E)}` : "") + (fd !== fNow ? ` F${fd}` : ""));
        fNow = fd;
      };
      for (let i = 1; i < p.x.length; i++) {
        const x0 = X(p, i - 1),
          y0 = Y(p, i - 1),
          z0 = Z(p, i - 1),
          x1 = X(p, i),
          y1 = Y(p, i),
          zi = Z(p, i),
          d = Math.hypot(x1 - x0, y1 - y0);
        if (zi > top) top = zi;
        if (!wiping && lapAt.has(i)) lines.push(lapAt.get(i));
        const flow = (t) => g.e * (F(p, i - 1) + (F(p, i) - F(p, i - 1)) * t);
        if (!wiping && s + d > wipeAt) {
          // split this segment where the wipe starts
          const t = (wipeAt - s) / d,
            xm = x0 + (x1 - x0) * t,
            ym = y0 + (y1 - y0) * t,
            zm = z0 + (zi - z0) * t;
          if (t > 1e-6) {
            e += Math.hypot(xm - x0, ym - y0, zm - z0) * 0.5 * (flow(0) + flow(t));
            move(xm, ym, zm, g.e > 0 ? e : null, FD(i));
          }
          lines.push("G92 E0", "; wipe: pull back while finishing the line");
          wiping = true;
        }
        s += d;
        if (wiping) move(x1, y1, zi, -r * Math.min(1, (s - wipeAt) / wipeLen), FD(i));
        else {
          e += Math.hypot(x1 - x0, y1 - y0, zi - z0) * 0.5 * (flow(0) + flow(1));
          move(x1, y1, zi, g.e > 0 ? e : null, FD(i));
        }
      }
      if (r && !wiping) lines.push("G92 E0", `G1 F${rF} E${E5(-r)} ; retract`); // too short to wipe: retract in place
    });
    lines.push(
      `G1 Z${f3(top + g.lift)} F${zNear}`,
      ...((g.end || []).length ? ["; printer end", ...g.end.map(sub)] : []),
      "; end"
    );
    return lines.join("\n") + "\n";
  };

  // Read G-code back as line segments for a preview of the whole print: every move from one point to the next, in the
  // order the printer makes them, each with its kind: 0 wall, 1 fill (a filled base layer), 2 travel (no chocolate), 3
  // purge (the printer's start lines), 4 wipe (pulling back while finishing a line). Reads G0 / G1 X Y Z E, G90 / G91,
  // G92 E, and the comments UNB.exportGcode writes ("; layer … (fill)", "; wipe", "; copy", "; printer end"); other
  // lines (host commands, pauses) are skipped. Returns { seg: Float32Array [x0, y0, z0, x1, y1, z1, …], kind:
  // Uint8Array }.
  UNB.readGcode = function (text) {
    const seg = [],
      kind = [];
    let x = 0,
      y = 0,
      z = 0,
      e = 0,
      rel = false,
      layerKind = 0,
      start = true,
      wiping = false,
      known = 0,
      wasKnown = false; // known: X, Y and Z each set once (bits), before that there's no "from"
    for (const raw of text.split(/\r?\n/)) {
      const c = raw.trim();
      if (c.startsWith(";")) {
        if (/^; layer \d+ of \d+ \(fill\)/.test(c)) {
          layerKind = 1;
          start = false;
          wiping = false;
        } else if (/^; layer \d+ of \d+ \(wall\)/.test(c)) {
          layerKind = 0;
          start = false;
          wiping = false;
        } else if (c.startsWith("; wipe")) wiping = true;
        else if (c.startsWith("; copy")) {
          start = false;
          wiping = false;
        } else if (c.startsWith("; printer end")) {
          start = false;
          wiping = false;
        }
        continue;
      }
      const code = c.split(";")[0].trim();
      if (/^G90\b/.test(code)) {
        rel = false;
        continue;
      }
      if (/^G91\b/.test(code)) {
        rel = true;
        continue;
      }
      const m = code.match(/^G([01])\b(.*)$/),
        g92 = code.match(/^G92\b.*E(-?[\d.]+)/);
      if (g92) {
        e = +g92[1];
        continue;
      }
      if (!m) continue;
      const v = {};
      for (const w of m[2].matchAll(/([XYZE])(-?[\d.]+)/g)) v[w[1]] = +w[2];
      const nx = v.X === undefined ? x : rel ? x + v.X : v.X,
        ny = v.Y === undefined ? y : rel ? y + v.Y : v.Y,
        nz = v.Z === undefined ? z : rel ? z + v.Z : v.Z;
      const ne = v.E === undefined ? e : v.E,
        pushes = ne > e + 1e-9;
      if (m[1] === "0") wiping = false;
      known |= (v.X !== undefined ? 1 : 0) | (v.Y !== undefined ? 2 : 0) | (v.Z !== undefined ? 4 : 0);
      if (known === 7 && wasKnown && (nx !== x || ny !== y || nz !== z)) {
        seg.push(x, y, z, nx, ny, nz);
        kind.push(wiping && v.E !== undefined ? 4 : pushes ? (start ? 3 : layerKind) : 2);
      }
      x = nx;
      y = ny;
      z = nz;
      e = ne;
      wasKnown = known === 7;
    }
    return { seg: Float32Array.from(seg), kind: Uint8Array.from(kind) };
  };

  // Minimal ZIP (one stored file) for formats the page cannot save directly: name inside, text content → bytes
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  UNB.zip = function (name, text) {
    const enc = new TextEncoder(),
      data = enc.encode(text),
      fn = enc.encode(name);
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) crc = CRC[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    crc = (crc ^ 0xffffffff) >>> 0;
    const lh = new DataView(new ArrayBuffer(30)),
      ch = new DataView(new ArrayBuffer(46)),
      eo = new DataView(new ArrayBuffer(22));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(8, 0, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true);
    lh.setUint32(22, data.length, true);
    lh.setUint16(26, fn.length, true);
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true);
    ch.setUint32(24, data.length, true);
    ch.setUint16(28, fn.length, true);
    ch.setUint32(42, 0, true);
    const cdOff = 30 + fn.length + data.length,
      cdLen = 46 + fn.length;
    eo.setUint32(0, 0x06054b50, true);
    eo.setUint16(8, 1, true);
    eo.setUint16(10, 1, true);
    eo.setUint32(12, cdLen, true);
    eo.setUint32(16, cdOff, true);
    const out = new Uint8Array(cdOff + cdLen + 22);
    let o = 0;
    for (const part of [
      new Uint8Array(lh.buffer),
      fn,
      data,
      new Uint8Array(ch.buffer),
      fn,
      new Uint8Array(eo.buffer),
    ]) {
      out.set(part, o);
      o += part.length;
    }
    return out;
  };
})(typeof window !== "undefined" ? window : globalThis);
