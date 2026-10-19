// Test drawings. Synthetic scenes are drawn in code, so their true line is known exactly (the "truth").
// Photos come from ../bench/images (made by ../bench/make_images.py); tests that need them skip when missing.
const path = require("path"), fs = require("fs");
const { createCanvas, loadImage } = require("@napi-rs/canvas");

const IMAGES = path.resolve(__dirname, "../../bench/images");
const hasImage = (name) => fs.existsSync(path.join(IMAGES, name + ".png"));
async function image(name) {
  const img = await loadImage(fs.readFileSync(path.join(IMAGES, name + ".png")));
  const c = createCanvas(img.width, img.height), g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0);
  return c;
}

// the app's built-in samples (copied from web-app/index.html makeSample)
function sample(kind) {
  const c = createCanvas(640, 480), g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, 640, 480); g.strokeStyle = "#000"; g.fillStyle = "#000"; g.lineCap = "round"; g.lineJoin = "round";
  if (kind === "smiley") {
    g.lineWidth = 9; g.beginPath(); g.arc(320, 220, 170, 0, 7); g.stroke();
    g.beginPath(); g.arc(255, 170, 22, 0, 7); g.fill(); g.beginPath(); g.arc(385, 170, 22, 0, 7); g.fill();
    g.beginPath(); g.arc(320, 230, 95, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke();
    g.font = "bold 64px serif"; g.textAlign = "center"; g.fillText("Hi", 320, 460);
  } else if (kind === "shapes") {
    g.font = "bold 110px serif"; g.fillText("Fourier", 60, 140);
    for (let i = 0; i < 6; i++) { g.lineWidth = 5; g.beginPath(); g.arc(80 + i * 96, 270, 26 + i * 4, 0, 7); g.stroke(); }
    g.lineWidth = 5; g.strokeRect(50, 370, 540, 60); g.beginPath(); g.moveTo(50, 370); g.lineTo(590, 430); g.stroke();
  } else {
    g.lineWidth = 6; g.beginPath(); g.moveTo(140, 400); g.bezierCurveTo(150, 220, 330, 80, 520, 70); g.bezierCurveTo(500, 260, 340, 400, 140, 400); g.stroke();
    g.beginPath(); g.moveTo(140, 400); g.quadraticCurveTo(320, 240, 500, 90); g.stroke(); g.lineWidth = 4;
    for (const [x0, y0, x1, y1] of LEAF_VEINS) { g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + 10, (y0 + y1) / 2, x1, y1); g.stroke(); }
    g.lineWidth = 7; g.beginPath(); g.moveTo(140, 400); g.quadraticCurveTo(110, 430, 90, 450); g.stroke();
  }
  return c;
}
const LEAF_VEINS = [[230, 318, 225, 245], [290, 266, 305, 180], [350, 214, 380, 140], [410, 163, 445, 110], [260, 292, 330, 330], [325, 240, 400, 270], [390, 186, 460, 200]];

// ---- truth helpers: dense points along each primitive (0.15 px apart), in source px
const arc = (cx, cy, r, a0, a1) => { const p = [], n = Math.ceil(Math.abs(a1 - a0) * r / 0.15); for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return p; };
const seg = (x0, y0, x1, y1) => { const p = [], n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.15); for (let i = 0; i <= n; i++) p.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]); return p; };
const bez = (P) => { const p = []; for (let i = 0; i <= 3000; i++) { const t = i / 3000, u = 1 - t; p.push([0, 1].map((k) => P.length === 4 ? u * u * u * P[0][k] + 3 * u * u * t * P[1][k] + 3 * u * t * t * P[2][k] + t * t * t * P[3][k] : u * u * P[0][k] + 2 * u * t * P[1][k] + t * t * P[2][k])); } return p; };

