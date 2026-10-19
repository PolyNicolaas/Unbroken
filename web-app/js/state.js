// Unbroken · web app · state.js
// Shared state and two tiny helpers used everywhere: $ (element by id), PX_MM, and st (the current design and its
// trace).
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

const $ = (id) => document.getElementById(id);
const PX_MM = 25.4 / 96;
// The browser's own storage (the folded cards, Suggestion box notes without a database): keys are "unbroken-…". They
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
const st = { finalVer: 0, outW: 100, spacing: 0, simplify: 0.05, N: 300, autoPending: true, playing: false, t: 0 };
