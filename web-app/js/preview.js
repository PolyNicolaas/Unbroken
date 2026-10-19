// Unbroken · web app · preview.js
// The preview: epicycle animation, drawing the line and overlays, the size box and the error chart.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// ---------- epicycles + animation: two circle chains, one per axis ----------
// x(t) = x₀ + Σ a cos(2πkt + φ): a chain of circles above the drawing whose tip's x is x(t).
// y(t) = y₀ + Σ b cos(2πkt + ψ): a chain to the left, turned a quarter, whose tip's y is y(t). The pen sits where they
// meet.
const CHAIN_SHOWN = 160; // circles drawn per chain (all of them count towards the tip)
function chainStep(tm, t, yAxis) {
  const a = 2 * Math.PI * tm.k * t + tm.phase,
    c = tm.amp * Math.cos(a),
    s = tm.amp * Math.sin(a);
  return yAxis ? [-s, c] : [c, s];
}
function buildEpicycles() {
  const ax = st.fit.ax,
    terms = st.codes.map((c) => UNB.termOf(c, ax));
  const off = (a) => {
    const t = terms.find((m) => m.axis === a && m.k === 0);
    return t ? t.amp * Math.cos(t.phase) : 0;
  };
  const xs = terms.filter((m) => m.axis === "x" && m.k > 0).sort((a, b) => b.amp - a.amp),
    ys = terms.filter((m) => m.axis === "y" && m.k > 0).sort((a, b) => b.amp - a.amp);
  // how far each chain reaches from its anchor over one cycle (circles included), to place it clear of the drawing
  const reach = (list, yAxis) => {
    let lo = [Infinity, Infinity],
      hi = [-Infinity, -Infinity];
    for (let q = 0; q <= 160; q++) {
      let x = 0,
        y = 0;
      for (let i = 0; i < list.length; i++) {
        const r = i < CHAIN_SHOWN ? list[i].amp : 0;
        lo = [Math.min(lo[0], x - r), Math.min(lo[1], y - r)];
        hi = [Math.max(hi[0], x + r), Math.max(hi[1], y + r)];
        const [dx, dy] = chainStep(list[i], (q / 160) * (st.open ? 0.5 : 1), yAxis);
        x += dx;
        y += dy;
      }
    }
    return { lo, hi };
  };
  const fb = st.fb || { x0: 0, y0: 0, x1: st.w, y1: st.h },
    gap = 0.06 * Math.max(fb.x1 - fb.x0, fb.y1 - fb.y0, 1);
  const rx = reach(xs, false),
    ry = reach(ys, true);
  const xa = [off("x"), fb.y0 - gap - rx.hi[1]],
    ya = [fb.x0 - gap - ry.hi[0], off("y")]; // anchors: X chain above, Y chain to the left
  st.epi = {
    xs,
    ys,
    xa,
    ya,
    box: [
      Math.min(xa[0] + rx.lo[0], ya[0] + ry.lo[0]),
      Math.min(xa[1] + rx.lo[1], ya[1] + ry.lo[1]),
      Math.max(xa[0] + rx.hi[0], fb.x1),
      Math.max(ya[1] + ry.hi[1], fb.y1),
    ],
  };
}

let lastTs = 0;
// stop the drawing animation; t: where it rests (0 = the start, 1 = the whole line drawn)
function stopPlay(t = 0) {
  st.playing = false;
  st.t = t;
  $("play").textContent = "Play drawing";
}
function loop(ts) {
  if (!st.playing) return;
  const dt = lastTs ? (ts - lastTs) / 1000 : 0;
  lastTs = ts;
  st.t += dt / +$("speed").value;
  if (st.t >= 1) {
    stopPlay(1);
    redrawStage();
    return;
  }
  redrawStage(); // views.js: the line, the 2D page or the 3D layers, whichever is showing
  requestAnimationFrame(loop);
}
$("play").addEventListener("click", () => {
  const v = stageNow();
  if (v === "plate" || (v === "line" ? !st.fit : v === "page" ? !st.plot : !st.layers)) return; // nothing to play yet
  st.playing = !st.playing;
  $("play").textContent = st.playing ? "Pause" : "Play drawing";
  if (st.playing) {
    if (st.t >= 1) st.t = 0;
    lastTs = 0;
    requestAnimationFrame(loop);
  } else redrawStage();
});

