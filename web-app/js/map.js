// Unbroken · web app · map.js
// The steps as a tool palette (since v148; before it, a map across the top). The picture fills the screen; a rail of
// tools at its left holds the design: Start from, where the art comes from (and its own tools: Grey levels, Tracing,
// a vase's Profile … Rim), the line and its size, how it's made (Drawing, Math), the material. Each tool opens its
// settings as a panel floating beside the rail: for Material, Machine and Layers one row per setting (the controls
// themselves are moved into the rows while it's open, and put back after, so every listener stays as it was); for the
// others, their cards. Print… (or Plot…) at the rail's foot opens the output's own screen, its rail on the right
// (Plate, Layers, Tests, Machine), with Back to the design at its top. The palette follows the design: a 3D object
// has no line tools and its Layers are on its design rail too; a pen plotter has no Material. Features add their tools
// (state.js addMapNode, MAP_SHAPERS, addOutput); a tool's icon is MAP_ICONS[node.icon || id].
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// ---------- the nodes ----------
// step: the step (input name="view") its settings are on; cards: the headings of the cards it shows; rows: groups of
// settings shown as rows ([title, [element ids or fields' control ids]]); cap: its label; val(): its result now
// (default: the first card's header readout); quiet(): faded (a step you rarely need, with nothing to say)
const MAP_CORE = {
  material: {
    cap: "Material",
    step: "choc",
    rows: [
      ["Machine and chocolate", ["printer", "#printerSummary", "chocolate", "needle", "#chocInfo"]],
      ["Line", ["#mapSpacing"]],
      ["Flow", ["layerH", "gFeed", "gFlow", "gE", "gOver"]],
    ],
    recipe: true,
    holds: ["h-choc"],
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
    // (a picture's brightness, contrast and background are with the picture: Image prep)
    cards: ["h-input", "h-pic", "h-prep", "h-text", "h-art", "h-mol", "h-model"],
    val: () => {
      const kind =
        { picture: "Picture", text: "Text", pattern: "Pattern", molecule: "Molecule" }[st.art.kind] ||
        (st.model && st.model.vase ? "Vase" : "3D model");
      const what = st.art.kind === "model" ? (st.model && !st.model.vase && st.model.name) || "" : st.srcLabel || "";
      return what ? `${kind} · ${what}` : kind;
    },
  },
  tracing: { cap: "Tracing", step: "design", cards: ["h-trace"], quiet: () => true, val: () => "" },
  line: {
    cap: "Line",
    step: "design",
    cards: ["h-src", "h-line", "h-fit"],
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
  // how it's made: the drawing played (the circles drawing the line), and the series behind it
  watch: { cap: "Drawing", step: "design", cards: ["h-watch"], val: () => "" },
  math: { cap: "Math", step: "design", cards: [], extra: ["#math"], val: () => mapText("mathSummary") },
  print: {
    cap: "Print",
    icon: "printer",
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
};
for (const [id, node] of Object.entries(MAP_CORE)) addMapNode(id, node);
// a printer: Material before Art, Print at the end (a pen plotter adds itself: plot.js)
addOutput("print", {
  name: "A printer",
  icon: "printer",
  radio: "artForPrint",
  before: ["material"],
  step: "print",
  up: ["plate", "machine"],
  down: ["layers", "tests"],
});
const MAP_STEP_RADIO = { art: "viewArt", design: "viewDesign", choc: "viewChoc", plot: "view2D" };
const mapText = (id) => ($(id) ? $(id).textContent.trim() : "");
const selText = (id) => {
  const s = $(id);
  return s && s.selectedIndex >= 0 ? s.options[s.selectedIndex].textContent.trim() : "";
};
// nothing to work on yet: the empty start, or a picture still being traced (a line made some other way counts: the
// Line step's separate strokes, or the art as drawn)
const mapNothing = () => {
  if (isEmpty()) return true;
  if (isModel() || st.final) return false;
  const m = lineModeNow();
  return !(
    (m === "strokes" && st.sepStrokes && st.sepStrokes.strokes && st.sepStrokes.strokes.length) ||
    m === "drawn"
  );
};
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
    b = c && c.querySelector(".card-head");
  if (!b) return "";
  const t = b.querySelector(".t");
  return b.textContent
    .slice(t ? t.textContent.length : 0)
    .replace(/ⓘ/g, "")
    .trim();
}

const mapVal = (N) => (N.val ? N.val() : mapCardVal(N.cards[0]));

// ---------- the shape of the map for this design ----------
// spine: the steps the design goes through, left to right; up / down: chips above and below a spine node
const outputNow = () => Object.keys(OUTPUTS).find((k) => $(OUTPUTS[k].radio).checked) || "print";
function mapShape() {
  const O = OUTPUTS[outputNow()],
    model = st.art.kind === "model",
    picture = st.art.kind === "picture";
  const spine = [...(O.before || []), "art"];
  if (!model) spine.push("line", "size");
  spine.push(O.step);
  const S = { spine, up: { art: ["examples"], [O.step]: [...(O.up || [])] }, down: { [O.step]: [...(O.down || [])] } };
  if (!model && picture) S.up.line = ["tracing"];
  if (!model) S.down.line = ["watch", "math"];
  for (const shaper of MAP_SHAPERS) shaper(S);
  // a chip whose node no script added (its feature is off) isn't on the map
  for (const side of [S.up, S.down]) for (const k in side) side[k] = side[k].filter((id) => MAP_NODES[id]);
  return S;
}

// ---------- drawing it: the tool palette ----------
// The picture fills the screen. A rail of tools sits at its left (the design: where it comes from, the line, the
// material); each opens its settings as a panel floating beside the rail. Print… (or Plot…) at the rail's foot opens the
// output's own screen, whose rail is on the right (the plate, layers, tests, the machine) with Back to the design at
// its top. One panel at a time; tapping the open tool again closes it. The preview takes the room the rail and the
// panel leave.
let mapOpenId = null,
  mapTrayOpen = false,
  mapShut = false, // the open tool's panel closed (its tool tapped again)
  mapScreen = "design"; // "design" or "out": the output's own screen
// a tool's icon: 24 × 24 paths, by name (a node's icon, else its id)
const MAP_ICONS = {
  examples: "M12 5v14M5 12h14",
  picture: "M3 7h18v13H3z M12 10.5a3 3 0 1 0 0 6a3 3 0 1 0 0-6 M8 7l1.5-2h5L16 7",
  text: "M5 5h14M12 5v14",
  pattern: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z",
  molecule: "M12 3l7 4v8l-7 4-7-4V7z M12 9v4",
  model: "M12 3l8 4.5v9L12 21l-8-4.5v-9z M12 12l8-4.5M12 12v9M12 12L4 7.5",
  vase: "M9 3h6M10 3c0 4-5 6-5 11a7 7 0 0 0 14 0c0-5-5-7-5-11",
  levels: "M4 20V14M10 20V9M16 20V12M22 20V5",
  tracing: "M4 18c2-6 5-10 8-10s6 4 8 10 M12 8V3",
  line: "M3 17c3-8 6 4 9-4s6 4 9-4",
  size: "M4 20L20 4M14 4h6v6M10 20H4v-6",
  watch: "M12 12a7 7 0 1 0 0.01 0 M12 12l5-3 M17 9a2 2 0 1 0 0.01 0",
  math: "M5 5h10l-6 7 6 7H5 M17 9l4 6M21 9l-4 6",
  material: "M12 3v10M8 13h8l-4 8z",
  layers: "M4 8h16M4 12h16M4 16h16",
  print: "M6 9V3h12v6 M6 18H4v-7h16v7h-2 M7 14h10v7H7z",
  plate: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  machine: "M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8 M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2",
  tests: "M8 3v6l-4 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-4-9V3 M7 3h10",
  profile: "M9 3c0 5-4 7-4 12a7 7 0 0 0 14 0c0-5-4-7-4-12",
  shape: "M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z",
  texture: "M6 3v18M10 3v18M14 3v18M18 3v18",
  move: "M2 12c2.5-5 5-5 7.5 0s5 5 7.5 0 3.5-4 5-2",
  rim: "M4 8c3 3 13 3 16 0M6 8v10h12V8",
  page: "M6 3h9l4 4v14H6z M15 3v4h4",
  fills: "M4 20L20 4M4 14L14 4M10 20L20 10",
  export: "M12 3v12M7 10l5 5 5-5M4 21h16",
  // what it's made for (the For chips, Print… / Plot…): a printer's nozzle over the plate, a pen plotter's pen
  printer: "M8 3h8v5l-2.5 3h-3L8 8z M12 11v3 M4 20h16 M7 17h10",
  plotter: "M15.5 3.5l5 5L9 20H4v-5z M13 6l5 5",
  back: "M15 5l-7 7 7 7",
  dot: "M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8",
};
const mapSvg = (name) =>
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${MAP_ICONS[name] || MAP_ICONS.dot}"/></svg>`;
// the source tool's icon and name follow what the art is
const mapArtKind = () =>
  st.art.kind === "model" ? (st.model && st.model.vase ? "vase" : "model") : st.art.kind in MAP_ICONS ? st.art.kind : "picture";
const mapIcon = (id) => (id === "art" ? mapArtKind() : MAP_NODES[id].icon || id);
const mapCap = (id) =>
  id === "art"
    ? { picture: "Picture", text: "Text", pattern: "Pattern", molecule: "Molecule", model: "3D object", vase: "Vase" }[
        mapArtKind()
      ] || "Art"
    : MAP_NODES[id].cap;
// the palette for this design: the design's rail in groups, and the output's own rail
function mapPalette() {
  const S = mapShape(),
    O = OUTPUTS[outputNow()],
    before = O.before || [],
    group = (id) => [id, ...(S.up[id] || []), ...(S.down[id] || [])].filter((k) => k !== "examples" && MAP_NODES[k]);
  const design = [["examples"]];
  for (const id of S.spine) if (id !== O.step && !before.includes(id)) design.push(group(id));
  // (a picture's Tracing is with the picture; the line's Size with the line; how it's made, a group of its own)
  const take = (ids) => {
    const got = [];
    for (const g of design)
      for (const k of ids)
        if (g.includes(k)) {
          g.splice(g.indexOf(k), 1);
          got.push(k);
        }
    return got;
  };
  const art = design.find((g) => g[0] === "art"),
    line = design.find((g) => g[0] === "line");
  if (art) art.push(...take(["tracing"]));
  const how = take(["watch", "math"]);
  if (line) line.push(...take(["size"]));
  if (how.length) design.push(how);
  const own = before.flatMap(group);
  // a 3D object's layers are its design: they're with its material too
  if (st.art.kind === "model" && MAP_NODES.layers && OUTPUTS[outputNow()] === OUTPUTS.print) own.push("layers");
  if (own.length) design.push(own);
  const out = [...group(O.step), ...before.filter((k) => MAP_NODES[k])];
  return { S, O, design: design.filter((g) => g.length), out: [...new Set(out)] };
}
// the screen a tool opens on: the output's tools on its screen; one on both rails stays where it is
function mapScreenOf(id, P = mapPalette()) {
  const inDesign = P.design.some((g) => g.includes(id)),
    inOut = P.out.includes(id);
  return inOut && (!inDesign || mapScreen === "out") ? "out" : "design";
}
function mapButton(id, rail) {
  const nodes = $("mapNodes"),
    key = `${rail}:${id}`;
  let el = nodes.querySelector(`[data-key="${key}"]`);
  if (!el) {
    el = document.createElement("button");
    el.type = "button";
    el.className = "map-node";
    el.dataset.node = id;
    el.dataset.key = key;
    el.innerHTML = '<span class="map-ico"></span><span class="map-cap"></span><span class="map-val"></span><span class="map-dot"></span>';
    el.addEventListener("click", () => {
      if (MAP_NODES[id].tray) return mapTray(!mapTrayOpen);
      if (mapOpenId === id && !mapShut && mapScreen === rail) return mapClose();
      mapScreen = rail;
      mapOpen(id);
    });
  }
  return el;
}
function mapRender() {
  const box = $("map"),
    nodes = $("mapNodes");
  if (!box || !nodes) return;
  const P = mapPalette(),
    O = P.O,
    want = [];
  const head = (t) => {
    const h = document.createElement("div");
    h.className = "map-sep";
    h.setAttribute("aria-hidden", "true");
    if (t) h.textContent = t;
    return h;
  };
  // the design's rail, in groups, and at its foot the way to the output's screen
  P.design.forEach((g, k) => {
    if (k) want.push(head());
    for (const id of g) want.push(mapButton(id, "design"));
  });
  let go = $("mapGo");
  if (!go) {
    go = document.createElement("button");
    go.type = "button";
    go.id = "mapGo";
    go.className = "map-go";
    go.addEventListener("click", () => {
      mapScreen = "out";
      mapOpen(OUTPUTS[outputNow()].step);
    });
  }
  go.innerHTML = `${mapSvg(O.icon || (O.step === "plot" ? "page" : "print"))}<span>${O.step === "plot" ? "Plot…" : "Print…"}</span>`;
  go.title = `${MAP_NODES[O.step].cap}: ${mapVal(MAP_NODES[O.step]) || ""}`;
  want.push(go);
  // the output's own rail: back to the design, then its tools
  let back = $("mapBack");
  if (!back) {
    back = document.createElement("button");
    back.type = "button";
    back.id = "mapBack";
    back.className = "map-back";
    back.innerHTML = `${mapSvg("back")}<span>Design</span>`;
    back.title = "Back to the design";
    back.setAttribute("aria-label", "Back to the design");
    back.addEventListener("click", () => {
      mapScreen = "design";
      const v = MAP_NODES.line && P.S.spine.includes("line") ? "line" : "art";
      mapOpen(v);
    });
  }
  want.push(back);
  for (const id of P.out) want.push(mapButton(id, "out"));
  // in this order; anything no longer on the palette goes
  const keep = new Set(want);
  for (const el of [...nodes.children]) if (!keep.has(el)) el.remove();
  want.forEach((el, i) => {
    if (nodes.children[i] !== el) nodes.insertBefore(el, nodes.children[i] || null);
  });
  for (const el of nodes.querySelectorAll(".map-node")) {
    const id = el.dataset.node,
      rail = el.dataset.key.split(":")[0],
      N = MAP_NODES[id],
      open = N.tray ? mapTrayOpen : mapOpenId === id && !mapShut && mapScreen === rail;
    el.dataset.rail = rail;
    el.classList.toggle("big", P.S.spine.includes(id) && rail === "design");
    el.classList.toggle("open", open);
    el.setAttribute("aria-pressed", String(open));
    el.querySelector(".map-ico").innerHTML = mapSvg(mapIcon(id));
    el.querySelector(".map-cap").textContent = mapCap(id);
    el.querySelector(".map-val").textContent = mapVal(N);
    el.title = `${mapCap(id)}${mapVal(N) ? ": " + mapVal(N) : ""}`;
  }
  document.body.dataset.screen = mapScreen;
  document.body.dataset.panel = mapOpenId && !mapShut ? "on" : "off";
  document
    .querySelectorAll(".map-for")
    .forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.for === outputNow())));
  mapDots();
  mapPanelHead();
}
// the open tool's panel closes; the tool stays the one in use (its step's preview stays)
function mapClose() {
  mapShut = true;
  mapRender();
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
  for (const el of $("mapNodes").querySelectorAll(".map-node")) {
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
    // (a tool on the screen not showing has its warnings on the way there)
  }
  const go = $("mapGo");
  if (go) {
    const n = mapReady.filter((r) => r.lvl !== "ok").length;
    go.classList.toggle("warn", n > 0);
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
let mapMoved = []; // the parts moved into the panel, each with a marker where it came from
function mapMove(el, into) {
  if (!el.__mapHome) el.__mapHome = document.createComment("map: its place");
  if (el.parentNode) el.parentNode.insertBefore(el.__mapHome, el);
  into.appendChild(el);
  mapMoved.push(el);
}
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
      mapMove(el, g);
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
  $("mapHeadTitle").textContent = mapCap(mapOpenId);
  // (its result, without repeating its name: "Picture · sample" under Picture is "sample")
  const t = mapCap(mapOpenId),
    v = mapVal(N) || "";
  $("mapHeadSub").textContent = v.startsWith(t + " · ") ? v.slice(t.length + 3) : v === t ? "" : v;
  $("mapRecipe").hidden = !N.recipe;
  if (N.recipe) {
    $("mapRecipeSwatch").style.background = $("chocSwatch").style.background;
    $("mapRecipeName").textContent = `Recipe: ${selText("chocolate")} · ${selText("needle").split(" · ")[0]}`;
    $("mapRecipeNote").textContent = /changed/.test(mapText("tuneVal"))
      ? `${mapText("tuneVal")} for this print`
      : "as the recipe";
    $("mapRecipeReset").disabled = $("tuneReset").disabled;
    $("mapSpacing").querySelector(".val").textContent =
      `${fmt(lineWidthMM(), 2)} + ${fmt(Math.max(0, (spacingMM() || 0) - lineWidthMM()), 2)} mm`;
  }
}
// its step comes up (the preview follows it), only its settings show, at the top
function mapOpen(id) {
  const N = MAP_NODES[id];
  if (!N || N.tray) return;
  mapOpenId = id;
  mapShut = false;
  mapScreen = mapScreenOf(id);
  mapTray(false);
  const r = $(MAP_STEP_RADIO[N.step]);
  if (r && !r.checked) mapPick(r);
  const cards = N.cards || [];
  document.querySelectorAll(".panel section.card").forEach((c) => c.removeAttribute("data-map"));
  mapRows(N);
  for (const h of cards) {
    const c = mapCard(h);
    if (!c) continue;
    c.dataset.map = "1";
  }
  // a node that's one part of a card (a vase's Shape, say) shows only that part of it: [data-part] marks the parts
  document
    .querySelectorAll(".panel [data-part]")
    .forEach((el) => el.classList.toggle("part-off", !!N.part && el.dataset.part !== N.part));
  // a node's extra parts (the math, for the Line step) move into the panel after its cards
  for (const ref of N.extra || []) if (mapFieldOf(ref)) mapMove(mapFieldOf(ref), $("mapExtra"));
  mapRender();
  const part = N.at && $(N.at) && ($(N.at).closest(".seg") || $(N.at));
  if (part) part.scrollIntoView({ block: "center" });
}
// the node that holds the step now showing (a step changed some other way: an example, a ready-list link)
function mapFollowStep() {
  const v = document.body.dataset.view,
    S = mapShape(),
    shown = S.spine.concat(...Object.values(S.up), ...Object.values(S.down)),
    cur = mapOpenId && MAP_NODES[mapOpenId];
  if (cur && cur.step === v && shown.includes(mapOpenId)) return;
  mapOpen(S.spine.find((k) => MAP_NODES[k].step === v) || S.spine[0]);
}

// ---------- the examples tray ----------
// the examples (state.js EXAMPLES) as tiles over the preview; picking one starts from it. It opens only when asked.
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
      '<h2>Start from</h2><span class="hint">an example: one tap starts from it; everything stays editable</span><button type="button" class="map-tray-x" aria-label="Close">×</button>';
    head.querySelector("button").addEventListener("click", () => mapTray(false));
    // your own: a picture, an STL model or a saved design (the same as dropping it on the page)
    const own = document.createElement("div");
    own.className = "map-tray-own";
    own.innerHTML =
      '<button type="button" class="btn" id="trayFile">Open a file…</button><span class="hint">a picture, a photo, an STL model or a saved design</span><span class="spacer"></span><button type="button" class="btn" id="startOver" title="A clean start: the design, its picture and every change are cleared (save it first from File)">Start over</button>';
    own.querySelector("#trayFile").addEventListener("click", () => {
      mapTray(false);
      $("anyFile").click();
    });
    // two taps: the first asks, the second clears (the page opens again as it does at first: nothing in use)
    let sure = 0;
    own.querySelector("#startOver").addEventListener("click", (e) => {
      const b = e.currentTarget;
      if (!sure) {
        b.textContent = "Tap again to clear it all";
        b.classList.add("danger");
        sure = setTimeout(() => {
          sure = 0;
          b.textContent = "Start over";
          b.classList.remove("danger");
        }, 4000);
        return;
      }
      clearTimeout(sure);
      const q = new URLSearchParams(location.search);
      q.delete("example");
      location.assign(location.pathname + (q.toString() ? "?" + q : ""));
    });
    const grid = document.createElement("div");
    grid.className = "map-tray-grid";
    for (const { key, name, what } of EXAMPLES) {
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
    t.append(head, own, grid);
    $("box").appendChild(t);
  }
  if (t) t.hidden = !on;
  mapRender();
}

