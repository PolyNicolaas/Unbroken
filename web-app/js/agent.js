// Unbroken · web app · agent.js
// window.unbroken: the app driven from outside, by an agent, a script or a test, the way a person drives it, without
// reaching into the app's own functions and fields. Every call works through the same controls a person uses (so the
// app reacts exactly as it would to a click), waits until the app is ready, and answers with plain data. AGENT.md lists
// the calls; docs/AGENT-PLAYBOOK.md says how an agent uses them. Loaded after main.js (which keeps body[data-state]).
// Plain script (not a module) so the app also works opened straight from disk.
"use strict";

// a control set as a person would: its value, then the events its listeners wait for
function agentSet(id, v) {
  const el = $(id);
  if (!el) throw new Error(`no control #${id}`);
  if (el.type === "checkbox" || el.type === "radio") el.checked = !!v;
  else el.value = v;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}
// a <select> by its value, or by part of an option's text ("18G", "0.84", "Dark")
function agentPick(id, v) {
  const el = $(id),
    s = String(v).toLowerCase(),
    o =
      [...el.options].find((o) => o.value === String(v)) ||
      [...el.options].find((o) => o.textContent.toLowerCase().includes(s));
  if (!o)
    throw new Error(
      `#${id} has no option "${v}" (options: ${[...el.options].map((o) => o.textContent.trim()).join(", ")})`
    );
  agentSet(id, o.value);
}
const agentReady = (ms) => window.unbroken.whenReady(ms);

// The settings unbroken.set() knows, in the order they're applied (what the design is before how it's traced, the
// size last, since the size follows the trace). Values are what a person would pick; numbers in mm where they're mm.
const AGENT_SETTINGS = [
  ["madeFor", (v) => agentSet(/plot/i.test(v) ? "artForPlot" : "artForPrint", true)],
  ["input", (v) => artUse(v)], // "picture", "text", "pattern", "molecule", "model"
  ["text", (v) => agentSet("textIn", v)],
  ["font", (v) => agentPick("font", v)],
  ["needle", (v) => agentPick("needle", v)],
  ["chocolate", (v) => agentPick("chocolate", v)],
  ["style", (v) => agentSet(/outline|edge/i.test(v) ? "modeOutline" : "modeCenter", true)],
  ["threshold", (v) => agentSet("sens", v)], // −60 … 60: higher takes in lighter parts
  ["smoothing", (v) => agentSet("blur", v)], // the Smoothing slider, 0 … 30 (tenths of a working pixel)
  ["ignoreSpecks", (v) => agentSet("minLen", v)], // 0 … 200
  ["dropFarAway", (v) => agentSet("far", v)], // 0 … 40 (% of the picture)
  ["looseEnds", (v) => agentPick("loose", v)],
  ["cornersMM", (v) => agentSet("corner", Math.round(+v * 10))], // Round corners, radius in mm (0 = off)
  ["crossings", (v) => agentPick("uncross", v)],
  ["allowOverlaps", (v) => agentSet("overlaps", v)],
  ["lineGapMM", (v) => agentSet("lineGapMM", v)], // between lines, on top of the line width
  ["widthMM", (v) => agentSet("outW", v)],
  ["heightMM", (v) => agentSet("outH", v)],
  ["letterHeightMM", (v) => agentSet("capH", v)],
  [
    "fitInside",
    ([w, h]) => {
      $("fitW").value = w;
      $("fitH").value = h;
      $("fitBtn").click();
    },
  ],
  ["terms", (v) => (v === "auto" ? $("auto").click() : agentSet("terms", agentTermsSlider(+v)))],
  ["copies", (v) => agentSet("copies", v)],
  ["printHeightMM", (v) => agentSet("printHeightMM", v)],
  ["name", (v) => agentSet("designName", v)],
];
// the Complexity slider's position for a term count (controls.js maps it back the same way)
const agentTermsSlider = (n) =>
  Math.max(0, Math.min(1000, Math.round((1000 * Math.log(Math.max(2, n) / 2)) / Math.log(st.Nmax / 2))));