// ---------- drawing ----------
function view() {
  const cv = $("view"),
    { r, dpr } = fitCanvas(cv, true) || { r: cv.getBoundingClientRect(), dpr: window.devicePixelRatio || 1 };
  // fit the working image, and the size box too when it's shown (a tilted box can reach past the image)
  let x0 = 0,
    y0 = 0,
    x1 = st.w,
    y1 = st.h;
  if ((st.playing || (st.t > 0 && st.t < 1)) && $("circles").checked && st.epi && st.epi.box) {
    const b = st.epi.box;
    x0 = Math.min(x0, b[0]);
    y0 = Math.min(y0, b[1]);
    x1 = Math.max(x1, b[2]);
    y1 = Math.max(y1, b[3]);
  } // room for both circle chains
  if (st.mbox && $("dims").checked && st.tool !== "erase" && st.tool !== "cross" && st.tool !== "lane")
    for (const [x, y] of st.mbox.corners) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  const pad = 26 * dpr,
    k = Math.min((cv.width - 2 * pad) / (x1 - x0), (cv.height - 2 * pad) / (y1 - y0));
  const t = zoomT("line", cv); // zoom.js: the line view's zoom and pan, folded in so the tools follow it
  return {
    cv,
    g: cv.getContext("2d"),
    k: k * t.z,
    ox: ((cv.width - (x1 - x0) * k) / 2 - x0 * k) * t.z + t.tx,
    oy: ((cv.height - (y1 - y0) * k) / 2 - y0 * k) * t.z + t.ty,
    dpr,
    rect: r,
  };
}
function bgLayer(kind, accent) {
  // the faint image or line map behind the drawing; accent: in the key so a theme change redraws it
  const key = kind + accent + st.w;
  if (st.bgCache && st.bgCache.key === key) return st.bgCache.c;
  const c = document.createElement("canvas");
  c.width = st.w;
  c.height = st.h;
  const g = c.getContext("2d");
  if (kind === "source") {
    g.globalAlpha = 0.28;
    g.drawImage(st.small, 0, 0);
  } else if (kind === "lines" && st.walk) {
    const im = g.createImageData(st.w, st.h),
      m = st.walk.mask;
    const [R, G, B] = cssRGBA("--accent"); // any CSS colour form (#abc, #aabbcc, rgb(…))
    for (let i = 0; i < m.length; i++)
      if (m[i]) {
        im.data[4 * i] = R;
        im.data[4 * i + 1] = G;
        im.data[4 * i + 2] = B;
        im.data[4 * i + 3] = 90;
      }
    g.putImageData(im, 0, 0);
  }
  st.bgCache = { key, c };
  return c;
}
// The preview, in layers: what's under the line, the line, marks on it, and the turning circles while it plays.
function render() {
  if (isModel()) {
    drawModel();
    return;
  } // model.js
  if (st.tool === "select") {
    renderSelect();
    return;
  }
  if (st.tool === "draw") {
    renderDraw();
    return;
  }
  if (!st.w) return;
  const v = view();
  v.g.clearRect(0, 0, v.cv.width, v.cv.height);
  v.ink = css("--ink");
  v.accent = css("--accent");
  renderUnder(v);
  if (!st.final) return;
  const r = renderLine(v);
  renderMarks(v, r);
  if (r.animating && $("circles").checked && st.epi) renderCircles(v, r);
}
// under the line: the background (source, detected lines or nothing), a freehand selection, painted areas, the brush
function renderUnder({ g, k, ox, oy, dpr, accent }) {
  const bg = st.tool === "erase" ? "lines" : $("bg").value;
  if (bg !== "none") {
    g.imageSmoothingEnabled = false;
    g.drawImage(bgLayer(bg, accent), ox, oy, st.w * k, st.h * k);
  }
  if (st.sel && st.crop && st.sel.length > 4) {
    // faint outline of a freehand selection
    const { sx, sy, kx, ky } = st.crop,
      W = st.source.width,
      H = st.source.height;
    g.save();
    g.strokeStyle = css("--muted");
    g.globalAlpha = 0.6;
    g.setLineDash([4 * dpr, 4 * dpr]);
    g.lineWidth = dpr;
    g.beginPath();
    st.sel.forEach(([u, v], i) => {
      const x = ox + (u * W - sx) * kx * k,
        y = oy + (v * H - sy) * ky * k;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    });
    g.closePath();
    g.stroke();
    g.restore();
  }
  const painting = st.tool === "cross" || st.tool === "lane";
  for (const kind of ["lane", "cross"]) {
    const t = zoneTint(kind);
    if (t) {
      g.save();
      g.globalAlpha = painting ? (st.tool === kind ? 1 : 0.35) : 0.6;
      g.imageSmoothingEnabled = true;
      g.drawImage(t, ox, oy, st.w * k, st.h * k);
      g.restore();
    }
  }
  if (painting && st.draft && st.draft.pts.length) {
    // brush stroke being painted
    g.save();
    // brush preview: the area's colour, stronger
    const [r, gg, b] = cssRGBA(st.tool === "cross" ? "--zone-cross" : "--zone-lane");
    g.strokeStyle = st.draft.erase ? css("--zone-erase") : `rgba(${r}, ${gg}, ${b}, 0.45)`;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.lineWidth = 2 * st.draft.r * k;
    g.beginPath();
    st.draft.pts.forEach(([x, y], i) => {
      i ? g.lineTo(ox + x * k, oy + y * k) : g.moveTo(ox + x * k, oy + y * k);
    });
    if (st.draft.pts.length === 1) g.lineTo(ox + st.draft.pts[0][0] * k + 0.1, oy + st.draft.pts[0][1] * k);
    g.stroke();
    g.restore();
  }
}
// the line (and the size box, connectors, start and end marks); returns what the later layers need
function renderLine({ g, k, ox, oy, dpr, ink, accent }) {
  const T = (x, y) => [ox + x * k, oy + y * k];
  const animating = st.playing || (st.t > 0 && st.t < 1);
  if (!animating && $("dims").checked && st.mbox && st.bw) drawBox(g, T, dpr);
  const tSeries = st.t * (st.open ? 0.5 : 1); // open paths use the outbound half of the cycle
  // on the 3D tab with a filled base, the first base layer as it prints (the fill is only in the layers)
  const L3 = st.layers,
    baseView =
      !animating &&
      document.body.dataset.view === "choc" &&
      L3 &&
      L3.baseFinal &&
      L3.walk === st.walk &&
      infillPattern()
        ? L3.baseFinal
        : null;
  const curve = animating ? st.fit.curve : baseView || st.final;
  const S = curve.re.length;
  const upto = animating ? Math.floor(tSeries * S) : st.open ? S - 1 : S;
  // line width in screen px (needle width, or 80% of the spacing)
  const lv = $("lineView").value,
    widthPx = Math.max(1.15 * dpr, (lineWidthMM() / scale()) * k);
  const tracePath = () => {
    g.beginPath();
    for (let s = 0; s <= upto; s++) {
      const [x, y] = T(curve.re[s % S], curve.im[s % S]);
      s ? g.lineTo(x, y) : g.moveTo(x, y);
    }
  };
  g.lineJoin = "round";
  g.lineCap = "round";
  if (!animating && lv !== "thin") {
    // the chocolate line: faded band, or solid as printed
    g.save();
    g.strokeStyle = css("--choc");
    g.globalAlpha = lv === "band" ? 0.45 : 1;
    g.lineWidth = widthPx;
    tracePath();
    g.stroke();
    g.restore();
  }
  if (animating || lv !== "print") {
    g.strokeStyle = ink;
    g.lineWidth = 1.15 * dpr;
    tracePath();
    g.stroke();
  }
  if (!animating && !baseView && $("showConn").checked && st.jumpF) {
    // connectors in a second colour
    g.strokeStyle = css("--warn");
    g.lineWidth = 2 * dpr;
    g.beginPath();
    let pen = false;
    for (let s = 0; s <= upto; s++) {
      const on = st.jumpF[s % S] && st.jumpF[(s + 1) % S];
      if (on && s < upto) {
        const [x, y] = T(curve.re[s % S], curve.im[s % S]),
          [x2, y2] = T(curve.re[(s + 1) % S], curve.im[(s + 1) % S]);
        if (!pen) g.moveTo(x, y);
        g.lineTo(x2, y2);
        pen = true;
      } else pen = false;
    }
    g.stroke();
  }
  if (!animating) {
    // start ring (and end dot for open paths)
    const [x0, y0] = T(curve.re[0], curve.im[0]);
    g.strokeStyle = accent;
    g.lineWidth = 2 * dpr;
    g.beginPath();
    g.arc(x0, y0, 5.5 * dpr, 0, 7);
    g.stroke();
    if (st.open) {
      const [x1, y1] = T(curve.re[S - 1], curve.im[S - 1]);
      g.fillStyle = accent;
      g.beginPath();
      g.arc(x1, y1, 3.5 * dpr, 0, 7);
      g.fill();
    }
  }
  return { T, animating, tSeries, baseView };
}
// on the line: where it was pushed off the drawing, problem spots, the erase brush
function renderMarks({ g, k, dpr }, { T, animating, baseView }) {
  if (
    !animating &&
    !baseView &&
    $("showDrift").checked &&
    st.problems &&
    st.problems.drift &&
    st.problems.drift.length
  ) {
    // where the line was pushed off the drawing
    g.save();
    g.strokeStyle = css("--drift");
    g.lineWidth = Math.max(6 * dpr, ((2 * lineWidthMM()) / scale()) * k);
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    for (const sp of st.problems.drift)
      sp.forEach(([px, py], i) => {
        const [x, y] = T(px, py);
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      });
    g.stroke();
    g.restore();
  }
  if (!animating && $("showProb").checked && st.problems) {
    // problem spots
    g.strokeStyle = css("--warn");
    g.lineWidth = 1.6 * dpr;
    for (const [px, py] of st.problems.crossings) {
      const [x, y] = T(px, py);
      g.beginPath();
      g.arc(x, y, 6 * dpr, 0, 7);
      g.stroke();
    }
    g.setLineDash([2 * dpr, 2 * dpr]);
    for (const [px, py] of st.problems.tight) {
      const [x, y] = T(px, py);
      g.beginPath();
      g.arc(x, y, 8 * dpr, 0, 7);
      g.stroke();
    }
    g.setLineDash([]);
  }
  if (st.tool === "erase" && st.draft && st.draft.pts.length) {
    // brush preview
    g.save();
    g.strokeStyle = css("--warn");
    g.globalAlpha = 0.35;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.lineWidth = 2 * st.draft.r * k;
    g.beginPath();
    st.draft.pts.forEach(([x, y], i) => {
      const [a, b] = T(x, y);
      i ? g.lineTo(a, b) : g.moveTo(a, b);
    });
    if (st.draft.pts.length === 1) {
      const [a, b] = T(...st.draft.pts[0]);
      g.lineTo(a + 0.1, b);
    }
    g.stroke();
    g.restore();
  }
}
// while it plays: the two chains of turning circles drawing the line
function renderCircles({ g, k, dpr, accent }, { T, tSeries }) {
  const t = tSeries,
    E = st.epi;
  g.lineWidth = 1 * dpr;
  g.strokeStyle = accent;
  const chain = (list, [x, y], yAxis) => {
    // draw one chain from its anchor; returns its tip
    for (let i = 0; i < list.length; i++) {
      const [dx, dy] = chainStep(list[i], t, yAxis),
        r = list[i].amp;
      if (i < CHAIN_SHOWN && r * k > 0.6 * dpr) {
        const [cx, cy] = T(x, y),
          [px, py] = T(x + dx, y + dy);
        g.globalAlpha = 0.35;
        g.beginPath();
        g.arc(cx, cy, r * k, 0, 2 * Math.PI);
        g.stroke();
        g.globalAlpha = 0.8;
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(px, py);
        g.stroke();
      }
      x += dx;
      y += dy;
    }
    return [x, y];
  };
  const tx = chain(E.xs, E.xa, false),
    ty = chain(E.ys, E.ya, true),
    pen = [tx[0], ty[1]]; // x from the top chain, y from the side chain
  const [ax1, ay1] = T(...tx),
    [bx1, by1] = T(...ty),
    [px, py] = T(...pen);
  g.globalAlpha = 0.5;
  g.setLineDash([3 * dpr, 3 * dpr]);
  g.beginPath();
  g.moveTo(ax1, ay1);
  g.lineTo(px, py);
  g.moveTo(bx1, by1);
  g.lineTo(px, py);
  g.stroke();
  g.setLineDash([]);
  g.globalAlpha = 1;
  g.fillStyle = accent;
  for (const [qx, qy, r] of [
    [ax1, ay1, 2.5],
    [bx1, by1, 2.5],
    [px, py, 3.5],
  ]) {
    g.beginPath();
    g.arc(qx, qy, r * dpr, 0, 2 * Math.PI);
    g.fill();
  }
}

