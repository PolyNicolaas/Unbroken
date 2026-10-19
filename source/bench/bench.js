// Trace-quality benchmark: traces a set of drawings and photos with the app's own pipeline (the tests' lib/trace.js)
// and reports the numbers that describe a printable line, plus a side-by-side picture per image.
// usage (from this folder): node bench.js [out dir] [image filter]
// For pass/fail checks see ../tests; this is for exploring and comparing.
const path = require("path"), fs = require("fs");
const S = require("../tests/lib/scenes.js"), { trace } = require("../tests/lib/trace.js");
const { createCanvas } = S;
const OUT = process.argv[2] || "out", FILTER = process.argv[3] || "";
fs.mkdirSync(OUT, { recursive: true });

// [name, trace style, photo?]
const SET = [["leaf", "centerline"], ["shapes", "centerline"], ["smiley", "centerline"],
  ["text", "centerline", 1], ["logo", "centerline", 1], ["horse", "centerline", 1],
  ["camera", "edges", 1], ["astronaut", "edges", 1], ["coffee", "edges", 1], ["cat", "edges", 1], ["rocket", "edges", 1]];

// left: detected lines (blue kept, orange dropped) over the faint source; right: final line, connectors orange
function render(file, src, r) {
  const K = 2, W = r.w * K, H = r.h * K, c = createCanvas(W * 2 + 10, H), g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  g.globalAlpha = 0.25; g.drawImage(src, 0, 0, W, H); g.globalAlpha = 1;
  const im = g.getImageData(0, 0, W, H);
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    const i = y * r.w + x; if (!r.lines[i]) continue; const kept = r.walk.mask[i];
    for (let dy = 0; dy < K; dy++) for (let dx = 0; dx < K; dx++) { const o = 4 * ((y * K + dy) * W + x * K + dx); im.data[o] = kept ? 20 : 230; im.data[o + 1] = kept ? 80 : 120; im.data[o + 2] = kept ? 200 : 30; im.data[o + 3] = 255; }
  }
  g.putImageData(im, 0, 0);
  const ox = W + 10, f = r.fin.final, J = r.fin.jumpF;
  g.lineWidth = 1;
  for (let s = 1; s <= f.re.length; s++) {
    const a = s - 1, b = s % f.re.length; if (b === 0 && r.open) break;
    g.strokeStyle = J[a] ? "rgba(230,110,20,0.9)" : "#111"; g.beginPath(); g.moveTo(ox + f.re[a] * K, f.im[a] * K); g.lineTo(ox + f.re[b] * K, f.im[b] * K); g.stroke();
  }
  fs.writeFileSync(file, c.toBuffer("image/png"));
}

(async () => {
  const rows = [];
  for (const [name, mode, photo] of SET) {
    if (FILTER && !name.match(FILTER)) continue;
    if (photo && !S.hasImage(name)) { console.log(`${name.padEnd(10)} skipped (run: python3 make_images.py)`); continue; }
    const src = photo ? await S.image(name) : S.sample(name), r = trace(src, { mode });
    if (!r.walk) { console.log(name, "no lines"); continue; }
    render(path.join(OUT, name + ".png"), src, r);
    let len = 0; for (let i = 1; i < r.walk.px.length; i++) len += Math.hypot(r.walk.px[i] - r.walk.px[i - 1], r.walk.py[i] - r.walk.py[i - 1]);
    const row = { name, mode, N: r.N, err: +r.fin.err.score.toFixed(3), parts: r.walk.nParts, dropped: r.walk.dropped, pathRatio: +(len / r.walk.linePix).toFixed(2),
      doubled: +r.walk.doubledFrac.toFixed(3), jumpLen: Math.round(r.walk.jumpLen), crossBefore: r.fin.before, crossAfter: r.fin.after, ms: Math.round(r.ms.total) };
    rows.push(row);
    console.log(`${name.padEnd(10)} ${mode.padEnd(10)} N=${String(row.N).padStart(4)} err=${row.err.toFixed(2)} parts=${row.parts} drop=${row.dropped} path/pix=${row.pathRatio} doubled=${(100 * row.doubled).toFixed(0)}% jumps=${row.jumpLen}px crossings ${row.crossBefore}→${row.crossAfter} ${row.ms}ms`);
  }
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(rows, null, 1));
  const avg = (k) => (rows.reduce((a, r) => a + r[k], 0) / rows.length).toFixed(3);
  console.log(`MEAN err=${avg("err")} N=${avg("N")} pathRatio=${avg("pathRatio")} doubled=${avg("doubled")} crossings before untangle=${avg("crossBefore")}`);
})();
