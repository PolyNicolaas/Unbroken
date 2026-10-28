// Unbroken · web app · camera.js
// Take a picture: a live camera in the preview (full screen on a phone), with the page it finds outlined; the shutter
// keeps the frame, the page's corners can be dragged, and the photo is straightened and cleaned (engine 14-photo.js,
// in its own worker) into the picture to trace. The Photo card cleans it again with other settings. Without a live
// camera (no permission, an old browser, a page opened from disk) the device's own camera or photo picker is used.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

const PHO = makeEngine("photo"); // engine-bridge.js: its own worker, so a photo never waits behind a trace
const CAM_MAX = 2400; // the photo kept: its longest side, px (an iPad's 12 MP is far more than a trace uses)
const cam = {
  stream: null,
  facing: "environment",
  timer: null,
  still: null, // the photo taken (a canvas), while its corners are adjusted
  corners: null, // its page's corners, px
  live: null, // the outline shown over the live camera (px of the video frame), smoothed
  from: "camera", // camera | file | picture (Clean up as a photo): what Retake does
};
const camKind = () => (document.querySelector('input[name="camKind"]:checked') || {}).value || "drawing";

// ---------- opening and closing ----------
async function cameraOpen() {
  cameraStop();
  cam.from = "camera";
  const box = $("camera");
  box.hidden = false;
  box.dataset.mode = "live";
  document.body.dataset.camera = "1";
  $("camMsg").textContent = "Starting the camera…";
  const md = navigator.mediaDevices;
  if (!md || !md.getUserMedia) {
    cameraClose();
    toast("No live camera here: the device's camera or photos open instead");
    $("camFile").click();
    return;
  }
  try {
    cam.stream = await md.getUserMedia({
      video: { facingMode: { ideal: cam.facing }, width: { ideal: 1920 }, height: { ideal: 1440 } },
      audio: false,
    });
  } catch (e) {
    cameraClose();
    const why = e && e.name === "NotAllowedError" ? "The camera wasn't allowed" : "No camera could be opened";
    toast(`${why}: choose a photo instead`, true);
    $("camFile").click();
    return;
  }
  if ($("camera").hidden) return cameraStop(); // closed while it was starting
  const v = $("camVideo");
  v.srcObject = cam.stream;
  try {
    await v.play();
  } catch (e) {
    /* (autoplay: muted, so it plays) */
  }
  cam.live = null;
  $("camMsg").textContent = "Hold the camera over the page";
  cam.timer = setInterval(cameraLook, 280);
}
function cameraStop() {
  clearInterval(cam.timer);
  cam.timer = null;
  if (cam.stream) for (const t of cam.stream.getTracks()) t.stop();
  cam.stream = null;
  $("camVideo").srcObject = null;
}
function cameraClose() {
  cameraStop();
  $("camera").hidden = true;
  document.body.dataset.camera = "";
  cam.still = null;
}

// ---------- the live view: the page found, outlined ----------
// where a frame of fw × fh px sits in an element of the size given (object-fit: contain)
function fitIn(el, fw, fh) {
  const W = el.clientWidth,
    H = el.clientHeight,
    k = Math.min(W / fw, H / fh);
  return { k, x: (W - fw * k) / 2, y: (H - fh * k) / 2, W, H };
}
const looker = document.createElement("canvas");
function cameraLook() {
  const v = $("camVideo");
  if (!v.videoWidth || $("camera").dataset.mode !== "live") return;
  const k = Math.min(1, 320 / Math.max(v.videoWidth, v.videoHeight));
  looker.width = Math.round(v.videoWidth * k);
  looker.height = Math.round(v.videoHeight * k);
  const g = looker.getContext("2d", { willReadFrequently: true });
  g.drawImage(v, 0, 0, looker.width, looker.height);
  const f = UNB.findPage(g.getImageData(0, 0, looker.width, looker.height).data, looker.width, looker.height, {
    side: 120,
  });
  if (f && f.found) {
    const c = f.corners.map(([x, y]) => [x / k, y / k]);
    // smoothed, so the outline doesn't shiver
    cam.live = cam.live ? cam.live.map((p, i) => [p[0] * 0.5 + c[i][0] * 0.5, p[1] * 0.5 + c[i][1] * 0.5]) : c;
    $("camMsg").textContent = "Page found: hold still and take it";
  } else {
    cam.live = null;
    $("camMsg").textContent =
      camKind() === "object"
        ? "Take the picture when it's framed"
        : "No page found yet: a plain, darker background helps";
  }
  cameraDrawQuad(cam.live, v.videoWidth, v.videoHeight, false);
}
// the outline (and, editing, the corner handles) over the video or the photo
function cameraDrawQuad(q, fw, fh, handles) {
  const svg = $("camQuad"),
    F = fitIn(svg, fw, fh);
  svg.setAttribute("viewBox", `0 0 ${F.W} ${F.H}`);
  const pts = q ? q.map(([x, y]) => [F.x + x * F.k, F.y + y * F.k]) : [];
  $("camPoly").setAttribute("points", pts.map((p) => p.join(",")).join(" "));
  $("camPoly").dataset.on = q ? "1" : "";
  const g = $("camHandles");
  if (!handles) {
    g.replaceChildren();
    return;
  }
  if (g.children.length !== 4) {
    g.replaceChildren();
    ["top left", "top right", "bottom right", "bottom left"].forEach((name, i) => {
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("r", 18);
      c.setAttribute("class", "cam-handle");
      c.setAttribute("tabindex", "0");
      c.setAttribute("role", "slider");
      c.setAttribute("aria-label", `The page's ${name} corner (arrow keys move it)`);
      c.dataset.i = i;
      g.appendChild(c);
    });
  }
  pts.forEach(([x, y], i) => {
    g.children[i].setAttribute("cx", x);
    g.children[i].setAttribute("cy", y);
  });
}