// smallest box at any angle around the printed line, with its side lengths and tilt
function drawBox(g, T, dpr) {
  const b = st.mbox,
    sc = scale(),
    u = "mm",
    dec = 1,
    c = b.corners.map(([x, y]) => T(x, y));
  g.save();
  g.strokeStyle = css("--accent");
  g.lineWidth = 1.25 * dpr;
  g.setLineDash([5 * dpr, 4 * dpr]);
  g.globalAlpha = 0.9;
  g.beginPath();
  c.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.stroke();
  g.setLineDash([]);
  g.font = `500 ${11 * dpr}px ${css("--font-mono")}`;
  g.textBaseline = "middle";
  g.textAlign = "center";
  const label = (t, p, q, out) => {
    // text along side p→q, pushed outward
    let ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
    if (ang > Math.PI / 2) ang -= Math.PI;
    if (ang < -Math.PI / 2) ang += Math.PI;
    const mx = (p[0] + q[0]) / 2 + out[0],
      my = (p[1] + q[1]) / 2 + out[1];
    g.save();
    g.translate(mx, my);
    g.rotate(ang);
    const wd = g.measureText(t).width + 8 * dpr;
    g.fillStyle = css("--surface");
    g.fillRect(-wd / 2, -8 * dpr, wd, 16 * dpr);
    g.fillStyle = css("--accent");
    g.fillText(t, 0, 0);
    g.restore();
  };
  const cx = c.reduce((a, p) => a + p[0], 0) / 4,
    cy = c.reduce((a, p) => a + p[1], 0) / 4;
  const outward = (p, q) => {
    const mx = (p[0] + q[0]) / 2 - cx,
      my = (p[1] + q[1]) / 2 - cy,
      l = Math.hypot(mx, my) || 1;
    return [(mx / l) * 11 * dpr, (my / l) * 11 * dpr];
  };
  // label the lower long-ish side with w and the right-hand side with h
  const sides = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
  ].map(([i, j]) => ({
    p: c[i],
    q: c[j],
    mid: [(c[i][0] + c[j][0]) / 2, (c[i][1] + c[j][1]) / 2],
    len: i % 2 ? b.h : b.w,
  }));
  const bottom = sides.filter((s2, k) => k % 2 === 0).sort((a, z) => z.mid[1] - a.mid[1])[0],
    right = sides.filter((s2, k) => k % 2 === 1).sort((a, z) => z.mid[0] - a.mid[0])[0];
  label(`${fmt(bottom.len * sc, dec)} ${u}`, bottom.p, bottom.q, outward(bottom.p, bottom.q));
  label(`${fmt(right.len * sc, dec)} ${u}`, right.p, right.q, outward(right.p, right.q));
  if (Math.abs(b.angle) >= 0.5) {
    const top = c.slice().sort((a, z) => a[1] - z[1])[0];
    g.fillStyle = css("--accent");
    g.textAlign = "left";
    g.fillText(`tilted ${fmt(Math.abs(b.angle), 0)}°`, top[0] + 6 * dpr, top[1] - 10 * dpr);
  }
  g.restore();
}

