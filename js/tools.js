// Unbroken · web app · tools.js
// Hand tools on the preview (select area, erase, set start, draw, crossing areas, connector paths), auto threshold, and
// drag-and-drop / paste.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// ---------- tools: select area, erase, set start, draw ----------
const BARS = {
  select: "selbar",
  erase: "erasebar",
  start: "startbar",
  draw: "drawbar",
  cross: "paintbar",
  lane: "paintbar",
};
const BTNS = {
  select: "selectBtn",
  erase: "eraseBtn",
  start: "startBtn",
  draw: "drawBtn",
  cross: "crossBtn",
  lane: "laneBtn",
};
const DRAW_W = 1000,
  DRAW_H = 750;
st.strokes = [];
function updateToolLabels() {
  $("selectBtn").textContent = st.tool === "select" ? "Cancel" : st.sel ? "Edit selection" : "Select area";
  $("eraseBtn").textContent = st.erase && st.erase.length ? `Erase (${st.erase.length})` : "Erase";
  $("startBtn").textContent = st.start ? "Start set" : "Set start";
  $("crossBtn").textContent = st.zones.cross.length
    ? `Crossing areas (${st.zones.cross.filter((z) => !z.erase).length})`
    : "Crossing areas";
  $("laneBtn").textContent = st.zones.lane.length
    ? `Connector paths (${st.zones.lane.filter((z) => !z.erase).length})`
    : "Connector paths";
  if (st.tool === "cross" || st.tool === "lane") {
    $("zoneSwatch").className = "swatch zone" + (st.tool === "lane" ? " lane" : "");
    $("paintHint").textContent =
      st.tool === "cross"
        ? "Paint where the line may cross itself. Crossings here are kept and strands aren't pushed apart."
        : "Paint where connectors should run, e.g. along the outline or the border. Connectors are routed through these paths.";
  }
}
function zonesChanged(kind) {
  st.zoneVer++;
  st.zm = {};
  updateToolLabels();
  if (kind === "lane")
    schedule(extract); // lanes change the walk itself
  else schedule(fit); // crossing areas: lay out the line again (and the size marks)
}
$("zoneUndo").addEventListener("click", () => {
  const k = st.tool;
  if (st.zones[k] && st.zones[k].length) {
    st.zones[k].pop();
    zonesChanged(k);
  }
});
$("zoneClear").addEventListener("click", () => {
  const k = st.tool;
  if (st.zones[k] && st.zones[k].length) {
    st.zones[k] = [];
    zonesChanged(k);
  }
});
$("zoneDone").addEventListener("click", () => exitTool());
function enterTool(t) {
  if ((!st.source && t !== "draw") || isModel()) return; // nothing to work on, or a 3D model is the source
  if (st.tool) exitTool();
  st.tool = t;
  stopPlay();
  st.draft = null;
  $(BARS[t]).hidden = false;
  $("box").classList.add("tool-mode");
  $(BTNS[t]).classList.add("on");
  $(BTNS[t]).setAttribute("aria-pressed", "true");
  if (t === "select") {
    st.pendingSel = st.sel;
    updateSelHint();
  }
  updateToolLabels();
  render();
}
function exitTool() {
  if (!st.tool) return;
  $(BARS[st.tool]).hidden = true;
  $(BTNS[st.tool]).classList.remove("on");
  $(BTNS[st.tool]).setAttribute("aria-pressed", "false");
  st.tool = null;
  st.draft = null;
  $("box").classList.remove("tool-mode");
  updateToolLabels();
  render();
}
Object.entries(BTNS).forEach(([t, id]) =>
  $(id).addEventListener("click", () => (st.tool === t ? exitTool() : enterTool(t)))
);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && st.tool) exitTool();
});

// shared fitted view of a W×H surface (full source image, or the drawing pad)
function surfView(W, H) {
  const cv = $("view"),
    { r, dpr } = fitCanvas(cv, true) || { r: cv.getBoundingClientRect(), dpr: window.devicePixelRatio || 1 };
  const pad = 14 * dpr,
    k = Math.min((cv.width - 2 * pad) / W, (cv.height - 2 * pad) / H);
  return { cv, g: cv.getContext("2d"), k, ox: (cv.width - W * k) / 2, oy: (cv.height - H * k) / 2, dpr, W, H, rect: r };
}
const selView = () => surfView(st.source.width, st.source.height);
const surfUV = (e, v) => {
  const x = (e.clientX - v.rect.left) * v.dpr,
    y = (e.clientY - v.rect.top) * v.dpr;
  return [Math.min(1, Math.max(0, (x - v.ox) / (v.W * v.k))), Math.min(1, Math.max(0, (y - v.oy) / (v.H * v.k)))];
};
const workXY = (e) => {
  const v = view();
  return [((e.clientX - v.rect.left) * v.dpr - v.ox) / v.k, ((e.clientY - v.rect.top) * v.dpr - v.oy) / v.k];
};

