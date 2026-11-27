// Unbroken · web app · relief.js
// A relief: a picture, a text or a pattern standing out from a wall printed upright, layer by layer (the vase's
// texture "relief"; the engine's 19-relief.js). Make a relief (the Input card's Make it 3D) turns the source into a
// grey image and a flat plaque the first time; made again, from the same source or another, it keeps the relief's
// shape and settings and only takes the new source. The Texture tool then has the relief's own rows: how the greys
// become height (Smooth, Steps or Shapes, each with one slider), a text's or pattern's line width, the inset (the face
// as it will print: tap a part to press it in, again to leave it flat, again to raise it back; what the printer can't
// make in orange), Swap out and in, which way it goes from the wall, and where it sits (front, back, a face, round).
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

VASE_RADIO.tex.relief = "vtRelief"; // (vase.js: the texture's radio buttons)
const reliefIs = (V) => !!(V && UNB.reliefOn(V));
// the rail's design tool says Relief for one (map.js: "artKind"; it said Vase)
on("artKind", () => (st.art.kind === "model" && st.model && reliefIs(st.model.vase) ? { kind: "vase", cap: "Relief" } : null));

// ---------- what the printer can do ----------
// The lean: each layer may stand out (or step back) over the one below no more than the overhang a bead holds
// (export.js overhangMM), less a tenth to spare, at the layer height in use (mm out per mm up). The softening along
// each layer: just enough that the line never turns tighter than about two thirds of the bead, which takes more the
// deeper the relief (with the 0.84 mm needle: 0.65 mm at 1 mm deep, 0.86 at 2, 1.03 at 3; the engine's turn check,
// vaseTightest, measured 1.1, 0.68 and 0.55 mm turns against the 0.42 mm half bead it asks for). It was 1.3 mm
// whatever the depth until 26 November 2026, which flattened strokes narrower than about 2.7 mm.
const reliefSlope = () => +((0.9 * overhangMM()) / layerHmm()).toFixed(3);
const reliefSoft = (depth) => +(lineWidthMM() * (0.6 * Math.sqrt(Math.max(0.2, depth)) + 0.18)).toFixed(2);
on("vaseSending", (V) => {
  if (V.texture.kind !== "relief") return;
  V.texture.slope = reliefSlope();
  V.texture.soft = reliefSoft(V.texture.depth || 1);
});
// the overhang or the layer height changed (Material, Layers): a relief's lean follows
for (const id of ["gOver", "layerH"])
  $(id).addEventListener("change", () => {
    if (!(st.model && st.model.vase && reliefIs(st.model.vase))) return;
    vaseCur = structuredClone(st.model.vase);
    if (Math.abs((vaseCur.texture.slope || 0) - reliefSlope()) > 1e-3) vaseSend(true);
  });

// ---------- the face ----------
// the width the source is fitted to (mm per mm of reach): a plaque's flat face; a polygon's face, its corners
// rounded; a round wall's share of the way round
const reliefFacePerR = (V) =>
  V.plan.kind === "plaque"
    ? 2 * (1 - (+V.plan.thick || 0.1) / 2)
    : V.plan.kind === "polygon"
      ? 2 * Math.sin(Math.PI / Math.max(3, Math.round(+V.plan.sides || 6))) * (1 - 0.4 * (+V.plan.round || 0))
      : 2 * Math.PI * (V.texture.span || 0.5);
const reliefFaceMM = (V) => UNB.vaseRadius(V.profile, 0.5) * reliefFacePerR(V);
// a relief whose shape changes keeps its face as wide (the profile scaled to fit; a plaque keeps its front to back)
on("vaseReshape", (V) => {
  if (!reliefIs(V)) return null;
  const face = reliefFaceMM(V),
    thickMM = V.plan.kind === "plaque" ? vaseThickMM(V) : 10;
  return () => {
    if (!(face > 0)) return;
    const was = UNB.vaseRadius(vaseCur.profile, 0.5),
      now = vaseCur.plan.kind === "plaque" ? (face + Math.max(10, thickMM)) / 2 : face / reliefFacePerR(vaseCur),
      f = now / was;
    if (Math.abs(f - 1) < 1e-3) return;
    vaseCur.profile = vaseCur.profile.map(([t, r]) => [t, +(r * f).toFixed(2)]);
    if (vaseCur.plan.kind === "plaque")
      vaseCur.plan.thick = +(Math.max(10, thickMM) / UNB.vaseRadius(vaseCur.profile, 0.5)).toFixed(4);
  };
});

