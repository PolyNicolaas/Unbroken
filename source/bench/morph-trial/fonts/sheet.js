// show each trial font: the raw glyph outlines, and what the morph makes of them (one closed outline)
const { createCanvas } = require("../../../tests/node_modules/@napi-rs/canvas");
const UNB = require("../../../engine/core.js"), fs = require("fs"), FONTS = Object.assign({}, require("./fonts.js"), require("./fonts2.js"));
for (const k of process.argv.slice(2)) {
  const font = FONTS[k](), CH = Object.keys(font.glyphs), cols = 14, cw = 110, rh = 130;
  fs.writeFileSync(k + ".json", JSON.stringify(font));
  const cv = createCanvas(cols * cw, 2 * rh + 10), g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
  const info = [];
  CH.forEach((ch, i) => {
    const L = UNB.morphLetter(ch, font, { cap: 20, d: 1.34 }); if (!L) { info.push(ch + ":null"); return; }
    const ox = (i % cols) * cw + 15, oy = Math.floor(i / cols) * rh + 25, s = 4;
    g.fillStyle = "#f3e9e0"; g.strokeStyle = "#5a3a22"; g.lineWidth = 1.5; g.beginPath();
    L.x.forEach((x, j) => (j ? g.lineTo(ox + x * s, oy - L.y[j] * s) : g.moveTo(ox + x * s, oy - L.y[j] * s))); g.closePath(); g.fill(); g.stroke();
    if (L.loops !== 1 || L.slits || L.filled) info.push(`${ch}:${L.loops}l/${L.slits}s/${L.filled}f`);
  });
  fs.writeFileSync(k + ".png", cv.toBuffer("image/png"));
  console.log(k, info.join(" "));
}
