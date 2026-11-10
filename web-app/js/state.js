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
const joined = {}; // moment → the functions given for it
function on(moment, fn) {
  (joined[moment] ||= []).push(fn);
}
// every answer to a moment (a list, empty when no feature joined it)
const ask = (moment, ...args) => (joined[moment] || []).map((fn) => fn(...args));
// what the line is made for (the For chips, map.js): a printer or a pen plotter
const artForPlot = () => $("artForPlot").checked;

const st = { finalVer: 0, outW: 100, spacing: 0, simplify: 0.05, N: 300, autoPending: true, playing: false, t: 0 };
