// Unbroken · web app · map.js
// The steps as a map (View ▸ Map of the steps; on by default): a band across the top with one thick line through the
// steps the design takes (for a printer: Material, Art, Line, Size, Print), the less-used settings as chips above and
// below their step, faded until they matter. Each node shows its result (from the cards' own readouts) and a dot when
// the ready list has something for it. Tapping a node shows its settings beside the preview: for Material, Machine
// and Layers as one row per setting (the controls themselves are moved into the rows while the node is open, and put
// back after, so every listener stays as it was); for the others, their cards. The Examples chip above Art opens a
// tray of examples over the preview; it never opens by itself. The map's shape follows the design: a 3D model or a
// vase goes straight from Art to Print, a pen plotter ends in Plot.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// ---------- the nodes ----------
// step: the step (input name="view") its settings are on; cards: the headings of the cards it shows; rows: groups of
// settings shown as rows ([title, [element ids or fields' control ids]]); cap: its label; val(): its result now
// (default: the first card's header readout); quiet(): faded (a step you rarely need, with nothing to say)
const MAP_NODES = {
  material: {
    cap: "Material",
    step: "choc",
    rows: [
      ["Machine and chocolate", ["printer", "chocolate", "needle", "#chocInfo"]],
      ["Line", ["lineW", "lineGapMM", "#mapSpacing"]],
      ["Flow", ["layerH", "gFeed", "gFlow", "gE", "gOver"]],
    ],
    recipe: true,
    holds: ["h-choc", "h-line"],
    val: () =>
      [
        selText("chocolate").replace(/ chocolate$/i, ""),
        selText("needle").split(" · ")[0],
        `${fmt(lineWidthMM(), 2)} mm`,
      ]
        .filter(Boolean)
        .join(" · "),
  },
  examples: { cap: "Examples", tray: true, val: () => "" },
  art: {
    cap: "Art",
    step: "art",
    cards: ["h-input", "h-pic", "h-text", "h-art", "h-mol", "h-model"],
    val: () => {
      const kind =
        { picture: "Picture", text: "Text", pattern: "Pattern", molecule: "Molecule" }[st.art.kind] ||
        (st.model && st.model.vase ? "Vase" : "3D model");
      const what = st.art.kind === "model" ? (st.model && !st.model.vase && st.model.name) || "" : st.srcLabel || "";
      return what ? `${kind} · ${what}` : kind;
    },
  },
  prep: {
    cap: "Picture prep",
    step: "art",
    cards: ["h-prep", "h-levels"],
    quiet: () => mapText("prepVal") === "off" && /off/.test(mapCardVal("h-levels") || "off"),
  },
  // a vase made here: its parts are in the 3D model card, so each opens the card at its part
  vprofile: { cap: "Profile", step: "art", cards: ["h-model"], at: "vaseProfile", val: () => "" },
  vtexture: { cap: "Texture", step: "art", cards: ["h-model"], at: "vtNone", val: () => "" },
  vmove: { cap: "Movement", step: "art", cards: ["h-model"], at: "vmNone", val: () => "" },
  tracing: { cap: "Tracing", step: "design", cards: ["h-trace"], quiet: () => true, val: () => "" },
  line: {
    cap: "Line",
    step: "design",
    cards: ["h-src", "h-line", "h-fit"],
    extra: ["#math"],
    val: () => {
      if (mapNothing()) return "nothing yet";
      const m = lineModeNow(),
        t = ($("chip").textContent.match(/(\d+) terms · error ([\d.]+) mm/) || []).slice(1);
      return m === "strokes"
        ? "separate strokes"
        : m === "drawn"
          ? "as drawn"
          : t.length
            ? `one line · ${t[0]} terms`
            : "one line";
    },
  },
  size: { cap: "Size", step: "design", cards: ["h-size"], val: () => sizeText() },
  print: {
    cap: "Print",
    step: "choc",
    cards: ["h-gexport"],
    val: () => {
      if (mapNothing()) return "nothing to print yet";
      const n = mapReady.filter((r) => r.lvl !== "ok").length;
      return n ? `${n} to check` : "ready";
    },
  },
  plate: { cap: "Plate", step: "choc", cards: ["h-plate"], val: () => "" },
  machine: {
    cap: "Machine",
    step: "choc",
    rows: [["Machine", ["gZ", "gLift", "gOx", "gOy"]]],
    cards: ["h-profile"],
    holds: ["h-machine"],
    quiet: () => !["gZ", "gLift"].some((i) => $(i).closest("label").classList.contains("changed")),
    val: () => "",
  },
  layers: {
    cap: "Layers",
    step: "choc",
    rows: [
      ["Height and time", ["printHeightMM", "layerTime", "#layerCount", "#layerHint", "#cartHint"]],
      ["Walls and support", ["cutRow", "wallCount", "support"]],
      ["Base", ["baseLayers", "basePattern", "baseDensity", "baseDirRow", "infillMin"]],
      ["Infill", ["fillDensity", "fillPattern", "fillAngle", "fillTurnF", "fillMin"]],
    ],
    holds: ["h-layers", "h-base", "h-infill"],
    quiet: () => !isModel() && /^1 layer\b/.test(mapText("layerInfo")) && !(+$("baseLayers").value > 0),
    val: () => "",
  },
  tests: { cap: "Tests", step: "choc", cards: ["h-test", "h-matrix"], quiet: () => true, val: () => "" },
  plot: {
    cap: "Plot",
    step: "plot",
    cards: ["h-plot"],
    val: () => (mapNothing() ? "nothing yet" : "the page"),
    extra: [],
  },
  fills: { cap: "Fills", step: "plot", cards: ["h-fills"], val: () => "" },
  pexport: { cap: "Export", step: "plot", cards: ["h-pexport"], val: () => "" },
};
const MAP_STEP_RADIO = { art: "viewArt", design: "viewDesign", choc: "viewChoc", plot: "view2D" };
const mapText = (id) => ($(id) ? $(id).textContent.trim() : "");
const selText = (id) => {
  const s = $(id);
  return s && s.selectedIndex >= 0 ? s.options[s.selectedIndex].textContent.trim() : "";
};
// nothing to work on yet: the empty start, or a picture still being traced
const mapNothing = () => (typeof isEmpty === "function" && isEmpty()) || (!isModel() && !st.final);
// the size the design is drawn at: on a pen plotter's page (the page card's readout), else the Size card's own
const sizeText = () => {
  if (mapNothing()) return "";
  if (artForPlot()) {
    const m = mapCardVal("h-plot").match(/^[\d.]+ × [\d.]+ mm/);
    if (m) return m[0];
  }
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
// spine: the steps the design goes through, left to right; up / down: chips above and below a spine node
function mapShape() {
  const plot = artForPlot(),
    model = st.art.kind === "model",
    vase = model && st.model && st.model.vase,
    picture = st.art.kind === "picture";
  const spine = plot ? ["art"] : ["material", "art"];
  if (!model) spine.push("line", "size");
  spine.push(plot ? "plot" : "print");
  const up = { art: ["examples"] },
    down = {};
  if (picture) down.art = ["prep"];
  if (vase) down.art = ["vprofile", "vtexture", "vmove"];
  if (!model && picture) up.line = ["tracing"];
  if (plot) {
    up.plot = ["pexport"];
    down.plot = ["fills"];
  } else {
    up.print = ["plate", "machine"];
    down.print = ["layers", "tests"];
  }
  return { spine, up, down };
}

// ---------- drawing it ----------
let mapOpenId = null,
  mapTrayOpen = false;
// the band fits its width (no sideways scrolling): the steps share it, and each step's chips share the room under
// (or over) it and the gap to the next step, so nothing overlaps; chips are at least 34 px tall to tap
const MAP_CHIP_H = 34;
function mapRender() {
  if (!mapOn()) return;
  const box = $("map"),
    W = box.clientWidth,
    H = box.clientHeight,
    S = mapShape(),
    nodes = $("mapNodes"),
    pos = {};
  if (!(H > 0 && W > 0)) return;
  nodes.style.width = `${W}px`;
  const n = S.spine.length,
    side = 16,
    sw = Math.min(250, (W - 2 * side - (n - 1) * 28) / n),
    gap = n > 1 ? (W - 2 * side - n * sw) / (n - 1) : 0,
    midY = Math.round(H / 2),
    nh = 60;
  S.spine.forEach((id, i) => (pos[id] = { x: side + i * (sw + gap), y: midY - nh / 2, w: sw, h: nh, big: true, i }));
  const chips = (list, parent, y) => {
    const room = Math.min(sw + gap - 12, W - side - pos[parent].x),
      w = Math.min(132, (room - 8 * (list.length - 1)) / list.length);
    // (centred on their step, within its room)
    const x0 = Math.max(
      side,
      Math.min(W - side - room, pos[parent].x + pos[parent].w / 2 - (list.length * (w + 8) - 8) / 2)
    );
    list.forEach((id, k) => (pos[id] = { x: x0 + k * (w + 8), y, w, h: MAP_CHIP_H }));
  };
  for (const [p, list] of Object.entries(S.up)) chips(list, p, 10);
  for (const [p, list] of Object.entries(S.down)) chips(list, p, H - 10 - MAP_CHIP_H);
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
      el.innerHTML = '<span class="map-cap"></span><span class="map-val"></span><span class="map-dot"></span>';
      el.addEventListener("click", () => (MAP_NODES[id].tray ? mapTray(!mapTrayOpen) : mapOpen(id)));
      nodes.appendChild(el);
    }
    const p = pos[id],
      N = MAP_NODES[id],
      open = N.tray ? mapTrayOpen : mapOpenId === id;
    Object.assign(el.style, { left: `${p.x}px`, top: `${p.y}px`, width: `${p.w}px`, height: `${p.h}px` });
    el.classList.toggle("big", !!p.big);
    el.classList.toggle("chip", !p.big);
    el.classList.toggle("open", open);
    el.setAttribute("aria-pressed", String(open));
    el.querySelector(".map-cap").textContent = p.big ? `${p.i + 1} · ${N.cap}` : N.cap;
    el.querySelector(".map-val").textContent = N.val ? N.val() : mapCardVal(N.cards[0]);
  }
  // the lines: the design's own line thick through the spine, a short thin stem to each chip
  let spine = "",
    thin = "";
  S.spine.forEach((id, i) => {
    if (i) spine += `M${pos[S.spine[i - 1]].x + pos[S.spine[i - 1]].w} ${midY} L${pos[id].x} ${midY} `;
  });
  const mid = (id) => pos[id].x + pos[id].w / 2;
  for (const [p, list] of Object.entries(S.up))
    for (const id of list) thin += `M${mid(id)} ${pos[id].y + MAP_CHIP_H} L${mid(id)} ${pos[p].y} `;
  for (const [p, list] of Object.entries(S.down))
    for (const id of list) thin += `M${mid(id)} ${pos[p].y + nh} L${mid(id)} ${pos[id].y} `;
  const svg = $("mapLines");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);
  svg.innerHTML = `<path class="map-thin" d="${thin}"/><path class="map-spine" d="${spine}"/>`;
  document
    .querySelectorAll(".map-for")
    .forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.for === "plot") === artForPlot())));
  mapDots();
  mapPanelHead();
}
// the ready list's warnings, as dots on the nodes that hold their settings; a quiet node fades unless it has one
let mapReady = [];
// (the ready list names a card by its heading; a node holds the cards it shows, and those its rows came from)
const mapNodeOf = (heading) =>
  Object.keys(MAP_NODES).find((k) => (MAP_NODES[k].holds || MAP_NODES[k].cards || []).includes(heading));
