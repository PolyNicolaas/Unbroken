// Unbroken · web app · map.js
// The steps as a map (View ▸ Map of the steps; on by default): one thick line from the art to the output through
// every step the design passes, the settings hanging off it as small branches. Each node shows its result (taken from
// the cards' own readouts) and a dot when the ready list has something for it; tapping a node opens its cards beside
// the preview, and the step tabs and the Next bar go away. The map's shape follows the design: a 3D model or a vase
// goes straight from Art to Print, a pen plotter ends in Plot. The cards themselves are the same as with the step tabs:
// the map only chooses which ones show.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// ---------- the nodes ----------
// step: the step (input name="view") its cards are on; cards: the headings of its cards; cap: the small label;
// name(): its name now; val(): its result now (default: the first card's header readout)
const MAP_NODES = {
  machine: {
    cap: "Printer and chocolate",
    step: "choc",
    cards: ["h-choc"],
    name: () => "",
    val: () =>
      [selText("printer"), selText("chocolate"), selText("needle").split(" · ")[0]].filter(Boolean).join(" · "),
  },
  art: {
    cap: "Art",
    step: "art",
    cards: ["h-input", "h-pic", "h-text", "h-art", "h-mol", "h-model"],
    name: () =>
      ({
        picture: "Picture",
        text: "Text",
        pattern: "Pattern",
        molecule: "Molecule",
        model: st.model && st.model.vase ? "Vase" : "3D model",
      })[st.art.kind] || "Art",
    val: () => (st.art.kind === "model" ? (st.model && st.model.name) || "" : st.srcLabel || ""),
  },
  prep: { cap: "Picture prep", step: "art", cards: ["h-prep", "h-levels"] },
  // a vase made here: its parts are in the 3D model card, so each node opens the card at its part
  vprofile: {
    cap: "Profile",
    step: "art",
    cards: ["h-model"],
    at: "vaseProfile",
    val: () => mapText("vaseProfileVal") + (st.model && st.model.vase ? ` · ${fmt(st.model.vase.height, 0)} mm` : ""),
  },
  vtexture: { cap: "Surface texture", step: "art", cards: ["h-model"], at: "vtNone", val: () => mapText("vaseTexVal") },
  vmove: { cap: "Movement", step: "art", cards: ["h-model"], at: "vmNone", val: () => mapText("vaseMoveVal") },
  line: {
    cap: "Line",
    step: "design",
    cards: ["h-src", "h-trace", "h-line"],
    name: () =>
      lineModeNow() === "strokes" ? "Separate strokes" : lineModeNow() === "drawn" ? "As drawn" : "One continuous line",
    val: () => ($("chip").textContent.match(/\d+ terms · error [\d.]+ mm/) || [""])[0],
  },
  size: { cap: "Size", step: "design", cards: ["h-size"], val: () => sizeText() },
  fit: { cap: "Fit", step: "design", cards: ["h-fit"] },
  print: { cap: "Print", step: "choc", cards: ["h-gexport"], name: () => "G-code" },
  plate: { cap: "Plate", step: "choc", cards: ["h-plate"] },
  layers: { cap: "Layers", step: "choc", cards: ["h-layers", "h-base", "h-infill"] },
  tune: { cap: "Fine-tuning and tests", step: "choc", cards: ["h-machine", "h-test", "h-matrix", "h-profile"] },
  plot: { cap: "Plot", step: "plot", cards: ["h-plot"], name: () => "The page" },
  fills: { cap: "Fills", step: "plot", cards: ["h-fills"] },
  pexport: { cap: "Export", step: "plot", cards: ["h-pexport"], name: () => "SVG for Saxi" },
};
const MAP_STEP_RADIO = { art: "viewArt", design: "viewDesign", choc: "viewChoc", plot: "view2D" };
const mapText = (id) => ($(id) ? $(id).textContent.trim() : "");
const selText = (id) => {
  const s = $(id);
  return s && s.selectedIndex >= 0 ? s.options[s.selectedIndex].textContent.trim() : "";
};
const sizeText = () => {
  const w = +$("outW").value,
    h = +$("outH").value;
  return w > 0 && h > 0 ? `${fmt(w, 1)} × ${fmt(h, 1)} mm` : "";
};
// the card for a heading id, and a card's header readout (its text minus its title)
const mapCard = (hid) => $(hid) && $(hid).closest("section.card");
function mapCardVal(hid) {
  const c = mapCard(hid),
    b = c && c.querySelector(".card-toggle");
  if (!b) return "";
  const t = b.querySelector(".t");
  return b.textContent
    .slice(t ? t.textContent.length : 0)
    .replace(/ⓘ/g, "")
    .trim();
}

