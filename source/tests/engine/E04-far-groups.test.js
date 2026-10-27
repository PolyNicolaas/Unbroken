const S = require("../lib/scenes.js"), { check } = require("../lib/check.js"), UNB = require("../../engine/core.js"), { workingImage } = require("../lib/trace.js");
module.exports = {
  id: "E04", title: "Far-away groups: specks dropped, real elements kept",
  guards: "half a drawing silently disappearing",
  why: "\"Drop far-away parts\" exists to remove stray specks. It used to keep only the group around the single biggest piece, so a cluster of rings next to a spiral (seven smaller pieces) was thrown away entirely.",
  how: "Draws five concentric rings on the left, a spiral on the right (well beyond the 12% jump limit) and one short stray mark in a far corner, then builds the walk with the app's default far-part limit.",
  pass: "All 6 real parts (5 rings + spiral) are kept, and exactly 1 part (the stray mark) is dropped.",
  async run() {
    const c = S.createCanvas(900, 600), g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, 900, 600); g.strokeStyle = "#000"; g.lineCap = "round";
    g.lineWidth = 4; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(220, 300, 60 + i * 14, 0, 7); g.stroke(); }
    g.beginPath(); for (let a = 0; a < 8 * Math.PI; a += 0.01) { const r = 14 + 11 * a / (2 * Math.PI); const x = 680 + r * Math.cos(a), y = 300 + r * Math.sin(a); a ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    g.beginPath(); g.moveTo(860, 560); g.lineTo(885, 565); g.stroke();                       // stray mark, far corner
    const { w, h, gray } = workingImage(c, 500), bl = UNB.blur(gray, w, h, 1.2);
    const walk = UNB.stageTrace({ blurred: bl, mode: "centerline", sens: 0 }, w, h, { minPix: 6, maxJump: 0.12 * Math.hypot(w, h), open: false, jumpCost: 2 }, { blurred: bl, edges: false });
    return { checks: [check("parts kept", walk.nParts, "==", 6), check("parts dropped", walk.dropped, "==", 1)] };
  },
};