// The picture's parts: the ink's separate shapes (8-connected), grouped into bands and the groups side by side within
// them (below), each with its box and its size in mm when the whole picture's ink is widthMM wide (default: the size
// now, without a selection).
// strokeMM is the parts' typical stroke width (twice the ink's area over its outline), the number to hold against the
// needle: strokes under about two line spacings wobble or blob when traced (docs/AGENT-PLAYBOOK.md).
function agentParts(o = {}) {
  const src = st.source;
  if (!src || !src.getContext) return { parts: [], note: "no picture" };
  const k = Math.min(1, 900 / Math.max(src.width, src.height)),
    w = Math.max(1, Math.round(src.width * k)),
    h = Math.max(1, Math.round(src.height * k)),
    c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  g.drawImage(src, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data,
    light = $("invert") && $("invert").checked,
    ink = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const v = (d[4 * i] + d[4 * i + 1] + d[4 * i + 2]) / 3;
    ink[i] = light ? v > 160 : v < 160;
  }
  // components
  const lab = new Int32Array(w * h).fill(-1),
    comps = [],
    stack = [];
  for (let s = 0; s < w * h; s++) {
    if (!ink[s] || lab[s] >= 0) continue;
    const C = { x0: w, y0: h, x1: -1, y1: -1, area: 0, edge: 0 };
    lab[s] = comps.length;
    stack.push(s);
    while (stack.length) {
      const p = stack.pop(),
        x = p % w,
        y = (p / w) | 0;
      C.area++;
      if (x < C.x0) C.x0 = x;
      if (x > C.x1) C.x1 = x;
      if (y < C.y0) C.y0 = y;
      if (y > C.y1) C.y1 = y;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const X = x + dx,
            Y = y + dy;
          if (X < 0 || Y < 0 || X >= w || Y >= h || !ink[Y * w + X]) {
            if (!dx || !dy) C.edge++; // an outline step (4-neighbours only)
            continue;
          }
          const q = Y * w + X;
          if (lab[q] < 0) {
            lab[q] = comps.length;
            stack.push(q);
          }
        }
    }
    comps.push(C);
  }
  let all = { x0: w, y0: h, x1: -1, y1: -1 };
  const big = comps.filter((C) => C.area >= 4); // specks out
  for (const C of big)
    all = {
      x0: Math.min(all.x0, C.x0),
      y0: Math.min(all.y0, C.y0),
      x1: Math.max(all.x1, C.x1),
      y1: Math.max(all.y1, C.y1),
    };
  if (!big.length) return { parts: [], note: "no ink found" };
  const widthMM = +o.widthMM || (st.sel ? null : +$("outW").value) || null,
    mmPerPx = widthMM ? widthMM / (all.x1 - all.x0 + 1) : null;
  // Parts in two steps, the way a logo is laid out: bands one above the other (rows of ink with more than bandGapMM of
  // empty rows between them), then within a band, groups side by side with more than sideGapMM of empty columns
  // between them (letters of a word stay together; a mark beside a word doesn't). A band much narrower and shorter
  // than its nearest neighbour (a dot over an i between the lines) joins it.
  const gapPx = mmPerPx ? (+o.bandGapMM || 1) / mmPerPx : 0.01 * (all.y1 - all.y0 + 1),
    sidePx = mmPerPx ? (+o.sideGapMM || 4) / mmPerPx : 0.04 * (all.x1 - all.x0 + 1);
  const box = (L) =>
    L.reduce(
      (G, C) => ({
        x0: Math.min(G.x0, C.x0),
        y0: Math.min(G.y0, C.y0),
        x1: Math.max(G.x1, C.x1),
        y1: Math.max(G.y1, C.y1),
      }),
      { x0: w, y0: h, x1: -1, y1: -1 }
    );
  const runs = (L, a, b, gap) => {
    // members grouped where their [a, b] spans come within gap of each other
    const S = [...L].sort((p, q) => p[a] - q[a]),
      out = [];
    for (const C of S) {
      const R = out[out.length - 1];
      if (R && C[a] - R.end <= gap) {
        R.list.push(C);
        R.end = Math.max(R.end, C[b]);
      } else out.push({ list: [C], end: C[b] });
    }
    return out.map((R) => R.list);
  };
  let bands = runs(big, "y0", "y1", gapPx);
  for (let moved = true; moved && bands.length > 1;) {
    moved = false;
    const B = bands.map(box);
    for (let i = 0; i < bands.length; i++) {
      const near = [i - 1, i + 1]
          .filter((j) => j >= 0 && j < bands.length)
          .sort(
            (p, q) =>
              Math.min(Math.abs(B[p].y0 - B[i].y1), Math.abs(B[i].y0 - B[p].y1)) -
              Math.min(Math.abs(B[q].y0 - B[i].y1), Math.abs(B[i].y0 - B[q].y1))
          )[0],
        wi = B[i].x1 - B[i].x0,
        hi = B[i].y1 - B[i].y0;
      if (near != null && wi < 0.1 * (B[near].x1 - B[near].x0) && hi < 0.35 * (B[near].y1 - B[near].y0)) {
        bands[near] = bands[near].concat(bands[i]);
        bands.splice(i, 1);
        moved = true;
        break;
      }
    }
  }
  const groupsL = bands.flatMap((L) => runs(L, "x0", "x1", sidePx));
  const groups = groupsL.map((L) => ({
    ...box(L),
    area: L.reduce((s, C) => s + C.area, 0),
    edge: L.reduce((s, C) => s + C.edge, 0),
    shapes: L.length,
  }));
  const mm = (px) => (mmPerPx ? +(px * mmPerPx).toFixed(1) : null);
  const parts = groups
    .sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)
    .map((G) => ({
      box: [G.x0 / w, G.y0 / h, (G.x1 + 1) / w, (G.y1 + 1) / h].map((v) => +v.toFixed(4)), // fractions of the picture
      widthMM: mm(G.x1 - G.x0 + 1),
      heightMM: mm(G.y1 - G.y0 + 1),
      strokeMM: mm((2 * G.area) / Math.max(1, G.edge)),
      shapes: G.shapes,
      share: +(G.area / big.reduce((s, C) => s + C.area, 0)).toFixed(3), // of all the ink
    }));
  return { widthMM, bandGapMM: mmPerPx ? +o.bandGapMM || 1 : null, sideGapMM: mmPerPx ? +o.sideGapMM || 4 : null, parts };
}