// ---------- the shape of the map for this design ----------
// spine: the steps the design goes through, left to right; up / down: branches hanging off a spine node
function mapShape() {
  const plot = artForPlot(),
    model = st.art.kind === "model",
    picture = st.art.kind === "picture",
    vase = model && st.model && st.model.vase;
  const spine = ["art"];
  if (!model) spine.push("line", "size");
  spine.push(plot ? "plot" : "print");
  const up = {},
    down = {};
  if (picture) down.art = ["prep"];
  if (vase) {
    up.art = ["vprofile"];
    down.art = ["vtexture", "vmove"];
  }
  if (!model) down.line = ["fit"];
  if (plot) {
    up.plot = ["pexport"];
    down.plot = ["fills"];
  } else {
    up.print = ["plate"];
    down.print = ["layers", "tune"];
  }
  return { spine, up, down, machine: !plot, other: plot ? "print" : "plot" };
}

// ---------- drawing it ----------
let mapOpenId = null,
  mapLast = "";
const MAP_W = 188; // a node's width (px)
function mapRender() {
  if (!mapOn()) return;
  const box = $("map"),
    W = box.clientWidth,
    H = box.clientHeight,
    S = mapShape(),
    nodes = $("mapNodes"),
    pos = {};
  if (!(W > 0 && H > 0)) return;
  const n = S.spine.length,
    left = 24,
    gapX = n > 1 ? (W - 2 * left - MAP_W) / (n - 1) : 0,
    midY = Math.round(H * 0.5);
  S.spine.forEach((id, i) => (pos[id] = { x: left + i * gapX, y: midY - 48, w: MAP_W, h: 96, big: true, i }));
  for (const [id, list] of Object.entries(S.up))
    list.forEach((b, k) => (pos[b] = { x: pos[id].x + 10, y: midY - 48 - 116 * (k + 1), w: MAP_W - 20, h: 64 }));
  for (const [id, list] of Object.entries(S.down))
    list.forEach((b, k) => (pos[b] = { x: pos[id].x + 10, y: midY + 48 + 52 + 92 * k, w: MAP_W - 20, h: 64 }));
  if (S.machine) pos.machine = { x: W - left - 260, y: 58, w: 260, h: 60 };
  // the nodes: made once each, moved and refreshed
  const want = new Set(Object.keys(pos));
  for (const el of [...nodes.children]) if (!want.has(el.dataset.node)) el.remove();
  for (const id of want) {
    let el = nodes.querySelector(`[data-node="${id}"]`);
    if (!el) {
      el = document.createElement("button");
      el.type = "button";
      el.className = "map-node";
      el.dataset.node = id;
      el.innerHTML =
        '<span class="map-cap"></span><span class="map-name"></span><span class="map-val"></span><span class="map-dot"></span>';
      el.addEventListener("click", () => mapOpen(id));
      nodes.appendChild(el);
    }
    const p = pos[id],
      N = MAP_NODES[id];
    Object.assign(el.style, { left: `${p.x}px`, top: `${p.y}px`, width: `${p.w}px`, minHeight: `${p.h}px` });
    el.classList.toggle("big", !!p.big);
    el.classList.toggle("open", mapOpenId === id);
    el.setAttribute("aria-pressed", String(mapOpenId === id));
    el.querySelector(".map-cap").textContent = p.big ? `${p.i + 1} · ${N.cap}` : N.cap;
    el.querySelector(".map-name").textContent = N.name ? N.name() : "";
    el.querySelector(".map-val").textContent = N.val ? N.val() : mapCardVal(N.cards[0]);
  }
  // the lines: the spine thick (the design's own line), branches thin, the printer's link dashed
  const c = (p) => [p.x + p.w / 2, p.y + p.h / 2];
  let spine = "",
    thin = "",
    dash = "";
  S.spine.forEach((id, i) => {
    if (!i) return;
    const a = pos[S.spine[i - 1]],
      b = pos[id],
      x0 = a.x + a.w,
      x1 = b.x,
      y = midY;
    spine += `M${x0} ${y} L${x1} ${y} `;
  });
  for (const [id, list] of Object.entries(S.up))
    list.forEach((b, k) => {
      const from = k ? pos[list[k - 1]] : pos[id],
        to = pos[b];
      thin += `M${c(to)[0]} ${from.y} L${c(to)[0]} ${to.y + to.h} `;
    });
  for (const [id, list] of Object.entries(S.down))
    list.forEach((b, k) => {
      const from = k ? pos[list[k - 1]] : pos[id],
        to = pos[b];
      thin += `M${c(to)[0]} ${from.y + from.h} L${c(to)[0]} ${to.y} `;
    });
  if (S.machine) {
    const m = pos.machine,
      out = pos[S.spine[S.spine.length - 1]],
      fromX = m.x + 30,
      fromY = m.y + m.h;
    // to the print (what it prints on) and to the line (the needle sets the line's width)
    dash += `M${fromX} ${fromY} C${fromX} ${fromY + 60} ${c(pos.plate || out)[0]} ${(pos.plate || out).y - 50} ${c(pos.plate || out)[0]} ${(pos.plate || out).y} `;
    if (pos.line)
      dash += `M${m.x} ${m.y + m.h / 2} C${c(pos.line)[0]} ${m.y + m.h / 2} ${c(pos.line)[0]} ${pos.line.y - 80} ${c(pos.line)[0] + 30} ${pos.line.y} `;
  }
  const svg = $("mapLines");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);
  svg.innerHTML =
    `<path class="map-thin" d="${thin}"/><path class="map-dash" d="${dash}"/><path class="map-spine" d="${spine}"/>` +
    (S.spine.length > 1 ? "" : "");
  // the "For" chips
  document
    .querySelectorAll(".map-for")
    .forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.for === "plot") === artForPlot())));
  mapDots();
}
// the ready list's warnings, as dots on the nodes that hold their cards
let mapReady = [];
function mapDots() {
  const lvl = {};
  for (const r of mapReady) {
    const id = Object.keys(MAP_NODES).find((k) => MAP_NODES[k].cards.includes(r.card));
    if (id && r.lvl !== "ok") lvl[id] = lvl[id] === "bad" || r.lvl === "bad" ? "bad" : "warn";
  }
  for (const el of $("mapNodes").children) {
    const d = el.querySelector(".map-dot"),
      v = lvl[el.dataset.node] || "";
    d.className = "map-dot" + (v ? " " + v : "");
    d.title = v
      ? mapReady
          .filter((r) => r.lvl !== "ok" && MAP_NODES[el.dataset.node].cards.includes(r.card))
          .map((r) => r.text)
          .join("\n")
      : "";
  }
}