// ---------- Make a relief ----------
const RELIEF_FROM = ["picture", "text", "pattern"];
const reliefFromNow = () =>
  st.art && RELIEF_FROM.includes(st.art.kind) && !!st.source && !(st.art.kind === "picture" && !st.art.picture);
// The source as a grey image (dark = ink), cropped to its dark parts with a little room round them. A picture is
// averaged down to at most 320 px on its long side; a text's or a pattern's strokes are kept (the darkest of the
// pixels each one covers) at up to 480 px, so thin strokes survive and are thickened to the line width later.
// Text: drawn again from its layout (the letters as typed, without the joins along the baseline that help a trace).
function reliefTextCanvas() {
  const L = st.text && st.text.layout;
  if (!L || !L.strokes || !L.strokes.length) return null;
  const skip = new Set(L.joinIdx || []),
    m = 1.5, // mm round it
    ppm = 480 / (Math.max(L.width, L.height) + 2 * m),
    c = document.createElement("canvas");
  c.width = Math.max(8, Math.ceil((L.width + 2 * m) * ppm));
  c.height = Math.max(8, Math.ceil((L.height + 2 * m) * ppm));
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = "#000";
  g.lineWidth = Math.max(1.5, 0.6 * ppm);
  g.lineCap = g.lineJoin = "round";
  g.beginPath();
  L.strokes.forEach((S, k) => {
    if (skip.has(k)) return;
    for (let i = 0; i < S.length; i += 2) g[i ? "lineTo" : "moveTo"]((S[i] + m) * ppm, (S[i + 1] + m) * ppm);
    if (S.length === 2) g.lineTo((S[0] + m) * ppm + 0.1, (S[1] + m) * ppm);
  });
  g.stroke();
  const d = g.getImageData(0, 0, c.width, c.height).data,
    gray = new Float32Array(c.width * c.height);
  for (let i = 0; i < gray.length; i++) gray[i] = d[4 * i];
  return { w: c.width, h: c.height, gray };
}
// A picture with transparent parts (controls.js keepClear: st.source.__clear) as the working image is cropped and
// scaled: 1 where it's transparent (under 80% opaque: a soft edge blended with the paper would read as light), or null.
function reliefClearAt(W) {
  const src = st.source && st.source.__clear;
  if (!src || !W.crop) return null;
  const c = document.createElement("canvas");
  c.width = W.w;
  c.height = W.h;
  const g = c.getContext("2d"),
    { sx, sy, kx, ky } = W.crop;
  g.drawImage(src, sx, sy, W.w / kx, W.h / ky, 0, 0, W.w, W.h);
  const a = g.getImageData(0, 0, W.w, W.h).data,
    m = new Uint8Array(W.w * W.h),
    alpha = new Float32Array(W.w * W.h);
  let any = 0;
  for (let i = 0; i < m.length; i++) {
    alpha[i] = a[4 * i + 3] / 255;
    if (a[4 * i + 3] < 200) ((m[i] = 1), (any = 1));
  }
  if (any) m.alpha = alpha; // (reliefSource takes the paper back out of the soft edges)
  return any ? m : null;
}
async function reliefSource() {
  const kind = st.art.kind,
    strokes = kind !== "picture",
    W = (kind === "text" && reliefTextCanvas()) || (await working()), // pipeline.js: as Image prep makes it
    gw = W.w,
    gh = W.h,
    dark = strokes ? 128 : 200,
    // a transparent background: the art is what isn't transparent, light or dark
    clearW = strokes ? null : reliefClearAt(W),
    isArt = (i) => (clearW ? !clearW[i] : W.gray[i] < dark);
  let x0 = gw,
    y0 = gh,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++)
      if (isArt(y * gw + x)) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  if (x1 < 0) return null;
  const pad = Math.round(0.02 * Math.max(x1 - x0, y1 - y0)) + (strokes ? 4 : 0);
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(gw - 1, x1 + pad);
  y1 = Math.min(gh - 1, y1 + pad);
  const cw = x1 - x0 + 1,
    ch = y1 - y0 + 1,
    k = Math.min(1, (strokes ? 480 : 320) / Math.max(cw, ch)),
    w = Math.max(8, Math.round(cw * k)),
    h = Math.max(8, Math.round(ch * k)),
    data = new Array(w * h),
    clear = clearW ? new Uint8Array(w * h) : null;
  let hash = kind.length;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ax = x0 + Math.floor(x / k),
        bx = Math.max(ax, Math.min(x1, x0 + Math.floor((x + 1) / k) - 1)),
        ay = y0 + Math.floor(y / k),
        by = Math.max(ay, Math.min(y1, y0 + Math.floor((y + 1) / k) - 1));
      let s = 0,
        c = 0,
        m = 255,
        cl = 0;
      for (let yy = ay; yy <= by; yy++)
        for (let xx = ax; xx <= bx; xx++) {
          // (a soft edge of art on a transparent background was mixed with the white paper: the paper taken back out,
          // so a dark line's edge stays dark instead of reading light, and rising, when swapped)
          const q = yy * gw + xx,
            al = clearW && !clearW[q] ? clearW.alpha[q] : 1,
            g = al < 1 ? Math.max(0, Math.min(255, (W.gray[q] - 255 * (1 - al)) / al)) : W.gray[q];
          c++;
          if (clearW && clearW[q]) {
            cl++;
            continue; // (the transparent background isn't averaged in: a thin dark line beside it stays dark)
          }
          s += g;
          if (g < m) m = g;
        }
      const v = Math.round(Math.min(255, Math.max(0, strokes ? m : c > cl ? s / (c - cl) : 255)));
      data[y * w + x] = v;
      if (clear && 2 * cl > c) clear[y * w + x] = 1;
      hash = (hash * 31 + v + (clear ? 7 * clear[y * w + x] : 0)) % 2147483647;
    }
  // a picture that's nearly all black and white (a logo, a drawing) is flat art: Shapes suits it better than a slope;
  // counted over the whole picture (a transparent background counts as plain), since a thin logo's soft edges are
  // grey. Light art on a transparent background (white letters) starts swapped, so it's the art that stands out.
  let mid = 0,
    art = 0,
    light = 0;
  for (let i = 0; i < data.length; i++) {
    if (clear && clear[i]) continue;
    art++;
    if (data[i] > 50 && data[i] < 205) mid++;
    if (data[i] >= 128) light++;
  }
  // the transparent parts, as runs: [start, length, …] (a design keeps them small)
  const runs = [];
  if (clear)
    for (let i = 0; i < clear.length; i++)
      if (clear[i] && (i === 0 || !clear[i - 1])) {
        let j = i;
        while (j < clear.length && clear[j]) j++;
        runs.push(i, j - i);
      }
  return {
    w,
    h,
    data,
    kind,
    strokes,
    flat: !strokes && mid < 0.1 * data.length,
    ...(clear ? { clear: runs, light: light > 0.6 * art } : {}),
    id: `${kind}:${w}x${h}:${hash}`,
    from: $("designName").value.trim() || "",
  };
}
// how deep a source starts: 2 mm out, lettering 1 mm (its strokes across the wall can't climb further in their height)
const reliefDepth = (src) => (src.kind === "text" ? 1 : 2);
// the height style a source starts with: the engine's for its kind, Shapes for flat art
const reliefStart = (src) => Object.assign(UNB.reliefDefaults(src.kind), src.flat ? { style: "shapes" } : {});
// A text's or pattern's line width to start from, once it's on the wall (mm per source pixel sc): at most 2.4 mm,
// and no more than 60% of the narrow gaps between its strokes, so neighbouring strokes (the letters of a word, a
// pattern's lines a needle's spacing apart) don't run into one block. The narrow gaps: the middle line of the open
// space between strokes (where the distance from the ink peaks), its narrowest fifth.
function reliefLineW(src, sc) {
  const w = src.w,
    h = src.h,
    ink = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) ink[i] = src.data[i] < 128 ? 1 : 0;
  const d = UNB.edt(ink, w, h).dist,
    ridge = [];
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x,
        v = d[i];
      if (ink[i] || v < 1) continue;
      // a peak across one direction at least: between two strokes
      if ((v >= d[i - 1] && v >= d[i + 1]) || (v >= d[i - w] && v >= d[i + w])) ridge.push(v);
    }
  ridge.sort((a, b) => a - b);
  const gap = 2 * (ridge[Math.floor(0.2 * (ridge.length - 1))] || 0) * sc;
  return +Math.max(0.8, Math.min(2.4, 0.6 * gap + 0.6)).toFixed(1);
}
async function reliefMake() {
  if (!reliefFromNow()) {
    toast("Open a picture, type some text or pick a pattern first: a relief is made from one of those.", true);
    return;
  }
  const src = await reliefSource();
  if (!src) {
    toast("There's nothing dark to stand out.", true);
    return;
  }
  // the relief being worked on keeps its shape and settings; another kind of source starts its own height style
  const was = reliefIs(vaseCur) ? vaseCur : st.model && st.model.vase && reliefIs(st.model.vase) ? st.model.vase : null;
  let V;
  if (was) {
    V = structuredClone(was);
    const T = V.texture,
      same = T.source && T.source.kind === src.kind;
    if (!same || T.source.flat !== src.flat) {
      T.height = reliefStart(src);
      T.taps = [];
    }
    if (!same) T.depth = reliefDepth(src); // (lettering can't climb as far as a picture)
    T.source = src;
    if (src.clear) T.invert = src.light; // (light art on a transparent background: swapped, so the art stands out)
    // a plaque is as tall as its source needs (its width, front to back and everything else stay)
    if (V.plan.kind === "plaque")
      V.height = Math.round(Math.min(200, Math.max(10, (reliefFaceMM(V) * src.h) / src.w / 0.92)));
  } else {
    // a flat plaque, its face as wide as the drawing is now, tall enough for the source, 10 mm front to back (at
    // least 10: Nicolaas, 24 November 2026), the source on the front: 2 mm out (lettering 1 mm: its strokes across
    // the wall can't climb further in their height)
    const widthMM = Math.min(180, Math.max(30, st.outW > 0 ? st.outW : 80)),
      thick = 10,
      R = +((widthMM + thick) / 2).toFixed(1);
    V = UNB.vaseDefaults();
    V.profile = [
      [0, R],
      [0.5, R],
      [1, R],
    ];
    V.height = Math.round(Math.min(200, Math.max(10, (widthMM * src.h) / src.w / 0.92)));
    V.move = Object.assign(V.move, { kind: "none" });
    V.plan = { kind: "plaque", thick: +(thick / R).toFixed(4), sides: 6, depth: 0.3, round: 0.2 };
    V.texture = Object.assign(V.texture, {
      kind: "relief",
      depth: reliefDepth(src),
      sides: "front",
      span: 0.5,
      invert: !!(src.clear && src.light),
      dir: "out",
      height: reliefStart(src),
      taps: [],
      source: src,
    });
  }
  // a text's or pattern's strokes, new to this relief: a line width that keeps them apart
  if (src.strokes && !(was && was.texture.source && was.texture.source.kind === src.kind)) {
    const face = UNB.reliefFace(V, UNB.vaseRadius(V.profile, 0.5));
    V.texture.height.lineW = reliefLineW(src, UNB.reliefMap(V, face).sc);
  }
  vaseCur = V;
  vasePick = -1;
  artUse("model"); // art.js: the 3D model input
  $("mfVase").checked = true;
  ask("vaseSending", vaseCur);
  useVase(vaseCur, true);
  vaseUI();
  if (!$("viewArt").checked) $("viewArt").click();
  if (typeof mapOpen === "function") mapOpen("vtexture");
}
$("reliefMake").addEventListener("click", reliefMake);
const reliefRowUI = () => ($("reliefRow").hidden = !reliefFromNow());
on("artUI", reliefRowUI);
on("sourceChanged", reliefRowUI);
reliefRowUI();

