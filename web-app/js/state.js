// Unbroken · web app · state.js
// Shared state and two tiny helpers used everywhere: $ (element by id), PX_MM, and st (the current design and its
// trace); and where features join in (the lists and moments the core offers).
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

const $ = (id) => document.getElementById(id);
const PX_MM = 25.4 / 96;
// The browser's own storage (the folded cards, the map on or off): keys are "unbroken-…". They
// were "flt-…" until v94, so anything saved under the old name is moved across the first time it's asked for.
function storeKey(name) {
  const key = "unbroken-" + name,
    old = "flt-" + name;
  try {
    const v = localStorage.getItem(old);
    if (v !== null) {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, v);
      localStorage.removeItem(old);
    }
  } catch {}
  return key;
}
// Print settings changed: the printer, the chocolate, the needle or line width, or the layer height has just been
// applied (or a design restored). What depends on them (E per mm, the Fine-tuning notes, the test print) subscribes
// here
// and runs after the change is in place, instead of listening to those controls and relying on listener order.
const printSettingsSubs = [];
function onPrintSettings(fn) {
  printSettingsSubs.push(fn);
}
function printSettingsChanged() {
  for (const fn of printSettingsSubs) fn();
}

// ---------- features on and off ----------
// A feature is a module: its scripts (index.html loads them with feature(name, file)) and the parts of the page marked
// data-feature="name". Switched off, its scripts aren't loaded and its parts are taken off the page, so the app is as
// if it had never been built. What's off: settings.js (features: { vase: false }), and the page's address for trying
// things (?off=vase,plotter turns some off, ?on=vase turns one on that settings.js has off). A feature that needs
// another goes with it.
const FEATURE_NEEDS = { vase: ["model"] };
const FEATURES_OFF = (() => {
  const off = new Set(),
    set = (window.UNB_SETTINGS && window.UNB_SETTINGS.features) || {},
    q = new URLSearchParams(location.search),
    list = (k) => (q.get(k) || "").split(",").filter(Boolean);
  for (const k in set) if (set[k] === false) off.add(k);
  for (const k of list("off")) off.add(k);
  for (const k of list("on")) off.delete(k);
  for (const k in FEATURE_NEEDS) if (FEATURE_NEEDS[k].some((n) => off.has(n))) off.add(k);
  return off;
})();
const featureOn = (name) => !FEATURES_OFF.has(name);
function feature(name, src) {
  if (featureOn(name)) document.write(`<script src="${src}"><\/script>`);
}
// (state.js loads after the page's markup: an off feature's parts go before any other script looks for them)
for (const el of document.querySelectorAll("[data-feature]")) if (!featureOn(el.dataset.feature)) el.remove();

// ---------- where features join in ----------
// The core never names a feature. A feature adds itself when its script loads: an entry in a list the core reads
// (an example, a step of the map, something it's made for), or a function for a moment the core announces
// (on("save", fn): asked with ask("save")). A feature whose script isn't loaded simply isn't in the lists: test A61
// leaves each one out and checks the app still opens, traces and exports.
const EXAMPLES = []; // { order, key, name, what, use, blank }: the Examples tray (map.js), in order
function addExample(order, key, name, what, use, blank = false) {
  EXAMPLES.push({ order, key, name, what, use, blank });
  EXAMPLES.sort((a, b) => a.order - b.order);
}
// The map of the steps (map.js). A step or chip: id → { cap, step, cards, rows, holds, quiet, val } (map.js says what
// each is); added again, a node's cards join the ones it has (the Tests chip holds the test print's card and the
// test matrix's, each added by its own script).
const MAP_NODES = {};
function addMapNode(id, node) {
  const had = MAP_NODES[id];
  MAP_NODES[id] = had ? { ...had, ...node, cards: [...(had.cards || []), ...(node.cards || [])] } : node;
}
// What the line is made for: key → { name: its chip, radio: the input that holds the choice, before: the steps before
// Art, step: its last step, up / down: the chips over and under that step }. The map draws the For chips from these.
const OUTPUTS = {};
function addOutput(key, output) {
  OUTPUTS[key] = output;
}
// The map's shape for the design in hand can be changed by a feature: each of these gets the shape { spine, up, down }
// and may add its chips (a vase's Profile, Texture and Movement under Art).
const MAP_SHAPERS = [];
// The controls a design keeps (history.js saves and restores their values): each script adds the ones it owns
const DESIGN_IDS = [];
function addSaved(...ids) {
  DESIGN_IDS.push(...ids);
}
const joined = {}; // moment → the functions given for it
function on(moment, fn) {
  (joined[moment] ||= []).push(fn);
}
// every answer to a moment (a list, empty when no feature joined it)
const ask = (moment, ...args) => (joined[moment] || []).map((fn) => fn(...args));
// what the line is made for (the For chips, map.js): a printer or a pen plotter
const artForPlot = () => $("artForPlot").checked;

const st = { finalVer: 0, outW: 100, spacing: 0, simplify: 0.05, N: 300, autoPending: true, playing: false, t: 0 };