function mapDots() {
  const lvl = {};
  for (const r of mapReady) {
    const id = mapNodeOf(r.card);
    if (id && r.lvl !== "ok") lvl[id] = lvl[id] === "bad" || r.lvl === "bad" ? "bad" : "warn";
  }
  for (const el of $("mapNodes").children) {
    const id = el.dataset.node,
      N = MAP_NODES[id],
      d = el.querySelector(".map-dot"),
      v = lvl[id] || "";
    d.className = "map-dot" + (v ? " " + v : "");
    d.title = v
      ? mapReady
          .filter((r) => r.lvl !== "ok" && mapNodeOf(r.card) === id)
          .map((r) => r.text)
          .join("\n")
      : "";
    el.classList.toggle("quiet", !!(N.quiet && N.quiet()) && !v && mapOpenId !== id);
  }
}

// ---------- opening a node ----------
// a setting's row: the field round its control (a label, a range's row, a switch), or an element by id ("#id")
function mapFieldOf(ref) {
  if (ref[0] === "#") return $(ref.slice(1));
  const el = $(ref);
  if (!el) return null;
  if (ref === "chocolate") return el.closest(".choc-pick");
  if (el.matches("div.row, div.two, label.field")) return el;
  return el.closest("label.field, div.row, label.check") || el;
}
let mapMoved = []; // the settings moved into the rows, each with a marker where it came from
function mapPutBack() {
  for (const el of mapMoved)
    if (el.__mapHome && el.__mapHome.parentNode) el.__mapHome.parentNode.insertBefore(el, el.__mapHome);
  mapMoved = [];
}
function mapRows(N) {
  mapPutBack();
  const body = $("mapRowsBody");
  body.textContent = "";
  $("mapRows").hidden = !N.rows;
  if (!N.rows) return;
  for (const [title, ids] of N.rows) {
    const els = ids.map(mapFieldOf).filter(Boolean);
    if (!els.length) continue;
    const g = document.createElement("div");
    g.className = "map-group";
    const h = document.createElement("h3");
    h.textContent = title;
    g.appendChild(h);
    for (const el of els) {
      if (!el.__mapHome) el.__mapHome = document.createComment("map: its place");
      if (el.parentNode) el.parentNode.insertBefore(el.__mapHome, el);
      g.appendChild(el);
      mapMoved.push(el);
      // a Fine-tuning setting changed from the recipe: ↺ puts it back
      const inp = el.matches("label.field") && el.querySelector("input, select");
      if (inp && inp.id in TUNE_FROM && !el.querySelector(".map-reset")) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "map-reset";
        b.textContent = "↺";
        b.title = "Back to the recipe's value";
        b.setAttribute("aria-label", "Back to the recipe's value");
        b.addEventListener("click", (e) => {
          e.preventDefault();
          inp.value = tuneProfile()[inp.id].v;
          inp.dispatchEvent(new Event("input", { bubbles: true }));
          inp.dispatchEvent(new Event("change", { bubbles: true }));
        });
        el.appendChild(b);
      }
    }
    body.appendChild(g);
    // a group whose settings don't apply to this design (walls and support for a drawing) isn't shown
    g.hidden = !els.some((el) => el.getClientRects().length);
  }
}
// the panel's head: the node's name and result; for Material, the recipe (the printer, chocolate and needle's values)
function mapPanelHead() {
  const N = mapOpenId && MAP_NODES[mapOpenId];
  if (!N) return;
  $("mapHeadTitle").textContent = N.cap;
  $("mapHeadSub").textContent = N.val ? N.val() : mapCardVal(N.cards[0]);
  $("mapRecipe").hidden = !N.recipe;
  if (N.recipe) {
    $("mapRecipeSwatch").style.background = $("chocSwatch").style.background;
    $("mapRecipeName").textContent = `Recipe: ${selText("chocolate")} · ${selText("needle").split(" · ")[0]}`;
    $("mapRecipeNote").textContent = /changed/.test(mapText("tuneVal"))
      ? `${mapText("tuneVal")} for this print`
      : "as the recipe";
    $("mapRecipeReset").disabled = $("tuneReset").disabled;
    $("mapSpacing").querySelector(".val").textContent = `${fmt(Math.max(lineWidthMM(), spacingMM() || 0), 2)} mm`;
  }
}
// its step comes up (the preview follows it), only its settings show, at the top
function mapOpen(id) {
  const N = MAP_NODES[id];
  if (!N || N.tray) return;
  mapOpenId = id;
  mapTray(false);
  const r = $(MAP_STEP_RADIO[N.step]);
  if (r && !r.checked) document.querySelector(`label[for="${r.id}"]`).click();
  const cards = N.cards || [];
  if (cards.some((h) => mapCard(h) && mapCard(h).classList.contains("print-more"))) morePrintSet(true, false);
  document.querySelectorAll(".panel section.card").forEach((c) => c.removeAttribute("data-map"));
  mapRows(N);
  for (const h of cards) {
    const c = mapCard(h);
    if (!c) continue;
    c.dataset.map = "1";
    if (c.classList.contains("collapsed") && typeof cardSetOpen === "function") cardSetOpen(c, true, false);
  }
  $("mapRows").dataset.map = N.rows ? "1" : "";
  // a node's extra parts (the math, for the Line step) move into the panel after its cards
  for (const ref of N.extra || []) {
    const el = mapFieldOf(ref);
    if (!el) continue;
    if (!el.__mapHome) el.__mapHome = document.createComment("map: its place");
    if (el.parentNode) el.parentNode.insertBefore(el.__mapHome, el);
    $("mapExtra").appendChild(el);
    mapMoved.push(el);
  }
  document.body.dataset.mapnode = id;
  mapRender();
  const part = N.at && $(N.at) && ($(N.at).closest(".seg") || $(N.at));
  if (part) part.scrollIntoView({ block: "center" });
}
// the node that holds the step now showing (a step changed some other way: an example, a ready-list link)
function mapFollowStep() {
  if (!mapOn()) return;
  const v = document.body.dataset.view,
    S = mapShape(),
    shown = S.spine.concat(...Object.values(S.up), ...Object.values(S.down)),
    cur = mapOpenId && MAP_NODES[mapOpenId];
  if (cur && cur.step === v && shown.includes(mapOpenId)) return;
  mapOpen(S.spine.find((k) => MAP_NODES[k].step === v) || S.spine[0]);
}