// ---------- the controls ----------
const RL_STYLE = { smooth: "rlSmooth", steps: "rlSteps", shapes: "rlShapes" };
const rlHeight = (T) => Object.assign(UNB.reliefDefaults(T.source && T.source.kind), T.height || {});
on("vaseShown", (V) => {
  const T = V.texture;
  // Relief, among the textures: only for a vase made as a relief (Make a relief), to go back to it
  $("vtRelief").hidden = $("vtReliefLab").hidden = !(T.source && T.source.data);
  if (!T.source) return;
  const Hs = rlHeight(T);
  $(RL_STYLE[Hs.style] || "rlSmooth").checked = true;
  $("rlContrast").value = Hs.contrast;
  $("rlLevels").value = Hs.levels;
  $("rlBevel").value = Hs.bevel;
  $("rlLineW").value = Hs.lineW;
  $({ front: "vtSideFront", back: "vtSideBack", both: "vtSideBoth" }[T.sides || "front"]).checked = true;
  $("vtSpan").value = Math.round((T.span || 0.5) * 100);
  $("vtTurn").value = Math.round(+T.turn || 0);
  $({ out: "vtDirOut", in: "vtDirIn", both: "vtDirBoth" }[T.dir || "out"]).checked = true;
});
on("vaseLabelled", (V) => {
  const T = V.texture,
    P = V.plan,
    box = $("vaseBox");
  if (!reliefIs(V)) {
    delete box.dataset.rlstyle;
    delete box.dataset.rlstrokes;
    return;
  }
  const Hs = rlHeight(T),
    src = T.source,
    what = { picture: "picture", text: "text", pattern: "pattern" }[src.kind] || "picture";
  box.dataset.rlstyle = Hs.style;
  box.dataset.rlstrokes = src.strokes ? "1" : "0";
  $("mfVase").nextElementSibling.textContent = "A relief";
  if ($("mfVase").checked && st.model && st.model.vase) $("inputVal").textContent = st.model.name || "";
  $("vaseTexVal").textContent =
    `the ${what}, ${T.dir === "both" ? `${fmt(T.depth / 2, 1)} mm in and out` : `${fmt(T.depth, 1)} mm ${T.dir === "in" ? "in" : "out"}`}, ${
      P.kind === "polygon"
        ? T.faces === "every"
          ? "on every face"
          : `on face ${Math.round(+T.face || 1)}`
        : `on the ${{ front: "front", back: "back", both: "front and back" }[T.sides || "front"]}`
    }`;
  $("rlStyleVal").textContent = {
    smooth: "greys as a slope",
    steps: `${Hs.levels} flat levels`,
    shapes: Hs.bevel ? `shapes, edges rounded ${fmt(Hs.bevel, 1)} mm` : "shapes, straight up",
  }[Hs.style];
  $("rlContrastVal").textContent =
    Hs.contrast === 50 ? "as it is" : Hs.contrast < 50 ? `${Hs.contrast}: the darkest` : `${Hs.contrast}: the greys up`;
  $("rlLevelsVal").textContent = `${Hs.levels}`;
  $("rlBevelVal").textContent = Hs.bevel ? `${fmt(Hs.bevel, 1)} mm` : "straight up";
  $("rlLineWVal").textContent = `${fmt(Hs.lineW, 1)} mm`;
  $("rlSwap").setAttribute("aria-pressed", T.invert ? "true" : "false");
  $("rlSwap").classList.toggle("on", !!T.invert);
  $("vtDirVal").textContent = {
    out: "standing out",
    in: "pressed in",
    both: `mid-grey on the wall, ${fmt(T.depth / 2, 1)} mm each way`,
  }[T.dir || "out"];
  $("vtSidesVal").textContent = {
    front: "the front",
    back: "the back (it reads the right way from behind)",
    both: "both: front and back",
  }[T.sides || "front"];
  $("vtSpanVal").textContent = `${Math.round((T.span || 0.5) * 100)}% of the way round`;
  // a polygon's faces: one option a face, and every face
  const nf = Math.max(3, Math.min(24, Math.round(+P.sides || 6))),
    want = [...Array(nf)].map((_, i) => String(i + 1)).concat("every");
  if ([...$("vtFace").options].map((o) => o.value).join() !== want.join())
    $("vtFace").innerHTML = want
      .map(
        (v) =>
          `<option value="${v}">${v === "every" ? "Every face" : v === "1" ? "Face 1 (the front)" : `Face ${v}`}</option>`
      )
      .join("");
  $("vtFace").value = T.faces === "every" ? "every" : String(Math.min(nf, Math.max(1, Math.round(+T.face || 1))));
  $("vtTurnVal").textContent = T.turn ? `${Math.round(T.turn)}°` : "centred on the front";
  $("vtFaceVal").textContent =
    T.faces === "every"
      ? `every face (${P.sides})`
      : `face ${Math.round(+T.face || 1)} of ${P.sides}${(+T.face || 1) === 1 ? ", the front" : ""}`;
  rlDrawSoon();
});
// a change to the relief: labels, the inset, and the vase sent (an undo step at the end of a drag)
const rlChange = (set, record = true) => {
  set(vaseCur.texture);
  vaseLabels();
  vaseSend(record);
};
for (const [style, id] of Object.entries(RL_STYLE))
  $(id).addEventListener("change", () =>
    rlChange((T) => {
      T.height = Object.assign(rlHeight(T), { style });
      T.taps = []; // (the parts are another style's)
    })
  );