// ---------- the photo taken: its corners ----------
function cameraTake() {
  const v = $("camVideo");
  if (!v.videoWidth) return;
  const k = Math.min(1, CAM_MAX / Math.max(v.videoWidth, v.videoHeight)),
    c = document.createElement("canvas");
  c.width = Math.round(v.videoWidth * k);
  c.height = Math.round(v.videoHeight * k);
  c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
  cameraStop();
  cameraEdit(c, "camera");
}
// a photo (taken, chosen, or the picture in use) with its corners to adjust: found when there's a page
function cameraEdit(canvas, from, corners) {
  cam.from = from;
  cam.still = canvas;
  const box = $("camera");
  box.hidden = false;
  box.dataset.mode = "edit";
  document.body.dataset.camera = "1";
  const whole = [
    [0, 0],
    [canvas.width, 0],
    [canvas.width, canvas.height],
    [0, canvas.height],
  ];
  let found = null;
  if (!corners && camKind() !== "object") {
    const d = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height);
    found = UNB.findPage(d.data, canvas.width, canvas.height);
  }
  cam.corners = corners || (found && found.found ? found.corners : whole);
  $("camMsg").textContent = corners
    ? "Drag the corners onto the page's corners"
    : found && found.found
      ? "Page found: drag a corner if it's off, then Use it"
      : camKind() === "object"
        ? "The whole photo is used"
        : "No page found: the whole photo is used (or drag the corners onto the page)";
  $("camRetake").textContent = from === "picture" ? "Cancel" : "Retake";
  box.dataset.from = from; // (adjusting a photo's corners: its kind is set on the Photo card)
  cameraDrawStill();
}
function cameraDrawStill() {
  const c = $("camStill"),
    s = cam.still,
    dpr = devicePixelRatio || 1;
  if (!s) return;
  c.width = Math.round(c.clientWidth * dpr);
  c.height = Math.round(c.clientHeight * dpr);
  const F = fitIn(c, s.width, s.height),
    g = c.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, F.W, F.H);
  g.drawImage(s, F.x, F.y, s.width * F.k, s.height * F.k);
  cameraDrawQuad(cam.corners, s.width, s.height, true);
}
// dragging a corner (finger, pen or mouse); arrow keys move a focused one
let camDrag = null;
$("camQuad").addEventListener("pointerdown", (e) => {
  const h = e.target.closest(".cam-handle");
  if (!h || !cam.still) return;
  e.preventDefault();
  camDrag = { i: +h.dataset.i, id: e.pointerId };
  $("camQuad").setPointerCapture(e.pointerId);
});
$("camQuad").addEventListener("pointermove", (e) => {
  if (!camDrag || e.pointerId !== camDrag.id) return;
  const r = $("camQuad").getBoundingClientRect(),
    F = fitIn($("camQuad"), cam.still.width, cam.still.height);
  const x = (e.clientX - r.left - F.x) / F.k,
    y = (e.clientY - r.top - F.y) / F.k;
  cam.corners[camDrag.i] = [Math.max(0, Math.min(cam.still.width, x)), Math.max(0, Math.min(cam.still.height, y))];
  cameraDrawQuad(cam.corners, cam.still.width, cam.still.height, true);
});
const camDrop = () => (camDrag = null);
$("camQuad").addEventListener("pointerup", camDrop);
$("camQuad").addEventListener("pointercancel", camDrop);
$("camQuad").addEventListener("keydown", (e) => {
  const h = e.target.closest(".cam-handle"),
    d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (!h || !d || !cam.still) return;
  e.preventDefault();
  const step = (e.shiftKey ? 20 : 4) * Math.max(1, cam.still.width / 800),
    p = cam.corners[+h.dataset.i];
  p[0] = Math.max(0, Math.min(cam.still.width, p[0] + d[0] * step));
  p[1] = Math.max(0, Math.min(cam.still.height, p[1] + d[1] * step));
  cameraDrawQuad(cam.corners, cam.still.width, cam.still.height, true);
});
addEventListener("resize", () => {
  if (!$("camera").hidden && $("camera").dataset.mode === "edit") cameraDrawStill();
});