// Ground-truth scenes (640 × 480 source, traced at 500 px wide like the app's default)
const TRUTH = {
  rings: { mode: "centerline", why: "thick and thin round strokes",
    draw(g) { g.lineWidth = 9; g.beginPath(); g.arc(320, 220, 170, 0, 7); g.stroke(); g.lineWidth = 6; g.beginPath(); g.arc(320, 230, 95, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke(); },
    truth: () => [...arc(320, 220, 170, 0, 7), ...arc(320, 230, 95, 0.25 * Math.PI, 0.75 * Math.PI)] },
  shapes: { mode: "centerline", why: "small circles, straight edges, corners, a diagonal through a box",
    draw(g) { for (let i = 0; i < 6; i++) { g.lineWidth = 5; g.beginPath(); g.arc(80 + i * 96, 170, 26 + i * 4, 0, 7); g.stroke(); } g.lineWidth = 5; g.strokeRect(50, 300, 540, 100); g.beginPath(); g.moveTo(50, 300); g.lineTo(590, 400); g.stroke(); },
    truth: () => { let t = []; for (let i = 0; i < 6; i++) t = t.concat(arc(80 + i * 96, 170, 26 + i * 4, 0, 7)); return t.concat(seg(50, 300, 590, 300), seg(590, 300, 590, 400), seg(590, 400, 50, 400), seg(50, 400, 50, 300), seg(50, 300, 590, 400)); } },
  leaf: { mode: "centerline", why: "free curves, junctions and branch tips (the app's leaf)",
    draw(g) { g.lineWidth = 6; g.beginPath(); g.moveTo(140, 400); g.bezierCurveTo(150, 220, 330, 80, 520, 70); g.bezierCurveTo(500, 260, 340, 400, 140, 400); g.stroke(); g.beginPath(); g.moveTo(140, 400); g.quadraticCurveTo(320, 240, 500, 90); g.stroke(); g.lineWidth = 4;
      for (const [x0, y0, x1, y1] of LEAF_VEINS) { g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + 10, (y0 + y1) / 2, x1, y1); g.stroke(); } },
    truth: () => { let t = [...bez([[140, 400], [150, 220], [330, 80], [520, 70]]), ...bez([[520, 70], [500, 260], [340, 400], [140, 400]]), ...bez([[140, 400], [320, 240], [500, 90]])];
      for (const [x0, y0, x1, y1] of LEAF_VEINS) t = t.concat(bez([[x0, y0], [(x0 + x1) / 2 + 10, (y0 + y1) / 2], [x1, y1]])); return t; } },
  close: { mode: "centerline", why: "lines 9–13 px apart, and two groups far from each other",
    draw(g) { g.lineWidth = 4; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(200, 240, 40 + i * 12, 0, 7); g.stroke(); } g.lineWidth = 3; g.beginPath(); for (let a = 0; a < 6 * Math.PI; a += 0.01) { const r = 10 + 17 * a / (2 * Math.PI); const x = 480 + r * Math.cos(a), y = 240 + r * Math.sin(a); a ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); },
    truth: () => { let t = []; for (let i = 0; i < 5; i++) t = t.concat(arc(200, 240, 40 + i * 12, 0, 7)); for (let a = 0; a < 6 * Math.PI; a += 0.001) { const r = 10 + 17 * a / (2 * Math.PI); t.push([480 + r * Math.cos(a), 240 + r * Math.sin(a)]); } return t; } },
  filled: { mode: "edges", why: "Outline mode on filled shapes: circle, rotated ellipse, rectangle",
    draw(g) { g.fillStyle = "#333"; g.beginPath(); g.arc(180, 200, 110, 0, 7); g.fill(); g.beginPath(); g.ellipse(470, 260, 120, 70, 0.4, 0, 7); g.fill(); g.fillRect(80, 360, 200, 80); },
    truth: () => { const t = [...arc(180, 200, 110, 0, 7)], c = Math.cos(0.4), s = Math.sin(0.4); for (let a = 0; a < 7; a += 0.001) { const x = 120 * Math.cos(a), y = 70 * Math.sin(a); t.push([470 + x * c - y * s, 260 + x * s + y * c]); } return t.concat(seg(80, 360, 280, 360), seg(280, 360, 280, 440), seg(280, 440, 80, 440), seg(80, 440, 80, 360)); } },
};
function truthCanvas(sc) {
  const c = createCanvas(640, 480), g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, 640, 480); g.strokeStyle = "#000"; g.fillStyle = "#000"; g.lineCap = g.lineJoin = "round"; sc.draw(g);
  return c;
}

// Packed strokes, drawn at working size (500 × 375) directly. gap = centre-to-centre spacing, lw = stroke width, px.
function packed(kind, gap, lw) {
  const W = 500, H = 375, c = createCanvas(W, H), g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); g.strokeStyle = "#000"; g.lineWidth = lw; g.lineCap = g.lineJoin = "round";
  const T = [];
  if (kind === "rings") for (let i = 0; i < 6; i++) { const r = 40 + i * gap; g.beginPath(); g.arc(250, 187, r, 0, 7); g.stroke(); for (let a = 0; a < 2 * Math.PI; a += 0.15 / r) T.push([250 + r * Math.cos(a), 187 + r * Math.sin(a)]); }
  if (kind === "lines") for (let i = 0; i < 8; i++) { const y = 120 + i * gap; g.beginPath(); g.moveTo(80, y); g.lineTo(420, y + 30); g.stroke(); for (let t = 0; t <= 1; t += 0.0004) T.push([80 + 340 * t, y + 30 * t]); }
  if (kind === "spiral") { g.beginPath(); for (let a = 0; a < 8 * Math.PI; a += 0.005) { const r = 12 + gap * a / (2 * Math.PI); const x = 250 + r * Math.cos(a), y = 187 + r * Math.sin(a); a ? g.lineTo(x, y) : g.moveTo(x, y); T.push([x, y]); } g.stroke(); }
  return { canvas: c, truth: T.map(([x, y]) => [x - 0.5, y - 0.5]) };   // pixel-centre convention
}

module.exports = { sample, image, hasImage, IMAGES, TRUTH, truthCanvas, packed, createCanvas };