for (const [id, key] of [
  ["rlContrast", "contrast"],
  ["rlLevels", "levels"],
  ["rlBevel", "bevel"],
  ["rlLineW", "lineW"],
]) {
  $(id).addEventListener("input", () =>
    rlChange((T) => (T.height = Object.assign(rlHeight(T), { [key]: +$(id).value })), false)
  );
  $(id).addEventListener("change", () => vaseSend(true));
}
$("rlSwap").addEventListener("click", () => rlChange((T) => (T.invert = !T.invert)));
for (const [id, v] of [
  ["vtSideFront", "front"],
  ["vtSideBack", "back"],
  ["vtSideBoth", "both"],
])
  $(id).addEventListener("change", () => rlChange((T) => (T.sides = v)));
for (const [id, v] of [
  ["vtDirOut", "out"],
  ["vtDirIn", "in"],
  ["vtDirBoth", "both"],
])
  $(id).addEventListener("change", () => rlChange((T) => (T.dir = v)));
$("vtFace").addEventListener("change", () =>
  rlChange((T) => {
    const v = $("vtFace").value;
    T.faces = v === "every" ? "every" : "one";
    if (v !== "every") T.face = +v;
  })
);
for (const [id, set] of [
  ["vtSpan", (T, v) => (T.span = v / 100)],
  ["vtTurn", (T, v) => (T.turn = v)],
]) {
  $(id).addEventListener("input", () => rlChange((T) => set(T, +$(id).value), false));
  $(id).addEventListener("change", () => vaseSend(true));
}
$("vtRelief").addEventListener("change", () => rlChange((T) => (T.kind = "relief")));