// ---------- the photo → the picture ----------
const photoSettings = (kind) => {
  const K = UNB.PHOTO_KINDS[kind] || {};
  return { kind, light: K.light ?? 0, ink: K.ink ?? 0, specks: K.specks ?? 0 };
};
let photoSeq = 0,
  photoPending = null; // the Photo card's newest settings, while the picture they make is on its way
// clean photo (raw canvas + corners + settings) in the worker; the result becomes the picture in use
async function photoMake(photo, label) {
  const my = ++photoSeq,
    r = photo.raw,
    d = r.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, r.width, r.height);
  $("photoVal").textContent = "cleaning…";
  let out;
  try {
    out = await PHO.call("photoPicture", [
      d.data,
      r.width,
      r.height,
      { corners: photo.corners, kind: photo.kind, light: photo.light, ink: photo.ink, specks: photo.specks },
    ]);
  } catch (e) {
    if (e !== CANCELLED) toast("The photo couldn't be cleaned up: " + ((e && e.message) || e), true);
    photoUI();
    return;
  }
  if (my !== photoSeq) return; // a newer setting is on its way
  photoPending = null;
  const c = document.createElement("canvas");
  c.width = out.w;
  c.height = out.h;
  c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(out.rgba), out.w, out.h), 0, 0);
  artUsePhoto(c, label || (st.art.picture && st.art.picture.label) || "photo", photo); // art.js
  recordSoon();
}
function cameraUse(whole) {
  const s = cam.still;
  if (!s) return;
  const kind = camKind(),
    prev = st.art.picture && st.art.picture.photo,
    again = cam.from === "picture" && prev && prev.raw === s, // its corners adjusted: its settings stay
    framed = cam.corners.every(
      (p, i) => Math.abs(p[0] - (i === 1 || i === 2 ? s.width : 0)) < 1 && Math.abs(p[1] - (i >= 2 ? s.height : 0)) < 1
    ),
    // (the whole frame: nothing to straighten)
    corners = !whole && !framed && (again || kind !== "object") ? cam.corners.map((p) => p.slice()) : null;
  const photo = again ? { ...prev, corners } : { ...photoSettings(kind), raw: s, corners };
  const t = new Date(),
    label = again ? st.art.picture.label : `photo ${t.getHours()}:${String(t.getMinutes()).padStart(2, "0")}`;
  cameraClose();
  $("viewArt").checked = true; // the Art step shows the picture made
  viewChanged();
  photoMake(photo, label);
}