// --- select area
const draftPoly = () => {
  const d = st.draft;
  if (!d) return st.pendingSel;
  if (d.type === "rect") {
    const [a, b] = [d.a, d.b];
    return [
      [a[0], a[1]],
      [b[0], a[1]],
      [b[0], b[1]],
      [a[0], b[1]],
    ];
  }
  return d.pts;
};
function renderSelect() {
  const { cv, g, k, ox, oy, dpr, W, H } = selView();
  g.clearRect(0, 0, cv.width, cv.height);
  g.imageSmoothingEnabled = true;
  g.drawImage(st.source, ox, oy, W * k, H * k);
  const poly = draftPoly();
  if (poly && poly.length > 2) {
    g.save();
    g.fillStyle = css("--paper");
    g.globalAlpha = 0.72;
    g.beginPath();
    g.rect(ox, oy, W * k, H * k);
    poly.forEach(([u, v], i) => {
      const x = ox + u * W * k,
        y = oy + v * H * k;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    });
    g.closePath();
    g.fill("evenodd");
    g.restore();
    g.strokeStyle = css("--accent");
    g.lineWidth = 2 * dpr;
    g.setLineDash([6 * dpr, 4 * dpr]);
    g.beginPath();
    poly.forEach(([u, v], i) => {
      const x = ox + u * W * k,
        y = oy + v * H * k;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    });
    g.closePath();
    g.stroke();
    g.setLineDash([]);
  }
}
function updateSelHint() {
  const lasso = $("selLasso").checked;
  $("selHint").textContent = st.pendingSel
    ? "Drag again to redo it, or trace this selection."
    : lasso
      ? "Draw around the part of the image you want traced."
      : "Drag a box over the part of the image you want traced.";
}
function applySel(poly) {
  st.sel = poly;
  st.autoPending = true;
  st.sizeUser = false;
  exitTool(); // a new selection is a new drawing: back to the starting size
  $("srcinfo").textContent = (st.srcLabel || "") + (poly ? " · selection" : "");
  schedule(extract);
}
$("selDone").addEventListener("click", () => applySel(st.pendingSel || null));
$("selClear").addEventListener("click", () => applySel(null));
document.querySelectorAll('input[name="selShape"]').forEach((r) => r.addEventListener("change", updateSelHint));

// --- erase
const brushMode = () => $("erBrush").checked;
document.querySelectorAll('input[name="eraseMode"]').forEach((r) =>
  r.addEventListener("change", () => {
    $("brushField").hidden = !brushMode();
    $("eraseHint").textContent = brushMode()
      ? "Drag over the lines you want to wipe out."
      : "Tap a stray piece of line to remove it.";
  })
);
function eraseChanged() {
  updateToolLabels();
  schedule(extract);
}
$("eraseUndo").addEventListener("click", () => {
  if (st.erase.length) {
    st.erase.pop();
    eraseChanged();
  }
});
$("eraseClear").addEventListener("click", () => {
  if (st.erase.length) {
    st.erase = [];
    eraseChanged();
  }
});
$("eraseDone").addEventListener("click", exitTool);

// --- set start
$("startAuto").addEventListener("click", () => {
  st.start = null;
  updateToolLabels();
  schedule(extract);
});
$("startDone").addEventListener("click", exitTool);

