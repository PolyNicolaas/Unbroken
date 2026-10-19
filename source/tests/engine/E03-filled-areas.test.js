const S = require("../lib/scenes.js"), { check } = require("../lib/check.js"), UNB = require("../../engine/core.js"), { workingImage } = require("../lib/trace.js");
function parts(src, split) {
  const { w, h, gray } = workingImage(src, 500), bl = UNB.blur(gray, w, h, 1.2);
  const lines = UNB.centerline(bl, w, h, 0, undefined, undefined, split);
  const walk = UNB.buildWalk(lines, w, h, { minPix: 15, maxJump: 0, open: false });
  let ink = 0; for (let i = 0; i < lines.length; i++) ink += lines[i];
  return { parts: walk ? walk.nParts : 0, ink };
}
module.exports = {
  id: "E03", title: "Filled areas are not broken up by stroke splitting",
  guards: "holes punched in pale fills; a logo turning into dozens of specks",
  why: "Stroke splitting (E02) cuts along light valleys inside dark areas. Inside a pale filled area, faint texture also makes light valleys; a first version cut those too and turned the logo's fills into 50 small outlines. Splitting must only happen where it leaves thin strokes.",
  how: "Draws pale filled shapes with faint darker texture lines and noise inside (like a printed logo), and traces with splitting on and off; repeats on the logo photo if the bench images are present.",
  pass: "Splitting on gives the same number of parts as splitting off, and the traced line length changes by under 5%, for the synthetic fills and the logo.",
  async run() {
    const c = S.createCanvas(640, 480), g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, 640, 480);
    g.fillStyle = "#e8cfb8"; g.beginPath(); g.arc(220, 240, 170, 0, 7); g.fill(); g.fillStyle = "#d6e6c8"; g.fillRect(380, 80, 220, 320);
    g.strokeStyle = "rgba(120,100,90,0.35)"; g.lineWidth = 2;
    for (let y = 100; y < 400; y += 24) for (let x = 60; x < 600; x += 28) { g.beginPath(); for (let k = 0; k < 7; k++) { const a = k * Math.PI / 3; const px = x + 11 * Math.cos(a), py = y + 11 * Math.sin(a); k ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); }
    const im = g.getImageData(0, 0, 640, 480); let seed = 7; for (let i = 0; i < im.data.length; i += 4) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; const n = (seed % 9) - 4; for (let k = 0; k < 3; k++) im.data[i + k] = Math.max(0, Math.min(255, im.data[i + k] + n)); } g.putImageData(im, 0, 0);
    const checks = [], notes = [];
    const cases = [["synthetic fills", c]]; if (S.hasImage("logo")) cases.push(["logo photo", await S.image("logo")]);
    for (const [name, src] of cases) {
      const off = parts(src, 0), on = parts(src, 0.1);
      checks.push(check(`${name}: parts with splitting (without: ${off.parts})`, on.parts, "<=", off.parts), check(`${name}: line length change`, Math.abs(on.ink - off.ink) / Math.max(1, off.ink), "<", 0.05));
      notes.push(`${name}: ${off.parts} → ${on.parts} parts, ${off.ink} → ${on.ink} line px`);
    }
    return { checks, notes: notes.join("  \n") + (S.hasImage("logo") ? "" : "  \nLogo photo not present (run `npm run images`): synthetic fills only.") };
  },
};
