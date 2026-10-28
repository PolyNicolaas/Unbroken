// Unbroken · web app · steppers.js
// Touch-friendly number boxes: every <input type="number"> gets a − and a + button beside it (made bigger on touch
// screens), stepping by the box's own step within its min and max; holding a button repeats. Typing still works. Boxes
// added later (a fill pen's row) get their buttons too.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// the step a button moves by: the box's step, or for step="any" one that suits the number (1 from 20 up, 0.1 from 2,
// else 0.01)
function stepOf(el) {
  const s = parseFloat(el.step);
  if (s > 0) return s;
  const v = Math.abs(parseFloat(el.value || el.placeholder) || 0);
  return v >= 20 ? 1 : v >= 2 ? 0.1 : 0.01;
}
const decimalsOf = (x) => {
  const t = String(x);
  return t.includes(".") ? t.length - t.indexOf(".") - 1 : 0;
};
function stepBy(el, dir) {
  if (el.disabled || el.readOnly) return false;
  const s = stepOf(el),
    min = el.min === "" ? -Infinity : +el.min,
    max = el.max === "" ? Infinity : +el.max,
    cur = el.value === "" ? (Number.isFinite(min) ? min - (dir > 0 ? s : 0) : 0) : +el.value;
  // to the next multiple of the step (from min when it has one), so 0.84 + 0.05 is 0.85 / 0.9 as the box steps
  const base = Number.isFinite(min) ? min : 0,
    k = (cur - base) / s,
    next = base + (dir > 0 ? Math.floor(k + 1e-9) + 1 : Math.ceil(k - 1e-9) - 1) * s,
    v = Math.min(max, Math.max(min, next)),
    out = +v.toFixed(Math.max(decimalsOf(s), decimalsOf(base)));
  if (String(out) === el.value) return false;
  el.value = String(out);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}
function addStepper(el) {
  if (el.dataset.stepper || el.type !== "number" || el.readOnly) return;
  el.dataset.stepper = "1";
  const wrap = document.createElement("span");
  wrap.className = "num";
  el.parentNode.insertBefore(wrap, el);
  const btn = (dir) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "num-btn";
    b.tabIndex = -1; // (the keyboard has the arrow keys)
    b.textContent = dir > 0 ? "+" : "−";
    const name = (el.getAttribute("aria-label") || (el.closest("label") || {}).textContent || el.id || "").trim();
    b.setAttribute("aria-label", `${dir > 0 ? "More" : "Less"}${name ? ": " + name.split("\n")[0] : ""}`);
    let timer = null,
      moved = false;
    const stop = () => {
      clearTimeout(timer);
      timer = null;
      if (moved) el.dispatchEvent(new Event("change", { bubbles: true })); // once, when the button is let go
      moved = false;
    };
    const repeat = (delay) => {
      timer = setTimeout(() => {
        moved = stepBy(el, dir) || moved;
        repeat(70);
      }, delay);
    };
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault(); // no focus change, no text selection
      moved = stepBy(el, dir);
      repeat(420);
    });
    for (const ev of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(ev, stop);
    b.addEventListener("click", (e) => {
      // a keyboard or assistive "click" (no pointer): one step
      if (e.detail === 0) {
        if (stepBy(el, dir)) el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    return b;
  };
  wrap.append(btn(-1), el, btn(1));
}
function addSteppers(root = document) {
  root.querySelectorAll('input[type="number"]').forEach(addStepper);
}
addSteppers();
// boxes made later (the fill pens' rows, plot.js)
new MutationObserver((list) => {
  for (const m of list)
    for (const n of m.addedNodes)
      if (n.nodeType === 1) n.matches('input[type="number"]') ? addStepper(n) : addSteppers(n);
}).observe(document.body, { childList: true, subtree: true });
