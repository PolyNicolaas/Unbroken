// Unbroken · web app · scroll.js
// The settings and the preview while you scroll. The preview stays in view (app.css: a sticky column on wide screens,
// a compact pinned preview on phones, with Bigger / Smaller here). The Wheel: the settings scroll like a drum — when
// the scrolling stops, the card at the top of the settings opens and the others fold to their headers (their readouts
// still show), and cards away from it tip back a little. The Wheel switch turns it off (and puts every card back as you
// left it); it's remembered in this browser.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// ---------- the phone's pinned preview: compact, or bigger with its tools ----------
const PV_KEY = storeKey("preview");
function pvSet(big) {
  document.body.dataset.pv = big ? "big" : "pinned";
  $("pvSize").textContent = big ? "Smaller" : "Bigger";
  $("pvSize").setAttribute("aria-pressed", String(big));
  try {
    localStorage.setItem(PV_KEY, big ? "big" : "pinned");
  } catch {}
  wheelSnapTop();
}
$("pvSize").addEventListener("click", () => pvSet(document.body.dataset.pv !== "big"));
try {
  pvSet(localStorage.getItem(PV_KEY) === "big");
} catch {
  pvSet(false);
}

// ---------- the Wheel ----------
const WHEEL_KEY = storeKey("wheel");
const wheelOn = () => $("wheel").checked;
const calm = matchMedia("(prefers-reduced-motion: reduce)");
// the cards of the step in use, top to bottom
const stepCards = () =>
  [...document.querySelectorAll(".panel section.card")].filter((c) => c.offsetParent && !c.classList.contains("notes"));
// where a card lands: just under the pinned preview on a phone, near the top of the window otherwise
function landingY() {
  const left = document.querySelector(".left"),
    pinned = getComputedStyle(left).position === "sticky" && innerWidth < 900;
  return pinned ? left.getBoundingClientRect().bottom + 8 : 16;
}
function wheelSnapTop() {
  // (a card brought into view clears the pinned preview: app.css)
  document.documentElement.style.setProperty("--snap-top", `${Math.max(8, Math.round(landingY()))}px`);
}
let landed = null;
// the card at the landing line: the last whose top has reached it (or the first)
function cardAtLanding() {
  const y = landingY() + 40,
    cards = stepCards();
  let at = cards[0] || null;
  for (const c of cards) if (c.getBoundingClientRect().top <= y) at = c;
  return at;
}
function land(force) {
  if (!wheelOn() || !cardSetOpen) return;
  const card = cardAtLanding();
  if (!card || (card === landed && !force && !card.classList.contains("collapsed"))) return;
  landed = card;
  // folding the cards above moves this one up: scroll by as much, so it stays where it landed
  const top0 = card.getBoundingClientRect().top;
  for (const c of stepCards()) if (c !== card && !c.classList.contains("collapsed")) cardSetOpen(c, false, false);
  if (card.classList.contains("collapsed")) cardSetOpen(card, true, false);
  const moved = card.getBoundingClientRect().top - top0;
  if (Math.abs(moved) > 1) scrollBy(0, moved);
  tilt();
}
// cards away from the landing line tip back and fade a little, like a drum turning
function tilt() {
  const on = wheelOn() && !calm.matches,
    y0 = landingY(),
    H = innerHeight;
  for (const c of stepCards()) {
    if (!on || c === landed) {
      c.style.transform = c.style.opacity = "";
      continue;
    }
    const r = c.getBoundingClientRect(),
      d = Math.max(-1, Math.min(1, (r.top + Math.min(r.height, 120) / 2 - y0 - 40) / H));
    c.style.transform = `perspective(900px) rotateX(${(-d * 12).toFixed(2)}deg) scale(${(1 - Math.abs(d) * 0.04).toFixed(3)})`;
    c.style.opacity = (1 - Math.abs(d) * 0.35).toFixed(2);
  }
}
let tiltFrame = 0,
  landTimer = null;
addEventListener(
  "scroll",
  () => {
    if (!wheelOn()) return;
    if (!tiltFrame)
      tiltFrame = requestAnimationFrame(() => {
        tiltFrame = 0;
        tilt();
      });
    clearTimeout(landTimer);
    landTimer = setTimeout(() => land(), 160); // when the scrolling stops (scrollend isn't everywhere yet)
  },
  { passive: true }
);
addEventListener("resize", () => {
  wheelSnapTop();
  tilt();
});
function wheelChanged() {
  document.body.classList.toggle("wheel", wheelOn());
  try {
    localStorage.setItem(WHEEL_KEY, wheelOn() ? "on" : "off");
  } catch {}
  landed = null;
  if (wheelOn()) {
    wheelSnapTop();
    land(true);
  } else {
    tilt(); // (clears the tilt)
    if (cardRestore) cardRestore();
  }
}
$("wheel").addEventListener("change", wheelChanged);
// a new step: its first card opens
document.querySelectorAll('input[name="view"]').forEach((r) =>
  r.addEventListener("change", () => {
    landed = null;
    requestAnimationFrame(() => land(true));
  })
);
try {
  if (localStorage.getItem(WHEEL_KEY) === "off") $("wheel").checked = false;
} catch {}
wheelChanged();