// ---------- starting up ----------
// choosing a radio that holds the app's state (the step, what it's made for), as a tap on it would
function mapPick(r) {
  r.checked = true;
  r.dispatchEvent(new Event("change", { bubbles: true }));
}
// the For chips sit in the page's header, beside the name
document
  .querySelector("header.top")
  .insertBefore(document.querySelector(".map-top"), document.querySelector("header.top .design-name"));
{
  let raf = 0;
  new ResizeObserver(() => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      window.dispatchEvent(new Event("resize")); // (the preview's canvases size themselves to their box on a resize)
    });
  }).observe($("box"));
}
// one For chip per thing it can be made for (none when there's only a printer)
for (const [key, O] of Object.entries(OUTPUTS)) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "chip-btn map-for";
  b.dataset.for = key;
  b.innerHTML = `${mapSvg(O.icon || "dot")}<span></span>`;
  b.querySelector("span").textContent = O.name;
  b.addEventListener("click", () => {
    if (!$(O.radio).checked) mapPick($(O.radio));
    setTimeout(mapFollowStep, 0);
  });
  document.querySelector(".map-top").appendChild(b);
}
document.querySelector(".map-top").hidden = Object.keys(OUTPUTS).length < 2;
$("mapRecipeReset").addEventListener("click", () => $("tuneReset").click());
$("mapClose").addEventListener("click", mapClose);
// Esc closes the panel (not while typing in it)
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !e.defaultPrevented && !/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && !mapShut && mapOpenId)
    mapClose();
});
// the Drawing tool: Play, and the speed and circles (the View menu's, kept the same both ways)
$("watchPlay").addEventListener("click", () => $("play").click());
for (const [mine, theirs, k] of [
  ["watchSpeed", "speed", "value"],
  ["watchCircles", "circles", "checked"],
]) {
  $(mine)[k] = $(theirs)[k];
  $(mine).addEventListener("change", () => {
    $(theirs)[k] = $(mine)[k];
    $(theirs).dispatchEvent(new Event("change", { bubbles: true }));
  });
  $(theirs).addEventListener("change", () => ($(mine)[k] = $(theirs)[k]));
}
// Material shows the line's width and gap; they're changed where the line is (the Line step)
$("mapToLine").addEventListener("click", (e) => {
  e.preventDefault();
  mapOpen("line");
  $("lineW").focus();
});
// the ready list (export.js) also lights the map's dots
{
  const ready = readyUI;
  readyUI = function () {
    const items = ready();
    mapReady = items;
    mapDots();
    return items;
  };
}
document
  .querySelectorAll('input[name="view"]')
  .forEach((r) => r.addEventListener("change", () => setTimeout(mapFollowStep, 0)));
new ResizeObserver(() => mapRender()).observe($("map"));
// the readouts change as traces, slicing and edits finish: refresh the nodes a few times a second (reads only)
setInterval(() => {
  mapRender();
  mapFollowStep();
}, 500);
mapFollowStep();
