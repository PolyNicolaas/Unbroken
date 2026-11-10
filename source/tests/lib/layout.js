// Layout checks run in the page (page.evaluate(LAYOUT_AUDIT)): text over other text, text over a control it isn't
// part of, text cut off by its box, the page scrolling sideways, text off the screen. Hidden parts (display none,
// closed menus) and the phone's pinned preview, which the page scrolls under on purpose, aren't counted; nor is a
// row of example chips that scrolls sideways by design. Returns a list of findings, each a sentence.
const LAYOUT_AUDIT = () => {
  const vis = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === "none" || s.visibility === "hidden" || +s.opacity === 0) return false; if (e.parentElement && e.parentElement.tagName === "DETAILS" && !e.parentElement.open && e.tagName !== "SUMMARY") return false; } return true; };
  const name = (el) => { const id = el.id || (el.closest("[id]") || {}).id || ""; return `${el.tagName.toLowerCase()}${id ? "#" + id : ""}${el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : ""}`; };
  // (a pinned part, the phone's preview, has the page scrolling under it on purpose)
  const pinned = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === "sticky" || p === "fixed") return e; } return null; };
  const texts = [], boxes = [], out = [];
  const W = innerWidth, H = document.documentElement.scrollHeight;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walker.nextNode()); ) {
    const t = n.textContent.trim();
    if (!t || !n.parentElement || ["SCRIPT", "STYLE", "OPTION", "TITLE"].includes(n.parentElement.tagName)) continue;
    if (n.parentElement.closest("select, [hidden], template, .sr-only")) continue;
    if (!vis(n.parentElement)) continue;
    const r = document.createRange(); r.selectNodeContents(n);
    for (const b of r.getClientRects()) if (b.width > 1 && b.height > 1) texts.push({ el: n.parentElement, t: t.slice(0, 40), b });
  }
  for (const el of document.querySelectorAll("input:not([type=hidden]):not([type=radio]):not([type=checkbox]), select, canvas, button, textarea")) {
    if (!vis(el)) continue; const b = el.getBoundingClientRect(); if (b.width > 1 && b.height > 1) boxes.push({ el, b });
  }
  const ov = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  // text over text (different elements)
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], b = texts[j]; if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue; if (pinned(a.el) !== pinned(b.el)) continue;
    const o = ov(a.b, b.b), m = Math.min(a.b.width * a.b.height, b.b.width * b.b.height);
    if (o > 4 && o > 0.12 * m) out.push(`text over text: "${a.t}" (${name(a.el)}) × "${b.t}" (${name(b.el)})`);
  }
  // text over a control it isn't part of
  for (const a of texts) for (const c of boxes) {
    if (pinned(a.el) !== pinned(c.el) || c.el.contains(a.el) || a.el.contains(c.el) || (c.el.tagName === "CANVAS" && a.el.closest(".map, #mapBox, .stage, .view"))) continue;
    if (c.el.tagName === "CANVAS") { /* labels drawn over canvases on purpose (overlays) are skipped below */ if (a.el.closest("[class*=overlay], .ov, .badge, .tag, .readout, .chip, .legend, .zoom, .layer-bar")) continue; }
    const o = ov(a.b, c.b), m = a.b.width * a.b.height;
    if (o > 6 && o > 0.25 * m) out.push(`text over ${c.el.tagName.toLowerCase()}: "${a.t}" (${name(a.el)}) × ${name(c.el)}`);
  }
  // clipped text: wider than its box where the box hides the rest
  for (const el of document.querySelectorAll("body *")) {
    if (!el.childNodes.length || !vis(el) || ["svg", "SVG", "CANVAS", "SELECT", "INPUT", "TEXTAREA", "OPTION"].includes(el.tagName)) continue;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const s = getComputedStyle(el);
    if ((s.overflowX !== "visible" || s.textOverflow === "ellipsis") && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) out.push(`clipped: "${el.textContent.trim().slice(0, 40)}" (${name(el)}) ${el.scrollWidth}>${el.clientWidth}`);
  }
  // off the page sideways
  if (document.documentElement.scrollWidth > W + 1) out.push(`page scrolls sideways: ${document.documentElement.scrollWidth} > ${W}`);
  for (const a of texts) if ((a.b.right > W + 1 || a.b.left < -1) && !a.el.closest(".examples .chips")) out.push(`text off screen: "${a.t}" (${name(a.el)}) ${Math.round(a.b.left)}–${Math.round(a.b.right)} of ${W}`);
  return [...new Set(out)];
};
module.exports = { LAYOUT_AUDIT };