// ---------- opening a node ----------
// its step comes up (the preview follows it, as with the step tabs), only its cards show, opened, at the top
function mapOpen(id) {
  const N = MAP_NODES[id];
  if (!N) return;
  mapOpenId = id;
  const r = $(MAP_STEP_RADIO[N.step]);
  if (r && !r.checked) document.querySelector(`label[for="${r.id}"]`).click();
  if (N.cards.some((h) => mapCard(h) && mapCard(h).classList.contains("print-more"))) morePrintSet(true, false);
  document.querySelectorAll(".panel section.card").forEach((c) => c.removeAttribute("data-map"));
  for (const h of N.cards) {
    const c = mapCard(h);
    if (!c) continue;
    c.dataset.map = "1";
    if (c.classList.contains("collapsed") && typeof cardSetOpen === "function") cardSetOpen(c, true, false);
  }
  document.body.dataset.mapnode = id;
  mapRender();
  const first = N.cards.map(mapCard).find((c) => c && c.getClientRects().length),
    part = N.at && $(N.at) && ($(N.at).closest(".seg") || $(N.at));
  if (part) part.scrollIntoView({ block: "center" });
  else if (first && first.getBoundingClientRect().top < 0) first.scrollIntoView({ block: "start" });
}
// the node that holds the step now showing (a step changed some other way: an example, a ready-list link)
function mapFollowStep() {
  if (!mapOn()) return;
  const v = document.body.dataset.view,
    S = mapShape(),
    cur = mapOpenId && MAP_NODES[mapOpenId];
  if (
    cur &&
    cur.step === v &&
    (mapOpenId === "machine" ||
      Object.values(S.up).flat().concat(Object.values(S.down).flat(), S.spine).includes(mapOpenId))
  )
    return;
  const id = S.spine.find((k) => MAP_NODES[k].step === v) || S.spine[0];
  mapOpen(id);
}

