// each glyph alone, in a grid, large; then a few words with punctuation
const { wordShape } = require("./wordshape.js");
const { createCanvas } = require("/home/claude/Unbroken/source/tests/node_modules/@napi-rs/canvas");
const fs = require("fs");
const items = (process.argv[2] || "A|B|C|D|E|F|G|H|I|J|K|L|M|N|O|P|Q|R|S|T|U|V|W|X|Y|Z|HI!|WHY?|YES, NO.|X-RAY|DON'T|BOAT|NV").split("|");
const cap = 20, sc = 5.5, cell = 150, cols = 9;
const res = items.map((t) => { try { return { t, r: wordShape(t, { cap }) }; } catch (e) { return { t, err: e.message }; } });
const wide = (x) => x.r ? x.r.w * x.r.g * sc + 20 : cell;
// lay out rows
const rows = []; let row = [], rw = 0; const Wmax = cols * cell;
for (const x of res) { const ww = Math.max(cell, wide(x)); if (rw + ww > Wmax && row.length) { rows.push(row); row = []; rw = 0; } row.push([x, ww]); rw += ww; }
rows.push(row);
const cv = createCanvas(Wmax, rows.length * 190), g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
rows.forEach((R, ri) => { let ox = 0; R.forEach(([x, ww]) => {
  const oy = ri * 190; g.fillStyle = "#000"; g.font = "13px sans-serif";
  if (x.err) { g.fillText(`${x.t}: ${x.err}`, ox + 5, oy + 15); ox += ww; return; }
  const r = x.r, bad = r.stats.loops !== 1; g.fillStyle = bad ? "#c00" : "#555"; g.fillText(`${x.t}  ${r.stats.loops} loop · ${r.stats.slits} slit · ${r.stats.joins} join`, ox + 5, oy + 15);
  g.strokeStyle = "#ddd"; g.lineWidth = 1; r.lay.strokes.forEach((st) => { g.beginPath(); for (let i = 0; i < st.length; i += 2) { const X = ox + 10 + (st[i] + r.pad) * sc, Y = oy + 20 + (st[i + 1] + r.pad) * sc; i ? g.lineTo(X, Y) : g.moveTo(X, Y); } g.stroke(); });
  r.drawLoops.forEach((L, q) => { g.strokeStyle = q ? "#d00" : "#1a4a8a"; g.lineWidth = 2; g.beginPath(); L.forEach(([X0, Y0], i) => { const X = ox + 10 + (X0 + r.pad) * sc, Y = oy + 20 + (Y0 + r.pad) * sc; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.closePath(); g.stroke(); });
  ox += ww; }); });
fs.writeFileSync("out/ws-grid.png", cv.toBuffer("image/png"));
console.log(res.filter((x) => x.err || x.r.stats.loops !== 1).map((x) => x.t + ":" + (x.err || x.r.stats.loops)).join(" ") || "all one loop");
