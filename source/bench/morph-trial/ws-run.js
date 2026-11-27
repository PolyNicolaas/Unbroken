const { wordShape, FONTS } = require("./wordshape.js");
const { createCanvas } = require("/home/claude/Unbroken/source/tests/node_modules/@napi-rs/canvas");
const fs = require("fs");
const words = (process.argv[2] || "NV,BOAT,Nicolaas,Happy,abcdefg,hijklmn,opqrstu,vwxyz,ABCDEFGH,IJKLMNOP,QRSTUVWXYZ").split(",");
const font = process.argv[3] || "pebble";
const rows = words.map((t) => { const t0 = Date.now(); const r = wordShape(t, { font, cap: 20 }); r.ms = Date.now() - t0; return r; });
const sc = +(process.env.SC || 4), W = Math.max(...rows.map((r) => r.w * r.g * sc)) + 40, H = rows.reduce((a, r) => a + r.h * r.g * sc + 30, 0);
const cv = createCanvas(W, H), g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
let y0 = 0;
rows.forEach((r, k) => {
  const ox = 20, oy = y0 + 25;
  g.fillStyle = "#000"; g.font = "15px sans-serif"; g.fillText(`${words[k]} (${font}): ${r.stats.loops} loop${r.stats.loops > 1 ? "s" : ""}, ${r.stats.slits} slits, ${r.stats.filled} filled, ${r.stats.joins} joins, ${r.stats.dots} dots, ${r.ms} ms`, ox, oy - 8);
  // centre lines faint
  g.strokeStyle = "#ccc"; g.lineWidth = 1;
  r.lay.strokes.forEach((st) => { g.beginPath(); for (let i = 0; i < st.length; i += 2) { const X = ox + (st[i] + r.pad) * sc, Y = oy + (st[i + 1] + r.pad) * sc; i ? g.lineTo(X, Y) : g.moveTo(X, Y); } g.stroke(); });
  r.drawLoops.forEach((L, q) => { g.strokeStyle = q ? "#d00" : "#1a4a8a"; g.lineWidth = 2; g.beginPath(); L.forEach(([x, y], i) => { const X = ox + (x + r.pad) * sc, Y = oy + (y + r.pad) * sc; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.closePath(); g.stroke(); });
  y0 += r.h * r.g * sc + 30;
});
fs.writeFileSync(`out/ws-${font}.png`, cv.toBuffer("image/png"));