// The printed line seen from above, drawn at a fixed scale (pxPerMM), as a PNG data URL: what a person would see if
// the print were laid on paper. A text printed as a piece per line shows its pieces as laid out. For option sheets:
// two snapshots at the same pxPerMM compare sizes truly.
function agentSnapshot(o = {}) {
  if (isModel()) return null;
  const ppm = +o.pxPerMM || 8,
    margin = (o.marginMM ?? 2) * ppm,
    lw = lineWidthMM() * ppm,
    lines = [];
  const lay = plateNow();
  if (lay && lay.pieces) {
    const set = lay.placed.slice(0, lay.pieces.length);
    for (const p of set) {
      const q = lay.pieces[p.piece].local;
      lines.push({ x: Array.from(q.x, (v) => v + p.x), y: Array.from(q.y, (v) => v + p.y) });
    }
  } else {
    const d = designMM();
    if (!d) return null;
    const f = st.final,
      x = [],
      y = [];
    for (let i = 0; i < f.re.length; i++) {
      x.push((f.re[i] - d.b.x0) * d.k);
      y.push((d.b.y1 - f.im[i]) * d.k);
    }
    lines.push({ x, y, closed: !st.open });
  }
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const L of lines)
    for (let i = 0; i < L.x.length; i++) {
      x0 = Math.min(x0, L.x[i]);
      x1 = Math.max(x1, L.x[i]);
      y0 = Math.min(y0, L.y[i]);
      y1 = Math.max(y1, L.y[i]);
    }
  const c = document.createElement("canvas");
  c.width = Math.ceil((x1 - x0) * ppm + lw + 2 * margin);
  c.height = Math.ceil((y1 - y0) * ppm + lw + 2 * margin);
  const g = c.getContext("2d");
  g.fillStyle = o.background || "#f6f4f0";
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = o.color || "#5b3a29";
  g.lineWidth = lw;
  g.lineJoin = g.lineCap = "round";
  const X = (v) => margin + lw / 2 + (v - x0) * ppm,
    Y = (v) => margin + lw / 2 + (y1 - v) * ppm; // y up in mm, down on the canvas
  for (const L of lines) {
    g.beginPath();
    L.x.forEach((v, i) => (i ? g.lineTo(X(v), Y(L.y[i])) : g.moveTo(X(v), Y(L.y[i]))));
    if (L.closed) g.closePath();
    g.stroke();
  }
  return {
    png: c.toDataURL("image/png"),
    widthMM: +(x1 - x0 + lineWidthMM()).toFixed(1),
    heightMM: +(y1 - y0 + lineWidthMM()).toFixed(1),
    pxPerMM: ppm,
  };
}