function drawChart() {
  const cv = $("errChart"),
    dpr = (fitCanvas(cv) || { dpr: 1 }).dpr;
  const g = cv.getContext("2d"),
    W = cv.width,
    H = cv.height,
    sc = st.bw ? scale() : 1,
    pts = (st.sweep || []).map((p) => ({ n: p.n, e: p.e * sc })); // error in mm
  g.clearRect(0, 0, W, H);
  if (pts.length < 2) return;
  const L = 34 * dpr,
    B = 18 * dpr,
    Tp = 8 * dpr,
    R = 8 * dpr;
  const lx = (n) => L + ((Math.log(n) - Math.log(4)) / (Math.log(st.Nmax) - Math.log(4))) * (W - L - R);
  const ymax = Math.min(Math.max(...pts.map((p) => p.e)), 30 * sc),
    ly = (e) => Tp + (1 - Math.min(e, ymax) / ymax) * (H - Tp - B);
  g.font = `${10.5 * dpr}px ${css("--font-mono")}`;
  g.fillStyle = css("--muted");
  g.strokeStyle = css("--grid");
  g.lineWidth = dpr;
  for (const v of niceTicks(ymax)) {
    const y = ly(v);
    g.beginPath();
    g.moveTo(L, y);
    g.lineTo(W - R, y);
    g.stroke();
    g.textAlign = "right";
    g.fillText(v === 0 ? "0" : v.toFixed(v < 0.1 ? 2 : v < 1 ? 1 : 0), L - 5 * dpr, y + 3.5 * dpr);
  }
  g.textAlign = "center";
  for (const n of [10, 100, 1000].filter((n) => n >= 4 && n <= st.Nmax)) g.fillText(String(n), lx(n), H - 4 * dpr);
  g.strokeStyle = css("--accent");
  g.lineWidth = 1.6 * dpr;
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(lx(p.n), ly(p.e)) : g.moveTo(lx(p.n), ly(p.e))));
  g.stroke();
  const x = lx(Math.max(4, st.N));
  g.strokeStyle = css("--ink");
  g.setLineDash([3 * dpr, 3 * dpr]);
  g.beginPath();
  g.moveTo(x, Tp);
  g.lineTo(x, H - B);
  g.stroke();
  g.setLineDash([]);
  if (st.err) {
    g.fillStyle = css("--ink");
    g.beginPath();
    g.arc(x, ly(st.err.score * sc), 3.5 * dpr, 0, 7);
    g.fill();
  }
}
function niceTicks(max) {
  const step = max > 12 ? 10 : max > 6 ? 4 : max > 3 ? 2 : max > 1.5 ? 1 : 0.5;
  const out = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(v);
  return out;
}