// --- draw your own
function renderDraw() {
  const { cv, g, k, ox, oy, dpr } = surfView(DRAW_W, DRAW_H);
  g.clearRect(0, 0, cv.width, cv.height);
  g.fillStyle = css("--pad-paper");
  g.fillRect(ox, oy, DRAW_W * k, DRAW_H * k);
  g.strokeStyle = css("--rule");
  g.lineWidth = dpr;
  g.strokeRect(ox, oy, DRAW_W * k, DRAW_H * k);
  const all = st.draft && st.tool === "draw" ? st.strokes.concat([st.draft]) : st.strokes;
  g.strokeStyle = css("--pad-ink");
  g.lineCap = "round";
  g.lineJoin = "round";
  for (const sk of all) {
    g.lineWidth = sk.w * k;
    g.beginPath();
    sk.pts.forEach(([u, v], i) => {
      const x = ox + u * DRAW_W * k,
        y = oy + v * DRAW_H * k;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    });
    if (sk.pts.length === 1) g.lineTo(ox + sk.pts[0][0] * DRAW_W * k + 0.1, oy + sk.pts[0][1] * DRAW_H * k);
    g.stroke();
  }
  if (!all.length) {
    g.fillStyle = css("--pad-hint");
    g.font = `${15 * dpr}px ${css("--font-body")}`;
    g.textAlign = "center";
    g.fillText("Draw here", cv.width / 2, cv.height / 2);
  }
}
$("drawUndo").addEventListener("click", () => {
  st.strokes.pop();
  renderDraw();
});
$("drawClear").addEventListener("click", () => {
  st.strokes = [];
  renderDraw();
});
$("drawDone").addEventListener("click", () => {
  if (!st.strokes.length) {
    exitTool();
    return;
  }
  const c = document.createElement("canvas");
  c.width = DRAW_W;
  c.height = DRAW_H;
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, DRAW_W, DRAW_H);
  g.strokeStyle = "#000";
  g.lineCap = "round";
  g.lineJoin = "round";
  for (const sk of st.strokes) {
    g.lineWidth = sk.w;
    g.beginPath();
    sk.pts.forEach(([u, v], i) => (i ? g.lineTo(u * DRAW_W, v * DRAW_H) : g.moveTo(u * DRAW_W, v * DRAW_H)));
    if (sk.pts.length === 1) g.lineTo(sk.pts[0][0] * DRAW_W + 0.1, sk.pts[0][1] * DRAW_H);
    g.stroke();
  }
  $("modeCenter").checked = true;
  labels();
  $("sample").value = "user";
  setSource(c, "your drawing");
});

// --- pointer handling for all tools (a 3D model's orbit has its own handlers in model.js; the two never act at
// once, as the tools are off while a model is the source: see enterTool)
const view$ = $("view");
view$.addEventListener("pointerdown", (e) => {
  if (!st.tool) return;
  e.preventDefault();
  view$.setPointerCapture(e.pointerId);
  if (st.tool === "select") {
    const p = surfUV(e, selView());
    st.draft = $("selLasso").checked
      ? { type: "lasso", pts: [p], last: [e.clientX, e.clientY] }
      : { type: "rect", a: p, b: p };
    renderSelect();
  } else if (st.tool === "draw") {
    st.draft = { w: +$("pen").value, pts: [surfUV(e, surfView(DRAW_W, DRAW_H))], last: [e.clientX, e.clientY] };
    renderDraw();
  } else if (st.tool === "erase") {
    st.draft = { pts: [workXY(e)], r: +$("brush").value, down: [e.clientX, e.clientY], moved: false };
    render();
  } else if (st.tool === "start") st.draft = { p: workXY(e) };
  else if (st.tool === "cross" || st.tool === "lane") {
    st.draft = { pts: [workXY(e)], r: +$("zoneBrush").value, erase: $("zoneErase").checked };
    render();
  }
});
view$.addEventListener("pointermove", (e) => {
  const d = st.draft;
  if (!st.tool || !d) return;
  if (st.tool === "select") {
    if (d.type === "rect") d.b = surfUV(e, selView());
    else if (Math.hypot(e.clientX - d.last[0], e.clientY - d.last[1]) > 3) {
      d.pts.push(surfUV(e, selView()));
      d.last = [e.clientX, e.clientY];
    }
    renderSelect();
  } else if (st.tool === "draw") {
    if (Math.hypot(e.clientX - d.last[0], e.clientY - d.last[1]) > 2) {
      d.pts.push(surfUV(e, surfView(DRAW_W, DRAW_H)));
      d.last = [e.clientX, e.clientY];
      renderDraw();
    }
  } else if (st.tool === "cross" || st.tool === "lane") {
    d.pts.push(workXY(e));
    render();
  } else if (st.tool === "erase" && brushMode()) {
    if (Math.hypot(e.clientX - d.down[0], e.clientY - d.down[1]) > 3) d.moved = true;
    d.pts.push(workXY(e));
    render();
  }
});
const endPointer = () => {
  const d = st.draft;
  if (!st.tool || !d) return;
  st.draft = null;
  if (st.tool === "select") {
    st.draft = d;
    const poly = draftPoly();
    st.draft = null;
    let area = 0;
    for (let i = 0; i < poly.length; i++) {
      const [a, b] = poly[i],
        [c2, d2] = poly[(i + 1) % poly.length];
      area += a * d2 - c2 * b;
    }
    st.pendingSel = Math.abs(area) / 2 > 0.0004 ? poly : st.pendingSel; // ignore stray taps
    updateSelHint();
    renderSelect();
  } else if (st.tool === "draw") {
    st.strokes.push(d);
    renderDraw();
  } else if (st.tool === "erase") {
    if (brushMode()) st.erase.push({ type: "brush", r: d.r / st.crop.kx, pts: d.pts.map(([x, y]) => fromWork(x, y)) });
    else st.erase.push({ type: "part", p: fromWork(...d.pts[0]) });
    eraseChanged();
  } else if (st.tool === "start") {
    st.start = fromWork(...d.p);
    updateToolLabels();
    schedule(extract);
  } else if (st.tool === "cross" || st.tool === "lane") {
    st.zones[st.tool].push({ r: d.r / st.crop.kx, pts: d.pts.map(([x, y]) => fromWork(x, y)), erase: d.erase });
    zonesChanged(st.tool);
  }
};
view$.addEventListener("pointerup", endPointer);
view$.addEventListener("pointercancel", endPointer);

