// Unbroken · web app · ui.js
// Small page helpers every other file uses: number formatting, the toast, theme colours, sizing a canvas to its box,
// status lines, saving a file, and a counter for "busy" so overlapping jobs don't clear each other's state.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// a number with d decimals, or "–" when it isn't one
const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "–");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// a whole number from input #id, held to lo … hi (dflt when it isn't a number)
const intIn = (id, lo, hi, dflt) => {
  const v = Math.round(+$(id).value);
  return Number.isFinite(v) ? clamp(v, lo, hi) : dflt;
};
// "#rrggbb" → [r, g, b] (0–255)
const hexRGB = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// the toast at the bottom of the page (bad: red, shown longer)
let toastTimer = null;
function toast(t, bad) {
  const el = $("toast");
  el.textContent = t;
  el.className = "toast" + (bad ? " bad" : "");
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), bad ? 5000 : 1600);
}
// a message is about what was on screen: it goes with a click on it, or when another tab is opened
function hideToast() {
  clearTimeout(toastTimer);
  $("toast").hidden = true;
}
$("toast").addEventListener("click", hideToast);
document.querySelectorAll('input[name="view"]').forEach((r) => r.addEventListener("change", hideToast));

// a status line under a button: kind "ok", "bad", "busy" or "" (plain)
function setStatus(el, kind, text) {
  el.className = "status" + (kind ? " " + kind : "");
  el.textContent = text;
}

// theme colours (theme.css): css("--ink") as text; cssRGBA as [r, g, b, a] (0–255, a 0–1) for drawing pixel by pixel
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const cssRGBA = (n) => {
  const g = (cssRGBA.g ||= document.createElement("canvas").getContext("2d"));
  g.fillStyle = "#000";
  g.fillStyle = css(n) || "#000";
  const v = g.fillStyle; // the browser normalises any colour to #rrggbb or rgba(…)
  if (v[0] === "#") return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)).concat(1);
  const m = v.match(/[\d.]+/g).map(Number);
  return [m[0], m[1], m[2], m.length > 3 ? m[3] : 1];
};

// Size a canvas's pixels to its box on screen (× device pixel ratio). Returns { r (its box), dpr }, or null when it
// isn't shown (zero width). keep: leave the pixels alone when they already match (redrawing every frame).
function fitCanvas(cv, keep) {
  const r = cv.getBoundingClientRect(),
    dpr = window.devicePixelRatio || 1;
  if (!r.width) return null;
  const W = Math.round(r.width * dpr),
    H = Math.round(r.height * dpr);
  if (!keep || cv.width !== W || cv.height !== H) {
    cv.width = W;
    cv.height = H;
  }
  return { r, dpr };
}

// Save a file: through Claude's download prompt when the page runs inside Claude, else a normal browser download.
// Resolves when saved; rejects with the error (e.code "declined" / "rate_limited" from Claude's prompt).
const dlReady =
  window.claude && window.claude.use ? window.claude.use("downloads").catch(() => null) : Promise.resolve(null);
async function saveFile(name, data, type) {
  const dl = await dlReady;
  if (dl) return dl.save({ filename: name, data });
  const url = URL.createObjectURL(new Blob([data], type ? { type } : undefined)),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
// the reason a save failed, in words
const saveError = (e, what) =>
  e && e.code === "declined"
    ? `${what} cancelled`
    : e && e.code === "rate_limited"
      ? "A save prompt is already open. Finish that one first"
      : `${what} failed: ${(e && e.message) || "unknown error"}`;

// "working…" on the corner label while any job says it is busy: busyFor("trace" | "optimize" | "threshold", on).
// Each job clears only its own reason, so one finishing doesn't hide another that is still running.
const busyReasons = new Set();
function busyFor(why, on) {
  if (on) busyReasons.add(why);
  else busyReasons.delete(why);
  $("chip").classList.toggle("busy", busyReasons.size > 0);
}