// ---------- the examples tray ----------
// the examples (examples.js) as tiles over the preview; picking one starts from it. It opens only when asked.
function mapTray(on) {
  mapTrayOpen = !!on;
  let t = $("mapTray");
  if (on && !t) {
    t = document.createElement("div");
    t.id = "mapTray";
    t.className = "map-tray";
    t.setAttribute("role", "dialog");
    t.setAttribute("aria-label", "Examples");
    const head = document.createElement("div");
    head.className = "map-tray-head";
    head.innerHTML =
      '<h2>Examples</h2><span class="hint">one tap starts from it; everything stays editable</span><button type="button" class="map-tray-x" aria-label="Close the examples">×</button>';
    head.querySelector("button").addEventListener("click", () => mapTray(false));
    const grid = document.createElement("div");
    grid.className = "map-tray-grid";
    for (const [key, name, what] of EXAMPLES) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "map-ex";
      b.dataset.example = key;
      b.innerHTML = "<b></b><span></span>";
      b.querySelector("b").textContent = name;
      b.querySelector("span").textContent = what;
      b.addEventListener("click", () => {
        useExample(key);
        recordSoon();
        mapTray(false);
        setTimeout(() => mapOpen("art"), 0);
      });
      grid.appendChild(b);
    }
    t.append(head, grid);
    $("box").appendChild(t);
  }
  if (t) t.hidden = !on;
  if (mapOn()) mapRender();
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
    // the Wheel folds every card but the one scrolled to; the map opens a node's settings itself
    if ($("wheel").checked) {
      $("wheel").checked = false;
      $("wheel").dispatchEvent(new Event("change"));
    }
    mapOpenId = null;
    mapFollowStep();
  } else {
    mapPutBack();
    mapTray(false);
    document.querySelectorAll(".panel section.card").forEach((c) => c.removeAttribute("data-map"));
    delete document.body.dataset.mapnode;
  }
  window.dispatchEvent(new Event("resize")); // (the preview's canvas sizes itself to its new box)
}
$("mapUI").addEventListener("change", () => mapSet($("mapUI").checked));
// the For chips sit in the page's header, beside the name
document
  .querySelector("header.top")
  .insertBefore(document.querySelector(".map-top"), document.querySelector("header.top .design-name"));
{
  let raf = 0;
  new ResizeObserver(() => {
    if (!mapOn() || raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      window.dispatchEvent(new Event("resize")); // (the preview's canvases size themselves to their box on a resize)
    });
  }).observe($("box"));
}
document.querySelectorAll(".map-for").forEach((b) =>
  b.addEventListener("click", () => {
    const lab = document.querySelector(`label[for="${b.dataset.for === "plot" ? "artForPlot" : "artForPrint"}"]`);
    if (lab) lab.click();
    setTimeout(mapFollowStep, 0);
  })
);
$("mapRecipeReset").addEventListener("click", () => $("tuneReset").click());
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
// the readouts change as traces, slicing and edits finish: refresh the nodes a few times a second (reads only)
setInterval(() => {
  if (!mapOn()) return;
  mapRender();
  mapFollowStep();
}, 500);
{
  let on = true;
  try {
    on = localStorage.getItem(storeKey("mapUI")) !== "0";
  } catch (e) {}
  mapSet(on, false);
}
