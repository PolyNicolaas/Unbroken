// draw a centerline font's capitals as strokes
const { createCanvas } = require("../../../tests/node_modules/@napi-rs/canvas");
const F = require("../../../engine/fonts.js"), fs = require("fs");
const CH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ!?";
for (const name of process.argv.slice(2)) {
  const f = F[name], cols = 14, S = 0.12, cw = 110, rh = 120, cv = createCanvas(cols * cw, 2 * rh), g = cv.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.strokeStyle = "#5a3a22"; g.lineWidth = 2;
  [...CH].forEach((ch, i) => { const gl = f.glyphs[ch]; if (!gl) return; const ox = (i % cols) * cw + 10, oy = Math.floor(i / cols) * rh + 100;
    for (const st of gl[1].split("|")) { const P = st.trim().split(/\s+/).map((p) => p.split(",").map(Number)); g.beginPath(); P.forEach(([x, y], k) => (k ? g.lineTo(ox + x * S, oy - y * S) : g.moveTo(ox + x * S, oy - y * S))); g.stroke(); } });
  fs.writeFileSync(name + "-lines.png", cv.toBuffer("image/png"));
}