// ---------- on and off ----------
const mapOn = () => document.body.dataset.ui === "map";
function mapSet(on, store = true) {
  document.body.dataset.ui = on ? "map" : "";
  $("mapUI").checked = on;
  if (store)
    try {
      localStorage.setItem(storeKey("mapUI"), on ? "1" : "0");
    } catch (e) {}
  if (on) {
    // the Wheel folds every card but the one scrolled to; the map opens a node's cards itself
    if ($("wheel").checked) {
      $("wheel").checked = false;
      $("wheel").dispatchEvent(new Event("change"));
    }
    mapFollowStep();
  } else {
    document.querySelectorAll(".panel section.card").forEach((c) => c.removeAttribute("data-map"));
    delete document.body.dataset.mapnode;
  }
  if (typeof fitAll === "function") fitAll();
  window.dispatchEvent(new Event("resize")); // (the preview's canvas sizes itself to its new box)
}
$("mapUI").addEventListener("change", () => mapSet($("mapUI").checked));
document.querySelectorAll(".map-for").forEach((b) =>
  b.addEventListener("click", () => {
    const lab = document.querySelector(`label[for="${b.dataset.for === "plot" ? "artForPlot" : "artForPrint"}"]`);
    if (lab) lab.click();
    setTimeout(mapFollowStep, 0);
  })
);
// the ready list (export.js) also lights the map's dots
{
  const ready = readyUI;
  readyUI = function () {
    const items = ready();
    mapReady = items;
    if (mapOn()) mapDots();
    return items;
  };
}
document
  .querySelectorAll('input[name="view"]')
  .forEach((r) => r.addEventListener("change", () => setTimeout(mapFollowStep, 0)));
new ResizeObserver(() => mapRender()).observe($("map"));
// the readouts change as traces, slicing and edits finish: refresh the nodes' text a few times a second (cheap: reads
// only)
setInterval(() => {
  if (!mapOn()) return;
  const key = JSON.stringify([...$("mapNodes").children].map((el) => el.textContent)) + mapShape().spine.join();
  mapRender();
  const now = JSON.stringify([...$("mapNodes").children].map((el) => el.textContent)) + mapShape().spine.join();
  if (now !== key || now !== mapLast) {
    mapLast = now;
    mapFollowStep();
  }
}, 500);
{
  let on = true;
  try {
    on = localStorage.getItem(storeKey("mapUI")) !== "0";
  } catch (e) {}
  mapSet(on, false);
}