// ---------- auto threshold ----------
$("autoSens").addEventListener("click", () => {
  if (!st.source) return;
  busyFor("threshold", true);
  setChip("Trying thresholds (this can take a few seconds on a big image)");
  setTimeout(async () => {
    let ok;
    try {
      // 11 full line maps: slow on a big image
      const s = settings(),
        W = await working(undefined, OPT),
        grad = UNB.gradient(W.blurred, W.w, W.h),
        res = [];
      for (let sens = -50; sens <= 50; sens += 10)
        res.push({ sens, ...UNB.lineScore(detect(W, sens), grad, W.w, W.h, s.minLen) });
      const maxL = Math.max(...res.map((r) => r.L));
      ok = res
        .filter((r) => r.P > 0 && r.L >= 0.3 * maxL)
        .map((r) => ({ ...r, score: (r.align * r.L) / Math.pow(r.P, 0.7) }))
        .sort((a, b) => b.score - a.score);
    } catch (e) {
      if (e !== CANCELLED) {
        console.error(e);
        setChip("Auto threshold failed: " + ((e && e.message) || e));
      }
      return;
    } finally {
      busyFor("threshold", false);
    }
    if (!ok.length) {
      setChip("No threshold found clean lines here");
      return;
    }
    $("sens").value = ok[0].sens;
    labels();
    st.autoPending = true;
    launch(extract);
  }, 30);
});

// ---------- drop + paste ----------
let dragDepth = 0;
const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes("Files");
document.addEventListener("dragenter", (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth++;
  $("box").classList.add("dropping");
});
document.addEventListener("dragover", (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "copy";
});
document.addEventListener("dragleave", (e) => {
  if (!hasFiles(e)) return;
  if (--dragDepth <= 0) {
    dragDepth = 0;
    $("box").classList.remove("dropping");
  }
});
document.addEventListener("drop", (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0;
  $("box").classList.remove("dropping");
  $("dropZone").classList.remove("over");
  const files = [...e.dataTransfer.files];
  openAnyFile(
    files.find((f) => /\.(json|stl)$/i.test(f.name)) || files.find((f) => f.type.startsWith("image/")) || files[0]
  );
});
// One way in for every kind of file, dropped anywhere on the page or picked in the Input card's drop area:
// a saved design (.json), a 3D model (.stl) or an image
function openAnyFile(f) {
  if (!f) return;
  if (/\.json$/i.test(f.name) || f.type === "application/json")
    openDesign(f); // history.js
  else if (/\.stl$/i.test(f.name) || /stl|sla/.test(f.type))
    loadModelFile(f); // model.js
  else if (!f.type || f.type.startsWith("image/"))
    loadFile(f); // controls.js
  else
    toast(
      `${f.name} isn't a file the tracer opens: use an image (PNG, JPG, SVG), an STL model or a saved design`,
      true
    );
}
(() => {
  const z = $("dropZone");
  z.addEventListener("click", () => $("anyFile").click());
  z.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      $("anyFile").click();
    }
  });
  z.addEventListener("dragover", () => z.classList.add("over"));
  z.addEventListener("dragleave", () => z.classList.remove("over"));
  $("anyFile").addEventListener("change", () => {
    openAnyFile($("anyFile").files[0]);
    $("anyFile").value = "";
  });
})();
document.addEventListener("paste", (e) => {
  const item = [...(e.clipboardData ? e.clipboardData.items : [])].find((i) => i.type.startsWith("image/"));
  if (item) {
    e.preventDefault();
    loadFile(item.getAsFile(), "pasted image");
  }
});