// ---------- the Photo card ----------
function photoUI() {
  const p = st.art.picture,
    ph = p && p.photo && photoPending && photoPending.raw === p.photo.raw ? photoPending : p && p.photo;
  $("photoRows").hidden = !ph;
  $("photoOff").hidden = !!ph || !p;
  $("photoCard").hidden = !p;
  if (!ph) {
    $("photoVal").textContent = "";
    return;
  }
  $(`phK${ph.kind}`).checked = true;
  $("phLight").value = ph.light;
  $("phInk").value = ph.ink;
  $("phSpecks").value = ph.specks;
  $("phLightVal").textContent = ph.light ? `${ph.light}%` : "off";
  $("phInkVal").textContent = ph.ink ? `${ph.ink}%` : "off";
  $("phSpecksVal").textContent = ph.specks ? `under ${ph.specks} px` : "off";
  const clean = ph.kind !== "none";
  for (const id of ["phLight", "phInk", "phSpecks"]) $(id).disabled = !clean;
  $("phInk").disabled = !clean || ph.kind === "object";
  $("phSpecks").disabled = !clean || ph.kind === "object";
  $("photoVal").textContent =
    { drawing: "a drawing", print: "printed art", object: "an object", none: "as taken" }[ph.kind] +
    (ph.corners ? ", straightened" : "");
}
let photoTimer = null;
function photoEdited(change) {
  const p = st.art.picture;
  if (!p || !p.photo) return;
  const photo = { ...(photoPending && photoPending.raw === p.photo.raw ? photoPending : p.photo), ...change };
  photoPending = photo; // the card shows it at once; the cleaned picture follows
  photoUI();
  clearTimeout(photoTimer);
  photoTimer = setTimeout(() => photoMake(photo), 150);
}
document.querySelectorAll('input[name="photoKind"]').forEach((r) =>
  r.addEventListener("change", () => {
    const kind = r.value,
      K = kind === "none" ? {} : photoSettings(kind);
    photoEdited({ kind, ...(kind === "none" ? {} : { light: K.light, ink: K.ink, specks: K.specks }) });
  })
);
for (const [id, key] of [
  ["phLight", "light"],
  ["phInk", "ink"],
  ["phSpecks", "specks"],
])
  $(id).addEventListener("input", () => photoEdited({ [key]: +$(id).value }));
$("phCorners").addEventListener("click", () => {
  const ph = st.art.picture && st.art.picture.photo;
  if (!ph) return;
  $(`camK${ph.kind === "none" ? "drawing" : ph.kind}`).checked = true;
  cameraEdit(
    ph.raw,
    "picture",
    ph.corners
      ? ph.corners.map((p) => p.slice())
      : [
          [0, 0],
          [ph.raw.width, 0],
          [ph.raw.width, ph.raw.height],
          [0, ph.raw.height],
        ]
  );
});
// a picture of yours (a file, a sample) cleaned up as a photo: its page found, then the same as a photo taken
$("picPhoto").addEventListener("click", () => {
  const p = st.art.picture;
  if (!p) return;
  const src = p.orig || p.canvas,
    k = Math.min(1, CAM_MAX / Math.max(src.width, src.height)),
    c = document.createElement("canvas");
  c.width = Math.round(src.width * k);
  c.height = Math.round(src.height * k);
  c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
  $("camKdrawing").checked = true;
  cameraEdit(c, "file");
});

// ---------- the buttons ----------
for (const id of ["picCamera", "esCamera", "phRetake"]) $(id).addEventListener("click", cameraOpen);
$("camTake").addEventListener("click", cameraTake);
$("camCancel").addEventListener("click", cameraClose);
$("camFlip").addEventListener("click", () => {
  cam.facing = cam.facing === "environment" ? "user" : "environment";
  cameraOpen();
});
$("camRetake").addEventListener("click", () => {
  if (cam.from === "camera") cameraOpen();
  else if (cam.from === "file") {
    cameraClose();
    $("camFile").click();
  } else cameraClose();
});
$("camWhole").addEventListener("click", () => cameraUse(true));
$("camUse").addEventListener("click", () => cameraUse(false));
document.querySelectorAll('input[name="camKind"]').forEach((r) =>
  r.addEventListener("change", () => {
    // an object has no page: the whole photo; back to a drawing or print, the page is looked for again
    if ($("camera").dataset.mode !== "edit" || !cam.still || cam.from === "picture") return;
    cameraEdit(cam.still, cam.from);
  })
);
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("camera").hidden) cameraClose();
});
// the device's own camera or photo picker (no live camera): the photo it gives, with its corners to adjust
$("camFile").addEventListener("change", () => {
  const f = $("camFile").files[0];
  $("camFile").value = "";
  if (!f) return;
  const url = URL.createObjectURL(f),
    img = new Image();
  img.onload = () => {
    const k = Math.min(1, CAM_MAX / Math.max(img.naturalWidth, img.naturalHeight)),
      c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    cameraEdit(c, "file");
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    toast("That photo couldn't be read", true);
  };
  img.src = url;
});