// Export a file: "gcode" (the Print step's G-code, zipped), "dxf" (DXF for choc OS) or "svg" (the pen plotter's page).
// download: false gives the file's contents instead of saving it (G-code as text). A ready list with a red line isn't
// exported unless anyway: true, as Export G-code asks for a second click.
async function agentExport(kind = "gcode", o = {}) {
  const fmtName = { gcode: "gcode", dxf: "chocdxf", svg: "svg" }[kind];
  if (!fmtName) throw new Error(`export: "${kind}" isn't gcode, dxf or svg`);
  if (fmtName !== "svg" && !layersWanted()) setStage("plate"); // the G-code needs the layers
  await agentReady();
  if (fmtName === "gcode") {
    const bad = readyUI().filter((r) => r.lvl === "bad");
    if (bad.length && !o.anyway) return { ok: false, notReady: bad.map((r) => r.text) };
  }
  if (o.download === false) {
    const f = await buildFile(fmtName);
    return {
      ok: true,
      name: f.text ? f.inner : f.name,
      info: f.info,
      text: f.text || (typeof f.data === "string" ? f.data : null),
    };
  }
  const msg = fmtName === "svg" ? $("exportMsg") : $("gcodeMsg");
  await exportAs(fmtName, msg);
  const t = (msg.textContent || "").trim();
  return { ok: /^Exported/.test(t), message: t };
}

window.unbroken = {
  // what's on screen, as data
  status() {
    const e = st.err,
      sc = st.final ? scale() : 0,
      lifted = answer("lineLifts"),
      ready = st.final || isModel() ? readyItems() : [];
    return {
      state: document.body.dataset.state,
      version: $("appVersion").textContent,
      madeFor: artForPlot() ? "pen plotter" : "printer",
      input: st.art ? st.art.kind : null,
      source: st.srcLabel || null,
      selection: st.sel ? true : false,
      name: $("designName").value.trim() || null,
      trace: st.final
        ? {
            style: $("modeOutline").checked ? "outline" : "centerline",
            terms: st.N,
            errorMM: e ? +(e.score * sc).toFixed(3) : null,
            connectors: Math.max(0, (st.connRuns || 0) - (lifted ? lifted.n : 0)),
            threshold: +$("sens").value,
            smoothing: $("blurVal").textContent,
            smoothingSlider: +$("blur").value,
          }
        : null,
      size: st.final
        ? { widthMM: +(+$("outW").value).toFixed(1), heightMM: +(+$("outH").value).toFixed(1), pickedByApp: sizePicked }
        : null,
      line: {
        widthMM: lineWidthMM(),
        spacingMM: st.spacing,
        needle: $("needle").selectedOptions[0]?.textContent.trim() || null,
      },
      ready: ready.map((r) => ({ level: r.lvl, text: r.text })),
      lastExport: ($("gcodeMsg").textContent || "").trim() || null,
    };
  },
  // resolves with status() once the app is ready (or empty); rejects after ms
  whenReady(ms = 120000) {
    const t0 = Date.now();
    return new Promise((res, rej) => {
      const go = () =>
        ["ready", "empty"].includes(document.body.dataset.state)
          ? res(window.unbroken.status())
          : Date.now() - t0 > ms
            ? rej(new Error("still working after " + ms + " ms"))
            : setTimeout(go, 150);
      setTimeout(go, 300);
    });
  },
  // a picture from a link (the site must let other pages load it)
  async open(url) {
    const ok = await loadURL(url);
    return ok ? agentReady() : { ok: false, message: $("chip").textContent };
  },
  // settings by name (AGENT.md lists them); applied in a sensible order, then waits for the app
  async set(s = {}) {
    const unknown = Object.keys(s).filter((k) => !AGENT_SETTINGS.some(([n]) => n === k));
    if (unknown.length) throw new Error(`unknown setting${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}`);
    for (const [n, fn] of AGENT_SETTINGS)
      if (n in s) {
        fn(s[n]);
        await agentReady(); // each step settled before the next (a new input, a new trace, a new size)
      }
    return agentReady();
  },
  // trace only part of the picture: [x0, y0, x1, y1] as fractions of it (parts() gives boxes like that), or null for
  // the whole picture
  async select(box) {
    if (box && (box.length !== 4 || box.some((v) => !(v >= 0 && v <= 1))))
      throw new Error("select: a box is [x0, y0, x1, y1], each 0 … 1");
    applySel(
      box
        ? [
            [box[0], box[1]],
            [box[2], box[1]],
            [box[2], box[3]],
            [box[0], box[3]],
          ]
        : null
    );
    return agentReady();
  },
  parts: (o) => agentParts(o),
  // Optimize tracing; keep: false puts the settings back after seeing what it would change
  async optimize(o = {}) {
    if (!heard("optimize")) return { ok: false, message: "Optimize tracing is switched off" };
    await agentReady();
    const r = await answer("optimize", o);
    return { ...r, status: await agentReady() };
  },
  export: (kind, o) => agentExport(kind, o),
  snapshot: (o) => agentSnapshot(o),
  // which view the Print step shows: "line", "plate", "layers" (or "page" for the plotter)
  async view(v) {
    setStage(v);
    return agentReady();
  },
};