// ---------- the inset ----------
// The relief's face as it will print (the engine's grid, after the softening and the lean), lit from the upper left
// so raised and pressed parts read, each part outlined faintly, a part left flat dashed, and in orange what the
// printer can't make: where the wall stands well short of what the source asks (a thin band across the wall, cut
// short by the lean) and the specks too small for the bead (smoothed into what's round them).
let rlView = null,
  rlRaf = 0;
const rlDrawSoon = () => {
  if (!rlRaf)
    rlRaf = requestAnimationFrame(() => {
      rlRaf = 0;
      rlDraw();
    });
};
function rlGrid(V) {
  return UNB.reliefGrid(V, UNB.reliefFace(V, UNB.vaseRadius(V.profile, 0.5)));
}
function rlDraw() {
  const cv = $("rlInset"),
    V = vaseCur;
  if (!cv.isConnected || !reliefIs(V) || !(V.texture.depth > 0)) return;
  const G = rlGrid(V),
    M = G.map,
    R = G.height,
    v = insetCanvas(cv, G.face, M.H, 300); // ui.js
  if (!v) return;
  rlView = { ...v, G };
  const { g, s, ox, oy } = v,
    // the grid as an image: lit from the upper left (the slope across and up), in the chocolate's colour
    im = new ImageData(G.cols, G.rows),
    choc = cssRGBA("--choc"),
    paper = cssRGBA("--surface"),
    dx = G.face / G.cols,
    D = Math.max(0.01, G.depth);
  for (let r = 0; r < G.rows; r++)
    for (let c = 0; c < G.cols; c++) {
      const i = r * G.cols + c,
        h = G.d[i],
        sx = (G.d[r * G.cols + Math.min(G.cols - 1, c + 1)] - G.d[r * G.cols + Math.max(0, c - 1)]) / (2 * dx),
        sy = (G.d[Math.min(G.rows - 1, r + 1) * G.cols + c] - G.d[Math.max(0, r - 1) * G.cols + c]) / (2 * G.dz),
        lit = Math.max(0.35, Math.min(1.35, 0.85 - 0.45 * sx + 0.45 * sy)),
        k = 0.45 + 0.55 * Math.max(-1, Math.min(1, h / D)), // raised: more chocolate, pressed: towards the paper
        o = 4 * ((G.rows - 1 - r) * G.cols + c);
      for (let q = 0; q < 3; q++) im.data[o + q] = Math.min(255, (paper[q] * (1 - k) + choc[q] * k) * lit);
      im.data[o + 3] = 255;
    }
  const off = (rlDraw.off ||= document.createElement("canvas"));
  off.width = G.cols;
  off.height = G.rows;
  off.getContext("2d").putImageData(im, 0, 0);
  g.imageSmoothingEnabled = true;
  g.drawImage(off, ox, oy, G.face * s, M.H * s);
  // a source point (shares of its width and height) on the inset
  const P = (u, w) => [ox + (M.x0 + u * M.iw) * s, oy + (M.H - (M.y0 + M.ih - w * M.ih)) * s];
  // each part's edge, faintly; a part left flat dashed; a part that can't reach its depth in orange (Smooth has no
  // parts to tap: its greys run into each other)
  const S = UNB.reliefShort(G),
    short = new Set(S.short),
    lab = R.lab,
    W = R.w,
    Hh = R.h,
    px = M.iw / W, // mm per source pixel
    kindOf = (a) => (a < 0 ? 0 : short.has(a) ? 3 : R.parts[a].to === "flat" ? 2 : 1);
  for (const [kind, colour, alpha, dash] of [
    [1, "--muted", 0.35, []],
    [2, "--accent", 0.9, [3, 3]],
    [3, "--warn", 1, []],
  ]) {
    if (R.style === "smooth" && kind !== 3) continue;
    g.strokeStyle = css(colour);
    g.globalAlpha = alpha;
    g.lineWidth = kind === 3 ? 1.5 : 1;
    g.setLineDash(dash);
    g.beginPath();
    for (let y = 0; y < Hh; y++)
      for (let x = 0; x < W; x++) {
        const a = lab[y * W + x],
          edge = (b) => a !== b && (kindOf(a) === kind || kindOf(b) === kind);
        if (x + 1 < W && edge(lab[y * W + x + 1])) {
          const [X, Y] = P((x + 1) / W, y / Hh);
          g.moveTo(X, Y);
          g.lineTo(X, Y + px * s);
        }
        if (y + 1 < Hh && edge(lab[(y + 1) * W + x])) {
          const [X, Y] = P(x / W, (y + 1) / Hh);
          g.moveTo(X, Y);
          g.lineTo(X + px * s, Y);
        }
      }
    g.stroke();
  }
  g.setLineDash([]);
  g.globalAlpha = 1;
  // the specks too small for the bead, circled (a few: many, along a photo's edges, would only be noise)
  g.strokeStyle = css("--warn");
  g.lineWidth = 1.5;
  for (const k of R.specks.length <= 20 ? R.specks : []) {
    const [X, Y] = P(k.x, k.y);
    g.beginPath();
    g.arc(X, Y, 4, 0, 2 * Math.PI);
    g.stroke();
  }
  rlInfo(V, R, S);
}
function rlInfo(V, R, S) {
  const T = V.texture,
    live = R.parts.filter((p) => p.level > 0 && p.n > 0),
    n = (to) => live.filter((p) => p.to === to).length,
    bits = [];
  if (R.style === "smooth") bits.push("Steps and Shapes split the source into parts you can tap");
  else {
    bits.push("Tap a part to press it in, again to leave it flat, again to raise it back");
    const now = [`${n("out")} part${n("out") === 1 ? "" : "s"} ${T.dir === "in" ? "in" : "out"}`];
    if (n("in")) now.push(`${n("in")} pressed in`);
    if (n("flat")) now.push(`${n("flat")} left flat`);
    bits.push(now.join(" · "));
  }
  const warn = [];
  if (S.short.length) {
    const far = T.dir === "both" ? T.depth / 2 : T.depth, // (Both: half each way)
      climb = far / Math.max(0.05, T.slope || 0.8),
      wide = 2.1 * (T.soft === undefined ? 1.3 : T.soft),
      what = R.style === "smooth" ? "Some thin dark areas" : `${S.short.length} part${S.short.length === 1 ? "" : "s"}`,
      fixes = ["a wider wall (Profile)", "a shallower depth"].concat(T.source.strokes ? ["a wider line"] : []);
    warn.push(
      `${what} can't reach ${fmt(far, 1)} mm (outlined in orange): a part needs to be about ${fmt(wide, 1)} mm wide, and a band across the wall ${fmt(climb, 1)} mm tall, to stand that far out; ${fixes.slice(0, -1).join(", ")} or ${fixes.at(-1)} helps`
    );
  }
  if (R.faint > 0.15)
    warn.push(`some faint or thin lines are left out (Shapes keeps what's darker than mid-grey; Steps keeps them)`);
  if (R.specks.length)
    warn.push(
      `${R.specks.length} speck${R.specks.length === 1 ? "" : "s"} smaller than the bead smoothed away${R.specks.length <= 20 ? " (circled)" : ""}`
    );
  const w = warn.join("; ");
  $("rlInfo").textContent = bits.join(". ") + "." + (w ? " " + w[0].toUpperCase() + w.slice(1) + "." : "");
  $("rlInfo").className = warn.length ? "hint warn" : "hint";
}
// a tap: the part under it goes out → in → flat → out
$("rlInset").addEventListener("click", (e) => {
  if (!rlView || !reliefIs(vaseCur)) return;
  const r = $("rlInset").getBoundingClientRect(),
    { s, ox, oy, G } = rlView,
    M = G.map,
    fx = (e.clientX - r.left - ox) / s, // mm across the face
    z = M.H - (e.clientY - r.top - oy) / s, // mm up
    u = (fx - M.x0) / M.iw,
    w = (M.y0 + M.ih - z) / M.ih,
    R = G.height;
  if (R.style === "smooth") return; // Smooth has no parts
  // the part under the finger, or the nearest within about a fingertip (12 px) of it
  let id = UNB.reliefPartAt(R, u, w);
  const reach = Math.ceil(12 / s / M.sc), // source px
    cx = Math.floor(u * R.w),
    cy = Math.floor(w * R.h);
  for (let d = 1; id < 0 && d <= reach; d++)
    for (let k = 0; k < 8 * d && id < 0; k++) {
      const a = (k / (8 * d)) * 2 * Math.PI,
        x = Math.round(cx + d * Math.cos(a)),
        y = Math.round(cy + d * Math.sin(a));
      if (x >= 0 && y >= 0 && x < R.w && y < R.h) id = R.lab[y * R.w + x];
    }
  if (id < 0) return; // the wall
  const T = vaseCur.texture,
    taps = (T.taps || []).filter((t) => UNB.reliefPartAt(R, t.u, t.v) !== id),
    next = { out: "in", in: "flat", flat: null }[R.parts[id].to];
  if (next) taps.push({ u: +u.toFixed(4), v: +w.toFixed(4), to: next });
  rlChange((T) => (T.taps = taps));
});
new ResizeObserver(rlDrawSoon).observe($("rlInset"));
// the Solid view's light on Auto: raking, low across the wall, for a relief in use
// (drawn when its panel opens, and when it's resized)
on("lightDefault", () => (isModel() && st.model && reliefIs(st.model.vase) ? "raking" : null));
